# M3 implementation plan — the living federation

Binding spec: docs/research/08_AI_COMPETITORS_AND_LEAGUES.md, 12 (architecture), 14 (audit), 16
(acceptance). M3 starts only after the M2 gates listed as open in IMPLEMENTATION_STATUS are closed or
explicitly carried. No fake interfaces: nothing ships in the UI until it is backed by stored, replayable data.

## Contracts already stable in M2 (do not break)

- `GameRecord` (schema 1) — full legal move histories, opponent snapshot with engine profile and
  `calibrationId`; `context.tournamentId` reserved for events.
- `RatingEvent` / `PoolState` (`crown-rating-policy-1`) — anchors never drift; a new rating policy creates
  a new pool version, never rewrites history.
- `AnalysisReport` (immutable, versioned ids) and the Lab's methodology separation.
- IndexedDB migrations are additive (`MIGRATIONS` in src/storage/db.ts); backups `crown-backup-1`.
- Engine levels `crown-levels-2` with measured ratings (`src/engine/calibration.json`).

## 1. Data model (schema v3 migration, additive)

| Store | Key | Purpose |
| --- | --- | --- |
| `competitors` | id | 2,048 identities: name, portrait seed, region/division/circuit, home club, strength profile (engine level + node budget + latent strength), public rating per pool, career arc parameters, retired flag |
| `competitions` | id | league seasons, Swiss, round robin, knockout, championship; rules snapshot, schedule seed, tiebreak policy, status |
| `fixtures` | id | round, pairing, colours, tier (1 played / 2 watched / 3 abstract), result, `gameId` (tiers 1–2) or `abstractResult` (tier 3, labelled summary-only) |
| `worldTicks` | tick | staged commit markers (doc 12): provisional records invisible until the marker is published |
| `rankEvents` | id | promotions/relegations/titles with policy id and evidence |
| `rivalries` | pair id | derived from repeated consequential games (never invented) |

PRNG: one versioned mulberry32 stream per subsystem (schedule, abstract results, career arcs); state saved
in the tick record; never UI-timing dependent.

## 2. Simulation tiers

- Tier 1: the player's games and requested marquee games — real engine games, full records, analysable.
- Tier 2: watched games — real engine searches at bounded node budgets in the existing worker queue,
  serialized behind foreground play, full records.
- Tier 3: unobserved games — W/D/L sampled from the calibrated level ratings (Bradley–Terry with a draw
  model fitted on the calibration corpus); stored with `abstract-result`, no moves, no accuracy. A fixture
  promoted to Tier 1/2 before it starts is played for real; a finished abstract result can never gain a
  replay.

## 3. Competitions

Order: (a) 16-player circuits, round robin by the circle method (15 rounds, colour balance, home/away
reversal); (b) promotion/relegation top/bottom 2 between adjacent divisions within a region; (c) regional
Swiss with a documented pairing solver (repeat avoidance, colour balance; not advertised as FIDE Dutch);
(d) championship: 8 regional-champion seats + 8 Swiss seats, 4 groups of 4, 8-player knockout with two-game
mini-matches, rapid then blitz pairs, then the public seed rule; joint title in the final per doc 08.
Tie-breaks published before play: points, head-to-head, Sonneborn–Berger, playoff, seed.

## 4. World advance

`Continue round` preview → validate schedule → lock → resolve fixtures (player fixtures require Play /
Withdraw / Cancel) → ratings → standings/titles → commit marker. Idempotent stage cursor; crash recovery
resumes or discards unpublished stages. Training and analysis never advance time.

## 5. Personalities (measured, not named)

Style candidates (tactical, positional, defensive, pawn-racer) as evaluation-weight profiles at equal
strength. Ship a style label only if an equal-strength behaviour test passes: on a 500-position suite the
style's chosen-move distribution differs from the baseline (e.g. chi-square on move features, p < 0.01)
while paired match strength stays within ±50 Elo. Research experiment D was negative; failures stay
unlabeled.

## 6. Spectating

Live board for Tier 1/2 games with clocks and the existing analysis panel; post-game report identical to
player games. Abstract results display as summary cards labelled "summary only — not played move by move".

## 7. Acceptance tests (doc 16)

Seeded multi-season run reproduces schedules/results bit-for-bit; one fixture per competitor per round;
odd entrant counts and byes; ties resolved by published rules; no duplicate settlement sources; promoted
fixtures produce legal full records; crash in every tick stage recovers; 2,048 identities × 3 seasons
advance within a measured budget in the browser worker (target: < 2 s per round on desktop, measured).

## 8. Exchange hooks for M4 (contract only)

Each fixture exposes an immutable `outcomeSource` (game id or abstract-result id) and a `closesAt` tick so
the M4 funded LMSR can lock markets before results exist. Player-influenced events carry
`influencedByPlayer = true`; the official exchange will reject them, the Sandbox Exchange may list them with
sandbox-only balances that never enter official wealth, records or achievements.

## Estimated order of work

1. Schema v3 + seeded identity generation + persistence tests.
2. Round-robin circuits with Tier 3 results + standings + promotion/relegation (seeded replay tests).
3. Tier 1 player fixtures inside leagues (reuse MatchScreen with `context.tournamentId`).
4. Tier 2 watched games + spectator view.
5. Swiss + championship formats.
6. Rivalries, rank/title histories, Passport integration.
7. Style experiments (ship only passing styles).
