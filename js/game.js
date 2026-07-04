// ============================================================
// Game engine — pure logic, knows nothing about the DOM.
// Talks to the outside world only through the `hooks` object:
//   onWord(word, windowMs, round)  → a new word is on
//   onResult(result)               → the round was judged
//   onGameOver(stats)              → game ended (sudden death)
// The UI must call proceed() when its animations finish.
// ============================================================

export const CONFIG = {
  startWindowMs: 2000, // time allowed for the first word
  shrinkPerWordMs: 50, // window shrinks this much every word
  minWindowMs: 700,    // window never goes below this
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Game {
  constructor(hooks, words) {
    this.hooks = hooks;
    this.words = words; // [{ text, flies }, ...] — see loadWords()
    this.reset();
  }

  reset() {
    clearTimeout(this.deadline);
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

  // Fresh shuffled deck whenever the current one runs out, making sure
  // the reshuffle never repeats the word the player just saw.
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

    const windowMs = this.windowMs();
    this.awaitingAnswer = true;
    this.shownAt = performance.now();
    this.hooks.onWord(this.currentWord, windowMs, this.round);
    this.deadline = setTimeout(() => this.resolve('timeout'), windowMs);
  }

  // action: 'fly' | 'ground'
  answer(action) {
    if (!this.awaitingAnswer) return;
    this.resolve(action);
  }

  resolve(action) {
    this.awaitingAnswer = false;
    clearTimeout(this.deadline);

    const timedOut = action === 'timeout';
    const reactionMs = timedOut
      ? null
      : Math.round(performance.now() - this.shownAt);
    const correct = !timedOut && (action === 'fly') === this.currentWord.flies;

    if (correct) {
      this.reactionTimes.push(reactionMs);
    } else {
      this.playing = false; // sudden death
    }

    this.hooks.onResult({
      correct,
      action,
      word: this.currentWord,
      reactionMs,
    });
  }

  // Called by the UI once result animations are done.
  proceed() {
    if (this.playing) {
      this.nextRound();
    } else {
      this.hooks.onGameOver(this.stats());
    }
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
