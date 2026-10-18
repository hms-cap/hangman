// Chowka Bara rules for two players on the 5×5 board. No DOM here, so tools/test-chowka.js can run it in Node.
//
// Each player has 4 pawns that start on their home square (middle of their own edge). A pawn runs the outer ring
// anticlockwise (16 squares), then the inner ring clockwise (8 squares), then into the centre: 25 squares in all,
// numbered 0 (home) to 24 (centre). Four cowries are thrown: the number lying mouth-up is the move, except none up
// is 8 (bara) and all four up is 4 (chowka). A 4 or an 8 earns another throw, and all the throws of a turn are
// then spent one at a time, each by one pawn. Landing on an opponent outside the safe squares (the four edge
// middles and the centre) sends it home and earns another throw. Until a player has captured once, their pawns
// keep circling the outer ring instead of going inside. The centre must be reached exactly; first to bring all
// four pawns home wins.
(function(root){
'use strict';
const N = 5, HOME = 24, PAWNS = 4;

// Player 0 sits at the bottom. Path in [row, col], row 0 at the top.
const P0 = [[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[4,1], // outer, anticlockwise
            [3,1],[2,1],[1,1],[1,2],[1,3],[2,3],[3,3],[3,2],                                               // inner, clockwise
            [2,2]];                                                                                         // centre
const PATHS = [P0, P0.map(([r, c]) => [N - 1 - r, N - 1 - c])]; // player 1 sits opposite: the same route turned half way round
const SAFE = new Set(['4,2', '0,2', '2,0', '2,4', '2,2']);
const key = (r, c) => r + ',' + c;
const isSafe = (r, c) => SAFE.has(key(r, c));
const cellOf = (pl, i) => PATHS[pl][i];

const DEFAULTS = { killToEnter: true, pairs: true, threeOut: false };

// Cowries: true = mouth up. None up counts 8, all four up counts 4.
const score = shells => { const up = shells.filter(Boolean).length; return up === 0 ? 8 : up; };
const isBonus = v => v === 4 || v === 8;
const roll = (rand = Math.random) => [0, 1, 2, 3].map(() => rand() < 0.5);

function newGame(opts){
  return { pawns: [Array(PAWNS).fill(0), Array(PAWNS).fill(0)], killed: [false, false], turn: 0,
           pool: [], bonus: 0, streak: 0, phase: 'throw', winner: null, opts: Object.assign({}, DEFAULTS, opts || {}),
           log: [] };
}

// The squares a pawn passes through for a move of v (last one is where it lands), or null if it can't move v.
function route(S, pl, i, v){
  const at = S.pawns[pl][i];
  if (at === HOME) return null;
  const gated = S.opts.killToEnter && !S.killed[pl];
  const steps = [];
  for (let k = 1, p = at; k <= v; k++){
    p++;
    if (gated && p === 16) p = 0;  // no capture yet: keep going round the outer ring
    if (p > HOME) return null;     // the centre must be reached exactly
    steps.push(p);
  }
  return steps;
}

// Opponent pawns (indices) standing on square [r, c], centre excluded.
function opponentsAt(S, pl, r, c){
  const o = 1 - pl, out = [];
  S.pawns[o].forEach((p, j) => { if (p !== HOME){ const [rr, cc] = cellOf(o, p); if (rr === r && cc === c) out.push(j); } });
  return out;
}

function destination(S, pl, i, v){
  const steps = route(S, pl, i, v);
  if (!steps) return null;
  const to = steps[steps.length - 1], [r, c] = cellOf(pl, to);
  // A pair (two or more of one player's pawns) on an ordinary square can't be landed on by a single pawn.
  if (S.opts.pairs && !isSafe(r, c) && opponentsAt(S, pl, r, c).length >= 2) return null;
  return to;
}

// Legal moves for throw value v: one entry per square (pawns stacked together make the same move).
function movesFor(S, v){
  const pl = S.turn, seen = new Set(), out = [];
  S.pawns[pl].forEach((p, i) => {
    if (p === HOME || seen.has(p)) return;
    const to = destination(S, pl, i, v);
    if (to != null){ seen.add(p); out.push({ pawn: i, from: p, to }); }
  });
  return out;
}
const anyMove = S => S.pool.some(v => movesFor(S, v).length);

// Throw the cowries. Returns what happened so the page can say it.
function applyThrow(S, shells){
  if (S.phase !== 'throw') return null;
  const v = score(shells);
  S.pool.push(v);
  const res = { v, shells, again: false, lost: false, stuck: false };
  if (isBonus(v)){
    S.streak++;
    if (S.opts.threeOut && S.streak >= 3){ res.lost = true; S.pool = []; S.bonus = 0; endTurn(S); return res; }
    res.again = true; return res;
  }
  S.streak = 0; S.phase = 'move';
  if (!anyMove(S)){ res.stuck = true; S.pool = []; afterMoves(S); }
  return res;
}

// Move pawn i by the throw at pool index k.
function applyMove(S, i, k){
  if (S.phase !== 'move') return null;
  const pl = S.turn, v = S.pool[k];
  const steps = v == null ? null : route(S, pl, i, v), to = destination(S, pl, i, v);
  if (to == null) return null;
  S.pawns[pl][i] = to;
  S.pool.splice(k, 1);
  const [r, c] = cellOf(pl, to), res = { pawn: i, v, steps, to, captured: [], finished: to === HOME, won: false, forfeited: [] };
  if (!isSafe(r, c)){
    const hit = opponentsAt(S, pl, r, c);
    if (hit.length){ hit.forEach(j => S.pawns[1 - pl][j] = 0); res.captured = hit; S.killed[pl] = true; S.bonus++; }
  }
  if (S.pawns[pl].every(p => p === HOME)){ S.winner = pl; S.phase = 'over'; res.won = true; return res; }
  if (S.pool.length && !anyMove(S)){ res.forfeited = S.pool.slice(); S.pool = []; }
  if (!S.pool.length) afterMoves(S);
  return res;
}

function afterMoves(S){
  if (S.bonus > 0){ S.bonus--; S.phase = 'throw'; S.streak = 0; return; } // a capture earns another throw
  endTurn(S);
}
function endTurn(S){ S.turn = 1 - S.turn; S.phase = 'throw'; S.pool = []; S.streak = 0; S.bonus = 0; }

const api = { N, HOME, PAWNS, PATHS, SAFE, isSafe, cellOf, score, isBonus, roll, newGame, route, destination, movesFor, anyMove,
              opponentsAt, applyThrow, applyMove, DEFAULTS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Chowka = api;
})(typeof self !== 'undefined' ? self : this);
