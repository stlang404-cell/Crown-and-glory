# v0.9.0 "The Living Federation" — release report

Release: `release/crown-and-calculation-v0.9.0.zip` (source + prebuilt `dist` from the release commit; checksum in
`release/SHA256SUMS.txt`). Screenshots and evidence logs live in the repository (`docs/screenshots/`, `docs/evidence/`),
not in the ZIP. All browser checks ran in Chromium (Playwright) on a 4-core Linux VM at desktop and 390 px phone sizes.
**Not tested on a physical iPhone, in Safari/WebKit, or on a Windows machine.** Everything below is measured, or marked
PLANNED / NOT DONE.

## 1. Feature inventory

| Area | What changed in v0.9 | Status | Evidence |
|---|---|---|---|
| Automatic iPhone updates | The app checks for a new release on launch, on return to the foreground and on reconnect; downloads it in the background; switches only when nothing is in progress, otherwise shows "Update ready — Restart to Update"; confirms "Updated to vX" once. Build identity (version · commit · built) in Settings → About and `version.json`. The Pages workflow refuses to deploy a build that fails `scripts/verify-dist.mjs`. | Verified in Chromium | `e2e/pages-check.mjs` 12/12 (two real builds under `/Crown-and-glory/`), `tests/updatePolicy.test.ts`; docs/IPHONE_PAGES.md |
| Federation Dashboard | New landing page (`#/`): your next fixtures, live games with Watch / Trade, standings, markets, news; empty states on a fresh career. | Verified | `e2e/dashboard.mjs` 10/10 |
| Live match scheduler | AI-vs-AI games of the current round play in the background, move by move, committed to IndexedDB so a reload resumes them; adaptive capacity (desktop up to 24 at once, phones 6); Settings → Live Games. Games with a market are never scheduled. | Verified (services, Node and headless Chromium); no e2e through the Live Now panel yet | docs/FEDERATION_SCALE.md §2, `tests/scheduler*.test.ts` |
| Federation size | Rounds measured from 2,048 to 20,480 competitors. Desktop target (≤ ~1 s per round) met up to ~5,000. 4,096-competitor topology (crown-topology-2) implemented and tested, **off by default**: new worlds stay 2,048. | Measured; 10,000+ **not shipped** | docs/FEDERATION_SCALE.md §1 |
| Live odds (bug #21) | crown-odds-2: an ordered-logit model fitted on 3,200 Federation-style games; the rating gap keeps a fading weight in play, so the favourite stays the favourite at an equal evaluation. | Verified on 800 held-out games | docs/ODDS_MODEL.md, `tests/odds.test.ts` |
| Opponent styles (bug #20) | crown-styles-5: Tactical, Positional, Defensive and Endgame change the evaluation for the whole game; Aggressive failed its pre-set criterion and stays Universal. | Verified (200 games per style) | docs/STYLES_REPORT.md, `tests/styles.test.ts` |
| Engine speed | +38 % nodes per second with a node-for-node identical search; **+41 [12, 71] Elo at equal time** (320 games). | Measured | docs/ENGINE_OPTIMIZATION_PLAN.md ("v0.9 results") |
| The Sovereign's Grimoire | Rulebook + six books + 12-week program + glossary (~101,000 words, 283 machine-checked boards); Academy lessons and practice game; Book VI updated for crown-odds-2, Book V for crown-styles-5. | Verified (checker) | docs/GRIMOIRE_VERIFICATION.md, `e2e/grimoire.mjs`, `e2e/practice.mjs` |
| Endgame solver | Retrograde solver for 3–4-man endings, re-computing every published endgame figure. | Verified | `tools/grimoire/endgame.ts`, `tests/endgame.test.ts` |

## 2. Bugs fixed in this release (docs/BUG_REGISTER.md)

| # | Severity | What | Found by |
|---|---|---|---|
| 20 | Medium | Defensive / Endgame / Aggressive opponents played as Universal; styles only affected six plies. | Audit |
| 21 | Medium | Live odds ignored the rating gap (≈ 0.35 / 0.30 / 0.35 at an equal evaluation for any pairing). | Audit |
| 22 | High | With a Federation founded, a downloaded update **never** installed by itself: every scheduled background game counted as an in-play market. | `e2e/pages-check.mjs` on the integrated build |
| 23 | Medium | React error #185 (render loop) in the update notice when the waiting update was the build already running. | same run |
| 24 | Low | A move sound could be lost after an instant engine reply (made more common by the speed-up). | `e2e/motion-sound.mjs` |
| 25 | Low | On the play board a quick move right after the engine's reply was drawn without a slide or sound (the replay-scrubbing rule applied to live play). | `e2e/motion-sound.mjs` |
| — | Release | Two engine test files read a git-ignored corpus and failed on a clean checkout (would have stopped the Pages deploy). The corpus is now a committed fixture. | clean-worktree test run |
| — | Release | `scripts/verify-dist.mjs` only worked for a build inside the repository. | clean-worktree build check |

Bugs #22–#25 and the two release defects were found only by running every journey and the whole test suite on a clean
checkout of the integrated tree; each agent's own checks had passed.

## 3. Engine

* **Speed:** speed-probe checksums unchanged (`9be425be` at 12 positions, `428895a0` at 24); 463 k → 639 k nodes/s
  wall clock (+38 %), 440 k → 588 k CPU (+34 %), median of 3 interleaved runs on a shared VM.
* **Strength at equal time:** v0.9 at 200 ms vs v0.9 at 145 ms (= v0.8 at 200 ms, because the search is identical):
  114 W / 130 D / 76 L, **+41 [12, 71] Elo**, 0 illegal moves.
* **Styles:** within ±50 Elo of Universal at 8k and 2k nodes (intervals about ±40). Universal is unchanged (identical
  evaluation and `chooseMove`, tested).
* Fairy-Stockfish remains a development reference only, never bundled.

## 4. Odds model (crown-odds-2), held-out (800 games)

| Checkpoint | old LL / Brier | **new LL / Brier** |
|---|---|---|
| ply 0 | 0.968 / 0.573 | **0.900 / 0.533** |
| ply 20 | 0.639 / 0.354 | **0.596 / 0.332** |
| ply 40 | 0.440 / 0.246 | **0.352 / 0.200** |
| all live points (56,923) | 0.700 / 0.391 | **0.496 / 0.282** |

Inputs are public only (ratings, RDs, ply, published evaluation, material). At ply 80 an evaluation-only model has a
slightly lower Brier score (0.138 vs 0.147); the prior carries little information by then.

## 5. Release gates (clean checkout of the release commit)

Run on a clean worktree of commit `249f451` (no untracked files; logs in `docs/evidence/v0.9-final/`):

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | pass |
| Unit and integration tests (vitest) | **452 passed, 1 skipped** (48 files; the skipped test needs a validated Played Like model) |
| Production build + `scripts/verify-dist.mjs` | pass: version 0.9.0 · commit 249f451, 11 precached files verified |
| `e2e/run.mjs` (rated game, Gate G) | pass |
| `e2e/offline.mjs` | pass |
| `e2e/analysis-journey.mjs` | 12/12 |
| `e2e/nav-audit.mjs` (every destination, fresh + populated, desktop + phone) | 5/5 |
| `e2e/motion-sound.mjs` | 10/10 |
| `e2e/motion-extra.mjs` | 8/8 |
| `e2e/quick-match.mjs` | 9/9 |
| `e2e/vault.mjs` | 10/10 |
| `e2e/grimoire.mjs`, `e2e/practice.mjs`, `e2e/academy.mjs` | pass |
| `e2e/dashboard.mjs` | 10/10 |
| `e2e/m6-arena.mjs` (live markets, settlement) | 11/11 |
| `e2e/v5-journey.mjs` (v0.4.0 save → v0.9 migration, backup, restart, offline, rollback) | 20/20 |
| `e2e/pages-check.mjs` (GitHub Pages subpath, two real builds, automatic updates) | 12/12 (+ build-identity step) |

Two journeys were updated for intended v0.9 behaviour, never loosened: offline opens `#/play` (the landing page is
now the Dashboard), and the v5 restart check allows scheduled background games to gain moves while requiring every
earlier move to be kept and everything else to be byte-identical.

## 6. Not done / known limits
* **Physical iPhone, Safari/WebKit and Windows were not tested.** iOS foreground/resume timing and Safari's service
  worker update timing are unverified (docs/IPHONE_PAGES.md).
* **10,000+ competitors are not shipped.** 10,240 misses the desktop round-time target; 4,096 is implemented but off
  until storage compaction and the qualification-market cost are addressed (docs/FEDERATION_SCALE.md §4).
* Phone performance figures are estimates from VM measurements (×3–5), not measurements.
* The Live Now panel and Live Games settings have no browser journey yet (services are tested).
* Aggressive style: not validated. Played Like: still Calibrating. Grading (Brilliant etc.): experimental.
* Economy: not re-simulated for v0.9. No economy rule changed, but scheduled background games are now decided by
  real engine games instead of the result model (when the app is open), which changes individual results; the
  economy simulations (headless, no scheduler) are unaffected and the v0.8 seed-101 run stands.
* The FINAL GAMEPLAY EXPANSION (replay centre, eval bar, trophies, banners, Trophy Hall, achievement families) is
  the next milestone and is **not** part of v0.9.0.

## 7. Merging (owner action)
The branch `claude/fervent-brahmagupta-fnui2e` is not merged. To deploy to the iPhone URL, open a pull request
base `main` ← compare `claude/fervent-brahmagupta-fnui2e` and merge it; the Pages workflow runs the tests, builds,
runs the release check and deploys. The installed app then updates itself as described in docs/IPHONE_PAGES.md.
