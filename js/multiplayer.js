// ============================================================
// Multiplayer controller — drives the same UI as solo play,
// but the words come from the server (Socket.IO) so every
// player in the room sees them at the same moment.
//
// Reaction time is measured HERE, on the client (word shown →
// button press), and sent with the answer. That way network
// lag never punishes a player. The server stays authoritative
// about who is right, wrong, and eliminated.
// ============================================================

import { sfx } from './sfx.js';
import * as ui from './ui.js';

let socket = null;
let myId = null;
let roomCode = null;
let lobby = null;        // latest { code, players, maxPlayers }
let screen = 'idle';     // 'lobby' | 'playing' | 'report'
let active = false;      // this controller owns the input

// Per-round state
let currentRound = 0;
let currentFlies = null;
let shownAt = 0;
let iAmAlive = false;
let answered = false;
let localTimeoutTimer = null;

export function isActive() {
  return active;
}

// Load the Socket.IO client lazily — solo play never needs it,
// so the game still works on a static host.
function ensureIoScript() {
  if (window.io) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = resolve;
    s.onerror = () =>
      reject(new Error('Could not reach the game server. Multiplayer needs the Node server running (npm start).'));
    document.head.appendChild(s);
  });
}

function emitAck(event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function leave() {
  socket?.disconnect();
  // A clean reload resets every bit of game state.
  location.href = location.pathname;
}

function renderLobby() {
  screen = 'lobby';
  ui.hidePlayersStrip();
  ui.showLobby({
    ...lobby,
    myId,
    onStart: () => { sfx.click(); socket.emit('game:start'); },
    onLeave: leave,
  });
}

// ---------------- Entry point ----------------

// Flow: name → create a room OR type a friend's 6-char room code.
export async function startMultiplayer() {
  active = true;
  const name = await ui.promptName();

  try {
    await ensureIoScript();
  } catch (err) {
    ui.showMpError(err.message, { onBack: leave });
    return;
  }

  if (!socket) {
    socket = window.io();
    bindEvents();
  }

  // Keep offering the create/join screen until something works
  // (a bad code shows the error inline and lets them retry).
  let resp = null;
  let error = '';
  for (;;) {
    const choice = await ui.promptRoomChoice({ error });
    if (choice.mode === 'back') {
      active = false;
      socket.disconnect();
      socket = null;
      ui.showStartScreen();
      return;
    }
    resp = await emitAck(
      choice.mode === 'create' ? 'room:create' : 'room:join',
      { code: choice.code, name },
    );
    if (resp.ok) break;
    error = resp.error;
  }

  myId = socket.id;
  roomCode = resp.code;
  lobby = { code: resp.code, players: resp.players, maxPlayers: resp.maxPlayers };
  renderLobby();
}

// ---------------- Server events ----------------

function bindEvents() {
  socket.on('lobby:update', (data) => {
    lobby = data;
    // Only re-render if we're actually looking at the lobby —
    // after a game this event also fires while the report is up.
    if (screen === 'lobby') renderLobby();
  });

  socket.on('game:start', ({ players }) => {
    screen = 'playing';
    iAmAlive = true;
    ui.hideScreens();
    ui.hideWord();
    ui.setScore(0);
    ui.setButtonsEnabled(true);
    ui.showSpectatorBanner(false);
    ui.showPlayersStrip(players, myId);
    sfx.start();
  });

  socket.on('round:start', ({ round, word, windowMs }) => {
    currentRound = round;
    currentFlies = word.flies;
    answered = false;
    ui.setScore(round - 1);
    ui.clearRoundBadges();
    ui.showWord(word.text);
    ui.startTimer(windowMs);
    sfx.appear();
    shownAt = performance.now();

    // If I let the window run out, show my own timeout locally;
    // the server's round:result will confirm it.
    clearTimeout(localTimeoutTimer);
    if (iAmAlive) {
      localTimeoutTimer = setTimeout(async () => {
        ui.stopTimer();
        ui.flash('red');
        sfx.wrong();
        sfx.pop();
        await ui.animateTimeout();
      }, windowMs);
    } else {
      // Spectator: fade the word out when the window closes.
      localTimeoutTimer = setTimeout(() => ui.hideWord(), windowMs);
    }
  });

  socket.on('round:result', ({ outcomes, aliveIds }) => {
    ui.stopTimer();
    ui.applyRoundOutcomes(outcomes);

    if (iAmAlive && !aliveIds.includes(myId)) {
      iAmAlive = false;
      ui.setButtonsEnabled(false);
      ui.showSpectatorBanner(true);
    }
    // Someone (not me) burst this round? A little pop for drama.
    if (outcomes.some((o) => !o.correct && o.id !== myId)) sfx.pop();
  });

  socket.on('player:left', ({ id }) => {
    ui.markPlayerLeft(id);
  });

  socket.on('game:over', ({ report, winnerIds }) => {
    screen = 'report';
    clearTimeout(localTimeoutTimer);
    ui.stopTimer();
    ui.hideWord();
    ui.setButtonsEnabled(false);

    if (winnerIds.includes(myId)) sfx.start(); // victory arpeggio
    else sfx.gameOver();

    const isHost = !!lobby?.players.find((p) => p.id === myId)?.isHost;
    ui.showReport({
      report,
      winnerIds,
      myId,
      isHost,
      onPlayAgain: () => { sfx.click(); socket.emit('game:start'); },
      onLeave: leave,
    });
  });

  // The room creator left → the room is gone. Notify and send
  // everyone back to the home screen.
  socket.on('room:closed', ({ reason }) => {
    screen = 'closed';
    clearTimeout(localTimeoutTimer);
    ui.stopTimer();
    ui.hideWord();
    ui.hidePlayersStrip();
    ui.setButtonsEnabled(false);
    ui.showMpError(reason || 'This room no longer exists.', { onBack: leave });
  });

  socket.on('disconnect', () => {
    if (screen === 'playing' || screen === 'lobby') {
      ui.showMpError('Lost connection to the game server.', { onBack: leave });
    }
  });
}

// ---------------- Input (called from main.js) ----------------

export async function answer(action) {
  if (screen !== 'playing' || !iAmAlive || answered) return;
  answered = true;
  clearTimeout(localTimeoutTimer);

  const reactionMs = Math.round(performance.now() - shownAt);
  socket.emit('round:answer', { round: currentRound, action, reactionMs });

  // Instant local feedback — the server confirms eliminations,
  // but the player shouldn't wait a network round-trip to see
  // their word fly or burst.
  ui.pressButton(action);
  ui.stopTimer();
  const correct = (action === 'fly') === currentFlies;

  if (correct) {
    ui.flash('green');
    if (action === 'fly') {
      sfx.correctFly();
      await ui.animateFlyUp();
    } else {
      sfx.correct();
      sfx.thump();
      await ui.animateSettleDown();
    }
  } else {
    ui.flash('red');
    sfx.wrong();
    sfx.pop();
    if (action === 'fly') await ui.animateFailedJump();
    else await ui.animateFailedDrop();
  }
}
