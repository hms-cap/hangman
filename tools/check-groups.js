// Four Groups checks. Run: node tools/check-groups.js [samples]
// 1) the bank: word format, list sizes, wordplay lists that really fit.
// 2) phrase lists: compounds in the system dictionary that a list is missing (e.g. PIN + BALL), so decoys are known.
// 3) generation: success rate, speed and decoys per level, every daily for two years, and some sample puzzles.
'use strict';
const fs = require('fs');
const G = require('../groups-core.js');
const samples = +process.argv[2] || 3;
let problems = 0;
const warn = m => { console.log('  ' + m); problems++; };

console.log('Bank:', G.CATS.length, 'categories');
const tierCount = [0, 0, 0, 0, 0]; G.CATS.forEach(c => tierCount[c.tier]++);
console.log('  by tier 1-4:', tierCount.slice(1).join(' / '));
for (const c of G.CATS) {
  const seen = new Set();
  for (const w of c.words) {
    if (!/^[A-Z]+$/.test(w)) warn(`${c.name}: "${w}" is not plain A-Z`);
    if (w.length > 10) warn(`${c.name}: ${w} is longer than 10 letters`);
    if (seen.has(w)) warn(`${c.name}: ${w} listed twice`);
    seen.add(w);
    if ((c.hide || c.anag || c.pal) && !(c.hide ? c.hide.some(t => w.length > t.length && w.includes(t)) : c.anag ? G.fits({ set: new Set(), anag: c.anag }, w) : true)) warn(`${c.name}: ${w} doesn't fit its own rule`);
  }
  if (c.words.length < 6) warn(`${c.name}: only ${c.words.length} words`);
}

// Phrase audit with the Hunspell dictionary
const dicPath = '/usr/share/hunspell/en_US.dic';
if (fs.existsSync(dicPath)) {
  const dict = new Set(fs.readFileSync(dicPath, 'utf8').split('\n').slice(1).map(l => l.split('/')[0].toUpperCase()));
  const all = [...new Set(G.CATS.flatMap(c => c.words))];
  // Compounds that are too obscure for a player to read into a puzzle (checked by hand)
  const IGNORE = new Set(('BEANBALL PUNCHBALL BUTTERBALL CORNBALL COWFISH PIGFISH GOATFISH GOOSEFISH DRUMFISH GUITARFISH ROSEFISH ' +
    'FILEFISH DOLLARFISH SPADEFISH SNAILFISH BATFISH BONEFISH PINFISH BILLFISH PANFISH CANDLEFISH MILKFISH FALLFISH LUMPFISH ' +
    'DUCKBOARD BRIDGEBOARD BARGEBOARD PUNCHBOARD FIREBOARD GUIDEBOARD WATERBOARD CENTERBOARD BOXBOARD FLASHBOARD ENDPAPER ' +
    'EARTHLIGHT SAFELIGHT MICROLIGHT FLOPHOUSE POTHOUSE PILOTHOUSE SPRINGHOUSE ORANGEMAN COWMAN PIKEMAN JAZZMAN BLUESMAN ' +
    'HOUSEMAN POTMAN GOLDMAN EARTHMAN PIMAN YARDMAN PENMAN CARMAN TRAINMAN BARGEMAN OYSTERMAN FLAGMAN GLASSMAN SWITCHMAN ' +
    'SHIPMAN BELLMAN WHEELMAN BOOKMAN NEWSPAPERMAN EXPRESSMAN MEATMAN DUSTMAN SIDEMAN FLOORMAN FLYMAN PITMAN PLACEMAN ' +
    'WATERMAN LANDMAN OUTMAN CHURCHMAN LEGMAN SCHOOLMAN RAGMAN BERGMAN CHINAMAN RADARMAN FIRELOCK FIREBASE FIREDOG FIREBOARD ' +
    'SUNGLASS SUNWISE SUNDOG SUNDEW SUNPROOF BRIEFLY DAYFLY SAWFLY HONEYLOCUST STARRING STARKEY STARFLOWER CHROMEBOOK ' +
    'BLANKBOOK WATERBIRD WATERMAN WATERBOARD WATERAGE CATFALL OUTFALL BLACKCAP CODPIECE CHEEKPIECE CROSSPIECE SIDEPIECE ' +
    'CASEMATE COPPERFIELD SPRINGFIELD WHITEFIELD DOWNFIELD QUEENSHIP HEADSHIP LIGHTSHIP MASTERSHIP GODSHIP CAMPBELL PIGNUT ' +
    'EARTHNUT BLADDERNUT CANDLENUT BACKHOUSE BACKSAW BACKSWORD BACKPLATE BACKCROSS BACKSET BACKCOURT BACKFLOW BRIDGEWORK ' +
    'FROSTWORK CABINETWORK CASEWORK WHEELWORK BOOKWORK BRIGHTWORK PINWORK HEADWORK TIMEWORK OUTWORK CHERRYSTONE EAGLESTONE ' +
    'IRONSTONE TURNSTONE THUNDERSTONE GOLDSTONE TINSTONE FOOTSTONE DOORSTONE FIRESTONE GLADSTONE BLACKSTONE GREENSTONE ' +
    'OILSTONE WORKBAG ICEFALL STONEFISH DEVILFISH STRAWBOARD SUNSTONE CATCHFLY STONEFLY FORMATE STONEWORK').split(' '));
  for (const [name, , , words, x] of globalThis.GROUPS_BANK) {
    if (!x || !(x.suf || x.pre)) continue;
    const list = new Set(words.split(' ')), miss = [];
    for (const w of all) if (!list.has(w) && w !== (x.suf || x.pre) && dict.has(x.suf ? w + x.suf : x.pre + w) && !IGNORE.has(x.suf ? w + x.suf : x.pre + w)) miss.push(w);
    if (miss.length) warn(`${name}: dictionary also has ${miss.map(w => x.suf ? w + x.suf : x.pre + w).join(', ')}`);
  }
} else console.log('  (no Hunspell dictionary: phrase audit skipped)');

// Generation
for (const level of ['easy', 'medium', 'hard']) {
  let ok = 0, decoys = 0, t0 = Date.now(); const used = new Map(), N = 300;
  for (let s = 1; s <= N; s++) {
    const p = G.generate(s * 7919 + 13, level); if (!p) continue;
    ok++; decoys += p.decoys;
    const cats = p.groups.map(g => G.CATS.find(c => c.name === g[0]));
    if (G.countSolutions(p.groups.flatMap(g => g.slice(1)), cats) !== 1) warn(`${level} seed ${s}: not unique`);
    p.groups.forEach(g => used.set(g[0], (used.get(g[0]) || 0) + 1));
  }
  const ms = (Date.now() - t0) / N;
  console.log(`${level}: ${ok}/${N} built, ${ms.toFixed(1)} ms each, ${(decoys / ok).toFixed(2)} decoys on average, ${used.size} categories used`);
  if (ok < N * 0.98) warn(`${level}: too many failures`);
}
let dailyFail = 0, worst = 0;
for (let d = 0; d < 730; d++) for (const level of ['easy', 'medium', 'hard']) { const t = Date.now(); if (!G.daily(d, level)) dailyFail++; worst = Math.max(worst, Date.now() - t); }
console.log(`dailies: ${730 * 3 - dailyFail}/${730 * 3} built, slowest ${worst} ms`);
if (dailyFail) warn(`${dailyFail} dailies failed`);

for (const level of ['easy', 'medium', 'hard']) {
  console.log(`\nSample ${level} puzzles:`);
  for (let d = 0; d < samples; d++) {
    const p = G.daily(d, level);
    console.log(`  day ${d + 1} (${p.decoys} decoy${p.decoys === 1 ? '' : 's'})`);
    for (const g of p.groups) {
      const extra = g.slice(1).map(w => { const other = p.groups.filter(h => h !== g && G.fits(G.CATS.find(c => c.name === h[0]), w)).map(h => h[0]); return other.length ? `${w} (also ${other.join(', ')})` : w; });
      console.log(`    ${g[0].padEnd(24)} ${extra.join(', ')}`);
    }
  }
}
console.log(problems ? `\n${problems} problem(s)` : '\nno problems');
process.exit(problems ? 1 : 0);
