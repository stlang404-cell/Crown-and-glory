# Audit, design and evidence

## Authoritative rule audit

Audited `src/rules/types.ts`, `position.ts`, `tables.ts`, `notation.ts`, `adjudication.ts`, the rule tests and oracle fixtures. The existing implementation is the authority. Initial rank RNQKNR, six pawns, single-step pawns, Q/R/N promotion, no bishops/castling/en passant. FEN includes six ranks, side, disabled rights/EP fields and clocks. `Position.fromFen` checks king count, back-rank pawns and illegal check on the side not to move. Legal generation tests the mover's king safety; it is not an 8×8 adapter.

Adjudication differs from orthodox chess: only bare kings automatically draws for insufficient material. Fivefold/150 halfmoves are automatic; threefold/100 halfmoves are claimable; checkmate takes priority. A FEN cannot encode repetition, so `Study` retains the full setup and played history and `replay` reconstructs it. `automaticOutcome` is checked before analysis and during import replay.

## Engine and research audit

Read the current engine, canonical configuration, analysis types/analyzer/methodology, backup format and existing engine research (`docs/ENGINE_STRENGTH_RESEARCH.md`, `M4_ENGINE_STRENGTH.md`, `M2_ENGINE_STRENGTH.md`). Existing benchmarks and rejected experiments are evidence to preserve, not grounds to claim new strength. Those documents include a Fairy-Stockfish Los Alamos compatibility/perft investigation; no third-party engine is shipped here.

| Area | Existing implementation | Decision |
| --- | --- | --- |
| Search | Iterative deepening, negamax PVS, aspiration windows, mate-distance pruning | Reuse canonical `CANON_OPTS` |
| Ordering | TT move, capture/SEE ordering, killers, history | Keep tested behavior |
| Quiescence | Check-aware evasions, capture search, guarded SEE/delta pruning | Preserve correctness and differential tests |
| Tables | Two-part Zobrist keys, fixed typed-array transposition table, mate-score conversion | 2^18 slots, 2.75 MiB table per calculator worker |
| Selective search | Existing null move, LMR, check extensions and guarded futility | No unmeasured new pruning |
| Evaluation | Canonical fitted tapered eval4: material, piece-square terms, activity, mobility, king safety, pawns, promotion, threats, endgame scaling/mop-up | Display real coefficient trace; no invented additive search explanation |
| Draws | History-aware search; referee separately handles official claims and automatic endings | Preserve history and expose claim availability |
| Analysis | Legal root scoring, best/played comparisons, stable-depth evidence, experimental grading, sacrifice verification | Reuse existing analyzer in isolated review worker |
| Game saves | CCN move records, initial/setup state, versioned backup payload | Read legally replayed copies; never open career DB |

Established PVS, iterative-deepening, aspiration, killer/history and Zobrist approaches are already appropriate for this compact board and are covered by this repository's engine literature/research and regression suite. The implementation opportunity is orchestration: the old assistance API takes a depth and its client discards iteration progress; it does not supply this standalone timed, interactive MultiPV application. Rewriting move generation or adding speculative pruning would add risk without measured strength evidence.

Improvement opportunities remain measurable: optimize exclusion-MultiPV's repeated lower-depth work; add a dedicated budget-aware all-root MultiPV search; test tactical stability across adjacent depths; run randomized, sufficiently large paired matches at 1/5/30 s; validate richer explanation detectors and real Safari battery behavior. These are future engine-strength work, not claims made by this delivery.

## New architecture

`crownmaster/` is a separate Vite root, build output and PWA scope. Only npm scripts and build-output ignore rules change outside this directory and its integration tests. No existing engine, referee, game UI or save schema is modified.

`core.ts` validates/imports/replays studies and orchestrates exclusion MultiPV. For each target depth it searches the best remaining legal root move, excludes it and repeats for the requested candidate count. Each search uses a full-window canonical PVS search, not a static screen of a few promising moves. Only complete rounds are published. If a search ends before its requested depth, the unfinished round is discarded, except the engine's explicit mate termination. Individual early-mate depths are shown accurately; the headline depth is the minimum across candidates. No depth-zero fallback receives a fabricated score.

This is intentionally conservative and can spend more time repeating work than a specialized shared-tree MultiPV implementation. All root moves are eligible for each rank. Node totals include discarded incomplete work in the final result. A node count is search work, not a count of distinct positions. Search time excludes worker startup. Fixed completed-depth tests are deterministic; wall-clock runs are not.

`worker.ts` isolates synchronous computation from React. Each request has a generation ID. Stop, changing the study and leaving the visible document terminate the worker. Stale messages are ignored. The latest completed round/finished review rows remain available. One worker exists at a time, and tables are bounded. Full-game review is cancellable by termination, not by waiting for a synchronous search to poll a message queue.

`evaluationFacts` enables the engine's existing eval4 coefficient trace only for a single static evaluation, restores it in `finally`, applies current phase and scaling, and groups actual terms. Rounding, tempo and endgame adjustments form the residual. It does not decompose the future search score or claim independent causal contributions.

`explain` and `tactics.ts` inspect actual captures, promotions, legal post-move double attacks, ray pins/skewers, discovered attack lines, check defenses, attacked/undefended pieces and legally replayed sacrifice/promotion events. Lines are legal-validated. These descriptions distinguish board geometry from a forced material win. Search mate scores are marked as findings, not proofs. The engine's strongest searched reply is replayable.

There is no general proof-producing classifier for deflections, decoys, trapped pieces or mating nets. Those ideas may appear in the searched continuation, but are not automatically named without verified criteria. This limitation is deliberate and documented rather than filled with speculative tactical labels. Game review also reuses existing coach notes.

## Verification

The complete repository suite passed: **76 files, 831 tests** before the final three tactical integration cases were added. The final Crownmaster integration suite passed **13 tests**, covering authoritative perft, full-root-vs-exclusion MultiPV scores, distinct candidates, PV legality, determinism, known mate/capture tactics, zero-budget behavior, terminal draw handling, repetition replay, supported saves, invalid/live imports, static tracing, pins and legal tactical evidence. The original rule/search/analysis tests cover promotion, stalemate/checkmate, mate distance, TT conversions and game-review grading.

Production build and root typecheck are required. Browser evidence is in `evidence/browser-results.json`; screenshots cover desktop and 375/390 widths. The browser journey exercises a real Web Worker, tap movement, candidate variation, invalid setup, mate in one, full-game review, strongest-alternative playback, immediate Stop with stale-update rejection, no horizontal overflow, and an offline page reload followed by actual offline worker calculation. A real iPhone/Windows device was not available; responsive Chromium checks are not a claim of Safari/device certification. The launcher has not been executed on Windows.

## Measured performance and limitations

Raw results and environment details are in `benchmark-results.json`. Run `npm run crownmaster:bench` for the four-position probe; `npx tsx crownmaster/match-bench.ts` appends the exploratory paired-match probe. Run sequentially on an otherwise idle system for useful timings. The first probe uses the same canonical engine, 2^18 TT and 500 ms wall-clock limit for baseline single-PV vs 3-PV. V8 warm-up, ordering and runtime noise affect throughput, so this is a reproducible small probe, not a statistically controlled strength study.

Recorded on Node v24.22.1 / AMD EPYC 9V74:

| Position | Baseline depth | Calculator minimum depth | Calculator nodes | Calculator nodes/s | Expected move solved |
| --- | ---: | ---: | ---: | ---: | --- |
| Start | 10 | 9 | 209,623 | 418,188 | No oracle assigned |
| Mate in one | 3 | 3 | 13,689 | 494,357 | Yes |
| Hanging queen | 15 | 15 | 1,093,435 | 2,185,120 | Yes |
| Promotion probe | 11 | 10 | 974,116 | 2,088,612 | No: delayed promotion |

Two of three expected-move probes solved. The promotion probe's expected immediate queen promotion was not selected; this is a recorded expected-move mismatch, not a proven loss (alternative moves can also win). Do not hide this result or infer broad playing strength from three tactical probes.

The separate 25 ms/move exploratory match ran four fixed openings with colors swapped: **0 wins, 0 draws, 7 losses, 1 unfinished at the 160-ply cap** for 3-PV against original single-PV. The unfinished game is not counted as a draw. Claims were accepted at threefold/100 halfmoves. This tiny ultra-fast suite exposes MultiPV's computation cost and is insufficient for an Elo or population confidence interval; no interval is estimated. It does not measure the 1/5/30-second product modes. No stronger-engine claim is justified.

The typed-array TT is exactly 2,883,584 bytes. Other engine arrays, JS objects, React, worker duplication and browser caches add memory. The probe's combined Node-process RSS was ~106 MiB and heap used ~16 MiB; this is not an isolated browser worker memory measurement. No iPhone memory/battery measurement exists.

## Deployment and concurrency

Build/deploy instructions are in README. Static files are prepared only; no live app or environment was published. Existing GitHub Pages deployment configuration is untouched. A dedicated feature branch can be reviewed and integrated independently of concurrent work. No automatic merge, rated-play overlay, market connection or automation is present.
