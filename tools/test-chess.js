// Chess tests. Run: node tools/test-chess.js
// 1) perft: move generation must match the published node counts exactly.
// 2) hashing, notation and draw rules.  3) engine tactics and a short match.
'use strict';
const C = require('../chess-core.js');
const { Position, Engine } = C;
let fails = 0;
const check = (name, cond, info = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!cond) fails++; };

// ---- perft ----
const PERFT = [
  ['start position', C.START, [20, 400, 8902, 197281, 4865609]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
  ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]],
];
for (const [name, fen, expected] of PERFT) {
  const p = new Position(fen), got = expected.map((_, i) => p.perft(i + 1));
  check('perft ' + name, got.every((g, i) => g === expected[i]), got.join(','));
}

// ---- hashing ----
{
  let bad = 0;
  for (let g = 0; g < 200; g++) {
    const p = new Position();
    for (let i = 0; i < 120; i++) { const L = p.legal(); if (!L.length) break; p.make(L[(Math.random() * L.length) | 0]); const a = [p.h1, p.h2]; p.rehash(); if (a[0] !== p.h1 || a[1] !== p.h2) bad++; }
  }
  check('incremental hash matches full rehash', bad === 0, bad + ' mismatches');
}

// ---- notation ----
{
  const q = new Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), sq = q.legal().map(m => q.san(m));
  check('SAN castling O-O / O-O-O', sq.includes('O-O') && sq.includes('O-O-O'));
  const d = new Position('7k/8/8/8/8/8/8/R5RK w - - 0 1'), sd = d.legal().map(m => d.san(m));
  check('SAN file disambiguation', sd.includes('Rab1') && sd.includes('Rgb1'));
  const r = new Position('7k/8/8/8/R7/8/8/R6K w - - 0 1'), sr = r.legal().map(m => r.san(m));
  check('SAN rank disambiguation', sr.includes('R1a2') && sr.includes('R4a2'));
  const m = new Position('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  check('SAN checkmate suffix', m.legal().some(x => m.san(x) === 'Ra8#'));
  const pr = new Position('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  check('SAN promotion', pr.legal().map(x => pr.san(x)).includes('a8=Q'));
}

// ---- game end ----
check('checkmate', Position.fromMoves(C.START, ['f2f3', 'e7e5', 'g2g4', 'd8h4']).status()?.reason === 'checkmate');
check('stalemate', new Position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status()?.reason === 'stalemate');
check('insufficient material (K+B v K)', new Position('8/8/8/4k3/8/8/2B5/4K3 w - - 0 1').status()?.reason === 'insufficient material');
check('K+R v K plays on', new Position('8/8/8/4k3/8/8/2R5/4K3 w - - 0 1').status() === null);
check('threefold repetition', Position.fromMoves(C.START, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']).status()?.reason === 'threefold repetition');
check('fifty-move rule', new Position('8/8/8/4k3/8/8/2R5/4K3 w - - 100 80').status()?.reason === 'the fifty-move rule');

// ---- engine ----
const solve = (fen, level, expect, name) => {
  const p = new Position(fen), t = Date.now(), r = Engine.think(p, level, ['x']), u = Position.uci(r.move);
  check(`${name} (level ${level})`, expect.includes(u), `${u}, score ${r.score}, depth ${r.depth}, ${Date.now() - t}ms`);
};
solve('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 1, ['a1a8'], 'mate in 1, even at Beginner');
solve('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 4, ['h5f7'], "Scholar's mate");
solve('kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1', 4, ['a1a6'], "Morphy's mate in 2 (Ra6!!)");
solve('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', 4, ['f3h4'], 'wins a hanging queen');
{
  const p = new Position('8/8/8/4k3/8/8/8/3QK3 w - - 0 1'); let n = 0, st;
  while (!(st = p.status()) && n < 120) { p.make(Engine.think(p, 4, ['x']).move); n++; }
  check('K+Q v K is converted to mate', st && st.reason === 'checkmate', `${st ? st.reason : 'no result'} after ${n} plies`);
}
{
  const res = [];
  for (let g = 0; g < 2; g++) {
    const p = new Position(), hist = []; let st, n = 0;
    while (!(st = p.status()) && n < 240) { const lv = (p.turn === 0) === (g === 0) ? 5 : 1, r = Engine.think(p, lv, hist); hist.push(Position.uci(r.move)); p.make(r.move); n++; }
    res.push(st ? st.result : '*');
  }
  check('Expert beats Beginner with both colors', res[0] === '1-0' && res[1] === '0-1', res.join(' / '));
}
console.log(fails ? `${fails} FAILED` : 'ALL CHESS TESTS PASS');
if (fails) process.exitCode = 1;
