// Game menu shared by every game page. Tapping the game's title opens it:
//   - the game's own actions (restart, new game, quit, give up, resign), supplied by the page; anything that
//     throws away progress asks for a second tap first
//   - Back to all games (the game in progress stays saved)
//   - Switch game: straight to any other game
// A page calls GameNav.init({ id, actions, onOpen, onClose, note }) after its own script has set up.
(function(){
'use strict';
const GAMES = [
  ['hangman', 'Hangman', 'hangman.html', '#c0393f'],
  ['sudoku', 'Sudoku', 'sudoku.html', '#1f7a63'],
  ['five', 'Starfish', 'fiveletters.html', '#d38c1f'],
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
const css = `
.gn-title{font:inherit;color:inherit;background:none;border:0;padding:2px 4px;margin:0;cursor:pointer;display:inline-flex;align-items:center;gap:4px;border-radius:10px;line-height:1}
.gn-title .em{width:1.05em;height:1.05em;margin:0 6px 0 0;opacity:1;stroke-width:7}
.gn-title svg:not(.em){width:14px;height:14px;flex:none;opacity:.55;margin-top:4px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.gn-title:active{background:var(--peer)}
.sheet.gnav{z-index:40}
.gnav .panel{gap:12px}
.gn-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.gn-note{font-size:.85rem}
.gn-acts{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--key)}
.gn-acts:empty{display:none}
.gn-act{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:transparent;padding:12px 14px;cursor:pointer;color:var(--ink)}
.gn-act:last-child{border-bottom:0}
.gn-act:active{background:var(--peer)}
.gn-act svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.8}
.gn-act span{display:flex;flex-direction:column;gap:2px;min-width:0}
.gn-act b{font-weight:600;font-size:1rem}
.gn-act small{color:var(--muted);font-size:.8rem;line-height:1.3}
.gn-act.danger{color:var(--miss)}
.gn-act.armed{background:color-mix(in srgb,var(--miss) 12%,transparent)}
.gn-act.armed b{color:var(--miss)}
.gn-home{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-size:1.3rem;padding:10px 18px}
.gn-home svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.gn-games{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.gn-game{display:flex;align-items:center;gap:7px;padding:7px 9px;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--key);color:var(--ink);text-decoration:none;font-size:.82rem;font-weight:600;min-width:0}
.gn-game i{flex:none;width:12px;height:12px;border-radius:4px;background:var(--gc)}
.gn-game span{line-height:1.15;overflow-wrap:anywhere}
.gn-game[aria-current="page"]{border-color:var(--gc);box-shadow:inset 0 0 0 1px var(--gc)}
@media (max-width:360px){.gn-games{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
const ICONS = {
  restart: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/></svg>',
  new: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
  quit: '<svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  mode: '<svg viewBox="0 0 24 24"><path d="M4 7h11M4 17h7"/><circle cx="18" cy="7" r="2.5"/><circle cx="14" cy="17" r="2.5"/></svg>',
};
let cfg = null, sheet = null, isOpen = false, armedBtn = null, armTimer = null;

function build(){
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  sheet = document.createElement('div');
  sheet.className = 'sheet gnav'; sheet.id = 'gnavSheet'; sheet.hidden = true;
  const here = (GAMES.find(g => g[0] === cfg.id) || [])[1] || document.title;
  sheet.innerHTML = `<div class="panel" role="dialog" aria-labelledby="gnTitle">
    <div class="gn-head"><h2 id="gnTitle">${here}</h2></div>
    <p class="gn-note" id="gnNote"></p>
    <div class="gn-acts" id="gnActs"></div>
    <a class="btn primary gn-home" href="index.html"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>Back to all games</a>
    <span class="label">Switch game</span>
    <div class="gn-games">${GAMES.map(([id, name, href, c]) => `<a class="gn-game" href="${href}" style="--gc:${c}"${id === cfg.id ? ' aria-current="page"' : ''}><i></i><span>${name}</span></a>`).join('')}</div>
    <button class="btn" type="button" id="gnClose">Keep playing</button>
  </div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  sheet.querySelector('#gnClose').addEventListener('click', close);
  sheet.querySelector('.gn-games').addEventListener('click', e => { const a = e.target.closest('a'); if (a && a.getAttribute('aria-current')){ e.preventDefault(); close(); } });
  // the title in the header becomes the button that opens this menu
  const h1 = document.querySelector('.bar h1');
  if (h1){
    const label = h1.textContent.trim(), em = h1.querySelector('.em');
    h1.innerHTML = `<button class="gn-title" type="button" aria-haspopup="dialog" aria-label="${label}: game menu">${em ? em.outerHTML : ''}${label}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg></button>`;
    h1.firstElementChild.addEventListener('click', () => isOpen ? close() : open());
  }
  // while the menu is open, keys don't reach the game (Escape closes it)
  addEventListener('keydown', e => {
    if (!sheet || sheet.hidden) return;
    if (e.key === 'Escape'){ e.preventDefault(); close(); }
    if (e.key !== 'Tab') e.stopImmediatePropagation();
  }, true);
}

function disarm(){ clearTimeout(armTimer); if (armedBtn){ armedBtn.classList.remove('armed'); armedBtn.querySelector('b').textContent = armedBtn.dataset.label; armedBtn = null; } }
function drawActions(){
  const list = (cfg.actions ? cfg.actions() : []).filter(Boolean), box = sheet.querySelector('#gnActs');
  box.innerHTML = '';
  list.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gn-act' + (a.danger ? ' danger' : ''); b.dataset.label = a.label;
    b.innerHTML = `${ICONS[a.icon] || ICONS.next}<span><b>${a.label}</b>${a.note ? `<small>${a.note}</small>` : ''}</span>`;
    b.addEventListener('click', () => {
      if (a.confirm && armedBtn !== b){ // first tap arms, second tap does it
        disarm(); armedBtn = b; b.classList.add('armed'); b.querySelector('b').textContent = a.confirm;
        armTimer = setTimeout(disarm, 3500); return;
      }
      disarm(); close(true);
      a.run();
      if (a.leave) setTimeout(() => { location.href = 'index.html'; }, 30);
    });
    box.appendChild(b);
  });
  const note = typeof cfg.note === 'function' ? cfg.note() : cfg.note;
  sheet.querySelector('#gnNote').textContent = note || '';
  sheet.querySelector('#gnNote').hidden = !note;
}
function open(){
  if (!sheet) return;
  if (cfg.onOpen) cfg.onOpen();
  drawActions(); sheet.hidden = false; isOpen = true;
  const first = sheet.querySelector('.gn-act, .gn-home'); first && first.focus({ preventScroll: true });
}
function close(byAction){
  if (!sheet || sheet.hidden) { isOpen = false; return; }
  disarm(); sheet.hidden = true; isOpen = false;
  if (cfg.onClose) cfg.onClose(!!byAction);
}

// ---- end-of-game buttons ----
// Today's daily puzzles, in the order the home screen shows them, and whether each is finished
// (same rules as the home screen: Clover counts once any level is solved, or all three are played).
const DAILIES = [
  ['five', 'Starfish', 'fiveletters.html?daily', [2026, 9, 14]],
  ['trail', 'Tendril', 'trail.html?daily', [2026, 9, 16]],
  ['cpz', 'Chess Puzzles', 'chess-puzzles.html?daily', [2026, 9, 17]],
  ['groups', 'Clover', 'groups.html?daily', [2026, 9, 16]],
];
const read = k => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }catch(e){ return null; } };
const dayOf = ([y, m, d]) => { const n = new Date(); return Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(y, m, d)) / 864e5); };
function dailyDone(id){
  const D = DAILIES.find(x => x[0] === id), day = dayOf(D[3]);
  if (id === 'groups'){
    const p = read('groups-progress') || {}, lv = ['e', 'm', 'h'].map(l => p['d' + day + l]);
    return lv.some(x => x && x.done && x.won) || lv.every(x => x && x.done);
  }
  const s = read({ five: 'five-daily', trail: 'trail-daily', cpz: 'cpz-daily' }[id]);
  return !!(s && s.day === day && s.done);
}
// HTML for the end of a results screen: "Up next" to the next unfinished daily (if any), then Back to all games.
function endButtons(id){
  const i = DAILIES.findIndex(x => x[0] === id), daily = i >= 0;
  const order = daily ? DAILIES.slice(i + 1).concat(DAILIES.slice(0, i)) : DAILIES, next = order.find(x => !dailyDone(x[0]));
  const left = DAILIES.filter(x => !dailyDone(x[0])).length;
  const home = '<a class="btn homebtn" href="index.html"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>Back to all games</a>';
  const up = next ? `<a class="btn homebtn upnext" href="${next[2]}"><span class="label">Up next</span>${next[1]}${left > 1 ? ` <small>· ${left} daily puzzles left</small>` : ''}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`
    : daily ? '<p class="alldone">All of today\'s daily puzzles are done. See you tomorrow!</p>' : '';
  return `<div class="endnav">${up}${home}</div>`;
}

// Put the end buttons into a page element (by id) for the given game.
const fillEnd = (elId, id) => { const e = document.getElementById(elId); if (e) e.innerHTML = endButtons(id); };

window.GameNav = {
  endButtons, dailyDone, fillEnd,
  init(c){ cfg = c; build(); },
  open, close,
  get isOpen(){ return isOpen && sheet && !sheet.hidden; },
};
})();
