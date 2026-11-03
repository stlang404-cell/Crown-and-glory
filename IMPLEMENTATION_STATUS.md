# Implementation status

Last updated: 2026-11-03 · app 0.1.0 · rules crown-la6-v1 1.0.0 · engine crown-search-1 + crown-eval-2

Legend: **Complete** = implemented and verified by the tests/evidence named. **Partial** = works but
with stated gaps. **Not started** = planned only (docs/ROADMAP_M2_M5.md).

## M0 — Foundation: COMPLETE

| Requirement | Status | Evidence |
| --- | --- | --- |
| Repository architecture (rules/engine/games/ratings/analysis/academy/federation/exchange/storage/ui) | Complete | `src/*`; domain modules have no React dependency |
| Exact crown-la6-v1 rules, FEN, CCN + SAN notation | Complete | tests/rules.test.ts (26 tests) |
| Independent rules verification | Complete | 5,000 pyffish 0.0.90 positions: legal move sets and 47,884 successor states identical (tests/rules.oracle.test.ts); perft 1–5 = 10/100/1212/14332/191846, depth 5 confirmed with a native Fairy-Stockfish build; all 20 research replay games reproduce state-for-state (tests/rules.research.test.ts); colour-mirror metamorphic perft |
| Crown adjudication: mate, stalemate, bare kings, threefold/100 claims, fivefold/150 automatic, mate precedence, Crown timeout, agreement after 10 moves | Complete | tests/rules.test.ts, tests/session.test.ts |
| Chessboard, legal-move handling, promotion picker | Complete | e2e journey (docs/evidence), screenshots |
| Design system | Complete (initial) | src/ui/styles.css, original SVG pieces and pixel portraits |
| Persistence foundation, versioned schema, migration registry | Complete | src/storage/db.ts, tests/storage.test.ts |
| Test infrastructure | Complete | Vitest (85 tests), Playwright journeys, benchmark harness |

## M1 — Playable competitive chess: COMPLETE (with limitations below)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Real local engine in a Web Worker (ID, PVS, aspiration, TT, quiescence with check evasions, SEE, killers/history, null move, LMR, futility, mate distance, repetition-aware, time/node limits, PV, diagnostics, cancellation) | Complete | tests/engine.test.ts; ablations in docs/ENGINE_BENCHMARKS.md |
| Engine legality guarantee | Complete | Worker rejects any non-legal move; PVs validated; 300-position legality test; 0 illegal moves in all benchmark games |
| Multiple difficulty levels with measured ratings | Complete | 8 levels; calibration in src/engine/calibration.json (engine-vs-engine only) |
| Benchmark harness and results | Complete | tools/bench, docs/ENGINE_BENCHMARKS.md |
| Clocks, increments, flagging, pause on suspension | Complete | tests/session.test.ts |
| Rated and casual matches; resignation; draw offers and claims; restart/rematch | Complete | UI + tests |
| Glicko-2 (reference example reproduced), per-pool ledger, exactly-once updates | Complete | tests/ratings.test.ts, tests/storage.test.ts (concurrent retry test), e2e |
| Permanent game archive, Library search/filter/sort/pagination, replay, export | Complete | e2e; 10,000-game index test |
| Backup export/import with validation | Complete | tests/storage.test.ts (round trip, tamper rejection) |
| Initial engine postgame analysis (grades, accuracy, PVs, critical positions, coach notes, report versions, cancellation) | Complete, **experimental methodology** | tests/analysis.test.ts; e2e |
| Rating history and career statistics | Complete | Career screen, e2e |
| Playable Windows build | Partial | `Start-Crown.bat` / `Start-Crown.ps1` + `scripts/serve.mjs`; the Node server (port fallback, MIME types, traversal protection) was tested on Linux; **the .bat and .ps1 files were not executed on Windows** |
| PWA/offline | Partial | Manifest + generated service worker; offline reload and engine play verified in Chromium (e2e/offline.mjs). **Not tested on a physical iPhone.** |
| Final acceptance journey (directive §18) | See docs/TESTING.md | e2e/run.mjs |

## Known limitations (M1)

- Accuracy and grade thresholds are the research placeholders (s = 200 cp, k = 4, fixed bins) and are
  **not calibrated** for 6×6 chess; every report says so. Brilliant/Great are heuristic.
- Engine strength is far below Fairy-Stockfish per node (see benchmarks). No human-strength or FIDE
  claim is made. Level ratings are engine-vs-engine, anchored arbitrarily at L1 = 800; L8 is time
  limited and therefore hardware dependent.
- Opponent "styles" are not differentiated (research experiment D was negative); every opponent says so.
- Rank ladder is rating-band only (crown-rank-0) until federation events exist (M3).
- Multi-tab: second tabs are read-only via Web Locks; browsers without Web Locks have no lease.
- Browser storage can be evicted (especially Safari); backups are manual.
- Accessibility: keyboard board navigation, ARIA labels, reduced motion, colour-independent grade
  symbols are implemented; no formal screen-reader or contrast audit has been performed.

## M2 – M5: NOT STARTED (architecture prepared)

| Milestone | Status |
| --- | --- |
| M2 calibrated analytics, ten-skill lab, coach, academy | Not started. M1 foundations: versioned reports, coach notes, Lab screen with descriptive evidence only |
| M3 federation (2,048 competitors, leagues, tournaments, spectating) | Not started. M1 roster of 8 calibrated opponents |
| M4 exchange (LMSR, ledger, Sandbox Exchange), economy, clubs | Not started |
| M5 release polish, device validation | Not started |
