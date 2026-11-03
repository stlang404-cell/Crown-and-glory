# v0.3.0 baseline audit

Audited commit `70746c1` (v0.2.0), 2026-11-03, cloud Linux container (4 cores, Node 22.23.4, Chromium 1.63).
No `AGENTS.md` exists. Working tree clean and identical to the remote branch.

| Check | Result |
| --- | --- |
| `tsc -b` | pass |
| `vitest run` | **103 / 103** pass (117 s) |
| `vite build` | pass (app 360 kB, worker 41 kB, puzzle chunk 272 kB) |
| `e2e/run.mjs` rated journey (Gate G) | pass (after restarting the preview server, which was not running) |
| Federation code | `src/federation/roster.ts` only: 8 fixed opponents bound to engine levels |
| Exchange code | `src/exchange/` empty |
| Economy / ledger | none |
| Save schema | IndexedDB v2 (games, ratingEvents, ratingState, reports, analysisJobs, meta, attempts, trainingRuns, bookmarks) |

A production build of v0.2.0 was kept outside the repository to run a real upgrade test
(a v0.2.0 save opened by the v0.3.0 build at the same origin).

## Inputs used from the research and earlier work

- Topology and competition rules: research doc 08 (16 regions × 8 divisions × 16; round robin by the circle
  method; top/bottom-2 promotion and relegation between adjacent divisions; 8 + 8 championship seats;
  two-game knockout matches with rapid and blitz pairs, seed rule, joint title in the final).
- Market mathematics: research doc 09 (fixed-b categorical LMSR, uniform q0, integer microcrowns, 1% fee,
  directed rounding, no naked shorts, funded worst-case subsidy, idempotent settlement, 1/n cancellation,
  no trading on influenced events).
- Economy: research doc 10 (funded transfers, explicit issuance, upkeep sinks, non-cash recovery vouchers,
  Starter Club reference costs).
- Calibrated engine ladder (`src/engine/calibration.json`) and 1,779 recorded engine games, used to fit the
  background result model (Davidson ν = 0.9).
