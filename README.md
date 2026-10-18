# Paper Games

Hangman, Sudoku, Five Letters, Chess, Word Trail, Four Groups and Snake on graph paper, built as an installable web app for iPhone, Android and desktop. It is plain HTML, CSS and JavaScript with no build step, and works offline after the first visit.

**Play:** https://hms-cap.github.io/hangman/

## Install
**iPhone and iPad**
1. Open the link above in **Safari**.
2. Tap **Share**, then **Add to Home Screen → Add**.

**Android**
1. Open the link above in **Chrome**.
2. Tap the **⋮** menu, then **Install app** (or **Add to Home screen**) **→ Install**. Chrome may also show an **Install app** button on the home page.

Either way it opens full-screen from its own icon. The install steps on the home page hide themselves once the app is installed.

## Games

### Hangman
- 1,335 words and phrases in 22 categories, including animals, countries, capitals, space, mathematics, technology and food
- Play any category or pick one from the category label
- Hint reveals a letter at the cost of one guess
- Recently played words are skipped so they don't repeat
- Tracks wins, losses, the current streak and your best streak

### Sudoku
- 4,000 puzzles: 1,000 each at Easy, Medium, Hard and Expert
- Every puzzle has exactly one solution and is graded by the solving techniques it needs:
  - **Easy:** singles only
  - **Medium:** adds pointing/claiming and pairs
  - **Hard:** adds triples/quads, X-Wing and XY-Wing
  - **Expert:** needs more than that
- Replayed puzzles are shuffled (digits relabelled, rows and columns permuted), so they look new while keeping the same difficulty
- Notes (pencil marks), with an option to fill in all notes
- Undo and redo
- Hints
- Erase
- Mistake checking, with an optional three-mistake limit (each wrong number in a square counts once, so putting it back after undo or erase isn't a new mistake)
- Highlights for the selected row, column and box, and for matching numbers
- Count of how many of each number are left
- Timer with pause; the game pauses automatically when you leave the app
- Auto-save, so you can continue where you left off
- Per-level stats: solved, best time and average time
- Play a specific puzzle by its number
- Keyboard controls: `1–9`, arrow keys, `Backspace`, `N` for notes, `H` for hint, `P` to pause, `Ctrl/Cmd+Z` to undo

### Five Letters
A five-letter word-guessing game in the style of Wordle.
- **Daily** mode: one word a day, the same for everyone, numbered from No. 1 on 14 October 2026. The 2,139 hand-picked answers last almost six years before repeating.
- **Practice** mode: unlimited random words, with separate stats
- 6,486 accepted guesses, from the Hunspell en_US dictionary plus the answer list
- Correct scoring for repeated letters
- Hard mode
- High-contrast colors
- Stats with guess distribution and streaks
- Share your result as an emoji grid
- Countdown to the next daily word
- Saves progress

### Chess
- Play the computer at five strengths (Beginner, Casual, Intermediate, Advanced, Expert) as White, Black or a random side, or two players on one phone
- Full rules: castling, en passant and promotion with a piece picker
- Draws by stalemate, threefold repetition, the fifty-move rule and insufficient material
- Tap-to-move or drag, with legal-move dots, last-move and check highlights, and coordinates
- Undo, hints (an arrow shows a suggested move), flip board, resign, and offering the computer a draw
- Move list in standard notation; tap a move to look back at that position
- Copy the game as PGN to analyze it elsewhere
- Saves the game in progress and your win–draw–loss record at each level
- The engine is written for this app: alpha-beta search with a transposition table, quiescence search, null-move pruning and late-move reductions. It runs in a Web Worker so the board never freezes. The move generator passes the standard perft test positions.
- Original pencil-outline piece set drawn for this app
- **Game analysis** after any finished game (Analyze game on the result screen, or in More): every move by both sides is graded Best to Blunder with a plain-words comment; an evaluation graph you can tap or drag to jump through the game; accuracy and inaccuracy/mistake/blunder counts for each side; red and green arrows for the move played and the better one; step buttons and Next mistake. It runs on both engine workers (about 15 seconds for a 30-move game), fills in as it goes and is saved with the game
- **Tutor mode** (switch it on when starting a game, or from More): after each of your moves a coach card grades it (Best, Excellent, Good, Inaccuracy, Mistake, Blunder) and says why in plain words — a piece left hanging, a fork, a mate you allowed or missed — and names a better move and what it does
  - **Show better move** jumps to the position before your move with arrows for what you played and what was better; **Take back** lets you try again
  - Warns you about threats before you move: pieces that can be won and mate-in-one threats, with arrows on the board
  - Marks your moves `?!`, `?` and `??` in the move list (tap one to read its comment again) and shows a summary when the game ends
  - Reviews run in a second Web Worker, so the computer's reply is never slowed down. Tutor games don't count toward your record

### Chess Puzzles
- Positions mined from engine self-play right after a blunder: find the move that wins
- Mate in 1, 2 and 3 (checked with an exact mate solver: the key move is the only one, and no shorter mate exists) and winning material (the best move must beat every alternative by at least 1.5 pawns, and the material can't be won straight back)
- Any move that still forces mate is accepted, not just the stored line
- Adaptive puzzle rating that serves puzzles near your level; hints and "show solution" count as misses
- Filter by Mate in 1/2/3, Win material, Forks or Sacrifices; stats with a rating chart
- Opens on the **Daily** puzzle (No. 1 = 17 Oct 2026; one tile on the home page under Today), the same for everyone: easiest on Monday, hardest on Sunday (the set is split into seven rating bands, one per weekday, so it runs about 16 months before repeating)
  - Three tries: a wrong move costs one, three ends the day and plays out the solution. Hints are allowed and show up in the shared result
  - Separate stats and streak (it counts toward the home-page streak), share your result as `🟥💡✅`, countdown to the next one. It doesn't change your puzzle rating
  - **Practice** mode is the rated, filterable set described above
- Regenerate with `node tools/generate-chess-puzzles.js 500` and check with `node tools/verify-chess-puzzles.js`

### Word Trail
A letter-grid word search in the style of Squares.
- Swipe through neighboring letters (diagonals included) to spell words of 4 to 8 letters, or tap letters and tap the last one again to enter
- Find every target word to finish the grid; each tile shows how many target words still pass through it, and inks in at zero
- Target words are everyday words (5,843 hand-reviewed); 53,000+ other words from the Hunspell dictionary count as bonus words
- **Daily** grid (No. 1 = 16 Oct 2026; 730 pre-made grids), the same for everyone, with streaks and a countdown
- **Practice**: unlimited fresh 4×4 or 5×5 grids made on the phone
- Every grid is checked so all tiles are covered by target words and at least one longer word is hidden
- Rotate the grid a quarter-turn at a time (letters stay upright) to spot new words; the rotation is saved
- Hints show the first three letters of a word and outline those tiles, numbered, on the grid
- Share your result, saves progress

### Four Groups
A word-grouping puzzle in the style of Connections.
- Sixteen words hide four groups of four; pick four and submit, with four mistakes allowed and a "One away" nudge
- **Three levels.** Easy uses plain categories (fruits, dog breeds, metals) with no decoys. Medium adds phrases such as "___ ball" and synonyms, with one or two decoy words that seem to fit two groups. Hard adds wordplay (hidden words, anagrams, sound-alikes, palindromes) and two to four decoys
- **Hints:** the first names the easiest group you haven't found, the next two mark one and then two of its words. Hints are counted and shown in the shared result
- **Daily** puzzle at each level (No. 1 = 16 Oct 2026), the same for everyone, with a day streak (solve at least one level), a countdown and stats by level
- **Practice**: unlimited new puzzles at each level, plus every past daily and the 40 hand-written classics (Medium and Hard)
- Puzzles are built on the phone from a bank of 157 categories (`groups-bank.js`) by `groups-core.js`: it picks categories by level, places decoys, and keeps a puzzle only if an exact solver finds exactly one way to split the words. Hidden words, anagrams and palindromes are checked against every word on the board, so an accidental one is always known
- `node tools/check-groups.js` checks the bank (and uses the system Hunspell dictionary to find compound words a "___ ball" style list is missing), builds 300 puzzles per level and two years of dailies, and prints samples
- Shuffle, deselect, share your result as colored squares, saved progress

### Snake
The classic: steer the snake to the apples, grow with each one, and don't hit the walls or your own tail.
- Swipe anywhere to turn (one finger can make several turns), or use the on-screen arrow buttons; arrow keys or `WASD` on a keyboard
- Turns are buffered, so a quick double swipe around a corner isn't lost, and a reverse turn into your own neck is ignored
- Smooth movement between squares, drawn as a blue-pencil line on the graph paper
- **Board:** Small (12×12), Medium (16×16) or Large (20×20). **Speed:** Slow, Normal or Fast, with an option to speed up a little with every apple
- Optional wrap-around edges instead of walls
- Best score kept for each board, speed and edge combination, plus games played, apples eaten and longest snake
- Pauses automatically when you leave the app and saves the game, so you can continue later (the home tile shows where you left off)
- Keyboard: `Space` or `P` to pause, `Enter` to play again

## Files
| File | What it is |
| --- | --- |
| `index.html` | Home screen |
| `hangman.html`, `words.js` | Hangman game and word list |
| `sudoku.html`, `puzzles.js` | Sudoku game and puzzle set |
| `fiveletters.html`, `fivewords.js` | Five Letters game; answers in daily order plus extra accepted guesses |
| `chess.html`, `chess-core.js`, `chess-worker.js`, `chess-tutor.js`, `chess-pieces.js` | Chess page; rules and engine; engine worker; tutor (move grading and threat spotting); piece drawings |
| `trail.html`, `trail-core.js`, `trailwords.js`, `trail-daily.js` | Word Trail page; solver and grid generator; packed dictionary; daily grids (`tools/generate-trail.js`) |
| `groups.html`, `groups-bank.js`, `groups-core.js`, `groups-data.js` | Four Groups page; category bank; puzzle generator and solver; hand-written classics |
| `chess-puzzles.html`, `chess-puzzles.js`, `chess-daily.js` | Chess Puzzles page; its verified puzzle set; which puzzle is the daily one |
| `snake.html` | Snake game |
| `paper.css` | Shared look and colors (light and dark) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Offline support and home-screen install |
| `tools/` | Puzzle generator and grader (Node.js) |

## Regenerating the Sudoku puzzles
```sh
node tools/generate-sudoku.js 1000 1000 1000 1000   # easy medium hard expert
```
This rewrites `puzzles.js`. After changing any file, bump `CACHE` in `sw.js`. The service worker fetches fresh files whenever the phone is online (falling back to the saved copy offline or after 3 seconds) and pages reload once when a new version takes over, so installed copies show updates on the next open.

## Testing the chess engine
```sh
node tools/test-chess.js
```
Runs the standard perft positions (move generation must match known node counts exactly), notation and draw-rule checks, a few tactics puzzles and a short Expert vs Beginner match.

`node tools/test-chess-tutor.js` checks the tutor: blunders that allow mate, missed mates, hanging pieces, sound moves graded as sound, and threat warnings.

## Measuring the chess levels
```sh
node tools/elo-match.js 1-2:40,2-3:40,3-4:30,4-5:24 results.json   # pairings:games
node tools/elo-fit.js results.json
```
`elo-match.js` plays the strength levels against each other from balanced openings, both colors, each side with its own search memory. `elo-fit.js` fits a rating per level with bootstrap error bars. The 16 Oct 2026 run is saved in `tools/elo-results-2026-10-16.json`.
