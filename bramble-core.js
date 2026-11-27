// Bramble engine: a small crossword-tile board game (9x9). Pure logic, no DOM. Browser: window.Bramble; Node: module.exports.
//   dictionary  decode(encoded) -> dict (front-coded string from bramble-words.js -> trie); setDict(dict); the other functions use the current dict
//               (loaded automatically from window.BRAMBLE_WORDS when none was set)
//   game        newGame, validateMove, applyMove, exchange, pass, serialize/deserialize, winners
//   computer    allMoves(state, rack) -> every legal move with its score;  chooseMove(state, level, rng);  LEVELS
//               (expert simulates opponent replies, see EXPERT; the same state, level and rng always give the same move)
//   daily       dailySeed(dayIndex), newDailyGame(dayIndex), dailyTarget(dayIndex)
//   practice    newPracticeGame(seed), practiceTarget(seed) -> {target, plays, state}: the daily's rules on any seed; randomSeed()
// Rules in short: 9x9 board, the first word covers the centre (4,4); a move puts 1-7 tiles in one row or column, joined to the tiles
// already there; every word formed (the main word and each cross word, 2+ letters) must be in the word list. Premium squares count only for
// the tiles placed that turn: letter squares (DL x2, TL x3) multiply the tile, word squares (DW x2, TW x3) multiply the whole word.
// Blank tiles score 0. Using all 7 tiles earns +30.
// Data shapes (all plain JSON, so a game saves with serialize):
//   tile char     'A'..'Z' = a letter tile, '?' = a blank (in a rack/bag)
//   placement     {r, c, ch}  ch 'A'..'Z' plays that letter tile; ch 'a'..'z' plays a blank tile as that letter
//   board         array of 81 strings, index r*9+c; '' empty, 'A'..'Z' letter tile, 'a'..'z' blank tile showing that letter
//   state         {v, seed, rng, players, board, racks:[[tile..]..], bag:[tile..], scores:[n..], turn, passes, turns, over, final,
//                  daily, turnLimit, history:[{p, type, placements, tiles, score, words}]}
(function (root) {
'use strict';

const N = 9, SIZE = 81, CENTER = 40, RACK = 7, BINGO = 30, ALL = (1 << 26) - 1, MAX_SCORELESS = 6;

// ---------- tiles ----------
// 60 tiles: 58 letters + 2 blanks. Counts follow the letter frequencies of the word list (share of all letters, plain and weighted by
// Zipf frequency, averaged): e 11.9, s 8.8, a 7.8, i 7.7, r 7.4, n 6.2, o 6.1, t 6.3, l 5.4, d 4.2, u 3.4, c 3.9, g 3.1, p 2.9, m 2.8,
// h 2.4, b 2.1, y 1.7, f 1.5, k 1.2, w 1.1, v 1.0, z 0.3, x 0.3, j 0.2, q 0.2 (percent), scaled to 58 letters and rounded by hand so
// that vowels are about a third. Values: 1 for the common letters, up to 10 for the rarest.
const TILES = { A: [4, 1], B: [1, 3], C: [2, 3], D: [2, 2], E: [6, 1], F: [1, 4], G: [2, 2], H: [2, 3], I: [4, 1], J: [1, 8], K: [1, 5],
  L: [3, 1], M: [2, 3], N: [3, 1], O: [4, 1], P: [2, 3], Q: [1, 10], R: [3, 1], S: [4, 1], T: [3, 1], U: [2, 1], V: [1, 4], W: [1, 4],
  X: [1, 8], Y: [1, 4], Z: [1, 10] };            // letter: [count, value]; plus 2 blanks worth 0
const BLANKS = 2;
const VALUES = new Int8Array(26);
for (const L of Object.keys(TILES)) VALUES[L.charCodeAt(0) - 65] = TILES[L][1];
const tileValue = ch => ch === '?' ? 0 : (ch >= 'a' ? 0 : VALUES[ch.charCodeAt(0) - 65]);   // a placed lowercase letter is a blank: 0

// ---------- premium squares ----------
// Symmetric under rotation and reflection. '.' plain, 'd' double letter, 't' triple letter, 'D' double word, 'T' triple word.
// 4 TW (one square in from each corner), 9 DW (centre, 4 on the diagonals, 4 corners), 8 TL, 12 DL.
const LAYOUT = (() => {
  const rows = [];
  for (let r = 0; r < N; r++) {
    let s = '';
    for (let c = 0; c < N; c++) {
      const a = Math.max(Math.abs(r - 4), Math.abs(c - 4)), b = Math.min(Math.abs(r - 4), Math.abs(c - 4)), k = a + ',' + b;
      s += k === '3,3' ? 'T' : (k === '0,0' || k === '2,2' || k === '4,4') ? 'D' : (k === '1,1' || k === '3,0') ? 't' : (k === '2,0' || k === '4,2') ? 'd' : '.';
    }
    rows.push(s);
  }
  return rows;
})();
const LM = new Int8Array(SIZE), WM = new Int8Array(SIZE);
for (let i = 0; i < SIZE; i++) { const p = LAYOUT[(i / N) | 0][i % N]; LM[i] = p === 'd' ? 2 : p === 't' ? 3 : 1; WM[i] = p === 'D' ? 2 : p === 'T' ? 3 : 1; }
const PREMIUM_NAMES = { '.': '', d: 'DL', t: 'TL', D: 'DW', T: 'TW' };
const premium = (r, c) => PREMIUM_NAMES[LAYOUT[r][c]];

// ---------- dictionary (trie in typed arrays) ----------
function decode(enc) {
  const words = [], rareFlags = [], re = /(\d)([a-zA-Z]+)/g; let prev = '', m, nodes = 1;
  while ((m = re.exec(enc))) { nodes += m[2].length; const w = prev.slice(0, +m[1]) + m[2].toLowerCase(); words.push(w); rareFlags.push(m[2] !== m[2].toLowerCase()); prev = w; }
  const first = new Int32Array(nodes).fill(-1), next = new Int32Array(nodes).fill(-1), last = new Int32Array(nodes).fill(-1);
  const letter = new Uint8Array(nodes), term = new Uint8Array(nodes), rare = new Uint8Array(nodes);
  const path = new Int32Array(12); let count = 1, p = '';
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi]; let k = 0; while (k < p.length && k < w.length && p[k] === w[k]) k++;
    for (let j = k; j < w.length; j++) {
      const n = count++, par = path[j]; letter[n] = w.charCodeAt(j) - 97;
      if (first[par] < 0) first[par] = n; else next[last[par]] = n;
      last[par] = n; path[j + 1] = n;
    }
    term[path[w.length]] = 1; if (rareFlags[wi]) rare[path[w.length]] = 1; p = w;
  }
  const d = { words, nodes: count, first, next, letter, term, rare };
  d.child = (node, code) => { for (let c = first[node]; c >= 0; c = next[c]) { if (letter[c] === code) return c; if (letter[c] > code) return -1; } return -1; };
  d.walk = (node, s) => { for (let i = 0; i < s.length && node >= 0; i++) node = d.child(node, (s.charCodeAt(i) & 31) - 1); return node; };
  d.node = w => { let n = 0; for (let i = 0; i < w.length && n >= 0; i++) n = d.child(n, w.charCodeAt(i) - 97); return n; };
  d.has = w => { const n = d.node(w.toLowerCase()); return n > 0 && term[n] === 1; };
  d.isRare = w => { const n = d.node(w.toLowerCase()); return n > 0 && rare[n] === 1; };
  return d;
}
let DICT = null;
function setDict(d) { DICT = typeof d === 'string' ? decode(d) : d; return DICT; }
function dict() {
  if (!DICT) { const g = root.BRAMBLE_WORDS || (root.window && root.window.BRAMBLE_WORDS); if (!g) throw new Error('Bramble: no dictionary loaded'); DICT = decode(g); }
  return DICT;
}

// ---------- random ----------
function nextRand(state) {     // mulberry32; the generator state lives in state.rng so games can be saved and resumed exactly
  state.rng = (state.rng + 0x6D2B79F5) >>> 0; let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function mulberry(seed) { const s = { rng: seed >>> 0 }; return () => nextRand(s); }
function shuffle(arr, state) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(nextRand(state) * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } }
function fullBag() { const bag = []; for (const L of Object.keys(TILES)) for (let i = 0; i < TILES[L][0]; i++) bag.push(L); for (let i = 0; i < BLANKS; i++) bag.push('?'); return bag; }

// ---------- game state ----------
function newGame(opts) {
  opts = opts || {};
  const players = Math.max(1, Math.min(4, opts.players | 0 || 2));
  const seed = opts.seed === undefined ? (Math.random() * 4294967296) >>> 0 : opts.seed >>> 0;
  const s = { v: 1, seed, rng: seed, players, board: new Array(SIZE).fill(''), racks: [], bag: fullBag(), scores: new Array(players).fill(0),
    turn: 0, passes: 0, turns: 0, over: false, final: null, daily: !!opts.daily, turnLimit: opts.turnLimit | 0, history: [] };
  shuffle(s.bag, s);
  for (let p = 0; p < players; p++) { s.racks.push([]); draw(s, p); }
  return s;
}
function draw(s, p) { while (s.racks[p].length < RACK && s.bag.length) s.racks[p].push(s.bag.pop()); }
function clone(s) {
  return { v: s.v, seed: s.seed, rng: s.rng, players: s.players, board: s.board.slice(), racks: s.racks.map(r => r.slice()), bag: s.bag.slice(), scores: s.scores.slice(),
    turn: s.turn, passes: s.passes, turns: s.turns, over: s.over, final: s.final ? JSON.parse(JSON.stringify(s.final)) : null, daily: s.daily, turnLimit: s.turnLimit, history: s.history.slice() };
}
const serialize = s => JSON.stringify(s);
function deserialize(str) {
  const s = typeof str === 'string' ? JSON.parse(str) : str;
  if (!s || s.v !== 1 || !Array.isArray(s.board) || s.board.length !== SIZE || !Array.isArray(s.racks) || !Array.isArray(s.bag) || !Array.isArray(s.scores)) throw new Error('Bramble: bad saved game');
  return clone(s);
}
const rackValue = rack => rack.reduce((a, t) => a + tileValue(t), 0);
const isEmptyBoard = board => { for (let i = 0; i < SIZE; i++) if (board[i]) return false; return true; };
function tilesUsed(placements) { return placements.map(p => p.ch >= 'a' ? '?' : p.ch); }
function removeTiles(rack, tiles) {   // multiset difference, or null when the rack lacks a tile
  const r = rack.slice();
  for (const t of tiles) { const i = r.indexOf(t); if (i < 0) return null; r.splice(i, 1); }
  return r;
}
// Tiles not visible to `player`: the bag plus the other racks (what the player could still draw or the opponents hold).
function unseenTiles(s, player) {
  const seen = s.board.filter(Boolean).map(ch => ch >= 'a' ? '?' : ch).concat(s.racks[player] || []);
  return (removeTiles(fullBag(), seen) || []).sort();
}

// ---------- validation and scoring ----------
// validateMove(state, placements, opts) -> {ok, reason, score, bonus, words:[{word, score, rare, cells:[[r,c]..], main}], badWords}
//   opts.rack: check against this rack instead of the current player's; opts.skipRack: do not check tiles at all
function validateMove(s, pl, opts) {
  opts = opts || {}; const d = dict();
  const fail = (reason, extra) => Object.assign({ ok: false, reason, score: 0, bonus: 0, words: [], badWords: [] }, extra);
  if (!Array.isArray(pl) || !pl.length) return fail('Place at least one tile.');
  if (pl.length > RACK) return fail('You can place at most 7 tiles.');
  const cells = new Map();
  for (const p of pl) {
    if (!p || !Number.isInteger(p.r) || !Number.isInteger(p.c) || p.r < 0 || p.r >= N || p.c < 0 || p.c >= N || typeof p.ch !== 'string' || !/^[A-Za-z]$/.test(p.ch)) return fail('That placement is not on the board.');
    const i = p.r * N + p.c;
    if (s.board[i]) return fail('That square already has a tile.');
    if (cells.has(i)) return fail('Two tiles on one square.');
    cells.set(i, p.ch);
  }
  if (!opts.skipRack) {
    const rack = opts.rack || s.racks[s.turn];
    if (!rack || removeTiles(rack, tilesUsed(pl)) === null) return fail('Those tiles are not on your rack.');
  }
  const rows = new Set(pl.map(p => p.r)), cols = new Set(pl.map(p => p.c));
  if (rows.size > 1 && cols.size > 1) return fail('Tiles must go in one row or one column.');
  const at = (r, c) => (r < 0 || r >= N || c < 0 || c >= N) ? '' : (cells.get(r * N + c) || s.board[r * N + c]);
  const run = (r, c, dr, dc) => {   // the full run of tiles through (r,c) along (dr,dc), as list of [r,c]
    while (at(r - dr, c - dc)) { r -= dr; c -= dc; }
    const out = []; while (at(r, c)) { out.push([r, c]); r += dr; c += dc; }
    return out;
  };
  const found = [];   // {run, main}
  const f = pl[0];
  if (pl.length > 1) {
    const horiz = rows.size === 1, main = run(f.r, f.c, horiz ? 0 : 1, horiz ? 1 : 0);
    if (!pl.every(p => main.some(q => q[0] === p.r && q[1] === p.c))) return fail('Tiles must be in one connected line, with no gaps.');
    found.push({ cells: main, main: true });
    for (const p of pl) { const x = run(p.r, p.c, horiz ? 1 : 0, horiz ? 0 : 1); if (x.length > 1) found.push({ cells: x, main: false }); }
  } else {
    const h = run(f.r, f.c, 0, 1), v = run(f.r, f.c, 1, 0);
    if (h.length > 1) found.push({ cells: h, main: true });
    if (v.length > 1) found.push({ cells: v, main: found.length === 0 });
  }
  if (isEmptyBoard(s.board)) {
    if (!cells.has(CENTER)) return fail('The first word must cover the centre square.');
    if (!found.length) return fail('The first word needs at least two letters.');
  } else {
    if (!found.length) return fail('Your tiles must touch the tiles already on the board.');
    if (!found.some(w => w.cells.some(q => !cells.has(q[0] * N + q[1])))) return fail('Your tiles must touch the tiles already on the board.');
  }
  const words = [], bad = []; let total = 0;
  for (const w of found) {
    let sum = 0, mult = 1, str = '';
    for (const [r, c] of w.cells) {
      const i = r * N + c, ch = at(r, c); str += ch.toUpperCase();
      if (cells.has(i)) { sum += tileValue(ch) * LM[i]; mult *= WM[i]; } else sum += tileValue(ch);
    }
    const score = sum * mult; total += score;
    const ok = d.has(str);
    if (!ok) bad.push(str);
    words.push({ word: str, score, rare: ok && d.isRare(str), cells: w.cells, main: w.main });
  }
  if (bad.length) return fail(bad.length === 1 ? '"' + bad[0] + '" is not in the word list.' : bad.map(w => '"' + w + '"').join(', ') + ' are not in the word list.', { words, badWords: bad });
  const bonus = pl.length === RACK ? BINGO : 0;
  return { ok: true, reason: '', score: total + bonus, bonus, words, badWords: [] };
}

// ---------- turns ----------
function finish(s, why, outPlayer) {
  s.over = true;
  const adj = new Array(s.players).fill(0);
  if (why === 'out') {
    for (let p = 0; p < s.players; p++) if (p !== outPlayer) { const v = rackValue(s.racks[p]); adj[p] -= v; adj[outPlayer] += v; }
  } else if (why === 'stuck' && !s.daily) {   // the daily has no end penalty: it just ends
    for (let p = 0; p < s.players; p++) adj[p] -= rackValue(s.racks[p]);
  }
  for (let p = 0; p < s.players; p++) s.scores[p] += adj[p];
  s.final = { reason: why, adjustments: adj, winners: winners(s) };
}
function winners(s) {
  const best = Math.max.apply(null, s.scores); const w = [];
  s.scores.forEach((v, i) => { if (v === best) w.push(i); });
  return w;
}
function afterTurn(s, scoreless) {
  s.turns++; s.passes = scoreless ? s.passes + 1 : 0; s.turn = (s.turn + 1) % s.players;
  const last = (s.turn + s.players - 1) % s.players;
  if (!scoreless && !s.bag.length && !s.racks[last].length) return finish(s, 'out', last);
  if (s.turnLimit && s.turns >= s.turnLimit) return finish(s, 'turns');
  if (s.passes >= MAX_SCORELESS) return finish(s, 'stuck');
}
// applyMove(state, placements) -> {ok, state, score, words, bonus, reason}; the input state is not changed
function applyMove(s, pl) {
  if (s.over) return { ok: false, reason: 'The game is over.' };
  const v = validateMove(s, pl);
  if (!v.ok) return v;
  const n = clone(s), p = n.turn;
  for (const q of pl) n.board[q.r * N + q.c] = q.ch;
  n.racks[p] = removeTiles(n.racks[p], tilesUsed(pl));
  n.scores[p] += v.score; draw(n, p);
  n.history.push({ p, type: 'play', placements: pl.map(q => ({ r: q.r, c: q.c, ch: q.ch })), score: v.score, words: v.words.map(w => w.word) });
  afterTurn(n, false);
  return { ok: true, state: n, score: v.score, bonus: v.bonus, words: v.words, reason: '' };
}
// exchange(state, tiles) -> {ok, state, reason}; tiles = rack tiles ('A'..'Z', '?') to swap; only while the bag holds 7 or more tiles
function exchange(s, tiles) {
  if (s.over) return { ok: false, reason: 'The game is over.' };
  if (s.daily) return { ok: false, reason: 'No exchanging in the daily puzzle.' };
  if (s.bag.length < RACK) return { ok: false, reason: 'The bag has fewer than 7 tiles, so you cannot exchange.' };
  if (!Array.isArray(tiles) || !tiles.length) return { ok: false, reason: 'Pick at least one tile to exchange.' };
  const n = clone(s), p = n.turn, rest = removeTiles(n.racks[p], tiles);
  if (!rest) return { ok: false, reason: 'Those tiles are not on your rack.' };
  n.racks[p] = rest; draw(n, p);
  for (const t of tiles) n.bag.push(t);
  shuffle(n.bag, n);
  n.history.push({ p, type: 'exchange', tiles: tiles.length, score: 0 });
  afterTurn(n, true);
  return { ok: true, state: n, reason: '' };
}
function pass(s) {
  if (s.over) return { ok: false, reason: 'The game is over.' };
  const n = clone(s); n.history.push({ p: n.turn, type: 'pass', score: 0 });
  afterTurn(n, true);
  return { ok: true, state: n, reason: '' };
}
// Apply a move object as returned by chooseMove: {type:'play', placements} | {type:'exchange', tiles} | {type:'pass'}
function applyAny(s, m) { return m.type === 'play' ? applyMove(s, m.placements) : m.type === 'exchange' ? exchange(s, m.tiles) : pass(s); }

// ---------- move generation ----------
// allMoves(state, rack) -> [{placements:[{r,c,ch}], score, main, words:[WORD..], rare, tiles, dir:'h'|'v', bingo}]   (rack defaults to the current player's)
// Anchor squares + cross-checks (Appel and Jacobson): for each row and column, every empty square next to a tile is an anchor; words are
// built from the left part (new tiles before the anchor) through the anchor and on to the right, walking the trie; each square's allowed
// letters (its cross-check) are precomputed. Blanks try all 26 letters. Every move appears once.
let WORK = 0;     // search nodes visited by allMoves so far: a deterministic stand-in for time, used to budget Expert's thinking
function allMoves(s, rackIn) {
  const d = dict(), board = s.board, rack = rackIn || s.racks[s.turn];
  const first = d.first, next = d.next, letter = d.letter, term = d.term, rare = d.rare;
  const cnt = new Int8Array(26); let blanks = 0;
  for (const t of rack) { if (t === '?') blanks++; else cnt[t.charCodeAt(0) - 65]++; }
  const empty = isEmptyBoard(board), out = [];
  for (let dir = 0; dir < 2; dir++) {
    const stepIn = dir === 0 ? 1 : N, stepPerp = dir === 0 ? N : 1;          // along the line / across it
    const at = (line, i) => dir === 0 ? line * N + i : i * N + line;
    const mask = new Int32Array(SIZE), cross = new Int16Array(SIZE), hasCross = new Uint8Array(SIZE), anchor = new Uint8Array(SIZE);
    const pre = new Array(SIZE), suf = new Array(SIZE);
    for (let line = 0; line < N; line++) for (let i = 0; i < N; i++) {
      const x = at(line, i); if (board[x]) continue;
      const perp = dir === 0 ? (x / N | 0) : (x % N);                 // position across the line: row for h pass, col for v pass
      let a = '', b = '', sc = 0, y = x;
      for (let k = perp; k > 0 && board[y - stepPerp]; k--) { y -= stepPerp; a = board[y] + a; sc += tileValue(board[y]); }
      y = x;
      for (let k = perp; k < N - 1 && board[y + stepPerp]; k++) { y += stepPerp; b += board[y]; sc += tileValue(board[y]); }
      const nb = (i > 0 && board[x - stepIn]) || (i < N - 1 && board[x + stepIn]);
      anchor[x] = (a || b || nb) ? 1 : 0;
      if (a || b) {
        hasCross[x] = 1; cross[x] = sc; pre[x] = a; suf[x] = b;
        let m = 0; const n0 = d.walk(0, a);
        if (n0 >= 0) for (let c = first[n0]; c >= 0; c = next[c]) { const e = d.walk(c, b); if (e >= 0 && term[e]) m |= 1 << letter[c]; }
        mask[x] = m;
      } else mask[x] = ALL;
    }
    if (empty) { anchor.fill(0); anchor[CENTER] = 1; }
    const rPos = [], rCh = [], lCh = [];
    for (let line = 0; line < N; line++) {
      for (let i = 0; i < N; i++) {
        const ax = at(line, i); if (!anchor[ax]) continue;
        let startExisting = -1, node0 = 0;
        if (i > 0 && board[at(line, i - 1)]) {
          let s0 = i - 1; while (s0 > 0 && board[at(line, s0 - 1)]) s0--;
          for (let j = s0; j < i && node0 >= 0; j++) node0 = d.child(node0, (board[at(line, j)].charCodeAt(0) & 31) - 1);
          if (node0 < 0) continue; startExisting = s0;
        }
        const record = (node, endPos, k) => {
          const start = startExisting >= 0 ? startExisting : i - k, len = endPos - start + 1;
          if (len < 2) return;
          const n = k + rPos.length;
          if (dir === 1 && n === 1 && hasCross[ax]) return;           // single tile with a horizontal word: already found by the row pass
          let sum = 0, mult = 1, ci = 0, ri = 0, ok = true, crossTotal = 0, main = '', isRare = rare[node] === 1; const placements = [], words = [];
          for (let p = start; p <= endPos; p++) {
            const x = at(line, p); let ch = board[x];
            if (ch) { sum += tileValue(ch); main += ch.toUpperCase(); continue; }
            ch = p < i ? lCh[p - (i - k)] : rCh[ri++];
            const v = tileValue(ch), lm = LM[x];
            sum += v * lm; mult *= WM[x]; main += ch.toUpperCase();
            placements.push(dir === 0 ? { r: line, c: p, ch } : { r: p, c: line, ch });
            if (hasCross[x]) {
              crossTotal += (cross[x] + v * lm) * WM[x];
              const w = (pre[x] + ch + suf[x]).toUpperCase(); words.push(w);
              if (!isRare && rare[d.node(w.toLowerCase())]) isRare = true;
            }
          }
          words.unshift(main);
          out.push({ placements, score: sum * mult + crossTotal + (n === RACK ? BINGO : 0), main, words, rare: isRare, tiles: n, dir: dir === 0 ? 'h' : 'v', bingo: n === RACK });
        };
        const extend = (node, pos, k) => {
          WORK++;
          const x = pos < N ? at(line, pos) : -1;
          if (pos >= N || !board[x]) {
            if (pos > i && term[node]) record(node, pos - 1, k);
            if (pos < N) {
              const m = mask[x];
              for (let c = first[node]; c >= 0; c = next[c]) {
                const code = letter[c]; if (!((m >> code) & 1)) continue;
                if (cnt[code] > 0) { cnt[code]--; rPos.push(pos); rCh.push(String.fromCharCode(65 + code)); extend(c, pos + 1, k); rPos.pop(); rCh.pop(); cnt[code]++; }
                if (blanks > 0) { blanks--; rPos.push(pos); rCh.push(String.fromCharCode(97 + code)); extend(c, pos + 1, k); rPos.pop(); rCh.pop(); blanks++; }
              }
            }
          } else {
            const c = d.child(node, (board[x].charCodeAt(0) & 31) - 1);
            if (c >= 0) extend(c, pos + 1, k);
          }
        };
        if (startExisting >= 0) { extend(node0, i, 0); continue; }
        let limit = 0; for (let j = i - 1; j >= 0 && !anchor[at(line, j)] && !board[at(line, j)]; j--) limit++;
        const left = (node, k) => {
          extend(node, i, k);
          if (k >= limit) return;
          for (let c = first[node]; c >= 0; c = next[c]) {
            const code = letter[c];
            if (cnt[code] > 0) { cnt[code]--; lCh.push(String.fromCharCode(65 + code)); left(c, k + 1); lCh.pop(); cnt[code]++; }
            if (blanks > 0) { blanks--; lCh.push(String.fromCharCode(97 + code)); left(c, k + 1); lCh.pop(); blanks++; }
          }
        };
        left(0, 0);
      }
    }
  }
  return out;
}

// ---------- computer players ----------
const LEVELS = ['easy', 'casual', 'strong', 'expert'];
const LEVEL_NAMES = { easy: 'Easy', casual: 'Casual', strong: 'Strong', expert: 'Expert' };
const VOWELS = 'AEIOU';
// Value of the tiles kept after a move (points-ish), used by expert: blanks and S are worth keeping, duplicates and a lopsided
// vowel/consonant mix are not, Q is a burden.
const LEAVE = { blank: 25, s: 5, dupV: 2, dupC: 1.5, bal: 1.2, q: 7 };   // weights (tunable)
function leaveValue(tiles) {
  let v = 0; const n = tiles.length, cnt = {}; let vow = 0;
  for (const t of tiles) {
    cnt[t] = (cnt[t] || 0) + 1;
    if (t === '?') v += LEAVE.blank; else if (t === 'S') v += LEAVE.s; else if (t === 'E') v += 1.5; else if ('RTNAL'.includes(t)) v += 0.5;
    else if (t === 'Q') v -= LEAVE.q; else if (t === 'V' || t === 'W' || t === 'J') v -= 2;
    if (VOWELS.includes(t)) vow++;
  }
  for (const t in cnt) if (cnt[t] > 1 && t !== '?') v -= (VOWELS.includes(t) ? LEAVE.dupV : LEAVE.dupC) * (cnt[t] - 1);
  if (cnt.Q && !cnt.U) v -= 4;
  if (n > 1) v -= LEAVE.bal * Math.abs(vow - 0.4 * n);
  return v;
}
function leaveAfter(rack, m) { return removeTiles(rack, tilesUsed(m.placements)) || []; }
function equity(s, rack, m) {
  const left = leaveAfter(rack, m);
  if (s.bag.length === 0) {   // end game: tiles left behind are lost points, going out wins the other racks
    if (!left.length) { let opp = 0; s.racks.forEach((r, p) => { if (p !== s.turn) opp += rackValue(r); }); return m.score + 2 * opp; }
    return m.score - rackValue(left);
  }
  return m.score + leaveValue(left);
}
const byScore = (a, b) => b.score - a.score || (a.main < b.main ? -1 : a.main > b.main ? 1 : 0) || keyOf(a) - keyOf(b) || (keyStr(a) < keyStr(b) ? -1 : 1);
const keyOf = m => m.placements[0].r * 9 + m.placements[0].c;
const keyStr = m => m.placements.map(p => p.ch).join('');
const asPlay = m => ({ type: 'play', placements: m.placements, score: m.score, main: m.main, words: m.words, rare: m.rare });

function bestExchange(s, rack) {   // the tiles to throw back so the kept tiles have the best leave value (deterministic)
  let best = null, bestV = -1e9; const n = rack.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const keep = [], toss = [];
    for (let i = 0; i < n; i++) ((mask >> i) & 1 ? toss : keep).push(rack[i]);
    const v = leaveValue(keep) - 0.01 * toss.length;
    if (v > bestV) { bestV = v; best = toss; }
  }
  return { tiles: best, value: bestV };
}
// ----- Expert: simulation -----
// Take the best candidate plays by score + leave, give each the same sample of plausible opponent racks (drawn from the unseen tiles), find the
// opponent's best reply to each, and keep the play with the best (my score + leave - the opponent's reply), successively dropping the weaker
// candidates as the samples pile up. With the bag empty and two players the opponent's rack is known, so a small search plays it out exactly.
// Thinking is budgeted in allMoves search nodes (EXPERT.budget), not in milliseconds, so the choice depends only on the position and the seed;
// EXPERT.maxMs is only a safety stop for a device far slower than expected.
const EXPERT = { candidates: 14, rounds: 400, halve: [6, 12, 24, 48, 96], budget: 3000000, maxMs: 4000, endBudget: 60000, endBranch: [40, 10, 6], endDepth: 3 };
const CASUAL = { top: 0.2 };                                  // share of the plays (best first) casual picks from
const EASY = { lo: 0.7, hi: 1, short: 1 };                  // easy picks from this band of the score ranking (0 = worst play, 1 = best) of the ordinary-word plays; short = weight of tile count against word length
const boardAfter = (board, placements) => { const b = board.slice(); for (const p of placements) b[p.r * N + p.c] = p.ch; return b; };
function bestReplyScore(board, rack) {
  let best = 0; for (const m of allMoves({ board, racks: [], turn: 0 }, rack)) if (m.score > best) best = m.score;
  return best;
}
function sampleRack(pool, n, rand) {   // n tiles from the pool, without replacement
  const a = pool.slice(), out = [];
  for (let i = 0; i < n && a.length; i++) { const j = Math.floor(rand() * a.length); out.push(a[j]); a[j] = a[a.length - 1]; a.pop(); }
  return out;
}
// Exact play-out for the end game: value = (my final points - their final points) from here, searched to `depth` plies with the best few moves per ply.
function endSearch(board, mine, theirs, depth, passed, budgetEnd, st) {
  const staticV = (a, b) => rackValue(b) - rackValue(a);
  if (WORK > budgetEnd) { st.cut = true; return staticV(mine, theirs); }
  const moves = allMoves({ board, racks: [], turn: 0 }, mine).sort(byScore);
  if (!moves.length) return passed || depth <= 1 ? staticV(mine, theirs) : -endSearch(board, theirs, mine, depth - 1, true, budgetEnd, st);
  const top = moves.slice(0, EXPERT.endBranch[Math.min(EXPERT.endDepth - depth + 1, EXPERT.endBranch.length - 1)]);
  let best = -1e9;
  for (const m of top) {
    const left = leaveAfter(mine, m);
    const v = m.score + (!left.length ? 2 * rackValue(theirs) : depth <= 1 ? staticV(left, theirs) : -endSearch(boardAfter(board, m.placements), theirs, left, depth - 1, false, budgetEnd, st));
    if (v > best) best = v;
  }
  return best;
}
function endMove(s, rack, moves) {
  const opp = s.racks[(s.turn + 1) % s.players], cands = moves.slice(0, EXPERT.endBranch[0]), t0 = Date.now();
  let pick = null;
  for (let depth = 2; depth <= EXPERT.endDepth; depth++) {
    const st = { cut: false }, budgetEnd = WORK + EXPERT.endBudget; let best = null, bv = -1e9;
    for (const m of cands) {
      const left = leaveAfter(rack, m);
      const v = m.score + (!left.length ? 2 * rackValue(opp) : -endSearch(boardAfter(s.board, m.placements), opp, left, depth - 1, false, budgetEnd, st));
      if (v > bv + 1e-9) { bv = v; best = m; }
      if (Date.now() - t0 > EXPERT.maxMs) { st.cut = true; break; }
    }
    if (st.cut && pick) break;
    pick = best; if (st.cut) break;
  }
  return pick;
}
function expertMove(s, rack, moves, canSwap, rand) {
  if (s.bag.length === 0 && s.players === 2) return asPlay(endMove(s, rack, moves));
  const evs = moves.map(m => ({ m, e: equity(s, rack, m) }));
  evs.sort((a, b) => b.e - a.e || byScore(a.m, b.m));
  const cands = evs.slice(0, EXPERT.candidates).map(x => ({ m: x.m, board: null, base: x.e, sum: 0, n: 0 }));
  for (const x of moves.slice(0, 3)) if (!cands.some(c => c.m === x)) cands.push({ m: x, board: null, base: equity(s, rack, x), sum: 0, n: 0 });
  const ex = canSwap ? bestExchange(s, rack) : null;
  if (ex) cands.push({ m: null, board: s.board, base: ex.value - 3, sum: 0, n: 0 });   // an exchange must clearly beat the plays
  for (const c of cands) if (c.m) c.board = boardAfter(s.board, c.m.placements);
  if (cands.length === 1) return cands[0].m ? asPlay(cands[0].m) : { type: 'exchange', tiles: ex.tiles };
  const pool = unseenTiles(s, s.turn), oppLen = s.racks[(s.turn + 1) % s.players].length;
  let alive = cands.slice(); const t0 = Date.now(), stop = WORK + EXPERT.budget;
  for (let r = 0; r < EXPERT.rounds; r++) {
    const oppRack = sampleRack(pool, oppLen, rand);
    for (const c of alive) { c.sum += bestReplyScore(c.board, oppRack); c.n++; if (WORK > stop + EXPERT.budget) break; }   // a very heavy position (blanks) stops mid-round
    if (WORK > stop || Date.now() - t0 > EXPERT.maxMs) break;
    if (EXPERT.halve.includes(r + 1) && alive.length > 2) {
      alive.sort((a, b) => (b.base - b.sum / b.n) - (a.base - a.sum / a.n));
      alive = alive.slice(0, Math.max(2, Math.ceil(alive.length / 2)));
    }
  }
  let best = alive[0], bv = -1e9;
  for (const c of alive) { const v = c.base - c.sum / c.n; if (v > bv + 1e-9) { bv = v; best = c; } }
  return best.m ? asPlay(best.m) : { type: 'exchange', tiles: ex.tiles };
}

// The earlier Expert (best score + leave, one ply). Kept as it was for the daily target, which must not change.
function greedyLeaveMove(s, rack, moves, canSwap) {
  let best = null, bv = -1e9;
  for (const m of moves) { const e = equity(s, rack, m); if (e > bv + 1e-9) { bv = e; best = m; } }
  if (canSwap) { const ex = bestExchange(s, rack); if (ex.value > bv + 2) return { type: 'exchange', tiles: ex.tiles }; }
  return asPlay(best);
}

// chooseMove(state, level, rng) -> move; `rng` is a () => [0,1) generator (default Math.random); the same state, level and rng give the same move.
function chooseMove(s, level, rng, opts) {
  level = LEVELS.includes(level) ? level : 'casual';
  const rand = rng || Math.random, rack = s.racks[s.turn], moves = allMoves(s, rack);
  const canSwap = !s.daily && s.bag.length >= RACK;
  if (!moves.length) return canSwap ? { type: 'exchange', tiles: bestExchange(s, rack).tiles } : { type: 'pass' };
  moves.sort(byScore);
  if (level === 'strong') return asPlay(moves[0]);
  if (level === 'expert') return opts && opts.greedy ? greedyLeaveMove(s, rack, moves, canSwap) : expertMove(s, rack, moves, canSwap, rand);
  const n = moves.length;
  if (level === 'casual') {      // random among the top 20% by score, leaning towards the better ones
    const top = Math.max(1, Math.ceil(n * CASUAL.top));
    return asPlay(moves[Math.min(top - 1, Math.floor(top * rand() * rand()))]);
  }
  // easy: everyday words only when possible, a play from the better third of those (by score, often not the best), shorter plays preferred
  let pool = moves.filter(m => !m.rare); if (!pool.length) pool = moves;
  const asc = pool.slice().reverse(), lo = Math.floor(asc.length * EASY.lo), hi = Math.max(lo + 1, Math.ceil(asc.length * EASY.hi)), band = asc.slice(lo, hi);
  let total = 0; const w = band.map(m => { const x = 1 / (EASY.short * m.tiles * m.tiles + m.main.length); total += x; return x; });
  let r = rand() * total, k = 0; while (k < band.length - 1 && r >= w[k]) { r -= w[k]; k++; }
  return asPlay(band[k]);
}

// ---------- daily solo ----------
// A daily game is one player, 10 turns, no exchanging, no end-of-game rack penalty. The target is Expert's total over the same 10 turns.
const DAILY_TURNS = 10;
function dailySeed(dayIndex) {
  let h = 0x811C9DC5; const str = 'bramble-daily-' + (dayIndex | 0);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
  return h >>> 0;
}
// Both kinds of solo game come from a seed: the daily's seed is dailySeed(day), a practice game's is any number (a replay of a past daily
// uses dailySeed(day), so it gets the same tiles and the same target).
const newSeedGame = seed => newGame({ players: 1, seed: seed >>> 0, daily: true, turnLimit: DAILY_TURNS });
const newDailyGame = dayIndex => newSeedGame(dailySeed(dayIndex));
const newPracticeGame = seed => newSeedGame(seed);
const randomSeed = () => (Math.random() * 4294967296) >>> 0;
function seedTarget(seed) {
  let s = newSeedGame(seed); const plays = [];
  while (!s.over) { const m = chooseMove(s, 'expert', null, { greedy: true }); const r = applyAny(s, m); plays.push({ type: m.type, score: m.score || 0, main: m.main || '' }); s = r.state; }
  return { target: s.scores[0], plays, state: s };
}
const dailyTarget = dayIndex => seedTarget(dailySeed(dayIndex));
const practiceTarget = seed => seedTarget(seed);

const api = { N, CENTER, RACK, BINGO, TILES, BLANKS, VALUES, LAYOUT, premium, tileValue, decode, setDict, dict, newGame, validateMove, applyMove, exchange, pass, applyAny,
  serialize, deserialize, winners, rackValue, unseenTiles, allMoves, chooseMove, leaveValue, LEAVE, EXPERT, EASY, CASUAL, LEVELS, LEVEL_NAMES, dailySeed, newDailyGame, dailyTarget, newSeedGame, newPracticeGame, seedTarget, practiceTarget, randomSeed, DAILY_TURNS, mulberry, fullBag, isEmptyBoard };
root.Bramble = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
