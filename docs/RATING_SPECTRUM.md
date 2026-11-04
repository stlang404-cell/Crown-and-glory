# Rating spectrum 0 – 4,000+ (v0.10, Decision 1 of docs/V10_PLAN.md)

Goal: a believable rating ecosystem from 0 to 4,000+ in which weak AI genuinely plays weakly and strong AI strongly,
on the existing Crown scale (anchored at L1 Novice = 800, `cal-2026-11-03`), without changing L1–L9 or any existing
save. All numbers below are measured engine-vs-engine results on one cloud Linux host (Node v22, Intel Xeon @ 2.30 GHz,
4 cores shared with other work; every measurement is node-limited and seed-deterministic, so load does not change it).
They are **not** human, FIDE or browser measurements.

## 1. Beginner levels below 800 (crown-error-1)

Four new levels, L0a–L0d (`BEGINNER_LEVELS` in `src/engine/levels.ts`). They do not use the L1–L9 code path:
`chooseMove` sends a profile with an `error` field to `chooseErrorMove`; every other profile takes the unchanged path.
`tests/levelsGolden.test.ts` proves L1–L9 choose identical moves to v0.9.0 on 17 fixed positions × 2 seeds (306 moves;
L8/L9 depth-capped so the clock-limited code path is deterministic), and that their profiles are unchanged.

Each move of a beginner level:
1. with probability **pRandom** a uniformly random legal move;
2. otherwise every legal move is judged one ply deep. With probability **pBlind** the judgement is *blind*: static
   evaluation right after the move with no quiescence, so recaptures, hanging pieces and the opponent's threats are not
   seen. Otherwise captures are followed to quiescence (as L1 does). Check extension still finds mate in one;
3. a move is sampled by softmax with temperature **T** among moves within **margin** of the best judged move.

All three random draws come from `mulberry32(seed)` in a fixed order, so a move is a pure function of position, profile
and seed (tested with fresh and reused searchers). Moves are always legal (tested over 12 whole playouts; the worker
also re-checks legality). Cost: one-ply judgement of each legal move with ≤ `nodes / legal` nodes each (≤ ~4,000 nodes
a move, a few ms).

| Level | Name | pRandom | pBlind | T (cp) | margin (cp) |
|---|---|---|---|---|---|
| L0a | Starter | 0 | 0.05 | 220 | 400 |
| L0b | Beginner | 0 | 0.30 | 220 | 550 |
| L0c | Newcomer | 0.06 | 0.45 | 245 | 700 |
| L0d | First Moves | 0.20 | 0.70 | 300 | 1000 |

### How the parameters were chosen (tuning, not used for the ratings)
* 2-ply-opening pilots (`tools/bench/openings.json`, 32 colour-swapped pairs = 64 games each, results not kept):
  even small error rates cost a lot against L1. The "L1-equivalent" error model (pRandom 0, pBlind 0, T 200,
  margin 320 — L1's own selection without its search pass) scored 95 Elo below L1 (CI 0 to 198); pBlind 0.15 cost
  ≈ 380. A uniformly random mover scored 3 % against an early L0c candidate (≈ 600 below it), so the floor is far
  below anything offered here.
* One 4-ply round (`tools/bench/results/suite-beginners-r1-tuning.json`, offset 0, earlier L0b–L0d parameters) fitted
  664 / 518 / 366 / 174; L0b–L0d were then made weaker once (the table above).

### Calibration matches (final parameters)
Protocol: `OPENINGS=4ply OPENING_OFFSET=<60|120> THREADS=2 npx tsx tools/bench/run.ts suite beginners 60` — the chain
L1→L0a→L0b→L0c→L0d (60 opening pairs = 120 games per link) plus one-step-skip links (30 pairs = 60 games), on 4-ply
openings disjoint from every tuning run; Crown adjudication, cap 300 plies (no game was capped), 0 illegal moves.
Raw summaries and every game: `tools/bench/results/suite-beginners-r2*.json` (offset 60) and `-r3*.json` (offset 120).
A re-run of r3 reproduced every game move for move. Score CI: 95 % bootstrap over opening pairs.

Run r2 (openings 60–179 of 320):

| A | B | Games | A W/D/L | Capped | A score (95 % CI) | Elo diff (CI) |
| --- | --- | --- | --- | --- | --- | --- |
| crown-L1 | crown-L0a | 120 | 76/14/30 | 0 | 69.2% (61.3%–76.2%) | 140 (80 to 203) |
| crown-L0a | crown-L0b | 120 | 88/14/18 | 0 | 79.2% (72.1%–85.8%) | 232 (165 to 313) |
| crown-L0b | crown-L0c | 120 | 85/13/22 | 0 | 76.2% (69.6%–82.5%) | 203 (144 to 269) |
| crown-L0c | crown-L0d | 120 | 88/17/15 | 0 | 80.4% (75.0%–86.2%) | 245 (191 to 319) |
| crown-L1 | crown-L0b | 60 | 51/3/6 | 0 | 87.5% (80.0%–94.2%) | 338 (241 to 483) |
| crown-L0a | crown-L0c | 60 | 57/1/2 | 0 | 95.8% (90.8%–100.0%) | 545 (398 to +∞) |
| crown-L0b | crown-L0d | 60 | 50/4/6 | 0 | 86.7% (79.2%–93.3%) | 325 (232 to 458) |

Run r3 (openings 120–239):

| A | B | Games | A W/D/L | Capped | A score (95 % CI) | Elo diff (CI) |
| --- | --- | --- | --- | --- | --- | --- |
| crown-L1 | crown-L0a | 120 | 79/9/32 | 0 | 69.6% (61.7%–77.1%) | 144 (83 to 211) |
| crown-L0a | crown-L0b | 120 | 90/6/24 | 0 | 77.5% (69.6%–85.0%) | 215 (144 to 301) |
| crown-L0b | crown-L0c | 120 | 67/17/36 | 0 | 62.9% (55.0%–70.8%) | 92 (35 to 154) |
| crown-L0c | crown-L0d | 120 | 85/17/18 | 0 | 77.9% (71.2%–84.6%) | 219 (158 to 296) |
| crown-L1 | crown-L0b | 60 | 51/3/6 | 0 | 87.5% (77.5%–95.0%) | 338 (215 to 512) |
| crown-L0a | crown-L0c | 60 | 49/2/9 | 0 | 83.3% (73.3%–91.7%) | 280 (176 to 417) |
| crown-L0b | crown-L0d | 60 | 54/4/2 | 0 | 93.3% (87.5%–97.5%) | 458 (338 to 636) |

### Fitted ratings (`src/engine/calibration-beginners.json`, id `cal-2026-11-04-beginners-crown-error-1`)
`npx tsx tools/bench/fit_beginners.ts tools/bench/results/suite-beginners-r2.json tools/bench/results/suite-beginners-r3.json`:
the same Bradley–Terry maximum likelihood as `tools/bench/fit_calibration.ts` (draws ½, one virtual draw per match,
SE from the observed Fisher information, RD = √(SE² + 40²)), with **L1 held at 800**. CI = rating ± 1.96·SE,
statistical only and relative to L1 (L1 itself carries its published RD 40).

| Level | Target | Published (r2 + r3, 1,320 games) | 95 % CI | RD | Games | r3 alone | r2 alone |
|---|---|---|---|---|---|---|---|
| L1 (anchor) | 800 | 800 | — | 40 | — | — | — |
| L0a Starter | ~650 | **664** | 620 – 707 | 46 | 600 | 660 (599–721) | 670 (609–731) |
| L0b Beginner | ~450 | **446** | 391 – 501 | 49 | 720 | 461 (386–537) | 436 (356–515) |
| L0c Newcomer | ~250 | **302** | 237 – 367 | 52 | 600 | 360 (273–448) | 245 (149–341) |
| L0d First Moves | ~50 | **71** | −6 – 148 | 56 | 360 | 118 (13–224) | 29 (−82 to 141) |

Targets: L0a, L0b and L0d hit their targets within the CI; L0c measured 302 (target ~250, inside its CI but above
the target). Links: 664−800 = −136, then −218, −144, −231. Tuning stopped after r2, so r2 may carry a small
optional-stopping bias towards the targets; r3 alone is the cleanest check and agrees within its CIs.

### Tactics (direct, match-independent check)
Solve rate on the 87 Fairy-Stockfish-verified positions of `tools/bench/tactics.json`, 8 seeds each
(`npx tsx tools/bench/beginner_tactics.ts 8`): L1 53.2 % · L0a 48.0 % · L0b 39.7 % · L0c 35.3 % · L0d 26.3 %.
Strictly monotone; `tests/beginnerLevels.test.ts` checks the order with 6 seeds.

## 2. Latent → engine profile (crown-profile-map-2, `src/federation/profiles.ts`)

| Latent (Crown scale) | Engine actually played |
|---|---|
| < 71 (L0d) | L0d — nothing weaker is calibrated (flag `below-measured`) |
| 71 – 664 | error model, parameters interpolated linearly in the latent between the neighbouring measured beginner points (id `fed-e<latent>`; exact level ids at the measured points) |
| 664 – 800 | the nearer of L0a and L1 (as map-1 does between L1 and L5; the L1-equivalent error model measured ≈ 95 below L1, so it is not a valid endpoint) |
| 800 – 1976 | nearest of L1–L5 (unchanged) |
| 1976 – 3038 | full search, 600·2^((latent − 1976)/118) nodes (unchanged), capped by the call site (featured games: 30k) |
| > 3038 (L9, the strongest measured configuration) | the strongest budget the call site allows (player games: 2,000,000 nodes / 6 s; featured: 30k). Flag `beyond-measured` |

From 750 up to 3,038 the map is identical to crown-profile-map-1 (tested against a frozen copy). The interpolation
between calibrated points (beginner parameters, node budgets) is an assumption: each parameter is monotone along the
chain, so strength should be monotone too, but intermediate points are not separately measured.

**Above the measured range.** A competitor's latent may exceed 3,038 (up to 4,400). Its *simulated* results (tier-3
games) follow the latent through the result model; when its moves are actually computed (player games, featured and
scheduled games) it plays the strongest engine budget allowed on that device. `strengthNote()` returns the text the UI
shows on a competitor page whose public rating is above the measured top: "when moves at this level are actually
computed …, the engine plays at the Federation's strongest measured engine (~3,050) within this device's budget.
Simulated results follow the full strength." No strength above ~3,040 is claimed for any engine.

## 3. Population (crown-population-2, `src/federation/population.ts`)

The 8 divisions × 16 per circuit structure is unchanged. New federations draw latent ~ N(centre, sd²) per division,
clamped to [0, 4,400], with lower divisions packed closer than upper ones:

| Division | 1 Crown | 2 | 3 | 4 | 5 | 6 | 7 | 8 Open |
|---|---|---|---|---|---|---|---|---|
| centre | 3050 | 2600 | 2150 | 1720 | 1320 | 960 | 640 | 340 |
| sd | 200 | 190 | 180 | 170 | 160 | 150 | 150 | 160 |

plus a tiny apex: one Crown-Division competitor per 1,024 (2 in a 2,048 world, 4 in 4,096) gets 4,000 + 120·|z|, in
regions chosen by the world seed. Public ratings start at latent + N(0, 80²) (floored at 0), RD 120, as before.
Entrants: N(centre, sd²), public rating = centre, RD 300.

Band counts of hidden strength at creation (crown-topology-1, 2,048 competitors; `tools/sim/spectrum.mts`):

| Band | seed 42 | seed 7 | seed 1234 | 4,096 world (seed 5) |
|---|---|---|---|---|
| 0–399 | 178 | 173 | 184 | 351 |
| 400–799 | 315 | 349 | 318 | 665 |
| 800–1199 | 318 | 297 | 299 | 613 |
| 1200–1599 | 278 | 253 | 274 | 509 |
| 1600–1999 | 232 | 247 | 248 | 502 |
| 2000–2399 | 232 | 234 | 228 | 495 |
| 2400–2799 | 241 | 235 | 231 | 430 |
| 2800–3199 | 199 | 201 | 199 | 400 |
| 3200–3999 | 53 | 57 | 65 | 127 |
| 4000+ | 2 | 2 | 2 | 4 |

Over 8 simulated seasons (seed 42, `npx tsx tools/sim/spectrum.mts 42 8`, 726 entrants) the shape is stable: after
season 8 the latent bands read 177 / 326 / 308 / 266 / 240 / 229 / 234 / 204 / 63 / 1, public ratings
182 / 323 / 304 / 268 / 239 / 228 / 244 / 221 / 39 / 0, lowest public rating 55, highest 3,922. Division 8 is >90 %
under 800 at creation (tested), so a new player who joins in the Open division meets genuine beginners who play
L0-level engines.

## 4. Existing saves (additive migration)

* A world without `populationModel` is **crown-population-1** (every federation founded before v0.10). Nothing in it is
  rewritten: every competitor keeps id, name, latent, rating, RD, titles and history; the player's rating is never
  touched. `generateFederation(seed)` still defaults to crown-population-1, so every existing seed regenerates
  identically (tests unchanged).
* New behaviour for legacy worlds, from their next season end: turnover entrants into **divisions 7–8** are drawn from
  the crown-population-2 beginner distribution (an expanded lower tier); entrants into divisions 1–6 keep the v1 rule
  exactly. Season drift is unchanged, but its bounds widen from [750, 3050] to [0, 4,400] (otherwise beginners would be
  lifted to 750). Legacy worlds therefore gain beginners gradually and keep their measured-range top: seed 42 simulated
  as a legacy world had 1 competitor under 800 at creation, 78 after 4 seasons and 168 after 8 (of 2,048).
* `profileForStrength` changes only below 750 (no legacy competitor was ever there) and above 3,038 (legacy latents
  reach at most 3,050; such a competitor's player games now use the strongest budget, featured games are unchanged).
* New federations store `populationModel: 'crown-population-2'` in the world record (docs/SAVE_FORMAT.md).
* Tested: `tests/ratingSpectrum.test.ts` simulates a v0.9-generated world for three seasons with the v0.10 code.

## 5. Play screen

The opponent list now starts with four clearly labelled beginners ("Beginners · under 800 · they miss threats and
sometimes play random moves"): Bea Fallow (L0d, 71), Tam Orrell (L0c, 302), Wren Abernath (L0b, 446), Pip Hollins
(L0a, 664), then the calibrated ladder L1–L9. Ratings shown are the measured ones with RD; rated games are allowed
as for other calibrated opponents. The game record carries the exact beginner profile, so the worker plays the error
model, and the calibration id `cal-2026-11-04-beginners-crown-error-1`. Verified in Chromium at 390 px: the list
renders without overflow, a casual game against L0d starts and the engine replies; `e2e/nav-audit.mjs` passes.

## 6. Limits

* Engine-vs-engine only. Nothing here says what a human rated 300 or 3,500 plays like; human calibration needs human
  games. Ratings below 800 extend the same logistic scale; they are not FIDE ratings.
* The beginner chain hangs from L1 = 800, so every beginner rating also inherits L1's own uncertainty (RD 40) and the
  model error of the L1–L9 calibration.
* 1,320 games: per-level SE 22–39. L0c sits ~50 above its target. Non-transitivity between error models is possible
  (e.g. r3's L0b–L0c link was only +92); the skip links constrain it.
* Between measured points and above L5 the maps interpolate; above 3,038 nothing is measured, and computed games there
  are only as strong as the device budget allows.
* The Bradley–Terry fit, its anchor and the 40-point RD floor follow the existing calibration; they are choices.
