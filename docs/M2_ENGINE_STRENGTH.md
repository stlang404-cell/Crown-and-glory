# M2 engine strength report (Gate A)

All raw data: `tools/bench/results/`; tables: [ENGINE_BENCHMARKS.md](ENGINE_BENCHMARKS.md) (generated, not
hand-typed). Protocol: colour-swapped opening pairs, fixed node budgets (equal-node comparisons; for
evaluation-weight changes the cost per node is unchanged, so equal-node = equal-time), 95% pair-bootstrap
intervals, capped games reported separately (none occurred), zero illegal moves in every match.

## Starting point (crown-search-1 + crown-eval-2)

Ablations at 40k nodes showed that TT (+191), quiescence (+170), futility (+83), LMR (+66) and SEE pruning
(+66) each help significantly; null move and aspiration windows are neutral. Against the
development-only Fairy-Stockfish reference, Crown at 40k nodes scored 87.5% vs Fairy at 1k nodes and 39.1%
vs 4k nodes — Fairy is roughly 10× more efficient per node.

## What was tried in M2 (40k nodes, 32 opening pairs each)

| Change | First run | Held-out replication (openings 33–64) | Decision |
| --- | --- | --- | --- |
| Logarithmic LMR | −6 Elo (−62…+51) | — | rejected |
| Late-move pruning | +27 (−49…+100) | — | rejected (not significant) |
| LMR-log + LMP together | +83 (+11…+156) | **0 (−60…+60)** | rejected — did not replicate |
| Alternative piece values | −5 (−60…+49) | — | rejected |
| Stronger passed-pawn terms | 0 (−60…+60) | — | rejected |
| **Higher mobility weights (6/5/3)** | **+60 (0…+124)** | **+72 (+5…+143)** | **adopted → crown-eval-3** |
| Mobility 8/7/4 (vs eval-3) | −11 (−72…+49) | — | rejected (eval-3 is a local optimum on this axis) |
| King safety ×1.5 (vs eval-3) | +16 (−49…+77) | — | rejected |
| Rook open file ×1.7 (vs eval-3) | +38 (−16…+95) | — | rejected |
| Pawn-structure penalties ×1.7 (vs eval-3) | −27 (−89…+27) | — | rejected |

The held-out replication step mattered: the combined pruning change looked significant on the first
32 openings and was worth 0 on the next 32. Only the mobility change survived both.

## Gate A verdict

**Measurable improvement demonstrated in direct self-play:** crown-eval-3 vs crown-eval-2 scored ≈ +66 Elo
pooled over 128 games (two independent opening halves, both intervals above zero), at identical node and
time cost. This is an internal engine-vs-engine Elo difference at 40k nodes per move, not a human or FIDE
strength claim.

**Not detectable against the external reference:** re-running the Fairy-Stockfish matches with eval-3 gave
89.8% vs Fairy@1k nodes (eval-2: 87.5%) and 39.8% vs Fairy@4k (eval-2: 39.1%) — both changes are well inside
the 64-game intervals. Self-play gains often shrink against a different opponent; the honest summary is a
small, replicated improvement, not a step change in strength.

The maximum level (L8, clock-limited, up to 6 s per move) is the strongest validated configuration: in the
calibration it scored 91% against L7 (30k nodes) and 97.5% against L6. On this host the engine searches
~330k–620k nodes/s in Node; browser speed is listed in ENGINE_BENCHMARKS.md.

**Tactical suite** (87 Fairy-verified unique-best positions), eval-2 → eval-3: 72 → 70 at 10k nodes, 73 → 70 at
40k, 75 → 76 at 160k, 76 → 79 at 640k. Slightly fewer shallow solves, slightly more deep solves; all
differences are a few positions and not significant. The game-result gain did not come from tactics.

**Speed**: unchanged by eval-3 within noise (289k–593k nodes/s median in Node; 284k–441k in headless
Chromium's Web Worker).

## Strength ladder (crown-levels-2)

M1's ladder had cliffs (L3 beat L2 40–0; L4 beat L3 97.5%), so the intermediate levels were redesigned with
three short pilots and then calibrated with 500 games (see ENGINE_BENCHMARKS.md):

| Level | Configuration | Measured rating (anchor L1 = 800) |
| --- | --- | --- |
| L1 Novice | 1-ply, samples within 3.2 pawns | 800 |
| L2 Apprentice | 1-ply, within 2 pawns | 1037 ± 75 |
| L3 Club | 2-ply, within 1.3 pawns | 1416 ± 97 |
| L4 District | 2-ply, within 0.7 pawns | 1647 ± 107 |
| L5 Regional | full search, 600 nodes | 1911 ± 117 |
| L6 National | full search, 4k nodes | 2302 ± 137 |
| L7 Master | full search, 30k nodes | 2628 ± 152 |
| L8 Crown | full search, clock-limited | 2987 ± 170 (2 s cap in calibration; hardware dependent) |

Adjacent levels now score 80–92% against each other instead of 97.5–100%. Engine-vs-engine Elo gaps are
known to be larger than the gaps humans perceive; no human calibration exists yet.

## Not achieved / open

- The per-node gap to Fairy-Stockfish remains large; closing it needs better evaluation (tuned
  piece-square tables / texel tuning on a larger corpus) and pruning work that survives held-out replication.
- Opponent styles are still undifferentiated.
- A stronger optional engine (Fairy-Stockfish WASM) is not integrated: GPL distribution and
  cross-origin-isolation/iPhone requirements are unchanged (DECISION_LOG I01).
