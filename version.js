// The app's version and what changed, shown on the home screen's About page (the About button above the tabs).
// Every change to the app bumps this: a fix → 1.0.1, a new feature or game change → 1.1.0, a big overhaul → 2.0.0.
// Add the new entry at the top of CHANGES, and set CACHE in sw.js to 'paper-games-v' + the same version
// (that is what makes installed copies pick up the update). tools/check-version.js checks the two match.
self.APP = {
  version: '1.2.0',
  date: '2026-10-24',
  changes: [
    { v: '1.2.0', date: '2026-10-24', notes: [
      'Tendril: every word you find grows a flower or fruit on its vine (daisy, sunflower, cherries, strawberry and more)',
    ] },
    { v: '1.1.0', date: '2026-10-23', notes: [
      'End-of-game moments in every game except Hangman, each in its own theme:',
      'Sudoku: digits fly off the grid; Tendril: vines climb the screen; Clover: four-leaf clovers shower down',
      'Chess: a gold wave and crowns; Go: ink ripples and scattering stones; Chowka Bara: a rangoli and cowry shells',
      'Snake: the snake crumbles, with fireworks for a new best; trainers: stars for a pass, fireworks for mastery',
    ] },
    { v: '1.0.1', date: '2026-10-23', notes: [
      'About is now a button above the game tabs, next to the time played',
    ] },
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
