# Crown Exchange — market integrity audit (v0.10, work package E)

All money is fictional dollars ($) with no real-world value: nothing can be bought with real money, withdrawn or
redeemed. This audit covers the mathematics, accounting, information timing and exploit surface of the Crown Exchange
(`src/exchange/*`, `src/app/markets.ts`, the market wiring in `src/app/federation.ts`), the v0.10 additions, and a
Monte Carlo study of simulated traders. Defects found are logged in docs/BUG_REGISTER.md as **#26–#33**; every one is
fixed and has a regression test or a reproducible measurement.

Builds on docs/V3_EXCHANGE.md (accounting), docs/M4_EXCHANGE.md (market families, solvency proof, in-play audit) and
docs/ODDS_MODEL.md (crown-odds-2 information policy), which remain valid except where this document says otherwise.

## 1. Summary

| Area | Verdict | Defect |
|---|---|---|
| LMSR cost and price functions | Correct; prices are coherent probability vectors | — |
| Probability normalisation (prices, models, payout vectors) | Correct | — |
| Liquidity b and funded subsidy | Correct; maker loss ≤ b·ln n (or b·ln(1/min p0)) in every fuzzed resolution | — |
| Fee math (1%, rounded up) | Correct | — |
| Micro-unit accounting, rounding direction | **Violated at large inventories** | #26 (fixed) |
| Duplicate settlement | Correct (terminal states, unique `settle:` id, idempotent journals) | — |
| Stale quotes / revisions | Correct for match markets; extended to the API and Close Position | — |
| Trade atomicity (IndexedDB) | Correct (one transaction per command); now also tested for trades and Close Position | — |
| No look-ahead | **Two timing gaps and one stale snapshot** | #28, #29, #30 (fixed) |
| Balance conservation | Correct (ledger sums to zero after every trade, settlement and season) | — |
| Linked-market arbitrage | None possible (one inventory per event cluster; windows never overlap) | — |
| Exploits | **Void farming; forecast-following profit; player influence** | #31, #33, #32 (fixed) |
| NPC opening liquidity | **Traded on a placeholder model** | #27 (fixed) |

## 2. Mathematics and accounting

**Cost function.** C(q) = b·ln Σ e^{q_s/b} with log-sum-exp; prices p_s = e^{q_s/b} / Σ e^{q_j/b}. A claim on the state
set S costs C(q + k·1_S) − C(q). Since v0.10 this difference is evaluated in closed form (bug #26):

  C(q + k·1_S) − C(q) = b·ln(Q + P·e^{k/b}),  P = Σ_{s∈S} p_s,  Q = Σ_{s∉S} p_s (summed directly, never 1 − P),

using b·log1p(P·expm1(x)) for |x| < 1, b·(x + ln(P + Q·e^{−x})) for x ≥ 1 and b·ln(Q + P·eˣ) for x ≤ −1. The complete
set (S = every state) costs exactly k. The old two-cost difference lost up to 6.9·10⁻⁶ µ at 10⁴ shares and 5.4·10⁻⁵ µ
at 10⁵ shares; with a rounding guard of 10⁻⁶ µ, 9 of 20,000 random buys were undercharged and 33 sales overpaid by
1 µ at 10⁴ shares (4 and 18 at 10⁵). None at 10³ or below.

**Normalisation.** Prices sum to 1 within 10⁻¹² for 2–16 states and inventories up to ±30·b (fuzzed), are invariant
under adding a constant to every inventory, and equal the cost gradient. Published models are normalised with a floor
(`normaliseModel`, 0.1–0.2%) so no state is priced at exactly 0; payout vectors must lie in the simplex (sum 1 within
10⁻⁹, no negative entry) or resolution is refused.

**Liquidity and subsidy.** The market maker's worst-case loss is funded from the treasury before a market opens
(rounded up to the µ); a market whose subsidy the treasury cannot fund is not listed.

| Market | States | b | Funded subsidy (b·ln n) |
|---|---|---|---|
| Match result (W/D/B + Decisive) | 3 | 120 | $131.833476 |
| Match length over/under (v0.10) | 2 | 60 | $41.588831 |
| Federation Open champion | 32 | 150 | $519.860386 |
| Crown Championship champion | 16 | 150 | $415.888309 |
| Promotion / Qualification | 2 | 80 | $55.451775 |
| Season title | 16 | 100 | $277.258873 |
| Final four (bracket) | 8 | 100 | $207.944155 |
| Quarterfinal advancement (v0.10) | 16 | 100 | $277.258873 |
| Sandbox (prior-priced) | 3 | 60 | b·ln(1/min p0) |

b is chosen per family so that a $50–$500 trade moves the price by a few points: deep enough that NPC liquidity does
not swing prices wildly, shallow enough that a player's view matters. The over/under market is shallower (b = 60)
because its outcome is close to a coin flip at the listed line, and its subsidy is the smallest.

**Fees.** fee = ⌈amount × 100 / 10,000⌉ µ on every buy and sell: never below 1%, at most 1 µ above, zero only on a zero
amount (fuzzed over 5,000 amounts up to 10¹² µ). Buy total = amount + fee; sale total = amount − fee ≥ 0. Fees
accumulate in `fees` and return to the treasury at season end.

**Micro-units and rounding.** Every amount is an integer number of µ (10⁶ µ = $1); the ledger rejects non-integers,
unbalanced entries, overdrafts of non-issuance accounts and entries mixing sandbox and official accounts. Buy costs
round up, sale proceeds round down, payouts round down per holding; the residue always stays with the market and returns
to the treasury, so collateral ≥ (C(q) − C(q0)) after every trade (fuzzed).

**Solvency.** Collateral + subsidy covers the largest possible payout for every payout vector in the simplex (M4 §1).
The v0.10 fuzz test resolves 60 random markets (match with Decisive, 8-state bracket, 16-state advancement,
prior-priced sandbox, 2–16-state categorical) after 120 random multi-holder trades each, under every unit vector, the
uniform and published cancellation vectors and five random simplex vectors: the books sum to zero, no non-issuance
account is negative, collateral and subsidy accounts end at zero, each holder receives exactly its floored claim payout,
and the maker's loss never exceeds the funded subsidy.

**Duplicate settlement.** `settled` and `cancelled` are terminal: a second settlement or cancellation throws, the
`settle:<market>` journal id makes a re-post a no-op, and a featured fixture's result can be recorded once
(`finishFeaturedIn`), so neither its match market nor its over/under market can settle twice.

**Stale quotes and revisions.** The market revision `trades.publishedMoves` advances on every trade and every
published live move. Every player trade path (ticket, API buy/sell/close) passes the revision it was quoted on; a trade
quoted before a move or another trade is rejected, never re-priced. The ticket also passes its exact previewed total
as the limit (`maxTotal` / `minTotal`), so the amount on the Confirm button is the amount that executes.

**Atomicity.** Each command builds a working copy, posts validated journals into it and commits markets, positions,
accounts and journals in one IndexedDB transaction; the in-memory state is replaced only after the commit succeeds.
Tested for asset purchases (v0.4) and, in v0.10, for trades and Close Position (a simulated commit failure leaves
balances, positions and storage unchanged; a reload sees the old position).

## 3. No look-ahead — information timeline

No trader (player or NPC) and no model reads an unpublished move or result:

1. **Match result and over/under markets** close before the first move exists (background play), or the result market
   stays open in play between published moves while the over/under market closes when live play starts. Each move is
   computed inside the command lock after the previous window; NPCs react to the moving engine's own published
   evaluation through crown-odds-2 (never centipawns read as a probability).
2. **Family markets** close when their closing round starts. v0.10 (bug #29): a scheduled live game of that round is
   such a start, and closes them in the same commit.
3. **Results-pending suspension** (bug #28). The first recorded game of a round draws every tier-3 result of that round
   and the competitor and news pages show them; the published model and NPCs see them only when the round is processed.
   A family market is now **suspended** — still open, but no trade and no paper forecast — whenever the open round has a
   recorded result in an event it depends on (Open champion: the Open; Championship markets: the Championship;
   promotion and season title: that league; qualification: every Crown Division). Trading reopens after the round is
   processed, the model refreshed and the NPCs have re-traded. Remaining public in-play information (individual
   scheduled games' moves before their result) is visible to everyone and is not suspended: suspending on every live
   game would close these markets for almost the whole round.
4. **Paper forecasts** store the public model and prices of the moment; in play that is now the live model of the last
   published move (bug #30), so forecast comparisons and the Forecasting League are like-for-like.
5. **Models** read public ratings, RDs and recorded results only (crown-odds-2, crown-length-1, knockout models).
   Tests change hidden strength and verify the over/under model does not move.

## 4. Linked markets and arbitrage

- **Decisive vs W/D/B.** Decisive is a claim on {White, Black} of the same inventory, so its price is exactly
  1 − P(draw) at every inventory (fuzzed to 10⁻¹²) and Decisive + Draw is a complete set costing at least its payout.
  A separate Decisive market would have allowed riskless arbitrage between two independent LMSRs; one inventory cannot.
- **Over/under vs result.** No logical constraint links game length and result, so no riskless combination exists.
- **Advancement vs champion vs final four.** The quarterfinal market opens after the champion market has closed and
  closes before the final-four market opens; no two contracts on the Championship are ever tradable together.
- **Within a market.** Overlapping claims (champion / finalist / "beats", semifinalist / "meets") share one inventory;
  complete sets over any partition cost ≥ their payout and sell for ≤ it (fuzzed).

## 5. Exploit search

| Attempt | Result |
|---|---|
| Round trip (any buy/sell sequence returning to the starting holdings) | Loses at least the fees paid, always strictly negative (600 fuzzed sequences on random markets) |
| Order splitting (many small buys or sales instead of one) | Never cheaper / never pays more (300 fuzzed cases) |
| Rounding farming (tiny trades) | Each trade costs ≥ 1 µ fee and the directed-rounding spread is ≥ 0 |
| Complete-set or linked-claim arbitrage | None (above) |
| **Void farming**: buy below the cancellation refund, then cause the cancellation | **Found (#31)**: entering the Open cancelled its champion market at 1/32 for the entrant's own shares — $13.35–$31.80 risk-free per season on three seeds. Now refused while holding shares. Other cancellations (400-ply censoring, federation cancel) are not player-controllable; the sandbox cancels at its opening prior (M4 §6). |
| **Following the shown forecast** | **Found (#33)**: +$0.96 per pre-game market and +$1.32 per in-play window. Fixed by the anchoring analyst; now no edge (§7). |
| **Influencing a payoff** | **Found (#32)**: the qualification cut includes the player's own Crown Division. Not listed while the player is in division 1. Existing rules: own games never listed; Championship markets not listed when the player qualifies; sponsored competitors cannot be bought. |
| Trading during a computed move | Impossible: commands are serialised and the revision check rejects pre-move quotes |

## 6. v0.10 markets and trading features

**Match: Decisive claim.** Claims White wins / Draw / Black wins / Decisive (either side wins). Settlement on the
official game record; VOID (1/3 per state, so Decisive pays 2/3) if the match is never played or is stopped by the
400-ply playing limit.

**Match length: Over/Under X.5 plies** (`src/exchange/length.ts`, crown-length-1). The line X is the whole number whose
P(plies > X) is closest to ½ under a logistic model on public ratings only (mean level and gap, with interactions),
fitted by maximum likelihood on 2,400 federation-style engine games and validated on 800 held-out games: log-loss
0.31435 vs 0.32369 for the empirical survival curve over 29,600 (game, line) rows; at the model's own line the held-out
over rate is 52.5% and the Brier score 0.2502 (`docs/sim/length-crown-length-1.json`, `tools/market/fit-length.ts`).
Definition: plies on the fixture's official game record; Over pays if ≥ X + 1. A playing-limit game has 400 plies and
settles Over. Trading closes when the match starts (no in-play trading). VOID (½ per share) if the fixture never gets
an official game record.

**Crown Championship: who reaches the semifinals** (16 states = the four quarterfinal winners). Claims "X reaches the
semifinals" (8 states) and the conjunction "X meets Y in the semifinal" (4 states; pays nothing if either loses —
never a hindsight refund). Exact model from the two-game knockout probabilities with the published tiebreaks. Listed
after the round of 16 when the player is not in the Championship; closes when the quarterfinals start; settles on the
four recorded winners; VOID |S|/16 per share if the quarterfinals are not played.

**Trading API** (`src/exchange/api.ts`, documented at the top of the file for the Live Match Center): `status`,
`quote` (exact cost or proceeds, fee, total, average price, price before → after, max payout/loss and the position
*after* the trade), `buy` / `sell` with mandatory revision and a total limit, `close` (sells every held claim, or one,
in one atomic command), `position` / `positions` / `pnl`, and a persisted market watchlist.

**Position analytics** (`src/exchange/portfolio.ts`): average-cost basis per claim including buy fees (recorded from
v0.10; older holdings show "not recorded" rather than an invented split), realised and unrealised P&L with the tested
identity realised + unrealised = sell-now value + received − paid, amount at risk, and P&L in every outcome and under
VOID. Shown on the market page (with Close Position and an exact-proceeds confirmation), in Finance (portfolio table)
and to the Spectator through the API.

**Market page.** Watch toggle (persisted watchlist group on the Exchange), suspension chip and reason, settlement and
VOID terms per claim, market history (each recorded trade and its trader), price chart, rules before trading.

## 7. Simulated traders (tools/market/simulate.ts → docs/sim/market-sim-crown-market-sim-1.json)

Every trader is **simulated** and reads public information only (public ratings → crown-odds-2 / crown-length-1 and
current prices), except the clearly labelled **Oracle**, a benchmark that reads hidden strength and is impossible in the
game. Events are the 800 **held-out** engine games of `tools/odds/data` (never used to fit either model), with their
real results and real ply counts; each game lists the v0.10 result market (with Decisive) and over/under market through
the production `openMarket`/`trade`/`settleMarket` code and the double-entry books. 5 seeds → 4,000 markets of each
kind. Population A = four simulated agents (skilled: the public model; mediocre: model + noise σ = 0.06; contrarian:
+8 points on the cheapest state; noisy: random beliefs), three passes per market, $10,000 each. Population B = the
game's own NPC roster (`npcTrade`), with four in-play windows per result market (after plies 10, 20, 40, 60, using the
game's recorded evaluations). Player strategies trade a private copy of each market after the population (budget $50)
and are settled on the real outcome. Conservation was checked after every market (it never failed).

**Price calibration (closing pre-game prices, result markets, population B):**

| Price bin | 0–10% | 10–20% | 20–30% | 30–40% | 40–50% | 50–60% | 60–70% | 70–80% | 80–90% | 90–100% |
|---|---|---|---|---|---|---|---|---|---|---|
| n | 970 | 2,725 | 2,940 | 1,426 | 1,290 | 1,103 | 779 | 447 | 290 | 30 |
| mean price | 0.071 | 0.156 | 0.244 | 0.349 | 0.447 | 0.548 | 0.645 | 0.748 | 0.846 | 0.927 |
| observed | 0.057 | 0.141 | 0.229 | 0.403 | 0.457 | 0.545 | 0.664 | 0.736 | 0.862 | 0.833 |

Brier per result market: closing price 0.5333, public model 0.5334, uniform 0.6667, hidden-strength truth 0.4857
(the information no public trader has). Population A, whose noisy and contrarian agents trade last as often as first,
closes at 0.5494. Over/under: closing price 0.5005 vs model 0.5004 (coin-flip lines by design).

**Maker subsidy, fees, wealth.**

| | Result markets A | Result markets B (with in-play) | Over/under A | Over/under B |
|---|---|---|---|---|
| Funded subsidy | $131.83 | $131.83 | $41.59 | $41.59 |
| Mean subsidy used | $20.19 | $102.80 | −$0.29 | −$0.03 |
| Worst subsidy used | $127.02 | $130.63 | $32.69 | $1.48 |
| Mean fees per market | $1.95 | $10.26 | $0.60 | $0.24 |

The maker pays for information: in play, prices converge on the result and the maker spends most of its subsidy, but
never more (worst $130.63 of $131.83). Negative mean use means the maker gained (noisy traders). Population A after 800
markets per seed (start $10,000): skilled $20,856, mediocre $17,356, contrarian $15,479, noisy $183; Gini of final
wealth 0.309. Population B: the anchoring analyst $21,779, the in-play tactician $28,448, the favourite fans $55,635
(first to react after each published move), novices $1,102, momentum $1,831; Gini 0.465. In the game, NPC balances
above the $4,000 wallet cap return to the treasury each season, so NPC profits never accumulate as new money.

**Can a simple player strategy farm money?** No. Mean P&L per market at a $50 budget, 95% interval (population B,
v0.10):

| Strategy | Result market | Over/under |
|---|---|---|
| Always back the favourite | −$3.70 (−4.60, −2.80) | −$9.45 (−10.44, −8.46) |
| Always back the longshot | −$16.42 (−17.83, −15.01) | −$6.36 (−7.35, −5.37) |
| Buy one of every outcome (20 each) | −$0.20 exactly (fees) | −$0.20 exactly |
| Round-trip scalper (5 × buy/sell 30) | −$1.06 (−1.063, −1.056) | −$1.69 |
| Decisive vs White + Black "arbitrage" | −$0.10 exactly (fees) | — |
| Public-forecast edge > 3 points | no trade in 4,000 markets | no trade |
| In play: forecast edge > 3 points per window | no trade in 13,640 windows | — |
| In play: back the current favourite | −$1.33 per window (−1.68, −0.99) | — |
| **Oracle** (hidden strength; impossible) | **+$5.48 (4.76, 6.20)** | no edge (no hidden length information) |

Before the fix (`--legacy-analyst`, docs/sim/market-sim-legacy-analyst.json) the public-forecast strategy earned
+$0.96 (0.53, 1.39) per pre-game market and +$1.32 (1.03, 1.61) per in-play window, and closing prices (0.5408) were
worse than the forecast shown beside them. After the fix, money can only be made by knowing more than the public
forecast — the Oracle shows what such knowledge is worth — which is legitimate skill (reading form, rating
uncertainty, head-to-head, the board in play better than the live model).

Limits of the study: pre-game and four in-play windows only (no family markets, no season-level wallet caps or
sweeps); NPC order is the shipped order; strategies do not compound.

## 8. Investing mechanics: chosen and rejected

**Chosen: the Forecasting League and Calibration Challenge** (`src/app/forecastLeague.ts`, Forecasting screen). Each
season your resolved paper forecasts are ranked by mean Brier score against seven *simulated* forecasters (the
published model, the market price, an overconfident and an underconfident version of the model, a favourite-backer, a
seeded noisy novice and equal chances). They forecast exactly your markets from exactly the snapshot stored with your
forecast, so the comparison is fair and look-ahead-free by construction. A rank needs 5 resolved forecasts in the
season; the Brier skill against the market price says whether you were more accurate than the price you could have
traded at. The Calibration Challenge grades your expected calibration error over every probability you gave (≥ 30
probabilities; well ≤ 5 points, fairly ≤ 10) and says whether you lean over- or underconfident. No money, no prestige:
it teaches the skill that the market rewards without any gambling pressure, it is understandable (one number, one
table), and it is defensible (proper scoring rule, same information for everyone).

**Rejected.** *Tournament futures* — the champion, season, promotion, qualification, final-four and (new) advancement
markets already are futures; another layer would duplicate payoffs and invite cross-market arbitrage. *Risk-budget
competition* — a season-long return contest on a separate fictional budget rewards variance (the best "return" is an
all-in longshot) unless returns are risk-adjusted, which is hard to explain; it also needs a second money system beside
cash and sandbox money. Neither passed "fun, understandable and defensible" as well as the league.

## 9. Invariants and their tests

| Invariant | Test |
|---|---|
| Prices: probability vector, translation invariance, gradient of C | `tests/marketIntegrity.test.ts` LMSR (400 random markets) |
| Closed-form claim cost = translated-difference reference (10⁻⁹ $), finite for huge orders | same (1,200 cases, inventories to 10⁵) |
| Directed rounding at every inventory (#26) | same (8,000 quotes; fails on the old code) |
| Buys raise the bought claim, lower disjoint claims | same (300) |
| Fee bounds; integer quotes; buy/sale totals | same (5,000 fees, 500 quotes) |
| Ledger rejections (non-integer, unbalanced, overdraft, mixed sandbox, infinite) | same |
| Round trips lose ≥ fees; splitting never helps; complete sets ≥ payout | same (600 / 300 / 300) |
| Decisive = 1 − Draw; Decisive + Draw ≥ payout | same (400) |
| Solvency, conservation, payout exactness, maker loss ≤ subsidy | same (60 markets × 120 trades × all vectors); `tests/exchange*.test.ts` |
| Single settlement; idempotent journals | same; `tests/exchange2.test.ts` |
| Revision advances on every trade and move | same; `tests/arena.test.ts`; `e2e/m6-arena.mjs` steps 3–4 |
| Basis identities; legacy positions never get invented bases | same (200 sequences) |
| Advancement states, claims, model, settlement state | same |
| Over/under and Decisive settle on the official record; VOID ½ | `tests/exchangeService.test.ts` |
| Over/under closes when live play starts; in-play forecasts snapshot the live model (#30) | same |
| Close Position atomic; failed commit changes nothing; slippage guard | same |
| Watchlist persisted across reloads | same |
| Suspension while results are pending (#28); reopening after the round | same |
| Open entry refused while holding its market (#31); others paid 1/n | same; `tests/markets.test.ts` |
| No qualification market for a Crown Division player (#32) | same |
| Scheduled games close due markets (#29) | same |
| Advancement over a full season; every over/under settles on its record | same |
| Public-information inputs only | same; `tests/federationService.test.ts` |
| Forecasting League fairness, qualification, determinism; calibration grades | `tests/forecastLeague.test.ts` |
