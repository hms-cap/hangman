// Exact solvers for the three teaching endgames: King + Queen vs King, King + Rook vs King, King + Pawn vs King.
// Built at run time by retrograde analysis (well under a second), so the trainer can hint perfectly, defend as stubbornly
// as possible, and say the moment a move throws a win away. White always has the extra piece.
// Squares here are 0–63 (a1 = 0, h1 = 7, a8 = 56). Values: 0 = draw, n > 0 = White wins; for K+Q/K+R n - 1 is the number of
// plies to mate, for K+P n - 1 is the number of plies until the pawn promotes into a won K+Q (or K+R) ending.
(function (root) {
'use strict';
const R = s => s >> 3, F = s => s & 7;
const DIST = (a, b) => Math.max(Math.abs(R(a) - R(b)), Math.abs(F(a) - F(b)));
const KMOVES = [...Array(64)].map((_, s) => { const o = []; for (let dr = -1; dr <= 1; dr++) for (let df = -1; df <= 1; df++) { if (!dr && !df) continue; const r = R(s) + dr, f = F(s) + df; if (r >= 0 && r < 8 && f >= 0 && f < 8) o.push(r * 8 + f); } return o; });
const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]], BISH_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
// Squares a slider on s reaches, stopping at (and excluding) blocked squares
function slide(s, dirs, b1, b2, out) {
  out.length = 0;
  for (const [dr, df] of dirs) { let r = R(s) + dr, f = F(s) + df; while (r >= 0 && r < 8 && f >= 0 && f < 8) { const t = r * 8 + f; if (t === b1 || t === b2) break; out.push(t); r += dr; f += df; } }
  return out;
}
const DIRS = { Q: ROOK_D.concat(BISH_D), R: ROOK_D };
// Does a slider on x attack t, with `skip` treated as empty (the black king moving off the line) and `block` as a blocker?
function sliderHits(x, t, dirs, block, skip) {
  const dr = Math.sign(R(t) - R(x)), df = Math.sign(F(t) - F(x));
  if (x === t) return false;
  if (!dirs.some(d => d[0] === dr && d[1] === df)) return false;
  if (dr && df && Math.abs(R(t) - R(x)) !== Math.abs(F(t) - F(x))) return false;
  let r = R(x) + dr, f = F(x) + df;
  while (r * 8 + f !== t) { const q = r * 8 + f; if (q === block && q !== skip) return false; r += dr; f += df; }
  return true;
}
const IDX = (side, wk, bk, x) => ((side * 64 + wk) * 64 + bk) * 64 + x; // side 0 = White to move, 1 = Black to move

function legalSetup(side, wk, bk, x) {
  if (wk === bk || wk === x || bk === x || DIST(wk, bk) < 2) return false;
  return true;
}

// ---------- the solver ----------
// One routine for all three endings. Forward pass: mark impossible positions, draws (Black takes the piece, stalemate)
// and the starting wins (mates, or a pawn promoting into a won K+Q / K+R). Then a backward pass ("un-moves") spreads
// results outward one ply at a time, so every position is settled exactly once.
function solve(kind, kq, kr) {
  const pawn = kind === 'P', dirs = DIRS[kind] || [], N = 2 * 64 * 64 * 64;
  const v = new Uint8Array(N), dead = new Uint8Array(N), left = new Uint8Array(N); // left: Black's unresolved moves
  const buf = [], buf2 = [];
  const pawnHits = (p, t) => R(t) === R(p) + 1 && Math.abs(F(t) - F(p)) === 1;
  const hits = (x, t, wk, skip) => pawn ? pawnHits(x, t) : sliderHits(x, t, dirs, wk, skip);
  const okX = x => !pawn || (R(x) >= 1 && R(x) <= 6);
  const promoWin = (wk, bk, t) => kq.v[IDX(1, wk, bk, t)] > 0 || kr.v[IDX(1, wk, bk, t)] > 0;
  let cur = [], next = [];
  const win = (i, val) => { v[i] = val; next.push(i); };

  for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (let x = 0; x < 64; x++) {
    const w = IDX(0, wk, bk, x), b = w + 262144;
    if (!okX(x) || !legalSetup(0, wk, bk, x)) { dead[w] = dead[b] = 1; continue; }
    const check = hits(x, bk, wk, -1);
    if (check) dead[w] = 1;
    // Black's moves
    let n = 0, takes = false;
    for (const t of KMOVES[bk]) {
      if (DIST(t, wk) < 2) continue;
      if (t === x) { takes = true; break; }
      if (hits(x, t, wk, bk)) continue;
      n++;
    }
    if (takes) dead[b] = 1;
    else if (!n) { if (check && !pawn) win(b, 1); else dead[b] = 1; }
    else left[b] = n;
    // a pawn that promotes into a won ending
    if (pawn && !dead[w] && R(x) === 6 && x + 8 !== wk && x + 8 !== bk && promoWin(wk, bk, x + 8)) win(w, 2);
  }
  // Backward pass
  while (next.length) {
    cur = next; next = [];
    for (const i of cur) {
      const val = v[i], x = i & 63, bk = (i >> 6) & 63, wk = (i >> 12) & 63, side = i >> 18;
      if (side === 1) {
        // Black to move, lost: every White move into it from a legal position is a win one ply longer
        for (const t of KMOVES[wk]) {
          if (t === x || DIST(t, bk) < 2) continue;
          const p = IDX(0, t, bk, x); if (!dead[p] && !v[p]) win(p, val + 1);
        }
        if (pawn) {
          const from = [];
          if (R(x) >= 2 && x - 8 !== wk && x - 8 !== bk) from.push(x - 8);
          if (R(x) === 3 && x - 8 !== wk && x - 8 !== bk && x - 16 !== wk && x - 16 !== bk) from.push(x - 16);
          for (const f of from) { const p = IDX(0, wk, bk, f); if (!dead[p] && !v[p]) win(p, val + 1); }
        } else for (const f of slide(x, dirs, wk, bk, buf)) { const p = IDX(0, wk, bk, f); if (!dead[p] && !v[p]) win(p, val + 1); }
      } else {
        // White to move, won: each Black position that could have moved here has one fewer way out
        for (const f of KMOVES[bk]) {
          if (f === x || f === wk || DIST(f, wk) < 2) continue;
          if (hits(x, bk, wk, f)) continue; // Black couldn't have stepped onto an attacked square
          const p = IDX(1, wk, f, x); if (dead[p] || v[p]) continue;
          if (--left[p] === 0) win(p, val + 1);
        }
      }
    }
  }
  return { kind, v, dead };
}
const solveKXK = kind => solve(kind);
const solveKPK = (kq, kr) => solve('P', kq, kr);

const TABLES = {};
// Tables are built on first use: Q and R on their own, P needs both (a promoted pawn lands in one of them).
function tables(kind) {
  if (kind === 'P') { if (!TABLES.P) TABLES.P = solveKPK(tables('Q'), tables('R')); return TABLES.P; }
  if (!TABLES[kind]) TABLES[kind] = solveKXK(kind);
  return TABLES[kind];
}
// Install a table built elsewhere (the trainer builds them in a worker and sends the arrays over)
function install(kind, v, dead) { TABLES[kind] = { kind, v, dead }; }
// Value of a position (see top). side: 0 White to move, 1 Black to move. Returns -1 when the pieces overlap or the kings touch.
function probe(kind, side, wk, bk, x) {
  if (!legalSetup(side, wk, bk, x)) return -1;
  return tables(kind).v[IDX(side, wk, bk, x)];
}

const api = { tables, install, probe, solveKXK, solveKPK, IDX, DIST, KMOVES };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ChessEndgames = api;
})(typeof self !== 'undefined' ? self : globalThis);
