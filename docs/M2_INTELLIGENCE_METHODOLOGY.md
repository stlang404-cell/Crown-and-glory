# Chess Intelligence Lab — methodology `crown-lab-1`

Implementation: `src/academy/lab.ts` (pure functions, unit-tested by `tests/history100.test.ts`).
Screen: **Lab**. These are chess-specific performance summaries for crown-la6-v1. They are **not** IQ,
general intelligence, or validated psychometric measurements, and no number is shown without its
denominator.

## Evidence sources

| Source | What counts | Exclusions |
| --- | --- | --- |
| Games | The player's own non-forced, graded decisions from the latest *complete* report of each game | Training games, assisted games, and every report whose methodology key (grading id + engine build + settings) differs from the most common key — counted and shown as “excluded”, never merged |
| Practice puzzles | First exposure only (`exposure = 0`), training split, clean solve = first try, no hint, no reveal | Repeats (memorisation), mistake-replay positions |
| Held-out assessments | First exposure to held-out puzzles (20% of puzzle families, never served in practice) | — |

## Uncertainty and minimum evidence

- Game evidence: success rate with a **95% game-clustered bootstrap** interval (1,000 resamples of games,
  fixed seed), because positions in one game are correlated. Shown only with ≥ 10 opportunities across ≥ 3 games.
- Puzzle evidence: Beta(1 + s, 1 + n − s) equal-tailed 95% interval (first-exposure items treated as
  exchangeable). Shown only with ≥ 8 first-try attempts.
- Otherwise the dimension shows **insufficient evidence** and its raw count.

## The ten dimensions (rubrics)

| Dimension | Opportunity → success |
| --- | --- |
| Tactical vision | Games: positions where the engine line wins material or mates (coach-verified) → played the engine-best move. Puzzles: fork / pin / skewer / discovered / hanging-piece / mate themes → clean solve |
| Calculation | Puzzles needing ≥ 2 of your moves against best defence → clean solve |
| Positional understanding | Games: quiet non-critical decisions without tactical notes → loss ≤ 0.02. Puzzles: “position evaluation” (quiet unique best move) |
| Defensive awareness | Games: every decision → did not allow an engine-verified material-winning reply or mate. Puzzles: defensive-resource theme |
| Endgame technique | Endgame-phase decisions (phase rules crown-phase-1) → loss ≤ 0.05; endgame puzzles |
| Threat recognition | Positions where the opponent statically threatened ≥ 2 pawns (SEE) or mate in one before your move → loss ≤ 0.05 |
| Opening understanding | Opening-phase decisions → loss ≤ 0.05 (soundness, not memorised theory; no 6×6 theory exists) |
| Time management | Timed games, critical decisions → spent at least your median think time for that game (descriptive; speed alone is not skill) |
| Decision consistency | All graded decisions → not Mistake/Blunder |
| Adaptability | Held-out assessment first-exposure solve rate; change over time needs ≥ 2 assessment windows |

“Strongest/weakest measured” compare interval bounds (highest lower bound / lowest upper bound), so a
dimension is not called a strength on a lucky small sample.

## Trends and improvement

- Per-game accuracy (one methodology only) plotted chronologically.
- Recent vs historical: last 10 games vs all earlier games (non-overlapping), mean difference with a
  bootstrap 95% interval; requires ≥ 20 analysed games.
- Improvement velocity: OLS slope of per-game accuracy per 10 games with a bootstrap interval.
- The opponent-rating shift between windows is reported next to the comparison; accuracy is not
  adjusted for opponent strength or time control, and the text says so. A single planned comparison is
  not called a validated improvement.

## Recurring patterns (coach)

Coach notes (engine-verified, `crown-coach-0`) on the player's own moves are grouped by topic. A topic is
an **established pattern** only with ≥ 5 occurrences across ≥ 3 games (research doc 07); otherwise it is
labelled **tentative**. Each pattern links to its exact game plies. Training effectiveness compares the
per-decision rate of that topic before vs after the first related Academy attempt, only with ≥ 30
decisions on each side, and is labelled observational.

## Gate E evidence

`tests/history100.test.ts` builds 100 real legal games (engine “player” with growing node budget vs fixed
opponents), real engine reports (10 with a different methodology, 5 assisted games), real Glicko-2 events
in two pools, and real puzzle attempts; it asserts that 15 games are excluded, every rate is in [0,1],
every opportunity reference resolves to a stored report ply, intervals exist exactly when evidence is
sufficient, one dimension is recomputed by hand, recurring-pattern status obeys the 5/3 rule, and a
two-game history reports insufficient evidence everywhere.

## Limitations

No human cohort, no item calibration (IRT), no reliability or construct-validity study. Puzzle difficulty
is heuristic. Static threat detection misses deeper threats. Rates depend on the opponents faced.
