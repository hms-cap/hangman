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
      const good = L.p.piece === 'P' ? (L.p.win ? out === 'promoted' : ['held', 'stalemate', 'insufficient material'].includes(out)) : out === 'checkmate';
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
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
