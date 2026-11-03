# Implementation status

Last updated: 2026-11-03 · app **0.4.0 (“The Grand Exchange”)** · rules crown-la6-v1 1.0.0 · engine crown-search-1 + crown-eval-3 ·
levels crown-levels-2 · analysis crown-grade-v1-experimental / crown-accuracy-v1 · federation crown-federation-1 ·
exchange crown-exchange-2 · markets crown-markets-2 · forecasts crown-forecast-1 · economy crown-economy-1 (+ institutions) · save schema DB v4

Legend: **Complete** = implemented and verified by the named evidence. **Partial** = works with stated gaps.
**Not started** = planned only. Nothing is marked complete because it compiles or because a button exists.

## Correction to the v0.1.0 status

v0.1.0 marked M1 complete, but its level calibration had never been run, so Rated mode was disabled and no
rated game had ever been verified (docs/M2_BASELINE_AUDIT.md). M2 fixed this: levels were redesigned and
calibrated (500 games) and a strict rated browser journey now passes.

## M2 gates

| Gate | Verdict | Evidence |
| --- | --- | --- |
| A — engine strength | **Passed (modest)**: +66 Elo replicated on held-out openings (crown-eval-3); four other candidate changes rejected after failing replication; ladder redesigned from cliffs to 80–92% steps. Not detectable against the Fairy-Stockfish reference at 64 games. | docs/M2_ENGINE_STRENGTH.md, docs/ENGINE_BENCHMARKS.md |
| B — analysis | **Passed with disclosed limits**: expected-score map crown-outcome-map-v1 beats the placeholder on held-out opening families (Brier −0.0020…−0.0048, ECE 0.042 → 0.011); grade regression corpus re-analysed in tests; negative fixtures (forced move, recapture, unsound sacrifice). Grade bins, k = 4 and Great/Brilliant remain heuristic/experimental and are labelled so. | docs/M2_ANALYSIS_CALIBRATION.md, tests/grades.corpus.test.ts, tests/analysis.test.ts |
| C — postgame | **Passed**: saved games reopen, analyse, navigate, explore variations, bookmark/mark memorable, and re-analyse as a new immutable report version (batch too); original records never change. | e2e/run.mjs, tests/storage.test.ts |
| D — Academy | **Passed**: 484 engine-verified puzzles (reproducible verification), 8 playable modes with stored progress; held-out split never served in practice. | docs/M2_ACADEMY_VALIDATION.md, tests/academy.test.ts, e2e/academy.mjs |
| E — intelligence lab | **Passed**: 100-game fixture history yields coherent, traceable dimensions with insufficient-evidence states; methodology separation verified. | docs/M2_INTELLIGENCE_METHODOLOGY.md, tests/history100.test.ts |
| F — coach | **Passed with limits**: notes cite engine lines and positions; recurring patterns need ≥ 5 occurrences in ≥ 3 games; casual assistant (hint, candidates, threat check, evaluation, explanation) is refused by the game state in rated games and makes casual games permanently assisted. Explanations are template + motif based, not natural-language coaching. | src/academy/coach.ts, src/academy/lab.ts, tests/session.test.ts, e2e/run.mjs |
| G — rated integrity | **Passed in Chromium**: eligible rated start, assistant locked, legal finish, single Glicko-2 update, duplicate finalization rejected, pool isolation, restart persistence, assisted game unrated. | e2e/run.mjs, docs/evidence/e2e-log.txt |

## v0.4.0 — The Grand Exchange

Status vocabulary (directive Part XI): **Verified complete** = implemented and verified by the named executed
evidence · **Implemented, unverified** = code exists, not exercised end-to-end · **Partial** · **Not implemented**.

| Area | Status | Evidence |
| --- | --- | --- |
| Research reconciliation (167-row matrix) | Verified complete (document) | docs/M4_RESEARCH_RECONCILIATION.md |
| Baseline audit | Verified complete | docs/M4_BASELINE_AUDIT.md |
| Engine strength (M4-A): crown-eval-4 fitted evaluation + forward futility/delta pruning for play; levels recalibrated (crown-levels-3, L8 strongest) | Verified complete | docs/M4_ENGINE_STRENGTH.md: +374 [255, 545] Elo vs the M3 engine at 100 ms/move; vs the Fairy-Stockfish reference setting 45.3% → 75.0%; held-out-opening and equal-time checks |
| Analysis on the new engine | Not implemented (deliberate) | analysis, puzzle verification and the assistant stay on the pinned M3 engine because the outcome map and fixtures were measured on it; moving requires refitting (M5) |
| Fairy-Stockfish WASM backend | Evaluated, not integrated | GPL-3.0, needs cross-origin isolation (SharedArrayBuffer), 128 MiB initial memory; docs/M4_ENGINE_STRENGTH.md |
| AI styles beyond the opening | Not achieved (pilot failed; machinery present, disabled) | docs/M4_ENGINE_STRENGTH.md: evaluation-weight styles changed 17–29% of moves but shifted signatures only −8…+4 pp (< 10 pp required); Tactical/Positional opening repertoires remain; their parity was measured on the M3 engine and not re-run |
| n-state LMSR with subset claims, payout vectors, prior funding | Verified complete | tests/exchange2.test.ts (randomized adversarial), docs/M4_EXCHANGE.md |
| Market families: match, tournament champion (Open, Championship), promotion, qualification, season title, bounded conditional final four | Verified complete | tests/markets.test.ts (full season), e2e/m4-journey.mjs steps 14–19 |
| Live in-play trading (move-by-move publication, windows, NPC reaction, resume) | Verified complete | tests/markets.test.ts, journey steps 15–17, docs/M4_EXCHANGE.md §3 |
| NPC traders (8 strategies, exposure caps) | Verified complete (behaviour as specified; profitability not guaranteed) | tests, docs/M4_EXCHANGE.md §4 |
| Forecasting companion (Brier/log, calibration, skill progression) | Verified complete | src/app/forecasting.ts, journey step 13 + Forecasts screen |
| Sandbox Exchange (isolated ledger, prior-priced, back-yourself only) | Verified complete | tests/markets.test.ts, journey steps 20–21, docs/M4_EXCHANGE.md §6 |
| Institutions: club levels (venue, Federation Club), sponsorship contracts | Verified complete | tests/markets.test.ts, journey steps 22–23 |
| Censored games cancel markets; deterministic trade keys; stale-quote guard | Verified complete | tests |
| Theme system (Obsidian & Crimson default, Midnight & Gold, Ivory & Slate; 5 board palettes; Settings) | Verified complete | docs/M4_THEMES.md, tests/theme.test.ts, journey steps 2–3, screenshots |
| Federation news, championship history, season archive, rivalries | Verified complete | journey step 25 |
| Save migration v0.3.0 → v0.4.0 (DB v4, mid-season family listing) | Verified complete | tests/storage.test.ts, journey step 1 (real v0.3.0 build) |
| Player acceptance journey (28 steps) | Verified complete — 28/28 passed in Chromium on the final build, starting from a real v0.3.0 save | docs/evidence/m4/journey-log.txt, journey-results.json |
| Economy simulations (9 strategies × 3 seeds × 4 seasons) and federation (3 seeds × 40 seasons) | Verified complete (results reported; balance not claimed) | docs/M4_ECONOMY.md, docs/sim/ |
| Player route into the Federation Open (divisions 2–4) with the market conflict rule | Verified complete | tests/markets.test.ts |
| Group-stage championship format; rank titles | Not implemented | docs/M5_ROADMAP.md |
| Tournament-winner in-event trading, forecast league with funded prizes | Not implemented | docs/M5_ROADMAP.md |
| Windows launchers on Windows; physical iPhone | Not verified (no devices) | — |

## v0.3.0 phases

| Phase | Verdict | Evidence |
| --- | --- | --- |
| Baseline audit | Done | docs/V3_BASELINE_AUDIT.md |
| V3-A federation core (2,048 competitors, careers, tiered simulation, seasons) | **Complete** | tests/federation.test.ts, docs/V3_FEDERATION.md, docs/sim/economy-results.json |
| V3-B competitive career (leagues, promotion/relegation, Swiss ×2, Championship, Club Weekend, rated federation games, prizes) | **Complete** | tests/federationService.test.ts (full season), e2e/federation.mjs steps 3–7, docs/V3_COMPETITION_RULES.md |
| V3-C spectator | **Complete** | Live engine games with pause/speed/navigation/eval line, replays, result hidden until the end; e2e steps 8/12 |
| V3-C AI personalities | **Partial — 2 of 5 validated** | Opening-repertoire styles: Tactical and Positional passed behaviour (+86 / +68 pp) and strength parity (−29 / −14 Elo, 48 games); Aggressive, Defensive, Endgame failed and play Universal. docs/V3_STYLES.md, tests/styles.test.ts |
| M3 gap pass (Training Hall, spectator thinking-time clocks, 40-season federation simulation, wealth-concentration and market-maker metrics) | **Complete** | docs/M3_GAP_AUDIT.md, tests/federationService.test.ts, docs/sim/ |
| V3-D Crown Exchange (LMSR, ledger, close-before-play, settlement, research, paper forecasts, NPC traders) | **Complete** | tests/exchange.test.ts, tests/federationService.test.ts (incl. leakage), e2e steps 9–14, docs/V3_EXCHANGE.md |
| V3-D Sandbox Exchange | **Not started (documented blocker)** | docs/V3_EXCHANGE.md §8, docs/M4_PLAN.md §1; ledger isolation implemented and tested |
| V3-E wealth & prestige (finance dashboard, assets with effects/upkeep, recovery, two prestige ladders) | **Complete** | e2e steps 14–16, tests (assets, conservation), docs/V3_ECONOMY.md |
| V3-F integration (save upgrade, backups, persistence, simulations, docs) | **Complete** | e2e steps 1 and 17–18, tests/storage.test.ts v2→v3, 7-strategy × 6-season simulation |

**Player acceptance journey (directive §21): all 18 steps passed in Chromium** — docs/evidence/v3/journey-log.txt
(the save was created by the real v0.2.0 build and opened by v0.3.0 on the same origin).

## Feature status

| Area | Status | Notes |
| --- | --- | --- |
| crown-la6-v1 rules, Crown adjudication | Complete | 5,000-position oracle, perft 1–5, research fixtures (unchanged in M2) |
| Engine + workers + cancellation | Complete | crown-eval-3; L8 = strongest validated configuration |
| Strength levels with measured ratings | Complete | Engine-vs-engine only; anchor L1 = 800 is arbitrary; L8 hardware dependent |
| Rated/casual play, clocks, draws, resignation | Complete | |
| Glicko-2 pools, ledger, ranks | Complete | Rank ladder still rating-band only (crown-rank-0) |
| Game archive, Library, backups, migrations | Complete | DB v1 → v2 → v3 migrations tested; v0.2.0 → v0.3.0 upgrade verified in Chromium |
| Postgame analysis | Complete (experimental grading) | v1 map validated; bins/k/exceptional labels heuristic |
| Bookmarks, memorable moves, clock-pressure notes, batch re-analysis | Complete | |
| Crown Academy (Tactical, Rush, Calculation, Defensive, Endgame, Mistakes, Adaptive, Assessment) | Complete | Difficulty heuristic; only 3 mate puzzles |
| Intelligence Lab (10 dimensions, trends, velocity, patterns) | Complete (descriptive) | Not psychometrics; no human cohort |
| Coach + casual assistant | Complete (template-based) | |
| Chess Passport (timeline, records, memorable moves, opponents, filters, CSV) | Complete | |
| Windows launchers | Partial | Node server tested on Linux; .bat/.ps1 not executed on Windows |
| PWA / offline | Partial | Verified in desktop Chromium only; not on a physical iPhone |
| Federation (M3 scope) | Complete (v0.3.0) | See phase table above |
| Exchange / economy (M4 scope) | Complete except Sandbox Exchange | See phase table above |
| M5 release polish | Not started | |

## Known limitations

- No human playing data: level ratings, puzzle difficulty and grade thresholds are not calibrated on humans.
- The engine remains roughly an order of magnitude less efficient per node than Fairy-Stockfish.
- Only two opponent styles (Tactical, Positional) are validated, and they shape the first six plies only (docs/V3_STYLES.md).
- No tournament-winner markets and no in-match trading (docs/M4_PLAN.md).
- Background (tier-3) federation results are summary results from a fitted model, not games.
- Economy simulation samples player/featured results instead of playing them; 6 seasons, one seed per strategy.
- Featured-game speed depends on hardware; an "Advance" with three unwatched featured games takes ~5–20 s.
- Sandbox Exchange not implemented. No human playtesting of the federation's pacing or difficulty.
- Static threat detection in the Lab misses deeper threats; motif labels are geometric heuristics.
- Browser storage may be evicted; backups are manual. Multi-tab writes rely on Web Locks.
- No formal screen-reader audit; keyboard navigation and contrast were checked (docs/DESIGN.md).
- Windows and iPhone were not available for testing.
