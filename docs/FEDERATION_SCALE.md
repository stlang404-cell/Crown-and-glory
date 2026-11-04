# Federation scale and the live match scheduler (v0.9)

Two questions: how large can the Federation be, and how many AI-vs-AI games can play at the same time while you
watch. Everything below was measured in this repository. Where a number depends on the machine, the conditions are
given.

**Machine and conditions.** A 4-core Linux cloud VM, Node 22, Chromium (Playwright build). Other agents were running
benchmarks on the same VM the whole time: the load average was **5–9 on 4 cores**. Wall-clock times are therefore
higher than on a quiet machine, by up to about 2× (a quiet run of the 2,048 probe at the start measured a 183 ms
median round against 240 ms under load). Every timing is a median of 3 runs unless stated otherwise.

## 1. Population scaling

### Tools

| Tool | What it measures |
|---|---|
| `node --expose-gc --import tsx tools/sim/scale_probe.mts <regions> [rounds] [seed]` | create time, time per round advance, season time, stored size per store, JS heap. Uses fake-indexeddb. Featured games are stubbed out, so it measures the world simulation and persistence. |
| `npx tsx tools/sim/determinism_check.mts [rounds] [seed]` | SHA-256 of the full federation dump after N rounds (forfeits, stubbed featured games with seeded results, one player trade per round). Run it on old and new code to prove an optimisation changes nothing. |
| `node tools/sim/browser_scale.mjs <built dist> [rounds] [liveN] [seconds]` | The real app in headless Chromium: real IndexedDB and the real worker pool. |
| `npx tsx tools/sim/live_cost.mts [games] [divisions]` | Engine time per move and per game of a scheduled live game, by division. |

The world size is set by the number of regions (`regions × 8 divisions × 16`). The probe sizes are 16 / 32 / 40 / 80 /
160 regions, which gives 2,048 / 4,096 / 5,120 / 10,240 / 20,480 competitors. Sizes like 5,000 or 10,000 do not fit
the grid exactly.

### Results (Node + fake-indexeddb, one full season = 19 rounds, after the optimisations in §1.3)

| Competitors | Create | Round advance, median | Slowest round (season end) | Season | Stored after 1 season | Heap after 1 season* |
|---|---|---|---|---|---|---|
| 2,048 | 512 ms | **240 ms** | 824 ms | 6.3 s | 2.46 MB | 31 MB |
| 4,096 | 855 ms | **503 ms** | 1,007 ms | 11.1 s | 4.49 MB | 47 MB |
| 5,120 | 648 ms | **399 ms** | 1,044 ms | 8.5 s | 5.52 MB | 56 MB |
| 10,240 | 1,412 ms | **1,248 ms** | 2,919 ms | 25.0 s | 10.62 MB | 100 MB |
| 20,480 | 2,658 ms | **1,999 ms** | 5,459 ms | 39.8 s | 21.08 MB | 187 MB |

\*The heap includes fake-indexeddb's in-memory copy of the database, so it overstates what the app holds.

Stored size grows almost linearly with population. The per-store split at 4,096 is: competitors 2.69 MB, rounds
1.10 MB, journal 0.34 MB, the rest under 0.15 MB each.

**Long-run growth at 2,048 (5 seasons, 95 rounds).** The total is 8.24 MB: competitors 2.93 MB, rounds 2.62 MB,
journal 1.43 MB, markets 0.63 MB. Retired competitors stay in the map, so the count was 2,490 after 5 seasons
(about +90 per season). Each season also adds about 0.52 MB of round records (every background pairing is kept).
At 4,096 these growth rates double. That matters more for phone storage than the advance time does.

**The real app in headless Chromium, default size (2,048), real IndexedDB, one season.** Found the federation:
451–516 ms. Round advance: median **272–325 ms**, slowest 474–519 ms. JS heap 28–38 MB. IndexedDB usage 5.5–7.7 MB.
No page errors.

### 1.3 Hot spots and behaviour-preserving optimisations

A CPU profile of a 4,096 season (`node --cpu-prof`) found three main costs:

1. **`FederationService.clone()` deep-copied every competitor record (structuredClone) for every command.** That
   included forfeits, trades, featured-game commits and each live move. It was about 26% of the profile.
   Only the round advance changes competitor records, so it is now the only command that copies them
   (`clone({ competitors: true })`). Every other command shares the committed records.
   *Proof that this is safe:* `tests/federationScale.test.ts` deep-freezes every competitor record and then runs
   trades, favourites, the watchlist, Swiss registration, scheduled-game steps, an abstract resolution, a featured
   game and forfeits. Any write to a record would throw. None does. The round advance still works on its own copy.
2. **`leagueOrder` head-to-head.** The comparator re-filtered every game of the league on every comparison. It now
   computes each tied group's head-to-head once, adding the same terms in the same order, so the floating-point
   values are bit-identical. This function is called heavily by the exchange Monte Carlo models. A randomized test
   checks it against the old implementation on 400 tables with many ties.
3. **`makePlan` filtered the whole population once per circuit (O(n × circuits)).** It now buckets the population
   once. This has the same order and is a stable sort with total tie-breaks.

*Byte-identical check.* `tools/sim/determinism_check.mts 40` on the original commit `8d69a32` and on that commit
plus these changes (the topology code and the three optimisations) gives the same SHA-256,
`6a625dcd…ff1d82`, over 4,258,656 bytes. Times for the same 40 rounds, 3 interleaved runs each:
**12.0 / 12.5 / 12.8 s before, 7.2 / 7.7 / 8.5 s after (median 12.5 s → 7.7 s, −38%).**
On the current working tree the hash is different. That is because the odds-model work in progress changes market
forecasts, not because of this change.

**Remaining hot spot (not changed: it belongs to the odds-model work).** The `qualification` market model
(`src/exchange/families.ts`, `qualificationModel`) simulates every Crown Division league jointly, 150 times, after
every round. Its cost grows linearly with the number of regions. It was the largest single cost per round at 4,096
(about 30% of the profile).

### 1.4 Decision: supported population

* **Desktop target (round advance ≤ about 1 s):** met up to about 5,000 competitors (4,096: 0.5 s median, 1.0 s
  season end, under load). Not met at 10,240 (1.25 s median, 2.9 s season end) or at 20,480 (2.0 s median, 5.5 s).
* **Phone budget (documented, not measured on a phone):** assume a mid-range phone is 3–5× slower than this VM. That
  gives 2,048: about 0.7–1.2 s per advance and 2.5–4 s at season end; 4,096: about 1.5–2.5 s per advance and 3–5 s at
  season end. Storage on a phone is tighter: roughly 1 MB per season at 4,096.
* **Structure for a larger world:** crown-topology-2 = **32 regions × 8 divisions × 16 = 4,096**. Division size is a
  rule, not a parameter: a 15-round single round robin needs 16 per circuit, and the economy, Swiss bands and labels
  assume 8 divisions. So the world grows by adding regions. For anything beyond about 5,000, the plan is lightweight
  reserve records rather than more full circuits: name, latent strength and rating only, no history or milestones,
  with the full record created when the competitor is promoted into a circuit. Retired competitors could be compacted
  the same way.

**Implemented:** a versioned topology (`src/federation/model.ts`: `Topology`, `TOPOLOGY_V1`, `TOPOLOGY_V2`,
`topologyOf`, `NEW_FEDERATION_TOPOLOGY`).

* The world records its topology when it is founded. Each region's circuits are built from it (`makePlan`), and
  promotion and relegation use it (`endSeason`). It never changes after founding.
* **Existing saves.** A world with no `topology` field is crown-topology-1 (16 regions, 2,048 competitors). A v1
  world is still written without the field, so its record is byte-identical to the pre-v0.9 format.
* `FederationService.create(region, seed, topology)` validates the region against the topology.
* Region names extend to 32 originals (`regionName`, `regionNamesOf`), and the region pickers list only the regions
  that exist in your world.
* Tests (`tests/federationScale.test.ts`):
  * a stored 2,048 world loads, advances and rolls over a season with 16 regions and 128 circuits;
  * a 4,096 world persists its topology, reloads, and keeps 256 circuits and 32 regions across a season rollover;
  * a player can join any region of the larger topology.

**Not switched on for new federations:** `NEW_FEDERATION_TOPOLOGY` is still crown-topology-1. Speed is fine at
4,096. What is not yet safe is the content and the economy around it:

1. **AI clubs.** There are 32 clubs, 2 per region, with arms unique by construction (`src/heraldry/clubs.ts`).
   32 regions need 64 clubs with unique arms. Until then `clubOf` reuses region `r % 16`'s clubs. This only happens
   in scale experiments, and nothing changes for regions 0–15.
2. **Regional arms** repeat every 16 (`regionEmblem(r % 16)`), so regions 17–32 would duplicate existing arms.
3. **Economy.** Season issuance is per circuit (`prizePools`), so it doubles with 32 regions, while the treasury,
   NPC funds and sponsor budgets stay fixed. The economy simulator and money-supply bounds
   (`tools/sim/economy.ts`, docs/V3_ECONOMY.md) were calibrated on 16 regions and need to be re-run and re-validated.
4. **Competition balance.** The Championship still takes 8 of the (now 32) Crown Division winners plus 8 from the
   Swiss. The Swiss fields still take the top 32 of a pool twice the size. Qualification odds roughly halve, and the
   qualification market's cost doubles (§1.3).
5. **Storage on phones.** At 4,096 the save is about 1 MB larger per season. Compacting retired competitors and old
   rounds' abstract results should come first.

To switch it on: add 32 clubs and regional arms with uniqueness tests, re-run the economy simulator at 32 regions and
adjust the issuance per circuit, decide the Championship and Swiss quotas, then set
`NEW_FEDERATION_TOPOLOGY = TOPOLOGY_V2`. Existing saves keep 2,048 automatically.

## 2. Live match scheduler (crown-live-scheduler-1)

`src/app/scheduler.ts`, `src/app/schedulerEngine.ts`, the scheduled-game commands in `src/app/federation.ts`,
wiring in `src/app/services.ts`, UI in `src/ui/LiveNow.tsx`, `src/ui/LiveSchedulerSettings.tsx` and
`src/ui/SpectatorScreen.tsx`.

### What it does

* **Which games are played.** Up to N background fixtures of the open round are promoted to scheduled engine games
  ("slate" fixtures, tier 2, `slate: true`). The order is deterministic: your own circuit, then the Swiss events,
  then the leagues from the Crown Division down; higher public-rating sum first; ties broken by ids. At most
  `maxPerRound` fixtures of one round are ever promoted (default 64 on desktop, 24 on phones). Your games, featured
  games and anything with a market are never promoted.
* **How moves are made.** Every move is a fresh seeded search (`plySeed(seed, k)`, transposition table cleared),
  computed on a pool of spectator workers (`EngineChannel` role `live-i`, the same worker protocol as the spectator
  channel). Move k depends only on the moves before it, the profile (node-limited, featured cap 30,000), the style
  and the seed. The pool has `cores − 2` workers (1–4) on desktop and 1 on phones.
* **Commits.** A move is computed outside the command lock, then committed by `scheduledStep(id, expectPly, move)`.
  Each move goes into the `liveGames` store as soon as it exists. A stale result is discarded: the game moved on,
  ended, or the round closed. A user command that meets a scheduler commit now waits for it (a few ms) instead of
  failing. Scheduler commits wait behind everything.
* **Settlement.** The last move commits the result, the `WorldGame` record and the fixture through the featured-game
  path (`finishFeaturedIn`), once. The round advance counts the pairing once. Viewing speed only changes what a
  screen reveals, never which move is played or when a game ends.
* **Unfinished games at round close.** If the round is advanced first, an unfinished scheduled game gets exactly the
  tier-3 draw of its pairing (same seed and formula as `resolveAbstract`). Promotion therefore never changes the
  result a fixture would otherwise have had. These are labelled **Abstract result**, keep their partial live moves
  in the live-game record, and get **no replay**.
* **Pausing.** The scheduler pauses while you play your own game (`setMatchActive`) and while the tab is hidden.
* **Labels.** "Played live" (`simulated`), "Fast-forwarded" or "Abstract result" appear in Live Now, on the Arena
  status, and in `Fixture.resolution`, `LiveGame.resolution` and `WorldGame.mode` (`scheduled-live` /
  `fast-forwarded`).

### Capacity N: measured, adaptive and set per device

Engine time per live move (`tools/sim/live_cost.mts`, 3 games per class, under load, in Node). Two runs are shown:
the first was taken at load average 8+ (only the two rows shown), the second at about 5.

| Pairing | Profile | Median ms/move (run 1 / run 2) | p90 (run 2) | Median plies |
|---|---|---|---|---|
| Both at the featured cap | 30,000 nodes | 78 / **37** | 54 | 49 |
| Crown Division | about 9,000 nodes | 48 / **7** | 23 | 74 |
| Division 2 | 5,120 nodes | **4.6** | 11 | 96 |
| Division 4 | L4 sampling | **0.9** | 3 | 80 |
| Division 8 | L2 sampling | **0.4** | 1 | 32 |

At one move per game every 3 s, a game at the cap costs 37–78 ms every 3 s, which is 1.2–2.6% of one core.
**24 cap-strength games ≈ 0.3–0.6 cores.** The default slate (home circuit first) is mostly cheaper.

Auto capacity is `N = ⌊workers × utilisation × plyInterval / median measured ms per move⌋`, clamped to `[1, maxAuto]`.
It starts at 4 until 5 moves have been measured on this device. The defaults come from these numbers:

| Device | Workers | Utilisation | maxAuto | Interval | Catch-up K |
|---|---|---|---|---|---|
| Desktop | cores − 2 (1–4) | 0.5 | **24** | 3 s | 4 |
| Phone (coarse pointer or mobile UA) | 1 | 0.4 | **6** | 3 s | 2 |

At desktop speed (37–78 ms per move at the cap) the formula always hits the 24 cap. A phone 5× slower (about
190–390 ms per move) gets 3–6. **Settings → Live Games** offers Off, Automatic and Fixed (1–32). The setting is
stored per device in localStorage (`crown.liveScheduler.v1`), not in the save, because N is a property of the
device. The absolute bound is 32.

**In the real app (Chromium, 4 cores under load, 2 live workers, Fixed N, 3 s interval, 60 s each):**

| N | Max in progress | Moves committed | Moves/s (target N/3) | Main-thread commit median / p95 | Long tasks |
|---|---|---|---|---|---|
| 12 | 12 | 216 | 3.6 (4.0) | 5.3 / 12.7 ms | 0 |
| 24 | 24 | 435 | 7.25 (8.0) | 3.3 / 10.5 ms | 0 |

Throughput is a little under target only because games start one interval after promotion and the window is short.
The first version reached only 3.9/s at N = 24, because a freed worker waited for the next 500 ms tick. Workers now
take the next due move as soon as they finish.

### Persistence, resume and bounded catch-up

* **Reload.** Every committed move is in IndexedDB. After a reload the scheduler continues each game from its move
  list, on the same timeline. The test compares a game interrupted and resumed on a different number of workers and
  a different pace with an uninterrupted run: identical moves and results.
* **While closed.** Nothing computes while the app is closed or hidden.
* **On reopen.** If the most recent move is older than `catchUpAfterMs` (10 min), the scheduler handles the games
  that were in progress:
  * at most **K** of them, the longest-running first, are **fast-forwarded**: every remaining move is still computed
    by the engine, at full speed, and the game is labelled *Fast-forwarded*, not live;
  * the rest are **resolved abstractly** with their tier-3 draw, labelled, and a note records how long the app was
    away. No move-by-move replay is ever made for an abstract result.
  * Total catch-up work is bounded by K games of at most 400 plies.
* Games with a market are never part of a catch-up.

### Markets and information policy

Scheduled games have **no market**, so the economy and NPC trading are unchanged. In-play markets stay what they
were: featured fixtures with a market, played move by move through `startLive` / `liveStep`, with trading windows
and revision locking (docs/M6_LIVE_ARENA.md). A market game is never resolved abstractly and never fast-forwarded by
the scheduler. A scheduled game's published moves and their moving-engine evaluations are public live information
(policy category 1). Post-game analysis follows the existing rule: only after the game is recorded and no official
market on it can trade (scheduled games have none).

## 3. Tests

* `tests/scheduler.test.ts` (9 tests):
  * capacity formula and bounds; settings sanitising and persistence;
  * in progress ≤ N and computing ≤ workers at all times, with slots refilled when games finish and no new games
    when N is lowered;
  * settlement once through the featured path; stale and duplicate steps discarded; the pairing counted once at
    advance; ledger conserved;
  * unfinished games at round close take exactly the tier-3 draw of a world without the scheduler, labelled
    abstract, with no replay;
  * reload resume on the same timeline, independent of pace and worker count;
  * bounded reopen catch-up: K fast-forwarded with real moves, the rest abstract, all labelled;
  * determinism across two runs with the same seed;
  * user commands queue behind scheduler commits.
* `tests/federationScale.test.ts` (6 tests):
  * the v1 world format is unchanged; a stored 2,048 save loads, advances and rolls over a season;
  * crown-topology-2 (4,096 competitors) persists its topology and keeps it across a season rollover;
  * a player can join any region;
  * `leagueOrder` matches the reference implementation;
  * frozen competitor records prove the shared-record optimisation is safe.

## 4. What remains

* Switching new federations to crown-topology-2 (blockers and plan in §1.4).
* Lightweight reserve and retired records, and compaction of old rounds' abstract results (storage growth).
* The qualification market model's cost grows with the number of regions (odds-model code).
* Phone numbers are estimates from the VM numbers (×3–5); a physical phone has not been measured.
* The scheduler's live in-play driving of featured market games is not automated: those stay user-driven in the
  Arena, as before.
* An e2e journey through the Live Now panel and Settings in the browser; the browser probe drives the services
  directly.
