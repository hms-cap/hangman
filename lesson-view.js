// A lesson before a trainer level: a few pages, each with a heading, a short text and diagrams, then the drills.
// Shared by the Chess and Go trainers; each supplies its own diagram drawing.
//   LessonView.open({ label, title, pages: [{ h, text (HTML), figs: [any], wide }], figure: f => ({ svg, cap }),
//                     done: 'Start the drills', skip: 'Skip to the drills', onDone(), onSkip() (default: onDone) })
// The sheet is a normal .sheet, so a page's own open()/close() helpers and glossary links keep working with it.
(function (root) {
'use strict';
let L = null, i = 0;
const $ = id => document.getElementById(id);
function ensure() {
  if ($('lessonSheet')) return;
  const st = document.createElement('style');
  st.textContent = `
#lessonSheet .panel{gap:12px}
.ls-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ls-dots{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.ls-dots i{width:7px;height:7px;border-radius:50%;background:var(--line)} .ls-dots i.on{background:var(--ink)}
#lessonSheet h2{margin:0}
.ls-h{margin:0;font-weight:700;font-size:1rem;color:var(--ink)}
.ls-text{margin:0;font-size:.95rem;line-height:1.5;color:var(--ink)}
.ls-figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;align-items:start}
.ls-figs.wide{grid-template-columns:minmax(0,320px);justify-content:center}
.ls-figs figure{margin:0;display:flex;flex-direction:column;gap:4px}
.ls-figs figure > svg{width:100%;height:auto;display:block}
.ls-figs figcaption{font-size:.78rem;color:var(--muted);line-height:1.3}
.ls-nav{display:grid;grid-template-columns:auto 1fr;gap:8px}
.ls-nav .btn{margin:0}
.ls-skip{align-self:center;background:none;border:0;color:var(--muted);font-size:.85rem;text-decoration:underline;cursor:pointer;padding:4px}
`;
  document.head.appendChild(st);
  const d = document.createElement('div');
  d.className = 'sheet'; d.id = 'lessonSheet'; d.hidden = true;
  d.innerHTML = `<div class="panel" role="dialog" aria-labelledby="lsTitle">
    <div class="ls-top"><span class="label" id="lsLabel"></span><span class="ls-dots" id="lsDots"></span></div>
    <h2 id="lsTitle"></h2>
    <p class="ls-h" id="lsH"></p>
    <p class="ls-text" id="lsText"></p>
    <div class="ls-figs" id="lsFigs"></div>
    <div class="ls-nav"><button class="btn" id="lsBack" type="button" aria-label="Previous page">◀</button><button class="btn primary" id="lsNext" type="button"></button></div>
    <button class="ls-skip" id="lsSkip" type="button"></button>
  </div>`;
  document.body.appendChild(d);
  $('lsBack').onclick = () => { if (i > 0) { i--; draw(); } };
  $('lsNext').onclick = () => { if (i < L.pages.length - 1) { i++; draw(); } else finish(); };
  $('lsSkip').onclick = () => { const l = L; hide(); l && (l.onSkip || l.onDone) && (l.onSkip || l.onDone)(); };
}
function finish() { const l = L; hide(); l && l.onDone && l.onDone(); }
function hide() { const s = $('lessonSheet'); if (s) s.hidden = true; }
function draw() {
  const p = L.pages[i], last = i === L.pages.length - 1;
  $('lsLabel').textContent = L.label || 'Lesson';
  $('lsTitle').textContent = L.title || '';
  $('lsDots').innerHTML = L.pages.length > 1 ? L.pages.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('') : '';
  $('lsH').textContent = p.h || ''; $('lsH').hidden = !p.h;
  $('lsText').innerHTML = p.text || '';
  const figs = (p.figs || []).map(f => { try { return L.figure(f); } catch (e) { return null; } }).filter(Boolean);
  $('lsFigs').className = 'ls-figs' + (p.wide || figs.length === 1 ? ' wide' : '');
  $('lsFigs').innerHTML = figs.map(g => `<figure>${g.svg}${g.cap ? `<figcaption>${g.cap}</figcaption>` : ''}</figure>`).join('');
  $('lsBack').disabled = i === 0;
  $('lsNext').textContent = last ? (L.done || 'Start the drills') : 'Next ▶';
  $('lsSkip').textContent = last ? '' : (L.skip || 'Skip to the drills');
  $('lsSkip').hidden = last;
  $('lessonSheet').querySelector('.panel').scrollTop = 0;
}
function open(opts) {
  ensure(); L = opts; i = 0;
  document.querySelectorAll('.sheet').forEach(s => { if (s.id !== 'lessonSheet' && !s.classList.contains('gnav')) s.hidden = true; });
  $('lessonSheet').hidden = false;
  draw();
}
root.LessonView = { open, close: hide };
})(typeof self !== 'undefined' ? self : globalThis);
