// ============================================================
// rating.js — the "Flyer Rating" (0–3000): a skill number, not a
// volume number. A player who grinds many games doesn't out-rank a
// sharper one. Computed over the player's most recent 20 games.
//
//   accuracy = correct / (correct + mistakes)      weight 0.45
//   speed    = clamp((700 - avgMs) / 450, 0..1)      weight 0.35
//   depth    = clamp(bestWords / 35, 0..1)           weight 0.20
//   base     = 3000 * weighted sum
//   rating   = min(3000, base + crownBonus)
//
// Crowns 👑 = group games won, counted over ALL games (a win is a
// lasting achievement, not recent form). Each crown adds +30, capped
// at +300 — so winning a group game moves your rating far more than a
// typical solo run, which only nudges a 20-game average.
//
// MUST stay in sync with the player_ratings view in
// supabase/schema.sql (the leaderboard uses that; this powers the
// player's own live rating in the navbar/profile).
// ============================================================

export const RATING_CONFIG = {
  recentGames: 20,
  speedBestMs: 250, // at/under this, speed component is ~maxed
  speedWorstMs: 700,
  depthTarget: 35,  // words survived that maxes the depth component
  weights: { accuracy: 0.45, speed: 0.35, depth: 0.20 },
  crownBonus: 30,   // rating points per group-game win
  crownBonusMax: 300,
  provisionalUnder: 5,
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// games: [{ correct, mistakes, avg_ms, words_survived, played_at, won }]
export function computeRating(games) {
  if (!games || games.length === 0) {
    return { rating: 0, games: 0, accuracy: 0, avgMs: null, crowns: 0, provisional: true };
  }
  const recent = [...games]
    .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    .slice(0, RATING_CONFIG.recentGames);

  const correct = recent.reduce((s, g) => s + (g.correct || 0), 0);
  const mistakes = recent.reduce((s, g) => s + (g.mistakes || 0), 0);
  const msVals = recent.map((g) => g.avg_ms).filter((v) => v != null);
  const avgMs = msVals.length ? msVals.reduce((a, b) => a + b, 0) / msVals.length : null;
  const bestWords = recent.reduce((m, g) => Math.max(m, g.words_survived || 0), 0);

  const accuracy = correct + mistakes > 0 ? correct / (correct + mistakes) : 0;
  const { speedWorstMs, speedBestMs, depthTarget, weights } = RATING_CONFIG;
  const speed = clamp01((speedWorstMs - (avgMs ?? speedWorstMs)) / (speedWorstMs - speedBestMs));
  const depth = clamp01(bestWords / depthTarget);

  const base =
    3000 * (weights.accuracy * accuracy + weights.speed * speed + weights.depth * depth);

  // Crowns count over ALL games, not just recent form.
  const crowns = games.filter((g) => g.won).length;
  const crownBonus = Math.min(
    RATING_CONFIG.crownBonusMax, RATING_CONFIG.crownBonus * crowns);

  return {
    rating: Math.min(3000, Math.round(base + crownBonus)),
    games: games.length,
    accuracy,
    avgMs: avgMs != null ? Math.round(avgMs) : null,
    crowns,
    provisional: games.length < RATING_CONFIG.provisionalUnder,
  };
}

// Tier / league for a rating, for the gamification hook.
const TIERS = [
  { min: 2500, name: 'Diamond', emoji: '💎', color: '#5ec6e6' },
  { min: 2000, name: 'Platinum', emoji: '🔷', color: '#7fb0d6' },
  { min: 1400, name: 'Gold', emoji: '🥇', color: '#e8b83a' },
  { min: 800,  name: 'Silver', emoji: '🥈', color: '#b9c0c8' },
  { min: 0,    name: 'Bronze', emoji: '🥉', color: '#cd8a4b' },
];

export function tierFor(rating) {
  return TIERS.find((t) => rating >= t.min) || TIERS[TIERS.length - 1];
}
