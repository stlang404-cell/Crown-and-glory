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
