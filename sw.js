// Offline cache. Online: fetch fresh files (so updates show at once) and keep the cache current.
// Offline or on a very slow connection: serve the saved copy.
const CACHE = 'paper-games-v55';
const FILES = ['./', 'index.html', 'hangman.html', 'sudoku.html', 'sudoku-coach.js', 'fiveletters.html', 'chess.html', 'trail.html', 'groups.html', 'chess-puzzles.html', 'chess-trainer.html', 'snake.html', 'chowka.html', 'paper.css', 'profiles.js', 'playtime.js', 'game-nav.js', 'emblems.js', 'words.js', 'puzzles.js', 'fivewords.js', 'chess-core.js', 'chess-pieces.js', 'chess-worker.js', 'chess-tutor.js', 'trailwords.js', 'trail-daily.js', 'trail-core.js', 'groups-data.js', 'groups-bank.js', 'groups-core.js', 'chess-puzzles.js', 'chess-daily.js', 'chess-trainer-core.js', 'chess-trainer-data.js', 'chess-openings.js', 'chess-endgames.js', 'chess-endgames-worker.js', 'chowka-core.js', 'go.html', 'go-core.js', 'go-tutor.js', 'go-worker.js', 'go-solver.js', 'go-problem.js', 'go-problems.html', 'go-problems-data.js', 'go-problems-worker.js', 'go-daily.js', 'go-explain.js', 'go-glossary.js', 'go-trainer.html', 'go-trainer-core.js',
  'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const net = fetch(e.request, { cache: 'no-cache' }).then(res => { if (res && res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => null);
    const slow = new Promise(r => setTimeout(r, 3000, null)); // fall back to the cache after 3 s
    const res = await Promise.race([net, slow]);
    if (res) return res;
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit){ e.waitUntil(net); return hit; }
    return (await net) || (e.request.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});
