# The Crown Legacy (v0.11, package I): identity header, Trophy Hall, career Elo

## Career Elo
**The career Elo shown everywhere in the game is the player's (or competitor's) Glicko-2 rating on the Crown scale**
(`src/ratings/glicko2.ts`, model `crown-glicko2-1`; the scale is anchored at engine level L1 = 800,
docs/ENGINE_BENCHMARKS.md and docs/RATING_SPECTRUM.md). It is **not a FIDE rating** and is not comparable with one. The
player's Federation career Elo is the Rapid pool. Nothing about the rating model changed in package I: only its display.

One formatter, `src/ratings/display.ts` (`crown-career-elo-display-1`), is used on every surface:
* displayed value = `max(0, round(r))` — no surface prints a negative career Elo (a stored rating may be below 0 for a
  new career starting at 0 with a high RD);
* `±RD` where there is room (`1,427 ±45`); RD is hidden in narrow table cells on phones;
* provisional ratings are **labelled** ("· provisional"), not ranked or compared;
* after every rated game: **"Previous 1,427 → New 1,445 (+18)"**, computed from the displayed values (stored −40 → −10
  shows "Previous 0 → New 0 (+0)"). Shown on the result overlay and the Career Passport; the Library, Rated Games
  table and header "Last Rated" use the same displayed delta.

Surfaces using it: identity header; Dashboard (rating card, rank heading); Career Passport (current, change line, peak /
lowest, Career Elo History graph, Rated Games, Game History, Career Statistics); Play (opponent cards, your pool rating,
match player bars, result overlay); Quick Match card; Federation fixtures; league standings (the player's own row
included), Swiss tables, Crown Championship bracket; competitor directory and scouting profile (CompetitorScreen);
Rivals; Exchange match panel; Live Arena player cards and scoreboard; Analysis/replay player bars; Replay Library;
Library history. (The Played Like panel and result lines belong to package H.)

## Identity header (`src/ui/IdentityBanner.tsx`, `src/ui/legacy.css`)
Desktop: one rich row — insignia (feudal rank insignia when available, else the chosen or current rating-title
insignia), display name, feudal rank (package P) / rating title, career Elo ±RD, progress to the next title, division and
region, cash, net worth, last rated change, Brilliant moves, Federation title, Exchange honour, latest ceremony,
featured trophies (link to the Trophy Hall), achievement showcase, and the primary banner as a thin top strip.
iPhone (≤ 700 px): compact — insignia, name, rank/title, career Elo, one line with division · featured title/honour ·
net worth, and cash; **More/Less** expands the rest in place. The header is in normal page flow (no fixed or sticky
position, no fixed height, no inner scroller), so it never covers content or traps scrolling; `.main` gains
`env(safe-area-inset-*)` padding on phones (the app draws under the translucent status bar, `viewport-fit=cover`).
Verified by `e2e/legacy.mjs` check 8–9 (every main screen scrolls to its bottom at 390 px).

Dashboard and Player Profile headings show the **current feudal rank** with insignia and sublevel ("Duke II"), career Elo
beside it and the division (`src/ui/RankHeading.tsx`). The ranks come from package P through the adapter
`src/legacy/ranks.ts` (`currentRank(state)`, `highestRank(state)`; discovered from `src/federation/ranks*.ts`). Without
that module the heading shows the rating title, labelled "rating title". Profile → **Career Statistics** shows the highest
rank ever achieved (with season/date when P records it) separately from the current and highest career Elo.

## Customisation (`src/legacy/customise.ts`, `crown-legacy-prefs-1`)
Primary banner, featured trophies (≤ 3), insignia, header accent, achievement showcase (≤ 3), Exchange honour and a
display name. **Only earned items**: banners = owned/earned banner cosmetics, your regional federation's arms, seasonal
banner trophies; insignias = collected rating-title insignias; showcase = owned Vault achievements; honour = held Vault
Exchange titles; accents: Crimson and Steel always, Royal Blue (any tier-2+ trophy), Emerald (Promotion Banner), Amethyst
(Norm Medal), Burgundy (Division Shield), Silver (Rating Milestone), Gold (tier-4+ trophy). `equip` refuses anything else;
`effective` drops a stored choice that is not earned, so an edited or restored save can't display unearned items.

## Trophy Hall (`src/legacy/trophies.ts`, `crown-trophies-1`; Hall of Fame screen)
14 trophy definitions in 10 kinds, each with id, name, description, unlock rule, prestige tier (Bronze, Silver, Gold,
Royal, Sovereign), and per award: season, event, evidence, and an optional replay link to the deciding game. Original SVG
art per kind (`src/ui/TrophyArt.tsx`): regional cup, division shield, seasonal banner, invitational goblet, rivalry
swords, rating starburst, medal, crown on cushion (elite honours), forecasting orb, career obelisk; the tier sets the
metal and ornaments.

| Kind | Trophies | Recorded source |
|---|---|---|
| Regional cups | Regional Cup | titles "Club Weekend …", "… Cup …" |
| Division trophies | Division Shield | "… Division champion (…)" titles |
| Seasonal banners | Season Podium Banner, Promotion Banner | season tables (`world.player.history`, current division) |
| Invitationals | Open Goblet | Federation/Challenger Open, invitational, Swiss, round-robin titles |
| Rivalry trophies | Rivalry Trophy | crown-rivalry-1 Nemesis+ with ≥ 4 meetings and more wins than losses |
| Rating milestones | Rating Milestone (400 … 3,400) | rating ledger, established ratings only |
| Medals | Norm Medal | recorded norms |
| Elite honours | Crown of the Federation, Elite Laurel, Federation Title Standard | Crown Champion / elite / Sovereign-final titles, Federation title |
| Forecasting championships | Forecasting Orb | first place in a finished season's Forecasting League (≥ 5 forecasts) |
| Career monuments | Career Obelisk (10–500 rated games), Seasons Monument (1–20 seasons) | finished games, season finishes |

Awarding (`src/legacy/service.ts`): event-driven and throttled; `deriveAwards` is pure and builds deterministic keys
(`div-champion:s3:…`, `rating-milestone:1400`); records are written put-if-absent (`trophy:<key>`), so reloads,
re-processing, restores and back-fills never duplicate, rewrite or revoke. The first run on an existing save back-fills
from history silently (marked "recorded from your history"); later awards show one restrained inline ceremony
(no overlay; animation off under reduced motion), remembered under `trophyseen:<key>`. New title strings added by the
shared-Federation package are classified by pattern; unknown strings award nothing rather than guessing.

## Not done / limits
* Feudal ranks are rendered through the adapter only; the ranks themselves are package P's.
* Pre-existing inner list scrollers (fixed max-height lists on Exchange, Finance, News, Tournaments) were left as they
  are (they chain to the page scroll; the 390 px journey reaches the bottom of every screen). The Hall of Fame's own
  list scroller was removed.
* Checked in Chromium at 1366 px and 390 px only; not on a physical iPhone.
