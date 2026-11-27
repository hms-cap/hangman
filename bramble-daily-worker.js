// Works out the Bramble daily target (what the computer scores over the same ten turns) off the main thread.
//   in: {id, day} or {id, seed} (a practice game)  ->  out: {id, target, plays}   plays = [{type, score, main}]   or {id, error}
self.window = self;
importScripts('bramble-words.js', 'bramble-core.js');
onmessage = e => {
  const { id, day, seed } = e.data;
  try {
    const t = typeof seed === 'number' ? Bramble.practiceTarget(seed) : Bramble.dailyTarget(day);
    postMessage({ id, target: t.target, plays: t.plays });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
