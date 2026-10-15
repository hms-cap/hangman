// Runs the chess engine off the main thread so the board stays responsive while the computer thinks.
importScripts('chess-core.js');
onmessage = e => {
  const { id, fen, moves, level } = e.data;
  try {
    const pos = Chess.Position.fromMoves(fen, moves);
    const r = Chess.Engine.think(pos, level, fen === Chess.START ? moves : ['x']);
    postMessage({ id, move: r.move ? Chess.Position.uci(r.move) : null, score: r.score, depth: r.depth });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
