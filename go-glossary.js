// Go glossary: the key terms with small diagrams. Every diagram is built by placing stones and playing moves on a real
// board (go-core.js), so captures and liberties are always right. The technique terms (ladder, net, snapback,
// throw-in, vital point) use a real problem from go-problems-data.js when it is loaded: its start, and after the solution.
//   GoGlossary.html()           the glossary as HTML (index chips + one card per term)
//   GoGlossary.diagram(spec)    one diagram as SVG
//   GoGlossary.linkify(html)    wraps known terms in <a data-term="id"> (outside tags and existing links)
//   GoGlossary.TERMS            [{ id, term, text, frames: [spec] }]
// A spec: { n (board size) | crop: [x0, y0, x1, y1] on a problem board, B: 'C3 D4', W: '...', stones: 81-char problem
//   string, moves: 'C2 B2' (Black first unless first: 'W'), libs: 'C3' (mark that group's liberties), try: 'C2' (dashed
//   ring: the move to look at), no: 'B3' (a cross: can't play here), eye: 'A1' (an eye), target: 'C3' (marked stones),
//   region: [names] (shaded), cap: caption }
(function (root) {
'use strict';
const G = root.Go || (typeof require !== 'undefined' && require('./go-core.js'));
const { BLACK, WHITE, EMPTY } = G;
const names = s => (s || '').split(/\s+/).filter(Boolean);

function build(spec) {
  const N = spec.stones ? Math.round(Math.sqrt(spec.stones.length)) : spec.n, b = new G.Board(N);
  if (spec.stones) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ch = spec.stones[y * N + x]; if (ch === 'X') b._place(b.pt(x, y), BLACK); else if (ch === 'O') b._place(b.pt(x, y), WHITE); }
  names(spec.B).forEach(s => b._place(b.parse(s), BLACK));
  names(spec.W).forEach(s => b._place(b.parse(s), WHITE));
  b.turn = spec.first === 'W' ? WHITE : BLACK; b.seen = new Set([b.key()]);
  const num = new Map(); let ghosts = [];
  names(spec.moves).forEach((s, k) => {
    const before = b.c.slice(), col = b.turn;
    if (b.play(b.parse(s)) < 0) throw new Error(`glossary diagram: illegal move ${s}`);
    ghosts = b.points.filter(q => before[q] !== EMPTY && b.c[q] === EMPTY).map(q => [q, before[q]]);
    for (const [q] of ghosts) num.delete(q);
    num.set(b.parse(s), k + 1);
  });
  return { b, N, num, ghosts };
}

const CELL = 10;
function diagram(spec) {
  const { b, N, num, ghosts } = build(spec);
  const [x0, y0, x1, y1] = spec.crop || [0, 0, N - 1, N - 1];
  const P = 6, W = (x1 - x0) * CELL + 2 * P, H = (y1 - y0) * CELL + 2 * P, X = x => P + (x - x0) * CELL, Y = y => P + (y - y0) * CELL;
  let h = `<svg class="gd" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect class="gd-bg" width="${W}" height="${H}" rx="2"/>`;
  const at = s => b.xy(b.parse(s));
  for (const s of spec.region || []) { const [x, y] = at(s); if (x >= x0 && x <= x1 && y >= y0 && y <= y1) h += `<rect class="gd-zone" x="${X(x) - CELL / 2}" y="${Y(y) - CELL / 2}" width="${CELL}" height="${CELL}"/>`; }
  // lines run on past the frame where the board goes on, and stop at a real edge
  const ext = (lo, edge) => lo === edge ? 0 : P;
  for (let y = y0; y <= y1; y++) h += `<line class="gd-ln${y === 0 || y === N - 1 ? ' e' : ''}" x1="${X(x0) - ext(x0, 0)}" y1="${Y(y)}" x2="${X(x1) + ext(x1, N - 1)}" y2="${Y(y)}"/>`;
  for (let x = x0; x <= x1; x++) h += `<line class="gd-ln${x === 0 || x === N - 1 ? ' e' : ''}" x1="${X(x)}" y1="${Y(y0) - ext(y0, 0)}" x2="${X(x)}" y2="${Y(y1) + ext(y1, N - 1)}"/>`;
  const libMarks = new Set();
  names(spec.libs).forEach(s => { const p = b.parse(s); if (b.c[p] === BLACK || b.c[p] === WHITE) b.libs(p).forEach(q => libMarks.add(q + (b.libCount(p) === 1 ? '!' : ''))); });
  const target = new Set(); names(spec.target).forEach(s => { const p = b.parse(s); if (b.c[p] !== EMPTY) b.stones(p).forEach(q => target.add(q)); });
  for (const [q, col] of ghosts) { const [x, y] = b.xy(q); h += `<circle class="gd-ghost ${col === BLACK ? 'b' : 'w'}" cx="${X(x)}" cy="${Y(y)}" r="4.3"/>`; }
  for (const p of b.points) {
    const [x, y] = b.xy(p), v = b.c[p];
    if (x < x0 || x > x1 || y < y0 || y > y1 || (v !== BLACK && v !== WHITE)) continue;
    h += `<circle class="gd-${v === BLACK ? 'b' : 'w'}" cx="${X(x)}" cy="${Y(y)}" r="4.5"/>`;
    if (num.has(p)) h += `<text class="gd-n ${v === BLACK ? 'onb' : 'onw'}" x="${X(x)}" y="${Y(y) + .3}">${num.get(p)}</text>`;
    else if (target.has(p)) h += `<rect class="gd-t" x="${X(x) - 1.6}" y="${Y(y) - 1.6}" width="3.2" height="3.2" style="stroke:${v === BLACK ? 'var(--gd-w)' : 'var(--gd-mark)'}"/>`;
  }
  // a book-style sequence: every move numbered on the starting position (captures not taken off)
  const seqNotes = [];
  if (spec.seq) { const placed = new Map();
    names(spec.seq).forEach((s, k) => { const q = b.parse(s), [x, y] = b.xy(q), black = k % 2 === 0;
      if (placed.has(q)) { seqNotes.push(`${k + 1} at ${placed.get(q)}`); return; }
      placed.set(q, k + 1);
      h += `<circle class="gd-${black ? 'b' : 'w'}" cx="${X(x)}" cy="${Y(y)}" r="4.5"/><text class="gd-n ${black ? 'onb' : 'onw'}" x="${X(x)}" y="${Y(y) + .3}">${k + 1}</text>`; }); }
  for (const m of libMarks) { const one = String(m).endsWith('!'), q = parseInt(m, 10), [x, y] = b.xy(q); h += `<circle class="gd-lib${one ? ' one' : ''}" cx="${X(x)}" cy="${Y(y)}" r="1.8"/>`; }
  names(spec.eye).forEach(s => { const [x, y] = at(s); h += `<rect class="gd-eye" x="${X(x) - 2.4}" y="${Y(y) - 2.4}" width="4.8" height="4.8" rx="1"/>`; });
  names(spec.try).forEach((s, i) => { const [x, y] = at(s); h += `<circle class="gd-try" cx="${X(x)}" cy="${Y(y)}" r="4.3"/>` + (spec.tryNum !== false ? `<text class="gd-n tryn" x="${X(x)}" y="${Y(y) + .3}">${i + 1}</text>` : ''); });
  names(spec.no).forEach(s => { const [x, y] = at(s); h += `<path class="gd-no" d="M${X(x) - 2.6} ${Y(y) - 2.6}l5.2 5.2M${X(x) + 2.6} ${Y(y) - 2.6}l-5.2 5.2"/>`; });
  h += '</svg>';
  return spec.withNotes ? { svg: h, notes: seqNotes } : h;
}
// SVG plus the caption, with any "3 at 1" notes added
function figure(f) {
  const r = diagram(Object.assign({}, f, { withNotes: true }));
  return { svg: r.svg, cap: (f.cap || '') + (r.notes.length ? ` (${r.notes.join(', ')})` : '') };
}

// ---- the terms ----
const TERMS = [
  { id: 'liberty', term: 'Liberty', text: 'The empty points right next to a stone, along the lines (not diagonally). Stones that are joined share their liberties. A stone or group with no liberties left is captured.',
    frames: [{ n: 5, B: 'C3', libs: 'C3', cap: 'In the open: 4 liberties' }, { n: 5, B: 'A1', libs: 'A1', cap: 'In the corner: only 2' }, { n: 5, B: 'C3 D3', libs: 'C3', cap: 'Two stones joined: 6' }] },
  { id: 'group', term: 'Group (chain)', text: 'Stones of one colour next to each other along the lines form a group. They live or die together and share their liberties. Stones that only touch diagonally are separate.',
    frames: [{ n: 5, B: 'B3 C3 C2', libs: 'C3', cap: 'One group of three' }, { n: 5, B: 'B2 C3', libs: 'B2 C3', cap: 'Diagonal: two separate stones' }] },
  { id: 'atari', term: 'Atari', text: 'A stone or group with only one liberty left is in atari: the opponent can capture it on the next move by playing there. Escape by adding liberties, or capture something around you.',
    frames: [{ n: 5, W: 'C3', B: 'B3 C4 D3', libs: 'C3', cap: 'White has one liberty: atari' }, { n: 5, W: 'B4 C4', B: 'A4 B5 C5 D4 B3', libs: 'B4', cap: 'Two stones in atari' }] },
  { id: 'capture', term: 'Capture', text: 'Take the last liberty of a stone or group and it is removed from the board. Each captured stone is a point for the capturer, and the empty points can become your territory.',
    frames: [{ n: 5, W: 'C3', B: 'B3 C4 D3', try: 'C2', cap: 'Black plays 1 in the last liberty…' }, { n: 5, W: 'C3', B: 'B3 C4 D3', moves: 'C2', cap: '…and the white stone comes off' }] },
  { id: 'selfatari', term: 'Suicide and self-atari', text: 'You may not play where your stone would have no liberties, unless the move captures something (that would be suicide). Playing where your stone has just one liberty is allowed, but it can be captured at once: self-atari. Sometimes that is exactly the point (see snapback and throw-in).',
    frames: [{ n: 5, W: 'B1 A2 C2 B3', no: 'B2', cap: 'Black can\'t play here: suicide' }, { n: 5, W: 'A2 C2 B3', moves: 'B2', libs: 'B2', cap: 'Legal, but in atari: self-atari' }] },
  { id: 'eye', term: 'Eye (two eyes)', text: 'An eye is an empty point surrounded by one player\'s stones. The opponent can\'t play there, as it would be suicide. A group with one eye can still be captured, by filling its outside liberties and then the eye. A group with two separate eyes can never be captured: it lives.',
    frames: [{ n: 5, B: 'A2 B2 B1', W: 'A3 B3 C3 C2 C1', eye: 'A1', cap: 'One eye: White can still fill the outside, then A1' }, { n: 5, B: 'A2 B2 C2 D2 D1 B1', W: 'A3 B3 C3 D3 E3 E2 E1', eye: 'A1 C1', cap: 'Two eyes: alive for good' }] },
  { id: 'ko', term: 'Ko', text: 'A shape where each side could capture one stone back and forth forever. The rule: after a ko capture, the other player may not take back straight away. They must play somewhere else first, usually a threat the opponent has to answer.',
    frames: [{ n: 5, B: 'B4 A3 B2', W: 'C4 D3 C2 B3', try: 'C3', cap: 'Black 1 captures…' }, { n: 5, B: 'B4 A3 B2', W: 'C4 D3 C2 B3', moves: 'C3', no: 'B3', cap: '…White may not retake at once' }] },
  { id: 'ladder', term: 'Ladder', theme: 'ladder', text: 'Atari after atari from the same side, driving the stones in a zigzag toward the edge. Each time they extend they get only two liberties, and the next atari takes one away. A ladder only works if no friendly stone stands in its path.' },
  { id: 'net', term: 'Net', theme: 'net', text: 'A loose move that doesn\'t give atari but blocks every way out. Ataris would only push the stones into open space; the net leaves them liberties but nowhere to go.' },
  { id: 'snapback', term: 'Snapback', theme: 'snapback', text: 'Put a stone where it can be captured. When the opponent takes it, the capturing stones are left with a single liberty, the point you just lost, and you play there again to capture them all.' },
  { id: 'throwin', term: 'Throw-in', theme: 'throwin', text: 'A sacrifice played inside the opponent\'s shape. It takes away a liberty or an eye from the inside; when they capture it, they have lost time and liberties.' },
  { id: 'vital', term: 'Vital point (eye space)', theme: 'kill', text: 'The eye space is the empty area inside a group where it can make eyes. Its vital point is the point that decides whether it can be split into two eyes: whoever plays there first decides if the group lives or dies. For three points in a row, it is the middle.',
    frames: [{ n: 5, W: 'A2 B2 C2 D2 D1', B: 'A3 B3 C3 D3 E3 E2 E1', first: 'W', moves: 'B1', eye: 'A1 C1', cap: 'White 1 in the middle: two eyes, alive' },
      { n: 5, W: 'A2 B2 C2 D2 D1', B: 'A3 B3 C3 D3 E3 E2 E1', moves: 'B1', cap: 'Black 1 there first: only one eye, dead' }] },
];

// a corner of a problem big enough to show the fight
function cropFor(p) {
  const N = Math.round(Math.sqrt(p.stones.length)), b = new G.Board(N), pts = [];
  const add = s => { const [x, y] = b.xy(b.parse(s)); pts.push([x, y]); };
  (p.line || []).forEach(add); add(p.target); (p.region || []).forEach(add);
  let x0 = Math.min(...pts.map(q => q[0])) - 1, x1 = Math.max(...pts.map(q => q[0])) + 1, y0 = Math.min(...pts.map(q => q[1])) - 1, y1 = Math.max(...pts.map(q => q[1])) + 1;
  // reach the edge if close, and keep at least 5×5
  if (x0 <= 1) x0 = 0; if (y0 <= 1) y0 = 0; if (x1 >= N - 2) x1 = N - 1; if (y1 >= N - 2) y1 = N - 1;
  while (x1 - x0 < 4) { if (x0 > 0) x0--; else x1++; } while (y1 - y0 < 4) { if (y0 > 0) y0--; else y1++; }
  return [Math.max(0, x0), Math.max(0, y0), Math.min(N - 1, x1), Math.min(N - 1, y1)];
}
const area = c => (c[2] - c[0] + 1) * (c[3] - c[1] + 1);
const exampleCache = {};
function exampleFor(theme) {
  if (theme in exampleCache) return exampleCache[theme];
  const PZ = root.GO_PROBLEMS || [];
  const pool = PZ.filter(p => p.theme === theme && p.line && p.line.length >= (theme === 'kill' ? 1 : 2) && p.line.length <= 7)
    .map(p => ({ p, c: cropFor(p) })).sort((a, b) => area(a.c) - area(b.c) || a.p.rating - b.p.rating);
  return (exampleCache[theme] = pool[0] || null);
}
function framesFor(t) {
  const own = t.frames || [];
  if (!t.theme) return own;
  const ex = exampleFor(t.theme); if (!ex) return own;
  return own.concat(problemFrames(ex));
}
function problemFrames(ex) {
  const { p, c } = ex, base = { stones: p.stones, crop: c, region: p.region || null };
  const goal = { capture: 'Capture the marked stones', kill: 'Kill the corner group' }[p.goal] || 'Black to play';
  const fr = [Object.assign({}, base, { target: p.target, try: p.line[0], cap: `${goal}: Black starts at 1` })];
  if (p.line.length > 1) fr.push(Object.assign({}, base, { seq: p.line.join(' '), cap: `The sequence, 1 to ${p.line.length}` }));
  fr.push(Object.assign({}, base, { moves: p.line.join(' '), cap: p.line.length > 1 ? 'The result (dotted: captured)' : 'After 1: the group can\'t make two eyes' }));
  return fr;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function html() {
  ensureStyle();
  return `<div class="gl-index">${TERMS.map(t => `<a data-term="${t.id}">${esc(t.term.replace(/ \(.*\)/, ''))}</a>`).join('')}</div>` +
    TERMS.map(t => `<section class="gl-term" id="gl-${t.id}"><h3>${esc(t.term)}</h3><p>${linkify(esc(t.text), t.id)}</p><div class="gl-frames">${framesFor(t).map(f => { const g = figure(f); return `<figure>${g.svg}<figcaption>${esc(g.cap)}</figcaption></figure>`; }).join('')}</div></section>`).join('');
}

// ---- linking terms in text ----
const WORDS = [
  [/\b(liberty|liberties)\b/i, 'liberty'], [/\batari\b/i, 'atari'], [/\b(captur(e|es|ed|ing))\b/i, 'capture'],
  [/\b(ladder|ladders)\b/i, 'ladder'], [/\bnet\b/i, 'net'], [/\b(snapback|snapbacks)\b/i, 'snapback'], [/\b(throw-in|throw-ins)\b/i, 'throwin'],
  [/\bko\b/i, 'ko'], [/\b(two (separate )?eyes|an eye|eyes|eye)\b/i, 'eye'], [/\b(vital point|key point|eye space)\b/i, 'vital'],
  [/\b(suicide|self-atari)\b/i, 'selfatari'], [/\b(group)\b/i, 'group'],
];
// Wrap the first mention of each term (outside tags and existing links); `skip` leaves one term alone (the card's own).
function linkify(s, skip) {
  const used = new Set(skip ? [skip] : []);
  s.replace(/data-term="([a-z]+)"/g, (_, id) => used.add(id)); // terms already linked stay as they are
  return s.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/).map(part => {
    if (!part || part[0] === '<') return part;
    let out = '', rest = part;
    for (;;) {
      let best = null;
      for (const [re, id] of WORDS) { if (used.has(id)) continue; const m = re.exec(rest); if (m && (!best || m.index < best.m.index)) best = { m, id }; }
      if (!best) break;
      used.add(best.id);
      out += rest.slice(0, best.m.index) + `<a data-term="${best.id}">${best.m[0]}</a>`;
      rest = rest.slice(best.m.index + best.m[0].length);
    }
    return out + rest;
  }).join('');
}

let styled = false;
function ensureStyle() {
  if (styled || typeof document === 'undefined') return; styled = true;
  const st = document.createElement('style');
  st.textContent = `
:root{--gd-bg:#e9dcb8;--gd-line:#5b4a2c;--gd-b:#1f2a33;--gd-w:#fbfbf6;--gd-w-edge:#3a4650;--gd-mark:#c4353d;--gd-good:#2f8a5b;--gd-zone:rgba(46,94,166,.16);--gd-try:#2e5ea6}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--gd-bg:#3b4f63;--gd-line:#c9d6e2;--gd-b:#0b141c;--gd-w:#eef3f7;--gd-w-edge:#93a9bd;--gd-mark:#ff8a8a;--gd-good:#5cc08a;--gd-zone:rgba(140,194,255,.18);--gd-try:#8cc2ff}}
:root[data-theme="dark"]{--gd-bg:#3b4f63;--gd-line:#c9d6e2;--gd-b:#0b141c;--gd-w:#eef3f7;--gd-w-edge:#93a9bd;--gd-mark:#ff8a8a;--gd-good:#5cc08a;--gd-zone:rgba(140,194,255,.18);--gd-try:#8cc2ff}
.gd{display:block;width:100%;height:auto;border-radius:6px}
.gd-bg{fill:var(--gd-bg)} .gd-zone{fill:var(--gd-zone)}
.gd-ln{stroke:var(--gd-line);stroke-width:.35} .gd-ln.e{stroke-width:.6}
.gd-b{fill:var(--gd-b)} .gd-w{fill:var(--gd-w);stroke:var(--gd-w-edge);stroke-width:.35}
.gd-ghost{fill:none;stroke-width:.5;stroke-dasharray:1 1} .gd-ghost.b{stroke:var(--gd-b)} .gd-ghost.w{stroke:var(--gd-w-edge)}
.gd-n{font-family:var(--mono,monospace);font-size:4.2px;font-weight:600;text-anchor:middle;dominant-baseline:central} .gd-n.onb{fill:var(--gd-w)} .gd-n.onw{fill:var(--gd-b)}
.gd-n.tryn{fill:var(--gd-try)}
.gd-t{fill:none;stroke-width:.7}
.gd-lib{fill:var(--gd-good)} .gd-lib.one{fill:var(--gd-mark)}
.gd-eye{fill:none;stroke:var(--gd-good);stroke-width:.8}
.gd-try{fill:none;stroke:var(--gd-try);stroke-width:.7;stroke-dasharray:1.3 .9}
.gd-no{stroke:var(--gd-mark);stroke-width:.9;stroke-linecap:round}
.gl-index{display:flex;flex-wrap:wrap;gap:6px}
.gl-index a,.gl-term a,[data-term]{cursor:pointer}
.gl-index a{border:1px solid var(--line);background:var(--key);border-radius:999px;padding:4px 10px;font-size:.8rem;font-weight:600;color:var(--ink);text-decoration:none}
.gl-term{border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:6px;scroll-margin-top:8px}
.gl-term h3{margin:0;font-family:var(--hand);font-weight:400;font-size:1.45rem;line-height:1}
.gl-term p{margin:0;font-size:.88rem;line-height:1.45}
.gl-term.flash h3{color:var(--hit)}
.gl-frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}
.gl-frames figure{margin:0;display:flex;flex-direction:column;gap:3px}
.gl-frames figcaption{font-size:.74rem;color:var(--muted);line-height:1.3}
a[data-term]{color:var(--hit);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px}
.gl-index a[data-term]{text-decoration:none}
`;
  document.head.appendChild(st);
}

const api = { TERMS, diagram, figure, html, linkify, framesFor, cropFor, ensureStyle };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoGlossary = api;
})(typeof self !== 'undefined' ? self : globalThis);
