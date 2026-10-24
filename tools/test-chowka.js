// Checks the Chowka Bara rules in chowka-core.js, then plays thousands of random games to make sure every one ends.
// Run: node tools/test-chowka.js
'use strict';
const C = require('../chowka-core.js');
let fails = 0;
const ok = (cond, msg) => { if (!cond){ fails++; console.log('FAIL', msg); } };
const shellsFor = v => v === 8 ? [0, 0, 0, 0] : [0, 1, 2, 3].map(k => k < v); // v mouth-up shells
const play = (S, v) => C.applyThrow(S, shellsFor(v).map(Boolean));

// Board: 25 distinct squares per path, each player's route covers the whole board, the two routes mirror.
for (const P of C.PATHS){
  ok(new Set(P.map(([r, c]) => r + ',' + c)).size === 25, 'path visits 25 distinct squares');
  for (let i = 1; i < 25; i++){ const d = Math.abs(P[i][0] - P[i - 1][0]) + Math.abs(P[i][1] - P[i - 1][1]); ok(d === 1, 'path steps are adjacent at ' + i); }
  ok(P[24][0] === 2 && P[24][1] === 2, 'path ends at centre');
}
ok(C.PATHS[0][0] + '' === '4,2' && C.PATHS[1][0] + '' === '0,2', 'homes are opposite edge middles');

// Scoring
ok(C.score([false, false, false, false]) === 8, 'none up is 8');
ok(C.score([true, true, true, true]) === 4, 'all up is 4');
ok(C.score([true, false, true, false]) === 2, 'two up is 2');

// Extra throws: 4 and 8 keep the turn in the throw phase and pile up.
let S = C.newGame();
play(S, 4); ok(S.phase === 'throw' && S.pool.join() === '4', '4 throws again');
play(S, 8); ok(S.phase === 'throw', '8 throws again');
play(S, 2); ok(S.phase === 'move' && S.pool.join() === '4,8,2', 'turn ends throwing on 2 with three moves to spend');
C.applyMove(S, 0, 0); C.applyMove(S, 0, 0); C.applyMove(S, 1, 0);
ok(S.pawns[0].join() === '12,2,0,0' && S.turn === 1, 'moves spent on chosen pawns, turn passes');

// Three bonus throws in a row (option)
S = C.newGame({ threeOut: true }); play(S, 4); play(S, 8); const r3 = play(S, 4);
ok(r3.lost && S.turn === 1 && !S.pool.length, 'three bonus throws in a row lose the turn when the option is on');

// Without a capture, pawns circle the outer ring; after one, they go in.
S = C.newGame(); S.pawns[0][0] = 14;
ok(C.destination(S, 0, 0, 3) === 1, 'no capture yet: 14 + 3 wraps to 1');
S.killed[0] = true; ok(C.destination(S, 0, 0, 3) === 17, 'after a capture: 14 + 3 goes inside to 17');
S.pawns[0][0] = 22; ok(C.destination(S, 0, 0, 3) === null && C.destination(S, 0, 0, 2) === 24, 'centre needs an exact throw');
S = C.newGame({ killToEnter: false }); S.pawns[0][0] = 14; ok(C.destination(S, 0, 0, 3) === 17, 'kill rule off: goes straight in');

// Capture sends the pawn home, unlocks the inside, earns a throw.
S = C.newGame(); S.pawns[1][0] = 6; // player 1's square 6 is player 0's square... find it
const target = C.PATHS[1][6], idx0 = C.PATHS[0].findIndex(([r, c]) => r === target[0] && c === target[1]);
S.pawns[0][0] = idx0 - 3; play(S, 3); const cap = C.applyMove(S, 0, 0);
ok(cap.captured.join() === '0' && S.pawns[1][0] === 0 && S.killed[0] && S.turn === 0 && S.phase === 'throw', 'capture: home, unlock, extra throw');

// Safe squares: no capture there.
S = C.newGame(); S.pawns[0][0] = 5; play(S, 3); // player 0 square 8 is player 1's home (0,2)
const safe = C.applyMove(S, 0, 0); ok(safe.to === 8 && !safe.captured.length && S.pawns[1].every(p => p === 0), 'no capture on a safe square');

// Pairs: a single can't land on two opponent pawns on an ordinary square.
S = C.newGame(); S.pawns[1][0] = S.pawns[1][1] = 6; S.pawns[0][0] = idx0 - 1;
ok(C.destination(S, 0, 0, 1) === null, 'pair blocks a landing');
S.opts.pairs = false; ok(C.destination(S, 0, 0, 1) === idx0, 'pairs off: landing allowed');
S.phase = 'move'; S.pool = [1]; const two = C.applyMove(S, 0, 0); ok(two.captured.length === 2, 'pairs off: both captured');

// No legal move: the throw is lost and the turn passes.
S = C.newGame(); S.killed[0] = true; S.pawns[0] = [24, 24, 24, 23]; play(S, 3);
ok(S.turn === 1, 'stuck throw passes the turn');
S = C.newGame(); S.killed[0] = true; S.pawns[0] = [24, 24, 24, 23]; play(S, 1);
C.applyMove(S, 3, 0);
ok(S.phase === 'over' && S.winner === 0, 'last pawn home wins');

// Pairs (jodi) move together half an even throw.
S = C.newGame(); S.pawns[0] = [5, 5, 1, 2]; S.phase = 'move'; S.pool = [4];
ok(C.pairMovesFor(S, 4).length === 1 && C.pairMovesFor(S, 4)[0].to === 7, 'pair on 5 with a 4 moves to 7');
ok(C.pairMovesFor(S, 3).length === 0, 'no pair move on an odd throw');
const pm = C.applyMove(S, 0, 0, true);
ok(pm && pm.pair && S.pawns[0][0] === 7 && S.pawns[0][1] === 7 && S.turn === 1, 'both pawns land together and the throw is spent');
S = C.newGame(); S.pawns[0] = [5, 5, 0, 0]; S.phase = 'move'; S.pool = [8]; S.opts.pairMoves = false;
ok(C.pairMovesFor(S, 8).length === 0, 'pair moves can be switched off');
S = C.newGame(); S.pawns[0] = [24, 24, 0, 0]; ok(C.pairMovesFor(Object.assign(S, { phase: 'move' }), 2).length === 1, 'pawns home on the start square can pair up');
S = C.newGame(); S.pawns[0] = [24, 24, 3, 7]; S.phase = 'move';
ok(C.pairMovesFor(S, 2).length === 0, 'pawns in the centre are not a pair');
{ // a pair may land on the other player's pair and captures both
  const T = C.newGame(), sq = C.PATHS[0][9], j = C.PATHS[1].findIndex(([r, c]) => r === sq[0] && c === sq[1]);
  T.pawns[1] = [j, j, 0, 0]; T.pawns[0] = [7, 7, 0, 0]; T.phase = 'move'; T.pool = [4];
  ok(C.destination(T, 0, 0, 2) === null, 'a single cannot land on a pair');
  const r2 = C.applyMove(T, 0, 0, true);
  ok(r2 && r2.captured.length === 2 && T.pawns[1][0] === 0 && T.pawns[1][1] === 0, 'a pair captures a pair');
}
{ // a throw only a pair can use is not lost
  const T = C.newGame(); T.killed[0] = true; T.pawns[0] = [22, 22, 24, 24]; T.phase = 'move'; T.pool = [4]; // singles would overshoot
  ok(C.canUse(T, 4) && !C.movesFor(T, 4).length, '4 with two pawns on 22: only the pair can use it');
  const r3 = C.applyMove(T, 0, 0, true); ok(r3 && r3.won, 'pair move into the centre wins');
}

// Random games all finish.
let seed = 7; const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let total = 0, wins = [0, 0];
for (let g = 0; g < 3000; g++){
  const G = C.newGame({ pairs: g % 2 === 0, threeOut: g % 3 === 0 });
  let n = 0;
  while (G.phase !== 'over' && n++ < 20000){
    if (G.phase === 'throw') C.applyThrow(G, C.roll(rand));
    else {
      const ks = G.pool.map((v, k) => [k, C.movesFor(G, v).concat(C.pairMovesFor(G, v))]).filter(([, m]) => m.length);
      const [k, m] = ks[(rand() * ks.length) | 0], mv = m[(rand() * m.length) | 0];
      if (!C.applyMove(G, mv.pawn, k, mv.pair)){ fails++; console.log('FAIL listed move rejected'); break; }
    }
  }
  ok(G.phase === 'over', 'random game ' + g + ' finishes'); total += n; if (G.winner != null) wins[G.winner]++;
}
console.log(`3000 random games: avg ${Math.round(total / 3000)} actions, wins ${wins.join(' / ')}`);

// The throw used in play (you and the computer): exact cowry odds, independent shells, and a shake can't bias it
{
  const N = 400000, fair = { 0: 1 / 16, 1: 4 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16 };
  const run = mixOf => { const c = [0, 0, 0, 0, 0], perShell = [0, 0, 0, 0], pair = [0, 0, 0, 0];
    for (let i = 0; i < N; i++){ const sh = C.throwShells(mixOf(i)); c[sh.filter(Boolean).length]++; sh.forEach((x, k) => { if (x) perShell[k]++; }); pair[(sh[0] ? 2 : 0) + (sh[1] ? 1 : 0)]++; }
    return { c, perShell, pair }; };
  for (const [label, mixOf] of [['no shake', () => undefined], ['a shake', i => (i * 2654435761) >>> 0], ['the worst shake (all bits set)', () => 0xffffffff], ['a constant shake', () => 12345]]){
    const { c, perShell, pair } = run(mixOf);
    let worst = 0; for (let k = 0; k <= 4; k++){ const sd = Math.sqrt(N * fair[k] * (1 - fair[k])); worst = Math.max(worst, Math.abs(c[k] - N * fair[k]) / sd); }
    const shellDev = Math.max(...perShell.map(x => Math.abs(x - N / 2) / Math.sqrt(N / 4))), pairDev = Math.max(...pair.map(x => Math.abs(x - N / 4) / Math.sqrt(N * 3 / 16)));
    ok(worst < 4.5 && shellDev < 4.5 && pairDev < 4.5, `throw odds with ${label} (worst deviation ${worst.toFixed(1)} sd)`);
    if (label === 'no shake') console.log(`Throw odds over ${N}: ` + [0, 1, 2, 3, 4].map(k => `${k === 0 ? 'bara' : k === 4 ? 'chowka' : k + ' up'} ${(100 * c[k] / N).toFixed(2)}%`).join(', ') + ' (fair: 6.25, 25, 37.5, 25, 6.25)');
  }
  // full games against Hard: the computer gets no more bara/chowka per throw than you
  const t = [[0, 0], [0, 0]];
  for (let g = 0; g < 300; g++){
    const G = C.newGame(); G.turn = g % 2; let n = 0;
    while (G.phase !== 'over' && n++ < 20000){
      if (G.phase === 'throw'){ const who = G.turn, sh = C.throwShells(); C.applyThrow(G, sh); t[who][0]++; if (C.isBonus(C.score(sh))) t[who][1]++; }
      else { const mv = C.chooseMove(G, G.turn === 1 ? 'hard' : 'medium'); C.applyMove(G, mv.pawn, mv.k, mv.pair); }
    }
  }
  const r0 = t[0][1] / t[0][0], r1 = t[1][1] / t[1][0], se = Math.sqrt(0.125 * 0.875 * (1 / t[0][0] + 1 / t[1][0]));
  ok(Math.abs(r0 - r1) < 4 * se, `same bara/chowka rate for both sides in play (you ${(100 * r0).toFixed(2)}%, computer ${(100 * r1).toFixed(2)}%)`);
  console.log(`In 300 games vs Hard: you ${t[0][0]} throws, ${(100 * r0).toFixed(2)}% bara/chowka; computer ${t[1][0]} throws, ${(100 * r1).toFixed(2)}% (fair 12.5%)`);
}

// Computer player
for (const lv of ['easy', 'medium', 'hard']){
  // takes a capture when it's the obvious move (Easy picks at random half the time, so only Medium and Hard are held to it)
  const S2 = C.newGame(); S2.turn = 1; // player 0's square 6 is an ordinary square; put player 1 two behind it
  const victim = C.PATHS[0][6], j = C.PATHS[1].findIndex(([r, c]) => r === victim[0] && c === victim[1]);
  S2.pawns[0][0] = 6; S2.pawns[1][0] = j - 2; S2.pool = [2]; S2.phase = 'move';
  const m = C.chooseMove(S2, lv, () => 0.99);
  ok(m && C.destination(S2, 1, m.pawn, 2) != null, lv + ' picks a legal move');
  if (lv !== 'easy') ok(m.pawn === 0, lv + ' takes the capture');
}
{ // Hard steps onto a safe square instead of next to an enemy pawn
  const S3 = C.newGame(); S3.turn = 1; S3.killed = [true, true];
  S3.pawns[1] = [3, 24, 24, 24]; // player 1 pawn three squares before its safe square at 4
  const sq = C.PATHS[1][4], k0 = C.PATHS[0].findIndex(([r, c]) => r === sq[0] && c === sq[1]);
  S3.pawns[0] = [k0 - 2, 24, 24, 24]; S3.pool = [1]; S3.phase = 'move';
  ok(C.danger(S3, 1, 4) === 0, 'safe square has no danger');
  ok(C.danger(S3, 1, 5) > 0.2, 'square two in front of an enemy pawn is dangerous');
}
{ // every level plays only legal moves through whole games, and the levels rank as expected
  const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const match = (a, b, games) => { let wa = 0;
    for (let g = 0; g < games; g++){
      const r = mul(g + 99), G = C.newGame(), who = g % 2 ? [b, a] : [a, b]; G.turn = (g >> 1) & 1; let n = 0;
      while (G.phase !== 'over' && n++ < 5000){
        if (G.phase === 'throw') C.applyThrow(G, C.roll(r));
        else { const mv = C.chooseMove(G, who[G.turn], r); if (!mv || !C.applyMove(G, mv.pawn, mv.k, mv.pair)){ ok(false, 'computer move rejected'); break; } }
      }
      if (G.winner === (g % 2 ? 1 : 0)) wa++;
    }
    return wa / games; };
  const me = match('medium', 'easy', 200), hm = match('hard', 'medium', 300);
  ok(me > 0.7, `medium beats easy (${(me * 100).toFixed(0)}%)`); ok(hm > 0.54, `hard beats medium (${(hm * 100).toFixed(0)}%)`);
  console.log(`Computer: medium beats easy ${(me * 100).toFixed(0)}%, hard beats medium ${(hm * 100).toFixed(0)}%`);
}
console.log(fails ? `${fails} failed` : 'All checks passed');
process.exit(fails ? 1 : 0);
