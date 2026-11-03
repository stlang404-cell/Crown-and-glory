# Acceptance and verification contract

Use Vitest/property tests for pure domain logic, deterministic integration fixtures for workers/storage, and Playwright or equivalent for browser UI. Add real-device/manual evidence where emulation is insufficient. Research Python tests support design exploration; they do not replace production tests.

## Rules and engine

- Initial state and all legal moves verified against an independent exact variant oracle, including promotion choice, pins, king adjacency, check evasion and no illegal king capture.
- Golden perft and differential random positions. Metamorphic color/rank symmetry with correct side/pawn orientation. Every engine PV replays legally.
- Exact mate/stalemate/bare-kings/repetition/no-progress/Crown-timeout adjudication and precedence, with declared differences from orthodox automatic dead-position rules. Do not pass with an unresolved edge rule.
- Search obeys time/node limits, exposes achieved depth, returns a legal fallback after cancellation/timeout and preserves mate distance/perspective across TT reuse.
- Fixed tactical corpus and paired strength benchmarks; no superhuman or FIDE rating claim from internal matches.

## Games, ratings and lifetime history

- Complete at least one eligible rated game, one draw, one assisted game, one resignation, one resumed game and a promotion game. Only eligible results update the proper pool.
- Atomically persist game/result/rating/report intent; crash/retry produces exactly one update. Replaying rating ledger reproduces before/after values with documented tolerance.
- Glicko-2 published reference, inactivity, volatility bounds, opponent uncertainty and multi-result period snapshots tested. Rank promotions/relegations preserve dated provenance.
- Save/load/export/import round trips preserve every move/clock/opponent/competition/result/version. Search all old games after pagination and migration; no silent deletion.
-10,000-game archive performance tests and100-game analytics fixture include absent phases, provisional ratings, different engines/methodologies and assisted games.

## Analysis and skill measurement

- Ply0 initial, selecting ply n displays exact after-state and analysis for move n; before-state n−1 available. Variations branch at stated origin and return without mutating mainline.
- All eight labels have justified examples and boundary tests; single-legal moves never receive Great/Brilliant solely for uniqueness. Unsound sacrifice fixture must not be Brilliant.
- Mate score, drawn state, uncertain score, partial analysis, empty denominator, accuracy[0,100], phase splits, critical opportunities, best frequency and cp/mate loss metrics verified.
- Engine/settings/method change yields a new report; originals remain viewable. Cache key tests include repetition history, settings, resources, variant and engine hashes.
- Cancel analysis while running, during finalization and after newer request; stale messages cannot commit. UI stays interactive; errors visible and retryable.
- Coach observations link stored games/plies/opportunities, not templates pretending to be personalized. Training/held-out family leakage tests. Assessment uncertainty and multiple-comparison/learning-claim rules reviewed.

## World, market and economy

- Seeded tick/schedule replay including crash recovery, odd entrant counts, ties, byes, repeat-avoidance failure, retirements and promotions. One match per participant per round; no invented replay for abstract outcomes.
- p sums to1, bounded cost, log-sum-exp at extreme inventories, complete-set identity, slippage, ownership/short restrictions, rounding, zero/huge orders and stale quotes.
- Round-trip trade loses only disclosed fees absent information; prohibited external recenter regression. Correlated portfolio bounds prevent shared reserve double spend.
- Every journal balances; no negative required cash, shares or reserve; buy/sell/resolve/settle/void/retry idempotency. Fixed cancellation payout vector and rounding verified; no retroactive trade reversal or claimed purchase-price refund. Winner payout drawn from funded accounts.
- Market closure precedes terminal information orders; own-event/conflict changes rejected; NPCs cannot read future outcome state. Local tampering limits disclosed, not falsely certified secure.
- Economy long-career strategy grid tracks wealth distribution, issuance/sinks, reserve failures, recovery and dominance.100/120-season toy experiments are insufficient integrated acceptance.

## Interface and packaging

Actual Windows and iPhone Safari/PWA: create/resume/finish/analyze/export/import in airplane mode after install; verify all fonts/art/engine assets local. Suspend/resume clocks fairly. Worker termination and memory pressure recover. Service worker upgrade preserves games and history. Quota failure never silently truncates history. Persistent-storage denial explained with backup path.

At narrow phone width and200% text zoom: touch/keyboard board, promotion, replay, graph/move selection, cancel and Library filters usable. Test reduced motion, color-independent grades, contrast and screen-reader alternatives. Record screenshots/interaction evidence and hardware/OS/browser versions. Emulated viewport alone is not actual iPhone verification.

## End-to-end release scenario

A player finishes a rated6×6 match, reopens the complete report, inspects every move with justified classifications and preferred continuations, understands the rating change and compares historical performance. After100 stored games they can examine supported skill trends/weaknesses and training priorities with sample warnings. They may then follow a tournament, forecast/trade a permitted NPC event, settle it correctly, fund an institution and recover from losses while preserving their chess career. All displayed statistics must trace to actual stored/computed data. No placeholder value can satisfy an acceptance assertion.
