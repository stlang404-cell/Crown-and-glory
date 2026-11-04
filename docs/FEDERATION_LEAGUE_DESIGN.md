# Federation leagues, ratings and progression: audit, design and migration plan

Status for v0.8.0: **audit and design only.** The league rebalance, the new rating classifications and the
sub-800 competitor population are **planned for the next milestone** (v0.9). Nothing below changes v0.8.0 saves.
The priority order (repair Analysis/Passport, verify animation and sound, finish the engine benchmarks) was done
first; a league migration touches every save and was not safe to ship unverified.

## 1. What exists today (measured from the code and a freshly founded federation)

| System | What it is today | Where |
|---|---|---|
| Rating | Glicko-2 (rating, RD, volatility) per player pool; federation competitors carry a public Glicko-2 rating updated only from results | `src/ratings/`, `src/federation/model.ts` |
| Rating rank (descriptive label) | 6 bands: Club (< 1300), District (1300), Regional (1500), National (1700), Master Circuit (1900), Crown Contender (2100+); "Provisional" while RD is high | `src/ratings/ledger.ts` `RANKS` |
| Divisions | **8**: 1 Crown, 2 Grand, 3 Premier, 4 Masters, 5 Senior, 6 District, 7 Club, 8 Open | `src/federation/model.ts` `divisionLabel` |
| Regional circuits | **16 regions** (Ashmere … Pellmoor); each division is 16 regional leagues of 16 competitors ⇒ 8 × 16 × 16 = 2,048 | `REGIONS`, `DIVISION_SIZE` |
| Promotion / relegation | Season end: top 2 / bottom 2 of each regional league move between adjacent divisions of the same region | `src/federation/world.ts` season end |
| Tournaments | League (15 rounds), Swiss events (rounds 4–8), Club Weekend (10–11), Crown Championship knockout (16–19) | `model.ts` round constants |
| Federation titles (permanent) | 4: Squire, Knight, Paladin, Sovereign — earned by performance norms, kept forever | `src/heraldry/catalog.ts` `FED_TITLES`, `src/app/heraldry.ts` |
| Event titles, trophies, achievements, financial tiers | Hall of Fame, ceremonies, cosmetics | `src/app/heraldry.ts`, `src/economy/` |
| Engine strength scale | Calibrated L1 800 … L9 3038 (500 engine-vs-engine games, L1 anchored at 800 by design; not FIDE) | `src/engine/calibration.json` |

**"Sixteen Circuit Grades" do not exist in the game.** The number sixteen in the federation is the 16 regional
circuits per division. No grade ladder, grade titles or grade achievements exist in code or saves, so there is
nothing to preserve or migrate; if a 16-step ladder is wanted it must be designed as a new system (see § 4) and
must not duplicate divisions or titles.

### Population (founded federation, seed 4242, `npx tsx tools/sim/population_audit.mts 0`)

| Public rating | Competitors |
|---|---|
| 1–399 | **0** |
| 400–799 | **3** |
| 800–999 | 33 |
| 1000–1199 | 159 |
| 1200–1399 | 248 |
| 1400–1599 | 277 |
| 1600–1799 | 283 |
| 1800–1999 | 270 |
| 2000–2199 | 248 |
| 2200–2399 | 261 |
| 2400–2599 | 202 |
| 2600–2799 | 61 |
| 2800–2999 | 3 |

Min 705 · 5th percentile 1112 · median 1813 · 95th percentile 2556 · max 2855. Hidden engine strength (latent)
starts at 800 because **no engine profile weaker than L1 (800) is calibrated**.

| Division | Rating min / median / max |
|---|---|
| 1 Crown | 2054 / 2496 / 2855 |
| 2 Grand | 1952 / 2313 / 2680 |
| 3 Premier | 1675 / 2114 / 2560 |
| 4 Masters | 1513 / 1905 / 2482 |
| 5 Senior | 1256 / 1721 / 2078 |
| 6 District | 1088 / 1539 / 2003 |
| 7 Club | 1021 / 1360 / 1718 |
| 8 Open | 705 / 1158 / 1522 |

**Findings**

1. The bottom of the scale is empty: nobody below ~700, and the weakest opponent anywhere is the 800 L1 engine.
   A new player rated 1500 provisional starts above most of the Open division.
2. Rating label "Club" (< 1300) collides with the "Club Division" (7) and with clubs (ownership). "District"
   collides with the "District Division" (6). Rank labels and division names therefore disagree for most players.
3. Divisions overlap heavily (expected for leagues), but the labels imply a ladder of strength that the ranks do
   not follow.
4. Promotion is regional top-2 per season: a player needs ~7 seasons minimum to climb from Open to Crown. Reasonable;
   relegation exists; there are no promotion play-offs.

## 2. Rating classifications (descriptive bands — proposal for v0.9)

Separate concepts, each with one name:

| Concept | Meaning | Example |
|---|---|---|
| **Rating** | Glicko-2 estimate of strength on the Crown scale (not FIDE) | 1712 ± 64 |
| **Classification** | Descriptive band of the rating; changes freely; never a title | "Advanced" |
| **Division** | League membership, changed only by promotion/relegation | "Masters Division" |
| **Federation title** | Permanent achievement by norms | "Knight" |
| **Event titles / trophies** | Won events | "Ashmere Swiss champion" |
| **Financial prestige** | Economic tier | coin tiers |

Proposed classification table (refined from the directive's draft; labels avoid FIDE title words such as
"Master"/"Grandmaster" so the game never implies an official title, and avoid "Club"/"District", which are
division names):

| Crown rating | Classification | Note |
|---|---|---|
| 1–99 | First Steps | |
| 100–199 | Beginner | |
| 200–399 | Novice | |
| 400–599 | Apprentice | |
| 600–799 | Developing | |
| 800–999 | Improver | was draft "Club Novice" (collides with Club Division) |
| 1000–1199 | Regular | was draft "Club Player" |
| 1200–1399 | Intermediate | |
| 1400–1599 | Competitive | |
| 1600–1799 | Advanced | |
| 1800–1999 | Expert | |
| 2000–2199 | Candidate | was draft "Master Candidate" (FIDE title word) |
| 2200–2399 | Elite | was draft "Master Class" |
| 2400–2599 | Senior Elite | was draft "Elite Master" |
| 2600–2799 | Champion Class | was draft "Grandmaster Class" (FIDE title word) |
| 2800–2999 | Super-Elite | |
| 3000+ | Sovereign Class | no cap; "Sovereign" is also the top Federation title — keep the word "Class" visible |

Migration: classifications are computed, never stored, so changing the table rewrites nothing. Historical rating
events keep the rank string recorded at the time (`rankBefore`/`rankAfter`) and are shown as recorded, labelled
"label at the time".

## 3. Divisions (proposal for v0.9)

Keep the eight existing division identities (names, heraldry, history, ceremonies, saved standings all reference
them) and attach the directive's rating guidelines as **matchmaking benchmarks**, not assignment rules:

| Division | Guideline (v0.9 target, after the sub-800 population exists) | Directive name candidate |
|---|---|---|
| 8 Open | 1–399 entry; anyone may enter | Foundation |
| 7 Club | 400–799 | Bronze |
| 6 District | 800–1199 | Silver |
| 5 Senior | 1200–1599 | Gold |
| 4 Masters | 1600–1999 | Platinum |
| 3 Premier | 2000–2399 | Diamond |
| 2 Grand | 2400–2799 | Crown (name clash with division 1 — keep "Grand") |
| 1 Crown | 2800+ | Sovereign (clashes with the Sovereign title — keep "Crown") |

Renaming divisions to metals would duplicate existing identities and clash with "Crown" and "Sovereign"; the
recommendation is to **keep the current names** and show the guideline beside them. If the metal names are still
wanted, they can be added as display aliases in v0.9 with a one-time explanation; stored division numbers never
change, so no save migration is needed for names.

Promotion/relegation additions for v0.9 (each needs simulation before shipping): promotion play-off for 3rd/4th
place; relegation play-out for 13th/14th; division champion trophy; anti-farming — league points only from league
fixtures (opponents are assigned, not chosen), tournament prize money only for events at or above the player's
division guideline, and repeat-opponent rewards capped per season.

## 4. "Circuit Grades" (only if wanted — new system, v0.9 or later)

A 16-step career ladder would be a new progression system. To avoid a redundant ladder it should measure
something divisions and titles do not — e.g. **career milestones** (games completed, events entered, norms
attempted) — two per division band, purely additive, earned once and never revoked. It needs its own design
review; it is not implemented and no existing data refers to it.

## 5. Sub-800 competitors (v0.9 engine work)

Requires genuinely weaker play, calibrated by games (never by assigning low numbers to strong engines):
1. Beginner profiles: L1 search plus calibrated error models — move choice by softmax over shallow scores with a
   temperature, a per-move blunder probability (pick among the bottom half of legal moves), and "missed threat"
   (ignore opponent's best reply) — each a legal-move policy, no result predetermination.
2. Calibrate with engine-vs-engine round robins against L1 and each other (Bradley–Terry, as for L1–L9), anchored
   to the existing L1 = 800 so the scale stays continuous; target steps of ~150–200 points down to the floor.
3. Population: extend the generator's latent distribution below 800 for divisions 7–8 once profiles exist;
   ratings converge from results (no rating floor other than Glicko-2 itself; no cap at 3000).
4. Acceptance: a rating-1 (floor) competitor exists, plays legal games, loses most games to 400-rated ones; a new
   player can start in Open and meet suitable opponents.

## 6. Migration plan (v0.9)

| Step | Saves touched? | Safety |
|---|---|---|
| Classification table | No (computed) | historical labels shown as recorded |
| Division guidelines / aliases | No (division numbers unchanged) | |
| New beginner competitors | Yes: new competitor records added at season start | additive only; existing competitors, ratings, titles, histories untouched; `crown-federation-1` → `-2` migration with a pre-migration backup and the v0.4/v0.5 migration journeys extended |
| Play-offs / play-outs | Yes: new fixture kinds | old seasons keep their recorded results; new rules start next season |
| Circuit grades (if adopted) | Yes: new additive records | earned from the start of adoption, never back-filled silently |

## 7. Scale
2,048 competitors: create 0.73 s, round 0.35–0.73 s, save 1.23 MB (`tools/sim/scale_probe.mts`). Growing to
10,000 multiplies round time and save size ≈ 5×; not attempted in v0.8. Before any increase: lightweight career
records for inactive competitors, simulated (not engine-played) results for non-featured fixtures (already the
case), and a measured mobile budget.
