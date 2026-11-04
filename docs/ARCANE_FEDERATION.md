# The Arcane Federation: rating titles, insignias, banner, achievements

| Part | v0.8.0 status |
|---|---|
| 100-point rating titles (31) | **Implemented** — `src/ratings/titles.ts`, tests `tests/ratingTitles.test.ts` |
| Insignias (heraldry grammar) | **Implemented** — 31 unique, prestige rises by era |
| Federation identity banner | **Implemented** — `src/ui/IdentityBanner.tsx`, desktop + phone verified in Chromium |
| Passport: current title, peak title, insignia collection | **Implemented** |
| Achievement framework + Sovereign Vault | **Implemented (v0.8.0, Vault v1; v0.11 crown-vault-2, §5.1)** — 210 collectibles: 170 achievements (159 earnable, 11 awaiting validated grading), 9 Exchange titles, 31 insignias, in 20 tiered families; see `src/vault/catalog.ts` (the catalog below was the design; the implemented set is in the code) |
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

### 5.1 Vault expansion — crown-vault-2 (v0.11, package J)

The implemented catalog is `src/vault/catalog.ts` (rules) + `src/vault/families.ts` (families, tiers); tests
`tests/vault.test.ts` (crown-vault-1) and `tests/vault-expansion.test.ts` (crown-vault-2); journey `e2e/vault.mjs`.

* **Preservation.** All 142 crown-vault-1 collectibles keep their id, name, description, rule, rarity, collection,
  art and order (asserted byte for byte against `tests/fixtures/vault-v1-catalog.json`). No id was re-keyed or
  removed; no collection was added (so `all-collections` keeps its meaning). Existing `ach:<id>` records are never
  rewritten. 68 achievements were added: **210 collectibles, 170 achievements (159 earnable), 9 Exchange titles,
  31 insignias, 11 awaiting validated grading, 8 secret.**
* **Families and tiers.** Every collectible belongs to one of 20 families (the 17 skill and career threads below, plus
  Federation Career, Patron's Treasury and Rating Insignias). The tier is a fixed reading of rarity — Common/Uncommon =
  **Bronze**, Rare = **Silver**, Epic/Legendary = **Gold**, Mythic = **Sovereign** — so old and new entries share one
  ladder without changing any old definition.
* **Grading.** No new achievement reads the move grading. The Brilliant / accuracy / Played Like entries stay
  "Awaiting validated grading (experimental)" and can never be earned while `GRADING_ID` is experimental.
* **Event-driven, idempotent.** The VaultService re-evaluates when a record is committed (finalized game, rating
  event, report, Academy/Grimoire record, Federation round, title, settlement, forecast, asset, finance point) and
  writes unlocks put-if-absent under `ach:<id>`. On the first start of v0.11 on an older save, the expansion is
  back-filled from history once (`vault:backfilled:crown-vault-2`), recorded as `backfill: true` (no notice flood);
  crown-vault-1 behaves exactly as before. Unlocks made by the expansion carry `catalog: 'crown-vault-2'`.

**Anti-farming rules (crown-vault-2).**

| Rule | Applies to | Why |
|---|---|---|
| Rated games only (a rating event exists, so never casual, assisted, training, retry, imported, abandoned or set-up positions); the opponent must be an engine or Federation competitor (never self-play) | every new chess rule | unrated/assisted/sandbox/practice play is never rewarded |
| A win against an opponent rated **more than 400 below you** (both ratings recorded) never counts | all new win counters, mates, endgames, streaks, rivalries, regions, secrets | no farming a weak opponent |
| **One counted win per opponent per UTC day** and **at most 10 counted wins per UTC day** | mates, endgame wins, promotions, regions, home region, marathon, anniversary | repeat-opponent and rate limit |
| Distinct opponents / distinct regions / distinct days | upsets-5/25, rivals-ahead, home-region, regions-32/80, days-N, long-rivalry | volume against one opponent never adds |
| Win streaks: a draw or loss always ends the run; weak or same-opponent-same-day wins neither extend nor break it | winstreak-5/10/20/40 | a streak cannot be padded with weak opponents |
| A material deficit counts only when held **4 consecutive plies** | fortress, against-odds, miracle | a capture-recapture is not a comeback |
| Rating milestones and climbs read **established** ratings only (20+ games, RD ≤ 100) | rating-3500/4000, climb-N | provisional swings never count |
| Calibration: latest forecast per market only; sandbox/unsettled markets never count; the Brier score must also be no worse than (or better than) the market price | calibration-30/100/250 | re-forecasting or hedging to 1/3 never qualifies |
| Profit: official settled markets with shares held at settlement; P&L must clear the bar after removing your single best market; sandbox and practice never count | pnl-1k/10k, profit-seasons-N | one lucky market or round-tripping never qualifies |
| Recovery uses only the Federation finance record (sandbox/practice money never enters it) | weathered-storm, second-fortune, from-ashes | |
| Analysis counts one report per game; Grand Archive needs games of 20+ plies; Lessons in Defeat needs rated losses | analyses-300, lessons-defeat | no resign-and-analyse farming |
| Grimoire first-sight exercises use the **first ever** attempt outcome | first-try-25/100 | re-solving after seeing the answer never counts |

Residual risk (not preventable offline): changing the device clock can spread games over more calendar days; the
day rules then count them, but every other rule (rated, weak-opponent, distinct-opponent) still applies.

**Counts by family and tier** (generated from the catalog):

| Family | crown-vault-1 | added | Bronze | Silver | Gold | Sovereign |
|---|---|---|---|---|---|---|
| Chess Mastery | 13 | 3 | 7 | 4 | 4 | 1 |
| Tactical Brilliance | 9 | 2 | 4 | 2 | 5 | 0 |
| Defensive Resilience | 2 | 4 | 1 | 3 | 1 | 1 |
| Endgame Technique | 0 | 5 | 2 | 1 | 2 | 0 |
| Tournament Victories | 9 | 5 | 2 | 6 | 4 | 2 |
| Upsets | 5 | 3 | 2 | 2 | 3 | 1 |
| Win Streaks | 2 | 4 | 1 | 1 | 3 | 1 |
| Rating Milestones | 10 | 5 | 5 | 3 | 3 | 4 |
| Federation Career | 6 | 2 | 1 | 3 | 3 | 1 |
| Rivalries | 6 | 4 | 3 | 3 | 4 | 0 |
| Regional Conquest | 3 | 3 | 3 | 0 | 2 | 1 |
| Grimoire Mastery | 8 | 5 | 3 | 4 | 5 | 1 |
| Forecasting Calibration | 4 | 3 | 1 | 2 | 4 | 0 |
| Exchange Profitability | 13 | 4 | 6 | 4 | 5 | 2 |
| Financial Recovery | 3 | 3 | 1 | 3 | 2 | 0 |
| Patron’s Treasury | 5 | 0 | 2 | 1 | 2 | 0 |
| Career Longevity | 2 | 6 | 3 | 1 | 2 | 2 |
| Replay Analysis | 7 | 3 | 5 | 3 | 2 | 0 |
| Rare Secrets | 4 | 4 | 2 | 2 | 3 | 1 |
| Rating Insignias | 31 | 0 | 12 | 4 | 14 | 1 |
| **Total** | **142** | **68** | 66 | 52 | 73 | 19 |

Tiers, crown-vault-1 / added: Bronze 49 / 17, Silver 36 / 16, Gold 49 / 24, Sovereign 8 / 11.

| id | Name | Family | Tier (rarity) | Rule |
|---|---|---|---|---|
| `mates-10` | Mating Net | Chess Mastery | Bronze (uncommon) | Win 10 rated games by checkmate. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `mates-50` | Executioner's Art | Chess Mastery | Gold (epic) | Win 50 rated games by checkmate. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `miniature` | Miniature | Chess Mastery | Silver (rare) | Win a rated game by checkmate within 30 plies (15 moves each) against an opponent rated no more than 100 below you (both ratings recorded). |
| `sacrificial-mate` | Sacrificial Mate | Tactical Brilliance | Gold (epic) | Win a rated game by checkmate while at least 2 points down in material in the final position, against an opponent rated no more than 200 below you (both ratings recorded). |
| `puzzles-25` | Puzzle Apprentice | Tactical Brilliance | Bronze (common) | Solve 25 different Academy puzzles on the first try without hints. |
| `fortress` | Fortress | Defensive Resilience | Bronze (uncommon) | Draw a rated game after being at least 3 points down in material for at least 4 consecutive plies. Rated games only. |
| `hold-the-line` | Hold the Line | Defensive Resilience | Silver (rare) | Draw a rated game against an opponent rated at least 300 above you (both ratings recorded). |
| `against-odds` | Against the Odds | Defensive Resilience | Gold (epic) | Win a rated game after being at least 6 points down in material for at least 4 consecutive plies. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `miracle` | Miracle Escape | Defensive Resilience | Sovereign (mythic) | Win a rated game after being at least 9 points down in material for at least 4 consecutive plies, against an opponent rated at or above you (both ratings recorded). |
| `endgame-5` | Endgame Technician | Endgame Technique | Bronze (uncommon) | Win 5 rated games that reached an endgame (at most 2 queens, rooks or knights left on the whole board). Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `endgame-25` | Endgame Master | Endgame Technique | Silver (rare) | Win 25 rated games that reached an endgame (at most 2 queens, rooks or knights left on the whole board). Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `endgame-100` | Endgame Sovereign | Endgame Technique | Gold (legendary) | Win 100 rated games that reached an endgame (at most 2 queens, rooks or knights left on the whole board). Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `crowned-pawn` | Crowned Pawn | Endgame Technique | Bronze (uncommon) | Win a rated game in which you promoted a pawn. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `endgame-giant` | Endgame Giant | Endgame Technique | Gold (epic) | Win a rated game that reached an endgame against an opponent rated at least 200 above you (both ratings recorded). |
| `upsets-5` | Upstart | Upsets | Bronze (uncommon) | Win rated games against 5 different opponents, each rated at least 100 above you at the time (both ratings recorded). |
| `upsets-25` | Kingmaker's Bane | Upsets | Gold (epic) | Win rated games against 25 different opponents, each rated at least 100 above you at the time (both ratings recorded). |
| `colossus` | Colossus Slayer | Upsets | Sovereign (mythic) | Win a rated game against an opponent whose recorded rating is at least 800 above yours. |
| `winstreak-5` | Hot Hand | Win Streaks | Bronze (uncommon) | Win 5 rated games in a row. A draw or loss ends the run; a win against an opponent rated more than 400 below you, or a second win against the same opponent on the same day, neither extends nor breaks it. |
| `winstreak-10` | Unstoppable | Win Streaks | Gold (epic) | Win 10 rated games in a row. A draw or loss ends the run; a win against an opponent rated more than 400 below you, or a second win against the same opponent on the same day, neither extends nor breaks it. |
| `winstreak-20` | Inexorable | Win Streaks | Gold (legendary) | Win 20 rated games in a row. A draw or loss ends the run; a win against an opponent rated more than 400 below you, or a second win against the same opponent on the same day, neither extends nor breaks it. |
| `winstreak-40` | Sovereign Run | Win Streaks | Sovereign (mythic) | Win 40 rated games in a row. A draw or loss ends the run; a win against an opponent rated more than 400 below you, or a second win against the same opponent on the same day, neither extends nor breaks it. |
| `rating-3500` | Rating 3,500 | Rating Milestones | Sovereign (mythic) | Your established Rapid rating reaches 3,500 or more. |
| `rating-4000` | Rating 4,000 | Rating Milestones | Sovereign (mythic) | Your established Rapid rating reaches 4,000 or more. |
| `climb-200` | Rising Star | Rating Milestones | Bronze (uncommon) | Your established Rapid rating peaks at least 200 above the rating at which it first became established (20+ rated games and RD 100 or less). |
| `climb-500` | Ascendant | Rating Milestones | Silver (rare) | Your established Rapid rating peaks at least 500 above the rating at which it first became established (20+ rated games and RD 100 or less). |
| `climb-1000` | Meteoric Rise | Rating Milestones | Gold (legendary) | Your established Rapid rating peaks at least 1,000 above the rating at which it first became established (20+ rated games and RD 100 or less). |
| `division-masters` | Masters' Gate | Federation Career | Silver (rare) | Play in Division 4 (Masters) or higher. |
| `promotions-3` | Climber | Federation Career | Silver (rare) | Be promoted at the end of three different seasons. |
| `titles-3` | Laurel Collector | Tournament Victories | Silver (rare) | Win 3 Federation titles in total (division leagues, Swiss events, the Crown Championship and the Club Weekend). |
| `titles-10` | Hall of Titles | Tournament Victories | Gold (epic) | Win 10 Federation titles in total (division leagues, Swiss events, the Crown Championship and the Club Weekend). |
| `titles-25` | Dynasty | Tournament Victories | Sovereign (mythic) | Win 25 Federation titles in total (division leagues, Swiss events, the Crown Championship and the Club Weekend). |
| `season-double` | Double Crown | Tournament Victories | Gold (epic) | Win two or more Federation titles in the same season. |
| `triple-crown` | Triple Crown | Tournament Victories | Gold (legendary) | Over your career, win a division league, a Swiss event (Federation Open or Challenger Open) and a knockout (the Crown Championship or the Club Weekend). |
| `rivals-ahead-3` | Circle of Rivals | Rivalries | Bronze (uncommon) | Hold a winning head-to-head record (more wins than losses, at least 3 meetings) against 3 different Federation competitors. Rated games only; the first game per opponent per day counts, and wins against opponents rated more than 400 below you are ignored. |
| `rivals-ahead-10` | Feared Across the Federation | Rivalries | Gold (epic) | Hold a winning head-to-head record (more wins than losses, at least 3 meetings) against 10 different Federation competitors. Rated games only; the first game per opponent per day counts, and wins against opponents rated more than 400 below you are ignored. |
| `long-rivalry` | Old Acquaintance | Rivalries | Silver (rare) | Play rated games against the same Federation competitor on 15 different days. |
| `featured-sweep` | Every Score Settled | Rivalries | Gold (legendary) | Beat each of your featured rivals (at least 3) in a rated game. Wins against opponents rated more than 400 below you do not count. |
| `home-region` | Home Turf | Regional Conquest | Bronze (common) | Win rated games against 5 different Federation competitors from your own region. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `regions-32` | Continental | Regional Conquest | Gold (legendary) | Win rated games against Federation competitors from 32 different regions (needs a federation of at least 32 regions). Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `regions-80` | Conqueror of the Eighty | Regional Conquest | Sovereign (mythic) | Win rated games against Federation competitors from 80 different regions (needs a federation of at least 80 regions). Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `strategist-graduate` | The Strategist | Grimoire Mastery | Silver (rare) | Complete every chapter of Book III — The Strategist. |
| `oracle-reader` | The Oracle's Reading | Grimoire Mastery | Gold (epic) | Complete every chapter of Book VI — The Oracle (read each to the end). |
| `grimoire-complete` | Keeper of the Grimoire | Grimoire Mastery | Sovereign (mythic) | Complete every chapter of Books I to VI. |
| `first-try-25` | Sharp Eye | Grimoire Mastery | Bronze (uncommon) | Solve 25 different Grimoire exercises first try on your very first attempt at each (later re-solves never count). |
| `first-try-100` | Flawless Scholar | Grimoire Mastery | Gold (legendary) | Solve 100 different Grimoire exercises first try on your very first attempt at each (later re-solves never count). |
| `calibration-30` | Steady Calibration | Forecasting Calibration | Bronze (uncommon) | At least 30 resolved paper forecasts on different markets (latest forecast per market) with an expected calibration error of 0.10 or less over 10 bins, and a mean Brier score no more than 0.02 worse than the market price. Sandbox markets never count. |
| `calibration-100` | True Calibration | Forecasting Calibration | Silver (rare) | At least 100 resolved paper forecasts on different markets (latest forecast per market) with an expected calibration error of 0.06 or less over 10 bins, and a mean Brier score equal to or better than the market price. Sandbox markets never count. |
| `calibration-250` | Perfect Calibration | Forecasting Calibration | Gold (legendary) | At least 250 resolved paper forecasts on different markets (latest forecast per market) with an expected calibration error of 0.04 or less over 10 bins, and a mean Brier score better than the market price. Sandbox markets never count. |
| `pnl-1k` | Steady Profits | Exchange Profitability | Silver (rare) | Realized P&L of $1,000 or more across at least 10 settled Grand Exchange markets, even after removing your single best market. Sandbox and practice markets never count; shares sold before settlement never count. |
| `pnl-10k` | Merchant Prince | Exchange Profitability | Gold (legendary) | Realized P&L of $10,000 or more across at least 40 settled Grand Exchange markets, even after removing your single best market. Sandbox and practice markets never count; shares sold before settlement never count. |
| `profit-seasons-3` | Three Good Seasons | Exchange Profitability | Silver (rare) | Positive realized P&L in 3 different seasons, each with at least 5 settled positions. |
| `profit-seasons-10` | Golden Decade | Exchange Profitability | Sovereign (mythic) | Positive realized P&L in 10 different seasons, each with at least 5 settled positions. |
| `weathered-storm` | Weathered the Storm | Financial Recovery | Bronze (uncommon) | Net worth falls at least 30% below an earlier recorded peak of $2,000 or more, then later rises above that peak. Only the Federation finance record counts. |
| `second-fortune` | Second Fortune | Financial Recovery | Gold (epic) | Net worth falls at least 60% below an earlier recorded peak of $10,000 or more, then later rises above that peak. |
| `from-ashes` | From Ashes | Financial Recovery | Gold (legendary) | Recover from a recorded net worth below $100 to $10,000 or more. |
| `days-7` | Regular | Career Longevity | Bronze (common) | Finish rated games on 7 different calendar days (UTC). |
| `days-30` | Devoted | Career Longevity | Silver (rare) | Finish rated games on 30 different calendar days (UTC). |
| `days-100` | Lifelong | Career Longevity | Gold (epic) | Finish rated games on 100 different calendar days (UTC). |
| `days-365` | A Year at the Board | Career Longevity | Sovereign (mythic) | Finish rated games on 365 different calendar days (UTC). |
| `seasons-3` | Seasoned | Career Longevity | Bronze (common) | Complete 3 Federation seasons. |
| `seasons-25` | Elder of the Federation | Career Longevity | Sovereign (mythic) | Complete 25 Federation seasons. |
| `analyses-300` | Grand Archive | Replay Analysis | Gold (epic) | Complete a Match Analysis of 300 of your own finished games of at least 20 plies (re-analysing a game does not count twice). |
| `lessons-defeat` | Lessons in Defeat | Replay Analysis | Bronze (uncommon) | Complete a Match Analysis of 10 different rated games you lost. |
| `retry-25` | Relentless | Replay Analysis | Silver (rare) | Win 25 different training retries started from your own mistakes (each source position counts once). |
| `stalemate-swindle` | Stalemate Swindle (secret) | Rare Secrets | Silver (rare) | Draw a rated game by stalemate while at least 3 points down in material in the final position. |
| `humble-crown` | Humble Crown (secret) | Rare Secrets | Silver (rare) | Win a rated game in which you promoted a pawn to a rook or a knight. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `marathon` | Marathon (secret) | Rare Secrets | Bronze (uncommon) | Win a rated game of at least 200 plies. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |
| `anniversary` | Anniversary (secret) | Rare Secrets | Gold (epic) | Win a rated game on the calendar anniversary (same month and day, UTC) of your first counted rated win, a year or more later. Rated games only; one win per opponent per day, at most 10 counted a day, and wins against opponents rated more than 400 below you never count. |


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
