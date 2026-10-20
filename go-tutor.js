// Go tutor: grades a move against the computer's search and explains the tactical point in plain words
// (stones left in atari, a capture missed, an own eye filled), and warns about stones in danger before you move.
// Runs in go-worker.js and in Node tests.
(function (root) {
'use strict';
const G = root.Go || (typeof require !== 'undefined' && require('./go-core.js'));
const { BLACK, WHITE, EMPTY, other } = G;
const NAME = c => c === BLACK ? 'Black' : 'White';
const stonesWord = n => n === 1 ? 'stone' : 'stones';
const where = (b, p) => b.name(p);
const chainHeads = (b, col) => b.points.filter(p => b.c[p] === col && b.chain[p] === p);

// Chains of `col` in atari, biggest first: [{ head, size, lib, at }]
function inAtari(b, col) {
  return chainHeads(b, col).filter(h => b.inAtari(h)).map(h => ({ head: h, size: b.size[h], lib: b.atariLib(h), at: where(b, h) })).sort((a, c) => c.size - a.size);
}
// Could `col` save the chain (head h, in atari) by extending to its liberty? (it must gain liberties)
function canEscape(b, h, col) {
  const lib = b.atariLib(h); if (!b.legal(lib, col)) return false;
  const t = b.clone(); t._play(lib, col); return t.libCount(lib) >= 2;
}
// Warnings for the side to move: our stones in atari, enemy stones we can capture
function warn(b) {
  const me = b.turn, out = [];
  for (const a of inAtari(b, me)) if (a.size >= 1) out.push({ kind: 'danger', points: b.stones(a.head), lib: a.lib, text: `Your ${a.size === 1 ? 'stone' : a.size + ' stones'} at ${a.at} ${a.size === 1 ? 'is' : 'are'} in atari: one liberty left, at ${where(b, a.lib)}.` });
  for (const a of inAtari(b, other(me))) if (b.legal(a.lib, me)) out.push({ kind: 'chance', points: b.stones(a.head), lib: a.lib, text: `${NAME(other(me))}'s ${a.size === 1 ? 'stone' : a.size + ' stones'} at ${a.at} can be captured.` });
  return out;
}
// The tactical story of a move: what it did, what it allowed, what it missed
function tactics(b0, move) {
  const me = b0.turn, opp = other(me), facts = [];
  if (move === 0) return facts;
  const b = b0.clone(); const caps = b._play(move, me); b.turn = opp; b.lastMove = move;
  if (caps) facts.push({ good: true, kind: 'capture', text: `Captures ${caps} ${stonesWord(caps)}.` });
  // filled own eye
  if (b0.isEye(move, me)) facts.push({ bad: true, kind: 'eye', text: `That fills one of your own eyes. A group needs two eyes to live, so never fill them yourself.` });
  // self-atari
  if (b.inAtari(b.chain[move]) && !caps) { const n = b.size[b.chain[move]]; facts.push({ bad: true, kind: 'selfatari', lib: b.atariLib(b.chain[move]), text: `That leaves your ${n === 1 ? 'stone' : n + ' stones'} in atari: ${NAME(opp)} can capture at ${where(b, b.atariLib(b.chain[move]))}.` }); }
  // a chain of ours that was in atari and still is (and could have escaped)
  for (const a of inAtari(b0, me)) {
    if (b.c[a.head] !== me || !b.inAtari(b.chain[a.head])) continue;
    if (a.size >= 2 && canEscape(b0, a.head, me)) facts.push({ bad: true, kind: 'ignored', lib: a.lib, text: `Your ${a.size} stones at ${a.at} were in atari and still are. Extending at ${where(b0, a.lib)} would have saved them.` });
  }
  // an enemy chain that could have been captured and wasn't
  if (!caps) for (const a of inAtari(b0, opp)) {
    if (a.size >= 2 && b0.legal(a.lib, me) && b.c[a.head] === opp && b.inAtari(b.chain[a.head])) { facts.push({ bad: true, kind: 'missed', lib: a.lib, text: `You could have captured ${a.size} stones at ${where(b0, a.lib)}.` }); break; }
  }
  // atari on the opponent
  if (!caps) for (const d of b.DIRS) { const q = move + d; if (b.c[q] === opp && b.inAtari(b.chain[q])) { facts.push({ good: true, kind: 'atari', text: `Puts ${b.size[b.chain[q]] === 1 ? 'a stone' : b.size[b.chain[q]] + ' stones'} in atari.` }); break; } }
  return facts;
}
// A plain reason for a positional difference (no tactics involved)
const lineOf = (b, p) => { const [x, y] = b.xy(p), N = b.N; return Math.min(x, y, N - 1 - x, N - 1 - y); };
function whyBetter(b0, move, best, wr, bwr) {
  const me = b0.turn, opp = other(me), early = b0.moves < b0.N * b0.N / 5;
  const chances = `(The computer gives you about ${Math.round(wr * 100)}% winning chances after your move, ${Math.round(bwr * 100)}% after ${b0.name(best)}.)`;
  if (move && best && early && lineOf(b0, move) === 0 && lineOf(b0, best) >= 1) return 'Early in the game a stone on the edge claims almost nothing. Moves further in, on the third and fourth lines, are much bigger. ' + chances;
  if (move && best && early && lineOf(b0, move) === 1 && lineOf(b0, best) >= 2) return 'Early in the game, moves on the second line are small; the third and fourth lines claim more. ' + chances;
  if (move) {
    const own = b0.DIRS.map(d => move + d).filter(q => b0.c[q] === me);
    if (own.length && own.every(q => b0.libCount(q) >= 3) && !b0.DIRS.some(d => b0.c[move + d] === opp)) return 'Your move adds to a group that was already safe, which is slow. ' + chances;
  }
  if (best) {
    const b = b0.clone(); b._play(best, me);
    const pressed = b.DIRS.map(d => best + d).filter(q => b.c[q] === opp && b.libCount(q) <= 2);
    if (pressed.length) { const q = pressed[0], n = b.size[b.chain[q]]; return `It presses ${NAME(opp)}'s ${n === 1 ? 'stone' : n + ' stones'} at ${b0.name(b.chain[q])}, leaving ${b.libCount(q) === 1 ? 'one liberty' : 'two liberties'}. ` + chances; }
  }
  return chances;
}
const GRADES = [['best', 'Best', 0.02], ['good', 'Good', 0.06], ['inaccuracy', 'Inaccuracy', 0.12], ['mistake', 'Mistake', 0.25], ['blunder', 'Blunder', 2]];
// Grade a move. opts: { playouts, time, seed }
function review(b0, move, opts = {}) {
  const me = b0.turn, P = opts.playouts || 2500;
  const s = G.search(b0, { playouts: P, time: opts.time || 3000, seed: opts.seed });
  const best = s.top[0] || { move: 0, winrate: 0.5 };
  let mine = s.top.find(t => t.move === move && t.n > 40);
  let wr;
  if (mine) wr = mine.winrate;
  else { // not among the candidates the search looked at closely: look at the position after it
    const b = b0.clone(true); b.play(move);
    const r = G.search(b, { playouts: Math.max(400, P / 3), time: (opts.time || 3000) / 2, seed: (opts.seed || 1) + 1 });
    wr = 1 - (r.top[0] ? r.top[0].winrate : r.winrate);
  }
  let drop = Math.max(0, best.winrate - wr);
  if (move === best.move) drop = 0;
  const facts = tactics(b0, move), bad = facts.filter(f => f.bad), good = facts.filter(f => f.good);
  // a tactical mistake with big stakes is at least a mistake
  if (bad.some(f => f.kind === 'missed' || f.kind === 'ignored' || f.kind === 'selfatari') && drop < 0.12) drop = Math.max(drop, 0.12);
  const [grade, label] = GRADES.find(g => drop < g[2]);
  let text = '';
  if (bad.length) text = bad.map(f => f.text).join(' ');
  else if (good.length && drop < 0.06) text = good.map(f => f.text).join(' ') + (grade === 'best' ? ' Exactly what the computer would play.' : '');
  else if (grade === 'best') text = move === 0 ? 'Passing is right: there is nothing useful left to play.' : 'Exactly what the computer would play.';
  else if (grade === 'good') text = 'A solid move.';
  // a missed capture or a group left in atari names its own better move
  const tact = bad.find(f => (f.kind === 'missed' || f.kind === 'ignored') && f.lib);
  if (tact) return { grade, label, text: text.trim(), drop, winrate: wr, best: tact.lib, bestName: b0.name(tact.lib), facts };
  if (grade !== 'best' && grade !== 'good' && best.move !== move) {
    const bf = best.move ? tactics(b0, best.move).filter(f => f.good) : [];
    text += ` ${best.move ? `${b0.name(best.move)} was stronger` : 'Passing was better'}${bf.length ? ': it ' + bf[0].text.charAt(0).toLowerCase() + bf[0].text.slice(1) : '.'}`;
    if (!bf.length) text += ' ' + whyBetter(b0, move, best.move, wr, best.winrate);
  }
  return { grade, label, text: text.trim(), drop, winrate: wr, best: best.move, bestName: best.move ? b0.name(best.move) : 'pass', facts };
}

const api = { review, tactics, warn, inAtari, GRADES };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoTutor = api;
})(typeof self !== 'undefined' ? self : globalThis);
