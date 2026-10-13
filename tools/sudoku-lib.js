// Shared Sudoku logic: solver (uniqueness), generator, and a human-technique rater.
// Ratings: 1 Easy (singles) · 2 Medium (locked candidates, pairs) · 3 Hard (triples/quads, X-Wing, XY-Wing) · 4 Expert (needs more)
'use strict';
const ROW = i => (i / 9) | 0, COL = i => i % 9, BOX = i => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push([...Array(9)].map((_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push([...Array(9)].map((_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) { const u = []; for (let k = 0; k < 9; k++) u.push((((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (b % 3) * 3 + (k % 3)); UNITS.push(u); }
const PEERS = [...Array(81)].map((_, i) => { const s = new Set(); for (const u of UNITS) if (u.includes(i)) u.forEach(j => j !== i && s.add(j)); return [...s]; });
const POP = new Uint8Array(512); for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
const LOWBIT_DIGIT = m => 31 - Math.clz32(m & -m) + 1; // digit 1..9 of lowest set bit
const bit = d => 1 << (d - 1);

// Count solutions up to `limit`; optionally capture the first one and shuffle digit order.
function solve(grid, limit = 2, rand = null) {
  const g = Array.from(grid), rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) if (g[i]) { const b = bit(g[i]); if ((rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]) & b) return { count: 0 }; rows[ROW(i)] |= b; cols[COL(i)] |= b; boxes[BOX(i)] |= b; }
  let count = 0, first = null;
  (function rec() {
    let best = -1, bestMask = 0, bestPop = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const m = 511 & ~(rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]), p = POP[m];
      if (p < bestPop) { best = i; bestMask = m; bestPop = p; if (p <= 1) break; }
    }
    if (best < 0) { count++; if (!first) first = g.slice(); return; }
    if (!bestMask) return;
    const ds = []; for (let d = 1; d <= 9; d++) if (bestMask & bit(d)) ds.push(d);
    if (rand) for (let k = ds.length - 1; k > 0; k--) { const j = (rand() * (k + 1)) | 0; [ds[k], ds[j]] = [ds[j], ds[k]]; }
    const r = ROW(best), c = COL(best), x = BOX(best);
    for (const d of ds) {
      const b = bit(d); g[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
      rec();
      g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b;
      if (count >= limit) return;
    }
  })();
  return { count, solution: first };
}

// ---------- Rater ----------
function rate(grid) {
  const val = Array.from(grid), cand = new Uint16Array(81);
  for (let i = 0; i < 81; i++) if (!val[i]) { let m = 511; for (const p of PEERS[i]) if (val[p]) m &= ~bit(val[p]); cand[i] = m; }
  const place = (i, d) => { val[i] = d; cand[i] = 0; const b = ~bit(d); for (const p of PEERS[i]) cand[p] &= b; };
  const elim = (i, mask) => { if (cand[i] & mask) { cand[i] &= ~mask; return true; } return false; };
  let level = 1, steps = 0;
  const T = {
    nakedSingle() { for (let i = 0; i < 81; i++) if (!val[i] && POP[cand[i]] === 1) { place(i, LOWBIT_DIGIT(cand[i])); return true; } return false; },
    hiddenSingle() {
      for (const u of UNITS) for (let d = 1; d <= 9; d++) { const b = bit(d); let at = -1, n = 0;
        for (const i of u) if (cand[i] & b) { n++; at = i; if (n > 1) break; }
        if (n === 1) { place(at, d); return true; } }
      return false; },
    locked() {
      let ch = false;
      for (let ui = 18; ui < 27; ui++) for (let d = 1; d <= 9; d++) { const b = bit(d), cs = UNITS[ui].filter(i => cand[i] & b); if (cs.length < 2) continue;
        for (const [f, base] of [[ROW, 0], [COL, 9]]) if (cs.every(i => f(i) === f(cs[0]))) for (const j of UNITS[base + f(cs[0])]) if (BOX(j) !== ui - 18) ch = elim(j, b) || ch;
        if (ch) return true; }
      for (let ui = 0; ui < 18; ui++) for (let d = 1; d <= 9; d++) { const b = bit(d), cs = UNITS[ui].filter(i => cand[i] & b); if (cs.length < 2) continue;
        if (cs.every(i => BOX(i) === BOX(cs[0]))) for (const j of UNITS[18 + BOX(cs[0])]) if (!UNITS[ui].includes(j)) ch = elim(j, b) || ch;
        if (ch) return true; }
      return false; },
    nakedSubset(k) {
      for (const u of UNITS) { const cells = u.filter(i => !val[i] && POP[cand[i]] >= 2 && POP[cand[i]] <= k);
        for (const combo of combos(cells, k)) { let m = 0; for (const i of combo) m |= cand[i];
          if (POP[m] === k) { let ch = false; for (const j of u) if (!val[j] && !combo.includes(j)) ch = elim(j, m) || ch; if (ch) return true; } } }
      return false; },
    hiddenSubset(k) {
      for (const u of UNITS) { const ds = []; for (let d = 1; d <= 9; d++) { const n = u.filter(i => cand[i] & bit(d)).length; if (n >= 2 && n <= k) ds.push(d); }
        for (const combo of combos(ds, k)) { let dm = 0; for (const d of combo) dm |= bit(d);
          const cells = u.filter(i => cand[i] & dm); if (cells.length === k) { let ch = false; for (const i of cells) if (cand[i] & ~dm) { cand[i] &= dm; ch = true; } if (ch) return true; } } }
      return false; },
    xwing() {
      for (let d = 1; d <= 9; d++) { const b = bit(d);
        for (const [lines, cross, other] of [[0, COL, 9], [9, ROW, 0]]) {
          const pos = []; for (let l = 0; l < 9; l++) { const cs = UNITS[lines + l].filter(i => cand[i] & b); if (cs.length === 2) pos.push([l, cross(cs[0]), cross(cs[1])]); }
          for (let a = 0; a < pos.length; a++) for (let c = a + 1; c < pos.length; c++) if (pos[a][1] === pos[c][1] && pos[a][2] === pos[c][2]) {
            let ch = false; for (const x of [pos[a][1], pos[a][2]]) for (const j of UNITS[other + x]) { const l = lines === 0 ? ROW(j) : COL(j); if (l !== pos[a][0] && l !== pos[c][0]) ch = elim(j, b) || ch; }
            if (ch) return true; } } }
      return false; },
    xywing() {
      for (let p = 0; p < 81; p++) { if (POP[cand[p]] !== 2) continue;
        const wings = PEERS[p].filter(i => POP[cand[i]] === 2 && POP[cand[i] & cand[p]] === 1);
        for (let a = 0; a < wings.length; a++) for (let c = a + 1; c < wings.length; c++) { const A = wings[a], B = wings[c];
          if ((cand[A] & cand[p]) === (cand[B] & cand[p])) continue; const z = cand[A] & cand[B] & ~cand[p]; if (POP[z] !== 1) continue;
          let ch = false; for (const j of PEERS[A]) if (j !== B && j !== p && PEERS[B].includes(j)) ch = elim(j, z) || ch; if (ch) return true; } }
      return false; },
  };
  const ladder = [[1, () => T.nakedSingle()], [1, () => T.hiddenSingle()], [2, () => T.locked()], [2, () => T.nakedSubset(2)], [2, () => T.hiddenSubset(2)],
    [3, () => T.nakedSubset(3)], [3, () => T.hiddenSubset(3)], [3, () => T.xwing()], [3, () => T.xywing()], [3, () => T.nakedSubset(4)]];
  for (;;) {
    if (val.every(v => v)) return { level, steps };
    let moved = false;
    for (const [lv, fn] of ladder) if (fn()) { level = Math.max(level, lv); moved = true; steps++; break; }
    if (!moved) return { level: 4, steps };
  }
}
function* combos(arr, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
}

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Generate one puzzle aiming at `target` level. Returns {grid, level, clues} or null.
function generate(target, rand) {
  const full = solve(new Array(81).fill(0), 1, rand).solution, g = full.slice();
  const order = [...Array(41).keys()]; for (let k = order.length - 1; k > 0; k--) { const j = (rand() * (k + 1)) | 0; [order[k], order[j]] = [order[j], order[k]]; }
  const minClues = target === 1 ? 34 + ((rand() * 6) | 0) : target === 2 ? 26 + ((rand() * 4) | 0) : 0;
  let clues = 81;
  for (const i of order) {
    const pair = i === 40 ? [40] : [i, 80 - i];
    if (clues - pair.length < minClues) continue;
    const keep = pair.map(j => g[j]); pair.forEach(j => g[j] = 0);
    let ok = solve(g, 2).count === 1;
    if (ok && target < 4) ok = rate(g).level <= target;
    if (ok) clues -= pair.length; else pair.forEach((j, k) => g[j] = keep[k]);
  }
  const lv = rate(g).level;
  return lv === target ? { grid: g, level: lv, clues } : null;
}

module.exports = { solve, rate, generate, mulberry, UNITS, PEERS };
