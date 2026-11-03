# Test results (v0.4.0 — The Grand Exchange)

Run on 2026-11-03 in a cloud Linux container (4 cores, Node 22, Playwright headless Chromium). No Windows machine
or physical iPhone was available. Every result below was executed in this session.

## Automated suites — `npx vitest run`: **VITEST_COUNT**

New or extended in v0.4.0:

| File | What it covers |
| --- | --- |
| tests/exchange2.test.ts | n-state LMSR under randomized adversarial trading (16-state tournament markets, the 8-state final-four model with overlapping conditional claims, prior-priced sandbox markets): solvency after every trade, conservation, maker loss ≤ funded subsidy for every unit vector, joint splits and cancellation; canonical claims; complete-set identity; non-simplex payouts and double resolution rejected; models never move inventory |
| tests/markets.test.ts | model coherence (knockout, bracket, final four); a full season of every family through the service (listing, closure before the closing round, settlement from recorded results, consistency between the champion and final-four markets, conservation); live in-play trading (windows, NPC reaction, stale-quote rejection, resume after reload, no trading after the end); Sandbox isolation and anti-exploit rules; institutions (upgrade escrow, contracts, conflict-of-interest block, prize shares = 25% exactly); mid-season migrated saves; the player's Federation Open route and its market-cancellation conflict rule |
| tests/storage.test.ts | + DB v3 → v4 migration |
| tests/theme.test.ts | theme/board ids known to the pre-paint script; preference storage fallbacks |
| tests/styles.test.ts, tests/engine*.ts | see docs/M4_ENGINE_STRENGTH.md |

Typecheck (`tsc -b`): pass. Production build (`vite build`): pass. Contrast audit (`node tools/contrast/check-themes.mjs`): all pairs pass.

## Browser journeys

| Script | Result | Evidence |
| --- | --- | --- |
| `e2e/m4-journey.mjs` — **v0.4.0 player acceptance journey, 28 steps**, from a save made by the real v0.3.0 build on the same origin | JOURNEY_RESULT | docs/evidence/m4/journey-log.txt, journey-results.json, screenshots (desktop + 390 px phone, no horizontal overflow) |
| `e2e/federation.mjs` (v0.3.0 journey), `e2e/run.mjs`, `e2e/academy.mjs`, `e2e/offline.mjs` | REGRESSION_RESULT | docs/evidence/ |
| `e2e/m4-themes.mjs` — every theme × key screens × desktop/phone | pass (theme workstream) | docs/evidence/m4-themes/ |

## Simulations

`tools/sim/economy.ts` — 9 strategies × 3 seeds × 4 seasons + an 8-season convergence run (docs/M4_ECONOMY.md);
`tools/sim/federation.ts` — 3 seeds × 40 seasons (docs/M4_ECONOMY.md §4); `tools/bench/analysis_speed.ts`;
`tools/styles/validate.ts`; engine benchmarks in docs/M4_ENGINE_STRENGTH.md.

## Not tested

Windows launchers on Windows; physical iPhone/iPad; screen readers; human playtesting.

---

# Earlier results (v0.3.0)

Run on 2026-11-03 in a cloud Linux container (4 cores, Node 22.23.4, Playwright headless Chromium).
No Windows machine or physical iPhone was available.

## Automated suites — `npx vitest run`: **139 / 139 passed** (16 files, 163 s; after the M3 gap pass)

New in v0.3.0 (the M2 suites below still pass unchanged):

| File | Tests | What it covers |
| --- | --- | --- |
| tests/federation.test.ts | 11 | deterministic 2,048-competitor generator, round robin (colour balance), standings/tiebreaks, Swiss pairing without repeats, knockout termination incl. joint final, Davidson model, a full headless season, determinism, player joining, 4-season population stability |
| tests/exchange.test.ts | 12 | LMSR prices/gradient, log-sum-exp stability, no complete-set arbitrage, directed rounding, 4,500 random trades with solvency and bounded maker loss for every outcome, idempotent settlement, no shorting/unfunded buys, cancellation, sandbox/official isolation, quotes, NPC traders use only public forecasts |
| tests/federationService.test.ts | 8 | creation/persistence, rated player fixture recorded once (contradicting retry ignored), trade → market closed before the game exists → settlement, full season (prizes from escrow, sponsors once, issuance only via mint entries, competitor expense sink, conservation and non-negativity every round), stale/duplicate commands and simulated crash leave state unchanged, assets/upkeep/net worth, mid-season backup export/import + tampered-ledger rejection, no forecast leakage from hidden strength |
| tests/storage.test.ts | +1 | DB v2 → v3 migration keeps games, ratings and Academy data |
| tests/styles.test.ts | 3 | every repertoire move legal and within 30 cp of the best; seeded choices stay in the book; universal/endgame never use it; only validated styles are played |
| tests/federationService.test.ts | +1 | Training Hall sparring is unrated, uses the opponent's exact profile and never becomes a federation result |

Typecheck (`tsc -b`): pass. Production build (`vite build`): pass.

## Browser journeys (production build)

| Script | Result | Evidence |
| --- | --- | --- |
| `e2e/federation.mjs` — **v0.3.0 / M3 player acceptance journey, all 18 steps** (+ Training Hall sparring and spectator thinking-time checks), starting from a save made by the real v0.2.0 build on the same origin | **PASS** | docs/evidence/v3/journey-log.txt, docs/evidence/v3/*.png (desktop + 390 px phone, no horizontal overflow) |
| `e2e/run.mjs` — rated acceptance journey (Gate G) | **PASS** (re-run on v0.3.0) | docs/evidence/e2e-log.txt |
| `e2e/academy.mjs` — Academy | **PASS** (re-run on v0.3.0) | docs/evidence/academy-log.txt |
| `e2e/offline.mjs` — service worker, offline engine move | **PASS** (re-run on v0.3.0, Chromium) | docs/evidence/offline-log.txt |

The federation journey plays 14 complete rated games through the UI (one in v0.2.0, thirteen federation
games across eight rounds), watches a full engine game live, trades, settles, buys an asset, closes and
reopens the browser and compares every federation, finance, rating and game value before and after.

## Simulations

`tools/sim/economy.ts` — 7 strategies × 6 seasons through the real service: conservation and non-negative
balances in all 42 strategy-seasons; results and interpretation in docs/V3_ECONOMY.md.
`tools/sim/federation.ts` — 40 seasons headless: rating stability, mobility, careers, champion diversity (docs/V3_FEDERATION.md §7).
`tools/styles/validate.ts` — style behaviour/strength validation (400 walks + 48 parity games per style); results in docs/V3_STYLES.md.

---

# Earlier results (M2, v0.2.0)

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
