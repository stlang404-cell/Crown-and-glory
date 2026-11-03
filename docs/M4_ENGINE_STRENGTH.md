# M4 engine strength report

Every number below comes from a run made for this report. Raw results: `tools/bench/results/*m4*.json`
(per-game records inside each file), `nps-bundle-*.json`, `wasm-speed.json`, `suite-calibrate.json`.
Host: Intel Xeon @ 2.80 GHz, 4 cores, Node 22, **shared with other jobs** (load average 4–9 during most runs),
so absolute speeds are noisy; all speed comparisons below are paired/interleaved on the same host.
Protocol as in M2: colour-swapped pairs over the 64 deterministic 2-ply openings (`tools/bench/openings.json`),
Crown adjudication, 95% bootstrap intervals over opening pairs, Elo = internal logistic conversion (not FIDE).
"Held-out" = openings 33–64 (`OPENING_OFFSET=32`), never used for the first test of that change.

## Summary

| | M3 engine (crown-search-1 + crown-eval-3) | M4 play engine (crown-search-2 + crown-eval-4) |
| --- | --- | --- |
| Head-to-head, 100 ms per move | — | **+374 Elo [255, 545]** (40 W / 6 D / 2 L, 48 games) |
| vs Fairy-Stockfish `go nodes 4000`, Crown at 40k nodes | 45.3% [37.9, 52.7] (128 games) | **75.0% [64.8, 84.4]** (64 games) |
| Tactical suite (87 Fairy-verified positions) 10k / 40k / 160k / 640k nodes | 70 / 70 / 76 / 79 | **74 / 78 / 78 / 79** |
| Nodes/s (esbuild bundle, paired, 300k nodes, 5 positions) | 1.00 | 0.63–0.82 × (heavier evaluation) |

The gain comes almost entirely from the new evaluation; one search change (forward futility + delta pruning)
was accepted. Nodes per second dropped because crown-eval-4 does more work per node, but at equal *time* the
new engine is far stronger (+374 Elo; the evaluation alone measured +229 at equal time, below).

## What ships and where

- **Play** (`chooseMove`: all levels, federation games, sparring, Training Hall): `PLAY_FEATURES` +
  `PLAY_WEIGHTS` = crown-search-2 + crown-eval-4, levels id `crown-levels-3`, recalibrated (below).
- **Analysis, puzzle verification, in-game assistance** keep the default profile, which reproduces
  crown-search-1 + crown-eval-3 **node for node** (verified: identical depth, nodes, best move and score at
  150k and 400k nodes on five positions). Reason: the analysis expected-score map (crown-outcome-map-v1), the
  grade regression corpus (`tests/grades.corpus.test.ts`) and the puzzle re-verification rate
  (`tests/academy.test.ts`) were all measured with that engine; switching them to eval-4 failed both tests
  (one grade changed blunder → mistake; verification rate 0.319 vs pinned 0.418). Moving analysis to eval-4
  needs a refit of the outcome map and regenerated fixtures — out of scope here.
- **Known labelling issue (needs a one-line change outside the engine folder):** `src/federation/roster.ts`
  and `src/app/federation.ts` tag engine games with `SEARCH_ID`/`EVAL_ID`, which still name the analysis
  profile (`crown-search-1`/`crown-eval-3`, correct for analysis reports). Games played through `chooseMove`
  should be tagged with `PLAY_ENGINE_ID` (`src/engine/levels.ts`, = `crown-search-2+crown-eval-4`). The
  `levelsId` field (`crown-levels-3`) already identifies the new play engine. Those files were outside this
  task's allowed scope, so they are not changed.

## 1. Baseline (M3 engine, measured before any change)

- Speed (tsx, 1 s searches, loaded host): 199k–423k nodes/s median (`speed-m4-base.json`).
- Tactics: 70/87, 70/87, 76/87, 79/87 at 10k/40k/160k/640k nodes (`tactics-m4-base.json`) — identical to M2.
- vs Fairy-Stockfish at 4k nodes, Crown 40k nodes: 48 W / 20 D / 60 L, 45.3% [37.9%, 52.7%], −33 Elo [−86, +19]
  (128 games). A base160k vs Fairy-16k run was started and stopped to free CPU; it is not reported.

## 2. Performance work (behaviour-neutral)

Search and evaluation hot paths were made allocation-free (own repetition scan instead of the rules helper's
object return, typed scratch buffers in evaluation/SEE, in-check status passed to children, module-local
copies of rule constants/tables). With the M4 features off the search is node-for-node identical to M3.
Paired bundled benchmark (`nps-bundle-default.json`, 300k nodes × 5 positions × 5 reps, interleaved):
**1.05–1.21× the M3 nodes/s**. Under the tsx loader used by the benchmark harness the same change measured
about 2× (the loader turns cross-module constant reads into getter calls), so tsx speed numbers overstate it.

## 3. Strength experiments

All at 40k nodes per move unless noted. "Base" below is the reference at the time of the test.

### Evaluation (accepted): crown-eval-4

New evaluation (`src/engine/eval4.ts`): linear in its 361 parameter pairs (tapered mg/eg): material, full
piece-square tables for all pieces, safe mobility (linear + table), passed pawns by rank, free path, king
distances to the square ahead, unstoppable passer, doubled/isolated/supported/phalanx pawns, king shield,
open king files, king-zone pressure, rook open/semi-open files, threats (pawn/knight/rook on bigger pieces),
hanging pieces, knight outposts, king tropism, tempo; plus untuned mop-up and a drawish-material scale
(side ahead has no pawns and ≤ a knight's worth of extra piece material → ×¼).
Fitting (`tools/bench/tune/`): 97,482 quiet positions (after a small capture search) from the 2,407 recorded
M2/M3 benchmark games, labelled with Fairy-Stockfish depth 10 (development reference only); 88,699 with
centipawn labels used; train/validation split by game (every 10th game held out). Logistic loss with
K = ln10/400, Adam, 2,000 iterations. Validation loss 0.03324 (eval-3-equivalent start) → **0.02278**.
The shipped parameters are the first fit (`eval4-fit-l0`, pure Fairy target); the later-added terms
(mobility table, outposts, tropism, unstoppable passer, open king file) are present with weight 0 — a refit
including them reached validation 0.02227 but was **not** match-tested in time and is not shipped.

| Test (search crown-search-1 features) | Games | W/D/L | Score [95%] | Elo [95%] |
| --- | --- | --- | --- | --- |
| eval-4 (λ=0) vs eval-3, openings 1–32 | 64 | 47/10/7 | 81.3% [72.7, 89.1] | +255 [170, 364] |
| eval-4 (λ=0) vs eval-3, **held-out** openings 33–64 | 64 | 44/5/15 | 72.7% [61.7, 82.8] | +170 [83, 273] |
| eval-4 (λ=0) vs eval-3, **equal time** 100 ms/move | 64 | 45/11/8 | 78.9% [70.3, 86.7] | +229 [150, 326] |
| eval-4 (λ=0.25: target mixes 25% game result) vs eval-3 | 64 | 42/15/7 | 77.3% [69.5, 85.2] | +213 [143, 303] (not chosen) |

### Search

Tested first with eval-3 (cur = M3 behaviour), then the promising ones again with eval-4.

| Change | Reference | Games | Elo [95%] | Decision |
| --- | --- | --- | --- | --- |
| **Forward futility (quiets, depth ≤ 3, margin 80+90·d) + qsearch delta pruning** | eval-3 | 64 | +72 [11, 137] | |
| same, held-out openings | eval-3 | 64 | +49 [−22, 124] | |
| same, on eval-4 | eval-4 | 128 | **+46 [3, 89]** | **accepted** (consistent in 3 runs) |
| Table LMR (log·log, history/improving/killer adjustments) | eval-3 | 64 | +72 [0, 143] | |
| same, held-out | eval-3 | 64 | +11 [−49, 72] | |
| same, on eval-4 | eval-4 | 128 | +14 [−30, 58] | rejected (not significant) |
| History gravity + malus + countermoves | eval-3 | 64 | −5 [−66, 55] | rejected |
| Table LMR + history gravity/countermove vs table LMR | eval-3 | 64 | +22 [−39, 86] | rejected |
| Two-slot TT buckets (depth/age replacement) + TT in qsearch | eval-3 | 64 | +11 [−44, 66] | rejected (neutral; eval-4 retest stopped for time) |
| Pruning bundle (fwd futility, razoring, adaptive null-move R, RFP to depth 6, SEE pruning in main search, delta pruning) | eval-3 | 64 | −22 [−66, 22] | rejected |
| IIR + passed-pawn-push extension | eval-3 | 64 | −38 [−100, 16] | rejected |
| Singular extension with multi-cut | eval-3 | 64 | −5 [−66, 49] | rejected |

All rejected features remain in the code behind `SearchFeatures` switches (default off) so they can be
re-measured. Not investigated for lack of time: TT size, check-extension variants, aspiration tuning,
time management (L8's allocation is unchanged), endgame tablebase-style knowledge beyond the scale/mop-up terms.

### Final combination

| Test | Games | W/D/L | Score [95%] | Elo [95%] |
| --- | --- | --- | --- | --- |
| M4 play engine vs M3 engine, 100 ms per move (equal time), openings 1–24 | 48 | 40/6/2 | 89.6% [81.3, 95.8] | **+374 [255, 545]** |

## 4. Fairy-Stockfish reference

Same setting as the baseline (native build 3a95e072, `losalamos`, 1 thread, 16 MB hash, `go nodes 4000`;
Crown at 40k nodes):

| Crown engine | Games | W/D/L | Score [95%] | Elo [95%] |
| --- | --- | --- | --- | --- |
| M3 (crown-search-1 + crown-eval-3) | 128 (openings 1–64) | 48/20/60 | 45.3% [37.9, 52.7] | −33 [−86, 19] |
| **M4 play engine** | 64 (openings 1–32) | 42/12/10 | **75.0% [64.8, 84.4]** | **+191 [106, 293]** |

The M4 engine at 40k nodes now clearly beats Fairy-Stockfish at 4k nodes, which the M3 engine did not. The
per-node gap remains large (M2: Fairy at 16k nodes beat the M3 engine at 40k by ~470 Elo); stronger Fairy
settings were not re-run for lack of time.

## 5. Speed of the M4 play engine

Paired bundled benchmark (`nps-bundle-play.json`): crown-search-2 + crown-eval-4 searches **0.63–0.82×** the
M3 nodes/s (230k vs 281k nodes/s at the start position) but reaches equal or greater depth from the same node
count (start position: depth 11 vs 9 at 300k nodes). Browser speed was not re-measured.

## 6. Level calibration (crown-levels-3)

Re-ran the unchanged calibration suite (`tools/bench/run.ts suite calibrate 20`, 500 games; L8 capped at
2 s per move) with the M4 play engine and refitted (`tools/bench/fit_calibration.ts`, Bradley–Terry, anchor
L1 = 800 on the internal Crown scale — **not FIDE**). `src/engine/calibration.json` id
`cal-2026-11-03-crown-search-2+crown-eval-4`.

| Level | Configuration | M3 rating | **M4 rating ± RD** |
| --- | --- | --- | --- |
| L1 Novice | 1-ply, within 3.2 pawns | 800 | 800 (anchor) |
| L2 Apprentice | 1-ply, within 2 pawns | 1037 | 1122 ± 86 |
| L3 Club | 2-ply, within 1.3 pawns | 1416 | 1582 ± 116 |
| L4 District | 2-ply, within 0.7 pawns | 1647 | 1710 ± 121 |
| L5 Regional | 600 nodes | 1911 | 1976 ± 129 |
| L6 National | 4k nodes | 2302 | 2375 ± 148 |
| L7 Master | 30k nodes | 2628 | 2641 ± 157 |
| L8 Crown | clock-limited | 2987 | 2926 ± 169 |

Adjacent matches: L2–L1 87.5%, L3–L2 92.5%, L4–L3 68.8%, L5–L4 85.0%, L6–L5 92.5%, L7–L6 83.8%, L8–L7 83.8%
(L8 lost 1 of 40); L8 beat L6 20–0. **L8 remains the strongest verified configuration.**
The scale is anchored at L1 of the *same* engine, so these numbers are not comparable with M3's in absolute
terms: every level now plays the stronger engine (the head-to-head gain is in section 3), while the ladder's
internal spacing is similar. The L3–L4 gap is the narrowest (68.8%, interval 52.5–83.8%).

`src/federation/profiles.ts` still maps latent strength via the L5 rating (now 1976, read from the file) and a
node-scaling constant, refitted from the new L5–L7 points: 600 → 30k nodes = 665 rating points over 5.64
doublings ≈ **118 per doubling** (was 133; locally 146 for 600→4k and 92 for 4k→30k, so the interpolation
remains an assumption).

## 7. Fairy-Stockfish WASM as a production backend — assessment: **not integrated**

Measured/inspected: npm `fairy-stockfish-nnue.wasm` 1.1.12 (commit b2e693ef, Emscripten 2.0.26).

- **Correctness:** with `UCI_Variant losalamos` it reproduces our perft 1–5 from the start position
  (10 / 100 / 1,212 / 14,332 / 191,846) — the rules match.
- **Speed in Node 22** (`tools/bench/wasm_speed.ts`, 1M nodes, 1 thread, loaded host): 191k–348k nodes/s vs
  473k–670k for the native build (≈ 0.4–0.5× native); start-up 1.5–2.2 s. Fairy is ~10× more efficient per
  node than the Crown engine (M2), so even the WASM build would be much stronger than L8.
  Running it in Node needed a shim (the 2021 Emscripten loader prefers `fetch()`, which cannot load a file path).
- **Threads / isolation:** the build uses pthreads (`SharedArrayBuffer`); in browsers that requires
  cross-origin isolation (COOP `same-origin` + COEP `require-corp`). Not available from `file://`, the
  PowerShell fallback server sends no such headers, and on iPhone home-screen PWAs it depends on the hosting
  setup; there is no single-threaded fallback build in the package.
- **Memory:** `INITIAL_MEMORY` 128 MiB shared memory, maximum 2 GiB — above the 32 MiB mobile engine budget of
  research doc 05; a 1.6 MB `.wasm` must be cached for offline use.
- **Licence:** GPL-3.0. Distributing it inside this app makes the distributed whole subject to GPL obligations
  (corresponding source, licence notices, likely GPL for the combined work); the repository is `UNLICENSED`.
  That is a decision for the project owner, not an engineering default.

Conclusion: unchanged from DECISION_LOG I01 — it stays a development-only reference. Integration would need
the owner's licensing decision, a cross-origin-isolated host, a single-thread build or verified iPhone
behaviour, and a smaller memory configuration.

## 8. Full-game styles — not validated

Infrastructure added: asymmetric evaluation (`own`/`opp` term adjustments for the styled side, an
endgame-simplification bonus) plus draw contempt (`src/engine/styles.ts` STYLE_EVAL), gated by a new
`fullGame` list in `styles-validation.json` (absent → no style uses it), and a validator
(`tools/styles/validate_full.ts`: middlegame/endgame position suite split into pilot/validation halves,
signature rates with game-clustered intervals, plus 64-game parity runs and whole-game rates).
Pilot results only (80 pilot positions, 8k nodes):

| Style (pilot) | Moderate adjustments: disagreement / signature Δ | Strong adjustments: disagreement / signature Δ |
| --- | --- | --- |
| Tactical (contact moves) | 8.7% / +2.5 pp | 17.5% / +2.5 pp |
| Positional (quiet moves) | 8.7% / −3.7 pp | 16.3% / +2.5 pp |
| Aggressive (king-zone pressure) | 15.0% / +1.3 pp | 28.7% / +3.8 pp |
| Defensive (king safety) | 11.3% / −3.7 pp | 20.0% / +1.3 pp |
| Endgame (simplification, 13 positions) | 7.7% / 0 pp | 23.1% / −7.7 pp |

No variant came near the pre-registered behaviour threshold (Δ ≥ 10 pp with CI > 0), so the validation and
parity runs were not started and **no full-game style is enabled**; `styles-validation.json` is unchanged and
all styles other than the M3-validated opening repertoires (Tactical, Positional) still play as Universal.
Caveat: the M3 repertoire validation (parity at 8k nodes) was measured with the M3 engine and was not re-run
with the M4 engine.

## Reproduce

```
npx tsx tools/bench/tune/extract.ts && FAIRY_STOCKFISH=… npx tsx tools/bench/tune/label.ts 10 2
npx tsx tools/bench/tune/tune.ts fit 0 2000 params-l0.json --write
OPENING_OFFSET=32 npx tsx tools/bench/run.ts match '<spec json>' cur40k 32
npx tsx tools/bench/run.ts suite calibrate 20 && npx tsx tools/bench/fit_calibration.ts
```
