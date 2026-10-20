// Go problem solver tests on textbook positions. Run: node tools/test-go-solver.js
'use strict';
const G = require('../go-core.js'), S = require('../go-solver.js');
const { BLACK, WHITE } = G;
let fails = 0;
const check = (name, cond, info = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!cond) fails++; };
function setup(rows, turn) {
  const N = rows.length, b = new G.Board(N);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') b._place(b.pt(x, y), BLACK); if (ch === 'O') b._place(b.pt(x, y), WHITE); }));
  b.turn = turn; b.seen = new Set([b.key()]); return b;
}
const names = (b, ps) => ps ? ps.map(p => b.name(p)).join(' ') : 'null';
const t0 = Date.now();
// Ladder: white D5 in a ladder towards the top right
const ladder = ['.........', '.........', '.........', '...X.....', '..XO.....', '....X....', '.........', '.........', '.........'];
{ const b = setup(ladder, BLACK), o = { attacker: BLACK, target: b.parse('D5'), depth: 40 };
  const r = S.solve(b, o); check('ladder: Black captures', r.win, `${r.nodes} nodes`);
  const g = S.goodMoves(b, o); check('ladder: the atari from the right side starts it', g && g.length >= 1, names(b, g)); }
{ const rows = ladder.slice(); rows[2] = '......O..'; rows[7] = '.O.......'; // breakers on both ladder paths (G7, B2)
  const b = setup(rows, BLACK), o = { attacker: BLACK, target: b.parse('D5'), depth: 40 };
  const r = S.solve(b, o); check('ladder breaker: Black can\'t capture', !r.win, `${r.nodes} nodes`); }
// Net (geta): white stone C5 with two liberties; the net, not the atari, captures it
const net = ['.........', '.........', '.........', '..XX.....', '.XO......', '..X......', '.........', '.........', '.........'];
{ const b = setup(net, BLACK), o = { attacker: BLACK, target: b.parse('C5'), depth: 20 };
  const g = S.goodMoves(b, o); check('net: Black captures', g && g.length >= 1, names(b, g)); }
// Snapback: white takes the sacrificed stone and is recaptured
const snap = ['.........', '.........', '.........', '.........', '.........', '.........', 'XXX......', 'OOOX.....', '..OX.....'];
{ const b = setup(snap, BLACK), o = { attacker: BLACK, target: b.parse('A2'), depth: 12 };
  const g = S.goodMoves(b, o); check('snapback: the sacrifice at B1 captures the white stones', g && g.includes(b.parse('B1')), names(b, g));
  const t = b.clone(true); t.play(b.parse('B1')); const rep = S.bestReply(t, o); check('snapback: White takes the stone, and is taken back', rep > 0, b.name(rep)); }
// Straight three: whoever takes the middle decides
const three = ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXX....', 'OOOOX....', '...OX....'];
{ const region = ['A1', 'B1', 'C1'];
  const ba = setup(three, BLACK), o = { attacker: BLACK, target: ba.parse('A2'), region: region.map(s => ba.parse(s)), depth: 12 };
  const g = S.goodMoves(ba, o); check('straight three, Black to move: the vital point kills', g && g.length === 1 && ba.name(g[0]) === 'B1', names(ba, g));
  const bd = setup(three, WHITE), g2 = S.goodMoves(bd, o); check('straight three, White to move: the vital point lives', g2 && g2.length === 1 && bd.name(g2[0]) === 'B1', names(bd, g2)); }
// Two eyes: always alive whoever moves
const eyes = ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXXX...', 'OOOOOX...', '.O.O.X...'];
{ const b = setup(eyes, BLACK), o = { attacker: BLACK, target: b.parse('A2'), region: ['A1', 'C1', 'E1'].map(s => b.parse(s)), depth: 12 };
  const r = S.solve(b, o); check('two eyes: Black can\'t kill', !r.win, `${r.nodes} nodes`); }
// Best replies
{ const b = setup(three, BLACK), o = { attacker: BLACK, target: b.parse('A2'), region: ['A1', 'B1', 'C1'].map(s => b.parse(s)), depth: 12 };
  b.play(b.parse('B1')); const rep = S.bestReply(b, o); check('after the vital point, White resists somewhere in the eye space', rep > 0, b.name(rep)); }
console.log(`${Date.now() - t0} ms`);
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
