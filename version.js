// The app's version and what changed, shown on the home screen's About page (the About button above the tabs).
// Every change to the app bumps this: a fix → 1.0.1, a new feature or game change → 1.1.0, a big overhaul → 2.0.0.
// Add the new entry at the top of CHANGES, and set CACHE in sw.js to 'paper-games-v' + the same version
// (that is what makes installed copies pick up the update). tools/check-version.js checks the two match.
self.APP = {
  version: '1.11.1',
  date: '2026-11-26',
  changes: [
    { v: '1.11.1', date: '2026-11-26', notes: [
      'Sudoku: pencil notes are now only marked when that number is already placed in the same row, column or box. The dashed outline that hinted the right number had been crossed out is gone',
    ] },
    { v: '1.11.0', date: '2026-11-25', notes: [
      'Sudoku: new Strategy training: 30 practice positions for each of the 12 techniques, from Full House to Swordfish',
      'Find the step yourself: place the number, or cross off the candidates the technique removes, then Check; Show why walks you through it',
      'Training tracks each technique, with a mastery meter (5 right first time in a row), Mixed review, and a Sudoku Training tile on the home screen',
      'Sudoku: with Show mistakes on, pencil notes that clash with a placed number turn red, and a square whose notes have lost the right number gets a dashed outline. These are never counted as mistakes',
      'Game menus no longer squash their options on small screens',
    ] },
    { v: '1.10.0', date: '2026-11-25', notes: [
      'Sudoku: new Learn mode: go through the rules and all 12 techniques step by step without starting a puzzle',
      'A new "Learn Sudoku" tile on the home screen, plus a Learn Sudoku entry in the Sudoku menu and the New puzzle screen',
      'Learn tracks what you have worked through, with ticks and a progress bar, and a Next topic button takes you straight on',
      'A new short lesson, The basics, explains the three Sudoku rules and solves one square for you',
    ] },
    { v: '1.9.0', date: '2026-11-23', notes: [
      'Sudoku: a new player rating that goes up and down with every puzzle, like a chess rating',
      'Every Sudoku puzzle now has its own difficulty rating, based on the techniques it needs',
      'Your score takes in mistakes, hints, guess-like moves and (a little) how long you took',
      'See which techniques you used after each puzzle, plus a technique profile and rating chart',
      'The level picker suggests the level that suits your rating',
    ] },
    { v: '1.8.1', date: '2026-11-19', notes: [
      'Games now open straight away with no network or a weak signal: before, a page could stay blank for a long time waiting on its fonts',
      'The handwriting and number fonts are now saved on your device, so games look right offline too',
      'With no signal the app no longer waits on every file before using its saved copy',
    ] },
    { v: '1.8.0', date: '2026-11-18', notes: [
      'Trellis practice: 29 more mini crosswords, bringing Practice up to 109 puzzles',
    ] },
    { v: '1.7.1', date: '2026-11-18', notes: [
      'Trellis: the squares no longer change shape as you type; every square stays the same size whatever letter goes in it',
    ] },
    { v: '1.7.0', date: '2026-11-18', notes: [
      'Trellis: new Practice mode with 80 extra mini crosswords, played in a shuffled order and kept apart from the daily puzzle and its streak',
      'Trellis practice options: auto-check wrong letters as you type, and starter letters (a few squares or the first letter of every word)',
      'Trellis: choose whether typing skips filled squares, and hide the timer if you prefer',
      'Trellis practice keeps its own statistics, including clean solves and your best clean time',
    ] },
    { v: '1.6.0', date: '2026-10-25', notes: [
      'Chess Trainer and Go Trainer: every level now starts with a short lesson: the idea, pictures of it on the board, and a worked example from the level\'s own drills',
      'The lesson appears the first time you start a level (or one of the opening lessons); after that, the Lesson button on the level brings it back',
    ] },
    { v: '1.5.2', date: '2026-10-24', notes: [
      'Chowka Bara: restarting during the computer\'s turn no longer carries its throw or move into the new game',
    ] },
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
