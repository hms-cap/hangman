// Runs the Go computer player and tutor off the main thread, so the board never freezes while it thinks.
importScripts('go-core.js', 'go-tutor.js');
onmessage = e => {
  const { id, type, N, handicap, komi, moves, level, move, seed, playouts, time } = e.data;
  try {
    const b = Go.replay(N, handicap, komi, moves);
    if (type === 'think') {
      const r = Go.think(b, Go.LEVELS[level], { seed });
      postMessage({ id, move: r.move, resign: !!r.resign, winrate: r.winrate });
    } else if (type === 'review') {
      postMessage({ id, review: GoTutor.review(b, move, { playouts, time, seed }) });
    } else if (type === 'estimate') {
      const est = Go.estimate(b, playouts || 400, seed);
      postMessage({ id, dead: [...est.dead], own: Array.from(est.own), margin: est.margin });
    } else if (type === 'hint') {
      const r = Go.search(b, { playouts: playouts || 3000, time: time || 3000, seed });
      postMessage({ id, move: r.move, top: r.top });
    }
  } catch (err) { postMessage({ id, error: String(err && err.message || err) }); }
};
