// Self-play matches between Bramble computer levels (seat-swapped, seeded), to measure how far apart the levels are.
//   node tools/sim-bramble.js [--matches casual:strong,easy:casual,expert:strong] [--games 40] [--seed 1] [--jobs 2] [--quiet]
//   --matches  comma list of A:B pairs; the table reports A's results against B (a positive margin means A is stronger)
//   --games    games per match, played as pairs: the same bag twice with the seats swapped, so luck of the draw cancels (rounded up to even)
//   --seed     base seed; every game's bag and every player's random choices derive from it, so a run is repeatable
//   --tune     key=value,... overrides of the tuning tables Bramble.EXPERT (candidates, budget, ...), EASY (lo, hi, short), CASUAL (top) and LEAVE for the run, e.g. --tune budget=400000
//   --jobs     worker threads (default: the number of CPUs, at most 4). Move times are wall clock, so more jobs than cores inflate them.
// Reports per match: wins/draws/losses of A, win rate (a draw counts half), average margin A-B with a 95% interval (computed over the
// seat-swapped pairs, so it is honest about the pairing), and the average and worst time of one chooseMove for each level.
const path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const root = path.join(__dirname, '..');

function playGame(B, a, b, bagSeed, aSeat, seed) {
  let s = B.newGame({ players: 2, seed: bagSeed }), guard = 0;
  const lv = aSeat === 0 ? [a, b] : [b, a], rng = [B.mulberry(seed * 2 + 1), B.mulberry(seed * 2 + 2)];
  const time = { [a]: { sum: 0, n: 0, max: 0 }, [b]: { sum: 0, n: 0, max: 0 } };
  while (!s.over && guard++ < 300) {
    const p = s.turn, t0 = process.hrtime.bigint();
    const m = B.chooseMove(s, lv[p], rng[p]);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6, t = time[lv[p]];
    t.sum += ms; t.n++; if (ms > t.max) t.max = ms;
    const r = B.applyAny(s, m); if (!r.ok) throw new Error(`${lv[p]} chose an illegal move: ${r.reason}`);
    s = r.state;
  }
  const mine = s.scores[aSeat], theirs = s.scores[1 - aSeat];
  return { margin: mine - theirs, a: mine, b: theirs, time };
}

if (!isMainThread) {
  const B = require(path.join(root, 'bramble-core.js'));
  B.setDict(require('vm').runInNewContext(require('fs').readFileSync(path.join(root, 'bramble-words.js'), 'utf8') + ';window.BRAMBLE_WORDS', { window: {} }));
  for (const kv of (workerData.tune || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); const T = [B.EXPERT, B.EASY, B.CASUAL, B.LEAVE].find(o => k in o); if (!T) throw new Error('unknown --tune key ' + k); T[k] = Array.isArray(T[k]) ? JSON.parse(v) : +v; }
  parentPort.on('message', job => {
    if (job === null) { process.exit(0); }
    const out = [0, 1].map(aSeat => playGame(B, job.a, job.b, job.bagSeed, aSeat, job.seed * 2 + aSeat));
    parentPort.postMessage({ job, out });
  });
  parentPort.postMessage({ ready: true });
} else {
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
  const matches = opt('matches', 'casual:strong,easy:casual,expert:strong').split(',').map(x => x.split(':'));
  const pairsN = Math.ceil(+opt('games', 40) / 2), seed = +opt('seed', 1), jobs = Math.max(1, +opt('jobs', Math.min(4, os.cpus().length)));
  const queue = [];
  matches.forEach(([a, b], mi) => { for (let k = 0; k < pairsN; k++) queue.push({ mi, a, b, k, bagSeed: 100000 * (seed + 1) + k, seed: seed * 100003 + k * 7 + mi }); });
  const results = matches.map(() => []), t0 = Date.now(); let done = 0, live = 0;
  const finish = () => {
    const f1 = x => x.toFixed(1), tab = [];
    const agg = {};   // per level: move time over all matches
    matches.forEach(([a, b], mi) => {
      const pairs = results[mi]; let w = 0, d = 0, l = 0, A = 0, Bs = 0; const pm = [];
      for (const pr of pairs) {
        pm.push((pr[0].margin + pr[1].margin) / 2);
        for (const g of pr) { if (g.margin > 0) w++; else if (g.margin < 0) l++; else d++; A += g.a; Bs += g.b;
          for (const lv of [a, b]) { const t = (agg[lv] = agg[lv] || { sum: 0, n: 0, max: 0 }), x = g.time[lv]; t.sum += x.sum; t.n += x.n; if (x.max > t.max) t.max = x.max; } }
      }
      const n = pm.length, g2 = 2 * n, mean = pm.reduce((x, y) => x + y, 0) / n;
      const sd = Math.sqrt(pm.reduce((x, y) => x + (y - mean) * (y - mean), 0) / Math.max(1, n - 1)), ci = 1.96 * sd / Math.sqrt(n);
      tab.push({ match: `${a} vs ${b}`, games: g2, W: w, D: d, L: l, winRate: (100 * (w + d / 2) / g2).toFixed(1) + '%', margin: `${mean >= 0 ? '+' : ''}${f1(mean)} +-${f1(ci)}`,
        avgPoints: `${f1(A / g2)} - ${f1(Bs / g2)}` });
    });
    console.log(`\nBramble self-play, ${pairsN} seat-swapped pairs per match, seed ${seed}, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
    console.table(tab);
    const tt = Object.keys(agg).map(lv => ({ level: lv, moves: agg[lv].n, 'avg ms': f1(agg[lv].sum / agg[lv].n), 'worst ms': f1(agg[lv].max) }));
    console.log('Time of one chooseMove (wall clock on this machine; a phone is roughly 3-4x slower):'); console.table(tt);
    process.exit(0);
  };
  const workers = [];
  const feed = w => { const j = queue.shift(); if (j) { live++; w.postMessage(j); } else { w.postMessage(null); } };
  for (let i = 0; i < jobs; i++) {
    const w = new Worker(__filename, { workerData: { tune: opt('tune', '') } }); workers.push(w);
    w.on('message', m => {
      if (m.ready) return feed(w);
      live--; (results[m.job.mi][m.job.k] = m.out); done++;
      if (!args.includes('--quiet') && done % 5 === 0) process.stderr.write(`  ${done}/${matches.length * pairsN} pairs, ${((Date.now() - t0) / 1000).toFixed(0)} s\r`);
      if (queue.length) feed(w); else { w.postMessage(null); if (live === 0) finish(); }
    });
    w.on('error', e => { console.error(e); process.exit(1); });
  }
}
