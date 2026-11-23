// Gives each of the 4,000 Sudoku puzzles an Elo-style difficulty rating and writes sudoku-ratings.js.
// Each puzzle is solved step by step with the coach (sudoku-coach.js). Score = hardest technique (most), then number of
// non-single steps, then 'reveal' steps, then blank squares (tiebreak). Within a level, puzzles are ranked by score and the
// ranks are spread evenly over the level's band. Deterministic. Regenerate: node tools/rate-sudoku-elo.js
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const coach = require(path.join(root, 'sudoku-coach.js'));
const { solve } = require('./sudoku-lib.js');
global.window = {};
require(path.join(root, 'puzzles.js'));
const PUZ = global.window.SUDOKU_PUZZLES;

const BANDS = { easy: [600, 1000], medium: [1000, 1350], hard: [1350, 1750], expert: [1750, 2300] };
const TECH = ['fullHouse', 'hiddenSingle', 'nakedSingle', 'pointing', 'claiming', 'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple', 'xWing', 'xyWing', 'swordfish', 'reveal'];
const LETTER = { fullHouse: 'F', hiddenSingle: 'H', nakedSingle: 'N', pointing: 'P', claiming: 'C', nakedPair: 'A', hiddenPair: 'B', nakedTriple: 'T', hiddenTriple: 'U', xWing: 'X', xyWing: 'Y', swordfish: 'S', reveal: 'R' };
const TIER = { fullHouse: 0, hiddenSingle: 0, nakedSingle: 0, pointing: 1, claiming: 2, nakedPair: 3, hiddenPair: 4, nakedTriple: 5, hiddenTriple: 6, xWing: 7, xyWing: 8, swordfish: 9, reveal: 10 };
const SINGLES = new Set(['fullHouse', 'hiddenSingle', 'nakedSingle']);

function analyse(str) {
  const values = Array.from(str, Number), solution = solve(values, 1).solution;
  const blanks = values.filter(v => !v).length, elims = new Set(), counts = {};
  let hardest = 'fullHouse', nonSingle = 0, reveals = 0;
  for (let guard = 0; guard < 800; guard++) {
    const l = coach.next(values, solution, elims);
    if (!l) break;
    counts[l.key] = (counts[l.key] || 0) + 1;
    if (TIER[l.key] > TIER[hardest] || (TIER[l.key] === TIER[hardest] && TECH.indexOf(l.key) > TECH.indexOf(hardest))) hardest = l.key;
    if (!SINGLES.has(l.key)) nonSingle++;
    if (l.key === 'reveal') reveals++;
    if (l.action.type === 'place') values[l.action.i] = l.action.d; else l.action.elims.forEach(([i, d]) => elims.add(i * 10 + d));
  }
  if (values.some(v => !v)) throw new Error('unsolved puzzle ' + str);
  return { hardest, counts, nonSingle, reveals, blanks, score: TIER[hardest] * 1e7 + nonSingle * 1e4 + reveals * 100 + blanks };
}

const t0 = Date.now(); let calls = 0, callMs = 0;
const orig = coach.next; coach.next = function () { const s = process.hrtime.bigint(); const r = orig.apply(this, arguments); callMs += Number(process.hrtime.bigint() - s) / 1e6; calls++; return r; };

const out = {}, tech = {}, stats = {};
for (const lv of Object.keys(BANDS)) {
  const str = PUZ[lv], n = str.length / 81, rs = [];
  for (let k = 0; k < n; k++) rs.push(analyse(str.slice(k * 81, k * 81 + 81)));
  const order = rs.map((_, k) => k).sort((a, b) => rs[a].score - rs[b].score || a - b);
  const rank = new Array(n); // tied scores share the average rank
  for (let s = 0; s < n;) { let e = s; while (e + 1 < n && rs[order[e + 1]].score === rs[order[s]].score) e++; for (let j = s; j <= e; j++) rank[order[j]] = (s + e) / 2; s = e + 1; }
  const [lo, hi] = BANDS[lv];
  out[lv] = rs.map((_, k) => Math.round(lo + rank[k] / (n - 1) * (hi - lo)));
  tech[lv] = rs.map(r => LETTER[r.hardest]).join('');
  stats[lv] = rs;
  console.error(lv + ' done ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

const lines = [
  '// Elo-style difficulty rating for each of the 4,000 Sudoku puzzles in puzzles.js (same order: SUDOKU_RATINGS[level][k] is puzzle k of that level).',
  '// Made by solving every puzzle step by step with sudoku-coach.js and scoring: hardest technique needed (most weight), then the number of',
  '// steps beyond singles, then "reveal" steps (nothing in the guide works), then blank squares. Within a level, puzzles are ranked by that',
  '// score and the ranks are spread evenly over the level\'s band: Easy 600-1000, Medium 1000-1350, Hard 1350-1750, Expert 1750-2300.',
  '// Regenerate with: node tools/rate-sudoku-elo.js',
  '//',
  '// SUDOKU_PUZZLE_TECH[level][k] is one letter, the hardest technique puzzle k needs:',
  '//   F full house, H hidden single, N naked single, P pointing, C claiming, A naked pair, B hidden pair,',
  '//   T naked triple, U hidden triple, X X-Wing, Y XY-Wing, S swordfish, R beyond the guide (a reveal was needed)',
  'window.SUDOKU_RATINGS = {'];
for (const lv of Object.keys(BANDS)) {
  lines.push('  ' + lv + ': [');
  for (let k = 0; k < out[lv].length; k += 25) lines.push('    ' + out[lv].slice(k, k + 25).join(',') + (k + 25 < out[lv].length ? ',' : ''));
  lines.push('  ],');
}
lines.push('};', 'window.SUDOKU_PUZZLE_TECH = {');
for (const lv of Object.keys(BANDS)) lines.push('  ' + lv + ': "' + tech[lv] + '",');
lines.push('};', '');
fs.writeFileSync(path.join(root, 'sudoku-ratings.js'), lines.join('\n'));

// report
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
for (const lv of Object.keys(BANDS)) {
  const r = out[lv], by = {};
  stats[lv].forEach((s, k) => (by[s.hardest] = by[s.hardest] || []).push(r[k]));
  console.log(`${lv}: n=${r.length} min ${Math.min(...r)} median ${med(r)} max ${Math.max(...r)}  in-band ${r.every(x => x >= BANDS[lv][0] && x <= BANDS[lv][1])}`);
  console.log('   ' + TECH.filter(t => by[t]).map(t => `${t}: ${by[t].length} (mean ${mean(by[t]).toFixed(0)})`).join(' | '));
  console.log(`   mean nonSingle ${mean(stats[lv].map(s => s.nonSingle)).toFixed(1)}, mean reveals ${mean(stats[lv].map(s => s.reveals)).toFixed(2)}, puzzles with reveal ${stats[lv].filter(s => s.reveals).length}`);
}
console.log(`coach.next calls ${calls}, avg ${(callMs / calls).toFixed(3)} ms/call`);
console.log(`runtime ${((Date.now() - t0) / 1000).toFixed(1)}s`);
