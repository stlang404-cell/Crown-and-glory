# v0.11.0 "The Crown Legacy" — release report (includes the v0.10.0 "Living Arena" checkpoint)

Release: `release/crown-and-calculation-v0.11.0.zip` (about 7.3 MB, 609 files: source at cc9725d + its verified prebuilt `dist`; checksum in `release/SHA256SUMS.txt`).
All browser checks ran in Chromium (Playwright) on a shared 4-core Linux VM at desktop and 390 px phone sizes.
**Not tested on a physical iPhone, in Safari/WebKit, or on Windows.** Phone performance figures are Chromium with
4× CPU throttling (a proxy). Everything below is measured or marked as not done. Engine search/eval/level files were
not changed in v0.11 (another team's engine work is isolated).

## 1. What is new since v0.9.0

| Area | Delivered | Evidence |
|---|---|---|
| Rating spectrum 0–4,000+ | Four calibrated beginner engines below L1 (664 / 446 / 302 / 71, 1,320 games, Bradley–Terry); owner's population pyramid for new federations; strength above ~3,040 labelled "plays at the strongest measured engine" | docs/RATING_SPECTRUM.md |
| 10,240 competitors | New default; round median 241 ms desktop / 799 ms at 4× throttle (old code 1,414 / 2,579 ms); chunked storage; population analytics screen | docs/FEDERATION_SCALE.md §0, `e2e/population.mjs` |
| Famous personas | 409 historical + 350 contemporary fictional chess personas (all owner-named people included); names only, seeded random ratings; disclosure; Settings switch | docs/ROSTER.md |
| Opponent styles | crown-styles-6: Tactical, Positional, Defensive, Endgame, Aggressive (refined rule), Gambiteer, Materialist; scouting lines | docs/STYLES_REPORT.md |
| Match Center | Evaluation bar (spectate / replay / analysis only, never in your own game in progress), Live Match Center, Replay & Analysis Center with recorded market sync and sandbox, Replay Library | `e2e/replay-center.mjs` |
| Crown Exchange | Integrity audit (bugs #26–#33 fixed, 2 high), Decisive and Over/Under markets, close position, P&L, watchlist, Forecasting League | docs/MARKET_INTEGRITY.md |
| Played Like Performance Elo | crown-played-like-2: numerical, both sides, held-out MAE 356 vs 477 (accuracy line); permanent records (best/low clickable, averages, history, model-versioned) | docs/PLAYED_LIKE.md |
| Careers start at 0 | New careers: Glicko-2 at 0 ±350, display floor 0, provisional until 20 games and ±100; Start New Career with backup; existing careers unchanged | docs/CAREER_RATING.md |
| Legacy header & Trophy Hall | Rank + insignia + career Elo + division in Dashboard/Profile headings; compact iPhone header; 14 trophies / 10 kinds; customisation of earned items only | docs/LEGACY.md |
| Feudal ranks | 16 approved Circuit Grades × III/II/I = 48 steps; standing-score rule with hysteresis (4.9 % reversals vs 28 % without); highest rank ever; rank guide; ranks for all AI | docs/FEUDAL_RANKS.md |
| Rank vs title | Competitive Rank and Federation Title in separate labelled areas with distinct frames, tags and tooltips; independence tested | docs/FEUDAL_RANKS.md §0 |
| Sovereign Vault | crown-vault-2: 174 achievements (72 new) in 20 families and 4 tiers; anti-farming rules; original 142 preserved (5 rules gained one documented "established rating" clause) | docs/ARCANE_FEDERATION.md §5.1 |
| Shared Federation | Zonal Championships, Regional Cups, new qualification paths, postpone/forfeit rule (never auto-played), Your Season, brackets, rivalry challenges | docs/V3_COMPETITION_RULES.md |
| Wealth | Club facilities, event sponsorship, estates, reputation, treasury ceiling, administration and recovery, lifetime statistics; 24-season sims at both sizes | docs/ECONOMY_V11.md |
| Exhibition Arena | Any two competitors, own engine profile and style, full analysis and Played Like, separate archive; isolation proven by state hash | `tests/exhibition.test.ts` |

## 2. Release gate (clean worktree of dfffab6; logs in docs/evidence/v0.11-gate/)

| Gate | Result |
|---|---|
| `tsc --noEmit` | pass |
| vitest | **773 passed** (70 files), none skipped |
| build + `verify-dist` | pass |
| Journeys | run, offline, analysis 16, nav-audit 6, motion-sound 11, motion-extra 9, quick-match 10, vault 15, grimoire, dashboard 11, practice, academy, market-integrity 10, population 11, legacy 13, new-career 19, federation-career 12, exhibition 18, ranks 27, finance 9, m6-arena 11/11, **v5 save migration 20/20**, **pages-check (GitHub Pages + automatic updates)** — all pass |
| replay-center | 16/17 in the gate: the flip check read the bar before and after the Match Analysis landed (source switch between two readings). Fixed in the test (wait for the report; same strict equality) — 3/3 reruns 17/17; six diagnostic reruns before the fix also passed. Only the test file changed after the gated commit. |

Two intermittent journey issues were investigated rather than rerun away: the 390 px bottom-gap check (a race
with the Played Like panel growing after analysis; reproduced 6/6 under the race, fixed by measuring a settled
layout — docs/evidence/v0.11/bottom-gap.md) and the replay flip check (above). One further flake remains open: a
rating event once took > 30 s to appear after a reload under very heavy load (1 in 12 parallel runs).

## 3. Known limits
* Not measured on a physical iPhone, Safari or Windows.
* Engine strength above ~3,040 is not measured; legendary ratings are Federation ratings.
* L2's published 1,122 looks too high on held-out games (gap to L0a ≈ 230, not 458): to recalibrate in v1.0.
* Played Like is calibrated on engine games only; single-game ±~520 (80 %); compressed at both ends.
* Qualification at 10,240: below ~1,900 a player does not reach the Championship within 10 seasons; Crown Division
  players rarely reach the zonal field.
* Club ownership remains the strongest non-chess wealth path (+20–34 %); magnate archetype weak.
* The visual-identity package (royal palette, crests, emblems) and the v1.0 items (onboarding, accessibility audit,
  engine re-validation, loop audit, performance budgets, release candidate) are next.

## 4. Merging (owner action)
The branch is not merged. `main` is v0.9.0. Merging `claude/fervent-brahmagupta-fnui2e` into `main` deploys v0.11 to
the iPhone URL; the installed app updates itself and existing saves migrate (tested from v0.4 and v0.9 formats).
