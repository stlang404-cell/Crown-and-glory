# Save, export and import formats

All data lives in the browser's IndexedDB database `crown-calculation` (schema `crown-save-1`,
IndexedDB version **4** since v0.4.0) on the device. Nothing is sent anywhere.

## Object stores

| Store | Key | Contents |
| --- | --- | --- |
| `games` | `id` | `GameRecord` (src/games/types.ts): variant/rules/adjudication/notation versions, initial FEN, optional setup moves, every move with CCN, SAN, pre/post Zobrist hash, FEN after the move, clocks before/after and elapsed time, engine search metadata for engine moves, assistance and pause events, result, termination, opponent snapshot (engine profile, calibration id), rating event id, report ids, checksum. |
| `ratingEvents` | `id` = `rating:<gameId>:<pool>` | Immutable Glicko-2 events with inputs, expected score, before/after r/RD/σ, rank before/after, explanation terms. |
| `ratingState` | `pool` | Current pool state (derivable by replaying `ratingEvents`). |
| `reports` | `id` = `report:<gameId>:<checksum12>:<engineBuild>:<settings>:<gradingId>` | Immutable analysis reports. A new engine, setting or methodology produces a new id; old reports are never overwritten. |
| `analysisJobs` | `job:<gameId>:<settingsId>` | Job intent and status (queued/running/complete/partial/cancelled/failed). |
| `meta` | `key` | Schema marker, last backup time. |
| `attempts`, `trainingRuns`, `bookmarks` | `id` | v0.2.0 Academy attempts, training runs, position bookmarks. |
| `world` | `key` = `world` | Federation cursor: seed, season, round, player membership, titles, history (v0.3.0). |
| `seasons` | `id` = `season:<n>` | Season plans: 128 league circuits, Swiss events, championship and Club Weekend brackets. |
| `competitors` | `id` | 2,048+ competitor records (identity, hidden strength, public Glicko-2, career, titles). |
| `rounds` | `id` = `<season>:<round>` | Fixtures (player, featured, knockout) with results + compact summary results. |
| `worldGames` | `id` = `wg:<fixture>` | Full move records of featured AI-vs-AI games. |
| `journal` | `id` | Immutable double-entry journals (integer microcrowns). |
| `accounts` | `account` | Account balances (must equal the journal replay). |
| `markets`, `positions` | `id` | Exchange markets (LMSR state, history, status) and holdings. |
| `assets` | `id` | Owned assets (acquired season, upkeep, suspension). |
| `finance` | `key` | Net-worth history and player extras (watchlist, sponsors paid, vouchers, paper forecasts with price/model snapshots, sandbox refill marker). |
| `liveGames` | `id` = fixture id | v0.4.0: in-play featured game — moves so far, seed, status, published price/model points. |
| `contracts` | `id` | v0.4.0: sponsorship contracts (stipend, share, paid, earned, status). |

Markets gained optional fields in v0.4.0 (`kind`, `outcomes`, `claims`, `model`, `payout`, `rules`, `live`, `q0`, `cancelVector`, `ref`); v0.3.0 match markets without them are read as W/D/B categorical markets, so no record is rewritten. Display preferences (theme, board) live in localStorage, not IndexedDB.

Every federation/economy command writes all changed records in **one** transaction guarded by the
committed (season, round) cursor (docs/V3_FEDERATION.md §4).

Finalization writes the finished game, its rating event, the pool state and the analysis intent in
**one** IndexedDB transaction; the event key makes retries idempotent (tested in tests/storage.test.ts).
Finalized games are immutable (only bookmarks may change).

## Notation (ccn-1)

`<from><to>[promotion]`, squares `a1`–`f6`, files a–f left to right from White, ranks 1–6 from
White's side. Promotion letters `q`, `r`, `n` (mandatory on the last rank). Identical to the
Fairy-Stockfish UCI spelling for variant `losalamos`. Display SAN (`csan-1`) is derived, never stored
as the source of truth. This is **not** standard-chess PGN.

## Backup bundle (crown-backup-1)

```json
{ "format": "crown-backup-1", "appSchema": "crown-save-1", "variantId": "crown-la6-v1",
  "exportedAt": "...", "appVersion": "0.3.0",
  "counts": { "games": 0, "ratingEvents": 0, "reports": 0 },
  "payloadSha256": "<sha-256 of JSON.stringify(payload)>",
  "payload": { "games": [], "ratingEvents": [], "ratingState": [], "reports": [],
               "attempts": [], "trainingRuns": [], "bookmarks": [], "federation": { "world": [], "journal": [], "...": [] } } }
```

Import validates everything before writing: format/variant/schema, payload checksum, every game
replayed legally with the production rules and every stored `fenAfter` matched, finalized-game
checksums, and that each rating pool equals a replay of its event ledger. Into an empty career the
bundle is restored completely; into an existing career only new games/reports are merged and the
active rating ledger is never rewritten.

## Single game (crown-game-1)

`Export game` writes `{ format: "crown-game-1", notation, canonical, record }` where `canonical`
is the checksummed rules content (`id, variantId, rulesVersion, initialFen, setupMoves, moves, result, termination`).

## Migrations

`src/storage/db.ts` holds an ordered `MIGRATIONS` list applied in `onupgradeneeded`:

| Version | Release | Change |
| --- | --- | --- |
| 1 | v0.1.0 | Initial schema |
| 2 | v0.2.0 | Adds `attempts`, `trainingRuns`, `bookmarks` (additive) |
| 3 | v0.3.0 | Adds the 11 federation/economy stores (additive) |
| 4 | v0.4.0 | Adds `liveGames` (in-play featured games, persisted after every move) and `contracts` (sponsorship contracts) (additive) |

Both upgrades are **additive**: no existing record is read, rewritten or deleted, so a v0.2.0 career opens
unchanged in v0.3.0 (verified: `tests/storage.test.ts` v1→v2, v2→v3 and v3→v4, and in Chromium by
`e2e/federation.mjs`, which plays a rated game in the real v0.2.0 build, then serves the v0.3.0 build on
the same origin and checks the games, rating events and rating are identical). The federation is empty
until the player founds it. Future data-transforming migrations must follow research doc 12: export a
recovery backup first, check quota, validate the new store before switching, keep the old data until
confirmed.

### Backups in v0.3.0

The `crown-backup-1` payload gains an optional `federation` object holding every federation store.
It is restored **only into an empty career** (the federation is one consistent world, never merged), and
only after validation: every journal must balance, and every account balance must equal the replay of
the journals (a tampered balance is rejected — tested). Older backups without `federation` still import.

### v0.5.0 (no schema change, IndexedDB v4)

v0.5.0 adds **no object store and no version bump**. New data is carried in optional fields of existing records,
written lazily, and older builds ignore it:

| Where | Field | Meaning |
|---|---|---|
| federation `world` | `engineCommitments[]` | `{season, round, build, at, liveGamesInProgress}` — engine build in force from that round (appended on the first load of a build) |
| federation `world` | `featured[]` (M5 addendum) | the 28 featured rivals |
| federation `extra` | `cosmetics` | `{owned[], equipped{frame,banner,board,avatar}, avatarSeed}`; purchases are journals `cosmetic:<id>` (player cash → sink) |
| federation `extra` | `ceremonies[]`, `favorites[]` (M5 addendum) | ceremonies to present; followed careers |
| game `white/black.engine` | `config` | exact engine configuration used (rules, backend, build, table size, time cap, node cap, selection) |
| game `moves[].engine` | `score`, `stopReason`, `build` | provenance of each engine move |
| analysis job | id `job:<game>:<preset>:<build>:<grading>` | jobs keyed by engine and grading version (old `job:<game>:<preset>` jobs stay as they are) |
| analysis report | unchanged schema | new reports: build `crown-search-2+crown-eval-4`, grading `crown-grade-v2-experimental`, accuracy `crown-accuracy-v2`; old reports untouched |
| bundled puzzle data | `canonical`, `retired`, `revisedFrom` | v0.5 re-verification; attempts on retired puzzles keep pointing at a real puzzle |

Verified in Chromium by `e2e/v5-journey.mjs`: the real v0.4.0 build (commit `d4dbbe6`) creates a career (federation,
club, trade, rated game with its v0.4 analysis report, Academy attempt); the v0.5.0 build on the same origin finds
every game, rating event, rating state, report, attempt, journal and balance byte-identical, keeps the historical
report, and can re-analyse the game with the current engine as a second report. Backups (`crown-backup-1`) are
unchanged; the same journey exports a backup and restores it into an empty profile with identical data.

Rollback: because nothing is rewritten, the v0.4.0 build still opens a career touched by v0.5.0 (it ignores the
extra fields). Export a backup before upgrading regardless.

## Durability limits

Browser storage is best-effort unless the browser grants persistence (the Library shows the status).
Safari/iOS may evict site data. Export backups regularly; only an external file survives eviction.
