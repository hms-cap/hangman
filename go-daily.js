// Daily Go problem: the same problem for everyone each day, easiest on Monday and hardest on Sunday.
// No. 1 = 20 Oct 2026 (local time). Loaded after go-problems-data.js by go-problems.html and index.html.
(function (root) {
'use strict';
const EPOCH = [2026, 9, 20];
const BANDS = 7;
let bands = null;
function build() {
  const list = root.GO_PROBLEMS || [];
  const order = list.map((p, i) => i).sort((a, b) => list[a].rating - list[b].rating || a - b);
  bands = [];
  for (let k = 0; k < BANDS; k++) {
    const band = order.slice(Math.floor(k * order.length / BANDS), Math.floor((k + 1) * order.length / BANDS));
    let s = 0x5bd1e995 + k * 7919;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    for (let i = band.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [band[i], band[j]] = [band[j], band[i]]; }
    bands.push(band);
  }
}
function dayIndex(d = new Date()) {
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((mid - new Date(EPOCH[0], EPOCH[1], EPOCH[2])) / 864e5);
}
const dateOf = day => new Date(EPOCH[0], EPOCH[1], EPOCH[2] + day);
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// { index, weekday, band (0 easiest .. 6 hardest) }
function problemFor(day) {
  if (!bands) build();
  const wd = dateOf(day).getDay(), band = (wd + 6) % 7;
  const week = Math.floor((day - (band - ((dateOf(0).getDay() + 6) % 7))) / 7);
  const list = bands[band];
  if (!list || !list.length) return null;
  return { index: list[((week % list.length) + list.length) % list.length], weekday: WEEKDAY[wd], band };
}
const api = { dayIndex, problemFor, dateOf, WEEKDAY };
root.GoDaily = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
