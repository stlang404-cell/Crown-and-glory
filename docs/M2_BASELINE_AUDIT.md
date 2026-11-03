# M2 baseline audit

Audited commit: `31fe7518a13e5310564ebf5f0e947604f4113be0` (v0.1.0 + benchmark experiments), 2026-11-03.
Host: cloud Linux container, 4 cores, Node 22.23.4, Chromium via Playwright 1.63. No Windows or iPhone.
No `AGENTS.md` exists in the repository.

## Reproduced

| Check | Result |
| --- | --- |
| `tsc -b` typecheck | Pass |
| `vitest run` | **85 / 85 pass** (9 files, ~10 s) — matches the v0.1.0 claim |
| Rules oracle | 5,000 pyffish 0.0.90 positions, 47,884 successor states: 0 mismatches (re-run in the suite above) |
| Perft 1–5 | 10 / 100 / 1,212 / 14,332 / 191,846 (re-run) |
| Research replay fixtures | 20 games state-identical (re-run) |
| Production build | Pass; JS 306 kB (98 kB gzip), engine worker 39 kB |
| Browser journey (`e2e/run.mjs`) | Passed earlier in this session **only as a casual-game dry run** (`ALLOW_CASUAL=1`) |
| Offline check (`e2e/offline.mjs`) | Passed in Chromium (service worker, offline reload, engine move) |
| Engine benchmarks | Raw results exist in `tools/bench/results/*.json` (speed, tactics, ablations, Fairy-Stockfish reference, experiments) for engine build crown-search-1 + crown-eval-2 |

## Defects and gaps found

1. **Critical — rated play impossible.** `src/engine/calibration.json` still had status `pending`
   (the calibration suite was queued but never run). With no opponent ratings the UI correctly disables
   Rated mode, so v0.1.0 could not produce a rated game at all, and the M1 acceptance journey had not
   actually been verified with a rated game. Fix: run calibration for the final M2 engine and re-run a
   strict rated browser journey (Gate G).
2. **Missing documents.** `docs/ENGINE_BENCHMARKS.md` and `docs/TESTING.md` were referenced by README and
   IMPLEMENTATION_STATUS but never generated. They are now generated from raw outputs
   (`tools/bench/report.ts`) and written from actual test runs; no numbers are hand-typed.
3. **IMPLEMENTATION_STATUS overstated M1** ("COMPLETE") while (1) was unresolved. Corrected in the M2 status.
4. **Engine strength is weak per node:** Crown at 40k nodes scores between Fairy-Stockfish at 1k and 4k
   nodes (64-game matches). Biggest gap to close in Phase A.
5. **Grading is uncalibrated** (s = 200 cp, k = 4 placeholders) — known, disclosed in every report.
6. **Opponent styles undifferentiated** — known, disclosed.
7. **Windows launchers and iPhone PWA untested on real devices** — environment limitation, still true.

## Baseline engine evidence (crown-eval-2, before M2 changes)

All from `tools/bench/results/` (colour-swapped pairs over 32 openings unless noted):

- Ablations at 40k nodes: removing TT −191 Elo, quiescence −170, futility −83, LMR −66, SEE pruning −66
  (significant); null move and aspiration windows neutral within error. 160k vs 40k nodes: +221.
- Versus Fairy-Stockfish (dev-only reference): Crown 40k vs Fairy 1k nodes 87.5%; vs 4k 39.1%; vs 16k 6.3%;
  Crown 160k vs Fairy 16k 32.8%; vs 64k 8.6%.
- Tactical suite (87 Fairy-verified unique-best positions): 72 / 73 / 75 / 76 solved at 10k / 40k / 160k / 640k nodes.
- Median search speed 330k–620k nodes/s in Node on this host.

See docs/M2_ENGINE_STRENGTH.md for the M2 engine work that starts from this baseline.
