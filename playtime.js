// Play time: how long each player spends in the app, per day and per game, for the "today" timer and the
// Time played sheet. Loaded on every page right after profiles.js, so the record is per player like every other save.
//
// What counts: time while the page is on screen and someone has touched or typed in the last 5 minutes.
// Hidden, backgrounded or left idle, the clock stops.
// Stored under "playtime": { v:1, days: { "2026-10-21": { t: secs, g: { hangman: secs, … }, h: { "17": secs }, s: sessions } }, last: ms }
// Days older than 400 are dropped.
//
// UI: PlayTime.pill() for the home screen (time in all games today), a small "12m today" caption under each game's
// title (time in that game today), and PlayTime.open() for the stats sheet. Both open the sheet when tapped.
(function(){
'use strict';
const KEY = 'playtime', IDLE = 5 * 60e3, SESSION_GAP = 30 * 60e3, KEEP_DAYS = 400;
// [id, name, page, color] — same colors as the game menu
const GAMES = [
  ['home', 'Home screen', 'index.html', '#8d989f'],
  ['hangman', 'Hangman', 'hangman.html', '#c0393f'],
  ['sudoku', 'Sudoku', 'sudoku.html', '#1f7a63'],
  ['five', 'Stelium', 'fiveletters.html', '#d38c1f'],
  ['trail', 'Tendril', 'trail.html', '#2e5ea6'],
  ['groups', 'Clover', 'groups.html', '#7457a6'],
  ['chess', 'Chess', 'chess.html', '#33424f'],
  ['cpz', 'Chess Puzzles', 'chess-puzzles.html', '#2b6c84'],
  ['trainer', 'Chess Trainer', 'chess-trainer.html', '#8a4f7d'],
  ['go', 'Go', 'go.html', '#5a6b3a'],
  ['gpz', 'Go Problems', 'go-problems.html', '#7a6a2e'],
  ['gtrainer', 'Go Trainer', 'go-trainer.html', '#3f6f5a'],
  ['snake', 'Snake', 'snake.html', '#4f7f2a'],
  ['chowka', 'Chowka Bara', 'chowka.html', '#a8592c'],
];
const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const HERE = (GAMES.find(g => g[2] === file) || GAMES[0])[0];
const gameOf = id => GAMES.find(g => g[0] === id) || [id, id, '', '#8d989f'];

// ---- dates ----
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };

// ---- storage ----
let cache = null; // this page is the only writer while it's open; re-read when it comes back to the front
function load(){ if (cache) return cache; try{ const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.days) return (cache = v); }catch(e){} return (cache = { v: 1, days: {}, last: 0 }); }
let pendingMs = 0, pendingDay = null, pendingHour = null, stopped = false;
const live = () => pendingMs >= 1000 ? Math.floor(pendingMs / 1000) : 0;
function flush(){
  if (stopped) return;
  cache = null;
  const secs = Math.floor(pendingMs / 1000);
  if (!secs || !pendingDay) return;
  const D = load(), d = D.days[pendingDay] || (D.days[pendingDay] = { t: 0, g: {}, h: {}, s: 0 });
  d.t += secs; d.g[HERE] = (d.g[HERE] || 0) + secs; d.h[pendingHour] = (d.h[pendingHour] || 0) + secs;
  const now = Date.now();
  if (!d.s) d.s = 1; else if (D.last && now - D.last > SESSION_GAP) d.s++; // back after a break: another visit
  D.last = now;
  const keys = Object.keys(D.days).sort(); while (keys.length > KEEP_DAYS) delete D.days[keys.shift()];
  try{ localStorage.setItem(KEY, JSON.stringify(D)); }catch(e){}
  pendingMs -= secs * 1000;
}

// ---- the clock ----
let lastInput = Date.now(), lastTick = Date.now(), wasActive = false;
const active = () => document.visibilityState === 'visible' && Date.now() - lastInput < IDLE;
['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(t => addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
function tick(){
  const now = Date.now(), dt = Math.min(now - lastTick, 2000); lastTick = now;
  const on = active();
  if (on && wasActive){
    const d = new Date(), k = dayKey(d);
    if (pendingDay && k !== pendingDay) flush(); // midnight: close off yesterday
    if (k !== pendingDay){ pendingDay = k; }
    if (String(d.getHours()) !== pendingHour){ flush(); pendingHour = String(d.getHours()); }
    pendingMs += dt;
  }
  wasActive = on;
  if (now % 10000 < 1000) flush();
  paint();
}
pendingDay = dayKey(new Date()); pendingHour = String(new Date().getHours());
setInterval(tick, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') flush(); else { cache = null; lastInput = Date.now(); lastTick = Date.now(); shown = ''; paint(); } });
addEventListener('pagehide', flush);
// switching player reloads the page under the new player's saves: put this player's time away first
addEventListener('players:switching', () => { flush(); stopped = true; });

// ---- reading ----
function day(k){ const D = load().days[k] || { t: 0, g: {}, h: {}, s: 0 }; if (k === pendingDay && live()){ const x = JSON.parse(JSON.stringify(D)); x.t += live(); x.g[HERE] = (x.g[HERE] || 0) + live(); return x; } return D; }
const today = () => day(dayKey(new Date())).t;
const todayIn = id => day(dayKey(new Date())).g[id] || 0;

// ---- formatting ----
function fmt(s, long){
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (s < 60) return s ? (long ? 'under a minute' : '<1m') : (long ? 'no time yet' : '0m');
  if (!h) return long ? `${m} min` : `${m}m`;
  return long ? `${h} h ${pad(m % 60)} min` : `${h}h ${pad(m % 60)}m`;
}

// ---- the little displays ----
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const css = `
.pt-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 11px 5px 8px;border-radius:999px;background:var(--key);border:1px solid var(--key-edge);color:var(--ink);font-family:var(--mono);font-weight:600;font-size:.92rem;font-variant-numeric:tabular-nums;cursor:pointer;flex:none;white-space:nowrap}
.pt-pill svg{width:17px;height:17px;fill:none;stroke:var(--hit);stroke-width:2.2;stroke-linecap:round}
.pt-pill:active{background:var(--peer)}
.bar h1{position:relative}
.pt-cap{position:absolute;left:50%;top:calc(100% - 1px);transform:translateX(-50%);display:inline-flex;align-items:center;gap:3px;border:0;background:none;padding:1px 6px;margin:0;font-family:var(--mono);font-size:.66rem;font-weight:600;letter-spacing:.02em;color:var(--muted);white-space:nowrap;cursor:pointer;line-height:1.2;border-radius:6px}
.pt-cap svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
.pt-cap:active{background:var(--peer)}
.sheet.pt{z-index:55}
.pt .panel{gap:16px}
.pt-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.pt-big{font-family:var(--mono);font-weight:700;font-size:2.3rem;line-height:1;font-variant-numeric:tabular-nums;color:var(--hit)}
.pt-sub{font-size:.85rem;color:var(--muted);margin-top:4px}
.pt-chart svg{display:block;width:100%;height:auto;overflow:visible}
.pt-chart .bar0{fill:var(--line)} .pt-chart .barT{fill:var(--hit)} .pt-chart .barP{fill:color-mix(in srgb,var(--hit) 55%,var(--line))}
.pt-chart text{fill:var(--muted);font:600 10px var(--ui)} .pt-chart text.v{fill:var(--ink);font:600 10px var(--mono)}
.pt-chart .avg{stroke:var(--muted);stroke-dasharray:3 3;stroke-width:1}
.pt-games{display:flex;flex-direction:column;gap:9px}
.pt-g{display:grid;grid-template-columns:7.5em 1fr auto;align-items:center;gap:10px;font-size:.9rem}
.pt-g span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pt-g i{display:block;height:10px;border-radius:5px;background:var(--gc);min-width:3px}
.pt-g b{font-family:var(--mono);font-weight:600;font-size:.85rem;font-variant-numeric:tabular-nums;min-width:4.2em;text-align:right}
.pt-g.here span{font-weight:700}
.pt-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pt-facts div{border:1px solid var(--line);border-radius:12px;background:var(--key);padding:9px 11px;display:flex;flex-direction:column;gap:2px}
.pt-facts small{color:var(--muted);font-size:.74rem}
.pt-facts b{font-weight:600;font-size:1rem}
.pt-empty{color:var(--muted);font-size:.9rem;margin:0}
.pt .seg{grid-template-columns:repeat(4,1fr)}
`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

const mounts = new Set(); // [el, kind]
let shown = '';
function paint(){
  const t = today(), here = todayIn(HERE), key = `${Math.floor(t / 60)}|${Math.floor(here / 60)}|${t < 60}|${here < 60}`;
  if (key === shown) return; shown = key;
  mounts.forEach(([el, kind]) => {
    if (kind === 'pill'){ el.innerHTML = `${CLOCK}<span>${fmt(t)}</span>`; el.setAttribute('aria-label', `Played ${fmt(t, true)} today. Time played`); }
    else { el.innerHTML = `${CLOCK}${fmt(here)} today`; el.setAttribute('aria-label', `${fmt(here, true)} in ${gameOf(HERE)[1]} today. Time played`); }
  });
}
function pill(){ const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-pill'; b.title = 'Time played today';
  b.addEventListener('click', () => open()); mounts.add([b, 'pill']); shown = ''; paint(); return b; }
// game pages: the caption under the title (the title itself is the game menu button, set up by game-nav.js)
document.addEventListener('DOMContentLoaded', () => {
  const h1 = HERE !== 'home' && document.querySelector('.bar h1');
  if (!h1) return;
  const c = document.createElement('button'); c.type = 'button'; c.className = 'pt-cap';
  c.addEventListener('click', e => { e.stopPropagation(); open(); });
  h1.appendChild(c); mounts.add([c, 'cap']); shown = ''; paint();
});

// ---- the stats sheet ----
let sheet = null, range = 'week';
function open(r){
  flush();
  if (r) range = r;
  if (window.GameNav && GameNav.isOpen) GameNav.close();
  if (!sheet){
    sheet = document.createElement('div'); sheet.className = 'sheet pt'; sheet.hidden = true;
    sheet.innerHTML = '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="ptTitle"></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    addEventListener('keydown', e => { if (sheet.hidden) return; if (e.key === 'Escape'){ e.preventDefault(); close(); } if (e.key !== 'Tab') e.stopImmediatePropagation(); }, true);
  }
  draw(); sheet.hidden = false;
  const f = sheet.querySelector('#ptClose'); f && f.focus({ preventScroll: true });
}
function close(){ if (sheet) sheet.hidden = true; }

const RANGES = [['today', 'Today', 1], ['week', '7 days', 7], ['month', '30 days', 30], ['all', 'All time', 0]];
function draw(){
  const D = load(), keys = Object.keys(D.days).sort();
  const span = (RANGES.find(r => r[0] === range) || RANGES[1])[2];
  const n = span || Math.max(1, keys.length ? Math.round((daysAgo(0) - new Date(keys[0] + 'T12:00')) / 864e5) + 1 : 1);
  const list = Array.from({ length: n }, (_, i) => { const k = dayKey(daysAgo(n - 1 - i)); return [k, day(k)]; });
  const total = list.reduce((a, [, d]) => a + d.t, 0), played = list.filter(([, d]) => d.t >= 60);
  const t = today(), y = day(dayKey(daysAgo(1))).t;
  const last7 = Array.from({ length: 7 }, (_, i) => day(dayKey(daysAgo(i + 1))).t), avg7 = last7.reduce((a, b) => a + b, 0) / 7;
  const vs = avg7 >= 60 ? (t >= avg7 ? `${fmt(Math.round(t - avg7), true)} more than` : `${fmt(Math.round(avg7 - t), true)} less than`) + ' your daily average for the last week' : y >= 60 ? `Yesterday: ${fmt(y, true)}` : '';

  // per game for the range
  const per = {}; list.forEach(([, d]) => Object.entries(d.g || {}).forEach(([g, s]) => { per[g] = (per[g] || 0) + s; }));
  const games = Object.entries(per).filter(([, s]) => s >= 1).sort((a, b) => b[1] - a[1]), top = games.length ? games[0][1] : 1;

  // chart: one bar per day (7 for today/week, otherwise the range, max 30 shown)
  const bars = span === 1 ? Array.from({ length: 7 }, (_, i) => { const k = dayKey(daysAgo(6 - i)); return [k, day(k)]; }) : list.slice(-30);
  const W = 320, H = 120, gap = bars.length > 10 ? 2 : 8, bw = (W - gap * (bars.length - 1)) / bars.length, mx = Math.max(60, ...bars.map(([, d]) => d.t));
  const bavg = bars.reduce((a, [, d]) => a + d.t, 0) / bars.length, todayK = dayKey(new Date());
  const svg = `<svg viewBox="0 -14 ${W} ${H + 30}" role="img" aria-label="Minutes played per day">
    ${bars.map(([k, d], i) => { const h = d.t ? Math.max(3, d.t / mx * H) : 2, x = i * (bw + gap), dt = new Date(k + 'T12:00');
      const lab = bars.length <= 7 ? 'SMTWTFS'[dt.getDay()] : (i % 7 === (bars.length - 1) % 7 ? `${dt.getDate()}` : '');
      return `<rect class="${!d.t ? 'bar0' : k === todayK ? 'barT' : 'barP'}" x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw / 2).toFixed(1)}"><title>${dt.toDateString()}: ${fmt(d.t, true)}</title></rect>
        ${lab ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H + 14}" text-anchor="middle">${lab}</text>` : ''}
        ${bars.length <= 7 && d.t >= 60 ? `<text class="v" x="${(x + bw / 2).toFixed(1)}" y="${(H - h - 4).toFixed(1)}" text-anchor="middle">${Math.round(d.t / 60)}</text>` : ''}`; }).join('')}
    ${bavg >= 60 ? `<line class="avg" x1="0" x2="${W}" y1="${(H - bavg / mx * H).toFixed(1)}" y2="${(H - bavg / mx * H).toFixed(1)}"/>` : ''}
  </svg>`;

  // facts (over the range, except "today" which uses the last 7 days so they mean something)
  const fl = span === 1 ? Array.from({ length: 7 }, (_, i) => [0, day(dayKey(daysAgo(i)))]) : list;
  const fPlayed = fl.filter(([, d]) => d.t >= 60), fTotal = fl.reduce((a, [, d]) => a + d.t, 0);
  const hours = {}; fl.forEach(([, d]) => Object.entries(d.h || {}).forEach(([h, s]) => { hours[h] = (hours[h] || 0) + s; }));
  const parts = [['Mornings', 5, 12], ['Afternoons', 12, 17], ['Evenings', 17, 21], ['Late nights', 21, 29]].map(([name, a, b]) => [name, Object.entries(hours).reduce((s, [h, v]) => { const x = +h < 5 ? +h + 24 : +h; return x >= a && x < b ? s + v : s; }, 0)]).sort((p, q) => q[1] - p[1]);
  const longest = fl.reduce((m, [, d]) => Math.max(m, d.t), 0), sessions = fl.reduce((a, [, d]) => a + (d.s || 0), 0);
  const facts = [
    [span === 1 ? 'Last 7 days' : 'Total', fmt(fTotal, true)],
    ['Days played', `${fPlayed.length} of ${fl.length}`],
    ['Average on days played', fPlayed.length ? fmt(Math.round(fTotal / fPlayed.length), true) : '—'],
    ['Longest day', longest >= 60 ? fmt(longest, true) : '—'],
    ['Usually plays', parts[0][1] >= 60 ? parts[0][0] : '—'],
    ['Visits', sessions ? `${sessions}, about ${fmt(Math.round(fTotal / sessions), true)} each` : '—'],
  ];

  const me = window.Players && Players.current;
  sheet.firstChild.innerHTML = `<div class="pt-head"><div><h2 id="ptTitle">Time played${me ? ` · ${esc(me.name)}` : ''}</h2>
      <div class="pt-sub">Today</div><div class="pt-big">${fmt(t)}</div>${vs ? `<div class="pt-sub">${vs}</div>` : ''}</div></div>
    <div class="seg" role="group" aria-label="Period">${RANGES.map(([k, l]) => `<button type="button" data-r="${k}" aria-pressed="${k === range}">${l}</button>`).join('')}</div>
    <div class="pt-chart">${svg}</div>
    <span class="label">${range === 'today' ? 'Today' : range === 'all' ? 'All time' : `Last ${span} days`} by game · ${fmt(total, true)}</span>
    ${games.length ? `<div class="pt-games">${games.map(([g, s]) => { const G = gameOf(g); return `<div class="pt-g${g === HERE ? ' here' : ''}" style="--gc:${G[3]}"><span>${G[1]}</span><i style="width:${Math.max(2, s / top * 100).toFixed(1)}%"></i><b>${fmt(s)}</b></div>`; }).join('')}</div>`
      : '<p class="pt-empty">Nothing played in this period yet.</p>'}
    <div class="pt-facts">${facts.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <p class="pt-empty">Counts while the app is open and in use. The clock stops when you leave or after 5 minutes without a tap.</p>
    <button class="btn" type="button" id="ptClose">Done</button>`;
  sheet.querySelector('.seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b){ range = b.dataset.r; draw(); } });
  sheet.querySelector('#ptClose').addEventListener('click', close);
}
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');

window.PlayTime = {
  GAMES, here: HERE, fmt, today, todayIn,
  day: k => day(k || dayKey(new Date())),        // { t, g, h, s } for a date key ("2026-10-21"), live for today
  days: () => Object.keys(load().days).sort(),   // every day with any time
  pill, open, close, flush,
};
})();
