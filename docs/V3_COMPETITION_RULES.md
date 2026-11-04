# Competition rules (crown-federation-1)

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

## Circuit Grades (v0.11)

A rank tied to the division (two grades per division, sublevels III → II → I, 48 steps), moved at checkpoints after
round 8 and at season end by a standing score from league position, sanctioned results and rating within the
division, with hysteresis and protection. It never changes divisions, prizes or titles. Rules, thresholds and their
simulation: docs/FEUDAL_RANKS.md.
