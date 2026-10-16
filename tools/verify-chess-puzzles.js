// Independently re-checks every puzzle in chess-puzzles.js.
// Mates: the line is legal, ends in checkmate, the first move is the only one that mates in N (N >= 2), and no shorter mate exists.
// Material: the line is legal and the solver ends at least 2 pawns up, and the opponent can't win it straight back.
// Usage: node tools/verify-chess-puzzles.js [file]
'use strict';
const path = require('path');
global.window = {};
require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'chess-puzzles.js')));
const C = require('../chess-core.js');
const VAL = [0, 100, 300, 320, 500, 900, 0];
const material = (pos, color) => { let s = 0; for (let q = 0; q < 120; q++) { if (q & 0x88) { q += 7; continue; } const p = pos.b[q]; if (p) s += (C.colorOf(p) === color ? 1 : -1) * VAL[C.typeOf(p)]; } return s; };
let bad = 0; const counts = {}, ratings = [];
for (const [fen, lineStr, rating, themesStr] of window.CHESS_PUZZLES) {
  const line = lineStr.split(' '), themes = themesStr.split(','), kind = themes[0], fail = msg => { bad++; console.log('FAIL', msg, fen, lineStr); };
  counts[kind] = (counts[kind] || 0) + 1; ratings.push(rating);
  const pos = new C.Position(fen), me = pos.turn, start = material(pos, me);
  if (line.length % 2 === 0) { fail('line ends on a reply'); continue; }
  let ok = true;
  for (const u of line) { const m = pos.fromUci(u); if (!m) { fail('illegal move ' + u); ok = false; break; } pos.make(m); }
  if (!ok) continue;
  if (kind.startsWith('mateIn')) {
    const n = +kind.slice(6);
    if (!(pos.legal().length === 0 && pos.inCheck())) { fail('line does not end in mate'); continue; }
    if ((line.length + 1) / 2 !== n) { fail('line length does not match mate in ' + n); continue; }
    const p0 = new C.Position(fen);
    const firsts = C.mateIn(p0, n, { nodes: 2e7 }, true);
    if (!firsts) { fail('solver budget exceeded'); continue; }
    if (!firsts.map(C.Position.uci).includes(line[0])) { fail('first move does not force mate'); continue; }
    if (n >= 2 && firsts.length !== 1) { fail('more than one key move'); continue; }
    if (n >= 2 && C.mateIn(p0, n - 1, { nodes: 2e7 })) { fail('a shorter mate exists'); continue; }
  } else {
    if (material(pos, me) - start < 200 && !pos.status()) { fail('no material won'); continue; }
    if (!pos.status()) { const back = C.scoreMoves(pos, 4)[0]; if (back) { pos.make(back.move); if (material(pos, me) - start < 150) fail('material can be won back'); pos.unmake(); } }
  }
}
ratings.sort((a, b) => a - b);
console.log(`${window.CHESS_PUZZLES.length} puzzles: ${JSON.stringify(counts)}; ratings ${ratings[0]}-${ratings[ratings.length - 1]}, median ${ratings[ratings.length >> 1]}`);
console.log(bad ? `${bad} FAILED` : 'ALL PUZZLES VERIFIED');
if (bad) process.exitCode = 1;
