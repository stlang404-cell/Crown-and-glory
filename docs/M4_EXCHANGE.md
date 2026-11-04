# The Grand Exchange (v0.4.0) — market mathematics, solvency, information integrity, forecasting, sandbox

All money is fictional crowns (₵): no purchase, no withdrawal, no real-world value.

> v0.10: the integrity audit, the Decisive claim, the over/under and quarterfinal-advancement markets, the
> results-pending suspension, the anchoring analyst NPC and the trading API are documented in
> docs/MARKET_INTEGRITY.md (defects #26–#33 in docs/BUG_REGISTER.md). Where they differ, that document wins.
Code: `src/exchange/lmsr.ts`, `market.ts` (crown-exchange-2), `families.ts` (crown-markets-2), `npc.ts`
(crown-npc-traders-2), `src/app/markets.ts`, `src/app/federation.ts`, `src/app/forecasting.ts` (crown-forecast-1).
Tests: `tests/exchange.test.ts`, `tests/exchange2.test.ts`, `tests/markets.test.ts`, `tests/federationService.test.ts`;
browser: `e2e/m4-journey.mjs`. Builds on docs/V3_EXCHANGE.md (v0.3.0 match markets), which remains valid.

## 1. One mechanism for every market

Each market is a **fixed-b LMSR over n exhaustive, mutually exclusive states** (research doc 09):
C(q) = b·ln Σ e^{q_s/b}, log-sum-exp; prices p_s = e^{q_s/b}/Σ. Traders buy and sell **claims**: a claim pays 1 ₵
per share in every state of its subset S; buying k shares adds k to q_s for all s ∈ S and costs C(q + k·1_S) − C(q).
A categorical outcome is the singleton S = {i}. All claims of a market share one inventory, one collateral account
and one funded subsidy, so claim prices are coherent (complete-set identity C(q + t·1) − C(q) = t is tested).

- **Funding.** Uniform q0 = 0 → worst-case maker loss b·ln n, transferred from the treasury into the market's
  subsidy account before it opens (rounded up to whole µ). Prior-priced (sandbox) markets: q0_i = b·ln(p0_i/max p0),
  subsidy b·ln(1/min p0) (research doc 09's revised bound); liabilities are q − q0, never q0.
- **Money.** Integer microcrowns; buy cost rounded up, sale proceeds rounded down, 1% fee rounded up, each way;
  every operation is one balanced double-entry journal with a unique idempotency id. No account may go negative
  (except issuance accounts); journals mixing `sandbox:` and official accounts are rejected by the ledger.
- **Long-only.** You can only sell claims you hold; no leverage, no naked shorts.
- **Resolution** pays a published **payout vector** over states (sum 1): the realised state (unit vector), an equal
  split (joint champions), or the market's **cancellation vector** (uniform 1/n by default; the opening prior for
  sandbox markets). A claim pays Σ_{s∈S} payout_s per share, floored per holding. Settlement is terminal and
  idempotent (`settle:<market>`); a second attempt is rejected and posts nothing.
- **Solvency proof (tested).** Collateral = C(q) − C(q0) (rounding in the maker's favour), so for any payout vector
  y in the simplex: Σ_s y_s·x_s ≤ max_s x_s ≤ C(q) − C(q0) + subsidy. `tests/exchange2.test.ts` checks, after every
  one of thousands of random buys/sells by several holders: collateral + subsidy ≥ max issued exposure; ledger sums
  to zero; and for every unit vector, joint splits and cancellation: maker loss ≤ funded subsidy, no negative account.

| Test | Markets | Random trades | Resolutions checked per market |
| --- | --- | --- | --- |
| 16-state tournament market | 8 | 200 each | 16 unit vectors + joint split + uniform cancel |
| 8-state final-four with overlapping claims | 10 | 250 each | 8 paths + joint final + cancellation (|S|/8 per share verified) |
| Prior-priced sandbox markets | 12 | 150 each | 3 unit vectors + the prior; forced-cancel profit ≤ 0 |
| v0.3 W/D/L markets (tests/exchange.test.ts) | 30 | 150 each | 3 outcomes |

## 2. Market families (one canonical event cluster each per season)

| Family | States / claims | Listed | Trading closes | Settles from | Cancellation | b |
| --- | --- | --- | --- | --- | --- | --- |
| Match | W / D / B | featured match at round opening | first move (or, in-play, at the final move) | the game result; a game stopped by the 400-ply limit is **censored → cancelled** | 1/3 | 120 |
| Federation Open champion | 32 entrants | season start | round 4 starts | Swiss table after round 8 | 1/32 | 150 |
| Crown Championship champion | 16 qualifiers | bracket drawn (after round 15) | round 16 starts | final; joint champions split ½/½ | 1/16 | 150 |
| Promotion | Yes / No for one competitor in another region | season start | round 15 starts | season-end promotion list | ½ | 80 |
| Qualification | Yes / No for one Crown Division player of a third region | season start | round 15 starts | the Championship field | ½ | 80 |
| Season title | 16 members of a fourth region's Crown Division | season start | round 15 starts | final league order | 1/16 | 100 |
| Bounded conditional (final four) | 8 bracket paths; claims: champion (2 paths), finalist (4), "X beats Y in the final" (1) | after the quarterfinals | semifinals start | realised path; joint final ½/½ | |S|/8 | 100 |

**No duplicated payoffs.** The four season families use four different regions, never the player's own; the
champion market closes before the final-four market opens; the final-four claims are canonical subsets (identical
subsets are listed once — tested). **No influence.** Markets never list a game or event involving the player
(a season with the player in the Championship lists no Championship markets), and while the player sponsors a
competitor they may not buy into any market involving them (selling existing shares is allowed).

**Conditional semantics.** A conditional statement is a *conjunction* claim: "X beats Y in the final" pays 1 if Y
reaches the final AND X wins, and 0 if the condition fails — never a hindsight refund. The market page also shows
the *indicative* P(X wins | Y reaches the final) = p(X beats Y)/p(Y reaches final), labelled as a ratio of prices
and not an executable price. Deviation from research doc 09: our final can end in joint champions, which the
8-state reference does not model; we keep 8 states and settle a joint final by the payout vector ½/½ on the two
finalists' paths (inside the simplex, so the solvency bound is unchanged) instead of adding 4 joint states.

**Models (information only).** Published per state from **public ratings** and recorded results: two-game
knockout probabilities with the finite tiebreak policy (classical → rapid → blitz → seed / joint final), exact
bracket propagation, and Monte Carlo of the remaining league rounds / Swiss rounds (production pairing and
tiebreak code; 150–300 runs). Models are refreshed after each round; they never move q (only trades do).

## 3. Live in-play trading — information-integrity audit

| Requirement (doc 09) | Implementation | Evidence |
| --- | --- | --- |
| No precomputed outcome while trading | `startLive` creates a live record with **no moves**; each `liveStep` computes exactly one move (fresh seeded search) inside the serialized command lock, appends it and commits; the next move does not exist until the next step | `tests/markets.test.ts` live test; e2e step 15 |
| Publish, then reopen trading | the move, the public evaluation and the live model are committed in the same transaction as NPC reactions; player trades are serialized behind it | service code |
| Suspend during computation | commands are serialized (`run`); a trade requested meanwhile executes after publication, and the stale-quote guard (`expectVersion`) rejects it if the price moved | test: stale quote rejected |
| Suspend after terminal information | the terminal move is detected in the same step that settles the market; no command can trade between them | test: trading after the end is rejected |
| NPC traders only on public info | live model = engine evaluation of the published position → expected score with a draw share; momentum traders read price history | `npc.ts` |
| Same mechanism for NPCs | `npcTrade` calls the same `trade()`; budgets, per-market spend and a 60%-of-wallet exposure cap | `npc.ts`, exposure test via NPC batch |
| Reload resumes the committed timeline | moves are persisted after each step; a reloaded instance continues from the stored moves with the same seeds | test: second instance resumes and finishes |
| Not defeatable by a determined offline owner | stated limitation (doc 09): an offline client cannot be made tamper-proof | — |

The live model is labelled as a forecast; prices move only when someone trades. Background-played featured matches
still close their market at the first move (in-play trading exists only when the player watches live).

## 4. NPC traders (crown-npc-traders-2)

Eight funded traders (`Exchange → Traders` shows wallets and exposure): conservative liquidity seeker, favourite
fans, contrarians, noisy novices, momentum (price history only), tournament specialist (season/tournament markets
only), tactical desk (in-play, live evaluation) and a calibrated analyst. They act at listing ('pre'), after each
published move ('live') and after each processed round ('round'), with seeded noise, margins, per-market budgets
and an exposure cap. New traders in migrated v0.3 saves start with zero balance and are funded only by the normal
season top-up journals from the treasury. No trader is guaranteed to profit.

## 5. Forecasting companion (crown-forecast-1)

Free probability forecasts on any non-conditional market, one per market (updatable until closure, then locked),
stored with a snapshot of the market price and the public model at forecast time. Scoring on resolution:
Brier Σ(p − y)² and log score −Σ y·ln max(p, 0.001); cancelled markets are not scored. The Forecasts page shows the
summary against the market price and the model on the same events, a calibration plot (10 bins, 95% Wilson
intervals), a rolling-Brier skill chart and the history. Forecast skill is never counted as chess or financial
prestige, and the page states that a good forecast is not the same as a profitable trade.

## 6. Sandbox Exchange — isolation and anti-exploit audit

| Risk | Control | Evidence |
| --- | --- | --- |
| Sandbox money leaking into official finances | separate `sandbox:player/treasury/fees/mint` accounts; the ledger rejects mixed journals; finance, net worth, P&L, prestige and the federation read only official accounts | test: every non-sandbox balance identical before/after; e2e step 21 |
| Profiting by losing on purpose | only "You win" and "You draw or win" claims exist; no claim pays on your own loss | test (claims) |
| Profiting from a forced void (assistance, abandoning, early resignation) | the market opens at the rating-based prior and cancels at that same published vector: buying at the opening price and forcing a void returns at most what was paid, minus fees | tests (prior market; assisted game cancelled) |
| Trading after seeing the game | trading closes at move 1 (refused once a move exists; the market is closed when the first move is made) | service guard |
| Reloads / duplicate settlement | one market per game id; settlement from the finalized record, idempotent `settle:` id | test: second settlement is a no-op |
| Rated, federation, training or non-standard games | ineligible (`sandboxIneligible`) | test |
| Infinite refills | 500 starting balance; a refill to 200 only when below 20 and after 5 settled sandbox markets since the last | code; sandbox money has no official value |

Limitation: a game abandoned without finalization leaves its sandbox market closed (positions frozen) — it is
never settled in the player's favour.

## 7. Censored games and cancellations

A featured game that reaches the 400-ply playing limit is not a result: its market is cancelled on the published
uniform vector (previously v0.3.0 settled it as a draw). Standings still record the adjudicated draw, labelled
"playing limit". Paper forecasts on cancelled markets are not scored.
