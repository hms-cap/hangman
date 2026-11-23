// Simulates synthetic Sudoku players of known true strength and reports how fast sudoku-elo.js converges to that strength.
// Each player starts on 'medium' (wrong for most), then follows suggestLevel() on their current rating.
// Outcomes: a "good" solve with probability p = 1/(1+10^((pr-T)/400)), otherwise a "rough" game (35% unsolved).
// Run: node tools/sim-sudoku-elo.js
'use strict';
const E = require('../sudoku-elo.js');
const fs = require('fs'), vm = require('vm');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../sudoku-ratings.js', 'utf8'), ctx);
const R = ctx.window.SUDOKU_RATINGS;

const TRUE = [700, 1000, 1300, 1600, 2000, 2300];
const RUNS = 200, GAMES = 40, CHECK = [5, 10, 15, 20, 30, 40];
const BASE_SEED = 20261123;

// seeded RNG (mulberry32) so every run is reproducible
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const uni = (rnd, lo, hi) => lo + (hi - lo) * rnd();
const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)); // inclusive
function poisson(rnd, lam) { // Knuth's method
  const L = Math.exp(-lam); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
function pct(arr, q) {
  const s = [...arr].sort((a, b) => a - b), x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x);
  return s[lo] + (s[hi] - s[lo]) * (x - lo);
}

// The game record passed to E.update (plus the category used for diagnostics)
function playGame(rnd, T, pr) {
  const pGood = 1 / (1 + Math.pow(10, (pr - T) / 400));
  const seconds = E.expectedSeconds(pr) * Math.pow(2, (pr - T) / 350) * uni(rnd, 0.7, 1.4);
  if (rnd() < pGood) {
    return { cat: 'good', solved: true, mistakes: rnd() < 0.8 ? 0 : 1, revealHints: 0, teachHints: 0,
      guesses: int(rnd, 0, 1), seconds, puzzleRating: pr };
  }
  const failed = rnd() < 0.35;
  return { cat: failed ? 'roughFailed' : 'roughSolved', solved: !failed, mistakes: Math.min(3, 1 + poisson(rnd, 0.7)),
    revealHints: int(rnd, 0, 2), teachHints: 0, guesses: int(rnd, 1, 6), seconds, puzzleRating: pr };
}

function runPlayer(T, seed) {
  const rnd = mulberry32(seed);
  const out = { ratings: [], cats: [], scores: [], expected: [], parts: [] };
  const used = {}; for (const l of E.LEVELS) used[l] = new Set();
  let state = null;
  for (let n = 1; n <= GAMES; n++) {
    const level = state == null ? 'medium' : E.suggestLevel(state.rating);
    let idx; do idx = int(rnd, 0, R[level].length - 1); while (used[level].has(idx));
    used[level].add(idx);
    const g = playGame(rnd, T, R[level][idx]);
    const res = E.update(state, Object.assign({ level, idx, t: n }, g));
    state = res.state;
    out.ratings.push(res.after); out.cats.push(g.cat); out.scores.push(res.score);
    out.expected.push(res.expected); out.parts.push(res.parts);
  }
  return out;
}

const summary = [];
for (const T of TRUE) {
  const runs = [];
  for (let r = 0; r < RUNS; r++) runs.push(runPlayer(T, BASE_SEED + T * 1000 + r));
  const col = n => runs.map(x => x.ratings[n - 1]);
  const meanCurve = Array.from({ length: GAMES }, (_, i) => mean(col(i + 1)));

  const rows = CHECK.map(n => { const c = col(n); return { game: n, mean: Math.round(mean(c)), p10: Math.round(pct(c, 0.1)), p90: Math.round(pct(c, 0.9)) }; });
  console.log(`\n=== true strength T = ${T} (${RUNS} runs x ${GAMES} games, start medium) ===`);
  console.table(rows);

  const mae = n => mean(col(n).map(v => Math.abs(v - T)));
  let firstWithin = null; for (let n = 1; n <= GAMES; n++) if (Math.abs(meanCurve[n - 1] - T) <= 100) { firstWithin = n; break; }
  let lastOut = 0; for (let n = 1; n <= GAMES; n++) if (Math.abs(meanCurve[n - 1] - T) > 100) lastOut = n;
  const staysFrom = lastOut >= GAMES ? 'never' : lastOut + 1;

  // diagnostics: which games drive the drift
  const allCats = runs.flatMap(x => x.cats), allParts = runs.flatMap((x, ri) => x.parts.map((p, i) => ({ p, c: x.cats[i] })));
  const share = c => allCats.filter(x => x === c).length / allCats.length;
  const partMean = (cat, key) => { const xs = allParts.filter(x => x.c === cat).map(x => x.p[key] || 0); return xs.length ? mean(xs) : NaN; };
  const scoreMean = cat => { const xs = runs.flatMap(x => x.scores.filter((_, i) => x.cats[i] === cat)); return xs.length ? mean(xs) : NaN; };
  const late = runs.flatMap(x => x.ratings.length ? x.scores.slice(20).map((s, i) => ({ s, e: x.expected[20 + i] })) : []);
  const scoreGap = mean(late.map(x => x.s)) - mean(late.map(x => x.e));

  summary.push({
    T, mean40: Math.round(mean(col(40))), bias40: Math.round(mean(col(40)) - T),
    MAE20: Math.round(mae(20)), MAE40: Math.round(mae(40)),
    firstWithin100: firstWithin == null ? 'never' : firstWithin, staysFrom,
    goodShare: +share('good').toFixed(3), scoreGood: +scoreMean('good').toFixed(3), scoreRough: +scoreMean('roughSolved').toFixed(3),
    roughFailShare: +share('roughFailed').toFixed(3), scoreGap21_40: +scoreGap.toFixed(3),
    partsGood: ['mistakes', 'hints', 'guesses', 'time'].map(k => `${k} ${partMean('good', k).toFixed(3)}`).join(', '),
    partsRough: ['mistakes', 'hints', 'guesses', 'time'].map(k => `${k} ${partMean('roughSolved', k).toFixed(3)}`).join(', '),
  });
}

console.log('\n=== summary (bias = mean rating after game 40 minus T) ===');
console.table(summary.map(s => ({ T: s.T, mean40: s.mean40, bias40: s.bias40, MAE20: s.MAE20, MAE40: s.MAE40, firstWithin100: s.firstWithin100, staysFrom: s.staysFrom })));
console.log('=== diagnostics: what the game scores look like (scores in games 21-40 vs the Elo expectation) ===');
console.table(summary.map(s => ({ T: s.T, goodShare: s.goodShare, scoreGood: s.scoreGood, scoreRoughSolved: s.scoreRough, roughFailShare: s.roughFailShare, scoreGap21_40: s.scoreGap21_40 })));
console.log('mean score parts, good solves:');
for (const s of summary) console.log(`  T=${s.T}: ${s.partsGood}`);
console.log('mean score parts, rough solved games:');
for (const s of summary) console.log(`  T=${s.T}: ${s.partsRough}`);
