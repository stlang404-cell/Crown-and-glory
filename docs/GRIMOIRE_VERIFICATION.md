# The Sovereign's Grimoire — verification report

What was checked, how, and what remains provisional. Reproduce every check with
`npx tsx tools/grimoire/check.ts` (exit 0 required; also run by `tests/grimoire.test.ts`).

## 1. Scope and size
| Part | File | Words | Checked boards |
|---|---|---|---|
| Official rulebook | docs/RULEBOOK.md | 9,514 | 21 |
| Book I — The Apprentice (9 chapters) | docs/grimoire/01-book-i-apprentice.md | 16,077 | 71 |
| Book II — The Duelist (11 chapters) | docs/grimoire/02-book-ii-duelist.md | 17,969 | 72 |
| Book III — The Strategist (9 chapters) | docs/grimoire/03-book-iii-strategist.md | 16,602 | 44 |
| Book IV — The Master (8 chapters) | docs/grimoire/04-book-iv-master.md | 14,488 | 55 |
| Book V — The Sovereign (8 chapters) | docs/grimoire/05-book-v-sovereign.md | 12,253 | 18 |
| Book VI — The Oracle (7 chapters) | docs/grimoire/06-book-vi-oracle.md | 8,923 | 2 |
| Twelve-week program | docs/grimoire/07-twelve-week-program.md | 3,166 | — |
| Glossary (~95 terms) | docs/grimoire/08-glossary.md | 2,294 | — |
| **Total** | | **101,286** | **283** |

Editions: `docs/THE_SOVEREIGNS_GRIMOIRE.md` (single file), `docs/grimoire/build/grimoire.html` (offline, light/dark),
`docs/grimoire/build/grimoire.pdf` (269 A5 pages, every board drawn as an SVG diagram). Rules traceability:
`docs/RULES_TRACEABILITY.md` (100 rules → code → tests).

## 2. How each kind of statement was verified
| Claim on a board | Count | Verification | Strength |
|---|---|---|---|
| Legal position (every board) | 283 | Parsed by the game's own `Position.fromFen` (no bishops, one king each, no pawns on the back ranks, side not to move not in check) | Exact |
| Move lines (`line:`) | all lines | Every SAN move legal in sequence, spelled as the game spells it, + and # marks correct | Exact |
| checkmate / stalemate / bare-kings | 17 | `automaticOutcome` of the real adjudication code | Exact |
| mate-in-N (N = 1–3) | 11 | Exhaustive proof: every defence tried; the stated first move must be one that mates | Exact |
| only-mate-in-N | 31 | As above, and exactly one first move mates in ≤ N | Exact |
| puzzle <id> | 132 boards, 119 distinct puzzles | Academy puzzles verified by `crown-puzzle-verify-2` (engine best by a clear expected-score gap, no alternative winning mate, defences checked); FEN must match | Engine judgement (documented policy) |
| best <SAN> | 20 | Same puzzle policy run on the position at check time | Engine judgement — labelled in the text |
| tablebase <result> | 7 | Exhaustive retrograde solution of the 3–4-man ending (`tools/grimoire/endgame.ts`, real move generator): value and distance to mate for the side to move, after `line` | Exact |
| legal only (illustrations) | 65 | Legality only; the surrounding prose is not machine-checked | Prose reviewed by the authors with scripts |

Statements in the prose are tagged **Evidence** (measured, method stated), **Engine judgement** or **Guidance /
Counsel** (advice, not proven).

## 3. Evidence computed for the books (method in each chapter)
* 8,956 archived engine games (all benchmark results) replayed under the real rules — 0 illegal moves. Balanced subset
  (5,568 games): White 55.9 %; checkmate 66.2 %, threefold claim 22.9 %, bare kings 4.9 %, 100-halfmove claim 4.9 %,
  stalemate 1.0 %; median 75 plies; a promotion in 51.3 % of games (3,682 queens, 121 knights, 52 rooks).
* Depth-14 scores of every White first move; depth-12 material-imbalance experiments (colours swapped).
* Exhaustive endgame enumeration with the retrograde solver **`tools/grimoire/endgame.ts`** (committed; backward
  induction over the real move generator of `src/rules`, both sides to move, captures and promotions resolved through
  the smaller/next material classes, so DTM counts through the promotion). `npx tsx tools/grimoire/endgame.ts`
  re-computes every published figure in ~20 s; `--probe "<fen>"` values one position and each of its moves;
  `tests/endgame.test.ts` re-checks KQK/KRK/KNK/KPK in a few seconds. Boards in Books III–IV carry
  `claim: tablebase win-in-N | loss-in-N | draw`, checked by `check.ts` (7 boards). "Quiet" = the side to move is not
  in check and has no capture (the book's definition; it reproduces the published counts exactly).
  Re-run results (all White = the stronger side; WTM/BTM = White/Black to move):

  | Claim (book) | Published | Solver | |
  |---|---|---|---|
  | KQK: all WTM won, longest | ≤ 7 moves, `6/6/4k1/6/1Q4/K5 w` | 19,360 WTM, 100 % won, max 7, same FEN | agrees |
  | KRK: WTM positions, all won, longest | 25,440, ≤ 12, `6/6/6/6/2k3/KR4 w` | 25,440, 100 %, max 12, same FEN | agrees |
  | KNK | no win | 0 wins / 0 losses either side | agrees |
  | KNNK WTM: positions, wins | 447,832; 0.1 %, all mate-in-1 on the board | 447,832; 408 (0.09 %), all mate in 1 | agrees |
  | KNNK BTM | "none is lost" | 88 of 583,440 lost — all already checkmate on the board | **corrected** (text now says so) |
  | KPK WTM | 22,484; 76.0 %; a/f 71.6, b/e 76.7, c/d 79.8 %; longest 20 from `6/k5/6/6/K3P1/6 w` | 22,484; 76.0 % (17,088); 71.6 / 76.7 / 79.8 %; max 20 (that FEN is a 20; ties exist) | agrees |
  | KPK examples (opposition, key squares d2/d3/d4/b3/a3, rule of the square, Book III conversion Kc5 9 / Kc4, Ke4 11 / Kc3, Ke3 draw, `6/6/3K2/3P2/2k3/6 b` mate in 10, `3k2/6/6/3K2/3P2/6`) | as printed | identical | agrees |
  | KQ v KR quiet BTM | 326,672; W 87.8 / D 10.6 / L 1.6 %; longest 23 | 326,672; 87.8 / 10.6 / 1.6 %; max 23 (WTM and BTM) | agrees |
  | KR v KN | 852,400 WTM; 592,704 quiet BTM; 88.3 % drawn; longest 29 | 852,400; 592,704; 11.7 % won / 88.3 % drawn; max 29 WTM (28 from a quiet BTM position) | agrees |
  | KR v KN by king–knight distance 1/2/3/4+ | 2.5 / 3.4 / 7.3 / 27.1 % | 2.5 / 3.4 / 7.3 / 27.1 % | agrees |
  | KR v KN by defender king: edge / 2nd ring / centre / corner | 17.5 / 4.0 / 0.8 / 33.0 % | edge **including** corners 17.5 % (edge without corners 13.2 %) / 4.0 / 0.8 / 33.0 % | **clarified** (column now "the edge (corners included)") |
  | KR v KN diagrams `2nk2/6/3K2/6/6/5R w`, `n2k2/6/6/3K2/6/5R w` | draw; mate in 10 | draw; win in 10 | agrees |
  | Longest wins vs 100 halfmoves (Book IV.7) | KQK 7, KRK 12, KPK 20, KQ–KR 23, KR–KN 29 | same | agrees |

  Book IV's method note was updated: the program is now part of the repository.
* Exchange arithmetic (Book VI) computed with the game's own LMSR, fee, cancellation, Davidson and Brier functions.

## 4. Corrections found while writing (code wins)
* A pawn needs **four** single steps from its starting rank to promote (three after its first move).
* A knight can never fork the starting king (d1) and queen (c1): they stand on squares of different colours.
* Official markets never list your own games, but the **Sandbox Exchange** lets you back yourself on casual quick
  matches with practice money (described in Books V–VI and the rulebook).
* Thirteen documentation/code discrepancies (RULES_TRACEABILITY §D1–D13); D5, D6, D7, D11, D12, D13 fixed in code or
  docs, the rest documented as current behaviour (D1 forfeits count for the opponent's public rating, D2 the player is
  seeded last in league lists, D3 knockout tiebreak labels, D4 Club Weekend size at levels 2–3, D8 "abandoned" never set,
  D9 Swiss registration closes after round 3, D10 sparring games can carry a practice market). Reviewed again
  (RULES_TRACEABILITY, "Review of the current-behaviour discrepancies"): D9 and D10 were implementation defects and are
  fixed (pure registration rule closes before round 4; sparring games never carry a practice market); D1, D2, D3, D4
  and D8 are intended, documented behaviour and were kept.

## 5. Issues found in the game (logged in docs/BUG_REGISTER.md)
* Opponent style labels "Defensive", "Endgame" and "Aggressive" currently play as Universal; only Tactical and
  Positional change anything, and only the first six plies of the opening.
* The live in-play odds model ignores the rating gap: at an equal evaluation it returns about 0.35 / 0.30 / 0.35 for
  any pairing.
* Rules without any test (RULES_TRACEABILITY): claims only by the side to move; engine draw claims/offers; engine-vs-
  engine auto-claims and the 400-halfmove limit; rated play needing a calibrated opponent; Random Match defaults;
  whole-share trades; market cancellation at the playing limit; paper-forecast revision; and others listed there.

## 6. Provisional or unverified
* Prose explanations (why a move works) are not machine-checked beyond the board and line.
* "Best" moves and puzzle solutions are engine judgements under a documented policy, not proofs.
* Engine-played mating demonstrations (Book I) are legal and end in mate; optimality is not claimed.
* Strategic advice tagged Guidance/Counsel is advice. Statistics are associations from engine games (opening moves in
  the archive were assigned by a book, so first-move scores are not causal).
* Grading (Brilliant etc.) and Played Like are experimental/unvalidated in the game; the books say so.

## 7. Future curriculum
Five-man endgame tables (e.g. KRP v KR) need a more compact index than `endgame.ts` uses (36^n slots); a checker for prose square-control statements; more
Book VI exercises once Exchange markets expand; human-play validation of the 12-week program (not done: no human
playtests were run); translations of the glossary; additional mate-in-N and endgame puzzle sets mined from new engine
games.
