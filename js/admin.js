// ============================================================
// admin.js — the admin dashboard (admin.html).
//
// Access is gated by the is_admin() database function (an email
// allow-list in the `admins` table). The UI check here is just for
// show; the real protection is Row-Level Security — a non-admin
// simply gets no rows back even if they reach this page.
//
// Tabs: Players · Aggregates · Feedback · Words (CRUD).
//
// Player ratings are computed here from the raw games (same formula as
// js/rating.js) rather than read from the player_ratings view, so the
// view never has to expose user ids to ordinary signed-in users.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';
import { computeRating, tierFor } from './rating.js';

const app = document.getElementById('admin-app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString() : '–');
const daysAgo = (t) => (t ? Math.floor((Date.now() - new Date(t)) / 86400000) : null);

let sb;

function loadLib() {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/lib/supabase.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Supabase library.'));
    document.head.appendChild(s);
  });
}

async function main() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT')) {
    app.innerHTML = '<div class="admin-center"><h1>⚙️ Not configured</h1><p>Add your keys to config/supabase.js.</p></div>';
    return;
  }
  await loadLib();
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
  });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderSignedOut();

  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) return renderDenied(session.user);
  renderDashboard(session.user);
}

function renderSignedOut() {
  app.innerHTML = `
    <div class="admin-center">
      <h1>🔒 Flyer Admin</h1>
      <p>Sign in with the admin Google account.</p>
      <button id="si" class="btn-google"><span class="g-mark">G</span> Sign in with Google</button>
    </div>`;
  document.getElementById('si').onclick = () =>
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}

function renderDenied(user) {
  app.innerHTML = `
    <div class="admin-center">
      <h1>⛔ Access denied</h1>
      <p><b>${esc(user.email)}</b> is not an admin.</p>
      <button id="so" class="btn-small">Sign out</button>
    </div>`;
  document.getElementById('so').onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

// ---------------- Dashboard shell ----------------

const TABS = [
  ['players', '👥 Players'],
  ['aggregates', '📊 Aggregates'],
  ['feedback', '💬 Feedback'],
  ['words', '📝 Words'],
];

function renderDashboard(user) {
  app.innerHTML = `
    <header class="admin-header">
      <div class="admin-title">🪽 Flyer Admin</div>
      <div class="admin-user">${esc(user.email)} <button id="so" class="btn-small">Sign out</button></div>
    </header>
    <nav class="admin-tabs">
      ${TABS.map(([k, label], i) => `<button class="admin-tab${i === 0 ? ' active' : ''}" data-tab="${k}">${label}</button>`).join('')}
    </nav>
    <main class="admin-content" id="admin-content"></main>`;
  document.getElementById('so').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  const tabs = [...app.querySelectorAll('.admin-tab')];
  tabs.forEach((t) => t.onclick = () => {
    tabs.forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    show(t.dataset.tab);
  });
  show('players');
}

const content = () => document.getElementById('admin-content');

async function show(tab) {
  content().innerHTML = '<p class="admin-loading">Loading…</p>';
  try {
    if (tab === 'players') return showPlayers();
    if (tab === 'aggregates') return showAggregates();
    if (tab === 'feedback') return showFeedback();
    if (tab === 'words') return showWords();
  } catch (e) {
    content().innerHTML = `<p class="admin-error">Error: ${esc(e.message)}</p>`;
  }
}

// ---------------- Shared data ----------------

// One fetch of profiles + games, grouped per player. Everything the
// Players and Aggregates tabs need is derived from this.
async function loadPlayerData() {
  // `email` only exists after schema.sql §12 has been run — fall back so
  // the dashboard still works on an un-migrated database.
  let profRes = await sb.from('profiles').select('id, display_name, email, created_at');
  if (profRes.error) profRes = await sb.from('profiles').select('id, display_name, created_at');
  const profiles = profRes.data;
  const { data: games } = await sb
    .from('games')
    .select('user_id, mode, words_survived, best_ms, avg_ms, correct, mistakes, played_at, won');
  const byUser = new Map();
  (games || []).forEach((g) => {
    if (!byUser.has(g.user_id)) byUser.set(g.user_id, []);
    byUser.get(g.user_id).push(g);
  });
  const players = (profiles || []).map((p) => {
    const gs = byUser.get(p.id) || [];
    const best = gs.reduce((m, g) => Math.max(m, g.words_survived || 0), 0);
    const msVals = gs.map((g) => g.avg_ms).filter((v) => v != null);
    const last = gs.reduce((m, g) => (!m || g.played_at > m ? g.played_at : m), null);
    const days = new Set(gs.map((g) => new Date(g.played_at).toDateString())).size;
    return {
      id: p.id,
      name: p.display_name,
      email: p.email,
      joined: p.created_at,
      games: gs.length,
      mpGames: gs.filter((g) => g.mode === 'multiplayer').length,
      crowns: gs.filter((g) => g.won).length,
      best,
      avgMs: msVals.length ? Math.round(msVals.reduce((a, b) => a + b, 0) / msVals.length) : null,
      last,
      activeDays: days,
      // games per active day — a simple "how often do they play" signal
      perDay: days ? +(gs.length / days).toFixed(1) : 0,
      rating: gs.length ? computeRating(gs).rating : null,
      raw: gs,
    };
  });
  return { players, allGames: games || [] };
}

// ---------------- Players ----------------

let playerSort = { key: 'rating', dir: -1 };
let playerQuery = '';
let playerCache = null;

async function showPlayers() {
  playerCache = (await loadPlayerData()).players;
  renderPlayers();
}

function renderPlayers() {
  const cols = [
    ['name', 'Player'], ['email', 'Email'], ['rating', 'Rating'],
    ['games', 'Games'], ['crowns', '👑'], ['best', 'Best'],
    ['avgMs', 'Avg ms'], ['perDay', 'Games/day'], ['last', 'Last played'],
  ];
  const q = playerQuery.trim().toLowerCase();
  const rows = playerCache
    .filter((p) => !q || (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const { key, dir } = playerSort;
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * dir;
    });

  content().innerHTML = `
    <div class="admin-toolbar">
      <input id="p-search" class="admin-input" type="search" placeholder="Search name or email…" value="${esc(playerQuery)}" />
      <span class="admin-sub">${rows.length} of ${playerCache.length} players</span>
    </div>
    <div class="admin-scroll">
      <table class="admin-table">
        <thead><tr>${cols.map(([k, l]) =>
          `<th class="sortable${playerSort.key === k ? ' sorted' : ''}" data-key="${k}">${l}${playerSort.key === k ? (playerSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((p) => `
          <tr class="p-row" data-id="${p.id}">
            <td>${esc(p.name)}</td>
            <td class="dim">${esc(p.email || '–')}</td>
            <td>${p.rating != null ? `<b style="color:${tierFor(p.rating).color}">${p.rating}</b>` : '–'}</td>
            <td>${p.games}</td><td>${p.crowns || '–'}</td><td>${p.best}</td>
            <td>${p.avgMs ?? '–'}</td><td>${p.perDay || '–'}</td>
            <td class="dim">${p.last ? `${fmtDate(p.last)}<br><small>${daysAgo(p.last)}d ago</small>` : '–'}</td>
          </tr>`).join('') || '<tr><td colspan="9" class="admin-sub">No players match.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div id="p-detail"></div>`;

  const search = document.getElementById('p-search');
  search.oninput = () => {
    playerQuery = search.value;
    const pos = search.selectionStart;
    renderPlayers();
    const s2 = document.getElementById('p-search');
    s2.focus(); s2.setSelectionRange(pos, pos);
  };
  content().querySelectorAll('th.sortable').forEach((th) => th.onclick = () => {
    const key = th.dataset.key;
    playerSort = playerSort.key === key
      ? { key, dir: -playerSort.dir }
      : { key, dir: key === 'name' || key === 'email' ? 1 : -1 };
    renderPlayers();
  });
  content().querySelectorAll('.p-row').forEach((tr) => tr.onclick = () => showPlayerDetail(tr.dataset.id));
}

// Per-player drill-down: their worst words + a rating trend.
async function showPlayerDetail(id) {
  const p = playerCache.find((x) => x.id === id);
  const box = document.getElementById('p-detail');
  if (!p) return;
  box.innerHTML = '<p class="admin-loading">Loading player…</p>';

  const { data: misses } = await sb.from('word_misses')
    .select('word, flies, misses').eq('user_id', id)
    .order('misses', { ascending: false }).limit(12);

  // Rating after each game, oldest → newest (same formula as the app).
  const chron = [...p.raw].sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  const history = chron.map((_, i) => computeRating(chron.slice(0, i + 1)).rating);
  const first = history[0] ?? null;
  const lastR = history[history.length - 1] ?? null;
  const change = first != null && lastR != null ? lastR - first : null;

  box.innerHTML = `
    <div class="detail-card">
      <div class="detail-head">
        <div>
          <div class="detail-name">${esc(p.name)}</div>
          <div class="admin-sub">${esc(p.email || 'no email')} · joined ${fmtDate(p.joined)}</div>
        </div>
        <button class="btn-small" id="d-close">Close</button>
      </div>
      <div class="admin-tiles">
        <div class="admin-tile"><span class="t-num" style="color:${p.rating != null ? tierFor(p.rating).color : 'inherit'}">${p.rating ?? '–'}</span><span class="t-label">${p.rating != null ? tierFor(p.rating).name : 'unrated'}</span></div>
        <div class="admin-tile"><span class="t-num">${p.games}</span><span class="t-label">games (${p.mpGames} group)</span></div>
        <div class="admin-tile"><span class="t-num">${p.crowns}👑</span><span class="t-label">crowns</span></div>
        <div class="admin-tile"><span class="t-num">${p.activeDays}</span><span class="t-label">active days</span></div>
        <div class="admin-tile"><span class="t-num">${p.perDay}</span><span class="t-label">games/active day</span></div>
        <div class="admin-tile"><span class="t-num">${p.avgMs ?? '–'}</span><span class="t-label">avg ms</span></div>
      </div>
      <h3 class="admin-h3">Rating history ${change != null ? `<span class="${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '▲ +' : '▼ '}${change}</span>` : ''}</h3>
      ${sparkline(history)}
      <h3 class="admin-h3">Most-missed words</h3>
      <div class="words-list">
        ${(misses || []).map((m) => `<span class="word-chip ${m.flies ? 'w-fly' : 'w-sit'}">${esc(m.word)} <span class="tricky-n">×${m.misses}</span></span>`).join('')
          || '<span class="admin-sub">No misses recorded.</span>'}
      </div>
    </div>`;
  document.getElementById('d-close').onclick = () => { box.innerHTML = ''; };
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Tiny inline SVG trend line — no chart library needed.
function sparkline(values) {
  if (!values || values.length < 2) return '<p class="admin-sub">Not enough games yet.</p>';
  const w = 480, h = 90, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<div class="spark-wrap">
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="spark">
      <polyline points="${pts}" fill="none" stroke="#ff9f43" stroke-width="3"
        stroke-linejoin="round" stroke-linecap="round" />
    </svg>
    <div class="spark-labels"><span>${min}</span><span>${values.length} games</span><span>${max}</span></div>
  </div>`;
}

// ---------------- Aggregates ----------------

async function showAggregates() {
  const [{ players, allGames }, diffRes, { data: feedback }] = await Promise.all([
    loadPlayerData(),
    sb.from('word_difficulty').select('*').limit(15),
    sb.from('feedback').select('rating'),
  ]);
  // The word_difficulty view arrives with schema.sql §15.
  const difficulty = diffRes.error ? null : diffRes.data;

  const labels = ['<250', '250–350', '350–450', '450–550', '550–700', '700+'];
  const buckets = labels.map(() => 0);
  let corr = 0, mist = 0, mp = 0;
  allGames.forEach((g) => {
    corr += g.correct || 0; mist += g.mistakes || 0;
    if (g.mode === 'multiplayer') mp++;
    const v = g.avg_ms;
    if (v == null) return;
    const i = v < 250 ? 0 : v < 350 ? 1 : v < 450 ? 2 : v < 550 ? 3 : v < 700 ? 4 : 5;
    buckets[i]++;
  });
  const accuracy = corr + mist ? Math.round((100 * corr) / (corr + mist)) : 0;
  const rated = players.filter((p) => p.rating != null);
  const avgRating = rated.length ? Math.round(rated.reduce((s, p) => s + p.rating, 0) / rated.length) : 0;
  const avgStars = feedback?.length
    ? (feedback.reduce((s, f) => s + (f.rating || 0), 0) / feedback.length).toFixed(1) : '–';

  // Activity: games per day over the last 14 days.
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return { label: d.toLocaleDateString(undefined, { day: 'numeric' }), key: d.toDateString(), n: 0 };
  });
  const dayMap = new Map(days.map((d) => [d.key, d]));
  allGames.forEach((g) => {
    const d = dayMap.get(new Date(g.played_at).toDateString());
    if (d) d.n++;
  });
  const activeLast7 = players.filter((p) => daysAgo(p.last) != null && daysAgo(p.last) <= 7).length;

  content().innerHTML = `
    <div class="admin-tiles">
      <div class="admin-tile"><span class="t-num">${players.length}</span><span class="t-label">players</span></div>
      <div class="admin-tile"><span class="t-num">${activeLast7}</span><span class="t-label">active (7d)</span></div>
      <div class="admin-tile"><span class="t-num">${allGames.length}</span><span class="t-label">games played</span></div>
      <div class="admin-tile"><span class="t-num">${mp}</span><span class="t-label">group games</span></div>
      <div class="admin-tile"><span class="t-num">${accuracy}%</span><span class="t-label">avg accuracy</span></div>
      <div class="admin-tile"><span class="t-num">${avgRating}</span><span class="t-label">avg rating</span></div>
      <div class="admin-tile"><span class="t-num">${avgStars}★</span><span class="t-label">avg feedback</span></div>
    </div>

    <h3 class="admin-h3">Games per day (last 14 days)</h3>
    ${barChart(days.map((d) => ({ label: d.label, value: d.n })))}

    <h3 class="admin-h3">Reaction-time distribution (avg per game, ms)</h3>
    ${barChart(labels.map((l, i) => ({ label: l, value: buckets[i] })))}

    <h3 class="admin-h3">Hardest words (most missed, all players)</h3>
    <div class="admin-scroll short">
      <table class="admin-table">
        <thead><tr><th>Word</th><th>Type</th><th>Misses</th><th>Players</th></tr></thead>
        <tbody>${(difficulty || []).map((w) => `
          <tr><td>${esc(w.word)}</td>
              <td class="dim">${w.flies ? '🕊️ fly' : '⬇️ sit'}</td>
              <td>${w.total_misses}</td><td>${w.players_missed}</td></tr>`).join('')
          || `<tr><td colspan="4" class="admin-sub">${difficulty === null
                ? 'Run the latest supabase/schema.sql to enable this.'
                : 'No misses recorded yet.'}</td></tr>`}
        </tbody>
      </table>
    </div>

    <h3 class="admin-h3">Top players by rating</h3>
    <div class="admin-scroll short">
      <table class="admin-table">
        <thead><tr><th>#</th><th>Player</th><th>Rating</th><th>Games</th><th>👑</th></tr></thead>
        <tbody>${rated.sort((a, b) => b.rating - a.rating).slice(0, 10).map((p, i) => `
          <tr><td>${i + 1}</td><td>${esc(p.name)}</td>
              <td><b style="color:${tierFor(p.rating).color}">${p.rating}</b></td>
              <td>${p.games}</td><td>${p.crowns || '–'}</td></tr>`).join('')
          || '<tr><td colspan="5" class="admin-sub">No rated players yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function barChart(items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="admin-bars">
    ${items.map((i) => `
      <div class="admin-bar">
        <div class="bar-fill" style="height:${Math.round((i.value / max) * 100)}%"><span>${i.value || ''}</span></div>
        <div class="bar-label">${esc(i.label)}</div>
      </div>`).join('')}
  </div>`;
}

// ---------------- Feedback ----------------

async function showFeedback() {
  const { data } = await sb.from('feedback').select('*').order('created_at', { ascending: false });
  const rows = data || [];
  if (!rows.length) { content().innerHTML = '<p class="admin-sub">No feedback yet.</p>'; return; }
  const avg = (rows.reduce((s, f) => s + (f.rating || 0), 0) / rows.length).toFixed(1);
  content().innerHTML = `
    <div class="admin-tiles">
      <div class="admin-tile"><span class="t-num">${rows.length}</span><span class="t-label">messages</span></div>
      <div class="admin-tile"><span class="t-num">${avg}★</span><span class="t-label">average</span></div>
    </div>
    <div class="admin-scroll">
      <div class="fb-cards">
        ${rows.map((f) => `
          <div class="fb-card">
            <div class="fb-top"><span class="fb-stars-show">${'★'.repeat(f.rating || 0)}${'☆'.repeat(5 - (f.rating || 0))}</span>
              <span class="fb-name">${esc(f.name || 'Anonymous')}</span>
              <span class="fb-date">${fmtDate(f.created_at)}</span></div>
            ${f.comment ? `<div class="fb-comment-show">${esc(f.comment)}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

// ---------------- Words (CRUD) ----------------

let wordQuery = '';
let wordCache = [];

async function showWords() {
  const { data } = await sb.from('words').select('*').order('text');
  wordCache = data || [];
  renderWords();
}

function renderWords() {
  const q = wordQuery.trim().toLowerCase();
  const match = wordCache.filter((w) => !q || w.text.toLowerCase().includes(q));
  const fly = match.filter((w) => w.flies);
  const ground = match.filter((w) => !w.flies);
  const exact = q && wordCache.some((w) => w.text.toLowerCase() === q);

  const col = (title, list, total) => `
    <div class="words-col">
      <h3 class="admin-h3">${title} <span class="words-count">${list.length}${q ? ` / ${total}` : ''}</span></h3>
      <div class="words-list admin-scroll tall">
        ${list.map((w) => `
          <span class="word-chip ${w.flies ? 'w-fly' : 'w-sit'}">${esc(w.text)}
            <button class="word-flip" data-id="${w.id}" data-flies="${w.flies}" title="Move to the other list">⇄</button>
            <button class="word-del" data-id="${w.id}" title="Delete">×</button>
          </span>`).join('') || '<span class="admin-sub">no matches</span>'}
      </div>
    </div>`;

  content().innerHTML = `
    <div class="admin-toolbar">
      <input id="w-search" class="admin-input" type="search" placeholder="Search words…" value="${esc(wordQuery)}" />
      <span class="admin-sub">${wordCache.length} words total${q ? ` · ${match.length} match` : ''}
        ${q ? (exact ? '<b class="ok">· exists ✓</b>' : '<b class="warn">· not in list</b>') : ''}</span>
    </div>
    <div class="words-add">
      <input id="w-text" class="admin-input" placeholder="New word (e.g. Peacock)" maxlength="24" value="${esc(q && !exact ? wordQuery.trim() : '')}" />
      <select id="w-flies" class="admin-input">
        <option value="true">🕊️ flies (FLY)</option>
        <option value="false">⬇️ doesn't fly (SIT)</option>
      </select>
      <button id="w-add" class="btn-small">Add word</button>
    </div>
    <p class="admin-note" id="w-note"></p>
    <div class="words-cols">
      ${col('🕊️ Fly', fly, wordCache.filter((w) => w.flies).length)}
      ${col('⬇️ Sit', ground, wordCache.filter((w) => !w.flies).length)}
    </div>`;

  const search = document.getElementById('w-search');
  search.oninput = () => {
    wordQuery = search.value;
    const pos = search.selectionStart;
    renderWords();
    const s2 = document.getElementById('w-search');
    s2.focus(); s2.setSelectionRange(pos, pos);
  };

  document.getElementById('w-add').onclick = async () => {
    const text = document.getElementById('w-text').value.trim();
    const flies = document.getElementById('w-flies').value === 'true';
    if (!text) return;
    const { error } = await sb.from('words').insert({ text, flies });
    const note = document.getElementById('w-note');
    if (error) { note.textContent = `Could not add: ${error.message}`; note.className = 'admin-note err'; return; }
    wordQuery = '';
    showWords();
  };
  content().querySelectorAll('.word-del').forEach((b) => b.onclick = async () => {
    if (!confirm('Delete this word?')) return;
    const { error } = await sb.from('words').delete().eq('id', Number(b.dataset.id));
    if (error) alert(error.message); else showWords();
  });
  content().querySelectorAll('.word-flip').forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('words')
      .update({ flies: b.dataset.flies !== 'true' })
      .eq('id', Number(b.dataset.id));
    if (error) alert(error.message); else showWords();
  });
}

main();
