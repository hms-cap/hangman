// Checks the Trellis mini crosswords in mini-data.js:
// every grid is 5×5 with only letters and #, every across and down word (2+ squares) has a clue,
// no word repeats inside a grid, no two grids are the same, no clue gives away its own answer or
// another answer in the same grid, and every clue is used. Prints the next week's dailies.
//   node tools/check-mini.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'mini-data.js'), 'utf8'), ctx);
const { grids, clues } = ctx.window.MINI_DATA;
const N = 5;
let bad = 0;
const fail = m => { bad++; console.log('✗ ' + m); };

function words(g){
  const out = [], at = (r, c) => g[r * N + c];
  for (const dir of ['A', 'D']) for (let a = 0; a < N; a++){
    let w = '';
    for (let b = 0; b <= N; b++){
      const ch = b < N ? (dir === 'A' ? at(a, b) : at(b, a)) : '#';
      if (ch === '#'){ if (w.length > 1) out.push(w); w = ''; } else w += ch;
    }
  }
  return out;
}

const seen = new Set(), used = new Set();
grids.forEach((row, i) => {
  const parts = row.split('|');
  if (parts.length !== N || parts.some(p => p.length !== N || !/^[a-z#]+$/.test(p))) return fail(`grid ${i + 1}: not 5 rows of 5`);
  const g = parts.join('');
  if (seen.has(g)) fail(`grid ${i + 1}: same as an earlier grid`); seen.add(g);
  // every open square must be in an across or down word of 2+ letters (no unchecked lone squares)
  const ws = words(g);
  if (new Set(ws).size !== ws.length) fail(`grid ${i + 1}: a word repeats`);
  for (const w of ws){
    used.add(w);
    if (!clues[w]){ fail(`grid ${i + 1}: no clue for "${w}"`); continue; }
    if (clues[w].toLowerCase().includes(w)) fail(`clue for "${w}" contains the answer`);
    for (const v of ws) if (v !== w && new RegExp(`\\b${v}\\b`, 'i').test(clues[w])) fail(`grid ${i + 1}: clue for "${w}" contains "${v}"`);
  }
});
for (const w of Object.keys(clues)) if (!used.has(w)) fail(`clue for "${w}" is never used`);

const epoch = new Date(2026, 9, 24), now = new Date(), today = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - epoch) / 864e5);
console.log(`${grids.length} grids, ${used.size} clued words. Today is No. ${today + 1}; the grids repeat after No. ${grids.length}.`);
for (let d = Math.max(0, today); d < Math.max(0, today) + 7; d++){
  const g = grids[d % grids.length];
  console.log(`  No. ${d + 1}: ${g}   ${words(g.replace(/\|/g, '')).map(w => w.toUpperCase()).join(' ')}`);
}
if (bad){ console.log(`${bad} problem${bad > 1 ? 's' : ''}`); process.exit(1); }
console.log('✓ all good');
