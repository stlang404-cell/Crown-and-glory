# The Crown Exchange

All currency is fictional, nonredeemable and cannot be purchased for real money [D]. The exchange is optional and may be hidden. Never imply profit outside the game. Explain probabilities as prices/forecasts, never guaranteed outcomes.

## Five mechanisms evaluated

| Proposal | Correctness/liquidity | Strategy and comprehension | Cost, settlement and exploits | Choice |
| --- | --- | --- | --- | --- |
| Categorical LMSR W/D/L | Simplex prices, continuous quotes, bounded subsidy | Outcome bundles easy to explain, slippage matters | O(n), reserve requirement; fixed b | Core. |
| Inventory-backed fixed-product AMM | Needs collateralized outcome tokens and complete-set mint/redeem | Familiar swapping but pool imbalance opaque | Fee/invariant/LP accounting adds risks | Reject for launch. |
| Periodic call auction + funded LMSR backstop | Aggregates limited orders; can reduce click-race effects | Deeper limits/clearing-price learning curve | More matching and backstop interaction tests | Optional later exchange mode, same core ledger. |
| Proper-score forecast league | No liquidity or wagering required | Rewards honest probabilities; accessible recovery path | Brier scoring and locked forecast snapshots | Core companion; capped prizes separately funded. |
| Tournament state-tree conditional LMSR | Coherent joint outcomes if one shared state space | Real chess-research depth, difficult UX | Exponential state explosion unless restricted tree | Restrict to small explicit conditional contracts after validation. |
| Analyst syndicate pooled forecasts | Weighted aggregation and shared reports | Cooperative institutional identity | Reputation manipulation and self-trading risk | Institution research feature, not a new monetary market-maker. |

These are architecture comparisons [D], not comparative user testing. Categorical LMSR plus nonmonetary forecasts and small event markets gives a buildable first exchange while preserving match, tournament, promotion, qualification and seasonal markets in M4. Conditional markets are supported only with explicit bounded state spaces, not falsely advertised general combinatorial inference.

## Cost and prices

For exhaustive mutually exclusive outcomes i=1..n, inventories q and fixed b>0:

C(q)=b log Σ exp(q_i/b); p_i=exp(q_i/b)/Σ exp(q_j/b).

Use log-sum-exp. Trade vector x costs ΔC=C(q+x)−C(q). Exact settlement pays x_w for winning outcome w. Uniform initial q=0 gives worst-case market-maker subsidy b ln n; offset prices p0 can be initialized through q0_i=b ln p0_i with all p0_i>0, but worst-case bound becomes b ln(1/min p0), not b ln n. Reserve the larger exact bound for that initialization. Default use uniform q0 until supported initial-prior funding is tested. Here q0 is virtual initial inventory, x is cumulative actual issued shares, q=q0+x, and winner liabilities are actual holdings x_w (not q_w). Retail holdings cannot go negative; no leverage/naked shorts. Selling an owned position uses the same cost difference and current inventory, never the original purchase price.

Price history is recorded from trades; an information model may publish a separate forecast but must not externally mutate q or b. Adding/removing outcomes after opening is prohibited. Changing b creates a new market with disclosed closure/rollover rules; no invisible live-liquidity change. The external-recenter exploit is demonstrated in `data/adversarial_market_reset.json`.

For a complete set t in every outcome, C(q+t1)−C(q)=t. This prevents complete-set arbitrage within one market before fees. Disjoint market marginal prices need not automatically cohere across correlated events; avoid simultaneously tradable duplicated deterministic claims. Tournament winner markets share one categorical ledger. Match W/D/L shares one ledger. Conditional contract semantics must include condition-false condition-false payout explicitly.

## Money, fees and reserves

Use integer microcrowns for wallets/ledger, fixed-point/decimal quote calculations, conservative directed rounding and strict reconciliation. Avoid promising exact conservation from arbitrary binary floating-point. A final buy charge rounds upward; sell proceeds downward; residual goes to a rounding account. Provide exact execution quote, fee, resulting shares, maximum loss and potential payout before confirmation. Disallow negative balances.

Provisional fee1% of absolute notional cost [D], charged on buy and sell; fee treasury is separate from collateral. Stress rebates and tiny trades before enabling any fee discount. A reversal at unchanged q has zero gross gain and negative net gain; test this explicitly. Reserve proof must be per market and portfolio-wide across open events. Spending the same subsidy reserve twice is prohibited. Nonuniform initial priors require revised reserve bounds.

Ledger accounts: player/NPC cash, market collateral, maker subsidy, fee treasury, prize pool, operating sinks, rounding residuals and explicit mint/burn authority. Every journal entry balances. Equity includes cash plus marked holdings less liabilities; unrealized P&L based on executable liquidation quotes differs from marginal-price mark. Show both if needed.

No hidden issuance on settlement: for winning state w pay all outstanding winning shares from collected collateral plus reserved subsidy. Do not burn a loser's purchase twice; their cash already moved when they bought. Record unique settlement transaction keys. Market states: draft→funded→open→halted/closed→resolved→settled; cancellation must follow its prepublished payout vector. Settled is final absent an explicit corrective ledger event.

Cancellation policy [D, corrected after review]: no retroactive trade reversal. Each contract declares a fixed cancellation payout vector at creation: for an n-outcome ordinary market, every outcome share pays1/n on cancellation, with the same documented directed-rounding residual account. Shares are not “refunded at purchase price”; gains/losses and charged fees remain. This vector lies in the outcome simplex, so the same collateral bound covers its payout. Treat cancellation as an immutable terminal resolution through the normal idempotent settlement service. No ordinary settlement is later undone; a correction requires a separately funded explicit journal event. Conditional contracts have an explicit condition-false payout vector (published before orders), never a discretionary hindsight refund. All users see cancellation terms in the quote preview. This policy avoids clawing back profits already spent elsewhere.


## Information, timing and integrity

Markets only on NPC events the player/owned institution cannot influence. Entering an event or acquiring influence over it blocks new trades and enforces a prepublished conflict procedure. Prefer prohibit ownership changes while affected markets remain open. No deliberately losing one's own game, changing an opponent's configuration or re-running a settled event for profit.

At a live move, advance full game state, publish public board/clock information, then reopen trading. Suspend trading during adjudication and after terminal information before any further order can execute. NPC traders receive only permitted public/noisy information, never the future outcome. Ratings/engine WDL/live clocks are forecast features, not probabilities to stamp onto the price. Separate streams for world outcome and trader policy prevent UI activity from changing results. Honest-play save reload resumes the same committed timeline, but cannot defeat a determined owner of an offline client.

## Forecast and trader analytics

W/D/L forecast models may use a calibrated multinomial/ordinal model with rating gap, color, time control, style interaction and current position/clock. Train/test by temporal blocks and competitor/opening families. Evaluate Brier Σ(p−y)² and log loss, calibration bins with n/intervals and baseline comparisons. Do not call logistic rating forecasts actual engine-calibrated probabilities. E is a synthetic binary calibration demonstration only.

Trader types: noisy novice, conservative analyst, overconfident fan, calibrated fundamental trader and limited-budget value seeker. All have funded wallets, public/noisy signals, explicit order sizes and risk limits. Do not generate unlimited smart-money capital to force prices correct. Test zero-information and correlated-signal populations.

Exchange screens: live odds/history, watchlists, opponent dossiers, event filters, quote preview, cash/reserved cash/exposure, holdings, realized/unrealized P&L, fees, settlement history, Brier forecast track record and evidence links. Separate trading luck from forecast quality and chess strength. A player can paper-forecast indefinitely without money.

## Fees, payoff identities and funded retail validation

Initial release accepts single-outcome retail orders only. Fee=1% of absolute executed cash cost/proceeds, rounded up in microcrowns; buy cost rounds up, sell proceeds down. Batch portfolios execute ordered single-outcome fills with a maximum total spend; no undisclosed netting discounts. Complete-set fee-free identity is a math invariant, not an offer to waive retail fees. Later bundled orders require a versioned gross-leg fee rule to prevent low-net-cost fee bypass.

Use a canonical event/payoff registry. No separately traded contract may duplicate a deterministic payoff already represented unless complete-set mint/redeem or explicit collateralized arbitrage links make the identities coherent. Related promotion/qualification/season/conditional claims share a bounded joint state model or are not concurrently listed. Pricing independence is not a proof of no cross-market arbitrage.

`scripts/funded_ledger.py` tests50 funded single markets and25,000 attempted randomized retail orders using40-digit Decimal quotes with integer microcrown wallets, no shorts, fees, directed rounding, terminal/cancellation payouts and duplicate-settlement guards. All committed transfers conserve integer balances. This is stronger than F's signed-inventory math stress, but does not verify correlated portfolios, production persistence, strategic agents or rare-event closure races.

## Bounded conditional mechanism: executable reference [D]

Initial conditional event is a four-player knockout with two semifinals and a final, each settled to a winner by the finite competition tiebreak policy. Enumerate all2^3=8 branch-outcome states. A state records both semifinal winners and the final winner among them; state IDs include the complete bracket path. A single8-state LMSR owns inventory, collateral and prices. Buying a claim pays one crown in each state in an explicitly enumerated subset S: trade vector adds the share amount to every q_s for s∈S, with cost from the same C. A tournament-winner claim, semifinal-winner claim or conjunction such as “A reaches final AND B wins title” is a subset of these same states. Equivalent payoff subsets have one canonical claim ID; no independently inconsistent price engine.

A conditional statement defaults to a **conjunction contract**: pays1 when both condition and outcome occur and0 otherwise, including condition-false. Display joint claim price and, separately, indicative conditional probability P(B|A)=Σp_(A∩B)/Σp_A when denominator>0. The conditional ratio is not the cash execution price of the joint-payoff claim. Quote previews spell out all branches. Cancellation uses the uniform average of this claim's payout over the eight states (or its published state payout vector), so subset claims receive |S|/8 per share under uniform cancellation. Ledger positions retain state-exposure vectors and reserve against max_s liability, not a naive sum of unrelated standalone contract bounds.

Large group/league championships launch with one categorical winner or promotion market per canonical event cluster. Do not simultaneously list overlapping deterministic qualification/title claims in separate makers; select a market family before opening or use the same explicitly tractable state model. Nonfinancial forecasts can cover every event regardless. Additional multi-event conditional families require explicit enumeration/solver bounds and new tests; do not infer unrestricted combinatorial support from this eight-state reference.
