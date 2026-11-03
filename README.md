# Crown & Calculation — The Six-Square Federation

An offline-first 6×6 chess game (variant **crown-la6-v1**, Los Alamos-derived: no bishops, no castling,
no pawn double-step, no en passant, mandatory Q/R/N promotion) with a genuine local engine, Glicko-2
ratings, a permanent game library and engine-based move-by-move analysis. TypeScript + React + Vite,
Web Workers, IndexedDB, installable PWA. No accounts, servers, paid APIs or real money.

Status: **v0.2.0 — M0, M1 and M2 (“Sovereign Intelligence”) implemented with gate evidence** — see
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). The loop: **Play → Analyse → Train → Improve → play again.**
M3 (federation) is planned in [docs/M3_IMPLEMENTATION_PLAN.md](docs/M3_IMPLEMENTATION_PLAN.md); M4–M5 in
[docs/ROADMAP_M2_M5.md](docs/ROADMAP_M2_M5.md); the binding research specification is in [docs/research](docs/research).

M2 reports: [baseline audit](docs/M2_BASELINE_AUDIT.md) · [engine strength](docs/M2_ENGINE_STRENGTH.md) ·
[analysis calibration](docs/M2_ANALYSIS_CALIBRATION.md) · [Academy validation](docs/M2_ACADEMY_VALIDATION.md) ·
[intelligence methodology](docs/M2_INTELLIGENCE_METHODOLOGY.md) · [testing](docs/TESTING.md).

## Play on Windows

1. Install **Node.js 20 or newer (LTS)** from https://nodejs.org (one time).
2. Download/clone this repository and double-click **`Start-Crown.bat`**.
   The first run installs dependencies and builds (about a minute); later runs start instantly.
   Your browser opens at `http://127.0.0.1:5173/` (the next free port is used if 5173 is busy).
3. Keep the console window open while you play; close it to stop.

If `.bat` files are blocked, right-click the folder → *Open in Terminal* and run:

```bash
powershell -ExecutionPolicy Bypass -File .\Start-Crown.ps1
```

`Start-Crown.ps1` uses Node.js when installed; without Node.js it can still serve an existing prebuilt
`dist` folder with .NET's HttpListener (build once on any machine with `npm run build`, then copy the
whole folder). Note: the launchers were written for Windows but could not be executed on Windows in
the development environment (see IMPLEMENTATION_STATUS).

## Play on macOS / Linux / any machine with Node.js

```bash
npm ci
```

```bash
npm run build
```

```bash
npm run serve
```

Development mode with hot reload: `npm run dev`.

## iPhone (PWA)

- **Same Wi-Fi testing** (`npm run dev` prints a network URL, or `node scripts/serve.mjs --host 0.0.0.0`):
  works in Safari, but a plain `http://192.168.x.x` address is *not* a secure context, so the service
  worker does not install and the game is **not** available offline.
- **Real offline install** requires HTTPS hosting of the `dist` folder (e.g. GitHub Pages or any
  static HTTPS host; the build uses relative paths). Open the HTTPS URL in Safari → Share → *Add to
  Home Screen*, launch it once online, after which it runs in airplane mode. Saves stay on the phone.
- Offline behaviour was verified in desktop Chromium (service worker + airplane-mode reload + engine
  move). It has **not** been tested on physical iPhone hardware.

Safari may evict website data that is not used for a while. Use **Library → Export backup** regularly;
**Import backup** restores a career.

## What is in M1

- Exact crown-la6-v1 rules with Crown adjudication (claimable threefold/100-halfmove, automatic
  fivefold/150, bare-kings draw, Crown timeout rule, draw agreement after ten moves each).
- Local engine in a Web Worker: iterative deepening PVS, aspiration windows, TT, check-aware
  quiescence with SEE pruning, killers/history, null move, LMR, futility pruning, mate-distance
  handling, repetition-aware search. Eight levels with calibrated ratings.
- Clocks (blitz 3+2, rapid 5+3, classical 15+10, untimed), rated and casual games, resignation, draw
  offers/claims, promotion picker, tap and drag moves, keyboard board navigation.
- Glicko-2 per time-control pool with an immutable, replayable, explained rating ledger; career page
  with rating chart (RD band), records, rank history, performance by time control and opponent band.
- Atomic, idempotent game finalization; every game permanently stored; Library with search, filters,
  sorting, pagination, replay, per-game export and full backup/restore.
- Postgame report: per-move grades (experimental v0), evaluation graph, best alternatives with
  principal variations you can explore, accuracy by side and phase, critical positions, turning
  points, evidence-based coach notes, training-retry from any mistake, immutable report versions.

## What M2 adds

- Stronger evaluation (crown-eval-3, +66 Elo replicated) and a smooth, measured 8-level ladder (ratings
  800 → 2987 on the internal engine scale; L8 is the strongest configuration).
- Analysis methodology v1: an expected-score map fitted and validated on held-out 6×6 games; grade
  regression corpus; bookmarks, memorable moves, clock-pressure notes, batch re-analysis with versioned reports.
- **Crown Academy**: 484 engine-verified puzzles — Tactical Academy, Puzzle Rush, Calculation Chamber,
  Defensive Survival, Endgame Workshop (with play-out), Replay Your Mistakes, Adaptive Training and
  held-out Assessments.
- **Chess Intelligence Lab**: ten chess-specific dimensions with rubrics, counts, intervals and
  “insufficient evidence”; accuracy trend, improvement velocity, recurring-pattern coach.
- **Casual assistant** (hint, candidate moves, threat check, evaluation, explanation) — impossible in rated
  games, and any use makes a casual game permanently assisted.
- **Chess Passport**: career timeline, records, memorable moves, opponent history, filters and CSV export.

## Tests and benchmarks

```bash
npm test
```

```bash
npm run build && node scripts/serve.mjs --port 4173
```

```bash
node e2e/run.mjs http://127.0.0.1:4173/ && node e2e/academy.mjs http://127.0.0.1:4173/ && node e2e/offline.mjs http://127.0.0.1:4173/
```

Engine benchmarks need a local Fairy-Stockfish binary (development only, never shipped):

```bash
FAIRY_STOCKFISH=/path/to/stockfish npx tsx tools/bench/run.ts suite ablation 32
```

Results and methodology: [docs/ENGINE_BENCHMARKS.md](docs/ENGINE_BENCHMARKS.md). Test evidence:
[docs/TESTING.md](docs/TESTING.md). Save format: [docs/SAVE_FORMAT.md](docs/SAVE_FORMAT.md).
Decisions: [docs/DECISION_LOG.md](docs/DECISION_LOG.md).

## Repository layout

```
src/rules       crown-la6-v1 rules, notation, adjudication (pure TS)
src/engine      search, evaluation, levels, calibration, worker + client
src/games       game records, session state machine, clocks, openings
src/ratings     Glicko-2, rating ledger, ranks
src/analysis    analyser, methodology (grades/accuracy/phases), report types
src/academy     Academy (puzzles, verification, motifs), coach, Intelligence Lab
src/federation  opponent roster (M3 grows here)
src/exchange    reserved for M4 (no code yet)
src/storage     IndexedDB, finalization, backups, checksums
src/app, src/ui application services and React UI
tests           Vitest suites (rules oracle, engine, analysis, ratings, storage, sessions)
e2e             Playwright acceptance journey and offline check
tools           oracle fixture generator, benchmark harness
docs            status, decisions, benchmarks, roadmap, research package
```

All money in future milestones is fictional and nonredeemable. Ratings are internal Crown ratings and
are not FIDE ratings. See THIRD_PARTY_NOTICES.md for licensing of dependencies.
