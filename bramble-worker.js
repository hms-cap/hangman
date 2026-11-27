// Runs the Bramble computer player off the main thread so the board stays responsive while it thinks.
//   in:  {id, state, level, seed}            -> out: {id, move}   move = {type:'play', placements, score, main, words, rare} | {type:'exchange', tiles} | {type:'pass'}
//        {id, type:'hint', state, count}     -> out: {id, moves}  the best `count` (default 5) plays by score, each {placements, score, main, words, rare, tiles}
// `seed` (optional number) makes the choices repeatable (casual and easy pick at random; expert samples opponent racks). Expert thinks for about
// 0.2 s on average on a laptop (a second or two on a phone, longer in rare heavy positions with blanks); its work is capped by Bramble.EXPERT.budget.
self.window = self;
importScripts('bramble-words.js', 'bramble-core.js');
onmessage = e => {
  const { id, type, state, level, seed, count } = e.data;
  try {
    if (type === 'hint') {
      const moves = Bramble.allMoves(state).sort((a, b) => b.score - a.score).slice(0, count || 5);
      postMessage({ id, moves });
      return;
    }
    const rng = typeof seed === 'number' ? Bramble.mulberry(seed) : Math.random;
    postMessage({ id, move: Bramble.chooseMove(state, level, rng) });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
