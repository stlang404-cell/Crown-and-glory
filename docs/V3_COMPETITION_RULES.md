# Competition rules (crown-federation-1; crown-competition-2 since v0.11)

The sections below are crown-competition-1, still in force for rounds 1–15 and, unchanged, for any world in the
season it was in when it first opened in v0.11. **crown-competition-2** (§ at the end) adds two knockout formats in
rounds 16–19 and changes the Crown Championship and Federation Open fields; it starts at a world's next season.

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
remaining imbalance (see "not done" in the v0.11 report).

## Circuit Grades (v0.11)

A rank tied to the division (two grades per division, sublevels III → II → I, 48 steps), moved at checkpoints after
round 8 and at season end by a standing score from league position, sanctioned results and rating within the
division, with hysteresis and protection. It never changes divisions, prizes or titles. Rules, thresholds and their
simulation: docs/FEUDAL_RANKS.md.
