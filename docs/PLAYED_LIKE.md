# Played Like Performance Elo (crown-played-like-2)

**What it is.** After every completed, analysed game, a per-game performance rating for **both** sides on the Crown
scale, shown next to each side's career Elo: "White: Career 1,427 · Played like 2,190 ± 520". It is computed only
from the move-by-move analysis of that game. It never uses the result, the clock, either career rating or the
opponent, and it never changes any rating. It is **calibrated on engine play only (no human games) and is not FIDE.**

It replaces crown-played-like-1-experimental. That model shipped as "Calibrating" because on held-out games it did not
beat a straight line in accuracy (docs/V8_SOVEREIGN_STANDARD.md §4). It was fitted on 214 games of L1–L7 only.

## 1. Data
* **Games:** all 2,184 games of the spectrum corpus (`tools/bench/results/spectrum/*.jsonl`, docs/RATING_SPECTRUM.md
  §6). These are engine-vs-engine games between 14 engines whose ratings were calibrated by results: L0d 71, L0c 302,
  L0b 446, L0a 664, L1 800, L2 1,122, L3 1,582, L4 1,710, L5 1,976, L6 2,375, L7 2,641, L8 2,926, L9 3,038. The target for
  each side is the calibrated rating of the engine that played it.
* **Analysis:** every game was analysed with **the app's own default analysis** (`analyzeGame`, Standard `std-d7`,
  canonical engine `crown-search-2+crown-eval-4`, grading `crown-grade-v3-experimental`, `Searcher(18)` as in
  `src/engine/worker.ts`). No cheaper setting was used, so fitting and the app see the same inputs.
  `tools/playedlike/analyze_corpus.ts` ran 2 workers (THREADS = 2) for about 52 min on the shared 4-core host, at about
  2.8 s per game per worker.
* **Stored rows:** `tools/playedlike/data/raw-std-d7.{0,1}.jsonl.gz` holds the compact per-ply analysis of every game:
  the `LitePly` fields a stored report carries (2.2 MB gzipped). `tools/playedlike/data/features-std-d7.jsonl` has one
  feature row per side, 4,368 rows (2.6 MB), with the true rating, engine, pairing, opening and split flag.

## 2. Features (`src/analysis/playedLikeFeatures.ts`, shared by the tools and the app)
A move is **informative** when all of these hold:
* it is not forced (more than one legal move);
* it comes after ply 4 (the corpus openings are 2–4 book plies; in real games these moves are book-like too);
* the analysis measured its loss;
* the position was not already lost for the mover (best expected score > 0.03). In a lost position every move loses at
  most 0.03, so it says nothing.

Over the informative moves of one side, the code computes:

| Feature | Meaning |
|---|---|
| `lnMean`, `lnTrim` | ln(mean expected-score loss + 0.01); the same with the worst 10 % of moves trimmed |
| `blunder`, `mistake`, `precise` | share of moves losing > 0.25, losing > 0.12, and losing ≤ 0.02 |
| `lnHard` | ln mean loss on **hard** moves: at most one analysed candidate within 0.05 of the best (smoothed toward the side's mean with 3 pseudo-moves) |
| `lnEasy` | ln mean loss on moves with ≥ 2 good candidates (smoothed) |
| `onlyFound` | share of only-move positions (best ≥ 0.10 above the next candidate) solved within 0.05, as (k+1)/(m+2) |
| `lnLegal` | mean ln(legal moves): position complexity |
| `swing` | mean change of the best expected score between the side's consecutive informative moves: volatility |
| `endShare` | share of informative moves played in the endgame phase |
| `n` | number of informative moves (used only for the "insufficient" gate and the uncertainty, never as a predictor) |

These features suit this variant: games are short (median 14 informative moves per side), so smoothing and
trimming matter more than on 8×8. Difficulty comes from the analysis's own candidate set. Being lost early removes
moves instead of rewarding precision.

## 3. Split
A side is held out when `hash(opening plies) % 4 == 0`, using FNV-1a with a murmur3 finaliser in `features.ts` and
`fit.py`. Every game of an opening lands on the same side of the split: both colours, every pairing, and every source
that reused the opening. That gives train 1,485 games / 136 openings / 2,400 rated sides, and held-out 512 games / 46
openings / 835 sides. 1,133 sides have fewer than 8 informative moves and are excluded from fitting and scoring. Those
sides get "insufficient information". By band, the excluded share is 835 / 2,640 weak, 234 / 960 intermediate,
63 / 460 advanced and 1 / 308 elite.

## 4. Model (`tools/playedlike/fit.py` → `src/analysis/played-like-model.json`)
1. Features are standardised and fed to a weighted ridge regression on rating. λ is chosen by 5-fold cross-validation
   on the training set, with folds grouped by opening (chosen: 10).
   * Weights: n/(n+10), times a factor that gives each engine strength equal total weight. About 60 % of corpus sides
     are beginner engines, and without this factor the predictions crowd toward the beginners.
   * **Sign constraints for monotonicity:** a loss-quality coefficient can never point the wrong way (more loss reads
     weaker; more precision or found only-moves reads stronger). A coefficient that violates its sign is fixed at 0 and
     the model is refitted. The fitted model keeps `blunder`, `lnHard`, `lnEasy`, `onlyFound` and the three context
     features; `lnMean`, `lnTrim`, `mistake` and `precise` fall to 0 because the hard/easy split carries them.
2. A **monotone piecewise-linear calibration** maps the score to the rating scale. It has 7 knots at training quantiles,
   is fitted by least squares and made monotone by pool-adjacent-violators. The result is clipped to [71, 3,038].
3. **Uncertainty.** The out-of-fold residuals get a log-linear scale model,
   `log r² ≈ a + b ln n + c q + d q²` with q = predicted rating / 1000, so errors shrink with more informative moves
   (b < 0) and depend on the level. The interval multipliers are the 80 % and 95 % quantiles of the out-of-fold
   standardised residuals, z80 = 2.16 and z95 = 3.13; the residuals are heavy-tailed, so the normal 1.28 / 1.96 would
   under-cover. The card shows the rating ± the 80 % half-width; the detail line gives the 80 % range.

The TypeScript code (`src/analysis/playedLike.ts`) reproduces the Python predictions on stored fixtures to within
0.5 points. A test recomputes the held-out MAE, RMSE and 80 % coverage from the committed feature rows with the shipped
code.

## 5. Held-out results (835 sides, 512 games, 46 openings never seen in fitting)

| Estimator (held out) | MAE | RMSE | Spearman | Bias |
|---|---|---|---|---|
| **Played Like (crown-played-like-2)** | **355.9** | **471.3** | **0.749** | +79.9 |
| Baseline: training mean | 693.9 | 868.1 | — | −118.4 |
| Baseline: accuracy line (rating = a + b·accuracy) | 477.0 | 593.5 | 0.742 | −23.7 |
| Extra baseline: line in ln(mean loss) | 428.2 | 550.4 | 0.743 | −43.9 |
| (training, out of fold) | 337.5 | 454.1 | 0.695 | +118.9 |

**Interval coverage (held out):** 80 % interval 0.775, 95 % interval 0.941. By informative moves, 80 % / 95 % coverage
was 0.77 / 0.93 for 8–11 moves, 0.80 / 0.94 for 12–19, 0.80 / 0.94 for 20–29 and **0.71** / 0.95 for 30+. Long games
are somewhat over-confident at 80 %.

**Per band (held out):**

| Band | n | True mean | Predicted mean (± SE) | Bias | MAE | 80 % / 95 % coverage | Predicted band: weak / interm. / adv. / elite |
|---|---|---|---|---|---|---|---|
| weak 0–799 | 424 | 430 | 681 ± 17 | **+251** | 323 | 0.78 / 0.97 | 292 / 120 / 12 / 0 |
| intermediate 800–1599 | 196 | 1,060 | 1,112 ± 38 | +52 | 376 | 0.80 / 0.91 | 59 / 97 / 40 / 0 |
| advanced 1600–2399 | 123 | 2,004 | 1,811 ± 52 | −193 | 430 | 0.74 / 0.87 | 1 / 42 / 58 / 22 |
| elite 2400+ | 92 | 2,839 | 2,552 ± 34 | **−286** | 369 | 0.76 / 0.97 | 0 / 2 / 18 / 72 |

For comparison, the accuracy line's band means are 732 / 1,109 / 1,548 / 1,736. It cannot reach the elite band at all:
0 of 92 elite sides were predicted elite.

**Per engine (held-out mean prediction):** L0d 530, L0c 634, L0b 678, L0a 783, L1 922, L2 1,140, L3 1,508, L4 1,559,
L5 1,739, L6 2,181, L7 2,685, L8 2,467, L9 2,468.

**Ship gate** (`validation.gate`, checked by the app before any number is shown): all three parts pass.
* Beat both baselines on MAE and RMSE, and beat the accuracy line on Spearman.
* Band means strictly increasing, with every adjacent gap larger than 1.96 combined SE.
* 80 % coverage in [0.75, 0.88] and 95 % coverage in [0.91, 0.98].

**Robustness** (`tools/playedlike/altsplit.py`, refitting on other splits):

| Held-out split | MAE (accuracy line) | RMSE (accuracy line) | Spearman (accuracy line) | 80 % / 95 % coverage | Gate |
|---|---|---|---|---|---|
| opening % 4 == 1 | 323 (427) | 433 (533) | 0.698 (0.675) | 0.84 / 0.96 | passes |
| opening % 4 == 2 | 361 (481) | 486 (601) | 0.724 (0.703) | 0.79 / 0.92 | passes |
| opening % 4 == 3 | 342 (467) | 462 (573) | 0.663 (0.661) | 0.80 / 0.95 | passes |
| leave engine pairings out | 353 (432) | 460 (548) | 0.485 (0.463) | **0.67** / 0.94 | fails |

The leave-pairings-out split fails the gate for two reasons. Its held-out set happens to contain no elite pairing, so
only 3 bands can be compared, and its 80 % coverage is 0.67. Its errors still beat the accuracy line.

## 6. Limits (stated in the UI)
* **Engine play only.** Every target is an engine's results-calibrated rating. Humans make different errors, such as
  time trouble or opening knowledge, so a human's Played Like is an extrapolation.
* **Compression at the ends.** Weak play is over-estimated by about 250 and elite play under-estimated by about 290 on
  average. That is the expected regression toward the middle for a one-game, minimum-error estimator.
* **Ceiling.** The Standard (depth-7) analysis cannot separate L8 from L9: both average about 2,470 held out. There is
  no claim above about 2,600 per game. The range is clipped at 3,038, the top measured engine, and is marked "+".
* **Separating beginners is weak.** L0d–L0a means are ordered (530 < 634 < 678 < 783) but strongly overlapped.
* **Per-game noise is large.** The median 80 % half-width is about ±530. Intermediate games are the noisiest: there,
  the accuracy line's band MAE (339) beats the model's (376).
* **Insufficient information.** Fewer than 8 informative moves gives no number. This affects 26 % of corpus sides,
  mostly beginners who were lost early.
* **Settings.** Only Standard (std-d7) reports from the canonical engine and grading get a number. Quick or Deep
  reports, and reports from older engines, show "Needs Standard analysis".
* **The opponent's play is not used, but it shapes the positions.** For example, a weak opponent hands out easy wins.
  The difficulty features only partly correct for this.

## 7. Where it appears and how it is stored
* **Report:** `AnalysisReport.playedLike = { modelId, white, black }` is written when the analysis queue completes a
  report (`src/app/services.ts`). Older reports are computed on read from their stored plies by the same function.
  Mobile defers the work to the existing background analysis queue, which pauses during a match.
* **Permanent player records:** `GameRecord.playedLike[]` (crown-pl-record-1, `src/analysis/playedLikeRecords.ts`,
  `src/storage/playedLikeStore.ts`). It is filled when analysis completes and backfilled on boot for older saves
  (docs/SAVE_FORMAT.md).
  * Career Passport statistics count only "adequate" estimates: a validated number with ≥ 15 informative moves. The
    Passport shows highest and lowest (each opens that game), average, median, most recent, last 10 / 50 / 100, trend
    and a history graph.
  * Estimates of different model ids are kept and shown separately; they are never mixed.
* **UI API** (`src/ui/PlayedLikeCard.tsx`):
  * `PlayedLikeCard`: the player's game, in AnalysisScreen.
  * `PlayedLikePanel({report, sides})`: any game.
  * `PlayedLikeLine`: one line.
  * `PlayedLikeResultLines({gameId, sides})`: result overlay, live-updating.
  * `usePlayedLike(gameId)`: works for player games and `wg:<fixture>` engine archives.
  * `fmtPlayedLike` / `fmtPlayedLikeDetail`.
  * `PlayedLikeCareerPanel`: Passport.

## 8. Reproduce
```
npx tsx tools/playedlike/analyze_corpus.ts std-d7 0 2 & npx tsx tools/playedlike/analyze_corpus.ts std-d7 1 2   # 2 workers
gzip -9 tools/playedlike/data/raw-std-d7.*.jsonl          # resumable runs append to the plain .jsonl
npx tsx tools/playedlike/features.ts std-d7
python3 tools/playedlike/fit.py std-d7 8 && python3 tools/playedlike/summary.py
python3 tools/playedlike/altsplit.py && python3 tools/playedlike/fit.py std-d7 8   # robustness, then restore the model
```
The fit is deterministic (numpy, no random state). Tests: `tests/playedLike.test.ts` and
`tests/playedLikeRecords.test.ts`.
