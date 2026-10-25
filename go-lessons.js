// Go Trainer lessons: a short lesson before each level, shown the first time the level is started and on demand after.
// GoLessons.pages(trackKey, levelIndex, level) -> [{ h, text (HTML), figs: [glossary diagram specs], wide }]
// Idea pages use hand-made diagrams (built on a real board by go-glossary.js, so they are always legal); problem
// levels end with a worked example: one of the level's own problems, stepped through with go-explain.js captions.
(function (root) {
'use strict';
const GL = root.GoGlossary || (typeof require !== 'undefined' && require('./go-glossary.js'));
const EX = root.GoExplain || (typeof require !== 'undefined' && require('./go-explain.js'));
const T = root.GoTrainer || (typeof require !== 'undefined' && require('./go-trainer-core.js'));
const term = id => (GL.TERMS.find(t => t.id === id) || {}).frames || [];
const pick = (id, ...i) => i.map(k => term(id)[k]).filter(Boolean);

// ---- the idea pages, per level ----
const L = {
  'rules:0': [
    { h: 'Stones need liberties', text: 'A stone\'s liberties are the empty points right next to it along the lines. In the open a stone has four; on the edge three; in the corner only two.', figs: pick('liberty', 0, 1) },
    { h: 'Groups share them', text: 'Stones joined along the lines are one group and share all their liberties. Diagonal neighbours are not joined, so each counts its own.', figs: pick('group', 0, 1) },
    { h: 'In this level', text: 'Tap every liberty of the marked stones, then check your answer. Count carefully around groups: a point next to two of the stones is still just one liberty.', figs: [{ n: 5, W: 'B3 C3 C4', B: 'B4 D3', target: 'C3', libs: 'C3', cap: 'The marked group: 5 liberties' }] },
  ],
  'rules:1': [
    { h: 'Atari', text: 'When a stone or group has only one liberty left it is in atari: the next move there captures it.', figs: pick('atari', 0, 1) },
    { h: 'Capture', text: 'Play on the last liberty and the stones come off the board. A whole group goes at once, however big.', figs: pick('capture', 0, 1) },
    { h: 'In this level', text: 'Find the move that captures the marked white stones. Sometimes they are already in atari; sometimes you need to take a liberty from the right side first.' },
  ],
  'rules:2': [
    { h: 'Your stones are in atari', text: 'Now it\'s your stones with one liberty. There are two ways out: <b>run</b>, by extending to gain liberties, or <b>capture</b> a stone that is attacking you.', figs: [{ n: 5, B: 'C3', W: 'B3 C4 D3', target: 'C3', libs: 'C3', cap: 'Black is in atari' }, { n: 5, B: 'C3', W: 'B3 C4 D3', moves: 'C2', libs: 'C3', cap: 'Black 1 extends: 3 liberties' }] },
    { h: 'Capturing to escape', text: 'If one of the stones around you is itself in atari, taking it is often the best escape: it removes an attacker and gives you new liberties.', figs: [{ n: 5, B: 'C3 B4 B2', W: 'B3 C4 D3', target: 'C3', libs: 'C3 B3', cap: 'Black in atari, but so is White B3' }, { n: 5, B: 'C3 B4 B2', W: 'B3 C4 D3', moves: 'A3', libs: 'C3', cap: 'Black 1 captures: two liberties' }] },
    { h: 'Running is not always enough', text: 'Extending only helps if you get at least three liberties. With two, the opponent puts you straight back in atari, and in a ladder the stones are lost anyway.' },
  ],
  'rules:3': [
    { h: 'No suicide', text: 'You may not play where your stone would have no liberties at all.', figs: pick('selfatari', 0) },
    { h: '…unless it captures', text: 'A move with no liberties is allowed when it captures: the captured stones come off first, and that gives your stone a liberty.', figs: [{ n: 5, B: 'A2 B3 C2', W: 'A1 B2 C1', no: '', try: 'B1', cap: 'Black 1 at B1 looks like suicide…' }, { n: 5, B: 'A2 B3 C2', W: 'A1 B2 C1', moves: 'B1', cap: '…but it captures first, so it is legal' }] },
    { h: 'Ko', text: 'After a ko capture, the other side may not take back straight away. They must play elsewhere first.', figs: pick('ko', 0, 1) },
    { h: 'In this level', text: 'Decide whether Black may play on the marked point: free, suicide, a capture that makes it legal, or a ko retake that isn\'t allowed yet.' },
  ],
  'rules:4': [
    { h: 'Who won?', text: 'At the end, each side scores its stones on the board plus the empty points it surrounds (its territory). Here Black has 5 stones and 10 points of territory, 15 in all; White has 10.',
      figs: [{ n: 5, B: 'C1 C2 C3 C4 C5', W: 'D1 D2 D3 D4 D5', tb: 'A1 A2 A3 A4 A5 B1 B2 B3 B4 B5', tw: 'E1 E2 E3 E4 E5', cap: 'Black 15, White 10' }] },
    { h: 'In this level', text: 'Count Black\'s score: stones plus territory. In real games White also gets komi (here none) to make up for Black moving first.' },
  ],
  'capture:0': [
    { h: 'Chasing', text: 'Some stones can\'t be caught in one move. Keep them in atari, move after move, and choose the side of each atari so they run toward your stones or the edge, not into open space.', figs: pick('atari', 0) },
  ],
  'capture:1': [
    { h: 'The ladder', text: 'Atari from the side that drives the stones toward the edge. Each time they extend they get just two liberties, and you take one again. They zigzag across the board until they hit the edge.', figs: term('ladder').slice(-3, -1) },
    { h: 'Read it to the end', text: 'A ladder works only if nothing helps the running stones on the way: a friendly stone in the path (a ladder breaker) gives them a third liberty and they escape. Read the whole zigzag before you start.' },
  ],
  'capture:2': [
    { h: 'The net', text: 'An atari pushes the stones into open space. A net is looser: it doesn\'t give atari, but blocks every way out, so whichever way they run they meet your stones.', figs: term('net').slice(-3, -1) },
  ],
  'capture:3': [
    { h: 'The throw-in', text: 'Play a stone inside where it can be captured. It takes a liberty away from the inside, and when White captures it they have used a move and are still short of liberties.', figs: term('throwin').slice(-3, -1) },
  ],
  'capture:4': [
    { h: 'The snapback', text: 'Give up one stone where White can take it. After the capture, White\'s stones have only one liberty, the point where your stone was, and you take them all back.', figs: term('snapback').slice(-3, -1) },
  ],
  'capture:5': [
    { h: 'Which technique?', text: 'All the capturing ideas, mixed. Count the marked stones\' liberties first. One liberty: just take it. Two: an <a data-term="atari">atari</a> or a <a data-term="ladder">ladder</a>. Lots of space: a <a data-term="net">net</a>. Stones inside their shape: a <a data-term="throwin">throw-in</a> or <a data-term="snapback">snapback</a>.' },
  ],
  'saving:0': [
    { h: 'Count first', text: 'Your marked stones are short of liberties. Count them, then find the move that gains the most: extend toward open space, or capture one of the stones around you.', figs: [{ n: 5, B: 'C3', W: 'B3 C4 D3', target: 'C3', libs: 'C3', cap: 'One liberty: atari' }, { n: 5, B: 'C3', W: 'B3 C4 D3', moves: 'C2', libs: 'C3', cap: 'Extending gives three' }] },
    { h: 'Avoid the ladder', text: 'Running to just two liberties doesn\'t save anything: White plays atari again. Look for the move that gives three or more, or that puts a white stone in atari.' },
  ],
  'saving:1': [
    { h: 'Harder rescues', text: 'When running fails, look around: a white stone in <a data-term="atari">atari</a> next to you (capture it), a white group short of liberties (a counter-atari forces White to answer), or a friendly group to connect to.' },
  ],
  'life:0': [
    { h: 'Two eyes', text: 'A group lives only with two separate eyes. With one eye it can be surrounded and captured.', figs: pick('eye', 0, 1) },
    { h: 'The vital point', text: 'Inside a small space there is usually one point that decides everything. If White plays there, two eyes; if you play there first, only one.', figs: pick('vital', 0, 1) },
  ],
  'life:1': [
    { h: 'Living', text: 'Now it\'s your group. Make room for two separate eyes, and take the vital point before White does.', figs: pick('vital', 0, 1) },
    { h: 'Eye shapes', text: 'Three empty points in a row: the middle is vital. A square of four is already dead. Four in a row or a bent four can make two eyes, whoever plays first.' },
  ],
  'life:2': [
    { h: 'Bigger spaces', text: 'A big eye space can make two eyes too easily. Make it smaller first, from the outside, then take the vital point of what is left. Watch for sacrifices: a stone played inside can stop an eye from forming.', figs: pick('vital', 1) },
  ],
  'life:3': [
    { h: 'Bigger spaces', text: 'Widen your eye space before White shrinks it, or make one eye for sure and look for the second. The key point is often where White would want to play.', figs: pick('eye', 1) },
  ],
  'life:4': [
    { h: 'Kill or live?', text: 'Read the goal first. Then find the eye space and its key points: the same point is usually right for both sides.' },
  ],
};

// a worked example from the level's own problems: the most compact one, stepped through
function workedExample(level) {
  if (!level || level.kind !== 'pz' || !T.poolFor) return [];
  const pool = T.poolFor(level).filter(p => p.line && p.line.length);
  if (!pool.length) return [];
  const area = p => { const c = GL.cropFor(p); return (c[2] - c[0] + 1) * (c[3] - c[1] + 1); };
  const p = pool.slice().sort((a, b) => area(a) - area(b) || a.rating - b.rating)[0], crop = GL.cropFor(p);
  return EX.steps(p, null).map((st, i, all) => ({
    h: i === 0 ? 'A worked example' : `Worked example, ${i + 1} of ${all.length}`, text: st.text, wide: true,
    figs: [{ stones: p.stones, crop, region: p.region || null, target: i === 0 ? p.target : '', moves: st.moves.join(' '), libs: st.libsOf || '', cap: '' }],
  }));
}

function pages(tk, li, level) {
  const own = L[`${tk}:${li}`] || [];
  return own.concat(workedExample(level));
}

const api = { pages, has: (tk, li) => !!L[`${tk}:${li}`] };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoLessons = api;
})(typeof self !== 'undefined' ? self : globalThis);
