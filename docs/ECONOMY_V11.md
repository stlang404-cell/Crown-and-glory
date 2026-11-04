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

SIM_FINDINGS

## 2. Mechanisms added (all amounts in `src/economy/wealth.ts`)

| Mechanism | Decision it creates | Money flow | Bound |
|---|---|---|---|
| **Club facilities**: Members' Lounge ($350, $150 deposit, $30/season; appeal +5%), Spectator Gallery ($300, $100, $20; Club Weekend guests pay $12 not $5, +$20 event sponsor, appeal +2%), Heritage Library ($250, $100, $15; prestige +40, appeal +2%) | Is my region earning enough for more members to pay the upkeep? Do I host the Weekend? | player → sink + deposit escrow; dues and attendance are transfers from competitors' own balances | 45% appeal ceiling; upkeep every season; dues are 5% of what members hold |
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

SIM_RESULTS

## 6. Tests and journeys

TESTS

## 7. Changes to earlier behaviour (for the integrator and packages I/K)

* Upkeep is charged **after** club dues at a season end (was before): a club's own income now counts toward its
  upkeep. Same amounts.
* Season-end asset state (suspension, liquidation) is now committed with the season-end write; before, a suspension
  was only in memory and a reload showed the asset active again (bug).
* `finance()` returns `liabilities` (the outstanding recovery loan); `netWorth` subtracts it. Package I's header
  should show `finance().netWorth`.
* Financial prestige adds estates, facilities and settled sponsorships (`withWealthPrestige`).
* No prize amount or qualification rule was changed. If package K changes prize pools, re-run
  `tools/sim/wealth.ts`; the sponsorship settlement hooks take any event's recipients list.
