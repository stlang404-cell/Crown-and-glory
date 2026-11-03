# Reproducible simulation results

All results below are [E], under the stated synthetic/prototype assumptions. Source code and raw JSON are part of this package. No human-subject study, production engine benchmark or mobile run was performed. Scripts use fixed seeds; wall times are machine-dependent. Confidence intervals are approximate and their sampling units are specified.

## A — variant composition and random legal play

80 random-policy games per variant, maximum160 executed plies. The `plies` field counts actually applied moves; an earlier zero-based indexing bug was found during review, corrected and the experiment rerun. Capped games are censored, not draws.

| Variant | Mean applied plies (95% normal CI) | Sampled mean legal moves | Mate/stalemate/cap counts | Initial perft1/2/3 |
| --- | --- | --- | --- | --- |
| LA | 129.96 (120.63, 139.29) | 13.55 | {'cap': 49, 'mate': 23, 'stalemate': 7, 'repetition/50': 1} | [10, 100, 1212] |
| B | 138.12 (128.69, 147.56) | 13.17 | {'repetition/50': 3, 'cap': 59, 'mate': 16, 'stalemate': 2} | [6, 36, 344] |

No competitive balance, draw rate or practical human duration follows. Random legal choices are not realistic chess; the high cap rate is a negative result for using this experiment as a balance test. `A_games.json` stores per-game outcome/reason records.

## B — search experiments

Five fixed boards, three engine configurations, depths2/3,30 observations. Same Python rules/evaluation except specified quiescence. Timings are single hosted-Linux samples, not stable throughput estimates.

| Engine | Depth3 nodes total | Depth3 seconds total | Depth3 NPS pooled |
| --- | --- | --- | --- |
| ab | 1697 | 0.2708 | 6268 |
| ab_tt | 1697 | 0.2648 | 6408 |
| ab_q | 3364 | 0.5774 | 5826 |

TT had no node savings at these depths; this does not refute deeper TTs. Quiescence alters leaf semantics and work, so depth alone is not comparable strength. Additional paired matches: depth2 vs depth1,6 opening pairs/12 games, resolved 12; deeper score 0.7083; pair-bootstrap95% interval [0.5833333333333334, 0.8333333333333334]. Very small shared-engine samples do not establish a general strength gain. No human rating conversion is supported.

## C — Glicko-2

Reference update: [1464.0506705393013, 151.51652412385727, 0.059995984286488495]. Twelve independent seeds,120 players,40 periods,300 matches/period =144,000 matches. Estimated final RMSE across-run95% normal interval [36.121902797074824, 45.82638009689653]; population mean drift interval [-13.718630300164225, 12.535943294701546]. Units are internal rating points. Stationary logistic outcomes, no draws, no entrants/retirements, no learning. Absolute rating scale remains unanchored.

## D — opponent styles

Five boards, material/center/pawn-runner profiles, depth2: 0/5 boards with differing selected moves. **Failure to demonstrate diversity.** A single position family and tiny suite cannot distinguish genuine equivalence from low test power. No claim that personalities work.

## E — forecast calibration

Both predictors evaluated on the same10,000 synthetic independent logistic outcomes; the second predictor exaggerates log-odds. These are binary artificial matches, not chess W/D/L.

- Scale 1: Brier 0.17959, log loss 0.53507. Bin counts/observed frequencies/Wilson intervals are in E_calibration.json.
- Scale 1.7: Brier 0.18659, log loss 0.57200. Bin counts/observed frequencies/Wilson intervals are in E_calibration.json.

## F — LMSR math and exposure

Nine n/b configurations: n=2/3/16; b=10/100/1000;2,000 signed inventory trades each,18,000 total. Check price normalization, complete-set cost, telescoping cash and worst-case maker loss against b ln n with uniform initial inventory. The stress generator permits negative inventory; production retail holdings will disallow naked shorts. These are pathwise math checks, not a complete strategic portfolio simulator.

Maximum observed price-sum error: 2.22e-16. Maximum observed telescoping cash error: 2.27e-13. All tested paths respected the uniform bound. Floating-point tolerances do not certify fixed-point production accounting.

An adversarial external-recenter round trip paid6.201145 and later received9.999220, gross gain3.798075 [data/adversarial_market_reset.json]. The correction is structural: fixed b, no external q resets, information-based trades only. Paired ledgers verify conservation in the small follow-up test; whole-portfolio collateral, voids and conflict handling remain production gates.

## G/H — career economy and affordability

Five policies×100 seeds×120 seasons =60,000 synthetic player-seasons. Trading is a clipped Gaussian transfer, not an LMSR strategy model. Grants/prizes are stylized; the intentionally naive rescue subsidy is unbounded. Results demonstrate cash accumulation and subsidy risk, not a balanced economy.

| Policy | Final mean cash | Mean95% normal CI | Median season to1000 | Rescue count |
| --- | --- | --- | --- | --- |
| chess | 16936.21 | [16698.38469803794, 17174.043153987564] | 6.0 | 0 |
| conservative | 9193.60 | [9053.539337280803, 9333.660258176293] | 11.0 | 0 |
| aggressive | 9332.54 | [8949.025697062338, 9716.051435101279] | 11.0 | 65 |
| hybrid | 12788.70 | [12561.744953114292, 13015.649804825014] | 8.0 | 1 |
| struggling | 5651.23 | [5539.993559684054, 5762.470613926808] | 18.0 | 0 |

H measures cash affordability only. Skill/rank/title pacing is unverified. A follow-up funded-transfer model runs20 seeds per tax/ upkeep rate,100 players,120 seasons, across3 rates:720,000 player-season iterations. It checks money conservation and nonnegative accounts, not real club economics.

Maximum absolute funded-model total-money error: 1.75e-09. No integrated market/economy dominance result is claimed.

## I — improvement vs noise

For n=10/30/100 decisions per window,1,000 replications per scenario,12,000 total trials. Four synthetic scenarios: unchanged ability(.60), genuine improvement(.60→.75), easier opponents, memorized items. In the latter two, training/game observations improve artificially; independent held-out matched assessments remain.60 by construction. One positive z>1.96 is flagged; independent Bernoulli assumptions and pooled normal approximation limit interpretation.

| n/window | Scenario | Raw positive fraction | Held-out significance fraction | Wilson95% interval |
| --- | --- | --- | --- | --- |
| 10 | null | 0.439 | 0.022 | [0.014572598673771597, 0.03308591637481774] |
| 10 | improve | 0.684 | 0.104 | [0.08657073457775956, 0.12446016910266174] |
| 10 | easy_opponents | 0.684 | 0.022 | [0.014572598673771597, 0.03308591637481774] |
| 10 | memorized | 0.684 | 0.022 | [0.014572598673771597, 0.03308591637481774] |
| 30 | null | 0.464 | 0.028 | [0.019442147463132154, 0.040170444802420505] |
| 30 | improve | 0.866 | 0.237 | [0.21168091851549473, 0.26433203014094675] |
| 30 | easy_opponents | 0.866 | 0.028 | [0.019442147463132154, 0.040170444802420505] |
| 30 | memorized | 0.866 | 0.028 | [0.019442147463132154, 0.040170444802420505] |
| 100 | null | 0.468 | 0.032 | [0.02275696612786701, 0.04482501094899452] |
| 100 | improve | 0.983 | 0.628 | [0.5976058983153016, 0.6574144156465824] |
| 100 | easy_opponents | 0.983 | 0.032 | [0.02275696612786701, 0.04482501094899452] |
| 100 | memorized | 0.983 | 0.032 | [0.02275696612786701, 0.04482501094899452] |

The experiment shows a synthetic confounding mechanism, not real construct validity or a guarantee that100 chess games suffice. Repeated looks, multiple skills and correlated positions require correction/hierarchical modeling.

## J — performance and world arithmetic

Host details are in J_environment.json. Python prototype only. A deterministic schedule with2,048 identities,15 rounds×3 seasons,46,080 abstract matches took 0.513s on this host. This excludes UI, storage, market settlement, full engine searches, promotions and entrant dynamics. Circle schedule uniqueness was asserted per16-player group. No browser/iPhone/WASM measurement was completed; estimated budgets in documents05/12 are targets.

## Reproduction and gaps

Run experiments.py, validation.py and extended_experiments.py. Validation assertions include pin/promotion/forced-reply/mate/stalemate/tactic legality;20 full JSON replay round trips; Glicko reference/inactivity/draw; bounded experimental accuracy; numerical market checks and the recenter exploit. Passing these research checks does not pass the future game's acceptance suite. Missing: production cancellation/save migration/mobile UI tests, exhaustive/competition-policy rules validation, representative exceptional-move corpus, real calibrated accuracy, evolving-population rating study, integrated market/economy model and human playtesting.

## Review follow-up: funded retail ledger

`data/funded_ledger.json` / `scripts/funded_ledger.py`:50 funded three-outcome markets,25,000 attempted random orders (some intentionally rejected for funds/fee limits),8 retail wallets per market. Decimal quotes at40-digit precision, integer microcrown cash,1% fee, directed rounding. Half the markets settle to a winning outcome; half use the declared uniform cancellation payout. Every accepted transfer and settlement conserved integer cash exactly, no account/required reserve became negative, and duplicate settlement applied once. This tests a single-market reference model, not the future service or correlated portfolio reserve proof. Calibration E now uses the same generated outcomes for both predictors. Experiment streams are independently seeded by named experiment group to avoid unrelated output coupling.

## Final differential rules result [E]

`data/oracle_validation.json` / `scripts/oracle_validation.py`: **10,000 positions across75 seeded games**, zero legal-move-set or applied board/side/halfmove mismatches against pyffish0.0.90 (`Fairy-Stockfish 230826 LB by Fabian Fichter`). Initial perft depths1–4 agreed at[10, 100, 1212, 14332]. Hosted run elapsed120.385s; this is validation throughput, not search NPS. The binding binary hash is recorded in JSON. This validates sampled Los Alamos move generation; it does not validate Crown-specific draw/timeout adjudication, search strength, browser builds or every legal state.
