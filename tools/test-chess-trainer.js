// Chess Trainer tests: endgame tables against known results, every drill generator, endgame drills played out with
// perfect play, and the stored tactic and mate lines. Run: node tools/test-chess-trainer.js [seedsPerLevel=20]
'use strict';
const C = require('../chess-core.js');
const EG = require('../chess-endgames.js');
const T = require('../chess-trainer-core.js');
const { Position, mFrom, mTo, mFlags, F_CAP, F_PROMO } = C;
const seeds = +process.argv[2] || 20;
let fails = 0;
const check = (name, cond, info = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '')); if (!cond) fails++; };
const sq = s => (+s[1] - 1) * 8 + 'abcdefgh'.indexOf(s[0]);

// ---- endgame tables ----
{
  let t = Date.now(); const Q = EG.tables('Q'), R = EG.tables('R'), P = EG.tables('P'); const ms = Date.now() - t;
  const maxPly = tb => { let m = 0; for (let i = 0; i < tb.v.length / 2; i++) if (!tb.dead[i] && tb.v[i] > m) m = tb.v[i]; return m - 1; };
  check('K+Q v K: longest mate is 10 moves', maxPly(Q) === 19, `${maxPly(Q)} plies; tables built in ${ms} ms`);
  check('K+R v K: longest mate is 16 moves', maxPly(R) === 31, `${maxPly(R)} plies`);
  check('K+P v K: king in front on the 6th wins', EG.probe('P', 1, sq('e6'), sq('e8'), sq('e5')) > 0);
  check('K+P v K: rook pawn with the defender in the corner draws', EG.probe('P', 1, sq('b6'), sq('a8'), sq('a5')) === 0);
  check('K+P v K: opposition, defender to move after Ke6 vs Ke8 with pawn e5 loses', EG.probe('P', 1, sq('e6'), sq('e8'), sq('e5')) > 0);
  check('K+P v K: pawn on e2, kings e1 / e8, White to move wins', EG.probe('P', 0, sq('e1'), sq('e8'), sq('e2')) > 0);
  check('K+P v K: Kd5 Pd4 vs Kd7 with White to move is a draw (Black has the opposition)', EG.probe('P', 0, sq('d5'), sq('d7'), sq('d4')) === 0);
  check('K+P v K: Kd5 Pd4 vs Kd7 with Black to move wins for White', EG.probe('P', 1, sq('d5'), sq('d7'), sq('d4')) > 0);
}

// ---- generators ----
for (const t of T.TRACKS) t.levels.forEach((L, li) => {
  if (L.kind === 'tactic' || L.kind === 'mate') return;
  const t0 = Date.now(); let n = 0, bad = [];
  for (let s = 1; s <= seeds; s++) for (const it of T.makeSet(t.key, li, s * 7919 + li)) {
    n++;
    if (!it) { bad.push('missing item'); continue; }
    if (it.kind === 'kpath') {
      const forb = new Set(it.forbidden), d = T.knightDist(it.from, forb.size ? forb : null)[it.to];
      if (d !== it.min || it.path.length - 1 !== it.min || it.path.slice(1).some(x => forb.has(x))) bad.push('kpath ' + JSON.stringify(it).slice(0, 120));
      if (L.p.guards && forb.has(it.from)) bad.push('knight starts on a guarded square');
    } else if (it.kind === 'grab') {
      const plan = T.grabPlan(it.from, it.pawns);
      if (plan.moves !== it.min || new Set(it.order).size !== it.pawns.length) bad.push('grab');
    } else if (it.kind === 'loose') {
      const pos = new Position(it.fen);
      for (let s64 = 0; s64 < 64; s64++) {
        const caps = T.capturesOn(pos, T.to88(s64)); if (!caps.length) continue;
        const best = Math.max(...caps.map(m => T.seeMove(pos, m)));
        if ((best > 0) !== it.answers.includes(s64)) bad.push('loose ' + it.fen + ' ' + T.nm64(s64));
      }
    } else if (it.kind === 'count') {
      const pos = new Position(it.fen), v = T.seeMove(pos, pos.fromUci(it.move));
      const ans = v > 0 ? 'win' : v < 0 ? 'lose' : 'even';
      let tot = 0; it.line.forEach(x => tot += T.PTS[x.took] * (x.side === 0 ? 1 : -1));
      if (ans !== it.answer || tot !== v) bad.push(`count ${it.fen} ${it.san} ${v} ${tot} ${it.answer}`);
    } else if (it.kind === 'square') {
      const v = EG.probe('P', it.turn, it.wk, it.bk, it.pawn), f = T.squareFacts(it.pawn, it.bk, it.turn);
      if ((v === 0) !== it.catches || f.catches !== it.catches) bad.push('square ' + it.fen);
    } else if (it.kind === 'route') {
      // independent check: replay the stored shortest path with the move rules, and confirm nothing shorter exists
      const items = it.stars.concat(it.targets), blockers = new Set(it.blockers);
      let cur = it.from, got = 0, okPath = true;
      for (const t of it.path.slice(1)) {
        const left = new Set(it.targets.filter((x, j) => !(got & (1 << (it.stars.length + j)))));
        if (!T.routeMoves(it.piece, cur, blockers, left).includes(t)) { okPath = false; break; }
        cur = t; const j = items.indexOf(t); if (j >= 0) got |= 1 << j;
      }
      const sol = T.routeSolve(it, it.from, 0);
      if (!okPath || got !== (1 << items.length) - 1 || it.path.length - 1 !== it.min || !sol || sol.min !== it.min) bad.push('route ' + JSON.stringify(it).slice(0, 160));
      if (blockers.has(it.from) || items.some(x => blockers.has(x)) || new Set(items).size !== items.length) bad.push('route overlap');
      if (L.p.piece && it.piece !== L.p.piece) bad.push('route piece');
      // the piece rules themselves, on an empty board: rook 14 squares, bishop 7-13, queen 21-27, king 3-8, knight 2-8
      const n = T.routeMoves(it.piece, it.from, new Set(), new Set()).length, rng = { R: [14, 14], B: [7, 13], Q: [21, 27], K: [3, 8], N: [2, 8], P: [1, 2] }[it.piece];
      if (n < rng[0] || n > rng[1]) bad.push(`route ${it.piece} on ${T.nm64(it.from)} has ${n} moves on an empty board`);
    } else if (it.kind === 'goal') {
      const pos = new Position(it.fen), legal = pos.legal().map(m => C.Position.uci(m));
      if (!it.answers.length || it.answers.some(u => !legal.includes(u))) { bad.push('goal answers not legal ' + it.fen); continue; }
      for (const m of pos.legal()) {
        const u = C.Position.uci(m), want = it.answers.includes(u);
        let is;
        if (it.goal === 'check') is = T.isCheckMove(pos, m);
        else if (it.goal === 'mate') is = T.isMateMove(pos, m);
        else if (it.goal === 'escape') is = T.escapeWay(pos, m, [it.checker]) === it.way;
        else if (it.goal === 'castle') is = !!(mFlags(m) & C.F_CASTLE) && (T.to64(mTo(m)) === 6 ? 'k' : 'q') === it.side;
        else if (it.goal === 'promote') is = !!(mFlags(m) & F_PROMO) && u.endsWith('q');
        else if (it.goal === 'ep') is = !!(mFlags(m) & C.F_EP);
        if (is !== want) bad.push(`goal ${it.goal} ${it.fen} ${u}: expected ${want}`);
      }
      if (it.goal === 'escape' && (!pos.inCheck() || T.checkers(pos).length !== 1 || T.to88(it.checker) == null)) bad.push('escape without a single check ' + it.fen);
      if (it.goal === 'check' && it.answers.some(u => T.isMateMove(pos, pos.fromUci(u)))) bad.push('check drill that is mate ' + it.fen);
      if (it.goal === 'castle' && it.ask === 'any' && pos.legal().filter(m => mFlags(m) & C.F_CASTLE).some(m => (T.to64(mTo(m)) === 6 ? 'k' : 'q') !== it.side)) bad.push('castle: both sides allowed ' + it.fen);
    } else if (it.kind === 'eg') {
      // play it out: the solver plays the table's best move, the defender (or attacker) answers as the page does
      const pos = new Position(it.fen), me = pos.turn, lim = it.limit || it.moves; let moves = 0, out = 'running';
      for (let ply = 0; ply < 300 && out === 'running'; ply++) {
        const st = pos.status(); if (st) { out = st.reason; break; }
        const ms = T.egMoves(pos);
        if (pos.turn === me) {
          const m = ms[0].move;
          if (mFlags(m) & F_PROMO) { out = ms[0].value > 0 ? 'promoted' : 'bad promotion'; break; }
          pos.make(m); moves++;
          if (it.win === false && (!T.egKey(pos) || T.egKey(pos).kind === 'draw')) { out = 'held'; break; }
          if (moves >= lim && !pos.status()) { out = it.win === false ? 'held' : 'out of moves'; break; }
        } else {
          const top = ms.filter(x => x.value === ms[0].value); pos.make(top[0].move);
        }
      }
      const good = L.p.piece === 'P' ? (L.p.win ? out === 'promoted' : ['held', 'stalemate', 'insufficient material', 'threefold repetition', 'the fifty-move rule'].includes(out)) : out === 'checkmate';
      if (!good) bad.push(`eg ${it.fen}: ${out}`);
    }
  }
  check(`${t.name} ${li + 1}. ${L.name}: ${n} drills generated and checked`, !bad.length, (bad.length ? bad.slice(0, 2).join('; ') + ' · ' : '') + `${Date.now() - t0} ms`);
});

// ---- tactics and mates ----
const fs = require('fs'), vm = require('vm');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../chess-trainer-data.js', 'utf8'), ctx);
const DATA = ctx.window.CHESS_TRAINER_DATA;
for (const t of T.TRACKS) t.levels.forEach((L, li) => {
  if (L.kind !== 'tactic' && L.kind !== 'mate') return;
  const pool = L.kind === 'tactic' ? (DATA[L.p.set] || []) : null;
  const items = T.makeSet(t.key, li, 1);
  let bad = [];
  if (items.length < L.count) bad.push(`only ${items.length} drills (need ${L.count})`);
  const all = L.kind === 'tactic' ? pool.map(x => ({ fen: x[0], line: x[1].split(' '), alts: x[2].split('|').map(s => s ? s.split(' ') : []), theme: x[3], text: x[4] })) : items;
  for (const it of all) {
    const pos = new Position(it.fen);
    for (let k = 0; k < it.line.length; k++) {
      const m = pos.fromUci(it.line[k]); if (!m) { bad.push(`illegal ${it.line[k]} in ${it.fen}`); break; }
      if (k % 2 === 0 && it.alts && it.alts[k / 2]) for (const a of it.alts[k / 2]) if (!pos.fromUci(a)) bad.push(`illegal alternative ${a}`);
      pos.make(m);
    }
    if (L.kind === 'mate') { const st = pos.status(); if (!st || st.reason !== 'checkmate') bad.push('mate line does not mate: ' + it.fen); }
    if (L.kind === 'tactic') {
      if (!it.text || /undefined|NaN/.test(it.text)) bad.push('explanation: ' + it.text);
      if (L.p.set === 'knightFork' && it.theme !== 'fork') bad.push('theme ' + it.theme);
      if ((L.p.set === 'pin' || L.p.set === 'skewer') && it.theme !== L.p.set) bad.push('theme ' + it.theme);
      if (L.p.set === 'combo' && it.line.length < 5) bad.push('combination too short');
    }
  }
  check(`${t.name} ${li + 1}. ${L.name}: ${all.length} positions`, !bad.length, bad.slice(0, 3).join('; '));
});

// spot-check a few tactic first moves with the engine: the stored move (or an accepted alternative) is the best
{
  let n = 0, bad = 0;
  for (const set of Object.keys(DATA)) for (const x of DATA[set].slice(0, 3)) {
    const pos = new Position(x[0]), sm = C.scoreMoves(pos, 4), ok = [x[1].split(' ')[0]].concat(x[2].split('|')[0] ? x[2].split('|')[0].split(' ') : []);
    n++; if (!ok.includes(Position.uci(sm[0].move)) && sm[0].score - sm.find(y => ok.includes(Position.uci(y.move))).score > 60) bad++;
  }
  check('engine agrees with stored first moves (spot check)', bad === 0, `${n - bad}/${n}`);
}
// ---- openings ----
{
  let O; try { O = T.openingData(); } catch (e) { check('opening lines and traps are all legal moves', false, e.message); }
  if (O) {
    check('opening lines and traps are all legal moves', true, `${O.lines.length} lines, ${O.traps.length} traps`);
    const badWhy = O.lines.filter(L => L.why.length !== L.ucis.filter((_, k) => (k % 2 === 0) === (L.side === 'w')).length || L.why.some(w => !w || /undefined/.test(w)));
    check('every learner move in a line has its idea', !badWhy.length, badWhy.map(L => L.full).join(', '));
    check('every line belongs to a described family', O.lines.every(L => O.families[L.fam]));
    // no book move for the learner simply loses material (engine, 3 plies)
    const weak = [];
    for (const L of O.lines) { const pos = new Position(); L.ucis.forEach((u, k) => { const m = pos.fromUci(u);
      if ((k % 2 === 0) === (L.side === 'w')) { const sm = C.scoreMoves(pos, 3), mine = sm.find(x => x.move === m); if (sm[0].score - mine.score > 160) weak.push(`${L.full} ${L.sans[k]}`); }
      pos.make(m); }); }
    check('no learner book move loses material', !weak.length, weak.join(', '));
    // each trap: the punishing move is the engine's choice and the line ends in mate or clearly ahead
    const badTrap = [];
    for (const t of O.traps) {
      const pos = new Position(t.fen), sm = C.scoreMoves(pos, t.depth || 5), first = pos.fromUci(t.line[0]); // some traps need a deeper look
      const p2 = new Position(t.fen); t.line.forEach(u => p2.make(p2.fromUci(u)));
      const mate = p2.status() && p2.status().reason === 'checkmate';
      if (sm[0].move !== first || (!mate && sm[0].score - (sm[1] ? sm[1].score : -1e9) < 50)) badTrap.push(t.name);
      if ((pos.turn === 0) !== (t.side === 'w')) badTrap.push(t.name + ' (side)');
    }
    check('every trap: the refutation is the best move and it works', !badTrap.length, badTrap.join(', '));
    // naming: every family and every variation can be asked, answers are unambiguous
    const fams = new Set(), vars = new Set();
    for (let sd = 1; sd < 150; sd++) { T.makeSet('openings', 0, sd).forEach(x => fams.add(x.answer)); T.makeSet('openings', 6, sd).forEach(x => vars.add(x.answer)); }
    check('name the opening covers every family', fams.size === Object.keys(O.families).length, `${fams.size}/${Object.keys(O.families).length}`);
    check('name the variation covers every variation', vars.size === new Set(O.lines.map(L => L.full)).size, `${vars.size}`);
    const amb = []; for (const x of T.makeSet('openings', 0, 3).concat(T.makeSet('openings', 6, 3))) if (new Set(x.options).size !== 4 || !x.options.includes(x.answer)) amb.push(x.answer);
    check('naming questions have four different options including the answer', !amb.length, amb.join(', '));
  }
}
// lessons before each level and each opening lesson: every page builds, every board's moves are legal
{
  const CL = require('../chess-lessons.js'); let ok = true, msg = '', n = 0;
  T.TRACKS.forEach(t => t.levels.forEach((L, i) => {
    try { const pg = CL.pages(t.key, i); if (!pg.length) throw new Error('no pages'); pg.forEach(p => { if (/undefined|NaN/.test(p.text || '')) throw new Error('text: ' + p.text); (p.figs || []).forEach(f => CL.figure(f)); }); n++; }
    catch (e) { ok = false; msg += ` ${t.key} ${i}: ${e.message}`; }
  }));
  for (const lvl of ['e4w', 'e4b', 'd4w', 'd4b']) for (const les of T.openingLessons(lvl)) { try { CL.openingPages(les).forEach(p => (p.figs || []).forEach(f => CL.figure(f))); } catch (e) { ok = false; msg += ` ${les.key}: ${e.message}`; } }
  check(`lessons build for all ${n} levels and every opening`, ok, msg);
}
// opening lessons: every repertoire line is in exactly one lesson of its level, and every lesson's drills build
{
  const OD = T.openingData(); let ok = true, msg = '';
  for (const lvl of ['e4w', 'e4b', 'd4w', 'd4b']) {
    const ls = T.openingLessons(lvl), ids = ls.flatMap(l => l.lines);
    const want = OD.lines.filter(l => l.lvl === lvl).map(l => l.id);
    if (ids.length !== want.length || new Set(ids).size !== ids.length || !want.every(id => ids.includes(id))) { ok = false; msg += ` ${lvl}: lines`; }
    for (const les of ls) {
      const set = T.lessonSet(lvl, les.fam);
      if (set.length !== les.count || !set.every(x => x.kind === 'oline' ? x.sans && x.side : x.fen && x.line)) { ok = false; msg += ` ${les.key}`; }
      if (les.traps.some(k => OD.traps[k].side !== lvl[2])) { ok = false; msg += ` ${les.key}: trap side`; }
    }
  }
  check('opening lessons cover every line once', ok, msg);
}
// the home tile's level count and optional list match the level map
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8'), tot = +(/OPTIONAL = \{[^}]*\}, total = (\d+);/.exec(html) || [])[1]; // the chess tile (the Go tile has its own total)
  const req = T.TRACKS.reduce((n, t) => n + t.levels.filter(L => !L.optional).length, 0);
  const opt = {}; T.TRACKS.forEach(t => t.levels.forEach((L, i) => { if (L.optional) (opt[t.key] ||= []).push(String(i)); }));
  const m = /OPTIONAL = (\{[^}]*\})/.exec(html), optHtml = m ? JSON.parse(m[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":')) : {};
  check('home tile counts the required levels', tot === req && JSON.stringify(optHtml) === JSON.stringify(opt), `tile ${tot}, map ${req}`);
}
// ---- curriculum paths ----
{
  const steps = T.PATHS.map(P => { try { return T.pathSteps(P.key); } catch (e) { return e.message; } });
  check('every path step is a real level', steps.every(Array.isArray), steps.filter(x => !Array.isArray(x)).join(', '));
  const all = [].concat(...steps.filter(Array.isArray)).map(x => x.join(':')), req = [];
  T.TRACKS.forEach(t => t.levels.forEach((L, i) => req.push(t.key + ':' + i)));
  check('the paths together cover every level once', new Set(all).size === all.length && req.every(k => all.includes(k)), `${new Set(all).size}/${req.length}; missing: ${req.filter(k => !all.includes(k)).join(' ')}`);
  for (const P of T.PATHS) {
    const spec = T.checkpointSpec(P.key), set = T.mixedSet(spec, 5), egs = set.filter(x => x.kind === 'eg').length;
    const upTo = [].concat(...T.PATHS.slice(0, T.PATHS.indexOf(P) + 1).map(Q => T.pathSteps(Q.key))); // its own steps, or reviews of earlier paths
    check(`${P.name} checkpoint: ${set.length} different drills from this path or earlier ones`, set.length === 8 && spec.every(([tk, i]) => upTo.some(([a, b]) => a === tk && b === i)) && egs <= 1 && new Set(set.map(x => JSON.stringify(x))).size === 8);
  }
  const pl = T.placementSet(11);
  check('placement test: ten drills in four tiers', pl.length === 10 && T.PLACEMENT.every(t => pl.filter(x => x.tier === t.tier).length === t.spec.length));
  const res = (ok) => T.placementResult(pl.map((x, k) => ({ tier: x.tier, ok: ok(x, k) }))).path;
  check('placement suggestions', res(() => false) === 'beginner' && res(x => x.tier === 'beginner') === 'improver' && res(x => x.tier !== 'advanced' && x.tier !== 'club') === 'club' && res(() => true) === 'advanced' && res(x => x.tier !== 'advanced') === 'advanced');
  // the home tile's copy of the steps
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const ok = T.PATHS.every(P => html.includes(`${P.key}: ['${P.name}', '${T.pathSteps(P.key).map(([a, b]) => a + ':' + b).join(' ')}']`));
  check('home tile knows each path\'s steps', ok);
}
// stars: drills solved on a retry count toward passing, three stars need every drill first time
{
  const L = { count: 10, pass: 8 };
  check('stars with retries', T.stars(L, 10, 10) === 3 && T.stars(L, 10, 8) === 2 && T.stars(L, 9, 9) === 2 && T.stars(L, 8, 5) === 1 && T.stars(L, 7, 7) === 0 && T.stars(L, 10) === 3);
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
