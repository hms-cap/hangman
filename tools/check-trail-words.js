// Checks trailwords.js (the Tendril dictionary): format, sort order, no offensive words, sample classifications, counts.
//   node tools/check-trail-words.js   (exits 1 on a problem)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const Trail = require('../trail-core.js');
const { OFFENSIVE } = require('./build-trail-words.js');

const src = fs.readFileSync(path.join(root, 'trailwords.js'), 'utf8');
const sb = { window: {} }; vm.runInNewContext(src, sb);
const enc = sb.window.TRAIL_WORDS, bad = [];
if (typeof enc !== 'string') { console.error('window.TRAIL_WORDS is not a string'); process.exit(1); }
if (!/^(\d[a-zA-Z]+)+$/.test(enc)) bad.push('encoded string is not (digit + letters) repeated');
const d = Trail.decode(enc), words = d.words;

// order, length, duplicates, front-coding is canonical (digit = the full shared prefix)
for (let i = 0; i < words.length; i++) {
  const w = words[i], p = words[i - 1];
  if (!/^[a-z]{4,8}$/.test(w)) bad.push(`${w}: not 4-8 lowercase letters`);
  if (p !== undefined && !(p < w)) bad.push(`${p} then ${w}: not strictly sorted`);
}
if (new Set(words).size !== words.length) bad.push('duplicate words');
let prev = '';
for (const m of enc.matchAll(/(\d)([a-zA-Z]+)/g)) {
  const w = prev.slice(0, +m[1]) + m[2].toLowerCase(); let k = 0; while (k < prev.length && prev[k] === w[k]) k++;
  if (+m[1] !== Math.min(k, 9)) bad.push(`${w}: shared-letter digit is ${m[1]}, expected ${Math.min(k, 9)}`);
  prev = w;
}

// offensive words
const SWEARS = 'cunt fuck shit twat slut whore piss cock dick tits wank'.split(' ');
for (const w of [...SWEARS, ...OFFENSIVE]) if (d.set.has(w)) bad.push(`offensive word accepted: ${w}`);

// every target is accepted (and every counted word is a word)
for (const t of d.targets) if (!d.set.has(t)) bad.push(`target not accepted: ${t}`);

// sample classifications
const counted = 'tall gentle teams rating outing lined tallest till gull auto dental study studies studied studying'.split(' ');
const bonus = 'ratel atlatl ecotone'.split(' ');
const absent = 'ital etna cunt ordn econ ecol inst auth lati fuck shit cock dick tits'.split(' ');
for (const w of counted) if (!d.targets.has(w)) bad.push(`${w}: expected counted`);
for (const w of bonus) if (!d.set.has(w) || d.targets.has(w)) bad.push(`${w}: expected bonus`);
for (const w of absent) if (d.set.has(w)) bad.push(`${w}: expected not accepted`);

if (bad.length) { console.error('Trail words check failed:\n- ' + bad.slice(0, 40).join('\n- ') + (bad.length > 40 ? `\n... and ${bad.length - 40} more` : '')); process.exit(1); }

const n = words.length, t = d.targets.size;
const byLen = {}; for (const w of words) { const o = byLen[w.length] || (byLen[w.length] = [0, 0]); o[0]++; if (d.targets.has(w)) o[1]++; }
console.log(`Accepted ${n}, counted ${t}, bonus ${n - t}.`);
console.log('By length (counted/accepted): ' + Object.keys(byLen).map(k => `${k}: ${byLen[k][1]}/${byLen[k][0]}`).join(', '));
try {
  const dsb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'trail-daily.js'), 'utf8'), dsb);
  const daily = dsb.window.TRAIL_DAILY, g = daily.length >> 4, c = [];
  for (let i = 0; i < g; i++) c.push(Trail.analyze(daily.slice(i * 16, i * 16 + 16), d).targets.length);
  c.sort((a, b) => a - b);
  console.log(`Daily 4x4 grids: ${g}; counted per grid avg ${(c.reduce((s, x) => s + x, 0) / g).toFixed(1)}, min ${c[0]}, median ${c[g >> 1]}, max ${c[g - 1]}.`);
} catch (e) { console.log('(daily grid stats skipped: ' + e.message + ')'); }
console.log('Trail words check passed.');
