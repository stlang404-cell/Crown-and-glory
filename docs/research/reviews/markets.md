# Independent quantitative-market review

Scope: documents09/10/13/14 and experiment/validation scripts. This is a separate reasoning review, not external certification or evidence that a production service exists.

## Findings and required corrections

1. **Critical — void/reversal policy is not implementation-ready.** Reversing all trades cannot promise both unrestricted early sale proceeds and that no void profits survive. A trader can buy, profitably sell, then spend the profit elsewhere. A treasury guarantee can pay harmed counterparties but cannot claw back that trader's profit without debt or undoing unrelated trades. Fee escrow does not solve this. Choose a single policy now: preferably represent cancellation/condition-false as a predeclared categorical outcome with a specified fixed payout vector and normal funded settlement. If historical-cost refunds are retained, escrow all potentially reversible gains until resolution, making cash availability explicit; test cross-market spend and void chains. Merely saying “fund enough guarantee capital” does not enforce no surviving profits.

2. **High — baseline inventory and actual liabilities need explicit distinction.** For a nonuniform initial quote, q0 is a virtual pricing offset, not owned shares. Actual outstanding positions h=q−q0, reserve cash R=C(q)−C(q0)+subsidy, and payout liability h_w. The stated b*ln(1/min p0) worst-case subsidy is correct under this accounting. Paying q_w would incorrectly pay virtual initial inventory; store h and q0 separately and assert total holdings equals h. Uniform q0=0 avoids this initially but does not remove the need for the invariant.

3. **High — cross-market coherence remains an architectural gate.** One categorical match market eliminates W/D/L complete-set errors, but not duplicate qualification/champion/conditional claims across separate markets. A generic “avoid duplicated claims” is insufficient. Give each contract a canonical payoff vector on a bounded event-state model; aliases share the same book, and reject redundant tradable contracts unless funded cross-market arbitrage is intentionally supported. Related genuine forecasts can differ; deterministic duplicate payoffs should not become independent subsidized faucets.

4. **High — solvency test does not cover the proposed retail service.** F proves floating-point identities for signed inventory paths. It does not test funded wallets, nonnegative holdings, reserve allocation across markets, partial sales, fees/rounding or settlement. Its bounds are mathematically appropriate under declared assumptions, but must not be described as settlement/accounting implementation validation. Add an integer-ledger reference simulator with randomized legal buy/sell/settle actions and assertions after every action.

5. **Medium — 1% of absolute net cost is ambiguous for bundled orders.** A zero-net-cost outcome rotation may have material gross legs and pay no fee. This is not itself a subsidy-bound violation, but can defeat intended transaction costs. Either charge each executed nonnegative-leg notional, or explicitly define net-cost fees and evaluate their effect. Do not advertise a fee rate without the bundle convention and minimum-rounding policy.

6. **Medium — calibration comparisons should use one held-out dataset.** E generates different deltas/results for scale1 and scale1.7. Both are valid exploratory samples, but paired Brier/log-loss differences on identical outcomes give cleaner evidence about overconfidence. Generate one fixed dataset, evaluate both predictors on it, and bootstrap differences by match. Synthetic logistic data still cannot calibrate actual chess W/D/L.

7. **High — integrated progression/economy remains unverified, accurately disclosed.** G/H policies have different grant/prize baselines, so wealth differences do not isolate strategy value. The funded retest proves conservation only. No experiment yet supports upgrade prices, optimal trader behavior, inflation control, recovery pacing or strategy non-dominance. Preserve these gates and avoid using toy seasons-to1000 as a time-to-club estimate.

## Confirmed sound elements

The uniform fixed-b LMSR cost/prices and b ln n bound are correct. Nonuniform-prior worst-case bound is correctly increased. Log-sum-exp, fixed b, paid inventory updates, ownership restrictions, unique settlements, explicit subsidy allocation and honest offline-security limits are appropriate. The recenter demonstration is a real warning about free external inventory changes, not proof that every carefully funded dynamic AMM is impossible.

## Suggested immediate disposition

Amend document09/master prompt with explicit q0/holdings/liability identities and a single fixed-payoff cancellation policy. Add focused mathematical retail-accounting tests and paired calibration. Keep full multi-market/club economy as a release gate rather than claiming the research has validated it.
