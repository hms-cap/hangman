// Go problems at play time: sets up a problem, judges the learner's move with go-solver.js, picks the opponent's
// strongest answer, and explains in plain words why a wrong move fails (the refutation and what it achieves).
// Black (the learner) is always the side to move. Used by go-problems-worker.js, the trainer and the tests.
(function (root) {
'use strict';
const G = root.Go || (typeof require !== 'undefined' && require('./go-core.js'));
const S = root.GoSolver || (typeof require !== 'undefined' && require('./go-solver.js'));
const { BLACK, WHITE, EMPTY, other } = G;

function setup(p, moves = []) {
  const N = Math.round(Math.sqrt(p.stones.length)), b = new G.Board(N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ch = p.stones[y * N + x]; if (ch === 'X') b._place(b.pt(x, y), BLACK); else if (ch === 'O') b._place(b.pt(x, y), WHITE); }
  b.turn = BLACK; b.seen = new Set([b.key()]);
  for (const m of moves) b.play(m === 'pass' ? 0 : b.parse(m));
  const o = { attacker: p.attacker === 'B' ? BLACK : WHITE, target: b.parse(p.target), region: p.region ? p.region.map(s => b.parse(s)) : null,
    depth: Math.max(6, (p.depth || 20) - moves.length), nodes: 250000 };
  return { b, o };
}
const gone = (b, o) => b.c[o.target] !== other(o.attacker);
const plural = (n, a, b) => n === 1 ? a : b;

// Is the defender's group dead even if the attacker ignores it for a move? (Defender to move.)
function deadNow(t, o) {
  const def = other(o.attacker), St = { attacker: o.attacker, target: o.target, region: o.region ? new Set(o.region) : null };
  const tries = S.movesFor(t, St, def).filter(p => t.legal(p, def, false)).concat([0]);
  for (const m of tries) {
    const u = t.clone(true);
    if (m) u._play(m, def);
    if (gone(u, o)) continue;
    u.turn = def; u.seen = new Set([u.key()]);
    const r = S.solve(u, Object.assign({}, o, { nodes: 60000 }));
    if (r.aborted || !r.win) return false;
  }
  return true;
}

// Why a wrong move fails: t is the position after the learner's move, R the opponent's refutation
function explain(p, t, o, move, R, ko) {
  const N = t.N, user = BLACK, opp = WHITE, name = q => t.name(q);
  const u = t.clone(true); const before = u.caps[opp]; u.play(R || 0); const took = u.caps[opp] - before;
  const mine = t.c[move] === user && R && t.inAtari(t.chain[move]) && u.c[move] === EMPTY;
  const tLibs = gone(u, o) ? 0 : u.libCount(o.target);
  const userAtt = o.attacker === BLACK;
  if (ko) return userAtt
    ? `That only leads to a ko: White can take back and fight it out. There is a move that wins without a ko.`
    : `That only gives you a ko, so White can still win the fight. There is a move that saves the stones outright.`;
  let s = '';
  if (mine) s = `Your stone at ${name(move)} has only one liberty, and White captures it at ${name(R)}. `;
  if (userAtt) {
    if (p.goal === 'kill') return s + (R ? `White answers at ${name(R)}` : `White doesn't even need to answer`) + ` and can make two eyes, so the group lives.`;
    if (!R) return s + `White doesn't need to answer: the stones aren't caught yet.`;
    if (mine) return s + `The marked stones are free again.`;
    if (took) return s + `White answers at ${name(R)}, capturing ${took} ${plural(took, 'stone', 'stones')}, and the marked stones get away.`;
    return s + (tLibs >= 3 ? `White extends to ${name(R)}: the marked stones now have ${tLibs} liberties and get away.` : `White answers at ${name(R)}, and from there every attack fails: the stones get out.`);
  }
  if (!R) return `White can capture the stones anyway.`;
  if (gone(u, o)) return `White captures them at ${name(R)}.`;
  if (p.goal === 'live') return `White plays ${name(R)}, and your group can no longer make two eyes.`;
  return `White plays ${name(R)}, and the stones are caught: they can't get enough liberties to escape${tLibs === 1 ? ' (they are in atari)' : ''}.`;
}

// Judge the learner's move (a point name) after `moves` (names, alternating from Black).
// Returns { status: 'illegal' | 'wrong' | 'good' | 'solved', reply?, why?, refute?, how? }
function judge(p, moves, mv) {
  const { b, o } = setup(p, moves);
  const m = mv === 'pass' ? 0 : b.parse(mv);
  if (m && (b.c[m] !== EMPTY || !b.legal(m))) return { status: 'illegal' };
  const t = b.clone(true); t.play(m);
  if (o.attacker === BLACK) {
    if (gone(t, o)) return { status: 'solved', how: 'captured' };
    // the first move: the generator's list of answers is complete, so a quick check is enough to accept it
    const listed = moves.length === 0 && p.answers.includes(mv);
    // a move away from the fight doesn't count, even if the stones can't escape anyway
    const St = { attacker: o.attacker, target: o.target, region: o.region ? new Set(o.region) : null };
    if (!listed && !S.movesFor(b, St, BLACK, moves.length).includes(m)) {
      const R = S.bestReply(t, o);
      return { status: 'wrong', refute: R ? t.name(R) : 'pass', far: true, why: o.region
        ? `${m ? 'That move is outside the corner, so it' : 'Passing'} gives White a free move${R ? ` at ${t.name(R)}` : ''} to make the group safe. The fight is inside the corner.`
        : `${m ? 'That move is too far from the marked stones to matter' : 'Passing gives White a free move'}: White ${R ? `plays ${t.name(R)} and ` : ''}gets a chance to strengthen them. Keep up the pressure.` };
    }
    const r = S.solve(t, o);
    if (!listed && (r.aborted || !r.win || r.ko)) {
      const R = S.bestReply(t, o);
      return { status: 'wrong', refute: R ? t.name(R) : 'pass', why: explain(p, t, o, m, R, r.win && r.ko) };
    }
    if (deadNow(t, o)) return { status: 'solved', how: p.goal === 'kill' ? 'dead' : 'caught' };
    const R = S.bestReply(t, o);
    // after White's answer the stones might be dead already
    return { status: 'good', reply: R ? t.name(R) : 'pass' };
  }
  const r = S.solve(t, o);
  if (r.win && !r.aborted) {
    const R = S.bestReply(t, o);
    return { status: 'wrong', refute: R ? t.name(R) : 'pass', why: explain(p, t, o, m, R, false) };
  }
  return { status: 'solved', how: p.goal === 'live' ? 'alive' : 'safe' };
}

// A good move for Black now: the stored solution while the learner is still on it, otherwise the solver's choice
function hint(p, moves) {
  if (moves.every((m, k) => p.line[k] === m) && p.line[moves.length]) return p.line[moves.length];
  const { b, o } = setup(p, moves);
  const m = S.bestReply(b, o);
  return m ? b.name(m) : null;
}
const THEMES = {
  atari: ['Capture', 'The stones had one liberty left. Taking it captures them.'],
  chase: ['Capture', 'Keep the stones in atari, from the right side, until they run out of room.'],
  ladder: ['Ladder', 'A ladder: atari from the side that drives the stones toward the edge. They zigzag across the board and never get a third liberty.'],
  net: ['Net', 'A net: instead of atari, a looser move blocks every way out. An atari would only have pushed the stones into open space.'],
  snapback: ['Snapback', 'A snapback: give up one stone. When White takes it, White\'s own stones are left in atari, and you capture them all back.'],
  throwin: ['Throw-in', 'A throw-in: a stone sacrificed inside takes away a liberty, so White runs out of liberties first.'],
  escape: ['Saving stones', 'Saving stones: find the move that gains liberties fastest, or captures one of the stones around you.'],
  kill: ['Kill', 'Killing: play the key point of the eye space, so White can\'t make two separate eyes.'],
  live: ['Live', 'Living: a group needs two separate eyes. Take the point that gives you room for two.'],
};
const GOALS = {
  capture: 'Capture the marked white stones.',
  save: 'Save the marked black stones.',
  kill: 'Kill the white group in the corner.',
  live: 'Make your group in the corner live.',
};
const api = { setup, judge, hint, explain, deadNow, THEMES, GOALS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoProblem = api;
})(typeof self !== 'undefined' ? self : globalThis);
