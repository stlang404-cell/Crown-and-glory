# The Arcane Federation: rating titles, insignias, banner, achievements

| Part | v0.8.0 status |
|---|---|
| 100-point rating titles (31) | **Implemented** — `src/ratings/titles.ts`, tests `tests/ratingTitles.test.ts` |
| Insignias (heraldry grammar) | **Implemented** — 31 unique, prestige rises by era |
| Federation identity banner | **Implemented** — `src/ui/IdentityBanner.tsx`, desktop + phone verified in Chromium |
| Passport: current title, peak title, insignia collection | **Implemented** |
| Achievement framework + Sovereign Vault | **Implemented (v0.8.0, Vault v1)** — 134 collectibles: 83 earnable achievements, 9 Exchange titles, 31 insignias, 11 awaiting validated grading; see `src/vault/catalog.ts` (the catalog below was the design; the implemented set is in the code) |
| Ceremonies, collection sets, equippable identity | **PLANNED v0.9** |

## 1. Concepts (kept separate everywhere)

| Concept | Source | Changes when | Example |
|---|---|---|---|
| Federation rating | Glicko-2, Rapid pool (the rating the Federation uses for the player) | every rated Rapid game | 1,248 ±64 |
| Rating title + insignia | computed from the rating | crossing a 100-point line (follows the rating up and down) | Arcane Strategist |
| Peak title / insignia collection | computed from established rating history | first time an established rating reaches a band | collected 12/31 |
| Division / regional league | Federation season standings | promotion / relegation at season end | Open Division · Ashmere |
| Federation title | performance norms | earned once, kept forever | Knight |
| Event titles, trophies | tournament results | won once, kept forever | Ashmere Swiss champion |
| Achievements | recorded facts | earned once, kept forever | Giant Slayer |
| Financial prestige | net worth tiers | with the economy | coin tiers |

Rating titles are cosmetic descriptions of the current rating; they are never "earned honours". The game's
currency is the **crown (₵)**, fictional.

## 2. Rating titles (crown-rating-titles-1)

| Rating | Title | Era | Insignia charge |
|---|---|---|---|
| 0–99 | Wandless Wanderer | Apprentice | gate |
| 100–199 | First-Year Initiate | Apprentice | key |
| 200–299 | Candlelight Apprentice | Apprentice | flame |
| 300–399 | Spellbook Novice | Apprentice | book |
| 400–499 | Charmed Pawn | Apprentice | pawn |
| 500–599 | Potion Scholar | Apprentice | chalice |
| 600–699 | Wandcraft Student | Apprentice | quill |
| 700–799 | Hex Apprentice | Apprentice | moon |
| 800–899 | Arcane Challenger | Scholarly | sword |
| 900–999 | Rune Reader | Scholarly | book |
| 1000–1099 | Dueling Scholar | Scholarly | knight |
| 1100–1199 | Enchanted Tactician | Scholarly | star |
| 1200–1299 | Arcane Strategist | Scholarly | rook |
| 1300–1399 | Runic Tactician | Scholarly | key |
| 1400–1499 | Spellweaver | Scholarly | quill |
| 1500–1599 | Wardbreaker | Scholarly | gate |
| 1600–1699 | Mystic Duelist | Master | sword |
| 1700–1799 | Grand Enchanter | Master | star |
| 1800–1899 | High Arcanist | Master | tower |
| 1900–1999 | Archmage's Heir | Master | key |
| 2000–2099 | Royal Spellmaster | Master | queen |
| 2100–2199 | Grand Runemaster | Master | book |
| 2200–2299 | Elder Magister | Master | laurel |
| 2300–2399 | Crown Sorcerer | Master | crown |
| 2400–2499 | Supreme Arcanist | Legendary | sun |
| 2500–2599 | **Grand Runelord** (was "Grandmaster of Runes") | Legendary | griffin |
| 2600–2699 | Imperial Archmage | Legendary | king |
| 2700–2799 | Elder of the Crown | Legendary | crown |
| 2800–2899 | Sovereign Magister | Legendary | scales |
| 2900–2999 | **Astral Archon** (was "Astral Grandmaster") | Legendary | star |
| 3000+ (uncapped) | Eternal Sovereign | Sovereign | crown |

Refinements: two names avoid the FIDE title word "Grandmaster" so the game never implies an official title. All
names are original; no franchise names, houses or crests are used. Note that the Federation population currently
has nobody below ~700 and no engine weaker than 800 (docs/FEDERATION_LEAGUE_DESIGN.md), so the Apprentice era is
reachable only by the player's own rating until v0.9 adds calibrated beginner opponents.

**Rules (tested):** current title follows the current rating (marked "provisional" while the rating is provisional);
the collection holds every band an *established* rating has passed through (rising or falling between consecutive
established ratings), kept after a fall; bands below the first established rating are not collected; provisional
ratings never collect; the peak title is the band of the highest established rating. Everything is computed from
saved rating events, so reloads, migrations and re-analysis can neither duplicate nor erase it.

## 3. Insignia specification
Built from the existing heraldry grammar (`src/heraldry/`: shape · field division · tinctures · charge · border ·
crest · wreath · pips · prestige), drawn as local SVG at 22/44/104 px; locked insignias render greyscale at 35 %.

| Era | Ratings | Shape | Material (field) | Charge colour | Border | Crest | Wreath | Prestige |
|---|---|---|---|---|---|---|---|---|
| Apprentice | 0–799 | pennant | bronze wood + parchment | dark ink | single | — | — | 0 |
| Scholarly | 800–1599 | heater shield | steel + silver | silver | double | — | — | 1 |
| Master | 1600–2399 | kite (jewelled) | purple + garnet | gold | double | helm | — | 3 |
| Legendary | 2400–2999 | cartouche | azure + gold (celestial) | gold | pixel | star | yes | 4 |
| Sovereign | 3000+ | octagon | sable + gold | gold | pixel | crown | yes | 5 |

Within an era the charge (table above) and the field division (alternating) identify the title; pips (1–4) mark the
step within the era. Uniqueness of all 31 specs and non-decreasing prestige are unit-tested.

Shown in v0.8: identity banner, Passport (Rating Title card, Insignia Collection). **v0.9:** opponent profiles,
standings, leaderboards, tournament brackets, Live Arena player cards, rivalry screens (small 22 px insignia next to
the rating, using each competitor's public Federation rating).

## 4. Identity banner (implemented)
Insignia · title (+ "provisional") · rating ±RD · progress bar and "N to <next title>" · division and regional league
· cash (₵) · career Brilliant moves · last rated result and rating change · latest ceremony. Phone: insignia, title,
rating, cash and the progress bar; "More" reveals the rest. Hidden during live play and live spectating so the board
stays above the fold. Data: Rapid pool state and events, latest complete report per finished game (Brilliant count
never double-counts after re-analysis), Federation state; reloads throttled to once per 1.5 s.
The previous "0 / —" confusion came from the Passport's stat strip: game counts of unused pools and Peak/Lowest before
a rating is established; Peak/Lowest now says when it will appear.

## 5. Achievement framework (v0.9)

### Principles
* **Facts only:** each achievement is a pure function of saved records (games, rating events, reports, federation
  history, ledger, forecasts). Unlocks are stored as `{ id, at, evidence: { kind, ref } }` under a deterministic key
  `ach:<id>` and written idempotently (put-if-absent) — reloads, migrations and re-analysis never repeat or duplicate.
* **Event-driven:** evaluated on game finalisation, report completion, season/round end, trade settlement — only the
  achievements subscribed to that event, never a full history scan per move. Backfill once at migration.
* **Analysis-based achievements** count only complete reports from the current analysis build and grading version,
  latest report per game; and only once the grading is validated (until then they show as "awaiting validated
  grading", not locked forever).
* **Anti-exploit:** no rewards for volume alone (trades, purchases, sales, matches watched); wins against the same
  opponent count once per day toward win counters; asset achievements require holding for a season; forecasting
  skill requires a calibration sample (≥ 30 settled forecasts, Brier score better than market).
* **Rarity** from difficulty, reviewed after simulation: Common (most players in their first sessions), Uncommon,
  Rare, Epic, Legendary (top few percent of simulated careers), Mythic (exceptional; e.g. 3000 rating).
* **Rewards:** cosmetic (banner trims, portrait frames, insignia variants, board accents); currency only for a few
  career milestones, capped at ≤ 2 % of a typical season's earnings each (economy simulation must confirm).
* **Secret** achievements hide conditions until earned.

### Catalog (112; ids stable; ★ = already implemented in v0.5–v0.8 under the same id)

**A. Chess mastery (20)** — evidence: finalised game records, rating events
| id | Name | Rule | Rarity |
|---|---|---|---|
| first-win ★ | First Blood | win a finished game | Common |
| first-draw | Honours Even | draw a finished game | Common |
| wins-10 / 50 / 100 / 500 / 1000 | Ten / Fifty / Hundred / Five Hundred / Thousand Victories | rated or casual wins vs engines (once per opponent per day) | Common → Legendary |
| first-mate | The Final Spell | win by checkmate | Common |
| clean-sheet | Untouched | win without losing any piece or pawn | Rare |
| comeback | Turned Tide | win after being ≥ 3 pawns down in material at any point | Rare |
| upset-higher | Upward Duel | win vs an opponent rated higher (both ratings known) | Uncommon |
| giant-slayer ★ | Giant Slayer | win vs an opponent rated ≥ 200 higher | Rare |
| titan-slayer | Titan Slayer | win vs an opponent rated ≥ 500 higher | Epic |
| sovereign-unbound | Unbound Victory | win vs Sovereign Unbound at the rated budget | Legendary |
| sovereign-deep | Beyond Time | win vs Sovereign Unbound at ≥ 30 s | Mythic |
| streak-10 / 25 | Unbroken Ten / Twenty-Five | undefeated streak of rated games | Rare / Epic |
| perfect-event | Spotless Tournament | win a federation tournament without a loss | Epic |
| accuracy-90 | Precise Hand | a complete report with accuracy ≥ 90 over ≥ 20 graded moves | Rare |
| all-colours | Both Sides of the Board | 10 rated wins with each colour | Uncommon |

**B. Brilliance and analysis (14)** — evidence: latest complete report per game (validated grading only)
| id | Name | Rule | Rarity |
|---|---|---|---|
| brilliant-1 / 5 / 25 / 100 | First Spark / Five Sparks / Constellation / Starfield | career Brilliant moves | Uncommon → Legendary |
| brilliant-up | Spark Above | a Brilliant move in a win vs a higher-rated opponent | Rare |
| brilliant-final | Final Flourish | a Brilliant move in a tournament final | Epic |
| defence-critical | Last Ward | win a game with a critical defensive "only move" graded Best | Rare |
| analyses-10 / 100 | Student of the Game / Archivist | complete analyses of own finished games | Common / Rare |
| deep-review | Deep Reading | 10 games analysed at the Deep preset | Uncommon |
| played-like-high | Beyond Yourself | validated Played Like ≥ rating + 300, interval excludes rating | Epic |
| played-like-steady | Steady Hand | 10 consecutive estimated games within ±150 of rating | Rare |
| bookmarks-25 | Marginalia | 25 bookmarked positions | Common |
| retry-master | Second Chance | win 5 training retries from your own mistakes | Uncommon |

**C. Federation career (20)** — evidence: rating events, federation history
| id | Name | Rule | Rarity |
|---|---|---|---|
| first-title | Named | first established rating (first collected insignia) | Common |
| rating-500 / 1000 / 1500 / 2000 / 2500 / 3000 | Thresholds | established rating reaches the value | Common → Mythic |
| insignias-10 / 20 / 31 | Collector / Curator / Complete Heraldry | collected insignias | Rare / Epic / Mythic |
| promotion ★ | Ascent | promoted to a higher division | Uncommon |
| league-title ★ | Division Crown | win a regional league | Rare |
| crown-division | Crown Bearer | reach Division 1 (Crown) | Epic |
| champion | Crown Champion | win the Crown Championship | Legendary |
| title-defence | Crown Defended | win the championship in consecutive seasons | Mythic |
| relegation-recovery | Rise Again | promoted the season after a relegation | Rare |
| norm ★ | First Norm | first title norm | Rare |
| fed-knight / fed-paladin / fed-sovereign | Knighted / Paladin / Sovereign | Federation titles | Epic → Mythic |

**D. Rivals (10)** — evidence: rivalry records with persistent competitor ids
| id | Name | Rule | Rarity |
|---|---|---|---|
| rival-first | Old Score | beat a featured rival | Common |
| rival-bo5 | Best of Five | lead a rivalry 3+ wins after ≥ 5 meetings | Rare |
| rival-seasons | Long Feud | beat the same rival in 3 different seasons | Epic |
| ex-champion | Fallen Crown | beat a former champion | Rare |
| regions-8 / 16 | Wanderer / Grand Tour | win vs opponents from 8 / 16 regions | Uncommon / Epic |
| revenge | Redemption | beat a rival after losing 3 straight to them | Rare |
| nemesis | Nemesis | a rival you have beaten 10 times | Epic |
| regional-legend | Regional Legend | most wins vs one region's competitors in a season (≥ 8) | Rare |
| upset-feud | Underdog's Feud | beat a rival rated 200+ higher twice | Epic |

**E. Tournaments and spectating (14)**
| id | Name | Rule | Rarity |
|---|---|---|---|
| event-first | First Entry | register for a tournament | Common |
| swiss-podium ★ | Swiss Laurel | finish top 3 in a Swiss | Rare |
| semi / final / event-win | Last Four / Finalist / Champion of the Day | knockout stages, event win | Uncommon → Rare |
| multi-division | Across the Divisions | win events in 2 different divisions | Epic |
| underdog-champ | Against the Odds | win an event as ≤ 20 % pre-event favourite | Legendary |
| major | Major Honours | win a Crown Championship round-of-16 run | Legendary |
| watch-10 / 50 | Spectator / Connoisseur | watch complete featured games to the end (not skips) | Common / Uncommon |
| watch-analyse | Student Spectator | open the analysis of 10 settled Arena games | Uncommon |
| forecast-upset | Saw It Coming | settled forecast on an underdog (≤ 30 %) that won | Rare |
| arena-season | Season Ticket | watch featured games in every round of a season | Epic |
| club-weekend | Club Weekend Victor | win the Club Weekend | Rare |

**F. Exchange and forecasting (12)** — no volume rewards; wash/round-trip trades excluded
| id | Name | Rule | Rarity |
|---|---|---|---|
| trade-first | Opening Position | first settled position | Common |
| win-forecast | Right Call | first winning settled position | Common |
| underdog-forecast | Long Shot | profit on an outcome priced ≤ 25 % | Rare |
| hedge | Balanced Book | hold offsetting positions that reduce max loss ≥ 50 % then settle | Rare |
| season-profit | Profitable Season | positive exchange P&L over a season with ≥ 10 settled positions | Uncommon |
| forecaster ★ | Clear Sight | Brier score better than market over ≥ 30 forecasts | Epic |
| calibrated-100 | True Sight | same over ≥ 100 forecasts | Legendary |
| recover-trading | Back From the Red | profitable season after a losing season | Rare |
| no-ruin | Prudent Hand | five seasons without dropping below the recovery threshold | Rare |
| market-variety | Many Markets | profitable positions in 5 market families | Uncommon |
| early-read | First Mover | profit on a position opened before move 1 that settled 3+ rounds later | Uncommon |
| specialist | Specialist | Brier better than market within one market family (≥ 30) | Epic |

**G. Wealth, clubs, empire (12)** — assets must be held a full season; no buy/sell loops
| id | Name | Rule | Rarity |
|---|---|---|---|
| patron ★ | Patron of the Game | own a club | Uncommon |
| owner-2 / 3 | Holdings / Portfolio | hold 2 / 3 asset types for a season | Rare / Epic |
| business-positive | In the Black | an asset's season income exceeds its upkeep | Rare |
| near-ruin | Phoenix | recover from below the recovery threshold to ≥ 1,000 ₵ net worth | Rare |
| networth-5k / 25k / 100k | Wealth tiers | net worth milestones | Uncommon → Legendary |
| regional-patron | Regional Patron | club appeal ≥ 30 % for a season | Epic |
| club-level-3 | Grand Hall | club level 3 | Rare |
| empire | Sustainable Empire | 3 consecutive seasons with positive business income | Legendary |
| champion-owner | Owner-Champion | win a regional league while owning a profitable club | Epic |

**H. Exploration and legacy (10, some secret)**
| id | Name | Rule | Rarity |
|---|---|---|---|
| academy-set | Scholar | complete an Academy training set | Common |
| puzzles-100 / 500 | Puzzle Adept / Puzzle Sage | clean puzzle solves | Uncommon / Epic |
| full-season | Full Season | play every own fixture of a season | Uncommon |
| regions-played | Well Travelled | play in 3 different regions' leagues | Rare |
| comeback-run | The Long Road (secret) | win 5 straight after losing 5 straight | Epic |
| ten-seasons | Decade | 10 completed seasons | Legendary |
| all-collections | Archmage of the Federation (secret) | at least one Epic in every collection | Mythic |
| night-owl (secret) | Midnight Duel | win a rated game started between 00:00 and 04:00 local time | Uncommon |
| perfect-promotion (secret) | Unbeaten Ascent | promoted with no league losses | Legendary |

### v0.9 implementation tasks (in order; each with tests)
1. `src/achievements/` registry (data-driven defs: id, name, description, collection, rarity, secret, reward,
   events[], evaluate(facts) → { earned, progress?, evidence }); migrate the 8 existing ids unchanged.
2. Unlock store `achievements` (IndexedDB, keyed `ach:<id>`), put-if-absent; DB migration with backfill from history.
3. Event bus hooks: game finalised, report completed (current build + grading), season/round end, settlement,
   ceremony; each evaluates only subscribed achievements.
4. Achievement Hall screen: completion %, collection and rarity filters, recent unlocks, rare showcase, pinned,
   next achievable (by progress), locked/in-progress/complete, secret masking.
5. Post-match summary: rating before/after, title change ceremony (skippable, reduced-motion aware), new
   achievements, Brilliant count, accuracy, Played Like (if validated), prizes, progress to next title; ceremonies
   keyed by event id so they never repeat after reload.
6. Insignias in opponent profiles, standings, leaderboards, brackets, Arena cards, rivalry screens.
7. Simulation of rarity (economy/federation simulators) and reward balance; journey covering unlocks, reload
   idempotency, migration backfill, phone layout.
Dependencies: validated grading for B; Played Like validation for `played-like-*`; beginner opponents for the
Apprentice-era thresholds to be reachable through play rather than only through losses.
