# Crown & Calculation — mandatory chess intelligence expansion

Status: binding product requirements; implementation pending access to the existing project.

This addendum belongs in the Crown & Calculation master directive. It is a core M1/M2 requirement, not future polish. The existing master directive was not present in this workspace, so this document does not claim to replace or fully reproduce it. All existing requirements for the chess engine, AI competitors, tournaments, leagues, prediction markets, spectating, fictional economy, and career progression remain intact. Do not reduce those systems' scope. Advanced economic and dynasty work must wait until the M1/M2 gates below pass.

## Product outcomes

The permanent player history and intelligence platform must answer:

1. How strong am I currently?
2. How well did I actually play each game?
3. What mistakes am I repeatedly making?
4. How has my chess ability changed over time?
5. What should I practice to improve fastest?

Chess performance, accuracy, rating, and skill estimates measure chess-specific performance. Never describe them as general IQ, universal intelligence, or equivalent to FIDE Elo.

## 1. Complete, permanent game records

Record every played match, including unrated and assisted games, with a stable game ID and schema version. Store the exact initial position, immutable variant/rules version, ordered legal moves, and position records sufficient to reproduce every position. Preserve side to move, promotion, repetition, draw counters, and every other rule-relevant state; a board diagram alone is insufficient.

Record opponent identity, rating snapshot, style and difficulty; start/end timestamps and date; time control; tournament and league identifiers/context; result and termination reason; player and opponent rating before/after, deviation, volatility and change; clock usage per move; game duration; opening classification and classifier version where applicable; assistance status and events; and engine version/settings/analysis metadata. Missing information must be explicitly unavailable, never invented. Preserve incomplete or interrupted games with their status.

Atomically finalize the game, rated-result ledger entry, and analysis scheduling intent. Retrying finalization must not duplicate a game or rating update. Persist records durably under the player's identity. No automatic age-based deletion, archive truncation, or browser-only storage presented as permanent history. Support backup, restore, migrations, and save/load round trips. Explicit player deletion/export controls must not silently erase other records.

Every completed game remains searchable and supports replay, analysis, export, and comparison. Preserve original source records when analysis is cancelled, fails, or is superseded.

## 2. Actual-engine move analysis

Use the existing legal 6×6 engine through a versioned analysis adapter. No fabricated engine scores, placeholder analytics, or use of a standard-board engine that does not implement the actual variant. Store scores as typed centipawn, mate-distance, or terminal outcome values with an explicit perspective. Never treat mate scores as ordinary centipawns.

Analyze the position before a move and its resulting position using the same engine version, evaluation settings, configured depth/search policy, and comparable resource limits. Normalize both to the moving player's perspective. Store achieved depth as well as requested depth, nodes, limits, completion state, principal variation, legal candidate alternatives and their scores, uncertainty evidence, and engine provenance. If a requested depth is not reached, disclose that fact.

Expose configurable depth with resource estimates. At each move show classification, best alternative, evaluation before/after, evaluation loss, principal variation, tactical explanation, achieved depth, and confidence when supportable. Validate every returned variation against the variant rules before display. Explanations must point to engine continuations and actual tactical features; unsupported explanations are unavailable.

### Versioned classification contract

Ship a published methodology identifier and immutable parameters with each report. The final numerical thresholds require calibration against this exact 6×6 variant; uncalibrated methods must be marked experimental. Define evaluation loss from the engine's best continuation versus the played continuation at a matched search policy, in both native score and bounded expected-outcome space. Retain the before/after position evaluations separately. Do not compare opposite score perspectives or unmatched searches.

Use the following mutually exclusive labels with a documented precedence order:

| Label | Required evidence |
| --- | --- |
| Brilliant | Near-best play plus a verified nontrivial tactical justification, including the opponent's strongest tested defenses and a sound sacrifice or comparably exceptional tactic. Material loss alone is never sufficient. |
| Great | A uniquely valuable or difficult near-best move supported by a significant gap to alternatives; not merely a forced reply. |
| Best | Engine-preferred move or documented equivalent within score uncertainty. |
| Excellent | Small bounded outcome loss under the versioned thresholds. |
| Good | Acceptable bounded outcome loss under the versioned thresholds. |
| Inaccuracy | Meaningful but limited bounded outcome loss. |
| Mistake | Substantial bounded outcome loss. |
| Blunder | Severe bounded outcome loss or a verified decisive tactical failure. |

Evaluate loss severity first, then eligibility for Best/Great/Brilliant among near-best moves. Specify disjoint numeric intervals and boundary behavior in the shipped methodology. Count legal moves independently: a single legal reply is flagged forced and cannot receive Great or Brilliant solely for uniqueness. Distinguish legal forced moves from tactically necessary moves with multiple legal alternatives. Preserve terminal/no-move positions without inventing a move grade.

Account for already winning/losing positions, available alternatives, mate sequences, complexity, search instability, and score uncertainty. Mate preservation/loss and faster/slower mate require explicit rules. Do not inflate praise for an inevitable loss or assign a severe label solely for a large centipawn swing in a saturated position. If evidence is insufficient, show analysis pending or an uncertain provisional heuristic label. Engine search and tactical classifications are heuristic unless a rules-based exhaustive proof or applicable exact solver establishes the claim; store proof provenance separately.

## 3. Transparent game accuracy

Accuracy is a 0–100 measure of retained engine-estimated position quality over the player's decision opportunities, not intelligence or rating. Publish a versioned bounded expected-outcome transform calibrated to the chosen 6×6 rules, engine and search policy. Calibrate with held-out games and document the dataset, fit, limitations, and validation results. A conventional-board logistic scale must not be silently assumed valid.

For every eligible move, derive nonnegative bounded quality loss from the engine-preferred and played continuations. Aggregate through a published bounded scoring function and explicit weights; do not naively average raw centipawn losses. Document forced-move handling, phase definitions, mate/terminal handling, uncertainty, incomplete analysis, excluded moves, and zero-decision cases. Missing analysis is not perfect accuracy. Return unavailable rather than a misleading zero for an empty denominator. Scores must remain within [0,100].

Display overall, opening, middlegame and endgame accuracy, average evaluation loss with units and mate handling, mistake/blunder counts, best-move frequency and critical-position performance. Show numerator/denominator, report coverage, and methodology. Phase boundaries must follow documented variant-appropriate rules; absent phases are unavailable. Critical positions must be selected by a published position-based criterion, not retrospectively chosen only because the player erred.

## 4. Career rating and ranks

Implement Glicko-2 with documented initial rating/deviation/volatility, tau, rating periods, inactivity behavior, provisional threshold, numerical tolerance and opponent model. AI ratings must come from a justified, versioned competitor calibration, not difficulty labels substituted for measured strength. Define eligibility and separate assisted/unrated results. Record sufficient inputs to reproduce every update and explain expected outcome, actual result, uncertainty, and resulting change. Never claim equivalence to FIDE Elo.

Keep an immutable rating-event history with before/after rating, deviation and volatility, policy version and source games; protect against duplicate application. Preserve rank events, promotion/relegation dates and policy versions. Explain corrections through explicit superseding events, never silent history rewrites.

Show a rating graph, peak, lowest established rating, deviation, volatility, provisional status, rank history, personal records, recent trends, performance by time control and opponent-strength band. Provide last 10/30/100 games, all time, date range, opponent, tournament and time-control filters. Define established eligibility and chronological ordering. Keep rating pools and variants distinct; comparisons must disclose pool changes.

## 5. Chess intelligence profile

Create a separate skill-development dashboard for tactical vision, calculation, positional judgment, endgame technique, defensive awareness, opening understanding, time management, consistency, threat detection and adaptability.

Every score must reference actual eligible decisions or assessments, a versioned rubric, opportunity counts, sample window and uncertainty. Do not infer all ten skills from a single overall accuracy number. Distinguish observed game evidence from held-out assessment evidence. Avoid test leakage by excluding trained/replayed positions from held-out scoring. Unsupported skills show insufficient evidence. Show trends, confidence levels and limits; these are chess-specific measurements, not general IQ.

## 6. Chess Library

Provide a permanent Chess Library with opponent, result, date, accuracy, rating change, opening, game length, mistake count, blunder count, tournament, Replay and Analyze actions. Support stable sorting, combined filters, search, pagination across the entire archive, and bookmarked games and exact positions. Missing analysis is visibly pending/unavailable.

Export portable, documented records with a stable 6×6 variant identifier and rules version, initial position, full move sequence, clock/context metadata and report references. Define move notation, coordinate orientation, promotion and special rules. Do not label incompatible records as ordinary standard-chess PGN. Include a lossless versioned format and import validation; test reconstruction with an independent decoder. The exact variant identifier must be assigned from the existing engine rules, not guessed from board size alone.

## 7. Postgame experience

Offer a report after every completed game, with visible queued/running/partial/completed/failed/cancelled states. Include game summary, both players' accuracy, classification timeline, evaluation graph, critical turning points, biggest missed opportunity, worst mistake, best tactical sequence, opening/endgame assessments and recommended training. If evidence or a phase is absent, say so.

Use an interactive move-by-move board. Position index 0 is the initial state; ply n displays the exact state after move n, with analysis explicitly identifying before/after perspectives. Selecting a move updates board, clock, score, explanation and variations consistently. Support stepping, keyboard/touch navigation, variation exploration and return to the main line. Replay a mistake against the engine from the original pre-move state, including side to move and all rules state. Training retries must not mutate the original game or count as new rated results.

## 8. Improvement analytics

Track rating growth, accuracy, blunder rate, tactics, training effectiveness, results against stronger opponents, time-pressure performance, opening success, endgame conversion and consistency. Compare recent and historical nonoverlapping windows with comparable variant, pool, time control and methodology. Define opportunities and denominators, not just counts. Expose sample sizes, missingness, uncertainty and selection effects. Use predefined evidence thresholds; avoid improvement claims from a handful of games. Reports with incompatible methodologies must be separated or explicitly reanalyzed before combining.

## 9. Evidence-based personalized coach

Use the player's real archived games to detect recurring knight forks, overlooked threats, losing endgame trades, rushed critical decisions, failures to convert wins and other supported patterns. Link each observation to source games, move indices, opportunity counts, dates and analysis versions. Separate tentative signals from established recurring patterns.

Recommend exercises tied to supported weaknesses, record attempts and outcomes, and compare subsequent error rates against prior comparable opportunities. Use held-out assessments when appropriate; do not claim training caused improvement without appropriate evidence. With insufficient history, offer general training clearly labeled as such. Never fabricate personalized observations.

## 10. Asynchronous analysis and persistence

Run engine work outside the interface thread in cancellable workers/jobs with bounded resources, progress, retry and crash recovery. Cancellation must stop computation promptly, preserve the game and prior completed reports, and prevent late worker results from committing into a cancelled job. Partial results must be identifiable and resumable only under compatible settings.

Cache by canonical full position/rules state, variant/rules version, engine binary/evaluator version, all search settings, score perspective and relevant history/context, including repetition/draw state and resource/search policy. Analysis reports additionally include game checksum, report schema, classification/accuracy/calibration versions and phase policy. Board layout alone is not a valid cache key.

Persist completed reports as immutable versions. Changing engine or methodology offers explicit reanalysis and creates a new report; preserve and allow access to historical reports. Never silently overwrite accuracy or move ratings. Make the selected report version and comparison compatibility visible. Store analysis failures and retry status without inserting placeholder numbers.

## 11. Verification and release gates

Use representative legal games derived from the actual engine rules, with known tactical turning points and independently checked expected continuations. Include forced reply, sound/unsound sacrifice, knight fork, missed defense, mate preservation/loss, drawn position, promotion, repetition and applicable special-rule fixtures. No invented fixture is accepted as legal without engine validation.

Required automated checks:

- Full replay and every ply's before/after alignment; legal variations and exact mistake-retry state.
- Glicko-2 reference vectors, draws, stronger/weaker opponents, inactivity, provisional status, numerical stability and idempotent updates.
- Durable rating/rank history, game/report persistence, migration and backup/save/load round trips.
- Forced-move identification, mate-score perspectives, draws, terminal states and uncertainty handling.
- Accuracy boundaries, empty samples, missing phases, saturation and methodology compatibility.
- Immutable historical report versions and complete cache invalidation when relevant context changes.
- Cancellation races, worker failure/retry, duplicate completion, responsiveness during deep searches and recovery after restart.
- All statistics trace to stored or computed evidence; no production placeholder metrics or invented coaching.

Required interactive checks include mobile Library filtering, touch replay, exact move selection, variation navigation, graph readability, cancellation and accessible keyboard/screen-reader navigation. Test a narrow mobile viewport and long histories, not only the empty desktop state.

## Dependency order and milestone allocation

Implement in this order while preserving all original milestone obligations:

1. Inventory and freeze actual variant rules, engine adapter and existing game/rating persistence contracts.
2. Versioned durable game/position/move schemas, migrations, export and replay fixtures.
3. Atomic finalization, rating ledger and reproducible Glicko-2 updates.
4. Asynchronous legal engine analysis, cancellation, cache and immutable report storage.
5. Calibrated quality transform, classification/accuracy methodology and tactical verification.
6. Chess Library and complete interactive postgame reports.
7. Career/rank history, filtered aggregates and long-term comparisons.
8. Evidence-based skill profile, coaching, targeted training and effectiveness tracking.
9. Full integration, representative 100-game histories and mobile verification.

### M1 — permanent game and explainable postgame foundation

Complete steps 1–6, including versioned grading/accuracy, full records, rating explanation, replay, preferred variations, cancellation and persistence. A player must finish a rated 6×6 game, reopen the complete report after restart, inspect every move and its justified classification, explore preferred continuations, understand the rating change and compare with available historical performance. Sparse histories show evidence limits. M1 cannot pass on static screens or mocked engine output.

### M2 — lifetime development platform

Complete steps 7–9 and all requirements in this addendum: full rating/rank history and filters, improvement dashboard, ten-skill evidence profile, personalized coach, bookmarks, training retries, effectiveness tracking, held-out assessment support and preserved report reanalysis. At 100 games, the player can assess credible improvement, progressing skills, persistent weaknesses and supported training priorities, with uncertainty and evidence links. A 100-game test history must exercise aggregation/pagination/version compatibility; it does not by itself establish scientific calibration.

Both milestones are release gates before advanced economic or dynasty features. Existing chess, competitors, tournaments, leagues, markets, spectating, economy and career requirements remain required at their original scope.

## Honest implementation status

Completed here: this mandatory directive addendum, dependency ordering and M1/M2 acceptance contract.

Not completed here: runtime code, database migrations, engine integration, calibrated methodology, UI, coaching, rating implementation, fixtures and executable verification. The workspace contained no existing source code or master directive. This document is a specification artifact, not evidence that any product acceptance criterion passes. Merge it into the actual master directive and implement against the existing engine/project when those sources are available.
