# AI personality validation

> **Superseded (v0.9):** crown-styles-5 validates Tactical, Positional, Defensive and Endgame for the whole
> game; Aggressive still fails. See docs/STYLES_REPORT.md. The text below is the v0.3–v0.8 history.

**Verdict: two styles are validated and in play — Tactical attacker and Positional strategist** (policy
`crown-styles-3`, opening repertoire `crown-repertoire-1`, validation file `src/engine/styles-validation.json`).
Aggressive, Defensive and Endgame failed and play the common engine policy; the UI shows them as "Universal"
and the profile says the listed style was not validated.

## Attempt 1 — move filter (crown-styles-2): failed

After the normal search, choose the style's preferred move among moves within 20 cp, all game long.
On 400 positions no style passed (disagreement 5–25%, signature shifts 1.3–3.0 pp; table at the end).
Reason: few positions offer near-equal moves that differ in style-relevant ways. The strength run was stopped
after ~70 minutes because it could not change the verdict. An earlier eval-weight variant changed only 8–12%
of moves with no signature.

## Attempt 2 — opening repertoire (crown-styles-3): two styles pass

**Repertoire** (`tools/styles/build_repertoire.ts`): breadth-first over the first 6 plies from the start
position; at each node every legal move is scored at depth 7; all moves within **30 cp** of the best are book
moves; the 3 best are expanded. 292 book positions, 4.6 choices on average (start position: d3 +6, b3 +1,
c3 +1, a3 −1, f3 −13, e3 −15, Nf3 −21, Na3 −24 cp). A first build used a per-move node cap that aborted the
searches (no scores) and produced an almost empty book; that bug was found and fixed before validation.

**Policy** (`src/engine/styles.ts`): in a book position a styled competitor picks a book move with probability
∝ exp(1.2 · preference), seeded per game and ply (so games vary); outside the book it plays the normal engine.
Preferences: tactical — moves that attack enemy pieces, captures, checks, knight/queen moves; positional —
knight development and other piece moves, central files; aggressive — pawn advances and pressure near the
enemy king; defensive — king shelter and staying on the first two ranks. Endgame technicians have no opening
preference.

**Validation** (`tools/styles/validate.ts`):
- Behaviour: 400 seeded opening walks per style (the style side alternates colours; the other side picks
  uniformly among book moves). At each styled decision, the style's move is compared with the move the
  universal engine plays in the same position (20k nodes). Pass: disagreement ≥ 20%, signature Δ ≥ 10 pp,
  and the lower end of the 95% bootstrap interval (clustered by walk) > 0.
- Strength: 24 colour-swapped seeded pairs (48 games) per style vs universal from the start position at 8k
  nodes. Pass: Elo point estimate within ±100 and its 95% interval overlapping [−100, +100].

| Style | Decisions | Disagreement | Signature (style vs universal) | Δ [95% CI] | Elo vs universal [95% CI] | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Tactical | 321 | 95.0% | contact moves 91.6% vs 5.9% | +85.7 pp [80.7, 90.1] | −29 [−89, +36] | **pass** |
| Positional | 348 | 85.3% | piece moves 75.9% vs 7.8% | +68.1 pp [62.3, 74.0] | −14 [−89, +58] | **pass** |
| Aggressive | 401 | 84.5% | pawn pushes 90.8% vs 82.5% | +8.2 pp [4.2, 12.5] | +58 [−7, +129] | fail (Δ < 10 pp: the engine already pushes pawns) |
| Defensive | 343 | 88.3% | back-rank moves 6.7% vs 2.3% | +4.4 pp [2.4, 6.5] | +7 [−66, +73] | fail (Δ < 10 pp) |
| Endgame | 516 | — | no opening preference | — | 0 (identical play) | fail by design |

Thresholds were fixed before the run and not changed afterwards.

## What it means in play

A Tactical attacker opens with moves that bring pieces into contact early; a Positional strategist develops
knights and pieces before pawns. Both pick only moves the engine scores within 30 cp of its best at depth 7,
and after the first six plies everyone plays the common engine. The style is therefore an **opening
character**, not a middlegame personality — the profile and research pages show "Tactical attacker" /
"Positional strategist" only for these two.

## v0.4.0 update

The M4 engine work piloted full-game styles through style-specific evaluation weights: 17–29% of moves changed,
but signature shifts were only −8 to +4 percentage points (below the +10 pp threshold), so none ship
(docs/M4_ENGINE_STRENGTH.md). Play now uses the stronger crown-eval-4 engine; the Tactical/Positional opening
repertoires (book moves within 30 cp at depth 7 of the M3 engine) still apply, but their strength parity was
measured with the M3 engine and has not been re-run on the new one.

## Limits

- 48 parity games per style give wide intervals (the tactical lower bound, −89 Elo, is close to the −100 limit).
- Parity was measured at 8k nodes. For weak competitors (calibrated levels L1–L4 use bounded random move
  sampling) the book's first moves are stronger than their usual sampled moves; the effect is limited to at
  most three moves per side and was not separately measured.
- The repertoire was scored by the Crown engine itself at depth 7, not by an external reference.

## Attempt 1 data (crown-styles-2, 400 positions, 20k nodes)

| Style | Disagreement | Signature Δ |
| --- | --- | --- |
| Tactical | 5.0% | +3.0 pp |
| Positional | 11.0% | +1.3 pp |
| Defensive | 25.3% | +1.7 pp |
| Endgame | 7.2% | +1.4 pp |
| Aggressive | 24.7% | +1.8 pp |
