// ============================================================
// account.js — the single place a finished game is recorded and the
// player's live stats/rating are cached.
//
// Why this module exists: solo (main.js) and multiplayer
// (multiplayer.js) both finish games. Previously only the solo path
// refreshed the navbar, so group games never moved the visible
// rating. Both paths now go through recordGame() here, so a new game
// mode can't silently skip the update.
//
// Everything no-ops for guests.
// ============================================================

import * as auth from './auth.js';

let stats = null;        // last known getMyStats() result
let ratingNow = null;    // last known rating number
const listeners = [];

export function getStats() { return stats; }
export function getRating() { return ratingNow; }

// Called whenever stats change (navbar listens).
export function onChange(fn) { listeners.push(fn); }
function emit() { for (const fn of listeners) fn(stats); }

// Re-read this account's stats from the server. Safe to call often.
export async function refresh() {
  if (!auth.getUser()) {
    stats = null;
    ratingNow = null;
    emit();
    return null;
  }
  stats = await auth.getMyStats();
  ratingNow = stats?.rating?.rating ?? null;
  emit();
  return stats;
}

// Save a finished game (solo OR group), record its tricky words, then
// refresh. Returns { stats, delta } where delta is the rating change,
// or null for guests / when the rating isn't known yet.
export async function recordGame(game, mistakes = []) {
  if (!auth.getUser()) return { stats: null, delta: null, saved: false };

  const before = ratingNow;
  const row = await auth.saveGame(game);
  if (mistakes.length) await auth.recordMisses(mistakes);
  await refresh();
  const after = ratingNow;

  return {
    stats,
    saved: !!row,
    delta: before != null && after != null ? after - before : null,
  };
}
