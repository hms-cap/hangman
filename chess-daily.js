// Daily chess puzzle: the same puzzle for everyone each day, easiest on Monday and hardest on Sunday.
// No. 1 = 17 Oct 2026 (local time). Loaded after chess-puzzles.js by chess-puzzles.html and index.html.
(function (root) {
'use strict';
const EPOCH = [2026, 9, 17];
const BANDS = 7; // Monday .. Sunday, by puzzle rating

// Puzzle indexes sorted by rating and cut into seven equal bands; each band is shuffled with a fixed seed.
let bands = null;
function build() {
  const list = root.CHESS_PUZZLES || [];
  const order = list.map((p, i) => i).sort((a, b) => list[a][2] - list[b][2] || a - b);
  bands = [];
  for (let k = 0; k < BANDS; k++) {
    const band = order.slice(Math.floor(k * order.length / BANDS), Math.floor((k + 1) * order.length / BANDS));
    let s = 0x2545f491 + k * 7919;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    for (let i = band.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [band[i], band[j]] = [band[j], band[i]]; }
    bands.push(band);
  }
}

// Day number for a date (0 = No. 1), counted in local days.
function dayIndex(d = new Date()) {
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((mid - new Date(EPOCH[0], EPOCH[1], EPOCH[2])) / 864e5);
}
const dateOf = day => new Date(EPOCH[0], EPOCH[1], EPOCH[2] + day);
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The puzzle for a day: { index, weekday, band (0 easiest .. 6 hardest) }.
function puzzleFor(day) {
  if (!bands) build();
  const wd = dateOf(day).getDay(), band = (wd + 6) % 7; // Monday = 0
  const week = Math.floor((day - (band - ((dateOf(0).getDay() + 6) % 7))) / 7); // how many times this weekday has come round
  const list = bands[band];
  if (!list || !list.length) return null;
  return { index: list[((week % list.length) + list.length) % list.length], weekday: WEEKDAY[wd], band };
}

const api = { dayIndex, puzzleFor, dateOf, WEEKDAY };
root.ChessDaily = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
