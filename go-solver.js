// Go problem solver: can the attacker capture a target group, whoever moves first?
// Two kinds of search:
//   - region: every empty point of a closed area may be played (life and death in an enclosure; the defender may pass)
//   - tactical: only moves near the target (its liberties, their neighbours, captures of the stones around it), the way
//     ladders, nets and snapbacks are read; works across the whole board
// A line may not repeat a position (so ko fights end), and the search records whether a ko capture was needed.
// Used by the problem generator, the problem and trainer pages, and the tests.
(function (root) {
'use strict';
const G = root.Go || (typeof require !== 'undefined' && require('./go-core.js'));
const { BLACK, WHITE, EMPTY, other } = G;

// opts: { attacker, target (a stone of the target chain), region (array of points) | null, depth, nodes }
// Returns { win: bool, ko: bool, nodes } for the side to move in b. "win" means the attacker succeeds.
function solve(b0, opts) {
  const S = { attacker: opts.attacker, target: opts.target, region: opts.region ? new Set(opts.region) : null, budget: opts.nodes || 400000, used: 0, ko: false, tt: new Map(), aborted: false };
  const b = b0.clone();
  const path = new Set([b.key()]);
  const win = search(b, S, opts.depth || 20, path);
  return { win, ko: S.ko, nodes: S.used, aborted: S.aborted };
}
const captured = (b, S) => b.c[S.target] !== (other(S.attacker));
function movesFor(b, S, side, ply = 0) {
  const out = [], seen = new Set();
  const add = p => { if (p > 0 && !seen.has(p) && b.c[p] === EMPTY && (!S.region || S.region.has(p))) { seen.add(p); out.push(p); } };
  const def = other(S.attacker), t = S.target;
  const libs = b.libs(t);
  if (S.region) {
    // region search: the target's liberties first, then the rest of the area
    libs.forEach(add);
    for (const p of S.region) add(p);
  } else {
    if (side === S.attacker) {
      libs.forEach(add);
      // second-order liberties (nets, and the first move of a ladder from the other side) only near the start
      if (libs.length === 2 && ply <= 2) for (const l of libs) for (const d of b.DIRS) add(l + d);
      // capture defender stones next to attacker stones in atari (counter-captures are the defender's resource; the
      // attacker answers them by taking back)
      for (const s of b.stones(t)) for (const d of b.DIRS) { const q = s + d; if (b.c[q] === S.attacker && b.inAtari(b.chain[q])) { const lib = b.atariLib(b.chain[q]); add(lib); } }
    } else {
      libs.forEach(add);
      // capture an attacking stone that is in atari next to the target, or one of its neighbours
      for (const s of b.stones(t)) for (const d of b.DIRS) { const q = s + d; if (b.c[q] === S.attacker && b.inAtari(b.chain[q])) add(b.atariLib(b.chain[q])); }
    }
  }
  // order: for the attacker, moves that take liberties and leave the target shortest of them first
  return out;
}
function search(b, S, depth, path, ply = 0) {
  if (captured(b, S)) return true;
  if (depth <= 0 || S.aborted) return false;
  // tactical reading: a target with three liberties on the attacker's turn has escaped
  if (!S.region && b.turn === S.attacker && b.libCount(S.target) >= 3) return false;
  if (++S.used > S.budget) { S.aborted = true; return false; }
  const hit = S.tt.get(b.key());
  if (hit !== undefined) { if (hit.win != null && hit.win <= depth) return true; if (hit.lose != null && hit.lose >= depth) return false; }
  const side = b.turn, att = side === S.attacker;
  let moves = movesFor(b, S, side, ply).filter(p => b.legal(p, side, false));
  if (att) {
    // fewer target liberties after the move = more forcing; try those first
    const score = p => { const t = b.clone(); t._play(p, side); if (t.c[S.target] !== other(S.attacker)) return -100; const l = t.libCount(S.target); return l * 10 - (t.inAtari(t.chain[p]) ? 0 : 1); };
    moves = moves.map(p => [p, score(p)]).sort((a, c) => a[1] - c[1]).map(x => x[0]);
  } else {
    const score = p => { const t = b.clone(); t._play(p, side); return -t.libCount(S.target) * 10 - (t.caps[side] - b.caps[side]); };
    moves = moves.map(p => [p, score(p)]).sort((a, c) => a[1] - c[1]).map(x => x[0]);
  }
  let result;
  if (att) {
    result = false;
    for (const p of moves) {
      const t = b.clone(); const n = t._play(p, side); t.turn = other(side); t.lastMove = p;
      const k = t.key(); if (path.has(k)) continue;
      if (n === 1 && t.ko) S.koSeen = true;
      path.add(k); const r = search(t, S, depth - 1, path, ply + 1); path.delete(k);
      if (r) { result = true; if (n === 1 && t.ko) S.ko = true; break; }
      if (S.aborted) return false;
    }
  } else {
    result = true;
    // the defender may also pass (in a closed area that is often the best defence)
    const pass = b.clone(); pass.turn = other(side); pass.lastMove = 0; pass.ko = 0;
    const options = moves.map(p => ['m', p]).concat([['pass']]);
    for (const [kind, p] of options) {
      let t;
      if (kind === 'pass') t = pass;
      else { t = b.clone(); const n = t._play(p, side); t.turn = other(side); t.lastMove = p; if (n === 1 && t.ko) S.koSeen = true; }
      const k = t.key(); if (kind !== 'pass' && path.has(k)) continue;
      path.add(k); const r = search(t, S, depth - 1, path, ply + 1); path.delete(k);
      if (!r) { result = false; break; }
      if (S.aborted) return false;
    }
  }
  const e = S.tt.get(b.key()) || {};
  if (result) e.win = e.win == null ? depth : Math.min(e.win, depth); else e.lose = e.lose == null ? depth : Math.max(e.lose, depth);
  S.tt.set(b.key(), e);
  return result;
}

// All first moves for the side to move that achieve its goal (attacker: capture; defender: avoid capture)
function goodMoves(b, opts) {
  const side = b.turn, att = side === opts.attacker, S = { attacker: opts.attacker, target: opts.target, region: opts.region ? new Set(opts.region) : null };
  const cands = movesFor(b, S, side).filter(p => b.legal(p, side, false));
  const out = [];
  for (const p of cands) {
    const t = b.clone(true); t.play(p);
    if (att && t.c[opts.target] !== other(opts.attacker)) { out.push(p); continue; }
    const r = solve(t, opts);
    if (r.aborted) return null;
    if (att ? r.win : !r.win) out.push(p);
  }
  // passing can be the right defence too, but a problem always asks for a move, so it isn't listed
  return out;
}
// The best reply for the side to move: the attacker picks a capturing move (fastest); the defender the longest resistance
function bestReply(b, opts) {
  const side = b.turn, att = side === opts.attacker, S = { attacker: opts.attacker, target: opts.target, region: opts.region ? new Set(opts.region) : null };
  const cands = movesFor(b, S, side).filter(p => b.legal(p, side, false));
  let best = 0, bestD = att ? 1e9 : -1;
  for (const p of cands) {
    const t = b.clone(true); t.play(p);
    if (t.c[opts.target] !== other(opts.attacker)) { if (att) return p; continue; }
    // the shortest depth at which the attacker still wins measures how long the defence lasts
    let d = 0;
    for (let k = 1; k <= (opts.depth || 20); k += 2) { const r = solve(t, Object.assign({}, opts, { depth: k })); if (r.win) { d = k; break; } }
    if (att ? (d && d < bestD) : (d === 0 ? true : d > bestD)) { if (!att && d === 0) return p; best = p; bestD = d; }
  }
  return best;
}

const api = { solve, goodMoves, bestReply, movesFor };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoSolver = api;
})(typeof self !== 'undefined' ? self : globalThis);
