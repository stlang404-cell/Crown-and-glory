# Crownmaster Intelligence

Standalone, local 6×6 analysis app for `crown-la6-v1`. Uses the repository's actual rules and canonical TypeScript engine. No accounts, APIs, remote inference or game automation. It does not read or write the game's databases or expose results to rated play or Crown Exchange.

## Run

From the repository root, with Node.js 22.12+:

```sh
npm ci
npm run crownmaster:dev
```

Production and offline mode:

```sh
npm run crownmaster:build
npm run crownmaster:serve
```

Open the localhost URL printed by the server. On Windows, double-click `crownmaster/Start-Crownmaster.cmd` after installing Node LTS. First installation requires Internet; subsequent production use is local. The launcher does not change Windows security settings. Keep the server window open. Alternatively install the HTTPS-hosted PWA.

## Study

Tap or drag pieces; the board offers legal destinations and a Q/R/N promotion chooser. Use **Set up position** to paint either side's pieces, erase squares and choose the side to move. Apply validates the resulting FEN. Starting position, reset, flip and move navigation are available. Moving from an earlier position branches the study and replaces its later moves.

Choose Quick (1 s), Standard (5 s), Deep (30 s), or Crownmaster (1–3600 s). Stop immediately terminates the worker, retaining the last completed candidate round. Analysis pauses when the document is hidden to limit battery use. Times are targets; browser scheduling and the engine's 1024-node clock checks can overshoot slightly. Depth is actual completed search depth; candidates with early mate termination show their individual depth.

Select any of 3–5 candidate cards to compare the recommendation, score and line. Step through the variation without changing the study. Scores on cards are for the mover; the evaluation bar is White-positive. Expand **Understand the position** for actual static evaluator contributions. They describe the current board, while search evaluates future play. Mate findings are not tablebase proofs.

**Save to library** keeps up to 100 named studies on this device; reopen them from the Study Library selector. The current study automatically persists under `crownmaster-study-v1`, separate from game saves. Export important studies: browser storage can be evicted. Exported JSON can be reimported.

## Imports and review

Accepted: 6×6 FEN, `crownmaster-study-1` JSON, completed Crown `GameRecord` JSON, arrays of those games, or the `payload.games` section of a `crown-backup-1` JSON export. A selector appears for multiple games. Every move and setup move is legally replayed before accepting any game; incompatible variants, malformed positions, moves after an automatic terminal result, and unfinished official game records are rejected. Importing a backup reads legal game copies only; it does not restore careers, verify the backup's full ledger/checksum, or modify the original file. 10 MB file limit. Standard 8×8 FEN/PGN is not supported.

FEN has no repetition history. Game and study imports preserve setup and played moves, so repetition is reconstructible. Use a complete game rather than just its final FEN when repetition matters.

**Review entire game** streams results from the existing canonical quick-review preset (depth 5, screen 2, verification +2). Select a move to inspect its pre-move position, or **Best** to replay the strongest alternative. Stop retains finished rows; restarting reviews the game again. Grades are experimental and use the documented original methodology, including conservative Great/Brilliant evidence gates. They are not ratings or mathematical judgments. See the in-app methodology and `../src/analysis/methodology.ts`.

## Offline / iPhone

Build output is `dist-crownmaster/`. Serve it over localhost or HTTPS. Wait for **Ready for offline use** before disconnecting; all app assets and the engine worker are precached. In iPhone Safari use Share → Add to Home Screen. Windows Chrome/Edge can install from the address bar. Updates wait for the old page to close before activation. No user studies are stored in the asset cache.

Responsive browser checks cover 375px and 390px. Physical iPhone Safari and Windows launcher execution require device verification; Chromium emulation is not equivalent to testing those devices.

## Verify

```sh
npx vitest run tests/crownmaster.test.ts tests/rules.test.ts tests/engine.test.ts tests/analysis.test.ts
npm run crownmaster:build
npm run crownmaster:bench
```

`crownmaster/e2e.mjs` additionally requires Playwright (`npm install --no-save --package-lock=false playwright`) and Chromium at `/usr/bin/chromium` (adjust executablePath for other systems). Serve the production app on port 4174, then run `node crownmaster/e2e.mjs`. It checks real worker computation, mate, review, cancellation, responsive layouts, and offline reload plus calculation. Evidence is under `crownmaster/evidence/`.

Read [TECHNICAL.md](TECHNICAL.md) for architecture, audit, limitations, and measured benchmarks. No stronger-engine claim is made.

## Separate deployment (prepared, not published)

1. Build with `npm ci && npm run crownmaster:build`.
2. Upload **only the contents of `dist-crownmaster/`** to a separate HTTPS static site or a distinct `/crownmaster/` directory. Do not replace the live game's root or its service worker.
3. Open the site, verify a known mate (`k5/6/1K4/6/6/5R w - - 0 1` → `Rf6#`), wait for offline readiness, then reload offline and calculate again.
4. Test on physical iPhone Safari before announcing mobile verification.

Relative asset paths and the service worker's scoped cache support a subdirectory deployment. No deployment was performed and no public app URL has been verified. Existing live-game integration and merging require compatibility review with concurrent work.
