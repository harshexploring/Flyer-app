// ============================================================
// Room — one multiplayer game room, fully server-authoritative.
//
// Lifecycle: lobby → playing → (game:over) → lobby again.
// The server broadcasts every round's word to all players at
// the same moment, collects answers (reaction time is measured
// on each client so network lag doesn't punish anyone), judges
// after the answer window + a network grace period, eliminates
// wrong/late players, and keeps going until one player is left
// (or none, in a solo room / a draw).
//
// To scale beyond 5 players, change GAME_CONFIG.maxPlayers.
// Nothing else in the codebase assumes a specific count.
// ============================================================

export const GAME_CONFIG = {
  maxPlayers: 5,
  startWindowMs: 2000, // answer window for the first word
  shrinkPerWordMs: 50, // window shrinks this much every word
  minWindowMs: 700,    // window never goes below this
  graceMs: 600,        // extra time for answers to travel the network
  resultPauseMs: 1700, // pause between rounds (client animations play here)
  startDelayMs: 900,   // pause between "game:start" and the first word
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Room {
  constructor(io, code, words) {
    this.io = io;
    this.code = code;
    this.words = words;
    this.creatorId = null;    // the room dies when this player leaves
    this.players = new Map(); // id → player record
    this.phase = 'lobby';     // 'lobby' | 'playing' | 'over'
    this.round = 0;
    this.deck = [];
    this.currentWord = null;
    this.answers = new Map(); // id → { action, reactionMs } for this round
    this.deadlineTimer = null;
    this.nextTimer = null;
  }

  emit(event, data) {
    this.io.to(this.code).emit(event, data);
  }

  get connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  get alivePlayers() {
    return this.connectedPlayers.filter((p) => p.alive);
  }

  publicPlayers() {
    return this.connectedPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
    }));
  }

  broadcastLobby() {
    this.emit('lobby:update', {
      code: this.code,
      players: this.publicPlayers(),
      maxPlayers: GAME_CONFIG.maxPlayers,
    });
  }

  // ---------------- Lobby ----------------

  addPlayer(socket, rawName) {
    const isCreator = this.connectedPlayers.length === 0;
    if (isCreator) this.creatorId = socket.id;
    const name =
      String(rawName || '').trim().slice(0, 16) ||
      `Player ${this.players.size + 1}`;
    const player = {
      id: socket.id,
      socket,
      name,
      isHost: isCreator,
      connected: true,
      alive: false,
      correctCount: 0,
      reactionTimes: [],
      eliminatedRound: null,
    };
    this.players.set(player.id, player);
    socket.join(this.code);
    this.broadcastLobby();
    return player;
  }

  // Removes a NON-creator player. (When the creator leaves, the
  // whole room is closed instead — see close() and server/index.js.)
  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;

    if (this.phase === 'playing') {
      // Mid-game: leaving means elimination, but keep the record
      // so the final report still lists them.
      player.connected = false;
      if (player.alive) {
        player.alive = false;
        player.eliminatedRound = this.round;
        this.emit('player:left', { id, name: player.name });
        // If everyone left answers, don't wait for the deadline.
        this.judgeIfAllAnswered();
      }
    } else {
      this.players.delete(id);
      this.broadcastLobby();
    }
  }

  // The creator left: tell everyone and shut the room down. The
  // server deletes the room right after, so the code stops working.
  close(reason) {
    this.emit('room:closed', { reason });
    this.destroy();
  }

  get isEmpty() {
    return this.connectedPlayers.length === 0;
  }

  // ---------------- Game flow ----------------

  start(byId) {
    const starter = this.players.get(byId);
    if (this.phase === 'playing' || !starter?.isHost) return;

    // Drop stale records from previous games, reset per-game stats.
    for (const [id, p] of this.players) {
      if (!p.connected) this.players.delete(id);
    }
    for (const p of this.players.values()) {
      p.alive = true;
      p.correctCount = 0;
      p.reactionTimes = [];
      p.eliminatedRound = null;
    }

    this.phase = 'playing';
    this.round = 0;
    this.deck = shuffle([...this.words]);
    this.emit('game:start', { players: this.publicPlayers() });
    this.nextTimer = setTimeout(() => this.startRound(), GAME_CONFIG.startDelayMs);
  }

  windowMs() {
    return Math.max(
      GAME_CONFIG.minWindowMs,
      GAME_CONFIG.startWindowMs - (this.round - 1) * GAME_CONFIG.shrinkPerWordMs,
    );
  }

  startRound() {
    if (this.phase !== 'playing') return;
    this.round += 1;
    this.answers.clear();
    this.roundJudged = false;
    if (this.deck.length === 0) this.deck = shuffle([...this.words]);
    this.currentWord = this.deck.pop();

    const windowMs = this.windowMs();
    this.emit('round:start', {
      round: this.round,
      word: { text: this.currentWord.text, flies: this.currentWord.flies },
      windowMs,
    });
    this.deadlineTimer = setTimeout(
      () => this.judge(),
      windowMs + GAME_CONFIG.graceMs,
    );
  }

  onAnswer(id, { round, action, reactionMs } = {}) {
    if (this.phase !== 'playing' || round !== this.round) return;
    const player = this.players.get(id);
    if (!player?.alive || this.answers.has(id)) return;
    if (action !== 'fly' && action !== 'ground') return;

    const rt = Math.round(Math.min(Math.max(Number(reactionMs) || 0, 0), 60000));
    this.answers.set(id, { action, reactionMs: rt });
    this.judgeIfAllAnswered();
  }

  judgeIfAllAnswered() {
    if (this.phase !== 'playing' || this.roundJudged) return;
    if (this.alivePlayers.every((p) => this.answers.has(p.id))) this.judge();
  }

  judge() {
    // Guard against double-judging one round (e.g. the deadline firing
    // while a disconnect-triggered judge is already running).
    if (this.roundJudged) return;
    this.roundJudged = true;
    clearTimeout(this.deadlineTimer);
    const word = this.currentWord;

    const outcomes = [];
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      const answer = this.answers.get(player.id);
      const action = answer ? answer.action : 'timeout';
      const correct = !!answer && (action === 'fly') === word.flies;

      if (correct) {
        player.correctCount += 1;
        player.reactionTimes.push(answer.reactionMs);
      } else {
        player.alive = false;
        player.eliminatedRound = this.round;
      }
      outcomes.push({
        id: player.id,
        name: player.name,
        action,
        correct,
        reactionMs: answer ? answer.reactionMs : null,
      });
    }

    const alive = this.alivePlayers;
    this.emit('round:result', {
      round: this.round,
      word: { text: word.text, flies: word.flies },
      outcomes,
      aliveIds: alive.map((p) => p.id),
    });

    // Solo room: play until the lone player falls. Multi room:
    // game ends when one (winner) or zero (draw) remain.
    const gameDone =
      alive.length === 0 || (this.players.size > 1 && alive.length === 1);

    this.nextTimer = setTimeout(() => {
      if (gameDone) this.endGame(alive);
      else this.startRound();
    }, GAME_CONFIG.resultPauseMs);
  }

  endGame(winners) {
    this.phase = 'over';
    const winnerIds = winners.map((p) => p.id);

    const report = [...this.players.values()]
      .map((p) => ({
        id: p.id,
        name: p.name,
        correct: p.correctCount,
        avgMs: p.reactionTimes.length
          ? Math.round(p.reactionTimes.reduce((a, b) => a + b, 0) / p.reactionTimes.length)
          : null,
        bestMs: p.reactionTimes.length ? Math.min(...p.reactionTimes) : null,
        eliminatedRound: p.eliminatedRound,
        winner: winnerIds.includes(p.id),
        left: !p.connected,
      }))
      // Winner first, then whoever survived longest.
      .sort((a, b) => (b.winner - a.winner) || (b.eliminatedRound ?? Infinity) - (a.eliminatedRound ?? Infinity) || b.correct - a.correct);

    this.emit('game:over', { report, winnerIds });

    // Back to the lobby so the host can hit "play again".
    this.phase = 'lobby';
    this.broadcastLobby();
  }

  destroy() {
    clearTimeout(this.deadlineTimer);
    clearTimeout(this.nextTimer);
  }
}
