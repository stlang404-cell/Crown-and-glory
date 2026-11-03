# v0.5 federation, rating, market and economy integrity report

Evidence is either an automated test (run in this release: `npx vitest run`) or a simulation through the shipped
`FederationService` (`tools/sim/economy.ts`). Results that were not measured are marked NOT RUN.

## Ratings (Glicko-2)

| Property | Evidence |
|---|---|
| Matches Glickman's published worked example | `tests/ratings.test.ts` |
| Inactivity only increases RD (cap 350); volatility bounded; finite under extreme inputs | `tests/ratings.test.ts` |
| Exactly one rating update per rated game (atomic, idempotent finalisation) | `tests/storage.test.ts` "exactly one rating update"; `e2e/v5-journey.mjs` step 4 |
| Untimed and assisted games never rated | `tests/session.test.ts` |
| Rating ledger replays to the stored state (also enforced on backup import) | `tests/ratings.test.ts`, `src/storage/backup.ts` |
| Federation rating inflation/deflation over seasons | `tests/federation.test.ts` "multi-season stability … no inflation"; 20-season sweep below |
| Opponent calibration | level ratings from measured engine matches (`src/engine/calibration.json`); Sovereign Max: see docs/V5_ENGINE.md |

The six records are kept separate in code and UI (Passport → Career standing): chess rating (rated results only),
competitive division (league results), earned federation title (norms + rating), career experience, financial
prestige, achievements. No purchase path touches the first three (`tests/cosmetics.test.ts` asserts titles are
unchanged by purchases; money cannot buy rating points — the Training Hall offers unrated sparring only).

## Competition

| Property | Evidence |
|---|---|
| Round robin: every pair once, one game per round, colours balanced | `tests/federation.test.ts` |
| Swiss: no repeat pairings, byes to the lowest player without one, impossible cases handled | `tests/federation.test.ts` |
| Knockout always terminates; joint title only in the final | `tests/federation.test.ts` |
| League tiebreaks: head-to-head → Sonneborn–Berger → seed | `tests/federation.test.ts` |
| Qualification: best 8 Crown Division winners + top 8 of the Federation Open | `src/federation/world.ts` `buildChampionship`; full-season test |
| Prizes paid from funded escrow once; sponsor milestones once | `tests/federationService.test.ts` |
| Stale or duplicate commands rejected; failed commit leaves state unchanged | `tests/federationService.test.ts` |
| Titles/trophies/ceremonies only from recorded results, no duplicates | `tests/heraldryService.test.ts`; `e2e/m5-heraldry.mjs` |

## Markets (fixed-liquidity LMSR)

C(q) = b·log Σ exp(qᵢ/b); prices = softmax(q/b); a trade costs C(q′) − C(q) with directed rounding (buys up,
sells down). Uniform markets fund b·ln n; prior-priced markets fund b·ln(1/min p₀) with q₀ᵢ = b·ln(p₀ᵢ/max p₀).

| Property | Evidence |
|---|---|
| Prices are a probability vector equal to the cost gradient; stable log-sum-exp | `tests/exchange.test.ts` |
| No complete-set arbitrage; buy-then-sell loses exactly fees + rounding | `tests/exchange.test.ts` |
| Random trading: conservation and solvency at every step; maker loss ≤ funded subsidy for every outcome | `tests/exchange.test.ts`, `tests/exchange2.test.ts` (16-state, joint winners, bracket paths) |
| Non-uniform prior: funds b·ln(1/min p₀), solvent for every outcome | `tests/exchange2.test.ts` |
| Conditional (final-four) claims are canonical subsets of 2³ enumerated paths; coherent prices | `tests/exchange2.test.ts` |
| Settlement idempotent; closed markets refuse trades and never reopen; invalid payout vectors rejected | `tests/exchange.test.ts`, `tests/exchange2.test.ts` |
| No short selling, no unfunded purchases | `tests/exchange.test.ts` |
| Markets close before the game exists; NPCs use only published information | `tests/federationService.test.ts`, `tests/exchange.test.ts` |
| In-play: trading windows only between published moves; resume after reload | `tests/markets.test.ts`; `e2e/m4-journey.mjs` steps 11–17 |
| Sandbox money never mixes with official money | `tests/exchange.test.ts`, `tests/markets.test.ts`; `e2e/m4-journey.mjs` step 21 |
| Realised maker losses within the funded subsidy across long simulations | sweep below (`subsidyBoundViolations`) |

Honest limit: saves are owner-controlled local data. Checksums and ledger replays detect accidental corruption and
casual edits on import; they cannot make a local save tamper-proof.

## Economy and dynasty simulation (20 seasons × 10 strategies × 3 seeds)

`npx tsx tools/sim/economy.ts 20 <out> <all strategies> <seed>` for seeds 1000/2000/3000 (3 processes, ≈ 7,050 s
each on the 4-core host), summarised by `python3 tools/sim/summarize_sweep.py`. Raw data:
`docs/sim/economy-v5-20s-seed{1000,2000,3000}.json`; summary `docs/sim/economy-v5-20s-summary.json`.
Everything runs through the shipped `FederationService` (commands, ledger validation, atomic commits) with
fake-indexeddb. Stated shortcuts: the player's games and the featured engine games are sampled from the Davidson
result model with the strategy's assumed strength and the opponents' hidden strengths (playing ~25,000 engine
games was not feasible); cosmetics are not bought by any strategy.

**Integrity (600 season-runs):** every season of every run conserved the ledger exactly; 0 negative accounts
(other than the mint); **0 markets** whose realised maker loss exceeded its funded subsidy.

**Macro:** circulating money grew a median **0.56 % per season after season 5** (range 0.52–0.61 %; target
< 2 %); the mean competitor rating moved from 1835 to 1837 over 20 seasons (range of finals 1833–1843: no
inflation or deflation); correlation of public rating with hidden strength 0.98; Gini of competitor career
earnings 0.72. Growing balances here are money supply, not price inflation — prices of assets and fees are fixed.

| Strategy | Final net worth, median [range] (start 1,000 ₵) | Lowest cash | Fell below the 100 ₵ recovery line / later back above 200 ₵ | Final division | Event titles (3 seeds) |
|---|---|---|---|---|---|
| successful (2100 strength) | 4,882 [4,850, 5,304] | 1,025 | 0 / 0 | 3, 4, 3 | 17 |
| aggressive trader | 2,866 [1,776, 3,467] | 842 | 0 / 0 | 7, 7, 8 | 2 |
| hybrid | 2,492 [2,432, 2,879] | 675 | 0 / 0 | 5, 5, 6 | 10 |
| conservative trader | 2,182 [2,132, 2,720] | 998 | 0 / 0 | 7, 7, 7 | 3 |
| market specialist | 2,110 [1,533, 2,740] | 681 | 0 / 0 | 7, 8, 7 | 5 |
| chess only (1600) | 2,038 [1,655, 2,399] | 1,000 | 0 / 0 | 6, 6, 5 | 6 |
| business owner | 584 [4, 658] | 0 | 3 / 3 | 6, 6, 6 | 6 |
| business magnate | 568 [405, 676] | 1 | 3 / 3 | 6, 7, 6 | 3 |
| losing player (800) | 550 [550, 550] | 550 | 0 / 0 | 8, 8, 8 | 0 |
| reckless spender | 2 [1, 4] | 1 | 3 / 3 | 8, 8, 8 | 0 |

**Findings (not fixed in this release):**
* Chess strength dominates: the strong player ends with ~2× any trading strategy. Trading is profitable but
  modest; no strategy produced an infinite or guaranteed-profit loop.
* Owning institutions (club, scouting, analyst; or a magnate's club upgrades and contracts) **loses money** in
  this model: both business strategies fell to ~0 cash in every seed and ended around 570–580 ₵. The costs are
  disclosed in the UI and nothing is hidden, but the business/organiser career path is not yet viable as a way to
  get rich — a balance item for the next release (docs/V6_ROADMAP.md).
* Recovery: every strategy that fell below the line climbed back above 200 ₵ at some point (no debt exists), but the
  reckless spender (1000 strength, aggressive trading, all assets) ends near zero in all seeds: the recovery voucher
  keeps it playing, it does not make a weak, over-spending player solvent.
