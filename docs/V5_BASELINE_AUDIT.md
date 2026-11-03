# v0.5.0 "Sovereign Intelligence" — Phase 0 baseline audit

Audited on 2026-11-03 at commit `1d6cdcd` (branch `claude/fervent-brahmagupta-fnui2e`). Version in
`package.json`: **0.4.0**, plus the M5 heraldry addendum committed on top of it (not yet a version bump).
The target of this release is therefore **0.5.0**.

## Inputs actually available

* The directive's "Sovereign research package" (documents 00–17, raw results, J1–J6 journeys, registered
  statistical protocol) was **not present** in the container: `/mnt/attach` and `/mnt/user-data/uploads` are
  empty and no file named *sovereign* exists anywhere. The repository's `docs/research/` holds the earlier
  research package (01–18, reviews, `requirements/INTELLIGENCE_EXPANSION.md`); that is what this release
  follows. The J1–J6 journeys and the package's registered improvement-badge protocol could therefore **not
  be executed as written**; the nearest repository equivalents are used and named where they apply.
* No `AGENTS.md` exists in the repository. No `IMPLEMENTATION_STATUS.md` existed before this release
  (status was spread across README, TESTING and the milestone documents); this release creates one.

## Baseline commands (executed)

| Command | Result |
|---|---|
| `npx tsc -b` | pass |
| `npx vitest run` | **171 / 171** passed (22 files) |
| `npm run build` | pass (main chunk 700 kB, 222 kB gzip) |
| `node e2e/m5-heraldry.mjs` | 11 / 11 (same day, final M5 build) |
| `node e2e/m4-journey.mjs <v0.3.0 dist>` | 28 / 28 (same day, v0.4.0 build) |

## Source-grounded inventory

Legend: **V** verified complete (test or executed journey) · **U** implemented but unverified · **P** partial ·
**M** missing · **B** broken or regressed.

| Area | State | Evidence / gap |
|---|---|---|
| crown-la6-v1 rules (6×6, RNQKNR, no bishops/castling/double step/e.p., promotion Q/R/N) | V | `tests/rules*.ts`, perft vs. independent oracle, Fairy-Stockfish perft 1–5 |
| Draw/timeout/resignation/repetition/adjudication | V | `src/rules/adjudication.ts`, `tests/rules.test.ts`, `tests/session.test.ts` |
| Play engine crown-search-2 + crown-eval-4, levels crown-levels-3 (L1–L8) | V | docs/M4_ENGINE_STRENGTH.md, calibration.json |
| **One shared intelligence foundation** | **B (split)** | Play uses search-2 + eval-4; analysis, assistant, puzzle verification, Academy and Lab use search-1 + eval-3 (`Searcher` defaults). Directive Phase 3 makes this a blocker. |
| Engine provenance on requests/results | P | Game records store `searchId/evalId/levelsId`; **federation and engine games are tagged with the analysis ids** (`SEARCH_ID`/`EVAL_ID`) although played by the play engine (known mislabel, M4 report). No per-request provenance, no rules hash, no purpose/budget record. |
| Engine scheduling | P | `EngineChannel` per role with generation-guarded cancellation (terminate + discard stale). No broker, no priority between roles, no record of cancellations. |
| Maximum strength tier | P | L8 "Crown": clock-limited ≤ 6 s/move, 2^18 TT. No configurable thinking budget, no displayed configuration. |
| Fairy-Stockfish | — | Evaluated in M4; GPL-3.0, pthreads/COOP-COEP, 128 MiB memory → dev-only reference (decision I38). |
| Analysis calibration | P | Outcome map v1 validated held-out (for eval-3); grade bins and k are documented placeholders. |
| Puzzle library verification | V (for eval-3) | `tools/academy/verify_puzzles.ts`; not re-verified with the play engine. |
| Rated-game assistance lock, assisted flag | V | `tests/session.test.ts`, e2e |
| Glicko-2 ratings, exactly-once updates | V | `tests/ratings.test.ts`, rating ledger idempotency |
| Federation: 2,048 competitors, 8 divisions × 16 regions, leagues, Swiss, KO championship | V | `tests/federation*.ts`, `tests/history100.test.ts`, journeys |
| Featured rivals, rivalries, fictional titles, clubs, ceremonies, Hall of Fame | V | M5 addendum, docs/M5_HERALDRY.md |
| Spectator: move-by-move, pause, speed, review, evaluation, live trading | V | m4 journey steps 11–17 |
| Spectator: browsing/filtering many live matches | P | Three featured matches per round; other results are summary results by design (I16). |
| Exchange (LMSR, families, conditional, live, forecasting, sandbox) | V | `tests/exchange*.ts`, `tests/markets.test.ts`, m4 journey |
| Economy simulation | P | 9 strategies × 3 seeds × 4 seasons + one 8-season run; directive asks ≥ 20 seasons. |
| Career Passport | P | Career timeline, records, opponents and CSV export exist; federation titles, trophies, rivalries, net worth and forecasting are on other screens, not in the Passport. |
| Cosmetic unlockables | P | Themes and board palettes are free settings; nothing to earn or buy cosmetically. |
| Save export/import, DB migrations v1→v4 | V | `tests/storage.test.ts`, `src/storage/backup.ts`, journeys from real older builds |
| **Windows launcher port fallback** | **B** | `scripts/serve.mjs` and `Start-Crown.ps1` silently take the next free port when 5173 is busy; a different port is a different IndexedDB origin, so the player sees an empty career. |
| Offline PWA | V (Chromium) | `e2e/offline.mjs`, m4 step 28 |
| Physical iPhone, Windows | **not run** | no hardware in this environment |

## Save preservation plan

* Fixtures: a save produced by the real v0.4.0 build (commit `d4dbbe6`, before the heraldry addendum) is
  created in Phase 7 and loaded by the v0.5.0 build on the same origin; journals, markets, positions,
  balances, ratings and game records are compared byte for byte.
* No federation regeneration and no economy reset. New fields are optional and added lazily.
* Historical analysis reports keep their engine and grading fingerprints; new reports get new ids (the report
  id already embeds the engine build and grading id), so both coexist.
