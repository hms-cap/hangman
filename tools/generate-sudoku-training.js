// Builds sudoku-training.js: a bank of Sudoku training positions, one list per solving technique, for the strategy trainer.
// Every puzzle in puzzles.js is solved step by step with the coach (sudoku-coach.js). Where the coach's simplest available step is technique K
// (so nothing easier works), the position BEFORE that step is a candidate for K. Up to 2 per puzzle per technique; singles need 20-60 empty
// squares and placement techniques prefer 1-6 instances. If a technique is short of TARGET, extra puzzles are generated (seeded) until it is full.
// Deterministic. Regenerate: node tools/generate-sudoku-training.js [--no-extra]
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const coach = require(path.join(root, 'sudoku-coach.js'));
const lib = require('./sudoku-lib.js');
global.window = {};
require(path.join(root, 'puzzles.js'));
const PUZ = global.window.SUDOKU_PUZZLES;
const KEYS = ['fullHouse', 'hiddenSingle', 'nakedSingle', 'pointing', 'claiming', 'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple', 'xWing', 'xyWing', 'swordfish'];
const PLACE = new Set(['fullHouse', 'hiddenSingle', 'nakedSingle']);
const TARGET = 30, MIN = 15, PER_PUZZLE = 2, EXTRA_ATTEMPTS = 4000, EXTRA_SECONDS = 540;

const pool = {}; KEYS.forEach(k => pool[k] = []);
let order = 0;
function walk(grid, src) {
  const values = Array.from(grid, Number), solution = lib.solve(values, 1).solution, elims = new Set(), found = {};
  for (let guard = 0; guard < 800; guard++) {
    const l = coach.next(values, solution, elims);
    if (!l || l.key === 'reveal') break;
    if (pool[l.key]) {
      const empties = values.filter(v => !v).length, n = coach.instances(l.key, values, elims).length;
      const good = n > 0 && (!PLACE.has(l.key) ? true : n <= 6) && (!PLACE.has(l.key) || (empties >= 20 && empties <= 60));
      (found[l.key] = found[l.key] || []).push({ values: values.join(''), elims: [...elims].sort((a, b) => a - b), empties, n, good, src, order: order++ });
    }
    if (l.action.type === 'place') values[l.action.i] = l.action.d; else l.action.elims.forEach(([i, d]) => elims.add(i * 10 + d));
  }
  for (const k in found) { // at most 2 per puzzle: prefer good ones; take the earliest and the latest for variety
    const a = found[k].filter(x => x.good), use = a.length ? a : (PLACE.has(k) ? [] : found[k]);
    const pick = use.length <= PER_PUZZLE ? use : [use[0], use[use.length - 1]];
    for (const p of pick) pool[k].push(p);
  }
}
const t0 = Date.now(); let srcN = 0;
for (const lv of ['easy', 'medium', 'hard', 'expert']) {
  const n = PUZ[lv].length / 81;
  for (let k = 0; k < n; k++) walk(PUZ[lv].slice(k * 81, k * 81 + 81), srcN++);
}
console.error('walked ' + srcN + ' puzzles in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's; pool', KEYS.map(k => k + ' ' + pool[k].filter(x => x.good).length).join(', '));

if (!process.argv.includes('--no-extra')) {
  const short = () => KEYS.filter(k => pool[k].filter(x => x.good).length < TARGET);
  const rand = lib.mulberry(20261125); let tries = 0; const t1 = Date.now();
  while (short().length && tries < EXTRA_ATTEMPTS && (Date.now() - t1) / 1000 < EXTRA_SECONDS) {
    tries++;
    const g = lib.generate(4, rand); if (!g) continue;
    walk(g.grid, srcN++);
    if (tries % 20 === 0) console.error('extra ' + tries + ' short: ' + short().map(k => k + ' ' + pool[k].filter(x => x.good).length).join(', '));
  }
  console.error('extra puzzles tried: ' + tries);
}

const out = {}, report = [];
for (const k of KEYS) {
  const good = pool[k].filter(x => x.good), rest = pool[k].filter(x => !x.good);
  let chosen;
  if (good.length >= TARGET) { // spread evenly over the pool, in source order
    chosen = []; for (let j = 0; j < TARGET; j++) chosen.push(good[Math.floor(j * good.length / TARGET)]);
  } else chosen = good.concat(PLACE.has(k) ? [] : rest.slice(0, TARGET - good.length));
  // easier first: singles by fewer instances... see below; singles: more empty squares = harder; others: fewer instances = harder
  chosen.sort(PLACE.has(k) ? (a, b) => a.empties - b.empties || b.n - a.n || a.order - b.order : (a, b) => b.n - a.n || a.empties - b.empties || a.order - b.order);
  out[k] = chosen; report.push(k + ' ' + chosen.length);
}
console.error('chosen: ' + report.join(', '));

const lines = [
  '// Sudoku training positions for the strategy trainer: for each technique, positions where the coach\'s simplest available step is that technique.',
  '// Format: SUDOKU_TRAINING[key] is a list (easier first) of strings "<81 digits, 0 = empty>|<crossed-off candidates>": the board and, after the bar,',
  '// the candidates already removed by earlier steps as space-separated numbers i*10+d (i = square 0..80 row by row, d = digit 1..9); empty if none.',
  '// Candidates are everything the rows, columns and boxes allow, minus those. Check answers with SudokuCoach.checkStep(key, values, elims, answer).',
  '// Keys: fullHouse hiddenSingle nakedSingle pointing claiming nakedPair hiddenPair nakedTriple hiddenTriple xWing xyWing swordfish.',
  '// Made by tools/generate-sudoku-training.js (walks the solve path of every puzzle in puzzles.js). Regenerate: node tools/generate-sudoku-training.js',
  'window.SUDOKU_TRAINING = {'];
for (const k of KEYS) {
  lines.push('  ' + k + ': [');
  out[k].forEach(p => lines.push('    "' + p.values + '|' + p.elims.join(' ') + '",'));
  lines.push('  ],');
}
lines.push('};', '');
fs.writeFileSync(path.join(root, 'sudoku-training.js'), lines.join('\n'));
console.error('wrote sudoku-training.js ' + fs.statSync(path.join(root, 'sudoku-training.js')).size + ' bytes');
