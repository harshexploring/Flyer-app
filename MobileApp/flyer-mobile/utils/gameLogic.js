// Game logic — same rules as the web version, adapted for React.
// Solo mode and multiplayer rounds both use this.

export const CONFIG = {
  startWindowMs: 2000,
  shrinkPerWordMs: 50,
  minWindowMs: 700,
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Game {
  constructor(words) {
    this.words = words;
    this.reset();
  }

  reset() {
    this.deck = [];
    this.round = 0;
    this.reactionTimes = [];
    this.currentWord = null;
    this.lastWordText = null;
    this.playing = false;
    this.awaitingAnswer = false;
  }

  start() {
    this.reset();
    this.playing = true;
    this.nextRound();
  }

  drawWord() {
    if (this.deck.length === 0) {
      this.deck = shuffle([...this.words]);
      if (this.deck[this.deck.length - 1].text === this.lastWordText) {
        this.deck.unshift(this.deck.pop());
      }
    }
    return this.deck.pop();
  }

  windowMs() {
    return Math.max(
      CONFIG.minWindowMs,
      CONFIG.startWindowMs - (this.round - 1) * CONFIG.shrinkPerWordMs,
    );
  }

  nextRound() {
    if (!this.playing) return;
    this.round += 1;
    this.currentWord = this.drawWord();
    this.lastWordText = this.currentWord.text;
    this.awaitingAnswer = true;
    this.shownAt = Date.now();
  }

  // action: 'fly' | 'ground' | 'timeout'. A timeout is always a
  // failure — running out of time never counts as an answer.
  answer(action) {
    if (!this.awaitingAnswer) return;
    this.awaitingAnswer = false;

    const timedOut = action === 'timeout';
    const reactionMs = timedOut ? null : Math.round(Date.now() - this.shownAt);
    const correct = !timedOut && (action === 'fly') === this.currentWord.flies;

    if (correct) {
      this.reactionTimes.push(reactionMs);
    } else {
      this.playing = false;
    }

    return { correct, action, word: this.currentWord, reactionMs };
  }

  stats() {
    const times = this.reactionTimes;
    const survived = times.length;
    const avgMs = survived
      ? Math.round(times.reduce((a, b) => a + b, 0) / survived)
      : null;
    const bestMs = survived ? Math.min(...times) : null;
    return { survived, avgMs, bestMs };
  }
}
