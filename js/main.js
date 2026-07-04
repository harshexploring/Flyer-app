// ============================================================
// main.js — wires everything together:
// game engine (game.js) ⇄ UI (ui.js) + sounds (sfx.js).
// ============================================================

import { Game } from './game.js';
import { loadWords } from './words.js';
import { sfx, setMuted, isMuted } from './sfx.js';
import * as ui from './ui.js';
import * as mp from './multiplayer.js';

const HIGHSCORE_KEY = 'flyer-highscore';

let highscore = Number(localStorage.getItem(HIGHSCORE_KEY) || 0);
let inputLocked = true; // true while animations run or no game is on
let lastResult = null;  // remembered for the game-over screen
let game = null;        // created once words.json has loaded

const hooks = {

  onWord(word, windowMs, round) {
    ui.setScore(round - 1);
    ui.showWord(word.text);
    ui.startTimer(windowMs);
    sfx.appear();
    inputLocked = false;
  },

  async onResult(result) {
    inputLocked = true;
    lastResult = result;
    ui.stopTimer();

    if (result.correct) {
      ui.flash('green');
      sfx.correct();
      if (result.action === 'fly') {
        sfx.whoosh();
        await ui.animateFlyUp();
      } else {
        sfx.thump();
        await ui.animateSettleDown();
      }
      await ui.wait(120); // tiny breather between words
    } else {
      ui.flash('red');
      sfx.wrong();
      if (result.action === 'fly') {
        sfx.pop();
        await ui.animateFailedJump();
      } else if (result.action === 'ground') {
        sfx.pop();
        await ui.animateFailedDrop();
      } else {
        sfx.pop();
        await ui.animateTimeout();
      }
      await ui.wait(400); // let the loss sink in
    }

    game.proceed();
  },

  onGameOver(stats) {
    const isNewBest = stats.survived > highscore;
    if (isNewBest) {
      highscore = stats.survived;
      localStorage.setItem(HIGHSCORE_KEY, String(highscore));
    }
    ui.setBest(highscore);
    ui.setButtonsEnabled(false);
    sfx.gameOver();
    ui.showGameOver({
      stats,
      word: lastResult.word,
      action: lastResult.action,
      isNewBest,
    });
  },
};

function startGame() {
  if (!game) return; // words still loading
  ui.hideScreens();
  ui.hideWord();
  ui.setScore(0);
  ui.setButtonsEnabled(true);
  sfx.start();
  setTimeout(() => game.start(), 450); // let the start jingle play
}

function answer(action) {
  if (mp.isActive()) {
    mp.answer(action);
    return;
  }
  if (inputLocked) return;
  ui.pressButton(action);
  game.answer(action);
}

// ---------------- Boot ----------------

ui.init();
ui.setBest(highscore);

// Load the word list, then build the game and let the player start.
(async () => {
  try {
    const words = await loadWords();
    game = new Game(hooks, words);
  } catch (err) {
    console.error(err);
    ui.showLoadError();
  }
})();

// Opened via a shared room link (?room=CODE)? Go straight to
// the multiplayer join flow.
const roomCode = new URLSearchParams(location.search).get('room');
if (roomCode) mp.startMultiplayer({ code: roomCode });

// ---------------- Event wiring ----------------

ui.els.playBtn.addEventListener('click', () => { sfx.click(); startGame(); });
ui.els.replayBtn.addEventListener('click', () => { sfx.click(); startGame(); });
ui.els.friendsBtn.addEventListener('click', () => { sfx.click(); mp.startMultiplayer(); });

ui.els.flyBtn.addEventListener('pointerdown', () => answer('fly'));
ui.els.groundBtn.addEventListener('pointerdown', () => answer('ground'));

ui.els.muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  ui.setMuteIcon(isMuted());
});

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    answer('fly');
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    answer('ground');
  } else if (e.key === ' ' || e.key === 'Enter') {
    if (mp.isActive()) return; // multiplayer restarts are host-driven
    // Space / Enter starts (or restarts) the game from an overlay.
    const startVisible = !ui.els.startScreen.classList.contains('hidden');
    const overVisible = !ui.els.gameoverScreen.classList.contains('hidden');
    if (startVisible || overVisible) {
      e.preventDefault();
      sfx.click();
      startGame();
    }
  }
});
