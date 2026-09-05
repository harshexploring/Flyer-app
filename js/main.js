// ============================================================
// main.js — wires everything together:
// game engine (game.js) ⇄ UI (ui.js) + sounds (sfx.js).
// ============================================================

import { Game } from './game.js';
import { loadWords } from './words.js';
import { sfx, setMuted, isMuted } from './sfx.js';
import * as ui from './ui.js';
import * as mp from './multiplayer.js';
import * as auth from './auth.js';

const HIGHSCORE_KEY = 'flyer-highscore';

let highscore = Number(localStorage.getItem(HIGHSCORE_KEY) || 0);
let inputLocked = true; // true while animations run or no game is on
let game = null;        // created once words.json has loaded
let accountBest = null; // signed-in player's server best (null = guest)

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
    ui.stopTimer();

    if (result.correct) {
      ui.flash('green');
      if (result.action === 'fly') {
        sfx.correctFly();
        await ui.animateFlyUp();
      } else {
        sfx.correct();
        sfx.thump();
        await ui.animateSettleDown();
      }
      await ui.wait(120); // tiny breather between words
    } else {
      ui.flash('red');
      ui.setLives(result.livesLeft); // fade the lost heart
      ui.vibrate();                  // buzz the phone
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
    // Best score follows the account when signed in (same everywhere),
    // and falls back to this device's localStorage for guests.
    const loggedIn = !!auth.getUser();
    const baseline = loggedIn ? (accountBest ?? 0) : highscore;
    const isNewBest = stats.survived > baseline;
    if (loggedIn) {
      accountBest = Math.max(accountBest ?? 0, stats.survived);
      ui.setBest(accountBest);
    } else {
      if (isNewBest) {
        highscore = stats.survived;
        localStorage.setItem(HIGHSCORE_KEY, String(highscore));
      }
      ui.setBest(highscore);
    }
    ui.setButtonsEnabled(false);
    sfx.gameOver();
    ui.showGameOver({
      stats,
      mistakes: game.mistakes, // every word that cost a life
      isNewBest,
    });
    handleGameOverAccount(stats, game.mistakes);
  },
};

// Save the run + tricky words (if signed in) and show rank; nudge guests.
async function handleGameOverAccount(stats, mistakes) {
  if (!auth.getUser()) {
    ui.setRankLine({ guest: true, onSignIn: () => { sfx.click(); auth.signInWithGoogle(); } });
    return;
  }
  ui.setRankLine('<span class="rank-saving">Saving your run…</span>');
  await auth.saveGame({
    mode: 'solo',
    wordsSurvived: stats.survived,
    bestMs: stats.bestMs,
    avgMs: stats.avgMs,
    correct: stats.survived,
    mistakes: mistakes.length,
  });
  await auth.recordMisses(mistakes);
  // Rank against the board's bests — accountBest already includes this run.
  const { rank, total, percentile } =
    await auth.getRankForScore(Math.max(accountBest ?? 0, stats.survived));
  const pct = percentile != null && total >= 5 ? ` · top ${percentile}%` : '';
  ui.setRankLine(`🏆 Rank #${rank}${pct}`);
  refreshAccountUI(); // update navbar rating + best after the new game
}

// Keep the navbar (best + rating) in sync with the signed-in account.
async function refreshAccountUI() {
  const user = auth.getUser();
  if (!user) { accountBest = null; ui.setBest(highscore); ui.setRating(null); return; }
  const stats = await auth.getMyStats();
  accountBest = stats?.best ?? 0;
  ui.setBest(accountBest);
  ui.setRating(stats?.rating ?? null);
}

// Open the profile / stats screen.
async function openProfile() {
  sfx.click();
  const user = auth.getUser();
  if (!user) return;
  ui.showProfile({ user, stats: null, rank: null, onBack: () => { sfx.click(); ui.hideProfile(); } });
  const stats = await auth.getMyStats();
  const rank = await auth.getRankForScore(stats?.best ?? 0);
  ui.showProfile({ user, stats, rank, onBack: () => { sfx.click(); ui.hideProfile(); } });
}

function startGame() {
  if (!game) return; // words still loading
  ui.hideScreens();
  ui.hideWord();
  ui.setScore(0);
  ui.showHearts(3);
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
const booted = (async () => {
  try {
    const words = await loadWords();
    game = new Game(hooks, words);
  } catch (err) {
    console.error(err);
    ui.showLoadError();
  }
})();

// ---------------- Preloader ----------------
// The scene loops every 2.5s (see .pre-scene CSS). Keep it up until
// the page + words are ready AND at least MIN_ITERATIONS full loops
// have played, then fade out at a loop boundary so the animation
// never cuts mid-motion.
const PRELOADER_ITERATION_MS = 2500;
const PRELOADER_MIN_ITERATIONS = 2;
const preloaderShownAt = performance.now();

(async () => {
  const el = document.getElementById('preloader');
  if (!el) return;
  const finish = () => {
    el.classList.add('done');
    setTimeout(() => el.remove(), 600);
  };
  const safety = setTimeout(finish, 15000); // never trap the user

  await booted;
  await new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });

  const elapsed = performance.now() - preloaderShownAt;
  const loops = Math.max(PRELOADER_MIN_ITERATIONS, Math.ceil(elapsed / PRELOADER_ITERATION_MS));
  setTimeout(() => { clearTimeout(safety); finish(); },
    Math.max(0, loops * PRELOADER_ITERATION_MS - elapsed));
})();

// ---------------- Event wiring ----------------

// ---------------- Accounts ----------------

auth.onAuthChange((user) => {
  ui.renderAuthRow(user, {
    onSignIn: () => { sfx.click(); auth.signInWithGoogle(); },
    onSignOut: () => { sfx.click(); auth.signOut(); },
    onProfile: openProfile,
  });
  // Best + rating follow the account (same on every device), not this
  // device's localStorage.
  refreshAccountUI();
});
auth.initAuth();

ui.els.ratingPill.addEventListener('click', openProfile);

ui.els.leaderboardBtn.addEventListener('click', () => {
  sfx.click();
  ui.showLeaderboard({
    load: (kind) => auth.getLeaderboard(kind),
    onBack: () => { sfx.click(); ui.hideLeaderboard(); },
    myName: auth.getUser()?.name,
  });
});

ui.els.feedbackBtn.addEventListener('click', () => {
  sfx.click();
  ui.showFeedback({
    onSubmit: (f) => auth.submitFeedback(f),
    onBack: () => { sfx.click(); ui.hideFeedback(); },
  });
});

ui.els.playBtn.addEventListener('click', () => { sfx.click(); startGame(); });
ui.els.replayBtn.addEventListener('click', () => { sfx.click(); startGame(); });
ui.els.friendsBtn.addEventListener('click', () => { sfx.click(); mp.startMultiplayer(); });

// Solo game-over → back to the landing screen (Play Solo / Friends).
ui.els.homeBtn.addEventListener('click', () => {
  sfx.click();
  ui.hideWord();
  ui.setScore(0);
  ui.hideHearts();
  ui.showStartScreen();
});

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
