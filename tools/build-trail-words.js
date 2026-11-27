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
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

let B_ZIPF = 2.5, B_SIZE = 60, C_ZIPF = 2.2; // --b-zipf / --b-size / --c-zipf override these (for tuning only)

// REMOVED from the dictionary: swear words, sexual slang and slurs among 4-8 letter words (a family game does not accept them).
// Ordinary words with another main meaning stay (tart, knob, queer, slag, shag, anus, penis, vagina ...), but see NO_COUNT.
const OFFENSIVE = new Set(`cunt cunts fuck fucks fucked fucker fuckers fucking fuckhead shit shits shitty shite shithead shitload shitted shittier shitting
shitwork bullshit twat twats slut sluts slutty sluttier sluttish whore whores whoring whorish whoredom whoreish whoreson piss pissed pisses pissing pisser
pissers pissoir pissoirs cock cocks dick dicks dickhead tits titty titties wank wanks wanked wanker wankers wanking bitch bitches bitched bitching bitchy
bitchier bitchily bastard bastards bastardy prick pricks pussy pussies cums cumming jizz clit clits blowjob handjob nigger niggers nigga niggas niggaz
negro negroes negros negroid darkie darkies dago dagos dagoes wop wops kraut krauts honky fag fags faggot faggots poof poofs poofter poofters homo homos
hooker hookers bugger buggers buggered buggery bollocks tosser tossers tosspot dildo dildoes dildos fellatio cunnilingus porn porno goddamn
asshole assholes gyps gypped gypper gyppers gypping gypster gypsters`.split(/\s+/));
// Also removed by hand: obscure words that read as a name or an abbreviation (ESDB does list them as lowercase words).
const JUNK = new Set('etna etnas lati'.split(' '));
// Accepted as bonus words but never counted by rules (b) and (c): crude, sexual, violent or sensitive words.
const NO_COUNT = new Set(`crap crapped crapper crappers crapping craps crappy crappier fart farted farting farts dickens damn damns damned damning
penis penises vagina vaginas vaginal anus anuses sexy sexual sexes sexed sexing sexist sexists sexism sexier sexiest sexily semen rape raped rapes rapist
rapists raper rapers molest molested molester molests suicide suicides suicidal incest orgy orgies erotic erotica sodomy sodomize sodomite boob boobs
boobies buttock buttocks nipple nipples bimbo bimbos retarded retarder queer queers queerer queerest gypsy gypsies niggard niggards scumbag scumbags
pimp pimps pimped pimping lecher lechers coital coitus clitoris clitoral boner boners sexting erection sexually hooters cuckold genital genitals
brothel brothels kinky fetish fetishes groping spanking spanked turd turds poop pooped pooping poops moron morons moronic dumbo urinate urinated urinal urinals`.split(/\s+/));
// Lowercase ordinary words in ESDB whose frequency is really a name's (John, Mike, Wales, Oxford ...): accepted as bonus, never counted by rules (b), (c).
const NAMES = new Set(`john mike tony jimmy charlie johnny josh maria billy rick graham warren nelson terry bobby wright victor kent brad dale sally troy newton
joey randy jenny glen molly mickey marina timothy hank romeo barney sheila veronica barbie sonny peter harry roger jean martin batman superman khan afghan
wales oxford oxfords basques levy lynch sanders griffin manning bailey brooks rogers hart marquis jasper hector derrick colleen kelvin curt dirk trey fritz
phoebe myrtle rosemary jarred noel earnest beau rowan emery tiff dona`.split(/\s+/));
for (const w of NAMES) NO_COUNT.add(w);

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

function loadWindowFile(file, name) {
  const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(file, 'utf8'), sb); return sb.window[name];
}

// ---------- ESDB parsing ----------
const NOT_WORD_POS = new Set(['abbr', 'x', 'pre', 'suf', 'wp', 'we', 's']);
const NOT_WORD_CLASS = /^(person|surname|place|name|upper|demonym|trademark|abbr)\??$/;
const LEVELS = '.=?v~V@-x';
const ANN = /[*\-@~!†]+$/;

// Returns Map word -> { size, strongSize, ordinary, usage:Set } for every purely lowercase a-z word (any length) listed in ESDB, and
// Map lemma -> { pos:Set, forms:Map(word->{size,weak}) } for ordinary lowercase lemmas.
function parseScowl(file) {
  const words = new Map(), lemmas = new Map(), bad = [];
  const note = (w, size, weak, usage) => {
    let r = words.get(w); if (!r) words.set(w, r = { size: 999, strongSize: 999, usage: new Set() });
    if (size < r.size) r.size = size;
    if (!weak && size < r.strongSize) r.strongSize = size;
    if (usage) r.usage.add(usage);
  };
  // Groups are separated by blank lines. A lemma of "-" means the group's lemma, which may be on a later line of the group.
  const groups = fs.readFileSync(file, 'utf8').split(/\n\n+/);
  const LINE = /^(?:((?:[ABZCD_][.=?v~V@\-x]?(?: [ABZCD_][.=?v~V@\-x]?)*|[.=?v~V@\-x])(?: \{\d+\})?|\+): )?(.+?)(?: <([^>]*)>)?(?: \{[^}]*\})?(?: \(([^)]*)\))?(?:: (.*))?$/;
  let prevLemma = null;
  for (const g of groups) {
    const rows = [];
    for (let line of g.split('\n')) {
      if (!line || line[0] === '#') continue;
      line = line.replace(/\s+#.*$/, ''); // trailing comments
      const i = line.indexOf(': '); if (i < 0) { bad.push(line); continue; }
      const m = line.slice(i + 2).match(LINE); if (!m) { bad.push(line); continue; }
      const [, vinfo, lem0, posFull, usage, entries] = m, [pos, cls = ''] = (posFull || '').split('/');
      rows.push({ size: parseInt(line, 10), vinfo, lem0, pos, cls, usage, entries });
    }
    let main = null;
    for (const r of rows) {
      if (r.lem0 === '-') continue;
      let lem = r.lem0, weak = false;
      if (/^[-@!]./.test(lem)) { lem = lem.slice(1); weak = true; }
      r.lem = lem.replace(ANN, ''); r.lemWeak = weak;
      r.ok = /^[a-z]+$/.test(r.lem) && !NOT_WORD_POS.has(r.pos) && !NOT_WORD_CLASS.test(r.cls);
      if (!main) main = r;
    }
    const gl = main ? main.lem : prevLemma, gok = main ? main.ok : prevLemma !== null && lemmas.has(prevLemma);
    if (!main && rows.length) bad.push('group without lemma: ' + g.split('\n')[0]);
    if (main) prevLemma = main.lem;
    for (const r of rows) {
      const lemma = r.lem0 === '-' ? gl : r.lem, ok = r.lem0 === '-' ? gok : r.ok;
      if (!lemma || !ok) continue; // names, abbreviations, prefixes: nothing they list counts as an ordinary word
      let weak = !!r.lemWeak;
      if (r.vinfo && r.vinfo.split(' ').every(t => '-@x'.includes(t[t.length - 1]))) weak = true;
      let L = lemmas.get(lemma); if (!L) lemmas.set(lemma, L = { pos: new Set(), forms: new Map(), size: 999 });
      L.pos.add(r.pos);
      if (r.lem0 !== '-') { note(lemma, r.size, weak, r.usage); if (r.size < L.size && !weak) L.size = r.size; }
      if (r.entries) {
        let depth = 0, cur = '', parts = [];   // split on ', ' outside parentheses
        for (const ch of r.entries) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur.trim()); cur = ''; } else cur += ch; }
        parts.push(cur.trim());
        for (const p of parts) {
          if (!p || p === '-') continue;
          const alts = p[0] === '(' ? p.slice(1, p.lastIndexOf(')')).split(' | ') : [p];
          for (const alt of alts) {
            let w = alt, aw = weak;
            const j = alt.indexOf(': ');
            if (j >= 0) { const toks = alt.slice(0, j).split(' '); w = alt.slice(j + 2); if (toks.every(t => '-@x'.includes(t[t.length - 1]))) aw = true; }
            if (ANN.test(w)) { aw = true; w = w.replace(ANN, ''); }
            if (!/^[a-z]+$/.test(w)) continue;
            note(w, r.size, aw, r.usage);
            const f = L.forms.get(w); if (!f || r.size < f.size || (f.weak && !aw)) L.forms.set(w, { size: r.size, weak: aw });
          }
        }
      }
    }
  }
  return { words, lemmas, bad };
}

// Regular inflected spellings (liberal: both doubled and undoubled consonants) of a base word, by part of speech.
function regular(base, pos) {
  const out = new Set(), last = base[base.length - 1], pre = base[base.length - 2] || '';
  const V = 'aeiou', cons = c => c && !V.includes(c);
  const dbl = cons(last) && !'wxy'.includes(last) && V.includes(pre) ? base + last : null;
  const s = () => {
    if (/(s|x|z|ch|sh)$/.test(base)) out.add(base + 'es');
    else if (cons(pre) && last === 'y') out.add(base.slice(0, -1) + 'ies');
    else { out.add(base + 's'); if (last === 'o') out.add(base + 'es'); }
  };
  const suffix = (e, ie) => {
    if (cons(pre) && last === 'y') out.add(base.slice(0, -1) + 'i' + e);
    else if (last === 'e') out.add(base + e.slice(1));
    else out.add(base + e);
    if (dbl) out.add(dbl + e);
  };
  if (pos === 'n' || pos === 'v' || pos === 'm' || pos === 'n_v') s();
  if (pos === 'v' || pos === 'm' || pos === 'n_v') {
    suffix('ed');
    if (last === 'e' && !/(ee|ye|oe)$/.test(base)) out.add(base.slice(0, -1) + 'ing'); else if (/ie$/.test(base)) out.add(base.slice(0, -2) + 'ying'); else out.add(base + 'ing');
    if (dbl) out.add(dbl + 'ing');
  }
  if (['aj', 'av', 'a', 'aj_av'].includes(pos)) { suffix('er'); suffix('est'); }
  return out;
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
  for (const w of cur.words) {
    if (isOffensive(w)) removedOffensive.push(w);
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
