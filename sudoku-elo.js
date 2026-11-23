// Sudoku Elo: a player rating from puzzle difficulty, mistakes, hints, time and the techniques the player probably used.
// Pure functions, no DOM. Browser: window.SudokuElo. Node: require('./sudoku-elo.js').
//
// A solved puzzle scores 0..1 (see score()); an unsolved one scores 0. The rating moves like Elo: K * (score - expected), where
// expected is the chance a player of that rating "wins" against a puzzle of that difficulty. Puzzle ratings come from sudoku-ratings.js.
(function (root) {
'use strict';
const LEVELS = ['easy', 'medium', 'hard', 'expert'];
const START = { easy: 800, medium: 1100, hard: 1450, expert: 1800 }; // first rated game's level sets the starting rating
const MID = { easy: 800, medium: 1175, hard: 1550, expert: 2025 };   // middle of each level's puzzle-rating band
const FLOOR = 100, KEEP = 200, PROVISIONAL = 10;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const r3 = x => Math.round(x * 1000) / 1000;

const expected = (player, puzzle) => 1 / (1 + Math.pow(10, (puzzle - player) / 400));
const K = games => games < 10 ? 64 : games < 20 ? 40 : games < 40 ? 24 : 16; // games = rated games played before this one
const expectedSeconds = r => 300 * Math.pow(2, (r - 800) / 350);

// g: { solved, mistakes, revealHints, teachHints, guesses, seconds, puzzleRating }
function score(g) {
  if (!g.solved) return { score: 0, parts: { base: 0 } };
  const secs = Math.max(30, +g.seconds || 0), pr = g.puzzleRating == null ? 1000 : g.puzzleRating;
  const parts = {
    base: 1,
    mistakes: -Math.min(0.6, 0.15 * (g.mistakes || 0)),
    hints: -(0.2 * (g.revealHints || 0) + 0.1 * (g.teachHints || 0)),
    guesses: -Math.min(0.2, 0.04 * (g.guesses || 0)),
    time: clamp(0.05 * Math.log2(expectedSeconds(pr) / secs), -0.1, 0.1),
  };
  const raw = parts.base + parts.mistakes + parts.hints + parts.guesses + parts.time;
  for (const k in parts) parts[k] = r3(parts[k]);
  return { score: r3(clamp(raw, 0, 1)), parts };
}

const fresh = () => ({ rating: null, games: 0, best: null, history: [], tech: {}, rated: {} });
const normalise = s => Object.assign(fresh(), s || {});

// g: the score() inputs plus { level, idx, puzzleRating, techUsed?, t? }.
// Returns { state, rated, delta, before, after, expected, score, parts }. The input state is not changed.
// A puzzle already in state.rated (a replay) is not rated: the state comes back as it was, with delta 0.
function update(state, g) {
  const s0 = normalise(state), key = g.level + ':' + g.idx, pr = g.puzzleRating == null ? MID[g.level] : g.puzzleRating;
  const sc = score(Object.assign({}, g, { puzzleRating: pr }));
  if (s0.rated[key]) return { state: s0, rated: false, delta: 0, before: s0.rating, after: s0.rating, expected: null, score: sc.score, parts: sc.parts };
  const before = s0.rating == null ? START[g.level] : s0.rating;
  const exp = expected(before, pr), delta = Math.round(K(s0.games) * (sc.score - exp));
  const after = Math.max(FLOOR, before + delta), real = after - before;
  const tech = Object.assign({}, s0.tech);
  for (const k in g.techUsed || {}) tech[k] = (tech[k] || 0) + g.techUsed[k];
  const state1 = {
    rating: after, games: s0.games + 1, best: Math.max(s0.best == null ? -Infinity : s0.best, after),
    history: s0.history.concat([{ t: g.t || Date.now(), level: g.level, idx: g.idx, pr, s: sc.score, d: real, r: after }]).slice(-KEEP),
    tech, rated: Object.assign({}, s0.rated, { [key]: 1 }),
  };
  return { state: state1, rated: true, delta: real, before, after, expected: r3(exp), score: sc.score, parts: sc.parts };
}

// The level whose band middle is nearest the rating (null before the first rated game)
function suggestLevel(rating) {
  if (rating == null) return null;
  return LEVELS.reduce((b, l) => Math.abs(MID[l] - rating) < Math.abs(MID[b] - rating) ? l : b, LEVELS[0]);
}
const provisional = state => !state || (state.games || 0) < PROVISIONAL;

const api = { START, MID, LEVELS, expected, K, expectedSeconds, score, update, fresh, suggestLevel, provisional };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SudokuElo = api;
})(typeof self !== 'undefined' ? self : this);
