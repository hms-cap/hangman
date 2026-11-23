// Tests for the Sudoku Elo: strategy detection (SudokuCoach.forcedBy) and the score/update formulas (sudoku-elo.js), with hand-computed numbers.
// Run: node tools/test-sudoku-elo.js
'use strict';
const C = require('../sudoku-coach.js');
const E = require('../sudoku-elo.js');
const { solve } = require('./sudoku-lib.js');
const fs = require('fs'), vm = require('vm');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + '/../puzzles.js', 'utf8'), ctx);
const P = ctx.window.SUDOKU_PUZZLES;
const grid = (lv, n) => [...P[lv].slice(n * 81, n * 81 + 81)].map(Number);
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)); };
const near = (name, got, want, tol = 1e-9) => { const ok = Math.abs(got - want) <= tol; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `  got ${got} want ${want}`)); };

// ---- forcedBy: plain candidates worked out independently here ----
const { UNITS, PEERS } = C;
const cands = (v, i) => { const s = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]); for (const p of PEERS[i]) s.delete(v[p]); return s; };
const unitsOf = i => UNITS.filter(u => u.includes(i));
const hiddenIn = (v, i, d) => unitsOf(i).some(u => u.filter(j => !v[j] && cands(v, j).has(d)).length === 1);

{ // easy #1: square 10 (row 2, col 2) holds 6; no other square in one of its houses can take 6, and it still has other candidates
  const v = grid('easy', 0), sol = solve(v, 1).solution, i = 10, d = 6;
  eq('hidden single: the board agrees (6 fits nowhere else in a house, square has >1 candidate)', [hiddenIn(v, i, d), cands(v, i).size > 1], [true, true]);
  eq('hidden single', C.forcedBy(v, i, sol[i]), 'hiddenSingle');
}
{ // easy #1: square 3 holds 8 and 8 is its only candidate; it is not a hidden single anywhere
  const v = grid('easy', 0), sol = solve(v, 1).solution, i = 3;
  eq('naked single: the board agrees (one candidate left, not hidden in any house)', [cands(v, i).size, hiddenIn(v, i, sol[i])], [1, false]);
  eq('naked single', C.forcedBy(v, i, sol[i]), 'nakedSingle');
}
{ // easy #4: square 40 is the last empty square of a house
  const v = grid('easy', 3), sol = solve(v, 1).solution, i = 40;
  eq('full house: the board agrees (all other squares of a house filled)', unitsOf(i).some(u => u.every(j => j === i || v[j])), true);
  eq('full house', C.forcedBy(v, i, sol[i]), 'fullHouse');
}
{ // easy #2: square 26 (2) is not a single of any kind until Pointing crosses something off
  const v = grid('easy', 1), sol = solve(v, 1).solution, i = 26;
  eq('pointing: the board agrees (no single in sight on the plain candidates)', [cands(v, i).size > 1, hiddenIn(v, i, sol[i])], [true, false]);
  eq('a move that needs pointing', C.forcedBy(v, i, sol[i]), 'pointing');
}
{ // a wrong number on the board is the caller's job to zero out: the same call works once it is
  const v = grid('easy', 0), sol = solve(v, 1).solution, i = 10; v[i] = 0;
  eq('the square itself may hold anything: it is cleared first', C.forcedBy(Object.assign(v.slice(), { [i]: 3 }), i, sol[i]), 'hiddenSingle');
}
{ // a guess-like move: expert puzzles have squares nothing in the guide forces
  const v = grid('expert', 0), sol = solve(v, 1).solution; let nulls = 0, keys = new Set();
  for (let i = 0; i < 81; i++) if (!v[i]) { const k = C.forcedBy(v, i, sol[i]); if (k === null) nulls++; else keys.add(k); }
  eq('guess-like: most opening squares of an expert puzzle are forced by nothing in the guide', nulls > 20, true);
  const i = v.findIndex((x, n) => !x && C.forcedBy(v, n, sol[n]) === null);
  eq('guess-like move returns null', C.forcedBy(v, i, sol[i]), null);
}
{ // every key it returns is a real technique, and every answer for a correct digit is stable across a long playthrough
  const names = new Set(C.TECHNIQUES.map(t => t.key)); let n = 0, bad = 0;
  for (let p = 0; p < 20; p++) { const v = grid('hard', p), sol = solve(v, 1).solution;
    for (let i = 0; i < 81; i++) if (!v[i]) { const k = C.forcedBy(v, i, sol[i]); n++; if (k !== null && !names.has(k)) bad++; } }
  eq(`all ${n} answers are known technique keys or null`, bad, 0);
}

{ // credit goes to the smallest sufficient tier: a move that pointing alone unlocks is credited to pointing/claiming, never to a pair or triple
  const v = grid('easy', 1), sol = solve(v, 1).solution, k = C.forcedBy(v, 26, sol[26]);
  eq('pointing-only move is credited to pointing, not a pair or triple', k, 'pointing');
  let tier1 = 0, harder = 0;
  for (let p = 0; p < 40; p++) { const g = grid('easy', p), sl = solve(g, 1).solution;
    for (let i = 0; i < 81; i++) if (!g[i]) { const x = C.forcedBy(g, i, sl[i]); if (x === 'pointing' || x === 'claiming') tier1++; else if (x && !['fullHouse', 'hiddenSingle', 'nakedSingle'].includes(x)) harder++; } }
  console.log(`info easy puzzles: ${tier1} opening moves credited to pointing/claiming, ${harder} to anything harder`);
  eq('easy puzzles have pointing/claiming credits', tier1 > 0, true);
}

// ---- speed: positions from real puzzles at every level ----
{ let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; let n = 0, tot = 0, worst = 0;
  for (const lv of ['easy', 'medium', 'hard', 'expert']) for (let p = 0; p < 60; p++) {
    const pz = grid(lv, p), sol = solve(pz, 1).solution;
    for (let r = 0; r < 4; r++) {
      const v = pz.slice(), emp = v.map((x, i) => x ? -1 : i).filter(i => i >= 0), keep = Math.floor(rnd() * emp.length * 0.9);
      for (let k = 0; k < keep; k++) { const e = emp[Math.floor(rnd() * emp.length)]; v[e] = sol[e]; }
      const e2 = v.map((x, i) => x ? -1 : i).filter(i => i >= 0); if (!e2.length) continue;
      const i = e2[Math.floor(rnd() * e2.length)], t = process.hrtime.bigint();
      C.forcedBy(v, i, sol[i]); const ms = Number(process.hrtime.bigint() - t) / 1e6; n++; tot += ms; worst = Math.max(worst, ms);
    } }
  console.log(`info forcedBy timing over ${n} positions: average ${(tot / n).toFixed(2)} ms, worst ${worst.toFixed(2)} ms`);
  eq('forcedBy is fast (average < 5 ms, worst < 15 ms on this machine)', tot / n < 5 && worst < 15, true);
}

// ---- formulas ----
near('expected: equal ratings', E.expected(1000, 1000), 0.5);
near('expected: puzzle 400 above', E.expected(800, 1200), 1 / 11);
near('expected: puzzle 400 below', E.expected(1400, 1000), 10 / 11);
eq('K by games rated', [0, 9, 10, 19, 20, 39, 40, 500].map(E.K), [64, 64, 40, 40, 24, 24, 16, 16]);
near('expectedSeconds(800) = 300', E.expectedSeconds(800), 300);
near('expectedSeconds(1150) = 600', E.expectedSeconds(1150), 600);
near('expectedSeconds(450) = 150', E.expectedSeconds(450), 150);
eq('unsolved scores 0 with no other parts', E.score({ solved: false, mistakes: 0, seconds: 10, puzzleRating: 800 }), { score: 0, parts: { base: 0 } });
// 1 − 2×0.15 − (0.2 + 0.1) − 3×0.04 + time(300s on an 800 puzzle = 0) = 0.28
eq('score: 2 mistakes, 1 reveal, 1 teach, 3 guesses, on time', E.score({ solved: true, mistakes: 2, revealHints: 1, teachHints: 1, guesses: 3, seconds: 300, puzzleRating: 800 }),
  { score: 0.28, parts: { base: 1, mistakes: -0.3, hints: -0.3, guesses: -0.12, time: 0 } });
eq('score: mistakes cap at −0.6 (5 mistakes), guesses cap at −0.2 (9 guesses)', E.score({ solved: true, mistakes: 5, revealHints: 0, teachHints: 0, guesses: 9, seconds: 300, puzzleRating: 800 }).parts,
  { base: 1, mistakes: -0.6, hints: 0, guesses: -0.2, time: 0 });
eq('score: half the expected time = +0.05; fast clean solve clamps to 1', [E.score({ solved: true, seconds: 150, puzzleRating: 800 }).parts.time, E.score({ solved: true, seconds: 150, puzzleRating: 800 }).score], [0.05, 1]);
eq('score: the time part clamps at +0.1 (floor of 30 s) and −0.1', [E.score({ solved: true, seconds: 1, puzzleRating: 800 }).parts.time, E.score({ solved: true, seconds: 5000, puzzleRating: 800 }).parts.time], [0.1, -0.1]);
eq('score: 1.5× the expected time on a 1150 puzzle (900 s vs 600 s): 0.05×log2(2/3)', E.score({ solved: true, seconds: 900, puzzleRating: 1150 }).parts.time, -0.029);
eq('score: never below 0', E.score({ solved: true, mistakes: 5, revealHints: 6, teachHints: 0, guesses: 9, seconds: 9999, puzzleRating: 800 }).score, 0);

{ // update: first game sets the start from the level, 800 vs a puzzle rated 800, clean on time: score 1, expected 0.5, K 64 → +32
  const a = E.update(null, { level: 'easy', idx: 4, puzzleRating: 800, solved: true, mistakes: 0, seconds: 300, techUsed: { hiddenSingle: 5, nakedSingle: 2 }, t: 1 });
  eq('update 1: before/after/delta/expected', [a.rated, a.before, a.after, a.delta, a.expected, a.score], [true, 800, 832, 32, 0.5, 1]);
  eq('update 1: state', [a.state.rating, a.state.games, a.state.best, a.state.history, a.state.tech, a.state.rated],
    [832, 1, 832, [{ t: 1, level: 'easy', idx: 4, pr: 800, s: 1, d: 32, r: 832 }], { hiddenSingle: 5, nakedSingle: 2 }, { 'easy:4': 1 }]);
  const re = E.update(a.state, { level: 'easy', idx: 4, puzzleRating: 800, solved: true, seconds: 300, techUsed: { hiddenSingle: 9 } });
  eq('replay of a rated puzzle is unrated: delta 0, state unchanged', [re.rated, re.delta, re.state.rating, re.state.games, re.state.tech], [false, 0, 832, 1, { hiddenSingle: 5, nakedSingle: 2 }]);
  // a loss on an expert puzzle (2000) for the first game: start 1800, expected 1/(1+10^0.5) = 0.24025, K 64 → round(−15.376) = −15
  const b = E.update(null, { level: 'expert', idx: 1, puzzleRating: 2000, solved: false });
  eq('update loss: first expert game', [b.rated, b.before, b.after, b.delta, b.expected, b.state.best], [true, 1800, 1785, -15, 0.24, 1785]);
  // a later game uses K 24 after 20 rated games: 1000 vs 1000, score 0.28 → 24 × (0.28 − 0.5) = −5.28 → −5
  let s = { rating: 1000, games: 20, best: 1000, history: [], tech: {}, rated: {} };
  const c = E.update(s, { level: 'easy', idx: 0, puzzleRating: 1000, solved: true, mistakes: 2, revealHints: 1, teachHints: 1, guesses: 3, seconds: 300 * Math.pow(2, 200 / 350) });
  eq('update K=24 after 20 games', [c.score, c.delta, c.after, c.state.games], [0.28, -5, 995, 21]);
  eq('best keeps the peak', c.state.best, 1000);
  eq('the input state is not changed', s, { rating: 1000, games: 20, best: 1000, history: [], tech: {}, rated: {} });
  let h = null; for (let k = 0; k < 230; k++) h = E.update(h, { level: 'easy', idx: k, puzzleRating: 800, solved: true, seconds: 300 }).state;
  eq('history keeps the last 200', [h.history.length, h.history[0].idx, h.games], [200, 30, 230]);
  eq('missing puzzle rating falls back to the level midpoint', E.update(null, { level: 'hard', idx: 0, puzzleRating: undefined, solved: true, seconds: 300 }).state.history[0].pr, 1550);
}
eq('suggestLevel', [E.suggestLevel(null), E.suggestLevel(700), E.suggestLevel(1000), E.suggestLevel(1400), E.suggestLevel(1700), E.suggestLevel(1800), E.suggestLevel(2400)], [null, 'easy', 'medium', 'hard', 'hard', 'expert', 'expert']);
eq('provisional until 10 rated games', [E.provisional({ games: 0 }), E.provisional({ games: 9 }), E.provisional({ games: 10 })], [true, true, false]);

console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
