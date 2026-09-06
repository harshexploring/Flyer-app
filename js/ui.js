// ============================================================
// UI layer — owns the DOM. Renders words, runs the result
// animations (fly up / settle down / burst), the timer bar,
// screen flashes and the overlay screens.
// All animation helpers are async so main.js can sequence them.
// ============================================================

import { getReveal } from './reveal.js';
import { tierFor } from './rating.js';

const els = {};

export function init() {
  const ids = [
    'stage', 'word-card', 'flash', 'timer-fill',
    'fly-btn', 'ground-btn', 'mute-btn', 'hearts',
    'score-pill', 'best-pill',
    'start-screen', 'gameover-screen', 'play-btn', 'replay-btn',
    'reveal-row', 'stat-survived', 'stat-avg', 'stat-fastest', 'new-best', 'home-btn',
    'friends-btn', 'name-screen', 'name-input', 'name-ok-btn', 'name-back-btn',
    'lobby-screen', 'lobby-panel', 'report-screen', 'report-panel',
    'players-strip', 'spectator-banner',
    'auth-row', 'leaderboard-btn', 'leaderboard-screen', 'leaderboard-panel',
    'profile-screen', 'profile-panel', 'rating-pill', 'rating-line',
    'feedback-btn', 'feedback-screen', 'feedback-panel',
  ];
  for (const id of ids) {
    els[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] =
      document.getElementById(id);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- Word card ----------------

export async function showWord(text) {
  const card = els.wordCard;
  card.textContent = text;
  card.getAnimations().forEach((a) => a.cancel());
  await card.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    ],
    { duration: 180, easing: 'ease-out', fill: 'forwards' },
  ).finished;
}

// Correct "fly": soar into the sky.
export async function animateFlyUp() {
  await els.wordCard.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: 'translate(-50%, calc(-50% - 36vh)) scale(0.7) rotate(-6deg)', opacity: 0 },
    ],
    { duration: 600, easing: 'cubic-bezier(0.4, -0.3, 0.7, 1)', fill: 'forwards' },
  ).finished;
}

// Correct "ground": settle down softly with a little squash.
export async function animateSettleDown() {
  await els.wordCard.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: 'translate(-50%, calc(-50% + 20vh)) scale(1.05, 0.8)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, calc(-50% + 19vh)) scale(0.95, 1)', opacity: 0 },
    ],
    { duration: 550, easing: 'cubic-bezier(0.5, 0, 0.6, 1)', fill: 'forwards' },
  ).finished;
}

// Wrong "fly": the word tries to jump, stalls, and bursts.
export async function animateFailedJump() {
  await els.wordCard.animate(
    [
      { transform: 'translate(-50%, -50%)' },
      { transform: 'translate(-50%, calc(-50% - 13vh)) rotate(4deg)' },
      { transform: 'translate(-50%, calc(-50% - 11vh)) rotate(-4deg)' },
    ],
    { duration: 380, easing: 'ease-out', fill: 'forwards' },
  ).finished;
  await burstCard();
}

// Wrong "ground": the flying thing is dragged down and bursts.
export async function animateFailedDrop() {
  await els.wordCard.animate(
    [
      { transform: 'translate(-50%, -50%)' },
      { transform: 'translate(-50%, calc(-50% + 14vh)) rotate(6deg)' },
    ],
    { duration: 320, easing: 'ease-in', fill: 'forwards' },
  ).finished;
  await burstCard();
}

// Timeout: the word shakes angrily, then bursts.
export async function animateTimeout() {
  await els.wordCard.animate(
    [
      { transform: 'translate(-50%, -50%)' },
      { transform: 'translate(calc(-50% - 12px), -50%)' },
      { transform: 'translate(calc(-50% + 12px), -50%)' },
      { transform: 'translate(calc(-50% - 8px), -50%)' },
      { transform: 'translate(calc(-50% + 8px), -50%)' },
      { transform: 'translate(-50%, -50%)' },
    ],
    { duration: 300, easing: 'ease-in-out', fill: 'forwards' },
  ).finished;
  await burstCard();
}

// Pop the card + spray particles from where it is right now.
async function burstCard() {
  const card = els.wordCard;
  spawnParticles(card);
  await card.animate(
    [
      { opacity: 1, filter: 'brightness(1)' },
      { opacity: 0, filter: 'brightness(2)', transform: getComputedStyle(card).transform + ' scale(1.5)' },
    ],
    { duration: 200, easing: 'ease-out', fill: 'forwards' },
  ).finished;
}

function spawnParticles(fromEl) {
  const stageBox = els.stage.getBoundingClientRect();
  const box = fromEl.getBoundingClientRect();
  const cx = box.left - stageBox.left + box.width / 2;
  const cy = box.top - stageBox.top + box.height / 2;
  const colors = ['#f0605a', '#ff9f43', '#ffd54d', '#fff'];

  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.background = colors[i % colors.length];
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    els.stage.appendChild(p);

    const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
    const dist = 60 + Math.random() * 90;
    p.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 30}px) scale(0.2)`,
          opacity: 0,
        },
      ],
      { duration: 500 + Math.random() * 250, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
    ).onfinish = () => p.remove();
  }
}

// ---------------- Flash ----------------

export function flash(kind /* 'green' | 'red' */) {
  els.flash.className = `flash ${kind}`;
  els.flash.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }],
    { duration: kind === 'green' ? 350 : 550, easing: 'ease-out' },
  );
}

// ---------------- Timer bar ----------------

export function startTimer(windowMs) {
  const fill = els.timerFill;
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(1)';
  void fill.offsetHeight; // force reflow so the reset applies instantly
  fill.style.transition = `transform ${windowMs}ms linear`;
  fill.style.transform = 'scaleX(0)';
}

export function stopTimer() {
  const fill = els.timerFill;
  const frozen = getComputedStyle(fill).transform;
  fill.style.transition = 'none';
  fill.style.transform = frozen === 'none' ? 'scaleX(0)' : frozen;
}

// ---------------- HUD ----------------

export function setScore(n) {
  els.scorePill.textContent = `Word ${n}`;
}

export function setBest(n) {
  els.bestPill.textContent = `Best ${n}`;
}

export function setMuteIcon(muted) {
  els.muteBtn.textContent = muted ? '🔇' : '🔊';
}

// Navbar rating chip. Pass a rating info object, or null to hide (guest).
export function setRating(info) {
  if (!info || info.games === 0) { els.ratingPill.classList.add('hidden'); return; }
  const tier = tierFor(info.rating);
  els.ratingPill.style.background = tier.color;
  els.ratingPill.textContent = `${tier.emoji} ${info.rating}${info.provisional ? '?' : ''}`;
  els.ratingPill.classList.remove('hidden');
}

// ---------------- Lives (hearts) ----------------

let heartsPrev = 0;

// Show a fresh row of `total` full hearts.
export function showHearts(total = 3) {
  els.hearts.innerHTML = Array.from({ length: total },
    () => '<span class="heart">❤️</span>').join('');
  heartsPrev = total;
  els.hearts.classList.remove('hidden');
}

export function hideHearts() {
  els.hearts.classList.add('hidden');
}

// Update how many hearts are full. The heart(s) that just went out
// grey-fade, and the newest one gets a little "break" pop.
export function setLives(n) {
  const hearts = [...els.hearts.children];
  hearts.forEach((h, i) => {
    const lost = i >= n;
    h.classList.toggle('lost', lost);
    if (lost && i >= n && i < heartsPrev && i === n) {
      h.classList.add('just-lost');
      setTimeout(() => h.classList.remove('just-lost'), 460);
    }
  });
  heartsPrev = n;
}

// Buzz the phone on a life loss (no-op on desktop / unsupported).
export function vibrate(pattern = 200) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

// ---------------- Game-over picture reveal ----------------

const revealTimers = []; // oscillation intervals, so we can stop them

// Stop every running emoji↔photo oscillation and forget it.
export function clearReveals() {
  revealTimers.forEach(clearInterval);
  revealTimers.length = 0;
}

// One card: a cartoon emoji + the real photo, cross-fading back and
// forth (~1.1s each) so you get a good look at both.
function buildRevealCard(wordObj) {
  const { emoji, caption, imagePromise } = getReveal(wordObj);
  const card = document.createElement('div');
  card.className = 'reveal-card';

  const media = document.createElement('div');
  media.className = 'reveal-media';
  const em = document.createElement('span');
  em.className = 'reveal-emoji';
  em.textContent = emoji;
  media.appendChild(em);

  const cap = document.createElement('div');
  cap.className = 'reveal-cap';
  cap.textContent = caption;

  card.append(media, cap);

  imagePromise.then((url) => {
    if (!url) return; // no photo (character / offline) → emoji stays put
    const img = new Image();
    img.className = 'reveal-photo';
    img.alt = wordObj.text;
    img.onload = () => {
      media.appendChild(img);
      media.classList.add('show-photo'); // show the real one first
      revealTimers.push(setInterval(
        () => media.classList.toggle('show-photo'), 1100));
    };
    img.src = url;
  });
  return card;
}

// Render one card per word (the mistakes that cost a life) into a row.
export function renderReveals(container, wordObjs) {
  clearReveals();
  container.innerHTML = '';
  for (const w of wordObjs || []) container.appendChild(buildRevealCard(w));
}

export function setButtonsEnabled(enabled) {
  els.flyBtn.disabled = !enabled;
  els.groundBtn.disabled = !enabled;
}

// Visual feedback when the answer comes from the keyboard.
export function pressButton(action) {
  const btn = action === 'fly' ? els.flyBtn : els.groundBtn;
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 130);
}

// ---------------- Screens ----------------

export function showStartScreen() {
  els.startScreen.classList.remove('hidden');
  els.gameoverScreen.classList.add('hidden');
}

export function showGameOver({ stats, mistakes, isNewBest }) {
  // Show every word that cost a life — each as an emoji that cross-fades
  // with its real photo — so the player learns all of them, not just
  // the last one.
  renderReveals(els.revealRow, mistakes);

  els.statSurvived.textContent = stats.survived;
  els.statAvg.textContent = stats.avgMs != null ? `${stats.avgMs} ms` : '–';
  els.statFastest.textContent = stats.bestMs != null ? `${stats.bestMs} ms` : '–';
  els.newBest.classList.toggle('hidden', !isNewBest);
  els.gameoverScreen.classList.remove('hidden');
}

export function hideScreens() {
  clearReveals(); // stop any oscillating reveal animations
  els.startScreen.classList.add('hidden');
  els.gameoverScreen.classList.add('hidden');
  els.nameScreen.classList.add('hidden');
  els.lobbyScreen.classList.add('hidden');
  els.reportScreen.classList.add('hidden');
  els.leaderboardScreen.classList.add('hidden');
  els.profileScreen.classList.add('hidden');
  els.feedbackScreen.classList.add('hidden');
}

// ---------------- Accounts & leaderboard ----------------

// The Google sign-in button / signed-in identity on the home screen.
// The identity chip opens the profile.
export function renderAuthRow(user, { onSignIn, onSignOut, onProfile }) {
  if (user) {
    els.authRow.innerHTML = `
      <button class="who" id="profile-open">
        ${user.avatar ? `<img class="who-av" src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer">` : '<span class="who-av ph">🙂</span>'}
        <span class="who-name">${esc(user.name)}</span>
        <span class="who-chevron">📊</span>
      </button>
      <button class="btn-small" id="signout-btn">Sign out</button>`;
    els.authRow.querySelector('#profile-open').addEventListener('click', onProfile);
    els.authRow.querySelector('#signout-btn').addEventListener('click', onSignOut);
  } else {
    els.authRow.innerHTML =
      `<button class="btn-google" id="signin-btn"><span class="g-mark">G</span> Sign in with Google</button>`;
    els.authRow.querySelector('#signin-btn').addEventListener('click', onSignIn);
  }
}

// How the player's rating moved this game. We deliberately show the
// CHANGE (▲/▼), not a leaderboard rank — the rank barely moves and
// tells the player nothing about their own progress.
function ratingMoveHtml({ rating, delta, failed, crown, saving }) {
  if (saving) return '<span class="rank-saving">Saving your run…</span>';
  if (failed) return '<span class="rank-saving">Couldn’t save this run.</span>';
  if (rating == null) return '';
  const crownBit = crown ? '<span class="rt-crown">👑 Crown earned!</span>' : '';
  let move = '';
  if (delta > 0) move = `<span class="rt-up">▲ +${delta}</span>`;
  else if (delta < 0) move = `<span class="rt-down">▼ ${delta}</span>`;
  else if (delta === 0) move = '<span class="rt-flat">no change</span>';
  return `${crownBit}<span class="rt-val">Rating ${rating}</span>${move}`;
}

// Game-over rating line. Pass { saving }, { rating, delta, failed, crown },
// or { guest: true, onSignIn } to nudge guests to sign in.
export function setRatingLine(info) {
  if (!info) { els.ratingLine.classList.add('hidden'); els.ratingLine.innerHTML = ''; return; }
  if (info.guest) {
    els.ratingLine.innerHTML =
      `<button class="btn-google sm" id="go-signin-btn"><span class="g-mark">G</span> Sign in to save your progress</button>`;
    els.ratingLine.querySelector('#go-signin-btn').addEventListener('click', info.onSignIn);
  } else {
    els.ratingLine.innerHTML = ratingMoveHtml(info);
  }
  els.ratingLine.classList.remove('hidden');
}

// Same, but inside the multiplayer report panel (rebuilt each game, so
// the element may not exist — guard rather than throw).
export function setReportRatingLine(info) {
  const el = document.getElementById('report-rating-line');
  if (!el) return;
  el.innerHTML = ratingMoveHtml(info);
  el.classList.remove('hidden');
}

// The leaderboard overlay. `load(kind)` returns rows for a tab.
export function showLeaderboard({ load, loadMyRank, onBack, myName }) {
  els.leaderboardPanel.innerHTML = `
    <h1 class="panel-title">🏆 Leaderboard</h1>
    <div class="lb-tabs">
      <button class="lb-tab active" data-kind="rating">Rating</button>
      <button class="lb-tab" data-kind="weekly">This Week</button>
      <button class="lb-tab" data-kind="fastest">Fastest</button>
    </div>
    <div class="lb-head"><span class="lb-rank">#</span><span class="lb-name">Player</span><span class="lb-score" id="lb-metric">Rating</span></div>
    <div class="lb-list" id="lb-list"><p class="lb-empty">Loading…</p></div>
    <button class="btn-small" id="lb-back">Back</button>`;
  els.leaderboardScreen.classList.remove('hidden');

  const listEl = els.leaderboardPanel.querySelector('#lb-list');
  const metricEl = els.leaderboardPanel.querySelector('#lb-metric');
  const METRIC_LABEL = { rating: 'Rating', weekly: 'Best run', fastest: 'Fastest' };

  const metricFor = (kind, r) =>
    kind === 'fastest' ? `${r.best_ms} ms`
      : kind === 'rating' ? `${r.rating}`
      : `${r.best_words}`;

  // Only ONE medal per row: the rank cell shows a medal for the top 3
  // and a plain number after that. (The score column stays a number —
  // tier emoji there produced a confusing second medal.)
  const rankCell = (n) => ['🥇', '🥈', '🥉'][n - 1] || `${n}`;

  const rowHtml = (r, rank, kind, isMe) => {
    const av = r.avatar_url
      ? `<img class="lb-av" src="${esc(r.avatar_url)}" alt="" referrerpolicy="no-referrer">`
      : '<span class="lb-av ph">🙂</span>';
    const tint = kind === 'rating' && r.rating != null
      ? ` style="color:${tierFor(r.rating).color}"` : '';
    return `<div class="lb-row${isMe ? ' me' : ''}">
      <span class="lb-rank">${rankCell(rank)}</span>
      ${av}<span class="lb-name">${esc(r.display_name)}</span>
      <span class="lb-score"${tint}>${metricFor(kind, r)}</span>
    </div>`;
  };

  const render = async (kind) => {
    metricEl.textContent = METRIC_LABEL[kind] || 'Score';
    listEl.innerHTML = '<p class="lb-empty">Loading…</p>';
    const [rows, mine] = await Promise.all([
      load(kind),
      kind === 'rating' && loadMyRank ? loadMyRank() : Promise.resolve(null),
    ]);
    if (!rows.length) {
      listEl.innerHTML = '<p class="lb-empty">No scores yet — be the first! 🥇</p>';
      return;
    }
    let html = rows
      .map((r, i) => rowHtml(r, i + 1, kind, myName && r.display_name === myName))
      .join('');

    // Codeforces-style: if you're outside the visible list, your own row
    // is still pinned at the bottom with your true rank.
    const visible = myName && rows.some((r) => r.display_name === myName);
    if (kind === 'rating' && mine?.rank && !visible) {
      html += `<div class="lb-gap">⋯</div>` +
        rowHtml({ display_name: myName, rating: mine.rating, avatar_url: null },
          mine.rank, kind, true);
    }
    listEl.innerHTML = html;
    // Bring the player's own row into view on open.
    listEl.querySelector('.lb-row.me')?.scrollIntoView({ block: 'nearest' });
  };

  els.leaderboardPanel.querySelectorAll('.lb-tab').forEach((t) =>
    t.addEventListener('click', () => {
      els.leaderboardPanel.querySelectorAll('.lb-tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      render(t.dataset.kind);
    }));
  els.leaderboardPanel.querySelector('#lb-back').addEventListener('click', onBack);
  render('rating');
}

export function hideLeaderboard() {
  els.leaderboardScreen.classList.add('hidden');
}

// The player's profile: rating, headline stats, and recent tricky words.
export function showProfile({ user, stats, onBack }) {
  const s = stats || {};
  const num = (v, suffix = '') => (v == null ? '–' : `${v}${suffix}`);
  const r = s.rating;
  const tier = r ? tierFor(r.rating) : null;
  const sub = tier
    ? `${tier.emoji} ${tier.name} · <b>${r.rating}</b>${r.provisional ? ' (provisional)' : ''}`
    : (s.played ? 'Keep playing to earn a rating!' : 'Play a game to start your stats!');

  const tricky = (s.topMisses || []).length
    ? `<div class="tricky-list">${s.topMisses.map((m) => `
        <span class="tricky-chip ${m.flies ? 'fly' : 'sit'}">
          ${esc(m.word)} <span class="tricky-n">×${m.misses}</span>
        </span>`).join('')}</div>
       <p class="tricky-hint">Your latest slip-ups — get these next time!</p>`
    : '<p class="tricky-empty">No tricky words yet — nicely done! ✨</p>';

  els.profilePanel.innerHTML = `
    <div class="profile-head">
      ${user.avatar
        ? `<img class="profile-av" src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer">`
        : '<span class="profile-av ph">🙂</span>'}
      <div class="profile-id">
        <div class="profile-name">${esc(user.name)}</div>
        <div class="profile-sub"${tier ? ` style="color:${tier.color}"` : ''}>${sub}</div>
      </div>
    </div>

    <div class="profile-grid">
      <div class="stat"><span class="stat-num">${num(s.best)}</span><span class="stat-label">best run</span></div>
      <div class="stat stat-crown"><span class="stat-num">${num(s.crowns)}👑</span><span class="stat-label">crowns</span></div>
      <div class="stat"><span class="stat-num">${num(s.played)}</span><span class="stat-label">games</span></div>
      <div class="stat"><span class="stat-num">${num(s.mpGames)}</span><span class="stat-label">group games</span></div>
      <div class="stat"><span class="stat-num">${num(s.avgReaction, ' ms')}</span><span class="stat-label">avg reaction</span></div>
      <div class="stat"><span class="stat-num">${num(s.fastest, ' ms')}</span><span class="stat-label">fastest</span></div>
      <div class="stat"><span class="stat-num">${num(s.streak)}🔥</span><span class="stat-label">day streak</span></div>
    </div>

    <h2 class="profile-h2">🎯 Your tricky words</h2>
    ${tricky}

    <button class="btn-small" id="profile-back">Back</button>`;
  els.profileScreen.classList.remove('hidden');
  els.profilePanel.querySelector('#profile-back').addEventListener('click', onBack);
}

export function hideProfile() {
  els.profileScreen.classList.add('hidden');
}

// ---------------- Feedback ----------------

export function showFeedback({ onSubmit, onBack }) {
  els.feedbackPanel.innerHTML = `
    <h1 class="panel-title">💬 Feedback</h1>
    <p class="panel-sub">How's Flyer treating you?</p>
    <div class="stars" id="fb-stars">
      ${[1, 2, 3, 4, 5].map((n) => `<button class="star" data-n="${n}">☆</button>`).join('')}
    </div>
    <textarea class="text-input fb-comment" id="fb-comment" maxlength="500"
      placeholder="Anything you'd change? (optional)"></textarea>
    <button class="btn-big" id="fb-send">Send</button>
    <p style="margin-top:10px"><button class="btn-small" id="fb-back">Back</button></p>`;
  els.feedbackScreen.classList.remove('hidden');

  let rating = 0;
  const stars = [...els.feedbackPanel.querySelectorAll('.star')];
  const paint = () => stars.forEach((s, i) => { s.textContent = i < rating ? '★' : '☆'; });
  stars.forEach((s, i) => s.addEventListener('click', () => { rating = i + 1; paint(); }));

  els.feedbackPanel.querySelector('#fb-send').addEventListener('click', async () => {
    if (rating === 0) { els.feedbackPanel.querySelector('#fb-stars').classList.add('shake'); return; }
    const comment = els.feedbackPanel.querySelector('#fb-comment').value.trim();
    const ok = await onSubmit({ rating, comment });
    els.feedbackPanel.innerHTML = `
      <h1 class="panel-title">${ok ? '🙏 Thank you!' : '😕 Hmm'}</h1>
      <p class="panel-sub">${ok ? 'Your feedback really helps.' : 'Could not send — please try again later.'}</p>
      <button class="btn-big" id="fb-done">Close</button>`;
    els.feedbackPanel.querySelector('#fb-done').addEventListener('click', onBack);
  });
  els.feedbackPanel.querySelector('#fb-back').addEventListener('click', onBack);
}

export function hideFeedback() {
  els.feedbackScreen.classList.add('hidden');
}

// ---------------- Multiplayer screens ----------------

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ask for a nickname. Resolves with the trimmed name, or null if the
// player backs out (every multiplayer step must have a way back).
export function promptName() {
  hideScreens();
  els.nameScreen.classList.remove('hidden');
  els.nameInput.value = localStorage.getItem('flyer-name') || '';
  els.nameInput.focus();

  return new Promise((resolve) => {
    const cleanup = (value) => {
      els.nameOkBtn.removeEventListener('click', submit);
      els.nameBackBtn.removeEventListener('click', back);
      els.nameInput.removeEventListener('keydown', onKey);
      els.nameScreen.classList.add('hidden');
      resolve(value);
    };
    const submit = () => {
      const name = els.nameInput.value.trim().slice(0, 16);
      if (!name) { els.nameInput.focus(); return; }
      localStorage.setItem('flyer-name', name);
      cleanup(name);
    };
    const back = () => cleanup(null);
    const onKey = (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') back();
      e.stopPropagation();
    };
    els.nameOkBtn.addEventListener('click', submit);
    els.nameBackBtn.addEventListener('click', back);
    els.nameInput.addEventListener('keydown', onKey);
  });
}

// Create-or-join chooser. Resolves with {mode:'create'},
// {mode:'join', code} or {mode:'back'}.
export function promptRoomChoice({ error = '' } = {}) {
  hideScreens();
  els.lobbyPanel.innerHTML = `
    <h1 class="panel-title">👥 Play with Friends</h1>
    ${error
      ? `<p class="mp-error">${esc(error)}</p>`
      : '<p class="panel-sub">start a room, or join your friend’s</p>'}
    <button class="btn-big" id="create-room-btn">Create a room</button>
    <div class="join-divider">— or join with a code —</div>
    <input class="text-input code-input" id="join-code-input" maxlength="6"
           placeholder="ABC123" autocomplete="off" autocapitalize="characters" />
    <button class="btn-big btn-friends" id="join-room-btn">Join</button>
    <p style="margin-top:14px"><button class="btn-small" id="choice-back-btn">Back</button></p>
  `;
  els.lobbyScreen.classList.remove('hidden');

  return new Promise((resolve) => {
    const input = document.getElementById('join-code-input');
    const done = (value) => { els.lobbyScreen.classList.add('hidden'); resolve(value); };
    const tryJoin = () => {
      const code = input.value.trim().toUpperCase();
      if (code.length !== 6) { input.classList.add('input-error'); input.focus(); return; }
      done({ mode: 'join', code });
    };
    input.addEventListener('input', () => {
      input.classList.remove('input-error');
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryJoin(); e.stopPropagation(); });
    document.getElementById('create-room-btn').addEventListener('click', () => done({ mode: 'create' }));
    document.getElementById('join-room-btn').addEventListener('click', tryJoin);
    document.getElementById('choice-back-btn').addEventListener('click', () => done({ mode: 'back' }));
  });
}

export function showLobby({ code, players, myId, maxPlayers, minPlayers = 2, onStart, onLeave }) {
  hideScreens();
  const me = players.find((p) => p.id === myId);
  const isHost = !!me?.isHost;
  // A group game needs a group — don't offer Start until someone joins.
  const canStart = players.length >= minPlayers;

  els.lobbyPanel.innerHTML = `
    <h1 class="panel-title">🛖 Room</h1>
    <div class="lobby-code-row">
      <span class="lobby-code">${esc(code)}</span>
      <button class="btn-small" id="copy-code-btn">Copy code</button>
    </div>
    <p class="lobby-hint">friends: open this site → Play with Friends → enter this code</p>
    <div class="lobby-players">
      ${players.map((p) => `
        <div class="lobby-player">
          <span>${p.id === myId ? '🫵' : '🙂'}</span>
          <span>${esc(p.name)}${p.id === myId ? ' (you)' : ''}</span>
          ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
        </div>`).join('')}
    </div>
    <p class="lobby-hint">${players.length}/${maxPlayers} players</p>
    ${isHost
      ? (canStart
          ? '<button class="btn-big" id="lobby-start-btn">Start game</button>'
          : `<button class="btn-big" id="lobby-start-btn" disabled>Start game</button>
             <p class="lobby-hint">Waiting for a friend to join — share the code above 👆</p>`)
      : '<p class="lobby-hint">Waiting for the host to start…</p>'}
    <p style="margin-top:12px"><button class="btn-small" id="lobby-leave-btn">Back</button></p>
  `;
  els.lobbyScreen.classList.remove('hidden');

  document.getElementById('copy-code-btn').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(code);
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy code'; }, 1500);
    } catch {
      prompt('Copy this code:', code);
    }
  });
  document.getElementById('lobby-start-btn')?.addEventListener('click', onStart);
  document.getElementById('lobby-leave-btn').addEventListener('click', onLeave);
}

// Inline note inside the lobby (e.g. "you need one more player").
export function showLobbyNote(message) {
  const panel = els.lobbyPanel;
  let note = panel.querySelector('.lobby-note');
  if (!note) {
    note = document.createElement('p');
    note.className = 'mp-error lobby-note';
    panel.appendChild(note);
  }
  note.textContent = message;
}

export function showMpError(message, { onBack } = {}) {
  hideScreens();
  els.lobbyPanel.innerHTML = `
    <h1 class="panel-title">😕 Oops</h1>
    <p class="mp-error">${esc(message)}</p>
    <button class="btn-big" id="mp-back-btn">Back</button>
  `;
  els.lobbyScreen.classList.remove('hidden');
  document.getElementById('mp-back-btn').addEventListener('click', () => {
    if (onBack) onBack();
    else { els.lobbyScreen.classList.add('hidden'); showStartScreen(); }
  });
}

// ---------------- Players strip ----------------

let mpTotalLives = 3;

function heartRow(left, total) {
  return Array.from({ length: total },
    (_, i) => `<span class="h${i < left ? '' : ' lost'}">❤️</span>`).join('');
}

export function showPlayersStrip(players, myId) {
  mpTotalLives = players[0]?.lives ?? 3;
  els.playersStrip.innerHTML = players.map((p) => `
    <div class="player-chip alive ${p.id === myId ? 'me' : ''}" data-player-id="${esc(p.id)}">
      <span class="chip-name">${esc(p.name)}</span>
      <span class="chip-lives">${heartRow(p.lives ?? mpTotalLives, mpTotalLives)}</span>
      <span class="chip-ms hidden"></span>
    </div>`).join('');
  els.playersStrip.classList.remove('hidden');
}

export function hidePlayersStrip() {
  els.playersStrip.classList.add('hidden');
  els.spectatorBanner.classList.add('hidden');
}

function chip(id) {
  return els.playersStrip.querySelector(`[data-player-id="${CSS.escape(id)}"]`);
}

// After each round: update each player's hearts, reaction time, and
// (only when their lives hit 0) flip them to the eliminated look.
export function applyRoundOutcomes(outcomes) {
  for (const o of outcomes) {
    const el = chip(o.id);
    if (!el) continue;
    const ms = el.querySelector('.chip-ms');
    const lives = el.querySelector('.chip-lives');
    if (lives && o.livesLeft != null) {
      lives.innerHTML = heartRow(o.livesLeft, mpTotalLives);
    }
    if (o.correct) {
      ms.textContent = `${o.reactionMs} ms`;
    } else {
      ms.textContent = o.action === 'timeout' ? '⏰' : '✗';
      if (o.livesLeft <= 0) {
        el.classList.remove('alive');
        el.classList.add('dead');
      }
    }
    ms.classList.remove('hidden');
  }
}

export function clearRoundBadges() {
  for (const ms of els.playersStrip.querySelectorAll('.chip-ms')) {
    if (!ms.closest('.player-chip').classList.contains('dead')) {
      ms.classList.add('hidden');
    }
  }
}

export function markPlayerLeft(id) {
  const el = chip(id);
  if (el) { el.classList.remove('alive'); el.classList.add('dead'); el.style.opacity = 0.4; }
}

export function showSpectatorBanner(show) {
  els.spectatorBanner.classList.toggle('hidden', !show);
}

// ---------------- Final report ----------------

export function showReport({ report, winnerIds, myId, isHost, revealWords, onPlayAgain, onLeave }) {
  const fmt = (v, suffix = '') => (v == null ? '–' : `${v}${suffix}`);
  const title = winnerIds.length === 0
    ? '😢 Everyone udd gaya!'
    : winnerIds.includes(myId) ? '🏆 You win!' : '😢 Game over!';

  els.reportPanel.innerHTML = `
    <h1 class="panel-title">${title}</h1>
    <p class="panel-sub">${winnerIds.length ? esc(report.find((r) => r.winner)?.name ?? '') + ' is the last one standing' : 'it ends in a draw'}</p>
    ${revealWords?.length ? `
      <p class="panel-sub reveal-heading">What caught you out:</p>
      <div class="reveal-row" id="report-reveal-row"></div>` : ''}
    <table class="report-table">
      <thead>
        <tr><th>Player</th><th>Result</th><th>Correct</th><th>Avg</th><th>Fastest</th></tr>
      </thead>
      <tbody>
        ${report.map((r) => `
          <tr class="${r.winner ? 'winner-row' : ''}">
            <td>${r.winner ? '🏆 ' : ''}${esc(r.name)}${r.id === myId ? ' (you)' : ''}${r.left ? ' 🔌' : ''}</td>
            <td>${r.winner ? 'Winner' : r.left ? 'Left' : `Out · word ${r.eliminatedRound}`}</td>
            <td>${r.correct}</td>
            <td>${fmt(r.avgMs, ' ms')}</td>
            <td>${fmt(r.bestMs, ' ms')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="rank-line hidden" id="report-rating-line"></div>
    <div class="report-actions">
      ${isHost ? '<button class="btn-big" id="report-again-btn">Play again</button>' : '<p class="lobby-hint">Waiting for the host to restart…</p>'}
      <button class="btn-small" id="report-leave-btn">Leave</button>
    </div>
  `;
  els.reportScreen.classList.remove('hidden');

  // If the local player was knocked out, show every word that beat them.
  if (revealWords?.length) {
    renderReveals(document.getElementById('report-reveal-row'), revealWords);
  }

  document.getElementById('report-again-btn')?.addEventListener('click', onPlayAgain);
  document.getElementById('report-leave-btn').addEventListener('click', onLeave);
}

// Shown if words.json fails to load (e.g. opened without a server).
export function showLoadError() {
  els.startScreen.classList.remove('hidden');
  const panel = els.startScreen.querySelector('.panel');
  panel.innerHTML =
    '<h1 class="panel-title">😕 Oops</h1>' +
    '<p class="panel-sub">Couldn’t load the word list.</p>' +
    '<div class="how-to"><div class="how-row">Make sure the game is served over HTTP ' +
    '(e.g. <b>python3 -m http.server</b>) and that <b>words.json</b> is present.</div></div>';
}

export function hideWord() {
  els.wordCard.getAnimations().forEach((a) => a.cancel());
  els.wordCard.style.opacity = '0';
}

export { els, wait };
