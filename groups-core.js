// Clover puzzle generator: builds puzzles at three levels from the category bank (groups-bank.js) and only keeps
// ones with exactly one answer. Loaded by groups.html and index.html; also runs in Node for tools/check-groups.js.
(function (root) {
'use strict';
const BANK = root.GROUPS_BANK || (typeof require !== 'undefined' && (require('./groups-bank.js'), root.GROUPS_BANK));
const sortL = w => w.split('').sort().join('');
const CATS = BANK.map(([name, tier, family, words, x = {}], i) => ({
  i, name, tier, family, words: words.split(' '), set: new Set(words.split(' ')),
  hide: x.hide ? x.hide.split(' ') : null, anag: x.anag ? x.anag.split(' ') : null, pal: !!x.pal,
  anchor: x.suf || x.pre || null, nameWords: (name.toUpperCase().match(/[A-Z]+/g) || []).flatMap(w => /S$/.test(w) ? [w, w.slice(0, -1)] : [w]),
}));

// Does word w belong to category c? Lists, plus computed wordplay so an accidental hidden word or anagram counts too.
function fits(c, w) {
  if (c.set.has(w)) return true;
  if (c.hide && c.hide.some(t => w.length > t.length && w.includes(t))) return true;
  if (c.anag) { const s = sortL(w); if (c.anag.some(t => t !== w && t.length === w.length && sortL(t) === s)) return true; }
  if (c.pal && w.length >= 3 && w === w.split('').reverse().join('')) return true;
  return false;
}

// Number of ways to split the words into the categories, four each (stops counting at 2).
function countSolutions(words, cats) {
  const mem = words.map(w => cats.map((c, k) => fits(c, w) ? k : -1).filter(k => k >= 0));
  if (mem.some(m => !m.length)) return 0;
  const order = words.map((_, i) => i).sort((a, b) => mem[a].length - mem[b].length);
  const room = [4, 4, 4, 4]; let n = 0;
  (function go(k) {
    if (n >= 2) return;
    if (k === order.length) { n++; return; }
    for (const g of mem[order[k]]) if (room[g]) { room[g]--; go(k + 1); room[g]++; }
  })(0);
  return n;
}

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Which tiers each slot may use, and how many decoys (words that fit two of the groups) to place.
const LEVELS = {
  easy:   { slots: [[1], [1], [1, 2], [1, 2]], decoys: [0, 0] },
  medium: { slots: [[1], [1, 2], [2, 3], [3, 4]], decoys: [1, 2] },
  hard:   { slots: [[1, 2], [2, 3], [3], [4]], decoys: [2, 4] },
};
const FAMILY_MAX = { phrase: 2 };

// Pairwise overlap (how many words could sit in either category), used to pick categories that tangle.
let OVER = null;
function overlap(a, b) {
  if (!OVER) OVER = new Map();
  const k = a.i < b.i ? a.i * 1000 + b.i : b.i * 1000 + a.i;
  if (!OVER.has(k)) { let n = 0; for (const w of a.words) if (fits(b, w)) n++; for (const w of b.words) if (fits(a, w) && !a.set.has(w)) n++; OVER.set(k, n); }
  return OVER.get(k);
}

function pickWeighted(list, weight, rnd) {
  const ws = list.map(weight), total = ws.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
function shuffled(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build one puzzle. Returns { groups: [[name, w, w, w, w] x4] easiest first, level, decoys } or null.
function generate(seed, level = 'medium') {
  const L = LEVELS[level] || LEVELS.medium, rnd = mulberry(seed), tangle = level !== 'easy';
  for (let attempt = 0; attempt < 600; attempt++) {
    // 1. categories
    const chosen = [], fam = {};
    for (const tiers of L.slots) {
      const opts = CATS.filter(c => tiers.includes(c.tier) && !chosen.includes(c) && (fam[c.family] || 0) < (FAMILY_MAX[c.family] || 1));
      if (!opts.length) break;
      const c = pickWeighted(opts, c => tangle && chosen.length && c.tier < 4 ? 1 + 2 * chosen.filter(d => overlap(c, d) > 0).length : 1, rnd); // prefer categories that share a word with one already chosen
      chosen.push(c); fam[c.family] = (fam[c.family] || 0) + 1;
    }
    if (chosen.length < 4) continue;
    // 2. words: never the fixed part of a phrase or a word from a category name
    const banned = new Set(chosen.flatMap(c => [c.anchor, ...c.nameWords]).filter(Boolean));
    const memOf = w => chosen.filter(c => fits(c, w)).length;
    const want = L.decoys[0] + Math.floor(rnd() * (L.decoys[1] - L.decoys[0] + 1));
    const used = new Set(), groups = chosen.map(() => []);
    // decoys first: a word listed in one group that also fits another
    if (want) {
      const pool = shuffled(chosen.flatMap((c, k) => c.words.filter(w => !banned.has(w) && memOf(w) >= 2).map(w => [k, w])), rnd);
      for (const [k, w] of pool) { if (used.has(w) || groups[k].length >= 2 || groups.flat().length >= want) continue; groups[k].push(w); used.add(w); }
    }
    let ok = true;
    chosen.forEach((c, k) => {
      const pool = shuffled(c.words.filter(w => !banned.has(w) && !used.has(w) && memOf(w) === 1), rnd);
      while (groups[k].length < 4 && pool.length) { const w = pool.pop(); groups[k].push(w); used.add(w); }
      if (groups[k].length < 4) ok = false;
    });
    if (!ok) continue;
    const words = groups.flat();
    const decoys = words.filter(w => memOf(w) >= 2).length;
    if (decoys < L.decoys[0] || decoys > L.decoys[1]) continue;
    // reject a word that contains another word on the board (e.g. SNOW and SNOWMAN): too easy to misread
    if (words.some(a => words.some(b => a !== b && a.includes(b)))) continue;
    if (countSolutions(words, chosen) !== 1) continue;
    // colour order: plainest first; equal tiers in random order
    const order = chosen.map((c, k) => k).sort((a, b) => chosen[a].tier - chosen[b].tier || rnd() - 0.5);
    return { groups: order.map(k => [chosen[k].name, ...groups[k]]), level, decoys, seed };
  }
  return null;
}

// The daily puzzle for a day number and level: the same for everyone.
function daily(day, level) {
  for (let salt = 0; salt < 20; salt++) { const p = generate(hash(`groups:${day}:${level}:${salt}`), level); if (p) return p; }
  return null;
}

// Level of a hand-written puzzle (groups-data.js): wordplay makes it hard.
const classicLevel = p => p.some(g => /hidden|anagram|sound|tenses|letters/i.test(g[0])) ? 'hard' : 'medium';

const api = { generate, daily, fits, countSolutions, classicLevel, CATS, LEVELS, hash };
root.GroupsCore = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
