// Tutor tests: move grades and explanations, and threat warnings. Run: node tools/test-chess-tutor.js
'use strict';
const C = require('../chess-core.js');
const T = require('../chess-tutor.js');
let fails = 0;
const check = (name, cond, info = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!cond) fails++; };
const at = moves => C.Position.fromMoves(C.START, moves.split(' ').filter(Boolean));
function rev(moves, uci) {
  const p = at(moves), t0 = Date.now(), r = T.review(p, p.fromUci(uci), { time: 500, opp: 'the computer' });
  r.ms = Date.now() - t0; return r;
}
const show = r => `${r.san}: ${r.label} (${r.ms} ms) — ${r.text}`;

let r = rev('f2f3 e7e5', 'g2g4');
check('allowing mate is a blunder', r.grade === 'blunder' && /force mate at once/.test(r.text) && r.replySan === 'Qh4#', show(r));

r = rev('e2e4 e7e5 f1c4 b8c6 d1h5 g8f6', 'd2d3');
check('missing mate in one', ['mistake', 'blunder'].includes(r.grade) && /checkmate with Qxf7#/.test(r.text), show(r));

r = rev('e2e4 e7e5 f1c4 b8c6 d1h5 g8f6', 'h5f7');
check('delivering mate', r.grade === 'best' && /Checkmate/.test(r.text), show(r));

r = rev('e2e4 e7e5 g1f3 b8c6', 'f3d4');
check('knight left en prise', ['mistake', 'blunder'].includes(r.grade) && /knight on d4 can be taken/.test(r.text), show(r));

r = rev('e2e4 e7e5', 'g1f3');
check('normal development is fine', ['best', 'excellent', 'good'].includes(r.grade), show(r));

r = rev('e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5', 'e1g1');
check('castling is fine', ['best', 'excellent', 'good'].includes(r.grade), show(r));

r = rev('e2e4 e7e5 g1f3 d7d6', 'd1e2');
console.log('     (info) ' + show(r));

r = rev('e2e4 d7d5 e4d5 d8d5', 'b1c3');
check('gaining time on the queen', ['best', 'excellent', 'good'].includes(r.grade), show(r));

// Warnings
let w = T.warn(at('e2e4 e7e5 f1c4 b8c6 d1h5'), 'the computer');
check('warns about a mate threat', w && /threatens Qxf7, checkmate/.test(w.text), w && w.text);
w = T.warn(at('e2e4 d7d5'), 'the computer');
check('warns about an unprotected pawn', w && /pawn on e4 is attacked by the pawn on d5 and isn’t protected/.test(w.text), w && w.text);
w = T.warn(at('e2e4 e7e5 g1f3 b8c6'), 'the computer');
check('no warning when the pawn is defended', w === null, w && w.text);
w = T.warn(at('e2e4 e7e5 g1f3 b8c6 f3e5'), 'the computer');
console.log('     (info) after Nxe5: ' + (w && w.text));

// Pinned attacker can't take, so no warning: white bishop pins the black knight to the king
w = T.warn(new C.Position('4k3/8/2n5/1B6/3P4/8/8/4K3 w - - 0 1'), 'the computer');
check('pinned attacker is ignored', w === null, w && w.text);

// Grading speed across a random-ish game
{
  const p = new C.Position(); let worst = 0;
  for (let i = 0; i < 12; i++) {
    const L = p.legal(), m = L[(i * 7) % L.length], t0 = Date.now();
    T.review(p, m, { time: 300 }); worst = Math.max(worst, Date.now() - t0); p.make(m);
  }
  check('review time stays bounded', worst < 2500, worst + ' ms worst');
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
