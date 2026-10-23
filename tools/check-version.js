// Checks the app version is consistent: version.js's APP.version, its newest changelog entry, and sw.js's CACHE name.
// node tools/check-version.js   (exits 1 on a mismatch)
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const self = {}; new Function('self', fs.readFileSync(path.join(root, 'version.js'), 'utf8'))(self);
const A = self.APP, sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), m = sw.match(/const CACHE = 'paper-games-v([^']+)'/);
const bad = [];
if (!/^\d+\.\d+\.\d+$/.test(A.version)) bad.push(`APP.version "${A.version}" is not x.y.z`);
if (!A.changes.length || A.changes[0].v !== A.version) bad.push(`newest changelog entry is ${A.changes[0] && A.changes[0].v}, not ${A.version}`);
if (A.changes[0] && A.changes[0].date !== A.date) bad.push(`newest changelog date ${A.changes[0].date} differs from APP.date ${A.date}`);
if (!m) bad.push('sw.js has no CACHE = \'paper-games-v…\''); else if (m[1] !== A.version) bad.push(`sw.js CACHE is v${m[1]}, version.js is ${A.version}`);
if (!sw.includes("'version.js'")) bad.push('sw.js does not cache version.js');
if (bad.length){ console.error('Version check failed:\n- ' + bad.join('\n- ')); process.exit(1); }
console.log(`Version ${A.version} (${A.date}) is consistent.`);
