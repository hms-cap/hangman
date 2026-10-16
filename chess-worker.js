// Runs the chess engine off the main thread so the board stays responsive while the computer thinks.
// The page starts two of these: one plays the computer's moves, the other reviews your moves in tutor mode.
importScripts('chess-core.js', 'chess-tutor.js');
onmessage = e => {
  const { id, fen, moves, level, type, move, opp } = e.data;
  try {
    const pos = Chess.Position.fromMoves(fen, moves);
    if (type === 'review') {
      const m = pos.fromUci(move);
      if (!m) throw new Error('Illegal move to review: ' + move);
      postMessage({ id, review: ChessTutor.review(pos, m, { time: 600, opp }) });
      return;
    }
    const r = Chess.Engine.think(pos, level, fen === Chess.START ? moves : ['x']);
    postMessage({ id, move: r.move ? Chess.Position.uci(r.move) : null, score: r.score, depth: r.depth });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
