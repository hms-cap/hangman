// Step-by-step walkthrough of a Go problem's solution. steps(p, tried) returns one step per position: the start, each
// move of the stored solution, a summary, and (if the learner had a wrong try) what went wrong with it.
// A step is { moves: [names played so far], text (HTML), libsOf: point name whose liberties to mark or null,
//   ghosts: [{ at, color }] stones just captured, ring: { at, kind } for the move just played, term: glossary id }.
// Captions are built from what actually happens on the board: captures, atari, liberties gained and lost, sacrifices.
(function (root) {
'use strict';
const G = root.Go || (typeof require !== 'undefined' && require('./go-core.js'));
const P = root.GoProblem || (typeof require !== 'undefined' && require('./go-problem.js'));
const { BLACK, WHITE, EMPTY, other } = G;

const TERM_LABEL = { atari: 'atari', liberty: 'liberties', ladder: 'ladders', net: 'nets', snapback: 'snapbacks', throwin: 'throw-ins', vital: 'the vital point', eye: 'eyes' };
const THEME_TERM = { atari: 'atari', chase: 'atari', ladder: 'ladder', net: 'net', snapback: 'snapback', throwin: 'throwin', escape: 'liberty', kill: 'vital', live: 'eye' };
const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const stonesTxt = (n, col) => `${n === 1 ? 'a' : n} ${col} stone${n === 1 ? '' : 's'}`;

function libNames(b, at) { return b.libs(at).map(q => b.name(q)).sort(); }

function steps(p, tried) {
  const { b: b0, o } = P.setup(p, []);
  const att = o.attacker, def = other(att), learnerAttacks = att === BLACK, region = !!o.region;
  const tgt = p.target, out = [];
  const alive = b => b.c[b.parse(tgt)] === def;
  const libsOf = b => alive(b) ? libNames(b, b.parse(tgt)) : [];

  // ---- the start ----
  {
    const L = libsOf(b0);
    let t = `<b>The goal:</b> ${P.GOALS[p.goal]} `;
    if (region) t += learnerAttacks
      ? 'The shaded points are White\'s eye space. A group needs <a data-term="eye">two separate eyes</a> to live, so the question is whether White can make two there.'
      : 'The shaded points are your eye space. Your group needs <a data-term="eye">two separate eyes</a> to live.';
    else t += `${learnerAttacks ? 'The marked white stones' : 'Your marked stones'} have <b>${L.length}</b> <a data-term="liberty">${L.length === 1 ? 'liberty' : 'liberties'}</a> (dotted): ${list(L)}.` +
      (L.length === 1 ? ` They are in <a data-term="atari">atari</a>.` : '') +
      (learnerAttacks ? ' Taking them all captures the stones.' : ' If White takes them all, the stones are captured.');
    out.push({ moves: [], text: t, libsOf: region ? null : tgt, ghosts: [], ring: null });
  }

  // ---- each move of the solution ----
  const line = p.line || [];
  for (let k = 0; k < line.length; k++) {
    const mv = line[k], col = k % 2 ? WHITE : BLACK, n = k + 1, who = col === BLACK ? 'Black' : 'White';
    const { b: pb } = P.setup(p, line.slice(0, k)), { b: nb } = P.setup(p, line.slice(0, k + 1));
    const ghosts = [];
    pb.points.forEach(q => { if (pb.c[q] === other(col) && nb.c[q] === EMPTY) ghosts.push({ at: pb.name(q), color: other(col) }); });
    const l0 = libsOf(pb), l1 = libsOf(nb), gone = !alive(nb);
    let t;
    if (mv === 'pass') t = `${who} has nothing useful to play and passes.`;
    else {
      const m = nb.parse(mv), self = nb.c[m] === col && nb.libCount(m) === 1;
      // opponent chains this move put in atari
      const hit = new Set();
      for (const d of nb.DIRS) { const q = m + d; if (nb.c[q] === other(col) && nb.libCount(q) === 1 && !(pb.c[q] === other(col) && pb.libCount(q) === 1)) hit.add(nb.chain[q]); }
      const hitStones = [...hit].reduce((s, h) => s + nb.stones(h).length, 0);
      const caps = ghosts.length, capCol = col === BLACK ? 'white' : 'black';
      const head = `<b>${who} ${n}</b> at ${mv}`;
      const mine = col === BLACK;
      if (mine && learnerAttacks) {
        if (gone) t = `${head} takes the last liberty: the marked stones are <a data-term="capture">captured</a>${caps > 1 ? ` (${caps} stones)` : ''}.`;
        else if (caps) t = `${head} captures ${stonesTxt(caps, 'white')}. The marked stones have ${l1.length} ${l1.length === 1 ? 'liberty' : 'liberties'} now.`;
        else if (self && (p.theme === 'snapback' || p.theme === 'throwin')) t = `${head} is a sacrifice: the stone has only one liberty, so White can take it. ` +
          (p.theme === 'snapback' ? 'That is the trap: if White captures, the capturing stones will be left in atari themselves. This is a <a data-term="snapback">snapback</a>.'
            : `It fills a liberty from the inside: the marked stones are down to <b>${l1.length}</b>. This is a <a data-term="throwin">throw-in</a>.`);
        else if (region && k === 0) t = `${head} takes the <a data-term="vital">vital point</a>: the point White needed to split the eye space into two eyes.` + (l1.length === 1 ? ` It also puts White in <a data-term="atari">atari</a>.` : '');
        else if (l1.length === 1) t = `${head} puts the marked stones in <a data-term="atari">atari</a>: one liberty left, at ${l1[0]}.` + (p.theme === 'ladder' && k > 0 ? ' The <a data-term="ladder">ladder</a> goes on, always toward the edge.' : '');
        else if (p.theme === 'net' && k === 0) t = `${head} doesn't give atari. It closes the way out: the marked stones still have ${l1.length} liberties, but every way out now runs into black stones. This is a <a data-term="net">net</a>.`;
        else if (region) t = `${head} ${hitStones ? `puts ${stonesTxt(hitStones, 'white')} in atari` : 'keeps the eye space too small'}: White still can't make a second eye.`;
        else t = `${head} takes a liberty: the marked stones are down to <b>${l1.length}</b> (${list(l1)}).`;
      } else if (mine) {
        if (caps) t = `${head} captures ${stonesTxt(caps, 'white')}${region ? ', which makes room for an eye' : ', so your stones get room to breathe'}.` + (!region && !gone ? ` They have ${l1.length} liberties now.` : '');
        else if (region && k === 0) t = `${head} takes the key point: now the group has room for <a data-term="eye">two separate eyes</a>.`;
        else if (region) t = `${head} makes sure of the second eye.`;
        else if (hitStones) t = `${head} puts ${stonesTxt(hitStones, 'white')} in <a data-term="atari">atari</a>, so White has to answer.` + (l1.length !== l0.length ? ` Your stones have ${l1.length} liberties.` : '');
        else if (l1.length > l0.length) t = `${head} extends: your stones now have <b>${l1.length}</b> <a data-term="liberty">liberties</a> (${list(l1)}).`;
        else t = `${head}: your stones have ${l1.length} liberties.`;
      } else if (learnerAttacks) { // White's answer while Black attacks
        if (caps) { const back = nb.libCount(m) === 1 && nb.c[m] === WHITE;
          t = `${head} captures ${stonesTxt(caps, 'black')}.` + (back ? ` But now White's stones have just one liberty, at ${nb.name(nb.atariLib(nb.chain[m]))}${p.theme === 'snapback' ? ', the point where Black\'s stone was' : ''}.` : ''); }
        else if (region) t = `${head} ${hitStones ? `puts ${stonesTxt(hitStones, 'black')} in atari` : 'tries to make room for a second eye'}.`;
        else if (hitStones) t = `${head} puts ${stonesTxt(hitStones, 'black')} in atari, hoping to break out.`;
        else if (l1.length > l0.length) t = `${head} runs: ${l1.length} liberties (${list(l1)}).` + (l1.length <= 2 ? ' Still not enough to get away.' : '');
        else if (l1.length === 1) t = `${head} runs, but there's nowhere to go: still only one liberty, at ${l1[0]}.`;
        else t = `${head} tries to get out, but the marked stones still have only ${l1.length} liberties.`;
      } else { // White attacks the learner's stones
        if (caps) t = `${head} captures ${stonesTxt(caps, 'black')}.`;
        else if (region) t = `${head} tries to spoil the eye space.`;
        else if (l1.length < l0.length) t = `${head} takes a liberty: your stones have ${l1.length} left.`;
        else t = `${head} blocks.`;
      }
    }
    out.push({ moves: line.slice(0, k + 1), text: t, libsOf: region || gone ? null : tgt, ghosts, ring: mv === 'pass' ? null : { at: mv, kind: col === BLACK ? 'b' : 'w' } });
  }

  // ---- what it all comes to ----
  {
    const { b: fb } = P.setup(p, line), L = libsOf(fb), gone = !alive(fb);
    let t = '<b>The result.</b> ';
    if (p.goal === 'capture') t += gone ? 'The marked stones are captured.' : `The marked stones have ${L.length === 1 ? 'one liberty left' : L.length + ' liberties'} and no way out: whatever White plays, Black captures them.`;
    else if (p.goal === 'save') t += `Your stones are safe: ${gone ? '' : `${L.length} liberties, and `}White can't capture them any more.`;
    else {
      const eyes = (o.region || []).filter(q => fb.isEye(q, p.goal === 'kill' ? WHITE : BLACK)).map(q => fb.name(q));
      t += p.goal === 'kill'
        ? `White can't make two separate eyes${eyes.length === 1 ? ` (only one, at ${eyes[0]})` : ''}, so the group is dead.`
        : `Your group has two separate eyes${eyes.length >= 2 ? ` (at ${list(eyes.slice(0, 2))})` : ''}, or is sure to get them: White can't fill both, so it lives.`;
    }
    const th = P.THEMES[p.theme];
    if (th) t += ` <b>The idea:</b> ${th[1]}`;
    const term = THEME_TERM[p.theme] || 'liberty';
    t += ` <a data-term="${term}">More about ${TERM_LABEL[term]} in the glossary</a>.`;
    out.push({ moves: line.slice(), text: t, libsOf: region || gone ? null : tgt, ghosts: [], ring: null, final: true });
  }

  // ---- the learner's wrong try, if any ----
  if (tried && tried.mv) {
    const mv2 = tried.moves.concat(tried.refute && tried.refute !== 'pass' ? [tried.mv, tried.refute] : [tried.mv]);
    out.push({ moves: mv2, text: `<b>Your try at ${tried.mv}.</b> ${tried.why}`, libsOf: region ? null : (P.setup(p, mv2).b.c[P.setup(p, []).b.parse(tgt)] === def ? tgt : null), ghosts: [], ring: { at: tried.mv, kind: 'bad' }, tried: true });
  }
  return out;
}

const api = { steps, THEME_TERM };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoExplain = api;
})(typeof self !== 'undefined' ? self : globalThis);
