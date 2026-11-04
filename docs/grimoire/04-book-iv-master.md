# Book IV — The Master

*Being the fourth book of THE SOVEREIGN'S GRIMOIRE: FROM APPRENTICE TO CHESS SOVEREIGN, for players of Crown & Calculation (rules `crown-la6-v1`).*

Welcome to the Masters' Hall, Strategist. You know where pieces belong and why. Now you must become exact. A master's spells are short and they never misfire: the right candidate moves, a forcing line calculated to its end, a defence found when all seems lost, and the cold certainties of the endgame. On a board of 36 squares those certainties are closer than you think: many endings that are mysteries on the older board can here be solved completely, and this book does so.

**How to read this book.** As in Book III, every board is checked by `tools/grimoire/check.ts`. A caption that says **mate in N** (N ≤ 3) was proven by the checker, which tried every defence; **only** means no other first move mates as fast. Claims carry labels:

- **Proven** — by the checker's exhaustive mate search.
- **Evidence (exhaustive enumeration)** — by retrograde analysis written for this book: every legal position of an ending (for example king and rook against king and knight: 852,400 positions with White to move) was generated with the real move generator of `src/rules`, and won/drawn/lost values with distance to mate were computed backwards from the checkmates. The solver is `tools/grimoire/endgame.ts` (`npx tsx tools/grimoire/endgame.ts` re-computes every figure in this book in about 20 seconds; `--probe "<fen>"` gives the value of any 3- or 4-man position and of each of its moves), and `tests/endgame.test.ts` re-checks a sample of the results; the positions are reported exactly so that anyone can test them. A position is *quiet* when the side to move is not in check and has no capture.
- **Evidence (archive)** — measured on the engine-game archive described in Book III's Ledger (method A: 5,568 games from balanced pairings).
- **Engine judgement** — the canonical engine (`crown-search-2` + `crown-eval-4`, `CANON_OPTS`) at the stated depth.
- **Guidance** — advice.

---

## Chapter IV.1 — The Branching Path: Candidate Moves and Calculation

### Learning objectives
- Generate candidate moves in a fixed order, including the quiet moves most players forget.
- Calculate a short line to its end and check every defence.
- Use the small size of the board to calculate deeper than you think you can.

### Prerequisites
Books II and III.

### Explanation
**The tree is narrow.** **Evidence (archive, 640-game match):** a position offers on average **12.9** legal moves (max 44); in the endgame (after ply 60) only **10.5**. One fifth of all moves played were captures (21.4%) and one in seven gave check (14.1%). With so few branches, a human can calculate three or four moves deep in most positions — if the candidates are chosen well.

**The candidate order.**
1. **Checks** — every one, even the absurd ones. On a small board, a check often forces the only reply.
2. **Captures** — every one, including captures by the king.
3. **Threats** — moves that attack something or threaten mate.
4. **Quiet moves that take squares away** — especially king moves and rook moves that cut the enemy king off. These are the moves players miss.

**The defence check.** For each candidate, list every legal reply, not only the one you hope for. Small boards make this possible: often there are fewer than five replies.

**Stop at quiet positions.** Calculate until nothing hangs and no check is pending, then evaluate with the strategy of Book III.

### Illustrated example

```crown
fen: 5k/R5/3K2/1P4/P5/6 w - - 3 27
line: Ke4 Ke6 Ra6#
claim: only-mate-in-2
caption: From an engine game. White to move: the only mate in two is the quiet king move 1. Ke4. No check, no capture — the king takes e5 and f5 away, and Black's king must walk into the rook's sixth-rank mate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ ♖ · · · · ·
4 │ · · · ♔ · ·
3 │ · ♙ · · · ·
2 │ ♙ · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*From an engine game. White to move: the only mate in two is the quiet king move 1. Ke4. No check, no capture — the king takes e5 and f5 away, and Black's king must walk into the rook's sixth-rank mate.*
<!-- /diagram -->

### Step-by-step reasoning
1. **Checks:** `1. Ra6+` and `1. Rf5+`. After `1. Ra6+` the king escapes to f5 (the rook has left the fifth rank); after `1. Rf5+` it escapes to e6. Both checks give the king air.
2. **Captures:** none.
3. **Threats:** none forcing.
4. **Quiet moves that take squares:** `1. Ke4` takes e5 and f5 (and d5). Now Black's king on f6 has one move: `1...Ke6` (e5 and f5 are covered by the king, the fifth rank by the rook). Then `2. Ra6#`: the rook covers d6–f6 along the sixth rank, the king covers d5, e5 and f5.

**Proven:** this is the only mate in two.

### Common mistakes
- Looking only at checks. Here every check lets the king out.
- Stopping the calculation at the move you like ("then I check and win") without listing the defender's replies.
- Forgetting that the king itself is an attacking piece in the endgame.

### Advanced insight
Because rooks and queens cut whole files and ranks on a six-square edge, the defending king usually has only one or two squares. A quiet move that takes one of them away is often stronger than any check. Train your eye to ask "how many squares does their king have?" before "what checks do I have?".

### Worked example
A real engine position with a capture-check, a queen check and a quiet finish.

```crown
fen: rk2n1/2R3/2p1N1/4Q1/P1P1P1/1n2K1 w - - 1 18
line: Rxc4+ Kb5 Qb3+ Ka5 Qb4#
claim: only-mate-in-3
caption: White to move mates in three, and only by 1. Rxc4+. The line played: 1. Rxc4+ Kb5 2. Qb3+ Ka5 3. Qb4#.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♚ · · ♞ ·
5 │ · · ♖ · · ·
4 │ · · ♟ · ♘ ·
3 │ · · · · ♕ ·
2 │ ♙ · ♙ · ♙ ·
1 │ · ♞ · · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*White to move mates in three, and only by 1. Rxc4+. The line played: 1. Rxc4+ Kb5 2. Qb3+ Ka5 3. Qb4#.*
<!-- /diagram -->

1. **Candidates.** Black's king is on b6, White's rook on c5 and queen on e3 — all on one diagonal, e3–d4–c5–b6. So any move of the c5-rook is a **discovered check** from the queen. The best of them also captures: `1. Rxc4+` takes a pawn, and on c4 the rook will later protect the queen.
2. **Replies.** The king must answer the queen's check. The game went `1...Kb5`; the checker tried every reply and found a mate by move 3 in each.
3. **The finish.** `2. Qb3+` checks along the b-file, `2...Ka5` is forced, and `3. Qb4#`: the queen, protected by the rook on c4, covers a4, b5 and b6, and Black's own rook blocks a6.

### Guided exercise
White to move. White's knights are scattered and Black's b-pawn is two steps from crowning. Find the only move that holds.

```crown
fen: 1nk1n1/r2pp1/6/Np1NP1/3P1K/R5 w - - 2 15
claim: puzzle pz-rz4qge
caption: Guided exercise (Academy puzzle pz-rz4qge). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♞ ♚ · ♞ ·
5 │ ♜ · · ♟ ♟ ·
4 │ · · · · · ·
3 │ ♘ ♟ · ♘ ♙ ·
2 │ · · · ♙ · ♔
1 │ ♖ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise (Academy puzzle pz-rz4qge). White to move.*
<!-- /diagram -->

*Hint:* start with checks. *Answer:* `15. Nxe5+`. The d3-knight takes the e5-pawn with check (from e5 it attacks the king on c6). After `15...Kc5 16. Nd3+ Kd6 17. Nb2` the knight is back in time to blockade the b-pawn on b2. **Engine judgement (depth 10):** −14 (holding); the other checks `15. Rc1+` and `15. Nb4+` are −197.

### Independent exercises
1. White to move. Find the quiet rook move that mates in two.

```crown
fen: 6/4RR/1k4/1Pp1P1/2P1n1/1K4 w - - 3 34
claim: only-mate-in-2
caption: Exercise 1 (from an engine game). White to move: mate in two.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · ♖ ♖
4 │ · ♚ · · · ·
3 │ · ♙ ♟ · ♙ ·
2 │ · · ♙ · ♞ ·
1 │ · ♔ · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (from an engine game). White to move: mate in two.*
<!-- /diagram -->

2. White to move. A Black pawn on c3 is attacking d2. Find the only move that holds.

```crown
fen: q2k1r/2n3/1n1p1p/1Pp2R/2PPP1/1NQK2 w - - 0 13
claim: puzzle pz-1ojk9ut
caption: Exercise 2 (Academy puzzle pz-1ojk9ut). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♛ · · ♚ · ♜
5 │ · · ♞ · · ·
4 │ · ♞ · ♟ · ♟
3 │ · ♙ ♟ · · ♖
2 │ · · ♙ ♙ ♙ ·
1 │ · ♘ ♕ ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-1ojk9ut). White to move.*
<!-- /diagram -->

3. White to move. Black's queen on c5 is close to White's queen on a3. Find the forcing sequence.

```crown
fen: rn1k2/p1q1pr/3p2/QP4/2PP1P/R2KR1 w - - 0 12
claim: puzzle pz-taj1mu
caption: Exercise 3 (Academy puzzle pz-taj1mu). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ·
5 │ ♟ · ♛ · ♟ ♜
4 │ · · · ♟ · ·
3 │ ♕ ♙ · · · ·
2 │ · · ♙ ♙ · ♙
1 │ ♖ · · ♔ ♖ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (Academy puzzle pz-taj1mu). White to move.*
<!-- /diagram -->

4. The same theme with one difference (Black's pawns are on d5 and e4). White to move.

```crown
fen: rn1k2/p1qp1r/4p1/QP4/2PP1P/R2KR1 w - - 0 12
claim: puzzle pz-1qqoidw
caption: Exercise 4 (Academy puzzle pz-1qqoidw). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ·
5 │ ♟ · ♛ ♟ · ♜
4 │ · · · · ♟ ·
3 │ ♕ ♙ · · · ·
2 │ · · ♙ ♙ · ♙
1 │ ♖ · · ♔ ♖ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 4 (Academy puzzle pz-1qqoidw). White to move.*
<!-- /diagram -->

### Answers with explanations
1. `34. Ra5!` The e5-rook slides to a5 (the f5-rook could not: the e5-rook was in the way). Black's king on b4 now has no square at all: a3, a4 and a5 are covered by the rook on the a-file, b5 and c5 by the rook on the fifth rank, c4 by the b3-pawn; b3 is a pawn protected by c2, and c3 holds Black's own pawn. Whatever Black plays, `35. Ra4#` follows, the rook protected by the b3-pawn (the game went `34...Nc1 35. Ra4#`). **Proven:** the only mate in two.
2. `13. dxc3`. The d2-pawn takes the c3-pawn before it can take on d2, and from c3 it attacks Black's knight on b4. **Engine judgement (depth 10):** +2 (level); `13. Qa3` is −222 and `13. Nxc3` −284.
3. `12. b4! Qb5 13. bxa5+`. The pawn attacks the queen; the queen's only good square is b5; then the pawn captures on a5 and *uncovers* the White queen's diagonal a3–b4–c5–d6: discovered check. After `13...Ke6 14. axb6=Q+` White promotes with check. **Engine judgement (depth 10):** +57; the natural `12. Qxc5+` is −171.
4. `12. b4! axb4 13. Qxa6`. Again the pawn attacks the queen; this time Black takes it with the a-pawn, which opens the a-file, and White's queen takes the rook on a6. **Engine judgement (depth 10):** +22; `12. Re2` −133.

### Summary
- 12.9 legal moves per position on average: calculate deeper than you would on a larger board.
- Candidate order: checks, captures, threats, then quiet square-takers (especially king moves).
- List every defence; stop at quiet positions and evaluate.

### Next lesson
Chapter IV.2: forcing lines — how to calculate them, and how to judge where they end.

---

## Chapter IV.2 — The Chain of Compulsion: Evaluating Forcing Lines

### Learning objectives
- Recognise forcing sequences (checks, captures, threats of mate or promotion).
- Judge the final position of a forcing line correctly: material, king safety, pawns about to crown.
- Understand engine mate scores and the "horizon" of a calculation.

### Prerequisites
Chapter IV.1.

### Explanation
A **forcing line** is a sequence in which the opponent's replies are limited to a few legal or sensible moves. Checks are the most forcing (the reply must deal with check), then captures that must be recaptured, then threats of mate or promotion.

**How to evaluate the end of a forcing line:**
1. **Count material** — but count the pawns about to crown as nearly queens.
2. **Check king safety** — after a sacrifice, which king is in the open?
3. **Look one move further** — is there a check or capture *right after* your line ends? That is the "horizon" trap: the position looks good until the next move.

**Engine mate scores.** When the engine finds a forced mate it reports a score near 30,000 (for example 29,991 means mate in a few moves from the root). Puzzle analyses in this book quote such scores as "the engine announces mate".

### Illustrated example

```crown
fen: r4k/1RR2p/2P1pP/P1PpP1/3P1K/6 w - - 3 28
line: Rxf5+ Ke6 Rbe5+ Kd6 Rf6#
claim: only-mate-in-3
caption: From an engine game. White mates in three, and only by 1. Rxf5+. Two rooks drive the king along the sixth rank: 1. Rxf5+ Ke6 2. Rbe5+ Kd6 3. Rf6#.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · · · ♚
5 │ · ♖ ♖ · · ♟
4 │ · · ♙ · ♟ ♙
3 │ ♙ · ♙ ♟ ♙ ·
2 │ · · · ♙ · ♔
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*From an engine game. White mates in three, and only by 1. Rxf5+. Two rooks drive the king along the sixth rank: 1. Rxf5+ Ke6 2. Rbe5+ Kd6 3. Rf6#.*
<!-- /diagram -->

### Step-by-step reasoning
1. **The forcing first move.** `1. Rxf5+` captures with check (the c5-rook slides through d5 and e5; the b5-rook is blocked). Black's king on f6 must move, and e6 is its only square: e5 is covered by the rook on f5 and by the f4-pawn.
2. **The second check.** `2. Rbe5+`: the b5-rook joins on e5 (the `b` says which rook), protected by the f4-pawn. The king must go to d6 (d5 is covered by the rook and by the c4-pawn).
3. **The finish.** `3. Rf6#`: the f5-rook rises to f6 and checks along the sixth rank; the e5-rook covers c5 and d5; the king has nowhere to go. The checker confirms it is the only mate in three.

### Common mistakes
- Evaluating the end of a line by material only, when an enemy pawn is one step from crowning.
- Stopping one move early: "I win the queen" — but the opponent then mates or forks.
- Trusting a "forcing" line that contains a quiet move by the opponent you did not consider.

### Advanced insight
Promotion makes horizons treacherous on a six-rank board: a pawn on its 5th rank crowns next move, so a line that "wins a rook" may end with the opponent queening. Always add "and then, can a pawn crown?" to the last position of every line.

### Worked example
A forcing line that the engine sees to mate.

```crown
fen: 3k1r/1R4/1KPn1p/2nppP/6/R5 w - - 2 35
claim: puzzle pz-culn07
caption: Academy puzzle pz-culn07. White to move. The engine announces mate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ♜
5 │ · ♖ · · · ·
4 │ · ♔ ♙ ♞ · ♟
3 │ · · ♞ ♟ ♟ ♙
2 │ · · · · · ·
1 │ ♖ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-culn07. White to move. The engine announces mate.*
<!-- /diagram -->

The solution begins `35. Ra6+ Nc6+ 36. Kxc3`. The rook check from a6 drives the king; Black's best is to block with a knight check, and White's king calmly captures on c3. **Engine judgement (depth 10):** a forced mate (score 29,991; its line continues `36...Rf5 37. Rxf5 Ke6 38. Rd5 d2 39. Rxc6#`). The calmer `35. c5+` is only +271. When a line is all checks and captures, calculate it to the end before choosing a "safe" move.

### Guided exercise
Black to move. Black's queen and rook face a White king on d2. Find the forcing line that wins material.

```crown
fen: r2k2/pp1p1r/2qP1n/P4N/2QK1P/R3NR b - - 2 14
claim: puzzle pz-t9swgq
caption: Guided exercise (Academy puzzle pz-t9swgq). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ · ·
5 │ ♟ ♟ · ♟ · ♜
4 │ · · ♛ ♙ · ♞
3 │ ♙ · · · · ♘
2 │ · · ♕ ♔ · ♙
1 │ ♖ · · · ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise (Academy puzzle pz-t9swgq). Black to move.*
<!-- /diagram -->

*Answer:* `14...Qe2+ 15. Kc1 Rc6`. The queen checks from e2 (the king's only square is c1), and the rook pins White's queen on c2 to the king on c1 along the c-file. **Engine judgement (depth 10):** +249 for Black; the greedy `14...Qxf1` only −119.

### Independent exercises
1. White to move: mate in three. Only one first move works.

```crown
fen: 1Q4/3pr1/P1p1k1/5p/3K1P/1RR3 w - - 3 24
claim: only-mate-in-3
caption: Exercise 1 (from an engine game). White to move: mate in three.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♕ · · · ·
5 │ · · · ♟ ♜ ·
4 │ ♙ · ♟ · ♚ ·
3 │ · · · · · ♟
2 │ · · · ♔ · ♙
1 │ · ♖ ♖ · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (from an engine game). White to move: mate in three.*
<!-- /diagram -->

2. White to move: mate in three. White is in check from the knight on d2. The first move is a capture, but not a check.

```crown
fen: r3k1/1pP3/1P3R/pNQ1pK/P2n1N/6 w - - 1 24
claim: only-mate-in-3
caption: Exercise 2 (from an engine game). White to move: mate in three.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · · ♚ ·
5 │ · ♟ ♙ · · ·
4 │ · ♙ · · · ♖
3 │ ♟ ♘ ♕ · ♟ ♔
2 │ ♙ · · ♞ · ♘
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (from an engine game). White to move: mate in three.*
<!-- /diagram -->

3. White to move. Sacrifice, promote, mate.

```crown
fen: 1n1k2/5R/1r2P1/p2p2/3P2/2RK2 w - - 0 29
claim: puzzle pz-1xogykc
caption: Exercise 3 (Academy puzzle pz-1xogykc). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♞ · ♚ · ·
5 │ · · · · · ♖
4 │ · ♜ · · ♙ ·
3 │ ♟ · · ♟ · ·
2 │ · · · ♙ · ·
1 │ · · ♖ ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (Academy puzzle pz-1xogykc). White to move.*
<!-- /diagram -->

### Answers with explanations
1. `24. Qe3+ Kf5 25. Qxf3+ Ke6 26. Rb6#`. The queen checks from e3, takes the f3-pawn with check, and the b1-rook runs up the open b-file to mate on the sixth rank while the queen covers f5 and f6. **Proven:** the only mate in three.
2. `24. Nxd2 exd2 25. Qf6+ Kd5 26. Rd4#`. The b3-knight takes the checking knight; after `24...exd2` the queen checks from f6 and the f4-rook mates on d4. Of all the ways out of check, only this one keeps the initiative. **Proven:** the only mate in three.
3. `29. e5+ Ke6 30. Rc6+ Kxf5 31. e6=Q+`. The pawn checks, the c1-rook checks on c6 (and is sacrificed: the king takes the f5-rook instead), and the e-pawn crowns with check. **Engine judgement (depth 10):** the engine announces mate (score 29,987); the quiet `29. Rfc5` is only +82.

### Summary
- Forcing moves: checks, captures, mate and promotion threats.
- Evaluate the final position by material, king safety and pawns about to crown; look one move further.
- Engine mate scores are near 30,000.

### Next lesson
Chapter IV.3: the art of defence.

---

## Chapter IV.3 — The Unbroken Ward: Defensive Resources

### Learning objectives
- Find saving resources: perpetual check, counter-sacrifice, the trade into bare kings, and returning material.
- Use the rules (repetition, bare kings, stalemate) as defensive weapons.
- Keep defending: half of all engine games with a one-pawn deficit were not lost.

### Prerequisites
Chapters IV.1–IV.2.

### Explanation
**Defence is common and often works.** **Evidence (archive):** with a one-pawn deficit at the first quiet moment after move 20, the defender lost only 48.0% of games (Book III, Chapter III.9); 22.9% of all balanced games ended in a threefold-repetition claim, 4.9% by bare kings, 4.9% by the 100-halfmove claim and 1.0% by stalemate.

**The defender's toolkit:**
1. **Perpetual check.** If you can check forever, you draw. Knights and queens are the usual instruments.
2. **Counter-sacrifice / returning material.** Give back what you are behind to break the attack.
3. **The bare-kings trade.** If you can trade your last piece for the opponent's last piece, the game is **automatically drawn** (rule: only two kings remain).
4. **Stalemate.** A defender with few moves can sometimes run out of them (Chapter IV.7).
5. **Fortresses.** Some material advantages cannot win at all (Chapter IV.6, IV.7).

### Illustrated example

```crown
fen: rnk2r/pNnq1p/2p3/2PpQ1/PP2PP/R2K1R w - - 3 11
claim: puzzle pz-1uhg8w8
caption: Academy puzzle pz-1uhg8w8. White to move. White's knight on b5 is attacked by Black's king, and Black's pawn on d3 eyes e2. Find the only move that holds.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♚ · · ♜
5 │ ♟ ♘ ♞ ♛ · ♟
4 │ · · ♟ · · ·
3 │ · · ♙ ♟ ♕ ·
2 │ ♙ ♙ · · ♙ ♙
1 │ ♖ · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-1uhg8w8. White to move. White's knight on b5 is attacked by Black's king, and Black's pawn on d3 eyes e2. Find the only move that holds.*
<!-- /diagram -->

### Step-by-step reasoning
1. **The danger.** White's knight on b5 is attacked by the king on c6, and Black's pawns on d3 and c4 tear at White's king. Quiet defence (`Re1`, `Qd4`) loses: **engine judgement (depth 10)** −593.
2. **The resource.** `11. Nd4+` — the knight checks from d4. After `11...Kd6 12. Nb5+ Kc6 13. Nd4+` the same position returns.
3. **The verdict.** **Engine judgement:** 0.00, a draw by repetition. The defender who is losing should look for a sequence that the attacker cannot escape.

### Common mistakes
- Defending passively when a perpetual check is available.
- Refusing to give back material. A pawn returned is better than a king lost.
- Forgetting that trading the last pieces into bare kings is an automatic draw.

### Advanced insight
Why are perpetual checks so frequent here? Because the kings are close to every piece on a 6×6 board, and with only 10–13 legal moves per position the attacker's king often has just one or two squares to oscillate between. When you are worse, count the checks before you count the pawns.

### Worked example
A queen perpetual from the opening.

```crown
fen: rnqkr1/pp4/n1pP2/P1p2N/1P3P/R1QK1R w - - 0 11
claim: puzzle pz-bus7cm
caption: Academy puzzle pz-bus7cm. White to move. Black's pawn on c3 threatens to take on b2 and crown; White's position is collapsing.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♜ ·
5 │ ♟ ♟ · · · ·
4 │ ♞ · ♟ ♙ · ·
3 │ ♙ · ♟ · · ♘
2 │ · ♙ · · · ♙
1 │ ♖ · ♕ ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-bus7cm. White to move. Black's pawn on c3 threatens to take on b2 and crown; White's position is collapsing.*
<!-- /diagram -->

`11. Qf4+! Kd5 12. Qf5+ Kd6 13. Qf4+` and the king cannot escape the checks on the f4–d6 and f5–d5 lines. **Engine judgement (depth 10):** 0.00; every other move is −1,134 or worse. The losing side found a draw in one move.

### Guided exercise
White to move. White has only a rook against queen and king. Find the move that draws at once.

```crown
fen: 6/4R1/K5/6/6/3kq1 w - - 0 35
claim: puzzle pz-1w5drbc
caption: Guided exercise (Academy puzzle pz-1w5drbc). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · ♖ ·
4 │ ♔ · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · ♚ ♛ ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise (Academy puzzle pz-1w5drbc). White to move.*
<!-- /diagram -->

*Answer:* `35. Rxe1+ Kxe1`. The rook takes the queen with check and is recaptured: only kings remain, an automatic draw. The checker confirms the result:

```crown
fen: 6/4R1/K5/6/6/3kq1 w - - 0 35
line: Rxe1+ Kxe1
claim: bare-kings
show: after
caption: After 35. Rxe1+ Kxe1: bare kings, an automatic draw under crown-adj-1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ ♔ · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · ♚ ·
  └─────────────
    a b c d e f    White to move
```
*After 35. Rxe1+ Kxe1: bare kings, an automatic draw under crown-adj-1.*
<!-- /diagram -->

### Independent exercises
1. White to move. Black's queen on a1 and rook on a6 threaten everything. Find the only move that holds.

```crown
fen: r5/1p1P2/6/1P1K2/1k4/q2R2 w - - 0 33
claim: puzzle pz-1e3gsvq
caption: Exercise 1 (Academy puzzle pz-1e3gsvq). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · · · ·
5 │ · ♟ · ♙ · ·
4 │ · · · · · ·
3 │ · ♙ · ♔ · ·
2 │ · ♚ · · · ·
1 │ ♛ · · ♖ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (Academy puzzle pz-1e3gsvq). White to move.*
<!-- /diagram -->

2. Black to move. White's queen and passed pawn are close to crowning a second queen. Find the only move that holds.

```crown
fen: 1Q3r/5P/p2nk1/6/1P4/3K1R b - - 0 22
claim: puzzle pz-3rc51e
caption: Exercise 2 (Academy puzzle pz-3rc51e). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♕ · · · ♜
5 │ · · · · · ♙
4 │ ♟ · · ♞ ♚ ·
3 │ · · · · · ·
2 │ · ♙ · · · ·
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (Academy puzzle pz-3rc51e). Black to move.*
<!-- /diagram -->

3. Black to move. Black's rook on b1 is attacked by the queen. Find the only move that holds.

```crown
fen: 4k1/4pr/3p2/6/2PPRP/1rQK2 b - - 1 17
claim: puzzle pz-gbfcab
caption: Exercise 3 (Academy puzzle pz-gbfcab). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · ♟ ♜
4 │ · · · ♟ · ·
3 │ · · · · · ·
2 │ · · ♙ ♙ ♖ ♙
1 │ · ♜ ♕ ♔ · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (Academy puzzle pz-gbfcab). Black to move.*
<!-- /diagram -->

4. White to move. A Black rook has landed on e2, next to White's king. Find the only move that holds.

```crown
fen: 2q3/1p1k1p/1p1n1Q/r4P/P3rR/2RK2 w - - 0 20
claim: puzzle pz-34jbi3
caption: Exercise 4 (Academy puzzle pz-34jbi3). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♛ · · ·
5 │ · ♟ · ♚ · ♟
4 │ · ♟ · ♞ · ♕
3 │ ♜ · · · · ♙
2 │ ♙ · · · ♜ ♖
1 │ · · ♖ ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 4 (Academy puzzle pz-34jbi3). White to move.*
<!-- /diagram -->

### Answers with explanations
1. `33. Rxa1 Rxa1`. The d1-rook takes the queen (b1 and c1 are empty), and Black recaptures with the a6-rook down the open a-file. White's d5-pawn and active king keep the game alive. **Engine judgement (depth 10):** −142 (worse but fighting); `33. Ke2` −705, and `33. Rc1` loses to a mating attack.
2. `22...Rxb6 23. f6=Q Rxf6`. Black's rook takes the queen on b6 along the sixth rank; when the f-pawn crowns, the rook returns to take the new queen. **Engine judgement (depth 10):** −157 for Black (still worse, but alive); `22...Rxf5` −1,063, and the other moves allow mate.
3. `17...Rxc1+ 18. Kxc1`. The attacked rook takes the queen with check: Black gives a rook for a queen and reaches a playable rook ending. **Engine judgement (depth 10):** −71; retreating the rook (`17...Rb6`) is −544.
4. `20. Rxe2`. The f2-rook removes the e2-rook, the attacker standing right beside White's king; the knight on d4 and queen on c6 then have no partner for a mating net. **Engine judgement (depth 10):** −35 (holding); `20. Rxc6` −257 and `20. Qxd4+` −742.

### Summary
- Perpetual check, counter-sacrifice, bare kings, stalemate and fortresses are the defender's tools.
- 22.9% of balanced engine games ended in a repetition claim: draws are a real result to fight for.
- When worse, count the checks before you count the pawns.

### Next lesson
Chapter IV.4: the king's endgame — key squares, opposition and races on a six-rank board.

---

## Chapter IV.4 — The Crown's March: King Activity and King-and-Pawn Endings

### Learning objectives
- Use the **key squares** of a pawn to know at once whether king and pawn beat king.
- Use the **opposition**, and know where it decides the result.
- Apply the **rule of the square** (with no exception for the starting rank) and calculate pawn races.
- Know the rook-pawn drawing method.

### Prerequisites
Book I promotion; Book III Chapter III.5.

### Explanation
**King activity.** In the endgame the engine's king table rewards the centre (d4 +21, c4/d5 +18) and its shield term turns negative (Book III). The king is a fighting piece: walk it forward.

**Evidence (exhaustive enumeration): king and pawn against king.** All 22,484 legal positions with White to move were solved. White wins **76.0%** of them; by file of the pawn: a- or f-pawn 71.6%, b- or e-pawn 76.7%, c- or d-pawn 79.8%. The longest win takes 20 moves (to mate, including the promotion), from `6/k5/6/6/K3P1/6 w`. The rook pawn is harder to win, but far from the hopeless case of the older game.

**Key squares (Evidence, exhaustive enumeration).** A *key square* is a square such that, if the stronger king stands there, it wins whatever the defender does (with the defender to move; positions where the pawn simply hangs are excluded). Computed for a d-pawn:

```text
Pawn on d2              Pawn on d3              Pawn on d4
6 . . . . . .           6 . . . . . .           6 . . * * * .
5 . . . . . .           5 . . * * * .           5 . . * * * .
4 . . * * * .           4 . . * * * .           4 . . . P . .
3 . . . . . .           3 . . . P . .           3 . . . . . .
2 . . . P . .           2 . . . . . .           2 . . . . . .
1 . . . . . .           1 . . . . . .           1 . . . . . .
  a b c d e f             a b c d e f             a b c d e f
```

Rule: **for a pawn on its 2nd rank the key squares are two ranks ahead of it; from the 3rd rank on, the key squares are the squares one and two ranks ahead** (on the pawn's file and the two neighbouring files). For a b-pawn on b3 the key squares are a4–c4 and a5–c5; for a rook pawn on a3 the only key square is b5.

**Opposition.** When the kings stand on the same file with one square between them, the side *not* to move "has the opposition": the other king must give way. In king-and-pawn endings this often decides everything (see the illustrated example).

**The rule of the square.** Draw a square from the pawn to its promotion rank (for a pawn on f3: f3–f6 and across to c3–c6). If the defending king is inside it — or, with the defender to move, can step into it — the king catches the pawn. **There is no exception for the starting rank here**, because pawns never move two squares. **Evidence (exhaustive enumeration):** pawn on f3, White king far away on a1, Black king on a5 with Black to move: lost (a5 cannot step into the c-to-f square); Black king on b5: drawn. Pawn on f2, Black king on a5: drawn with Black to move (b5 is inside the larger square), lost with White to move.

### Illustrated example

```crown
fen: 6/3k2/6/3K2/3P2/6 w - - 0 1
claim: tablebase draw
caption: Opposition, White to move. Kings on d3 and d5, pawn on d2. Evidence (exhaustive enumeration): with White to move this is a draw — White must give way.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♚ · ·
4 │ · · · · · ·
3 │ · · · ♔ · ·
2 │ · · · ♙ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Opposition, White to move. Kings on d3 and d5, pawn on d2. Evidence (exhaustive enumeration): with White to move this is a draw — White must give way.*
<!-- /diagram -->

```crown
fen: 6/3k2/6/3K2/3P2/6 b - - 0 1
claim: tablebase loss-in-12
caption: The same position with Black to move. Evidence (exhaustive enumeration): White wins (mate in 12 with best play), because Black's king must step aside and White's king reaches a key square (c4, d4 or e4).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♚ · ·
4 │ · · · · · ·
3 │ · · · ♔ · ·
2 │ · · · ♙ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*The same position with Black to move. Evidence (exhaustive enumeration): White wins (mate in 12 with best play), because Black's king must step aside and White's king reaches a key square (c4, d4 or e4).*
<!-- /diagram -->

### Step-by-step reasoning
Why does the move matter?

1. **Black to move.** Black's king on d5 must leave. If it goes to c5 or c6, White's king steps to e4; if to e5 or e6, White goes c4. White's king reaches a key square of the d2-pawn (c4, d4, e4) and wins.
2. **White to move.** Every White king move gives up the opposition: after `Kc3` Black answers `...Kc5`, after `Ke3` `...Ke5`, and Black's king keeps White out of the key squares. Draw.
3. **The lesson.** With the kings face to face, the side that does *not* have to move is the one in control.

### Common mistakes
- Pushing the pawn first. The pawn should usually follow the king, not lead it: the key squares are in front.
- Stepping back with the king. **Evidence (exhaustive enumeration):** in the Book III conversion example (`4k1/6/3K2/3P2/6/6 w`), `Kc5`, `Kc4` and `Ke4` win but `Kc3` and `Ke3` only draw.
- Applying the eight-by-eight "starting-rank exception" to the rule of the square. There is none here.

### Advanced insight
The key-square rule on six ranks is the older game's rule compressed: the board's two empty middle ranks mean a pawn on its 3rd rank is already "half-way", and its key squares reach the far side of the board. That is why, in a pawn race, the king that arrives first in front of its pawn decides the game.

### Worked example
Taking the opposition at a distance.

```crown
fen: 3k2/6/6/3K2/3P2/6 w - - 0 1
claim: tablebase win-in-11
caption: White to move. Black's king on d6, White's on d3, pawn on d2. Evidence (exhaustive enumeration): White wins with 1. Kc4, 1. Kd4 or 1. Ke4 — each reaches a key square. With Black to move, only 1...Kd5! (taking the opposition) draws.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · ♔ · ·
2 │ · · · ♙ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*White to move. Black's king on d6, White's on d3, pawn on d2. Evidence (exhaustive enumeration): White wins with 1. Kc4, 1. Kd4 or 1. Ke4 — each reaches a key square. With Black to move, only 1...Kd5! (taking the opposition) draws.*
<!-- /diagram -->

With White to move, `1. Kd4` puts the kings on d4 and d6 with Black to move: Black must give way and White's king advances to c5 or e5 next. With Black to move, `1...Kd5` stops the king at once: White's king cannot reach c4, d4 or e4 without Black answering in opposition.

### Guided exercise
White to move. White has only a king against king and a-pawn. Find the only move that draws.

```crown
fen: 6/6/6/pk4/6/1K4 w - - 14 66
claim: puzzle pz-1og62nt
caption: Guided exercise (Academy puzzle pz-1og62nt). White to move. Black's pawn is on a3, Black's king on b3, White's king on b1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ ♟ ♚ · · · ·
2 │ · · · · · ·
1 │ · ♔ · · · ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise (Academy puzzle pz-1og62nt). White to move. Black's pawn is on a3, Black's king on b3, White's king on b1.*
<!-- /diagram -->

*Answer:* `66. Ka1!` The king goes into the corner, in front of the pawn. If Black ever plays `...a2`, White is stalemated (b1 is covered by the pawn, b2 by Black's king); if not, White's king shuttles between a1 and b1 and the pawn never crowns. `66. Kc1?` loses to `66...a2` and the pawn crowns. **Engine judgement (depth 10):** `66. Ka1` is a draw by repetition in its line; `66. Kc1` is −1,061.

### Independent exercises
1. White to move. Win the d-pawn and keep your own.

```crown
fen: 6/6/3p2/3P1K/1kP3/6 w - - 3 37
claim: puzzle pz-lw0zln
caption: Exercise 1 (Academy puzzle pz-lw0zln). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · · ♟ · ·
3 │ · · · ♙ · ♔
2 │ · ♚ ♙ · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (Academy puzzle pz-lw0zln). White to move.*
<!-- /diagram -->

2. Black to move. Promoting at once looks natural. Find the only move that holds.

```crown
fen: 6/6/6/N1kPpP/1p4/3K2 b - - 0 27
claim: puzzle pz-58b8es
caption: Exercise 2 (Academy puzzle pz-58b8es). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ ♘ · ♚ ♙ ♟ ♙
2 │ · ♟ · · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (Academy puzzle pz-58b8es). Black to move.*
<!-- /diagram -->

3. Black to move. A pawn race: both sides have passed pawns.

```crown
fen: 3k2/6/p1PP2/P3Pp/1K4/6 b - - 0 28
claim: puzzle pz-fhy0fo
caption: Exercise 3 (Academy puzzle pz-fhy0fo). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ ♟ · ♙ ♙ · ·
3 │ ♙ · · · ♙ ♟
2 │ · ♔ · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (Academy puzzle pz-fhy0fo). Black to move.*
<!-- /diagram -->

4. Black to move. King and pawn against rook: crown with tempo.

```crown
fen: 5R/6/6/2p3/1k4/3K2 b - - 0 46
claim: puzzle pz-c0qvzm
caption: Exercise 4 (Academy puzzle pz-c0qvzm). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♖
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♟ · · ·
2 │ · ♚ · · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 4 (Academy puzzle pz-c0qvzm). Black to move.*
<!-- /diagram -->

### Answers with explanations
1. `37. Ke4! Kc3 38. Kd5 Kxc2 39. Kxd4`. White gives up the c2-pawn, wins the d4-pawn and keeps the d3-pawn with the king directly in front of it, on a key square. **Evidence (exhaustive enumeration):** the final position (`6/6/3K2/3P2/2k3/6 b`) is a forced win, mate in 10. **Engine judgement (depth 10):** +292; `37. c3` only draws (−8).
2. `27...Kxd3`. Promoting with `27...b1=Q+` fails to `28. Nxb1+`: the a3-knight guards b1. Instead the king takes the d3-pawn and supports the e-pawn. **Engine judgement (depth 10):** −20 (level); `27...b1=Q+` −354, `27...Kb3` −282.
3. `28...f2! 29. e4 f1=Q`. Black's f-pawn is one step ahead in the race. **Engine judgement (depth 10):** +497 for Black after `30. c5+ Kc6` (the puzzle line) — the new queen stops White's pawns; the king moves `28...Ke6` and `28...Kc6` lose to mate.
4. `46...c2+ 47. Ke2 c1=Q`. The pawn advances with check, so White's king has no time to reach c1, and Black crowns: queen against rook. **Engine judgement (depth 10):** +449 for Black; `46...Kb3` −546.

### Summary
- Key squares: two ranks ahead for a 2nd-rank pawn; one and two ranks ahead from the 3rd rank on. King on a key square = win.
- Opposition: with the kings face to face, the side not to move holds the opposition.
- The square rule has no starting-rank exception. Rook pawns win less often (71.6% of positions with White to move) but often still win.

### Next lesson
Chapter IV.5: rook endings, the most common ending of all.

---

## Chapter IV.5 — The Tower's Patience: Rook Endings

### Learning objectives
- Mate with king and rook against king efficiently (never more than 12 moves).
- Know the outcome statistics of rook endings and play them actively.
- Defend rook against pawn by bringing the king.

### Prerequisites
Chapter IV.4.

### Explanation
**Rook endings are the commonest endings.** **Evidence (archive):** of the "pure" endings first reached in the balanced games, rook endings were by far the most frequent (1,511, against 428 knight, 286 pawn and 125 queen endings). With equal pawns they were drawn 53.5% of the time; the side with more pawns won 62.2% and drew 28.7%.

**King and rook against king (Evidence, exhaustive enumeration).** Every one of the 25,440 legal positions with White to move is a win, and the longest takes **12 moves** (from `6/6/6/6/2k3/KR4 w`). The technique: use the rook to cut the enemy king off on a rank or file, bring your own king up in opposition, and check on the edge.

**Rook endings with pawns (Guidance).**
1. **Active rook.** A rook attacking pawns or cutting off a king is worth more than a rook passively defending.
2. **Rook behind passed pawns** — yours (it pushes) or the opponent's (it stops).
3. **Bring the king.** In rook-against-pawn endings, the defending king next to its pawn often draws.

### Illustrated example

```crown
fen: 3k2/6/3K2/6/6/R5 w - - 0 1
line: Ra6#
claim: mate-in-1
caption: The basic rook mate. Kings on d4 and d6; the rook mates on the sixth rank because White's king covers c5, d5 and e5.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · ♔ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♖ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The basic rook mate. Kings on d4 and d6; the rook mates on the sixth rank because White's king covers c5, d5 and e5.*
<!-- /diagram -->

### Step-by-step reasoning
The technique in three steps (illustrated by a real engine game):

```crown
fen: 4k1/R5/6/1P2K1/P5/6 w - - 1 26
line: Kd4 Kf6 Ke4 Ke6 Ra6#
claim: only-mate-in-3
caption: From an engine game. The rook already cuts Black's king off on the sixth rank (it stands on a5, guarding the fifth). White mates in three with two quiet king moves: 1. Kd4 Kf6 2. Ke4 Ke6 3. Ra6#.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ ♖ · · · · ·
4 │ · · · · · ·
3 │ · ♙ · · ♔ ·
2 │ ♙ · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*From an engine game. The rook already cuts Black's king off on the sixth rank (it stands on a5, guarding the fifth). White mates in three with two quiet king moves: 1. Kd4 Kf6 2. Ke4 Ke6 3. Ra6#.*
<!-- /diagram -->

1. **Cut off.** The rook on a5 confines Black's king to the sixth rank.
2. **Approach in opposition.** White's king walks up: `Kd4`, `Ke4`. When Black's king stands opposite (e6 against e4), the rook checks.
3. **Mate on the edge.** `Ra6#`.

For the longest case, here is the starting position of the 12-move win:

```crown
fen: 6/6/6/6/2k3/KR4 w - - 0 1
claim: tablebase win-in-12
caption: Evidence (exhaustive enumeration): the longest king-and-rook win on 6×6 — White mates in 12 moves with best play. Every legal position of this ending is won in 12 moves or fewer, well inside the 100-halfmove limit.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · ♚ · · ·
1 │ ♔ ♖ · · · ·
  └─────────────
    a b c d e f    White to move
```
*Evidence (exhaustive enumeration): the longest king-and-rook win on 6×6 — White mates in 12 moves with best play. Every legal position of this ending is won in 12 moves or fewer, well inside the 100-halfmove limit.*
<!-- /diagram -->

### Common mistakes
- Checking aimlessly with the rook. Checks are for the last move; cutting off comes first.
- Letting the enemy king attack the rook: keep the rook far from the enemy king.
- In rook-and-pawn endings, keeping the rook passive in front of your own pawn.

### Advanced insight
The 6×6 edge is only two moves from the centre, so the defending king is driven to the edge almost at once. That is why king-and-rook wins never take more than 12 moves here. In practical games, use the rook to restrict before you check.

### Worked example
Black mates with king and rook in three moves, from an engine game.

```crown
fen: 6/5K/6/4k1/3r2/6 b - - 11 45
line: Kd4 Kf6 Kd5 Kf5 Rf2#
claim: only-mate-in-3
caption: Black to move mates in three: 1...Kd4 2. Kf6 Kd5 3. Kf5 Rf2#. White's king is already on the edge file; Black's king approaches in opposition and the rook mates along the f-file.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ♔
4 │ · · · · · ·
3 │ · · · · ♚ ·
2 │ · · · ♜ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Black to move mates in three: 1...Kd4 2. Kf6 Kd5 3. Kf5 Rf2#. White's king is already on the edge file; Black's king approaches in opposition and the rook mates along the f-file.*
<!-- /diagram -->

After `1...Kd4` and `2...Kd5` Black's king stands opposite White's on the fifth rank (d5 against f5, with e5 between them covered). The rook swings to f2 and checks along the f-file; the king on d5 covers e4, e5 and e6.

### Guided exercise
Black to move. Rook against pawn: Black's e-pawn is on e2, White's rook is on e5. Find the only move that holds.

```crown
fen: 6/4R1/6/1K1k2/4p1/6 b - - 1 38
claim: puzzle pz-1sosh8a
caption: Guided exercise (Academy puzzle pz-1sosh8a). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · ♖ ·
4 │ · · · · · ·
3 │ · ♔ · ♚ · ·
2 │ · · · · ♟ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise (Academy puzzle pz-1sosh8a). Black to move.*
<!-- /diagram -->

*Answer:* `38...Kd2!` The king protects the pawn and the queening square. White can only take the pawn when it promotes: `39. Kc4 e1=Q 40. Rxe1 Kxe1`, bare kings, a draw. `38...Kd4?` loses to `39. Rxe2`. **Engine judgement (depth 10):** −6 (a draw); every other move −551 or worse.

### Independent exercises
1. White to move: mate in two with two rooks and a quiet move.

```crown
fen: 3R2/6/PK4/N4k/4R1/6 w - - 1 44
claim: only-mate-in-2
caption: Exercise 1 (from an engine game). White to move: mate in two.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♖ · ·
5 │ · · · · · ·
4 │ ♙ ♔ · · · ·
3 │ ♘ · · · · ♚
2 │ · · · · ♖ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (from an engine game). White to move: mate in two.*
<!-- /diagram -->

2. Black to move. Rook, knight and pawn against rook, knight and pawns. Find the rook move that wins material.

```crown
fen: 6/2knN1/3p2/1P1P1P/r5/2K2R b - - 2 23
claim: puzzle pz-qn6wq1
caption: Exercise 2 (Academy puzzle pz-qn6wq1). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · ♚ ♞ ♘ ·
4 │ · · · ♟ · ·
3 │ · ♙ · ♙ · ♙
2 │ ♜ · · · · ·
1 │ · · ♔ · · ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (Academy puzzle pz-qn6wq1). Black to move.*
<!-- /diagram -->

3. White to move. Black's king and pawn on d3 threaten White's king. Find the only move that holds.

```crown
fen: 6/2n3/p4P/3pk1/1r4/3KNR w - - 0 22
claim: puzzle pz-1qt9loi
caption: Exercise 3 (Academy puzzle pz-1qt9loi). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · ♞ · · ·
4 │ ♟ · · · · ♙
3 │ · · · ♟ ♚ ·
2 │ · ♜ · · · ·
1 │ · · · ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (Academy puzzle pz-1qt9loi). White to move.*
<!-- /diagram -->

4. In the archive, how often did the side with more pawns win a rook ending? How often were rook endings with equal pawns drawn?

### Answers with explanations
1. `44. Rde6!` The d6-rook steps to e6, so that both rooks control the e-file and Black's king on f3 has only f4. After `44...Kf4 45. Rf6#` the e-rook on e2 covers the second rank. **Proven:** the only mate in two.
2. `23...Ra1+ 24. Kd2 Rxf1`. The rook checks along the first rank and, after the king moves, takes the f1-rook: a skewer. (After `24. Kb2` the same `24...Rxf1` follows.) **Engine judgement (depth 10):** +390 for Black; the quiet `23...Kb4` only +78.
3. `22. Rf3+! Kd4 23. Nxd3`. The check comes first, driving the king off e3; then the knight takes the d3-pawn. Taking at once with `22. Nxd3?` lets Black's knight recapture and start a mating attack (the engine announces mate); `22. Nc2+??` loses to `22...dxc2+ 23. Kc1 Nd3#`. **Engine judgement (depth 10):** −51 (holding); `22. Kc1` −717.
4. 62.2% wins (28.7% draws) for the side with more pawns; 53.5% draws with equal pawns.

### Summary
- King and rook beat king in at most 12 moves: cut off, approach in opposition, mate on the edge.
- Rook endings are the commonest pure endings; an extra pawn wins about 62% of them.
- Against a rook, a pawn one step from crowning, defended by its king, often draws.

### Next lesson
Chapter IV.6: knights and queens in the endgame.

---

## Chapter IV.6 — Knights in Moonlight, Queens at Dawn: Knight and Queen Endings

### Learning objectives
- Know exactly which knight endings can and cannot be won.
- Defend rook against knight, using the proven rule: keep the knight near the king, and the king away from the corner.
- Mate with the queen fast, and win queen against rook.

### Prerequisites
Chapters IV.4–IV.5.

### Explanation
**Knights (Evidence, exhaustive enumeration).**
- King and knight against king: **no position is a win**; mate is impossible.
- King and **two** knights against king: no forced win. In 447,832 positions with White to move, 0.1% are wins, and every one of those is a mate in one that already stands on the board. With the defender to move, the only lost positions (88 of 583,440) are those where the defender is already checkmated on the board.
- **Evidence (archive):** knight endings were drawn 61.0% of the time, and even with an extra pawn the stronger side won only 49.0%.

**Rook against knight (Evidence, exhaustive enumeration).** 852,400 positions with White (the rook) to move; we report the 592,704 *quiet* positions with the knight's side to move (not in check, no capture available). White wins only **11.7%**; the rest are draws. The win rate depends on two things:

| Defender's king–knight distance | 1 | 2 | 3 | 4 or more |
|---|---|---|---|---|
| White wins | 2.5% | 3.4% | 7.3% | 27.1% |

| Defender's king on | the edge (corners included) | second ring | the four centre squares | a corner |
|---|---|---|---|---|
| White wins | 17.5% | 4.0% | 0.8% | 33.0% |

**Rule (proven by these counts): keep the knight next to the king and the king out of the corner.** The longest win in this ending takes 29 moves.

**Queens (Evidence, exhaustive enumeration).**
- King and queen against king: every position is won, in at most **7 moves** (longest from `6/6/4k1/6/1Q4/K5 w`).
- Queen against rook: in the 326,672 quiet positions with the rook's side to move, White wins **87.8%**, draws 10.6% (and loses 1.6%, to tactical rook tricks). The draws do not depend on geometry the way rook-against-knight does: the defender's chances are tactical — checks, skewers and stalemates. The longest win takes 23 moves.
- **Evidence (archive):** queen endings with an extra pawn were won 63.8% of the time.

### Illustrated example

```crown
fen: 2nk2/6/3K2/6/6/5R w - - 0 1
claim: tablebase draw
caption: Rook against knight, knight beside its king. Evidence (exhaustive enumeration): with White to move, a draw.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♞ ♚ · ·
5 │ · · · · · ·
4 │ · · · ♔ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ♖
  └─────────────
    a b c d e f    White to move
```
*Rook against knight, knight beside its king. Evidence (exhaustive enumeration): with White to move, a draw.*
<!-- /diagram -->

```crown
fen: n2k2/6/6/3K2/6/5R w - - 0 1
claim: tablebase win-in-10
caption: The same material with the knight stranded in the corner, away from its king. Evidence (exhaustive enumeration): White wins (mate in 10).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♞ · · ♚ · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · ♔ · ·
2 │ · · · · · ·
1 │ · · · · · ♖
  └─────────────
    a b c d e f    White to move
```
*The same material with the knight stranded in the corner, away from its king. Evidence (exhaustive enumeration): White wins (mate in 10).*
<!-- /diagram -->

### Step-by-step reasoning
1. **Why does distance matter?** A rook wins against a knight mostly by trapping or forking the knight, or by mating the king while the knight is too far to block. A knight next to its king is protected and can block checks.
2. **Why does the corner matter?** In the corner the defending king has only three squares; the rook and king can build a mating net, and the knight cannot cover everything. In the centre the king has eight squares.
3. **What the defender does.** Keep the king central and the knight within one or two squares of it. In the quiet positions satisfying both, the attacker almost never wins (under 1% with the king on the centre squares).

### Common mistakes
- Running with the king to the corner "for safety". That is where the rook wins most often (33.0%).
- Sending the knight on a long trip. At distance four or more, the rook wins over a quarter of the time.
- Playing on for a win with king and two knights against a careful defender: there is no forced mate.

### Advanced insight
Time and the rules matter in these endings (Chapter IV.7): with king and knight against a lone king you cannot mate, **but if the lone king's side runs out of time, it loses** — the crown-adj-1 rule awards the game to the side that still has any piece. The defender of a "dead draw" must still watch the clock.

### Worked example
A knight that saves the game by blockading a pawn.

```crown
fen: 6/3k2/5p/3Pp1/1p1NP1/4K1 w - - 0 24
claim: puzzle pz-1ce067n
caption: Academy puzzle pz-1ce067n. White to move. White's knight on d2 is attacked by the e3-pawn, and Black's b2-pawn wants to crown on b1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♚ · ·
4 │ · · · · · ♟
3 │ · · · ♙ ♟ ·
2 │ · ♟ · ♘ ♙ ·
1 │ · · · · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-1ce067n. White to move. White's knight on d2 is attacked by the e3-pawn, and Black's b2-pawn wants to crown on b1.*
<!-- /diagram -->

`24. Nb1!` solves both problems at once: the knight leaves the attacked square and blockades the queening square b1. **Engine judgement (depth 10):** −36 (holding); `24. Kd1` is −1,142 and `24. Kf1` allows mate. A knight in front of a pawn is a perfect blockader: it cannot be driven away by the pawn.

### Guided exercise
Black to move. The queen and knight hunt White's king.

```crown
fen: 6/1K4/2n3/1k4/3q2/6 b - - 7 50
line: Qd5+ Ka6 Qa5#
claim: only-mate-in-2
caption: From an engine game. Black to move mates in two: 1...Qd5+ 2. Ka6 Qa5#. Black's king on b3, knight on c4 and queen work together against White's king on b5.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♔ · · · ·
4 │ · · ♞ · · ·
3 │ · ♚ · · · ·
2 │ · · · ♛ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*From an engine game. Black to move mates in two: 1...Qd5+ 2. Ka6 Qa5#. Black's king on b3, knight on c4 and queen work together against White's king on b5.*
<!-- /diagram -->

*Question:* why does `1...Qd5+` mate in two? *Answer:* after the check along the fifth rank, White's king on b5 has only a6: a4 and b4 are covered by Black's king, a5, c5 and c6 by the queen, b6 by the knight, and the knight on c4 is protected twice. Then `2...Qa5#`: the queen, protected by the knight, covers a6's neighbours b5 and b6. **Proven:** no other first move mates in two.

### Independent exercises
1. White to move. Knight against two pawns. Find the only move that holds.

```crown
fen: 6/6/6/2Kp2/4kp/5N w - - 4 66
claim: puzzle pz-10kdeu
caption: Exercise 1 (Academy puzzle pz-10kdeu). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♔ ♟ · ·
2 │ · · · · ♚ ♟
1 │ · · · · · ♘
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (Academy puzzle pz-10kdeu). White to move.*
<!-- /diagram -->

2. White to move. Black's b-pawn is about to crown. Find the only move that holds.

```crown
fen: 6/6/2kp1p/5N/1p1K2/6 w - - 0 56
claim: puzzle pz-1kyexec
caption: Exercise 2 (Academy puzzle pz-1kyexec). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · ♚ ♟ · ♟
3 │ · · · · · ♘
2 │ · ♟ · ♔ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-1kyexec). White to move.*
<!-- /diagram -->

3. Black to move. Black's knight on e2 is attacked. Find the move that wins material.

```crown
fen: 6/1kp3/p5/4K1/P3nr/3R2 b - - 0 22
claim: puzzle pz-1s6cykg
caption: Exercise 3 (Academy puzzle pz-1s6cykg). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♚ ♟ · · ·
4 │ ♟ · · · · ·
3 │ · · · · ♔ ·
2 │ ♙ · · · ♞ ♜
1 │ · · · ♖ · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (Academy puzzle pz-1s6cykg). Black to move.*
<!-- /diagram -->

4. White to move. Promote — but to what?

```crown
fen: 3K2/2P3/3k2/6/2n3/6 w - - 0 52
claim: puzzle pz-1ftvz6i
caption: Exercise 4 (Academy puzzle pz-1ftvz6i). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♔ · ·
5 │ · · ♙ · · ·
4 │ · · · ♚ · ·
3 │ · · · · · ·
2 │ · · ♞ · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 4 (Academy puzzle pz-1ftvz6i). White to move.*
<!-- /diagram -->

5. White to move: mate in three with queen and king (from an engine game).

```crown
fen: Q5/2k3/6/3K1N/4p1/6 w - - 0 25
claim: only-mate-in-3
caption: Exercise 5. White to move: mate in three.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♕ · · · · ·
5 │ · · ♚ · · ·
4 │ · · · · · ·
3 │ · · · ♔ · ♘
2 │ · · · · ♟ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 5. White to move: mate in three.*
<!-- /diagram -->

### Answers with explanations
1. `66. Nd2!` The knight on f1 is attacked by Black's king on e2, and Black's f2-pawn wants f1. From d2 the knight still guards f1 (and e4), and after `66...Ke3 67. Nf1+ Ke4 68. Nd2+` the knight checks back and forth: a draw by repetition. **Engine judgement (depth 10):** 0.00; `66. Kd4` −988.
2. `56. Kc2!` The king steps next to b1, so `56...b1=Q+ 57. Kxb1` removes the pawn. **Engine judgement (depth 10):** −89 (holding); the knight moves `56. Ne5+` and `56. Nxd4` are −851 and worse.
3. `22...Nc3!` The e2-knight escapes the king's attack and from c3 attacks the d1-rook and the a2-pawn, while the f2-rook keeps watch. In the engine's line Black wins the a2-pawn and keeps a clear advantage. **Engine judgement (depth 10):** +485; the rook moves +127 to +153.
4. `52. c6=Q`. A queen, of course — but test the alternatives honestly: a rook (`52. c6=R`) gives only +40, and a knight with check (`52. c6=N+`) −1. The queen keeps a winning advantage (+635). Under-promotion is a tool for checks and forks (3.1% of promotions in the archive were to knights), not a habit.
5. `25. Qa5+ Kd6 26. Kd4 Kc6 27. Qa6#`. The queen checks, the king approaches in opposition with a quiet move, and the queen mates on the edge. **Proven:** the only mate in three.

### Summary
- K+N vs K and K+N+N vs K cannot be won by force. Knight endings are drawish (61% draws in the archive).
- Rook vs knight is a draw in 88% of quiet positions: keep the knight close and the king central.
- K+Q vs K: at most 7 moves. Q vs R: a win in about 88% of quiet positions, at most 23 moves.

### Next lesson
Chapter IV.7: fortresses, draws and the rulebook.

---

## Chapter IV.7 — The Law of the Realm: Draws, Fortresses and the Rules

### Learning objectives
- Know every way a game can be drawn under crown-adj-1, which are automatic and which must be claimed.
- Avoid stalemating a lone king, and use stalemate as a defender.
- Understand the timeout rule and its consequences.

### Prerequisites
Chapters IV.3–IV.6.

### Explanation
**The rules** (verified in `src/rules/adjudication.ts`, policy `crown-adj-1`):

| Event | Result | Automatic or claimed? |
|---|---|---|
| Checkmate | win | automatic (takes precedence over every draw) |
| Stalemate | draw | automatic |
| Only the two kings remain | draw | automatic ("bare kings") |
| The same position for the 3rd time | draw | **claimable** |
| The same position for the 5th time | draw | automatic |
| 100 halfmoves without a pawn move or capture | draw | **claimable** |
| 150 halfmoves without a pawn move or capture | draw | automatic |
| Agreement | draw | only after each side has made at least 10 moves |
| A player's time runs out | loss — **if the opponent has any piece other than the king**; otherwise a draw | automatic |

Two differences from the older game's rules matter in practice:
1. **Only bare kings is an automatic "dead position".** King and knight against king is *not* automatically drawn; it continues until repetition, the halfmove rules or agreement.
2. **The timeout rule is strict.** If you run out of time and your opponent has even a lone knight, you lose — even though that knight could never mate.

**Evidence (archive, balanced games):** checkmate ended 66.2% of games; threefold-repetition claims 22.9%; bare kings 4.9%; 100-halfmove claims 4.9%; stalemate 1.0%.

**The halfmove limits are never in the way of correct technique in the small endings.** **Evidence (exhaustive enumeration):** the longest forced wins are KQK 7 moves, KRK 12, KPK 20, KQ–KR 23 and KR–KN 29 — all inside 50 moves (100 halfmoves).

### Illustrated example

```crown
fen: k5/6/1K4/6/6/3Q2 w - - 0 1
line: Qd4
claim: stalemate
show: after
caption: The trap. 1. Qd4?? looks like it tightens the net, but Black's king on a6 has no legal move and is not in check: stalemate, a draw.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · ♔ · ♕ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*The trap. 1. Qd4?? looks like it tightens the net, but Black's king on a6 has no legal move and is not in check: stalemate, a draw.*
<!-- /diagram -->

```crown
fen: k5/6/1K4/6/6/3Q2 w - - 0 1
line: Qd6#
claim: checkmate
show: after
caption: The right move from the same position: 1. Qd6#. The queen checks along the sixth rank; the king on b4 covers a5 and b5.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · ♕ · ·
5 │ · · · · · ·
4 │ · ♔ · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*The right move from the same position: 1. Qd6#. The queen checks along the sixth rank; the king on b4 covers a5 and b5.*
<!-- /diagram -->

### Step-by-step reasoning
How to avoid stalemate with a queen:
1. **Before every queen move, count the enemy king's legal moves after it.** If the answer is zero and it is not check, stop.
2. **Give the king a square until you are ready to mate.** A king with one square cannot be stalemated.
3. **Mate with check.** The final move must attack the king.

### Common mistakes
- Playing "safe" queen moves near a cornered king without counting its squares.
- Forgetting to *claim* a threefold repetition or the 100-halfmove draw: they are not automatic until the fifth repetition or 150 halfmoves.
- Relaxing on the clock with a "drawn" lone king against a knight: if you flag, you lose.

### Advanced insight
Stalemate as a defence: a king with no pawns and no pieces left, boxed into a corner, may be stalemated by an over-eager attacker. In the rook-pawn ending of Chapter IV.4 (`pz-1og62nt`), the defender's king sits in the corner precisely because the attacker must avoid stalemate and can never drive it out.

### Worked example
A draw by repetition, found by the defender.

```crown
fen: R5/6/1p2k1/5p/1PP3/K5 b - - 7 32
claim: puzzle pz-rmet01
caption: Academy puzzle pz-rmet01. Black to move. Black has two pawns for nothing against a rook, but White's king is far away.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♖ · · · · ·
5 │ · · · · · ·
4 │ · ♟ · · ♚ ·
3 │ · · · · · ♟
2 │ · ♙ ♙ · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-rmet01. Black to move. Black has two pawns for nothing against a rook, but White's king is far away.*
<!-- /diagram -->

`32...Ke5!` keeps Black's king between both pawns: it guards the f3-pawn's path and stays near the b4-pawn. White's rook can only check: `33. Ra5+ Ke4 34. Ra6` and the position repeats. **Engine judgement (depth 10):** 0.00 (draw); `32...Kf5` −135 and `32...f2` −323. A draw by repetition must be claimed on the third occurrence, or it becomes automatic on the fifth.

### Guided exercise
White to move. Exactly one move mates; four other queen moves stalemate.

```crown
fen: k5/6/K5/6/6/2Q3 w - - 0 1
line: Qc6#
claim: only-mate-in-1
caption: Guided exercise. White to move. (Solution shown: 1. Qc6#.)
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ ♔ · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · ♕ · · ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise. White to move. (Solution shown: 1. Qc6#.)*
<!-- /diagram -->

*Answer:* `1. Qc6#` — the queen checks along the sixth rank, the king on a4 covers a5 and b5, and the queen covers b6. The stalemating moves are `1. Qb1`, `1. Qb2`, `1. Qc5` and `1. Qe3`: each leaves Black's king with no move and no check.

### Independent exercises
1. You have king and knight against king, and 30 seconds against your opponent's 5 seconds. Can you win? Can you lose?
2. A position has occurred for the third time. Is the game over?
3. True or false: "King and rook against king and knight is a win if the defender's king is in the corner." Give the measured figure.
4. In the starting position, may the players agree a draw after 1. c3 b4?

### Answers with explanations
1. You cannot force mate (proven: K+N vs K has no won position). But if your opponent's flag falls, you **win**, because you still have a piece; if your own flag falls, it is a draw, because your opponent has only a king. The defender must not lose on time.
2. No — a threefold repetition must be **claimed**. The game ends automatically only on the fifth occurrence.
3. False as a rule: the corner is the defender's worst place, but even there White wins only 33.0% of quiet positions with the defender to move (exhaustive enumeration).
4. No. Agreement is allowed only after each side has completed at least ten moves (20 plies).

### Summary
- Automatic: checkmate, stalemate, bare kings, fivefold repetition, 150 halfmoves. Claimable: threefold, 100 halfmoves. Agreement after ten moves each.
- Timeout loses if the opponent has any non-king piece; otherwise it is a draw.
- Count the lone king's moves before every queen move: stalemate is one careless move away.

### Next lesson
Chapter IV.8: converting advantages, managing the clock and making practical decisions.

---

## Chapter IV.8 — The Sovereign's Hourglass: Conversion, Time and Practical Decisions

### Learning objectives
- Convert material advantages with the methods and evidence of Books III–IV.
- Budget your clock using the Academy's time controls and measured game lengths.
- Make practical decisions: when to simplify, when to claim, when to play on.

### Prerequisites
All earlier chapters.

### Explanation
**Conversion.** **Evidence (archive):** at the first quiet moment after move 20, a one-pawn lead won 48.0% of games, two pawns 68.3%, three or four points 83.1%, five or more 93.0% (Book III, Chapter III.9). The methods:
1. **Take what is offered** — but only after checking the opponent's checks.
2. **Simplify toward the endings you know are won**: king and pawn with the king on a key square; queen against rook; rook against pawns without their king.
3. **Avoid the drawing materials**: knight endings, rook against knight, two knights.
4. **Promote to a queen** unless a knight check or fork wins more (3.1% of promotions in the archive were knights, 1.3% rooks).

**Time.** The Academy's time controls (`src/games/types.ts`) are **Blitz 3+2**, **Rapid 5+3** and **Classical 15+10** (minutes + seconds added per move). **Evidence (archive):** balanced engine games lasted a median of **75 plies** (38 moves each), with 10% shorter than 49 plies and 10% longer than 124 (62 moves). In a Rapid game, a 38-move game gives you 300 + 38 × 3 = 414 seconds, about 11 seconds a move; a 62-move game, about 8 seconds a move. The engine itself spends roughly (remaining time − a small reserve) / 22 + ¾ of the increment on each move (`src/engine/levels.ts`).

**Guidance for the clock:**
- Spend time where the position is *critical*: when forcing moves exist, or when you are choosing a plan or a pawn structure. Spend little on recaptures and forced replies.
- Keep a reserve for the endgame: half of all games here see a promotion (median first promotion on ply 64), and pawn races are decided by a single tempo.
- Remember the timeout rule: if your opponent has any piece, flagging loses.

**Practical decisions.**
- **Claims.** You may claim a draw at the third repetition or after 100 halfmoves. If you are worse, claim. If you are better, avoid repeating.
- **Playing on.** With a material lead of two points or more, the archive says play on (68% wins).
- **Agreement.** Only after ten moves each.

### Illustrated example

```crown
fen: 1n2k1/2r3/pN4/2R3/5P/2K3 w - - 0 29
claim: puzzle pz-b8tld2
caption: Academy puzzle pz-b8tld2. White to move. Black's rook on c5 stands undefended in front of White's rook.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♞ · · ♚ ·
5 │ · · ♜ · · ·
4 │ ♟ ♘ · · · ·
3 │ · · ♖ · · ·
2 │ · · · · · ♙
1 │ · · ♔ · · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-b8tld2. White to move. Black's rook on c5 stands undefended in front of White's rook.*
<!-- /diagram -->

### Step-by-step reasoning
1. **Checks for the opponent?** After `29. Rxc5`, Black has no check that wins anything.
2. **Is the rook really free?** Black's king on e6 does not reach c5, and the b6-knight covers a4, c4, d5 — not c5. Yes.
3. **Take it.** `29. Rxc5`. **Engine judgement (depth 10):** +843; any other move (`29. Kb2`, `29. Kc2`) is about +30. When something is genuinely free, conversion begins by taking it.

### Common mistakes
- Spending your clock early on routine opening moves and then losing a won pawn race on time.
- Avoiding a simplification into a won pawn ending because "the rook ending is safer". The archive says otherwise (77.4% against 62.2% wins with an extra pawn), and the key squares tell you exactly.
- Under-promoting without a concrete reason.

### Advanced insight
In converting, the opponent's best chances are tactical: checks, discovered attacks and stalemate tricks. Your job is to remove them one at a time — trade the active piece, centralise your king, then push. On a six-rank board a passed pawn needs at most four steps, so every move spent on safety is cheap compared with the cost of a counter-chance.

### Worked example
Converting with a discovered attack.

```crown
fen: 6/1kPp1r/6/1K3p/5P/rN3R w - - 0 20
claim: puzzle pz-ephpsb
caption: Academy puzzle pz-ephpsb. White to move. Black's rook on a1 and White's rook on f1 stand on the same rank, with only White's knight on b1 between them.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♚ ♙ ♟ · ♜
4 │ · · · · · ·
3 │ · ♔ · · · ♟
2 │ · · · · · ♙
1 │ ♜ ♘ · · · ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-ephpsb. White to move. Black's rook on a1 and White's rook on f1 stand on the same rank, with only White's knight on b1 between them.*
<!-- /diagram -->

`20. Nc3+!` The knight jumps with check (from c3 it attacks b5) and uncovers the f1-rook's attack along the first rank on the a1-rook. After `20...Kxc5 21. Rxa1` White has won a rook. **Engine judgement (depth 10):** +271; `20. Na3+` only −87.

### Guided exercise
Black to move. Promote — and choose the piece.

```crown
fen: 5k/6/1Pp1P1/2K3/p5/6 b - - 0 36
claim: puzzle pz-1cphbbp
caption: Guided exercise (Academy puzzle pz-1cphbbp). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · · · ·
4 │ · ♙ ♟ · ♙ ·
3 │ · · ♔ · · ·
2 │ ♟ · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise (Academy puzzle pz-1cphbbp). Black to move.*
<!-- /diagram -->

*Answer:* `36...a1=Q+`. The new queen checks the king on c3 along the long diagonal a1–c3, so White has no time to push the b-pawn; the queen then stops it, and Black's king collects the e4-pawn. **Engine judgement (depth 10):** +720; `36...a1=R` only +6, because the rook gives no check and cannot cover b5 and b6 in time.

### Independent exercises
1. White to move. Black's rook attacks c4; Black's knight is on b6. Find the only move that holds.

```crown
fen: 1n2k1/5p/p1P2r/3K2/6/6 w - - 0 27
claim: puzzle pz-1td3for
caption: Exercise 1 (Academy puzzle pz-1td3for). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♞ · · ♚ ·
5 │ · · · · · ♟
4 │ ♟ · ♙ · · ♜
3 │ · · · ♔ · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (Academy puzzle pz-1td3for). White to move.*
<!-- /diagram -->

2. White to move. Queen or rook?

```crown
fen: 6/p3Pr/k5/4K1/6/6 w - - 0 33
claim: puzzle pz-12j3cmu
caption: Exercise 2 (Academy puzzle pz-12j3cmu). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ ♟ · · · ♙ ♜
4 │ ♚ · · · · ·
3 │ · · · · ♔ ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-12j3cmu). White to move.*
<!-- /diagram -->

3. In a Rapid 5+3 game, how much thinking time per move do you have on average if the game lasts the median length of the archive (38 moves)?
4. You are a rook up against a knight with no pawns, and a threefold repetition is available to your opponent. What do the enumeration results say about your winning chances, and what should you do?

### Answers with explanations
1. `27. c5! Nd5 28. c6=Q+`. The pawn steps away from the rook's attack and runs; after Black's knight jumps to d5, the pawn crowns with check (the new queen on c6 checks along the sixth rank). **Engine judgement (depth 10):** −265 (White is still worse, but alive); every king move loses the pawn and scores about −1,740.
2. `33. e6=Q`. The pawn was attacked by the rook on f5; the new queen on e6 attacks that rook along the diagonal and covers the long diagonal toward a2. `33. e6=R` gives only −161 (a rook on e6 attacks nothing), and king moves −713. **Engine judgement (depth 10):** +360.
3. About 11 seconds: 300 s + 38 × 3 s = 414 s over 38 moves.
4. Rook against knight with the knight's side to move is a draw in 88.3% of quiet positions (exhaustive enumeration). If the defender's knight is beside a central king, your chances are under 3%; if the knight is far away or the king is cornered, play on. If not, the draw is the realistic result — avoid wasting your clock and, if you are short of time, remember that a flag lost against a knight is a loss.

### Summary
- Convert by taking what is free, simplifying into known wins, and avoiding drawish materials.
- Budget about 11 seconds a move in Rapid for a median-length game; save time for the endgame.
- Claim draws when worse; play on with a two-point lead.

### Next lesson
The Master's training ends here. **Book V — The Sovereign** asks for the last step: deep calculation under complexity, and the art of choosing the position you want to play.
