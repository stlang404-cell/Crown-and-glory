# Competition rules (crown-federation-1; crown-competition-2 since v0.11; crown-competition-3 since v1.0)

The sections below are crown-competition-1, still in force for rounds 1–15 and, unchanged, for any world in the
season it was in when it first opened in v0.11. **crown-competition-2** (§ below) adds two knockout formats in
rounds 16–19 and changes the Crown Championship and Federation Open fields; it starts at a world's next season.
**crown-competition-3** (v1.0, § "crown-competition-3: the Crown Path") changes the Regional Cup field, the Open
invitations, the Open's Championship places and the 10,240 zonal field; same calendar, same prizes.

All rules below are implemented in `src/federation/formats.ts`, `src/federation/world.ts` and
`src/app/federation.ts`, and covered by `tests/federation.test.ts` / `tests/federationService.test.ts`.
Scoring: win 1, draw ½, loss 0. Forfeit: the forfeiting side scores 0 (no game, unrated).

## Leagues (rounds 1–15)

- 128 divisions (16 regions × 8 levels), 16 players each, **single round robin** (15 rounds) by the circle
  method. Colours: the player with fewer Whites so far gets White (balanced to within one).
- **Order:** points → head-to-head points among the tied players → Sonneborn–Berger → pre-season seed
  (rating at season start).
- **Promotion / relegation** at season end, simultaneous between adjacent divisions of the same region:
  places 1–2 move up (not from division 1), places 15–16 move down (not from division 8).
- **Prizes** (escrowed at season start): division pool 2,000 ₵ (division 1) falling geometrically to 120 ₵
  (division 8) — 2,000 / 1,338 / 895 / 599 / 401 / 268 / 179 / 120 — split 50 / 30 / 20 % to places 1–3.
  Title: "<Division> champion (region) S<n>".

## Swiss events (rounds 4–8)

- **Federation Open** — the 32 highest-rated active competitors of divisions 2–4 at season start; since v0.4.0 a
  player in divisions 2–4 may register (25 ₵ or a recovery voucher) and takes the place of the 32nd seed — their
  entry cancels the Open champion market on its published 1/32 vector (conflict rule).
  **Challenger Open** — the 32 highest-rated of divisions 5–8; if the player registers (entry 25 ₵, or a
  recovery voucher; registration closes before round 4) they take the place of the 32nd seed and are seeded
  by rating. Both fields are 32 (no byes unless the field changes); byes are supported by the pairing code.
- Pairing `crown-swiss-1` (a simplified score-group system, **not** FIDE Dutch): sort by points then seed;
  the bye (1 point) goes to the lowest-ranked player without a bye; depth-first search pairs the highest
  unpaired player with the nearest-ranked opponent not met before, with full backtracking (200k-node
  budget) so a repeat-free pairing is found whenever one exists; otherwise the minimum number of rematches
  is used and recorded. Colours: fewer Whites gets White.
- **Order:** points → Buchholz Cut-1 → Buchholz → Sonneborn–Berger → seed.
- **Prizes:** Open 1,500 ₵, Challenger 600 ₵, split 30 / 20 / 12 / 12 / 6.5 / 6.5 / 6.5 / 6.5 % to
  places 1–8; winner's title. The top 8 of the Federation Open (excluding league qualifiers) enter the
  Crown Championship.

## Crown Championship (rounds 16–19)

- **Qualification:** the 8 best regional Crown Division (division 1) winners (points, then rating) + the
  top 8 of the Federation Open not already qualified = 16. Seeds by rating; bracket 1–16, 8–9, 5–12,
  4–13, 3–14, 6–11, 7–10, 2–15.
- **Matches:** two games, colours alternate. Level 1–1 → two rapid games → two blitz games → the higher
  seed advances. In the **final** a level match after blitz produces **joint Crown Champions**.
- **Prizes:** 8,000 ₵: champion 40 %, finalist 20 %, semifinalists 10 % each, quarterfinalists 5 % each
  (joint champions share 60 % equally).

## Club Weekend (rounds 10–11, club owners only)

The owner and the three members of their own division closest to them in rating meet in a 4-player
knockout (seeded by rating; semifinals in round 10, final in round 11) with the same two-game match rule.
Costs and income (all ledger entries): hosting 20 ₵ to the sink, prize escrow 40 ₵ (paid to the winner),
5 ₵ attendance per guest who can pay, 30 ₵ sponsor when completed.

## Knockout games inside a round

A knockout match can need several games in one round (classical pair, then rapid, then blitz). The next
game is scheduled as soon as the previous games of **that** match are decided; pending games elsewhere in
the round never delay it. "Advance" refuses to run while one of your games is ready, and tells you why.

## Ratings

Every result (summary or full game) updates the competitors' public Glicko-2 ratings once per round
(one rating period per round). The player's own federation games are rated in the normal rapid pool
(one immutable rating event per game, as in v0.2.0).

## Titles and reputation

Titles come only from results (league titles, Swiss winners, Crown Champion / joint champions). They can
never be bought. Reputation rises with titles (Crown Champion +25, Federation Open +10, others +4) and
decays ×0.9 per season.

## crown-competition-2 (v0.11): one shared Federation

Implemented in `src/federation/competitions.ts`, `src/federation/world.ts` (`makePlan`, `buildChampionship`,
`buildCups`, `endSeason`, `promotionMoves`), `src/federation/driver.ts` and `src/app/federation.ts`; tested in
`tests/sharedFederation.test.ts`. New federations are founded with it; an older world adopts it at its next season
start (the season in progress finishes under crown-competition-1). With `RULES=1`, `tools/sim/determinism_check.mts`
reproduces the v0.10 hashes exactly (16 regions / 40 rounds: canonical `e1eeeb50…`; 80 regions / 21 rounds:
`723fda00…`).

### Competitions and how the player enters

| Competition | Format | Rounds | Field / entry | Prize | Qualifies for |
|---|---|---|---|---|---|
| Regional league (every region × division) | single round robin, 16 | 1–15 | automatic (your division) | 2,000 … 120 ₵ | promotion (top 2), relegation (bottom 2) |
| Federation Open | Swiss, 32, 5 rounds | 4–8 | invited Regional Cup winners (≤ 8) first, then highest-rated of divisions 2–4; player: register by round 3 (25 ₵, voucher, or free with an invitation) | 1,500 ₵ | Crown Championship (top 8 not already qualified) |
| Challenger Open | Swiss, 32, 5 rounds | 4–8 | highest-rated of divisions 5–8; player: register by round 3 (25 ₵ or voucher) | 600 ₵ | — (title, prizes) |
| Club Weekend | knockout 4 / 8 | 10–11(12) | club owners and their nearest-rated division members | escrow | — |
| **Zonal Championship** (8, one per zone) | knockout, 16 | 16–19 | the zone's Crown Division finishers by finishing rank (all rank-1 finishers, then rank 2, …; inside a rank points, rating, id), skipping Crown Championship qualifiers — automatic | 1,000 ₵ each | **next season's Crown Championship** (zone place) |
| **Regional Cup** (one per region) | knockout, 8 | 17–19 | champions of the region's divisions 2–8 + Grand Division runner-up; anyone already in a Championship/Zonal is replaced by the next of their division — automatic | 150 ₵ each | **next season's Federation Open** (the 8 highest-rated winners in divisions 2–8) |
| Crown Championship | knockout, 16 | 16–19 | up to 8 zone places (last season's zonal champions still active), the rest by the v1 league rule (best Crown Division winners by points, then rating), plus 8 Federation Open places | 8,000 ₵ | Crown Champion title |

Zones are 8 blocks of consecutive regions, ⌈regions / 8⌉ each: 2 regions at 2,048, 4 at 4,096, 10 at 10,240. In
season 1 of a crown-competition-2 world there are no zonal champions yet, so all 8 league places use the v1 rule.
Knockout matches use the Championship match rule (2 games → rapid pair → blitz pair → higher seed); only the Crown
Championship final can produce joint champions. Prizes by stage: Zonal as the Championship (40/20/10/10/5×4 %),
Regional Cup 50/25/12.5/12.5 %. All amounts are constants in `src/economy/economy.ts` (`ZONAL_POOL`, `CUP_POOL`,
`ZONAL_SPLIT`, `CUP_SPLIT`); issuance per season grows by 8 × 1,000 + regions × 150 ₵ (10,400 ₵ at 2,048, 20,000 ₵
at 10,240). Titles: "Zone III Zonal Champion S4", "Ashmere Regional Cup winner S4" (recorded in the season history and
the Hall of Champions).

### Promotion / relegation (unchanged, exported)

`promotionMoves(tables, topology)` with `PROMOTION_PLACES = 2`, `RELEGATION_PLACES = 2`; `leagueZone(division, rank,
size)` gives the zone of a place. `endSeason` returns `SeasonEndResult` (promotions, relegations, titles, standings,
retirements, entrants); `processRound(...).seasonEnd` and `FederationService.advanceRound()` pass it on, and the
player's finish is appended to `world.player.history`. Progression layers should build on these.

### Your games: never auto-played; deadline and forfeit rule

* Nothing is ever played for you. A round only advances when you press **Advance**, and Advance refuses while one of
  the open round's games is unplayed (live AI games and reopen catch-up never touch your fixtures).
* **Play now**, **Postpone** or **Forfeit** each game. Only league games can be postponed (Swiss and knockout
  pairings depend on the result), at most **2** at a time. A postponed game leaves its round, stays playable at any
  time (it is rated in the round in which you play it), and is **due by the end of league round 15**: Advance from
  round 15 refuses until it is played or forfeited.
* "Advance Without Playing" lists every game it would forfeit and needs a confirmation; a forfeit is a loss with no
  game and no rating change, and a forfeited knockout match is lost.
* AI-only matches advance deterministically (seeded per fixture); the world never waits for anything but your own
  pending games.

### Qualification simulation (`tools/sim/qualification.mts`)

Headless shipped world code, crown-population-2, a joined player of fixed strength (rating = strength) whose games
use the same result model, registering for every Swiss event it may enter (invitation first). 10 seasons per run.
Raw lines: `docs/sim/qualification-16.jsonl`, `docs/sim/qualification-80.jsonl` (4 seeds), `docs/sim/qualification-80-12seeds.jsonl`.

| World | Strength | Rules | Runs reaching the Championship | First qualification (season) | Championship seasons / runs × 10 |
|---|---|---|---|---|---|
| 2,048 | 1600 | 1 / 2 | 0/4 / 0/4 | – | 0 / 0 |
| 2,048 | 2000 | 1 / 2 | 3/4 / 3/4 | 6–7 / 3–10 | 4 / 6 |
| 2,048 | 2400 | 1 / 2 | 4/4 / 4/4 | 5–6 / 2–3 | 9 / 15 |
| 2,048 | 2800 | 1 / 2 | 4/4 / 4/4 | 5 / 2 | 12 / 19 |
| 10,240 | 1600 | 1 / 2 | 0/4 / 0/4 | – | 0 / 0 |
| 10,240 | 2000 (12 runs) | 1 / 2 | 6/12 / 6/12 | 5–8 / 5–10 | 7 / 8 |
| 10,240 | 2200 (12 runs) | 1 / 2 | 5/12 / 9/12 | 5–6 / 2–7 | 6 / 19 |
| 10,240 | 2400 | 1 / 2 | 4/4 / 4/4 | 6–7 / 2 | 5 / 15 |
| 10,240 | 2800 | 1 / 2 | 4/4 / 4/4 | 5 / 2 | 12 / 20 |

Findings: the Regional Cup → Open invitation gives a strong player an Open place from season 2 instead of season 5
(division 4), at both sizes; at 10,240 a 2,200–2,400 player now reaches the Championship about three times as often.
Players below ~1,900 do not qualify in 10 seasons under either rule (the Open's top 8 are much stronger). Once in the
Crown Division the route is the zonal title only (Crown Division players cannot enter the Open): at 10,240 the zone
field is the 10 regional winners + 6 best runners-up, and the Crown Division is where the 3,000+ apex players live,
so a 2,800 player finishing 2nd–13th rarely enters a zonal (1 entry in 12 Crown Division seasons) — the main
remaining imbalance (see "not done" in the v0.11 report). **v1.0:** both findings are addressed by crown-competition-3 (§ "the Crown Path" below).

## crown-competition-3 (v1.0): the Crown Path

Implemented in `src/federation/competitions.ts` (`cupFields`, `zonalFields`, `openInvitationsV3`,
`openChampionshipPlaces`, constants `REGIONS_PER_INVITE`, `CHALLENGER_INVITES`, `PATH_PLACES`, `PATH_MIN_POINTS`,
`ZONAL_DEPTH`), `src/federation/world.ts` (`buildChampionship`, `openInvitees`, `buildCups`, `endSeason`,
`registerChallenger`), shown by `src/app/seasonCareer.ts` (Dashboard / Federation "Qualification · What You Need") and
`src/ui/WorldScreen.tsx`; tested in `tests/crownPath.test.ts`. New federations are founded with it (`RULES_V3 = 3`);
a crown-competition-1 or -2 world finishes the season in progress under its own rules and adopts -3 at its next season
start (`driver.ts processRound`, as in v0.11). Every -3 branch is gated on `rules ≥ 3`: with the current code
`RULES=1` / `RULES=2 tools/sim/determinism_check.mts 40 4242 16` give the same hashes as the code before this change
(canonical `ade8d83e…` / `323838af…`; 80 regions / 21 rounds `7ab02b2d…` / `3d021acc…`), and
`tools/sim/qualification.mts … rules=2` reproduces every v0.11 baseline run season by season (48/48 at 2,048, 48/48
at 10,240). Prize amounts are unchanged (`src/economy/economy.ts` not modified).
Circuit Grades (docs/FEUDAL_RANKS.md) are unaffected: league position and rating percentile are unchanged, and the
sanctioned events are the same event ids (league, `open`, `challenger`, `champ`, `zonal-…`, `cup-…`); only who plays
the Open and the cups changes.

### Audit: where the path broke (crown-competition-2)

* **Promotion speed is not the problem.** A 1,700–1,900 player wins divisions 8 → 4 in consecutive seasons and reaches
  division 3 by season 6 (the v0.11 runs below); division medians are 433 / 767 / 980 / 1,180 / 1,373 / 1,565 / 1,841 /
  2,288 (docs/RATING_SPECTRUM.md), so such a player then stalls in division 2–3 — correctly.
* **The only gates to the Championship were absolute.** The Open's 8 places go to its top 8; the Open field is the 32
  highest-rated of divisions 2–4 (median hidden strength ≈ 2,015 at 2,048, ≈ 2,076 at 10,240), so its top 8 are ≈ 2,050–2,200
  players. Below ~1,900 a top-8 finish is rare (v0.11: 1 qualification in 96 seasons at 1,700).
* **The ladder from below was not a ladder.** Regional Cups (champions of 2–8 + Grand Division runner-up) were won by
  Grand Division players in 75 of 80 cups (10,240) and 15–16 of 16 (2,048) (one diagnostic world, seed 1000, seasons 3–4): they are promoted, so their
  invitation is void (`divisionNext ≥ 2`), and a division 3–8 cup winner almost never existed. The Challenger Open
  led nowhere.
* **Entry rule bug-in-waiting:** a registering player replaced the lowest-rated Open entrant, which could be an invitee.
* **Zonal gap at 10,240:** 10 regional winners + the 6 runners-up with most points; ranking runners-up by points across
  regions of very different strength left strong 2nd/3rd-placed players out (2,800 player: 8 zonal entries in 40 Crown
  Division seasons in the crown-competition-2 runs below).

### Rules (changes only)

| Competition | crown-competition-2 | crown-competition-3 |
|---|---|---|
| Regional Cup field (8, rounds 17–19) | champions of divisions 2–8 + division-2 runner-up | champions **and** runners-up of divisions 3–4 + champions of 5–8 (no Grand Division) |
| Federation Open invitations (next season, free entry) | the 8 highest-rated cup winners staying in divisions 2–8 | per zone the highest-rated cup winner(s) staying in divisions 2–8 — one per 5 regions of the zone, at least one (1 per zone at 2,048 and 4,096, 2 at 10,240) — **plus the Challenger Open winner**; ≤ 9 / 17 invitations |
| Player registration for the Open | replaces the lowest-rated entrant | replaces the lowest-rated entrant **who was not invited** |
| Open → Crown Championship (8 places) | top 8 not already qualified | top 6 not already qualified + **2 Crown Path places**: the best-placed *invited* entrants (the player included when invited) with **≥ 3 of 5** points; an unused path place goes to the next Open finisher (`champ.pathPlaces` records them) |
| Zonal field when a zone has > 5 regions (10,240) | 10 regional winners + 6 runners-up with most points | 10 regional winners + the 6 **highest-rated** of the zone's 2nd and 3rd places (`ZONAL_DEPTH = 3`); 2,048 / 4,096 unchanged (tested equal) |

The Crown Path, in one line: win your league or the Challenger Open → win your Regional Cup or the Challenger Open →
invited to the Federation Open → finish in the Open's top 6, or be one of its two best invited finishers with a plus
score → Crown Championship. Each rung is a result against the field of that rung; nothing can be bought (an invitation
is free; money still only buys the 25 ₵ entry that existed before).

**Why these numbers.** Two path places of 16 keep 14 places for the zonal/league/Open-top-6 routes; the 3 / 5 threshold
(a plus score against a field of median ≈ 2,000) keeps a weak invitee out. Simulated variant (2,048, same seeds) with 2
cup invitations per zone + the Challenger top 2: 1,500 qualified in 2/8 runs and the weakest Championship qualifier
averaged 1,703 — the Open was diluted; the chosen 1 per zone + the Challenger winner gives 0/8 at 1,500 and 1,815.

### Qualification simulation (v1.0)

`npx tsx tools/sim/qualification.mts <regions> 12 8 1200,1500,1700,1900,2200,2600 <rules>` (8 runs × 12 seasons each;
player strength = rating; the player registers for every Swiss event it may enter, invitation first). Raw lines:
`docs/sim/qualification-v2-16-baseline.jsonl`, `…-v2-80-baseline.jsonl` (crown-competition-2, current code),
`…-v3-16.jsonl`, `…-v3-80.jsonl`, and the 2,800 Crown Division check `…-v2-80-2800-baseline.jsonl` /
`…-v3-80-2800.jsonl`. Table: `node tools/sim/qualification_summary.mjs <files>`. "Weakest" = the weakest of the 16
qualifiers' hidden strengths, averaged over every simulated season (AI fields included); path holders = all Crown Path
places filled in those seasons (AI and player) and their mean strength.

| World | Strength | Rules | Runs reaching the Championship | First season (each run that qualified) | Championship appearances (all runs) | via path / open / zone / league | Runs reaching the Crown Division | Zonal entries (wins) / Crown Division seasons | Championship field: median / weakest latent (path holders, mean strength) |
|---|---|---|---|---|---|---|---|---|---|
| 2,048 | 1200 | 2 | 0/8 | – | 0 / 96 | – / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 2801 / 1942 |
| 2,048 | 1200 | 3 | 0/8 | – | 0 / 96 | 0 / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 2796 / 1815 (98, 1809) |
| 2,048 | 1500 | 2 | 0/8 | – | 0 / 96 | – / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 2790 / 1961 |
| 2,048 | 1500 | 3 | 0/8 | – | 0 / 96 | 0 / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 2800 / 1803 (91, 1802) |
| 2,048 | 1700 | 2 | 1/8 | 7 | 1 / 96 | – / 1 / 0 / 0 | 0/8 | 0 (0) / 0 | 2809 / 1950 |
| 2,048 | 1700 | 3 | 3/8 | 2, 7, 7 | 3 / 96 | 1 / 2 / 0 / 0 | 0/8 | 0 (0) / 0 | 2794 / 1813 (93, 1795) |
| 2,048 | 1900 | 2 | 3/8 | 6, 10, 12 | 4 / 96 | – / 4 / 0 / 0 | 4/8 | 0 (0) / 7 | 2800 / 1947 |
| 2,048 | 1900 | 3 | 7/8 | 2, 2, 2, 3, 4, 4, 6 | 11 / 96 | 3 / 8 / 0 / 0 | 4/8 | 0 (0) / 8 | 2800 / 1825 (98, 1817) |
| 2,048 | 2200 | 2 | 8/8 | 2, 2, 2, 3, 3, 4, 4, 11 | 24 / 96 | – / 24 / 0 / 0 | 8/8 | 7 (0) / 31 | 2800 / 1959 |
| 2,048 | 2200 | 3 | 8/8 | 2, 2, 2, 2, 2, 3, 4, 4 | 29 / 96 | 6 / 23 / 0 / 0 | 8/8 | 5 (0) / 33 | 2802 / 1833 (85, 1843) |
| 2,048 | 2600 | 2 | 8/8 | 2, 2, 2, 2, 2, 2, 2, 3 | 37 / 96 | – / 37 / 0 / 0 | 8/8 | 38 (0) / 40 | 2785 / 1950 |
| 2,048 | 2600 | 3 | 8/8 | 2, 2, 2, 2, 2, 2, 2, 2 | 39 / 96 | 0 / 39 / 0 / 0 | 8/8 | 37 (0) / 40 | 2797 / 1831 (88, 1825) |
| 10,240 | 1200 | 2 | 0/8 | – | 0 / 96 | – / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 3293 / 2035 |
| 10,240 | 1200 | 3 | 0/8 | – | 0 / 96 | 0 / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 3285 / 1811 (166, 1855) |
| 10,240 | 1500 | 2 | 0/8 | – | 0 / 96 | – / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 3289 / 2038 |
| 10,240 | 1500 | 3 | 0/8 | – | 0 / 96 | 0 / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 3289 / 1806 (166, 1849) |
| 10,240 | 1700 | 2 | 0/8 | – | 0 / 96 | – / 0 / 0 / 0 | 0/8 | 0 (0) / 0 | 3286 / 2032 |
| 10,240 | 1700 | 3 | 1/8 | 9 | 1 / 96 | 0 / 1 / 0 / 0 | 0/8 | 0 (0) / 0 | 3292 / 1806 (169, 1846) |
| 10,240 | 1900 | 2 | 3/8 | 6, 7, 10 | 3 / 96 | – / 3 / 0 / 0 | 6/8 | 0 (0) / 10 | 3289 / 2047 |
| 10,240 | 1900 | 3 | 8/8 | 2, 2, 2, 2, 4, 7, 8, 8 | 16 / 96 | 6 / 10 / 0 / 0 | 5/8 | 0 (0) / 6 | 3289 / 1806 (158, 1846) |
| 10,240 | 2200 | 2 | 6/8 | 2, 3, 3, 5, 5, 6 | 13 / 96 | – / 13 / 0 / 0 | 8/8 | 0 (0) / 31 | 3296 / 2046 |
| 10,240 | 2200 | 3 | 8/8 | 2, 2, 2, 3, 4, 4, 5, 5 | 18 / 96 | 7 / 11 / 0 / 0 | 8/8 | 0 (0) / 36 | 3289 / 1818 (167, 1862) |
| 10,240 | 2600 | 2 | 8/8 | 2, 2, 2, 2, 2, 2, 2, 4 | 38 / 96 | – / 38 / 0 / 0 | 8/8 | 2 (0) / 40 | 3290 / 2048 |
| 10,240 | 2600 | 3 | 8/8 | 2, 2, 2, 2, 2, 2, 2, 2 | 38 / 96 | 1 / 37 / 0 / 0 | 8/8 | 1 (0) / 40 | 3296 / 1812 (151, 1844) |

**Reading.**
* **Target met for 1,900 at both sizes and 1,700 at 2,048; 1,700 at 10,240 stays rare.** 1,900: 3/8 → 7/8 (2,048) and
  3/8 → 8/8 (10,240). 1,700: 1/8 → 3/8 (2,048), 0/8 → 1/8 (10,240). At 10,240 there are five times as many 1,700-level
  players for the same 16 seats, and a zone's two invitations go to the best-rated of ~10 cup winners (≈ 1,750–1,900),
  so the Challenger Open win is a 1,700 player's realistic rung and a plus score in the Open from there is uncommon. Equal
  per-player odds at both sizes would need five times the seats; we did not trivialise the Championship to get them.
* **First qualifications come earlier than the 6–10-season target** when the player wins the Challenger Open in season
  1 (division 8) and scores 3+/5 in season 2's Open as an invitee (1,900: first season 2 in 3–4 runs of 8). That is a
  result against a ≈ 2,000 field, so we kept it rather than add a waiting rule.
* **Too easy? No.** 1,200 and 1,500: 0/8 at both sizes (the 1,200 player won the Challenger Open at 10,240 and scored
  0–1 / 5 in the Open). The Championship's median qualifier is unchanged (≈ 2,800 at 2,048, ≈ 3,290 at 10,240); the
  weakest qualifier is ≈ 130 (2,048) / ≈ 230 (10,240) weaker because the path places (filled in ~all seasons, almost
  always by AI invitees of mean strength ≈ 1,800–1,860) replace two Open places of ≈ 2,000.
* **Stronger players are not hurt.** 2,200 at 10,240: 6/8 → 8/8; 2,600: unchanged (8/8, every season before the Crown
  Division).
* **Zonal gap (10,240):** a 2,800 player's zonal entries rise from 8 to 18 in 40 Crown Division seasons (every season it
  finished 1st–3rd: 6 + 6 + 6; it finished 4th–10th in the other 22); 0 zonal titles either way (zonal champions at 10,240 average
  ≈ 3,400–3,900). Table: `node tools/sim/qualification_summary.mjs docs/sim/qualification-v2-80-2800-baseline.jsonl
  docs/sim/qualification-v3-80-2800.jsonl`: 2,800 / rules 2: 8/8 runs, 40 appearances, 8 zonal entries; rules 3: 8/8,
  39 appearances, 18 zonal entries.

Not done: the Crown Division's 4th–16th places at 10,240 still have no Championship route other than the league
places (a zonal field of 16 cannot hold 160 players); a 2,600 player finishes 4th–8th there and is not in a zonal (1 in
40 seasons), which follows from 2,600 being a mid-table Crown Division strength at 10,240 (regional champions median ≈ 3,050).

## Circuit Grades (v0.11)

A rank tied to the division (two grades per division, sublevels III → II → I, 48 steps), moved at checkpoints after
round 8 and at season end by a standing score from league position, sanctioned results and rating within the
division, with hysteresis and protection. It never changes divisions, prizes or titles. Rules, thresholds and their
simulation: docs/FEUDAL_RANKS.md.
