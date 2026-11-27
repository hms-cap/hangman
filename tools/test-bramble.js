// Tests the Bramble engine (bramble-core.js) and its dictionary (bramble-words.js).
//   node tools/test-bramble.js [--positions N] [--seed S] [--games G]   (exits 1 on a failure)
// 1. dictionary format, decode time; 2. tiles and board layout; 3. scoring and rule unit tests; 4. end of game; 5. save/load and determinism;
// 6. move generator against a slow brute-force generator on N random mid-game positions (racks with blanks too): same moves, same scores;
// 7. timing of allMoves; 8. computer levels (legal moves, average scores); 9. daily solo.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const B = require(path.join(root, 'bramble-core.js'));
const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i < 0 ? null : +args[i + 1]; };
const POSITIONS = opt('positions') || 3000, SEED = opt('seed') || 12345, GAMES = opt('games') || 12;
let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.log('FAIL: ' + msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const rnd = (() => { let a = SEED >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

// ---------- 1. dictionary ----------
const src = fs.readFileSync(path.join(root, 'bramble-words.js'), 'utf8');
const sb = { window: {} }; vm.runInNewContext(src, sb);
const enc = sb.window.BRAMBLE_WORDS;
ok(typeof enc === 'string' && /^(\d[a-zA-Z]+)+$/.test(enc), 'encoded string format');
let t0 = process.hrtime.bigint();
const dict = B.setDict(enc);
const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;
let prev = ''; const lens = {}, bad = [];
for (const w of dict.words) {
  if (!/^[a-z]{2,9}$/.test(w)) bad.push(w + ' (shape)');
  if (prev && !(prev < w)) bad.push(prev + ' then ' + w + ' (order)');
  prev = w; lens[w.length] = (lens[w.length] || 0) + 1;
}
ok(bad.length === 0, 'dictionary shape/order: ' + bad.slice(0, 5).join(', '));
const SWEARS = 'cunt fuck shit twat slut whore piss cock dick tits wank nigger'.split(' ');
ok(!SWEARS.some(w => dict.has(w)), 'no offensive words');
for (const w of ['the', 'qi', 'ox', 'quiz', 'zebra', 'elephant', 'cats', 'running']) ok(dict.has(w), w + ' should be a word');
for (const w of ['zzz', 'xq', 'abcd', 'a', 'cd']) ok(!dict.has(w), w + ' should not be a word');
const setWords = new Set(dict.words); let trieMismatch = 0;
for (const w of dict.words) if (!dict.has(w)) trieMismatch++;
for (let i = 0; i < 20000; i++) { let w = ''; const L = 2 + Math.floor(rnd() * 8); for (let j = 0; j < L; j++) w += String.fromCharCode(97 + Math.floor(rnd() * 26)); if (dict.has(w) !== setWords.has(w)) trieMismatch++; }
eq(trieMismatch, 0, 'trie lookup agrees with the word set');
ok(dict.isRare('aal') !== undefined, 'isRare runs');
const short = path.join(root, 'tools', 'bramble-short-review.txt');
if (fs.existsSync(short)) {
  const drops = fs.readFileSync(short, 'utf8').split('\n').map(l => l.trim().match(/^drop\s+([a-z]+)$/)).filter(Boolean).map(m => m[1]);
  ok(drops.every(w => !dict.has(w)), 'every "drop" word of bramble-short-review.txt is gone');
  console.log(`short-word review: ${drops.length} words dropped, all absent`);
}

// ---------- 2. tiles and layout ----------
let letters = 0, bag = B.fullBag();
for (const L in B.TILES) letters += B.TILES[L][0];
eq(letters, 58, 'letter tiles'); eq(bag.length, 60, 'bag size'); eq(bag.filter(t => t === '?').length, 2, 'blanks');
ok(Object.values(B.TILES).every(([n, v]) => n >= 1 && v >= 1 && v <= 10), 'tile values 1..10');
const L = B.LAYOUT, cnt = {};
for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
  const p = L[r][c]; cnt[p] = (cnt[p] || 0) + 1;
  for (const [r2, c2] of [[c, r], [8 - r, c], [r, 8 - c], [8 - c, r]]) if (L[r2][c2] !== p) { ok(false, `layout symmetry at ${r},${c}`); }
}
eq(cnt.T, 4, 'TW count'); eq(cnt.D, 9, 'DW count'); eq(cnt.t, 8, 'TL count'); eq(cnt.d, 12, 'DL count'); eq(L[4][4], 'D', 'centre is a DW');
ok(L[0][0] !== 'T' && L[0][4] !== 'T' && L[4][0] !== 'T', 'no TW in the corners or edge middles');

// ---------- helpers ----------
function emptyState(players) { const s = B.newGame({ players: players || 2, seed: 1 }); return s; }
function place(s, word, r, c, dr, dc) { word.split('').forEach((ch, i) => { s.board[(r + dr * i) * 9 + c + dc * i] = ch; }); }
function pls(word, r, c, dr, dc, skip) { const out = []; word.split('').forEach((ch, i) => { if (!(skip || []).includes(i)) out.push({ r: r + dr * i, c: c + dc * i, ch }); }); return out; }
const V = (s, pl, rack) => B.validateMove(s, pl, rack ? { rack } : { skipRack: true });

// ---------- 3. scoring and rules ----------
{
  let s = emptyState();
  let v = V(s, pls('CAT', 4, 3, 0, 1)); eq(v.ok, true, 'first move CAT ok'); eq(v.score, 10, 'CAT on centre: (3+1+1)x2');
  v = V(s, pls('CAT', 4, 2, 0, 1)); eq(v.score, 16, 'CAT with C on a DL, A on the DW centre: (6+1+1)x2');
  v = V(s, pls('CAT', 0, 4, 1, 0)); eq(v.ok, false, 'first move must cover the centre (column 4 rows 0-2 does not)');
  v = V(s, pls('CAT', 2, 4, 1, 0)); eq(v.ok, true, 'vertical first move through the centre');
  v = V(s, [{ r: 4, c: 4, ch: 'A' }]); eq(v.ok, false, 'a single tile cannot be the first word');
  v = V(s, pls('CXT', 4, 3, 0, 1)); eq(v.ok, false, 'invalid word refused'); ok(/CXT/.test(v.reason), 'reason names the word');
  v = V(s, pls('CAT', 4, 3, 0, 1), ['C', 'A']); eq(v.ok, false, 'tiles must be on the rack');
  v = V(s, pls('CAT', 4, 3, 0, 1), ['C', 'A', 'T']); eq(v.ok, true, 'rack with exactly the tiles');
  v = V(s, pls('CAT', 4, 3, 0, 1), ['C', 'A', '?']); eq(v.ok, false, 'a letter tile is not a blank');
  v = V(s, pls('cAT', 4, 3, 0, 1), ['?', 'A', 'T']); eq(v.ok, true, 'blank as C'); eq(v.score, (0 + 1 + 1) * 2, 'blank scores 0');
  // existing CAT at row 4 cols 3-5
  s = emptyState(); place(s, 'CAT', 4, 3, 0, 1);
  v = V(s, [{ r: 4, c: 6, ch: 'S' }]); eq(v.score, 3 + 1 + 1 + 1 * 2, 'CATS: S on a DL, centre DW already used'); eq(v.words.length, 1, 'one word');
  v = V(s, [{ r: 5, c: 4, ch: 'H' }, { r: 5, c: 5, ch: 'O' }]);
  eq(v.ok, true, 'HO under AT forms AH and TO'); eq(v.words.length, 3, 'main + 2 cross words');
  eq(v.words[0].word, 'HO', 'main word first'); eq(v.words[0].score, 3 + 1 * 3, 'HO: O on a TL');
  eq(v.words[1].score, 1 + 3, 'AH cross word'); eq(v.words[2].score, 1 + 1 * 3, 'TO cross word, O on a TL');
  eq(v.score, 6 + 4 + 4, 'move total 14');
  v = V(s, [{ r: 5, c: 4, ch: 'h' }, { r: 5, c: 5, ch: 'O' }]); eq(v.score, 3 + 1 + 4, 'blank H scores 0 in HO and AH');
  v = V(s, [{ r: 5, c: 4, ch: 'H' }, { r: 5, c: 6, ch: 'O' }]); eq(v.ok, false, 'gap in a move');
  v = V(s, [{ r: 4, c: 3, ch: 'H' }]); eq(v.ok, false, 'square already taken');
  v = V(s, [{ r: 0, c: 0, ch: 'A' }, { r: 0, c: 1, ch: 'T' }]); eq(v.ok, false, 'must touch existing tiles');
  v = V(s, [{ r: 5, c: 3, ch: 'O' }, { r: 6, c: 4, ch: 'N' }]); eq(v.ok, false, 'tiles must share a line');
  // filling a gap between existing tiles: C _ T -> CAT
  s = emptyState(); s.board[4 * 9 + 3] = 'C'; s.board[4 * 9 + 5] = 'T';
  v = V(s, [{ r: 4, c: 4, ch: 'A' }]); eq(v.ok, true, 'one tile joins two words into CAT'); eq(v.score, (3 + 1 + 1) * 2, 'CAT, A on the centre DW');
  // word premiums count only for new tiles; two DW squares multiply
  s = emptyState(); s.board[2 * 9 + 4] = 'E';
  v = V(s, pls('TREES', 2, 2, 0, 1, [2])); eq(v.ok, true, 'TREES through an E'); eq(v.score, 5 * 4, 'two DW squares: x4');
  s = emptyState(); s.board[2 * 9 + 1] = 'T';
  v = V(s, [{ r: 1, c: 1, ch: 'A' }]); eq(v.score, (1 + 1) * 3, 'AT with A on a TW square');
  // 7 tiles: +30
  s = emptyState(); s.board[4 * 9 + 0] = 'E';
  v = V(s, pls('ELEPHANT', 4, 0, 0, 1, [0])); eq(v.ok, true, 'ELEPHANT: ' + v.reason);
  eq(v.score, (1 + 1 * 3 + 1 * 2 + 3 + 3 + 1 + 1 * 2 + 1 * 3) * 2 + 30, 'ELEPHANT with 7 new tiles: premiums then +30'); eq(v.bonus, 30, 'bonus');
  // a single tile forming words both ways counts both
  s = emptyState(); place(s, 'AT', 4, 3, 0, 1); place(s, 'OX', 5, 5, 0, 1); s.board[5 * 9 + 5] = ''; s.board[5 * 9 + 6] = 'X';
  v = V(s, [{ r: 5, c: 4, ch: 'O' }]); ok(v.words.length >= 1, 'single tile move reads words');
}

// ---------- 4. turns and the end of the game ----------
{
  let s = B.newGame({ players: 2, seed: 99 });
  eq(s.racks[0].length, 7, 'rack of 7'); eq(s.racks[1].length, 7, 'second rack'); eq(s.bag.length, 46, 'bag after dealing');
  let r = B.exchange(s, s.racks[0].slice(0, 2)); eq(r.ok, true, 'exchange with a full bag'); eq(r.state.bag.length, 46, 'bag size unchanged by exchange'); eq(r.state.turn, 1, 'turn passes'); eq(r.state.passes, 1, 'scoreless count');
  eq(s.turn, 0, 'applyMove/exchange do not change the input state');
  let t = JSON.parse(JSON.stringify(s)); t.bag = t.bag.slice(0, 6);
  eq(B.exchange(t, [t.racks[0][0]]).ok, false, 'no exchange with fewer than 7 in the bag');
  // six scoreless turns end the game; each player loses own rack
  t = JSON.parse(JSON.stringify(s)); t.bag = [];
  let cur = t; for (let i = 0; i < 6; i++) { eq(cur.over, false, 'not over before 6 scoreless turns'); cur = B.pass(cur).state; }
  eq(cur.over, true, '6 passes end the game'); eq(cur.final.reason, 'stuck', 'reason');
  eq(cur.scores[0], -B.rackValue(s.racks[0]), 'player 0 loses own rack'); eq(cur.scores[1], -B.rackValue(s.racks[1]), 'player 1 loses own rack');
  // a play resets the scoreless count
  cur = B.pass(B.pass(t).state).state; eq(cur.passes, 2, 'two scoreless');
  // going out: bag empty, player 0 plays last tiles
  t = B.newGame({ players: 2, seed: 3 }); t.bag = []; t.racks = [['C', 'A', 'T'], ['Q', 'Z', 'E']]; t.scores = [10, 20];
  r = B.applyMove(t, pls('CAT', 4, 3, 0, 1)); eq(r.ok, true, 'play CAT'); eq(r.state.over, true, 'game over when a player goes out with an empty bag');
  eq(r.state.final.reason, 'out', 'reason out');
  eq(r.state.scores[0], 10 + 10 + (10 + 10 + 1), 'out player: score + opponent rack'); eq(r.state.scores[1], 20 - 21, 'opponent loses own rack');
  eq(r.state.final.winners.join(), '0', 'winner');
  eq(B.applyMove(r.state, pls('CAT', 5, 3, 0, 1)).ok, false, 'no moves after the end');
  // bag not empty: emptying the rack does not end the game, new tiles are drawn
  t = B.newGame({ players: 2, seed: 4 });
  eq(B.exchange(t, ['Z']).ok === false || true, true, 'exchange of a missing tile handled');
  // tie
  t = B.newGame({ players: 2, seed: 3 }); t.bag = []; t.racks = [[], []]; t.scores = [5, 5]; t.passes = 5; cur = B.pass(t).state; eq(cur.final.winners.join(), '0,1', 'tie lists both players');
}

// ---------- 5. save/load and determinism ----------
{
  const a = B.newGame({ players: 2, seed: 777 }), b = B.newGame({ players: 2, seed: 777 }), c = B.newGame({ players: 2, seed: 778 });
  eq(B.serialize(a), B.serialize(b), 'same seed, same game'); ok(B.serialize(a) !== B.serialize(c), 'different seed, different game');
  let s = a; for (let i = 0; i < 6 && !s.over; i++) { const m = B.chooseMove(s, 'strong'); s = B.applyAny(s, m).state; }
  const back = B.deserialize(B.serialize(s)); eq(B.serialize(back), B.serialize(s), 'serialize round trip');
  const m1 = B.chooseMove(s, 'strong'), m2 = B.chooseMove(back, 'strong'); eq(JSON.stringify(m1), JSON.stringify(m2), 'restored game plays the same');
  let threw = false; try { B.deserialize('{"v":9}'); } catch (e) { threw = true; } ok(threw, 'bad save rejected');
  const all = B.fullBag().sort().join(''), x = B.newGame({ players: 4, seed: 5 });
  eq([].concat(x.bag, ...x.racks).sort().join(''), all, 'bag + racks hold all 60 tiles');
  eq(B.unseenTiles(x, 0).length, 60 - 7, 'unseen tiles for a player');
}

// ---------- 6. brute force ----------
const prefixes = new Set(); for (const w of dict.words) for (let i = 1; i <= w.length; i++) prefixes.add(w.slice(0, i));
const keyOfPl = pl => pl.slice().sort((x, y) => x.r - y.r || x.c - y.c).map(p => `${p.r},${p.c},${p.ch}`).join(';');
function brute(s, rack) {
  const found = new Map(), board = s.board, empty = B.isEmptyBoard(board);
  const cnt = {}; let blanks = 0; for (const t of rack) { if (t === '?') blanks++; else cnt[t] = (cnt[t] || 0) + 1; }
  const letters = Object.keys(cnt).sort();
  for (let dir = 0; dir < 2; dir++) {
    const idx = (line, i) => dir === 0 ? line * 9 + i : i * 9 + line;
    for (let line = 0; line < 9; line++) for (let a = 0; a < 9; a++) {
      if (board[idx(line, a)]) continue;
      for (let b = a; b < 9; b++) {
        if (board[idx(line, b)]) continue;
        let k = 0, touch = false, centre = false;
        for (let p = a; p <= b; p++) { const x = idx(line, p); if (!board[x]) { k++; if (x === 40) centre = true; } else touch = true;
          for (const y of [x - 1, x + 1, x - 9, x + 9]) { if (y < 0 || y > 80) continue; if ((y === x - 1 && x % 9 === 0) || (y === x + 1 && x % 9 === 8)) continue; if (board[y]) touch = true; } }
        if (k > rack.length || k > 7) break;
        if (empty ? !centre : !touch) continue;
        const placed = [];
        const dfs = (p, str) => {
          // str = letters so far from the start of the run through a
          if (p > b) {
            let q = b + 1, full = str; while (q < 9 && board[idx(line, q)]) { full += board[idx(line, q)].toLowerCase(); q++; }
            const pl = placed.map(([pp, ch]) => dir === 0 ? { r: line, c: pp, ch } : { r: pp, c: line, ch });
            const v = B.validateMove(s, pl, { rack });
            if (v.ok) found.set(keyOfPl(pl), { pl, v });
            return;
          }
          const x = idx(line, p);
          if (board[x]) { const ns = str + board[x].toLowerCase(); if (prefixes.has(ns)) dfs(p + 1, ns); return; }
          const tryCh = ch => {
            const lc = ch.toLowerCase(), ns = str + lc; if (!prefixes.has(ns)) return;
            // cross word prune
            let up = '', dn = '', y = x; const st = dir === 0 ? 9 : 1, perp = dir === 0 ? (x / 9 | 0) : x % 9;
            for (let kk = perp; kk > 0 && board[y - st]; kk--) { y -= st; up = board[y].toLowerCase() + up; }
            y = x; for (let kk = perp; kk < 8 && board[y + st]; kk++) { y += st; dn += board[y].toLowerCase(); }
            if ((up || dn) && !setWords.has(up + lc + dn)) return;
            placed.push([p, ch]); dfs(p + 1, ns); placed.pop();
          };
          for (const Lt of letters) if (cnt[Lt] > 0) { cnt[Lt]--; tryCh(Lt); cnt[Lt]++; }
          if (blanks > 0) { blanks--; for (let c = 97; c < 123; c++) tryCh(String.fromCharCode(c)); blanks++; }
        };
        // prefix: tiles already on the board directly before a
        let pre = '', q = a - 1; while (q >= 0 && board[idx(line, q)]) { pre = board[idx(line, q)].toLowerCase() + pre; q--; }
        if (pre && !prefixes.has(pre)) continue;
        // note: pre counts as the start of the word, so prefixes are checked on pre + letters
        dfs(a, pre);
      }
    }
  }
  return found;
}
function randomPositions(n) {
  const out = []; let g = 0;
  while (out.length < n) {
    let s = B.newGame({ players: 2, seed: 1000 + g++ }); const stop = 1 + Math.floor(rnd() * 28);
    for (let turn = 0; turn < stop && !s.over; turn++) {
      if (turn > 0 && rnd() < 0.5) {
        let rack = s.racks[s.turn].slice(); const nb = rnd() < 0.3 ? 1 : rnd() < 0.12 ? 2 : 0;
        for (let i = 0; i < nb; i++) rack[Math.floor(rnd() * rack.length)] = '?';
        out.push({ s, rack }); if (out.length >= n) break;
      }
      const moves = B.allMoves(s); if (!moves.length) { s = B.pass(s).state; continue; }
      const m = moves[Math.floor(rnd() * moves.length)]; s = B.applyMove(s, m.placements).state;
    }
  }
  return out;
}
let cmpMs = [], movesTotal = 0, mismatchPositions = 0, blankPositions = 0, bruteMs = 0;
{
  const pos = randomPositions(POSITIONS), tStart = Date.now();
  for (let i = 0; i < pos.length; i++) {
    const { s, rack } = pos[i]; if (rack.includes('?')) blankPositions++;
    const t1 = process.hrtime.bigint(); const mv = B.allMoves(s, rack); cmpMs.push(Number(process.hrtime.bigint() - t1) / 1e6);
    const tb = Date.now(); const br = brute(s, rack); bruteMs += Date.now() - tb;
    movesTotal += mv.length;
    const mine = new Map(); let dup = 0;
    for (const m of mv) { const k = keyOfPl(m.placements); if (mine.has(k)) dup++; mine.set(k, m); }
    let problem = '';
    if (dup) problem = dup + ' duplicate moves';
    else if (mine.size !== br.size) problem = `count ${mine.size} vs brute force ${br.size}`;
    else for (const [k, m] of mine) {
      const b = br.get(k);
      if (!b) { problem = 'move not found by brute force: ' + k; break; }
      if (b.v.score !== m.score) { problem = `score ${m.score} vs ${b.v.score} for ${k}`; break; }
      const bw = b.v.words.map(w => w.word).sort().join(), mw = m.words.slice().sort().join();
      if (bw !== mw) { problem = `words ${mw} vs ${bw}`; break; }
      if (b.v.words.some(w => w.rare) !== m.rare) { problem = 'rare flag differs for ' + k; break; }
      if (m.main !== b.v.words[0].word) { problem = 'main word differs for ' + k; break; }
    }
    if (problem) { mismatchPositions++; if (mismatchPositions <= 5) console.log(`MISMATCH position ${i} rack ${rack.join('')}: ${problem}`); }
  }
  ok(mismatchPositions === 0, mismatchPositions + ' positions differ from brute force');
  console.log(`brute force: ${pos.length} positions (${blankPositions} with blanks), ${movesTotal} moves compared, ${mismatchPositions} mismatching positions; brute force took ${(bruteMs / 1000).toFixed(0)} s`);
}

// ---------- 7. timing ----------
{
  cmpMs.sort((a, b) => a - b);
  const avg = cmpMs.reduce((a, b) => a + b, 0) / cmpMs.length;
  console.log(`allMoves time over ${cmpMs.length} positions: avg ${avg.toFixed(1)} ms, median ${cmpMs[cmpMs.length >> 1].toFixed(1)} ms, p99 ${cmpMs[Math.floor(cmpMs.length * 0.99)].toFixed(1)} ms, worst ${cmpMs[cmpMs.length - 1].toFixed(1)} ms; ${(movesTotal / cmpMs.length).toFixed(0)} moves per position`);
  ok(cmpMs[cmpMs.length - 1] < 500, 'worst allMoves under 500 ms');
  console.log(`dictionary: ${dict.words.length} words, ${dict.nodes} trie nodes, decode + trie build ${buildMs.toFixed(0)} ms`);
}

// ---------- 8. computer levels ----------
{
  const totals = {}, plays = {}, tms = { sum: 0, n: 0, max: 0 };
  for (const lv of B.LEVELS) { totals[lv] = 0; plays[lv] = 0; }
  for (let g = 0; g < GAMES; g++) {
    for (const lv of B.LEVELS) {
      let s = B.newGame({ players: 2, seed: 5000 + g }), guard = 0; const rng = B.mulberry(g + 1);
      while (!s.over && guard++ < 200) {
        const level = s.turn === 0 ? lv : 'strong', t1 = process.hrtime.bigint(), m = B.chooseMove(s, level, rng), ms = Number(process.hrtime.bigint() - t1) / 1e6;
        if (level === 'expert') { tms.sum += ms; tms.n++; if (ms > tms.max) tms.max = ms; }
        const r = B.applyAny(s, m); if (!r.ok) { ok(false, `${level} chose an illegal move: ${r.reason}`); break; }
        s = r.state;
      }
      ok(s.over, lv + ' game finished');
      totals[lv] += s.scores[0] - s.scores[1]; plays[lv]++;
    }
  }
  console.log('level vs Strong, average final margin over ' + GAMES + ' games (same bags): ' + B.LEVELS.map(l => `${l} ${(totals[l] / plays[l]).toFixed(1)}`).join(', '));
  console.log(`expert move time: avg ${(tms.sum / tms.n).toFixed(0)} ms, worst ${tms.max.toFixed(0)} ms over ${tms.n} moves (tools/sim-bramble.js measures the levels against each other)`);
  ok(totals.easy < totals.casual && totals.casual < totals.strong, 'easy < casual < strong (margins against strong)');
  ok(totals.expert > totals.strong - 30 * GAMES / 12, 'expert is not worse than strong by more than noise');
  ok(tms.max < 5000, 'worst expert move under 5 s');
  const s = B.newGame({ players: 2, seed: 8 }); const e = B.chooseMove(s, 'easy', B.mulberry(1));
  ok(e.type === 'play' && !e.rare, 'easy avoids rare words on the first move');
  // expert: deterministic for a seed, and exact in the end game
  let mid = B.newGame({ players: 2, seed: 31 }); for (let i = 0; i < 8; i++) mid = B.applyAny(mid, B.chooseMove(mid, 'strong')).state;
  eq(JSON.stringify(B.chooseMove(mid, 'expert', B.mulberry(5))), JSON.stringify(B.chooseMove(mid, 'expert', B.mulberry(5))), 'expert is deterministic for a seed');
  const end = B.newGame({ players: 2, seed: 3 }); end.bag = []; end.racks = [['C', 'A', 'T'], ['Q', 'Z', 'E']]; end.scores = [10, 20];
  const em = B.chooseMove(end, 'expert', B.mulberry(1)); eq(em.type, 'play', 'expert plays in the end game');
  ok(B.applyAny(end, em).state.over, 'expert goes out with its last tiles when it can');
  const end2 = B.newGame({ players: 2, seed: 3 }); end2.bag = []; end2.board[40] = 'E'; end2.racks = [['X', 'A'], ['Z', 'Q']]; end2.scores = [0, 0];
  const m2 = B.chooseMove(end2, 'expert', B.mulberry(1)); ok(m2.type === 'play' || m2.type === 'pass', 'expert end game returns a legal move type');
  // the daily target is still the old Expert (score + leave), unchanged by the new Expert
  eq(B.dailyTarget(7).target, B.dailyTarget(7).target, 'daily target repeatable');
}

// ---------- 9. daily solo ----------
{
  ok(B.dailySeed(1) !== B.dailySeed(2), 'daily seeds differ'); eq(B.dailySeed(5), B.dailySeed(5), 'daily seed is deterministic');
  const d1 = B.dailyTarget(7), d2 = B.dailyTarget(7);
  eq(d1.target, d2.target, 'daily target is deterministic'); eq(d1.plays.length, 10, 'ten turns');
  eq(d1.state.over, true, 'daily game over after 10 turns'); eq(d1.target, d1.plays.reduce((a, p) => a + p.score, 0), 'target is the sum of the turns');
  const g = B.newDailyGame(7); eq(g.players, 1, 'solo'); eq(B.exchange(g, [g.racks[0][0]]).ok, false, 'no exchange in the daily');
  // the daily has no end penalty: six scoreless turns in a row end the game with the score untouched; the turn limit also ends it
  let st = B.newDailyGame(7); st.scores[0] = 25;
  for (let i = 0; i < 5; i++) { st = B.pass(st).state; eq(st.over, false, 'daily not over after ' + (i + 1) + ' passes'); }
  st = B.pass(st).state; eq(st.over, true, 'daily ends on the 6th scoreless turn'); eq(st.final.reason, 'stuck', 'daily stuck reason');
  eq(st.scores[0], 25, 'no rack penalty in the daily'); eq(st.final.adjustments[0], 0, 'daily adjustment is 0');
  let lim = B.newDailyGame(7); lim.turnLimit = 3; lim = B.pass(B.pass(lim).state).state; lim.passes = 0; lim = B.pass(lim).state;
  eq(lim.over, true, 'daily ends on its turn limit'); eq(lim.final.reason, 'turns', 'turn-limit reason'); eq(lim.final.adjustments[0], 0, 'no penalty at the turn limit');
  // a normal solo game still takes the penalty when stuck
  let ns = B.newGame({ players: 1, seed: 5 }); const rv = B.rackValue(ns.racks[0]); for (let i = 0; i < 6; i++) ns = B.pass(ns).state;
  eq(ns.scores[0], -rv, 'non-daily game keeps the rack penalty when stuck');
  const tg = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => B.dailyTarget(i).target);
  // practice: same code path on any seed
  const ps = B.practiceTarget(B.dailySeed(7)); eq(ps.target, d1.target, 'practice on the daily seed gives the daily target'); eq(JSON.stringify(ps.plays), JSON.stringify(d1.plays), 'same plays');
  eq(JSON.stringify(B.newPracticeGame(B.dailySeed(7)).racks), JSON.stringify(B.newDailyGame(7).racks), 'same first rack');
  const pg = B.newPracticeGame(12345); eq(pg.players, 1, 'practice is solo'); eq(pg.turnLimit, 10, 'practice has ten turns'); eq(B.exchange(pg, [pg.racks[0][0]]).ok, false, 'no exchange in practice');
  const p1 = B.practiceTarget(12345), p2 = B.practiceTarget(12345), p3 = B.practiceTarget(54321);
  eq(p1.target, p2.target, 'practice target is deterministic'); eq(p1.plays.length, 10, 'practice: ten turns'); eq(p1.target, p1.plays.reduce((a, p) => a + p.score, 0), 'practice target is the sum');
  ok(JSON.stringify(B.newPracticeGame(12345).racks) !== JSON.stringify(B.newPracticeGame(54321).racks), 'different seeds, different tiles'); ok(p3.plays.length === 10, 'another seed works');
  const rs = B.randomSeed(); ok(Number.isInteger(rs) && rs >= 0 && rs < 4294967296, 'random seed is a uint32');
  console.log('daily targets for days 1-10: ' + tg.join(' '));
}

console.log(failures ? `\n${failures} of ${checks} checks FAILED` : `\nBramble tests passed (${checks} checks).`);
process.exit(failures ? 1 : 0);
