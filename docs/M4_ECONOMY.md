# v0.4.0 economy and long-horizon balance

Tools: `tools/sim/economy.ts` (crown-sim-2) runs the **real** FederationService (all market families, NPC
traders, institutions, ledger validation, atomic commits; fake IndexedDB) and `tools/sim/federation.ts` runs the
world alone for 40 seasons. Shortcuts, stated honestly: the player's games and featured engine games are
**sampled** from the result model (hidden strengths) instead of being played on a board; strategies are scripted.
Raw data: `docs/sim/economy-v4.json`, `docs/sim/federation-results*.json`; summary: `node tools/sim/summarize.mjs`.

## 1. Multi-seed strategy study — 9 strategies × 3 seeds (1000, 2000, 3000) × 4 seasons (2,069 s)

Values are mean ± standard deviation across the three seeds after season 4 (crowns).

| Strategy | Final division | Cash | Net worth | Trading P&L | Contracts (earned − paid) | Club level | Titles | Conserved, no negative account |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chess only (1600) | 6 ± 0 | 1686 ± 211 | 1686 ± 211 | — | — | — | 1 ± 1 | yes |
| Successful competitor (2100) | 4 ± 1 | 3270 ± 380 | 3270 ± 380 | — | — | — | 5 ± 1 | yes |
| Losing player (800) | 8 ± 0 | 950 ± 0 | 950 ± 0 | — | — | — | 0 | yes |
| Conservative trader (1300) | 7 ± 1 | 1339 ± 171 | 1339 ± 171 | +8 ± 20 | — | — | 0 | yes |
| Aggressive trader (1300) | 7 ± 1 | 1508 ± 201 | 1508 ± 201 | +198 ± 315 | — | — | 0 ± 1 | yes |
| Hybrid (1700, analyst, conservative trading) | 6 ± 1 | 1708 ± 228 | 1858 ± 228 | +38 ± 14 | — | — | 2 ± 1 | yes |
| Business owner (1500, club + departments) | 6 ± 1 | 259 ± 198 | 809 ± 198 | — | — | 1 | 1 | yes |
| Market specialist (1300, all families) | 7 ± 0 | 1183 ± 132 | 1333 ± 132 | +112 ± 49 | — | — | 1 ± 1 | yes |
| Business magnate (1500, club upgrades + contracts) | 6 ± 1 | 372 ± 266 | 739 ± 204 | — | −357 ± 352 | 1 ± 1 | 1 ± 1 | yes |

System-wide (all 27 runs): every journal balanced and **no account went negative in any of the 108 strategy-seasons**;
treasury 23,711 ± 490 ₵ at the end; earnings Gini 0.797 ± 0.004 (top-1% share 0.205 ± 0.011); market maker total
−2,856 ± 1,396 ₵ over 200 settled markets per run, **worst single market −333.3 ₵** (a 32-state Open champion market
whose funded bound is 150·ln 32 = 519.9 ₵); settled per run: 176 match, 8 tournament-champion, 4 promotion,
4 qualification, 4 season-title, 4 conditional final-four markets.

## 2. What the study found (including failures)

1. **Contracts were a passive-profit machine (fixed).** In the first run, signing the top Crown Division players
   earned 450 ₵ against 320 ₵ of stipends in one season. Stipends are now priced at ≥ 30% of the competitor's own
   average season earnings (and ≥ 10% of their division pool), repriced at renewal, against a 25% prize share — the
   magnate strategy that signs the highest-rated players now loses 357 ± 352 ₵ over four seasons. Profit requires
   spotting players who will outperform their record (scouting), and is not guaranteed.
2. **Circulating money grew 4.3% ± 0.6% in season 4 — a transient, not a leak.** My first diagnosis (NPC trading
   profits accumulating) was wrong: eight NPC wallets are funded from the treasury at genesis (16,000 ₵), leaving it
   near 9,000 ₵, and the capped replenishment then refills it toward its 25,000 ₵ target over three seasons; that
   refill is counted as circulating money. An 8-season run (§3) shows growth falling to 0.5–1.0% per season once
   the treasury is refilled. A season-end sweep of NPC balances above their 4,000 ₵ cap back to the treasury was
   added anyway as a safeguard (it lowered NPC wallets from ≈ 34.2k to ≈ 33.0k ₵ in the confirmation run — a small
   effect, since eight wallets at the cap already hold 32k).
3. **Chess results remain the main income.** The successful competitor ends with roughly twice the chess-only net
   worth; titles and promotions drive prizes and sponsorships.
4. **Trading is a risky side income.** Aggressive trading averages +198 ₵ but with ±315 across seeds (one seed lost
   money); the market specialist trading season and tournament families on model edges earns +112 ± 49 ₵ — positive in
   all three seeds (plausibly because those markets see fewer NPC trades than match markets; not separately measured).
   It is small relative to chess income.
5. **Institutions are strategic costs, not passive income.** Clubs, upgrades and departments reduce cash (business
   259 ± 198 ₵) while adding book value, Club Weekend games, prestige and contracts. With these scripted strategies the
   business path has the lowest net worth; it is viable only combined with strong chess or a scouting edge. This is a
   deliberate design choice (directive: avoid guaranteed passive-profit machines) but means the pure "magnate" path
   is weak — recorded for M5 balancing (docs/M5_ROADMAP.md §5).
6. **No bankruptcy.** The losing player keeps 950 ₵ (only optional entry fees are spent); no debt exists anywhere.

## 3. NPC profit sweep — confirmation run

Chess-only strategy, seed 1000, 8 seasons, with the NPC sweep (`docs/sim/economy-v4-long.json`):

| Season | Circulating ₵ | Growth | Treasury ₵ | NPC wallets ₵ | Competitor accounts ₵ |
| --- | --- | --- | --- | --- | --- |
| 1 | 164,403 | — | 9,354 | 22,912 | 25,068 |
| 2 | 179,911 | 9.43% | 10,145 | 31,002 | 31,348 |
| 3 | 190,418 | 5.84% | 17,558 | 32,860 | 32,679 |
| 4 | 196,737 | 3.32% | 24,454 | 32,993 | 31,934 |
| 5 | 198,793 | 1.05% | 25,982 | 32,737 | 32,816 |
| 6 | 199,920 | 0.57% | 26,727 | 33,362 | 32,767 |
| 7 | 201,763 | 0.92% | 28,819 | 32,309 | 33,435 |
| 8 | 202,874 | 0.55% | 29,486 | 32,813 | 33,371 |

Conserved with no negative account in every season. After season 4 the residual growth (≈ 0.5–1%) comes from
escrow remainders, fees and sweeps returning to a treasury that is already at its target (replenishment then
mints nothing); it is below the M5 acceptance threshold of 2% per season but not zero.

## 4. Federation stability — 40 seasons × 3 seeds

| Seed | Mean public rating (min–max over seasons) | Rating SD | Rating–strength correlation (min) | League mobility | Champions (distinct / titles / most by one) |
| --- | --- | --- | --- | --- | --- |
| 42 | 1,831.5 – 1,839.7 | 445 – 449 | 0.982 | 20.5 – 21.6% | 18 / 41 / 7 |
| 7 | 1,827.8 – 1,834.1 | 453 – 455 | 0.983 | 20.4 – 21.3% | 20 / 40 / 6 |
| 99 | 1,832.1 – 1,839.4 | 447 – 453 | 0.982 | 20.2 – 21.5% | 24 / 43 / 5 |

No rating inflation or deflation trend; at most 0.73 s of CPU per headless season.

## 5. Limits

Four seasons per economy run (CPU budget); three seeds; scripted strategies; sampled game results; asset
affordability was not studied separately beyond the business and magnate strategies above. Not claimed: perfect
balance or a validated "best" strategy.
