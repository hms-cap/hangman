// Rebuilds trailwords.js (the Tendril dictionary) from the current dictionary, word frequencies and SCOWL/ESDB levels.
//   node tools/build-trail-words.js <zipf_en.json> <scowl-pre.txt> [--out file] [--base file] [--new-counted file] [--review file] [--report]
//   zipf_en.json : {word: Zipf} decoded from wordfreq's large_en list (Zipf = log10 occurrences per billion words)
//   scowl-pre.txt: data/scowl-pre.txt from the SCOWL/ESDB distribution (https://github.com/en-wl/wordlist)
// Deterministic: the same inputs always give the same trailwords.js. The starting point is tools/trail-words-base.js, the
// hand-reviewed dictionary from before this tool existed (the same format as trailwords.js); its targets are the hand-checked
// words that always stay counted. trailwords.js itself is only ever written, never read, so rebuilding is repeatable.
//
// The rule:
//   ACCEPTED = words already in the base dictionary, minus offensive words (OFFENSIVE below) and minus words that are not
//              ordinary lowercase words in ESDB (abbreviations, names, not listed at all; hand-reviewed targets are exempt from
//              this second test). A regular inflection of an ordinary lowercase ESDB word is never removed. Also removed:
//              anything ESDB marks vulgar-1 or offensive.
//   COUNTED  = (a) every word that was already a target (hand-reviewed), plus
//              (b) words with Zipf >= B_ZIPF whose ESDB size is <= B_SIZE (as a headword or as a listed inflection), plus
//              (c) regular inflections (plural, -s, -ed, -ing, -er, -est) of a counted headword, Zipf >= C_ZIPF.
//              Rules (b) and (c) skip NO_COUNT words (crude, sexual, sensitive, or really a name) and anything ESDB marks vulgar.
//   Everything else accepted is BONUS (accepted, optional).
const fs = require('fs'), path = require('path');
const { parseScowl, regular, loadWindowFile, OFFENSIVE, NO_COUNT, JUNK } = require('./scowl.js');
const root = path.join(__dirname, '..');

let B_ZIPF = 2.5, B_SIZE = 60, C_ZIPF = 2.2; // --b-zipf / --b-size / --c-zipf override these (for tuning only)


function argv() {
  const a = process.argv.slice(2), pos = [], o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--report') o.report = true;
    else if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--base') o.base = a[++i];
    else if (a[i] === '--b-zipf') B_ZIPF = +a[++i];
    else if (a[i] === '--b-size') B_SIZE = +a[++i];
    else if (a[i] === '--c-zipf') C_ZIPF = +a[++i];
    else if (a[i] === '--new-counted') o.newCounted = a[++i];
    else if (a[i] === '--review') o.review = a[++i];
    else pos.push(a[i]);
  }
  return { pos, o };
}

function main() {
  const { pos, o } = argv();
  if (pos.length < 2) { console.error('usage: node tools/build-trail-words.js <zipf_en.json> <scowl-pre.txt> [--out file] [--base file] [--new-counted file] [--review file] [--report]'); process.exit(2); }
  const Trail = require('../trail-core.js');
  const zipf = JSON.parse(fs.readFileSync(pos[0], 'utf8'));
  const Z = w => zipf[w] || 0;
  const outFile = o.out || path.join(root, 'trailwords.js');
  const baseFile = o.base || path.join(__dirname, 'trail-words-base.js');
  const cur = Trail.decode(loadWindowFile(baseFile, 'TRAIL_WORDS'));
  const { words: esdb, lemmas, bad } = parseScowl(pos[1]);

  // ---- 1. accepted ----
  const valid = new Set(esdb.keys());          // lowercase words listed (as headword or listed inflection) of ordinary lemmas
  for (const [lem, L] of lemmas) for (const p of L.pos) for (const f of regular(lem, p)) valid.add(f);
  const flagged = (w, re) => { const r = esdb.get(w); return !!r && [...r.usage].some(u => re.test(u)); };
  const isOffensive = w => OFFENSIVE.has(w) || JUNK.has(w) || flagged(w, /^(vulgar-1|offensive)/);
  const noCount = w => NO_COUNT.has(w) || flagged(w, /^(vulgar|offensive)/);
  const removedOffensive = [], removedOther = [], accepted = [];
  const reviewPath = o.review || path.join(__dirname, 'trail-word-review.txt');
  const REMOVE = new Set(fs.existsSync(reviewPath) ? fs.readFileSync(reviewPath, 'utf8').split('\n').map(l => l.trim().match(/^remove\s+([a-z]+)$/)).filter(Boolean).map(m => m[1]) : []);
  for (const w of cur.words) {
    if (isOffensive(w) || REMOVE.has(w)) removedOffensive.push(w);
    else if (!valid.has(w) && !cur.targets.has(w)) removedOther.push(w); // hand-reviewed targets are not second-guessed by ESDB
    else accepted.push(w);
  }
  const acc = new Set(accepted);

  // ---- 2. counted ----
  const counted = new Set();
  for (const w of cur.targets) if (acc.has(w)) counted.add(w);              // (a)
  const bOK = w => acc.has(w) && esdb.get(w) && esdb.get(w).strongSize <= B_SIZE && Z(w) >= B_ZIPF && !noCount(w);
  for (const w of acc) if (bOK(w)) counted.add(w);                          // (b)
  const heads = [...lemmas.keys()].filter(l => counted.has(l)).sort();
  for (const h of heads) {                                                   // (c)
    const L = lemmas.get(h), cand = new Set();
    for (const [f, info] of L.forms) if (!info.weak) cand.add(f);
    for (const p of L.pos) for (const f of regular(h, p)) cand.add(f);
    for (const f of cand) if (acc.has(f) && Z(f) >= C_ZIPF && !noCount(f)) counted.add(f);
  }

  // (d) reviewed: newly counted words that a reviewer judged rare/technical (or a name/crude) go back to bonus.
  //     tools/trail-word-review.txt, lines "rare <word>" or "flag <word>"; hand-reviewed targets (a) are never demoted.
  const reviewFile = o.review || path.join(__dirname, 'trail-word-review.txt');
  let demoted = 0;
  if (fs.existsSync(reviewFile)) for (const line of fs.readFileSync(reviewFile, 'utf8').split('\n')) {
    const m = line.trim().match(/^(rare|flag)\s+([a-z]+)$/); if (!m) continue;
    if (counted.has(m[2]) && !cur.targets.has(m[2])) { counted.delete(m[2]); demoted++; }
  }
  console.error(`review: ${demoted} newly counted words returned to bonus (${reviewFile})`);

  // ---- 3. write ----
  const sorted = accepted.slice().sort();
  let enc = '', prev = '';
  for (const w of sorted) {
    let k = 0; while (k < prev.length && k < w.length && prev[k] === w[k]) k++;
    k = Math.min(k, 9);
    const suf = w.slice(k); enc += k + (counted.has(w) ? suf.toUpperCase() : suf); prev = w;
  }
  const header = `// Tendril dictionary: 4-8 letter words, sorted and front-coded (digit = letters shared with the previous word).
// UPPERCASE suffix = a counted word (an ordinary everyday word that counts towards finishing); lowercase = bonus (accepted, optional).
// Accepted words come from the Hunspell en_US dictionary, minus abbreviations, names and offensive words. Counted words: the hand-reviewed
// targets, plus words with Zipf >= ${B_ZIPF} that SCOWL lists at size ${B_SIZE} or smaller, plus their regular inflections (plural, -s, -ed, -ing,
// -er, -est) with Zipf >= ${C_ZIPF}. Rebuild with tools/build-trail-words.js; check with tools/check-trail-words.js. Daily grids are in trail-daily.js.
// Word frequencies: wordfreq by Robyn Speer, CC BY-SA 4.0; word list levels: SCOWL/ESDB by Kevin Atkinson, MIT-like licence.
`;
  const text = header + 'window.TRAIL_WORDS = "' + enc + '";\n';
  fs.writeFileSync(outFile, text);

  if (o.newCounted) {
    const fresh = [...counted].filter(w => !cur.targets.has(w)).sort((a, b) => Z(b) - Z(a) || (a < b ? -1 : 1));
    fs.writeFileSync(o.newCounted, fresh.map(w => w + ' ' + Z(w).toFixed(2)).join('\n') + '\n');
  }
  const stats = { before: { words: cur.words.length, targets: cur.targets.size }, accepted: accepted.length, counted: counted.size, bonus: accepted.length - counted.size,
    removedOffensive, removedOther, parseLinesSkipped: bad.length };
  if (o.report) {
    const dailyStr = loadWindowFile(path.join(root, 'trail-daily.js'), 'TRAIL_DAILY');
    const newDict = Trail.decode(loadWindowFile(outFile, 'TRAIL_WORDS')), n = dailyStr.length >> 4;
    const per = (dict, idxs) => idxs.map(i => { const a = Trail.analyze(dailyStr.slice(i * 16, i * 16 + 16), dict); return [a.targets.length, a.bonus.length]; });
    const all = Array.from({ length: n }, (_, i) => i);
    const stat = rows => { const t = rows.map(r => r[0]).sort((a, b) => a - b), q = p => t[Math.min(t.length - 1, Math.floor(p * t.length))]; return { avgCounted: +(t.reduce((s, x) => s + x, 0) / t.length).toFixed(1), avgBonus: +(rows.reduce((s, r) => s + r[1], 0) / rows.length).toFixed(1), min: t[0], p10: q(.1), median: q(.5), p90: q(.9), max: t[t.length - 1] }; };
    stats.grids = n; stats.perGridBefore = stat(per(cur, all)); stats.perGridAfter = stat(per(newDict, all));
    for (const i of [42, 43]) {
      const g = dailyStr.slice(i * 16, i * 16 + 16), b = Trail.analyze(g, cur), a = Trail.analyze(g, newDict);
      stats['daily' + (i + 1)] = { grid: g, before: { counted: b.targets, bonus: b.bonus }, after: { counted: a.targets, bonus: a.bonus } };
    }
  }
  console.log(JSON.stringify(stats, null, 1));
}

if (require.main === module) main();
module.exports = { parseScowl, regular, OFFENSIVE, NO_COUNT, JUNK };
