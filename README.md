# Paper Games

Hangman, Sudoku, Stelium, Chess, Chess Trainer, Go, Go Problems, Go Trainer, Tendril, Clover, Trellis (mini crossword), Snake and Chowka Bara on graph paper, built as an installable web app for iPhone, Android and desktop. It is plain HTML, CSS and JavaScript with no build step, and works offline after the first visit.

**Play:** https://hms-cap.github.io/hangman/

The home page has three tabs: **Casual** (the word dailies, Sudoku, Hangman, Snake, Chowka Bara), where it always opens, then **Chess** (Chess Puzzles daily, Chess, Chess Trainer) and **Go** (Go Problems daily, Go, Go Trainer). The **About** button above the tabs shows what the app is, its version and what's new. `#chess`, `#go` or `#about` in the address opens those tabs, and a dot marks a tab whose daily puzzle is still waiting. Swipe left or right anywhere on the page to move between tabs; the page follows your finger and goes round and round (Go → Casual and back).

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
- A results screen after each word: the answer, your record, Next word (or press Enter), Change category
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
- Hints: tap Hint to choose **Teach me how**, **Just show me a number** or the **Technique guide**
- **Teach mode** (switch it on from the Hint sheet or Settings, then Hint always teaches): a coach card replaces the number pad and walks through the next logical step on the board, one tap at a time, then writes the number in or crosses off the candidates for you
  - The board shows the reasoning: the houses involved are shaded, the numbers that rule squares out are circled with lines along their rows and columns, blocked squares are hatched, candidates in the pattern are circled in blue, candidates being removed are struck through in red, and patterns (pairs, X-Wings, XY-Wings, Swordfish) are joined with lines
  - The coach always picks the simplest step available, from Full House, Hidden Single and Naked Single through Pointing, Claiming, Naked/Hidden Pairs and Triples to X-Wing, XY-Wing and Swordfish. A wrong number on the board is pointed out first. When a position needs something harder (some Expert puzzles), it says so and reveals one square
  - Each lesson counts as a hint; candidates the coach crosses off are remembered and respected by Fill in all notes
- **Technique guide** (from Hint or More): each technique demonstrated on an example board taken from the puzzle set, without touching your game or timer
- Erase
- Mistake checking, with an optional three-mistake limit (each wrong number in a square counts once, so putting it back after undo or erase isn't a new mistake)
- Highlights for the selected row, column and box, and for matching numbers
- Count of how many of each number are left
- Timer with pause; the game pauses automatically when you leave the app
- Auto-save, so you can continue where you left off
- Per-level stats: solved, best time and average time
- Play a specific puzzle by its number
- Keyboard controls: `1–9`, arrow keys, `Backspace`, `N` for notes, `H` for hint, `T` to teach, `P` to pause, `Ctrl/Cmd+Z` to undo

### Stelium
A five-letter word-guessing game in the style of Wordle. The name comes from *stellium*, a cluster of stars. Five letters, five points: the stats sheet and the home tile show a five-pointed star whose points take the colour of each letter's best result so far.
- **Daily** mode: one word a day, the same for everyone, numbered from No. 1 on 14 October 2026. The 2,139 hand-picked answers last almost six years before repeating.
- **Practice** mode: unlimited random words, with separate stats
- 6,486 accepted guesses, from the Hunspell en_US dictionary plus the answer list
- Correct scoring for repeated letters
- Hard mode
- **Tide-pool look**: deep-sea blue for the right spot, coral for the wrong spot, wet sand for letters not in the word, pebble keys on a sand bank, and the sea at night in dark mode. High-contrast colors (orange and blue) is still a setting
- **Live starfish** above the board: an arm turns blue the moment you find that letter's spot ("3 of 5 arms found")
- **Win**: the starfish spins and sparkles. **Loss**: the tide washes over the board and leaves the word written on the sand (tap it for the stats)
- **Stats as a night sky**: every win is a star in its 1–6 guess column, this game's win shines gold, and your current streak is joined up as a constellation (streaks started before this version join up from here on)
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

### Chess Trainer
Short drills that build the skills you use to calculate in real games, plus a beginner course that teaches the rules from scratch. Its own tile on the home screen (and linked from Chess: "New to chess? Learn how the pieces move" on the new-game screen, and Learn the moves in its title menu).
- **Learn the moves** (beginners, 7 levels): the rook, bishop, queen, king, knight and pawn, then Capture them all. Each drill is a star hunt for one piece within a move limit (the fewest moves plus a little slack). The board always dots every square the piece can reach, and tapping a square it can't reach says why: "A bishop stays on its own colour", "Something is in the way. The rook can't jump over pieces", "A pawn only moves diagonally when it captures". Later drills add obstacles (your own pieces) and black pieces to capture; the knight is boxed in so it has to jump; pawn drills show the double step and need diagonal captures to change file. Every drill is solved by an exact shortest-route search, and a miss shows the shortest route
- **Check, mate & special moves** (beginners, 5 levels): give check; get out of check, each time by a named way (move the king, capture the attacker, block), with the checking piece circled; checkmate in one on simple boards (back-row mates and queen mates); castling kingside, queenside, and "on the side where it's allowed" with the reason the other side isn't (a piece in the way, or the king would cross an attacked square); promotion to a queen and en passant with Black's double step shown. Every answer is explained in plain words, with the chess notation (+, #, O-O)
- The drills below assume you know the rules. Groups of levels; passing a level (for example 8 of 10) unlocks the next, with up to three stars and your best score kept per level. Every try brings new positions.
- **Mastery**: three stars (every drill right first time) marks a level *Mastered* in gold on the map. Levels can be replayed as often as you like. At the end of each level you choose what's next: until a level is passed, Try again; once passed, Next level (or the next group, or the next step of your path) is offered, but Try for mastery stays the main button until the level is mastered, after which moving on becomes the main button.
- **Chess course:** four paths that run through the whole trainer in order. Beginner has 16 steps (the moves, the rules, first mates), Improver 10 (loose pieces, counting, forks, rook mate, 1.e4 openings and traps, mate in 2), Club player 12 (pins and skewers in busy positions, pawn endings, 1.d4 openings, batteries, harder mates) and Advanced 5 (combinations, holding the draw, mate in 3, naming openings). Together they cover every level once. The "Your path" panel at the top of the trainer shows the next step; a path opens its own steps whatever the group locks say, and a level passed anywhere counts. Each path ends with an 8-drill checkpoint (pass with 6) that suggests the next path. A 10-drill placement test in four tiers suggests where to start. The home tile shows where you are in your path
- **Openings:** 41 main lines across 25 openings for both colours (1.e4 as White: Italian, Evans, Ruy Lopez including the Berlin and Exchange, Scotch, King's Gambit, Vienna, Four Knights, and against the Sicilian, French and Caro-Kann; facing 1.e4: Najdorf, Dragon, Taimanov, Alapin, Winawer, French Advance and Tarrasch, Caro-Kann Classical and Advance, Scandinavian, Pirc, Alekhine, Petrov, Two Knights, Marshall; 1.d4 and flank openings: Queen's Gambit Declined and Accepted, London, Catalan, English, Réti; facing 1.d4: Slav, QGD Tartakower, King's Indian, Nimzo-Indian, Grünfeld, Queen's Indian, Dutch Leningrad). Play your side from memory with the idea behind every move (Hint shows the idea without giving the move; a wrong move is taken back and the book move explained), name the opening from its first moves and name the variation deeper in (both optional: always open, and not needed to unlock other levels), and punish 18 classic traps (Legal's mate, Elephant trap, Lasker trap, Noah's Ark, Monticelli trap, Siberian trap, Fishing Pole, Blackburne Shilling and more). Every book move is checked by the engine so none simply loses material, and every trap's refutation is the engine's best move
- **One opening at a time:** under each of the four repertoire levels, a lesson for each named opening (31 in all), open as soon as its level is: the Italian Game, the Ruy Lopez, "Against the Sicilian Defence" and so on. A lesson plays that opening's lines, then any classic trap from it where you are the side that punishes (the Fishing Pole and Noah's Ark in the Ruy Lopez, the Elephant trap in the Queen's Gambit Declined, the Stafford trap in the Petrov…). Lessons keep their own stars and mastery; at the end you choose the next opening or, after the last one, the level's own test, which mixes them all
- **Knight & board vision:** knight to a flag in the fewest moves (short hops, long routes, then avoiding every square a black piece or pawn guards); knight tours that take every pawn in the fewest moves, where the nearest-first order usually isn't best; spotting which black pieces can be won (take it and stay ahead after the recaptures), on a light and then a busy board
- **Forks, pins & skewers:** 420 positions: knight forks, forks by any piece, pins, skewers, all three mixed in busy positions (60 each), and 120 two-move combinations. In a combination a decoy sacrifice the king must take, a check that drives the king onto a line, or a capture that removes a defender sets up a fork, pin or skewer; each try of eight rotates through these kinds. Each position is built around the motif and checked by the engine: one move (or two or three equivalent ones, such as pinning from either of two squares) wins material and nothing else does. After the answer, a plain explanation names the pieces involved: "Ng7+ forks the king on f5 and the rook on h5. After Kg6, Nxh5 wins the rook."
- **Endgame technique:** the rule of the square; mate with king and queen, and with king and rook, within a move limit; king and pawn against king, winning with the opposition and key squares, and holding the draw as the defender. The other side plays perfectly from exact endgame tables, and the moment a move throws a win away (or loses a draw) the trainer says so and shows the move that kept it
- **Checkmates & counting:** mate in 1, 2 and 3 from the Chess Puzzles set; counting exchanges (who comes out ahead after all the sensible recaptures), first simple, then with batteries, x-rays and pinned defenders. The answer plays the exchange out with a running score
- Three tries per drill: after a wrong attempt the trainer says why it failed without giving the answer away (the engine's best reply to a wrong tactic or mate move, what a wrong opening choice really is, which piece guards a square, why a pawn-ending move lets Black draw), takes the move back and offers Try again or Show the answer. A drill solved on the second or third try counts toward passing; three stars need every drill right first time. Two-choice questions and the placement test give one try, and running out of time on the speed clock is final
- Hint on every drill (a drill solved with a hint doesn't count toward passing); misses show the solution on the board
- Optional speed clock in Settings: each drill gets a time limit, and running out counts as a miss
- Tips for each level, such as how to draw the square or how the rook boxes in the king

### Go
- 9 × 9 and 13 × 13, against the computer or two players on one device
- Five computer strengths, from Beginner to Expert: a Monte Carlo tree search with RAVE whose playouts answer ataris anywhere on the board; it runs in a Web Worker, with time limits so 13 × 13 stays quick on a phone. The stronger levels beat the weaker ones (tested by self-play)
- Handicap stones (2 to 6) when you play Black; komi 7.5, or 0.5 with handicap
- Rules: captures, no suicide, ko and superko (a move may not repeat an earlier position)
- Area scoring: after two passes the app marks the stones it thinks are dead (from hundreds of playouts) and shows each side's territory; tap a group to change it, then confirm, or keep playing
- Tap twice to place a stone (on by default for 13 × 13, so a slightly-off tap doesn't cost a move), coordinates, undo, a hint, "Who's ahead" (a score estimate shown as territory on the board), resign
- **Tutor mode:** each of your moves is graded (Best, Good, Inaccuracy, Mistake, Blunder) against the computer's search, with the reason in plain words: stones left in atari, a group in atari that could have escaped, a missed capture, filling your own eye, a small edge move early on, a slow move next to a safe group, or the winning chances after your move and the better one. Before you move it rings your stones in atari and enemy stones you can capture. Show the better move, or take yours back. Tutor games don't count toward your record
- Your record against each strength on each board size

### Go Problems
Tsumego on a 9 × 9 board, Black to play: capture (atari, ladders, nets, throw-ins, snapbacks), save stones, kill, and live.
- Every problem is built and checked by a solver (`go-solver.js`): the listed first moves are the only ones that work, moving second would fail, and no ko is involved
- Any correct move is accepted, not just the stored one: the solver judges each move as you play it and answers with White's strongest defence
- A wrong move shows White's refutation and says why it fails (the stones escape with three liberties, White captures your stone, White makes two eyes…); three tries per problem
- **Walk through it:** once a problem is solved or its solution shown, step through the solution on the board: the start, each move (numbered and ringed, with the marked stones' liberties dotted, red when only one is left, and captured stones dotted), the result and the idea behind it, and finally your own wrong try if you had one. Captions come from what happens on the board: captures, ataris, liberties gained and lost, sacrifices, the vital point. Tap the board or Next step to go on
- **Glossary:** the ? button, the hint ("New to this? See snapback") and the underlined words in every explanation open an illustrated glossary: liberty, group, atari, capture, suicide and self-atari, eyes, ko, ladder, net, snapback, throw-in and the vital point. Each term has small diagrams built by playing the moves on a real board; the techniques use a real problem from the set, shown at the start, as a numbered sequence and as the result
- **Daily** problem (No. 1 = 20 Oct 2026), the same for everyone, easiest on Monday and hardest on Sunday; streaks, share and a countdown. It isn't part of the home page streak
- **Practice**: rated problems picked near your rating (Elo; a first-try solve without a hint counts as a win), filters by kind, stats by kind
- Hint, show the solution (played out move by move), numbered moves on the board

### Go Trainer
A course from the rules to life and death, 18 levels in four groups; pass a level to open the next, with up to three stars.
- **Mastery** works as in the Chess Trainer: three stars marks a level *Mastered*, any level can be replayed until it is, and the end-of-level sheet lets you choose between Try for mastery and Next level (or the next group) once a level is passed.
- **Learn the rules:** liberties (tap them all), capture, escape from atari, where you may play (suicide, captures that only look like suicide, ko), and counting a finished game by area
- **Capturing techniques:** chasing, ladders, nets, throw-ins, snapbacks, and a mix
- **Saving stones** and **Life and death:** killing and living in small and bigger corners, then a mix
- Every drill allows three tries and explains each wrong answer; the technique levels use the checked problems from Go Problems
- The same illustrated glossary as Go Problems: the ? button, and the underlined terms in level descriptions, tips, drill prompts and explanations (closing it returns to the sheet it was opened from)

### Tendril
A letter-grid word search in the style of Squares. Each word you trace is drawn as a vine that leafs out between letters, and the vine on the home tile and stats sheet grows as you find the words.
- Swipe through neighboring letters (diagonals included) to spell words of 4 to 8 letters, or tap letters and tap the last one again to enter
- Find every target word to finish the grid; each tile shows how many target words still pass through it, and inks in at zero
- Target words are everyday words (5,843 hand-reviewed); 53,000+ other words from the Hunspell dictionary count as bonus words
- **Daily** grid (No. 1 = 16 Oct 2026; 730 pre-made grids), the same for everyone, with streaks and a countdown
- **Practice**: unlimited fresh 4×4 or 5×5 grids made on the phone
- Every grid is checked so all tiles are covered by target words and at least one longer word is hidden
- Rotate the grid a quarter-turn at a time (letters stay upright) to spot new words; the rotation is saved
- Hints show the first three letters of a word and outline those tiles, numbered, on the grid
- Share your result, saves progress
- **Every word you find blooms**: the vine stays for a moment and a random flower or fruit grows at its end (daisy, sunflower, cherry blossom, tulip, rose, violet, cherries, apple, strawberry, lemon, grapes or orange), with buds opening along it: pink for target words, yellow for bonus words

### Clover
A word-grouping puzzle in the style of Connections. Four groups, four leaves: each group you find adds a leaf, in its colour, to the clover beside the mistakes counter, on the stats sheet and on the home tile.
- Sixteen words hide four groups of four; pick four and submit, with four mistakes allowed and a "One away" nudge
- **Three levels.** Easy uses plain categories (fruits, dog breeds, metals) with no decoys. Medium adds phrases such as "___ ball" and synonyms, with one or two decoy words that seem to fit two groups. Hard adds wordplay (hidden words, anagrams, sound-alikes, palindromes) and two to four decoys
- **Hints:** the first names the easiest group you haven't found, the next two mark one and then two of its words. Hints are counted and shown in the shared result
- **Daily** puzzle at each level (No. 1 = 16 Oct 2026), the same for everyone, with a day streak (solve at least one level), a countdown and stats by level
- **Practice**: unlimited new puzzles at each level, plus every past daily and the 40 hand-written classics (Medium and Hard)
- Puzzles are built on the phone from a bank of 157 categories (`groups-bank.js`) by `groups-core.js`: it picks categories by level, places decoys, and keeps a puzzle only if an exact solver finds exactly one way to split the words. Hidden words, anagrams and palindromes are checked against every word on the board, so an accidental one is always known
- `node tools/check-groups.js` checks the bank (and uses the system Hunspell dictionary to find compound words a "___ ball" style list is missing), builds 300 puzzles per level and two years of dailies, and prints samples
- Shuffle, deselect, share your result as colored squares, saved progress

### Trellis
A 5 × 5 mini crossword, one a day. The grid is a garden trellis: words cross like its slats.
- Tap a square to choose it; tap it again (or tap the clue) to switch between Across and Down. The arrows beside the clue step through the clues, and the list button shows them all
- An on-screen keyboard, so the phone's own keyboard never covers the grid; typing moves through the word and then on to the next clue with a gap. A hardware keyboard works too (arrows, Tab for the next clue, space to switch direction)
- A timer that only runs while the puzzle is on screen
- **Check** a square, word or the whole grid (wrong letters are crossed out in red pencil; right ones stay in blue and lock) or **Reveal** them (marked with a red corner). A solve without either is a clean solve
- **Daily** puzzle (No. 1 = 24 Oct 2026), the same for everyone, with a day streak that counts toward the home screen's flame, a countdown and stats (best clean time, average time, clean solves). Every earlier daily can be played from **Past puzzles**
- Share your time and a picture of the grid as coloured squares
- The puzzles are in `mini-data.js`: 62 grids made by `node tools/generate-mini.js` from Tendril's everyday words (no plurals, nothing obscure or grim), each word with one hand-written clue. They repeat after No. 62; add more by running the generator, pasting the new grids at the end and writing clues for the words it lists. `node tools/check-mini.js` checks every word has a clue, no clue gives away an answer in its grid, and no grid repeats

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

### Chowka Bara
The traditional Indian race game (also called Chowka Bhara or Ashta Chamma) for two players on one phone or against the computer, with four cowry shells you tap to throw.
- 5×5 board with crosses on the safe squares (the middle of each edge and the centre). Each player has four pawns that start on their home cross, go round the outer ring anticlockwise, then the inner ring clockwise, then into the centre
- **Cowries:** count the shells lying mouth up. 1, 2 or 3 moves that many; all four up is **chowka (4)** and none up is **bara (8)**, and both earn another throw. The shells tumble and land with the toothed slit up or the speckled back up
- **Shake:** tap the shells to throw at once, or hold **Shake** to rattle them in your hands first. The shells bounce around the mat, spin, hop and flip over (harder the longer you hold, and they follow your finger), then fly up, bounce and settle when you let go. The press, any movement and the exact moment you let go are stirred into the throw on top of the phone's secure random numbers, so your hand sets the result while every shell stays an even chance (checked over 40,000 throws). The computer shakes before its throws too
- All the throws of a turn are spent one at a time: pick a number, then tap a pawn. Dashed circles show where each pawn would land, and pawns that can move pulse
- **Pairs (jodi):** two of your pawns on one square can move together on an even throw (2, 4 or 8), each going half of it. Pick the even number and tap **Move pair** (landing spots get a double ring), or just tap the pair when only the pair can use the throw. A moving pair can land on, and capture, the other player's pair. The computer uses pairs too
- **Clocks:** each player's card shows their total time on turn, and the end of the game shows the game time. An optional **turn time limit** (15, 30 or 60 seconds) drains a bar on the active card; when it runs out the game throws or makes a sensible move for that player
- Landing on the other player outside a safe square sends that pawn home and earns another throw. You can't enter the inner ring until you've captured once (a dotted route shows your way round, faded inside until it opens)
- Exact throw needed for the centre; a throw no pawn can use is lost. First to bring all four pawns home wins, and the loser starts the next game
- Options: capture before going inside, pairs move together, pairs can't be hit (a single pawn can't land on two of the other player's pawns), three chowkas or baras in a row lose the turn, show the route, and **face to face**, which turns the shells toward the top player on their turn when the phone lies flat between you
- **Vs computer** at three levels (the computer plays Red and throws its own shells, pausing so you can see which throw it uses and where):
  - **Easy** often just moves something
  - **Medium** picks the best single move and avoids leaving pawns where they can be hit
  - **Hard** plans how to spend all of a turn's throws together, then weighs every likely reply: it works out the chance of each pawn being hit from the cowry odds and assumes you answer well
  - In computer matches Medium beats Easy about 88% of the time and Hard beats Medium about 63% (dice games always leave room for luck); `node tools/chowka-match.js` plays the levels against each other
  - Your won–lost record is kept for each level
- Player names, wins on this phone, a How to play summary, and the game saves itself
- Rules and the computer player live in `chowka-core.js`; `node tools/test-chowka.js` checks the rules, plays 3,000 random games to make sure every game ends, and checks that the computer only makes legal moves and that each level beats the one below

## Getting around
Every game has a **‹ Games** link back to the home screen, and tapping the **game's title** opens its menu:
- **Back to all games**, with the game in progress saved, and **Switch game** to jump straight to any other game
- The game's own **restart and quit** options, for example Restart this puzzle, New word, Give up (shows the answer), Resign, End this game or Quit this game. Anything that throws away progress or counts as a loss asks for a second tap first. Daily puzzles can be given up but not restarted, so a daily result can't be replayed
- Every game's end screen (Hangman, Sudoku, Snake, Chess, Chowka Bara and the daily puzzles' results) has **Up next**, which goes straight to the next of today's daily puzzles you haven't finished, and **Back to all games**. Once all four dailies are done, the daily results say so and the other games just show Back to all games
- While the menu is open the game is paused (Sudoku's timer, Snake, Chowka Bara's clocks and computer player) and keys don't reach the game

## Players
Up to 5 people can share the app on one device. A player is just a name and a color, no password.
- **First open** asks for a name. Any progress already on the device becomes that first player's
- **Each player has their own everything**: games in progress, stats, streaks, daily puzzles, trainer progress and settings
- **Color**: 8 to pick from, one per player. It becomes the player's pencil (the blue-pencil color used across the games) and tints the paper and its grid, in light and dark mode, so it's clear at a glance who's playing
- **Switching**: tap the badge at the top of the home screen, or **Switch player** in any game's menu. Picking someone else always shows a confirmation screen (Switch to Maya?) before the page reloads as them; the current player's game stays saved
- **Edit** (pencil icon) renames or recolors a player. **Remove** asks for a second tap and deletes that player's saves from the device; the player who's playing now can't be removed

## Time played
The app keeps a simple record of how long each player spends in it.
- **Today's time** shows under the greeting on the home screen (all games) and in small type under each game's title (that game)
- **Tap either one** for the Time played sheet: today against the last week's daily average, a bar per day (7 days, or 30 for the longer periods), time per game, and facts for the period (total, days played, average on days played, longest day, the time of day you usually play, and visits)
- The clock runs only while the app is on screen and in use: it stops when you leave the app or after 5 minutes without a tap. A new visit starts after a 30-minute break
- It's kept per player, like the other saves, under `playtime` (a year of days, each with the total and the time per game and per hour). `PlayTime.day()` and `PlayTime.days()` read it for anything else in the app that wants to use it

## End-of-game moments
Every game ends with a short animation in its own theme (`celebrate.js`, drawn on one full-screen layer that never blocks taps):
- **Hangman**: one of several endings, picked at random (never the same twice running). Solve the word and the figure is freed, in your pencil colour: it hops, waves and walks off the page whistling; floats away on balloons spelling the word; or the gallows becomes a swing and it swings. Run out of guesses and a pink eraser scrubs the figure out, or the page becomes a chalkboard and a duster wipes it away
- **Sudoku**: a gold wave across the grid and pencil digits flying off it ("Flawless!" with no mistakes or hints); out of mistakes, red digits drop
- **Stelium**: the starfish spins, with stars and rising bubbles; a loss brings the tide in
- **Tendril**: vines climb up the screen and leaves burst from the grid
- **Clover**: four-leaf clovers shower down in the group colours, with fireworks for a perfect game; a loss drops a few wilted leaves
- **Trellis**: a gold wave across the grid, leaves and petals flung out and drifting down, fireworks for a clean solve
- **Chess** and **Chess Puzzles**: a gold wave across the squares, crowns, stars and fireworks ("Checkmate!"); a loss drops grey squares
- **Go** and **Go Problems**: ink rings spread across the board and black and white stones scatter; a loss leaves grey ripples
- **Snake**: the snake crumbles into pixels, with fireworks for a new best or a full board
- **Chowka Bara**: a rangoli blooms on the board in the winner's colour and cowry shells shower down
- **Trainers**: stars burst for a pass, fireworks for mastery or a finished path
They play once, when the game ends (not when a finished game is reopened). With reduced motion turned on, only the word shows.

## Version
The version is in `version.js` and shows on the About page (the About button above the home tabs) with a short list of what changed in each version. Every change bumps it (fixes 1.0.x, features 1.x.0) and sets the same number in `sw.js`'s cache name, so installed copies update; `node tools/check-version.js` checks they match. See `CLAUDE.md`.

## Files
| File | What it is |
| --- | --- |
| `index.html` | Home screen |
| `celebrate.js` | End-of-game animations: particles (confetti, stars, digits, leaves, clovers, shells, stones, petals, pixels, bubbles, crowns), ripples, vines, rangoli, a board wave and the big stamp word |
| `version.js` | App version and the What's new list for the About tab |
| `playtime.js` | Time played: the clock, the per-player daily record, the today displays and the Time played sheet |
| `profiles.js` | Players: the player list, switch/confirm/edit screens, each player's color theme, and keeping each player's saves apart (loaded first on every page; prefixes every saved key with the player, except the first player's) |
| `hangman.html`, `words.js` | Hangman game and word list |
| `sudoku.html`, `puzzles.js`, `sudoku-coach.js` | Sudoku game; puzzle set; coach (technique finder and step-by-step lessons for teach mode and the technique guide) |
| `fiveletters.html`, `fivewords.js` | Stelium game; answers in daily order plus extra accepted guesses |
| `chess.html`, `chess-core.js`, `chess-worker.js`, `chess-tutor.js`, `chess-pieces.js` | Chess page; rules and engine; engine worker; tutor (move grading and threat spotting); piece drawings |
| `trail.html`, `trail-core.js`, `trailwords.js`, `trail-daily.js` | Tendril page; solver and grid generator; packed dictionary; daily grids (`tools/generate-trail.js`) |
| `groups.html`, `groups-bank.js`, `groups-core.js`, `groups-data.js` | Clover page; category bank; puzzle generator and solver; hand-written classics |
| `mini.html`, `mini-data.js` | Trellis page; the grids and clues (`tools/generate-mini.js` makes grids, `tools/check-mini.js` checks them) |
| `go.html`, `go-core.js`, `go-tutor.js`, `go-worker.js` | Go page; rules, scoring and the computer player; tutor; worker (`node tools/test-go.js` checks rules, scoring, tactics and the strength ladder) |
| `go-explain.js`, `go-glossary.js` | Go Problems walkthrough captions; the glossary of terms and its diagrams (checked by `tools/test-go-problems.js`) |
| `go-solver.js`, `go-problem.js`, `go-problems-worker.js` | Capture and life-and-death reading; judging a move in a problem and explaining wrong ones; worker (`node tools/test-go-solver.js`) |
| `go-problems.html`, `go-problems-data.js`, `go-daily.js` | Go Problems page; the problem set, made by `node tools/generate-go-problems.js` (resumable; rechecks stored problems); daily schedule (`node tools/test-go-problems.js` plays every problem through) |
| `go-trainer.html`, `go-trainer-core.js` | Go Trainer page; the course and its drills (`node tools/test-go-trainer.js`) |
| `chess-trainer.html`, `chess-trainer-core.js`, `chess-trainer-data.js`, `chess-openings.js` (opening lines, ideas and traps), `chess-endgames.js`, `chess-endgames-worker.js` | Chess Trainer page; drill generators and level map; engine-checked fork, pin, skewer and combination positions (`tools/generate-chess-trainer.js`); exact K+Q, K+R and K+P vs K tables built on first use (about a second) in a worker |
| `chess-puzzles.html`, `chess-puzzles.js`, `chess-daily.js` | Chess Puzzles page; its verified puzzle set; which puzzle is the daily one |
| `snake.html` | Snake game |
| `chowka.html`, `chowka-core.js` | Chowka Bara page; rules (board paths, cowry scoring, moves, captures) and the computer player |
| `paper.css` | Shared look and colors (light and dark) |
| `emblems.js` | The Tendril, Stelium and Clover emblems (title marks, home-tile watermarks, progress pictures) |
| `game-nav.js` | The game menu behind each game's title: back to the games, switch game, restart and quit |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Offline support and home-screen install |
| `tools/` | Puzzle generator and grader (Node.js) |

## Regenerating the Sudoku puzzles
```sh
node tools/generate-sudoku.js 1000 1000 1000 1000   # easy medium hard expert
```
This rewrites `puzzles.js`. After changing any file, bump `CACHE` in `sw.js`. The service worker fetches fresh files whenever the phone is online (falling back to the saved copy offline or after 3 seconds) and pages reload once when a new version takes over, so installed copies show updates on the next open.

## Testing the Sudoku coach
```sh
node tools/test-sudoku-coach.js 100   # puzzles per level
```
Solves puzzles at every level with the coach alone and checks that every number it writes in and every candidate it crosses off agrees with the solution, that every lesson has its text, that wrong numbers are taught first, and that the technique guide finds an example of each technique.

## Chess Trainer data and tests
```sh
node tools/generate-chess-trainer.js 40 chess-trainer-data.js 80   # positions per set, output, minutes
node tools/test-chess-trainer.js 20                                # seeds per level
```
The generator rewrites the file every 30 seconds, so a long run can be stopped at any point. The tests check the endgame tables against known theory (longest K+Q mate 10 moves, K+R 16, opposition positions), generate drills for every level and check each answer independently (shortest knight routes, exchange counts, the rule of the square against the tables), play every endgame drill out with perfect play to make sure it can be won or held in the move limit, and check every stored tactic and mate line.

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
