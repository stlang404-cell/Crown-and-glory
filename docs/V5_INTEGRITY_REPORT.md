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

## Economy and dynasty simulation

See the section appended below after the 20-season sweep.
