// Chess tutor: grades a move against the engine's choice, explains it in plain words, and spots threats for the side to move.
// Loaded by chess.html and chess-worker.js (after chess-core.js); also runs in Node for tests (module.exports).
(function (root) {
'use strict';
const C = root.Chess || require('./chess-core.js');
const { WHITE, P, N, B, R, Q, K, pc, colorOf, typeOf, mFrom, mTo, mPromo, mFlags, F_CAP, F_EP, F_CASTLE, F_PROMO, sqName, MATE, analyse, mateIn } = C;

const NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const PV = [0, 1, 3, 3, 5, 9, 99];
const LABEL = { best: 'Best move', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' };
const SYMBOL = { inaccuracy: '?!', mistake: '?', blunder: '??' };
const RANK = { best: 0, excellent: 1, good: 2, inaccuracy: 3, mistake: 4, blunder: 5 };
const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14], B_OFF = [15, 17, -15, -17], R_OFF = [16, -16, 1, -1], K_OFF = [15, 16, 17, 1, -1, -15, -16, -17];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Squares of `by` pieces that attack sq directly (no x-rays).
function attackers(pos, sq, by) {
  const b = pos.b, out = [];
  for (const s of by === WHITE ? [sq - 15, sq - 17] : [sq + 15, sq + 17]) if (!(s & 0x88) && b[s] === pc(by, P)) out.push(s);
  for (const o of N_OFF) { const s = sq + o; if (!(s & 0x88) && b[s] === pc(by, N)) out.push(s); }
  for (const o of K_OFF) { const s = sq + o; if (!(s & 0x88) && b[s] === pc(by, K)) out.push(s); }
  for (const [offs, a, q] of [[B_OFF, B, Q], [R_OFF, R, Q]]) for (const o of offs) {
    let s = sq + o;
    while (!(s & 0x88)) { const p = b[s]; if (p) { if (colorOf(p) === by && (typeOf(p) === a || typeOf(p) === q)) out.push(s); break; } s += o; }
  }
  return out;
}

// Could the piece on `from` legally capture on `to` (as if it were its turn)?
function legalCapture(pos, from, to) {
  const by = colorOf(pos.b[from]);
  if (pos.turn !== by) {
    if (pos.inCheck()) return true; // can't pass the move while in check; assume the threat is real
    pos.makeNull(); const ok = pos.legal().some(m => mFrom(m) === from && mTo(m) === to); pos.unmakeNull(); return ok;
  }
  return pos.legal().some(m => mFrom(m) === from && mTo(m) === to);
}

// Pieces of `side` that can be won: attacked and either unprotected or attacked by something cheaper. Most valuable first.
function hanging(pos, side) {
  const out = [];
  for (let s = 0; s < 120; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = pos.b[s]; if (!p || colorOf(p) !== side) continue;
    const t = typeOf(p); if (t === K) continue;
    const def = attackers(pos, s, side).length > 0;
    const atk = attackers(pos, s, side ^ 1).filter(a => !(def && typeOf(pos.b[a]) === K) && legalCapture(pos, a, s));
    if (!atk.length) continue;
    atk.sort((a, b) => PV[typeOf(pos.b[a])] - PV[typeOf(pos.b[b])]);
    const byType = typeOf(pos.b[atk[0]]);
    if (!def || PV[byType] < PV[t]) out.push({ sq: s, type: t, by: atk[0], byType, free: !def });
  }
  return out.sort((a, b) => PV[b.type] - PV[a.type]);
}

// After `reply` (played from pos, where `us` is not to move): does the moved piece attack two or more of our valuable pieces?
function forkBy(pos, reply, us) {
  pos.make(reply);
  const s = mTo(reply), ty = typeOf(pos.b[s]), hit = [];
  if (!hanging(pos, us ^ 1).some(h => h.sq === s)) {
    for (let q = 0; q < 120; q++) {
      if (q & 0x88) { q += 7; continue; }
      const p = pos.b[q]; if (!p || colorOf(p) !== us || !attackers(pos, q, us ^ 1).includes(s)) continue;
      const t = typeOf(p);
      if (t === K || PV[t] > PV[ty] || (t !== P && !attackers(pos, q, us).length)) hit.push(t);
    }
  }
  pos.unmake();
  return hit.length >= 2 ? hit.sort((a, b) => PV[b] - PV[a]).slice(0, 2).map(t => NAME[t]) : null;
}

const isMate = s => Math.abs(s) > MATE - 1000;
// Moves to mate, from a score seen by the mover and measured from the position after their move.
function mateMoves(s) { const k = MATE - Math.abs(s); return s > 0 ? Math.floor(k / 2) + 1 : Math.max(1, Math.ceil(k / 2)); }
const winP = cp => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));
function cost(cp) {
  if (cp <= 150) return 'about a pawn'; if (cp <= 250) return 'about two pawns'; if (cp <= 420) return 'about a piece';
  if (cp <= 700) return 'about a rook'; if (cp <= 1100) return 'about a queen'; return 'more than a queen';
}

// Why a move is good, in a few words ('' if nothing simple to say). pos is before the move; hMine = our pieces in danger before it.
function reasonFor(pos, mv, hMine, ply) {
  const us = pos.turn, f = mFrom(mv), to = mTo(mv), ty = typeOf(pos.b[f]), fl = mFlags(mv);
  if (fl & F_CASTLE) return 'getting your king to safety';
  const victim = fl & F_EP ? P : fl & F_CAP ? typeOf(pos.b[to]) : 0;
  const theirsBefore = hanging(pos, us ^ 1);
  pos.make(mv);
  const mineAfter = hanging(pos, us), theirsAfter = hanging(pos, us ^ 1), check = pos.inCheck();
  pos.unmake();
  let r = '';
  if (fl & F_PROMO) r = `making a new ${NAME[mPromo(mv)]}`;
  else if (victim) r = (theirsBefore.some(h => h.sq === to) || PV[victim] > PV[ty]) ? `winning a ${NAME[victim]}` : `taking the ${NAME[victim]}`;
  else {
    const saved = hMine.find(h => h.sq === f) && !mineAfter.some(h => h.sq === to);
    const guarded = hMine.find(h => h.sq !== f && !mineAfter.some(x => x.sq === h.sq));
    const threat = theirsAfter.find(h => !theirsBefore.some(x => x.sq === h.sq) && PV[h.type] >= 3);
    if (saved) r = `moving your ${NAME[ty]} out of danger`;
    else if (guarded) r = `protecting your ${NAME[guarded.type]} on ${sqName(guarded.sq)}`;
    else if (threat) r = `attacking the ${NAME[threat.type]} on ${sqName(threat.sq)}`;
    else if (ply < 24 && (ty === N || ty === B) && (f >> 4) === (us === WHITE ? 0 : 7)) r = `developing your ${NAME[ty]}`;
    else if (ply < 12 && ty === P && [3, 4].includes(to & 7) && [3, 4].includes(to >> 4)) r = 'taking space in the center';
  }
  if (check && r) r += ' with check';
  return r;
}

// Grade move m (legal in pos) and explain it. opt: { time (ms per search), opp: name of the other side, e.g. 'the computer' }.
function review(pos, m, opt = {}) {
  const time = opt.time || 600, opp = opt.opp || 'your opponent', us = pos.turn, ply = pos.reps.length - 1;
  const legal = pos.legal(), san = pos.san(m, legal), f = mFrom(m), ty = typeOf(pos.b[f]), fl = mFlags(m);
  const hMine = hanging(pos, us);
  const best = analyse(pos, time).move || m;

  pos.make(m);
  const aM = analyse(pos, time);
  const reply = aM.move, replySan = reply ? pos.san(reply) : '';
  const hAfter = hanging(pos, us), mated = !pos.legal().length && pos.inCheck();
  const fork = reply && !mated ? forkBy(pos, reply, us) : null;
  const replyCaptures = reply && (mFlags(reply) & F_CAP);
  pos.unmake();

  const sPlayed = -aM.score;
  let sBest = sPlayed, bestSan = san;
  if (best !== m) {
    bestSan = pos.san(best, legal);
    pos.make(best); const aB = analyse(pos, time * 2, Math.max(1, aM.depth)); pos.unmake();
    sBest = Math.max(sPlayed, -aB.score);
  }

  const loss = Math.max(0, winP(sBest) - winP(sPlayed));
  let grade = best === m ? 'best' : loss < 0.02 ? 'excellent' : loss < 0.05 ? 'good' : loss < 0.10 ? 'inaccuracy' : loss < 0.15 ? 'mistake' : 'blunder';
  const allowsMate = sPlayed < -(MATE - 1000) && !(sBest < -(MATE - 1000));
  const missedMate = isMate(sBest) && sBest > 0 && !(sPlayed > MATE - 1000);
  if (allowsMate) grade = 'blunder';
  if (missedMate) { const want = mateMoves(sBest) <= 2 ? 'mistake' : 'inaccuracy'; if (RANK[grade] < RANK[want]) grade = want; }

  const t = [];
  if (mated) t.push('Checkmate — well played!');
  else if (RANK[grade] <= RANK.good) {
    const why = reasonFor(pos, m, hMine, ply);
    if (grade === 'best') t.push(why ? `Best move, ${why}.` : 'That’s the move the computer likes best.');
    else if (grade === 'excellent') t.push(why ? `Excellent, ${why}.` : 'Excellent — as good as the computer’s choice.');
    else t.push(`Good${why ? `, ${why}` : ''}. ${bestSan} was a little stronger.`);
  } else {
    if (allowsMate) { const n = mateMoves(sPlayed); t.push(`This lets ${opp} force mate${n === 1 ? ' at once' : ` in ${n}`}, starting with ${replySan}.`); }
    else if (missedMate) { const n = mateMoves(sBest); t.push(n === 1 ? `You had checkmate with ${bestSan}.` : `You had a forced mate in ${n}, starting with ${bestSan}.`); }
    else {
      const moved = hAfter.find(h => h.sq === mTo(m));
      const fresh = hAfter.find(h => h.sq !== mTo(m) && !hMine.some(x => x.sq === h.sq));
      const kept = hAfter.find(h => hMine.some(x => x.sq === h.sq));
      const where = h => `${NAME[h.type]} on ${sqName(h.sq)}`;
      if (moved) t.push(`Your ${where(moved)} can be taken ${moved.free ? 'for free' : `by the ${NAME[moved.byType]} on ${sqName(moved.by)}`}.`);
      else if (fresh) t.push(`It leaves your ${where(fresh)} ${fresh.free ? 'unprotected' : `open to the ${NAME[fresh.byType]} on ${sqName(fresh.by)}`}.`);
      else if (kept) t.push(`Your ${where(kept)} was under attack and still is.`);
      else if (fork) t.push(`${replySan} would fork your ${fork[0]} and ${fork[1]}.`);
      else if (grade !== 'inaccuracy' && reply) t.push(`${cap(opp)} can answer ${replySan}${replyCaptures ? ', winning material' : ''}.`);
      if (grade !== 'inaccuracy' && !isMate(sBest) && !isMate(sPlayed)) t.push(`That’s ${cost(sBest - sPlayed)} worse than the best move.`);
    }
    if (!missedMate && best !== m) { const why = reasonFor(pos, best, hMine, ply); t.push(`Better was ${bestSan}${why ? `, ${why}` : ''}.`); }
  }
  // Opening habits worth a gentle word, when the move wasn't the engine's choice anyway
  if (grade !== 'best' && grade !== 'blunder' && !mated) {
    if (ty === Q && ply < 14 && !(fl & F_CAP)) t.push('Tip: bringing the queen out early lets the other side chase it while developing.');
    else if (ty === K && !(fl & F_CASTLE) && (pos.castle & (us === WHITE ? 3 : 12))) t.push('Tip: moving your king gives up castling.');
  }

  return {
    ply: ply + 1, san, uci: C.Position.uci(m), grade, label: LABEL[grade], symbol: SYMBOL[grade] || '', text: t.join(' '),
    best: C.Position.uci(best), bestSan, reply: reply ? C.Position.uci(reply) : null, replySan,
    loss: isMate(sBest) || isMate(sPlayed) ? null : Math.round((sBest - sPlayed) / 10) / 10,
  };
}

// Threats against the side to move: a mate threat, or pieces that can be won. { text, arrows:[[from,to]] } or null.
// skip = a square to leave out (a piece the coach has already mentioned).
function warn(pos, opp = 'your opponent', skip = -1) {
  if (pos.inCheck()) return null;
  pos.makeNull();
  const mm = mateIn(pos, 1), mateSan = mm ? pos.san(mm) : '';
  pos.unmakeNull();
  if (mm) return { text: `Watch out: ${opp} threatens ${mateSan.replace('#', '')}, checkmate.`, arrows: [[mFrom(mm), mTo(mm)]] };
  const h = hanging(pos, pos.turn).filter(x => x.sq !== skip);
  if (!h.length) return null;
  const a = h[0];
  let text = `Watch out: your ${NAME[a.type]} on ${sqName(a.sq)} is attacked by the ${NAME[a.byType]} on ${sqName(a.by)}${a.free ? ' and isn’t protected' : ''}.`;
  if (h.length > 1) text += ` Your ${NAME[h[1].type]} on ${sqName(h[1].sq)} is in danger too.`;
  return { text, arrows: h.slice(0, 2).map(x => [x.by, x.sq]) };
}

const api = { review, warn, hanging, attackers, LABEL, SYMBOL };
root.ChessTutor = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
