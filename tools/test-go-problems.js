// Checks the Go problems in go-problems-data.js: every listed answer is accepted and can be played through to the end
// (following the solver's hints after White's answers), a sample of wrong moves is rejected with an explanation,
// and the daily schedule covers every weekday. Usage: node tools/test-go-problems.js [limit]
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const c = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'go-problems-data.js'), 'utf8'), c);
const PZ = c.window.GO_PROBLEMS;
global.GO_PROBLEMS = PZ;
const P = require('../go-problem.js'), D = require('../go-daily.js');
let fails = 0; const t0 = Date.now();
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };
const limit = +(process.argv[2] || PZ.length);

const themes = {}; PZ.forEach(p => themes[p.theme] = (themes[p.theme] || 0) + 1);
console.log(PZ.length, 'problems:', Object.entries(themes).map(([k, n]) => `${k} ${n}`).join(', '));
ok(PZ.length >= 200, 'at least 200 problems');
ok(new Set(PZ.map(p => p.stones)).size === PZ.length, 'no duplicate positions');
for (const p of PZ) {
  ok(p.stones.length === 81 && /^[XO.]+$/.test(p.stones), `${p.id}: board`);
  ok(P.THEMES[p.theme] && P.GOALS[p.goal], `${p.id}: theme and goal known`);
  ok(p.answers.length >= 1 && p.answers.length <= 2, `${p.id}: one or two answers`);
}

let played = 0, wrongs = 0;
for (const p of PZ.slice(0, limit)) {
  // play it through: the first listed answer, then hints
  const moves = []; let mv = p.answers[0], st = null;
  for (let k = 0; k < 30; k++) {
    st = P.judge(p, moves, mv);
    if (st.status !== 'good') break;
    moves.push(mv, st.reply);
    mv = P.hint(p, moves);
    if (!mv) { st = { status: 'stuck' }; break; }
  }
  ok(st.status === 'solved', `${p.id} (${p.theme}): played through, got ${st.status} after ${moves.join(' ')}`);
  for (const a of p.answers.slice(1)) { const r = P.judge(p, [], a); ok(r.status === 'good' || r.status === 'solved', `${p.id}: second answer ${a} accepted`); }
  // one wrong move next to the target
  const { b, o } = P.setup(p, []);
  const near = b.points.filter(q => b.c[q] === 0 && !p.answers.includes(b.name(q)) && b.legal(q) && (o.region ? o.region.includes(q) : b.DIRS.some(d => b.c[q + d] && b.chain[q + d] === b.chain[o.target]) ));
  if (near.length) {
    const r = P.judge(p, [], b.name(near[0]));
    ok(r.status === 'wrong' && r.why && r.why.length > 20, `${p.id}: wrong move ${b.name(near[0])} rejected (${r.status})`);
    wrongs++;
  }
  played++;
}
console.log(`played ${played} problems through, ${wrongs} wrong moves checked`);

// daily: a problem for every day of the next year, Monday easier than Sunday on average
const by = [[], [], [], [], [], [], []];
for (let d = 0; d < 364; d++) { const x = D.problemFor(d); ok(x && PZ[x.index], `daily ${d}`); by[x.band].push(PZ[x.index].rating); }
const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
ok(avg(by[0]) < avg(by[6]), 'Monday problems easier than Sunday ones');
console.log(`daily: Monday average ${Math.round(avg(by[0]))}, Sunday ${Math.round(avg(by[6]))}`);
console.log(((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
