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

// ---------- computer player ----------
// Chance that a pawn can be landed on from d squares behind in one turn. A turn is a run of 4s and 8s ending in a
// 1, 2 or 3, and one pawn can use any subset of those throws, so every subset sum is a square it can land on.
const THROW_P = [[1, 4 / 16], [2, 6 / 16], [3, 4 / 16], [4, 1 / 16], [8, 1 / 16]];
const HIT = (() => {
  const hit = Array(40).fill(0);
  (function grow(seq, p, depth){
    for (const [v, q] of THROW_P){
      const s = seq.concat(v), pr = p * q;
      if (isBonus(v)){ if (depth < 3) grow(s, pr, depth + 1); continue; }
      const sums = new Set([0]);
      for (const x of s) for (const t of [...sums]) sums.add(t + x);
      sums.forEach(d => { if (d > 0 && d < 40) hit[d] += pr; });
    }
  })([], 1, 0);
  return hit;
})();

// Steps from square index `from` to index `to` along a player's route (null if it never gets there this lap).
function distance(gated, from, to){
  for (let d = 1, p = from; d <= 16; d++){
    p++; if (gated && p === 16) p = 0; if (p > HOME) return null;
    if (p === to) return d;
  }
  return null;
}
// Chance that player pl's pawn on square index `at` is hit by the other player next turn.
function danger(S, pl, at){
  if (at === HOME) return 0;
  const [r, c] = cellOf(pl, at);
  if (isSafe(r, c)) return 0;
  if (S.opts.pairs && S.pawns[pl].filter(x => x === at).length >= 2) return 0; // a pair can't be hit by a single pawn
  const o = 1 - pl, target = PATHS[o].findIndex(([rr, cc]) => rr === r && cc === c);
  if (target < 0) return 0;
  const gated = S.opts.killToEnter && !S.killed[o];
  if (gated && target >= 16) return 0; // they can't come inside yet
  let safe = 1;
  for (const p of S.pawns[o]){ const d = p === HOME ? null : distance(gated, p, target); if (d) safe *= 1 - HIT[d]; }
  return 1 - safe;
}
// How good the position is for pl. Progress counts most, then being able to go inside, then not being exposed.
function evaluate(S, pl, w){
  const side = q => {
    const gated = S.opts.killToEnter && !S.killed[q];
    let v = 0;
    for (const p of S.pawns[q]){
      const worth = p === HOME ? 300 : gated ? 10 + p * 7 : 10 + p * 10 + (p >= 16 ? 25 : 0);
      v += worth;
    }
    if (S.opts.killToEnter && S.killed[q]) v += 70;
    return v;
  };
  let score = side(pl) - side(1 - pl);
  if (w.danger){
    for (const p of S.pawns[pl]) score -= w.danger * danger(S, pl, p) * (40 + (p === HOME ? 0 : p * 10));
    for (const p of S.pawns[1 - pl]) score += w.threat * danger(S, 1 - pl, p) * (40 + (p === HOME ? 0 : p * 10));
  }
  score += 45 * S.bonus * (S.turn === pl ? 1 : 0); // banked extra throws from captures
  if (S.winner === pl) score += 1e6; else if (S.winner === 1 - pl) score -= 1e6;
  return score;
}
const clone = S => ({ ...S, pawns: [S.pawns[0].slice(), S.pawns[1].slice()], killed: S.killed.slice(), pool: S.pool.slice(), opts: S.opts });

// Every (pawn, throw) pair worth trying now: stacked pawns and equal throws are the same choice.
function choices(S){
  const out = [], seenV = new Set();
  S.pool.forEach((v, k) => { if (seenV.has(v)) return; seenV.add(v); for (const m of movesFor(S, v)) out.push({ pawn: m.pawn, k, v }); });
  return out;
}
// Best score reachable by spending all remaining throws (pool), searched exhaustively up to `depth` moves.
function plan(S, pl, depth, w){
  if (S.phase !== 'move' || S.turn !== pl || depth === 0 || !S.pool.length) return evaluate(S, pl, w);
  let best = -Infinity;
  for (const c of choices(S)){ const T = clone(S); applyMove(T, c.pawn, c.k); best = Math.max(best, plan(T, pl, depth - 1, w)); }
  return best === -Infinity ? evaluate(S, pl, w) : best;
}

// The other player's possible next turns: every run of 4s/8s (up to two) ending in 1, 2 or 3, with its chance.
const TURNS = (() => {
  const out = [];
  (function grow(seq, p){
    for (const [v, q] of THROW_P){ if (isBonus(v)){ if (seq.length < 1) grow(seq.concat(v), p * q); } else out.push({ pool: seq.concat(v), p: p * q }); }
  })([], 1);
  return out; // 9 turns covering 99% of the chances; longer runs of 4s and 8s are rare enough to skip
})();
// The other player spending their throws one at a time, each on the move that looks best right then (quick, and decent).
function greedyTurn(S, pl){
  const w = { danger: 0, threat: 0 };
  while (S.phase === 'move' && S.turn === pl && S.pool.length){
    let best = null;
    for (const c of choices(S)){ const T = clone(S); applyMove(T, c.pawn, c.k); const s = evaluate(T, pl, w); if (!best || s > best.s) best = { s, T }; }
    if (!best) break;
    S = best.T;
  }
  return S;
}
// Average over the other player's throws of the position after they reply well (they spend their throws to suit themselves).
function afterReply(S, pl, w){
  if (S.phase === 'over' || S.turn === pl) return evaluate(S, pl, w); // game over, or we keep the turn (capture bonus)
  const o = 1 - pl;
  let total = 0, mass = 0;
  for (const t of TURNS){
    const T = clone(S); T.pool = t.pool.slice(); T.phase = 'move';
    total += t.p * evaluate(anyMove(T) ? greedyTurn(T, o) : T, pl, w); mass += t.p;
  }
  return total / mass;
}

const LEVELS = {
  easy:   { random: 0.55, depth: 1, w: { danger: 0, threat: 0 } },     // often just moves something
  medium: { random: 0.12, depth: 1, w: { danger: 0.8, threat: 0.2 } },  // best single move, watches for danger
  hard:   { random: 0, depth: 4, w: { danger: 0.6, threat: 0.15 }, reply: true }, // plans the whole turn, then weighs the other player's likely replies
};
// The computer's next move: { pawn, k } (k = index into S.pool), or null if nothing can move.
function chooseMove(S, level, rand = Math.random){
  const L = LEVELS[level] || LEVELS.medium, pl = S.turn, list = choices(S);
  if (!list.length) return null;
  if (rand() < L.random) return list[(rand() * list.length) | 0];
  if (L.reply){ // search my whole turn, then look one turn ahead at the reply
    const memo = new Map();
    const score = T => {
      if (T.phase !== 'move' || T.turn !== pl || !T.pool.length){
        const key = T.pawns[0].slice().sort().join() + '|' + T.pawns[1].slice().sort().join() + '|' + T.killed.join() + T.turn + T.phase + T.bonus;
        if (!memo.has(key)) memo.set(key, afterReply(T, pl, L.w));
        return memo.get(key);
      }
      let best = -Infinity;
      for (const c of choices(T)){ const U = clone(T); applyMove(U, c.pawn, c.k); best = Math.max(best, score(U)); }
      return best === -Infinity ? afterReply(T, pl, L.w) : best;
    };
    const scored = list.map(c => { const T = clone(S); applyMove(T, c.pawn, c.k); return { c, s: score(T) + rand() * 0.01 }; });
    scored.sort((a, b) => b.s - a.s);
    return scored[0].c;
  }
  const scored = list.map(c => { const T = clone(S); applyMove(T, c.pawn, c.k); return { c, s: plan(T, pl, L.depth - 1, L.w) + rand() * 0.01 }; });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].c;
}

const api = { N, HOME, PAWNS, PATHS, SAFE, isSafe, cellOf, score, isBonus, roll, newGame, route, destination, movesFor, anyMove,
              opponentsAt, applyThrow, applyMove, DEFAULTS, chooseMove, evaluate, danger, LEVELS, HIT };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Chowka = api;
})(typeof self !== 'undefined' ? self : this);
