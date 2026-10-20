// Builds the Chess Trainer's tactic drills (chess-trainer-data.js): forks, pins, skewers and two-move combinations.
// Each position is built around the motif (a fork square, a line with a king behind a piece, ...), padded with pawns and
// pieces, then checked by the engine: exactly one move must win at least two pawns' worth, the line must really use the
// motif, and the win must not be taken straight back. Half the positions are mirrored so Black is to move.
// Usage: node tools/generate-chess-trainer.js [perSet=40] [out=chess-trainer-data.js] [maxMinutes=120]
// The file is rewritten every 30 seconds, so a long run can be stopped at any point.
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os'), fs = require('fs'), path = require('path');
const C = require('../chess-core.js');
const { Position } = C;
const SETS = process.env.ONLY ? process.env.ONLY.split(',') : ['knightFork', 'fork', 'pin', 'skewer', 'mixed', 'combo'];

if (isMainThread) {
  const per = +(process.argv[2] || 40), out = process.argv[3] || path.join(__dirname, '..', 'chess-trainer-data.js'), maxMin = +(process.argv[4] || 120);
  const want = Object.fromEntries(SETS.map(s => [s, s === 'combo' ? Math.round(per * 0.75) : per]));
  const got = Object.fromEntries(SETS.map(s => [s, []])), seen = new Set(), t0 = Date.now();
  const done = () => SETS.every(s => got[s].length >= want[s]);
  const report = () => console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ` + SETS.map(s => `${s} ${got[s].length}/${want[s]}`).join('  '));
  const timer = setInterval(() => { report(); write(); if ((Date.now() - t0) / 60000 > maxMin) finish(); }, 30000);
  const workers = [];
  for (let t = 0; t < Math.max(1, os.cpus().length); t++) {
    const w = new Worker(__filename, { workerData: { seed: 1000 + t * 7919 } }); workers.push(w);
    w.on('message', m => {
      if (m.need) { w.postMessage({ need: SETS.filter(s => got[s].length < want[s]) }); return; }
      const key = m.item[0].split(' ').slice(0, 2).join(' ');
      if (seen.has(key) || got[m.set].length >= want[m.set]) return;
      seen.add(key); got[m.set].push(m.item);
      if (done()) finish();
    });
  }
  function write() {
    const body = SETS.map(s => `${s}: [\n${got[s].map(x => JSON.stringify(x)).join(',\n')}\n]`).join(',\n');
    fs.writeFileSync(out, `// Chess Trainer tactic drills, built and engine-checked by tools/generate-chess-trainer.js.\n// Each: [FEN, solution in UCI (solver, reply, solver, ...), other accepted moves for each solver move ('|' between moves),\n//        theme, explanation, material won in pawns]\nwindow.CHESS_TRAINER_DATA = {\n${body}\n};\n`);
  }
  function finish() {
    clearInterval(timer); report(); write();
    console.log('wrote', out, 'in', ((Date.now() - t0) / 60000).toFixed(1), 'min');
    workers.forEach(w => w.terminate()); process.exit(0);
  }
} else {
  let seed = workerData.seed;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1e6) / 1e6; };
  const pick = a => a[(rnd() * a.length) | 0];
  const VAL = [0, 100, 300, 320, 500, 900, 0], PTS = [0, 1, 3, 3, 5, 9, 0];
  const NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
  const to88 = s => ((s >> 3) << 4) | (s & 7), to64 = q => ((q >> 4) << 3) | (q & 7);
  const R = s => s >> 3, F = s => s & 7, at = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8 ? r * 8 + f : -1;
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const knightSq = s => KN.map(([a, b]) => at(R(s) + a, F(s) + b)).filter(x => x >= 0);
  const ray = (s, [dr, df]) => { const o = []; let r = R(s) + dr, f = F(s) + df; while (r >= 0 && r < 8 && f >= 0 && f < 8) { o.push(r * 8 + f); r += dr; f += df; } return o; };
  const fenOf = (pieces) => { const rows = []; for (let r = 7; r >= 0; r--) { let row = '', e = 0; for (let f = 0; f < 8; f++) { const p = pieces[r * 8 + f]; if (p) { if (e) row += e; e = 0; row += p; } else e++; } if (e) row += e; rows.push(row); } return rows.join('/') + ' w - - 0 1'; };
  const material = (pos, color) => { let s = 0; for (let q = 0; q < 120; q++) { if (q & 0x88) { q += 7; continue; } const p = pos.b[q]; if (p) s += (C.colorOf(p) === color ? 1 : -1) * VAL[C.typeOf(p)]; } return s; };

  // ---- skeletons: a motif laid out on an empty board, White to move ----
  function freeSq(P, ok) { for (let k = 0; k < 80; k++) { const s = (rnd() * 64) | 0; if (!P[s] && (!ok || ok(s))) return s; } return -1; }
  function clearPath(P, a, b) { const dr = Math.sign(R(b) - R(a)), df = Math.sign(F(b) - F(a)); let r = R(a) + dr, f = F(a) + df; while (r * 8 + f !== b) { if (P[r * 8 + f]) return false; r += dr; f += df; } return true; }
  // A square the piece can come from to reach `to` (slider along another line, knight hop, king step)
  function originFor(P, type, to, avoidLine) {
    const opts = [];
    if (type === 'N') knightSq(to).forEach(s => !P[s] && opts.push(s));
    else if (type === 'K') for (const [a, b] of ORTH.concat(DIAG)) { const s = at(R(to) + a, F(to) + b); if (s >= 0 && !P[s]) opts.push(s); }
    else for (const d of type === 'B' ? DIAG : type === 'R' ? ORTH : ORTH.concat(DIAG)) {
      if (avoidLine && avoidLine.some(x => x[0] === d[0] && x[1] === d[1] || x[0] === -d[0] && x[1] === -d[1])) continue;
      for (const s of ray(to, d)) { if (P[s]) break; opts.push(s); }
    }
    return opts.length ? pick(opts) : -1;
  }
  function knightFork(P) {
    const royal = rnd() < 0.75, k = freeSq(P, s => R(s) >= 3); P[k] = 'k';
    const F0 = royal ? pick(knightSq(k).filter(s => !P[s])) : freeSq(P); if (F0 == null || F0 < 0) return null;
    const ts = knightSq(F0).filter(s => !P[s] && s !== k); if (ts.length < (royal ? 1 : 2)) return null;
    const t1 = pick(ts); P[t1] = rnd() < 0.6 ? 'q' : 'r';
    if (!royal) { const t2 = pick(ts.filter(s => s !== t1)); if (t2 == null) return null; P[t2] = pick(['r', 'q', 'b']); }
    const S = pick(knightSq(F0).filter(s => !P[s] && !knightSq(k).includes(s))); if (S == null) return null; P[S] = 'N';
    return true;
  }
  function anyFork(P) {
    const type = pick(['P', 'B', 'R', 'Q', 'K', 'P', 'B', 'Q']);
    if (type === 'P') {
      const f = 1 + ((rnd() * 6) | 0), r = 2 + ((rnd() * 4) | 0), F0 = r * 8 + f;
      const a = F0 + 7, b = F0 + 9; if (P[a] || P[b] || P[F0]) return null;
      const big = ['n', 'b', 'r', 'q', 'k']; let x = pick(big), y = pick(big.filter(t => t !== x)); if (x === 'k' && y === 'k') return null;
      P[a] = x; P[b] = y; const from = F0 - 8; if (P[from]) return null; P[from] = 'P';
      return true;
    }
    if (type === 'K') {
      const F0 = freeSq(P, s => R(s) >= 2 && R(s) <= 5);
      const adj = ORTH.concat(DIAG).map(([a, b]) => at(R(F0) + a, F(F0) + b)).filter(s => s >= 0 && !P[s]);
      if (adj.length < 3) return null;
      const t1 = pick(adj), t2 = pick(adj.filter(s => s !== t1 && Math.max(Math.abs(R(s) - R(t1)), Math.abs(F(s) - F(t1))) > 1)); if (t2 == null) return null;
      P[t1] = pick(['r', 'b', 'n']); P[t2] = pick(['r', 'b', 'n']);
      const S = pick(adj.filter(s => s !== t1 && s !== t2 && !P[s])); if (S == null) return null; P[S] = 'K';
      return 'K';
    }
    const dirs = type === 'B' ? DIAG : type === 'R' ? ORTH : ORTH.concat(DIAG);
    const F0 = freeSq(P, s => R(s) >= 1 && R(s) <= 6);
    const rays = dirs.map(d => [d, ray(F0, d)]).filter(([, r]) => r.length >= 2);
    if (rays.length < 3) return null;
    const [d1, r1] = pick(rays), others = rays.filter(([d]) => d !== d1), [d2, r2] = pick(others);
    const s1 = r1[(rnd() * Math.min(4, r1.length)) | 0], s2 = r2[(rnd() * Math.min(4, r2.length)) | 0];
    if (P[s1] || P[s2] || !clearPath(P, F0, s1) || !clearPath(P, F0, s2)) return null;
    const royal = rnd() < 0.6;
    P[s1] = royal ? 'k' : pick(['r', 'q', 'n', 'b']);
    P[s2] = type === 'Q' ? pick(['r', 'n', 'b']) : type === 'R' ? pick(['q', 'n', 'b']) : pick(['r', 'q', 'n']);
    const S = originFor(P, type, F0, [d1, d2].concat(dirs.filter(d => ray(F0, d).includes(s1) || ray(F0, d).includes(s2))));
    if (S < 0) return null; P[S] = type;
    return true;
  }
  function pin(P) {
    const diag = rnd() < 0.5, dirs = diag ? DIAG : ORTH, back = pick(['k', 'k', 'k', 'q', 'r']);
    const y = freeSq(P, s => R(s) >= 3); P[y] = back;
    const d = pick(dirs), line = ray(y, d); if (line.length < 3) return null;
    const xi = (rnd() * 2) | 0, x = line[xi]; if (P[x]) return null;
    P[x] = back === 'k' ? pick(['n', 'r', 'b', 'q', 'n']) : back === 'q' ? pick(['n', 'b', 'r']) : pick(['n', 'b']);
    if (diag && P[x] === 'b' || !diag && P[x] === 'r' || P[x] === 'q' && back === 'k') { if (rnd() < 0.8) return null; }
    const pi = xi + 1 + ((rnd() * Math.min(4, line.length - xi - 1)) | 0), p = line[pi]; if (p == null || P[p]) return null;
    for (let k = xi + 1; k < pi; k++) if (P[line[k]]) return null;
    const type = rnd() < 0.8 ? (diag ? 'B' : 'R') : 'Q';
    const S = originFor(P, type, p, [d]); if (S < 0) return null; P[S] = type;
    // often a pawn ready to attack the pinned piece, or a second attacker
    if (rnd() < 0.5) { const a = at(R(x) - 2, F(x) + (rnd() < .5 ? 1 : -1)); if (a >= 8 && !P[a] && !P[a + 8]) P[a] = 'P'; }
    else if (rnd() < 0.5) { const t = pick(['N', 'B', 'R']), o = originFor(P, t, x, [d]); if (o >= 0) P[o] = t; }
    if (back !== 'k') { const k = freeSq(P, s => R(s) >= 5); P[k] = 'k'; }
    return true;
  }
  function skewer(P) {
    const diag = rnd() < 0.5, dirs = diag ? DIAG : ORTH, front = rnd() < 0.7 ? 'k' : 'q';
    const h = freeSq(P, s => R(s) >= 2 && R(s) <= 6); P[h] = front;
    const d = pick(dirs), behind = ray(h, d); if (behind.length < 1) return null;
    const yi = (rnd() * Math.min(3, behind.length)) | 0, y = behind[yi];
    for (let k = 0; k < yi; k++) if (P[behind[k]]) return null;
    if (P[y]) return null; P[y] = front === 'k' ? pick(['q', 'r', 'r', 'b', 'n']) : pick(['r', 'b', 'n']);
    const fwd = ray(h, [-d[0], -d[1]]); if (!fwd.length) return null;
    const pi = (rnd() * Math.min(5, fwd.length)) | 0, p = fwd[pi];
    for (let k = 0; k < pi; k++) if (P[fwd[k]]) return null;
    if (P[p]) return null;
    const type = rnd() < 0.75 ? (diag ? 'B' : 'R') : 'Q';
    const S = originFor(P, type, p, [d]); if (S < 0) return null; P[S] = type;
    if (front !== 'k') { const k = freeSq(P, s => R(s) >= 5); P[k] = 'k'; }
    return true;
  }
  function pad(P, busy) {
    const nwp = busy ? 4 + ((rnd() * 4) | 0) : (rnd() * 3) | 0, nbp = busy ? 4 + ((rnd() * 4) | 0) : (rnd() * 3) | 0;
    for (let k = 0; k < nwp; k++) { const s = freeSq(P, s => R(s) >= 1 && R(s) <= 4); if (s >= 0) P[s] = 'P'; }
    for (let k = 0; k < nbp; k++) { const s = freeSq(P, s => R(s) >= 3 && R(s) <= 6); if (s >= 0) P[s] = 'p'; }
    if (busy) {
      for (let k = 0; k < 1 + ((rnd() * 3) | 0); k++) { const s = freeSq(P, s => R(s) <= 3); if (s >= 0) P[s] = pick(['N', 'B', 'R', 'B']); }
      for (let k = 0; k < 2 + ((rnd() * 3) | 0); k++) { const s = freeSq(P, s => R(s) >= 4); if (s >= 0) P[s] = pick(['n', 'b', 'r', 'b', 'q']); }
    } else if (rnd() < 0.4) { const s = freeSq(P, s => R(s) >= 4); if (s >= 0) P[s] = pick(['n', 'b', 'p']); }
    if (!Object.values(P).includes('K')) { const s = freeSq(P, s => R(s) <= 1); if (s < 0) return false; P[s] = 'K'; }
    if (!Object.values(P).includes('k')) { const s = freeSq(P, s => R(s) >= 6); if (s < 0) return false; P[s] = 'k'; }
    return true;
  }
  function build(kind, busy) {
    const P = {};
    const ok = kind === 'knightFork' ? knightFork(P) : kind === 'fork' ? anyFork(P) : kind === 'pin' ? pin(P) : skewer(P);
    if (!ok || !pad(P, busy)) return null;
    let pos; try { pos = new Position(fenOf(P)); } catch (e) { return null; }
    if (pos.king[0] < 0 || pos.king[1] < 0 || pos.inCheck(1) || pos.inCheck(0)) return null;
    if (Object.entries(P).some(([s, p]) => (p === 'P' || p === 'p') && (R(+s) === 0 || R(+s) === 7))) return null;
    if (!pos.legal().length) return null;
    return pos;
  }

  // ---- motifs, read off a move in a line ----
  // Enemy pieces the piece on sq attacks (by the side that just moved)
  function hitsFrom(pos, sq) {
    pos.makeNull(); const caps = pos.gen([], true).filter(m => C.mFrom(m) === sq && (C.mFlags(m) & C.F_CAP)).map(m => C.mTo(m)); pos.unmakeNull();
    return caps;
  }
  // After the solver's move m (already made on pos), what motif is it? Returns { theme, text } or null.
  // `taken`: squares the solver captures on later in the line.
  function motif(pos, m, taken) {
    const to = C.mTo(m), me = pos.turn ^ 1, mover = C.typeOf(pos.b[to]), sqn = C.sqName;
    const nm = q => `${NAME[C.typeOf(pos.b[q])]} on ${sqn(q)}`;
    const hits = hitsFrom(pos, to).filter(q => { const t = C.typeOf(pos.b[q]); return t === 6 || VAL[t] > VAL[mover] || !pos.attacked(q, pos.turn); });
    if (hits.length >= 2 && hits.some(q => taken.includes(q) || C.typeOf(pos.b[q]) === 6)) {
      const king = hits.find(q => C.typeOf(pos.b[q]) === 6), other = hits.filter(q => q !== king);
      const parts = (king != null ? [nm(king)] : []).concat(other.slice(0, 2).map(nm));
      return { theme: 'fork', mover, targets: hits, text: `forks the ${parts.join(' and the ')}` };
    }
    if (mover === 3 || mover === 4 || mover === 5) {
      const dirs = (mover === 3 ? DIAG : mover === 4 ? ORTH : ORTH.concat(DIAG));
      const s64 = to64(to);
      for (const d of dirs) {
        const line = ray(s64, d).map(to88); let first = -1, second = -1;
        for (const q of line) { if (!pos.b[q]) continue; if (first < 0) first = q; else { second = q; break; } }
        if (first < 0 || second < 0) continue;
        const a = pos.b[first], b = pos.b[second];
        if (C.colorOf(a) === me || C.colorOf(b) === me) continue;
        const ta = C.typeOf(a), tb = C.typeOf(b);
        // skewer: the front piece is worth more (or is the king) and the one behind gets taken
        if ((ta === 6 || VAL[ta] > VAL[tb]) && taken.includes(second))
          return { theme: 'skewer', mover, targets: [first, second], text: `attacks the ${nm(first)}, and when it moves the ${nm(second)} behind it falls` };
        // pin: the piece behind is the king or worth more, and the pinned piece gets taken
        if ((tb === 6 || VAL[tb] > VAL[ta]) && taken.includes(first))
          return { theme: 'pin', mover, targets: [first, second], text: tb === 6 ? `pins the ${nm(first)} to the king on ${sqn(second)}: it can't move` : `pins the ${nm(first)} to the ${nm(second)}: if it moves, the ${NAME[tb]} is lost` };
      }
    }
    return null;
  }

  // ---- engine checks ----
  const SM = (pos, d) => C.scoreMoves(pos, d);
  function lineFrom(pos0, depth, maxSolver) {
    const me = pos0.turn, start = material(pos0, me), p = new Position(pos0.fen()), line = [], alts = [];
    let sm = SM(p, depth); if (sm.length < 2) return null;
    const base = start, w = winners(sm, base); if (!w) return null;
    alts.push(w.slice(1).map(x => Position.uci(x.move)));
    let mv = sm[0].move;
    for (let step = 0; step < maxSolver; step++) {
      line.push(Position.uci(mv)); p.make(mv);
      if (p.status()) break;
      const gained = material(p, me) - start;
      const reply = SM(p, depth)[0]; if (!reply) break;
      p.make(reply.move); const after = material(p, me) - start; p.unmake();
      if (gained >= 200 && after >= 200) break;
      line.push(Position.uci(reply.move)); p.make(reply.move);
      const next = SM(p, depth); if (next.length < 1 || next[0].score < base + 200) return null;
      mv = next[0].move;
      // other ways to collect: captures or promotions that are just as good (not slow moves that happen to keep the win)
      alts.push(next.filter(x => x.move !== mv && x.score >= next[0].score - 40 && x.score >= base + 200 && (C.mFlags(x.move) & (C.F_CAP | C.F_PROMO))).map(x => Position.uci(x.move)));
    }
    if (line.length % 2 === 0) return null;
    const gain = material(p, me) - start;
    if (gain < 200 && !p.status()) return null;
    if (!p.status()) { const back = SM(p, Math.max(3, depth - 1))[0]; if (back) { p.make(back.move); const kept = material(p, me) - start; p.unmake(); if (kept < 150) return null; } }
    return { line, alts: alts.slice(0, (line.length + 1) / 2), gain: Math.round(gain / 100) };
  }
  // The winning first moves: up to three that are about equally good (say a pin from two squares on the same line),
  // and every other move clearly worse and not winning
  function winners(sm, base) {
    const top = sm[0].score; if (top < base + 230) return null;
    const w = sm.filter(x => x.score >= top - 40), rest = sm.filter(x => x.score < top - 40);
    if (w.length > 3) return null;
    if (rest.length && (rest[0].score > base + 120 || top - rest[0].score < 180)) return null;
    return w;
  }
  // Read the motif at solver move index `k` (0 = first move) of a line
  function motifAt(pos0, line, k) {
    const p = new Position(pos0.fen()), taken = [];
    // squares the solver captures on after move k
    { const q = new Position(pos0.fen()); line.forEach((u, i) => { const m = q.fromUci(u); if (i % 2 === 0 && i > 2 * k && (C.mFlags(m) & C.F_CAP)) taken.push(C.mTo(m)); q.make(m); }); }
    let san = '';
    for (let i = 0; i < 2 * k; i++) p.make(p.fromUci(line[i]));
    const m = p.fromUci(line[2 * k]); san = p.san(m); p.make(m);
    const mo = motif(p, m, taken); if (!mo) return null;
    return Object.assign(mo, { san, check: p.inCheck() });
  }
  function sanLine(pos0, line) { const p = new Position(pos0.fen()), out = []; for (const u of line) { const m = p.fromUci(u); out.push(p.san(m)); p.make(m); } return out; }
  const whatTaken = (pos0, line) => { const p = new Position(pos0.fen()), got = []; line.forEach((u, i) => { const m = p.fromUci(u); if (i % 2 === 0 && (C.mFlags(m) & C.F_CAP)) got.push(NAME[C.typeOf(p.b[C.mTo(m)])]); p.make(m); }); return got; };

  function explain(pos0, res, mo, k) {
    const s = sanLine(pos0, res.line), won = whatTaken(pos0, res.line).filter(Boolean);
    const prize = won.length ? `the ${won[won.length - 1]}` : 'material';
    const label = { fork: 'Fork', pin: 'Pin', skewer: 'Skewer' }[mo.theme];
    let t = '';
    if (k === 1) t = `${s[0]} forces ${s[1]}. Now ${s[2]} ${mo.text}.`;
    else t = `${label}: ${s[0]} ${mo.text}.`;
    const rest = s.slice(2 * k + 1);
    if (rest.length >= 2) t += ` After ${rest[0]}, ${rest[1]} wins ${prize}.`;
    else if (rest.length === 1) t += ` ${rest[0]} and the win is in hand.`;
    return t;
  }

  // ---- combos: put a forcing check in front of a working single tactic ----
  // Two classic set-ups. Decoy: a piece lands next to Black's king with check and must be taken, pulling the king onto the
  // square where the tactic works. Drive: a check from a distance that leaves the king one or two squares to go to.
  // Returns up to three different set-ups (no engine work here, so it can afford many tries)
  function addPrelude(pos1, gain) {
    const out = [], seen = new Set();
    const P = {}; for (let s = 0; s < 64; s++) { const p = pos1.b[to88(s)]; if (p) P[s] = (C.colorOf(p) ? 'pnbrqk' : 'PNBRQK')[C.typeOf(p) - 1]; }
    const k1 = to64(pos1.king[1]);
    const k0s = ORTH.concat(DIAG).map(([a, b]) => at(R(k1) + a, F(k1) + b)).filter(s => s >= 0 && !P[s]);
    for (let tries = 0; tries < 80 && out.length < 3; tries++) {
      const k0 = pick(k0s); if (k0 == null) return out;
      const Q = Object.assign({}, P); delete Q[k1]; Q[k0] = 'k';
      let w0, w1, decoy = false;
      if (rnd() < 0.55) {
        // decoy: a rook or bishop (worth less than what the tactic wins) steps onto k1 with check
        const orth = R(k0) === R(k1) || F(k0) === F(k1), t = orth ? (gain >= 7 ? pick(['R', 'Q']) : 'R') : 'B';
        if (PTS[{ R: 4, B: 3, Q: 5 }[t]] > gain - 2) continue;
        w1 = k1; w0 = originFor(Q, t, k1, null); if (w0 < 0) continue; Q[w0] = t; decoy = true;
      } else {
        const white = Object.keys(P).map(Number).filter(s => 'NBRQ'.includes(P[s])); w1 = pick(white); if (w1 == null) continue;
        const t = P[w1]; w0 = originFor(Q, t, w1, null); if (w0 < 0) continue;
        delete Q[w1]; Q[w0] = t;
      }
      let pos0; try { pos0 = new Position(fenOf(Q)); } catch (e) { continue; }
      if (pos0.king[0] < 0 || pos0.king[1] < 0 || pos0.inCheck(1) || pos0.inCheck(0) || !pos0.legal().length) continue;
      const m = pos0.legal().find(x => to64(C.mFrom(x)) === w0 && to64(C.mTo(x)) === w1); if (!m) continue;
      pos0.make(m);
      const check = pos0.inCheck(), replies = pos0.legal(), toK1 = replies.some(x => C.mFrom(x) === pos0.king[1] && to64(C.mTo(x)) === k1);
      pos0.unmake();
      if (!check || !toK1 || replies.length > (decoy ? 3 : 2)) continue;
      const key = pos0.fen(); if (seen.has(key)) continue; seen.add(key);
      out.push(pos0);
    }
    return out;
  }

  // ---- mirror so Black is to move ----
  const flipSq = u => u[0] + (9 - +u[1]);
  const flipUci = u => flipSq(u.slice(0, 2)) + flipSq(u.slice(2, 4)) + u.slice(4);
  function mirror(fen, line, alts) {
    const [board] = fen.split(' ');
    const rows = board.split('/').reverse().map(r => r.replace(/[a-z]/gi, c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
    return { fen: rows.join('/') + ' b - - 0 1', line: line.map(flipUci), alts: alts.map(a => a.map(flipUci)) };
  }
  const flipText = t => t.replace(/([a-h])([1-8])(?![0-9])/g, (_, f, r) => f + (9 - +r));

  function attempt(set) {
    const busy = set === 'mixed' || set === 'combo';
    const kind = set === 'mixed' || set === 'combo' ? pick(['knightFork', 'fork', 'pin', 'skewer']) : set;
    const pos1 = build(kind, busy && set !== 'combo' ? true : set === 'combo' ? rnd() < 0.5 : false);
    if (!pos1) return null;
    const depth = busy ? 5 : 4;
    let pos = pos1, k = 0, res = null, mo = null;
    if (set === 'combo') {
      const r1 = lineFrom(pos1, depth, 2); if (!r1) return null;
      const mo1 = motifAt(pos1, r1.line, 0); if (!mo1) return null;
      // try each forcing set-up until one checks out
      for (const p0 of addPrelude(pos1, r1.gain)) {
        const r = lineFrom(p0, 5, 3); if (!r || r.line.length < 5) continue;
        const m = motifAt(p0, r.line, 1); if (!m) continue;
        pos = p0; res = r; mo = m; k = 1; break;
      }
      if (!res) return null;
    } else {
      res = lineFrom(pos, depth, 2); if (!res) return null;
      mo = motifAt(pos, res.line, 0); if (!mo) return null;
    }
    if (set === 'knightFork' && !(mo.theme === 'fork' && mo.mover === 2)) return null;
    if (set === 'fork' && !(mo.theme === 'fork' && mo.mover !== 2)) return null;
    if ((set === 'pin' || set === 'skewer') && mo.theme !== set) return null;
    // deeper look must agree for the busy sets
    if (busy) { const d = C.scoreMoves(pos, depth + 1), w = winners(d, material(pos, pos.turn)); if (!w || !w.some(x => Position.uci(x.move) === res.line[0])) return null; }
    let fen = pos.fen().split(' ').slice(0, 2).join(' ') + ' - - 0 1', line = res.line, alts = res.alts, text = explain(pos, res, mo, k);
    if (rnd() < 0.5) { const m = mirror(fen, line, alts); fen = m.fen; line = m.line; alts = m.alts; text = flipText(text); }
    return [fen, line.join(' '), alts.map(a => a.join(' ')).join('|'), mo.theme, text, res.gain];
  }

  let need = SETS.slice();
  parentPort.on('message', m => { if (m.need) need = m.need; });
  let n = 0;
  (function loop() {
    for (let k = 0; k < 40; k++) {
      const set = pick(need); if (!set) return;
      const item = attempt(set);
      if (item) parentPort.postMessage({ set, item });
    }
    if (++n % 5 === 0) parentPort.postMessage({ need: true });
    setImmediate(loop);
  })();
}
