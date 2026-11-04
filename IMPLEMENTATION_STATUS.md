# Implementation status — v0.9.0 "The Living Federation"

The sections after "v0.9.0" below were written for v0.6.0-preview.1 and remain accurate unless a v0.9 row says
otherwise. Release reports: docs/V8_SOVEREIGN_STANDARD.md (v0.8.0), docs/V9_LIVING_FEDERATION.md (v0.9.0).

## v0.9.0

| Feature | State | Evidence |
|---|---|---|
| Automatic iPhone (PWA) updates: background download, safe switch, "Restart to Update", build identity | V (Chromium) | `e2e/pages-check.mjs` 12/12; physical iPhone NOT RUN |
| Federation Dashboard landing page | V | `e2e/dashboard.mjs` 10/10 |
| Live match scheduler (background AI games, resume, adaptive capacity) | V (services) / U (Live Now panel UI) | `tests/scheduler.test.ts`; docs/FEDERATION_SCALE.md |
| 4,096-competitor topology | U (implemented and tested, off by default) | docs/FEDERATION_SCALE.md |
| 10,000+ competitors | N (misses the round-time target) | docs/FEDERATION_SCALE.md §1.4 |
| Live odds crown-odds-2 (rating-aware) | V | docs/ODDS_MODEL.md (800 held-out games) |
| Full-game styles: Tactical, Positional, Defensive, Endgame | V | docs/STYLES_REPORT.md; Aggressive N (failed validation) |
| Engine speed (+38 % nodes/s, identical search; +41 [12, 71] Elo at equal time) | V | docs/ENGINE_OPTIMIZATION_PLAN.md |
| The Sovereign's Grimoire + Academy integration + endgame solver | V | docs/GRIMOIRE_VERIFICATION.md |
| Replay centre, eval bar, trophies, banners, Trophy Hall, achievement families | N (next milestone) | — |

## v0.6.0-preview.1 (v0.5.0 "Sovereign Intelligence" + M6 Live Arena addendum)

Labels: **V** verified complete (automated test or executed browser journey on the final build) ·
**U** implemented but unverified · **P** partial · **N** not implemented. Physical iPhone and Windows were
**NOT RUN** (no hardware in the build environment); "Chromium" means desktop Chromium, including 390 px phone
emulation, which is not a device test.

Input note: the directive's "Sovereign research package" (documents 00–17, J1–J6 journeys, registered statistical
protocol) was not provided to this environment. The repository's earlier research package (docs/research) was
used; J1–J6 could not be executed as written (see docs/V5_BASELINE_AUDIT.md).

## Chess and engine

| Feature | State | Evidence |
|---|---|---|
| crown-la6-v1 rules, adjudication, clocks | V | `tests/rules*.ts`, `tests/session.test.ts`, independent perft oracle |
| One intelligence foundation (crown-search-2 + crown-eval-4) for play, Max, federation, assistant, analysis, puzzles, Academy, Lab | V | `tests/engine.canonical.test.ts`; docs/V5_ENGINE.md |
| Sovereign Max (L9): no handicap, 2^20 table, 5/10/20/40 s budgets, recorded configuration | V | +112 Elo [60, 163] vs L8 (64 games, time-scaled); `e2e/v5-journey.mjs` step 2 |
| Engine provenance on every move/assist result and in game records | V | `tests/engine.canonical.test.ts`; journey step 2 |
| Scheduling: foreground priority, cancellation, stale-result discard, event log | V | journey step 26; `src/engine/client.ts` |
| Engine-commitment record for federation events | V | journey step 25 (`world.engineCommitments`) |
| Fairy-Stockfish as a shipped backend | N (by decision) | GPL-3.0, threads/COOP-COEP, memory — docs/V5_ENGINE.md |
| Full-game AI personalities | V in v0.9 for Tactical, Positional, Defensive, Endgame (Aggressive N) | docs/STYLES_REPORT.md (crown-styles-5); earlier failure: docs/M4_ENGINE_STRENGTH.md §8 |

## Analysis, Academy, Lab

| Feature | State | Evidence |
|---|---|---|
| Outcome map v2 refitted for the canonical engine, held-out validated | V | docs/V5_ANALYSIS_CALIBRATION.md |
| Grading v2 (Great/Brilliant guards), accuracy bounded 0–100, not presented as IQ | V | `tests/grades.corpus.test.ts` (v2 + legacy v1 corpora); journey step 6 |
| Historical reports preserved and labelled; re-analysis adds a new report | V | journey step 6a; v0.4 defect fixed (jobs keyed by engine version) |
| Puzzle library re-verified (405 active, 79 retired, 12 shortened; best-defence check) | V | `tools/academy/reverify_canonical.ts`; `tests/academy.test.ts`; journey step 9 |
| Lab never mixes methodologies; no confirmed-improvement badge without evidence | V | `tests/history100.test.ts`; journey step 10 |
| Grade bins and k calibrated on human outcomes | N | no human data; labelled experimental |

## Ratings, federation, career

| Feature | State | Evidence |
|---|---|---|
| Glicko-2, exactly-once updates, permanent history | V | `tests/ratings.test.ts`, `tests/storage.test.ts`; journey steps 4–5 |
| 2,048 competitors, leagues, Swiss, knockout championship, promotion/relegation | V | `tests/federation*.ts`; `e2e/m4-journey.mjs` |
| Featured rivals, rivalries from events, fictional norm-based titles, ceremonies, Hall of Fame | V | M5 addendum; `e2e/m5-heraldry.mjs` 11/11 |
| Career Passport: six separate records, eligibility, requirements, rivalries, finances, forecasting | V | journey steps 11, 22 |
| Spectator: move-by-move, pause, speed, review, live evaluation, replays | V | `e2e/m4-journey.mjs` steps 11–17 |
| Spectator browsing/filtering of many simultaneous live matches | P | three featured engine games per round; other results are summary results by design |

## M6 addendum: Sovereign Live Arena

| Feature | State | Evidence |
|---|---|---|
| One dashboard: board, players, thinking clocks, notation, evaluation graph, odds + history, portfolio, replay controls; phone tabs | V | `e2e/m6-arena.mjs` 11/11; docs/M6_LIVE_ARENA.md |
| Information policy: published evaluation only while trading; labels/deep analysis only after settlement | V | journey steps 1b, 6 |
| Market revision per published move; stale quotes and duplicate steps rejected | V | `tests/arena.test.ts`; journey steps 3–4 |
| Settlement, post-game analysis, replay after restart, offline replay | V (Chromium) | journey steps 5–9 |
| Main M6 "Crown Legacy" features (e.g. 16 Circuit Grades) | N | the main M6 prompt was not provided |
| Physical iPhone run of the Arena | NOT RUN | no device |

## Exchange and economy

| Feature | State | Evidence |
|---|---|---|
| LMSR match, champion, promotion, qualification, season, conditional final-four markets | V | `tests/exchange*.ts`, `tests/markets.test.ts`; `e2e/m4-journey.mjs` |
| Live in-play trading windows; settlement; sandbox separation | V | `tests/markets.test.ts`; m4 journey steps 11–21 |
| Funded worst-case subsidy holds in long simulations | V | `subsidyBoundViolations` in the sweep (docs/V5_INTEGRITY_REPORT.md) |
| Cosmetic unlockables (bought → sink, or earned; never strength/titles) | V | `tests/cosmetics.test.ts`; journey step 21 |
| Institutions (club levels, venue, contracts), recovery voucher | V | `tests/markets.test.ts`, `tests/federationService.test.ts` |
| Multi-seed 20-season economy sweep | V | 10 strategies × 3 seeds × 20 seasons; findings: business paths lose money, chess strength dominates (docs/V5_INTEGRITY_REPORT.md) |

## Platform and data

| Feature | State | Evidence |
|---|---|---|
| Save migration v0.4.0 → v0.5.0 without loss; rollback to v0.4.0 opens the career | V (Chromium) | journey step 25 and rollback step |
| Export/import continuity | V (Chromium) | journey step 24 |
| Offline restart and offline engine move | V (Chromium) | journey step 27 |
| Windows launcher keeps one origin (reuses a running game; loud warning if it must change port) | U on Windows / V on Linux | `scripts/serve.mjs` tested here; PowerShell path not executed |
| Accessibility: named controls, labelled SVGs, keyboard focus, no overflow at 390 px | V (automated checks) | journey step 28; screen-reader pass NOT RUN |
| Physical iPhone (install, offline cold start, suspend/resume, memory pressure) | NOT RUN | no device |
| Windows 10/11 launcher on real hardware | NOT RUN | no device |

---

# Previous status (v0.4.0, kept unchanged for history)

Last updated: 2026-11-03 · app **0.4.0 (“The Grand Exchange”)** · rules crown-la6-v1 1.0.0 · engine crown-search-1 + crown-eval-3 ·
levels crown-levels-2 · analysis crown-grade-v1-experimental / crown-accuracy-v1 · federation crown-federation-1 ·
exchange crown-exchange-2 · markets crown-markets-2 · forecasts crown-forecast-1 · economy crown-economy-1 (+ institutions) · save schema DB v4

Legend: **Complete** = implemented and verified by the named evidence. **Partial** = works with stated gaps.
**Not started** = planned only. Nothing is marked complete because it compiles or because a button exists.

### Correction to the v0.1.0 status

v0.1.0 marked M1 complete, but its level calibration had never been run, so Rated mode was disabled and no
rated game had ever been verified (docs/M2_BASELINE_AUDIT.md). M2 fixed this: levels were redesigned and
calibrated (500 games) and a strict rated browser journey now passes.

### M2 gates

| Gate | Verdict | Evidence |
| --- | --- | --- |
| A — engine strength | **Passed (modest)**: +66 Elo replicated on held-out openings (crown-eval-3); four other candidate changes rejected after failing replication; ladder redesigned from cliffs to 80–92% steps. Not detectable against the Fairy-Stockfish reference at 64 games. | docs/M2_ENGINE_STRENGTH.md, docs/ENGINE_BENCHMARKS.md |
| B — analysis | **Passed with disclosed limits**: expected-score map crown-outcome-map-v1 beats the placeholder on held-out opening families (Brier −0.0020…−0.0048, ECE 0.042 → 0.011); grade regression corpus re-analysed in tests; negative fixtures (forced move, recapture, unsound sacrifice). Grade bins, k = 4 and Great/Brilliant remain heuristic/experimental and are labelled so. | docs/M2_ANALYSIS_CALIBRATION.md, tests/grades.corpus.test.ts, tests/analysis.test.ts |
| C — postgame | **Passed**: saved games reopen, analyse, navigate, explore variations, bookmark/mark memorable, and re-analyse as a new immutable report version (batch too); original records never change. | e2e/run.mjs, tests/storage.test.ts |
| D — Academy | **Passed**: 484 engine-verified puzzles (reproducible verification), 8 playable modes with stored progress; held-out split never served in practice. | docs/M2_ACADEMY_VALIDATION.md, tests/academy.test.ts, e2e/academy.mjs |
| E — intelligence lab | **Passed**: 100-game fixture history yields coherent, traceable dimensions with insufficient-evidence states; methodology separation verified. | docs/M2_INTELLIGENCE_METHODOLOGY.md, tests/history100.test.ts |
| F — coach | **Passed with limits**: notes cite engine lines and positions; recurring patterns need ≥ 5 occurrences in ≥ 3 games; casual assistant (hint, candidates, threat check, evaluation, explanation) is refused by the game state in rated games and makes casual games permanently assisted. Explanations are template + motif based, not natural-language coaching. | src/academy/coach.ts, src/academy/lab.ts, tests/session.test.ts, e2e/run.mjs |
| G — rated integrity | **Passed in Chromium**: eligible rated start, assistant locked, legal finish, single Glicko-2 update, duplicate finalization rejected, pool isolation, restart persistence, assisted game unrated. | e2e/run.mjs, docs/evidence/e2e-log.txt |

### v0.4.0 — The Grand Exchange

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

### v0.3.0 phases

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

### Feature status

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

### Known limitations

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
