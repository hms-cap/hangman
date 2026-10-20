// Go: rules, scoring and the computer player. Used by go.html, go-worker.js, the Go problems and trainer pages, and Node tests.
// Rules: stones are captured when their last liberty is filled; suicide is illegal; positional superko (no move may recreate
// an earlier position). Scoring is area scoring (stones + surrounded empty points) with komi 7.5 (0.5 with handicap).
// Points are numbered on a padded board: p = (y + 1) * (N + 2) + (x + 1), with a ring of border cells around it.
(function (root) {
'use strict';
const EMPTY = 0, BLACK = 1, WHITE = 2, EDGE = 3;
const other = c => 3 - c;
const COLS = 'ABCDEFGHJKLMNOPQRST'; // Go coordinates skip I

// ---------- random numbers (seedable, so tests repeat) ----------
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ZOB = (() => { const r = rng(20261020), z = new Int32Array(3 * 441 * 2); for (let k = 0; k < z.length; k++) z[k] = (r() * 4294967296) | 0; return z; })();

class Board {
  constructor(N) {
    this.N = N; this.W = N + 2; const S = this.W * this.W; this.S = S;
    this.c = new Uint8Array(S);            // colour of each point
    this.chain = new Int16Array(S);        // chain id = index of its head stone
    this.next = new Int16Array(S);         // stones of a chain form a ring
    this.size = new Int16Array(S);         // per chain head: number of stones
    this.plib = new Int16Array(S);         // pseudo-liberties (counted with multiplicity)
    this.lsum = new Int32Array(S);         // sum and sum of squares of pseudo-liberty points: a chain is in atari exactly
    this.lsq = new Float64Array(S);        //   when plib * lsq == lsum * lsum (all pseudo-liberties are the same point)
    for (let p = 0; p < S; p++) { const x = p % this.W, y = (p / this.W) | 0; this.c[p] = x === 0 || y === 0 || x === this.W - 1 || y === this.W - 1 ? EDGE : EMPTY; }
    this.DIRS = [1, -1, this.W, -this.W];
    this.DIAG = [this.W + 1, this.W - 1, -this.W + 1, -this.W - 1];
    this.turn = BLACK; this.ko = 0; this.passes = 0; this.caps = [0, 0, 0]; this.moves = 0; this.lastMove = -1;
    this.hash = 0; this.seen = new Set([0]); this.komi = 7.5; this.handicap = 0;
    this.points = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) this.points.push((y + 1) * this.W + x + 1);
  }
  // deep: also copy the record of earlier positions (needed before calling play() on the copy; searches only read it)
  clone(deep = false) {
    const b = Object.create(Board.prototype);
    for (const k of Object.keys(this)) { const v = this[k]; b[k] = ArrayBuffer.isView(v) ? v.slice() : v instanceof Set ? (deep ? new Set(v) : v) : Array.isArray(v) ? v.slice() : v; }
    return b;
  }
  // the position key used for superko: stones plus side to move
  key(turn = this.turn) { return this.hash ^ (turn === WHITE ? 1 : 0); }
  pt(x, y) { return (y + 1) * this.W + x + 1; }
  xy(p) { return [p % this.W - 1, ((p / this.W) | 0) - 1]; }
  // "D4" style name (rows counted from the bottom, as on a real board)
  name(p) { if (p === 0) return 'pass'; const [x, y] = this.xy(p); return COLS[x] + (this.N - y); }
  parse(s) { s = s.trim().toUpperCase(); if (s === 'PASS') return 0; const x = COLS.indexOf(s[0]), y = this.N - +s.slice(1); return this.pt(x, y); }
  inAtari(h) { return this.plib[h] > 0 && this.plib[h] * this.lsq[h] === this.lsum[h] * this.lsum[h]; }
  atariLib(h) { return this.lsum[h] / this.plib[h]; } // the single liberty of a chain in atari
  // exact liberties of the chain containing p (slower; for display and tactics)
  libs(p) {
    const h = this.chain[p], out = new Set(); let q = h;
    do { for (const d of this.DIRS) if (this.c[q + d] === EMPTY) out.add(q + d); q = this.next[q]; } while (q !== h);
    return [...out];
  }
  stones(p) { const h = this.chain[p], out = []; let q = h; do { out.push(q); q = this.next[q]; } while (q !== h); return out; }
  libCount(p) { return this.inAtari(this.chain[p]) ? 1 : this.libs(p).length; }

  _addLib(h, p) { this.plib[h]++; this.lsum[h] += p; this.lsq[h] += p * p; }
  _delLib(h, p) { this.plib[h]--; this.lsum[h] -= p; this.lsq[h] -= p * p; }
  _place(p, col) {
    const { c, chain, next, size } = this;
    c[p] = col; chain[p] = p; next[p] = p; size[p] = 1; this.plib[p] = 0; this.lsum[p] = 0; this.lsq[p] = 0;
    this.hash ^= ZOB[col * 441 + p];
    for (const d of this.DIRS) {
      const q = p + d;
      if (c[q] === EMPTY) this._addLib(p, q);
      else if (c[q] === BLACK || c[q] === WHITE) this._delLib(chain[q], p);
    }
    for (const d of this.DIRS) { const q = p + d; if (c[q] === col && chain[q] !== chain[p]) this._merge(chain[p], chain[q]); }
  }
  _merge(a, b) { // relabel the smaller chain
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    let q = b; do { this.chain[q] = a; q = this.next[q]; } while (q !== b);
    const na = this.next[a]; this.next[a] = this.next[b]; this.next[b] = na;
    this.size[a] += this.size[b]; this.plib[a] += this.plib[b]; this.lsum[a] += this.lsum[b]; this.lsq[a] += this.lsq[b];
  }
  _remove(h) { // capture a whole chain; returns the number of stones
    const { c, chain } = this, col = c[h]; let q = h, n = 0;
    const list = []; do { list.push(q); q = this.next[q]; } while (q !== h);
    for (const s of list) { c[s] = EMPTY; this.hash ^= ZOB[col * 441 + s]; n++; }
    for (const s of list) for (const d of this.DIRS) { const r = s + d; if (c[r] === BLACK || c[r] === WHITE) this._addLib(chain[r], s); }
    return n;
  }
  // Is a move legal for the side to move? (superko: also checks the resulting position hasn't happened before)
  legal(p, col = this.turn, superko = true) {
    if (p === 0) return true;
    if (this.c[p] !== EMPTY || p === this.ko) return false;
    let libsOrCapture = false;
    for (const d of this.DIRS) {
      const q = p + d, v = this.c[q];
      if (v === EMPTY) { libsOrCapture = true; break; }
      if (v === col) { if (!this.inAtari(this.chain[q])) { libsOrCapture = true; break; } }
      else if (v === other(col)) { if (this.inAtari(this.chain[q])) { libsOrCapture = true; break; } }
    }
    if (!libsOrCapture) return false; // suicide
    if (!superko) return true;
    // a position can only repeat after a capture, so only capturing moves need the full check
    let captures = false;
    for (const d of this.DIRS) { const q = p + d; if (this.c[q] === other(col) && this.inAtari(this.chain[q])) captures = true; }
    if (!captures) return true;
    const b = this.clone(); b._play(p, col);
    return !this.seen.has(b.key(other(col)));
  }
  _play(p, col) {
    let captured = 0, lastCap = 0;
    this._place(p, col);
    for (const d of this.DIRS) { const q = p + d; if (this.c[q] === other(col) && this.plib[this.chain[q]] === 0) { const n = this._remove(this.chain[q]); captured += n; lastCap = q; } }
    // simple ko: a single stone captured a single stone and is now alone in atari
    this.ko = captured === 1 && this.size[this.chain[p]] === 1 && this.inAtari(this.chain[p]) ? lastCap : 0;
    return captured;
  }
  // Play a move (0 = pass) for the side to move. Returns the number of stones captured, or -1 if illegal.
  play(p) {
    const col = this.turn;
    if (p !== 0 && !this.legal(p, col)) return -1;
    let n = 0;
    if (p === 0) { this.passes++; this.ko = 0; }
    else { n = this._play(p, col); this.caps[col] += n; this.passes = 0; }
    this.turn = other(col); this.moves++; this.lastMove = p;
    this.seen.add(this.key());
    return n;
  }
  legalMoves(col = this.turn) { return this.points.filter(p => this.c[p] === EMPTY && this.legal(p, col)); }
  // A point every neighbour of which is `col` (or the edge), and most diagonals too: a real eye, which shouldn't be filled
  isEye(p, col) {
    for (const d of this.DIRS) { const v = this.c[p + d]; if (v !== col && v !== EDGE) return false; }
    let bad = 0, edge = false;
    for (const d of this.DIAG) { const v = this.c[p + d]; if (v === EDGE) edge = true; else if (v === other(col)) bad++; }
    return bad === 0 || (!edge && bad < 2);
  }

  // ---------- scoring ----------
  // Area score with the given dead stones removed. Returns { black, white, owner: Uint8Array (point -> colour or 0) }
  score(dead = new Set()) {
    const own = new Uint8Array(this.S), c = this.c.slice();
    for (const p of dead) c[p] = EMPTY;
    let b = 0, w = 0;
    const seen = new Uint8Array(this.S);
    for (const p of this.points) {
      if (c[p] === BLACK) { b++; own[p] = BLACK; continue; }
      if (c[p] === WHITE) { w++; own[p] = WHITE; continue; }
      if (seen[p]) continue;
      // flood an empty region; it belongs to a colour only if it touches no other
      const region = [p], touch = new Set(); seen[p] = 1;
      for (let k = 0; k < region.length; k++) for (const d of this.DIRS) {
        const q = region[k] + d;
        if (c[q] === EMPTY && !seen[q]) { seen[q] = 1; region.push(q); } else if (c[q] === BLACK || c[q] === WHITE) touch.add(c[q]);
      }
      if (touch.size === 1) { const o = [...touch][0]; for (const q of region) own[q] = o; if (o === BLACK) b += region.length; else w += region.length; }
    }
    // dead stones count as territory for the side surrounding them (already counted: their points are empty now)
    return { black: b, white: w + this.komi, owner: own, margin: b - (w + this.komi) };
  }
}

// ---------- playouts and the computer player ----------
// A light playout policy: answer ataris (capture or escape), otherwise random moves that don't fill own eyes and avoid
// large self-ataris. Returns the winner of the finished game (area scoring).
function playout(b, r, amaf, maxMoves) {
  let passes = 0, n = 0;
  const pts = b.points;
  while (passes < 2 && n < maxMoves) {
    const col = b.turn;
    let move = 0;
    // 1. capture or save a chain that the last move put in atari
    if (b.lastMove > 0 && r() < 0.9) move = urgent(b, col, r);
    // 2. anywhere on the board: capture the biggest enemy chain in atari, or rescue our own
    if (!move && r() < 0.7) move = ataris(b, col);
    // 2. random move
    if (!move) {
      const start = (r() * pts.length) | 0;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[(start + k) % pts.length];
        if (b.c[p] !== EMPTY || p === b.ko || b.isEye(p, col)) continue;
        if (!b.legal(p, col, false)) continue;
        if (selfAtariBig(b, p, col)) continue;
        move = p; break;
      }
    }
    if (move) { if (amaf && !amaf[move]) amaf[move] = col; b._play(move, col); passes = 0; }
    else { passes++; b.ko = 0; }
    b.turn = other(col); b.lastMove = move; n++;
  }
  const s = b.score();
  return s.margin > 0 ? BLACK : WHITE;
}
// Biggest capture available, else the biggest of our chains in atari that can escape by extending
function ataris(b, col) {
  const opp = other(col); let cap = 0, capSize = 0, save = 0, saveSize = 0;
  for (const p of b.points) {
    const v = b.c[p]; if ((v !== BLACK && v !== WHITE) || b.chain[p] !== p || !b.inAtari(p)) continue;
    const lib = b.atariLib(p), sz = b.size[p];
    if (v === opp) { if (sz > capSize && b.legal(lib, col, false)) { cap = lib; capSize = sz; } }
    else if (sz > saveSize && b.legal(lib, col, false) && !selfAtari(b, lib, col)) { save = lib; saveSize = sz; }
  }
  return cap || save;
}
// Moves that answer the last move's ataris: capture a chain in atari next to it, or extend one of ours that it put in atari
function urgent(b, col, r) {
  const lm = b.lastMove, opp = other(col);
  // our chains next to the last move that are in atari: escape by extending (if that gains liberties) or capture an attacker
  for (const d of b.DIRS) {
    const q = lm + d;
    if (b.c[q] === col && b.inAtari(b.chain[q])) {
      const h = b.chain[q];
      // capture a neighbouring opponent chain in atari
      let st = h; do { for (const e of b.DIRS) { const z = st + e; if (b.c[z] === opp && b.inAtari(b.chain[z])) { const lib = b.atariLib(b.chain[z]); if (b.legal(lib, col, false)) return lib; } } st = b.next[st]; } while (st !== h);
      const lib = b.atariLib(h);
      if (b.legal(lib, col, false) && !selfAtari(b, lib, col)) return lib;
    }
  }
  // the last move's own chain in atari: capture it
  if (b.c[lm] === opp && b.inAtari(b.chain[lm])) { const lib = b.atariLib(b.chain[lm]); if (b.legal(lib, col, false)) return lib; }
  return 0;
}
// Would playing p leave our new chain in atari? (counted roughly: liberties of the merged chain after the move)
function selfAtari(b, p, col) {
  const libs = new Set(); let captures = false;
  for (const d of b.DIRS) {
    const q = p + d, v = b.c[q];
    if (v === EMPTY) libs.add(q);
    else if (v === col) { for (const l of b.libs(q)) if (l !== p) libs.add(l); }
    else if (v === other(col) && b.inAtari(b.chain[q])) captures = true;
    if (libs.size > 1) return false;
  }
  return !captures && libs.size <= 1;
}
function selfAtariBig(b, p, col) {
  let size = 1;
  for (const d of b.DIRS) { const q = p + d; if (b.c[q] === col) size += b.size[b.chain[q]]; }
  return size >= 3 && selfAtari(b, p, col);
}

// Monte Carlo tree search with RAVE. opts: { playouts, time, noise, seed }. Returns { move, winrate, visits, top: [...] }.
const LEVELS = [
  null,
  // time caps (ms) keep 13x13 moves quick on a phone; on 9x9 the playout count is usually reached first
  { name: 'Beginner', playouts: 120, noise: 0.35, time: 1000 },
  { name: 'Casual', playouts: 500, noise: 0.15, time: 2000 },
  { name: 'Intermediate', playouts: 2000, noise: 0.04, time: 3500 },
  { name: 'Advanced', playouts: 6000, noise: 0, time: 6000 },
  { name: 'Expert', playouts: 16000, noise: 0, time: 9000 },
];
class Node {
  constructor(move, col, prior) { this.move = move; this.col = col; this.n = 0; this.w = 0; this.rn = 0; this.rw = 0; this.kids = null; this.prior = prior || 0; }
}
function priorFor(b, p, col) {
  // simple knowledge: captures and saving moves are good, first-line moves early and self-ataris are bad
  if (p === 0) return -2;
  let v = 0;
  const [x, y] = b.xy(p), N = b.N, line = Math.min(x, y, N - 1 - x, N - 1 - y);
  if (line === 0) v -= 1.2; else if (line === 1 && b.moves < N * 2) v -= 0.3; else if (line === 2 || line === 3) v += 0.3;
  for (const d of b.DIRS) {
    const q = p + d, c = b.c[q];
    if (c === other(col) && b.inAtari(b.chain[q])) v += 1 + Math.min(3, b.size[b.chain[q]]) * 0.6;
    if (c === col && b.inAtari(b.chain[q])) v += 0.8 + Math.min(3, b.size[b.chain[q]]) * 0.5;
  }
  if (selfAtari(b, p, col)) v -= 2;
  if (b.lastMove > 0) { const [lx, ly] = b.xy(b.lastMove), dist = Math.max(Math.abs(lx - x), Math.abs(ly - y)); if (dist <= 2) v += 0.4; }
  return v;
}
function search(b0, opts) {
  const r = rng(opts.seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0));
  const me = b0.turn, root = new Node(-1, other(me)), t0 = Date.now(), maxMoves = b0.N * b0.N * 3;
  const expand = (node, b) => {
    node.kids = [];
    for (const p of b.points) if (b.c[p] === EMPTY && !b.isEye(p, b.turn) && b.legal(p, b.turn)) node.kids.push(new Node(p, b.turn, priorFor(b, p, b.turn)));
    node.kids.push(new Node(0, b.turn, -2));
    // priors as virtual wins/visits
    for (const k of node.kids) { const pv = 1 / (1 + Math.exp(-k.prior)); k.n = 10; k.w = 10 * pv; }
  };
  let done = 0;
  const limit = opts.playouts || 1000, timeLimit = opts.time || 1e9;
  while (done < limit && Date.now() - t0 < timeLimit) {
    const b = b0.clone(), path = [root], amaf = new Uint8Array(b0.S);
    let node = root;
    while (node.kids && node.kids.length) {
      // UCT with RAVE blend
      let best = null, bv = -1e9;
      const lnN = Math.log(node.n + 1);
      for (const k of node.kids) {
        const q = k.w / k.n, rq = k.rn ? k.rw / k.rn : 0.5, beta = k.rn / (k.rn + k.n + 4e-4 * k.rn * k.n + 1e-9);
        const v = (1 - beta) * q + beta * rq + 0.35 * Math.sqrt(lnN / k.n);
        if (v > bv) { bv = v; best = k; }
      }
      node = best; path.push(node);
      if (node.move > 0 && !amaf[node.move]) amaf[node.move] = node.col;
      if (node.move === 0) { b.passes++; b.ko = 0; b.turn = other(b.turn); b.lastMove = 0; if (b.passes >= 2) break; }
      else { b._play(node.move, b.turn); b.turn = other(b.turn); b.lastMove = node.move; b.passes = 0; }
    }
    if (!node.kids && node.n >= 2 && b.passes < 2) { expand(node, b); }
    const winner = b.passes >= 2 ? (b.score().margin > 0 ? BLACK : WHITE) : playout(b, r, amaf, maxMoves);
    for (const nd of path) {
      nd.n++; if (nd.col === winner) nd.w++;
      if (nd.kids) for (const k of nd.kids) if (k.move > 0 && amaf[k.move] === k.col) { k.rn++; if (k.col === winner) k.rw++; }
    }
    if (!root.kids) expand(root, b0);
    done++;
  }
  const kids = (root.kids || []).filter(k => k.n > 10).sort((a, b) => b.n - a.n);
  if (!kids.length) return { move: 0, winrate: 0.5, visits: done, top: [] };
  let pick = kids[0];
  if (opts.noise) {
    // weaker levels: choose among the decent candidates with some randomness
    const cands = kids.slice(0, 8).filter(k => k.w / k.n > kids[0].w / kids[0].n - 0.25 && k.move !== 0);
    if (cands.length && r() < opts.noise * 2) pick = cands[(r() * cands.length) | 0];
  }
  return { move: pick.move, winrate: pick.w / pick.n, visits: done, top: kids.slice(0, 6).map(k => ({ move: k.move, winrate: k.w / k.n, n: k.n })) };
}
// The computer's move at a level: passes when the game is over, resigns when hopeless
function think(b, level, opts = {}) {
  const L = typeof level === 'number' ? LEVELS[level] : level;
  const res = search(b, Object.assign({}, L, opts));
  // pass if the opponent passed and passing doesn't lose, or if nothing useful is left
  if (b.lastMove === 0 && b.moves > 0) { const s = estimate(b, 200); if ((s.margin > 0) === (b.turn === BLACK)) return Object.assign(res, { move: 0 }); }
  if (res.winrate < 0.04 && L.playouts >= 2000 && b.moves > b.N * b.N / 2) res.resign = true;
  return res;
}

// Ownership estimate from playouts: for each point, the share of playouts black owned it in. Also guesses dead stones.
function estimate(b0, n = 300, seed) {
  const r = rng(seed || 12345), own = new Float32Array(b0.S);
  let margin = 0;
  for (let k = 0; k < n; k++) {
    const b = b0.clone(); b.passes = 0;
    playout(b, r, null, b.N * b.N * 3);
    const s = b.score(); margin += s.margin;
    for (const p of b.points) if (s.owner[p] === BLACK) own[p]++; else if (s.owner[p] === WHITE) own[p]--;
  }
  for (const p of b0.points) own[p] /= n;
  // stones whose point the other side owns most of the time are dead; decide per chain
  const dead = new Set();
  const done = new Uint8Array(b0.S);
  for (const p of b0.points) {
    if (done[p] || (b0.c[p] !== BLACK && b0.c[p] !== WHITE)) continue;
    const st = b0.stones(p); st.forEach(s => done[s] = 1);
    const avg = st.reduce((a, s) => a + own[s], 0) / st.length;
    if ((b0.c[p] === BLACK && avg < -0.3) || (b0.c[p] === WHITE && avg > 0.3)) st.forEach(s => dead.add(s));
  }
  return { own, dead, margin: margin / n };
}

// Handicap stones (standard star points)
function handicapPoints(N, n) {
  const e = N >= 13 ? 3 : 2, m = (N - 1) / 2, f = N - 1 - e;
  const all = [[f, e], [e, f], [f, f], [e, e], [m, m], [e, m], [f, m], [m, e], [m, f]];
  const order = { 2: [0, 1], 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6], 8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8] }[n] || [];
  return order.map(k => all[k]);
}
function newGame(N, handicap = 0, komi) {
  const b = new Board(N);
  if (handicap >= 2) {
    for (const [x, y] of handicapPoints(N, handicap)) b._place(b.pt(x, y), BLACK);
    b.turn = WHITE; b.handicap = handicap; b.seen = new Set([b.key()]);
  }
  b.komi = komi != null ? komi : handicap >= 2 ? 0.5 : 7.5;
  return b;
}
// Replay a list of moves (point numbers, 0 = pass) from a fresh game
function replay(N, handicap, komi, moves) { const b = newGame(N, handicap, komi); for (const m of moves) if (b.play(m) < 0) throw new Error('illegal move in replay: ' + b.name(m)); return b; }
// Play a whole game between two levels (tests and strength checks). Returns { winner, margin, moves }
function selfPlay(N, blackLevel, whiteLevel, seed = 1) {
  const b = newGame(N); let k = 0;
  while (b.passes < 2 && b.moves < N * N * 3) {
    const L = b.turn === BLACK ? blackLevel : whiteLevel, res = think(b, L, { seed: seed * 7919 + k++ });
    if (res.resign) return { winner: other(b.turn), margin: null, moves: b.moves, resigned: true };
    if (b.play(res.move) < 0) b.play(0);
  }
  const est = estimate(b, 200), s = b.score(est.dead);
  return { winner: s.margin > 0 ? BLACK : WHITE, margin: s.margin, moves: b.moves };
}

const api = { selfPlay, Board, EMPTY, BLACK, WHITE, EDGE, other, COLS, LEVELS, search, think, estimate, playout, newGame, replay, handicapPoints, selfAtari, rng };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Go = api;
})(typeof self !== 'undefined' ? self : globalThis);
