# Federation scale and the live match scheduler (v0.9, v0.10)

Two questions: how large can the Federation be, and how many AI-vs-AI games can play at the same time while you
watch. Everything below was measured in this repository. Where a number depends on the machine, the conditions are
given. **§0 is the v0.10 work (10,240 competitors); §1–§4 are the v0.9 record, kept as it was measured, with the
v0.10 changes noted.**

## 0. v0.10: the Grand federation (10,240 competitors)

**Decision.** New federations are founded as **crown-topology-3: 80 regions × 8 divisions × 16 = 10,240 persistent
AI competitors**, on desktop and on phones. The founding screen also offers Standard (2,048, crown-topology-1) and
Large (4,096, crown-topology-2). Every existing federation keeps the size it was founded with: a v0.9 2,048 world
loads, plays and is saved as before (§0.4). 20,480 meets the desktop budget but not the phone budget (§0.3), so
10,240 is the largest size shipped.

**Conditions.** Same 4-core VM as v0.9, shared with other agents: **load average 6–12 on 4 cores during every run
below** (worse than the 5–9 of v0.9). Old and new code were run **interleaved** (old, new, old, new …) with the load
recorded per run. "Old" = the v0.9.0 code at `5c73a73`; "new" = this branch. Phones were not available: the phone
figures are **Chromium with DevTools CPU throttling 4×** (the DevTools "mid-tier mobile" preset) as a proxy. It slows
JavaScript and structured cloning in the page; IndexedDB's backend runs in the browser process and is not throttled,
and WebKit (iPhone) is not Chromium. Treat the phone column as an estimate that is measured, not as an iPhone result.

### 0.1 Root causes (profiles)

`node --cpu-prof --import tsx tools/sim/scale_probe.mts 80 21` (10,240, one season + 2 rounds), and the real app in
Chromium with the time inside IndexedDB commits recorded (`tools/sim/browser_scale.mjs`, new `commitMs`):

| Cost (old code, 10,240) | Share / time | Why it scaled badly |
|---|---|---|
| IndexedDB commit of the round advance (Chromium) | **680 ms of an 866 ms round** | every competitor written as its own record each round (10,240 puts), and at season end every competitor's ledger account (another ~10,000 puts). Chromium measured: 10,240 records put one by one 600–840 ms; the same data in 20 records of 512 about 55 ms. The number of records, not the bytes, is the cost. |
| `qualificationModel` (qualification market) | 35% of the Node profile | simulated all 80 Crown Division leagues 150 times per round, recomputing the Davidson W/D/L (`10**x`) for every simulated game, allocating a game object per game, and building full standings for every league tied at the top. |
| `structuredClone` of competitors (`clone`) | 17% | deep copy of 10,240 records per round advance. |
| `standings` / `leagueTable` / `leagueOrder` | 12% + 5% + 3% | each league table filtered the whole season's games (≈ 77,000) once per circuit: 640 × 77,000 at league end and season end. |
| `playedIn` (market models) | 3% | one scan of every round per Crown Division league. |

### 0.2 Changes

Behaviour-preserving (same results):

* **Market models** (`src/exchange/families.ts`): the W and W+D thresholds of each remaining pairing are computed once
  (they depend only on the two public ratings), so a simulated game is one PRNG draw and two comparisons with
  exactly the same outcome. The qualification model now asks "did the target win its league, and do fewer than 8
  other winners rank above it" (the winners' order is a strict total order: points, rating, id), and resolves a
  league's full tiebreak order only when it can matter (the target's own league tied at the top, or another winner on
  exactly the target's points). The PRNG stream is consumed in the same order. `leagueModel` uses the same prepared
  form.
* **One pass instead of one per circuit**: `gamesByEvent` index for league tables at league end, championship build
  and season end (`src/federation/world.ts`), and for the market models (`src/app/markets.ts`).
* **`copyData`** (`src/federation/copy.ts`) instead of `structuredClone` for plain records (same keys, same order,
  `undefined` kept; refuses non-plain data).

Storage format (lossless, no IndexedDB schema change, `src/federation/persist.ts`, docs/SAVE_FORMAT.md):

* **Competitors in chunk records** `~c:<n>` of 512 (by competitor index) in the `competitors` store; only chunks with a
  changed record are rewritten (retired-only chunks stop being written).
* **Competitor ledger accounts** `comp:<id>` in chunk records `~a:<n>` in the `accounts` store; all other accounts
  stay individual records. The backup ledger check reads the chunks.
* **Packed tier-3 results**: a round record's `abstract` (≈ 5,000 4-tuples per round) is stored as five strings
  (`packed = { v: 1, n, events, ev, w, b, r }`). Stored rounds shrink by ~46%.
* Older saves: individual records are read as they are; each is replaced by its chunk, and deleted, in the
  transaction that first writes that chunk.

Intended changes (larger worlds only; every 16-region world is unchanged, checked by hash):

* crown-topology-3; region names 33–80 (original); regional arms for regions 17–80 (unused division/charge pairs,
  double border, unique silhouettes, tested); 128 more AI clubs (unique names ≤ 32 characters, arms and mottos) and
  `clubsOf(regions)` so screens and club finances use a world's own clubs; `clubOf` maps regions 17–80 to their own
  clubs (v0.9 reused `r % 16`, only ever in scale experiments); the season-market subjects use `% regions` instead of
  `% 16`.
* UI: founding size selector (default Grand); Discover Competitors pages of 100 (Prev/Next) instead of a top-200 cap;
  the clubs table groups members in one pass; the new **Federation Population** screen (§0.5).

Not changed: competition rules (8 Crown Division winners + 8 Federation Open qualifiers for the Championship; Swiss
fields of 32; 16 per circuit; promotion/relegation), the scheduler's caps, results.

**Behaviour proof.** `tools/sim/determinism_check.mts` now also prints a `canonical` hash over the stores as the app
reads them (chunks expanded, rounds unpacked) with sorted keys:

| Check | Old (`5c73a73`) | New | |
|---|---|---|---|
| 16 regions, 40 rounds (2 seasons + 2), seed 4242 | `0c985165…2dbaa5` | `0c985165…2dbaa5` (branch head) | identical |
| 80 regions, 21 rounds | `83510f4e…db92f11b` | `83510f4e…db92f11b` (performance + storage commit `cb3c3b1`) | identical |
| 80 regions, 21 rounds, branch head | `83510f4e…` | `ce3dbe6f…` | differs by the intended club/market-subject changes for regions ≥ 17 above |

The 16-region raw `sha256` changes (`e106b030…` → `6e1650a7…`) only because the stored format changed; 4.27 MB →
3.71 MB stored. Tests (`tests/federationPersist.test.ts`): codecs round-trip exactly and reject damage; a world
reloaded after every round across a season end equals one never reloaded; a v0.9-format save (individual records)
loads, continues identically through a season end and ends fully chunked; backups carry chunks and a tampered chunk
balance is rejected; the qualification and league models equal the v0.9 reference implementations on 70 random
worlds with heavy rating and points ties; `copyData` equals `structuredClone`.

### 0.3 Results and budgets

**Budgets** (set before the final runs). Desktop (Chromium 1×): round advance median ≤ 500 ms, slowest round (season
end) ≤ 1,500 ms, cold load ≤ 1,000 ms, competitor search ≤ 100 ms. Phone proxy (Chromium 4× CPU): median ≤ 1,200 ms,
slowest ≤ 2,500 ms, cold load ≤ 2,000 ms. Storage ≤ 10 MB per season at the default size.

**Real app, Chromium, real IndexedDB, one season (19 rounds), featured games stubbed** (`node tools/sim/browser_scale.mjs
<dist> 19 0 0 <port> <regions> <throttle>`; interleaved; slowest round = season end):

| Size | CPU | Load | Old median / slowest / commit median | New median / slowest / commit median | New cold load | Budget |
|---|---|---|---|---|---|---|
| 2,048 | 1× | 8.3–8.5 | 342 / 568 / 194 ms | **126 / 319 / 47 ms** | 30 ms | pass |
| 10,240 | 1× | 8.5–10.4 | 1,414 / 2,181 / 932 ms | **241 / 541 / 90 ms** | 152 ms | **pass** (old: fail) |
| 2,048 | 4× | 10.0–10.9 | 846 / 2,210 / 348 ms | **328 / 885 / 100 ms** | 149 ms | pass |
| 10,240 | 4× | 6.9–10.6 | 2,579 / 5,545 / 1,011 ms | **799 / 1,624 / 254 ms** | 528 ms | **pass** (old: fail) |
| 20,480 | 1× | 10.3 | – | 513 / 912 / 178 ms | 492 ms | median 3% over, slowest pass |
| 20,480 | 4× | 10.2 | – | 1,566 / 3,292 / 560 ms | 1,436 ms | **fail** |

Earlier single runs on the new code at 10,240 (load 3.4–4.7): 1× median 189–197 ms, season end 452 ms, commit 61–71
ms; 4× over **two seasons** (38 rounds, load 4.9–6.3): median 993 ms, slowest 1,776 ms (season 2's end), commit
median 377 ms — commits grow slowly with the records' season history.

**Node + fake-indexeddb, one season** (`tools/sim/scale_probe.mts`, 2 interleaved runs each, load 7–12; heap after GC
includes fake-indexeddb's copy of the database):

| Size | Old median / slowest | New median / slowest | Old → new season | Stored after 1 season (old → new) | Heap (old → new) |
|---|---|---|---|---|---|
| 2,048 | 140–277 / 340–877 ms | 66–90 / 219–409 ms | 3.0–6.2 s → 1.6–2.6 s | 2.46 → 2.20 MB | 31 → 24 MB |
| 4,096 | 259–525 / 510–1,505 ms | 102–193 / 241–464 ms | 5.1–11.0 s → 2.2–4.4 s | 4.50 → 3.98 MB | 48 → 35 MB |
| 10,240 | 602–954 / 1,383–2,723 ms | 260–410 / 583–1,286 ms | 12.1–21.2 s → 5.7–11.3 s | 10.62 → 9.33 MB | 100 → 65 MB |
| 20,480 | 1,447–1,541 / 3,331–4,777 ms | 371–522 / 836–1,224 ms | 33.9–35.1 s → 8.1–12.1 s | 21.08 → 18.48 MB | 188 → 118 MB |

**Long run, 10,240, five seasons (95 rounds)**, 2 interleaved runs, load 6.3–11.8: old median 934–1,011 ms, slowest
2,224–2,909 ms; new **509–524 ms, slowest 1,090–1,412 ms**. Competitors on record 12,356 (retired ones stay).
Stored: old 33.4 MB, new **27.3 MB** (rounds 13.0 → 7.0 MB, accounts 0.48 → 0.35 MB; competitors 14.6 MB in both) —
about **5.5 MB per season**, within the 10 MB budget. Heap 316 → 162 MB (both including fake-indexeddb's copy).

**UI at 10,240** (`e2e/population.mjs` through the real UI, desktop UA): founding the Grand federation 504–626 ms; a
round with two featured engine games: engine games 4.2 s (unchanged from v0.9: up to three featured games are played
in full before a round closes), world simulation and commit 564 ms (live scheduler running, load ~10); Population
screen and Discover Competitors at 1366 px and 390 px without overflow; name search to rendered rows 74–125 ms
including Playwright round trips. In Node (`tests/population.test.ts`): `filterCompetitors` 2.3 ms per search,
`populationStats` 14 ms at 10,240.

**Pass/fail.** 10,240 passes every desktop and phone-proxy budget (old code failed both). 20,480 passes the desktop
slowest-round budget, misses the desktop median budget by 3% under load and fails the phone proxy, so it is not
offered. **Largest verified stable size: 10,240** (five seasons, no errors, storage and heap bounded as above).

### 0.4 Existing saves

* A v0.9 world (with or without the `topology` field) keeps its size; its records are read as stored. Its first
  round advance writes chunks and deletes the individual records it replaces in the same transaction; untouched
  competitor accounts stay individual until they change. Tested in `tests/federationPersist.test.ts` and the v0.9
  `tests/federationScale.test.ts` save test.
* Downgrade: a v0.9 app cannot read the chunk records (it would see them as malformed competitors). The app updates
  forward only (docs/IPHONE_PAGES.md); export a backup before installing an older build.

### 0.5 Population analytics (Federation → Population, `#/population`)

From saved data only (public Glicko-2 ratings and each competitor's stored season history; never hidden strengths):
active / retired / reserve counts; counts and shares per band 0–399, 400–799, …, 3200–3999, 4000+; a distribution
chart; mean, median and range; your percentile among active competitors (from your rated rapid pool; ties count half);
top 10; the strongest competitor of each division; and mean / median / band counts at each completed season's end
plus now. One pass and one sort (`src/app/population.ts`): 14 ms at 10,240 in Node, memoised per committed state.

### 0.6 Mobile performance mode

Phones and tablets (coarse pointer or mobile user agent, `detectDevice`) keep the v0.9 reduced live load: one engine
worker, at most 6 scheduled games at once, 24 per round, catch-up K = 2. The live scheduler's caps are unchanged and
the app never claims that matches play while it is closed: nothing computes while closed or hidden, and the reopen
catch-up is bounded and labelled (§2). The founding screen tells phone users that Standard has the quickest rounds.

### 0.7 Not done

* No physical iPhone or Android measurement (only Chromium 4× throttling); WebKit's IndexedDB may behave differently.
* Retired competitors keep full records (≈ +420 per season at 10,240, 12,356 on record after five seasons): their
  chunks are no longer rewritten, but they are not compacted, and they are kept in memory.
* Old seasons' rounds stay in memory after load (packed only on disk); the heap grows with seasons (§0.3).
* Competition balance at 80 regions is unchanged by rule: 8 of 80 Crown Division winners qualify for the
  Championship by points, so qualifying through the league is much harder than in a 16-region world. The economy's
  issuance is per circuit (5× the 16-region total, almost all paid to AI competitors and expensed at season end); the
  economy simulator (`tools/sim/economy.ts`) was not re-run at 80 regions.
* The featured engine games of a round (up to three, played in full before the round closes) are engine time, not
  world-size time, and were not changed.
* 20,480 is not offered (phone proxy budget fails; regions beyond 80 have no names, arms or clubs).

## v0.9 record

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

**Not switched on for new federations in v0.9** (v0.10: new federations are crown-topology-3 and the content and storage blockers below are resolved, see §0; the economy simulator and Championship quotas are still as listed): Speed is fine at
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

## 4. What remains (v0.9 list; v0.10 status in §0.7)

* Switching new federations to crown-topology-2 (blockers and plan in §1.4).
* Lightweight reserve and retired records, and compaction of old rounds' abstract results (storage growth).
* The qualification market model's cost grows with the number of regions (odds-model code).
* Phone numbers are estimates from the VM numbers (×3–5); a physical phone has not been measured.
* The scheduler's live in-play driving of featured market games is not automated: those stay user-driven in the
  Arena, as before.
* An e2e journey through the Live Now panel and Settings in the browser; the browser probe drives the services
  directly.
