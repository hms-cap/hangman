// Checks the Go trainer course: every level makes a full set of drills, problem levels have enough problems,
// rules drills are right (liberties, legality, counting), and the home page's level total matches.
// Usage: node tools/test-go-trainer.js
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const c = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'go-problems-data.js'), 'utf8'), c);
global.GO_PROBLEMS = c.window.GO_PROBLEMS;
const G = require('../go-core.js'), T = require('../go-trainer-core.js');
const { BLACK, WHITE, EMPTY } = G;
let fails = 0; const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };

let levels = 0;
for (const t of T.TRACKS) for (let i = 0; i < t.levels.length; i++) {
  const L = t.levels[i]; levels++;
  if (L.kind === 'pz') { const n = T.poolFor(L).length; console.log(`${t.key} ${i + 1} ${L.name}: ${n} problems`); ok(n >= L.count * 1.5, `${t.key} ${i + 1}: pool of ${n} for ${L.count} drills`); }
  for (let seed = 1; seed <= 25; seed++) {
    const set = T.makeSet(t.key, i, seed * 7919);
    ok(set.length === L.count, `${t.key} ${i + 1} seed ${seed}: ${set.length} of ${L.count} drills`);
    for (const it of set) {
      if (it.kind === 'libs') {
        const b = T.boardOf(it.N, it.stones), libs = b.libs(b.parse(it.target)).map(p => b.name(p)).sort();
        ok(libs.join() === it.libs.join() && libs.length >= 2, `libs ${it.target}`);
      } else if (it.kind === 'legal') {
        const b = T.boardOf(it.N, it.stones);
        if (it.play) { b.turn = WHITE; b.seen = new Set([b.key()]); ok(b.play(b.parse(it.play)) >= 0, 'ko capture plays'); }
        const p = b.parse(it.point);
        ok(b.turn === BLACK && b.c[p] === EMPTY && b.legal(p) === it.answer, `legal ${it.case} at ${it.point}: expected ${it.answer}`);
      } else if (it.kind === 'count') {
        const b = T.boardOf(it.N, it.stones); b.komi = 0; const s = b.score(new Set());
        ok(s.black === it.answer && it.options.includes(it.answer) && it.options.length === 4 && new Set(it.options).size === 4, 'count');
      } else ok(it.kind === 'pz' && it.p && it.p.answers.length, 'problem item');
    }
  }
}
// the four legality cases all appear
const cases = new Set(); for (let s = 1; s < 10; s++) T.makeSet('rules', 3, s).forEach(it => cases.add(it.case));
ok(['free', 'suicide', 'capture', 'ko'].every(k => cases.has(k)), 'all legality cases: ' + [...cases].join(','));
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), m = idx.match(/const total = (\d+); \/\/ levels in go-trainer-core\.js/);
ok(m && +m[1] === levels, `home page total ${m && m[1]} = ${levels} levels`);
console.log(levels, 'levels');
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
