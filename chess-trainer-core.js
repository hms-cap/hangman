// Chess Trainer: drill definitions, generators and answer checking. No DOM here, so it runs in Node for tests.
// Needs chess-core.js (Chess) and chess-endgames.js (ChessEndgames); tactics come from chess-trainer-data.js and
// mates from chess-puzzles.js. Squares are 0x88 (as in chess-core) unless named s64 (0–63, a1 = 0).
(function (root) {
'use strict';
const C = root.Chess || (typeof require !== 'undefined' && require('./chess-core.js'));
const EG = root.ChessEndgames || (typeof require !== 'undefined' && require('./chess-endgames.js'));
const { Position, WHITE, BLACK, colorOf, typeOf, mFrom, mTo, mFlags, F_CAP, F_PROMO, sqName } = C;
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const PTS = [0, 1, 3, 3, 5, 9, 0];                       // the usual piece values, in pawns
const NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const LET = ' PNBRQK';
const to88 = s => ((s >> 3) << 4) | (s & 7), to64 = q => ((q >> 4) << 3) | (q & 7);
const nm64 = s => 'abcdefgh'[s & 7] + ((s >> 3) + 1);
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KNIGHT = [...Array(64)].map((_, s) => KN.map(([dr, df]) => [(s >> 3) + dr, (s & 7) + df]).filter(([r, f]) => r >= 0 && r < 8 && f >= 0 && f < 8).map(([r, f]) => r * 8 + f));
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const plural = (n, w) => `${n < 11 ? words[n] : n} ${w}${n === 1 ? '' : 's'}`;

// ---------- random ----------
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pickOne = (a, r) => a[(r() * a.length) | 0];
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build a position from { s64: 'N' | 'p' ... } (upper case White)
function fenOf(pieces, turn) {
  const rows = [];
  for (let r = 7; r >= 0; r--) { let row = '', e = 0; for (let f = 0; f < 8; f++) { const p = pieces[r * 8 + f]; if (p) { if (e) row += e; e = 0; row += p; } else e++; } if (e) row += e; rows.push(row); }
  return rows.join('/') + ` ${turn === BLACK ? 'b' : 'w'} - - 0 1`;
}
function piecesOf(pos) { const out = {}; for (let s = 0; s < 64; s++) { const p = pos.b[to88(s)]; if (p) out[s] = colorOf(p) ? LET[typeOf(p)].toLowerCase() : LET[typeOf(p)]; } return out; }
// Squares (s64) attacked by `color` in pos (empty or not)
function attackedSet(pos, color) { const out = new Set(); for (let s = 0; s < 64; s++) if (pos.attacked(to88(s), color)) out.add(s); return out; }
// Is a position fine to show: both kings present, side not to move not in check
function sane(pos) { return pos.king[WHITE] >= 0 && pos.king[BLACK] >= 0 && !pos.inCheck(pos.turn ^ 1); }

// ---------- knight geometry ----------
// BFS distances from `from` avoiding `forbidden` (a Set of s64); the target itself may be forbidden-free only
function knightDist(from, forbidden) {
  const d = new Array(64).fill(-1), q = [from]; d[from] = 0;
  while (q.length) { const s = q.shift(); for (const t of KNIGHT[s]) if (d[t] < 0 && !(forbidden && forbidden.has(t))) { d[t] = d[s] + 1; q.push(t); } }
  return d;
}
function knightPath(from, to, forbidden) {
  const d = knightDist(to, forbidden); if (d[from] < 0) return null;
  const path = [from]; let s = from;
  while (s !== to) { s = KNIGHT[s].find(t => d[t] === d[s] - 1 && !(forbidden && forbidden.has(t) && t !== to)); path.push(s); }
  return path;
}
// Fewest knight moves to visit every target (any order), and one best order
function grabPlan(from, targets) {
  const pts = [from, ...targets], D = pts.map(p => knightDist(p));
  let best = Infinity, order = null;
  const perm = (cur, left, cost, seq) => {
    if (cost >= best) return;
    if (!left.length) { best = cost; order = seq.slice(); return; }
    for (let k = 0; k < left.length; k++) { const t = left[k]; seq.push(t); perm(t, left.filter((_, j) => j !== k), cost + D[pts.indexOf(cur)][t], seq); seq.pop(); }
  };
  perm(from, targets, 0, []);
  return { moves: best, order };
}

// ---------- exchanges (static exchange evaluation, with real legal moves so pins and x-rays count) ----------
function capturesOn(pos, sq) { return pos.legal().filter(m => mTo(m) === sq && (mFlags(m) & F_CAP) && !(mFlags(m) & F_PROMO)); }
const cheapest = (pos, ms) => ms.reduce((a, m) => !a || PTS[typeOf(pos.b[mFrom(m)])] + (typeOf(pos.b[mFrom(m)]) === K ? 100 : 0) < PTS[typeOf(pos.b[mFrom(a)])] + (typeOf(pos.b[mFrom(a)]) === K ? 100 : 0) ? m : a, 0);
// Best result (in pawns) for the side to move from continuing the exchange on sq, never below 0 (they can stop)
function seeSquare(pos, sq) {
  const m = cheapest(pos, capturesOn(pos, sq)); if (!m) return 0;
  const gain = PTS[typeOf(pos.b[sq])]; pos.make(m); const v = Math.max(0, gain - seeSquare(pos, sq)); pos.unmake();
  return v;
}
// Net result in pawns of playing capture m and letting both sides continue sensibly
function seeMove(pos, m) { const gain = PTS[typeOf(pos.b[mTo(m)])]; pos.make(m); const v = gain - seeSquare(pos, mTo(m)); pos.unmake(); return v; }
// The exchange as it would go: list of { san, gain } with each side only continuing when it pays
function exchangeLine(pos0, m0) {
  const pos = new Position(pos0.fen()), sq = mTo(m0), line = [];
  const push = m => { line.push({ san: pos.san(m), took: typeOf(pos.b[sq]), by: typeOf(pos.b[mFrom(m)]), side: pos.turn }); pos.make(m); };
  push(m0);
  for (;;) { const m = cheapest(pos, capturesOn(pos, sq)); if (!m) break; const g = PTS[typeOf(pos.b[sq])]; pos.make(m); const worth = g - seeSquare(pos, sq); pos.unmake(); if (worth <= 0) break; push(m); }
  return line;
}

// ---------- rule of the square ----------
// Pawn moves to promote (a pawn on its first rank counts its double step), King distance to the queening square
function squareFacts(pawn, bk, turn) {
  const r = pawn >> 3, f = pawn & 7, n = 7 - Math.max(r, 2), queen = 56 + f;
  const d = Math.max(Math.abs((bk >> 3) - 7), Math.abs((bk & 7) - f));
  const catches = turn === BLACK ? d <= n + 1 : d <= n;
  return { n, d, queen, catches, double: r === 1 };
}

// ---------- endgames: table lookups on a real position ----------
// Returns { kind, side, wk, bk, x } in table squares, or null if not a K+Q / K+R / K+P vs K position with White ahead
function egKey(pos) {
  let wk = -1, bk = -1, x = -1, kind = null, n = 0;
  for (let s = 0; s < 64; s++) { const p = pos.b[to88(s)]; if (!p) continue; n++;
    const t = typeOf(p), c = colorOf(p);
    if (t === K) { if (c) bk = s; else wk = s; } else if (c === WHITE && (t === Q || t === R || t === P)) { x = s; kind = LET[t]; } else return null; }
  if (n === 2) return { kind: 'draw', side: pos.turn, wk, bk, x: -1 };
  if (n !== 3 || !kind) return null;
  return { kind, side: pos.turn, wk, bk, x };
}
// Value after the position (0 = draw, >0 White wins; see chess-endgames.js). A bare-kings position is 0.
function egValue(pos) {
  const k = egKey(pos); if (!k) return null;
  if (k.kind === 'draw') return 0;
  if (!pos.legal().length) return pos.inCheck() ? 1 : 0;
  return EG.probe(k.kind, k.side, k.wk, k.bk, k.x);
}
// Moves for the side to move, each with the value after it, best first for that side (White: fastest win; Black: longest defence / a draw)
function egMoves(pos) {
  const out = [], root = egKey(pos), pawnGame = root && root.kind === 'P';
  for (const m of pos.legal()) {
    pos.make(m); let value = egValue(pos);
    // In a pawn ending the goal is a safe promotion: count it as reached (the K+Q table measures mate, not promotion)
    if (pawnGame && (mFlags(m) & F_PROMO)) value = value > 0 ? 1 : 0;
    out.push({ move: m, value }); pos.unmake();
  }
  const white = pos.turn === WHITE, rank = v => v > 0 ? v : 1000;
  out.sort((a, b) => white ? rank(a.value) - rank(b.value) : (a.value === 0 ? -1 : b.value === 0 ? 1 : b.value - a.value));
  return out;
}

// ---------- beginner lessons: how the pieces move ----------
// A "route" drill: one white piece collects stars (and captures black pieces, which stand still) in as few moves as it can.
// White pawns are obstacles: nothing may land on them and only the knight jumps over them.
const DIRS = { R: [[1, 0], [-1, 0], [0, 1], [0, -1]], B: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
DIRS.Q = DIRS.R.concat(DIRS.B); DIRS.K = DIRS.Q;
// Squares the piece can move to from `from`; blockers: Set of own pawns, targets: Set of black pieces still on the board
function routeMoves(piece, from, blockers, targets) {
  const r0 = from >> 3, f0 = from & 7, out = [], on = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
  if (piece === 'N') return KNIGHT[from].filter(t => !blockers.has(t));
  if (piece === 'P') {
    const one = from + 8;
    if (r0 < 7 && !blockers.has(one) && !targets.has(one)) { out.push(one); const two = from + 16; if (r0 === 1 && !blockers.has(two) && !targets.has(two)) out.push(two); }
    for (const df of [-1, 1]) { const f = f0 + df, t = from + 8 + df; if (r0 < 7 && f >= 0 && f < 8 && targets.has(t)) out.push(t); }
    return out;
  }
  for (const [dr, df] of DIRS[piece]) {
    let r = r0 + dr, f = f0 + df;
    while (on(r, f)) { const t = r * 8 + f; if (blockers.has(t)) break; out.push(t); if (targets.has(t) || piece === 'K') break; r += dr; f += df; }
  }
  return out;
}
// Why a piece can't go to `to` (for a friendly message), or '' if it can
function routeWhy(piece, from, to, blockers, targets) {
  if (routeMoves(piece, from, blockers, targets).includes(to)) return '';
  const dr = (to >> 3) - (from >> 3), df = (to & 7) - (from & 7), name = NAME[LET.indexOf(piece)];
  if (blockers.has(to)) return `You can't land on your own piece.`;
  if (piece === 'N') return 'A knight moves in an L: two squares one way and one to the side.';
  if (piece === 'K') return 'The king moves just one square at a time.';
  if (piece === 'P') return dr < 0 ? 'Pawns never move backwards.' : df ? (dr === 1 && Math.abs(df) === 1 ? 'A pawn only moves diagonally when it captures.' : 'Pawns move straight forward.') : dr === 2 ? 'Only a pawn on its starting row can move two squares.' : targets.has(to) ? 'A pawn can\'t capture straight ahead.' : 'A pawn moves one square forward.';
  const straight = !dr || !df, diag = Math.abs(dr) === Math.abs(df);
  if (piece === 'R' && !straight) return 'A rook moves in straight lines: up, down or sideways.';
  if (piece === 'B' && !diag) return (((from >> 3) + (from & 7)) & 1) !== (((to >> 3) + (to & 7)) & 1) ? 'A bishop stays on its own colour: it can never reach that square.' : 'A bishop moves diagonally.';
  if (piece === 'Q' && !straight && !diag) return 'The queen moves in straight lines or diagonals, not in an L.';
  return `Something is in the way. The ${name} can't jump over pieces.`;
}
// Fewest moves to collect every item (stars and black pieces) from a state, and one shortest path (list of squares)
function routeSolve(it, from, gotMask) {
  const items = it.stars.concat(it.targets), full = (1 << items.length) - 1, blockers = new Set(it.blockers);
  const key = (s, m) => m * 64 + s, prev = new Map(), start = key(from, gotMask);
  prev.set(start, -1); let q = [start], d = 0;
  while (q.length) {
    const next = [];
    for (const k of q) {
      const s = k % 64, m = (k - s) / 64;
      if (m === full) { const path = []; let x = k; while (x !== -1) { path.unshift(x % 64); x = prev.get(x); } return { min: d, path }; }
      const left = new Set(it.targets.filter((t, j) => !(m & (1 << (it.stars.length + j)))));
      for (const t of routeMoves(it.piece, s, blockers, left)) {
        let m2 = m; const j = items.indexOf(t); if (j >= 0) m2 |= 1 << j;
        const k2 = key(t, m2); if (!prev.has(k2)) { prev.set(k2, k); next.push(k2); }
      }
    }
    q = next; d++;
    if (d > 40) break;
  }
  return null;
}
// k is the drill's number in the set (0-based): the first few are gentle, later ones add more stars and obstacles
function genRoute(p, r, k) {
  const late = k >= 2, piece = p.piece || pickOne(['R', 'B', 'Q', 'N', 'K'], r);
  if (piece === 'P') return genPawnRoute(p, r, k);
  for (let tries = 0; tries < 5000; tries++) {
    const used = new Set();
    const free = rankOk => { for (let n = 0; n < 200; n++) { const s = (r() * 64) | 0; if (!used.has(s) && (!rankOk || rankOk(s >> 3))) { used.add(s); return s; } } return -1; };
    const from = piece === 'P' ? free(rk => k < 2 ? rk === 1 : rk >= 1 && rk <= 3) : free();
    const nStars = p.capture ? 0 : (late ? 2 + ((r() * 2) | 0) : 1 + ((r() * 2) | 0)) + (piece === 'P' ? 0 : 0);
    const nTargets = p.capture ? 2 + ((r() * (late ? 3 : 2)) | 0) : piece === 'P' && late ? 1 : 0;
    const nBlock = piece === 'N' && late ? 3 + ((r() * 3) | 0) : late ? (r() * 4) | 0 : 0;
    const stars = [], targets = [], blockers = [];
    const near = piece === 'P' || piece === 'K';
    const okItem = rk => piece === 'P' ? rk > (from >> 3) && rk <= 6 : true;
    for (let j = 0; j < nStars; j++) { const s = free(okItem); if (s >= 0) stars.push(s); }
    for (let j = 0; j < nTargets; j++) { const s = free(rk => okItem(rk) && rk >= 1 && rk <= 6); if (s >= 0) targets.push(s); }
    if (piece === 'N' && late) { // crowd the knight with pawns so it has to jump
      for (const t of [from + 8, from - 8, from + 1, from - 1, from + 9, from - 9, from + 7, from - 7]) if (t >= 0 && t < 64 && Math.abs((t & 7) - (from & 7)) <= 1 && !used.has(t) && blockers.length < nBlock) { used.add(t); blockers.push(t); }
    } else for (let j = 0; j < nBlock; j++) { const s = free(); if (s >= 0) blockers.push(s); }
    if (near && stars.some(s => Math.max(Math.abs((s >> 3) - (from >> 3)), Math.abs((s & 7) - (from & 7))) > 4)) continue;
    const it = { kind: 'route', piece, from, stars, targets, blockers, capture: !!p.capture };
    const sol = routeSolve(it, from, 0); if (!sol) continue;
    const lo = (p.min || [1, 9])[0] + (late ? 1 : 0), hi = (p.min || [1, 9])[1] + (late ? 1 : 0);
    if (sol.min < Math.max(lo, stars.length + targets.length) || sol.min > hi) continue;
    // the pieces and shapes the lesson is about: a straight line for the rook, a diagonal for the bishop, a double step for the pawn
    it.min = sol.min; it.limit = sol.min + (p.slack != null ? p.slack : 2); it.path = sol.path;
    it.targetKinds = targets.map(() => pickOne(p.capture ? ['p', 'n', 'b', 'r', 'q'] : ['p'], r));
    return it;
  }
}

// Pawn drills are built by walking the pawn forward (single steps, a double step from its first row, and diagonal
// captures of black pawns placed on the way), then dropping stars on squares it passes, so every drill can be solved.
function genPawnRoute(p, r, k) {
  const late = k >= 2;
  for (let tries = 0; tries < 5000; tries++) {
    const from = 8 * (k < 2 ? 1 : 1 + ((r() * 3) | 0)) + ((r() * 8) | 0);
    let s = from; const visited = [], targets = [];
    const steps = (late ? 3 : 2) + ((r() * 2) | 0);
    for (let n = 0; n < steps && (s >> 3) < 6; n++) {
      const f = s & 7, wantCap = late && targets.length < 2 && r() < .45;
      const dfs = [-1, 1].filter(d => f + d >= 0 && f + d < 8);
      if (wantCap && dfs.length) { s = s + 8 + pickOne(dfs, r); targets.push(s); }
      else if ((s >> 3) === 1 && (k === 0 && n === 0 || r() < .4)) s += 16;
      else s += 8;
      visited.push(s);
    }
    if (late && !targets.length) continue;
    const plain = visited.filter(x => !targets.includes(x));
    if (!plain.length) continue;
    const stars = [plain[plain.length - 1]];
    for (const x of plain.slice(0, -1)) if (stars.length < (late ? 2 : 1) + 1 && r() < .5) stars.push(x);
    const blockers = [];
    if (late) for (let n = 0; n < 1 + ((r() * 2) | 0); n++) { const b = 8 + ((r() * 48) | 0); if (b !== from && !visited.includes(b) && !blockers.includes(b) && !targets.includes(b)) blockers.push(b); }
    const it = { kind: 'route', piece: 'P', from, stars, targets, blockers, capture: false };
    const sol = routeSolve(it, from, 0); if (!sol) continue;
    if (k === 0 && sol.path[1] - sol.path[0] !== 16) continue; // the first drill shows the double step
    it.min = sol.min; it.limit = sol.min + (p.slack != null ? p.slack : 2); it.path = sol.path;
    it.targetKinds = targets.map(() => 'p');
    return it;
  }
}

// ---------- beginner lessons: check, mate and the special moves ----------
// Black pieces giving check to the white king (s64 list)
function checkers(pos) {
  const k = to64(pos.king[WHITE]), out = [];
  for (let s = 0; s < 64; s++) { const p = pos.b[to88(s)]; if (!p || colorOf(p) !== BLACK || typeOf(p) === K) continue;
    if (attacks(pos, s, k)) out.push(s); }
  return out;
}
// Does the piece on s attack square t (geometry plus empty squares in between)?
function attacks(pos, s, t) {
  const p = pos.b[to88(s)], ty = typeOf(p), c = colorOf(p), dr = (t >> 3) - (s >> 3), df = (t & 7) - (s & 7);
  if (ty === P) return dr === (c === WHITE ? 1 : -1) && Math.abs(df) === 1;
  if (ty === N) return KNIGHT[s].includes(t);
  if (ty === K) return Math.max(Math.abs(dr), Math.abs(df)) === 1;
  const line = !dr || !df, diag = Math.abs(dr) === Math.abs(df);
  if (!(ty === R && line || ty === B && diag || ty === Q && (line || diag)) || (!dr && !df)) return false;
  const sr = Math.sign(dr), sf = Math.sign(df); let r = (s >> 3) + sr, f = (s & 7) + sf;
  while (r * 8 + f !== t) { if (pos.b[to88(r * 8 + f)]) return false; r += sr; f += sf; }
  return true;
}
// How a legal move gets out of check: 'king' (king steps away), 'capture' (takes the checking piece) or 'block'
function escapeWay(pos, m, chk) {
  const from = to64(mFrom(m)), to = to64(mTo(m));
  if (chk.includes(to)) return 'capture';
  return from === to64(pos.king[WHITE]) ? 'king' : 'block';
}
const isCheckMove = (pos, m) => { pos.make(m); const v = pos.inCheck(); pos.unmake(); return v; };
const isMateMove = (pos, m) => { pos.make(m); const v = pos.inCheck() && !pos.legal().length; pos.unmake(); return v; };

function genCheck(p, r, k) {
  const sets = [['R'], ['B'], ['N'], ['Q'], ['P', 'R'], ['N', 'B'], ['R', 'B'], ['Q', 'P']];
  for (let tries = 0; tries < 4000; tries++) {
    const { pos } = randomPosition(r, sets[k % sets.length], bag(r, ['p', 'p', 'n', 'b'], (r() * 3) | 0));
    const ms = pos.legal(), good = ms.filter(m => isCheckMove(pos, m));
    if (!good.length || good.length > 3 || ms.length < good.length + 6) continue;
    if (good.some(m => isMateMove(pos, m))) continue; // keep checkmate for its own lesson
    return { kind: 'goal', goal: 'check', fen: pos.fen(), answers: good.map(m => C.Position.uci(m)) };
  }
}
function genEscape(p, r, k) {
  const want = ['king', 'capture', 'block'][k % 3];
  for (let tries = 0; tries < 20000; tries++) {
    const pieces = {}, used = new Set(), put = (t, ok) => { for (let n = 0; n < 60; n++) { const s = (r() * 64) | 0; if (used.has(s) || (ok && !ok(s >> 3))) continue; used.add(s); pieces[s] = t; return s; } return -1; };
    put('K', rk => rk <= 3); put('k', rk => rk >= 5);
    put(pickOne(want === 'block' ? ['r', 'b', 'q'] : ['r', 'b', 'q', 'n', 'r'], r));
    for (const t of bag(r, ['R', 'B', 'N', 'P', 'Q'], 1 + ((r() * 2) | 0))) put(t, t === 'P' ? rk => rk >= 1 && rk <= 5 : null);
    if (r() < .5) put('p', rk => rk >= 2 && rk <= 6);
    let pos; try { pos = new Position(fenOf(pieces, WHITE)); } catch (e) { continue; }
    if (!sane(pos) || !pos.inCheck(WHITE)) continue;
    const chk = checkers(pos); if (chk.length !== 1) continue;
    const ms = pos.legal(); if (ms.length < 3) continue;
    const ways = {}; for (const m of ms) (ways[escapeWay(pos, m, chk)] ||= []).push(C.Position.uci(m));
    if (!ways[want] || Object.keys(ways).length < 2) continue;
    if (want === 'capture' && ways.capture.every(u => sqFromName(u.slice(0, 2)) === to64(pos.king[WHITE]))) continue; // a piece should do the capturing
    return { kind: 'goal', goal: 'escape', way: want, fen: pos.fen(), checker: chk[0], ways, answers: ways[want] };
  }
}
const sqFromName = n => (n.charCodeAt(1) - 49) * 8 + n.charCodeAt(0) - 97;
function genMate1(p, r, k) {
  const sets = [['R'], ['Q'], ['Q'], ['R', 'R'], ['Q', 'N'], ['R', 'B'], ['Q'], ['R']];
  for (let tries = 0; tries < 30000; tries++) {
    const pieces = {}, used = new Set(), put = (t, s) => { if (s < 0 || s > 63 || used.has(s)) return false; used.add(s); pieces[s] = t; return true; };
    // the black king on its back row or an edge, sometimes behind its own pawns
    const edge = r() < .7, bk = edge ? 56 + ((r() * 8) | 0) : [0, 7][(r() * 2) | 0] * 1 + 8 * (2 + ((r() * 4) | 0));
    put('k', bk);
    if (edge && r() < .7) for (const df of [-1, 0, 1]) { const f = (bk & 7) + df; if (f >= 0 && f < 8 && r() < .8) put('p', 48 + f); }
    const wk = r() < .5 ? (r() * 24) | 0 : bk - 16 + ((r() * 3) | 0) - 1; if (!put('K', wk)) continue;
    for (const t of sets[k % sets.length]) for (let n = 0; n < 40 && !put(t, (r() * 64) | 0); n++);
    let pos; try { pos = new Position(fenOf(pieces, WHITE)); } catch (e) { continue; }
    if (!sane(pos) || pos.inCheck(WHITE) || pos.inCheck(BLACK)) continue;
    const ms = pos.legal(), good = ms.filter(m => isMateMove(pos, m));
    if (!good.length || good.length > 2) continue;
    return { kind: 'goal', goal: 'mate', fen: pos.fen(), answers: good.map(m => C.Position.uci(m)) };
  }
}
function genCastle(p, r, k) {
  // k 0-1: castle on the side asked; 2-3: the side asked; 4-5: only one side is allowed, find which
  const which = k < 4 ? ['k', 'q'][k % 2] : 'any';
  for (let tries = 0; tries < 20000; tries++) {
    const pieces = { 4: 'K', 7: 'R', 0: 'R' }, used = new Set([4, 7, 0]);
    const put = (t, s) => { if (used.has(s)) return; used.add(s); pieces[s] = t; };
    for (const f of [0, 1, 2, 5, 6, 7]) if (r() < .75) put('P', 8 + f);
    put('k', 56 + ((r() * 8) | 0));
    // black pieces that may watch the squares the king crosses (or blockers in the back row)
    const nb = which === 'any' ? 1 + ((r() * 2) | 0) : (r() * 2) | 0;
    for (let n = 0; n < nb; n++) put(pickOne(['b', 'r', 'n', 'q'], r), 16 + ((r() * 40) | 0));
    if (which === 'any' && r() < .4) put(pickOne(['N', 'B'], r), pickOne([1, 2, 3, 5, 6], r));
    let pos; try { pos = new Position(fenOf(pieces, WHITE).replace(' w - -', ' w KQ -')); } catch (e) { continue; }
    if (!sane(pos) || pos.inCheck(WHITE)) continue;
    const cs = pos.legal().filter(m => mFlags(m) & C.F_CASTLE), side = m => to64(mTo(m)) === 6 ? 'k' : 'q';
    const have = new Set(cs.map(side));
    if (which === 'any' ? have.size !== 1 : !have.has(which)) continue;
    const goalSide = which === 'any' ? [...have][0] : which, other = goalSide === 'k' ? 'q' : 'k';
    let why = '';
    if (which === 'any') {
      const between = other === 'k' ? [5, 6] : [1, 2, 3], crossing = other === 'k' ? [5, 6] : [2, 3];
      const blocked = between.find(s => pos.b[to88(s)]);
      if (blocked != null) why = `There's a piece on ${nm64(blocked)}, between the king and the rook.`;
      else { const hit = crossing.find(s => pos.attacked(to88(s), BLACK)); if (hit == null) continue; why = `${nm64(hit)} is attacked by a black piece, and the king may not pass through or land on an attacked square.`; }
    }
    return { kind: 'goal', goal: 'castle', side: goalSide, ask: which, why, fen: pos.fen(), answers: cs.filter(m => side(m) === goalSide).map(m => C.Position.uci(m)) };
  }
}
function genSpecial(p, r, k) {
  const ep = k % 2 === 1;
  for (let tries = 0; tries < 20000; tries++) {
    const pieces = {}, used = new Set(), put = (t, s) => { if (s < 0 || s > 63 || used.has(s)) return false; used.add(s); pieces[s] = t; return true; };
    let fenTail = ' w - -', last = null;
    if (!ep) { // promotion: a white pawn on the 7th row
      const f = (r() * 8) | 0; put('P', 48 + f);
      if (r() < .4) { const g = f + (r() < .5 ? -1 : 1); if (g >= 0 && g < 8) put(pickOne(['r', 'n', 'b'], r), 56 + g); }
      if (r() < .5) put('n', 56 + f); // sometimes the square in front is blocked, so the pawn must capture to promote
    } else { // en passant: Black's pawn has just stepped two squares past White's pawn on the 5th row
      const f = 1 + ((r() * 6) | 0), side = r() < .5 ? -1 : 1;
      put('P', 32 + f + side); put('p', 32 + f);
      if (used.has(48 + f) || used.has(40 + f)) continue;
      fenTail = ` w - ${'abcdefgh'[f]}6`; last = 'abcdefgh'[f] + '7' + 'abcdefgh'[f] + '5';
      if (r() < .5) put('P', 8 + ((r() * 8) | 0));
    }
    if (!put('K', (r() * 24) | 0)) continue;
    let bk; for (let n = 0; n < 60; n++) { bk = 32 + ((r() * 32) | 0); if (!used.has(bk)) break; } if (!put('k', bk)) continue;
    let pos; try { pos = new Position(fenOf(pieces, WHITE).replace(' w - -', fenTail)); } catch (e) { continue; }
    if (!sane(pos) || pos.inCheck(WHITE)) continue;
    const ms = pos.legal(), good = ms.filter(m => ep ? mFlags(m) & C.F_EP : (mFlags(m) & F_PROMO) && C.Position.uci(m).endsWith('q'));
    if (!good.length) continue;
    if (!ep && pos.legal().some(m => (mFlags(m) & F_PROMO) && isMateMove(pos, m))) continue;
    return { kind: 'goal', goal: ep ? 'ep' : 'promote', fen: pos.fen(), last, answers: good.map(m => C.Position.uci(m)) };
  }
}

// ---------- the training map ----------
// kinds: kpath (knight route), grab (knight takes every pawn), loose (spot pieces you can win), count (exchange outcome),
// square (rule of the square), tactic (fork/pin/skewer from the data), mate (mate in n from the puzzle set),
// eg (play an endgame against the exact table)
const TRACKS = [
  { key: 'pieces', name: 'Learn the moves', beginner: true, blurb: 'New to chess? Start here: how each piece moves and captures. The board shows every square your piece can reach.', levels: [
    { name: 'The rook', kind: 'route', count: 6, pass: 5, p: { piece: 'R', min: [1, 4] }, about: 'The rook moves in straight lines, up, down or sideways, as far as it likes. Collect the stars.',
      tip: 'A rook can cross the whole board in one move, but it can\'t jump: anything in its way stops it. From any square it reaches any other in two moves at most.' },
    { name: 'The bishop', kind: 'route', count: 6, pass: 5, p: { piece: 'B', min: [1, 4] }, about: 'The bishop moves diagonally, as far as it likes. It always stays on squares of its own colour.',
      tip: 'Each side has a light-squared and a dark-squared bishop. A bishop can only ever reach half the board.' },
    { name: 'The queen', kind: 'route', count: 6, pass: 5, p: { piece: 'Q', min: [1, 3] }, about: 'The queen moves like a rook and a bishop together: straight or diagonal, any distance. The strongest piece.',
      tip: 'The queen is worth about nine pawns. Keep her safe: early in the game, don\'t bring her out where smaller pieces can chase her.' },
    { name: 'The king', kind: 'route', count: 6, pass: 5, p: { piece: 'K', min: [2, 5] }, about: 'The king moves one square in any direction. Slow, but the most important piece: lose it and you lose the game.',
      tip: 'Moving diagonally is as quick as moving straight, so the king reaches a square as many moves away as its longest distance across or up.' },
    { name: 'The knight', kind: 'route', count: 6, pass: 5, p: { piece: 'N', min: [1, 4] }, about: 'The knight moves in an L: two squares one way, then one to the side. It is the only piece that jumps over others.',
      tip: 'A knight always lands on the other colour. Squares two steps away diagonally take it two moves; the square right next to it takes three.' },
    { name: 'The pawn', kind: 'route', count: 6, pass: 5, p: { piece: 'P', min: [1, 4], slack: 1 }, about: 'Pawns move one square forward, or two from their starting row. They capture one square diagonally forward, and never move back.',
      tip: 'A pawn that reaches the far end becomes a queen (or any other piece): that is called promotion. You will practise it later.' },
    { name: 'Capture them all', kind: 'route', count: 6, pass: 5, p: { capture: true, min: [2, 6] }, about: 'Capture by moving onto a black piece: it is removed from the board. Black\'s pieces stand still here. Take every one.',
      tip: 'Plan the order before you move. Taking the nearest piece first is not always the fastest way round.' },
  ] },
  { key: 'rules', name: 'Check, mate & special moves', beginner: true, blurb: 'The rules that decide the game: attacking the king, checkmate, castling, promotion and en passant.', levels: [
    { name: 'Give check', kind: 'check', count: 8, pass: 6, p: {}, about: 'Attacking the enemy king is called check. Find a move that gives check.',
      tip: 'Look at every one of your pieces and ask: which square would let it attack the king? Don\'t forget pawns and knights.' },
    { name: 'Out of check', kind: 'escape', count: 9, pass: 7, p: {}, about: 'When your king is in check you must deal with it straight away. There are three ways: move the king, capture the piece giving check, or block the line.',
      tip: 'A knight\'s check can\'t be blocked, and neither can a check from right next to the king. Every move the board offers is one that ends the check.' },
    { name: 'Checkmate in one', kind: 'mate1', count: 8, pass: 6, p: {}, about: 'Checkmate is a check the king can\'t escape: it can\'t move away, and nothing can capture or block. That wins the game.',
      tip: 'Kings stuck on the edge behind their own pawns are in danger: a rook or queen on that back row is often mate. Check that every escape square is covered.' },
    { name: 'Castling', kind: 'castle', count: 6, pass: 5, p: {}, about: 'Castling tucks your king away and brings a rook into play in one move. Tap the king, then the square two steps toward the rook.',
      tip: 'You may castle only if the king and that rook have not moved, nothing stands between them, the king is not in check, and it does not pass through or land on an attacked square.' },
    { name: 'Promotion & en passant', kind: 'special', count: 6, pass: 5, p: {}, about: 'A pawn reaching the far row becomes a queen. And when a pawn steps two squares past an enemy pawn, that pawn may capture it as if it had moved one: en passant.',
      tip: 'En passant is only allowed straight away, on the very next move. In promotion you may choose any piece, but a queen is almost always best.' },
  ] },
  { key: 'openings', name: 'Openings', blurb: 'The main openings for both colours: play the moves from memory, learn why each move is played, punish the classic traps.', levels: [
    { name: 'Name the opening', kind: 'oname', count: 10, pass: 8, clock: 20, p: { deep: false }, about: 'A few moves in. Which opening is it?',
      tip: 'Look at the first moves: 1.e4 e5 leads to the open games (Italian, Ruy Lopez, Scotch), 1.e4 with anything else is a defence (Sicilian, French, Caro-Kann), 1.d4 d5 c4 is a Queen\'s Gambit, 1.d4 Nf6 is an Indian defence.' },
    { name: '1.e4 as White', kind: 'oline', count: 6, pass: 4, p: { lvl: 'e4w' }, about: 'Play White\'s moves in the Italian, Ruy Lopez, Scotch and gambits, and against the Sicilian, French and Caro-Kann. Each move comes with its idea.',
      tip: 'Every move has a job: claim the centre, develop a piece with a threat, castle, put a rook on an open file. Use Hint to see the idea of the next move without being told the move.' },
    { name: 'Facing 1.e4 as Black', kind: 'oline', count: 6, pass: 4, p: { lvl: 'e4b' }, about: 'Play Black in the Sicilian, French, Caro-Kann, Scandinavian, Pirc, Alekhine, Petrov, Two Knights and Marshall.',
      tip: 'Black\'s first question is how to fight for the centre: directly with ...e5, from the side with ...c5, or with a solid ...e6/...c6 and ...d5.' },
    { name: '1.d4 and flank openings', kind: 'oline', count: 6, pass: 4, p: { lvl: 'd4w' }, about: 'Play White in the Queen\'s Gambit, London, Catalan, English and Réti.',
      tip: 'Queen\'s pawn openings are about the c-pawn: c4 attacks d5 from the side, and the bishops often find long diagonals.' },
    { name: 'Facing 1.d4 as Black', kind: 'oline', count: 6, pass: 4, p: { lvl: 'd4b' }, about: 'Play Black in the Slav, Queen\'s Gambit Declined, King\'s Indian, Nimzo-Indian, Grünfeld, Queen\'s Indian and Dutch.',
      tip: 'Against 1.d4, ...d5 holds the centre with pawns; ...Nf6 and a fianchetto fight for it with pieces and hit back later.' },
    { name: 'Opening traps', kind: 'trap', count: 8, pass: 6, clock: 60, p: {}, about: 'Your opponent has just made a famous mistake. Find the move that punishes it: Legal\'s mate, the Elephant trap, the Lasker trap and more.',
      tip: 'The trap usually works because something is overloaded or pinned, or the king is short of squares. Look for checks first.' },
    { name: 'Name the variation', kind: 'oname', count: 10, pass: 8, clock: 25, p: { deep: true }, about: 'Deeper into the opening: which variation is it?',
      tip: 'Variations are named after their key moves: ...a6 in the Najdorf, ...g6 in the Dragon, ...Bb4 in the Winawer, d5 by Black in the Grünfeld.' },
  ] },
  { key: 'vision', name: 'Knight & board vision', blurb: 'See where pieces go and what they guard, without moving them.', levels: [
    { name: 'Knight hops', kind: 'kpath', count: 10, pass: 8, clock: 20, p: { min: 2, max: 3 }, about: 'Take the knight to the flag in the fewest moves.' },
    { name: 'Long routes', kind: 'kpath', count: 10, pass: 8, clock: 25, p: { min: 4, max: 6 }, about: 'Longer trips, including corner to corner. Count the moves before you start.' },
    { name: 'Guarded squares', kind: 'kpath', count: 10, pass: 8, clock: 30, p: { min: 3, max: 5, guards: true }, about: 'Reach the flag without ever landing on a square an enemy piece or pawn attacks, or on a piece.' },
    { name: 'Pawn grab', kind: 'grab', count: 8, pass: 6, clock: 45, p: { pawns: [3, 4] }, about: 'Capture every pawn with the knight in the fewest moves. The order matters.' },
    { name: 'Loose pieces', kind: 'loose', count: 8, pass: 6, clock: 40, p: { busy: false }, about: 'Tap every black piece White can win: take it and still come out ahead after the recaptures.' },
    { name: 'Loose pieces: busy board', kind: 'loose', count: 8, pass: 6, clock: 60, p: { busy: true }, about: 'The same with more pieces, pins and defenders to check.' },
  ] },
  { key: 'tactics', name: 'Forks, pins & skewers', blurb: 'Win material with double attacks and lines.', levels: [
    { name: 'Knight forks', kind: 'tactic', count: 8, pass: 6, clock: 60, p: { set: 'knightFork' }, about: 'A knight attacks two things at once. Find the move that wins material.' },
    { name: 'Forks by any piece', kind: 'tactic', count: 8, pass: 6, clock: 60, p: { set: 'fork' }, about: 'Pawns, bishops, rooks, queens and kings can fork too.' },
    { name: 'Pins', kind: 'tactic', count: 8, pass: 6, clock: 75, p: { set: 'pin' }, about: 'Pin a piece to its king (or to something bigger), then win it.' },
    { name: 'Skewers', kind: 'tactic', count: 8, pass: 6, clock: 75, p: { set: 'skewer' }, about: 'Attack a big piece so that when it moves, the one behind it falls.' },
    { name: 'Mixed: busy positions', kind: 'tactic', count: 8, pass: 6, clock: 90, p: { set: 'mixed' }, about: 'Forks, pins and skewers in full positions. Nobody tells you which.' },
    { name: 'Two-move combinations', kind: 'tactic', count: 8, pass: 5, clock: 150, p: { set: 'combo' }, about: 'A decoy sacrifice, a check that drives the king, or a capture that removes a defender sets up the fork, pin or skewer. Calculate both moves before you play.' },
  ] },
  { key: 'endgames', name: 'Endgame technique', blurb: 'The endings every player must know, against perfect defence.', levels: [
    { name: 'Rule of the square', kind: 'square', count: 10, pass: 8, clock: 15, p: {}, about: 'Can the king catch the pawn? Answer without counting moves one by one.' },
    { name: 'Mate with a queen', kind: 'eg', count: 4, pass: 3, p: { piece: 'Q', dtm: [12, 19], slack: 5 }, about: 'King and queen against king. Box the king in, avoid stalemate, mate within the move limit.' },
    { name: 'Mate with a rook', kind: 'eg', count: 4, pass: 3, p: { piece: 'R', dtm: [20, 31], slack: 8 }, about: 'King and rook against king. Use your king and the rook together to push the king to the edge.' },
    { name: 'Pawn ending: opposition', kind: 'eg', count: 5, pass: 4, p: { piece: 'P', win: true, ranks: [4, 5], tricky: 1 }, about: 'King and pawn against king. Win by promoting safely. One careless move and it is a draw.' },
    { name: 'Pawn ending: key squares', kind: 'eg', count: 5, pass: 4, p: { piece: 'P', win: true, ranks: [1, 3], tricky: 2 }, about: 'The pawn is further back. Get your king in front of it and use the opposition.' },
    { name: 'Pawn ending: hold the draw', kind: 'eg', count: 5, pass: 4, p: { piece: 'P', win: false, ranks: [2, 5], moves: 12 }, about: 'You have the lone king. Keep the opposition and hold the draw for 12 moves.' },
  ] },
  { key: 'mates', name: 'Checkmates & counting', blurb: 'Calculate forcing lines and count exchanges.', levels: [
    { name: 'Mate in 1', kind: 'mate', count: 8, pass: 6, clock: 30, p: { n: 1 }, about: 'Find the checkmate.' },
    { name: 'Count the exchange', kind: 'count', count: 10, pass: 8, clock: 30, p: { busy: false }, about: 'White captures. After all the sensible recaptures, who is ahead?' },
    { name: 'Mate in 2', kind: 'mate', count: 8, pass: 6, clock: 90, p: { n: 2, part: 0 }, about: 'Two moves. Look at checks first, then captures, then quiet moves.' },
    { name: 'Counting with batteries', kind: 'count', count: 10, pass: 8, clock: 40, p: { busy: true }, about: 'Pieces lined up behind each other join in. Pinned pieces don\'t.' },
    { name: 'Mate in 2: harder', kind: 'mate', count: 8, pass: 6, clock: 120, p: { n: 2, part: 1 }, about: 'Quieter first moves and more defences to see.' },
    { name: 'Mate in 3', kind: 'mate', count: 6, pass: 4, clock: 180, p: { n: 3 }, about: 'Three-move mates. Calculate the defences before you move.' },
  ] },
];

// ---------- generators ----------
const DATA = () => root.CHESS_TRAINER_DATA || (typeof require !== 'undefined' ? (() => { try { const fs = require('fs'), vm = require('vm'), c = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + '/chess-trainer-data.js', 'utf8'), c); return c.window.CHESS_TRAINER_DATA; } catch (e) { return null; } })() : null);
const PUZZLES = () => root.CHESS_PUZZLES || (typeof require !== 'undefined' ? (() => { const fs = require('fs'), vm = require('vm'), c = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + '/chess-puzzles.js', 'utf8'), c); return c.window.CHESS_PUZZLES; })() : []);

function genKpath(p, r) {
  for (let tries = 0; tries < 2000; tries++) {
    const from = (r() * 64) | 0, to = (r() * 64) | 0; if (from === to) continue;
    const pieces = {}; let forbidden = null, guards = [];
    if (p.guards) {
      // a few black pawns and one or two pieces; the knight may not land on them or on anything they attack
      const n = 3 + ((r() * 3) | 0), kinds = ['p', 'p', 'p', 'b', 'r', 'n', 'p', 'b'];
      for (let k = 0; k < n; k++) { const s = (r() * 64) | 0; if (s === from || s === to || pieces[s]) continue; const t = pickOne(kinds, r); if (t === 'p' && ((s >> 3) === 0 || (s >> 3) === 7)) continue; pieces[s] = t; }
      pieces[from] = 'N';
      const kPos = [...Array(64).keys()].filter(s => !pieces[s] && s !== to);
      pieces[pickOne(kPos, r)] = 'K'; const k2 = kPos.filter(s => !pieces[s] && Math.abs((s >> 3) - 0) >= 0); pieces[pickOne(k2, r)] = 'k';
      let pos; try { pos = new Position(fenOf(pieces, WHITE)); } catch (e) { continue; }
      if (!sane(pos) || pos.inCheck(WHITE)) continue;
      const att = attackedSet(pos, BLACK);
      if (att.has(from)) continue; // start the knight on a safe square
      forbidden = new Set([...att, ...Object.keys(pieces).map(Number).filter(s => s !== from && pieces[s] !== 'K')]);
      if (forbidden.has(to)) continue;
      guards = [...att];
      const d0 = knightDist(from)[to], d = knightDist(from, forbidden)[to];
      if (d < p.min || d > p.max || d === d0 && r() < 0.6) continue; // usually the guards should change the route
      return { kind: 'kpath', fen: fenOf(pieces, WHITE), from, to, min: d, forbidden: [...forbidden], guards, path: knightPath(from, to, forbidden) };
    }
    const d = knightDist(from)[to];
    if (d < p.min || d > p.max) continue;
    pieces[from] = 'N';
    return { kind: 'kpath', fen: null, pieces, from, to, min: d, forbidden: [], guards: [], path: knightPath(from, to, null) };
  }
}

function genGrab(p, r) {
  for (;;) {
    const n = p.pawns[0] + ((r() * (p.pawns[1] - p.pawns[0] + 1)) | 0), from = (r() * 64) | 0, pawns = new Set();
    while (pawns.size < n) { const s = 8 + ((r() * 48) | 0); if (s !== from) pawns.add(s); }
    const plan = grabPlan(from, [...pawns]);
    if (plan.moves < n + 3 || plan.moves > 3 * n + 2) continue;
    const naive = (() => { let cur = from, left = [...pawns], c = 0; while (left.length) { const d = knightDist(cur); left.sort((a, b) => d[a] - d[b]); c += d[left[0]]; cur = left.shift(); } return c; })();
    if (naive === plan.moves && r() < 0.5) continue; // prefer positions where "nearest first" isn't best
    const pieces = { [from]: 'N' }; pawns.forEach(s => pieces[s] = 'p');
    return { kind: 'grab', pieces, from, pawns: [...pawns], min: plan.moves, order: plan.order, greedy: naive };
  }
}

function randomPosition(r, white, black, opts = {}) {
  for (;;) {
    const pieces = {}, used = new Set();
    const put = (t, rankOk) => { for (let k = 0; k < 60; k++) { const s = (r() * 64) | 0; if (used.has(s) || (rankOk && !rankOk(s >> 3))) continue; used.add(s); pieces[s] = t; return s; } return -1; };
    put('K', rk => rk < 3); put('k', rk => rk > 4);
    for (const t of white) put(t, t === 'P' ? rk => rk >= 1 && rk <= 5 : null);
    for (const t of black) put(t, t === 'p' ? rk => rk >= 2 && rk <= 6 : null);
    let pos; try { pos = new Position(fenOf(pieces, WHITE)); } catch (e) { continue; }
    if (!sane(pos) || pos.inCheck(WHITE)) continue;
    return { pos, pieces };
  }
}
const bag = (r, pool, n) => { const out = []; for (let k = 0; k < n; k++) out.push(pickOne(pool, r)); return out; };

function genLoose(p, r) {
  for (let tries = 0; tries < 4000; tries++) {
    const nw = p.busy ? 5 + ((r() * 3) | 0) : 2 + ((r() * 2) | 0), nb = p.busy ? 6 + ((r() * 4) | 0) : 3 + ((r() * 2) | 0);
    const { pos } = randomPosition(r, bag(r, ['N', 'B', 'R', 'Q', 'P', 'P', 'N', 'B', 'R'], nw), bag(r, ['n', 'b', 'r', 'q', 'p', 'p', 'n', 'b', 'r'], nb));
    const answers = [], why = {};
    const caps = pos.legal().filter(m => (mFlags(m) & F_CAP) && !(mFlags(m) & F_PROMO));
    const targets = [...new Set(caps.map(mTo))];
    for (const t of targets) {
      let best = null, bv = -99;
      for (const m of caps) if (mTo(m) === t) { const v = seeMove(pos, m); if (v > bv) { bv = v; best = m; } }
      if (bv > 0) { answers.push(to64(t)); why[to64(t)] = { san: pos.san(best), gain: bv, line: exchangeLine(pos, best).map(x => x.san) }; }
    }
    const blackPieces = Object.entries(piecesOf(pos)).filter(([, c]) => c !== 'k' && c === c.toLowerCase()).length;
    if (!answers.length || answers.length > 3 || answers.length === blackPieces) continue;
    // some attacked-but-safe pieces as decoys make it a real test
    const decoys = targets.filter(t => !answers.includes(to64(t))).length;
    if (decoys < (p.busy ? 2 : 1)) continue;
    return { kind: 'loose', fen: pos.fen(), answers, why };
  }
}

// Counting: a target square with attackers and defenders on lines into it
const LINES = { N: KN.map(([a, b]) => [[a, b]]), R: [[[1, 0]], [[-1, 0]], [[0, 1]], [[0, -1]]], B: [[[1, 1]], [[1, -1]], [[-1, 1]], [[-1, -1]]] };
function genCount(p, r, want) {
  for (let tries = 0; tries < 5000; tries++) {
    const t = 8 * (2 + ((r() * 4) | 0)) + 1 + ((r() * 6) | 0), pieces = {};
    pieces[t] = pickOne(['p', 'n', 'b', 'r', 'n', 'b', 'p', 'q'], r);
    const place = (white, n) => {
      for (let k = 0; k < n; k++) {
        const kind = pickOne(['N', 'B', 'R', 'B', 'R', 'Q', 'P', 'N'], r);
        if (kind === 'P') { const f = (t & 7) + (r() < .5 ? -1 : 1), rk = (t >> 3) + (white ? -1 : 1); const s = rk * 8 + f; if (f >= 0 && f < 8 && !pieces[s]) pieces[s] = white ? 'P' : 'p'; continue; }
        if (kind === 'N') { const [[dr, df]] = pickOne(LINES.N, r), rk = (t >> 3) + dr, f = (t & 7) + df; const s = rk * 8 + f; if (rk >= 0 && rk < 8 && f >= 0 && f < 8 && !pieces[s]) pieces[s] = white ? 'N' : 'n'; continue; }
        const dirs = kind === 'R' ? LINES.R : kind === 'B' ? LINES.B : LINES.R.concat(LINES.B), [[dr, df]] = pickOne(dirs, r);
        // walk out along the line; in "battery" mode stack behind a piece already there
        let rk = t >> 3, f = t & 7, steps = 0;
        for (;;) { rk += dr; f += df; if (rk < 0 || rk > 7 || f < 0 || f > 7) break; steps++; const s = rk * 8 + f;
          if (pieces[s]) { if (!p.busy) break; continue; }
          if (r() < 0.45 || steps > 3) { pieces[s] = white ? kind : kind.toLowerCase(); break; } }
      }
    };
    place(true, p.busy ? 3 + ((r() * 2) | 0) : 1 + ((r() * 2) | 0));
    place(false, p.busy ? 2 + ((r() * 3) | 0) : 1 + ((r() * 2) | 0));
    const free = [...Array(64).keys()].filter(s => !pieces[s]);
    const wk = pickOne(free.filter(s => s >> 3 <= 1), r), bk = pickOne(free.filter(s => s >> 3 >= 6 && Math.abs((s & 7) - (wk & 7)) + 0 >= 0), r);
    if (wk == null || bk == null) continue;
    pieces[wk] = 'K'; pieces[bk] = 'k';
    let pos; try { pos = new Position(fenOf(pieces, WHITE)); } catch (e) { continue; }
    if (!sane(pos) || pos.inCheck(WHITE)) continue;
    const caps = capturesOn(pos, to88(t)); if (!caps.length) continue;
    const defenders = (() => { pos.makeNull(); const n = pos.legal().filter(m => mTo(m) === to88(t)).length; pos.unmakeNull(); return n; })();
    void defenders;
    const m = pickOne(caps, r), v = seeMove(pos, m), line = exchangeLine(pos, m);
    if (line.length < 2) continue; // there should be at least one recapture to count
    if (p.busy && line.length < 4) continue;
    const answer = v > 0 ? 'win' : v < 0 ? 'lose' : 'even';
    if (want && answer !== want) continue;
    return { kind: 'count', fen: pos.fen(), move: C.Position.uci(m), san: pos.san(m), target: t, answer, net: v, line: line.map(x => ({ san: x.san, took: x.took, side: x.side })) };
  }
}

function genSquare(p, r, wantCatch) {
  for (;;) {
    const pf = (r() * 8) | 0, pr = 1 + ((r() * 5) | 0), pawn = pr * 8 + pf;
    const bk = (r() * 64) | 0; if (bk === pawn || (bk >> 3) <= pr - 1 && r() < .8) continue;
    // White's king far from the action so the race decides it
    const wkCands = [...Array(64).keys()].filter(s => s !== pawn && s !== bk && EG.DIST(s, bk) > 1 && EG.DIST(s, pawn) >= 4 && EG.DIST(s, 56 + pf) >= 5 && (s >> 3) <= 2);
    if (!wkCands.length) continue;
    const wk = pickOne(wkCands, r), turn = r() < .5 ? WHITE : BLACK;
    const f = squareFacts(pawn, bk, turn);
    if (Math.abs(f.d - f.n) > 2) continue; // close races only
    const v = EG.probe('P', turn, wk, bk, pawn); if (v < 0) continue;
    const pos = new Position(fenOf({ [wk]: 'K', [bk]: 'k', [pawn]: 'P' }, turn));
    if (!sane(pos)) continue;
    const truth = v === 0;
    if (truth !== f.catches) continue; // keep the cases the rule explains
    if (wantCatch != null && truth !== wantCatch) continue;
    return { kind: 'square', fen: pos.fen(), pawn, bk, wk, turn, catches: truth, n: f.n, d: f.d, double: f.double };
  }
}

function genEg(p, r) {
  for (let tries = 0; tries < 20000; tries++) {
    const wk = (r() * 64) | 0, bk = (r() * 64) | 0, x = p.piece === 'P' ? (8 * (p.ranks[0] + ((r() * (p.ranks[1] - p.ranks[0] + 1)) | 0))) + ((r() * 8) | 0) : (r() * 64) | 0;
    if (new Set([wk, bk, x]).size < 3 || EG.DIST(wk, bk) < 2) continue;
    const side = p.piece === 'P' && !p.win ? BLACK : WHITE;
    const pos = new Position(fenOf({ [wk]: 'K', [bk]: 'k', [x]: p.piece }, side));
    if (!sane(pos) || !pos.legal().length) continue;
    const v = egValue(pos); if (v == null || v < 0) continue;
    if (p.piece !== 'P') {
      if (v - 1 < p.dtm[0] || v - 1 > p.dtm[1] || EG.DIST(bk, 27) > 2 && EG.DIST(bk, 36) > 2) continue; // Black's king near the centre
      const movesNeeded = Math.ceil((v - 1) / 2);
      return { kind: 'eg', piece: p.piece, fen: pos.fen(), limit: movesNeeded + p.slack, best: movesNeeded };
    }
    if (p.win) {
      if (!v) continue;
      // there should be a natural-looking way to go wrong
      const ms = egMoves(pos), bad = ms.filter(m => !m.value).length;
      if (bad < p.tricky) continue;
      if (Math.abs((wk >> 3) - (x >> 3)) > 2 || Math.abs((wk & 7) - (x & 7)) > 2) continue; // White's king near its pawn
      if (EG.DIST(bk, x + 8) > 3) continue; // and Black's king in the fight
      return { kind: 'eg', piece: 'P', win: true, fen: pos.fen(), limit: Math.ceil((v - 1) / 2) + 10 };
    }
    // hold the draw: Black to move, drawn, but some moves lose
    if (v) continue;
    const ms = egMoves(pos), losing = ms.filter(m => m.value > 0).length;
    if (losing < 2 || losing === ms.length) continue;
    if (EG.DIST(wk, x) > 2 || EG.DIST(bk, x + 8) > 2) continue;
    return { kind: 'eg', piece: 'P', win: false, fen: pos.fen(), moves: p.moves };
  }
}

// Mates come from the puzzle set (verified with an exact solver); `part` splits mate-in-2 into easier and harder halves by rating
// ---------- openings ----------
const OPENINGS = () => root.CHESS_OPENINGS || (typeof require !== 'undefined' ? (() => { const fs = require('fs'), vm = require('vm'), c = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + '/chess-openings.js', 'utf8'), c); return c.window.CHESS_OPENINGS; })() : null);
const stripSan = s => s.replace(/[+#!?]/g, '');
// Play a list of moves in standard notation from a position: [{ uci, san }] (throws on an illegal move)
function playSans(fen, sans) {
  const pos = new Position(fen || C.START), out = [];
  for (const s of sans) {
    const m = pos.legal().find(x => stripSan(pos.san(x)) === stripSan(s));
    if (!m) throw new Error(`Illegal move ${s} after ${out.map(x => x.san).join(' ')}`);
    out.push({ uci: Position.uci(m), san: pos.san(m) }); pos.make(m);
  }
  return { list: out, fen: pos.fen() };
}
const moveText = sans => sans.map((s, i) => (i % 2 ? '' : (i / 2 + 1) + '.') + s).join(' ');
let OCACHE = null;
function openingData() {
  if (OCACHE) return OCACHE;
  const O = OPENINGS(); if (!O) return null;
  const lines = O.lines.map((L, k) => { const sans = L.moves.split(' '), pl = playSans(null, sans);
    return Object.assign({}, L, { id: k, full: L.fam + ': ' + L.name, sans: pl.list.map(x => x.san), ucis: pl.list.map(x => x.uci) }); });
  const traps = O.traps.map(t => { const set = playSans(null, t.moves.split(' ')), win = playSans(set.fen, t.win.split(' '));
    return Object.assign({}, t, { fen: set.fen, before: set.list.map(x => x.san), last: set.list[set.list.length - 1].uci, line: win.list.map(x => x.uci), sansWin: win.list.map(x => x.san) }); });
  return (OCACHE = { families: O.families, lines, traps });
}
// Name the opening: the position after the moves that define the family (or, deep, the whole line) and four names to pick from
function openingNameItems(p, r) {
  const D = openingData(), out = [], seenPos = new Set();
  const cands = [];
  for (const L of D.lines) {
    const n = p.deep ? L.sans.length : L.famPly, sans = L.sans.slice(0, n), key = sans.join(' ');
    if (seenPos.has(key)) continue; seenPos.add(key);
    const answer = p.deep ? L.full : L.fam;
    // a position that also belongs to a different answer can't be asked
    if (D.lines.some(M => (p.deep ? M.full : M.fam) !== answer && M.sans.slice(0, n).join(' ') === key)) continue;
    cands.push({ L, sans, answer });
  }
  for (const c of shuffle(cands, r)) {
    const all = [...new Set(D.lines.map(M => p.deep ? M.full : M.fam))].filter(x => x !== c.answer);
    // the closest names first: same family (for variations), or the same first move
    const near = all.filter(x => p.deep ? x.startsWith(c.L.fam + ':') : D.lines.some(M => M.fam === x && M.sans[0] === c.sans[0]));
    const far = all.filter(x => !near.includes(x));
    const pickN = (arr, n) => shuffle(arr.slice(), r).slice(0, n);
    const dis = pickN(near, 2); dis.push(...pickN(far.filter(x => !dis.includes(x)), 3 - dis.length));
    const fen = playSans(null, c.sans).fen, last = playSans(null, c.sans).list.pop();
    out.push({ kind: 'oname', deep: !!p.deep, fen, last: last.uci, moves: moveText(c.sans), answer: c.answer, options: shuffle([c.answer].concat(dis), r), fam: c.L.fam, about: D.families[c.L.fam], line: c.L });
  }
  return out;
}

function mateItems(p) {
  const all = PUZZLES().filter(x => x[3].split(',')[0] === 'mateIn' + p.n).sort((a, b) => a[2] - b[2]);
  const half = Math.floor(all.length / 2);
  const list = p.part === 0 ? all.slice(0, half) : p.part === 1 ? all.slice(half) : all;
  return list.map(x => ({ kind: 'mate', n: p.n, fen: x[0], line: x[1].split(' '), last: x[4] || '', rating: x[2] }));
}
function tacticItems(p) {
  const d = DATA(); if (!d) return [];
  return (d[p.set] || []).map(x => ({ kind: 'tactic', set: p.set, fen: x[0], line: x[1].split(' '), alts: x[2] ? x[2].split('|').map(s => s ? s.split(' ') : []) : [], theme: x[3], text: x[4], gain: x[5],
    how: x[6] || (p.set !== 'combo' ? null : /forces Kx/.test(x[4]) ? 'decoy' : 'drive') }));
}

// A fresh set of drills for a level. `seen` (optional): keys of fixed items played recently, to avoid repeats.
function makeSet(trackKey, levelIdx, seed, seen) {
  const L = TRACKS.find(t => t.key === trackKey).levels[levelIdx], r = rng(seed), out = [];
  if (L.kind === 'oline') {
    const pool = openingData().lines.filter(x => x.lvl === L.p.lvl).map(x => Object.assign({ kind: 'oline' }, x));
    return shuffle(pool, r).slice(0, L.count);
  }
  if (L.kind === 'oname') return openingNameItems(L.p, r).slice(0, L.count);
  if (L.kind === 'trap') return shuffle(openingData().traps.map(t => Object.assign({ kind: 'trap', set: 'trap' }, t)), r).slice(0, L.count);
  if (L.kind === 'mate' || L.kind === 'tactic') {
    const pool = L.kind === 'mate' ? mateItems(L.p) : tacticItems(L.p);
    const fresh = pool.filter(x => !(seen && seen.has(x.fen)));
    const use = shuffle((fresh.length >= L.count ? fresh : pool).slice(), r);
    if (L.kind === 'tactic' && L.p.set === 'combo') {
      // rotate through the kinds (set-up and motif) so one try sees decoys, drives and removed defenders, forks, pins and skewers
      const groups = {}; for (const x of use) (groups[x.how + '/' + x.theme] ||= []).push(x);
      const keys = shuffle(Object.keys(groups), r), out = [];
      while (out.length < L.count && keys.some(k => groups[k].length)) for (const k of keys) if (groups[k].length && out.length < L.count) out.push(groups[k].shift());
      return out;
    }
    return use.slice(0, L.count);
  }
  for (let k = 0; k < L.count; k++) {
    if (L.kind === 'route') out.push(genRoute(L.p, r, k));
    else if (L.kind === 'check') out.push(genCheck(L.p, r, k));
    else if (L.kind === 'escape') out.push(genEscape(L.p, r, k));
    else if (L.kind === 'mate1') out.push(genMate1(L.p, r, k));
    else if (L.kind === 'castle') out.push(genCastle(L.p, r, k));
    else if (L.kind === 'special') out.push(genSpecial(L.p, r, k));
    else if (L.kind === 'kpath') out.push(genKpath(L.p, r));
    else if (L.kind === 'grab') out.push(genGrab(L.p, r));
    else if (L.kind === 'loose') out.push(genLoose(L.p, r));
    else if (L.kind === 'count') out.push(genCount(L.p, r, ['win', 'even', 'lose', null][k % 4]));
    else if (L.kind === 'square') out.push(genSquare(L.p, r, k % 2 === 0));
    else if (L.kind === 'eg') out.push(genEg(L.p, r));
  }
  return L.kind === 'count' || L.kind === 'square' || L.kind === 'escape' ? shuffle(out, r) : out;
}

// Stars for a finished set: 1 = passed, 2 = at most one miss, 3 = perfect
function stars(L, score) { return score < L.pass ? 0 : score === L.count ? 3 : score >= L.count - 1 ? 2 : 1; }

const api = { openingData, playSans, moveText, TRACKS, makeSet, stars, rng, fenOf, piecesOf, attackedSet, knightDist, knightPath, grabPlan, seeMove, seeSquare, exchangeLine, capturesOn,
  squareFacts, egKey, egValue, egMoves, routeMoves, routeWhy, routeSolve, genRoute, genPawnRoute, checkers, attacks, escapeWay, isCheckMove, isMateMove,
  genCheck, genEscape, genMate1, genCastle, genSpecial, to88, to64, nm64, KNIGHT, PTS, NAME, plural, genCount, genSquare, genEg, genLoose, genKpath, genGrab };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ChessTrainer = api;
})(typeof self !== 'undefined' ? self : globalThis);
