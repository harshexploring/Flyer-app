// ============================================================
// UI layer — owns the DOM. Renders words, runs the result
// animations (fly up / settle down / burst), the timer bar,
// screen flashes and the overlay screens.
// All animation helpers are async so main.js can sequence them.
// ============================================================

const els = {};

export function init() {
  const ids = [
    'stage', 'word-card', 'flash', 'timer-fill',
    'fly-btn', 'ground-btn', 'mute-btn',
    'score-pill', 'best-pill',
    'start-screen', 'gameover-screen', 'play-btn', 'replay-btn',
    'killer-line', 'stat-survived', 'stat-avg', 'stat-fastest', 'new-best',
    'friends-btn', 'name-screen', 'name-input', 'name-ok-btn',
    'lobby-screen', 'lobby-panel', 'report-screen', 'report-panel',
    'players-strip', 'spectator-banner',
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

export function showGameOver({ stats, word, action, isNewBest }) {
  const why =
    action === 'timeout'
      ? `Too slow! “${word.text}” ${word.flies ? 'flew away' : 'just sat there'}…`
      : word.flies
        ? `Oops — a ${word.text.toLowerCase()} does fly!`
        : `Oops — a ${word.text.toLowerCase()} can't fly!`;

  els.killerLine.textContent = why;
  els.statSurvived.textContent = stats.survived;
  els.statAvg.textContent = stats.avgMs != null ? `${stats.avgMs} ms` : '–';
  els.statFastest.textContent = stats.bestMs != null ? `${stats.bestMs} ms` : '–';
  els.newBest.classList.toggle('hidden', !isNewBest);
  els.gameoverScreen.classList.remove('hidden');
}

export function hideScreens() {
  els.startScreen.classList.add('hidden');
  els.gameoverScreen.classList.add('hidden');
  els.nameScreen.classList.add('hidden');
  els.lobbyScreen.classList.add('hidden');
  els.reportScreen.classList.add('hidden');
}

// ---------------- Multiplayer screens ----------------

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ask for a nickname; resolves with the trimmed name.
export function promptName() {
  hideScreens();
  els.nameScreen.classList.remove('hidden');
  els.nameInput.value = localStorage.getItem('flyer-name') || '';
  els.nameInput.focus();

  return new Promise((resolve) => {
    const submit = () => {
      const name = els.nameInput.value.trim().slice(0, 16);
      if (!name) { els.nameInput.focus(); return; }
      localStorage.setItem('flyer-name', name);
      els.nameOkBtn.removeEventListener('click', submit);
      els.nameInput.removeEventListener('keydown', onKey);
      els.nameScreen.classList.add('hidden');
      resolve(name);
    };
    const onKey = (e) => { if (e.key === 'Enter') submit(); e.stopPropagation(); };
    els.nameOkBtn.addEventListener('click', submit);
    els.nameInput.addEventListener('keydown', onKey);
  });
}

export function showLobby({ code, players, myId, maxPlayers, onStart, onLeave }) {
  hideScreens();
  const link = `${location.origin}${location.pathname}?room=${code}`;
  const me = players.find((p) => p.id === myId);
  const isHost = !!me?.isHost;

  els.lobbyPanel.innerHTML = `
    <h1 class="panel-title">🛖 Room</h1>
    <div class="lobby-code-row">
      <span class="lobby-code">${esc(code)}</span>
      <button class="btn-small" id="copy-link-btn">Copy link</button>
    </div>
    <div class="lobby-players">
      ${players.map((p) => `
        <div class="lobby-player">
          <span>${p.id === myId ? '🫵' : '🙂'}</span>
          <span>${esc(p.name)}${p.id === myId ? ' (you)' : ''}</span>
          ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
        </div>`).join('')}
    </div>
    <p class="lobby-hint">${players.length}/${maxPlayers} players · share the link to invite</p>
    ${isHost
      ? '<button class="btn-big" id="lobby-start-btn">Start game</button>'
      : '<p class="lobby-hint">Waiting for the host to start…</p>'}
    <p style="margin-top:12px"><button class="btn-small" id="lobby-leave-btn">Leave</button></p>
  `;
  els.lobbyScreen.classList.remove('hidden');

  document.getElementById('copy-link-btn').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(link);
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy link'; }, 1500);
    } catch {
      prompt('Copy this link:', link);
    }
  });
  document.getElementById('lobby-start-btn')?.addEventListener('click', onStart);
  document.getElementById('lobby-leave-btn').addEventListener('click', onLeave);
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

export function showPlayersStrip(players, myId) {
  els.playersStrip.innerHTML = players.map((p) => `
    <div class="player-chip alive ${p.id === myId ? 'me' : ''}" data-player-id="${esc(p.id)}">
      <span class="chip-name">${esc(p.name)}</span>
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

// After each round: green stays alive, red = out; show reaction ms.
export function applyRoundOutcomes(outcomes) {
  for (const o of outcomes) {
    const el = chip(o.id);
    if (!el) continue;
    const ms = el.querySelector('.chip-ms');
    if (o.correct) {
      ms.textContent = `${o.reactionMs} ms`;
      ms.classList.remove('hidden');
    } else {
      el.classList.remove('alive');
      el.classList.add('dead');
      ms.textContent = o.action === 'timeout' ? '⏰' : '✗';
      ms.classList.remove('hidden');
    }
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

export function showReport({ report, winnerIds, myId, isHost, onPlayAgain, onLeave }) {
  const fmt = (v, suffix = '') => (v == null ? '–' : `${v}${suffix}`);
  const title = winnerIds.length === 0
    ? '💥 Everyone udd gaya!'
    : winnerIds.includes(myId) ? '🏆 You win!' : '🏁 Game over!';

  els.reportPanel.innerHTML = `
    <h1 class="panel-title">${title}</h1>
    <p class="panel-sub">${winnerIds.length ? esc(report.find((r) => r.winner)?.name ?? '') + ' is the last one standing' : 'it ends in a draw'}</p>
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
    <div class="report-actions">
      ${isHost ? '<button class="btn-big" id="report-again-btn">Play again</button>' : '<p class="lobby-hint">Waiting for the host to restart…</p>'}
      <button class="btn-small" id="report-leave-btn">Leave</button>
    </div>
  `;
  els.reportScreen.classList.remove('hidden');
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
