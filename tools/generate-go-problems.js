// Builds the Go problems (go-problems-data.js): capture problems (atari, ladder, net, snapback, throw-in), saving
// problems, and life-and-death problems in closed corners. Every problem is checked by go-solver.js: the solver's side
// (always Black, after recolouring) has one or two first moves that work, the position isn't already decided (moving
// second would fail), and the solution doesn't depend on a ko. Each problem is shown in a random orientation.
// Usage: node tools/generate-go-problems.js [perTheme=40] [out=go-problems-data.js] [maxMinutes=60]
// The file is rewritten every 30 seconds and a new run resumes from it. ONLY=ladder,net limits a run to some themes.
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os'), fs = require('fs'), path = require('path');
const G = require('../go-core.js'), S = require('../go-solver.js');
const { BLACK, WHITE, EMPTY, other } = G;
const THEMES = process.env.ONLY ? process.env.ONLY.split(',') : ['atari', 'ladder', 'net', 'snapback', 'throwin', 'escape', 'live', 'kill'];
const N = 9;

if (isMainThread) {
  const per = +(process.argv[2] || 40), out = process.argv[3] || path.join(__dirname, '..', 'go-problems-data.js'), maxMin = +(process.argv[4] || 60);
  const want = Object.fromEntries(THEMES.map(t => [t, t === 'live' || t === 'kill' ? Math.round(per * 1.5) : per]));
  const got = Object.fromEntries(THEMES.map(t => [t, []])), seen = new Set(), t0 = Date.now(), kept = [];
  if (fs.existsSync(out)) {
    const c = { window: {} }; require('vm').runInNewContext(fs.readFileSync(out, 'utf8'), c);
    for (const p of (c.window.GO_PROBLEMS || [])) { if (seen.has(p.stones)) continue; seen.add(p.stones); (got[p.theme] && got[p.theme].length < want[p.theme] ? got[p.theme] : kept).push(p); }
  }
  const done = () => THEMES.every(t => got[t].length >= want[t]);
  const report = () => console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ` + THEMES.map(t => `${t} ${got[t].length}/${want[t]}`).join('  '));
  function write() {
    const all = kept.concat(...THEMES.map(t => got[t])).sort((a, b) => a.rating - b.rating).map((p, k) => Object.assign(p, { id: k + 1 }));
    fs.writeFileSync(out, `// ${all.length} Go problems built and checked by tools/generate-go-problems.js (solver: go-solver.js).\n// Black to play in every problem. stones: 81 characters, rows from the top (X black, O white, . empty).\nwindow.GO_PROBLEMS = [\n${all.map(p => JSON.stringify(p)).join(',\n')}\n];\n`);
  }
  if (done()) { write(); console.log('already complete'); process.exit(0); }
  const timer = setInterval(() => { report(); write(); if ((Date.now() - t0) / 60000 > maxMin) finish(); }, 30000);
  const workers = [];
  function finish() { clearInterval(timer); report(); write(); console.log('wrote', out); workers.forEach(w => w.terminate()); process.exit(0); }
  for (let t = 0; t < Math.max(1, os.cpus().length); t++) {
    const w = new Worker(__filename, { workerData: { seed: 7 + t * 104729 + (Date.now() % 10007) } }); workers.push(w);
    w.on('message', m => {
      if (m.need) { w.postMessage({ need: THEMES.filter(t => got[t].length < want[t]) }); return; }
      const p = m.problem; if (!got[p.theme] || seen.has(p.stones) || got[p.theme].length >= want[p.theme]) return;
      seen.add(p.stones); got[p.theme].push(p); if (done()) finish();
    });
  }
} else {
  const r = G.rng(workerData.seed), pick = a => a[(r() * a.length) | 0];
  const nm = (b, p) => b.name(p);
  function boardFrom(cells, turn) { // cells: Map point -> colour
    const b = new G.Board(N); for (const [p, c] of cells) b._place(p, c);
    // no chain may start without liberties
    for (const p of b.points) if ((b.c[p] === BLACK || b.c[p] === WHITE) && b.libCount(p) === 0) return null;
    b.turn = turn; b.seen = new Set([b.key()]); return b;
  }
  const near = (b, p, d) => b.points.filter(q => { const [x, y] = b.xy(q), [a, c] = b.xy(p); return Math.abs(x - a) <= d && Math.abs(y - c) <= d; });

  // ---- capture problems: Black to capture the white target ----
  function captureProblem(want) {
    const b0 = new G.Board(N), cells = new Map();
    const tight = want === 'snapback' || want === 'throwin';
    const edgeD = p => { const [x, y] = b0.xy(p); return Math.min(x, y, N - 1 - x, N - 1 - y); };
    const start = pick(b0.points.filter(p => want === 'atari' || want === 'ladder' || want === 'net' ? edgeD(p) >= 1 : tight ? edgeD(p) <= 1 : true));
    // the target: 1–3 white stones in a line or bend
    const tgt = [start]; const len = want === 'atari' ? 1 + ((r() * 3) | 0) : 1 + ((r() * 2) | 0);
    while (tgt.length < len) { const q = pick(tgt) + pick(b0.DIRS); if (b0.c[q] === EMPTY && !tgt.includes(q)) tgt.push(q); else if (r() < 0.05) break; }
    tgt.forEach(p => cells.set(p, WHITE));
    const libsOf = () => { const s = new Set(); for (const p of tgt) for (const d of b0.DIRS) { const q = p + d; if (b0.c[q] === EMPTY && !cells.has(q)) s.add(q); } return [...s]; };
    // close off liberties with black stones until 1 (atari) or 2 remain
    const keep = want === 'atari' ? 1 : want === 'snapback' || want === 'throwin' ? 2 : 2;
    let libs = libsOf(); for (let k = 0; k < 20 && libs.length > keep; k++) { cells.set(pick(libs), BLACK); libs = libsOf(); }
    if (libs.length !== keep) return null;
    // a few more stones around for realism and to create (or break) ladders and shapes
    const extraW = (r() * (tight ? 6 : 4)) | 0, extraB = (r() * (tight ? 8 : 4)) | 0;
    const around = near(b0, start, tight ? 2 : 3);
    for (let k = 0; k < extraB; k++) { const q = pick(around); if (!cells.has(q) && !libs.includes(q)) cells.set(q, BLACK); }
    for (let k = 0; k < extraW; k++) { const q = pick(around); if (!cells.has(q) && !libs.includes(q)) cells.set(q, WHITE); }
    const b = boardFrom(cells, BLACK); if (!b) return null;
    // the target as one chain, and nothing else already in atari for Black (keep the problem clean)
    if (b.chain[tgt[0]] !== b.chain[tgt[tgt.length - 1]] || tgt.some(p => b.chain[p] !== b.chain[tgt[0]])) return null;
    if (b.points.some(p => b.c[p] === BLACK && b.inAtari(b.chain[p]))) return null;
    const o = { attacker: BLACK, target: tgt[0], depth: 30, nodes: 60000 };
    const good = S.goodMoves(b, o); if (!good || !good.length || good.length > 2) return null;
    // White to move would escape (so the problem is urgent)
    const bw = b.clone(true); bw.turn = WHITE; bw.seen = new Set([bw.key()]);
    const sw = S.solve(bw, o); if (sw.aborted || sw.win) return null;
    const line = mainLine(b, o, good[0]); if (!line) return null;
    return finishProblem(b, 'capture', o, good, line);
  }
  // ---- saving problems: Black's target stones are in danger; save them ----
  function saveProblem() {
    const p = captureProblem('escape-setup');
    return p;
  }
  function escapeProblem() {
    // build like a capture problem, then swap colours: the solver's stones are the ones in danger
    const b0 = new G.Board(N), cells = new Map();
    const start = pick(b0.points);
    const tgt = [start]; const len = 1 + ((r() * 3) | 0);
    while (tgt.length < len) { const q = pick(tgt) + pick(b0.DIRS); if (b0.c[q] === EMPTY && !tgt.includes(q)) tgt.push(q); else if (r() < 0.05) break; }
    tgt.forEach(p => cells.set(p, BLACK));
    const libsOf = () => { const s = new Set(); for (const p of tgt) for (const d of b0.DIRS) { const q = p + d; if (b0.c[q] === EMPTY && !cells.has(q)) s.add(q); } return [...s]; };
    let libs = libsOf(), keep = r() < 0.5 ? 1 : 2; for (let k = 0; k < 20 && libs.length > keep; k++) { cells.set(pick(libs), WHITE); libs = libsOf(); }
    if (libs.length !== keep) return null;
    const around = near(b0, start, 3);
    for (let k = 0; k < ((r() * 4) | 0); k++) { const q = pick(around); if (!cells.has(q) && !libs.includes(q)) cells.set(q, WHITE); }
    for (let k = 0; k < ((r() * 3) | 0); k++) { const q = pick(around); if (!cells.has(q) && !libs.includes(q)) cells.set(q, BLACK); }
    const b = boardFrom(cells, BLACK); if (!b) return null;
    if (tgt.some(p => b.chain[p] !== b.chain[tgt[0]])) return null;
    const o = { attacker: WHITE, target: tgt[0], depth: 30, nodes: 60000 };
    // White to move captures (the stones really are in danger)
    const bw = b.clone(true); bw.turn = WHITE; bw.seen = new Set([bw.key()]);
    const sw = S.solve(bw, o); if (sw.aborted || !sw.win) return null;
    const good = S.goodMoves(b, o); if (!good || !good.length || good.length > 2) return null;
    // the natural-looking escape (extending at a liberty) shouldn't always be it: keep half of the plain ones
    const plain = good.every(p => libs.includes(p));
    if (plain && r() < 0.5) return null;
    const line = mainLine(b, o, good[0], true); if (!line) return null;
    return finishProblem(b, 'save', o, good, line);
  }
  // ---- life and death in a closed corner ----
  function cornerProblem(goal) {
    const b0 = new G.Board(N), cells = new Map();
    const w = 3 + ((r() * 3) | 0), h = 2 + ((r() * 2) | 0); // eye space, bottom-left corner: x < w, y > N-1-h
    const P = (x, y) => b0.pt(x, N - 1 - y); // y counted up from the bottom edge
    const def = WHITE, att = BLACK; // built with White living; recoloured below for "Black to live"
    // defender wall: the row above the eye space and the column to its right
    for (let x = 0; x <= w; x++) cells.set(P(x, h), def);
    for (let y = 0; y < h; y++) cells.set(P(w, y), def);
    // attacker wall around it
    for (let x = 0; x <= w + 1; x++) cells.set(P(x, h + 1), att);
    for (let y = 0; y <= h; y++) cells.set(P(w + 1, y), att);
    // a few stones inside: defender stones that shape the eye space, attacker stones already inside
    const inside = []; for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) inside.push(P(x, y));
    const nd = (r() * 3) | 0, na = (r() * 2.4) | 0;
    for (let k = 0; k < nd; k++) cells.set(pick(inside), def);
    for (let k = 0; k < na; k++) { const q = pick(inside); if (!cells.has(q)) cells.set(q, att); }
    // the corner sometimes cut away: attacker stones on the wall corner make it smaller and trickier
    if (r() < 0.4) cells.set(P(w, h), att);
    let b = boardFrom(cells, att); if (!b) return null;
    const region = inside.filter(q => b.c[q] === EMPTY);
    if (region.length < 3 || region.length > 9) return null;
    // the defender's wall is the target; it must be one chain touching the eye space
    const tgt = P(0, h); if (b.c[tgt] !== def) return null;
    // the attacker's wall must be safe: one chain with liberties outside the corner
    const aw = P(w + 1, h + 1); if (b.c[aw] !== att) return null;
    const o = { attacker: att, target: tgt, region, depth: region.length * 2 + 4, nodes: 150000 };
    const first = S.solve(b, o); if (first.aborted || !first.win || first.ko) return null; // attacker first kills
    const bd = b.clone(true); bd.turn = def; bd.seen = new Set([bd.key()]);
    const second = S.solve(bd, o); if (second.aborted || second.win || second.ko) return null; // defender first lives
    // which version: Black kills (Black = attacker, to move) or Black lives (recolour so Black is the defender)
    let pb = b, po = o;
    if (goal === 'live') { pb = recolour(bd); po = Object.assign({}, o, { attacker: other(att) }); }
    const good = S.goodMoves(pb, po); if (!good || !good.length || good.length > 2) return null;
    const line = mainLine(pb, po, good[0], goal === 'live'); if (!line) return null;
    return finishProblem(pb, goal, po, good, line);
  }
  function recolour(b) { const cells = new Map(); for (const p of b.points) if (b.c[p]) cells.set(p, other(b.c[p])); return boardFrom(cells, other(b.turn)); }

  // best play from the solver's first move: the opponent resists as long as it can
  function mainLine(b, o, first, defending) {
    const t = b.clone(true); t.play(first); const line = [first];
    for (let k = 0; k < 24; k++) {
      if (t.c[o.target] !== other(o.attacker)) break;            // captured
      const m = S.bestReply(t, o);
      if (!m) break;
      t.play(m); line.push(m);
      if (defending && k > 8) break;
    }
    return line;
  }
  function theme(b, kind, o, line) {
    if (kind !== 'capture') return kind === 'save' ? 'escape' : kind;
    if (line.length === 1) return 'atari';
    const t = b.clone(true); t.play(line[0]);
    const libsAfter = t.c[o.target] === WHITE ? t.libCount(o.target) : 0;
    const t2 = t.clone(true); if (line[1]) t2.play(line[1]);
    const sacrificed = line[1] != null && t2.c[line[0]] === EMPTY; // White took the first stone
    if (sacrificed) return line[2] === line[0] ? 'snapback' : 'throwin';
    if (libsAfter >= 2) return 'net';
    if (libsAfter === 1 && line.length >= 7) {
      // a real ladder zigzags: the chase covers several rows and columns
      const xs = new Set(line.map(p => b.xy(p)[0])), ys = new Set(line.map(p => b.xy(p)[1]));
      return xs.size >= 3 && ys.size >= 3 ? 'ladder' : 'chase';
    }
    return 'chase';
  }
  // symmetry: rotate/flip so problems don't all sit in one corner
  function transform(b, k) {
    const f = (x, y) => [[x, y], [N - 1 - x, y], [x, N - 1 - y], [N - 1 - x, N - 1 - y], [y, x], [N - 1 - y, x], [y, N - 1 - x], [N - 1 - y, N - 1 - x]][k];
    return p => { const [x, y] = b.xy(p), [a, c] = f(x, y); return b.pt(a, c); };
  }
  function finishProblem(b, kind, o, good, line) {
    const th = theme(b, kind, o, line);
    const k = (r() * 8) | 0, T = transform(b, k);
    const cells = new Map(); for (const p of b.points) if (b.c[p]) cells.set(T(p), b.c[p]);
    const nb = boardFrom(cells, BLACK);
    let stones = ''; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = nb.c[nb.pt(x, y)]; stones += v === BLACK ? 'X' : v === WHITE ? 'O' : '.'; }
    const goal = kind === 'capture' ? 'capture' : kind === 'save' ? 'save' : kind;
    const len = line.length, reg = o.region ? o.region.length : 0;
    const base = { atari: 350, chase: 650, ladder: 700, net: 800, snapback: 900, throwin: 1050, escape: 700, live: 900, kill: 950 }[th] || 800;
    const rating = Math.round(base + len * 25 + reg * 20 + (good.length === 1 ? 40 : 0) + (r() - 0.5) * 80);
    return { theme: th, goal, stones, target: nb.name(T(o.target)), region: o.region ? o.region.map(p => nb.name(T(p))) : null, attacker: o.attacker === BLACK ? 'B' : 'W', depth: o.depth,
      answers: good.map(p => nb.name(T(p))), line: line.map(p => p ? nb.name(T(p)) : 'pass'), rating };
  }

  let need = THEMES.slice();
  parentPort.on('message', m => { if (m.need) need = m.need; });
  let n = 0;
  (function loop() {
    for (let k = 0; k < 30; k++) {
      const th = pick(need); if (!th) return;
      let p = null;
      try {
        if (th === 'live' || th === 'kill') p = cornerProblem(th);
        else if (th === 'escape') p = escapeProblem();
        else p = captureProblem(th);
      } catch (e) { p = null; }
      if (p && p.theme === th) parentPort.postMessage({ problem: p });
      else if (p && THEMES.includes(p.theme)) parentPort.postMessage({ problem: p }); // a capture problem of another theme is still useful
    }
    if (++n % 3 === 0) parentPort.postMessage({ need: true });
    setImmediate(loop);
  })();
}
