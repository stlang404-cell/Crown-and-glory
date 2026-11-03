# Production architecture

Stack [D]: TypeScript, Vite, React, Web Workers, IndexedDB via an audited wrapper, service worker offline PWA. No Godot, account, cloud backend, remote AI inference or paid API. Windows release may use a thin Tauri2 launcher with bundled assets and an engine-compatible local protocol; browser/PWA remains primary. Test protocol origin persistence and worker/WASM loading before committing to wrapper packaging. iPhone delivery is Safari + Add to Home Screen, not an implied native App Store binary.

## Modules

```text
app/ui -> application commands/selectors -> domain modules
  rules       pure position/move legality and notation
  engine      worker protocol, variant adapter, search scheduling
  games       match state, clocks, finalization, replay
  ratings     Glicko-2 pools, events, ranks
  analysis    jobs, cache, report versions, grading/calibration
  academy     motifs, items, attempts, held-out assessments, coach
  federation  identity, ticks, scheduling, standings, careers
  exchange    contracts, quotes, orders, reserves, settlement
  ledger      balanced journals, wallets, escrow, rounding
  storage     IndexedDB transactions, migrations, export, recovery
```

Pure domain functions avoid React dependencies. UI never directly mutates wallets or rating history. Each user command validates preconditions, executes one transactional domain operation, emits immutable events, updates indexed read models and returns typed results. Heavy search/simulation is worker-owned; main thread owns user interaction. One prioritized engine queue: foreground move > requested replay > visible report > batch analysis. Background analysis yields or pauses when playing.

## Core schemas

Every record has id, schemaVersion and UTC timestamp where appropriate. Integer simulated tick is separate from wall time.

- `VariantDefinition`: ID/rulesVersion, board/pieces/startState, legal policies, draw/clock adjudication, notation version, hash.
- `Game`: identity, participant snapshots/style/difficulty, initialState, variant hash, start/end/time control, competition IDs/context, assistance events, result/reason, duration, completion state, engine provenance, finalization key.
- `Move`: gameId, ply, from/to/promotion, preHash/postHash, complete postState or reproducible checkpoint reference, clockBefore/After/elapsed, pause events. Key(gameId,ply), ply0 is initial state.
- `RatingEvent`: pool/model/policy, period, result source IDs, participant inputs, before/after r/RD/sigma, rank references, idempotency key.
- `Report`: gameChecksum, engine binary/eval hash, settings, method/calibration/phase versions, per-ply typed scores/PVs/labels/evidence, aggregate coverage, immutable completion timestamp.
- `AnalysisJob`: request ID, game, settings, cancellation generation, status/progress/error, selected report ID.
- `PositionCache`: canonical full state/history hash, variant/engine/settings/context hash, evidence/result, verified provenance.
- `AssessmentItem/Attempt`: family/split, solution proof, motif/difficulty parameters/version, user response/clock, assistance/exposure, scoring evidence.
- `Competitor/Competition/WorldEvent`: stable identities, schedule/seed/rules snapshots, mutable current read models, immutable history.
- `Market`: exhaustive outcomes/contract semantics, b/q0/q, exact numeric policy, state/times, reserve allocation, conflict rules, outcome source and settlement key.
- `Order/Trade`: quote revision, actor, deltas, holdings, cost/fee/rounding, ledger refs, tick; reject stale quote or re-confirm max-spend constraints.
- `Journal/Entry`: unique command/source, version, balanced debit/credit amounts in integer microcrowns, account refs, before/after invariant hashes.
- `SaveManifest`: app/schema/rules versions, snapshot checksum, event cursor, RNG states, engine/report compatibility, export metadata.

Store completed games and reports permanently unless explicitly deleted by the player. Index game date/opponent/event/time-control/result/bookmarks; aggregate read models can be rebuilt. Keep raw evidence, not only chart points. Multi-tab single-writer lease with fencing token; stale writers fail. `navigator.locks` where available plus transactional lease fallback. Broadcast read-model changes; never allow two tabs to settle twice.

## Interfaces (contract sketches)

```ts
type EngineScore = {kind:'cp'; value:number; pov:'white'|'black'}
 | {kind:'mate'; plies:number; pov:'white'|'black'; proven:boolean}
 | {kind:'terminal'; outcome:'win'|'draw'|'loss'; pov:'white'|'black'};
interface SearchRequest {
 requestId:string; generation:number; variantHash:string; fullState:unknown;
 limits:{depth?:number; nodes?:number; timeMs?:number}; multiPv:number;
 engineHash:string; settingsHash:string;
}
// Worker outputs: progress | result | cancelled | error; all echo requestId/generation.
// Result includes achieved depth, nodes, score bound, legal PV, timing and provenance.
// Commands: startSearch, stopSearch, analyzeGame, cancelAnalysis, advanceWorldTick.
```

Unknown in this sketch must become versioned validated state types before implementation; never use unvalidated JSON at a trust boundary. Engine adapter tests enforce exact move/score orientation. Keep a rules-only import/export validator independent from rendered board state.

## State machines and crash safety

Match created→active↔paused→terminal→finalized; only finalized games schedule persistent reports. Analysis queued→running→complete/partial/cancelled/failed. Job cancellation uses a monotonic generation; discarded late replies cannot commit. Stop command plus worker termination timeout guarantees UI recovery, though no current benchmark proves a250ms target.

Game finalization, rating ledger and analysis-intent enqueue commit atomically in IndexedDB. A job worker may run later. World tick uses staged idempotent event commits and cursor recovery. Settlement posts one balanced journal under a unique key. Every interrupted operation either rolls back or resumes without duplicate effects. Export requests a consistent snapshot at a known event cursor.

## Saves, offline and packaging

IndexedDB transactions, checksummed journal and periodic compacted snapshots; compaction never discards player games/reports. Use schema migrations with fixture coverage, validate then migrate a copy, retain rollback backup until success. No silent incompatible import. Export a portable ZIP/JSON bundle containing documented `crown-la6-v1` records, manifests, games, reports, career and ledger. Import verifies sizes/types/checksums/legal replay and rejects malicious/incompatible inputs with clear errors.

Ask for persistent storage when supported, show quota/backup status, offer manual exports and Windows automatic backup rotation to a chosen local folder. Safari can evict origin data; no offline browser guarantees eternal records. Never claim an internal same-origin snapshot survives origin eviction. No silent deletion when quota is low: pause new heavy analysis, retain core records, offer export/storage management. An optional delete report cache action must distinguish reconstructable cache from historical reports.

Cache app shell and required engine/assets. Test first install requires access, then airplane-mode restart/resume. Service-worker updates stage until matches/transactions are safe; show version, preserve DB, allow rollback assets when possible. Content hashes bind engine reports. Threaded WASM requires compatible isolation headers; Windows protocol/iOS fallback must work single-threaded.

## Budgets and dependencies

[T] App interactive<3s warm local load; main-thread work<50ms; responsive analysis; searchable10,000-game archive with pagination/virtualization. Engine32MiB mobile TT default; avoid storing every background abstract position. Worker memory and archive sizes must be measured with actual report payloads before release.

Potential dependencies: React/Vite MIT, Dexie with license audit, Playwright Apache2, Vitest MIT, a small MIT/Apache chart library or native SVG, Tauri MIT/Apache option, Fairy-Stockfish GPLv3. Only retrieved licenses are audited preliminarily; no dependency lockfile exists. Claude must pin versions, transitive licenses, source offers, artifact hashes and offline font/art licenses. Use no unknown NNUE/model license. No claim this package contains a production build or release package.

## Review resolutions: concurrency, publication and migration

A `stop` message cannot interrupt a worker blocked inside synchronous WASM. Use engine-supported atomic cancellation only where shared memory/isolation is supported, or cooperative bounded yielding. The mandatory single-thread fallback is terminate-and-recreate the worker after the cancellation budget; keep job state, game state and completed reports outside that worker. A terminated incomplete search cannot publish final evidence. Echo request generation and engine epoch; discard messages from older epochs. Resume only from compatible persisted completed chunks.

Never await engine/network/long worker promises inside a live IndexedDB transaction. Compute outside, then open a short transaction, reread expected game/tick revisions and writer-fencing token, validate them, commit records and intents, and retry/rebase if changed. A fence check must occur within the same transaction as each write; BroadcastChannel alone is not a lock.

For staged world ticks, write provisional records under tickID with a parent committed cursor. Readers and downstream market-order commands only see records whose tick has a published commit marker. Publish that marker and current cursor in one short transaction after all stage invariants pass. Prevent competing tick writers with the same fenced lease. Crash recovery resumes or discards unpublished staging; no UI or order can observe a half-settled world. Persist immutable public-info revision and market quote revision to reject orders submitted against superseded state.

Before copy migrations, estimate quota/available headroom and export a recovery backup outside the origin. If full-copy space is unavailable, do not start a destructive migration; offer read-only/export mode or a reviewed incremental reversible migration. Validate a new database before switching the active pointer, keep the prior version until confirmed, and never count an internal duplicate as protection from whole-origin eviction. Old service workers/clients must lose write leases when schema compatibility changes.

Conditional claims use the explicit eight-state bracket model in document09: a claim is a validated bitset/payoff vector over canonical state IDs, and order/holding exposure updates the shared maker state. Larger event markets remain categorical unless a bounded joint state model exists; related deterministic identities cannot be split into independent makers.
