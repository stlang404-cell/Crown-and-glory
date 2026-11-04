# Economy v0.11 — wealth and financial progression (package M, crown-wealth-1)

Binding rules (docs/V10_PLAN.md): fictional dollars only (integer micro-units, 1,000,000 µ = $1), no pay-to-win —
nothing purchasable changes engine strength, ratings, pairings, results, standings, qualification, titles or
competitive rank — and every flow is a balanced, idempotent ledger journal. New amounts live in ONE config module,
`src/economy/wealth.ts`; the v0.4–v0.8 amounts stay where they were (`src/economy/economy.ts`, `src/heraldry/clubs.ts`).

## 1. Audit of every money source and sink

### 1.1 Issuance is per circuit (static, from the config)

| Flow | Who pays → who receives | Amount | 2,048 (16 regions) | 10,240 (80 regions) |
|---|---|---|---|---|
| League prize pools | mint → `prize:S:league:R:D` escrow → top 3 (50/30/20%) | $2,000 (D1) … $120 (D8) per circuit; $5,800 per region | $92,800 | $464,000 |
| Federation Open / Challenger Open | mint → escrow → top 8 by the Swiss split | $1,500 / $600 | $2,100 | $2,100 |
| Crown Championship | mint → escrow → champion 40%, finalist 20%, semis 10%, quarters 5% | $8,000 | $8,000 | $8,000 |
| Season sponsor budget | mint → `sponsor:S` → player milestones, club sponsorship, Club Weekend sponsor, **v0.11 sponsorship returns**; rest → treasury | $1,200 | $1,200 | $1,200 |
| **Season issuance** | | | **$104,100 = $50.83 per competitor** | **$475,300 = $46.42 per competitor** |
| Treasury replenishment | mint → treasury, toward $25,000, capped | ≤ $8,000 / season | same | same |
| Genesis, starting grant | mint → treasury / player | $25,000 / $1,000, once | same | same |

Issuance per competitor is 9% lower at 10,240 (the Open, Challenger, Championship and sponsor budget are federation-
wide, not per circuit), so the larger world is not more inflationary per player.

### 1.2 Transfers and sinks (who pays, who receives)

| Flow | Payer → receiver | Amount / rule |
|---|---|---|
| Competitor season expenses | competitors → sink | 75% of each balance at season end (100% when retired) |
| AI club dues / operations | competitors → AI clubs → sink | 5% of member balances; clubs spend 60% of theirs |
| Player club dues | members (competitors) → player | 5% of members' balances; members = appeal share (≤ 45%) of the region |
| Market subsidy, settlement | treasury → market → NPC traders, player, treasury | b·ln n per market, funded in advance |
| Trading fees | traders → fees → treasury | 1% |
| NPC wallets | treasury ↔ NPC | top-up ≤ $1,000 to a $4,000 cap; excess swept back |
| Assets (club, analyst, scouting, training, trophies) | player → sink + bond escrow; upkeep → sink | v0.4 price list (economy.ts) |
| Club levels, contracts, cosmetics, Challenger fee | player → sink / escrow / competitors | v0.4–v0.5 amounts |
| **v0.11** facilities, estates, sponsorship, loan, stipend, treasury ceiling | see §2 | wealth.ts |

The measured per-season flows by journal kind (both world sizes, chess-only runs) are in §5.3.

### 1.3 What the audit found (and what changed)

1. **Idle treasury money accumulated.** Once the treasury reached its $25,000 target, replenishment minted nothing
   but escrow remainders, unspent sponsor budgets, fees and market-maker gains kept flowing in: in the first 24-season
   run (seed 101, 2,048) the treasury held $47,594 at season 24 and circulating money per competitor still grew
   0.44% per season over seasons 13–24 (max 1.25%). Fix: a **$30,000 treasury ceiling** — the excess is retired to
   the sink at every season end (`treasury-sweep:S`). After the fix circulating money per competitor is flat from
   season 12 on (§5.2).
2. **A season-end crash (pre-existing, v0.4 contracts).** A sponsored competitor's 25% share of a Championship prize
   paid at the season end was transferred *after* club dues and the 75% season expenses; when that prize was most
   of their balance the transfer failed (`LedgerError: Insufficient funds in comp:…`) and the season could not be
   advanced. Found by the sweep (magnate, seed 104); shares are now taken right after the prizes.
3. **Club ownership led too far** after the v0.8 club sponsorship: in a first 10-seed sweep at 2,048 club owners
   ended at $8,046 mean vs $5,322 for chess-only careers of the same strength (+51%; from the run log, those runs
   were superseded). The local-sponsor pool was cut from **$600 to $400** and the new facilities' appeal reduced
   (Lounge +4%, Gallery +1%); final result +20% at 2,048 and +34% at 10,240 (§5.1).
4. Suspensions at the season end were never committed to storage (in memory only; a reload showed the asset active).
   Fixed: the season-end write now includes the assets.
5. Issuance per competitor is slightly *lower* at 10,240 ($46.42 vs $50.83) and circulating money per competitor
   settles lower too ($68.8 vs $101.5): the larger world is not more inflationary per player. Player-facing prices
   (assets, facilities, estates, cosmetics, entry fees, prize pools) are fixed nominal amounts, so there is no price
   inflation by construction; the measured quantity is the money supply per competitor.

## 2. Mechanisms added (all amounts in `src/economy/wealth.ts`)

| Mechanism | Decision it creates | Money flow | Bound |
|---|---|---|---|
| **Club facilities**: Members' Lounge ($350, $150 deposit, $30/season; appeal +4%), Spectator Gallery ($300, $100, $20; Club Weekend guests pay $12 not $5, +$20 event sponsor, appeal +1%), Heritage Library ($250, $100, $15; prestige +40, appeal +2%) | Is my region earning enough for more members to pay the upkeep? Do I host the Weekend? | player → sink + deposit escrow; dues and attendance are transfers from competitors' own balances | 45% appeal ceiling; upkeep every season; dues are 5% of what members hold |
| **Event sponsorship**: Supporter $100 / Patron $250 / Title $500 on an event of this season before it starts (own-region league circuits, Open, Challenger, Championship); max 2 per season | Which event, which tier, given how I and my region will do | stake → escrow; 60% added to the purse of the *other* prize winners, 40% event costs (sink); visibility return from the season sponsor budget = stake × min(130%, 55% + 40% × local prize-place share + 35% if I place) | return ≤ 130% of stake, ≤ 60% of the $1,200 budget per season; < 100% without results |
| **Estates**: Townhouse Study ($600, $25/season), Country Estate ($2,000, $80), Grand Chess Palace ($6,000, $200); half the price is a refundable deed deposit | Prestige vs a cash buffer | player → sink + deposit; upkeep → sink | no income at all |
| **Reputation** (0–100, start 50) | — | none | +5 per settled sponsorship, −25 on administration; moves club appeal ±10% |
| **Treasury ceiling** $30,000 | — | treasury → sink | idle federation money cannot accumulate |
| **Administration and recovery** | see §3 | | |

Rejected, and why:
* **Gating Academy content or practice modes behind a "training facility".** The Academy, Grimoire and practice modes
  are free today; selling access would take content away from players without money. The existing Training Hall
  (v0.4: unlimited unrated sparring against your next opponent's exact profile) already is the training facility.
* **Interest, dividends or any passive yield on cash or estates.** A recurring income with no upkeep or cap is the
  runaway loop this package must prevent.
* **Attendance-scaled sponsorship.** Every event's field is fixed by its format (32-player Swisses, full leagues), so
  "attendance" would be a constant; the return varies with the event's *outcome* instead.
* **Re-pricing sponsorship contracts** to rescue the magnate path: the contract rule (stipend ≥ 30% of the player's
  average earnings vs a 25% prize share) is a v0.4 decision against passive profit; changing it is out of scope and
  the magnate result is reported as measured.
* **Anything that touches ratings, pairings, qualification, titles or competitive rank.** Financial prestige stays a
  separate ladder from chess prestige.

## 3. Administration (bankruptcy) and recovery

* **Entry** (at a season end, after the club's dues and all upkeep): an obligation went unpaid (asset, club level,
  facility or estate upkeep, or a loan instalment) or net worth < $100.
* **Consequences, once on entry:** estates and facilities liquidated (deposits returned to cash), tools whose upkeep
  went unpaid sold back at their buy-back value, sponsorship contracts end, reputation −25, club appeal −10% while
  in administration. The club itself stays (suspended while unpaid) so its identity survives.
* **Restrictions while in administration:** no purchases of assets, facilities, estates or cosmetics, no club
  upgrade, no contracts, no event sponsorship; each Exchange purchase ≤ $25. **Never restricted:** games, every
  Federation event, the Challenger voucher, ratings.
* **Path back:** prize money; a hardship stipend of $8 per federation game played (≤ 10 per season, from the
  treasury); one recovery loan per episode ($300, repay $330 at $110 per season end from the next season, shown as
  a liability in net worth; missed instalments carry over as arrears).
* **Exit** at a season end when net worth ≥ $300, every bill is paid and there are no arrears.

## 4. Lifetime statistics (Finance → Lifetime Statistics)

`src/economy/stats.ts` sums every journal line on `player:cash` exactly (integer µ), grouped into earnings (prizes,
sponsorships, sponsorship returns, club dues and attendance, contract shares, hardship stipend), expenses (upkeep,
entry fees, hosting, stipends, cosmetics, sponsorship stakes), Exchange (net), property (purchases and deposits back)
and financing (starting grant, loan). The categories always sum to the cash balance (asserted in tests and in every
simulation run). Net worth over time comes from the recorded snapshots; milestones (first prize, sponsorship, club,
facility, estate, lifetime earnings $1k…$100k, net worth $2.5k…$100k, administration entered and recovered, loan
taken and repaid) are derived from the same journals.

## 5. Simulation

**Method.** `tools/sim/wealth.ts` (crown-wealth-sim-1) drives the real `FederationService` — every command, ledger
validation, prize, dues, NPC market making, upkeep, administration — for 24 seasons. Shortcuts: the player's games
and the featured engine games are sampled from the Davidson result model on hidden strengths (not played on a
board); storage is an in-memory stub (`--check-idb` replays one season through fake IndexedDB and compared all 892
account balances: 0 differ); archetypes are scripted rules, all at playing strength 1600 unless named, so the
comparison is between economic strategies at equal skill; skill references (1200 and 2000, chess only) were run for
5 seeds at 2,048 only. Seeds 101–110 at both sizes. Raw data: `docs/sim/wealth/wealth-*.json` (10,240 is split into
files a/b/c for CPU); summary `docs/sim/wealth/summary.json`
(`npx tsx tools/sim/wealth_summary.ts docs/sim/wealth/summary.json docs/sim/wealth/wealth-*.json`); runner
`tools/sim/wealth_sweep.sh`. In every run every journal balanced, no account went negative in any season, and the
lifetime statistics' cash total equalled the cash balance exactly ("Ledger exact & conserved").

Archetypes: **chess-only** (enters its Swiss event, buys nothing); **club-owner** (club, Tournament Venue, Members'
Lounge and Spectator Gallery when affordable with $300 spare); **sponsor** (its own league circuit at the largest tier
leaving $300, plus its Swiss event as Supporter, every season); **trader** (Analyst Office; 10 shares wherever the
public model exceeds the price by ≥ 4 points; skips the Swiss); **magnate** (club to Federation Club, all facilities,
contracts on its region's top-rated players, estates and Title sponsorship when rich); **reckless** (every tool and
cosmetic, estates whenever affordable, 60 shares on every match market, takes the recovery loan when cash < $100).

### 5.1 Final wealth, administration and recovery (24 seasons, starting money $1,000)
### 2,048 competitors (16 regions) — 10 seeds × 24 seasons

| Archetype | Runs | Final net worth mean ± sd | min / median / max | Final division (mean) | Runs with administration | Episodes | Recovered (mean seasons) | Still in administration at the end | Ledger exact & conserved |
|---|---|---|---|---|---|---|---|---|---|
| chess-only | 10 | $5,322 ± 876 | $4,071 / $5,287 / $6,727 | 2.8 | 0 | 0 | 0 (—) | 0 | yes |
| club-owner | 10 | $6,401 ± 919 | $4,574 / $6,526 / $7,984 | 2.9 | 0 | 0 | 0 (—) | 0 | yes |
| sponsor | 10 | $5,173 ± 1,118 | $3,526 / $5,034 / $6,747 | 2.8 | 0 | 0 | 0 (—) | 0 | yes |
| trader | 10 | $5,133 ± 803 | $4,332 / $4,747 / $6,575 | 3.0 | 0 | 0 | 0 (—) | 0 | yes |
| magnate | 10 | $2,240 ± 936 | $1,452 / $1,958 / $4,713 | 2.9 | 0 | 0 | 0 (—) | 0 | yes |
| reckless | 10 | $993 ± 580 | $160 / $912 / $1,976 | 2.8 | 7 | 18 | 15 (1.0) | 3 | yes |
| chess-weak | 5 | $3,629 ± 582 | $2,730 / $3,724 / $4,301 | 4.6 | 0 | 0 | 0 (—) | 0 | yes |
| chess-strong | 5 | $10,763 ± 1,233 | $9,162 / $10,471 / $12,351 | 1.6 | 0 | 0 | 0 (—) | 0 | yes |

Circulating money per competitor (minted − sink, $): S1 80.5 · S6 100.9 · S12 101.5 · S18 101.4 · S24 101.5; growth per season over seasons 13–24: mean -0.00%, max 1.00%. Season 24: minted 50.83 $/competitor, sunk 50.77 $/competitor; treasury $29,054.

### 10,240 competitors (80 regions) — 10 seeds × 24 seasons

| Archetype | Runs | Final net worth mean ± sd | min / median / max | Final division (mean) | Runs with administration | Episodes | Recovered (mean seasons) | Still in administration at the end | Ledger exact & conserved |
|---|---|---|---|---|---|---|---|---|---|
| chess-only | 10 | $4,780 ± 818 | $3,562 / $4,866 / $5,909 | 2.8 | 0 | 0 | 0 (—) | 0 | yes |
| club-owner | 10 | $6,411 ± 738 | $5,503 / $6,394 / $7,965 | 2.8 | 0 | 0 | 0 (—) | 0 | yes |
| sponsor | 10 | $4,446 ± 1,000 | $2,852 / $4,501 / $5,771 | 2.8 | 0 | 0 | 0 (—) | 0 | yes |
| trader | 10 | $5,244 ± 882 | $4,092 / $5,203 / $6,699 | 2.7 | 0 | 0 | 0 (—) | 0 | yes |
| magnate | 10 | $2,050 ± 510 | $1,562 / $1,908 / $3,320 | 2.8 | 0 | 0 | 0 (—) | 0 | yes |
| reckless | 10 | $1,195 ± 457 | $369 / $1,179 / $1,973 | 2.7 | 4 | 10 | 9 (1.0) | 1 | yes |

Circulating money per competitor (minted − sink, $): S1 61.4 · S6 68.7 · S12 68.9 · S18 68.8 · S24 68.8; growth per season over seasons 13–24: mean -0.01%, max 0.46%. Season 24: minted 46.42 $/competitor, sunk 46.34 $/competitor; treasury $29,225.

### 5.2 Reading

* **Skill dominates.** At 2,048, +400 rating points (2000 vs 1600, chess only) is worth +$5,441 (+102%); −400 costs
  −$1,693 (−32%). No economic strategy at equal strength comes close: the best, club ownership, is +$1,079 (+20%) at
  2,048 and +$1,631 (+34%) at 10,240. (The 10,240 skill references were not run.)
* **Club ownership** is the one durable non-chess income (average lifetime at 2,048: sponsorships $7,120 incl. the
  appeal-based local sponsor and the Weekend sponsor, dues $2,288, attendance $381 against hosting $2,820, upkeep
  $2,774, purchases $1,550). It is bounded by the 45% appeal ceiling, the $400 local-sponsor pool and upkeep.
* **Event sponsorship is roughly break-even money and buys reputation**: returns/stakes 0.998 at 2,048 (league
  circuits 1.073, Swisses lower) and 0.977 at 10,240; the sponsor ends slightly below chess-only ($5,173 vs $5,322;
  $4,446 vs $4,780), partly because sponsorship returns and milestone sponsorships share the season budget.
* **Trading** is a modest side income (Exchange +$671 lifetime at 2,048, +$773 at 10,240), offset by the Analyst
  Office and by skipping the Swiss.
* **Magnate stays weak** ($2,240 / $2,050): contract stipends ($11,455) exceed contract prize shares ($5,974) — the
  v0.4 contract rule, unchanged by design (§2). Estates and facilities are sinks.
* **Reckless spending is punished but recoverable**: 7 of 10 careers at 2,048 (4 of 10 at 10,240) entered
  administration, 28 episodes in total, every completed episode ended after **one season** (liquidation returns the
  deposits and buy-back values); 4 runs were still in an episode that began in the final season. The loan was taken
  3 times (10,240) and never at 2,048 (liquidation left at least $100). The hardship stipend averaged $120 per reckless career at 2,048 and $80 in seeds 101–105 at 10,240.
  Reckless careers end at ≈ $1,000–1,200 — they are never locked out of chess, and administration repeats because the
  script rebuys the same estates at once.
* **Inflation**: circulating money per competitor (minted − sink) is flat from season 12: 2,048 $101.5 (S12) →
  $101.5 (S24), mean growth −0.00% per season over seasons 13–24 (max 1.00%); 10,240 $68.9 → $68.8, −0.01% (max
  0.46%). Season 24 mint vs sink per competitor: $50.83 vs $50.77 (2,048), $46.42 vs $46.34 (10,240). Mean competitor
  balance S12 → S24: $15.10 → $14.81 (2,048), $13.85 → $13.77 (10,240). Treasury ≈ $29,000 (below the ceiling).

### 5.3 Measured flows per season (chess-only runs, mean of 10 seeds, $ per season; + receives, − pays)

| Journal kind | 2,048 | 10,240 |
|---|---|---|
| mint (season issuance + treasury replenishment, averaged over 24 seasons incl. season 1) | mint −110,928 → prize escrow +107,188, sponsor budget +1,250, treasury +2,490 | mint −497,590 → prize escrow +493,854, sponsor budget +1,250, treasury +2,486 |
| prize | escrow −102,900 → competitors +102,814, player +86 | escrow −474,100 → competitors +474,026, player +74 |
| expenses (competitor 75%) | competitors −95,219 → sink | competitors −438,873 → sink |
| club-dues / club-ops (AI clubs) | 6,337 / 6,160 → sink | 29,278 / 28,456 → sink |
| market-subsidy | treasury −9,451 → markets | treasury −9,468 → markets |
| market-settle | markets −31,170 → NPC +26,006, treasury +5,164 | markets −31,390 → NPC +26,091, treasury +5,300 |
| trade-buy (NPC) | NPC −22,783 → markets +22,558, fees +226 | NPC −22,984 → markets +22,757, fees +228 |
| transfers (unspent sponsor budget, fees, NPC sweep → treasury) | treasury +5,082 | treasury +5,008 |
| treasury-sweep (v0.11) | treasury −873 → sink | treasury −882 → sink |
| sponsor (player milestones) | sponsor budget −119 → player | −109 → player |

## 6. Tests and journeys

* `tests/wealth.test.ts` (13 tests): every v0.11 journal balances and never mints, re-posting is a no-op; sponsorship
  return bounds; v0.9 records read as defaults; static no-pay-to-win (purchasable effects are only money, appeal or
  prestige); facilities (club required, deposit in net worth, upkeep exactly once per season end, appeal, reload
  gives identical balances and wealth state with no new journals, refund on close); estates; event sponsorship
  (window, per-season limit, purse never paid to the sponsor, return ≤ cap, reputation, treasury ≤ ceiling);
  administration (entry on unpaid upkeep, liquidation, reputation hit, restrictions, loan once and as a liability,
  hardship stipend only for played games and ≤ 10, recovery after one season, loan instalment exactly once per
  season across a reload, lifetime statistics exact and with the milestones); a player in administration with no
  spare money still registers for the Challenger Open with the voucher and plays every round; **dynamic
  no-pay-to-win**: two worlds of the same seed, one spending on a facility, sponsorships or an estate, have identical
  ratings, RDs, divisions, every fixture and result, Championship qualifiers and player record (rank/division,
  titles); a v0.9 save (player record without `wealth`) loads, keeps its net worth, finishes a season and can build.
* Full suite: see the hand-back report. Journeys against a production build (`npx vite build && node
  scripts/serve.mjs --dir dist --port 4436`): `e2e/finance.mjs` (new, 8/8: panels present, fresh career $0
  liabilities and $0 earnings, club + Lounge + Supporter sponsorship bought with on-screen buttons → cash $50 and net
  worth $500 equal to the ledger, one journal per action, reload changes nothing, unaffordable buttons disabled, 390 px
  no overflow, no page errors; screenshots `docs/screenshots/v0.11/finance-*.png`), `e2e/dashboard.mjs` (all checks
  passed) and `e2e/nav-audit.mjs` (all checks passed).

## 7. Changes to earlier behaviour (for the integrator and packages I/K)

* Contract prize shares are taken before club dues and season expenses (fix for the season-end crash, §1.3).
* Upkeep is charged **after** club dues at a season end (was before): a club's own income now counts toward its
  upkeep. Same amounts.
* Season-end asset state (suspension, liquidation) is now committed with the season-end write; before, a suspension
  was only in memory and a reload showed the asset active again (bug).
* `finance()` returns `liabilities` (the outstanding recovery loan); `netWorth` subtracts it. Package I's header
  should show `finance().netWorth`.
* Financial prestige adds estates, facilities and settled sponsorships (`withWealthPrestige`).
* `CLUB_SPONSOR_POOL` (economy.ts) $600 → $400; the treasury ceiling ($30,000) is new. No prize amount or
  qualification rule was changed. If package K changes prize pools, re-run
  `tools/sim/wealth.ts`; the sponsorship settlement hooks take any event's recipients list.

## 8. Limits and what is not done

* Sampled games, scripted archetypes, one playing strength per archetype; skill references only at 2,048 (5 seeds).
  Not claimed: a validated best strategy or perfect balance.
* Club ownership remains the strongest non-chess path (+20% / +34% at equal strength). It is bounded and below the
  value of skill, but if package K raises chess prize money at 10,240 the gap narrows; re-run the sweep after K.
* The magnate archetype is still weak because of the unchanged v0.4 contract rule.
* Administration in the simulations is always left after one season because liquidation restores cash; the loan
  path was exercised 3 times (10,240) and in the unit tests.
* No browser journey reaches administration (it needs a season end with real engine games); it is covered by
  `tests/wealth.test.ts`. Package I's header must read `finance().netWorth` (now net of the loan).
