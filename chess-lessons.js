// Chess Trainer lessons: a short lesson before each level (and each opening lesson), shown the first time it is
// started and on demand after. ChessLessons.pages(trackKey, levelIndex) -> [{ h, text (HTML), figs: [spec], wide }]
// ChessLessons.figure(spec) -> { svg, cap } draws a board. A spec:
//   { fen | pieces: { s64: 'N' | 'p' ... }, play: 'e2e4 e7e5' (uci moves played from the position, last one shown),
//     dots: 'd4' (every square that piece can move to) or dotsAt: 'e4 f5', arrows: 'e2e4 g1f3', good / bad / mark:
//     'e4 d5' (square highlights), stars: 'c6 g2', zone: 'b4 c4 ...' (shaded area), cap }
// Moves for the dots are worked out from the position, and every example is a real drill from the level
// (chess-trainer-core.js makeSet with a fixed seed), so the boards can't disagree with the drills.
(function (root) {
'use strict';
const C = root.Chess || (typeof require !== 'undefined' && require('./chess-core.js'));
const T = root.ChessTrainer || (typeof require !== 'undefined' && require('./chess-trainer-core.js'));
const PCS = root.ChessPieces || null;
const FILES = 'abcdefgh';
const sq = n => FILES.indexOf(n[0]) + 8 * (+n[1] - 1);          // 'e4' -> 0..63 (a1 = 0)
const nm = s => FILES[s & 7] + ((s >> 3) + 1);
const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const names = s => (s || '').split(/\s+/).filter(Boolean);

// pieces of a FEN as { s64: letter } (upper case white)
function piecesOfFen(fen) {
  const out = {}, rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { out[(7 - i) * 8 + f] = ch; f++; } } });
  return out;
}
// where a piece could move on this board (ignores checks: these are for showing how pieces move)
function reach(pieces, s) {
  const p = pieces[s]; if (!p) return [];
  const white = p === p.toUpperCase(), t = p.toUpperCase(), out = [], f0 = s & 7, r0 = s >> 3;
  const own = q => pieces[q] && (pieces[q] === pieces[q].toUpperCase()) === white;
  const at = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
  const ray = (df, dr, far) => { for (let k = 1; k < 8; k++) { const q = at(f0 + df * k, r0 + dr * k); if (q < 0 || own(q)) break; out.push(q); if (pieces[q] || !far) break; } };
  if (t === 'R' || t === 'Q') [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => ray(a, b, true));
  if (t === 'B' || t === 'Q') [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => ray(a, b, true));
  if (t === 'K') [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => ray(a, b, false));
  if (t === 'N') [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([a, b]) => { const q = at(f0 + a, r0 + b); if (q >= 0 && !own(q)) out.push(q); });
  if (t === 'P') {
    const d = white ? 1 : -1, one = at(f0, r0 + d);
    if (one >= 0 && !pieces[one]) { out.push(one); const two = at(f0, r0 + 2 * d); if ((white ? r0 === 1 : r0 === 6) && two >= 0 && !pieces[two]) out.push(two); }
    [-1, 1].forEach(df => { const q = at(f0 + df, r0 + d); if (q >= 0 && pieces[q] && !own(q)) out.push(q); });
  }
  return out;
}
// play uci moves on a FEN with the engine: { fen, last: [from, to], sans }
function playUci(fen, ucis) {
  const pos = new C.Position(fen), sans = []; let last = null;
  for (const u of ucis) {
    const m = pos.legal().find(x => C.Position.uci(x) === u);
    if (!m) throw new Error(`lesson: illegal move ${u} in ${fen}`);
    sans.push(pos.san(m)); pos.make(m); last = [sq(u.slice(0, 2)), sq(u.slice(2, 4))];
  }
  return { fen: pos.fen(), last, sans };
}
const sanLine = (fen, ucis) => { const r = playUci(fen, ucis), w = fen.split(' ')[1] !== 'b'; return r.sans.map((s, i) => { const ply = i + (w ? 0 : 1); return (ply % 2 === 0 ? `${(ply >> 1) + 1}.` : i === 0 ? `${(ply >> 1) + 1}…` : '') + s; }).join(' '); };

function figure(spec) {
  let pieces = spec.pieces ? Object.assign({}, spec.pieces) : piecesOfFen(spec.fen || C.START), last = null, flip = !!spec.flip;
  if (spec.play) { const r = playUci(spec.fen, names(spec.play)); pieces = piecesOfFen(r.fen); last = r.last; }
  const Z = 10, W = 8 * Z, X = s => (flip ? 7 - (s & 7) : s & 7) * Z, Y = s => (flip ? s >> 3 : 7 - (s >> 3)) * Z, cx = s => X(s) + Z / 2, cy = s => Y(s) + Z / 2;
  let h = `<svg class="cl" viewBox="0 0 ${W} ${W}" aria-hidden="true">`;
  for (let s = 0; s < 64; s++) h += `<rect class="${((s & 7) + (s >> 3)) % 2 ? 'cl-l' : 'cl-d'}" x="${X(s)}" y="${Y(s)}" width="${Z}" height="${Z}"/>`;
  const fill = (list, cls) => names(list).forEach(n => { const s = sq(n); h += `<rect class="${cls}" x="${X(s)}" y="${Y(s)}" width="${Z}" height="${Z}"/>`; });
  fill(spec.zone, 'cl-zone');
  if (last) last.forEach(s => { h += `<rect class="cl-last" x="${X(s)}" y="${Y(s)}" width="${Z}" height="${Z}"/>`; });
  fill(spec.good, 'cl-good'); fill(spec.bad, 'cl-bad'); fill(spec.mark, 'cl-mark');
  // coordinates on the edge squares
  for (let i = 0; i < 8; i++) { const fs = flip ? 7 - i : i, rs = flip ? i : 7 - i;
    h += `<text class="cl-c" x="${i * Z + Z - .9}" y="${W - .9}" text-anchor="end">${FILES[fs]}</text><text class="cl-c" x="${.8}" y="${i * Z + 2.6}">${rs + 1}</text>`; }
  for (const s in pieces) { const p = pieces[s], t = p.toLowerCase(), col = p === p.toUpperCase() ? 'w' : 'b';
    h += PCS ? PCS.pieceSVG(t, col).replace('<svg ', `<svg x="${X(+s)}" y="${Y(+s)}" width="${Z}" height="${Z}" `) : `<text x="${cx(+s)}" y="${cy(+s) + 3}" text-anchor="middle">${p}</text>`; }
  names(spec.stars).forEach(n => { const s = sq(n), x = cx(s), y = cy(s); h += `<path class="cl-star" d="M${x} ${y - 3.4}l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z"/>`; });
  const dots = spec.dots ? reach(pieces, sq(spec.dots)) : names(spec.dotsAt).map(sq);
  dots.forEach(s => { h += pieces[s] ? `<circle class="cl-ring" cx="${cx(s)}" cy="${cy(s)}" r="4.4"/>` : `<circle class="cl-dot" cx="${cx(s)}" cy="${cy(s)}" r="1.5"/>`; });
  names(spec.arrows).forEach(u => { const a = sq(u.slice(0, 2)), b = sq(u.slice(2, 4)), x1 = cx(a), y1 = cy(a), x2 = cx(b), y2 = cy(b), L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, ex = x2 - ux * 3, ey = y2 - uy * 3;
    h += `<path class="cl-arrow" d="M${x1 + ux * 2} ${y1 + uy * 2}L${ex} ${ey}"/><path class="cl-head" d="M${x2 - ux * .6} ${y2 - uy * .6}L${ex - uy * 2.2} ${ey + ux * 2.2}L${ex + uy * 2.2} ${ey - ux * 2.2}z"/>`; });
  return { svg: h + '</svg>', cap: spec.cap || '' };
}

// ---- worked examples from the level's own drills ----
const SEED = 20261025;
const item = (tk, li, k = 0) => { try { return T.makeSet(tk, li, SEED)[k] || null; } catch (e) { return null; } };
const uciOf = m => typeof m === 'string' ? m : C.Position.uci(m);
function example(tk, li, L) {
  const it = item(tk, li); if (!it) return [];
  const H = 'A worked example';
  const turn = f => (f.split(' ')[1] === 'b' ? 'Black' : 'White');
  switch (it.kind) {
    case 'route': {
      const pcs = { [it.from]: it.piece === 'P' ? 'P' : it.piece }; (it.targets || []).forEach((s, i) => { pcs[s] = (it.targetKinds && it.targetKinds[i]) || 'p'; }); (it.blockers || []).forEach(s => { pcs[s] = it.piece === 'P' ? 'N' : 'P'; });
      const arrows = it.path.slice(1).map((s, i) => nm(it.path[i]) + nm(s)).join(' ');
      return [{ h: H, wide: true, text: `Collect ${it.stars.length ? 'the star' + (it.stars.length > 1 ? 's' : '') : 'every black piece'} in as few moves as you can. The best route takes <b>${it.min}</b> move${it.min === 1 ? '' : 's'}:`,
        figs: [{ pieces: pcs, stars: it.stars.map(nm).join(' '), arrows, cap: '' }] }];
    }
    case 'goal': {
      const a = it.answers[0], san = playUci(it.fen, [a]).sans[0];
      const what = { check: 'give check', escape: 'get out of check', mate: 'give checkmate', castle: 'castle', promote: 'promote', ep: 'capture en passant' }[it.goal] || 'find the move';
      return [{ h: H, text: `${turn(it.fen)} to ${what}.`, figs: [{ fen: it.fen, cap: 'The position' }, { fen: it.fen, play: a, arrows: a.slice(0, 4), cap: `${san}${it.answers.length > 1 ? ` (or ${it.answers.length - 1} other way${it.answers.length > 2 ? 's' : ''})` : ''}` }] }];
    }
    case 'oname':
      return [{ h: H, text: `After <b>${it.moves}</b>: this is the <b>${it.answer}</b>. ${it.about || ''}`, figs: [{ fen: it.fen, cap: it.answer }], wide: true }];
    case 'oline': return olinePages(it, H);
    case 'trap': {
      const san = playUci(it.fen, [uciOf(it.line[0])]).sans[0];
      return [{ h: H, text: `<b>${it.name}.</b> After ${it.before.map((s, i) => (i % 2 ? '' : (i / 2 + 1) + '.') + s).join(' ')}: ${it.text}`, figs: [{ fen: it.fen, cap: 'The mistake has just been played' }, { fen: it.fen, play: uciOf(it.line[0]), cap: `${san}!` }] }];
    }
    case 'kpath': {
      const pcs = it.fen ? piecesOfFen(it.fen) : Object.assign({}, it.pieces);
      return [{ h: H, wide: true, text: `From ${nm(it.from)} to the star on ${nm(it.to)} takes <b>${it.min}</b> moves${it.guards && it.guards.length ? ', without landing on a square a black piece attacks (shaded)' : ''}:`,
        figs: [{ pieces: pcs, stars: nm(it.to), zone: (it.forbidden || []).filter(s => !pcs[s]).map(nm).join(' '), arrows: it.path.slice(1).map((s, i) => nm(it.path[i]) + nm(s)).join(' ') }] }];
    }
    case 'grab': {
      const pcs = Object.assign({}, it.pieces), seq = [it.from].concat(it.order);
      return [{ h: H, wide: true, text: `The knight takes all ${it.pawns.length} pawns in <b>${it.min}</b> moves by taking them in this order.${it.greedy > it.min ? ` Always going for the nearest pawn would take ${it.greedy}.` : ''}`,
        figs: [{ pieces: pcs, arrows: seq.slice(1).map((s, i) => nm(seq[i]) + nm(s)).join(' ') }] }];
    }
    case 'loose': {
      const sqs = it.answers.map(nm), w = it.answers.map(s => it.why[s] && it.why[s].san).filter(Boolean);
      return [{ h: H, wide: true, text: `The loose black piece${sqs.length > 1 ? 's are' : ' is'} on <b>${list(sqs)}</b>: ${list(w)} ${w.length > 1 ? 'each win' : 'wins'} material.`, figs: [{ fen: it.fen, good: sqs.join(' ') }] }];
    }
    case 'tactic': {
      const line = it.line.map(uciOf), san = sanLine(it.fen, line);
      return [{ h: H, text: `${turn(it.fen)} to play. ${it.text}`, figs: [{ fen: it.fen, arrows: line[0], cap: 'The position' }, { fen: it.fen, play: line.join(' '), cap: san }] }];
    }
    case 'square': {
      // the square: from the pawn (a pawn on its first square counts as one further on) to the last rank, toward the king
      const f = it.pawn & 7, r = Math.max(it.pawn >> 3, 2), n = 7 - r, dir = (it.bk & 7) >= f ? 1 : -1, zone = [];
      for (let rr = r; rr <= 7; rr++) for (let k = 0; k <= n; k++) { const ff = f + dir * k; if (ff >= 0 && ff < 8) zone.push(nm(rr * 8 + ff)); }
      return [{ h: H, wide: true, text: `Draw the square from the pawn to the last rank (shaded). ${it.catches ? 'The black king can step into it, so it catches the pawn.' : 'The black king can\'t get into it in time, so the pawn queens.'}${it.double ? ' The pawn is on its first square, so count its two-square first move.' : ''}`,
        figs: [{ fen: it.fen, zone: zone.join(' ') }] }];
    }
    case 'eg': return [{ h: 'A position from this level', wide: true, text: it.piece === 'P' ? (it.win === false ? 'Black to move and hold the draw: keep the king in front of the pawn.' : 'White to move and win: get the king in front of the pawn, take the opposition, and the pawn queens.') : `White to move and mate with the ${it.piece === 'Q' ? 'queen' : 'rook'} and king. The drill counts your moves: the fewer, the better.`, figs: [{ fen: it.fen }] }];
    case 'mate': {
      const line = it.line.map(uciOf), san = sanLine(it.fen, line);
      return [{ h: H, text: `${turn(it.fen)} mates in ${it.n}: <b>${san}</b>.`, figs: [{ fen: it.fen, arrows: line[0], cap: 'The position' }, { fen: it.fen, play: line.join(' '), cap: 'Checkmate' }] }];
    }
    case 'count': {
      const steps = it.line.map(x => x.san).join(', ');
      const word = { even: 'comes out even', win: 'wins material', lose: 'loses material' }[it.answer] || it.answer;
      return [{ h: H, wide: true, text: `${it.san} starts a run of captures on ${nm(it.target)}: ${steps}. Counted to the end, it ${word}.`, figs: [{ fen: it.fen, arrows: uciOf(it.move), mark: nm(it.target) }] }];
    }
  }
  return [];
}
// an opening line: the first few of the learner's moves, each with its idea
function olinePages(it, H) {
  const w = it.side === 'w', pages = [];
  const r = T.playSans(null, it.sans);
  const all = r.list.map(x => x.uci);
  let k = 0;
  for (let ply = 0; ply < all.length && pages.length < 3; ply++) {
    const mine = (ply % 2 === 0) === w;
    if (!mine) continue;
    const why = it.why[k++];
    pages.push({ h: pages.length ? `${it.fam}, move by move` : H, wide: true, text: `<b>${it.sans.slice(0, ply + 1).map((s, i) => (i % 2 ? '' : (i / 2 + 1) + '.') + s).join(' ')}</b>: ${why}`,
      figs: [{ fen: C.START, play: all.slice(0, ply + 1).join(' '), flip: !w }] });
  }
  return pages;
}

// ---- the idea pages, per level ----
const P = {
  'pieces:0': [{ h: 'The rook', text: 'The rook moves any number of squares along a row (rank) or column (file). It can\'t jump over pieces: it stops before one of its own, or captures an enemy piece in its way.', figs: [{ fen: '8/8/8/8/3R4/8/8/8 w - - 0 1', dots: 'd4', cap: 'From d4: 14 squares' }, { fen: '8/3P4/8/8/3R2n1/8/8/8 w - - 0 1', dots: 'd4', cap: 'Blocked by its own pawn; it can take the knight' }] }],
  'pieces:1': [{ h: 'The bishop', text: 'The bishop moves any number of squares diagonally. It never changes colour: a bishop that starts on a light square stays on light squares all game.', figs: [{ fen: '8/8/8/8/3B4/8/8/8 w - - 0 1', dots: 'd4', cap: 'From d4' }, { fen: '8/8/5p2/8/3B4/8/1P6/8 w - - 0 1', dots: 'd4', cap: 'Stopped by its own pawn; it can take on f6' }] }],
  'pieces:2': [{ h: 'The queen', text: 'The queen moves like a rook and a bishop together: any number of squares in a straight line, along rows, columns and diagonals. It is the strongest piece.', figs: [{ fen: '8/8/8/8/3Q4/8/8/8 w - - 0 1', dots: 'd4', cap: 'From d4: 27 squares' }] }],
  'pieces:3': [{ h: 'The king', text: 'The king moves one square in any direction. It may never move onto a square where it could be captured: that would be moving into check.', figs: [{ fen: '8/8/8/8/4K3/8/8/8 w - - 0 1', dots: 'e4', cap: 'One step any way' }] }],
  'pieces:4': [{ h: 'The knight', text: 'The knight jumps in an L: two squares one way and one square to the side. It is the only piece that can jump over others, and every move it changes square colour.', figs: [{ fen: '8/8/8/2pPp3/3N4/2P1P3/8/8 w - - 0 1', dots: 'd4', cap: 'It jumps over the pawns around it' }, { fen: '8/8/8/8/8/8/8/N7 w - - 0 1', dots: 'a1', cap: 'In the corner: just two moves' }] }],
  'pieces:5': [{ h: 'The pawn', text: 'A pawn moves straight forward one square, or two from its starting square. It captures differently: one square diagonally forward. It can\'t move or capture backwards.', figs: [{ fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', dots: 'e2', cap: 'From the start: one or two' }, { fen: '8/8/8/2n1b3/3P4/8/8/8 w - - 0 1', dots: 'd4', cap: 'Captures diagonally' }, { fen: '8/8/8/3p4/3P4/8/8/8 w - - 0 1', dots: 'd4', cap: 'Blocked: a piece in front stops it' }] }],
  'pieces:6': [{ h: 'Capturing', text: 'A piece captures by moving onto the square of an enemy piece, which comes off the board. Plan your route: the order you take things in decides how many moves it costs.', figs: [{ fen: '8/8/5p2/8/3B4/8/8/8 w - - 0 1', arrows: 'd4f6', cap: 'Bxf6: the bishop takes the pawn' }] }],
  'rules:0': [{ h: 'Check', text: 'A move that attacks the enemy king is a check. The king is never captured: the side in check has to deal with it straight away.', figs: [{ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', play: 'a1a8', bad: 'e8', cap: 'Ra8+: the rook checks along the rank' }] }],
  'rules:1': [{ h: 'Three ways out', text: 'When you are in check, you must get out of it. There are three ways: <b>move the king</b> to a safe square, <b>block</b> the check with a piece, or <b>capture</b> the checking piece.', figs: [{ fen: '6k1/8/8/8/8/3B4/5PPP/4r1K1 w - - 0 1', arrows: 'd3f1', bad: 'g1', cap: 'Block: Bf1' }, { fen: '6k1/8/8/8/8/8/2N2PPP/4r1K1 w - - 0 1', arrows: 'c2e1', bad: 'g1', cap: 'Capture: Nxe1' }, { fen: '6k1/8/8/8/8/8/5PP1/4r1K1 w - - 0 1', arrows: 'g1h2', bad: 'g1', cap: 'Move: Kh2' }] }],
  'rules:2': [{ h: 'Checkmate', text: 'Checkmate is a check with no way out: the king can\'t move, the check can\'t be blocked and the checker can\'t be taken. That ends the game. A classic: the back-rank mate, where the king\'s own pawns trap it.', figs: [{ fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1', arrows: 'e1e8', cap: 'Re8 is coming…' }, { fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1', play: 'e1e8', bad: 'g8', cap: '…checkmate' }] }],
  'rules:3': [{ h: 'Castling', text: 'Once a game, the king can move two squares toward a rook, and the rook jumps over to the other side of it. Allowed only if neither has moved, the squares between are empty, and the king is not in check, doesn\'t pass through check and doesn\'t land in check.',
    figs: [{ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', arrows: 'e1g1 e1c1', cap: 'Short (O-O) and long (O-O-O)' }, { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', play: 'e1g1', cap: 'After O-O' }] }],
  'rules:4': [{ h: 'Promotion', text: 'A pawn that reaches the last rank becomes a queen, rook, bishop or knight; nearly always a queen.', figs: [{ fen: '8/4P3/8/8/8/8/8/k6K w - - 0 1', play: 'e7e8q', cap: 'e8=Q' }] },
    { h: 'En passant', text: 'If a pawn moves two squares and lands right beside an enemy pawn, that pawn may capture it as if it had moved one: but only on the very next move.', figs: [{ fen: 'k7/3p4/8/4P3/8/8/8/K7 b - - 0 1', play: 'd7d5', cap: 'Black plays …d5, passing e5' }, { fen: 'k7/8/8/3pP3/8/8/8/K7 w - d6 0 1', play: 'e5d6', cap: 'exd6 en passant' }] }],
  'openings:0': [{ h: 'Reading an opening', text: 'Openings are named after their first moves. 1.e4 e5 leads to the open games (Italian, Ruy Lopez, Scotch). 1.e4 with anything else is a defence: …c5 Sicilian, …e6 French, …c6 Caro-Kann. 1.d4 d5 2.c4 is a Queen\'s Gambit; 1.d4 Nf6 an Indian defence.' }],
  'openings:1': [{ h: 'Opening principles', text: 'Take the centre with a pawn, bring out the knights and bishops, castle, then connect your rooks. Don\'t move the same piece twice without a reason, and don\'t bring the queen out early.', figs: [{ fen: C.START, arrows: 'e2e4 g1f3 f1c4', cap: 'Centre, knight, bishop…' }] }],
  'openings:2': [{ h: 'Answering 1.e4', text: 'Black\'s first question is how to fight for the centre: directly with …e5, from the side with …c5, or with a solid …e6 or …c6 followed by …d5.', figs: [{ fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', arrows: 'e7e5 c7c5 e7e6 c7c6', flip: true, cap: '…e5, …c5, …e6, …c6' }] }],
  'openings:3': [{ h: 'Queen\'s pawn openings', text: 'After 1.d4 the fight is about the c-pawn: c4 attacks d5 from the side. Bishops often aim down long diagonals, and the knights go to f3 and c3.', figs: [{ fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', arrows: 'c2c4', cap: 'The Queen\'s Gambit: c4' }] }],
  'openings:4': [{ h: 'Answering 1.d4', text: 'Black can hold the centre with pawns (…d5), or fight for it with pieces (…Nf6 and a fianchetto) and hit back later.', figs: [{ fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', arrows: 'd7d5 g8f6', flip: true, cap: '…d5 or …Nf6' }] }],
  'openings:5': [{ h: 'Traps', text: 'Your opponent has just made a famous mistake. It usually works because something is pinned or overloaded, or the king is short of squares. Look for checks first.' }],
  'openings:6': [{ h: 'Variations', text: 'Variations are named after their key moves: …a6 in the Najdorf, …g6 in the Dragon, …Bb4 in the Winawer, …d5 against c4 in the Grünfeld.' }],
  'vision:0': [{ h: 'Knight hops', text: 'Picture the knight\'s eight jumps from each square. Every jump changes colour, so a target on the same colour always takes an even number of moves.', figs: [{ fen: '8/8/8/8/3N4/8/8/8 w - - 0 1', dots: 'd4', cap: 'Eight jumps, all to dark squares' }] }],
  'vision:1': [{ h: 'Long routes', text: 'Count before you move. A knight crosses the board corner to corner in six moves; squares right next to each other take three.' }],
  'vision:2': [{ h: 'Safe squares', text: 'Now the black pieces guard squares, and your knight may not land on any of them. Work out where each piece attacks first, then plan around it.' }],
  'vision:3': [{ h: 'Plan the order', text: 'With several pawns to collect, the nearest one first is often not the shortest way round. Look at the whole tour before the first move.' }],
  'vision:4': [{ h: 'Loose pieces', text: 'A loose piece is one you can take without losing material: it isn\'t defended, or your attacker is worth less than it is. Values: pawn 1, knight and bishop 3, rook 5, queen 9.', figs: [{ fen: '8/8/3n4/8/8/8/8/3R4 w - - 0 1', arrows: 'd1d6', good: 'd6', cap: 'Nobody guards the knight' }, { fen: '8/2p5/3n4/8/8/8/8/3R4 w - - 0 1', arrows: 'd1d6', bad: 'd6', cap: 'Guarded: Rxd6 cxd6 loses the exchange' }] }],
  'vision:5': [{ h: 'Busier boards', text: 'Same question, more pieces. For each black piece ask: who attacks it, who defends it, and is my cheapest attacker worth less?' }],
  'tactics:0': [{ h: 'The knight fork', text: 'A fork attacks two things at once. Knights fork best, because nothing they attack can hit back along the same line. Forks with check are the strongest: the king must move, and you take the other piece.', figs: [{ fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', arrows: 'b5c7', cap: 'Nc7+…' }, { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', play: 'b5c7', bad: 'e8 a8', cap: '…forks king and rook' }] }],
  'tactics:1': [{ h: 'Forks by any piece', text: 'Queens, rooks, bishops, kings and pawns fork too. Look for a square from which one piece attacks two loose targets, or the king and something else.', figs: [{ fen: '8/1k6/8/3r4/8/8/8/4Q1K1 w - - 0 1', arrows: 'e1e4', cap: 'Qe4+ hits the king and the rook' }] }],
  'tactics:2': [{ h: 'The pin', text: 'A pin attacks a piece that can\'t move out of the way without exposing something more valuable behind it. Pinned to the king, it can\'t move at all.', figs: [{ fen: 'k7/8/8/3n4/8/8/8/K6B w - - 0 1', mark: 'g2 f3 e4 c6 b7', cap: 'The knight is pinned to the king' }] }],
  'tactics:3': [{ h: 'The skewer', text: 'A skewer is a pin the other way round: the valuable piece is in front. It has to move, and you take what was behind it.', figs: [{ fen: '3q4/8/8/3k4/8/8/8/R5K1 w - - 0 1', arrows: 'a1d1', cap: 'Rd1+: the king moves…' }, { fen: '3q4/8/8/3k4/8/8/8/R5K1 w - - 0 1', play: 'a1d1 d5e5 d1d8', cap: '…and Rxd8 takes the queen' }] }],
  'tactics:4': [{ h: 'Busy positions', text: 'Forks, pins and skewers, mixed in with real games\' clutter. Check every check and capture first: those are where tactics hide.' }],
  'tactics:5': [{ h: 'Combinations', text: 'Two moves that work together: the first (often a check or a sacrifice) drives a piece onto the square where the second move wins it.' }],
  'endgames:0': [{ h: 'The square', text: 'Can the king catch a passed pawn? Draw a square from the pawn to the last rank. If the king can step into that square, it catches the pawn. A pawn on its starting square counts its two-square move.' }],
  'endgames:1': [{ h: 'Queen and king', text: 'Use the queen a knight\'s move away from the enemy king to make its box smaller, one step at a time. Then bring your own king up and mate on the edge. Always check the king still has a move, or it is stalemate (a draw).' }],
  'endgames:2': [{ h: 'Rook and king', text: 'The rook cuts the king off along a rank or file. Bring your king up opposite the enemy king, then check with the rook to push it back a line. A waiting move with the rook keeps the box.' }],
  'endgames:3': [{ h: 'The opposition', text: 'Kings facing each other with one square between: whoever does NOT have to move has the opposition, and the other king must give way.', figs: [{ fen: '8/8/4k3/8/4K3/8/4P3/8 b - - 0 1', mark: 'e5', cap: 'Black to move: White has the opposition' }] }],
  'endgames:4': [{ h: 'Key squares', text: 'For a pawn on the fourth rank or lower, the squares two ranks in front of it (and beside them) are key: if your king reaches one, the pawn queens whatever the other king does.', figs: [{ fen: '8/8/8/8/4P3/8/8/4K3 w - - 0 1', good: 'd6 e6 f6', cap: 'Pawn on e4: d6, e6, f6' }] }],
  'endgames:5': [{ h: 'Holding the draw', text: 'Stay in front of the pawn. When the white king comes forward, step into the opposition. When the pawn reaches your second rank in front of your king, step straight back.' }],
  'mates:0': [{ h: 'Mate in one', text: 'Look at every check first. For each, ask: can the king move, can the check be blocked, can the checker be taken? If none, it is mate.' }],
  'mates:1': [{ h: 'Counting an exchange', text: 'When pieces can capture back and forth on one square, list the attackers from cheapest to dearest on both sides and play it through. Either side can stop whenever going on would lose.', figs: [{ fen: '8/8/2p5/3p4/4P3/5N2/8/8 w - - 0 1', arrows: 'e4d5', mark: 'd5', cap: 'exd5 cxd5: even so far' }] }],
  'mates:2': [{ h: 'Mate in two', text: 'Forcing moves first: checks, captures, threats. For each move you try, look at every reply. The first move is often a check, or a quiet move that cuts off the king.' }],
  'mates:3': [{ h: 'Batteries', text: 'Two pieces lined up on the same line (a battery: queen and rook, or queen and bishop) count as two attackers on that square, even though one stands behind the other.' }],
  'mates:4': [{ h: 'Harder mates in two', text: 'The checks may not work. Look for quiet moves that take away the king\'s last squares, or sacrifices that drag a defender away.' }],
  'mates:5': [{ h: 'Mate in three', text: 'Same method, one move deeper. Find the forcing moves, follow every reply, and keep checking the king has no escape at the end.' }],
};

function pages(tk, li) {
  const L = T.TRACKS.find(t => t.key === tk).levels[li];
  return (P[`${tk}:${li}`] || []).concat(example(tk, li, L));
}
// the lesson for one named opening: its idea, the opening position, and its first line move by move
function openingPages(les) {
  const D = T.openingData(), first = D.lines[les.lines[0]], fen = playUci(C.START, first.ucis.slice(0, first.famPly)).fen;
  return [{ h: les.fam, wide: true, text: `${les.about} It starts <b>${first.sans.slice(0, first.famPly).map((s, i) => (i % 2 ? '' : (i / 2 + 1) + '.') + s).join(' ')}</b>.`,
    figs: [{ fen: C.START, play: first.ucis.slice(0, first.famPly).join(' '), flip: first.side === 'b' }] }]
    .concat(olinePages(Object.assign({ kind: 'oline' }, first), `${first.name}, move by move`).slice(0, 3))
    .concat(les.traps.length ? [{ h: 'And a trap', text: `This lesson ends with ${les.traps.length === 1 ? 'a classic trap' : 'classic traps'} from this opening: ${les.traps.map(k => `<b>${D.traps[k].name}</b>`).join(' and ')}. Your opponent has just made the mistake; find the move that punishes it.` }] : []);
}

const api = { pages, openingPages, figure, reach, piecesOfFen, playUci };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ChessLessons = api;
})(typeof self !== 'undefined' ? self : globalThis);
