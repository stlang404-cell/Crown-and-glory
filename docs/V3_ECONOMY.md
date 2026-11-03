# Economy and simulation report (crown-economy-1, crown-sim-1)

All amounts are fictional crowns (₵). Raw data: `docs/sim/economy-results.json`, produced by
`npx tsx tools/sim/economy.ts 6 docs/sim/economy-results.json` (7 strategies × 6 seasons, 338 s).

## 1. Money flows

| Flow | Source → destination | Amount |
| --- | --- | --- |
| Genesis | mint → treasury | 25,000 (once) |
| Starting grant | mint → player | 1,000 (once) |
| Season issuance | mint → prize escrows + sponsor budget | league pools 2,000…120 per division (128 divisions), Open 1,500, Challenger 600, Championship 8,000, sponsor 1,200 — 104,100 per season |
| Treasury replenishment | mint → treasury | toward 25,000, capped at 8,000 per season |
| Prizes | escrow → winners | by the published splits; remainder → treasury |
| Sponsor milestones | sponsor budget → player | 50–300 each, once per milestone; unused budget → treasury |
| Market subsidy | treasury → market | ⌈120 ln 3⌉ ≈ 131.83 per market; remainder back at settlement |
| Trading fees | traders → fees → treasury | 1% of each trade, recycled at season end |
| NPC wallets | treasury → NPC | ≤ 1,000 per season each, cap 4,000, only while treasury > 10,000 |
| Competitor expenses | competitors → sink | 75% of each balance at season end (100% when retired) |
| Assets | player → sink / bond escrow | purchase price; upkeep each season; resale/bond refunded on sale |
| Entry fee | player → Challenger pool | 25 |

Money is created **only** by explicit `mint:*` journals (genesis, starting grant, season issuance,
treasury replenishment) — asserted in `tests/federationService.test.ts`.

## 2. Problems found by the simulation and fixed

1. **Unbounded competitor wealth.** The first run had no sink for competitor prize money: ~100,000 ₵
   accumulated per season forever. Fix: season expenses (75%) to a sink. Circulating supply now converges.
2. **Treasury drain.** Subsidies and NPC top-ups drained the treasury ~1,400 ₵ per season; it would have
   run out and stopped new markets. Fix: capped treasury replenishment plus a guard that only opens markets
   whose subsidy is funded. The treasury now holds 24–26k from season 3 on.
3. **Exploitable prices.** With the informed NPC trading first, opening prices stayed ~18 points from the
   public model, and "buy the biggest model edge" earned more than winning chess games. Fix: the analyst
   trades last, so prices end within a few points of the model.
4. **Knockout scheduling bug.** A knockout follow-up game for the player was only scheduled after the round's
   featured games, so "Advance" failed in Club Weekend rounds. Fixed in `settleRound`; Advance now explains it.

## 3. Results after the fixes (6 seasons)

Every one of the 42 strategy-seasons: ledger conserved (sum of all balances = 0), **no negative account**.

| Strategy | Final division | Cash S6 | Net worth S6 | Titles | Trading P&L |
| --- | --- | --- | --- | --- | --- |
| Chess only (1600) | 6 | 1,594 | 1,594 | 1 | — |
| Successful (2100) | 4 | 3,727 | 3,727 | 5 | — |
| Losing (800) | 8 | 900 | 900 | 0 | — |
| Conservative trader (1300) | 7 | 1,591 | 1,591 | 1 | +27 (105 trades) |
| Aggressive trader (1300) | 7 | 1,763 | 1,763 | 0 | +343 (264 trades, 5,117 spent) |
| Hybrid (1700, analyst, conservative trading) | 6 | 1,698 | 1,848 | 2 | +58 (97 trades) |
| Business (1500; club, scouting, analyst) | 6 | 269 | 819 | 1 | — |

Federation health (all runs): active population constant (2,047 + player); ≈ 100 retirements per season
replaced by entrants; mean public rating stable (1,828–1,842); correlation between public rating and hidden
strength 0.983–0.987.

Supply: circulating money (minted − sink) 164k → 186k, growing **0.6%** in season 6 (converging).

### Wealth concentration and market-maker reserves (added in the M3 pass)

| Measure (after season 6) | Range across the 7 runs |
| --- | --- |
| Gini of competitors' lifetime earnings | 0.760 – 0.767 |
| Share of earnings held by the top 1% (21 competitors) | 17.4 – 21.4% |
| Settled markets | 264 per run |
| Market-maker P&L, all markets (before fees) | −0.1 to −3,616 ₵ (≈ 0 to −14 ₵ per market) |
| Worst single market | −120.2 ₵ (theoretical bound −b·ln 3 = −131.8 ₵, funded in advance) |

The high Gini is structural: prize pools fall geometrically from 2,000 ₵ (Crown Division) to 120 ₵ (Open
Division), so the top divisions earn most — by design, as in real sport. Market-maker losses are the price of
liquidity, paid from pre-funded subsidies; the treasury stays at 24.8–26.5k ₵ in every run.
Long-horizon federation stability (40 seasons) is reported in docs/V3_FEDERATION.md §7.

## 4. Interpretation (honest)

- **Chess results drive wealth.** The strongest player earns the most; winning is the main income.
- **Trading is a modest, risky side income**, not a money machine: the aggressive strategy made ≈ 57 ₵ per
  season on ≈ 850 ₵ traded per season, and its cash fell in some seasons (S4: −137). Conservative trading is roughly break-even.
- **A losing player cannot go bankrupt**: cash falls only by the optional 25 ₵ Challenger entry per season
  (900 after six seasons); no debt exists, and the recovery voucher becomes available below 100 ₵.
- **Assets are real choices with real costs.** The business strategy's assets cost 75 ₵/season upkeep and
  the Club Weekend does not pay that back at 1500 strength, so its net worth fell to 819. The Analyst Office
  and Scouting Department buy information and convenience, not income. That is intended but means the club
  is a prestige purchase, not an investment — stated in the UI.
- **Limits of this simulation**: player games and featured games are sampled from the result model rather
  than played (stated in the tool header); strategies are scripted; 6 seasons, one seed each. Longer horizons
  and seed sweeps are in the v0.4.0 plan.
