# Crown & Calculation — The Six-Square Federation

An offline-first 6×6 chess game (variant **crown-la6-v1**, Los Alamos-derived: no bishops, no castling,
no pawn double-step, no en passant, mandatory Q/R/N promotion) with a genuine local engine, Glicko-2
ratings, a permanent game library and engine-based move-by-move analysis. TypeScript + React + Vite,
Web Workers, IndexedDB, installable PWA. No accounts, servers, paid APIs or real money.

Status: **v0.3.0 — “The Living Federation”** — see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
The loop: **Play → Analyse → Train → Compete → Forecast → Build → play again.**
M4 (v0.4.0) is planned in [docs/M4_PLAN.md](docs/M4_PLAN.md); the binding research specification is in [docs/research](docs/research).

v0.3 reports: [baseline audit](docs/V3_BASELINE_AUDIT.md) · [federation architecture](docs/V3_FEDERATION.md) ·
[competition rules](docs/V3_COMPETITION_RULES.md) · [exchange math & accounting](docs/V3_EXCHANGE.md) ·
[economy & simulations](docs/V3_ECONOMY.md) · [AI personality validation](docs/V3_STYLES.md) · [M3 directive audit](docs/M3_GAP_AUDIT.md) ·
[save format & migration](docs/SAVE_FORMAT.md) · [testing](docs/TESTING.md).
M2 reports: [engine strength](docs/M2_ENGINE_STRENGTH.md) · [analysis calibration](docs/M2_ANALYSIS_CALIBRATION.md) ·
[Academy validation](docs/M2_ACADEMY_VALIDATION.md) · [intelligence methodology](docs/M2_INTELLIGENCE_METHODOLOGY.md).

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

## What v0.3.0 adds

- **A persistent federation of 2,048 AI competitors** (16 regions × 8 divisions) with identities, hidden
  strengths, public Glicko-2 ratings, careers, aging, retirements and new entrants.
- **Seasons**: 15-round division leagues with promotion/relegation, the Federation Open and Challenger Open
  (Swiss), the 16-player Crown Championship (two-game knockout matches with rapid/blitz tiebreaks) and a
  Club Weekend for club owners. Your federation games are real rated games.
- **Spectator**: watch featured AI-vs-AI games played live by the engine (pause, speed, navigation, each
  side's thinking time, the engine's own evaluation line), or replay them. Background results are summary results and are labelled so.
- **Validated AI personalities**: Tactical attackers and Positional strategists play measurably different
  openings (opening repertoire, strength parity tested); other listed styles failed and play Universal.
- **Crown Exchange**: forecast markets on featured AI matches (LMSR market maker, integer double-entry
  ledger, 1% fee, markets close before the game exists, idempotent settlement), match research with model
  probability vs market price, paper forecasts with Brier scores.
- **Economy**: escrowed prize pools, sponsorship milestones, a Finance page (net worth = cash + assets +
  positions − liabilities, ledger, history), functional assets (Starter Chess Club, Analyst Office, Scouting
  Department, Training Hall for unrated sparring against your next opponent) and collectibles with upkeep, recovery without debt, and two separate prestige ladders
  (chess vs financial — money never buys chess titles).

All money is fictional crowns (₵) with no real-world value.

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

The v0.3.0 acceptance journey (optionally upgrading a save made by a v0.2.0 build first):

```bash
node e2e/federation.mjs [path/to/v0.2.0/dist] 4191
```

Multi-season economy/federation simulation across player strategies:

```bash
npx tsx tools/sim/economy.ts 6 docs/sim/economy-results.json
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
src/federation  federation world: generator, formats (round robin, Swiss, knockout), seasons, result model
src/exchange    ledger, LMSR, markets, NPC traders
src/economy     prize pools, sponsors, assets, net worth, prestige
src/storage     IndexedDB, finalization, backups, checksums
src/app, src/ui application services and React UI
tests           Vitest suites (rules oracle, engine, analysis, ratings, storage, sessions)
e2e             Playwright acceptance journey and offline check
tools           oracle fixture generator, benchmark harness, style validation, economy simulation
docs            status, decisions, benchmarks, roadmap, research package
```

All money is fictional and nonredeemable. Ratings are internal Crown ratings and
are not FIDE ratings. See THIRD_PARTY_NOTICES.md for licensing of dependencies.
