# v0.5 analysis calibration report (crown-intel-1)

Every number below was produced in this release by the commands named. Host: 4-core cloud Linux container,
Node 22. Nothing was measured on a phone.

## Why recalibration was required

Until v0.4 the game used two engines: play ran crown-search-2 + crown-eval-4, while analysis, grading, the
assistant and puzzle verification still ran crown-search-1 + crown-eval-3 (docs/M4_ENGINE_STRENGTH.md §"What
ships"). v0.5 moves every intelligence system onto the play engine. Its evaluation is on a different centipawn
scale, so the expected-score map that turns evaluations into grades and accuracy had to be refitted rather than
reused.

## Corpus (crown-calib-corpus-2)

`CORPUS=v2 npx tsx tools/calibration/build_corpus.ts 6`

* 1,790 finished games between near-equal configurations (|measured Elo difference| < 75): the M2 benchmark
  suites, the M4 engine-experiment matches, and **128 new games of the canonical engine against itself**
  (30k vs 40k nodes, 64 colour-swapped opening pairs, −66 Elo [−112, −22]:
  `tools/bench/results/match-cur30k-vs-cur40k-v5calib.json`).
* Every third ply from ply 6 scored by the canonical engine (depth 6, fresh table per game) from the side to
  move's view, labelled with that side's final result. 45,120 positions: 43,305 centipawn scores, 1,815 mate
  scores. Ten opening families (White's first move).

## Held-out validation (crown-calib-fit-2)

`CORPUS=v2 npx tsx tools/calibration/fit.ts` — leave-one-opening-family-out: each position is predicted by a
model fitted without its own family. 95% intervals by bootstrap over games (positions within a game are
correlated). Raw output: `tools/calibration/fit-results-v2.json`.

| Model | Brier [95% CI] | Δ Brier vs placeholder [95% CI] | Log loss | ECE |
|---|---|---|---|---|
| P0 placeholder logistic, s = 200 cp | 0.0629 [0.0599, 0.0662] | — | 0.491 | 0.048 |
| V1 = old map v1 applied unchanged | 0.0633 [0.0608, 0.0662] | −0.0005 … +0.0014 (no improvement) | 0.488 | 0.048 |
| L1 fitted logistic (s = 125 cp) | 0.0596 [0.0570, 0.0625] | −0.0046 … −0.0023 | 0.476 | 0.013 |
| L2 logistic + side-to-move term | 0.0595 [0.0569, 0.0625] | −0.0047 … −0.0023 | 0.476 | 0.013 |
| **ISO isotonic (published as v2)** | **0.0590 [0.0563, 0.0619]** | **−0.0050 … −0.0029** | **0.475** | **0.003** |

Reading: on the canonical engine's scale, the old map is no better than the placeholder — confirming that the
evaluator change made the v1 calibration invalid. The refitted isotonic map is better than every alternative
on all three metrics, and its reliability table matches outcomes to within 0.015 in every decile
(e.g. predicted 0.302 → observed 0.301; 0.588 → 0.574; 0.880 → 0.879).

Published as `src/analysis/outcome-map-v2.json` (`CORPUS=v2 npx tsx tools/calibration/publish_v1.ts`):
54 monotone knots, linear interpolation, clamped to [−2000, 2000] cp, u(0) ≈ 0.516 (the side to move scores a
little above ½ at an even evaluation). Mate scores: 1,038 favourable mates all won, 777 unfavourable all lost,
so mate scores keep u = 1 / 0.

Caveat: fitted on engine-vs-engine games. Human games may convert advantages differently; that cannot be
measured without human game data.

## Grading and accuracy (crown-grade-v2-experimental, crown-accuracy-v2)

Unchanged definitions (src/analysis/methodology.ts): loss L = u(best) − u(played) in expected score,
grade bins Best ≤ 0.002 < Excellent ≤ 0.02 < Good ≤ 0.05 < Inaccuracy ≤ 0.12 < Mistake ≤ 0.25 < Blunder;
Great = engine best with the next alternative ≥ 0.10 worse, stable at two depths; Brilliant = a Great move that
invests ≥ 200 cp of material confirmed by a deeper search, never a recapture; forced moves are Best and excluded
from accuracy; unstable mate evidence gets no grade. **New in v2:** Great/Brilliant also require that the
position is not lost after the move (u ≥ 0.25) and that the best alternative was not already trivially winning
(u ≤ 0.97), so neither an "only move" that still loses nor one of several winning moves earns special credit.
Accuracy = 100·exp(−4·mean L), always within 0–100; it measures move quality in that game against the engine and
is presented as such — never as a rating or IQ. Grade bins and k = 4 remain experimental (not calibrated on human
outcomes).

Regression corpora (`npx vitest run tests/grades.corpus.test.ts`):

* `tests/fixtures/grades.json` (crown-grade-corpus-2, canonical engine, `tools/grades/build_grade_corpus.ts`):
  26 fixtures — three per label (Brilliant: two found), plus a best-move recapture that must not be
  Brilliant, an unsound sacrifice that must not be Great/Brilliant, and a forced move that must be Best. Pass.
* `tests/fixtures/grades-v1.json` (the frozen pre-v0.5 corpus) re-analysed in `legacy-v1` mode: every label
  reproduces, so historical reports remain explainable. Pass.

## Historical reports

Reports are never rewritten. The report id embeds the engine build and grading id, so old and new reports
coexist; old ones display with their own map and a "Historical report" note. Re-analysis jobs are keyed by
engine build and grading version (a v0.4 defect fixed in this release: a game with a complete legacy report
could not be re-analysed). The Lab uses each game's latest complete report and then exactly one methodology,
counting the rest as excluded — it never mixes versions in one chart.

## Puzzle library re-verification (crown-puzzle-verify-2)

`npx tsx tools/academy/reverify_canonical.ts` (57–75 s on 4 cores; identical results on two runs):

| | Count |
|---|---|
| Puzzles shipped in v0.4 | 484 |
| Still verified (active) | **405** (324 training, 81 held-out) |
| Retired — first move no longer uniquely best for the canonical engine | 79 |
| Shortened to their verified prefix | 12 (8 because a stored defence was not the engine's best reply) |

Policy: canonical engine, fresh table per check; unique best first move (gap ≥ 0.20 expected score at depth 8
after a depth-3 screen); every later player move checked the same way at depth 7; **new:** every stored opponent
reply must be the engine's best reply or within 0.05 of it, so the Calculation Chamber's promise "every reply is
the engine's best defence" is now verified, not assumed. Retired puzzles stay in the data so earlier attempts keep
their meaning; they are never served. `tests/academy.test.ts` re-verifies a sample and checks that retired
puzzles are never served.

## Improvement claims

The directive refers to a registered statistical protocol in a "Sovereign research package" that was not
provided, so no new badge rule was invented. The Lab's existing behaviour is kept (src/academy/lab.ts): a skill
dimension is "measured" only with enough evidence (game evidence ≥ 10 opportunities across ≥ 3 games, puzzle
evidence ≥ 8 first-try attempts), otherwise "insufficient"; the trend panel compares non-overlapping windows of
analysed games with an interval and says explicitly that an interval excluding zero is "a single planned
comparison, not a validated improvement claim". No confirmed-improvement badge exists.
