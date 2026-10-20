// Go trainer: the course (tracks of levels) and the drills for each level. Rules drills (liberties, where you may
// play, counting) are made here from a seed; technique drills use the solver-checked problems in go-problems-data.js.
// Used by go-trainer.html and tools/test-go-trainer.js.
(function (root) {
'use strict';
const G = root.Go || (typeof require !== 'undefined' && require('./go-core.js'));
const { BLACK, WHITE, EMPTY, other } = G;
const problems = () => root.GO_PROBLEMS || [];
const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const plural = (n, w) => `${n < 11 ? words[n] : n} ${n === 1 ? w : w.endsWith('y') ? w.slice(0, -1) + 'ies' : w + 's'}`;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

const TRACKS = [
  { key: 'rules', name: 'Learn the rules', beginner: true, blurb: 'Liberties, capturing, the moves you may not play, and counting the score.', levels: [
    { name: 'Liberties', kind: 'libs', count: 6, pass: 5, about: 'Tap every liberty of the marked stones: the empty points right next to them along the lines.',
      tip: 'Stones touch along the lines, not diagonally. Stones of one colour that touch form one group and share their liberties. A group with no liberties left is captured.' },
    { name: 'Capture', kind: 'pz', themes: ['atari'], maxRating: 520, count: 8, pass: 6, about: 'Stones with only one liberty left are "in atari". Take that liberty to capture them.',
      tip: 'Count the liberties of the white stones. When only one is left, playing there captures: the stones come off the board and count as prisoners.' },
    { name: 'Escape from atari', kind: 'pz', themes: ['escape'], inAtari: true, count: 8, pass: 6, about: 'Your stones are in atari. Save them, by adding liberties or by capturing a stone around them.',
      tip: 'Extending into open space adds liberties; extending toward the edge or into White\'s stones may not. Often the best escape is capturing a white stone that is itself short of liberties.' },
    { name: 'Where can you play?', kind: 'legal', count: 8, pass: 6, about: 'Is the marked point a legal move for Black? Learn suicide, capturing to make room, and ko.',
      tip: 'You may not play a stone with no liberties (suicide), unless it captures, which gives it liberties. Ko: if White has just captured one stone, Black may not take straight back; play elsewhere first.' },
    { name: 'Counting', kind: 'count', count: 6, pass: 5, about: 'The game is over. Count Black\'s score: stones on the board plus the empty points Black surrounds.',
      tip: 'This app counts by area: every stone you have on the board plus every empty point surrounded only by your stones. White also gets komi for moving second.' },
  ] },
  { key: 'capture', name: 'Capturing techniques', blurb: 'Read ahead: ladders, nets, throw-ins and snapbacks.', levels: [
    { name: 'Chase them down', kind: 'pz', themes: ['atari', 'chase'], minRating: 380, count: 8, pass: 6, about: 'Capture the marked stones, sometimes with more than one atari in a row.',
      tip: 'Atari from the side that pushes the stones toward the edge or toward your other stones, not into open space.' },
    { name: 'Ladders', kind: 'pz', themes: ['ladder'], count: 8, pass: 6, about: 'Chase the stones in a zigzag across the board until they run out of room.',
      tip: 'Keep the stones on one liberty every move. Before you start a ladder, look along its diagonal: a stone of theirs in the way breaks it.' },
    { name: 'Nets', kind: 'pz', themes: ['net'], count: 8, pass: 6, about: 'When atari would let the stones escape, a looser move can trap them.',
      tip: 'Look at every way out the stones have. A net (geta) covers them all at once, usually a diagonal or a knight\'s move away.' },
    { name: 'Throw-ins', kind: 'pz', themes: ['throwin'], count: 8, pass: 6, about: 'Sacrifice a stone where White would like to connect, to steal a liberty.',
      tip: 'A stone White must capture costs White a move and can leave White short of liberties.' },
    { name: 'Snapbacks', kind: 'pz', themes: ['snapback'], count: 6, pass: 4, about: 'Give up one stone; when White captures it, capture more stones right back.',
      tip: 'If White\'s capture leaves the capturing stones with one liberty, the point you lost is where you take them back.' },
    { name: 'Mixed techniques', kind: 'pz', themes: ['ladder', 'net', 'throwin', 'snapback', 'chase'], minRating: 850, count: 10, pass: 7, about: 'Any of the techniques, without being told which one.',
      tip: 'Try the forcing moves first: ataris and captures. Then ask what happens if the stones run, and where they would run to.' },
  ] },
  { key: 'saving', name: 'Saving stones', blurb: 'When your stones are under attack: run, capture, or connect.', levels: [
    { name: 'Rescue', kind: 'pz', themes: ['escape'], maxRating: 760, count: 8, pass: 6, about: 'Save the marked stones before White captures them.',
      tip: 'Count liberties after your move, then look at White\'s strongest reply. Two liberties are usually not enough if White can atari again.' },
    { name: 'Harder rescues', kind: 'pz', themes: ['escape'], minRating: 700, count: 8, pass: 6, about: 'The obvious escape doesn\'t always work. Find the move that does.',
      tip: 'Before you run, look for white stones next to yours that are short of liberties: capturing one often breaks out.' },
  ] },
  { key: 'life', name: 'Life and death', blurb: 'Two eyes live; one eye dies. Make them, or take them away.', levels: [
    { name: 'Kill: small spaces', kind: 'pz', themes: ['kill'], maxRegion: 4, count: 8, pass: 6, about: 'Stop the white group in the corner from making two eyes.',
      tip: 'A group needs two separate eyes to live. In a small eye space there is one key point, often the middle one: play there first.' },
    { name: 'Live: small spaces', kind: 'pz', themes: ['live'], maxRegion: 4, count: 8, pass: 6, about: 'Make two eyes for your group in the corner.',
      tip: 'The same key point that would kill you is usually the one that makes your two eyes.' },
    { name: 'Kill: bigger spaces', kind: 'pz', themes: ['kill'], minRegion: 5, count: 8, pass: 6, about: 'Bigger eye spaces. Shrink the space from outside or take the key point inside.',
      tip: 'Three in a row and bent three have a middle point. Four in a square is already dead. Larger spaces: reduce them from the edge, then take the key point.' },
    { name: 'Live: bigger spaces', kind: 'pz', themes: ['live'], minRegion: 5, count: 8, pass: 6, about: 'Make two eyes in a bigger corner.',
      tip: 'Widen your space if you can, or split it into two eyes. Check White\'s strongest reply each time.' },
    { name: 'Life and death mix', kind: 'pz', themes: ['kill', 'live'], minRating: 1000, count: 10, pass: 7, about: 'Kill or live: read the goal before you play.',
      tip: 'Find the eye space and its key points. Then read White\'s best answer to your move, not just the one you hope for.' },
  ] },
];

// ---------- problem levels ----------
function poolFor(L) {
  const N = 9;
  return problems().filter(p => L.themes.includes(p.theme)
    && (L.minRating == null || p.rating >= L.minRating) && (L.maxRating == null || p.rating <= L.maxRating)
    && (L.minRegion == null || (p.region && p.region.length >= L.minRegion)) && (L.maxRegion == null || (p.region && p.region.length <= L.maxRegion))
    && (!L.inAtari || targetLibs(p, N) === 1));
}
function targetLibs(p, N) {
  const b = new G.Board(N);
  for (let k = 0; k < N * N; k++) { const ch = p.stones[k]; if (ch !== '.') b._place(b.pt(k % N, (k / N) | 0), ch === 'X' ? BLACK : WHITE); }
  return b.libCount(b.parse(p.target));
}
function pick(r, list, n, seen) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  const fresh = a.filter(p => !seen.has(p.id)), old = a.filter(p => seen.has(p.id));
  return fresh.concat(old).slice(0, n);
}

// ---------- boards for rules drills ----------
const strOf = b => { let s = ''; for (let y = 0; y < b.N; y++) for (let x = 0; x < b.N; x++) { const v = b.c[b.pt(x, y)]; s += v === BLACK ? 'X' : v === WHITE ? 'O' : '.'; } return s; };
function boardOf(N, stones) { const b = new G.Board(N); for (let k = 0; k < N * N; k++) { const ch = stones[k]; if (ch !== '.') b._place(b.pt(k % N, (k / N) | 0), ch === 'X' ? BLACK : WHITE); } b.turn = BLACK; b.seen = new Set([b.key()]); return b; }
const anyZeroLibs = b => b.points.some(p => (b.c[p] === BLACK || b.c[p] === WHITE) && b.libCount(p) === 0);

// Liberties: a chain of 1–4 stones, some stones around it (diagonal ones too, to make the point that they don't count)
function libsItem(r) {
  const N = 7;
  for (let tries = 0; tries < 200; tries++) {
    const b = new G.Board(N), col = r() < 0.5 ? WHITE : BLACK;
    const len = 1 + ((r() * 4) | 0), start = b.points[(r() * b.points.length) | 0], tgt = [start];
    while (tgt.length < len) { const q = tgt[(r() * tgt.length) | 0] + b.DIRS[(r() * 4) | 0]; if (b.c[q] === EMPTY && !tgt.includes(q)) tgt.push(q); }
    tgt.forEach(p => b._place(p, col));
    const near = b.points.filter(q => b.c[q] === EMPTY && tgt.some(p => { const [x, y] = b.xy(p), [a, c] = b.xy(q); return Math.abs(x - a) <= 1 && Math.abs(y - c) <= 1; }));
    const n = 2 + ((r() * 4) | 0);
    for (let k = 0; k < n && near.length; k++) { const q = near.splice((r() * near.length) | 0, 1)[0]; b._place(q, r() < 0.6 ? other(col) : col); }
    if (anyZeroLibs(b)) continue;
    const head = b.chain[start]; if (tgt.some(p => b.chain[p] !== head)) continue;
    const libs = b.libs(start); if (libs.length < 2) continue;
    return { kind: 'libs', N, stones: strOf(b), target: b.name(start), color: col === BLACK ? 'B' : 'W', libs: libs.map(p => b.name(p)).sort(), size: b.stones(start).length };
  }
  return null;
}

// Where can you play? cases: an ordinary point, suicide, a capture that only looks like suicide, and ko
function legalItem(r, kind) {
  const N = 7;
  for (let tries = 0; tries < 400; tries++) {
    const b = new G.Board(N), P = (x, y) => b.pt(x, y);
    const ex = (r() * N) | 0, ey = (r() * N) | 0, e = P(ex, ey);
    const nb = b.DIRS.map(d => e + d).filter(q => b.c[q] !== G.EDGE);
    if (kind === 'ko') {
      // the white stone that just captured sits at w, next to e; Black's stones around w, White's around e
      if (nb.length < 3) continue;
      const w = nb[(r() * nb.length) | 0];
      for (const q of nb) if (q !== w) b._place(q, WHITE);
      for (const d of b.DIRS) { const q = w + d; if (q !== e && b.c[q] === EMPTY) b._place(q, BLACK); }
      b._place(e, BLACK); // the black stone White is about to capture
      sprinkle(b, r, 2, [e, w]);
      if (anyZeroLibs(b) || b.libCount(e) !== 1) continue;
      const pre = strOf(b); b.turn = WHITE; b.seen = new Set([b.key()]);
      if (b.play(w) < 0 || b.c[e] !== EMPTY || b.ko !== e) continue;
      if (b.legal(e)) continue;
      return { kind: 'legal', case: 'ko', N, stones: pre, play: b.name(w), point: b.name(e), answer: false,
        why: `White has just captured one stone at ${b.name(e)}. Taking straight back would bring back the same position, so the ko rule says Black must play somewhere else first, and may take back after that.` };
    }
    if (kind === 'suicide' || kind === 'capture') {
      for (const q of nb) b._place(q, WHITE);
      if (kind === 'capture') {
        // close the white stones in: every liberty except e taken by black stones
        for (const q of nb) for (const l of b.libs(q)) if (l !== e) b._place(l, BLACK);
      }
      sprinkle(b, r, 2, [e]);
      if (anyZeroLibs(b)) continue;
      const whiteAtari = nb.some(q => b.libCount(q) === 1);
      if (kind === 'capture' ? !nb.every(q => b.libCount(q) === 1) : whiteAtari) continue;
      b.turn = BLACK; b.seen = new Set([b.key()]);
      const ok = b.legal(e);
      if (ok !== (kind === 'capture')) continue;
      const t = b.clone(true); const caps = (t.play(e), t.caps[BLACK]);
      return { kind: 'legal', case: kind, N, stones: strOf(b), play: null, point: b.name(e), answer: kind === 'capture',
        why: kind === 'capture'
          ? `The point has no empty neighbours, but a black stone there takes the white stones' last liberty and captures ${plural(caps, 'stone')}. Once they come off, the black stone has liberties, so the move is allowed.`
          : `A black stone there would have no liberties, and it captures nothing because the white stones around it still have other liberties. That's suicide, which isn't allowed.` };
    }
    // ordinary: an empty point with at least one empty neighbour, among some stones
    sprinkle(b, r, 6 + ((r() * 5) | 0), []);
    if (anyZeroLibs(b) || b.c[e] !== EMPTY) continue;
    const libs = nb.filter(q => b.c[q] === EMPTY).length; if (libs < 1) continue;
    const touches = nb.some(q => b.c[q] === WHITE);
    b.turn = BLACK; b.seen = new Set([b.key()]); if (!b.legal(e)) continue;
    if (!touches && r() < 0.6) continue; // mostly points next to white stones, which look more doubtful
    return { kind: 'legal', case: 'free', N, stones: strOf(b), play: null, point: b.name(e), answer: true,
      why: `The stone would have ${plural(libs, 'liberty')} (${nb.filter(q => b.c[q] === EMPTY).map(q => b.name(q)).join(', ')}), so it's an ordinary legal move${touches ? ', even right next to White\'s stones' : ''}.` };
  }
  return null;
}
function sprinkle(b, r, n, avoid) {
  for (let k = 0; k < n; k++) {
    const q = b.points[(r() * b.points.length) | 0];
    if (b.c[q] !== EMPTY || avoid.includes(q) || avoid.some(a => b.DIRS.some(d => a + d === q))) continue;
    b._place(q, r() < 0.5 ? BLACK : WHITE);
  }
}

// Counting: a finished 7×7 game, Black on the left and White on the right of a wall that steps by at most one
function countItem(r) {
  const N = 7;
  for (let tries = 0; tries < 100; tries++) {
    const b = new G.Board(N), split = [];
    let s = 3 + ((r() * 2) | 0);
    for (let y = 0; y < N; y++) { if (y) s = Math.max(2, Math.min(N - 3, s + ((r() * 3) | 0) - 1)); split.push(s); }
    for (let y = 0; y < N; y++) { b._place(b.pt(split[y] - 1, y), BLACK); b._place(b.pt(split[y], y), WHITE); }
    // a stone or two inside each side's own area (they still count the same under area scoring)
    for (let k = 0; k < 2; k++) { const y = (r() * N) | 0, x = (r() * Math.max(1, split[y] - 2)) | 0; if (b.c[b.pt(x, y)] === EMPTY && r() < 0.5) b._place(b.pt(x, y), BLACK); }
    for (let k = 0; k < 2; k++) { const y = (r() * N) | 0, x = split[y] + 2 + ((r() * Math.max(1, N - split[y] - 2)) | 0); if (x < N && b.c[b.pt(x, y)] === EMPTY && r() < 0.5) b._place(b.pt(x, y), WHITE); }
    if (anyZeroLibs(b)) continue;
    b.komi = 0;
    const sc = b.score(new Set());
    if (sc.black + sc.white !== N * N) continue; // no neutral points
    const stonesB = b.points.filter(p => b.c[p] === BLACK).length, stonesW = b.points.filter(p => b.c[p] === WHITE).length;
    const answer = sc.black;
    const opts = new Set([answer]);
    for (const d of [stonesB, answer - stonesB, answer + 1, answer - 1, answer + 2, sc.white]) if (d > 0 && d !== answer && opts.size < 4) opts.add(d);
    const options = [...opts].sort((a, c) => a - c);
    if (options.length < 4) continue;
    return { kind: 'count', N, stones: strOf(b), answer, options, black: sc.black, white: sc.white, stonesB, stonesW, komi: 7.5 };
  }
  return null;
}

// The drills for a level: items in play order
function makeSet(tk, li, seed, seen = new Set()) {
  const L = TRACKS.find(t => t.key === tk).levels[li], r = rng(seed);
  if (L.kind === 'pz') return pick(r, poolFor(L), L.count, seen).map(p => ({ kind: 'pz', p }));
  const out = [];
  if (L.kind === 'legal') {
    const cases = ['free', 'suicide', 'capture', 'ko', 'free', 'suicide', 'capture', 'ko'];
    for (let i = cases.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [cases[i], cases[j]] = [cases[j], cases[i]]; }
    for (const c of cases.slice(0, L.count)) out.push(legalItem(r, c));
  } else for (let k = 0; k < L.count; k++) out.push(L.kind === 'libs' ? libsItem(r) : countItem(r));
  return out.filter(Boolean);
}
function stars(L, score, firstTry) {
  if (score < L.pass) return 0;
  if (score === L.count && (firstTry == null || firstTry === L.count)) return 3;
  return score >= L.count - 1 ? 2 : 1;
}
const api = { TRACKS, makeSet, poolFor, stars, rng, plural, boardOf, libsItem, legalItem, countItem };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoTrainer = api;
})(typeof self !== 'undefined' ? self : globalThis);
