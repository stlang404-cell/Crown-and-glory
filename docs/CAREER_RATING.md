# Career rating: new careers start at 0 (v0.11, crown-career-1)

The owner's v1.0 requirement: every genuinely **new** human career starts at **0 displayed career Elo, 0 rated games,
provisional**, and earns its rating only through real results. Existing careers are never changed.

## 1. Design
* A new career's Glicko-2 rating (model `crown-glicko2-1`, unchanged) starts at **r = 0 on the Crown scale**
  (L1 Novice = 800; calibrated beginners L0a 664, L0b 446, L0c 302, L0d 71 — docs/RATING_SPECTRUM.md) with the standard
  **RD 350** and **σ 0.06** in every pool (rapid, blitz, classical). Nothing is subtracted from a 1500-based rating.
* **Why this is coherent.** Glicko-2 works on μ = (r − 1500)/173.7178. Only rating *differences* enter g(φ), E, v and
  Δ, and the volatility step uses Δ, φ and v only, so translating every rating by a constant translates the result by
  the same constant (`CENTER` in `src/ratings/glicko2.ts` is the scale's origin, not a start rating). Tests prove it:
  a player at 0 vs 300/450/650 gets exactly the update of a player at 1500 vs 1800/1950/2150 (rating to 1e-9, RD, σ,
  v and Δ), and a 40-game history translated by −1500 is identical game by game (`tests/career.test.ts`).
* **Display floor.** The stored rating is never clamped (that would break the mathematics: losses at 0 make it
  negative). The *displayed* career Elo is `displayElo(r) = max(0, round(r))` (`src/ratings/career.ts`), used by the
  Career Passport, identity banner, Career Standing, Play, the match header, the result overlay, Library, Analysis,
  Quick Match and charts (the chart line is floored at 0). When the underlying rating is negative the result overlay
  says so ("the underlying rating is −143 and wins bring it back up"). Rating-change deltas are the true deltas.
* **Results only.** Ratings change only through rated results (win/draw/loss against the opponent's rating and RD);
  casual, assisted and untimed games never rate (existing rules), and there is no participation bonus. Tested: ten
  losses at 0 move the rating down every time; ten draws against a far weaker beginner move it down every time.

## 2. Worked examples (first rated game of a new career, from 0 ± 350, σ 0.06)
Values from the Glicko-2 formula (`tests/career.test.ts` recomputes the L0d case step by step):

| Opponent | Expected score | Win | Draw | Loss | RD after |
|---|---|---|---|---|---|
| L0d First Moves 71 ± 56 | 40.1 % | **214.0** | 35.5 | −143.1 (shown 0) | 251.0 |
| L0c Newcomer 302 ± 52 | 15.3 % | **390.6** | 160.2 | −70.3 (shown 0) | 284.9 |
| L0b Beginner 446 ± 49 | 7.3 % | **509.1** | 234.4 | −40.3 (shown 0) | 310.8 |
| L0a Starter 664 ± 46 | 2.2 % | **628.4** | 307.1 | −14.3 (shown 0) | 335.9 |

Five straight losses to L0d: −143.1, −203.5, −241.3, −268.8, −290.3 (displayed 0 throughout). A career that scores
2/3 against beginners picked near its rating is established after game 20 at ~514 ± 82 and then settles around
540 ± 63 — a genuine 400–799-band rating. Measured in the browser by `e2e/new-career.mjs`: a first rated win vs L0c
moved 0 ± 350 → 390.56 ± 284.85, shown as "Rapid career Elo 0 → 391 (±285) · provisional".

## 3. Provisional and established
The game's existing rule is kept (`isProvisional`, research doc 06): **provisional until 20 rated games AND RD ≤ 100**.
While provisional:
* the rating is shown as "0 · provisional" (`careerEloLabel`) / "Provisional" on the Passport and banner;
* **no comparisons**: the Population screen hides the percentile ("appears once it is established"); the established
  peak/lowest, rating-title collection, rating-milestone achievements and Federation titles already count established
  ratings only (unchanged); the Passport shows "highest so far … (provisional)" separately;
* rating-gap ("upset") Vault collectibles (Upward Duel, Giant Slayer, Titan Slayer, Fortune Favours, Lightning
  Strikes) count only games started with an established rating (RD ≤ 100 in the game's snapshot), so a 0-start career
  is not "beating higher-rated opponents" by beating beginners;
* the current rating *title* (one per 100 points, cosmetic) is still shown, labelled provisional, as before.

## 4. Federation and matchmaking
* **Joining.** The player always joins the **lowest division** (division 8) of the chosen region (`joinPlayer`,
  unchanged), whatever the rating — coherent for a 0-start player. Swiss and Club Weekend seeding by rating place a
  provisional 0-rated player as the lowest seed (true to the rating; no special case). The player's own games are never
  simulated, so the rating does not drive any abstract result.
* **Matchmaking.** `suggestBeginnerBands`: a provisional new (0-start) career, or any career whose displayed rating is
  under 800, defaults to the **0–399 and 400–799 bands**: Play preselects the calibrated beginner nearest the rating
  (L0d at 0) and labels the beginner group "Suggested for your career Elo"; Quick Match defaults to the new **Beginner
  Bands** pool (Federation competitors rated under 800), labelled the same way. "Near My Rating" and "Higher Rated"
  compare with the displayed career Elo. Legacy careers keep their previous defaults (Anyone / L3) unless under 800.

## 5. Career origin, saves and what did not change
* Each database has a meta record `career` (`CareerRecord`: model `crown-career-1`, id, `ratingStart`, origin
  `new`/`legacy`, createdAt, `previousArchiveId`). **The initial state of every new career is defined in one function,
  `newCareerRecord`** (`src/ratings/career.ts`), used by a brand-new database, an old-but-empty database and Start
  New Career; further starting state (e.g. a starting rank) belongs there.
* A brand-new database (IndexedDB upgrade from version 0) is a new career at 0. A database without the record was
  created before v0.11: if it holds any game, rating event, rating state or Federation it is **legacy** (start 1500,
  written once, never changed); if it holds none of these it has no career yet and becomes a new career at 0.
* **Existing careers are never changed**: no rating, event, state or history is rewritten; their unplayed pools still
  start at 1500. Verified by `tests/career.test.ts` (a v0.9/v0.10-shaped save: rating, events and 1500 origin
  unchanged, the next game continues from the stored state) and by `e2e/v5-journey.mjs` (real v0.4.0 build → this
  build: 1512 → 1522 on the next rated game).
* Backups (`crown-backup-1`) carry `payload.career`. A backup without it is from a pre-v0.11 career and replays from
  1500. Validation replays every pool from the career's origin and checks each pool's first event starts there.
  Restoring into an empty profile adopts the backup's origin, so an old career restored into a new install stays at
  1500 exactly. Merging into another career imports no rating events (unchanged rule).
* Unchanged: Glicko-2 parameters (τ 0.5, RD 350, σ 0.06, ε 1e-7, RD cap 350), the provisional rule, competitors'
  ratings, the Crown scale anchor, rating titles, Federation titles, the Played Like Performance Elo (separate model,
  package H — never derived from career rating), and the rating event schema.

## 6. Start New Career (Settings → Career)
Two explicit steps:
1. **Export Backup and Continue**: a full `crown-backup-1` export (the same as Library → Export Backup) is downloaded
   and a second copy is stored in a separate IndexedDB database `crown-calculation-archive` (store `backups`) if the
   storage estimate leaves room (otherwise the UI says no second copy was kept). Archived careers are listed under
   Settings → Career → Archived Careers and can be downloaded again.
2. **Confirm** (checkbox "I have the backup…" then Start New Career): background work stops (live scheduler, Vault,
   analysis queue), and as the Federation service's last command the main database is cleared in **one transaction**
   (games, rating ledger, analyses, Academy, Grimoire/Vault progress, Federation world, economy) and the new career
   record (rating 0) is written; the app reloads. Display preferences (localStorage) are kept.

**The Federation restarts with the new career**: the career is the player's identity in the Federation (division,
titles, trophies, rivals, money), so keeping the old world with a 0-rated stranger in it would be incoherent. The new
career founds a new Federation and joins its lowest division (tested). The old career can be brought back exactly by
importing its backup into an empty career (tested from the archive copy).

Tests: `tests/career.test.ts` (17), `tests/storage.test.ts`; journey `e2e/new-career.mjs` (desktop and 390 px).

## 7. v1.1 Grand Classical update: long time controls and the career pool (crown-career-pool-1)

### 7.1 Time controls
Human-rated play needs a base of **at least 30 minutes** with a Fischer increment (added to the clock of the player
who completes a legal move):

| Preset | Base + increment | Plain language |
|---|---|---|
| Extended Rapid | 30+30 | 30 minutes per player, plus 30 seconds after every completed move |
| **Classical (default)** | **60+60** | 60 minutes per player, plus 60 seconds after every completed move |
| Grand Classical | 90+60 | 90 minutes per player, plus 60 seconds after every completed move |
| Crownmaster | 120+90 | 120 minutes per player, plus 90 seconds after every completed move |
| Marathon | 180+120 | 180 minutes per player, plus 120 seconds after every completed move |
| Eternal Crown | 240+120 | 240 minutes per player, plus 120 seconds after every completed move |

* **Custom:** base 30–240 minutes, increment 0–120 seconds. It is **rated** when it lies inside the presets' envelope
  (base 30–240 min **and** increment 30–120 s) and then joins the same pool; otherwise (e.g. 45+0 sudden death) it is
  casual. `isRatedControl` / `poolFor` in `src/games/types.ts`.
* The last selected control is remembered (meta `pref:timeControl`); new profiles start at Classical 60+60. Play
  and Quick Match share one selector state.
* **Older controls** (Blitz 3+2, Rapid 5+3, Classical 15+10, Untimed) remain available, unchanged and with their
  original labels, **for casual games only**. No shorter control was renamed. Historical games store their own clock
  definition and are always shown with it.
* Entry points: Play (rated/casual vs the calibrated ladder), Random Quick Match (the remembered control), Rivals
  challenges/rematches (Classical 60+60), Federation fixtures (§7.4). Practice hand-offs and sparring stay casual.
* **AI thinking budget is separate from the clock** (`allocateTime` in `src/engine/levels.ts`, unchanged): an engine
  never thinks longer than its profile's cap — L1–L7 and beginners 0.4–2 s, L8 and Federation profiles 6 s, L9
  Sovereign Unbound 10 s in rated games (casual budgets up to 60 s). With 30+ minute clocks the cap always decides,
  so longer controls never weaken (or strengthen) an engine, and the search runs in a worker so the UI never freezes
  (tested in tests/grandClassical.test.ts).
* Clocks show h:mm:ss from one hour (`4:00:00`), m:ss below, tenths under 20 s; low-time warning at 10 % of the base
  (between 20 s and 5 min), critical under 20 s; running-side indicator, time-control name and increment, paused /
  resumed status on the match screen.

### 7.2 Rating-pool policy
* **One career pool, `classical-long` ("Long Classical")**, for every rated game of 30+ minutes. The career Elo shown
  everywhere (identity header, Play, Quick Match, Passport, ranks and percentiles, Vault facts and insignias, trophies
  and milestones, Played Like comparisons, the Federation's player rating for pairings, divisions and ranks, Start New
  Career, backups) reads it through ONE module, `src/ratings/pools.ts` (`CAREER_POOL`, `CrownDB.careerRating()`,
  `careerTimeline()`). No surface names a pool literally.
* **Legacy pools** `rapid`, `blitz`, `classical` (15+10) keep their full histories and states, shown under Career
  Passport → rating pool as "Rapid (legacy)" etc. No new game is rated in them; a game that was already in progress
  when v1.1 was installed finishes in the pool it was created with (an in-progress match is never changed).

### 7.3 Seeding (once per existing career)
* When a database opens and the career pool has **never been written** (no state, no events) and the Rapid pool
  (the career Elo until v1.0) has rated games, the career pool is seeded in one transaction from the player's current
  measured Rapid rating: **rating kept, RD = max(current RD, 150), volatility σ kept, rated-game count carried** (so
  an established player is not made provisional by the move; W–D–L start at 0 and count Long Classical games only).
  This is standard Glicko practice when a player moves to a new pool: the estimate carries over and its uncertainty
  grows. Nothing is fabricated: no result is invented and no rating moves.
* The seed is recorded with provenance on the pool state (`PoolState.seed`: source pool, time, source rating/RD/σ,
  games, last event id, rule) and in the meta record `careerPoolSeed`. It is **never repeated**: once the pool state
  exists it is only changed by rated results. `add()` aborts the transaction if another tab seeded first.
* **New careers** (package N rule, §1) have no Rapid games: their career pool is not seeded and starts at the career
  origin, **0 ±350** (legacy careers that never played Rapid start at their 1500 origin, as for any unplayed pool).
* The career timeline (charts, peaks, insignias, milestones) is the Rapid history up to the seeding point followed
  by the career pool's own events; because the pool continues the Rapid rating (and the game count), this is one
  continuous line (`careerTimeline`).
* Backups: the seeded state and its provenance are exported; validation replays the career pool from its seed and
  checks the seed against the Rapid ledger. A pre-v1.1 backup restored into an empty profile is seeded exactly as an
  upgrade would. Merging into another career still imports no rating events.
* No duplicate rating updates: finalization is unchanged (one event per game id and pool, atomic, idempotent).

### 7.4 Federation transition rule
* The clock of a Federation fixture is fixed **when the fixture's game record is created** (when the player first
  opens the fixture). A fixture game created before v1.1 — in progress or finished — keeps Rapid 5+3 and its Rapid
  pool. Every fixture game created from v1.1 on is **Classical 60+60, rated in the career pool**. The fixture row
  shows the clock that applies.
* No event's rules change mid-event: formats, pairings, scoring, tiebreaks, prizes, schedules and the AI-vs-AI
  simulation never depend on the player's clock. Pairings, divisions and ranks use the player's career-pool rating,
  which continues the Rapid rating (§7.3), so no event sees a jump at the transition.
* Pause on exit applies to fixtures like any human-vs-AI game (docs/SAVE_FORMAT.md); it never pauses the Federation's
  rounds, spectator games or markets.

Tests: `tests/grandClassical.test.ts` (presets, minimum, default, remembered control, increments, flag, mate and
stalemate with clocks, formatting, pause/resume, backgrounding, heartbeat reload during the human and engine turns,
duplicate submission, interrupted save, AI budget, update policy, seeding of v0.9 and v1.0.0-rc.1 saves, idempotency,
no duplicate ratings, backup round trip, Federation transition); journey `e2e/grand-classical.mjs`.
