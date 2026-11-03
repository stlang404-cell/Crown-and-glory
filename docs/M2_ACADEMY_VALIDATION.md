# Crown Academy validation report (Gate D)

## Content pipeline

1. **Mining** (`tools/academy/build_puzzles.ts`): every position of 1,408 recorded benchmark games
   (legal games played by the production rules). A position becomes a candidate when, in a depth-3 screen
   of all legal moves, the best move beats the second by ≥ 0.15 expected score; the Crown engine at depth 8
   must confirm a unique best move (gap ≥ 0.20 expected score at s = 200 cp, second move not a winning
   mate); Fairy-Stockfish (development-only reference, depth 16, MultiPV 2) must independently choose the
   same move with a ≥ 150 cp gap or an exclusive mate. In-check positions and plain recaptures on the
   square just captured on are excluded (they are trivial, not puzzles). Lines are extended through the
   engine's best reply while the next player move is again uniquely best (up to 3 player moves). At most
   3 puzzles per source game, with neighbouring plies skipped, to limit correlated items.
2. **Reproducible verification** (`src/academy/verify.ts`, `tools/academy/verify_puzzles.ts`): every
   candidate is re-checked with a fresh transposition table (so the result depends only on position,
   engine build and policy). Result: **500 candidates → 484 shipped, 16 dropped, 3 multi-move lines
   truncated** to their verified prefix (`tools/academy/verification-report.json`).
3. **Tagging**: motif detectors (`src/academy/motifs.ts`) on the solution line — fork, pin, skewer,
   discovered attack, hanging piece, mate threat, promotion, defensive resource (opponent threatens
   ≥ 2 pawns or mate before the move), endgame phase, calculation (≥ 2 player moves), position evaluation
   (quiet unique move without a detected tactic).
4. **Split**: 20% of source games (independence families) are **held out**; their puzzles are only used in
   Held-out Assessments, never in practice. No family appears in both splits (tested).

## Shipped bank (`src/academy/data/puzzles.json`, engine crown-search-1 + crown-eval-3)

| | Count |
| --- | --- |
| Puzzles | 484 (397 training, 87 held-out) |
| Player moves | 1: 376 · 2: 84 · 3: 24 |
| Themes | defensive 264 · endgame 154 · hanging piece 146 · calculation 131 · evaluation 121 · fork 62 · pin 47 · skewer 38 · discovered attack 19 · mate threat 17 · promotion 13 · mate 3 |

Forced-mate puzzles are rare (3) because the corpus comes from engine games that seldom allow mates; this
is a known content gap. Difficulty (1–5) is a **heuristic** (`crown-difficulty-0`: line length, quiet first
move, material investment, engine effort) and is not calibrated on human solvers.

## Modes shipped

| Mode | Content | Status |
| --- | --- | --- |
| Tactical Academy | all training puzzles, optional theme filter, difficulty adapts ±⅓ per clean/failed solve | Playable |
| Puzzle Rush | 3 minutes, 3 strikes, ascending difficulty, runs stored | Playable |
| Calculation Chamber | 94 training puzzles with ≥ 2 player moves; engine plays the verified reply | Playable |
| Defensive Survival | defensive-resource / only-move puzzles | Playable |
| Endgame Workshop | endgame puzzles + “Play it out vs the engine” (untimed training game from the position vs L6) | Playable |
| Replay Your Mistakes | positions from the player's own analysed games with loss ≥ 0.12; moves within 0.02 of the best are accepted | Playable once games are analysed |
| Adaptive Training | themes with the lowest first-try rate (≥ 5 attempts) and coach topics repeated in games (≥ 2 moments) | Playable; mixed themes until evidence exists |
| Held-out Assessment | 10 unseen held-out puzzles per run; items never repeat | Playable (87 items ≈ 8 assessments) |

Every attempt stores puzzle id, mode, split, timestamps, first move, time to first move, total time, hints,
reveal, clean solve and **exposure count**; only first exposures count as evidence anywhere (Lab, theme
stats), so repeated puzzles cannot inflate skill.

## Tests

- `tests/academy.test.ts`: all 484 lines legal; no duplicates; SAN/move counts consistent; split leakage
  check; practice modes never serve held-out items; assessments never repeat and report exhaustion;
  unseen-first selection; repeat exposures ignored by statistics; adaptive gating; **engine re-verification
  of a 12-puzzle sample reproduces the stored gap to 3 decimals**; motif detector fixtures.
- `e2e/academy.mjs` (Chromium): solve a puzzle by clicking its verified line, reveal a solution, score in
  Puzzle Rush, attempts persisted across a browser restart, phone layout.

## Limitations

Uniqueness is relative to the stated search policy, not a proof. No human difficulty calibration. Theme
labels come from geometric detectors and can miss or over-label motifs. The bank is finite; Rush and
Tactical repeat items after all are seen (repeats are flagged and excluded from evidence).
