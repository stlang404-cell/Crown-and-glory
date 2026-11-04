# Circuit Grades: the 16-rank feudal hierarchy (crown-circuit-grades-1, v0.11 package P)

Code: `src/federation/rankNames.ts` (names), `src/federation/ranks.ts` (rule, records, migration, read API),
`src/heraldry/ranks.ts` (insignia), `src/app/ranks.ts` (ceremonies, live standing), `src/ui/RankScreen.tsx` (rank guide,
`#/ranks`), `src/ui/RankBadge.tsx`. Tests: `tests/ranks.test.ts`. Simulation: `tools/sim/ranks_sim.mts`
(reports in `docs/sim/ranks_*.json`, summarised by `node tools/sim/ranks_summary.mjs docs/sim/ranks_*.json`). Journey:
`e2e/ranks.mjs`.

## 0. Status of the names (read first)

**APPROVED (v0.11 package Q).** The owner approved the 16 names below and the 48 sublevels (III → II → I) exactly as
they are; `CIRCUIT_GRADE_LIST_STATUS = 'approved'` in `src/federation/rankNames.ts`. (History: the owner referred to an
approved 16-rank hierarchy that was never delivered, so package P wrote this list as a proposal; the owner then
approved it unchanged.) The ids are stable and the names live in that one module; everything else refers to the id or
the index, so saves never depend on a name.

| Id | Grade (approved name) | Division | Steps (III · II · I) |
|---|---|---|---|
| cg-01 | Commoner | 8 Open | 1 · 2 · 3 |
| cg-02 | Page | 8 Open | 4 · 5 · 6 |
| cg-03 | Squire | 7 Club | 7 · 8 · 9 |
| cg-04 | Man-at-Arms | 7 Club | 10 · 11 · 12 |
| cg-05 | Knight | 6 District | 13 · 14 · 15 |
| cg-06 | Knight Banneret | 6 District | 16 · 17 · 18 |
| cg-07 | Baronet | 5 Senior | 19 · 20 · 21 |
| cg-08 | Baron | 5 Senior | 22 · 23 · 24 |
| cg-09 | Viscount | 4 Masters | 25 · 26 · 27 |
| cg-10 | Earl | 4 Masters | 28 · 29 · 30 |
| cg-11 | Marquess | 3 Premier | 31 · 32 · 33 |
| cg-12 | Duke | 3 Premier | 34 · 35 · 36 |
| cg-13 | Grand Duke | 2 Grand | 37 · 38 · 39 |
| cg-14 | Prince | 2 Grand | 40 · 41 · 42 |
| cg-15 | King | 1 Crown | 43 · 44 · 45 |
| cg-16 | High Sovereign | 1 Crown | 46 · 47 · 48 |

Sublevels are a separate value, ordered **III → II → I** (III lowest): 48 steps, Commoner III (step 1) … High
Sovereign I (step 48). Labels are always full ("Knight II"). Grade ids are never renumbered.

**Competitive Rank vs Federation Title (owner decision, package Q).** "Squire" and "Knight" are both Circuit Grades
and two of the four permanent *Federation Titles* earned by norms (Squire, Knight, Paladin, Sovereign;
`src/heraldry/catalog.ts`). The names are kept; instead the two concepts are always displayed apart
(`src/ui/RankBadge.tsx`):

| | Competitive Rank | Federation Title | Rating title |
|---|---|---|---|
| What | Circuit Grade + sublevel ("Knight II") | Squire · Knight · Paladin · Sovereign | Name of the 100-point Career Elo band |
| Changes | Up and down by season (checkpoints, promotion/relegation) | Earned by norms, permanent, never lost | With every rating change |
| Label | "Competitive Rank: Knight II" | "Federation Title: Knight" | "Rating title" |
| Insignia | Grade insignia with sublevel chevrons, square steel-blue frame with a chevron (`--rank-tone`) | Title standard in a round gold double-ring medallion with a star (`--title-tone`) | Dashed frame |
| Tag (kept in compact rows) | `RANK` | `TITLE` | `RATING` |
| Tooltip | `RANK_TOOLTIP` | `FED_TITLE_TOOLTIP` | `RATING_TITLE_TOOLTIP` |

Shown apart in: the identity header (separate "Competitive Rank" and "Federation Title" areas), the Dashboard/Profile
rank heading, Career Statistics (current/highest Competitive Rank and Federation Title as separate stats), Career
Standing, Competitor list rows/profile/scouting dossier, league tables, Hall of Fame, Rivals, the Live Match Center,
Exhibitions, the Heraldry gallery (separate Competitive Rank, Rating Ladder and Federation Title sections) and
ceremonies (headlines "Competitive Rank: …" / "Federation Title: …"; stored ceremony titles are unchanged). Compact
rows abbreviate (insignia or "KT") but always keep the tag and an accessible label.

The data were already independent (`rank` and `fedTitle` are separate fields; checkpoints never read or write
`fedTitle`, `awardNorms` never reads or writes `rank`); `tests/rank-title-independence.test.ts` verifies it: rank
Knight II with title Squire and rank Squire III with title Knight are both valid; a full season of checkpoints,
promotions and relegations leaves every title as it was; earning a title leaves every rank and highest-rank record as
it was.

**Concepts kept separate:** a Circuit Grade is a *rank*. It is not the Career Elo (the Glicko-2 rating), not Played
Like Performance Elo, not a rating title (100-point bands), not a Federation title (norms) and not the division
(although it is tied to it). Copy and code never mix them (`RANK_TOOLTIP` in `src/ui/RankBadge.tsx`).

## 1. Audit of the existing promotion/relegation rules (before this package)

Read from `src/federation/world.ts`, `formats.ts`, `model.ts`, `driver.ts`, `src/app/federation.ts`, docs/V3_COMPETITION_RULES.md.

| Rule | As implemented |
|---|---|
| Structure | `topology.regions` regions × 8 divisions × 16 competitors (2,048 / 4,096 / 10,240). Division 1 = Crown … 8 = Open. |
| League | 15-round single round robin per regional circuit, rounds 1–15; scoring 1 / ½ / 0; order points → head-to-head → Sonneborn–Berger → pre-season seed. |
| Promotion / relegation | Season end only (after round 19), simultaneous between adjacent divisions of the same region: places 1–2 up (not from division 1), places 15–16 down (not from division 8). Nothing else moves a division. |
| Swiss | Federation Open (divisions 2–4) and Challenger Open (5–8), rounds 4–8, 32 players; the player may register (25 ₵ or a voucher). Results do not affect division. |
| Championship | Rounds 16–19, 16 qualifiers (8 best Crown Division winners + top 8 of the Open). No effect on division. |
| Club Weekend | Rounds 10–11, only for a player who owns a club (bought with fictional money). Rated games. |
| Player entry | `joinPlayer` puts the player in division 8 of the chosen region; the lowest-rated member becomes a reserve and re-enters at the first retirement (into the retiree's slot, whatever its division). |
| Turnover | Retirements at season end (age based); each vacated slot is filled by an entrant **in the retiree's own division** (rating calibrated to that division). The code comment "entrants fill vacated slots in each region's bottom division" in `endSeason` does not match the code: entrants go to the retiree's division. (Not changed here; reported.) |
| Stored history | Competitor: `{season, region, division, rank (league place), points, played, rating (end of season), earnings}` per season. Player: `{season, division, rank, points}` per season (no rating, no games played). Round records of every season are kept (`rounds` store). No mid-season tables are stored. |
| Ranks before v0.11 | None. "Rank" in the Passport meant the rating-band ranks (Provisional, Club, District … Crown Contender) — renamed on screen to "Rating Band History" to avoid confusion. |

Consequences for the design: division is the only competitive tier with a rule; within a division the existing data
give league place, points, sanctioned event results and rating; any finer rank must be derived from those, at fixed
times, and must leave promotion/relegation exactly as they are (packages K/I own them).

## 2. The rule

1. **Division decides the pair of grades.** Division d owns steps `(8 − d)·6 … (8 − d)·6 + 5`: its lower grade
   III/II/I and its upper grade III/II/I. A rank is always inside its holder's division (tested every round).
2. **Division moves follow the existing season-end promotion/relegation** (unchanged). Promotion lands on the new
   division's **lower grade III** (e.g. Open → Club: Squire III) with demotion protection at the next checkpoint;
   relegation lands on the lower division's **upper grade III** (e.g. Club → Open: Page III): the senior grade of the
   lower division, its sublevels to be re-earned.
3. **Checkpoints:** after **round 8** (mid-season: eight league rounds and the whole Swiss) and at **season end**
   (after round 19, evaluated in the division the season was played in, before promotion/relegation).
4. **Standing score** (0–100, `standingScore`):
   * 45 % **league position**: 1 − (place − 1)/15 (1st = 1, 16th = 0) from the live league table;
   * 25 % **results**: score fraction in **sanctioned rated games** of the season so far — league, Federation Open,
     Challenger Open, Crown Championship and, under crown-competition-2 (package K), the **Zonal Championships**
     (`zonal-…`) and **Regional Cups** (`cup-…`), whose fields qualify by results with no entry fee (`SANCTIONED`). Wins
     and losses count; a forfeit counts as the recorded loss (no game, no rating change, but a zero in the table and in
     this part); a **postponed** league game (K's rule: ≤ 2, due by round 15) counts when played — while the player has
     one pending, the mid-season checkpoint can raise but not lower the player (the table is missing that game);
   * 30 % **rating within the division**: percentile of the Federation (Glicko-2) rating among all members of the
     same division federation-wide (the "division band", taken from actual ratings, so it works for every population
     model).
   A part with no data yet is omitted and the weights renormalised.
5. **Movement inside the division, at each checkpoint** (`checkpointStep`): local step k (0–5) is reached at a score of
   **0 / 30 / 42 / 54 / 64 / 76**. Up one step if the score reaches the next mark; down one step only if it is below
   the current step's mark minus **12** (hysteresis); **at most one step per checkpoint**; **no step down at the
   checkpoint right after any step up** (protection); **no step up from the league's relegation places** (15th–16th),
   so a career that forfeits every game cannot rise on its rating alone.
6. **Never counted:** exhibitions, unrated, assisted, practice, sandbox and quick-match games (they are not Federation
   fixtures, and the results part reads only the sanctioned events); the Club Weekend (a hosted event the player pays
   for). **Nothing can be bought:** no balance, purchase, asset, cosmetic, club level or sponsorship is an input.
   Honest caveat: entry to the Challenger/Federation Open costs 25 ₵ (an existing rule) and the Club Weekend's rated
   games move the Glicko-2 rating; money buys the chance to play, never points — a poor result lowers the score
   (tested: identical results with different purchases give identical ranks).
7. **New careers** start at **Commoner III**: package N's single new-career record `newCareerRecord` carries
   `rankStart = CAREER_RANK_START` (cg-01, III), and the Federation founded for the career applies it
   (`initialPlayerRank`, `INITIAL_STEP`, set in `FederationService.create` after `joinPlayer`; tested equal). Start New
   Career clears the Federation stores, so the next founding starts again at Commoner III; the previous career's rank
   and highest rank survive only in its archived backup. The rank does not depend on the starting rating (0 or 1500). **AI entrants** start at the lowest step of the division they enter. A **new world's
   founding competitors** are seeded from their rating percentile within their division (`seedLocal`, no hysteresis):
   a starting rank, not an achievement.

## 3. Highest rank ever achieved

* Stored with the record: player `rank.highest = {step, season, round, via}`; competitor `rank[2]` (step) and
  `rank[3]` (season first reached).
* Raised only by a genuine step up (checkpoint or division promotion), or when a competitor is placed on a higher step
  by a Federation rule (the reserve's re-entry) — i.e. only to a rank actually held. **Never lowered**: demotion,
  relegation, rating losses, season changes and division changes do not touch it (tested across three simulated
  seasons for every competitor and the player, and with a forced losing streak).
* `via`: `start` (starting rank), `checkpoint`, `promotion`, `replay` (reconstructed from stored season records at
  migration).

## 4. Thresholds and the simulation that chose them

`tools/sim/ranks_sim.mts` runs a headless federation (crown-population-2, the population of new federations) with the
live rule and a player of fixed strength, records every checkpoint's standing score and division moves (scores do not
depend on the rank rule, since ranks never feed back into results), then replays candidate rules offline on exactly
the same seasons. The offline replay of the shipped rule matched the live engine's stored ranks exactly in every run
(`liveVsReplayMismatches: 0`).

Runs: 2,048 competitors × 30 seasons (seed 4242, players 1,100 / 1,800 / 2,600; seed 777, player 1,800) and 10,240
competitors × 6 seasons (seed 4242). Metrics: share of competitors whose step changes at a checkpoint; share of moves
**reversed at the very next checkpoint** (oscillation); share of steps 0–5 within divisions; checkpoints a competitor
needs from a division's bottom step to its top step.

| Rule (2,048 × 30 seasons, seed 4242) | Step changes / checkpoint | Moves reversed next checkpoint | Local step share (0…5) | Bottom→top of a division (median, p10–p90 checkpoints) |
|---|---|---|---|---|
| **Shipped** (0/30/42/54/64/76, hysteresis 12, protection, one step) | 0.441 | **0.049** | .22 .14 .18 .22 .14 .11 | 11 (5–23) |
| No hysteresis, no protection | 0.622 | 0.278 | .28 .15 .18 .20 .11 .07 | 11 (5–24) |
| Hysteresis 12, no protection | 0.470 | 0.132 | .22 .14 .18 .22 .13 .10 | 11 (5–23) |
| Jump straight to target (no cap, no hysteresis) | 0.569 | 0.394 | .30 .14 .13 .21 .13 .09 | 5 (1–17) |
| Even marks 17/33/50/67/83 | 0.422 | 0.042 | .17 .10 .24 .28 .17 **.05** | 12 (6–25) |
| Hysteresis 4 / 8 / 10 | 0.510 / 0.475 / 0.458 | 0.085 / 0.066 / 0.058 | — | 11 |
| Hysteresis 15 / 20 | 0.414 / 0.375 | 0.038 / 0.024 | — | 11 / 10 |
| Relegation lands on upper grade I | 0.397 | 0.063 | .22 .13 .18 .12 .13 .23 | 11 (5–24) |

Seed 777 and the 10,240 run agree within ±0.01 (10,240: shipped 0.433 changes, 0.047 reversed; no hysteresis 0.616 /
0.265; full tables in the JSON reports).

Why these values:
* **Hysteresis + protection** cut oscillation from 28 % of moves (no hysteresis) to **4.9 %** (2.2 % of
  competitor-checkpoints); protection alone halves what hysteresis leaves (13.2 % → 4.9 %). 12 is the knee: 15–20
  lower oscillation only a little more but make demotion very rare (a step-1 holder would need a score under 10–15).
* **One step per checkpoint** keeps a division's ladder meaningful (median 11 checkpoints ≈ 5½ seasons from lower
  grade III to upper grade I for those who get there; jumping to target gives 5 checkpoints and 39 % reversals).
* **Uneven marks** make the top steps rarer (upper grade I ≈ 11 % of a division) while even marks leave only 5 % at
  the top and pile 28 % on upper grade III.
* **Relegation to upper grade III** (not I) keeps relegated competitors below the division's steady leaders and
  leaves upper grade I to those who earned it there (23 % would sit at the top step otherwise).

Distribution across the population: divisions are equal-sized by the league rules, so each grade holds about 1/16 of
the Federation (2,048: 110–149 per grade; 10,240: 597–682), the lower grade of each pair slightly fuller than the
upper. Per-step counts are in the reports (`perStep`).

Time to climb (player of fixed strength, 2,048, seed 4242): the division structure dominates — at most one division
per season. 2,600: Squire at S1 end, King at S7 end, High Sovereign at S9 mid-season, High Sovereign I by S30.
1,800: Squire S1, Viscount S4, Grand Duke S6, Prince first at S16 (the Grand Division is around its level); highest
Prince III. 1,100: Knight S2, Baronet S4, highest Baron III (S23), settling in Knight Banneret (District/Senior border).
At 10,240 the 1,800 player reached Marquess I after 6 seasons.

Cost: a checkpoint at 10,240 competitors took **189 ms** in node (shared 4-core VM, load average 12; 640 league tables,
8 division percentile sorts), twice a season (rounds 8 and 19). Storage: a competitor's rank is a 5-number tuple (< 30
bytes of JSON on average, tested).

## 5. Records and save format (additive, no version bump)

* `Competitor.rank?: [step, protect, highestStep, highestSeason, lastScore×10]` (stored in the existing competitor
  chunks).
* `WorldState.player.rank?: PlayerRank` = `{rule, step, protect, highest, last, log (≤ 200 step changes), origin}`.
* `Ceremony.kind` gains `'rank'` (one card per rank change; a division promotion adds the new grade to its own card).
* Backups carry both unchanged (tested round trip).

## 6. Insignia

`gradeEmblem(grade, sublevel)` with the heraldry grammar: **shape = the division's shield** (same as its division
emblem), **charge = the grade** (pawn, quill, key, sword, knight, flame, rook, scales, moon, griffin, star, chalice,
laurel, sun, king, crown — none equal to its division emblem's charge), field = the division's tincture (the upper
grade adds a gold chief), border/crest/wreath/prestige rise with the division, and **marks = sublevel chevrons** (one
for III, two for II, three for I). Marks are a new optional `EmblemSpec.marks`, drawn at every size (pips are dropped
at 22 px; marks are thicker there) in the theme's text colour for contrast in all themes. 48 distinct signatures,
distinct from every other emblem family (tested). Accessible label: "Knight II: Circuit Grade 5 of 16, sublevel II
(step 14 of 48)".

## 7. Migration of existing saves (v0.4–v0.10)

Deterministic, at load, from stored data only (`migrateRanks` → `ensureRanks`); nothing is reset, nothing else in the
record changes (tested: ratings, divisions and histories identical; two loads give identical ranks):

* **Competitor with season history:** seeded at its first recorded season (an entrant at the lowest step of that
  division; a founding competitor from its earliest stored rating's percentile within that season's division), then
  the season-end checkpoint rule is replayed over each stored season record — position from the recorded league
  place, results from recorded points/played, rating percentile from the stored end-of-season rating among that
  season's division — with the recorded division moves applied between seasons.
* **Competitor without history** (first season): a founding competitor from its current rating percentile; an entrant
  at the lowest step of its division.
* **The player:** Commoner III at the first recorded division (division 8), then the same replay over the stored
  season records (place and points; the player's per-season rating is not stored, so that part is left out and the
  weights renormalised).
* **Current season:** if the mid-season checkpoint (round 8) has already passed, it is applied to the migrated records
  from the current season's stored games.
* Highest rank from a replay is marked `via: 'replay'` with the season it was reached; the seed is a starting rank.

**What can and cannot be back-filled:** every save keeps its round records and season records, so every save
(v0.4–v0.10) gets a rank and a highest rank from its own history. What cannot be reconstructed: mid-season checkpoints
of past seasons (no mid-season tables are stored), the Swiss/Championship part of past seasons' results (season
records hold league points only), the player's past ratings (not stored per season), and the exact round a historic
highest rank was first reached (recorded as season end). Saves therefore migrate with one checkpoint per past season
instead of two — a slightly more conservative rank than live play would have given, never an inflated one.

## 8. UI

* **Rank guide** `#/ranks` (`RankScreen`): current rank with large insignia, highest rank with season, standing score
  (live "if the checkpoint were now", or the last checkpoint's) and its three parts, a progress bar to the next step,
  the exact requirement for the next attainable rank, the division-promotion route, the demotion and protection rules,
  the marks table, all 48 steps grouped by division (current and highest marked), the rules, recent changes.
* Badges and tooltips (`RankBadge`, `RANK_TOOLTIP`): Career Passport (Career Standing), competitor profile (rank,
  highest rank, insignia row, scouting dossier with last standing score), competitor list, league tables (every row,
  the player too).
* Ceremony: one restrained card per rank change (the existing ceremony overlay; reduced motion respected by the
  existing `prefers-reduced-motion`/`data-motion="reduce"` rules).
* Founding screen and the season calendar mention Commoner III and the checkpoints.

## 9. Read API (for package I's identity header and package J's achievements)

**Wired (v0.11 merge):** package I's adapter `src/legacy/ranks.ts` discovers this module (`import.meta.glob` of
`src/federation/ranks*.ts`) and `src/ui/RankHeading.tsx` shows the current full rank with insignia and sublevel,
linked to `#/ranks`, with the Career Elo and division beside it, on the Dashboard and Profile headings; Profile →
Career Statistics shows the Highest Rank Ever (sublevel, season and round first reached, or "starting rank")
separately from current/highest Career Elo (Played Like highs and lows stay in the Played Like panel).

```ts
import { currentRank, highestRank, competitorRank, competitorHighestRank, rankOfId } from '../federation/ranks';
currentRank(fed.state)   // { step, gradeId, grade, rankName, sublevel: 'III'|'II'|'I', label, division, insignia, ariaLabel, joined }
highestRank(fed.state)   // same + { season, round, via } or null before a career
competitorRank(c)        // RankView | null;  competitorHighestRank(c) → RankView & { season } | null
rankOfId(fed.state, id)  // 'player' or a competitor id
```
`insignia` is an `EmblemSpec`: render with `<Emblem spec={r.insignia} size="sm" title={r.ariaLabel} />` or
`<RankBadge rank={r} />` (label + tooltip; `compact` for the insignia alone). All functions are pure and cheap (a
table lookup); they accept `null` state (Commoner III before a career).

## 10. Not done / open

* (Done in package Q: the names are approved; rank and title are displayed apart.)
* The relegation-places gate uses the bottom two of every league, including the Open Division (which has no
  relegation), so it is not K's `leagueZone` (which returns null there).
* Mid-season checkpoints of past seasons cannot be back-filled (§7).
* Rank-milestone achievements are left to package J (data: `highestRank`, `rank.log`).
* No dedicated rank filter on the competitor list yet (the rank is shown in every row).
