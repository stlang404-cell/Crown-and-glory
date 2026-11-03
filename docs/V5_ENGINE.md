# v0.5 engine architecture and benchmark report

## One foundation (crown-intel-1)

`src/engine/canonical.ts` defines the only active chess-intelligence configuration:
**crown-search-2 + crown-eval-4** (TypeScript backend `crown-ts`, rules `crown-la6-v1@1.0.0`).

| System | Code path | Budget |
|---|---|---|
| Rated/casual play L1–L8 | `chooseMove` (`src/engine/levels.ts`) with `PLAY_FEATURES`/`PLAY_WEIGHTS` | per-level nodes/time; L1–L4 bounded selection |
| **Sovereign Max (L9)** | same, `maxProfile(budget)`, dedicated 2^20 table in the play worker | 5 / 10 / 20 / 40 s per move (rated: 10 s); best move only |
| Federation, sparring, spectator, in-play games | `chooseMove` / `playSelfplay` with competitor profiles | node budgets |
| Move assistant, candidate moves, threat check | worker `assist` → `scoreRootMoves(…, CANON_OPTS)` | chosen depth |
| Post-game analysis and grading | `analyzeGame(…, 'canonical')` → `CANON_OPTS` | presets depth 5 / 7 / 9 |
| Puzzle verification, Academy | `verifyPuzzle` (crown-puzzle-verify-2) → `CANON_OPTS` | depth 8 / 7 |
| Lab | reads reports; one methodology per view | — |

Verified by execution, not labels: `tests/engine.canonical.test.ts` checks that canonical and legacy searches of
the same position differ (different engines), that a fresh analysis report carries the canonical build and
grading v2, and that the analyser's best move matches a direct canonical search. The only remaining use of
crown-search-1 + crown-eval-3 is `analyzeGame(…, 'legacy-v1')`, used by the regression test that keeps
historical reports reproducible; no UI path can produce a new legacy report.

## Provenance (crown-provenance-1)

Every move and assist result from a worker carries: rules fingerprint, backend, build, intelligence id, enabled
search features, purpose (play / max / federation / spectator / assist / analysis / puzzle / sparring), budget
(depth, nodes, time, table size), worker generation, depth reached, nodes, elapsed time, principal variation,
score with point of view, stop reason and events (e.g. bounded selection). Games store the opponent's exact
engine configuration (`engine.config`) and, per engine move, depth/nodes/time/selection/seed plus score, stop
reason and build. Analysis reports store engine build, grading and accuracy ids, settings and coverage.

## Scheduling and cancellation

One worker per role (play, analysis, assist, spectator), so a long analysis never delays the opponent's move.
Foreground play has priority: when a match starts, running background analysis is cancelled by terminating its
worker and the job is re-queued (`AppServices.setMatchActive`); it resumes after the match. Every request has a
generation; replies from older generations are discarded and logged as `stale-discarded`. A cancelled job never
commits (its promise rejects before any write). All starts, completions, cancellations (with termination
latency), errors and crashes go to a bounded engine event log shown under Settings → Chess intelligence.
No engine work runs inside an IndexedDB transaction (searches complete first; commits are single transactions).

## Engine commitments during financially consequential events

The build used for federation, spectator and in-play games is recorded in `world.engineCommitments` with the
season and round from which it applies. A build can change only with an app update; the change is appended (never
silent) and shown in Settings. Every game keeps the build that produced it; recorded results are never
regenerated; both sides of every later game use the same build; market prices use public ratings and published
evaluations only, so a build change creates no information advantage. A live game in progress at the moment of
an update finishes on the new build, and the record notes how many were in progress.

## Strength: Sovereign Max vs the previous maximum (release gate)

`RESULT_TAG=v5max THREADS=3 npx tsx tools/bench/run.ts match '{"kind":"level","level":9,"timeCapMs":3333}' '{"kind":"level","level":8,"timeCapMs":2000}' 32`
→ `tools/bench/results/match-crown-L9-vs-crown-L8-v5max.json` (per-game records included).

| | Result |
|---|---|
| Games | 64 = 32 colour-swapped pairs over the deterministic 2-ply openings 1–32 |
| Sovereign Max (L9) vs Crown (L8) | **+28 =28 −8**, score **65.6% [58.6, 71.9]**, **+112 Elo [60, 163]** (internal logistic scale, 95% bootstrap over opening pairs) |
| Depth / nodes per move | L9 14.7 / 637k · L8 13.6 / 395k |
| Terminations | 36 checkmates, 21 threefold, 4 fifty-move, 3 bare kings; 0 illegal moves, 0 capped games |
| Host | Intel Xeon @ 2.80 GHz, 4 cores, Node 22, three games in parallel |

Budgets were scaled to 1/3 of the shipped ones with the same ratio (L9 3.33 s + 2^20 table vs L8 2 s + 2^18 table,
i.e. 10 s vs 6 s in the game), because full-length time-limited games would have taken many hours. The
calibration of L8 was also measured with a 2 s cap, so the two are comparable. L9 is entered in
`src/engine/calibration.json` as **3038 ± 171**, derived as L8's rating plus this difference (it inherits L8's
uncertainty). The gain comes from more thinking time and a larger table, not from a new evaluation or search
algorithm; nothing about the engine itself got stronger per node in v0.5. Time-based results depend on the host
and its load; a phone will reach lower depth at the same budget. **Not claimed:** any FIDE, grandmaster or
superhuman level — these are internal engine-vs-engine numbers without human games.

## Search correctness audit

Reviewed in `src/engine/search.ts`: mate-distance pruning, TT mate-score normalisation (`scoreToTT`/`scoreFromTT`,
16-bit range checked: MATE 30000 + 96 plies < 32767), repetition within search (two-fold since the last
irreversible move, including game history), 100-half-move draw with checkmate precedence, null-move guards
(no null move in check, after a null move, or with pawns only), futility/forward-futility bookkeeping (pruned
moves still count as legal, so no false stalemates), aspiration re-search widening to a full window, partial
iterations discarded on timeout (the last completed iteration's move is played), legality defence in depth in the
worker. No correctness defect was found. New regression tests (`tests/engine.canonical.test.ts`, 13 tests):
mate in one with exact distance; forced two-rook mate with odd distance and identical score from a reused table;
negative mate score for the losing side; hanging queen; promotion; checkmate/stalemate terminal scores; stalemate
avoidance when winning; legal best move and PV on 200 independent oracle positions; Sovereign Max determinism
across seeds; recorded configuration.

## Fairy-Stockfish

Unchanged from v0.4 (docs/M4_ENGINE_STRENGTH.md §7): the WASM build matches the rules (perft 1–5) and is much
stronger per node, but it is GPL-3.0 (the repository is unlicensed — an owner decision), needs pthreads with
cross-origin isolation that neither `file://` nor the PowerShell server provides, and reserves 128 MiB. It stays a
development-only reference opponent and is never bundled. No new Fairy-Stockfish measurements were made.
