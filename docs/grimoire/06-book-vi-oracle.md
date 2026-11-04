# Book VI — The Oracle

*Forecasting and the Crown Exchange*

> A Sovereign who can calculate a mate in three but cannot say how likely a game is to end in a draw has learned
> only half of judgement. The Oracle's discipline is the other half: **stating beliefs as numbers, testing them
> against reality, and never staking more than the evidence supports.**

**Fictional money only.** The Crown Exchange uses the game's **fictional dollars**. Nothing in it is, or can become,
real money, and nothing in this book is advice about real-money betting or investing. The Exchange is in the game
to teach probability, calibration and risk. Its lessons are the same ones that make reckless real-world gambling a
losing proposition, and this book says so wherever it matters.

As in Book V, statements are marked **[Demonstrated]** (read from the game's code or computed with its own
functions) or **[Counsel]** (practical advice, not measured). Every dollar figure in a worked example was computed
by calling the game's own pricing code (src/exchange/lmsr.ts) unless stated otherwise.

**The rules this book relies on. [Demonstrated]** (src/exchange/*, src/app/federation.ts, src/app/markets.ts):

* A market lists **mutually exclusive, exhaustive states**, for example *White wins / Draw / Black wins*. A **share**
  of a claim pays **$1** if the claim's state happens and $0 otherwise.
* Prices come from an automated market maker, the **LMSR**. There is no order book, and you trade against the maker.
* A **fee of 1 %** of the executed amount (rounded up) is charged on every buy *and* every sell.
* Holdings are **long-only**: you can sell only shares you hold. There is no short selling.
* Markets go **open → closed → settled or cancelled**, and are never reopened. **Settlement** pays $1 per winning
  share. **Cancellation** pays the market's published cancellation vector (for a match market, $1/3 per share).
* **Information policy:** official markets **never list your own games**. Rated games never carry markets. If you
  sponsor a competitor, you cannot buy in markets involving them (you may still sell). If you enter an event, its
  open winner market is cancelled at 1/n first. In live games, **move grades stay hidden until the market is
  settled or cancelled**. There is also a separate **Sandbox Exchange** with practice money on your own casual
  quick matches, where you may only back yourself and trading closes at the first move. Sandbox money never touches
  your official cash, net worth, ratings or standings.

---

## Chapter VI.1 — The Language of Chance: probability, prices and expected value

### Learning objectives
* Read a price as an implied probability.
* Compute the expected value (EV) of a trade in dollars, including the fee.
* Find the break-even belief for a trade.

### Prerequisites
Basic arithmetic with decimals. Book V, Chapter V.6 (the expected-score scale).

### Explanation
A **probability** is a number from 0 to 1 that says how likely an outcome is. For a single game, the three outcomes
*White wins, Draw, Black wins* have probabilities that add up to 1.

Because a share pays exactly $1 if its outcome happens, a **price of $0.40 says "40 % likely"**. That is the
**implied probability**. In the LMSR the prices of all states always add up to exactly $1 ([Demonstrated],
`prices()` normalises them). The price of a claim covering several states is the sum of their prices.

The **expected value** of a trade is what it earns on average, if your belief is right:

> EV = (your probability) × $1 × shares − (total paid, including the fee)

For a small trade at price *p*, the total paid per share is about *p* × 1.01, so the trade has positive EV only if
your belief *q* is above **1.01 × p**. That is the **break-even belief**. For larger trades the price moves against
you while you buy (Chapter VI.2), and the break-even rises.

### Illustrated example
A featured match is priced **White $0.40 · Draw $0.30 · Black $0.30**. You believe White wins 50 % of the time.

You buy **10 White shares**. The game's quote is $4.14 in total, fee included (computed with `buyClaimMicro` and
`feeMicro`; the price after your trade is $0.420).

EV = 0.50 × $10 − $4.14 = **+$0.86**. If White wins you receive $10.00 (profit $5.86). Otherwise you receive $0
(loss $4.14). Neither result tells you whether the trade was good. The EV does, and only if your 50 % is right.

### Step-by-step reasoning
1. **Write your probability first,** before you look at the price ([Counsel]: this guards against anchoring).
2. **Read the price** as the market's implied probability.
3. **Compare:** is your belief above 1.01 × price?
4. **Get the quote** for the size you want. It includes the price movement and the fee.
5. **Compute EV** = belief × shares − quoted total.
6. **Decide size** separately (Chapter VI.4). A positive EV does not mean "buy as much as you can".

### Common mistakes
* **Treating the price as the probability of winning *money*.** The price is the probability of the *outcome*. Your
  profit also depends on what you paid.
* **Forgetting the draw.** In chess-like games draws are common. The Federation's result model gives about 31 %
  draws between equals ([Demonstrated], crown-result-model-1, ν = 0.9).
* **Forgetting the fee on the way out.** Selling also costs 1 %.

### Advanced insight
The Federation's **public forecast** for a match uses the Davidson model on public ratings
([Demonstrated], src/federation/resultModel.ts): with π = 10^(rating/400) for each side,
P(W) = π_w / Z, P(D) = ν·√(π_w·π_b) / Z, P(B) = π_b / Z, where Z is the sum of the three numerators and ν = 0.9.
Computed values:

| White − Black (public rating) | P(White) | P(Draw) | P(Black) | White's expected score |
|---|---|---|---|---|
| 0 | 0.345 | 0.310 | 0.345 | 0.500 |
| +100 | 0.447 | 0.302 | 0.251 | 0.598 |
| +200 | 0.549 | 0.278 | 0.174 | 0.688 |
| +400 | 0.722 | 0.206 | 0.072 | 0.825 |

Prices that stray from this public model are either noise or information. Chapter VI.7 shows which.

### Worked example
A promotion market (*Yes / No*) shows **Yes at $0.30**. You think the competitor's chance of finishing in the top two
is 40 %.

* Break-even for a small trade: 1.01 × 0.30 = **0.303**. Your 0.40 is above it.
* Quote for 25 Yes shares (liquidity b = 80 for promotion markets): **$8.44** total, average price $0.334, price after
  $0.369 (computed).
* EV = 0.40 × $25 − $8.44 = **+$1.56**.

### Guided exercise
A match is priced **White $0.55 · Draw $0.25 · Black $0.20**. (a) What probability does the market give a Black win?
(b) What is the break-even belief for a small purchase of Black shares? (c) You believe Black wins 25 % of the time,
and the quote for 20 Black shares is $4.25. What is the EV?

### Independent exercises
1. The draw is priced at $0.31. A small trade costs about $0.313 per share with the fee. What is the lowest belief
   in a draw at which buying is worth it?
2. You buy 1 share of White in a fresh match market (all prices $1/3). The game's quote is $0.3376. Why is it more
   than $0.3333?
3. You hold 20 White shares bought for $9.00 in total. White wins. What is your profit? What would it have been if
   the game had been cancelled (match markets pay $1/3 per share)?
4. Explain in one sentence why "the trade lost money" is not the same as "the trade was a mistake".

### Answers
* **Guided:** (a) **20 %**. (b) **0.202** (1.01 × 0.20). (c) EV = 0.25 × $20 − $4.25 = **+$0.75**.
* **1:** about **0.313**. Below that, the fee makes the expected profit negative even before price movement.
* **2:** the price rises slightly while you buy (the cost is $0.334261 for the share itself), and the 1 % fee
  ($0.003343, rounded up) is added. Total **$0.337604**, which the screen shows rounded.
* **3:** win: $20 − $9 = **+$11**. Cancellation: 20 × $1/3 = $6.67 (rounded down per holding), so **−$2.33**.
* **4:** a trade's quality is its EV at the time of the trade, given what was knowable. Its result also includes
  luck (Chapter VI.7).

### Summary
Price = implied probability. EV = belief × payout − total cost. Break-even belief ≈ 1.01 × price for small trades,
higher for large ones. Write your belief before you look at the price, and judge trades by EV, not by results.

### Next lesson
Chapter VI.2: how the market maker sets those prices, and why buying moves them.

---

## Chapter VI.2 — The Engine of Prices: the LMSR market maker, liquidity and slippage

### Learning objectives
* State the LMSR cost and price formulas and compute a trade's cost by hand.
* Explain liquidity (b), slippage and the maker's funded subsidy.
* Estimate price impact before you trade.

### Prerequisites
Chapter VI.1. Natural logarithms and exponentials (a calculator is fine).

### Explanation
**[Demonstrated]** src/exchange/lmsr.ts: the Crown Exchange uses Hanson's **logarithmic market scoring rule**
with a fixed liquidity parameter *b*. For outstanding shares q = (q₁, …, qₙ) across the n states:

> **Cost function:** C(q) = b · ln( Σᵢ e^(qᵢ / b) )
>
> **Price of state i:** pᵢ = e^(qᵢ / b) / Σⱼ e^(qⱼ / b)
>
> **Cost of a trade** that changes q to q′: **C(q′) − C(q)**

Consequences:

* **Buying a state raises its price and lowers the others.** Prices always add up to 1.
* **Path independence:** buying 30 shares at once costs the same as buying 10 three times (apart from rounding and
  the fee on each trade).
* **Rounding favours the market:** buy costs are rounded *up* to the next micro-dollar and sale proceeds *down*.
* **The maker's worst-case loss is b · ln n,** and that **subsidy is funded before the market opens**. For a match
  market (b = 120, n = 3) it is **$131.83**.
* **Liquidity by market family:** match 120, tournament winner 150, promotion 80, qualification 80, season title
  100, bracket 100; Sandbox 60 (src/exchange/families.ts, src/app/federation.ts).

A larger *b* means **more liquidity**: prices move less per share. **Slippage** is the difference between the price
you see and the average price you pay. Near a price *p*, each share moves the price by about **p(1 − p)/b**.

### Illustrated example
*A fresh match market:* q = (0, 0, 0), b = 120, all prices $0.3333. You buy **30 White shares**.

* C(0,0,0) = 120 · ln 3 = **131.8335**
* C(30,0,0) = 120 · ln(e^0.25 + 2) = 120 · ln(3.284025) = **142.6884**
* Cost = 142.6884 − 131.8335 = **$10.8549** (the game's exact figure: $10.854918)
* Fee: 1 % rounded up = **$0.108550**, so the total is **$10.963468**
* New White price = e^0.25 / (e^0.25 + 2) = 1.284025 / 3.284025 = **$0.3910**; Draw and Black fall to **$0.3045**
* Average price paid: $10.8549 / 30 = **$0.3618**, about 2.9 cents of slippage per share

### Step-by-step reasoning: estimating impact before trading
1. Read the current price *p* and the market's *b*.
2. Estimate the price after *n* shares: about p + n·p(1 − p)/b for small n. Near $0.50 with b = 120, that is about
   0.2 cents per share.
3. The average price you pay is roughly halfway between the start and the end price.
4. Ask the game for the exact quote. The estimate only tells you whether the size is sensible.

Measured slippage when **White is at $0.40** (Draw and Black $0.30), b = 120 (computed):

| Shares bought | Total incl. fee | Average price | White price after |
|---|---|---|---|
| 50 | $22.78 | $0.451 | $0.503 |
| 100 | $50.78 | $0.503 | $0.605 |
| 150 | $83.78 | $0.553 | $0.699 |
| 200 | $121.18 | $0.600 | $0.779 |
| 250 | $162.20 | $0.642 | $0.843 |

### Common mistakes
* **Judging a trade by the displayed price.** You pay the *average* price over the trade. Use the quote.
* **Buying and selling back quickly.** A round trip costs two fees. Buying 10 shares at $0.50 costs $5.1552, and
  selling them straight back nets $5.0531: **$0.10 lost** for nothing.
* **Forgetting quotes expire.** A quote is tied to the market's *revision*, which changes with every trade and every
  published live move. A stale quote is rejected, not filled at a worse price ([Demonstrated], `revisionOf`).

### Advanced insight
Because every claim in a market shares **one inventory**, prices stay coherent across claims. In a bracket market
(8 states: the possible final-four paths), "A is champion" covers 2 states and "A reaches the final" covers 4, so
the champion claim can never cost more than the finalist claim ([Demonstrated], src/exchange/market.ts). In a fresh
bracket market every path costs 1/8, so the champion claim starts at **$0.25**.

### Worked example
*How large can a trade be before it stops making sense?* White is at $0.40 and you believe 0.50. As you buy, the
marginal price rises towards your belief. Buying beyond the point where the marginal price passes your belief
(minus the fee) *loses* EV. Computed EV, belief 0.50:

| Shares | Total paid | EV | Price after |
|---|---|---|---|
| 10 | $4.14 | +$0.86 | $0.420 |
| 25 | $10.74 | +$1.76 | $0.451 |
| 40 | $17.80 | +$2.20 | $0.482 |
| 50 | $22.78 | +$2.22 | $0.503 |
| 60 | $27.96 | +$2.04 | $0.524 |
| 75 | $36.13 | +$1.37 | $0.555 |
| 100 | $50.78 | −$0.78 | $0.605 |

EV peaks at **about 45–50 shares** (the price needed to reach $0.495 is 46 shares). Beyond that, every extra share
costs more than it is worth to you. **The market's liquidity, not your enthusiasm, sets the useful size.**

### Guided exercise
A fresh match market (b = 120). (a) Compute the White price after buying 120 White shares. (b) Compute the cost
before the fee. Use e ≈ 2.71828. (c) Is the average price above or below $0.45?

### Independent exercises
1. What subsidy does the game fund when it opens a binary promotion market (b = 80, n = 2)? And a 16-entrant
   tournament-winner market (b = 150)?
2. The same 30-share purchase in a Sandbox market (b = 60) costs $11.75 before the fee and moves White to $0.452.
   Why is it more expensive than in a match market?
3. Near a price of $0.50 in a b = 80 market, roughly how far does one share move the price?
4. You sell 30 White shares straight back into the market right after the illustrated example's purchase. The
   proceeds are $10.854917 before the fee. Why one micro-dollar less than you paid?

### Answers
* **Guided:** (a) e/(e + 2) = 2.71828/4.71828 ≈ **$0.5761**. (b) 120·ln((e + 2)/3) = 120·ln(1.57276) ≈
  **$54.34** (the game: $54.339892). (c) $54.34 / 120 ≈ **$0.453**, slightly **above** $0.45.
* **1:** 80·ln 2 = **$55.45**. 150·ln 16 = **$415.89** (computed with `subsidyMicro`, rounded up).
* **2:** a smaller b means lower liquidity: each share moves the price more, so the average price is higher.
* **3:** 0.5 × 0.5 / 80 ≈ **0.003**, about 0.3 cents per share.
* **4:** buy costs round **up** and sale proceeds round **down** to the micro-dollar, so rounding residue always stays
  with the market's collateral. The fee is charged again on the sale, giving net proceeds of $10.746367.

### Summary
The LMSR prices states by pᵢ = e^(qᵢ/b)/Σe^(qⱼ/b) and charges C(q′) − C(q) for a trade. Liquidity b sets the slippage,
about p(1 − p)/b per share. The maker's loss is capped at b·ln n, funded in advance. Size your trade by where the
marginal price meets your belief, not by your budget.

### Next lesson
Chapter VI.3: how good are your beliefs? The game measures them.

---

## Chapter VI.3 — Measuring the Oracle: calibration and the Brier score

### Learning objectives
* Compute the Brier score and the log score exactly as the game does.
* Explain why honest forecasts score best (proper scoring).
* Read the calibration chart and the skill tiers, and know how many forecasts it takes to judge them.

### Prerequisites
Chapter VI.1.

### Explanation
**Paper forecasts. [Demonstrated]** src/app/forecasting.ts (crown-forecast-1): for any market you may record a
**free probability vector** over its states. It costs nothing and is **locked when the market closes**. On resolution
it is scored with two proper scoring rules:

> **Brier score:** B = Σₛ (pₛ − yₛ)², summed over **all states**, from 0 (perfect) to 2 (worst). Lower is better.
>
> **Log score:** L = −Σₛ yₛ · ln max(pₛ, 0.001). Lower is better.

Here y is the resolution vector: 1 for the state that happened and 0 for the others (½/½ for joint champions).
**Cancelled markets are not scored.** Because the game sums over every state, a two-state market's Brier score is
**twice** the "binary Brier" you may know from elsewhere.

Your forecasts are compared with two baselines: the **market price** at the time of your forecast, and the
**public forecast** (the model). Over your scored forecasts the game shows a tier ([Demonstrated],
src/ui/ForecastScreen.tsx): **Apprentice** (fewer than 10 scored), **Sharp** (your mean Brier more than 0.02 below the
public forecast's), **Calibrated** (within ±0.02 of it) or **Learning** (more than 0.02 behind it). A rolling chart
shows your mean Brier over your last 10 resolved forecasts.

**Calibration** means that things you call 70 % happen about 70 % of the time. The game pools every (probability,
outcome) pair into **ten bins** (0–10 %, 10–20 %, …) and shows each bin's observed frequency with a **Wilson 95 %
interval**. A wide interval means too few forecasts in that bin to judge.

**Forecast skill is never mixed into chess or financial prestige.** A good forecast is not a profitable trade.
Trading profit depends on prices paid and fees, and is reported separately.

### Illustrated example
You forecast a match **White 0.50 · Draw 0.30 · Black 0.20**. Computed with the game's `brier` and `logScore`:

| Result | Brier | Log |
|---|---|---|
| White wins | (0.5−1)² + 0.3² + 0.2² = **0.38** | −ln 0.5 = **0.693** |
| Draw | 0.5² + (0.3−1)² + 0.2² = **0.78** | −ln 0.3 = **1.204** |
| Black wins | 0.5² + 0.3² + (0.2−1)² = **0.98** | −ln 0.2 = **1.609** |

For comparison: the "know-nothing" forecast (⅓, ⅓, ⅓) always scores **0.667**. A confident miss such as
(0.90, 0.05, 0.05) when Black wins scores **1.715** (log 2.996). The same forecast when White wins scores **0.015**.

### Step-by-step reasoning: why honesty wins
Suppose a promotion is truly 70 % likely. Your expected Brier score (two-state, as the game computes it):

* say **0.70**: 0.7 × 0.18 + 0.3 × 0.98 = **0.42**
* say **0.90** (overconfident): **0.50**
* say **0.50** (timid): **0.50**

Any distortion, in either direction, worsens the expected score ([Demonstrated] arithmetic). That is what "proper
scoring rule" means: **your best strategy is to report what you actually believe.**

### Common mistakes
* **Judging yourself on a handful of forecasts.** For an honest forecaster facing 60 % events, the standard deviation
  of the mean Brier is about **0.062 over 10 forecasts, 0.028 over 50 and 0.014 over 200** (computed). The ±0.02
  band between "Sharp", "Calibrated" and "Learning" needs **well over 50 forecasts** to mean much.
* **Rounding to 0 or 1.** The log score clamps at 0.001, but a near-zero forecast that misses still scores
  −ln 0.001 ≈ 6.9.
* **Copying the market price.** You will match the market's Brier, which is safe, but you learn nothing about your
  own judgement.

### Advanced insight
**Calibration and sharpness are different.** A forecaster who always says (⅓, ⅓, ⅓) is perfectly calibrated in a
trivial sense but scores 0.667 every time. Skill is being calibrated **and** confident when the evidence allows.
The bins show calibration, and the mean Brier against the public forecast shows whether you add anything
([Counsel] on interpretation; the measures are [Demonstrated]).

### Worked example
Five resolved forecasts on match markets:

| Your forecast (W/D/B) | Result | Brier |
|---|---|---|
| 0.50 / 0.30 / 0.20 | White | 0.38 |
| 0.40 / 0.35 / 0.25 | Draw | 0.16 + 0.4225 + 0.0625 = 0.645 |
| 0.60 / 0.25 / 0.15 | White | 0.16 + 0.0625 + 0.0225 = 0.245 |
| 0.30 / 0.30 / 0.40 | White | 0.49 + 0.09 + 0.16 = 0.74 |
| 0.45 / 0.30 / 0.25 | Black | 0.2025 + 0.09 + 0.5625 = 0.855 |

Mean = (0.38 + 0.645 + 0.245 + 0.74 + 0.855)/5 = **0.573**. That beats the uniform 0.667. Whether it beats the
public forecast depends on *its* scores on the same five markets, and five forecasts are far too few to say (see
above).

### Guided exercise
A two-state qualification market. You forecast **Yes 0.80**. (a) Brier if Yes happens? (b) Brier if No happens?
(c) Your expected Brier if the true chance is 0.80?

### Independent exercises
1. Compute the Brier and log scores of (0.25, 0.50, 0.25) when the game is drawn.
2. Why does a cancelled market not count against your forecasting record?
3. You have 12 scored forecasts with mean Brier 0.52; the public forecast has 0.55 on the same markets. Which tier
   does the game show, and how much should you trust it?
4. In your calibration chart the 70–80 % bin shows a frequency of 0.50 with a Wilson interval of 0.24–0.76. What can
   you conclude?

### Answers
* **Guided:** (a) (0.8 − 1)² + (0.2 − 0)² = **0.08**. (b) 0.8² + (0.2 − 1)² = **1.28**. (c) 0.8 × 0.08 + 0.2 × 1.28 =
  **0.32**.
* **1:** Brier 0.0625 + 0.25 + 0.0625 = **0.375**; log −ln 0.5 = **0.693**.
* **2:** a cancelled market has no outcome. The game scores only settled markets.
* **3:** 0.52 < 0.55 − 0.02 = 0.53, so **Sharp**. But with 12 forecasts the noise (about 0.06 per mean) is larger than
  the 0.03 gap. **Do not trust it yet.**
* **4:** almost nothing. The interval includes 0.75 (well calibrated) and 0.50 (overconfident). Gather more forecasts.

### Summary
The game scores paper forecasts with the Brier score (sum over all states, 0–2) and the log score, both lower-is-
better and both proper: honesty minimises your expected score. The calibration chart and the tiers need many
forecasts before they mean anything. Forecast skill is separate from trading profit.

### Next lesson
Chapter VI.4: from belief to stake. How much should you risk?

---

## Chapter VI.4 — Sizing the Stake: Kelly as a ceiling, risk as a discipline

### Learning objectives
* Compute the Kelly fraction for a $1 claim, and use fractional Kelly only as an upper bound.
* Combine Kelly with slippage, and see why liquidity usually binds first.
* Set per-market and total exposure limits, and never go all-in.

### Prerequisites
Chapters VI.1–VI.3.

### Explanation
The **Kelly criterion** gives the fraction of your bankroll that maximises long-run growth *if your probability is
exactly right*. For buying a $1 claim at price *p* when your belief is *q* (ignoring fees and slippage):

> **f\* = (q − p) / (1 − p)**

Three facts make full Kelly dangerous ([Counsel], widely accepted in forecasting practice):

1. **Your q is an estimate.** If it is too high, Kelly over-bets, and over-betting by a factor of two already
   gives zero long-run growth.
2. **Swings are large** even when q is right.
3. **In this game, prices move while you buy,** so the real edge shrinks as size grows (Chapter VI.2).

So use **fractional Kelly (½ or ¼) as a ceiling, never as a target,** and cap it further by liquidity and by fixed
exposure limits. **Never stake your whole bankroll on one market.** Keep cash for entry fees and running costs: your
career pays bills too. The economy simulations in docs/V8_SOVEREIGN_STANDARD.md show strategies that ran cash below
$100 for many rounds ([Demonstrated] that it happens; the rule is [Counsel]).

The game's own NPC traders obey similar discipline ([Demonstrated], src/exchange/npc.ts): each trades at most a
fixed share of its wallet per market (2 %–12 %), and their **open cost basis may not exceed 60 % of the wallet**.

### Illustrated example
Bankroll **$1,000**. White is at **$0.40**, and you believe **0.50**.

* f\* = (0.50 − 0.40)/(1 − 0.40) = **0.1667**, so full Kelly is $167, half Kelly $83 and quarter Kelly $42.
* **Half Kelly in this market:** $83 buys **148 shares** at an average of $0.551 and pushes the price to $0.696.
  The EV at your belief is **−$8.37**. You paid more per share than you think the share is worth!
* **The liquidity limit:** EV peaks at about 45–50 shares, roughly **$20–23** (Chapter VI.2).

In a b = 120 market, **liquidity binds long before Kelly.** The right size here is about $20, or 2 % of the bankroll,
not $83 or $167.

### Step-by-step reasoning: a sizing routine
1. Compute f\* and halve or quarter it. That is the **ceiling**.
2. Find the size at which the marginal price reaches your belief minus the fee. That is the **liquidity limit**.
3. Apply your **per-market cap**, for example 2–5 % of your bankroll ([Counsel]).
4. Check your **total exposure** across all open markets, for example at most 25 % ([Counsel]).
5. Take the **smallest** of these four numbers.

### Common mistakes
* **Doubling up after a loss** ("chasing"). The next market is independent of your last result. Your bankroll is
  smaller, so your size should be too.
* **Treating a closed market as cash.** A closed market cannot be traded. Until settlement, the game values it only at
  its **cancellation vector** (`liquidationValue`).
* **Ignoring cancellation risk.** If you bought 100 White shares in a fresh match market for $43.66 and the game is
  cancelled (for example by the 400-ply playing limit), you receive **$33.33**.
* **All-in on a "sure thing".** In a chess game the favourite at 0.82 still fails nearly one time in five.

### Advanced insight
**Correlated positions count as one.** Positions that depend on the same competitor, say a tournament-winner
claim on them and "they win" in two of their featured match markets, rise and fall together. For sizing, add them up as a single exposure. Chapter VI.5 shows
how.

### Worked example
Bankroll $600. A promotion market (b = 80) shows Yes at $0.30, and you believe 0.40.

* f\* = (0.40 − 0.30)/(0.70) = 0.143. Quarter Kelly is about **$21**.
* Liquidity: the marginal price reaches $0.396 (your belief minus the 1 % fee) after **34 shares**, which cost
  **$11.91** in total (average $0.347). Beyond that, extra shares lose EV. 50 shares would cost $18.70 and move Yes
  to $0.445, with EV down to +$1.30.
* A per-market cap of 3 % gives **$18**.
* The smallest limit is liquidity: buy about **34 shares for $11.91**, with EV = 0.40 × $34 − $11.91 = **+$1.69**
  (all computed with the game's functions). Check the live quote before you confirm.

### Guided exercise
Bankroll $800. A tournament-winner market (b = 150) lists your favourite at $0.25, and you believe 0.30. (a) Full and
quarter Kelly in dollars? (b) Near $0.25, roughly how much does each share move the price? (c) What other check must
you do before buying?

### Independent exercises
1. Compute f\* for q = 0.55, p = 0.50, and for q = 0.30, p = 0.25.
2. Why is a quarter-Kelly stake "safer" if your probabilities tend to be overconfident?
3. You hold positions costing $120, $80 and $60 in three markets on the same competitor, and your bankroll is $1,000.
   What is your exposure on that competitor as a percentage?
4. Name two reasons the NPC traders' 60 % exposure cap is *higher* than a sensible cap for you.

### Answers
* **Guided:** (a) f\* = 0.05/0.75 = 0.0667, so full Kelly ≈ **$53** and quarter ≈ **$13**. (b) 0.25 × 0.75/150 ≈
  **0.00125**, about 0.1 cents per share. (c) **Total and correlated exposure.** Is this competitor already in your
  other positions?
* **1:** (0.55 − 0.50)/0.50 = **0.10**; (0.30 − 0.25)/0.75 = **0.0667**.
* **2:** an overconfident q inflates f\*. A smaller fraction leaves room for the error, and over-betting harms growth
  much more than under-betting.
* **3:** $260 out of $1,000 = **26 %**, as one correlated exposure.
* **4:** for example: NPC wallets are topped up each season from the treasury (up to $4,000), while your losses are
  not refunded. NPCs also have no careers, entry fees or club costs to pay. ([Demonstrated] top-up rule; the
  comparison is [Counsel].)

### Summary
Kelly f\* = (q − p)/(1 − p) is a ceiling, not a target. Use ½ or ¼ of it at most. In the Crown Exchange, slippage
usually limits size first: stop where the marginal price meets your belief minus the fee. Add correlated positions
together, cap per-market and total exposure, keep cash for your career, and never go all-in.

### Next lesson
Chapter VI.5: forecasting whole tournaments, where outcomes are linked.

---

## Chapter VI.5 — Tournament Forecasting: correlated outcomes and hedging

### Learning objectives
* Know every Exchange market family, its states, and how it closes, settles and cancels.
* Reason about correlated outcomes across markets.
* Hedge a position by partial sale and compute the resulting outcomes.

### Prerequisites
Chapters VI.1–VI.4; Book V, Chapter V.4 (formats and tiebreaks).

### Explanation
**Market families. [Demonstrated]** src/exchange/families.ts `RULES`:

| Family | States | Trading closes | Settles on | Cancellation pays |
|---|---|---|---|---|
| Match | White / Draw / Black | the match starts (live: after each published move) | the result | 1/3 per share |
| Winner (Swiss Open, Championship) | every entrant | first round processed or first game started | the champion (joint: shares split) | 1/n |
| Promotion | Yes / No (top two) | last league round starts | the promotion list | ½ |
| Qualification | Yes / No (Crown Championship) | last league round starts | the Championship field | ½ |
| Season title | every division member | last league round starts | the title holder (league order) | 1/16 |
| Bracket | 8 final-four paths | the semifinals start | the realised path | \|S\|/8 per share of claim S |

**The public models** use public ratings and recorded results only: the Davidson match model, and Monte Carlo
simulations of the remaining league rounds, of Swiss events and of the bracket (src/exchange/families.ts). Markets
close **when their closing round starts**, so no result is ever traded after it is known (src/app/markets.ts).

**Correlated outcomes** move together. A competitor who wins their games raises their price in *every* market
they appear in at once. Markets on the same competitor, or on competitors in the same league, are linked. In the
bracket market, claims are subsets of the same 8 paths, so "champion", "finalist" and "beats Y in the final" are
nested. A conjunction claim pays nothing if its condition fails. It is **not refunded**.

**Hedging** means reducing the spread of your possible outcomes, usually by selling part of a position after the
price has moved. In this game you cannot short, so you hedge by **selling what you hold** (or, in a multi-state
market, by buying other states).

### Illustrated example
You bought **100 White shares** at $0.40 for **$50.78** (fee included). Later, other traders move the market to
**White $0.60 · Draw $0.20 · Black $0.20**. Computed with the game's functions (b = 120):

| Choice | Cash now | If White wins | If not |
|---|---|---|---|
| Hold all 100 | $0 | **+$49.22** | **−$50.78** |
| Sell 50 (nets $27.17, price falls to $0.497) | $27.17 | **+$26.39** | **−$23.61** |
| Sell all 100 (nets $49.23, price falls to $0.395) | $49.23 | **−$1.55** | **−$1.55** |

Selling everything at the new price still *loses* money: selling 100 shares pushes the price back down (slippage),
and you pay the fee twice. **Hedging has a price.** It is worth paying only if your belief has changed or your
exposure is too large.

### Step-by-step reasoning: a tournament forecast
1. **Start from the public model,** and know what it uses: public ratings and recorded results.
2. **Ask what it cannot know:** a high-RD rating is a weak signal (Book V, Chapter V.3), and the remaining schedule
   matters (who still plays whom).
3. **Write your probability vector** as a paper forecast before trading.
4. **Map your exposure:** list every market in which this competitor appears.
5. **Trade only the difference** between your belief and the price, sized by Chapter VI.4.

### Common mistakes
* **Thinking you are diversified when you are not.** Three markets on one competitor are one bet.
* **Buying a conjunction expecting a refund.** "X beats Y in the final" pays $0 if Y never reaches the final.
* **Trading a winner market you might enter.** Your entry cancels it at 1/n, so your position returns 1/n per share,
  whatever you paid.
* **Forgetting the conflict rule.** If you sponsor a competitor, the game refuses your buy orders in their markets.

### Advanced insight
In the bracket market every claim is priced from the same 8 path prices, so you can check coherence yourself: the
champion claim must equal the sum of its two paths, and the finalist claim the sum of its four. If you believe one
path is mispriced, the cheapest way to act is the **narrowest claim containing it**. Broader claims carry the other
paths' prices too ([Counsel], following directly from the [Demonstrated] claim structure).

### Worked example
*A 16-player division title market.* The public model gives the leader 0.35 with four rounds to go. The leader's
remaining opponents are the three strongest players in the division, so you estimate 0.28. The leader's price is
$0.34. **Do not buy the leader, and do not "short" it either (impossible).** Your options are a paper forecast of
0.28, or buying a rival you think is underpriced, *if* your belief about that rival is also above its price. A low
opinion of one competitor does not by itself make any other one cheap.

### Guided exercise
In a fresh bracket market (all 8 paths at $0.125), what does a "champion" claim cost? A "finalist" claim? If you
buy 10 champion shares for competitor A, how does the price of A's finalist claim change, and why?

### Independent exercises
1. Using the illustrated example, what is your profit if you sell 50 shares and White then draws?
2. Why do promotion and qualification markets pay ½ per share on cancellation, while season title markets pay 1/16?
3. You hold X in the Federation Open winner market and then buy "X wins" in a featured match market of one of X's
   Open games. Are these positions correlated? In which direction?
4. Why can no result be traded after it is known in the Exchange?

### Answers
* **Guided:** champion = 2 paths = **$0.25**; finalist = 4 paths = **$0.50**. Buying A's champion claim adds shares
  to A's two champion paths, which are also two of A's four finalist paths. So A's finalist price **rises** too. One
  inventory keeps the prices coherent.
* **1:** a draw is "not White": **−$23.61**.
* **2:** cancellation pays the uniform vector 1/n: two states give ½, sixteen states give 1/16.
* **3:** yes, **positively**. Winning that game raises X's chance of winning the Open, so both positions gain
  together, and losing it hurts both. Count them as one exposure.
* **4:** markets close when their closing round starts, and match markets close at the final move. Live trading
  happens only between published moves, and quotes taken before a move are rejected after it.

### Summary
Know each family's states, closing time, settlement and cancellation. Public models use only public information.
Linked markets are one exposure. Hedge by selling what you hold, but remember that slippage and fees make hedging
costly. Trade only the gap between a written belief and the price.

### Next lesson
Chapter VI.6: forecasting a game while it is being played.

---

## Chapter VI.6 — Live Odds and the Uncertain Board

### Learning objectives
* Know exactly how in-play trading works and what information is public.
* Compute the game's live model from an engine evaluation.
* Judge how certain a chess position really is, and what that means for a forecast.

### Prerequisites
Book V, Chapter V.6 (the expected-score scale); Chapters VI.1–VI.5.

### Explanation
**In-play trading. [Demonstrated]** src/app/federation.ts, src/ui/SpectatorScreen.tsx. When you watch a featured
Federation game live, its match market can be traded **between moves**. After each move is published, then before
the next move is computed, you see what every trader sees: the moves, the engine's own evaluation, and the price
history. **Future moves do not exist while you can trade.** Each move is computed only after the trading window
closes, and a trade queued while a move is being computed is rejected once it is published. **Move grades stay
hidden until the market is settled or cancelled,** and Match Analysis runs only then.

**The live model** is a forecast derived from the published evaluation. It is never the price. With u = the
expected score of the evaluation for White (crown-outcome-map-v2) and d₀ = the pre-game draw probability:

> d = max(0.01, d₀ · (1 − |2u − 1|)), W = max(0.005, u − d/2), B = max(0.005, 1 − u − d/2), then normalise.

The draw share shrinks as the evaluation becomes one-sided. Two NPC desks act in-play: *Kestrel Tactical Desk*
trades on this evaluation-based model, and *Tidewater Momentum* buys whatever has risen since the last window
(price history only).

**A fact worth noticing. [Demonstrated]** The live model uses **only the evaluation** of the current position, not
the rating gap. At 0 cp it gives roughly **0.35 / 0.30 / 0.35**, even if the pre-game forecast favoured one player.
Whether the rating gap should still count once the game is under way is *your* judgement as a forecaster.

### Illustrated example
A featured game between public ratings **1850 (White) and 1750**. Pre-game model: **0.447 / 0.302 / 0.251**
(d₀ = 0.302). Live model after the engine's evaluation (computed with the game's formula and `mapV2`):

| Evaluation (White) | u | Live W / D / B |
|---|---|---|
| 0 cp | 0.502 | 0.352 / 0.300 / 0.347 |
| +50 cp | 0.575 | 0.447 / 0.256 / 0.297 |
| +150 cp | 0.769 | 0.700 / 0.139 / 0.161 |
| +300 cp | 0.932 | 0.912 / 0.041 / 0.047 |
| −150 cp | 0.219 | 0.153 / 0.132 / 0.715 |

### Step-by-step reasoning: how certain is this board?
An evaluation is an estimate from a search of limited depth, and its certainty varies a lot.

```crown
fen: NK4/2p1Rr/1Q2p1/5k/6/3n2 w - - 0 1
line: Qxe4+
claim: only-mate-in-2
caption: White to move. Here the result is certain: there is a forced mate in two.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♘ ♔ · · · ·
5 │ · · ♟ · ♖ ♜
4 │ · ♕ · · ♟ ·
3 │ · · · · · ♚
2 │ · · · · · ·
1 │ · · · ♞ · ·
  └─────────────
    a b c d e f    White to move
```
*White to move. Here the result is certain: there is a forced mate in two.*
<!-- /diagram -->

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: a3 f4
show: after
caption: After 1.a3 f4, one of the book's dead-level openings (0 cp at Fairy-Stockfish depth 10). Most of the game is still to be played.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ·
4 │ · · · · · ♟
3 │ ♙ · · · · ·
2 │ · ♙ ♙ ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*After 1.a3 f4, one of the book's dead-level openings (0 cp at Fairy-Stockfish depth 10). Most of the game is still to be played.*
<!-- /diagram -->

1. **Forced mate on the board:** the result is settled (the first board is proven by exhaustive search). A
   forecast should be near 1, and only the remaining time on the clock adds doubt.
2. **A large but unforced edge** (+300 cp): the map says about 0.93 in engine games. But the map was fitted on
   *engine* games, and a weaker or time-pressed player converts less reliably ([Counsel]).
3. **A balanced position** (the second board): the evaluation says little. The draw rate and the players'
   strengths dominate, which is exactly the information the live model drops.
4. **Volatile positions:** if the evaluation has swung several times, the search is struggling. Widen your
   uncertainty rather than chasing each swing ([Counsel]).

### Common mistakes
* **Treating the evaluation as the probability.** It is an input to a model that maps it to an expected score.
* **Chasing momentum.** A price that rose in the last window carries no promise about the next one.
* **Trading on a stale quote.** It will be rejected. Read the new position first.
* **Expecting grades during the game.** They appear only after settlement.

### Advanced insight
The map is steep near balance and flat near decisive positions (Book V, Chapter V.6). So a 100 cp swing around 0
moves the live model much more than a 100 cp swing around +500. When a featured game is balanced, small evaluation
changes produce large live-model changes, and prices driven by the Tactical Desk can swing. That is where a
forecaster who reads the position calmly can disagree most usefully ([Counsel]).

### Worked example
After move 18 the evaluation is **+150 cp** for White. The live model says **0.700 / 0.139 / 0.161**. The price of
White is **$0.62**. You have watched the game: White's advantage is a protected passed pawn, and Black has no
counterplay. You believe **0.72**.

* Small-trade break-even: 1.01 × 0.62 = 0.626 < 0.72, so the trade is in your favour.
* Size it with Chapter VI.4: a match market has b = 120, so at $0.62 each share moves the price about
  0.62 × 0.38/120 ≈ 0.002. Stop well before the price reaches about 0.71.
* Write the paper forecast as well. It is scored even if you do not trade.

### Guided exercise
Pre-game draw probability d₀ = 0.31. The evaluation gives u = 0.676 (about +100 cp). Compute d, W and B (before
normalising), and check that they add up to 1.

### Independent exercises
1. At u = 0.5, what is d in terms of d₀? At u = 1?
2. Why does the game reject a trade that you queued while the next move was being computed?
3. Name the two NPC traders that act in-play and the information each one uses.
4. Why is a featured game that is stopped by the playing-length limit cancelled rather than settled as a draw?

### Answers
* **Guided:** |2u − 1| = 0.352, so d = 0.31 × 0.648 = **0.201**. W = 0.676 − 0.100 = **0.576**, B = 1 − 0.676 −
  0.100 = **0.224**. The three add up to exactly 1 by construction ((u − d/2) + d + (1 − u − d/2) = 1). The rounded
  figures give 1.001. The floors and the normalisation matter only when u is near 0 or 1.
* **1:** d = **d₀** at u = 0.5 (the draw share is at its maximum). At u = 1, d₀ × 0 = 0, so the floor **0.01**
  applies.
* **2:** the market's **revision** changes when a move is published. A quote taken before new public information can
  never execute after it.
* **3:** **Kestrel Tactical Desk** (the public engine evaluation of the current position, through the live model)
  and **Tidewater Momentum** (price history only). The fans and novices also trade live, on the live model plus their
  noise and bias.
* **4:** a game stopped by the limit has no real result. It is *censored*. The market pays its published
  cancellation vector (1/3), and the standings record an adjudicated draw, labelled as such.

### Summary
Live trading happens between published moves, on public information only. Grades stay hidden until settlement. The
live model turns the evaluation into W/D/B, with a draw share that shrinks as the position becomes one-sided, and
it ignores the rating gap. Judge how certain the board really is: proven mate, large edge, balanced, volatile.

### Next lesson
Chapter VI.7: the other traders, your own biases, and the long run.

---

## Chapter VI.7 — The Crowd and the Mirror: NPC traders, overconfidence and the long run

### Learning objectives
* Describe the NPC traders exactly as the code defines them.
* Recognise overconfidence and the other common forecasting and trading errors.
* Separate luck from skill with sample sizes.

### Prerequisites
All earlier chapters of Book VI.

### Explanation
**The NPC traders (crown-npc-traders-2). [Demonstrated]** src/exchange/npc.ts. All eight trade through the same LMSR
as you, long-only, with funded wallets. They use **only** information available when they decide: the published
model (public ratings), the live engine evaluation during play, and public price history. They **never** see hidden
strength or any future move or result. **No trader is guaranteed to profit.**

| Trader | Behaviour | Noise | Margin | Budget per market | Acts |
|---|---|---|---|---|---|
| Old Harbour Fund | conservative value; trades only large mispricings | 0.05 | 0.06 | 2 % | pre-game, between rounds |
| Crown Supporters Club | overconfident fans of the favourite (+0.06 on the favourite) | 0.08 | 0.02 | 5 % | pre-game, live |
| Lantern Contrarians | back the underdog (+0.06) | 0.08 | 0.04 | 3 % | pre-game, between rounds |
| First-Time Forecasters | noisy novices | 0.14 | 0.02 | 3 % | pre-game, live |
| Tidewater Momentum | buys what has risen since the last window | — | 0.03 | 2 % | live, between rounds |
| Summit Tournament Partners | tournament specialist (season and tournament markets) | 0.03 | 0.02 | 6 % | pre-game, between rounds |
| Kestrel Tactical Desk | trades in-play on the public evaluation | 0.03 | 0.03 | 4 % | live |
| Meridian Analytics | calibrated fundamental trader on the public model | 0.03 | 0.02 | 12 % | pre-game, between rounds |

*Noise* is the standard deviation added to the public belief, and *margin* is the minimum edge a value trader
demands. A value trader buys the claim with the largest (belief − price − margin) up to a target price of
(belief − margin). Biased and noisy traders act **first** and the informed ones **last**, so prices usually end near
the public consensus, with residual noise. Wallets are topped up each season to at most $4,000, and open exposure is
capped at 60 % of the wallet.

**What this means for you** ([Counsel], reasoned from the [Demonstrated] design): the price you see usually reflects
the *public model* closely. If you have an edge at all, it comes from **better judgement** than the public ratings
contain: about rating reliability (RD), about the remaining schedule, and about what the board shows in live games.
It does not come from tricks. If you have no view, do not trade. A paper forecast is free.

### Illustrated example: overconfidence
A forecaster says 0.9 to every "favourite wins" question. The favourites truly win 70 % of the time. Expected Brier
(two-state, game formula): honest 0.70 gives **0.42**, while the overconfident 0.90 gives **0.50**. In trading,
overconfidence makes Kelly-sized stakes far too large, and in this game it also makes you push prices past your
true break-even (Chapter VI.4).

### Step-by-step reasoning: luck versus skill
Suppose every trade is like the Chapter VI.2 example: 50 shares bought at $0.40 for **$22.78**, in an outcome that is
truly 50 %. EV = **+$2.22** per trade. The outcome alone has a standard deviation of $25 per trade. With independent
trades (computed with a normal approximation):

| Trades | Expected profit | Standard deviation | Chance of being behind anyway |
|---|---|---|---|
| 1 | $2 | $25 | 46.5 % |
| 10 | $22 | $79 | 38.9 % |
| 100 | $222 | $250 | 18.7 % |
| 400 | $889 | $500 | 3.8 % |
| 1,000 | $2,222 | $791 | 0.2 % |

**A genuine edge can lose for a long time, and a bad trader can be ahead after ten trades.** Results tell you about
skill only over hundreds of comparable decisions. Your Brier score against the public forecast is usually a faster,
cleaner signal than your profit.

### Common mistakes
1. **Outcome bias:** "I lost, so it was a bad trade." Judge EV at the time of the trade.
2. **Overconfidence:** probabilities too close to 0 or 1.
3. **Anchoring** on the price: write your belief first.
4. **Chasing** losses, or doubling up after a win.
5. **Ignoring the fee and slippage,** especially on round trips.
6. **Mistaking correlation for diversification.**
7. **Trading without a view:** when you have no view, the fee is your only certainty.
8. **Letting the Exchange take over your career.** Forecasting skill is not chess skill, and cash lost on the
   Exchange is cash you no longer have for entry fees and club costs.

### Advanced insight
**Base rates first.** Before any specific reasoning, start from the base rate (for example the ≈ 31 % draw rate
between equals in the result model), then adjust for specifics. Forecasters who start from the specifics tend to
overreact to vivid details such as a dramatic last game ([Counsel], a well-established finding in forecasting
practice, not measured in this game).

### Worked example: a forecaster's journal entry
*Market:* season title, 4 rounds left. *Price* of competitor K: $0.22. *Public model:* 0.24. *My belief:* 0.30.
*Reason:* K's rating is provisional (RD 180) after a strong run of results. I think K is better than the rating
says, and K's remaining opponents are the weakest four. *Exposure on K elsewhere:* none. *Size:* quarter Kelly =
(0.30 − 0.22)/0.78/4 ≈ 2.6 % of the bankroll, capped to 2 %. *Paper forecast:* recorded. *Review date:* after
settlement. Check the Brier score and whether the provisional rating moved the way I expected.

### Guided exercise
A trader tells you: "I've made money on 7 of my last 10 trades, so I'm skilled." Using the table, write two
questions you would ask before agreeing.

### Independent exercises
1. Which NPC trader would you expect to buy the favourite in a pre-game match market, even when the price already
   matches the public model? Why?
2. Can any NPC trader see a competitor's hidden strength? Quote the rule.
3. Your mean Brier is 0.55 over 200 forecasts, and the public forecast's is 0.58 on the same markets. Is that
   stronger evidence of skill than a $300 profit over 30 trades? Explain.
4. Give one reason why the order in which NPC traders act matters for the price you see.

### Answers
* **Guided:** for example: *What was the expected value of those trades at the time?* *How large were they, and
  how many would it take to separate luck from skill?* (Ten trades leave a 39 % chance of being behind with a real
  edge, so a lucky player can easily be ahead.)
* **1:** **Crown Supporters Club**: its belief adds +0.06 to the favourite, and its margin is only 0.02.
* **2:** **no**. "Information available at decision time only: the published model (public ratings), the board
  position's public engine evaluation during live play, and public price history — never hidden strength, never a
  future move or result." The competitor model also notes that hidden strength is "never used by forecasts or NPC
  traders".
* **3:** yes, very likely. Over 200 forecasts the noise in a mean Brier is roughly 0.014, so a 0.03 gap is about two
  standard deviations. A $300 profit over 30 trades can easily come from luck (see the table).
* **4:** the biased and noisy traders act first and the informed ones last, so the informed traders correct much of
  the noise and the final price ends near the public consensus.

### Summary
The NPC traders trade on public information only, with documented biases, noise and limits, and no one is
guaranteed a profit. Prices therefore tend to sit near the public model. Any edge you have must come from better
judgement, and a paper forecast is the free way to test it. Beware overconfidence, outcome bias and correlation.
Skill shows only over large samples, and the Brier score shows it faster than profit.

### Next lesson
The **Twelve-Week Program** (docs/grimoire/07-twelve-week-program.md) puts Books I–VI into a schedule, and the
**Glossary** (docs/grimoire/08-glossary.md) defines every term used in them.
