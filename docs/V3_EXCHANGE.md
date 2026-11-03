# Crown Exchange — mathematics and accounting (crown-exchange-1)

All money is **fictional crowns (₵)** with no real-world value, no purchase, no withdrawal. Code:
`src/exchange/lmsr.ts`, `src/exchange/market.ts`, `src/exchange/ledger.ts`, `src/exchange/npc.ts`;
tests: `tests/exchange.test.ts`, `tests/federationService.test.ts`, browser journey `e2e/federation.mjs`.

## 1. What is listed

One categorical market per **featured AI-vs-AI match**: outcomes *White wins*, *Draw*, *Black wins*. A
share of an outcome pays exactly 1 ₵ if that outcome happens. Matches involving the player are never
listed (enforced when markets are chosen and again in `trade`). Background (summary-result) pairings are
not listed.

## 2. Market maker: fixed-liquidity LMSR

- Cost function C(q) = b · ln Σᵢ e^{qᵢ/b}, computed with log-sum-exp for stability; b = 120 for every market;
  q₀ = (0, 0, 0) (uniform opening prices ⅓).
- Price pᵢ = e^{qᵢ/b} / Σⱼ e^{qⱼ/b}; prices always sum to 1.
- Buying k shares of i costs C(q + k·eᵢ) − C(q); selling returns C(q) − C(q − k·eᵢ).
- **Worst-case maker loss** is b · ln 3 ≈ 131.83 ₵. That subsidy, rounded **up** to whole microcrowns
  (131,833,476 µ), is transferred from the treasury into the market's subsidy account **before** the market
  opens; a market whose subsidy the treasury cannot fund is not opened (the match stays featured, unlisted).
- Shares are whole numbers; no short selling (you can only sell shares you hold).

## 3. Integer accounting

- Unit: microcrown (µ), 1 ₵ = 1,000,000 µ; every amount stored and posted is an integer.
- Directed rounding always favours solvency: buy cost rounded **up** (with a 1e-6 guard against float
  error), sale proceeds rounded **down**, fee = ⌈amount × 100 / 10,000⌉ (1%, rounded up).
- Double-entry ledger: each operation is one **journal** whose lines sum to exactly 0. Validation
  (`validateJournal`) rejects non-integers, unbalanced journals, any account that would go negative (except
  the issuance accounts `mint` / `sandbox:mint`) and any journal mixing sandbox and official accounts.
- Journal ids are unique idempotency keys (`market-open:<id>`, `trade:<market>:<seq>`, `settle:<market>`);
  posting an existing id is a no-op.

| Event | Journal lines |
| --- | --- |
| Open | treasury −S, market:subsidy +S (S = ⌈b ln 3⌉) |
| Buy | holder −(cost + fee), market:collateral +cost, fees +fee |
| Sell | market:collateral −proceeds, holder +(proceeds − fee), fees +fee |
| Settle on outcome k | collateral −all, subsidy −S, each holder +shares_k ₵, treasury +remainder |
| Cancel | as settle, every share pays ⅓ ₵ (rounded down per holding), remainder to treasury |

**Solvency.** The collateral account holds at least C(q) − C(0) (all rounding is in the maker's favour), so
collateral + subsidy ≥ maxᵢ qᵢ ₵ = the largest possible payout; settlement asserts it and would refuse
an insolvent market. Randomised tests (`tests/exchange.test.ts`) check maker loss ≤ b ln 3, solvency,
conservation and idempotent settlement over 30 random runs of 150 trades each (4,500 trades), checking every possible outcome.

## 4. Lifecycle and information timing

`open` → (player and NPC trading) → `closed` → `settled` (or `cancelled`).
The market is closed and the closure **committed** before the featured game's first move is generated, so
no move, evaluation or result exists while trading is possible. Settlement commits the game record, the
fixture result and the settlement journal in one transaction. Settlement and cancellation are terminal and
idempotent (`settle:<market>` id; a second attempt throws "already resolved" and posts nothing).

## 5. Model probability vs market price

The research page shows two different numbers side by side:

- **Model probability** — `crown-result-model-1` (Davidson, ν = 0.9) on the two **public** ratings. It is
  a forecast, not a price, and does not move with trading.
- **Market price** — the current LMSR price after all trades; what a share costs at the margin.

With the Analyst Office the page adds White's expected score, the White-win probability across ±1 RD of
both ratings (rating uncertainty, explicitly not a model confidence interval) and the price history.
Paper forecasts (free, no money) are scored with the Brier score against the result; the Exchange page
compares your average with the model's on the same markets.

## 6. NPC traders

Five NPC traders (`src/exchange/npc.ts`) trade once when a market opens, from **public** information only
(the model probability plus their own seeded noise and bias): a favourite-backing fan club, a contrarian, a
novice (large noise), a conservative fund and, last, an informed analyst. Each buys toward its belief minus
a margin, limited by a share of its wallet. Wallets start at 2,000 ₵ from the treasury and are topped up
each season by at most 1,000 ₵ to a 4,000 ₵ cap while the treasury holds more than 10,000 ₵. NPCs never
see hidden strengths or results.

Measured effect (seed 555, two markets): opening prices end within 1–5 points of the model
(e.g. model 0.866/0.115/0.019 → price 0.857/0.072/0.072), leaving small noise-driven edges.

## 7. Fees and where money goes

Fees accumulate in `fees` and are recycled to the treasury at season end. Settlement remainders (unused
subsidy and collateral) return to the treasury. The treasury therefore pays for market subsidies and NPC
wallets and receives fees and remainders; it is replenished at each season start toward 25,000 ₵ by an
explicit `mint:treasury:<season>` entry capped at 8,000 ₵ (see `docs/V3_ECONOMY.md`).

## 8. Sandbox Exchange

Not implemented in v0.3.0. The ledger already supports separate `sandbox:` accounts (and rejects any
journal mixing them with official accounts), but no sandbox markets on the player's own casual games are
created yet. Blocker: game-integrity design for markets on games the player influences (the player must
not be able to profit by throwing their own casual game into a sandbox position). Next action: v0.4.0
plan, section "Sandbox Exchange".

## 9. Not offered

No real money, no deposits or withdrawals, no lending, leverage or short selling, no order book, no
trading on the player's own official games, no markets on summary-result pairings.
