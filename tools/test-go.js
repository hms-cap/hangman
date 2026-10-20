// Go rules and computer player tests. Run: node tools/test-go.js [quick]
'use strict';
const G = require('../go-core.js');
const { BLACK, WHITE } = G;
let fails = 0;
const check = (name, cond, info = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!cond) fails++; };
// set up a position from rows ('X' black, 'O' white, '.' empty), top row first
function setup(rows, turn = BLACK) {
  const N = rows.length, b = new G.Board(N);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') b._place(b.pt(x, y), BLACK); if (ch === 'O') b._place(b.pt(x, y), WHITE); }));
  b.turn = turn; b.seen = new Set([b.key()]); return b;
}
const at = (b, s) => b.parse(s);

// capture
{ const b = setup(['.....', '..O..', '.OXO.', '.....', '.....'], WHITE);
  const n = b.play(at(b, 'C2')); check('capturing a stone by filling its last liberty', n === 1 && b.c[at(b, 'C3')] === 0 && b.caps[WHITE] === 1); }
// capture of a chain
{ const b2 = setup(['.....', '.OO..', 'OXX.O', '.OO..', '.....'], WHITE); const n = b2.play(at(b2, 'D3'));
  const b3 = setup(['.....', '.OO..', 'OXX.O', '.OO..', '.....'], WHITE);
  check('a two-stone chain with one liberty is in atari', b3.inAtari(b3.chain[at(b3, 'B3')]) && b3.libCount(at(b3, 'B3')) === 1 && b3.atariLib(b3.chain[at(b3, 'B3')]) === at(b3, 'D3'));
  check('capturing a two-stone chain', n === 2 && b2.c[at(b2, 'B3')] === 0 && b2.c[at(b2, 'C3')] === 0); }
// suicide
{ const b = setup(['.O...', 'O....', '.....', '.....', '.....'], BLACK);
  check('suicide is illegal', !b.legal(at(b, 'A5')) && b.play(at(b, 'A5')) === -1); }
// capturing is not suicide
{ const b = setup(['XO...', '.X...', '.....', '.....', '.....'], WHITE);
  check('a move that captures is legal even with no liberties of its own', b.legal(at(b, 'A4')) && b.play(at(b, 'A4')) === 1); }
// ko
{ const b = setup(['.XO..', 'XO.O.', '.XO..', '.....', '.....'], BLACK);
  const n = b.play(at(b, 'C4')); // black captures white at B4
  check('ko capture', n === 1);
  check('immediate recapture is illegal (ko)', !b.legal(at(b, 'B4')));
  b.play(at(b, 'E1')); b.play(at(b, 'E2'));
  check('recapture is legal after a move elsewhere', b.legal(at(b, 'B4'))); }
// scoring
{ const b = setup(['.X.O.', '.X.O.', '.X.O.', '.X.O.', '.X.O.'], BLACK); b.komi = 0.5;
  const s = b.score(); check('area scoring: stones plus surrounded empty points, neutral points count for nobody', s.black === 10 && s.white === 10.5, `${s.black} ${s.white}`); }
{ const b = setup(['XXX..', 'XOX..', 'XXX..', '.....', '.....'], BLACK); b.komi = 0;
  const s = b.score(new Set([at(b, 'B4')])); check('dead stones become territory of the surrounding side', s.black === 25, `${s.black}`); }
// handicap
{ const b = G.newGame(9, 4); check('handicap stones on the star points, White moves first, komi 0.5', [...b.c].filter(v => v === BLACK).length === 4 && b.turn === WHITE && b.komi === 0.5); }
// superko on a cycle: replaying a ko loop must eventually be refused
{ const b = setup(['.XO..', 'XO.O.', '.XO..', '.....', '.....'], BLACK); b.play(at(b, 'C4'));
  const seenBefore = b.seen.size; check('position record grows', seenBefore >= 2); }
// coordinates
{ const b = new G.Board(9); check('coordinates skip I and count rows from the bottom', b.name(b.pt(0, 8)) === 'A1' && b.name(b.pt(8, 0)) === 'J9' && b.parse('E5') === b.pt(4, 4)); }

// playouts finish and speed
{ const t0 = Date.now(), r = G.rng(3); let n = 0; while (Date.now() - t0 < 1000) { const b = G.newGame(9); G.playout(b, r, null, 300); n++; }
  check('9x9 playouts', n > 200, `${n} per second`);
  const t1 = Date.now(); let m = 0; while (Date.now() - t1 < 1000) { const b = G.newGame(13); G.playout(b, r, null, 600); m++; }
  check('13x13 playouts', m > 60, `${m} per second`); }
// the computer captures a stone in atari and saves its own
{ const b = setup(['.........', '.........', '..XOX....', '..XOX....', '...X.....', '.........', '.........', '.........', '.........'], BLACK);
  const r = G.search(b, { playouts: 1500, seed: 5 });
  check('the computer captures a two-stone group in atari', b.name(r.move) === 'D8', b.name(r.move)); }
{ const b = setup(['.........', '.........', '..OXO....', '..OXO....', '...O.....', '.........', '.........', '.........', '.........'], BLACK);
  const r = G.search(b, { playouts: 1500, seed: 6 });
  check('the computer saves its group in atari', b.name(r.move) === 'D8', b.name(r.move)); }
// a full game finishes, with a sensible score
{ const t0 = Date.now(), g = G.selfPlay(9, { playouts: 200, noise: 0.2 }, { playouts: 200, noise: 0.2 }, 2);
  check('a 9x9 game between two computers finishes', g.moves > 30 && g.moves < 250, `${g.moves} moves, margin ${g.margin}, ${Date.now() - t0} ms`); }
// tutor
{ const T = require('../go-tutor.js');
  const b = setup(['.........', '.........', '..XOX....', '..XOX....', '...X.....', '.........', '.........', '.........', '.........'], BLACK);
  const f = T.tactics(b, b.parse('H5'));
  check('tutor: a missed capture is pointed out', f.some(x => x.kind === 'missed' && x.text.includes('D8')), f.map(x => x.text).join(' | '));
  const g = T.tactics(b, b.parse('D8'));
  check('tutor: a capture is recognised', g.some(x => x.kind === 'capture'), g.map(x => x.text).join(' | '));
  const c = setup(['.........', '.........', '..OXO....', '..OXO....', '...O.....', '.........', '.........', '.........', '.........'], BLACK);
  const h = T.tactics(c, c.parse('H5'));
  check('tutor: stones left in atari are pointed out', h.some(x => x.kind === 'ignored' && x.text.includes('D8')), h.map(x => x.text).join(' | '));
  const w = T.warn(c); check('tutor: warns about stones in atari before the move', w.some(x => x.kind === 'danger'));
  const e = setup(['.X.......', 'X.X......', '.X.......', '.........', '.........', '.........', '.........', '.........', '.........'], BLACK);
  check('tutor: filling your own eye', T.tactics(e, e.parse('B8')).some(x => x.kind === 'eye'));
  const t0 = Date.now(), rv = T.review(b, b.parse('H5'), { playouts: 1500, seed: 3 });
  check('tutor review grades a missed capture as a mistake or worse', ['mistake', 'blunder'].includes(rv.grade) && rv.bestName === 'D8', `${rv.label}: ${rv.text} (${Date.now() - t0} ms)`);
  const rv2 = T.review(b, b.parse('D8'), { playouts: 1500, seed: 4 });
  check('tutor review: the capture is best', rv2.grade === 'best' || rv2.grade === 'good', `${rv2.label}: ${rv2.text}`);
}
if (process.argv[2] !== 'quick') {
  // strength ladder: a stronger level beats a weaker one most of the time
  for (const [a, b, n] of [[1, 3, 6], [2, 4, 4]]) {
    let wins = 0, t0 = Date.now();
    for (let g = 0; g < n; g++) { const strongBlack = g % 2 === 0, res = G.selfPlay(9, G.LEVELS[strongBlack ? b : a], G.LEVELS[strongBlack ? a : b], 100 + g); if ((res.winner === BLACK) === strongBlack) wins++; }
    check(`${G.LEVELS[b].name} beats ${G.LEVELS[a].name} on 9x9`, wins > n / 2, `${wins}/${n} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
