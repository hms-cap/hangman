// Makes new Trellis grids: 5×5 with two opposite black corners, every across and down word an everyday
// word from Tendril's dictionary (trailwords.js, the UPPERCASE targets), skipping plurals and -ed forms.
// It reads the grids already in mini-data.js so words aren't overused (each word at most twice in all)
// and no new grid shares 3+ words with an old one. It prints the new grids and the words that still need
// a clue; paste the grids at the end of MINI_DATA.grids, write the clues, then run tools/check-mini.js.
//   node tools/generate-mini.js [count=10] [seed=1]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const count = +process.argv[2] || 10;
let seed = +process.argv[3] || 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// words not to use: obscure, gloomy or not for a family game
const AVOID = new Set(`remap ovoid cabal ennui tepee leper slosh whey noose ovary tumor ulcer pagan arson prude crone loser apnea dirge
  annul nadir aorta humus anode udder shyly abbot harem idiot`.split(/\s+/));

// the Tendril dictionary, front-coded: digit = letters shared with the previous word; an UPPERCASE suffix marks a target word
const src = fs.readFileSync(path.join(root, 'trailwords.js'), 'utf8').match(/TRAIL_WORDS = "([^"]*)"/)[1];
let prev = ''; const common = [];
for (const m of src.matchAll(/(\d)([a-zA-Z]+)/g)){
  const w = (prev.slice(0, +m[1]) + m[2]).toLowerCase();
  if (/[A-Z]/.test(m[2]) && m[2] === m[2].toUpperCase()) common.push(w);
  prev = w;
}
const all = new Set(common);
const pool = common.filter(w => !AVOID.has(w) && !((w.endsWith('s') && !w.endsWith('ss') && all.has(w.slice(0, -1))) || (w.endsWith('es') && all.has(w.slice(0, -2))) || (w.endsWith('ed') && (all.has(w.slice(0, -2)) || all.has(w.slice(0, -1))))));
const WORDS = { 4: pool.filter(w => w.length === 4), 5: pool.filter(w => w.length === 5) };
const pre = new Set(); for (const L of [4, 5]) for (const w of WORDS[L]) for (let i = 0; i <= L; i++) pre.add(L + ':' + w.slice(0, i));

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'mini-data.js'), 'utf8'), ctx);
const DATA = ctx.window.MINI_DATA;

function slots(p){
  const g = p.split('|'), S = [];
  for (let r = 0; r < 5; r++){ let c = 0; while (c < 5){ if (g[r][c] === '#'){ c++; continue; } const s = c; while (c < 5 && g[r][c] !== '#') c++; if (c - s > 1) S.push({ dir: 'A', cells: [...Array(c - s)].map((_, i) => [r, s + i]) }); } }
  for (let c = 0; c < 5; c++){ let r = 0; while (r < 5){ if (g[r][c] === '#'){ r++; continue; } const s = r; while (r < 5 && g[r][c] !== '#') r++; if (r - s > 1) S.push({ dir: 'D', cells: [...Array(r - s)].map((_, i) => [s + i, c]) }); } }
  return { g, S };
}
const wordsOf = row => { const { g, S } = slots(row); return S.map(s => s.cells.map(([r, c]) => g[r][c]).join('')); };
const used = new Map(), old = DATA.grids.map(wordsOf);
old.flat().forEach(w => used.set(w, (used.get(w) || 0) + 1));

function fill(p){
  const { g, S } = slots(p), grid = g.map(r => r.split('')), across = S.filter(s => s.dir === 'A'), downs = S.filter(s => s.dir === 'D');
  let nodes = 0;
  const prefix = d => d.cells.map(([a, b]) => grid[a][b]).join('').replace(/\..*$/, '');
  function rec(i, chosen){
    if (++nodes > 20000) return null;
    if (i === across.length){
      const dw = downs.map(s => s.cells.map(([r, c]) => grid[r][c]).join('')), ws = chosen.concat(dw);
      return new Set(ws).size === ws.length ? grid.map(r => r.join('')).join('|') : null;
    }
    const s = across[i];
    const allow = s.cells.map(([r, c]) => { const d = downs.find(x => x.cells.some(([rr, cc]) => rr === r && cc === c)); if (!d) return null;
      const pf = prefix(d), L = d.cells.length, ok = new Set(); for (const ch of 'abcdefghijklmnopqrstuvwxyz') if (pre.has(L + ':' + pf + ch)) ok.add(ch); return ok; });
    for (const w of shuffle(WORDS[s.cells.length].filter(w => allow.every((ok, k) => !ok || ok.has(w[k]))))){
      if (chosen.includes(w) || (used.get(w) || 0) >= 2) continue;
      s.cells.forEach(([r, c], k) => grid[r][c] = w[k]);
      if (downs.every(d => pre.has(d.cells.length + ':' + prefix(d)))){ const x = rec(i + 1, chosen.concat(w)); if (x) return x; }
      s.cells.forEach(([r, c]) => grid[r][c] = '.');
    }
    return null;
  }
  return rec(0, []);
}

const PATTERNS = ['#....|.....|.....|.....|....#', '....#|.....|.....|.....|#....'], made = [];
for (let tries = 0; made.length < count && tries < count * 200; tries++){
  const x = fill(PATTERNS[(DATA.grids.length + made.length) % 2]); if (!x) continue;
  const ws = wordsOf(x);
  if (old.some(o => ws.filter(w => o.includes(w)).length >= 3)) continue;
  ws.forEach(w => used.set(w, (used.get(w) || 0) + 1)); old.push(ws); made.push(x);
}
console.log('New grids:\n' + made.map(g => `    "${g}",`).join('\n'));
const need = [...new Set(made.flatMap(wordsOf))].filter(w => !DATA.clues[w]).sort();
console.log(`\nWords that need a clue (${need.length}):\n` + need.join(' '));
