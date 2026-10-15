// Fits one Elo rating per level from tools/elo-match.js results (maximum likelihood, Bradley-Terry
// on the Elo scale), with 95% intervals from bootstrap resampling of games.
// Usage: node tools/elo-fit.js results.json [anchorLevel] [anchorElo]
'use strict';
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2] || 'elo-results.json', 'utf8'));
const anchorLevel = +(process.argv[3] || 1), anchorElo = +(process.argv[4] || 0);

const games = [];
for (const r of Object.values(data)) for (const g of r.games) games.push(g);
const levels = [...new Set(games.flatMap(g => [g.a, g.b]))].sort((x, y) => x - y);

function fit(gs) {
  const R = Object.fromEntries(levels.map(l => [l, 0]));
  const E = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
  for (let it = 0; it < 4000; it++) {
    const grad = Object.fromEntries(levels.map(l => [l, 0]));
    for (const g of gs) { const e = E(R[g.a], R[g.b]); grad[g.a] += g.score - e; grad[g.b] -= g.score - e; }
    // weak prior toward 0 keeps perfect scores finite (equivalent to a couple of virtual draws)
    for (const l of levels) R[l] += 8 * grad[l] - 0.002 * R[l];
  }
  const shift = anchorElo - R[anchorLevel];
  for (const l of levels) R[l] += shift;
  return R;
}

const best = fit(games);
const boots = Object.fromEntries(levels.map(l => [l, []]));
for (let b = 0; b < 200; b++) {
  const sample = games.map(() => games[(Math.random() * games.length) | 0]);
  const r = fit(sample); for (const l of levels) boots[l].push(r[l]);
}
const names = { 1: 'Beginner', 2: 'Casual', 3: 'Intermediate', 4: 'Advanced', 5: 'Expert' };
console.log('Pairing results:');
for (const [k, r] of Object.entries(data)) {
  const n = r.w + r.d + r.l, s = (r.w + r.d / 2) / n, plies = r.games.reduce((t, g) => t + g.plies, 0) / n;
  const adj = r.games.filter(g => g.reason.startsWith('adjudicated')).length;
  console.log(`  ${k.padEnd(10)} +${r.w} =${r.d} -${r.l}  score ${(100 * s).toFixed(0)}%  avg ${Math.round(plies)} plies${adj ? `, ${adj} adjudicated` : ''}`);
}
console.log(`\nRatings (anchored: ${names[anchorLevel]} = ${anchorElo}):`);
for (const l of levels) {
  const v = boots[l].slice().sort((x, y) => x - y), lo = v[Math.floor(v.length * 0.025)], hi = v[Math.floor(v.length * 0.975)];
  console.log(`  ${names[l].padEnd(13)} ${String(Math.round(best[l])).padStart(5)}   (95%: ${Math.round(lo)} to ${Math.round(hi)})`);
}
