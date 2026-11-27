// Works out the Bramble daily target (what the computer scores over the same ten turns) off the main thread.
//   in: {id, day}  ->  out: {id, target, plays}   plays = [{type, score, main}]   or {id, error}
self.window = self;
importScripts('bramble-words.js', 'bramble-core.js');
onmessage = e => {
  const { id, day } = e.data;
  try {
    const t = Bramble.dailyTarget(day);
    postMessage({ id, target: t.target, plays: t.plays });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
