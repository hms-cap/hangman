// Builds bramble-words.js (the Bramble dictionary) from SCOWL/ESDB and word frequencies.
//   node tools/build-bramble-words.js <zipf_en.json> <scowl-pre.txt> [--out file] [--candidates file] [--short-review file] [--report]
//   zipf_en.json : {word: Zipf} decoded from wordfreq's large_en list (Zipf = log10 occurrences per billion words)
//   scowl-pre.txt: data/scowl-pre.txt from the SCOWL/ESDB distribution (https://github.com/en-wl/wordlist)
//   --candidates file : also write every 2- and 3-letter word the rule accepts (before the short-word review), one per line
//   --short-review file (default tools/bramble-short-review.txt, if it exists): lines "drop <word>" remove 2-3 letter words
// Deterministic: the same inputs always give the same bramble-words.js.
//
// The rule:
//   ACCEPTED = lowercase ordinary words of 2-9 letters that ESDB lists (as a headword or a listed inflection, never a
//              weak/variant spelling) at SCOWL size <= 70, minus offensive words: OFFENSIVE/JUNK (tools/scowl.js), "remove" lines of
//              tools/trail-word-review.txt, anything ESDB marks vulgar or offensive, and the reviewed "drop" lines.
//   RARE     = judged on the base word (lemma) when the word is a regular inflection (plural, -ed, -ing, -er, -est ...) of a base word that ESDB
//              lists: rare only if the form itself is rare AND every possible base is rare (SCOWL size > 50 or Zipf < 2.5, or a
//              name-like word); so a common form of a rare base ("during") stays ordinary. Any other word is judged on its own form: SCOWL size > 50 or Zipf < 2.5 or name-like (NAMES in
//              tools/scowl.js). So "cats" and "walked" are ordinary because "cat" and "walk" are.
const fs = require('fs'), path = require('path');
const { parseScowl, regular, OFFENSIVE, JUNK, NAMES } = require('./scowl.js');
const root = path.join(__dirname, '..');
const MAX_SIZE = 70, RARE_SIZE = 50, RARE_ZIPF = 2.5, MIN_LEN = 2, MAX_LEN = 9;

function argv() {
  const a = process.argv.slice(2), pos = [], o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--report') o.report = true;
    else if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--candidates') o.candidates = a[++i];
    else if (a[i] === '--short-review') o.shortReview = a[++i];
    else pos.push(a[i]);
  }
  return { pos, o };
}
const readLines = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').map(l => l.trim()) : [];

function build(zipfFile, scowlFile, opts = {}) {
  const zipf = JSON.parse(fs.readFileSync(zipfFile, 'utf8'));
  const { words: esdb, lemmas } = parseScowl(scowlFile);
  const reviewFile = path.join(__dirname, 'trail-word-review.txt');
  const REMOVE = new Set(readLines(reviewFile).map(l => l.match(/^remove\s+([a-z]+)$/)).filter(Boolean).map(m => m[1]));
  const flagged = r => [...r.usage].some(u => /^(vulgar|offensive)/.test(u));
  const cand = [];
  for (const [w, r] of esdb) {
    if (w.length < MIN_LEN || w.length > MAX_LEN || r.strongSize > MAX_SIZE) continue;
    if (OFFENSIVE.has(w) || JUNK.has(w) || REMOVE.has(w) || flagged(r)) continue;
    cand.push(w);
  }
  cand.sort();
  const shortCandidates = cand.filter(w => w.length <= 3);
  const shortReview = opts.shortReview === undefined ? path.join(__dirname, 'bramble-short-review.txt') : opts.shortReview;
  const drop = new Set(shortReview ? readLines(shortReview).map(l => l.match(/^drop\s+([a-z]{2,3})$/)).filter(Boolean).map(m => m[1]) : []);
  const words = cand.filter(w => !drop.has(w));
  const selfRare = w => (esdb.has(w) ? esdb.get(w).strongSize : 999) > RARE_SIZE || (zipf[w] || 0) < RARE_ZIPF || NAMES.has(w);
  // base words (lemmas) of which each word is a regular inflection
  const bases = new Map();
  for (const [lem, L] of lemmas) {
    for (const pos of L.pos) for (const f of regular(lem, pos)) {
      if (f === lem || !L.forms.has(f)) continue;
      let a = bases.get(f); if (!a) bases.set(f, a = new Set()); a.add(lem);
    }
  }
  const rareOf = w => { const b = bases.get(w); return b ? selfRare(w) && [...b].every(selfRare) : selfRare(w); }; // an inflection is rare only if it AND its base word are rare
  const rare = new Set(words.filter(rareOf));
  const oldRare = new Set(words.filter(selfRare));
  return { words, rare, oldRare, bases, shortCandidates, dropped: [...drop].filter(w => cand.includes(w)), reviewApplied: drop.size > 0 };
}

function encode(words, rare) {
  let enc = '', prev = '';
  for (const w of words) {
    let k = 0; while (k < prev.length && k < w.length && prev[k] === w[k]) k++;
    k = Math.min(k, 9);
    const suf = w.slice(k); enc += k + (rare.has(w) ? suf.toUpperCase() : suf); prev = w;
  }
  return enc;
}

function main() {
  const { pos, o } = argv();
  if (pos.length < 2) { console.error('usage: node tools/build-bramble-words.js <zipf_en.json> <scowl-pre.txt> [--out file] [--candidates file] [--short-review file] [--report]'); process.exit(2); }
  const r = build(pos[0], pos[1], { shortReview: o.shortReview });
  if (o.candidates) fs.writeFileSync(o.candidates, r.shortCandidates.join('\n') + '\n');
  const enc = encode(r.words, r.rare);
  const header = `// Bramble dictionary: 2-9 letter words, sorted and front-coded (digit = letters shared with the previous word, at most 9).
// UPPERCASE suffix = a rare word (the game may show "rare word"): a base word with SCOWL size > ${RARE_SIZE} or Zipf < ${RARE_ZIPF}, or a regular inflection
// (plural, -ed, -ing, -er, -est) of such a base; lowercase = an ordinary word. Decode with Bramble.decode.
// Accepted words: lowercase ordinary words and their inflections listed by SCOWL/ESDB at size ${MAX_SIZE} or smaller, minus abbreviations, names,
// offensive words (tools/scowl.js, tools/trail-word-review.txt) and 2-3 letter words dropped in review (tools/bramble-short-review.txt).
// Rebuild with tools/build-bramble-words.js; check with tools/test-bramble.js.
// Word frequencies: wordfreq by Robyn Speer, CC BY-SA 4.0; word list: SCOWL/ESDB by Kevin Atkinson, MIT-like licence.
`;
  fs.writeFileSync(o.out || path.join(root, 'bramble-words.js'), header + 'window.BRAMBLE_WORDS = "' + enc + '";\n');
  const byLen = {}, rareByLen = {};
  for (const w of r.words) { byLen[w.length] = (byLen[w.length] || 0) + 1; if (r.rare.has(w)) rareByLen[w.length] = (rareByLen[w.length] || 0) + 1; }
  if (o.report) {
    const flip = (a, b) => r.words.filter(w => a.has(w) && !b.has(w)), toOrd = flip(r.oldRare, r.rare), toRare = flip(r.rare, r.oldRare);
    const pick = (list, n) => list.filter((w, i) => i % Math.max(1, Math.floor(list.length / n)) === 0).slice(0, n).join(' ');
    console.log('length  words  rare(old)  rare(new)');
    for (let L = 2; L <= 9; L++) { const ws = r.words.filter(w => w.length === L); console.log(`${L}  ${ws.length}  ${ws.filter(w => r.oldRare.has(w)).length} (${(100 * ws.filter(w => r.oldRare.has(w)).length / ws.length).toFixed(0)}%)  ${ws.filter(w => r.rare.has(w)).length} (${(100 * ws.filter(w => r.rare.has(w)).length / ws.length).toFixed(0)}%)`); }
    console.log(`all  ${r.words.length}  ${r.oldRare.size} (${(100 * r.oldRare.size / r.words.length).toFixed(1)}%)  ${r.rare.size} (${(100 * r.rare.size / r.words.length).toFixed(1)}%)`);
    console.log(`rare -> ordinary: ${toOrd.length}: ${pick(toOrd, 40)}`);
    console.log(`ordinary -> rare: ${toRare.length}: ${pick(toRare, 40)}`);
  }
  console.log(JSON.stringify({ total: r.words.length, rare: r.rare.size, byLength: byLen, rareByLength: rareByLen, shortCandidates: r.shortCandidates.length,
    droppedByReview: r.dropped.length, shortReviewApplied: r.reviewApplied, encodedBytes: enc.length }));
}
if (require.main === module) main();
module.exports = { build, encode };
