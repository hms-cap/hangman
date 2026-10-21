// Emblems for the three daily word games: Tendril (a curling vine), Starfish (five arms) and Clover (four leaves).
// Every drawing is a 100×100 SVG string. icon(name) is a two-tone mark in currentColor; starfish(fills) and
// clover(fills) take one fill per arm or leaf (a CSS colour or class name, or null for an empty outline) so a page
// can show progress with them; tendril(frac) draws the vine grown to frac (0..1) with leaves appearing as it goes.
(function(){
'use strict';
const f = n => +n.toFixed(2);
const pol = (a, r) => [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
const rad = d => d * Math.PI / 180;

// one arm of the starfish: from the centre out to a rounded tip and back
function armPath(k){
  const a = rad(-90 + 72 * k), R = 47, r = 17;
  const [lx, ly] = pol(a - rad(36), r), [rx, ry] = pol(a + rad(36), r);
  const [tlx, tly] = pol(a - rad(5.5), R - 3.5), [trx, try_] = pol(a + rad(5.5), R - 3.5);
  const [c1x, c1y] = pol(a - rad(11), r + (R - r) * .42), [c2x, c2y] = pol(a + rad(11), r + (R - r) * .42);
  return `M50 50L${f(lx)} ${f(ly)}Q${f(c1x)} ${f(c1y)} ${f(tlx)} ${f(tly)}A4.6 4.6 0 0 1 ${f(trx)} ${f(try_)}Q${f(c2x)} ${f(c2y)} ${f(rx)} ${f(ry)}Z`;
}
const ARMS = [0, 1, 2, 3, 4].map(armPath);
// little bumps down each arm, like the real thing
const BUMPS = [0, 1, 2, 3, 4].map(k => [15, 24, 33].map(d => pol(rad(-90 + 72 * k), d)));
const STAR_OUTLINE = (() => {
  const pts = [];
  for (let k = 0; k < 5; k++){
    const a = rad(-90 + 72 * k), R = 47, r = 17;
    const [lx, ly] = pol(a - rad(36), r), [rx, ry] = pol(a + rad(36), r);
    const [tlx, tly] = pol(a - rad(5.5), R - 3.5), [trx, try_] = pol(a + rad(5.5), R - 3.5);
    const [c1x, c1y] = pol(a - rad(11), r + (R - r) * .42), [c2x, c2y] = pol(a + rad(11), r + (R - r) * .42);
    pts.push(`${k ? 'L' : 'M'}${f(lx)} ${f(ly)}Q${f(c1x)} ${f(c1y)} ${f(tlx)} ${f(tly)}A4.6 4.6 0 0 1 ${f(trx)} ${f(try_)}Q${f(c2x)} ${f(c2y)} ${f(rx)} ${f(ry)}`);
  }
  return pts.join('') + 'Z';
})();

// one clover leaf: a heart with its point at the centre, turned to `deg`
const LEAF = 'M50 49C46 44 33.5 38 33.5 26.5C33.5 18.5 42 15 50 23C58 15 66.5 18.5 66.5 26.5C66.5 38 54 44 50 49Z';
const LEAF_DEG = [-45, 45, 135, 225];
const STEM = 'M50 50C53 62 58 72 68 84';

// the vine: rises from the bottom left, sweeps right and ends in a curl
const VINE = 'M14 94C17 76 24 64 40 57C58 49 74 41 74 26C74 13 59 9 53 18C48 26 55 34 62 30C66 27 65 22 61 22';
const VLEAVES = [ // [at fraction of the vine, path]
  [.22, 'M23 72C12 72 7 64 8 55C19 55 25 62 23 72Z'],
  [.42, 'M44 55C45 44 52 38 61 38C61 48 54 55 44 55Z'],
  [.6, 'M71 37C80 38 86 45 86 53C77 53 71 46 71 37Z'],
];

const paint = v => !v ? 'fill="none"' : /^[a-z][\w-]*$/i.test(v) && !/^(red|white|black|none)$/.test(v) ? `class="${v}"` : `style="fill:${v}"`;

const Emblems = {
  // two-tone mark in currentColor
  icon(name, cls = ''){
    const open = `<svg class="em em-${name} ${cls}" viewBox="0 0 100 100" aria-hidden="true" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">`;
    if (name === 'starfish') return open + `<path d="${STAR_OUTLINE}" fill="currentColor" fill-opacity=".22"/>` +
      BUMPS.flat().filter((_, i) => i % 3 !== 0).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="2.6" fill="currentColor" stroke="none"/>`).join('') + '</svg>';
    if (name === 'clover') return open + `<path d="${STEM}" fill="none"/>` +
      LEAF_DEG.map(d => `<path d="${LEAF}" transform="rotate(${d} 50 50)" fill="currentColor" fill-opacity=".22"/>`).join('') + '</svg>';
    return open + `<path d="${VINE}" fill="none"/>` + VLEAVES.map(([, d]) => `<path d="${d}" fill="currentColor" fill-opacity=".22"/>`).join('') + '</svg>';
  },
  // fills: five colours or class names (null = not yet known); line: outline colour
  starfish(fills, { line = 'currentColor', cls = '', dots = 'rgba(255,255,255,.55)' } = {}){
    let s = `<svg class="em-star ${cls}" viewBox="0 0 100 100" aria-hidden="true">`;
    ARMS.forEach((d, k) => { s += `<path d="${d}" ${fills[k] ? paint(fills[k]) : `fill="none" style="stroke:${line}" stroke-width="2.4" stroke-linejoin="round" stroke-dasharray="3.5 3.5"`}/>`; });
    BUMPS.forEach((b, k) => { if (fills[k]) b.forEach(([x, y], i) => { s += `<circle cx="${f(x)}" cy="${f(y)}" r="${2.6 - i * .5}" style="fill:${dots}"/>`; }); });
    return s + `<circle cx="50" cy="50" r="5" style="fill:${dots}"/></svg>`;
  },
  // fills: four colours or class names in leaf order (top-left, top-right, bottom-right, bottom-left)
  clover(fills, { line = 'currentColor', cls = '', stem = line, vein = 'rgba(255,255,255,.5)' } = {}){
    let s = `<svg class="em-clover ${cls}" viewBox="0 0 100 100" aria-hidden="true"><path d="${STEM}" fill="none" style="stroke:${stem}" stroke-width="4" stroke-linecap="round"/>`;
    LEAF_DEG.forEach((deg, k) => {
      const v = fills[k];
      s += `<g transform="rotate(${deg} 50 50)"><path d="${LEAF}" ${v ? paint(v) : `fill="none" style="stroke:${line}" stroke-width="2.4" stroke-dasharray="3.5 3.5"`}/>` +
        (v ? `<path d="M50 47V27" style="stroke:${vein}" stroke-width="2" stroke-linecap="round"/>` : '') + '</g>';
    });
    return s + '</svg>';
  },
  // the vine grown to frac; leaves unfold once the vine passes them
  tendril(frac, { line = 'currentColor', leaf = line, cls = '', ghost = 'rgba(255,255,255,.22)' } = {}){
    const p = Math.max(0, Math.min(1, frac));
    let s = `<svg class="em-vine ${cls}" viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="${VINE}" style="stroke:${ghost}" stroke-width="3" stroke-dasharray="2 5"/>`;
    if (p > 0) s += `<path d="${VINE}" pathLength="1" style="stroke:${line}" stroke-width="5" stroke-dasharray="${f(p)} 2"/>`;
    VLEAVES.forEach(([at, d]) => { if (p >= at) s += `<path d="${d}" style="fill:${leaf}"/>`; });
    return s + '</svg>';
  },
};
if (typeof module !== 'undefined') module.exports = Emblems;
if (typeof window !== 'undefined') window.Emblems = Emblems;
})();
