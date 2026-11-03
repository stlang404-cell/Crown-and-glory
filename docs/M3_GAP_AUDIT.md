# M3 directive audit against v0.3.0

The "M3: The Living Federation" master prompt describes the repository as v0.2.0, but the branch already
contained v0.3.0, which implemented the same scope (docs/V3_BASELINE_AUDIT.md is the v0.2.0 baseline audit).
This document audits v0.3.0 section by section against the M3 prompt and records what was added.
No `AGENTS.md` exists.

## Baseline at the start of this pass (commit `eae0494`)

| Check | Result |
| --- | --- |
| `tsc -b` | pass |
| `vitest run` | 135 / 135 pass |
| `vite build` | pass |
| `e2e/federation.mjs` (18-step journey incl. a real v0.2.0 save) | pass |
| `e2e/run.mjs`, `e2e/academy.mjs`, `e2e/offline.mjs` | pass |
| Engine benchmarks vs Fairy-Stockfish | not re-run: no engine code changed in search/eval; the Fairy-Stockfish binary used in M2 is not present in this container (only its build log). The style parity games below are engine benchmarks of the new policy. |

## Section-by-section

| § | Requirement | v0.3.0 status | Gap closed in this pass |
| --- | --- | --- | --- |
| 2 | 2,048 persistent competitors, reproducible, evolving; tiered simulation; no fake replays; no inflation; bounded CPU | Done | **Long-horizon proof added**: 40-season headless run (tools/sim/federation.ts) — mean rating 1,831–1,839 throughout, spread constant, ~0.4 s CPU per season |
| 3 | Divisions, standings, promotion/relegation, round robin/Swiss/knockout, byes, tiebreaks, prizes, titles separate from ratings, never stuck | Done | — |
| 4 | Measurable styles (engine parameters **or opening preferences**), statistical test, strength preserved; rivalries | Styles failed validation (move filter) | **Opening-repertoire styles (crown-styles-3)** built and validated; see docs/V3_STYLES.md |
| 5 | Spectator: animated board, **clocks**, profiles, move history, evals, context, speed, pause, replay, live vs playback, no outcome access | Done except clocks | **Per-side engine thinking-time display** (featured games are node-limited, so a game clock would be fake; labelled honestly) |
| 6 | Funded LMSR W/D/L markets, integer accounting, fees, reserves, positions, price history, idempotent settlement; tournament-winner markets only if correct | Match markets done; no tournament-winner markets | Tournament-winner markets deliberately **not** added (would need multi-round settlement and cancellation rules for joint champions; planned in docs/M4_PLAN.md) |
| 7 | Research dashboard; estimated probability ≠ price; live trading only if timing legitimate | Pre-match done | Live in-match trading not added (no legitimate timing design yet) |
| 8 | Prizes, cash, realized/unrealized P&L, net worth formula, history | Done | — |
| 9 | Functional purchases: clubs, **training facilities**, analyst offices, scouting; cosmetics after | Club, analyst, scouting, cosmetics | **Training Hall** added: unrated sparring against your next opponent's exact engine profile |
| 10 | Chess and financial prestige ladders | Done | — |
| 11 | Sandbox own-match betting isolated, or documented as M4 | Documented | Carried to docs/M4_PLAN.md §1 |
| 12 | Recovery without career reset; no reset exploits | Done (no debt, voucher once per season; a federation cannot be re-founded) | — |
| 13 | One coherent event system with idempotency and recovery tests | Done | Sparring games are proven never to become federation results (test) |
| 14 | Premium UI, Windows/iPhone usable, offline | Done (Chromium desktop + 390 px) | Not tested on physical Windows/iPhone |
| 15 | Tests + long-horizon sims: rating stability, mobility, prize distribution, money supply, **wealth concentration, market-maker reserves**, bankruptcy | Money supply, bankruptcy, prizes | **Added** mobility, champion diversity, earnings Gini / top-1% share, market-maker P&L and worst market |
| 16 | 15-step acceptance journey | 18-step superset passed | Re-run on the final build |
| 17 | M4 plan | Existed as the "v0.4.0 plan" | Renamed and extended as **docs/M4_PLAN.md** |
