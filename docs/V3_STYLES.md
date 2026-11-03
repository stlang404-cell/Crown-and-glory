# AI personality validation (crown-styles-2)

**Verdict: no playing style passed validation in v0.3.0.** Every competitor therefore plays the common
engine policy, and the UI shows their style as "Universal" (a listed style that failed is mentioned on the
profile as not validated). Nothing claims a personality that was not measured.

## Design

Styles are **bounded move-choice policies** (`src/engine/styles.ts`): after the normal search, all legal
moves are scored at (achieved depth − 2); among moves within **20 cp** of the best, the style picks the move
with the highest preference score (ties → the engine's choice). A style can therefore never choose a move
judged more than 20 cp worse, which protects strength. Preferences:

| Style | Prefers |
| --- | --- |
| Tactical attacker | checks, captures, moves attacking valuable pieces |
| Risk-taking aggressor | checks, pressure near the enemy king, advances, pawn moves |
| Positional strategist | quiet non-forcing moves, central squares, piece moves |
| Defensive specialist | more friendly pieces around the king, retreats; avoids checks/captures |
| Endgame technician | in endgames: pawn advances and central king |

An earlier attempt (style-specific evaluation weights) changed only 8–12% of moves and showed no signature
difference; it was replaced.

## Validation protocol (`tools/styles/validate.ts`)

- **Behaviour:** 400 fixed positions (every third oracle position with ≥ 3 legal moves), 20k nodes. Pass
  requires disagreement with the universal policy ≥ 10% **and** the style's signature feature moving in the
  claimed direction by ≥ 3 percentage points (tactical/aggressive: more forcing moves; positional/defensive:
  fewer; endgame: more pawn moves in endgames).
- **Strength parity:** 32 colour-swapped opening pairs vs universal at 20k nodes; |Elo| ≤ 100.
- A style ships only if both pass.

## Results (behaviour, 400 positions)

| Style | Disagreement | Signature Δ | Forcing rate (base 0.297) | Behaviour |
| --- | --- | --- | --- | --- |
| Tactical | 5.0% | +3.0 pp | 0.328 | **fail** (too few changed moves) |
| Positional | 11.0% | +1.3 pp | 0.285 | **fail** (signature too small) |
| Defensive | 25.3% | +1.7 pp | 0.280 | **fail** (signature too small) |
| Endgame | 7.2% | +1.4 pp | 0.290 | **fail** |
| Aggressive | 24.7% | +1.8 pp | 0.315 | **fail** (signature too small) |

Since every style fails the behavioural criterion, none can ship regardless of the strength result. The
strength-parity run is recorded in `src/engine/styles-validation.json` when it completes; the shipped file
lists `validated: []`.

## Why it failed and what is next

In 6×6 positions there are usually only a few moves within 20 cp of the best, so the bounded policy rarely
has a choice that expresses the style; where it does (defensive, aggressive ≈ 25%), the alternatives differ
in ways the forcing-move signature does not capture strongly. v0.4.0 (docs/V4_PLAN.md §2) will try phase-
and depth-dependent margins and style-specific search terms with the same harness and stricter sample sizes.
