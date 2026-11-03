# Save, export and import formats

All data lives in the browser's IndexedDB database `crown-calculation` (schema `crown-save-1`,
IndexedDB version 1) on the device. Nothing is sent anywhere.

## Object stores

| Store | Key | Contents |
| --- | --- | --- |
| `games` | `id` | `GameRecord` (src/games/types.ts): variant/rules/adjudication/notation versions, initial FEN, optional setup moves, every move with CCN, SAN, pre/post Zobrist hash, FEN after the move, clocks before/after and elapsed time, engine search metadata for engine moves, assistance and pause events, result, termination, opponent snapshot (engine profile, calibration id), rating event id, report ids, checksum. |
| `ratingEvents` | `id` = `rating:<gameId>:<pool>` | Immutable Glicko-2 events with inputs, expected score, before/after r/RD/σ, rank before/after, explanation terms. |
| `ratingState` | `pool` | Current pool state (derivable by replaying `ratingEvents`). |
| `reports` | `id` = `report:<gameId>:<checksum12>:<engineBuild>:<settings>:<gradingId>` | Immutable analysis reports. A new engine, setting or methodology produces a new id; old reports are never overwritten. |
| `analysisJobs` | `job:<gameId>:<settingsId>` | Job intent and status (queued/running/complete/partial/cancelled/failed). |
| `meta` | `key` | Schema marker, last backup time. |

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
  "exportedAt": "...", "appVersion": "0.1.0",
  "counts": { "games": 0, "ratingEvents": 0, "reports": 0 },
  "payloadSha256": "<sha-256 of JSON.stringify(payload)>",
  "payload": { "games": [], "ratingEvents": [], "ratingState": [], "reports": [] } }
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

`src/storage/db.ts` holds an ordered `MIGRATIONS` list applied in `onupgradeneeded`. Version 1 is
the initial schema. Future data-transforming migrations must follow research doc 12: export a
recovery backup first, check quota, validate the new store before switching, keep the old data
until confirmed.

## Durability limits

Browser storage is best-effort unless the browser grants persistence (the Library shows the status).
Safari/iOS may evict site data. Export backups regularly; only an external file survives eviction.
