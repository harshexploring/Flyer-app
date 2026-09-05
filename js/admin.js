// ============================================================
// admin.js — the admin dashboard (admin.html).
//
// Access is gated by the is_admin() database function (an email
// allow-list in the `admins` table). The UI check here is just for
// show; the real protection is Row-Level Security — a non-admin
// simply gets no rows back even if they reach this page.
//
// Tabs: Players · Aggregates · Feedback · Words (CRUD).
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

const app = document.getElementById('admin-app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString() : '–');

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
const loading = () => { content().innerHTML = '<p class="admin-loading">Loading…</p>'; };

async function show(tab) {
  loading();
  try {
    if (tab === 'players') return showPlayers();
    if (tab === 'aggregates') return showAggregates();
    if (tab === 'feedback') return showFeedback();
    if (tab === 'words') return showWords();
  } catch (e) {
    content().innerHTML = `<p class="admin-error">Error: ${esc(e.message)}</p>`;
  }
}

// ---------------- Players ----------------

async function showPlayers() {
  const [{ data: profiles }, { data: games }] = await Promise.all([
    sb.from('profiles').select('id, display_name, created_at'),
    sb.from('games').select('user_id, words_survived, played_at'),
  ]);
  const byUser = {};
  (games || []).forEach((g) => {
    const u = (byUser[g.user_id] ||= { games: 0, best: 0, last: null });
    u.games++;
    u.best = Math.max(u.best, g.words_survived);
    if (!u.last || g.played_at > u.last) u.last = g.played_at;
  });
  const rows = (profiles || [])
    .map((p) => ({ name: p.display_name, joined: p.created_at, ...(byUser[p.id] || { games: 0, best: 0, last: null }) }))
    .sort((a, b) => b.games - a.games);

  content().innerHTML = `
    <p class="admin-sub">${rows.length} players onboarded</p>
    <table class="admin-table">
      <thead><tr><th>Player</th><th>Games</th><th>Best</th><th>Joined</th><th>Last played</th></tr></thead>
      <tbody>${rows.map((r) => `
        <tr><td>${esc(r.name)}</td><td>${r.games}</td><td>${r.best}</td><td>${fmtDate(r.joined)}</td><td>${fmtDate(r.last)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

// ---------------- Aggregates ----------------

async function showAggregates() {
  const [{ data: games }, { count: players }] = await Promise.all([
    sb.from('games').select('avg_ms, correct, mistakes, mode'),
    sb.from('profiles').select('*', { count: 'exact', head: true }),
  ]);
  const labels = ['<250', '250–350', '350–450', '450–550', '550–700', '700+'];
  const buckets = labels.map(() => 0);
  let corr = 0, mist = 0, mp = 0;
  (games || []).forEach((g) => {
    corr += g.correct || 0; mist += g.mistakes || 0;
    if (g.mode === 'multiplayer') mp++;
    const v = g.avg_ms;
    if (v == null) return;
    const i = v < 250 ? 0 : v < 350 ? 1 : v < 450 ? 2 : v < 550 ? 3 : v < 700 ? 4 : 5;
    buckets[i]++;
  });
  const total = games?.length || 0;
  const accuracy = corr + mist ? Math.round((100 * corr) / (corr + mist)) : 0;
  const maxB = Math.max(1, ...buckets);

  content().innerHTML = `
    <div class="admin-tiles">
      <div class="admin-tile"><span class="t-num">${players || 0}</span><span class="t-label">players</span></div>
      <div class="admin-tile"><span class="t-num">${total}</span><span class="t-label">games played</span></div>
      <div class="admin-tile"><span class="t-num">${mp}</span><span class="t-label">multiplayer</span></div>
      <div class="admin-tile"><span class="t-num">${accuracy}%</span><span class="t-label">avg accuracy</span></div>
    </div>
    <h3 class="admin-h3">Reaction-time distribution (avg per game, ms)</h3>
    <div class="admin-bars">
      ${buckets.map((b, i) => `
        <div class="admin-bar">
          <div class="bar-fill" style="height:${Math.round((b / maxB) * 100)}%"><span>${b}</span></div>
          <div class="bar-label">${labels[i]}</div>
        </div>`).join('')}
    </div>`;
}

// ---------------- Feedback ----------------

async function showFeedback() {
  const { data } = await sb.from('feedback').select('*').order('created_at', { ascending: false });
  const rows = data || [];
  if (!rows.length) { content().innerHTML = '<p class="admin-sub">No feedback yet.</p>'; return; }
  content().innerHTML = `
    <p class="admin-sub">${rows.length} messages</p>
    <div class="fb-cards">
      ${rows.map((f) => `
        <div class="fb-card">
          <div class="fb-top"><span class="fb-stars-show">${'★'.repeat(f.rating || 0)}${'☆'.repeat(5 - (f.rating || 0))}</span>
            <span class="fb-name">${esc(f.name || 'Anonymous')}</span>
            <span class="fb-date">${fmtDate(f.created_at)}</span></div>
          ${f.comment ? `<div class="fb-comment-show">${esc(f.comment)}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

// ---------------- Words (CRUD) ----------------

async function showWords() {
  const { data } = await sb.from('words').select('*').order('text');
  const words = data || [];
  const fly = words.filter((w) => w.flies);
  const ground = words.filter((w) => !w.flies);

  const col = (title, list) => `
    <div class="words-col">
      <h3 class="admin-h3">${title} <span class="words-count">${list.length}</span></h3>
      <div class="words-list">
        ${list.map((w) => `
          <span class="word-chip">${esc(w.text)}
            <button class="word-flip" data-id="${w.id}" data-flies="${w.flies}"
              title="Move to the other list">⇄</button>
            <button class="word-del" data-id="${w.id}" title="Delete">×</button>
          </span>`).join('') || '<span class="admin-sub">none</span>'}
      </div>
    </div>`;

  content().innerHTML = `
    <div class="words-add">
      <input id="w-text" class="admin-input" placeholder="New word (e.g. Peacock)" maxlength="24" />
      <select id="w-flies" class="admin-input">
        <option value="true">🕊️ flies (FLY)</option>
        <option value="false">⬇️ doesn't fly (SIT)</option>
      </select>
      <button id="w-add" class="btn-small">Add word</button>
    </div>
    <p class="admin-note" id="w-note"></p>
    <div class="words-cols">${col('🕊️ Fly', fly)}${col('⬇️ Sit', ground)}</div>`;

  document.getElementById('w-add').onclick = async () => {
    const text = document.getElementById('w-text').value.trim();
    const flies = document.getElementById('w-flies').value === 'true';
    if (!text) return;
    const { error } = await sb.from('words').insert({ text, flies });
    const note = document.getElementById('w-note');
    if (error) { note.textContent = `Could not add: ${error.message}`; note.className = 'admin-note err'; return; }
    showWords();
  };
  content().querySelectorAll('.word-del').forEach((b) => b.onclick = async () => {
    if (!confirm('Delete this word?')) return;
    const { error } = await sb.from('words').delete().eq('id', Number(b.dataset.id));
    if (error) alert(error.message); else showWords();
  });
  // Update: move a word between the fly and sit lists.
  content().querySelectorAll('.word-flip').forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('words')
      .update({ flies: b.dataset.flies !== 'true' })
      .eq('id', Number(b.dataset.id));
    if (error) alert(error.message); else showWords();
  });
}

main();
