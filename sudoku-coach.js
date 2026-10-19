// Sudoku coach: finds the simplest next logical step on a board and turns it into a short, step-by-step visual lesson.
// Techniques, easiest first: Full House, Hidden Single, Naked Single, Pointing, Claiming, Naked Pair, Hidden Pair,
// Naked Triple, Hidden Triple, X-Wing, XY-Wing, Swordfish. Works in the browser (window.SudokuCoach) and in Node (require).
//
// Board model: `values` (81 numbers, 0 = empty, only numbers known to be right), `elims` (Set of i*10+d: candidates crossed off
// by earlier lessons). A lesson is { key, name, level, idea, steps:[{ text, hl }], action } where action is
// { type:'place', i, d } or { type:'elim', elims:[[i,d],…] }. Each step's `hl` says what the board should show:
//   units  houses to shade (0–8 rows, 9–17 columns, 18–26 boxes)    focus   squares to ring
//   cause  placed numbers that explain the step                       blocked squares that can't hold the digit
//   target squares that lose candidates in this step
//   digit  shade every placed copy of this number                      cands   'all' or a list of squares whose candidates to show
//   marks  [[i, d, role]] candidate roles: 'key', 'elim', 'place', 'alt'   links [[a, b, kind]] lines: 'ray', 'link', 'chain'
//   ghost  [i, d] the number to write in, drawn faintly
(function (root) {
'use strict';
const ROW = i => (i / 9) | 0, COL = i => i % 9, BOX = i => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push([...Array(9)].map((_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push([...Array(9)].map((_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) { const u = []; for (let k = 0; k < 9; k++) u.push((((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (b % 3) * 3 + (k % 3)); UNITS.push(u); }
const PEERS = [...Array(81)].map((_, i) => { const s = new Set(); for (const u of UNITS) if (u.includes(i)) u.forEach(j => j !== i && s.add(j)); return [...s]; });
const SEES = [...Array(81)].map((_, i) => { const a = new Array(81).fill(false); PEERS[i].forEach(j => a[j] = true); return a; });
const POP = new Uint8Array(512); for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
const bit = d => 1 << (d - 1);
const digits = m => { const out = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d); return out; };
const unitsOf = i => [ROW(i), 9 + COL(i), 18 + BOX(i)];

// ---------- words ----------
const BOXN = ['top-left', 'top-middle', 'top-right', 'middle-left', 'centre', 'middle-right', 'bottom-left', 'bottom-middle', 'bottom-right'];
const unitName = u => u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `the ${BOXN[u - 18]} box`;
const unitKind = u => u < 9 ? 'row' : u < 18 ? 'column' : 'box';
const cellName = i => `row ${ROW(i) + 1}, column ${COL(i) + 1}`;
const list = a => a.length < 2 ? String(a[0] ?? '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const orList = a => a.length < 2 ? String(a[0] ?? '') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const cap = s => s[0].toUpperCase() + s.slice(1);

const TECHNIQUES = [
  { key: 'fullHouse', name: 'Full House', level: 'Beginner', idea: 'When a row, column or box has just one empty square left, it takes the one number that is missing.' },
  { key: 'hiddenSingle', name: 'Hidden Single', level: 'Beginner', idea: 'Pick a number and a row, column or box. If every square but one is ruled out for that number, the number goes in the one that is left.' },
  { key: 'nakedSingle', name: 'Naked Single', level: 'Beginner', idea: 'Pick a square and cross out every number its row, column and box already have. If only one number is left, that is the answer.' },
  { key: 'pointing', name: 'Pointing', level: 'Intermediate', idea: 'If a number can only go in one row (or column) inside a box, the box "points" along that line: no other square on that line, outside the box, can have it.' },
  { key: 'claiming', name: 'Claiming', level: 'Intermediate', idea: 'If a number can only go inside one box along a row (or column), that line "claims" the number for the box: no other square in the box can have it.' },
  { key: 'nakedPair', name: 'Naked Pair', level: 'Intermediate', idea: 'Two squares in a row, column or box that can only be the same two numbers share them out between themselves, so no other square there can be either number.' },
  { key: 'hiddenPair', name: 'Hidden Pair', level: 'Intermediate', idea: 'If two numbers can only go in the same two squares of a row, column or box, those squares must hold those two numbers, so anything else pencilled in them can go.' },
  { key: 'nakedTriple', name: 'Naked Triple', level: 'Advanced', idea: 'Three squares in a row, column or box whose candidates, together, are only three numbers. Those three numbers are used up there, so remove them from the other squares.' },
  { key: 'hiddenTriple', name: 'Hidden Triple', level: 'Advanced', idea: 'If three numbers can only go in the same three squares of a row, column or box, those squares hold those numbers, so their other candidates can go.' },
  { key: 'xWing', name: 'X-Wing', level: 'Advanced', idea: 'A number with only two places in each of two rows, lining up in the same two columns, must sit on opposite corners of that rectangle. Either way, those columns get their copy from these rows.' },
  { key: 'xyWing', name: 'XY-Wing', level: 'Advanced', idea: 'A two-candidate "pivot" XY sees two "wings", XZ and YZ. Whatever the pivot turns out to be, one wing becomes Z, so any square that sees both wings cannot be Z.' },
  { key: 'swordfish', name: 'Swordfish', level: 'Expert', idea: 'An X-Wing with three lines: if a number fits in only three columns across three rows, those columns get their copy from these rows, so it can go from the rest of those columns.' },
  { key: 'reveal', name: 'Beyond the guide', level: 'Expert', idea: 'This position needs a technique harder than the ones in the guide (chains or colouring). The coach shows the answer for one square instead.' },
  { key: 'mistake', name: 'Check your numbers', level: '', idea: 'A wrong number makes every later step unreliable, so fix it first.' },
];
const INFO = Object.fromEntries(TECHNIQUES.map(t => [t.key, t]));

// ---------- board ----------
function Board(values, elims) {
  const val = Array.from(values), cand = new Uint16Array(81), em = new Uint16Array(81);
  if (elims) for (const k of elims) em[(k / 10) | 0] |= bit(k % 10);
  for (let i = 0; i < 81; i++) if (!val[i]) { let m = 511; for (const p of PEERS[i]) if (val[p]) m &= ~bit(val[p]); cand[i] = m & ~em[i]; }
  return { val, cand, em };
}
// A placed copy of d that rules out square i (prefer one on the same row or column, which reads as a straight line)
function blocker(B, i, d) {
  let box = -1;
  for (const p of PEERS[i]) if (B.val[p] === d) { if (ROW(p) === ROW(i) || COL(p) === COL(i)) return p; box = p; }
  return box;
}
function* combos(arr, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
}
const lesson = (key, steps, action, extra) => Object.assign({ key, name: INFO[key].name, level: INFO[key].level, idea: INFO[key].idea, steps, action }, extra || {});
const elimMarks = elims => elims.map(([i, d]) => [i, d, 'elim']);
const elimCells = elims => [...new Set(elims.map(e => e[0]))];
const elimText = (elims, where) => {
  const ds = [...new Set(elims.map(e => e[1]))].sort(), n = elimCells(elims).length;
  return `Cross ${list(ds)} off ${n === 1 ? 'the red square' : `the ${NUMW[n] || n} red squares`}${where ? ' ' + where : ''}.`;
};

// ---------- placement techniques ----------
function fullHouse(B) {
  for (const order of [[18, 27], [0, 9], [9, 18]]) for (let u = order[0]; u < order[1]; u++) {
    const empty = UNITS[u].filter(i => !B.val[i]);
    if (empty.length !== 1) continue;
    const i = empty[0]; let m = 511; for (const j of UNITS[u]) if (B.val[j]) m &= ~bit(B.val[j]);
    const d = digits(m)[0];
    return lesson('fullHouse', [
      { text: `Look at ${unitName(u)}. Eight of its nine squares are already filled.`, hl: { units: [u], focus: [i] } },
      { text: `The only number ${unitName(u)} is missing is ${d}, so ${d} goes in the empty square.`, hl: { units: [u], focus: [i], ghost: [i, d] } },
    ], { type: 'place', i, d });
  }
  return null;
}

function hiddenSingle(B, from, to) {
  for (let u = from; u < to; u++) for (let d = 1; d <= 9; d++) {
    const b = bit(d); if (UNITS[u].some(i => B.val[i] === d)) continue;
    const spots = UNITS[u].filter(i => B.cand[i] & b);
    if (spots.length !== 1) continue;
    const i = spots[0], empties = UNITS[u].filter(j => !B.val[j] && j !== i);
    if (!empties.length) continue; // that's a full house
    const cause = new Set(), blocked = [], links = [], earlier = [];
    const reach = new Map(); // blocker → squares it rules out
    for (const j of empties) {
      const p = blocker(B, j, d);
      if (p < 0) { earlier.push(j); continue; }
      cause.add(p); blocked.push(j); if (!reach.has(p)) reach.set(p, []); reach.get(p).push(j);
    }
    for (const [p, js] of reach) {
      const line = js.every(j => ROW(j) === ROW(p)) ? ROW : js.every(j => COL(j) === COL(p)) ? COL : null;
      if (line) { const far = js.reduce((a, j) => Math.abs(j - p) > Math.abs(a - p) ? j : a, js[0]); links.push([p, far, 'ray']); }
      else js.forEach(j => links.push([p, j, 'ray']));
    }
    const kind = unitKind(u), filled = 9 - empties.length - 1;
    const steps = [
      { text: `Where can ${d} go in ${unitName(u)}? Every ${kind} needs one ${d}${filled ? `, and ${filled} of its squares are already taken` : ''}.`, hl: { units: [u], digit: d } },
      { text: `Each ${d} already on the board rules out its own row, column and box. Follow the line${cause.size === 1 ? '' : 's'} from the circled ${d}${cause.size === 1 ? '' : 's'}: ${earlier.length ? 'most of' : 'all'} the other empty squares of ${unitName(u)} are covered.`,
        hl: { units: [u], digit: d, cause: [...cause], blocked, links } },
    ];
    if (earlier.length) steps.push({ text: `The ${earlier.length === 1 ? 'square' : 'squares'} marked ✕ without a line had ${d} crossed off in an earlier step.`, hl: { units: [u], digit: d, cause: [...cause], blocked: blocked.concat(earlier), links, marks: earlier.map(j => [j, d, 'elim']), cands: earlier } });
    steps.push({ text: `That leaves just one square in ${unitName(u)} for ${d}. It may still have other candidates, but it is the only home for ${d} here, so ${d} goes in.`,
      hl: { units: [u], digit: d, cause: [...cause], blocked: blocked.concat(earlier), links, focus: [i], ghost: [i, d] } });
    return lesson('hiddenSingle', steps, { type: 'place', i, d }, { where: kind });
  }
  return null;
}

function nakedSingle(B) {
  for (let i = 0; i < 81; i++) if (!B.val[i] && POP[B.cand[i]] === 1) {
    const d = digits(B.cand[i])[0], us = unitsOf(i);
    const by = us.map(u => [...new Set(UNITS[u].filter(j => B.val[j]).map(j => B.val[j]))].sort());
    const cause = PEERS[i].filter(j => B.val[j]);
    const seen = new Set(cause.map(j => B.val[j])), earlier = digits(B.em[i]).filter(x => !seen.has(x));
    const steps = [
      { text: `Look at the ringed square (${cellName(i)}). Which numbers could go here? Check its row, its column and its box.`, hl: { units: us, focus: [i] } },
      { text: `Its row already has ${list(by[0]) || 'nothing'}; its column has ${list(by[1]) || 'nothing'}; its box has ${list(by[2]) || 'nothing'}. None of those can go here.`,
        hl: { units: us, focus: [i], cause } },
    ];
    if (earlier.length) steps.push({ text: `${list(earlier)} ${earlier.length === 1 ? 'was' : 'were'} also crossed off for this square in an earlier step.`, hl: { units: us, focus: [i], cause, cands: [i], marks: earlier.map(x => [i, x, 'elim']) } });
    steps.push({ text: `Every number except ${d} is ruled out, so this square must be ${d}.`, hl: { units: us, focus: [i], cause, ghost: [i, d] } });
    return lesson('nakedSingle', steps, { type: 'place', i, d });
  }
  return null;
}

// ---------- elimination techniques ----------
const ALL = 'all';
function pointing(B) {
  for (let b = 18; b < 27; b++) for (let d = 1; d <= 9; d++) {
    const bb = bit(d), cs = UNITS[b].filter(i => B.cand[i] & bb); if (cs.length < 2 || cs.length > 3) continue;
    for (const [f, base] of [[ROW, 0], [COL, 9]]) {
      if (!cs.every(i => f(i) === f(cs[0]))) continue;
      const line = base + f(cs[0]), elims = UNITS[line].filter(j => BOX(j) !== b - 18 && (B.cand[j] & bb)).map(j => [j, d]);
      if (!elims.length) continue;
      const key = cs.map(i => [i, d, 'key']), lk = [[cs[0], cs[cs.length - 1], 'link']];
      return lesson('pointing', [
        { text: `The small numbers are candidates: the numbers each square could still be. Look at ${unitName(b)}: ${d} can only go in ${NUMW[cs.length]} of its squares.`, hl: { units: [b], cands: ALL, marks: key } },
        { text: `They all lie in ${unitName(line)}. Whichever square it turns out to be, the ${d} for ${unitName(b)} is in ${unitName(line)}.`, hl: { units: [b, line], cands: ALL, marks: key, links: lk } },
        { text: `${cap(unitName(line))} can only have one ${d}, so no square on it outside the box can be ${d}. ${elimText(elims)}`, hl: { units: [b, line], cands: ALL, marks: key.concat(elimMarks(elims)), links: lk, target: elimCells(elims) } },
      ], { type: 'elim', elims });
    }
  }
  return null;
}

function claiming(B) {
  for (let l = 0; l < 18; l++) for (let d = 1; d <= 9; d++) {
    const bb = bit(d), cs = UNITS[l].filter(i => B.cand[i] & bb); if (cs.length < 2 || cs.length > 3) continue;
    if (!cs.every(i => BOX(i) === BOX(cs[0]))) continue;
    const b = 18 + BOX(cs[0]), elims = UNITS[b].filter(j => !UNITS[l].includes(j) && (B.cand[j] & bb)).map(j => [j, d]);
    if (!elims.length) continue;
    const key = cs.map(i => [i, d, 'key']), lk = [[cs[0], cs[cs.length - 1], 'link']];
    return lesson('claiming', [
      { text: `The small numbers are candidates: the numbers each square could still be. In ${unitName(l)}, ${d} can only go in these ${NUMW[cs.length]} squares.`, hl: { units: [l], cands: ALL, marks: key } },
      { text: `All of them are inside ${unitName(b)}. So ${unitName(l)}'s ${d} is in that box, wherever exactly.`, hl: { units: [l, b], cands: ALL, marks: key, links: lk } },
      { text: `The box only gets one ${d}, and ${unitName(l)} is using it, so the box's other squares can't be ${d}. ${elimText(elims)}`, hl: { units: [l, b], cands: ALL, marks: key.concat(elimMarks(elims)), links: lk, target: elimCells(elims) } },
    ], { type: 'elim', elims });
  }
  return null;
}

function nakedSubset(B, k) {
  const key = k === 2 ? 'nakedPair' : 'nakedTriple';
  for (const order of [[18, 27], [0, 18]]) for (let u = order[0]; u < order[1]; u++) {
    const cells = UNITS[u].filter(i => !B.val[i] && POP[B.cand[i]] >= 2 && POP[B.cand[i]] <= k);
    for (const combo of combos(cells, k)) {
      let m = 0; for (const i of combo) m |= B.cand[i];
      if (POP[m] !== k) continue;
      const ds = digits(m), elims = [];
      for (const j of UNITS[u]) if (!B.val[j] && !combo.includes(j)) for (const d of ds) if (B.cand[j] & bit(d)) elims.push([j, d]);
      if (!elims.length) continue;
      const km = combo.flatMap(i => digits(B.cand[i]).map(d => [i, d, 'key']));
      const lk = combo.slice(1).map((i, n) => [combo[n], i, 'link']);
      const what = k === 2 ? 'Both' : 'Between them, these three';
      return lesson(key, [
        { text: `The small numbers are candidates. Look at the ${NUMW[k]} ringed squares in ${unitName(u)}. ${k === 2 ? `Each can only be ${orList(ds)}.` : `Their candidates are only ${orList(ds)}.`}`, hl: { units: [u], cands: ALL, marks: km, focus: combo } },
        { text: `${what} squares have to take ${list(ds)} between them. We don't know which way round yet, but those ${NUMW[k]} numbers are used up in ${unitName(u)}.`, hl: { units: [u], cands: ALL, marks: km, focus: combo, links: lk } },
        { text: `So no other square in ${unitName(u)} can be ${orList(ds)}. ${elimText(elims)}`, hl: { units: [u], cands: ALL, marks: km.concat(elimMarks(elims)), target: elimCells(elims), focus: combo, links: lk } },
      ], { type: 'elim', elims });
    }
  }
  return null;
}

function hiddenSubset(B, k) {
  const key = k === 2 ? 'hiddenPair' : 'hiddenTriple';
  for (const order of [[18, 27], [0, 18]]) for (let u = order[0]; u < order[1]; u++) {
    const ds = []; for (let d = 1; d <= 9; d++) { const n = UNITS[u].filter(i => B.cand[i] & bit(d)).length; if (n >= 2 && n <= k) ds.push(d); }
    for (const combo of combos(ds, k)) {
      let dm = 0; for (const d of combo) dm |= bit(d);
      const cells = UNITS[u].filter(i => B.cand[i] & dm); if (cells.length !== k) continue;
      const elims = []; for (const i of cells) for (const d of digits(B.cand[i] & ~dm)) elims.push([i, d]);
      if (!elims.length) continue;
      const km = cells.flatMap(i => combo.filter(d => B.cand[i] & bit(d)).map(d => [i, d, 'key']));
      const lk = cells.slice(1).map((i, n) => [cells[n], i, 'link']);
      return lesson(key, [
        { text: `The small numbers are candidates. In ${unitName(u)}, look for ${list(combo)}: each of them fits in only these ${NUMW[k]} squares and nowhere else in the ${unitKind(u)}.`, hl: { units: [u], cands: ALL, marks: km, focus: cells } },
        { text: `${cap(unitName(u))} needs a ${list(combo)}, and there are exactly ${NUMW[k]} squares to hold them. So these squares must be ${list(combo)}, in some order.`, hl: { units: [u], cands: ALL, marks: km, focus: cells, links: lk } },
        { text: `That means their other candidates are impossible, even though nothing else rules them out directly. ${elimText(elims, 'from these squares')}`, hl: { units: [u], cands: ALL, marks: km.concat(elimMarks(elims)), target: elimCells(elims), focus: cells, links: lk } },
      ], { type: 'elim', elims });
    }
  }
  return null;
}

function fish(B, n) {
  const key = n === 2 ? 'xWing' : 'swordfish';
  for (let d = 1; d <= 9; d++) {
    const bb = bit(d);
    for (const [base, cover, cross] of [[0, 9, COL], [9, 0, ROW]]) {
      const lines = [];
      for (let l = 0; l < 9; l++) { const cs = UNITS[base + l].filter(i => B.cand[i] & bb); if (cs.length >= 2 && cs.length <= n) lines.push([l, cs]); }
      for (const combo of combos(lines, n)) {
        const cov = [...new Set(combo.flatMap(([, cs]) => cs.map(cross)))];
        if (cov.length !== n) continue;
        const ls = combo.map(([l]) => l), elims = [];
        for (const x of cov) for (const j of UNITS[cover + x]) if ((B.cand[j] & bb) && !ls.includes(base === 0 ? ROW(j) : COL(j))) elims.push([j, d]);
        if (!elims.length) continue;
        const corners = combo.flatMap(([, cs]) => cs), km = corners.map(i => [i, d, 'key']);
        const bu = ls.map(l => base + l), cu = cov.map(x => cover + x).sort((a, b) => a - b);
        const along = base === 0 ? 'rows' : 'columns', acrossW = base === 0 ? 'columns' : 'rows';
        const lk = [];
        for (const [, cs] of combo) for (let a = 1; a < cs.length; a++) lk.push([cs[a - 1], cs[a], 'link']);
        for (const x of cov) { const cs = corners.filter(i => cross(i) === x).sort((a, b) => a - b); for (let a = 1; a < cs.length; a++) lk.push([cs[a - 1], cs[a], 'chain']); }
        const steps = [
          { text: `The small numbers are candidates. Follow the ${d}s in ${list(bu.map(unitName))}: in each of these ${along}, ${d} has only ${n === 2 ? 'two places' : 'two or three places'}.`, hl: { units: bu, cands: ALL, marks: km, digit: d } },
          { text: `Those places all fall in the same ${NUMW[n]} ${acrossW}: ${list(cu.map(unitName))}.`, hl: { units: bu.concat(cu), cands: ALL, marks: km, links: lk, digit: d } },
          { text: n === 2
              ? `Each ${along.slice(0, -1)} needs one ${d}, and they can't share a ${acrossW.slice(0, -1)}. So the two ${d}s sit on opposite corners of the rectangle, one in each ${acrossW.slice(0, -1)}, whichever way round.`
              : `Each of the ${NUMW[n]} ${along} needs one ${d}, and no two can share a ${acrossW.slice(0, -1)}. So these ${along} fill all ${NUMW[n]} ${acrossW} with their ${d}s, whichever arrangement it is.`,
            hl: { units: bu.concat(cu), cands: ALL, marks: km, links: lk, digit: d } },
          { text: `Those ${acrossW} already get their ${d} from inside the pattern, so the rest of each ${acrossW.slice(0, -1)} can't be ${d}. ${elimText(elims)}`, hl: { units: bu.concat(cu), cands: ALL, marks: km.concat(elimMarks(elims)), target: elimCells(elims), links: lk, digit: d } },
        ];
        return lesson(key, steps, { type: 'elim', elims });
      }
    }
  }
  return null;
}

function xyWing(B) {
  for (let p = 0; p < 81; p++) {
    if (B.val[p] || POP[B.cand[p]] !== 2) continue;
    const wings = PEERS[p].filter(i => !B.val[i] && POP[B.cand[i]] === 2 && POP[B.cand[i] & B.cand[p]] === 1);
    for (let a = 0; a < wings.length; a++) for (let c = a + 1; c < wings.length; c++) {
      const A = wings[a], C = wings[c];
      if ((B.cand[A] & B.cand[p]) === (B.cand[C] & B.cand[p])) continue;
      const zm = B.cand[A] & B.cand[C] & ~B.cand[p]; if (POP[zm] !== 1) continue;
      const z = digits(zm)[0], elims = [];
      for (const j of PEERS[A]) if (j !== C && j !== p && SEES[C][j] && (B.cand[j] & zm)) elims.push([j, z]);
      if (!elims.length) continue;
      const [x, y] = digits(B.cand[p]), xa = digits(B.cand[A] & B.cand[p])[0], ya = digits(B.cand[C] & B.cand[p])[0];
      const km = [[p, x, 'key'], [p, y, 'key'], [A, xa, 'key'], [C, ya, 'key'], [A, z, 'alt'], [C, z, 'alt']];
      const lk = [[p, A, 'link'], [p, C, 'link']], wl = lk.concat(elims.flatMap(([j]) => [[A, j, 'ray'], [C, j, 'ray']]));
      return lesson('xyWing', [
        { text: `The small numbers are candidates. The ringed pivot (${cellName(p)}) can only be ${x} or ${y}.`, hl: { cands: ALL, marks: km.slice(0, 2), focus: [p] } },
        { text: `It sees two "wing" squares: one that can only be ${xa} or ${z}, and one that can only be ${ya} or ${z}.`, hl: { cands: ALL, marks: km, focus: [p, A, C], links: lk } },
        { text: `If the pivot is ${xa}, the first wing loses ${xa} and must be ${z}. If the pivot is ${ya}, the second wing must be ${z}. Either way, one of the wings is ${z}.`, hl: { cands: ALL, marks: km, focus: [A, C], links: lk } },
        { text: `So a square that sees both wings can never be ${z}. ${elimText(elims)}`, hl: { cands: ALL, marks: km.concat(elimMarks(elims)), target: elimCells(elims), focus: [A, C], links: wl } },
      ], { type: 'elim', elims });
    }
  }
  return null;
}

// ---------- the ladder ----------
const LADDER = [
  B => fullHouse(B),
  B => hiddenSingle(B, 18, 27),
  B => nakedSingle(B),
  B => hiddenSingle(B, 0, 18),
  B => pointing(B),
  B => claiming(B),
  B => nakedSubset(B, 2),
  B => hiddenSubset(B, 2),
  B => nakedSubset(B, 3),
  B => hiddenSubset(B, 3),
  B => fish(B, 2),
  B => xyWing(B),
  B => fish(B, 3),
];

// Fallback: the empty square with the fewest candidates; the coach just shows its answer.
function reveal(B, solution) {
  let best = -1, bp = 10;
  for (let i = 0; i < 81; i++) if (!B.val[i] && POP[B.cand[i]] < bp) { bp = POP[B.cand[i]]; best = i; }
  if (best < 0) return null;
  const d = solution[best];
  return lesson('reveal', [
    { text: `No technique in the guide moves this position forward: it needs chains or colouring, which go beyond it. The ringed square has the fewest candidates, so it's the best one to reveal.`, hl: { cands: ALL, focus: [best] } },
    { text: `Its answer is ${d}. With that in, the simpler techniques usually take over again.`, hl: { cands: ALL, focus: [best], ghost: [best, d] } },
  ], { type: 'place', i: best, d });
}

// Next lesson for a game. `values` may contain the player's own numbers; wrong ones (checked against `solution`) come first.
function next(values, solution, elims, opts) {
  opts = opts || {};
  if (solution && !opts.ignoreMistakes) for (let i = 0; i < 81; i++) if (values[i] && values[i] !== solution[i] && !(opts.givens && opts.givens[i])) {
    const v = values[i], clash = PEERS[i].filter(j => values[j] === v);
    return lesson('mistake', [
      { text: clash.length ? `The ringed ${v} clashes with another ${v} in the same row, column or box, so one of them has to go.` : `The ringed ${v} isn't right. Nothing clashes with it yet, but it leads to a dead end later.`,
        hl: { focus: [i], cause: clash } },
      { text: `Every step builds on the numbers already in, so the coach can only teach from a board without mistakes. Erase this ${v}, then carry on.`, hl: { focus: [i] } },
    ], { type: 'erase', i });
  }
  const clean = solution ? Array.from(values, (v, i) => v === solution[i] ? v : 0) : values;
  if (clean.every(v => v)) return null;
  const B = Board(clean, elims);
  for (const f of LADDER) { const l = f(B); if (l) return l; }
  return solution ? reveal(B, solution) : null;
}

// Candidates as the coach sees them (for drawing).
function candidates(values, elims) { return Array.from(Board(values, elims).cand); }

// Find a position in a set of puzzles where `key` is the next lesson. Solves each puzzle step by step with the coach.
function findExample(key, puzzles, solveFn, limit) {
  for (let n = 0; n < Math.min(puzzles.length, limit || 200); n++) {
    const puzzle = puzzles[n], solution = solveFn(puzzle), vals = puzzle.slice(), el = new Set();
    for (let guard = 0; guard < 400; guard++) {
      const l = next(vals, solution, el);
      if (!l) break;
      if (l.key === key) return { index: n, puzzle, values: vals.slice(), elims: [...el], lesson: l };
      if (l.key === 'reveal') break;
      if (l.action.type === 'place') vals[l.action.i] = l.action.d; else l.action.elims.forEach(([i, d]) => el.add(i * 10 + d));
    }
  }
  return null;
}

const api = { next, candidates, findExample, TECHNIQUES, INFO, UNITS, PEERS, unitName, cellName };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SudokuCoach = api;
})(typeof self !== 'undefined' ? self : this);
