// ============================================================
// auth.js — Google sign-in + leaderboard data, via Supabase.
//
// Everything here is OPTIONAL: if Supabase isn't configured, or the
// user is a guest, every function safely no-ops and the game plays
// exactly as before. Only signed-in players write scores.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';
import { computeRating } from './rating.js';

let client = null;
let clientPromise = null;
let currentUser = null;      // { id, name, avatar } or null
const listeners = [];

export function isConfigured() {
  return (
    SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT') &&
    SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR-')
  );
}

// Load the vendored Supabase library once (kept out of the initial
// page load so guests who never sign in don't pay for it).
function loadLib() {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/lib/supabase.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the Supabase library.'));
    document.head.appendChild(s);
  });
}

async function getClient() {
  if (!isConfigured()) return null;
  if (client) return client;
  if (!clientPromise) {
    clientPromise = (async () => {
      await loadLib();
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      return client;
    })();
  }
  return clientPromise;
}

function toProfile(user) {
  const m = user.user_metadata || {};
  return {
    id: user.id,
    name: m.full_name || m.name || 'Player',
    avatar: m.avatar_url || m.picture || null,
  };
}

// ---------------- Session ----------------

export function getUser() {
  return currentUser;
}

export function onAuthChange(fn) {
  listeners.push(fn);
  fn(currentUser); // fire immediately with current state
}

function emit() {
  for (const fn of listeners) fn(currentUser);
}

// Call once at boot. Restores an existing session (including right
// after the Google redirect) and watches for sign-in / sign-out.
export async function initAuth() {
  const c = await getClient();
  if (!c) { emit(); return; }
  try {
    const { data } = await c.auth.getSession();
    currentUser = data.session?.user ? toProfile(data.session.user) : null;
    emit();
    c.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user ? toProfile(session.user) : null;
      emit();
    });
  } catch (e) {
    console.warn('auth init failed (continuing as guest):', e.message);
    emit();
  }
}

export async function signInWithGoogle() {
  const c = await getClient();
  if (!c) return;
  await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
}

// ---------------- Data ----------------

// Save one finished game. No-op for guests. Returns the row or null.
export async function saveGame({ mode, wordsSurvived, bestMs, avgMs, correct, mistakes }) {
  const c = await getClient();
  if (!c || !currentUser) return null;
  const { data, error } = await c
    .from('games')
    .insert({
      user_id: currentUser.id,
      mode,
      words_survived: wordsSurvived,
      best_ms: bestMs ?? null,
      avg_ms: avgMs ?? null,
      correct: correct ?? 0,
      mistakes: mistakes ?? 0,
    })
    .select()
    .single();
  if (error) { console.warn('saveGame failed:', error.message); return null; }
  return data;
}

const VIEWS = {
  rating: 'leaderboard_rating',
  weekly: 'leaderboard_weekly',
  fastest: 'leaderboard_fastest',
  // Not a leaderboard tab — used by getRankForScore() to rank a run by
  // words survived. Keep it here or rank lookups silently break.
  alltime: 'leaderboard_alltime',
};

export async function getLeaderboard(kind = 'rating') {
  const c = await getClient();
  if (!c) return [];
  const { data, error } = await c.from(VIEWS[kind] || VIEWS.rating).select('*');
  if (error) { console.warn('leaderboard failed:', error.message); return []; }
  return data || [];
}

// Leave feedback (⭐ 1-5 + optional comment). Works for signed-in users.
export async function submitFeedback({ rating, comment }) {
  const c = await getClient();
  if (!c) return false;
  const { error } = await c.from('feedback').insert({
    user_id: currentUser?.id ?? null,
    name: currentUser?.name ?? 'Guest',
    rating,
    comment: comment || null,
  });
  if (error) { console.warn('feedback failed:', error.message); return false; }
  return true;
}

// Record the words that cost a life this game (signed-in players only),
// so the profile can show "your tricky words".
export async function recordMisses(mistakes) {
  const c = await getClient();
  if (!c || !currentUser || !mistakes?.length) return;
  const words = mistakes.map((m) => m.text);
  const flies = mistakes.map((m) => !!m.flies);
  const { error } = await c.rpc('record_misses', { p_words: words, p_flies: flies });
  if (error) console.warn('record_misses failed:', error.message);
}

// Count consecutive days (up to today/yesterday) the player has games for.
function dayStreak(playedAts) {
  const days = new Set(playedAts.map((t) => new Date(t).toDateString()));
  if (days.size === 0) return 0;
  const oneDay = 86400000;
  let streak = 0;
  const d = new Date();
  // If they haven't played today, the streak can still be "alive" from
  // yesterday — start counting there.
  if (!days.has(d.toDateString())) d.setTime(d.getTime() - oneDay);
  while (days.has(d.toDateString())) { streak += 1; d.setTime(d.getTime() - oneDay); }
  return streak;
}

// Everything the profile / navbar needs, including the live rating.
export async function getMyStats() {
  const c = await getClient();
  if (!c || !currentUser) return null;
  const { data: games, error } = await c
    .from('games')
    .select('mode, words_survived, best_ms, avg_ms, correct, mistakes, played_at')
    .eq('user_id', currentUser.id);
  if (error || !games) return null;

  const best = games.reduce((m, g) => Math.max(m, g.words_survived), 0);
  const fastest = games.reduce(
    (m, g) => (g.best_ms != null ? Math.min(m, g.best_ms) : m), Infinity);
  const avgVals = games.map((g) => g.avg_ms).filter((v) => v != null);
  const avgReaction = avgVals.length
    ? Math.round(avgVals.reduce((a, b) => a + b, 0) / avgVals.length) : null;
  const mpGames = games.filter((g) => g.mode === 'multiplayer').length;

  // Only the most RECENTLY missed words (never a huge growing list).
  const { data: misses } = await c
    .from('word_misses')
    .select('word, flies, misses')
    .eq('user_id', currentUser.id)
    .order('last_missed_at', { ascending: false })
    .limit(7);

  return {
    best,
    fastest: fastest === Infinity ? null : fastest,
    avgReaction,
    played: games.length,
    mpGames,
    streak: dayStreak(games.map((g) => g.played_at)),
    rating: computeRating(games),
    topMisses: misses || [],
  };
}

// Rank + "top X%" for a player's BEST score, against the all-time board.
// Pass the player's best (not a single run's score) — the board is built
// from bests, so mixing the two can rank you below yourself.
// Exact while there are ≤100 players; approximate (top-100) beyond that.
export async function getRankForScore(bestWords) {
  const board = await getLeaderboard('alltime');
  const total = board.length;
  if (total === 0) return { rank: 1, total: 0, percentile: null };
  const better = board.filter((r) => (r.best_words ?? 0) > bestWords).length;
  const rank = better + 1;
  return {
    rank,
    total,
    // "top X%" — SMALLER is better. #1 of 4 → top 25%. Guard with
    // max(rank,total) for a score not yet reflected on the board.
    percentile: Math.max(1, Math.round((rank / Math.max(rank, total)) * 100)),
  };
}
