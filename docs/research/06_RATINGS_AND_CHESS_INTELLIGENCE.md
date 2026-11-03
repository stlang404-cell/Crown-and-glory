# Ratings and chess-specific measurement

## Rating model

Elo is simple and explainable but a fixed K does not explicitly express uncertainty. Glicko adds deviation; Glicko-2 adds volatility and is selected for documented local implementation [R: glicko/glicko2]. A hierarchical Bayesian model could share time-control strength and model draws but adds fitting/interpretability cost; keep pools separate initially.

Parameters [D]: initial 1500, RD 350, sigma .06, tau .5; one competition round is a period. For independent quick matches, a round contains one match; comparisons must disclose this policy. Use pre-period snapshots for all results; close both sides atomically. Inactivity is one scheduled federation round, not wall-clock days away. Cap published RD at initial 350 and mark the cap policy. Numerical epsilon 1e-7. Provisional until at least 20 eligible games AND RD <=100; these thresholds are design choices to test.

Core equations [R]: mu=(r−1500)/173.7178, phi=RD/173.7178, g(phi)=1/sqrt(1+3phi²/pi²), E=1/(1+exp(−g(phi_j)(mu−mu_j))). v=[Σg²E(1−E)]^−1; Delta=vΣg(s−E); update sigma via Glickman's stable bracketed root algorithm; phi*=sqrt(phi²+sigma'²), phi'=[1/phi*²+1/v]^−1/2; mu'=mu+phi'²Σg(s−E). See executable implementation `scripts/ratings.py`.

Reference example reproduces approximately 1464.05, RD151.52, sigma .059996 [E]; paper rounds rating to1464.06. Closed stationary simulations cover 144,000 synthetic matches across12 seeded populations. Read actual RMSE/drift intervals in document13. These do not validate evolving/selected real players or calibrate absolute AI strength.

Anchor agents with fixed versions do not improve/decline. Keep their reference performance ladders outside the drifting population and periodically test active agents against them. Do not silently recenter player career history. New rating policies create a new pool/version or explicit conversion with uncertainty. Entry/exit cohorts and selective play can cause drift despite Glicko-2; test them separately before claims of stability.

An explainable rating event contains inputs, expected scores, outcomes, RD/sigma and before/after state; replaying the ledger yields the same result. Assisted, puzzle, retry and imported games do not update rated pools. Repeated opponent farming: cap rank qualification credit from the same opponent per round, but preserve all actual eligible rating results. No invisible post-loss penalties.

## Lifetime profile and comparison

Graphs: rating with uncertainty band, rank events, accuracy by methodology, blunders/opportunity, clock distributions and tournament outcomes. Peaks and lowest established rating exclude provisional states. Filters: last10/30/100/all, date range, opponent, tournament, time control. All aggregates use explicit result eligibility, pool, assistance status, report version and denominator. Show raw n alongside confidence. Do not merge incompatible engine/report versions.

For recent vs historical skill compare nonoverlapping windows, stratify difficulty and time control and bootstrap by game (not independent plies). Rating intervals are model uncertainty, not promises that “true strength” lies in a universal Elo range. Learning velocity estimates a slope with interval on held-out comparable assessments; unavailable if timepoints are insufficient. No universal minimum n guarantees reliability; use opportunity counts and estimated precision.

## Chess intelligence laboratory

Ten displayed dimensions: tactical vision, calculation, positional judgment, endgame technique, defensive awareness, opening understanding, time management, consistency, threat detection and adaptability. Pattern recognition informs tactical/recognition subtests; learning rate is a trend rather than an independent general-intelligence axis.

Start with transparent success/opportunity metrics and Beta(1,1) posteriors for independent binary held-out items: posterior Beta(1+s,1+n−s), report posterior mean and a 95% interval. This is a descriptive model assuming exchangeable items, not validated psychometrics. Correlated game positions require game-cluster intervals instead. Do not use Beta counts for continuous accuracy without defining a justified likelihood.

Future adaptive item calibration [H]: P(success|theta,item)=logistic(a_i(theta−b_i)). Maintain each skill's normal prior and update by numerical quadrature using verified item responses; display 0–100 as100*Phi(theta) only relative to a named frozen reference cohort, never as an IQ percentile. Until a real cohort and item parameters exist, display descriptive rates and uncertainty, no fabricated normalized score.

Items need known solution, multiple difficulty bands, motif labels and content-family IDs. Separate training and held-out families, not only exact FENs; exclude transpositions and remembered siblings. Select informative unseen items, allow skip, limit test length and disclose ability uncertainty. Time-pressure tests compare matched items under controlled budgets; practice effects and motor/UI delays are confounders.

## Operational evidence rubrics [D]

- Tactical vision: verified motifs found among actual motif opportunities.
- Calculation: correct continuation through defended branches on unseen multi-ply items, with depth separately reported.
- Positional judgment: evaluation-preserving decisions on nonforcing positions stable across searches; avoid pretending a heuristic is a proven answer.
- Endgame: conversion/defense relative to starting expected outcome, material and clock; do not mix trivial wins with difficult ones.
- Defensive awareness/threat detection: responses to independently verified opponent threats; distinguish detecting from successfully solving.
- Opening understanding: sound decisions after known sequence departure, not memorized opening name recall.
- Time management: time spent on critical decisions and avoidable flags conditioned on complexity; speed alone is not skill.
- Consistency: dispersion/error tail across matched opportunities, not simply a high average.
- Adaptability: improvement against novel motifs/opponents after prior exposure, separating general growth from memorization.

All ten scores can legitimately show insufficient evidence. Never fill empty charts with invented values. One hundred games can support useful patterns but cannot guarantee psychometric validity or detect small changes. Synthetic learning experiment I quantifies why handfuls of games are inadequate.

## Review resolutions: interpretation and improvement-claim policy

The ten dimensions are **content-domain performance summaries**, not ten independently established cognitive faculties. Construct validity, factor structure, reliability and transfer must be studied before stronger claims. `100*Phi(theta)` is only a named model normalization, not an empirical cohort percentile; a genuine percentile requires an actual frozen representative cohort and a documented conversion.

Improvement claims use scheduled, nonoverlapping assessment windows, never significance testing after every move. Exploratory charts remain descriptive with uncertainty. A confirmatory six-month assessment plan predeclares the ten skill hypotheses and applies Holm correction at familywise alpha=.05 across them at each planned comparison, with a further prespecified alpha-spending budget across repeated comparisons (initial release: at most two planned comparisons, alpha=.025 each before Holm). Use game/item-family clustered resampling, matched difficulty, and an interval/effect-size threshold chosen before viewing results. If sufficient independent clusters or calibrated items are missing, do not issue a confirmatory improvement badge. No universal n guarantees power. Store plan/version, eligible families and comparison cursor for audit.

ExperimentI removes opponent/memory advantages by construction; it demonstrates the need for matching/held-out content, not a validated matching algorithm or leak detector. Real-world confounding, item exposure and selective practice remain open validation work.
