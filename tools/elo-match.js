// Round-robin between the engine's strength levels, to measure the Elo gaps between them.
// Usage: node tools/elo-match.js <pairs> [out.json]   e.g. 1-2:30,2-3:30,3-4:30,4-5:20,1-3:20
// Each pairing plays a set of balanced openings once with each color. Each side keeps its own
// search memory. Games longer than 200 plies are scored from the final position.
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const C = require('../chess-core.js');

const OPENINGS = [
  '', 'e2e4 e7e5', 'e2e4 c7c5', 'e2e4 e7e6', 'e2e4 c7c6', 'd2d4 d7d5', 'd2d4 g8f6', 'c2c4 e7e5', 'g1f3 d7d5',
  'e2e4 e7e5 g1f3 b8c6 f1b5', 'e2e4 e7e5 g1f3 b8c6 f1c4', 'e2e4 c7c5 g1f3 d7d6', 'd2d4 d7d5 c2c4 e7e6', 'd2d4 d7d5 c2c4 c7c6',
  'd2d4 g8f6 c2c4 e7e6', 'd2d4 g8f6 c2c4 g7g6', 'e2e4 d7d5', 'e2e4 g8f6', 'b1c3 d7d5', 'g2g3 d7d5', 'f2f4 d7d5', 'b2b3 e7e5',
  'e2e4 e7e5 b1c3 g8f6', 'e2e4 c7c5 b1c3 b8c6', 'd2d4 f7f5', 'c2c4 c7c5 b1c3 b8c6', 'e2e4 d7d6 d2d4 g8f6', 'd2d4 e7e6 c2c4 f8b4',
  'e2e4 e7e5 f2f4', 'e2e4 e7e5 d2d4 e5d4', 'e2e4 b7b6', 'd2d4 d7d5 c1f4',
].map(s => s ? s.split(' ') : []);

if (isMainThread) {
  const spec = (process.argv[2] || '1-2:20,2-3:20,3-4:20,4-5:20').split(',');
  const jobs = [];
  for (const item of spec) {
    const [pair, n] = item.split(':'), [a, b] = pair.split('-').map(Number);
    for (let g = 0; g < +n; g++) jobs.push({ a, b, opening: OPENINGS[Math.floor(g / 2) % OPENINGS.length], aWhite: g % 2 === 0 });
  }
  jobs.sort((x, y) => (x.a + x.b) - (y.a + y.b)); // fast pairings first
  const results = {}, t0 = Date.now(); let next = 0, done = 0;
  const threads = Math.max(1, os.cpus().length);
  const report = () => {
    const lines = Object.entries(results).map(([k, r]) => { const n = r.w + r.d + r.l, s = (r.w + r.d / 2) / n; return `${k}: +${r.w} =${r.d} -${r.l} (${(100 * s).toFixed(0)}%)`; });
    console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${done}/${jobs.length} games\n  ` + lines.join('\n  '));
  };
  for (let t = 0; t < threads; t++) {
    const w = new Worker(__filename, { workerData: {} });
    const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else w.terminate(); };
    w.on('message', r => {
      const key = `L${r.a} vs L${r.b}`, R = (results[key] ||= { w: 0, d: 0, l: 0, games: [] });
      R[r.score === 1 ? 'w' : r.score === 0 ? 'l' : 'd']++; R.games.push(r);
      done++; if (done % 10 === 0 || done === jobs.length) report();
      if (done === jobs.length) {
        require('fs').writeFileSync(process.argv[3] || 'elo-results.json', JSON.stringify(results, null, 1));
        process.exit(0);
      }
      feed();
    });
    feed();
  }
} else {
  const tts = {};
  parentPort.on('message', job => {
    const { a, b, opening, aWhite } = job;
    const p = new C.Position(), hist = [];
    for (const u of opening) { p.make(p.fromUci(u)); hist.push(u); }
    tts[a] ||= C.newTT(); tts[b] ||= C.newTT();
    for (const k of [a, b]) for (const arr of Object.values(tts[k])) arr.fill(0); // fresh memory each game
    let st = null, plies = 0;
    while (!(st = p.status()) && plies < 200) {
      const lvl = (p.turn === C.WHITE) === aWhite ? a : b;
      C.useTT(tts[lvl]);
      const r = C.Engine.think(p, lvl, hist);
      hist.push(C.Position.uci(r.move)); p.make(r.move); plies++;
    }
    let result, reason;
    if (st) { result = st.result; reason = st.reason; }
    else { // adjudicate long games by a short search of the final position
      C.useTT(C.newTT());
      const r = C.Engine.think(p, { depth: 6, time: 2000, noise: 0 }, ['x']);
      const white = p.turn === C.WHITE ? r.score : -r.score;
      result = white > 150 ? '1-0' : white < -150 ? '0-1' : '1/2-1/2'; reason = 'adjudicated (' + white + ')';
    }
    const aScore = result === '1/2-1/2' ? 0.5 : (result === '1-0') === aWhite ? 1 : 0;
    parentPort.postMessage({ a, b, aWhite, score: aScore, result, reason, plies, opening: opening.join(' ') });
  });
}
