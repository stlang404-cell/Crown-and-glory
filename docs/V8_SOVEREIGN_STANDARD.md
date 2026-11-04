# v0.8.0 "The Sovereign Standard" — release report

Release: `release/crown-and-calculation-v0.8.0.zip` (about 1.8 MB; source + prebuilt `dist` from the commit that adds it;
checksum in `release/SHA256SUMS.txt`). Screenshots and evidence logs live in the
repository (`docs/screenshots/`, `docs/evidence/`), not in the ZIP. All browser checks ran in Chromium (Playwright) on
Linux at desktop and 390 px phone sizes. **Not tested on a physical iPhone or a Windows machine.** Everything below is
measured or marked PENDING/PLANNED.

## 1. Feature inventory

| Feature | Status | Evidence |
|---|---|---|
| Analysis opens from navigation; game picker; Analyse Game; grades, graph, best lines, variations, replay | Verified | `e2e/analysis-journey.mjs` 12/12 on the release build |
| Career Passport (fresh, populated, after Analysis, migrated v0.4.0 save) | Verified | `e2e/nav-audit.mjs` 5/5; migrated-save check |
| Every navigation destination, desktop rail + phone tabs, fresh + populated | Verified | `e2e/nav-audit.mjs` |
| Shared Match Center (Play, Live Arena, Analysis) | Verified | journeys above + `m6-arena.mjs` 11/11 |
| Piece animation (slide, capture, promotion glint, check pulse, replay, live spectating), settings, reduced motion | Verified | `e2e/motion-sound.mjs` 10/10, `e2e/motion-extra.mjs` 8/8, `motion-play-and-replay.gif` |
| Procedural sound (10 sounds), unlock on first gesture, settings persisted | Verified (sound calls recorded; audible output not checkable headless) | same |
| Rated play hides engine information; Glicko-2 updates once | Verified | `e2e/run.mjs`, `quick-match.mjs` |
| Live markets: stale quotes and duplicate steps rejected; exact settlement; grades only after settlement | Verified | `m6-arena.mjs` 11/11 |
| Offline reload; update-ready notice for pages on an old build | Verified | `e2e/offline.mjs`; migrated-save check |
| v0.4.0 → v0.8 save migration, rollback | Verified | `e2e/v5-journey.mjs` 20/20 |
| Money shown as fictional dollars (no rescaling) | Verified | `tests/money.test.ts`, journeys |
| 31 rating titles (one per 100 points, uncapped) + 31 insignias; identity banner; Passport title + insignia collection | Verified | `tests/ratingTitles.test.ts`, nav audit screenshots |
| Random Federation Quick Match (uniform over all active competitors; Rated default; filters; Reroll/Cancel) | Verified | `tests/quickMatch.test.ts`, `e2e/quick-match.mjs` 9/9 on the combined build |
| Sovereign Vault v1: 134 collectibles (83 earnable achievements, 9 Exchange titles, 31 insignias, 11 awaiting validated grading) | Verified | `tests/vault.test.ts` (110), `e2e/vault.mjs` 10/10 on the combined build |
| Sovereign Unbound: thinking times 1/5/10 (rated)/15/30/60 s; thinking indicator; fullBudget time use | Verified (UI + time use); strength per budget PENDING | §3 |
| Played Like | Shipped as **Calibrating** (fails validation) | §4 |
| Economy after the club-sponsorship change | Re-simulated for one seed (24 seasons); more seeds PENDING | §5 |
| League rebalance, beginner opponents, achievements Hall expansion, Living Federation | PLANNED | docs/V9_MASTER_PROMPT.md |

Tests: full vitest **344 passed, 1 skipped** (the skipped test needs a validated Played Like model). Production build
passes. Journeys on the release build: run, offline, analysis 12/12, nav 5/5, motion 10/10, motion-extra 8/8,
quick-match 9/9, m6-arena 11/11, v5 20/20 (logs: `docs/evidence/v0.8-final/`); on the combined build (with Vault):
nav 5/5, vault 10/10, quick-match 9/9.

## 2. Broken pages: root causes
* **Analysis blank page** — reproduced on the pre-fix build: the replay-autoplay hooks were declared after
  `AnalysisScreen`'s "Loading game…" early return; React error #310 unmounted the whole app. Fixed; guarded by the
  `react-hooks/rules-of-hooks` lint run as a unit test (shown to flag the original file) and by `ScreenBoundary`.
* **Career Passport "did not appear"** — the same defect: Passport rendered until the player opened an analysis,
  after which the crash removed the entire app including the navigation. No fault in the Passport itself.
* Full list with reproduction, root cause, fix and evidence: docs/BUG_REGISTER.md (#12–#19).

## 3. Engine (Sovereign)

### UI audit
Real UI games (`e2e/sovereign-probe.mjs`): the UI plays the benchmark configuration (crown-search-2 + crown-eval-4,
partialRoot, 2^20 table, best move only — no randomness, handicap or style). At a 5 s budget it used 2.4–4.6 s per move
(about 56 %) before the fix and **3.2–4.9 s (about 81 %) after**, depth 12–13 → 12–15.

### Candidates (confirmation rule fixed in advance: 640 games on the 4-ply book; adopt only if the 95 % lower bound > 0)
| Candidate | Screening (128 g) | Confirmation (640 g) | Adopted |
|---|---|---|---|
| nullAdaptive | +38 [−5, 86] | +4 [−14, 22] | No |
| singular | +33 [−3, 69] | +8 [−11, 28] | No |
| seeMain | +22 [−16, 60] | +7 [−13, 26] | No |
| **fullBudget** (200 ms) | — | **+23 [6, 41]** (+228 =227 −185) | **Yes** — L8 and Sovereign, `crown-levels-6` |
Screened and dropped: lmr2 +14, rfpDeep +11, ttBucket+qsTT +11, iir +5, eval refit +3, histGravity+counterMove +3,
razoring 0, lmp −66. 0 illegal moves in every match.

**Measured gain of v0.8 over v0.7 Sovereign: +23 [6, 41] Elo at 200 ms** (fullBudget). The +150/+200 targets were not
reached. Screening at 128 games proved unreliable (every positive screen except fullBudget regressed to ≈ 0).

### Versus Fairy-Stockfish (dev-only benchmark, never bundled; shipped configuration; equal move time)
| Move time | Games | Result | Elo [95 %] | Avg depth (ours / Fairy) |
|---|---|---|---|---|
| 100 ms | 128 | +5 =16 −107 | −379 [−482, −309] | 8.9 / 38.8* |
| 300 ms | 96 | +3 =19 −74 | −330 [−405, −267] | 10.7 / 44.8* |
| 1000 ms | 64 | +3 =15 −46 | −283 [−379, −213] | 12.9 / 52.5* |
\*Fairy reports selective depth differently; not comparable to ours. These runs used the pre-fullBudget configuration
(partialRoot) and shared the CPU with other jobs (both sides equally time-limited).
Doubling-time ladder (does more thinking time help? shipped configuration vs itself, 128 games each, 4-ply book):
| Comparison | Result | Elo [95 %] | Avg depth |
|---|---|---|---|
| 100 ms vs 50 ms | +61 =43 −24 | +103 [55, 153] | 9.6 vs 8.6 |
| 200 ms vs 100 ms | +58 =41 −29 | +80 [38, 128] | 10.7 vs 9.6 |
| 400 ms vs 200 ms | +59 =48 −21 | +106 [63, 150] | 12.0 vs 10.8 |
Each doubling of time is worth roughly +80 to +106 Elo at these budgets, so Sovereign Unbound's longer budgets
(15/30/60 s) are genuinely stronger than its 1/5 s settings; the size of the gain at multi-second budgets was not
measured (doubling gains usually shrink as time grows). The gap to Fairy-Stockfish narrows with time in this data
(−379 → −330 → −283 from 100 to 1000 ms) but stays large.

### Profile and plan
Evaluation 43.5 % of search time, move generation 16 %, bookkeeping ≈ 20 %. Plans: docs/ENGINE_OPTIMIZATION_PLAN.md
(incremental evaluation, attack maps, move generation, bitboards, all behind differential correctness tests) and
docs/ENGINE_STRENGTH_RESEARCH.md (approach A native engine incl. NNUE-style evaluation; approach B Fairy-Stockfish with
licensing options B1–B4 for the owner to decide).

## 4. Played Like
Fitted on 214 analysed calibration games (430 player-game samples, engine levels L1–L7, 800–2641 on the Crown scale;
the run was stopped at 214 of 500 games by the compute stopping rule). Held-out (every third opening pair):
MAE 293, r 0.678, 90 % interval coverage 0.89, monotone by level — **but no better than a naive accuracy line**
(MAE 284, r 0.687) and compressed toward the middle (L1 800 → 1120, L7 2641 → 2344). The release gate requires beating
that baseline, so **no numbers are shown**; the card and Passport say "Calibrating" and explain why. No calibration
exists below 800. Next: difficulty features (legal-move count, criticality, eval volatility), the remaining L7–L8
games, and beginner profiles once they exist.

## 5. Economy
The club-sponsorship change (appeal-scaled sponsorship paid from the existing season sponsor budget; no new money) was
re-simulated for **one seed (101), 24 seasons**, after the engine benchmarks freed the CPU (`tools/sim/economy.ts`;
old policy = `CROWN_SIM_NO_PLAYER_CLUB_DUES=1`). Starting money $1,000.

| Policy | Strategy | Net worth after 24 seasons | Peak net worth | Lowest cash | Rounds below $100 | Below recovery threshold | Ledger conserved every season |
|---|---|---|---|---|---|---|---|
| old | business | $554 | $1,205 | $3.1 | 19 | seasons 8→12 (recovered) | True |
| new | business | $3,064 | $3,064 | $432.2 | 0 | never | True |
| old | magnate | $665 | $1,074 | $32.2 | 0 | seasons 1→2 (recovered) | True |
| new | magnate | $758 | $1,424 | $5.6 | 0 | season 4 (recovered) | True |
| old | organizer | $561 | $1,205 | $51.0 | 12 | seasons 8→11 (recovered) | True |
| new | organizer | $3,162 | $3,162 | $465.0 | 0 | never | True |
| new | chess-only | $2,694 | $2,844 | $1,025.0 | 0 | never | True |

Reading: owning a club went from losing money (business and organizer ended near $550–560 after dipping below the $100
recovery line) to slightly ahead of a chess-only career ($3,064 / $3,162 vs $2,694), with cash never below $100. The
magnate strategy (buys every asset type) is still weak ($758): upkeep of the tools outweighs their income — a v0.9
balance item. The ledger balanced in every season of every run and no account went negative. **One seed only**:
indicative, not a distribution. Remaining seeds 102–105 reproduce with `npx tsx tools/sim/economy.ts 24 out.json
<strategy> <seed>` (prefix `CROWN_SIM_NO_PLAYER_CLUB_DUES=1` for the old policy); about 8–15 minutes per run.

## 6. Federation, ratings, leagues
docs/FEDERATION_LEAGUE_DESIGN.md: 8 divisions × 16 regional leagues (2,048 competitors); 4 Federation titles;
**no "Circuit Grades" exist**; nobody below rating ~700 and no engine weaker than the 800 L1 level. The rating-title
ladder (docs/ARCANE_FEDERATION.md) is the descriptive band system now shown in the game.

## 7. Windows and phone
* **Windows:** unzip, double-click `Start-Crown.bat` (needs Node.js 20+ LTS; first run builds) or run
  `powershell -ExecutionPolicy Bypass -File .\Start-Crown.ps1` (uses the bundled prebuilt `dist` when Node.js is
  absent). The game opens at http://127.0.0.1:5173/. Saves stay in that browser for that address. Not executed on Windows
  in this release cycle.
* **Phone (PWA):** host the `dist` folder over HTTPS (any static host) and use the browser's Add to Home Screen;
  served over plain HTTP from a PC on the LAN, the service worker does not install and the game is not available
  offline. Not tested on physical iPhone hardware.

## 8. Known issues
1. Engine gap to Fairy-Stockfish remains large (−283 to −379 Elo at equal time, 100–1000 ms); only +23 gained this cycle.
2. Played Like not validated (Calibrating).
3. Economy re-simulated for one seed only; the magnate strategy is still unprofitable (§5).
4. Vault: three legacy achievement ids use broader rules than the Hall of Fame's old evaluator (first-win, giant-slayer,
   patron) — the two screens can disagree until the Hall reads from the Vault; backups do not export unlock records
   (they are rebuilt from history on import, so wealth/Exchange unlocks that no longer hold could be lost).
5. Brilliant-move achievements wait for validated grading.
6. Population has no sub-800 opponents; no league rebalance yet.
7. Not tested on Windows or iPhone hardware.
