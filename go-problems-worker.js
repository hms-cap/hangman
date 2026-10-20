// Judges moves in Go problems off the main thread (the solver can take a moment on life-and-death problems).
importScripts('go-core.js', 'go-solver.js', 'go-problem.js');
onmessage = e => {
  const { id, type, problem, moves, move } = e.data;
  try {
    if (type === 'hint') postMessage({ id, move: GoProblem.hint(problem, moves) });
    else postMessage(Object.assign({ id }, GoProblem.judge(problem, moves, move)));
  } catch (err) { postMessage({ id, status: 'error', error: String(err && err.message || err) }); }
};
