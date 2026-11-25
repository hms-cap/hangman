// Checks sudoku-training.js: each position has a unique solution, its crossed-off candidates never remove a solution digit, the coach's
// simplest step on it is exactly the named technique, and SudokuCoach.instances / checkStep behave (accept every instance; reject a wrong
// placement, crossing off a solution digit, and an empty answer). Run: node tools/check-sudoku-training.js
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
const coach = require(path.join(root, 'sudoku-coach.js'));
const { solve } = require('./sudoku-lib.js');
global.window = {};
require(path.join(root, 'sudoku-training.js'));
const T = global.window.SUDOKU_TRAINING;
const KEYS = ['fullHouse', 'hiddenSingle', 'nakedSingle', 'pointing', 'claiming', 'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple', 'xWing', 'xyWing', 'swordfish'];
const fails = [], cnt = {};
const fail = (k, n, msg) => fails.push(`${k} #${n}: ${msg}`);
for (const k of Object.keys(T)) if (!KEYS.includes(k)) fails.push('unknown technique ' + k);
for (const key of KEYS) {
  const list = T[key] || []; cnt[key] = list.length;
  if (list.length < 15) fails.push(`${key}: only ${list.length} positions`);
  list.forEach((s, n) => {
    const [v, e] = s.split('|'), values = Array.from(v, Number), elims = new Set(e ? e.split(' ').map(Number) : []);
    if (values.length !== 81 || values.some(x => !(x >= 0 && x <= 9))) return fail(key, n, 'bad values');
    const r = solve(values, 2); if (r.count !== 1) return fail(key, n, 'solutions: ' + r.count);
    const sol = r.solution;
    for (const x of elims) if (sol[(x / 10) | 0] === x % 10) fail(key, n, 'elim removes the solution digit ' + x);
    const l = coach.next(values, sol, elims); if (!l || l.key !== key) return fail(key, n, 'next() gives ' + (l && l.key));
    const inst = coach.instances(key, values, elims); if (!inst.length) return fail(key, n, 'no instances');
    const place = key === 'fullHouse' || key === 'hiddenSingle' || key === 'nakedSingle';
    const cand = coach.candidates(values, elims);
    for (const x of inst) {
      if (place ? !x.place : !(x.elims && x.elims.length)) fail(key, n, 'bad instance shape');
      if (place && sol[x.place[0]] !== x.place[1]) fail(key, n, 'instance places a wrong digit');
      const a = place ? { place: x.place } : { elims: x.elims }, c = coach.checkStep(key, values, elims, a);
      if (!c.ok) fail(key, n, 'rejects its own instance: ' + c.reason);
      if (!place && x.elims.some(([i, d]) => sol[i] === d)) fail(key, n, 'instance removes a solution digit');
    }
    // rejections
    const empty = [...values.keys()].filter(i => !values[i]);
    const wrongI = empty.find(i => !inst.some(x => x.place && x.place[0] === i));
    const wrong = { place: [wrongI, sol[wrongI] % 9 + 1] };
    if (coach.checkStep(key, values, elims, wrong).ok) fail(key, n, 'accepts a wrong placement');
    const ci = empty.find(i => cand[i] & (1 << (sol[i] - 1)));
    if (coach.checkStep(key, values, elims, { elims: [[ci, sol[ci]]] }).ok) fail(key, n, 'accepts crossing off the solution digit');
    for (const a of [{}, { elims: [] }, null]) if (coach.checkStep(key, values, elims, a).ok) fail(key, n, 'accepts an empty answer');
    if (!place && inst.length && inst[0].elims.length > 1) { // partial answers are not enough
      const part = coach.checkStep(key, values, elims, { elims: [inst[0].elims[0]] });
      if (part.ok && !inst.some(x => x.elims.length === 1 && x.elims[0].join() === inst[0].elims[0].join())) fail(key, n, 'accepts a partial answer');
    }
  });
}
console.log(KEYS.map(k => `${k} ${cnt[k]}`).join('  '));
if (fails.length) { console.log(fails.slice(0, 40).join('\n')); console.log(`${fails.length} failure(s)`); process.exit(1); }
console.log('✓ all good');
