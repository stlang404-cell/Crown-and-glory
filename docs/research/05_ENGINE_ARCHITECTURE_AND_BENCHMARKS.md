# Local engine architecture and strength evidence

## Options

| Approach | Advantages | Risks | Decision |
| --- | --- | --- | --- |
| Ordinary Stockfish | Mature standard chess | Selected rules not assumed supported | Reject as an unverified drop-in. |
| Fairy-Stockfish, Los Alamos configuration | Existing exact setup/promotion source, mature search | GPL compliance, variant/build correctness, WASM memory and iOS work | Preferred production candidate with gates. |
| Custom TS alpha-beta | Easy debugging, same rules domain | Large strength/optimization burden, weaker search initially | Independent rules oracle and fallback. |
| Custom native/WASM | Speed/control | Build complexity and duplicate maintenance | Fallback only if measured need. |
| MCTS with hand evaluation | Diverse policy potential | Tactical traps, rollout quality and overhead | Experiment later; no current superiority evidence. |
| Neural evaluator/self-play | Potential learned evaluation | Training corpus/compute, licensing, export/runtime size | Not a launch dependency. AlphaZero results do not establish feasible local training. |

Default architecture: pure TypeScript rules state for UI and persistence, differential-tested against a pinned Fairy engine; worker adapter supplies asynchronous UCI-like searches using its actual variant name. The engine is a replaceable module. License obligations are not solved merely by worker separation. Choose GPL-compatible distribution for the combined app unless a reviewed licensing strategy establishes another lawful option. Include corresponding source, patches, build scripts and notices when distributing required binaries.

## Search design

Iterative deepening negamax with alpha-beta/PVS, aspiration windows, legal move ordering (TT move, captures/SEE, killers/history), bounded quiescence, transposition table with depth/score/bound type, mate-score ply normalization and repetition-sensitive search. In check, quiescence cannot stand pat and must examine legal evasions; depth/time caps must disclose uncertainty. Do not store fail-high/low values as exact. Test null-move, late-move reductions and futility separately before enabling for analysis because tactical risk differs on 6×6.

Evaluation candidates: material tuned to actual variant, mobility, king exposure, pawn structure, passed pawns, threats and phase interpolation. Do not assume ordinary piece values or opening/endgame terms transfer unchanged. Use tapered evaluation, held-out tactical suites and self-play ablations. No unsupported numeric claim of strength.

Prototype `chess6.py` uses material, optional center/pawn terms, alpha-beta, optional exact-only TT and bounded quiescence. It omits repetition-aware search, advanced pruning and production draw adjudication. Its quiescence cap can still stop in check and must not be treated as definitive analysis. Research findings cannot certify a production engine.

## Controlled measurement

`data/B_benchmarks.json`: five fixed positions, depth 2 and 3, plain alpha-beta, exact-only TT, and quiescence. Same position/evaluation/order for applicable comparisons. Raw per-position seconds, nodes, qnodes and choices are retained. TT adds no node savings at these shallow fixtures; no speedup claim. Quiescence changes scores and consumes more work. NPS across q/non-q is not a direct strength measure. One timing sample per configuration is exploratory; rerun repeated warmed samples and report medians/p95 for production decisions.

`data/extended_engine.json` adds paired opening matches, score intervals and deeper-search comparisons. Tiny, correlated, capped games are insufficient to infer human rating or a strength hierarchy. Opening families, not individual plies, are the resampling unit. A mate-in-one and a hanging queen are not a comprehensive tactical suite.

## Strength testing protocol

Pin rules, engine commit, compiler flags, hardware, memory, time/node controls and opening corpus. Use color-swapped opening pairs; reserve disjoint tuning/test sets. Report W/D/L and cap/technical failures separately. Estimate score confidence by bootstrap across pairs; convert to an internal Elo difference only if justified and finite, never FIDE strength. Use minimum evidence chosen by power analysis for the effect size of interest, not “won ten games.” Run tactical correctness tests before self-play optimization. Analyze exploitation by repeat openings and style-specific traps.

## Local performance budgets [T, not measured]

Single-thread worker baseline; optional WASM threads only with compatible cross-origin isolation and a functioning fallback. Target engine memory 32 MiB on mobile, 64 MiB desktop, configurable lower TT; one active deep analysis worker and one short foreground match task, never thousands of engines. Standard opponent search budget 0.2–1.5 seconds desktop and 0.3–2 seconds mobile, selectable. Frame target 60fps, input response under 100ms, main-thread task under 50ms, analysis cancellation acknowledged within 250ms or worker termination. Depth is achieved, not promised; time/node limits control work.

Measure cold startup, WASM compilation, worker messaging, long searches, battery/thermal throttling, memory pressure and suspend/resume on actual Windows and iPhones. Browser/iPhone/WASM results are **not available** in this research package. No NPS multiplication from Python to phones is offered.

## Difficulty and persistent opponents

Calibrate fixed resource/evaluation profiles against a stable anchor ladder. Weaker agents use shallower planning, limited candidate generation and bounded imperfect evaluation; sample only within a documented bounded quality range. Do not make high-rank agents randomly throw winning games. Styles choose among near-equivalent candidates using stable preferences while preserving a common strength budget. Repeated exploitation triggers evidence-based preparation between games, never hidden omniscience during play. Background identity does not imply resident search state.

## Native rules adapter execution

The optional pyffish0.0.90 Fairy-Stockfish binding supports `losalamos` and was actually executed. It matched10,000 sampled legal positions, all tested successor board/counter states, and initial depth4 perft14332. This reduces variant-compatibility risk for one native build. Its API was used for rules validation, not search benchmarking; the package does not report Fairy search strength or infer WASM/iPhone performance from it.
