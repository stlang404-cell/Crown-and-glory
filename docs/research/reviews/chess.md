# Independent review — chess-engine researcher

Reviewed documents 04, 05, 07 and 13, `prototypes/chess6.py`, and `scripts/extended_experiments.py`. This is a separate reasoning review, not external expert certification or independent execution of Fairy-Stockfish.

## Findings requiring correction or an explicit gate

1. **High — competitive rules remain incomplete.** Timeout mate-possibility adjudication and non-bare-king dead positions are explicitly unresolved. The package must not describe its rule chapter as a completely definitive implementation-ready ruleset while asking Claude to invent those decisions. An implementable version can either choose a fully specified Crown timeout policy (distinct from FIDE's possible-mate rule), or require a reviewed variant-safe adjudicator before timed release. A pause for adjudication is acceptable in research but not a deterministic finished local game. Retain this as a blocking M0 gate if not resolved now.

2. **High — the proposed accuracy algorithm has an undefined mate branch.** Document 07 describes heuristic mate evidence but does not give an executable quality map for stable nonterminal mate scores versus ordinary evaluations. Consequently `u(best)-u(played)` is not defined for every legal analysis case. Correction: explicitly return accuracy unavailable for mixed mate/cp cases until a versioned mate-policy is defined, or define and test a separate calibrated WDL mapping with evidence flags. A stable engine mate claim still is not a proof under all defenses.

3. **High — classification uncertainty is not yet a complete algorithm.** Expanding the Best band with `eps_i` and shifting other comparisons “consistently” leaves numeric boundary/precedence choices to the implementer. Near-best eligibility for Great/Brilliant is also not numerically defined. Correction: use v0's exact fixed bins plus an independent uncertainty flag and withhold exceptional labels unless all conditions are explicit; defer adaptive bands to a new fully specified method version. Threshold validity remains a calibration question even after boundaries are deterministic.

4. **High — research draw semantics differ from the proposed game.** The search unconditionally returns a draw at halfmove 100, and match experiments automatically draw on threefold/50-move conditions. Crown describes those as claimable, with automatic fivefold/75-move policies. The prototype also omits repetition-aware search and caps quiescence even while in check. These choices are acceptable as research simplifications but results cannot be called tests of the exact final competitive game. State these differences alongside every strength/variant conclusion; production must use the precise claim/automatic-draw contract.

5. **Medium — empirical engine and variant conclusions are exceptionally weak.** Five engine positions, depths 2/3, one timing sample, six paired openings and random policies do not settle architecture strength, competitive balance or mobile feasibility. The document already says this honestly. Add a frozen, independently checked tactical corpus, repeated timing runs and stronger time-controlled paired matches before selecting production search parameters. Existing source support makes Los Alamos a practical provisional default, not an experimentally superior variant.

6. **Medium — phase rules need a transition contract.** “First queen exchange” is ambiguous about a first queen capture without recapture; promotions can reintroduce a queen after the proposed endgame starts. Specify whether phases are monotonic and exactly which post-ply state triggers each boundary. Until then phase accuracy is not uniquely reproducible.

7. **Medium — perft and replay tests share the same generator.** The fixtures are useful regressions but cannot independently establish move legality; JSON round trips can preserve the same wrong move sequence. The required second implementation/differential gate is appropriate and should remain blocking. Check initial deeper perft and random positions against a pinned compiled variant engine, including promoted positions and attack/pin corner cases.

## Positive decisions

- Does not assume ordinary Stockfish supports 6×6.
- Uses actual retrieved Los Alamos configuration and Q/R/N promotion evidence.
- Separates heuristic search from proof and refuses material-loss-only Brilliant labels.
- Preserves negative style/diversity findings and avoids human/FIDE/superhuman strength claims.
- Separates censored random-play caps from genuine draws and labels hardware targets as unmeasured.
- Requires full history-sensitive cache keys, immutable report versions and legal PV replay.

## Conclusion

A sound exploratory architecture and honest evidence register, but not a validated production engine or fully closed move-grading/rules specification. Resolve findings 1–3 before claiming Claude can implement every fundamental decision without invention. Findings 4–7 remain explicit verification gates. No balance, human skill scale, phone performance or exceptional-move detector is independently verified by this review.
