# v0.4.0 baseline audit

Audited commit `260dae6` (v0.3.0 + M3 gap pass), 2026-11-03, cloud Linux container (4 cores, Node 22, Playwright
Chromium). No `AGENTS.md` exists anywhere in the repository. The research package in the attached ZIP is
byte-identical to `docs/research/` for every document; the ZIP additionally contains raw data, scripts and
prototypes, which were read for the reconciliation (docs/M4_RESEARCH_RECONCILIATION.md) but not copied.

## Measured at the baseline commit (all executed in this session)

| Check | Result |
| --- | --- |
| `tsc -b` | pass |
| `vitest run` | **139 / 139** pass (16 files) |
| `vite build` | pass (app 529 kB / 167 kB gzip, engine worker 44 kB, puzzle chunk 272 kB) |
| `e2e/federation.mjs` (v0.3.0 18-step journey from a real v0.2.0 save) | pass |
| `e2e/run.mjs` (rated game, Gate G), `e2e/academy.mjs`, `e2e/offline.mjs` | pass |
| Engine benchmarks | delegated to the engine-strength workstream: see docs/M4_ENGINE_STRENGTH.md (baseline measured before any change) |
| A real v0.3.0 production build | built from `260dae6` outside the repository and used for the save-migration journey |

## Market and ledger audit (code review + the reconciliation agent's findings)

| Finding | Severity | Fixed in v0.4.0 |
| --- | --- | --- |
| A featured game stopped by the 400-ply limit settled its market as a Draw (censored game treated as a result) | correctness | yes — market cancelled on the published vector |
| Player trade idempotency keys used `Math.random()` | robustness | yes — deterministic key = market history length (shared rule with NPC batches; a latent collision between the two schemes was found and fixed) |
| No stale-quote protection | fairness | yes — `expectVersion` / `maxTotal` guards; the UI always sends the quoted version |
| `FederationService.cancel` existed but nothing could trigger it | dead code | cancellation now runs through `resolveMarket` for censored games, sandbox voids and market resolution |
| Market maths hard-coded to 3 outcomes | scope | yes — n-state LMSR with subset claims and payout vectors |
| NPC traders assumed 3 outcomes and traded once at listing | scope | yes — generic traders, in-play and per-round roles, exposure cap |
| No promotion / qualification / season / conditional / tournament-winner markets; no live trading; no sandbox | missing | implemented |
| Forecast scoring: average Brier only | missing | Brier + log, calibration, skill progression, price/model snapshots |
| Uniform opening prices for prior-sensitive markets | design | sandbox markets open at a funded prior (research doc 09 bound) |

## Persistence and migrations

DB v3 at the baseline. v0.4.0 adds DB v4 (additive: `liveGames`, `contracts`). Upgrade verified by a unit test
(v1→v2→v3→v4 chain) and in Chromium with a save made by the real v0.3.0 build (e2e/m4-journey.mjs step 1).

## Known issues carried into v0.4.0 work

- Vitest occasionally reports an infrastructure "Timeout calling onTaskUpdate" under heavy CPU load (all tests
  pass; observed while the engine benchmarks were running concurrently).
- Windows launchers and a physical iPhone remain untested (no such devices in this environment).
