// Paper Games chess: rules (0x88 board), notation, draw detection and a search engine.
// Loaded by chess.html and by chess-worker.js; also runs in Node for tests (module.exports).
(function (root) {
'use strict';

const WHITE = 0, BLACK = 1;
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const pc = (c, t) => t | (c << 3);
const colorOf = p => p >> 3, typeOf = p => p & 7;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
const B_OFF = [15, 17, -15, -17];
const R_OFF = [16, -16, 1, -1];
const K_OFF = [15, 16, 17, 1, -1, -15, -16, -17];

// Move = from | to<<7 | promo<<14 | flags<<17
const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8, F_PROMO = 16;
const mk = (f, t, promo, flags) => f | (t << 7) | (promo << 14) | (flags << 17);
const mFrom = m => m & 127, mTo = m => (m >> 7) & 127, mPromo = m => (m >> 14) & 7, mFlags = m => m >> 17;

const sqName = s => 'abcdefgh'[s & 7] + ((s >> 4) + 1);
const sqFrom = n => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);
const LETTER = ' pnbrqk';

const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[0] = 15 & ~2; CASTLE_MASK[4] = 15 & ~3; CASTLE_MASK[7] = 15 & ~1;
CASTLE_MASK[112] = 15 & ~8; CASTLE_MASK[116] = 15 & ~12; CASTLE_MASK[119] = 15 & ~4;

// Zobrist keys: two independent 32-bit halves
let seed = 0x9e3779b9;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
const ZP1 = new Int32Array(16 * 128), ZP2 = new Int32Array(16 * 128);
for (let i = 0; i < ZP1.length; i++) { ZP1[i] = rnd(); ZP2[i] = rnd(); }
const ZC1 = new Int32Array(16), ZC2 = new Int32Array(16);
for (let i = 0; i < 16; i++) { ZC1[i] = rnd(); ZC2[i] = rnd(); }
const ZE1 = new Int32Array(128), ZE2 = new Int32Array(128);
for (let i = 0; i < 128; i++) { ZE1[i] = rnd(); ZE2[i] = rnd(); }
const ZS1 = rnd(), ZS2 = rnd();

class Position {
  constructor(fen) { this.b = new Int8Array(128); this.load(fen || START); }

  load(fen) {
    const [board, side, castle, ep, half, full] = fen.trim().split(/\s+/);
    this.b.fill(0); this.king = [-1, -1];
    let r = 7, f = 0;
    for (const ch of board) {
      if (ch === '/') { r--; f = 0; continue; }
      if (/\d/.test(ch)) { f += +ch; continue; }
      const t = LETTER.indexOf(ch.toLowerCase()), c = ch === ch.toUpperCase() ? WHITE : BLACK;
      const s = r * 16 + f; this.b[s] = pc(c, t); if (t === K) this.king[c] = s; f++;
    }
    this.turn = side === 'b' ? BLACK : WHITE;
    this.castle = 0;
    if (castle && castle !== '-') for (const ch of castle) this.castle |= { K: 1, Q: 2, k: 4, q: 8 }[ch] || 0;
    this.ep = ep && ep !== '-' ? sqFrom(ep) : -1;
    this.half = +half || 0; this.full = +full || 1;
    this.stack = [];
    this.rehash();
    this.reps = [this.h1]; // position keys since the game started, for repetition
  }

  rehash() {
    let h1 = 0, h2 = 0;
    for (let s = 0; s < 128; s++) if (!(s & 0x88) && this.b[s]) { h1 ^= ZP1[this.b[s] * 128 + s]; h2 ^= ZP2[this.b[s] * 128 + s]; }
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep]; h2 ^= ZE2[this.ep]; }
    if (this.turn) { h1 ^= ZS1; h2 ^= ZS2; }
    this.h1 = h1; this.h2 = h2;
  }

  fen() {
    let out = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.b[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        const l = LETTER[typeOf(p)]; out += colorOf(p) === WHITE ? l.toUpperCase() : l;
      }
      if (empty) out += empty;
      if (r) out += '/';
    }
    let c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return `${out} ${this.turn ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
  }

  attacked(sq, by) {
    const b = this.b;
    if (by === WHITE) { if (!((sq - 15) & 0x88) && b[sq - 15] === pc(WHITE, P)) return true; if (!((sq - 17) & 0x88) && b[sq - 17] === pc(WHITE, P)) return true; }
    else { if (!((sq + 15) & 0x88) && b[sq + 15] === pc(BLACK, P)) return true; if (!((sq + 17) & 0x88) && b[sq + 17] === pc(BLACK, P)) return true; }
    const kn = pc(by, N), kg = pc(by, K), bi = pc(by, B), rk = pc(by, R), qn = pc(by, Q);
    for (const o of N_OFF) { const s = sq + o; if (!(s & 0x88) && b[s] === kn) return true; }
    for (const o of K_OFF) { const s = sq + o; if (!(s & 0x88) && b[s] === kg) return true; }
    for (const o of B_OFF) { let s = sq + o; while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === bi || p === qn) return true; break; } s += o; } }
    for (const o of R_OFF) { let s = sq + o; while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === rk || p === qn) return true; break; } s += o; } }
    return false;
  }
  inCheck(c = this.turn) { return this.attacked(this.king[c], c ^ 1); }

  // Pseudo-legal moves. noisy = captures and queen promotions only (for quiescence search).
  gen(out, noisy) {
    const b = this.b, us = this.turn, them = us ^ 1;
    for (let f = 0; f < 120; f++) {
      if (f & 0x88) { f += 7; continue; }
      const p = b[f]; if (!p || colorOf(p) !== us) continue;
      const t = typeOf(p);
      if (t === P) {
        const dir = us ? -16 : 16, rank = f >> 4, promoRank = us ? 1 : 6;
        const to = f + dir;
        if (!(to & 0x88) && !b[to]) {
          if (rank === promoRank) { out.push(mk(f, to, Q, F_PROMO)); if (!noisy) { out.push(mk(f, to, N, F_PROMO)); out.push(mk(f, to, R, F_PROMO)); out.push(mk(f, to, B, F_PROMO)); } }
          else if (!noisy) { out.push(mk(f, to, 0, 0)); if (rank === (us ? 6 : 1) && !b[to + dir]) out.push(mk(f, to + dir, 0, F_DOUBLE)); }
        }
        for (const side of [-1, 1]) {
          const c = to + side; if (c & 0x88) continue;
          if (b[c] && colorOf(b[c]) === them) {
            if (rank === promoRank) { out.push(mk(f, c, Q, F_PROMO | F_CAP)); if (!noisy) { out.push(mk(f, c, N, F_PROMO | F_CAP)); out.push(mk(f, c, R, F_PROMO | F_CAP)); out.push(mk(f, c, B, F_PROMO | F_CAP)); } }
            else out.push(mk(f, c, 0, F_CAP));
          } else if (c === this.ep) out.push(mk(f, c, 0, F_CAP | F_EP));
        }
        continue;
      }
      const offs = t === N ? N_OFF : t === B ? B_OFF : t === R ? R_OFF : K_OFF /* queen and king: all 8 directions */, slide = t === B || t === R || t === Q;
      for (const o of offs) {
        let s = f + o;
        while (!(s & 0x88)) {
          const q = b[s];
          if (q) { if (colorOf(q) === them) out.push(mk(f, s, 0, F_CAP)); break; }
          if (!noisy) out.push(mk(f, s, 0, 0));
          if (!slide) break;
          s += o;
        }
      }
      if (t === K && !noisy) {
        const base = us ? 112 : 0;
        if (f === base + 4 && !this.attacked(f, them)) {
          if (this.castle & (us ? 4 : 1) && !b[base + 5] && !b[base + 6] && b[base + 7] === pc(us, R) && !this.attacked(base + 5, them) && !this.attacked(base + 6, them)) out.push(mk(f, base + 6, 0, F_CASTLE));
          if (this.castle & (us ? 8 : 2) && !b[base + 3] && !b[base + 2] && !b[base + 1] && b[base] === pc(us, R) && !this.attacked(base + 3, them) && !this.attacked(base + 2, them)) out.push(mk(f, base + 2, 0, F_CASTLE));
        }
      }
    }
    return out;
  }

  make(m) {
    const b = this.b, f = mFrom(m), t = mTo(m), fl = mFlags(m), us = this.turn, them = us ^ 1, p = b[f];
    const capSq = fl & F_EP ? t + (us ? 16 : -16) : t, cap = b[capSq];
    this.stack.push(m, cap, this.castle, this.ep, this.half, this.h1, this.h2);
    let h1 = this.h1 ^ ZP1[p * 128 + f], h2 = this.h2 ^ ZP2[p * 128 + f];
    if (cap) { h1 ^= ZP1[cap * 128 + capSq]; h2 ^= ZP2[cap * 128 + capSq]; b[capSq] = 0; }
    const np = fl & F_PROMO ? pc(us, mPromo(m)) : p;
    b[f] = 0; b[t] = np; h1 ^= ZP1[np * 128 + t]; h2 ^= ZP2[np * 128 + t];
    if (fl & F_CASTLE) {
      const [rf, rt] = t > f ? [f + 3, f + 1] : [f - 4, f - 1], rp = b[rf];
      b[rf] = 0; b[rt] = rp; h1 ^= ZP1[rp * 128 + rf] ^ ZP1[rp * 128 + rt]; h2 ^= ZP2[rp * 128 + rf] ^ ZP2[rp * 128 + rt];
    }
    if (typeOf(p) === K) this.king[us] = t;
    if (this.ep >= 0) { h1 ^= ZE1[this.ep]; h2 ^= ZE2[this.ep]; }
    this.ep = -1;
    if (fl & F_DOUBLE) {
      const e = (f + t) >> 1, ep = pc(them, P);
      if ((!((t - 1) & 0x88) && b[t - 1] === ep) || (!((t + 1) & 0x88) && b[t + 1] === ep)) { this.ep = e; h1 ^= ZE1[e]; h2 ^= ZE2[e]; }
    }
    const nc = this.castle & CASTLE_MASK[f] & CASTLE_MASK[t];
    if (nc !== this.castle) { h1 ^= ZC1[this.castle] ^ ZC1[nc]; h2 ^= ZC2[this.castle] ^ ZC2[nc]; this.castle = nc; }
    this.half = typeOf(p) === P || cap ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.turn = them; h1 ^= ZS1; h2 ^= ZS2;
    this.h1 = h1; this.h2 = h2;
    this.reps.push(h1);
  }

  unmake() {
    const s = this.stack, h2 = s.pop(), h1 = s.pop(), half = s.pop(), ep = s.pop(), castle = s.pop(), cap = s.pop(), m = s.pop();
    const b = this.b, f = mFrom(m), t = mTo(m), fl = mFlags(m);
    this.turn ^= 1; const us = this.turn;
    const p = fl & F_PROMO ? pc(us, P) : b[t];
    b[f] = p; b[t] = 0;
    if (cap) b[fl & F_EP ? t + (us ? 16 : -16) : t] = cap;
    if (fl & F_CASTLE) { const [rf, rt] = t > f ? [f + 3, f + 1] : [f - 4, f - 1]; b[rf] = b[rt]; b[rt] = 0; }
    if (typeOf(p) === K) this.king[us] = f;
    if (us === BLACK) this.full--;
    this.castle = castle; this.ep = ep; this.half = half; this.h1 = h1; this.h2 = h2;
    this.reps.pop();
  }

  makeNull() {
    this.stack.push(0, 0, this.castle, this.ep, this.half, this.h1, this.h2);
    if (this.ep >= 0) { this.h1 ^= ZE1[this.ep]; this.h2 ^= ZE2[this.ep]; this.ep = -1; }
    this.turn ^= 1; this.h1 ^= ZS1; this.h2 ^= ZS2; this.half++;
    this.reps.push(this.h1);
  }
  unmakeNull() {
    const s = this.stack; this.h2 = s.pop(); this.h1 = s.pop(); this.half = s.pop(); this.ep = s.pop(); this.castle = s.pop(); s.pop(); s.pop();
    this.turn ^= 1; this.reps.pop();
  }

  legal() {
    const out = [], us = this.turn;
    for (const m of this.gen([], false)) { this.make(m); if (!this.attacked(this.king[us], us ^ 1)) out.push(m); this.unmake(); }
    return out;
  }

  // Repetition: has the current position occurred `times`-1 times before?
  repeats(times) {
    const r = this.reps, n = r.length - 1, h = r[n]; let c = 1;
    for (let i = n - 2; i >= 0 && i >= n - this.half; i -= 2) if (r[i] === h && ++c >= times) return true;
    return false;
  }

  insufficient() {
    let minors = [], other = false;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.b[s]; if (!p) continue; const t = typeOf(p);
      if (t === K) continue;
      if (t === N || t === B) minors.push([t, ((s >> 4) + (s & 7)) & 1]); else { other = true; break; }
    }
    if (other) return false;
    if (minors.length <= 1) return true;
    return minors.every(m => m[0] === B) && minors.every(m => m[1] === minors[0][1]); // bishops all on one color
  }

  // Game state for the side to move: null if the game goes on.
  status() {
    const moves = this.legal();
    if (!moves.length) return this.inCheck() ? { over: true, result: this.turn ? '1-0' : '0-1', reason: 'checkmate' } : { over: true, result: '1/2-1/2', reason: 'stalemate' };
    if (this.insufficient()) return { over: true, result: '1/2-1/2', reason: 'insufficient material' };
    if (this.half >= 100) return { over: true, result: '1/2-1/2', reason: 'the fifty-move rule' };
    if (this.repeats(3)) return { over: true, result: '1/2-1/2', reason: 'threefold repetition' };
    return null;
  }

  san(m, legalList) {
    const f = mFrom(m), t = mTo(m), fl = mFlags(m), p = this.b[f], type = typeOf(p);
    let s;
    if (fl & F_CASTLE) s = t > f ? 'O-O' : 'O-O-O';
    else {
      s = '';
      if (type === P) { if (fl & F_CAP) s = 'abcdefgh'[f & 7] + 'x'; }
      else {
        s = LETTER[type].toUpperCase();
        const rivals = (legalList || this.legal()).filter(x => x !== m && mTo(x) === t && this.b[mFrom(x)] === p);
        if (rivals.length) {
          const sameFile = rivals.some(x => (mFrom(x) & 7) === (f & 7)), sameRank = rivals.some(x => (mFrom(x) >> 4) === (f >> 4));
          if (!sameFile) s += 'abcdefgh'[f & 7]; else if (!sameRank) s += (f >> 4) + 1; else s += sqName(f);
        }
        if (fl & F_CAP) s += 'x';
      }
      s += sqName(t);
      if (fl & F_PROMO) s += '=' + LETTER[mPromo(m)].toUpperCase();
    }
    this.make(m);
    if (this.inCheck()) s += this.legal().length ? '+' : '#';
    this.unmake();
    return s;
  }

  static uci(m) { return sqName(mFrom(m)) + sqName(mTo(m)) + (mFlags(m) & F_PROMO ? LETTER[mPromo(m)] : ''); }
  fromUci(u) { return this.legal().find(m => Position.uci(m) === u) || 0; }

  static fromMoves(fen, moves) {
    const p = new Position(fen);
    for (const u of moves) { const m = p.fromUci(u); if (!m) throw new Error('Illegal move in record: ' + u); p.make(m); }
    return p;
  }

  perft(d) {
    if (!d) return 1;
    let n = 0; const us = this.turn;
    for (const m of this.gen([], false)) { this.make(m); if (!this.attacked(this.king[us], us ^ 1)) n += this.perft(d - 1); this.unmake(); }
    return n;
  }
}

// ---------------- Evaluation ----------------
const VAL = [0, 100, 320, 330, 500, 900, 0];
const PST = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  7: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};
const PHASE = [0, 0, 1, 1, 2, 4, 0];
const pstIndex = (s, c) => c === WHITE ? (7 - (s >> 4)) * 8 + (s & 7) : (s >> 4) * 8 + (s & 7);

function evaluate(pos) {
  const b = pos.b; let mg = 0, phase = 0, bishops = [0, 0], nonPawn = [0, 0];
  const kingSq = pos.king;
  for (let s = 0; s < 120; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s]; if (!p) continue;
    const t = typeOf(p), c = colorOf(p), sign = c === WHITE ? 1 : -1;
    phase += PHASE[t];
    if (t === K) continue;
    if (t === B) bishops[c]++;
    if (t !== P) nonPawn[c] += VAL[t];
    mg += sign * (VAL[t] + PST[t][pstIndex(s, c)]);
  }
  phase = Math.min(phase, 24);
  for (const c of [WHITE, BLACK]) {
    const i = pstIndex(kingSq[c], c), k = (PST[6][i] * phase + PST[7][i] * (24 - phase)) / 24;
    mg += (c === WHITE ? 1 : -1) * k;
    if (bishops[c] >= 2) mg += c === WHITE ? 30 : -30;
  }
  // Endgame "mop-up": help the stronger side drive the lone king to the edge and bring its own king closer.
  if (phase <= 8 && Math.abs(mg) > 250) {
    const strong = mg > 0 ? WHITE : BLACK, weak = strong ^ 1;
    const wk = kingSq[weak], sk = kingSq[strong];
    const cd = Math.max(3 - (wk >> 4), (wk >> 4) - 4) + Math.max(3 - (wk & 7), (wk & 7) - 4);
    const kd = Math.abs((wk >> 4) - (sk >> 4)) + Math.abs((wk & 7) - (sk & 7));
    mg += (strong === WHITE ? 1 : -1) * (cd * 10 + (14 - kd) * 4);
  }
  const score = Math.round(mg) + 10 * (pos.turn === WHITE ? 1 : -1);
  return pos.turn === WHITE ? score : -score;
}

// ---------------- Search ----------------
const MATE = 100000, INF = 1000000;
const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
let ttKey = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE);
// Lets a test harness give each player its own search memory (the app uses one engine, so it never calls this).
function newTT(){ return { ttKey: new Int32Array(TT_SIZE), ttMove: new Int32Array(TT_SIZE), ttScore: new Int32Array(TT_SIZE), ttDepth: new Int8Array(TT_SIZE), ttFlag: new Int8Array(TT_SIZE) }; }
function useTT(t){ ({ ttKey, ttMove, ttScore, ttDepth, ttFlag } = t); }
const EXACT = 1, LOWER = 2, UPPER = 3;

const BOOK = {
  '': ['e2e4', 'd2d4', 'c2c4', 'g1f3'],
  'e2e4': ['e7e5', 'c7c5', 'e7e6', 'c7c6'], 'd2d4': ['d7d5', 'g8f6'], 'c2c4': ['e7e5', 'g8f6', 'c7c5'], 'g1f3': ['d7d5', 'g8f6', 'c7c5'],
  'e2e4 e7e5': ['g1f3', 'f1c4', 'b1c3'], 'e2e4 e7e5 g1f3': ['b8c6', 'g8f6'], 'e2e4 e7e5 g1f3 b8c6': ['f1b5', 'f1c4', 'd2d4'],
  'e2e4 c7c5': ['g1f3', 'b1c3'], 'e2e4 c7c5 g1f3': ['d7d6', 'b8c6', 'e7e6'], 'e2e4 e7e6': ['d2d4'], 'e2e4 e7e6 d2d4': ['d7d5'], 'e2e4 c7c6': ['d2d4'], 'e2e4 c7c6 d2d4': ['d7d5'],
  'd2d4 d7d5': ['c2c4', 'g1f3'], 'd2d4 d7d5 c2c4': ['e7e6', 'c7c6', 'd5c4'], 'd2d4 g8f6': ['c2c4', 'g1f3'], 'd2d4 g8f6 c2c4': ['e7e6', 'g7g6'],
  'c2c4 e7e5': ['b1c3', 'g2g3'], 'c2c4 g8f6': ['b1c3', 'g1f3'], 'g1f3 d7d5': ['d2d4', 'g2g3'], 'g1f3 g8f6': ['c2c4', 'd2d4'],
};

// Strength levels. noise = random centipawns added to each root move (weaker play); depth/time limit the search.
const LEVELS = [
  null,
  { name: 'Beginner', depth: 1, time: 300, noise: 220 },
  { name: 'Casual', depth: 2, time: 400, noise: 90 },
  { name: 'Intermediate', depth: 3, time: 700, noise: 30 },
  { name: 'Advanced', depth: 64, time: 1000, noise: 0 },
  { name: 'Expert', depth: 64, time: 2500, noise: 0 },
];

class Engine {
  static think(pos, level, history = []) {
    const L = typeof level === 'number' ? LEVELS[level] : level;
    const legal = pos.legal();
    if (!legal.length) return { move: 0 };
    if (legal.length === 1) return { move: legal[0], score: 0, depth: 0 };
    const book = BOOK[history.join(' ')];
    if (book && history.length < 8) {
      const opts = book.map(u => legal.find(m => Position.uci(m) === u)).filter(Boolean);
      if (opts.length) return { move: opts[(Math.random() * opts.length) | 0], score: 0, depth: 0, book: true };
    }
    const S = new Search(pos, L.time);
    return L.noise ? S.noisyRoot(legal, L.depth, L.noise) : S.iterate(L.depth);
  }
}

class Search {
  constructor(pos, timeMs) {
    this.pos = pos; this.deadline = now() + timeMs; this.nodes = 0; this.stop = false;
    this.killers = new Int32Array(128 * 2); this.hist = new Int32Array(16 * 128);
  }
  time() { if ((++this.nodes & 2047) === 0 && now() > this.deadline) this.stop = true; return this.stop; }

  iterate(maxDepth) {
    let best = { move: 0, score: 0, depth: 0 };
    for (let d = 1; d <= maxDepth; d++) {
      this.rootBest = 0; this.rootScore = -INF;
      const score = this.search(d, -INF, INF, 0, true);
      if (this.stop) { if (this.rootBest && this.rootScore > -INF) best = { move: this.rootBest, score: this.rootScore, depth: d - 1, partial: true }; break; }
      best = { move: this.rootBest, score, depth: d };
      if (Math.abs(score) > MATE - 200) break; // found a forced mate
    }
    if (!best.move) best.move = this.pos.legal()[0];
    return best;
  }

  noisyRoot(legal, depth, noise) {
    const scored = [];
    this.deadline = now() + 60000; // fixed depth; noise decides
    for (const m of legal) {
      this.pos.make(m);
      const s = -this.search(depth - 1, -INF, INF, 1, true);
      this.pos.unmake();
      scored.push([m, s + gauss() * noise, s]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    // Never miss a mate in one, even at low levels
    const mate = scored.find(x => x[2] > MATE - 10);
    const pick = mate || scored[0];
    return { move: pick[0], score: pick[2], depth };
  }

  search(depth, alpha, beta, ply, allowNull) {
    const pos = this.pos;
    if (ply && (pos.half >= 100 || pos.repeats(2))) return 0;
    if (this.time()) return 0;
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    const idx = pos.h1 & TT_MASK; let ttm = 0;
    if (ttKey[idx] === pos.h2) {
      ttm = ttMove[idx];
      if (ply && ttDepth[idx] >= depth) {
        let s = ttScore[idx]; if (s > MATE - 500) s -= ply; else if (s < -MATE + 500) s += ply;
        const fl = ttFlag[idx];
        if (fl === EXACT || (fl === LOWER && s >= beta) || (fl === UPPER && s <= alpha)) return s;
      }
    }

    // Null move pruning
    if (allowNull && !inCheck && ply && depth >= 3 && this.hasPieces(pos.turn) && evaluate(pos) >= beta) {
      pos.makeNull();
      const s = -this.search(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (this.stop) return 0;
      if (s >= beta) return beta;
    }

    const moves = pos.gen([], false);
    this.order(moves, ttm, ply);
    const us = pos.turn, a0 = alpha;
    let legal = 0, bestScore = -INF, bestMove = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      pos.make(m);
      if (pos.attacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
      legal++;
      let s;
      if (legal === 1) s = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        const quiet = !(mFlags(m) & (F_CAP | F_PROMO));
        let r = 0;
        if (ply && depth >= 3 && legal > 4 && quiet && !inCheck && !pos.inCheck()) r = depth >= 6 && legal > 12 ? 2 : 1;
        s = -this.search(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && (r || s < beta)) s = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stop) return 0;
      if (s > bestScore) {
        bestScore = s; bestMove = m;
        if (!ply) { this.rootBest = m; this.rootScore = s; }
      }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (!(mFlags(m) & F_CAP)) {
          if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
          this.hist[pos.b[mFrom(m)] * 128 + mTo(m)] += depth * depth;
        }
        break;
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;

    let ts = bestScore; if (ts > MATE - 500) ts += ply; else if (ts < -MATE + 500) ts -= ply;
    ttKey[idx] = pos.h2; ttMove[idx] = bestMove; ttScore[idx] = ts; ttDepth[idx] = depth;
    ttFlag[idx] = bestScore >= beta ? LOWER : bestScore > a0 ? EXACT : UPPER;
    return bestScore;
  }

  quiesce(alpha, beta, ply) {
    const pos = this.pos;
    if (this.time()) return 0;
    if (pos.inCheck() && ply < 40) return this.evasions(alpha, beta, ply);
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 60) return stand;
    const moves = pos.gen([], true);
    this.order(moves, 0, -1);
    const us = pos.turn;
    for (const m of moves) {
      pos.make(m);
      if (pos.attacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
      const s = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stop) return 0;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  // In check at the end of a line: try every escape so checkmates are never mistaken for quiet positions.
  evasions(alpha, beta, ply) {
    const pos = this.pos, us = pos.turn, moves = pos.gen([], false);
    this.order(moves, 0, -1);
    let legal = 0, best = -INF;
    for (const m of moves) {
      pos.make(m);
      if (pos.attacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
      legal++;
      const s = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stop) return 0;
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) return alpha;
    }
    return legal ? best : -MATE + ply;
  }

  hasPieces(c) {
    const b = this.pos.b;
    for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if (p && colorOf(p) === c && typeOf(p) !== P && typeOf(p) !== K) return true; }
    return false;
  }

  order(moves, ttm, ply) {
    const b = this.pos.b, k1 = ply >= 0 ? this.killers[ply * 2] : 0, k2 = ply >= 0 ? this.killers[ply * 2 + 1] : 0;
    const key = new Map();
    for (const m of moves) {
      let s;
      if (m === ttm) s = 1e9;
      else if (mFlags(m) & F_CAP) { const victim = mFlags(m) & F_EP ? P : typeOf(b[mTo(m)]); s = 1e8 + VAL[victim] * 10 - VAL[typeOf(b[mFrom(m)])] / 10; }
      else if (mFlags(m) & F_PROMO) s = 9e7 + VAL[mPromo(m)];
      else if (m === k1) s = 8e7; else if (m === k2) s = 7e7;
      else s = this.hist[b[mFrom(m)] * 128 + mTo(m)];
      key.set(m, s);
    }
    moves.sort((a, c) => key.get(c) - key.get(a));
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---------------- Puzzle helpers ----------------
// Score every legal move with a fixed-depth search (best first). Scores are from the mover's point of view.
function scoreMoves(pos, depth) {
  const S = new Search(pos, 1e12), out = [];
  for (const m of pos.legal()) { pos.make(m); const s = -S.search(depth - 1, -INF, INF, 1, true); pos.unmake(); out.push({ move: m, score: s }); }
  return out.sort((a, b) => b.score - a.score);
}
// Exact mate solver (no pruning). mateIn: a move that forces mate within n moves, or 0.
// budget = { nodes } caps the work; when exceeded the answer is unknown (returns -1 / null).
function mateIn(pos, n, budget, all) {
  const moves = pos.legal(), checks = [], rest = [];
  for (const m of moves) { pos.make(m); (pos.inCheck() ? checks : rest).push(m); pos.unmake(); }
  const found = [];
  for (const m of checks.concat(rest)) {
    if (budget && --budget.nodes < 0) return all ? null : -1;
    pos.make(m); const r = isMated(pos, n - 1, budget); pos.unmake();
    if (r === null) return all ? null : -1;
    if (r) { if (!all) return m; found.push(m); }
  }
  return all ? found : 0;
}
// Is the side to move mated now, or within n more attacker moves whatever it does? null = budget ran out.
function isMated(pos, n, budget) {
  const moves = pos.legal();
  if (!moves.length) return pos.inCheck();
  if (n <= 0) return false;
  for (const d of moves) {
    if (budget && --budget.nodes < 0) return null;
    pos.make(d); const r = mateIn(pos, n, budget); pos.unmake();
    if (r === -1) return null;
    if (!r) return false;
  }
  return true;
}

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const api = { scoreMoves, mateIn, isMated, newTT, useTT, Position, Engine, LEVELS, START, WHITE, BLACK, P, N, B, R, Q, K, pc, colorOf, typeOf, mFrom, mTo, mPromo, mFlags, F_CAP, F_EP, F_CASTLE, F_PROMO, sqName, sqFrom, evaluate, MATE };
root.Chess = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
