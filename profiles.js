// Players: up to 5 people share the app on one device, each with their own saves, stats, streaks and settings.
// No passwords, just a name and a color. The color becomes that player's pencil (--hit) and tints the paper,
// so it's obvious at a glance whose games are on screen.
//
// How the saves are kept apart: every page loads this file first, in <head>. It wraps localStorage so each
// player's keys get their own prefix ("pg:<id>:hangman-game"). The first player (id p0) keeps the plain,
// unprefixed keys, so the progress that was already on the phone simply becomes theirs. The player list itself
// lives under "pg-profiles", which is never prefixed.
//
// UI: Players.open() shows the player list. Picking someone else always goes through a confirmation screen,
// then the page reloads as them. The home page shows a badge (Players.badge()) and asks for the first name;
// the game menu has a "Switch player" row.
(function(){
'use strict';
const MAX = 5, REG = 'pg-profiles';
const COLORS = [ // [id, name, light-mode pencil, dark-mode pencil]
  ['blue', 'Blue', '#2e5ea6', '#8cc2ff'],
  ['teal', 'Teal', '#0f7f86', '#6fd6d6'],
  ['green', 'Green', '#2f8a3c', '#86d68e'],
  ['purple', 'Purple', '#7449b0', '#c3a2f2'],
  ['pink', 'Pink', '#b3388f', '#f29ad3'],
  ['orange', 'Orange', '#c75d12', '#ffb170'],
  ['gold', 'Gold', '#9a7408', '#f0cd63'],
  ['slate', 'Slate', '#4b5b69', '#b4c3d1'],
];
const colorOf = id => COLORS.find(c => c[0] === id) || COLORS[0];

// ---- the storage wrapper ----
const S = Storage.prototype, raw = { get: S.getItem, set: S.setItem, del: S.removeItem, key: S.key };
let ls = null; try{ ls = window.localStorage; }catch(e){}
const rget = k => { try{ return raw.get.call(ls, k); }catch(e){ return null; } };
const rset = (k, v) => { try{ raw.set.call(ls, k, v); }catch(e){} };
function readReg(){ try{ const r = JSON.parse(rget(REG)); if (r && Array.isArray(r.list) && r.list.length) return r; }catch(e){} return null; }
let reg = readReg();
const saveReg = () => rset(REG, JSON.stringify(reg));
const activeId = () => reg && reg.list.some(p => p.id === reg.active) ? reg.active : 'p0';
const prefixFor = id => id === 'p0' ? '' : `pg:${id}:`;
const ours = k => typeof k === 'string' && (k === REG || k.startsWith('pg-'));
let PFX = prefixFor(activeId());
if (ls){
  S.getItem = function(k){ return this === ls && !ours(k) ? raw.get.call(this, PFX + k) : raw.get.call(this, k); };
  S.setItem = function(k, v){ return this === ls && !ours(k) ? raw.set.call(this, PFX + k, v) : raw.set.call(this, k, v); };
  S.removeItem = function(k){ return this === ls && !ours(k) ? raw.del.call(this, PFX + k) : raw.del.call(this, k); };
}
function allKeys(){ const out = []; try{ for (let i = 0; i < ls.length; i++) out.push(raw.key.call(ls, i)); }catch(e){} return out; }
const belongsTo = (k, id) => id === 'p0' ? !ours(k) && !k.startsWith('pg:') : k.startsWith(prefixFor(id));
const hasOldSaves = () => allKeys().some(k => belongsTo(k, 'p0'));

// ---- theme: the player's color as the pencil, a faint tint on the paper and its grid ----
function applyTheme(){
  const p = current(), root = document.documentElement;
  if (!p){ root.removeAttribute('data-pc'); return; }
  const [, , L, D] = colorOf(p.color);
  root.setAttribute('data-pc', p.color);
  root.style.setProperty('--pc', L); root.style.setProperty('--pc-dark', D);
}
const themeCss = `
html:root[data-pc]{--pc-hit:var(--pc);
  --hit:var(--pc);--paper:color-mix(in srgb,var(--pc) 6%,#f2f4ef);--grid:color-mix(in srgb,var(--pc) 14%,transparent);
  --sel:color-mix(in srgb,var(--pc) 26%,transparent);--peer:color-mix(in srgb,var(--pc) 8%,transparent);--same:color-mix(in srgb,var(--pc) 17%,transparent)}
@media (prefers-color-scheme: dark){html:root[data-pc]:not([data-theme="light"]){--pc-hit:var(--pc-dark);
  --hit:var(--pc-dark);--paper:color-mix(in srgb,var(--pc-dark) 9%,#102a43);--grid:color-mix(in srgb,var(--pc-dark) 13%,transparent);
  --sel:color-mix(in srgb,var(--pc-dark) 30%,transparent);--peer:color-mix(in srgb,var(--pc-dark) 8%,transparent);--same:color-mix(in srgb,var(--pc-dark) 18%,transparent)}}
html:root[data-pc][data-theme="dark"]{--pc-hit:var(--pc-dark);
  --hit:var(--pc-dark);--paper:color-mix(in srgb,var(--pc-dark) 9%,#102a43);--grid:color-mix(in srgb,var(--pc-dark) 13%,transparent);
  --sel:color-mix(in srgb,var(--pc-dark) 30%,transparent);--peer:color-mix(in srgb,var(--pc-dark) 8%,transparent);--same:color-mix(in srgb,var(--pc-dark) 18%,transparent)}
`;

// ---- UI ----
const uiCss = `
.sheet.pl{z-index:60}
.pl .panel{gap:14px}
.pl-av{--c:var(--pc-hit,#2e5ea6);flex:none;width:40px;height:40px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center;font-family:var(--hand);font-size:1.45rem;line-height:1;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
.pl-av.big{width:96px;height:96px;font-size:3.4rem;box-shadow:inset 0 -6px 0 rgba(0,0,0,.18),0 0 0 6px color-mix(in srgb,var(--c) 22%,transparent)}
.pl-list{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--key)}
.pl-row{display:flex;align-items:center;border-bottom:1px solid var(--line)}
.pl-row:last-child{border-bottom:0}
.pl-pick{flex:1;min-width:0;display:flex;align-items:center;gap:12px;border:0;background:transparent;padding:10px 12px;text-align:left;cursor:pointer;color:var(--ink)}
.pl-pick:active,.pl-edit:active{background:var(--peer)}
.pl-pick span{display:flex;flex-direction:column;gap:1px;min-width:0}
.pl-pick b{font-weight:600;font-size:1.05rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-pick small{color:var(--muted);font-size:.8rem}
.pl-row.on .pl-pick small{color:var(--c);font-weight:600}
.pl-edit{flex:none;align-self:stretch;width:52px;border:0;border-left:1px solid var(--line);background:transparent;cursor:pointer;color:var(--muted);display:grid;place-items:center}
.pl-edit svg,.pl-add svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.pl-add{display:flex;align-items:center;justify-content:center;gap:8px;border-style:dashed}
.pl-name{font:inherit;font-size:1.15rem;padding:11px 14px;border-radius:12px;border:2px solid var(--line);background:var(--key);color:var(--ink);width:100%;-webkit-user-select:text;user-select:text}
.pl-name:focus{outline:none;border-color:var(--c)}
.pl-sw{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pl-sw button{position:relative;aspect-ratio:1;max-height:62px;border-radius:14px;border:3px solid transparent;background:var(--c);cursor:pointer;color:#fff;font-family:var(--hand);font-size:1.3rem;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
.pl-sw button[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 2px var(--sheet)}
.pl-sw button:disabled{opacity:.35;cursor:default}
.pl-sw button svg{width:24px;height:24px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.pl-err{color:var(--miss)!important;font-size:.88rem;min-height:1.2em}
.pl-center{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:6px 0 2px}
.pl-center h2{margin-top:6px}
.pl .row .btn.go{background:var(--c);border-color:var(--c);color:#fff}
.pl-del.armed{background:color-mix(in srgb,var(--miss) 12%,transparent);color:var(--miss);border-color:var(--miss)}
.pl-badge{--c:var(--pc-hit,#2e5ea6);display:inline-flex;align-items:center;gap:8px;padding:4px 12px 4px 4px;border-radius:999px;background:var(--key);border:1px solid var(--key-edge);color:var(--ink);font-weight:600;font-size:.95rem;cursor:pointer;max-width:46vw}
.pl-badge .pl-av{width:30px;height:30px;font-size:1.1rem}
.pl-badge span:not(.pl-av){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-hint{font-size:.85rem}
`;
const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
const ICON_ADD = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_TICK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initial = n => (Array.from(n.trim())[0] || '?').toUpperCase();
const avatar = (p, big) => `<span class="pl-av${big ? ' big' : ''}" style="--c:${colorOf(p.color)[2]}" aria-hidden="true">${esc(initial(p.name))}</span>`;
const dark = () => document.documentElement.getAttribute('data-theme') === 'dark' || (document.documentElement.getAttribute('data-theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
const shade = id => colorOf(id)[dark() ? 3 : 2];

let sheet = null, panel = null, view = null, draft = null, armTimer = null, onDone = null, forced = false;
function current(){ return reg ? reg.list.find(p => p.id === activeId()) || null : null; }
function build(){
  if (sheet) return;
  sheet = document.createElement('div'); sheet.className = 'sheet pl'; sheet.hidden = true;
  sheet.innerHTML = '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="plTitle"></div>';
  panel = sheet.firstChild; document.body.appendChild(sheet);
  sheet.addEventListener('click', e => { if (e.target === sheet && !forced) close(); });
  // while open, keys don't reach the game underneath (typing a name mustn't guess Hangman letters)
  addEventListener('keydown', e => {
    if (sheet.hidden) return;
    if (e.key === 'Escape' && !forced){ e.preventDefault(); close(); }
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('pl-name')){ e.preventDefault(); const b = panel.querySelector('#plSave'); b && b.click(); }
    if (e.key !== 'Tab') e.stopImmediatePropagation();
  }, true);
  ['keyup', 'keypress'].forEach(t => addEventListener(t, e => { if (!sheet.hidden) e.stopImmediatePropagation(); }, true));
}
function show(v, arg){
  build(); view = v; clearTimeout(armTimer);
  ({ list: drawList, edit: drawEdit, confirm: drawConfirm, welcome: drawEdit })[v](arg);
  sheet.hidden = false;
  const f = panel.querySelector('.pl-name') || panel.querySelector('[data-focus]');
  if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
}
function close(){ forced = false; if (sheet){ sheet.hidden = true; view = null; clearTimeout(armTimer); } if (onDone){ const f = onDone; onDone = null; f(); } }

function drawList(){
  const me = activeId(), list = reg ? reg.list : [];
  panel.innerHTML = `<h2 id="plTitle">Who's playing?</h2>
    <div class="pl-list">${list.map(p => `<div class="pl-row${p.id === me ? ' on' : ''}" style="--c:${shade(p.color)}">
      <button class="pl-pick" type="button" data-id="${p.id}"${p.id === me ? ' data-focus' : ''}>${avatar(p)}<span><b>${esc(p.name)}</b><small>${p.id === me ? 'Playing now' : 'Tap to switch'}</small></span></button>
      <button class="pl-edit" type="button" data-edit="${p.id}" aria-label="Edit ${esc(p.name)}">${ICON_EDIT}</button></div>`).join('')}</div>
    ${list.length < MAX ? `<button class="btn pl-add" type="button" id="plAdd">${ICON_ADD}Add a player</button>` : ''}
    <p class="pl-hint">Up to ${MAX} players. Each has their own saved games, stats, streaks and settings. No passwords, so anyone can pick any player.</p>
    <button class="btn" type="button" id="plClose">Done</button>`;
  panel.querySelectorAll('.pl-pick').forEach(b => b.addEventListener('click', () => b.dataset.id === me ? close() : show('confirm', b.dataset.id)));
  panel.querySelectorAll('.pl-edit').forEach(b => b.addEventListener('click', () => show('edit', b.dataset.edit)));
  const add = panel.querySelector('#plAdd'); add && add.addEventListener('click', () => show('edit', null));
  panel.querySelector('#plClose').addEventListener('click', close);
}

// Add (id null), edit, or the first-run welcome. Colors already taken by someone else are greyed out.
function drawEdit(id){
  const welcome = view === 'welcome', p = id && reg ? reg.list.find(x => x.id === id) : null;
  const others = (reg ? reg.list : []).filter(x => !p || x.id !== p.id);
  const taken = new Set(others.map(x => x.color));
  draft = { name: p ? p.name : '', color: p ? p.color : (COLORS.find(c => !taken.has(c[0])) || COLORS[0])[0] };
  const old = welcome && hasOldSaves();
  panel.innerHTML = `<h2 id="plTitle">${welcome ? 'Who\'s playing?' : p ? 'Edit player' : 'New player'}</h2>
    ${welcome ? `<p>Up to ${MAX} people can share Paper Games on this device, each with their own games and streaks. ${old ? 'Name the player whose progress is already here.' : 'Start with your name.'}</p>` : ''}
    <input class="pl-name" id="plName" type="text" maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Name" value="${esc(draft.name)}" aria-label="Player name">
    <span class="label">Color</span>
    <div class="pl-sw" role="group" aria-label="Color">${COLORS.map(([cid, cname]) => {
      const who = others.find(x => x.color === cid);
      return `<button type="button" data-c="${cid}" style="--c:${shade(cid)}" aria-label="${cname}${who ? `, ${esc(who.name)}'s color` : ''}" aria-pressed="${cid === draft.color}"${who ? ' disabled' : ''}>${who ? esc(initial(who.name)) : cid === draft.color ? ICON_TICK : ''}</button>`; }).join('')}</div>
    <p class="pl-err" id="plErr" role="alert"></p>
    <div class="row">${forced ? '' : '<button class="btn" type="button" id="plBack">Cancel</button>'}<button class="btn primary go" type="button" id="plSave">${welcome ? 'Let\'s play' : p ? 'Save' : 'Add player'}</button></div>
    ${p && others.length ? `<button class="btn pl-del" type="button" id="plDel"${p.id === activeId() ? ' disabled' : ''}>Remove ${esc(p.name)}</button>
      <p class="pl-hint">${p.id === activeId() ? 'Switch to someone else first to remove this player.' : 'Removing a player deletes all of their saved games and stats from this device.'}</p>` : ''}`;
  const paint = () => { panel.style.setProperty('--c', shade(draft.color));
    panel.querySelectorAll('.pl-sw button').forEach(b => { if (b.disabled) return; const on = b.dataset.c === draft.color; b.setAttribute('aria-pressed', on); b.innerHTML = on ? ICON_TICK : ''; }); };
  paint();
  panel.querySelector('.pl-sw').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled){ draft.color = b.dataset.c; paint(); } });
  const back = panel.querySelector('#plBack'); back && back.addEventListener('click', () => reg ? show('list') : close());
  panel.querySelector('#plSave').addEventListener('click', () => {
    const name = panel.querySelector('#plName').value.trim().replace(/\s+/g, ' '), err = panel.querySelector('#plErr');
    if (!name){ err.textContent = 'Type a name first.'; return; }
    const dup = others.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (dup){ err.textContent = `There's already a player called ${dup.name}.`; return; }
    if (p){ p.name = name; p.color = draft.color; saveReg(); if (p.id === activeId()) refresh(); show('list'); return; }
    if (!reg){ reg = { list: [{ id: 'p0', name, color: draft.color }], active: 'p0', next: 1 }; saveReg(); refresh();
      if (welcome){ close(); return; } show('list'); return; }
    const np = { id: 'p' + (reg.next || reg.list.length), name, color: draft.color };
    reg.next = +np.id.slice(1) + 1; reg.list.push(np); saveReg();
    show('confirm', np.id); // a new player: offer to switch to them now (Cancel goes back to the list)
  });
  const del = panel.querySelector('#plDel');
  del && del.addEventListener('click', () => {
    if (!del.classList.contains('armed')){ del.classList.add('armed'); del.textContent = `Tap again to remove ${p.name}`; armTimer = setTimeout(() => { del.classList.remove('armed'); del.textContent = `Remove ${p.name}`; }, 3500); return; }
    allKeys().filter(k => belongsTo(k, p.id)).forEach(k => { try{ raw.del.call(ls, k); }catch(e){} });
    reg.list = reg.list.filter(x => x.id !== p.id); saveReg(); show('list');
  });
}

// The confirmation screen: always shown before switching.
function drawConfirm(id){
  const p = reg.list.find(x => x.id === id), me = current();
  panel.style.setProperty('--c', shade(p.color));
  panel.innerHTML = `<div class="pl-center">${avatar(p, true)}<h2 id="plTitle">Switch to ${esc(p.name)}?</h2>
    <p>${me ? `${esc(me.name)}'s games stay saved. ` : ''}${esc(p.name)} picks up their own games, stats and streaks.</p></div>
    <div class="row"><button class="btn" type="button" id="plNo">Cancel</button><button class="btn primary go" type="button" id="plYes" data-focus>Switch to ${esc(p.name)}</button></div>`;
  panel.querySelector('#plNo').addEventListener('click', () => show('list'));
  panel.querySelector('#plYes').addEventListener('click', () => {
    dispatchEvent(new CustomEvent('players:switching')); // e.g. play time saves under the old player first
    reg.active = p.id; saveReg(); PFX = prefixFor(p.id);
    sheet.hidden = true; location.reload();
  });
}

// keep the badge and theme in step after a rename/recolor
const badges = new Set();
function paintBadge(el){ const p = current(); el.hidden = !p; if (!p) return;
  el.style.setProperty('--c', shade(p.color)); el.innerHTML = `${avatar(p)}<span>${esc(p.name)}</span>`; el.setAttribute('aria-label', `Playing as ${p.name}. Switch player`); }
function refresh(){ applyTheme(); badges.forEach(paintBadge); window.dispatchEvent(new CustomEvent('players:change')); }

applyTheme();
const st = document.createElement('style'); st.textContent = themeCss + uiCss; document.head.appendChild(st);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => badges.forEach(paintBadge));

window.Players = {
  MAX, COLORS,
  get list(){ return reg ? reg.list.map(p => Object.assign({}, p)) : []; },
  get current(){ const p = current(); return p ? Object.assign({}, p) : null; },
  open(done){ onDone = done || null; forced = false; reg ? show('list') : show('welcome'); },
  welcome(){ if (!reg){ forced = true; show('welcome'); } }, // first run on the home page: name the first player (can't be skipped)
  badge(){ const b = document.createElement('button'); b.type = 'button'; b.className = 'pl-badge'; badges.add(b); paintBadge(b);
    b.addEventListener('click', () => Players.open()); return b; },
  avatar(p, big){ return avatar(p || current() || { name: '?', color: 'blue' }, big); },
};
})();
