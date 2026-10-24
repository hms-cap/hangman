// The app's version and what changed, shown on the home screen's About page (the About button above the tabs).
// Every change to the app bumps this: a fix → 1.0.1, a new feature or game change → 1.1.0, a big overhaul → 2.0.0.
// Add the new entry at the top of CHANGES, and set CACHE in sw.js to 'paper-games-v' + the same version
// (that is what makes installed copies pick up the update). tools/check-version.js checks the two match.
self.APP = {
  version: '1.5.1',
  date: '2026-10-24',
  changes: [
    { v: '1.5.1', date: '2026-10-24', notes: [
      'Chowka Bara: you and the computer now throw with exactly the same single, tested throw (four fair 50/50 shells), and a shake can never change the odds',
      'Chowka Bara: see the throws for yourself: the end of each game shows how many bara and chowka each side threw, and the menu keeps a running tally against the computer',
    ] },
    { v: '1.5.0', date: '2026-10-24', notes: [
      'New daily game: Trellis, a 5 × 5 mini crossword with a new puzzle every day, a timer, check and reveal, and every past puzzle to play',
    ] },
    { v: '1.4.0', date: '2026-10-24', notes: [
      'Hangman: three ways to win, picked at random: the figure walks away, floats off on balloons spelling the word, or swings on the gallows-turned-swing',
      'Hangman: two ways to lose: an eraser rubs the figure out, or it is wiped off a chalkboard with a duster',
    ] },
    { v: '1.3.0', date: '2026-10-24', notes: [
      'Hangman: solve the word and the figure is freed: it hops, waves and walks off the page whistling',
      'Hangman: run out of guesses and a pencil eraser rubs the figure out',
    ] },
    { v: '1.2.1', date: '2026-10-24', notes: [
      'Clover: a much bigger finish, with a giant four-leaf clover and larger clovers showering down',
    ] },
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
