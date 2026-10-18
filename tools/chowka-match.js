// Plays the computer levels against each other (and against random moves) to check that each level beats the one below.
// Run: node tools/chowka-match.js [games per pairing, default 400]
'use strict';
const C = require('../chowka-core.js');
const n = +process.argv[2] || 400;
function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const randomMove = (S, rand) => { const l = []; S.pool.forEach((v, k) => C.movesFor(S, v).concat(C.pairMovesFor(S, v)).forEach(m => l.push({ pawn: m.pawn, k, pair: m.pair }))); return l[(rand() * l.length) | 0]; };
function game(a, b, seed){ // a plays player 0, b player 1; player 0 or 1 starts by seed
  const rand = mulberry(seed), S = C.newGame(); S.turn = seed & 1; let steps = 0;
  const who = [a, b];
  while (S.phase !== 'over' && steps++ < 5000){
    if (S.phase === 'throw') C.applyThrow(S, C.roll(rand));
    else { const lv = who[S.turn], m = lv === 'random' ? randomMove(S, rand) : C.chooseMove(S, lv, rand); C.applyMove(S, m.pawn, m.k, m.pair); }
  }
  return S.winner;
}
const t0 = Date.now();
for (const [a, b] of [['easy', 'random'], ['medium', 'easy'], ['hard', 'medium'], ['hard', 'easy']]){
  let wa = 0;
  for (let g = 0; g < n; g++){ const swap = g % 2, w = swap ? game(b, a, g + 1) : game(a, b, g + 1); if (w === (swap ? 1 : 0)) wa++; }
  const pct = 100 * wa / n, err = 100 * Math.sqrt(0.25 / n) * 2;
  console.log(`${a.padEnd(6)} vs ${b.padEnd(6)}: ${a} wins ${pct.toFixed(1)}% (±${err.toFixed(1)})`);
}
console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
