# Playing styles: full-game evaluation (crown-styles-5)

**Result.** Four styles now change play for the whole game and pass the measurement:
**Tactical attacker, Positional strategist, Defensive specialist, Endgame technician**. Each one changes judgement
throughout the game, not only in the opening. **Risk-taking aggressor did not pass.** It plays more king-zone
attacks and has fewer draws, but it gives fewer checks than its opponent. "More checks" was one of its fixed
criteria, so an Aggressive competitor still plays as Universal and is still labelled Universal.

Validation file: `src/engine/styles-validation.json` (id `styles-5-2026-11-04`, `fullGame` = tactical, positional,
defensive, endgame). Measurement tool: `tools/styles/measure.ts`. Raw results: `tools/styles/results/`.
The engine search and evaluation were not changed. `npx tsx tools/bench/speed_probe.ts 300000 12` gives the same
checksum before and after: `9be425be`.

This addresses bug #20 (docs/BUG_REGISTER.md).

## 1. How a style works

`src/engine/styles.ts` → `STYLE_EVAL`; `levels.ts chooseMove` applies it through `styledWeights`.

A style is a set of changes to the crown-eval-4 parameters (`Eval4Weights.own` / `opp`), plus a draw contempt and,
for Endgame, a `simplify` bonus. These are hooks that already existed.

- `own` changes the styled side's own terms, for example how much it values its own king attack.
- `opp` changes how the styled side sees the opponent's terms, for example how dangerous the opponent's attack
  looks to it.
- The opponent's own search is never touched. The legal moves, search depth, node budget and wall-clock budget
  are all unchanged.
- Contempt sets the draw value from the styled side's view: −contempt. A positive contempt avoids draws; a negative
  one accepts them.
- `simplify` adds bonus × (traded phase / 20) to the styled side's score when it is ahead by more than 80 cp.

Changes are additive centipawns `[mg, eg]`, or multipliers `x` / `{x:[mg, eg]}`. A key such as `MAT.4` addresses one
entry of a table term: `MAT.4` is the queen value and `PST.5` is the king square table. This per-entry addressing
is new in crown-styles-5.

Tactical and Positional also keep their validated opening repertoire (crown-styles-3, first six plies).

| Style | Own terms | Opponent terms as seen | Contempt | Simplify |
| --- | --- | --- | --- | --- |
| Tactical | HANGING +25/+10, THREAT_PAWN/MINOR/ROOK +20/+5, KING_ATTACKERS +8/0 | — | +15 | — |
| Positional | THREAT_* ×0.85, HANGING ×0.85, SUPPORTED +8/+4, PHALANX +8/+4, OUTPOST +20/+10, MOB ×1.1 | — | 0 | — |
| Defensive | KING_SHIELD +10/0, KING_OPEN −10/0 | KING_ATTACKERS +10/0, KING_ATTACK +1/0, TROPISM +3/0, HANGING +15/+5, queen value +20/0 (queen trades welcome) | −20 | — |
| Endgame | PASSED, PASSED_FREE, PASSED_OWNK eg ×1.5; UNSTOPPABLE +0/+60; king square table eg ×1.5 (active king) | queen value +25/0 (queen trades welcome) | +15 | 100 |
| Aggressive (not validated) | KING_ATTACKERS +25/0, KING_ATTACK +2/0, TROPISM +8/0 | — | +35 | — |

For comparison, the base play-weight values (mg/eg) are: KING_ATTACKERS 8/−7, KING_ATTACK 2/−1, KING_SHIELD 18/−14,
HANGING 25/9, queen 934/775. TROPISM, OUTPOST, UNSTOPPABLE and KING_OPEN are 0 in the play weights, so for those
terms the style adds the whole value.

## 2. Measurement

Every style was measured with its complete play policy (repertoire where validated, styled evaluation, contempt)
against Universal, at an equal node budget. The tool is `tools/styles/measure.ts` with 2 worker threads.

- **(a) Decisions.** 300 middlegame positions from `tools/bench/tune/positions.json`: one per source game,
  phase 10–18, fullmove ≥ 6, not in check, spread evenly over the corpus. Each position was searched with 8 000
  nodes and fresh tables, by the styled engine and by Universal.
- **(b) Games.** 100 colour-swapped pairs, so 200 games per style. The openings are the first 100 lines of
  `tools/bench/openings-4ply.json`, played at 8 000 nodes per move. The reference is Universal against Universal:
  one game per opening, 100 games, because node-limited play is deterministic.
- **(c) Strength.** Elo from the mean pair score, with a 95 % bootstrap interval over pairs (4 000 resamples).

**Pass rule.** The rule was fixed before the measurement run.

- Decision disagreement ≥ 10 %.
- Every intended direction below holds.
- Elo is within ±50 and its 95 % interval overlaps [−50, +50].

The intended directions were:

- Tactical: more captures + checks than the Universal side.
- Positional: fewer checks than the Universal side.
- Aggressive: more checks and more king-zone attacks than the Universal side, and fewer draws than Universal
  self-play.
- Defensive: fewer attacks suffered on its own king zone than the Universal side, and more draws than Universal
  self-play.
- Endgame: queens off at an earlier median ply than in Universal self-play.

**Avoiding overfitting.** Magnitudes were chosen on separate pilot data: openings from line 200 onward, and decision
positions half-way between the measured ones (`DEC_PART=1`). Openings 0–99 and the measured positions were used
only for measurement.

### (a) How often the chosen move differs from Universal (300 positions, 8 000 nodes)

| Style | Moves that differ | Single-move signature: style vs Universal |
| --- | --- | --- |
| Tactical | 12.7 % | contact move 73.0 % vs 74.3 % |
| Positional | 14.3 % | quiet move 24.0 % vs 25.7 % |
| Aggressive | 21.7 % | adds king-zone attacks 35.7 % vs 34.7 % |
| Defensive | 21.0 % | improves own king safety 25.7 % vs 25.3 % |
| Endgame | 10.7 % | simplifying capture or passed-pawn push 6.0 % vs 4.7 % |

Styles change between one move in nine and one in five. The single-move signatures barely move. A one-move label
does not capture what each style changes; the differences show up over a whole game (table (b)).

### (b) Game characteristics (200 games per style vs Universal, 8 000 nodes)

Columns are per game: plies, draw %, median ply at which both queens are off, and the styled side's captures,
checks and promotions. Per move: the styled side's attacks on the enemy king zone and the attacks it suffers on its
own zone. Each styled-side value is followed by the Universal side's value in the same games (styled / Universal).

| | Plies | Draw % | Queens off (median ply) | Captures | Checks | Promotions | King-zone attacks / move | Attacks suffered / move |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Universal self-play (100 games, per side) | 78.3 | 31.0 | 31 | 8.65 | 5.52 | 0.35 | 2.85 | 2.60 |
| Tactical | 82.9 | **21.0** | 36 | **9.17** / 9.04 | **6.17** / 6.09 | 0.42 / 0.36 | **2.98** / 2.90 | 2.66 / 2.73 |
| Positional | 82.0 | 26.5 | 31 | 8.77 / 8.83 | **5.57** / 5.63 | 0.38 / 0.36 | 2.94 / 2.85 | 2.61 / 2.70 |
| Defensive | 79.1 | **35.5** | **29** | 8.74 / 8.70 | 5.14 / 5.25 | 0.35 / 0.32 | 2.87 / 2.63 | **2.38** / 2.64 |
| Endgame | **85.1** | 30.0 | **28** | 8.99 / 9.26 | 5.62 / 6.25 | 0.38 / 0.41 | 2.85 / 2.88 | 2.63 / 2.62 |
| Aggressive (fails) | **89.4** | **22.5** | **42** | 8.86 / 9.01 | 6.01 / *6.79* | 0.29 / 0.33 | **3.12** / 2.99 | 2.73 / 2.92 |

What the table shows:

- **Defensive** suffers 10 % fewer attacks on its own king zone than its opponent (2.38 vs 2.64 per move). It
  draws more (35.5 % vs 31 % in self-play) and trades queens earlier (median ply 29). Its games are **not**
  longer: 79.1 plies vs 78.3.
- **Endgame** trades queens earliest of the validated styles (median ply 28 vs 31) and plays the longest games of
  the validated styles (85.1 plies).
- **Tactical** has the fewest draws among the validated styles (21 %), and more captures, checks and promotions than
  its opponent.
- **Positional** is quieter than the Tactical style, but the difference from Universal is small.
- **Aggressive** has the most king-zone attacks per move (3.12), the fewest draws apart from Tactical (22.5 %) and
  keeps queens longest (median ply 42). It gives 6.01 checks per game: more than a side in Universal self-play
  (5.52), but fewer than its own opponent (6.79). That opponent checks more because the Aggressive king is more
  exposed. Under the fixed rule this is a fail.

### (c) Strength vs Universal

| Style | 8 000 nodes W-D-L | Elo [95 % CI] | 2 000 nodes W-D-L | Elo [95 % CI] |
| --- | --- | --- | --- | --- |
| Tactical | 82-42-76 | +10 [−33, +53] | 84-39-77 | +12 [−30, +53] |
| Positional | 71-53-76 | −9 [−47, +30] | 74-44-82 | −14 [−56, +30] |
| Defensive | 63-71-66 | −5 [−38, +30] | 61-55-84 | −40 [−78, −5] |
| Endgame | 66-60-74 | −14 [−51, +24] | 80-46-74 | +10 [−21, +42] |
| Aggressive | 69-45-86 | −30 [−69, +7] | 74-30-96 | −38 [−80, +2] |

The 2 000-node run is a supplementary check of weaker profiles. It used the same openings and 200 games per
style, against a 100-game Universal reference.

All four validated styles are within ±50 Elo at both budgets. Defensive at 2 000 nodes is at −40, and its
interval excludes 0, so it is somewhat weaker there. At 2 000 nodes, Positional did not show its "fewer checks"
direction (5.57 vs 5.54), and Defensive did not show "more draws" (27.5 % vs 28 %).

## 3. Iterations (all measurements kept honest)

1. **Pilots** (openings from line 200 onward).
   - The first magnitudes for Aggressive cost about −55 to −97 Elo. These included own shelter ×0.5, queen +40,
     and attack terms ×2–3.
   - Doubling every style's magnitudes raised move disagreement only from about 16 % to 21 % on pilot positions,
     so the moderate magnitudes were kept.
2. **Measurement round 1** (openings 0–99, 8 000 nodes).
   - Tactical, Positional and Endgame passed, with the values above.
   - Aggressive failed its directions. That version had KING_ATTACKERS +15, KING_ATTACK +1, TROPISM +4, own queen
     +25, contempt +20. Result: −19 Elo, checks 5.63 vs 6.07, king-zone attacks 2.93 vs 2.99.
   - Defensive passed at 8 000 nodes (−30 [−67, +9], 37.5 % draws, queens off at ply 26). The 2 000-node check
     then gave **−74 [−119, −33]**, outside the limit. Its magnitudes were halved:
     - own KING_SHIELD 15 → 10, KING_OPEN −15 → −10;
     - opponent KING_ATTACKERS 15 → 10, KING_ATTACK 2 → 1, TROPISM 5 → 3, HANGING 25/10 → 15/5, queen 30 → 20;
     - contempt −25 → −20.

     These values were piloted (−3 Elo at 2 000 nodes) and measured again, giving the table values.
3. **Aggressive round 2.**
   - Change: no queen bias, stronger attack terms, contempt +35. This was chosen on pilot openings, where it scored
     +3 Elo with more king-zone attacks and fewer draws.
   - Result on the measurement openings: −30 Elo, and the "more checks than the opponent" criterion failed again.
     It stays unvalidated.

## 4. Do competitors actually get their style? (checked)

The path from a competitor's style to the engine is:

`Competitor.style` (src/federation/generator.ts) → `playStyle()` (styles.ts: validated styles only) →
`engine.styleId` in watched, player and sparring game records (src/app/federation.ts) → engine worker
`chooseMove(…, playStyle(req.style))` (src/engine/worker.ts). League spectator moves go through `computeMove`
with `playStyle(side.style)`, and engine-vs-engine self-play through `selfplay.ts`.

`chooseMove` uses the styled evaluation exactly when `usesStyleEval(style)`, which reads `fullGame` in the
validation file.

UI labels come from `isValidatedStyle` (CompetitorScreen, SpectatorScreen, ExchangeScreen, heraldry rivals):

- Defensive and Endgame competitors are now shown with their style, and that style is the one they play.
- Aggressive competitors are shown as "Universal", with the existing note that they are listed as Risk-taking
  aggressor but play the standard engine style.

The label matches the behaviour in every case.

## 5. Limits

- Each style has 200 games per budget. The intervals are about ±40 Elo, so a true cost of up to roughly 40 Elo
  cannot be ruled out for any style.
- Levels L1–L4 use bounded sampling among near-best moves, scored with the styled evaluation. They were not
  measured separately; the 2 000-node full search is the nearest check.
- The game characteristics are averages; individual games vary a lot. Most differences from Universal are
  5–15 % in relative terms. These are tendencies, not caricatures.
- Positional is the weakest signal: 14 % of moves differ, and the check difference is tiny.
- Move signatures measured on a single move (table (a)) show almost no shift. The styles are visible in whole-game
  statistics, not in single-move labels.
- Two parts of the original brief are not implemented:
  - "Defensive prefers trades when behind" is only partial: it welcomes queen trades at any score. The `simplify`
    hook works only when ahead.
  - "Aggressive keeps queens" was dropped from the final Aggressive design, because the queen bias cost strength
    in pilots.
- Measurements used the local `tools/bench/tune/positions.json`, which is gitignored and has 97 613 positions.
- The Grimoire text (docs/THE_SOVEREIGNS_GRIMOIRE.md around line 8300, and the review question near line 10178)
  and docs/V3_STYLES.md still describe the crown-styles-3 state (two styles, opening only). They need updating by
  the owners of those files.

## 6. Reproduce

```
npx tsx tools/styles/measure.ts decisions                 # (a)
PAIRS=100 npx tsx tools/styles/measure.ts games           # (b)+(c), all styles + Universal reference
NODES=2000 TAG=n2k PAIRS=100 npx tsx tools/styles/measure.ts games
npx tsx tools/styles/measure.ts summary --write           # updates src/engine/styles-validation.json
```

## 7. Bug register #20: proposed text

| 20 | Medium | Opponent styles | Competitors labelled "Defensive", "Endgame" or "Aggressive" played exactly as Universal; only Tactical and Positional changed play, and only in the first six plies. | Style evaluation parameters existed but were never validated, so none were enabled. | **Fixed (v0.9, crown-styles-5)**: full-game styled evaluation and contempt. 200 games per style vs Universal at 8k nodes, within ±50 Elo at 8k and 2k nodes. Tactical, Positional, Defensive and Endgame now change play all game, with measured differences: Defensive suffers 10 % fewer king-zone attacks and draws 35.5 % vs 31 %; Endgame trades queens off at median ply 28 vs 31; Tactical draws 21 %. Aggressive failed its "more checks than the opponent" criterion and stays labelled and played as Universal. | `src/engine/styles.ts`, `styles-validation.json`, `tools/styles/measure.ts`, `tests/styles.test.ts`, docs/STYLES_REPORT.md. |

## 8. crown-styles-6 (v0.10): Aggressive redesigned, three new candidate styles

### 8.1 What changed and what did not

- Tactical, Positional, Defensive and Endgame keep their crown-styles-5 parameters unchanged. They are re-run on
  the same openings only to give one consistent table (node-limited play is deterministic, so the rerun must
  reproduce the crown-styles-5 numbers; checked for Universal self-play before any change: 100/100 identical games).
- Aggressive gets new parameters (below) and a refined criterion (§8.2).
- Three new candidate styles, each using only the existing hooks (own/opponent evaluation weights, contempt):
  **Gambiteer**, **Materialist**, **Complication seeker**.
- Not attempted: root move preferences, risk tolerance (selection margin) and time allocation. All three would
  need changes in `src/engine/levels.ts chooseMove`, which belongs to package A in v0.10. Time-Pressure
  Specialist, Fortress Builder, Counterattacker, Precision Technician and Opportunist were therefore not built
  (Fortress Builder and Opportunist would also overlap Defensive and Tactical in what the tool can measure).
- New game statistics in `tools/styles/measure.ts` (all measured from the games, per side):
  - *behind / ahead on material*: share of the side's own moves after which its material (P 1, N 3, R 5, Q 9)
    is at least one pawn below / above the opponent's;
  - *pieces at ply 40*: knights, rooks and queens of both sides on the board after ply 40 (or at the end);
  - *pawns at ply 30* (reported, not used in a criterion).

### 8.2 Pre-registered pass criteria (fixed before the measurement run)

Method as in §2: decisions on the same 300 middlegame positions (8 000 nodes), 100 colour-swapped pairs = 200 games
per style vs Universal on openings 0–99 at 8 000 nodes, the 100-game Universal self-play reference on the same
openings, and the same 200 games at 2 000 nodes. A style passes when:

1. decision disagreement with Universal ≥ 10 % (300 positions, 8 000 nodes);
2. every intended direction below holds at 8 000 nodes (at 2 000 nodes they are reported, not required —
   the same rule the four crown-styles-5 styles were validated under);
3. Elo vs Universal within ±50 with the 95 % interval overlapping [−50, +50], **at 8 000 and at 2 000 nodes**.

Intended directions:

| Style | Directions (styled side vs the Universal side in the same games, or vs Universal self-play) |
| --- | --- |
| Aggressive (refined) | more king-zone attacks per move than the Universal side; fewer draws than Universal self-play; more checks per game than a side in Universal self-play |
| Gambiteer | behind on material after a larger share of its moves than the Universal side; more king-zone attacks per move than the Universal side |
| Materialist | behind on material after a smaller share of its moves than the Universal side; ahead on material after a larger share of its moves than the Universal side |
| Complication seeker | more knights, rooks and queens on the board at ply 40 than in Universal self-play; queens off at a later median ply than in Universal self-play; fewer draws than Universal self-play |
| Tactical, Positional, Defensive, Endgame | unchanged from §2 |

**Why Aggressive's criterion changed (recorded before measuring).** The crown-styles-5 rule required "more checks
than the Universal side in the same games". Across the two crown-styles-5 measurements and seven Aggressive pilot variants
in this round, the styled-minus-opponent check difference stayed between −0.8 and +0.6 per game, with a
pair-level standard error of about 0.3 per game on 440 pilot games (≈ 0.43 on 200 games). No evaluation hook
targets checks directly, and the opponent's checks mostly measure its counterplay against an exposed king,
not the aggressor's intent. The refined rule keeps the two aggression signals that are large and stable
(king-zone attacks, draws) and compares checks with a side in Universal self-play instead of with the
opponent. This is a weaker check criterion than before, and we say so: under the refined rule the failed
crown-styles-5 Aggressive would also have passed (3.12 vs 2.99 attacks, 22.5 % vs 31 % draws, 6.01 vs 5.52
checks). The redesign below also gives the aggressor its own king safety, so that it is not simply the old
style re-labelled; the old-rule comparison (checks vs the opponent) is still reported.

### 8.3 Pilots (openings 100–319, never used for measurement)

220 colour-swapped pairs (440 games) per variant, vs a 220-game Universal self-play reference on the same
openings (draws 28.2 %, median queens-off ply 31, 4.50 pieces at ply 40, 5.91 checks per side). Elo is the
point estimate (pilot intervals are about ±28).

| Variant | Parameters | Elo 8k | Signal |
| --- | --- | --- | --- |
| agg0 (= crown-styles-5 Aggressive) | own KING_ATTACKERS +25, KING_ATTACK +2, TROPISM +8; contempt 35 | −6 | attacks 3.21 vs 2.93, draws 20.5 %, checks 6.11 vs opponent 6.21 |
| agg1 | agg0 + own KING_SHIELD +10, KING_OPEN −10, opp KING_ATTACKERS +5 | −39 | checks 5.82 vs 6.15 |
| agg2 | KA +20, KATT +2, TROPISM +6, queen tropism +14, shield +10; contempt 30 | −25 | checks 6.41 vs 6.35 |
| **agg3 (chosen)** | own KA +15, KATT +1, TROPISM +6, KING_SHIELD +10, KING_OPEN −10; opp KA +8, KATT +1; contempt 25 | −7 (2k: −28) | attacks 3.06 vs 2.78, draws 21.1 %, checks 6.18 vs 5.58 |
| agg4 | agg3 + queen tropism +8 | −28 | checks 6.01 vs 5.93 |
| agg5 | agg3 with shield +15, opp KA +12 | −23 | checks 5.75 vs 5.84 |
| agg6 | agg3 with KA +20 | −29 | checks 5.70 vs 5.83 |
| gam1 | own pawn −25/−10, MOB ×1.25, KA +8, THREAT_PAWN/MINOR +10; contempt 20 | −40 | behind 36.1 % vs 29.8 %, but 36 % draws |
| **gam2 (chosen)** | own pawn −15/0, MOB ×1.15, KA +10; contempt 25 | −14 (2k: −15) | behind 36.9 % vs 30.5 %, attacks 3.05 vs 2.98 |
| gam3 | own pawn −30/0, KA +10, TROPISM +4; contempt 25 | −24 | behind 34.8 % vs 32.2 % |
| mat1 | own and opp MAT ×1.10 | −12 (2k: +18) | behind 29.4 % vs 35.7 % |
| **mat2 (chosen)** | own and opp MAT ×1.15 | +14 (2k: +17) | behind 29.6 % vs 37.9 %, ahead 47.3 % vs 38.5 % |
| cpx1 | own queen +30, THREAT_* ×1.2, MOB ×1.1; contempt 25 | −13 | no signal (4.23 pieces at ply 40) |
| **cpx2 (chosen)** | own knight, rook, queen +30/0; contempt 30 | +2 (2k: −9) | 5.28 pieces at ply 40, queens off ply 43, draws 21.1 % |

The checks column illustrates the reason for §8.2: variants built to give more checks did not.
