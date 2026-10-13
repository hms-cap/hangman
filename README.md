# Paper Games

Hangman and Sudoku on graph paper, built as an installable web app for iPhone, Android and desktop. It is plain HTML, CSS and JavaScript with no build step, and works offline after the first visit.

**Play:** https://hms-cap.github.io/hangman/

## Install on iPhone
1. Open the link above in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.

It opens full-screen from its own icon. On Android, open the link in Chrome and choose **Add to Home screen** or **Install app**.

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
- Mistake checking, with an optional three-mistake limit
- Highlights for the selected row, column and box, and for matching numbers
- Count of how many of each number are left
- Timer with pause; the game pauses automatically when you leave the app
- Auto-save, so you can continue where you left off
- Per-level stats: solved, best time and average time
- Play a specific puzzle by its number
- Keyboard controls: `1–9`, arrow keys, `Backspace`, `N` for notes, `H` for hint, `P` to pause, `Ctrl/Cmd+Z` to undo

## Files
| File | What it is |
| --- | --- |
| `index.html` | Home screen |
| `hangman.html`, `words.js` | Hangman game and word list |
| `sudoku.html`, `puzzles.js` | Sudoku game and puzzle set |
| `paper.css` | Shared look and colors (light and dark) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Offline support and home-screen install |
| `tools/` | Puzzle generator and grader (Node.js) |

## Regenerating the Sudoku puzzles
```sh
node tools/generate-sudoku.js 1000 1000 1000 1000   # easy medium hard expert
```
This rewrites `puzzles.js`. After changing any file, bump `CACHE` in `sw.js` so installed copies pick up the update.
