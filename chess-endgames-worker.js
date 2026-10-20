// Builds the exact endgame tables off the main thread for the Chess Trainer (see chess-endgames.js).
importScripts('chess-endgames.js');
onmessage = e => {
  const kinds = e.data.kind === 'P' ? ['Q', 'R', 'P'] : [e.data.kind];
  const out = kinds.map(k => { const t = ChessEndgames.tables(k); return { kind: k, v: t.v, dead: t.dead }; });
  postMessage({ id: e.data.id, tables: out });
};
