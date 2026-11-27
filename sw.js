// Offline cache. Online: fetch fresh files (so updates show at once) and keep the cache current.
// Offline or on a very slow connection: serve the saved copy. Once a fetch has failed or timed out, the next
// ones give the network only a moment, so a phone with no signal (but still "connected") doesn't wait on every file.
// The Google Fonts files are kept in their own cache (it survives updates), so the handwriting fonts work offline too.
const CACHE = 'paper-games-v1.12.0'; // = APP.version in version.js; bump both with every change
const FONTS = 'paper-games-fonts';
const FONT_CSS = ['https://fonts.googleapis.com/css2?family=Gochi+Hand&family=IBM+Plex+Mono:wght@400;500;600&display=swap', 'https://fonts.googleapis.com/css2?family=Gochi+Hand&family=IBM+Plex+Mono:wght@500;600&display=swap', 'https://fonts.googleapis.com/css2?family=Gochi+Hand&family=IBM+Plex+Mono:wght@500;600;700&display=swap'];
const FILES = ['./', 'index.html', 'hangman.html', 'sudoku.html', 'sudoku-coach.js', 'sudoku-training.js', 'sudoku-elo.js', 'sudoku-ratings.js', 'fiveletters.html', 'chess.html', 'trail.html', 'groups.html', 'chess-puzzles.html', 'chess-trainer.html', 'snake.html', 'chowka.html', 'paper.css', 'version.js', 'profiles.js', 'playtime.js', 'game-nav.js', 'celebrate.js', 'emblems.js', 'words.js', 'puzzles.js', 'fivewords.js', 'chess-core.js', 'chess-pieces.js', 'chess-worker.js', 'chess-tutor.js', 'trailwords.js', 'trail-daily.js', 'trail-core.js', 'groups-data.js', 'groups-bank.js', 'groups-core.js', 'mini.html', 'mini-data.js', 'mini-practice.js', 'chess-puzzles.js', 'chess-daily.js', 'chess-trainer-core.js', 'chess-trainer-data.js', 'chess-openings.js', 'chess-endgames.js', 'chess-endgames-worker.js', 'chowka-core.js', 'go.html', 'go-core.js', 'go-tutor.js', 'go-worker.js', 'go-solver.js', 'go-problem.js', 'go-problems.html', 'go-problems-data.js', 'go-problems-worker.js', 'go-daily.js', 'go-explain.js', 'go-glossary.js', 'go-lessons.js', 'chess-lessons.js', 'lesson-view.js', 'go-trainer.html', 'go-trainer-core.js',
  'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
// save the Latin letters of the fonts at install, so they are there offline; never lets the install fail or wait long
async function prewarmFonts(){
  const cache = await caches.open(FONTS);
  for (const url of FONT_CSS){
    try {
      const r = await fetch(url, { mode: 'cors' }), css = await r.clone().text();
      await cache.put(url, r);
      for (const block of css.split('/*').filter(b => /^\s*latin\s*\*\//.test(b))){
        const m = block.match(/url\((https:[^)]+)\)/);
        if (m && !(await cache.match(m[1]))) await cache.put(m[1], await fetch(m[1], { mode: 'cors' }));
      }
    } catch (err) {}
  }
}
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
  .then(() => Promise.race([prewarmFonts(), new Promise(r => setTimeout(r, 6000))]))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())));

let lastFail = 0; // when the network last failed or timed out
const patience = () => Date.now() - lastFail < 30000 ? 300 : 2500;

async function fontFetch(e){
  const cache = await caches.open(FONTS), hit = await cache.match(e.request);
  const net = fetch(e.request).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone()); return res; }).catch(() => null);
  if (hit){ if (new URL(e.request.url).hostname === 'fonts.googleapis.com') e.waitUntil(net); return hit; }
  const res = await Promise.race([net, new Promise(r => setTimeout(r, 4000, null))]);
  return res || Response.error();
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com'){ e.respondWith(fontFetch(e)); return; }
  if (u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const net = fetch(e.request, { cache: 'no-cache' }).then(res => { if (res && res.ok){ lastFail = 0; cache.put(e.request, res.clone()); } return res; }).catch(() => { lastFail = Date.now(); return null; });
    const slow = new Promise(r => setTimeout(r, patience(), null)); // give up on the network after a moment and use the saved copy
    const res = await Promise.race([net, slow]);
    if (res) return res;
    lastFail = Date.now();
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit){ e.waitUntil(net); return hit; }
    return (await net) || (e.request.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});
