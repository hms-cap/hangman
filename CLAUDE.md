# Paper Games: notes for making changes

## Versioning (do this for every change)
The app shows its version on the home screen's About tab. Every change that ships bumps it:
- a fix: 1.0.0 → 1.0.1; a new feature or a game change: → 1.1.0; a big overhaul: → 2.0.0
- in `version.js`: set `version` and `date`, and add a new entry at the top of `changes` with one short line per change, in plain words for players
- in `sw.js`: set `CACHE` to `'paper-games-v' + the same version` (this is what makes installed copies update)
- run `node tools/check-version.js` before committing
Several changes made together in one sitting can share one version.
