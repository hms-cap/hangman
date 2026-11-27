// Shared SCOWL/ESDB parsing and word-offensiveness lists, used by build-trail-words.js (Tendril) and build-bramble-words.js (Bramble).
// Word list levels: SCOWL/ESDB by Kevin Atkinson, MIT-like licence (https://github.com/en-wl/wordlist).
const fs = require('fs'), vm = require('vm');

// REMOVED from the dictionary: swear words, sexual slang and slurs among 4-8 letter words (a family game does not accept them).
// Ordinary words with another main meaning stay (tart, knob, queer, slag, shag, anus, penis, vagina ...), but see NO_COUNT.
const OFFENSIVE = new Set(`cunt cunts fuck fucks fucked fucker fuckers fucking fuckhead shit shits shitty shite shithead shitload shitted shittier shitting
shitwork bullshit twat twats slut sluts slutty sluttier sluttish whore whores whoring whorish whoredom whoreish whoreson piss pissed pisses pissing pisser
pissers pissoir pissoirs cock cocks dick dicks dickhead tits titty titties wank wanks wanked wanker wankers wanking bitch bitches bitched bitching bitchy
bitchier bitchily bastard bastards bastardy prick pricks pussy pussies cums cumming jizz clit clits blowjob handjob nigger niggers nigga niggas niggaz
negro negroes negros negroid darkie darkies dago dagos dagoes wop wops kraut krauts honky fag fags faggot faggots poof poofs poofter poofters homo homos
hooker hookers bugger buggers buggered buggery bollocks tosser tossers tosspot dildo dildoes dildos fellatio cunnilingus porn porno goddamn
asshole assholes gyps gypped gypper gyppers gypping gypster gypsters
sluttiest bitchiest bastardly dickheads whoresons whoredoms`.split(/\s+/));
// Slurs (ethnic, racial, religious, sexual-orientation, gender, disability) in every form, plus vulgar and explicit sexual words, found by QA
// and a manual scan of both word lists. Words whose main meaning is innocent stay (chinkapin, chinking, gypsum, squawk, jewel, cripple the verb,
// niggle, queer, tit the bird ...).
const SLURS = `chink chinks spic spics spick spicks kike kikes kyke kykes gook gooks wetback wetbacks mick micks coon coons paki pakis jap japs yid yids
wog wogs golliwog golliwogs coolie coolies sambo sambos jigaboo jigaboos boong boongs darky darkey darkeys darkies quadroon quadroons octoroon octoroons
mulatto mulattoes mulattos negress nigra squaw squaws redskin redskins gypsy gypsies gypsyish gipsy gipsies gip gips papist papists papistry popery kafir kafirs
kaffir kaffirs shylock shylocks limey limeys pommy pikey pikeys huns hun jews jewed jewing jewfish jewfishes orientals honkey honkeys ofay ofays cholo cholos dinge
dinges jocko jockos haole haoles chav chavs niggard niggards niggardly
retard retards retarded spaz spazzes spazzy spazzed spastic spastics gimp gimps gimped gimping gimpy mong mongs nong nongs mongoloid mongoloids mongolism
midget midgets cretin cretins cretinous cretinoid schizo schizos tard tards
tranny trannie trannies ladyboy ladyboys shemale shemales lezzie lezzies lezzy lesbo lesbos dyke dykes dyked dyking dykey bulldyke bulldykes fagged fagging
fagot fagots fagoting faggoting faggy sodomite sodomites sodomise sodomised sodomises sodomize sodomized sodomizes sodomy nance nances nancy nelly terf terfs
skank skanks skanky skanked skanking slapper slappers nympho nymphos bint bints hos
arse arses arsed arsey arsehole arseholes gobshite gobshites shithouse shitholes shithole shitless twattle twattled twattles twattling minge minges minger
mingers poon poons jism jisms fanny fannies lardass wiseass badass badasses hooters horny hornier horniest boner boners nookie nooky pisspot pisspots turd turds
frig frigs frigged frigging goddam goddamed goddamned goddammit bollix bollixed bollixes bollixing bollock bollocked bollocking scrote scrotes
orgy orgies orgasm orgasms orgasmic masturbate masturbates ejaculate ejaculates fornicate fornicates copulate copulated copulates
rape raped rapes raper rapers rapist rapists molest molested molester molesters molesting molests pedophile pedophiles`.split(/\s+/);
for (const w of SLURS) OFFENSIVE.add(w);
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


module.exports = { parseScowl, regular, loadWindowFile, OFFENSIVE, NO_COUNT, JUNK, NAMES };
