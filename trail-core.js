// Word Trail logic: dictionary decoding, grid solving and grid generation.
// Used by trail.html and by tools/generate-trail.js (Node).
(function (root) {
'use strict';

function decode(enc) {
  const words = [], targets = new Set(), re = /(\d)([a-zA-Z]+)/g; let prev = '', m;
  while ((m = re.exec(enc))) {
    const w = prev.slice(0, +m[1]) + m[2].toLowerCase();
    words.push(w); if (m[2] !== m[2].toLowerCase()) targets.add(w); prev = w;
  }
  return { words, targets, set: new Set(words) };
}

function hasPrefix(words, p) {
  let lo = 0, hi = words.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (words[mid] < p) lo = mid + 1; else hi = mid; }
  return lo < words.length && words[lo].startsWith(p);
}

function neighbors(size) {
  const n = [];
  for (let i = 0; i < size * size; i++) {
    const r = (i / size) | 0, c = i % size, list = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue; const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) list.push(rr * size + cc);
    }
    n.push(list);
  }
  return n;
}

// Every word (4-8 letters) that can be traced in the grid. Returns Map word -> Set of tiles on any of its paths;
// .starts maps word -> Set of tiles where one of its paths begins.
function solve(grid, size, dict) {
  const nb = neighbors(size), found = new Map(), starts = new Map(), used = new Uint8Array(size * size), path = [];
  const dfs = (i, w) => {
    used[i] = 1; path.push(i);
    const word = w + grid[i];
    if (word.length >= 4 && dict.set.has(word)) {
      let s = found.get(word); if (!s) found.set(word, s = new Set());
      for (const t of path) s.add(t);
      (starts.get(word) || starts.set(word, new Set()).get(word)).add(path[0]);
    }
    if (word.length < 8 && hasPrefix(dict.words, word)) for (const j of nb[i]) if (!used[j]) dfs(j, word);
    used[i] = 0; path.pop();
  };
  for (let i = 0; i < size * size; i++) dfs(i, '');
  found.starts = starts; // word -> Set of tiles a path can begin on
  return found;
}

// Letter weights (roughly English text frequency, with rare letters toned down). No Q.
const WEIGHTS = { a: 8.5, b: 2, c: 3.5, d: 3.8, e: 11.5, f: 1.8, g: 2.4, h: 3, i: 7.5, j: 0.25, k: 1, l: 5.2, m: 2.8, n: 6.6, o: 7.2, p: 2.8, r: 7.2, s: 6.6, t: 7.4, u: 3.4, v: 1, w: 1.3, x: 0.3, y: 1.8, z: 0.3 };
const LETTERS = Object.keys(WEIGHTS), TOTAL = LETTERS.reduce((s, l) => s + WEIGHTS[l], 0);
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const RULES = {
  4: { minTargets: 14, maxTargets: 34, vowels: [5, 7], maxSame: 2, longest: 6 },
  5: { minTargets: 30, maxTargets: 55, vowels: [8, 11], maxSame: 3, longest: 7 },
};

function randomLetters(size, rand) {
  const R = RULES[size], n = size * size;
  for (;;) {
    const g = [];
    for (let i = 0; i < n; i++) { let x = rand() * TOTAL, k = 0; while ((x -= WEIGHTS[LETTERS[k]]) > 0) k++; g.push(LETTERS[k]); }
    const v = g.filter(c => VOWELS.has(c)).length; if (v < R.vowels[0] || v > R.vowels[1]) continue;
    const counts = {}; let ok = true, rare = 0;
    for (const c of g) { counts[c] = (counts[c] || 0) + 1; if (counts[c] > R.maxSame) ok = false; if ('jkvwxz'.includes(c)) rare++; }
    if (!ok || rare > (size === 4 ? 1 : 2)) continue;
    return g;
  }
}

// Make a playable grid: every tile lies on some target word, a sensible number of targets, and at least one long word.
function generate(size, dict, rand) {
  const R = RULES[size];
  for (let attempt = 0; attempt < 5000; attempt++) {
    const g = randomLetters(size, rand), all = solve(g, size, dict);
    const targets = [...all.keys()].filter(w => dict.targets.has(w));
    if (targets.length < R.minTargets || targets.length > R.maxTargets) continue;
    if (!targets.some(w => w.length >= R.longest)) continue;
    const covered = new Set(); for (const w of targets) for (const t of all.get(w)) covered.add(t);
    if (covered.size < size * size) continue;
    return { grid: g.join(''), size, attempts: attempt + 1 };
  }
  return null;
}

// Full puzzle info for a grid string.
function analyze(gridStr, dict) {
  const size = Math.round(Math.sqrt(gridStr.length)), g = gridStr.split(''), all = solve(g, size, dict);
  const targets = [], bonus = [];
  for (const w of [...all.keys()].sort((a, b) => a.length - b.length || (a < b ? -1 : 1))) (dict.targets.has(w) ? targets : bonus).push(w);
  const tiles = {}, start = {};
  for (const [w, s] of all){ tiles[w] = [...s]; start[w] = Math.min(...all.starts.get(w)); }
  // tiles[w]: every tile the word can use; start[w]: the one tile it is counted on (lowest index that can begin it)
  return { size, grid: g, targets, bonus, tiles, start };
}

const api = { decode, solve, generate, analyze, neighbors, mulberry, RULES };
root.Trail = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
