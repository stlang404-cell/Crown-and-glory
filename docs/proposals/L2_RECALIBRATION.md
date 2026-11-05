# Proposal: recalibrate L2 (and re-fit the L1–L5 chain) — NOT APPLIED

Status: **proposal for the owner and the Codex engine team. No engine, level or calibration file was changed**
(docs/V1_PLAN.md, Codex isolation). Data: `tools/bench/results/chunks/l2ev-*.json`.

## Why
Package A's held-out check (docs/RATING_SPECTRUM.md) found L2 scoring 79 % against L0a where the published ratings
(L2 1122, L0a 664) predict 93 %. L2's published value rests on one 40-game match against L1.

## New evidence (v1.0, read-only use of the engine)
Five matches, 80 games each (40 colour-swapped pairs), 4-ply book at offset 200 (openings not used by the original
calibration or the beginner fits), `tools/bench/run.ts match`, THREADS=2, node/depth-limited levels (load-independent).
0 illegal moves, 0 capped games.

| L2 vs | Published rating | Result for L2 | Score | Implied L2 |
|---|---|---|---|---|
| L0b | 446 | +76 =0 −4 | 0.950 | 958 |
| L0a | 664 | +62 =5 −13 | 0.806 | 912 |
| L1 | 800 | +61 =5 −14 | 0.794 | 1034 |
| L3 | 1582 | +5 =4 −71 | 0.087 | 1175 |
| L4 | 1710 | +1 =1 −78 | 0.019 | 1022 |

Maximum-likelihood L2 with the opponents held at their published ratings: **1006, 95 % CI 945–1069** (likelihood
ratio), against the published **1122**.

## Reading
* L2 is about 115 points (CI 53–177) too high against its lower neighbours and L4.
* The L3 match implies 1175, inconsistent with the others: L3's published 1582 may itself be too high (it rests on 40
  games vs L2 and 40 vs L1). Moving L2 alone would therefore shift the inconsistency rather than remove it.

## Proposal
1. Re-fit L1–L5 jointly (Bradley–Terry, L1 fixed at 800 as the scale anchor) on the original calibration matches plus
   these 400 games plus a fresh L3–L4, L3–L5 and L2–L5 set (≥ 80 games each), and publish the new values with CIs.
2. Keep the anchor (L1 = 800) so player and competitor ratings keep their meaning; ratings of levels above L5 are
   unaffected by construction only if L5 does not move — check L5 in the refit.
3. Consequences to review before applying: Play-screen level labels, `profileForStrength` interpolation
   (src/federation/profiles.ts), the Played Like training labels (calibrated on these ratings — refit would require
   re-validating crown-played-like-2), and Grimoire figures that quote L2/L3.
Applying any of this requires explicit coordination with the Codex engine work.
