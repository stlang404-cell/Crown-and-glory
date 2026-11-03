# Implementation status

Last updated: 2026-11-03 · app 0.2.0 (M2) · rules crown-la6-v1 1.0.0 · engine crown-search-1 + crown-eval-3 ·
levels crown-levels-2 · analysis crown-grade-v1-experimental / crown-accuracy-v1 · save schema DB v2

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

## Feature status

| Area | Status | Notes |
| --- | --- | --- |
| crown-la6-v1 rules, Crown adjudication | Complete | 5,000-position oracle, perft 1–5, research fixtures (unchanged in M2) |
| Engine + workers + cancellation | Complete | crown-eval-3; L8 = strongest validated configuration |
| Strength levels with measured ratings | Complete | Engine-vs-engine only; anchor L1 = 800 is arbitrary; L8 hardware dependent |
| Rated/casual play, clocks, draws, resignation | Complete | |
| Glicko-2 pools, ledger, ranks | Complete | Rank ladder still rating-band only (crown-rank-0) |
| Game archive, Library, backups, migrations | Complete | DB v1 → v2 migration tested |
| Postgame analysis | Complete (experimental grading) | v1 map validated; bins/k/exceptional labels heuristic |
| Bookmarks, memorable moves, clock-pressure notes, batch re-analysis | Complete | |
| Crown Academy (Tactical, Rush, Calculation, Defensive, Endgame, Mistakes, Adaptive, Assessment) | Complete | Difficulty heuristic; only 3 mate puzzles |
| Intelligence Lab (10 dimensions, trends, velocity, patterns) | Complete (descriptive) | Not psychometrics; no human cohort |
| Coach + casual assistant | Complete (template-based) | |
| Chess Passport (timeline, records, memorable moves, opponents, filters, CSV) | Complete | |
| Windows launchers | Partial | Node server tested on Linux; .bat/.ps1 not executed on Windows |
| PWA / offline | Partial | Verified in desktop Chromium only; not on a physical iPhone |
| M3 federation | Not started | Contracts and plan: docs/M3_IMPLEMENTATION_PLAN.md |
| M4 exchange / economy (incl. Sandbox Exchange) | Not started | Design constraints preserved in docs/ROADMAP_M2_M5.md |
| M5 release polish | Not started | |

## Known limitations

- No human playing data: level ratings, puzzle difficulty and grade thresholds are not calibrated on humans.
- The engine remains roughly an order of magnitude less efficient per node than Fairy-Stockfish.
- Opponent styles are not differentiated (no measured behavioural difference yet).
- Static threat detection in the Lab misses deeper threats; motif labels are geometric heuristics.
- Browser storage may be evicted; backups are manual. Multi-tab writes rely on Web Locks.
- No formal screen-reader audit; keyboard navigation and contrast were checked (docs/DESIGN.md).
- Windows and iPhone were not available for testing.
