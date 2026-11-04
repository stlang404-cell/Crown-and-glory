# Match odds model (crown-odds-2)

The pre-game and in-play W/D/L forecast for featured AI match markets (Grand Exchange match markets and the
Live Arena). It replaces `crown-result-model-1` + the inline live mapping in `FederationService.liveStep`, which
ignored the rating gap once a game started (bug #21: at an equal evaluation it returned ≈ 0.35/0.30/0.35 for any
pairing).

A forecast is information, never a price. It is what the published model shows and what NPC traders believe;
prices move only through funded LMSR trades. LMSR accounting, fees, settlement and the information policy are
unchanged.

- Code: `src/exchange/odds.ts` (runtime), `src/exchange/odds-coefficients.json` (coefficients and fit metadata,
  written by the fitter).
- Callers: `FederationService.openRoundWithMarkets` (pre-game forecast) and `FederationService.liveStep`
  (in-play model published after each move); the Match Research panel in `ExchangeScreen` shows the ±RD range
  from the same model.
- Fit and validation: `tools/odds/generate.ts` (data), `tools/odds/fit.ts` (fit and held-out report),
  `tools/odds/data/*.json` (the 3,200 games used), `docs/sim/odds-crown-odds-2.json` (full report).
- Tests: `tests/odds.test.ts`.

## Inputs (public only)

| Input | Source | Used for |
|---|---|---|
| Public rating and RD of each side | `Competitor.rating`, `Competitor.rd` (Glicko-2, updated only from results) | pre-game prior, level of play |
| Ply count | number of published moves | how much weight the evaluation gets |
| Published evaluation | the moving engine's own score for the move just played (`SelfplayMove.score`), the same number the arena shows | in-play signal |
| Material | non-pawn material on the published FEN (N 3, R 5, Q 9) | draw width in simplified positions |

The model never reads hidden latent strength, a future move, a result, or any analysis beyond the published
score. The fit data records latent strength for diagnostics only. The fitter never passes it to the model.

Time control: every featured AI game is played in one format (node-capped engine search, 30k-node cap, no clock),
so the arena has no time-control variation to condition on and the model has no time-control term. I checked the
archived engine matches (`tools/bench/results`, near-equal engines of about 2,600 or more) for a time-control effect on draw
rate and found no consistent trend: T100 30.9% draws (4,016 games), T200 34.9% (768), T300 19.8% (96), T400 37.5%
(128), T1000 23.4% (64), 40k nodes 30.2% (1,220). If timed featured games are introduced, a time-control term
should be fitted then.

## Model

An ordered logit on one latent "White advantage" x with symmetric draw thresholds ±θ:

    P(White) = σ(x − θ),   P(Black) = σ(−x − θ),   P(Draw) = 1 − P(White) − P(Black)

**Pre-game.** q = ln10/400, g = 1/√(1 + 3q²(RDw² + RDb²)/π²) (Glicko's g-function, γ = 1),

    x0 = β·q·g·(Rw − Rb) + α
    θ0 = exp(t0 + t1·L),   L = clamp(((Rw + Rb)/2 − 2200)/400, levelMin, levelMax)

α is White's first-move advantage, and t1 lets the draw rate change with the level of play. L is clamped to the
1st–99th percentile range of the fit data, so the model does not extrapolate outside it.

**In play**, after ply n ≥ 1, with the published evaluation e in White-POV centipawns (mate = ±∞):

    s = clamp(e, ±C)/100
    x = a(n)·x0 + b(n)·s
    θ = θ0·exp(d(n) + m·(1 − material/50))

a, b and d are piecewise linear in ply over the knots 0, 1, 10, 20, 40, 80, 160 (constant after 160), with
a(0) = 1, b(0) = 0 and d(0) = 0 fixed. As a result:

- the ply-0 live forecast is exactly the pre-game forecast;
- the rating prior keeps a fitted, decaying weight a(n) throughout the game, so the favourite stays the favourite at an equal evaluation (the bug);
- the evaluation's weight b(n) and the draw width d(n) come from the data.

### Coherence guarantees (tested)

- The three probabilities are non-negative and sum to 1. The published vector floors each state at 0.005 and
  renormalises, as before.
- P(White) is non-decreasing and P(Black) non-increasing in the evaluation (the fit constrains b ≥ 0 through
  b = exp(·)).
- Colour symmetry: swapping colours (ratings and RDs swapped, evaluation negated) mirrors the forecast exactly,
  except for the fitted first-move term α. On the latent scale, x(A,B,e) + x(B,A,−e) = 2·a(n)·α.
- The model is deterministic, and every coefficient comes from the fit.

### Fitted coefficients (crown-odds-2)

| Pre-game | value | s.e. |
|---|---|---|
| β (gap slope, × q·g) | 1.115 | 0.056 |
| α (White first-move edge, logit) | 0.317 | 0.042 |
| t0 (log draw width at L = 0, i.e. mean rating 2200) | −0.933 | 0.049 |
| t1 (per 400 rating points of level) | 0.398 | 0.061 |
| level clamp L | [−2.751, 1.117] (mean rating 1100–2647) | |

| Live knot (ply) | 1 | 10 | 20 | 40 | 80 | 160 |
|---|---|---|---|---|---|---|
| a (prior weight) | 1.008 | 0.830 | 0.757 | 0.591 | 0.349 | 0.150 |
| b (per 100 cp) | 0.464 | 0.784 | 0.977 | 1.225 | 1.023 | 0.268 |
| d (log draw-width shift) | 0.002 | 0.159 | 0.391 | 0.770 | 1.316 | 1.631 |

m (draw width vs material traded) = 0.580. The evaluation clamp is C = 1,600 cp, picked from the grid
{400, 800, 1,600} by training likelihood (0.60301 / 0.60087 / 0.60080). Live-parameter standard errors are
0.014–0.088 (they are listed in the report).

On γ: a free RD multiplier is not identified by this data, because almost every competitor has an RD near 70
after three seasons. The free fit drives γ to 0, with a training log-loss of 0.9084 against 0.9090 for γ = 1
(likelihood-ratio ≈ 2.8 over 2,400 games, not significant). The model therefore keeps Glicko's own g(RD) (γ = 1),
so that a genuinely uncertain rating, such as a new entrant at RD 300, still shrinks the favourite's edge.

What the coefficients say:

- White scores 55.5% in these games. They start from the Crown start position without an opening book, which is
  why White's edge is larger than the 50.5% measured on book-balanced bench matches.
- Draws rise with level: equal ratings give 8.6% draws at 1400, 12.8% at 1800, 19.0% at 2200 and 27.8% at 2600.
  The observed draw rates for near-equal pairs (gap < 150) are 7.6%, 12.4%, 16.1% and 19.7% across the bands
  <1600, 1600–2000, 2000–2300 and >2300.
- The rating prior still carries 83% of its weight at ply 10, 59% at ply 40 and 15% at ply 160. The evaluation's
  weight peaks around ply 40. Long games become drawish: the draw width grows with ply and with traded material.

Bug #21, before and after, at ply 10 with an equal evaluation (0 cp, ratings 2300 ± gap/2, RD 80):

| gap (White − Black) | −300 | −150 | 0 | +150 | +300 |
|---|---|---|---|---|---|
| old W/D/L | 0.378/0.244/0.378 | 0.354/0.291/0.354 | 0.345/0.310/0.345 | 0.354/0.291/0.354 | 0.378/0.244/0.378 |
| crown-odds-2 W/D/L | 0.148/0.177/0.675 | 0.269/0.236/0.495 | 0.439/0.245/0.316 | 0.624/0.197/0.179 | 0.778/0.128/0.093 |

The old model is symmetric in the gap at an equal evaluation. The gap only narrowed its draw share, through the pre-game Davidson draw.

## Fit data

The fit data is 3,200 federation-style engine games from `tools/odds/generate.ts`, 800 from each of four worlds
(seeds 1–4). Each world is the shipped population generator run headless for three seasons, so public ratings and
RDs carry realistic estimation error. The correlation between rating and latent strength is 0.981, and RD is
mostly about 70 (10th–90th percentile 69–78).

Each game is played exactly like a featured live game: `profileForStrength(latent, 30k node cap)`, the
competitor's style, the Crown start position, the Crown adjudication rules and the 400-ply limit. Pairings are 60%
same circuit (league-like) and 40% across adjacent divisions in one region (Swiss- or cup-like gaps). Division
weights favour the top, since featured games come from top events, but the whole ladder is covered: mean ratings
run from 1,100 to 2,650. None of the games hit the 400-ply limit; games that do would be excluded, because their
markets are cancelled.

The two-stage maximum-likelihood fit (BFGS) works as follows:

1. The pre-game coefficients are fitted on the results only.
2. The live knots are fitted with the pre-game part held fixed, on every training ply up to 40 and every 4th
   ply from 41 to 240 (109,163 positions).

There is one observation per position at which a live point is published, that is after plies 1 … n−1.

The split is by game: FNV-1a(game id) mod 4 = 0 is held out, giving 2,400 training games and 800 held-out games.
Every number below is on the held-out games only.

### Why not the archived bench games

`tools/bench/results` holds engine-vs-engine matches between engine builds, not federation competitors: there are
no public ratings or RDs, the strength differences are tens of Elo, and the games start from a balanced opening
book. Per-ply published evaluations are not stored either. Re-evaluating those positions with a different fixed
budget would not be the score that the arena publishes. The archive is used only for the time-control check above.

## Held-out results (800 games)

Log-loss is natural-log, three-class. Brier is the sum over the three classes. The models are:

- **old**: crown-result-model-1 pre-game, plus the inline live map.
- **new**: crown-odds-2.
- **rating only**: the crown-odds-2 pre-game forecast, held for the whole game.
- **eval only**: the same live structure fitted with no ratings at all.

| checkpoint | n | old LL / Brier | **new LL / Brier** | rating-only LL / Brier | eval-only LL / Brier | new − old LL (95% CI) |
|---|---|---|---|---|---|---|
| ply 0 | 800 | 0.968 / 0.573 | **0.900 / 0.533** | 0.900 / 0.533 | 1.015 / 0.616 | [−0.090, −0.045] |
| ply 10 | 800 | 0.851 / 0.490 | **0.767 / 0.438** | 0.900 / 0.533 | 0.836 / 0.481 | [−0.109, −0.059] |
| ply 20 | 781 | 0.639 / 0.354 | **0.596 / 0.332** | 0.906 / 0.537 | 0.628 / 0.349 | [−0.064, −0.016] |
| ply 40 | 674 | 0.440 / 0.246 | **0.352 / 0.200** | 0.921 / 0.545 | 0.361 / 0.211 | [−0.121, −0.056] |
| ply 60 | 473 | 0.457 / 0.253 | **0.293 / 0.174** | 1.020 / 0.612 | 0.301 / 0.177 | [−0.215, −0.114] |
| ply 80 | 217 | 0.646 / 0.363 | **0.284** / 0.147 | 1.181 / 0.717 | 0.285 / **0.138** | [−0.452, −0.264] |
| all live points | 56,923 | 0.700 / 0.391 | **0.496 / 0.282** | 1.005 / 0.601 | 0.529 / 0.303 | [−0.258, −0.154] |

The confidence intervals are a cluster bootstrap by game (400 resamples).

- The new model beats the old one at every checkpoint, and every confidence interval excludes 0.
- It beats both baselines at plies 0–60 and over all live points.
- At ply 80, which only long games reach, the eval-only baseline has a slightly lower Brier score (0.138 against
  0.147) and the same log-loss. By then the rating prior carries little information.

### Calibration (held-out, deciles of the predicted probability; predicted → observed)

**P(White wins), ply 0 (pre-game)**

| decile | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | ECE |
|---|---|---|---|---|---|---|---|---|---|---|---|
| new | .15→.09 | .26→.29 | .33→.34 | .39→.38 | .45→.45 | .51→.47 | .56→.59 | .62→.60 | .69→.68 | .83→.81 | **0.023** |
| old | .13→.09 | .20→.31 | .25→.28 | .29→.39 | .33→.47 | .37→.38 | .40→.59 | .45→.68 | .50→.69 | .62→.82 | 0.123 |

**P(Draw), ply 0**

| decile | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | ECE |
|---|---|---|---|---|---|---|---|---|---|---|---|
| new | .06→.07 | .09→.06 | .12→.12 | .15→.15 | .17→.21 | .19→.11 | .21→.14 | .23→.20 | .25→.21 | .27→.29 | **0.032** |
| old | .23→.06 | .27→.16 | .28→.14 | .29→.16 | .30→.24 | .30→.21 | .31→.16 | .31→.17 | .31→.16 | .31→.10 | 0.134 |

**P(White wins), ply 20**

| decile | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | ECE |
|---|---|---|---|---|---|---|---|---|---|---|---|
| new | .01→.01 | .05→.05 | .11→.06 | .23→.12 | .41→.33 | .58→.50 | .74→.76 | .87→.87 | .94→.89 | .98→1.00 | **0.041** |
| old | .01→.04 | .09→.05 | .21→.06 | .30→.14 | .38→.28 | .50→.55 | .68→.76 | .78→.78 | .91→.96 | .98→.96 | 0.066 |

**All live points (56,923 positions)**: the ECE of P(White) is 0.035 for the new model against 0.074 for the old;
the ECE of P(Draw) is 0.020 against 0.112. The old model's draw forecast was never above about 0.31, even in dead-drawn
long endgames. The new one reaches the observed 0.89 in the top decile.

Remaining miscalibration: at ply 20 the new model over-forecasts White in the middle deciles (0.23 forecast
against 0.12 observed, and 0.41 against 0.33). That is a residual first-move or opening effect that one
linear-in-ply prior weight cannot fully capture.

## Limitations

- The model is fitted on simulated federation engine games from one engine snapshot, the working tree of
  2026-11-04, and it inherits that engine's style of play. A substantial change to the play engine, the profile
  map or the node cap should be followed by a regenerate-and-refit: run `tools/odds/generate.ts` for seeds 1–4,
  then `tools/odds/fit.ts tools/odds/data`.
- The RD term is Glicko theory (γ = 1) rather than a fitted quantity, because the data has too little RD variation
  to identify it (see above).
- There is no time-control term, because featured games have a single format.
- The level effect is clamped to mean ratings from 1,100 to 2,650.
- The published evaluation comes from the moving side's own search at its own budget. A weak player's evaluation
  is noisier, and the model only partly captures that, through the rating level in θ0. Per-level evaluation
  weights would need more data.
- The season-family models (`src/exchange/families.ts`) still use `crown-result-model-1` (Davidson ν = 0.9). That
  is deliberate: those markets mostly price tier-3 abstract games, which `sampleResult` generates from exactly that
  formula.
- Player-facing pre-game expectations in human games (`PlayScreen`) are unchanged, because they are not markets.
- Older saved markets keep the forecast and source they were opened with (`forecast.source` names the model).
