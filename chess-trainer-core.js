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

// ---------- the training map ----------
// kinds: kpath (knight route), grab (knight takes every pawn), loose (spot pieces you can win), count (exchange outcome),
// square (rule of the square), tactic (fork/pin/skewer from the data), mate (mate in n from the puzzle set),
// eg (play an endgame against the exact table)
const TRACKS = [
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
    if (L.kind === 'kpath') out.push(genKpath(L.p, r));
    else if (L.kind === 'grab') out.push(genGrab(L.p, r));
    else if (L.kind === 'loose') out.push(genLoose(L.p, r));
    else if (L.kind === 'count') out.push(genCount(L.p, r, ['win', 'even', 'lose', null][k % 4]));
    else if (L.kind === 'square') out.push(genSquare(L.p, r, k % 2 === 0));
    else if (L.kind === 'eg') out.push(genEg(L.p, r));
  }
  return L.kind === 'count' || L.kind === 'square' ? shuffle(out, r) : out;
}

// Stars for a finished set: 1 = passed, 2 = at most one miss, 3 = perfect
function stars(L, score) { return score < L.pass ? 0 : score === L.count ? 3 : score >= L.count - 1 ? 2 : 1; }

const api = { TRACKS, makeSet, stars, rng, fenOf, piecesOf, attackedSet, knightDist, knightPath, grabPlan, seeMove, seeSquare, exchangeLine, capturesOn,
  squareFacts, egKey, egValue, egMoves, to88, to64, nm64, KNIGHT, PTS, NAME, plural, genCount, genSquare, genEg, genLoose, genKpath, genGrab };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ChessTrainer = api;
})(typeof self !== 'undefined' ? self : globalThis);
