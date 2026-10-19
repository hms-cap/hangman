// Coach tests: every lesson's move agrees with the solution, lessons have text and visuals, and the technique guide finds an example of each technique.
// Run: node tools/test-sudoku-coach.js [puzzlesPerLevel]
'use strict';
const C = require('../sudoku-coach.js');
const { solve } = require('./sudoku-lib.js');
const fs = require('fs'), vm = require('vm');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + '/../puzzles.js', 'utf8'), ctx);
const P = ctx.window.SUDOKU_PUZZLES;
const per = +process.argv[2] || 120;
let fails = 0;
const check = (name, cond, info = '') => { if (!cond || info) console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!cond) fails++; };
const grid = (lv, n) => [...P[lv].slice(n * 81, n * 81 + 81)].map(Number);
const sol = g => solve(g, 1).solution;

const seen = {}, t0 = Date.now(); let lessons = 0, bad = 0;
for (const lv of ['easy', 'medium', 'hard', 'expert']) {
  let solvedNoReveal = 0;
  for (let n = 0; n < per; n++) {
    const puzzle = grid(lv, n), solution = sol(puzzle), vals = puzzle.slice(), el = new Set(); let reveals = 0;
    for (let g = 0; g < 500; g++) {
      const l = C.next(vals, solution, el); if (!l) break; lessons++;
      seen[l.key] = (seen[l.key] || 0) + 1;
      if (!l.steps.length || l.steps.some(s => !s.text || /undefined|NaN/.test(s.text) || !s.hl)) { bad++; if (bad < 4) console.log('bad text', l.key, l.steps.map(s => s.text)); }
      if (l.action.type === 'place') { if (solution[l.action.i] !== l.action.d) { bad++; console.log('wrong placement', lv, n, l.key); } vals[l.action.i] = l.action.d; if (l.key === 'reveal') reveals++; }
      else { if (!l.action.elims.length) bad++; for (const [i, d] of l.action.elims) { if (solution[i] === d) { bad++; console.log('wrong elimination', lv, n, l.key, i, d); } el.add(i * 10 + d); } }
    }
    if (!vals.every((v, i) => v === solution[i])) { bad++; console.log('did not finish', lv, n); }
    if (!reveals) solvedNoReveal++;
  }
  console.log(`${lv}: ${solvedNoReveal}/${per} solved with guide techniques only`);
}
check('every lesson move agrees with the solution, and every lesson has text', bad === 0, `${lessons} lessons in ${Date.now() - t0} ms`);
console.log('technique counts', JSON.stringify(seen));

// Mistakes come first
{ const puzzle = grid('easy', 0), solution = sol(puzzle), vals = puzzle.slice(), i = vals.indexOf(0); vals[i] = solution[i] % 9 + 1;
  const l = C.next(vals, solution, new Set()); check('a wrong number is taught first', l.key === 'mistake' && l.action.i === i); }

// The guide finds an example of each technique
for (const t of C.TECHNIQUES) { if (t.key === 'reveal' || t.key === 'mistake') continue;
  const t1 = Date.now(); let ex = null;
  for (const lv of ['easy', 'medium', 'hard', 'expert']) { const arr = [...Array(40)].map((_, n) => grid(lv, n)); ex = C.findExample(t.key, arr, sol, 40); if (ex) { ex.lv = lv; break; } }
  check('guide example for ' + t.name, !!ex, ex ? `${ex.lv} #${ex.index + 1}, ${Date.now() - t1} ms` : ''); }
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
