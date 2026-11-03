# Test results (M2, v0.2.0)

Run on 2026-11-03 in a cloud Linux container (4 cores, Node 22.23.4, Playwright 1.63 headless Chromium).
No Windows machine or physical iPhone was available.

## Automated suites — `npx vitest run`: **103 / 103 passed** (12 files, 123 s)

| File | Tests | What it covers |
| --- | --- | --- |
| tests/rules.test.ts | 26 | start position, perft 1–5, no double step/castling/en passant, Q/R/N promotion, pins, king adjacency, check evasion, make/unmake + hash, SAN/CCN, every Crown adjudication rule incl. mate precedence and Crown timeout, colour-mirror metamorphic perft |
| tests/rules.oracle.test.ts | 3 | 5,000 pyffish 0.0.90 positions: identical legal-move sets and 47,884 identical successor states |
| tests/rules.research.test.ts | 2 | the research package's 20 replay games state-for-state and its benchmark positions |
| tests/engine.test.ts | 12 | mates, tactics, promotion, TT mate scores, SEE, node/time limits, legal PVs on 300 positions, repetition, level bounds, seeded reproducibility, time allocation |
| tests/analysis.test.ts | 17 | all grade bins and boundaries, all 8 labels reachable, forced/recapture/unsound-sacrifice gating, uncertainty, mate handling, v0/v1 maps (monotone, bounded), phases, ply alignment, partial (cancelled) reports, report versioning, exchange-is-not-a-sacrifice |
| tests/grades.corpus.test.ts | 1 | 26 real-position fixtures re-analysed: identical labels for all 8 grades + forced, recapture and unsound-sacrifice negatives |
| tests/session.test.ts | 12 | clocks/increment/flags/pauses, timeout rules, rated eligibility, assistance refused in rated games, draw agreement, fivefold, underpromotion records, replay from record |
| tests/storage.test.ts | 6 | atomic + idempotent finalization under concurrent retries, casual games unrated, persistence across reopen, backup round trip, tamper rejection, v1 → v2 migration |
| tests/ratings.test.ts | 8 | Glickman reference example, inactivity, opponent strength, volatility bounds, provisional rule, ledger replay |
| tests/academy.test.ts | 11 | 484 puzzles legal, no duplicates, no split leakage, held-out never in practice, assessment exhaustion, first-exposure statistics, adaptive gating, engine re-verification sample, motif detectors, Beta interval |
| tests/history100.test.ts | 4 | Gate E: 100 real games + reports + rating events → coherent, traceable Lab output; exclusions; trend/velocity; recurring-pattern rule; sparse-history honesty |
| tests/archive.test.ts | 1 | 10,000-game Library index built, filtered and sorted in < 1 s |

Typecheck (`tsc -b`): pass. Production build (`vite build`): pass — app 360 kB (115 kB gzip), engine worker
41 kB, puzzle bank as a lazily loaded 272 kB chunk (38 kB gzip).

## Browser journeys (production build, `node scripts/serve.mjs --port 4173`)

| Script | Result | Evidence |
| --- | --- | --- |
| `e2e/run.mjs` — rated acceptance journey (Gate G) | **PASS** | docs/evidence/e2e-log.txt, 01–12 screenshots |
| `e2e/academy.mjs` — Academy play + persistence | **PASS** | docs/evidence/academy-log.txt, 20–23 |
| `e2e/offline.mjs` — service worker, offline reload, engine move | **PASS** (Chromium) | docs/evidence/offline-log.txt, 11 |
| `e2e/screens.mjs` — 6 screens × desktop/phone, no horizontal overflow | **12 / 12 ok** | docs/evidence/m2-*.png |
| `e2e/browser-bench.mjs` — engine speed in a Web Worker | measured | tools/bench/results/browser-speed.json |

The rated journey verifies, in one real browser session: eligible rated start (game state `rated: true,
pool: rapid`), assistant locked and absent, a complete legal game (the "human" side is a scripted robot
clicking moves chosen by the Crown engine in Node), result overlay, exactly one rating event, a forced
duplicate finalization that changes nothing, blitz pool untouched, analysis complete and navigable,
candidate-line exploration and return, rating history row, browser closed and reopened with game, rating
and report intact, and an assisted casual blitz game that stays unrated.

## Engine and analysis measurements

docs/ENGINE_BENCHMARKS.md (generated from tools/bench/results), docs/M2_ENGINE_STRENGTH.md,
docs/M2_ANALYSIS_CALIBRATION.md (generated from tools/calibration/fit-results.json).

## Not tested

- Windows: `Start-Crown.bat` / `Start-Crown.ps1` were not executed (no Windows host; installing PowerShell
  in the container was not permitted). The Node server they call was tested (port fallback, MIME types,
  path traversal).
- iPhone Safari / home-screen PWA, touch hardware, suspend/resume on iOS.
- Screen readers; 200% text zoom.
- Human play: no human playtests or human-calibrated ratings.
