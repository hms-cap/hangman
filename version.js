// The app's version and what changed, shown on the home screen's About tab.
// Every change to the app bumps this: a fix → 1.0.1, a new feature or game change → 1.1.0, a big overhaul → 2.0.0.
// Add the new entry at the top of CHANGES, and set CACHE in sw.js to 'paper-games-v' + the same version
// (that is what makes installed copies pick up the update). tools/check-version.js checks the two match.
self.APP = {
  version: '1.0.0',
  date: '2026-10-23',
  changes: [
    { v: '1.0.0', date: '2026-10-23', notes: [
      'First numbered version, with an About tab on the home screen',
      'Stelium: tide-pool colours, a live starfish, win and loss moments, and stats as a night sky',
      'Sudoku: wrong numbers are ringed as well as red; with Show mistakes off nothing is marked',
      'Chess, Go and Sudoku: Back to all games from the new-game screen',
      'Time played, per player, with a stats sheet',
      'Up to 5 players on one device, each with their own colour and saves',
      'Swipe between the home tabs',
    ] },
  ],
};
