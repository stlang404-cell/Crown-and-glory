# Book III — The Strategist

*Being the third book of THE SOVEREIGN'S GRIMOIRE: FROM APPRENTICE TO CHESS SOVEREIGN, for players of Crown & Calculation (rules `crown-la6-v1`).*

Welcome to the Strategists' Tower, Adept. In the first two books you learned how the pieces move and how they strike. Here you learn *why* one quiet move is better than another: where pieces belong, which pawns are strong, when to trade and how to make a plan. This tower has one house rule, carved over its door: **evidence over folklore**. Much of what is written about the older eight-by-eight game is wise there and wrong here. On a board of 36 squares, with no bishops, no castling and pawns that move one step at a time, every old proverb must earn its place again.

**How to read this book.** Every board is a *checked* board: a `crown` block tested by `tools/grimoire/check.ts` against the real rules in `src/rules`. Every claim carries one of three labels:

- **Evidence** — something measured, with the method stated (engine games, an experiment, or an exhaustive enumeration).
- **Engine judgement** — the opinion of the canonical Academy engine (`crown-search-2` + `crown-eval-4`, the `CANON_OPTS` configuration in `src/engine/canonical.ts`) at a stated depth. Strong, consistent, but not a proof.
- **Guidance** — a teacher's advice: a rule of thumb distilled from the evidence and from experience. Use it until you know better.

Engine scores are in centipawns (cp) from the point of view of the side to move unless stated otherwise; 100 cp is roughly one pawn in the engine's currency.

---

## The Strategist's Ledger: where the numbers come from

Every statistic in this book was computed for it, by one of the following methods. When a chapter quotes a number, it names the method by its letter.

**(A) The game archive.** The benchmark results in `tools/bench/results/*.json` (including `chunks/`) hold **8,956** complete engine games. Each was replayed move by move through `src/rules` (no illegal move was found). Many of those matches pit a stronger engine against a weaker one, which would distort questions such as "who wins with a queen against a rook and knight?" (the stronger engine wins material *and* games). So most figures use the **balanced subset**: the 31 pairings with at least 40 games whose overall score lies between 44% and 56%. That subset holds **5,568** games (5,566 finished), mostly played at 100–300 ms per move. Each game began from a short opening drawn from the benchmark books (`tools/bench/openings.json`, `openings-4ply.json`), so *which* first move was played was chosen by the book, not by the players.

**(B) Engine searches.** `new Searcher(18).search(Position.fromFen(fen), { limits: { depth }, ...CANON_OPTS })`, sometimes with `rootMoves` restricted to one move so that every candidate gets its own score.

**(C) Material experiments.** Pieces were removed from the starting array and the result searched to depth 12 (method B). Each experiment was run twice with the colours swapped, and the two scores averaged so that White's first-move advantage cancels. When pawns were removed, the experiment was repeated for every choice of file (one pawn: all six files; two pawns: five adjacent pairs; three pawns: four adjacent triples) and averaged, because removing a pawn also opens a file.

**(D) The evaluation's own terms.** `src/engine/eval4.ts` lists what the engine rewards, and `src/engine/eval4-params.ts` holds the fitted weights (`eval4-fit-l0`). Each term has a middlegame and an endgame weight; the engine blends them as pieces come off.

**(E) The opening references.** `tools/bench/openings.json` is a book of 64 two-ply openings that Fairy-Stockfish (depth 10) judged balanced (|score| ≤ 80 cp), and `src/engine/repertoire.json` is the engine's own six-ply opening tree (depth 7).

### What the engine values (method D)

| Term (eval4) | Middlegame | Endgame | Meaning |
|---|---|---|---|
| Pawn | 89 | 89 | material |
| Knight | **441** | 262 | material |
| Rook | 407 | **463** | material |
| Queen | 934 | 775 | material |
| King shield | +18 per pawn | −14 per pawn | own pawns on the three squares directly in front of the king |
| Rook on open file | +68 | −5 | no pawns of either colour on the rook's file |
| Rook on half-open file | +48 | +7 | no own pawn, but an enemy pawn |
| Pawn threatens a piece | +128 | −17 | a pawn attacks an enemy knight, rook or queen |
| Rook threatens queen | +110 | −6 | |
| Knight threatens rook/queen | +47 | −1 | |
| Hanging piece | +25 | +9 | an enemy piece attacked and undefended |
| Tempo (side to move) | +65 | −4 | |
| Doubled pawn | −15 | −6 | |
| Isolated pawn | −8 | −18 | no own pawn on either neighbouring file |
| Supported pawn | +13 | −4 | defended by an own pawn |
| Phalanx pawn | +16 | +15 | an own pawn stands beside it |
| Passed pawn, own 4th rank | −12 | +90 | plus +24 if the square ahead is empty |
| Passed pawn, own 5th rank | +37 | +109 | plus +56 if the square ahead is empty |

Four further terms exist in the code — knight **outposts**, king **tropism**, the **unstoppable** passed pawn and the **open king file** — but their fitted weight in the shipped parameters is **zero**. The engine knows how to see them; it simply found no profit in rewarding them beyond what its square tables and search already capture. Keep that in mind whenever someone tells you an outpost "is worth a pawn".

### Two absent friends: bishops and castling

**No bishops.** Only the queen, the king and the pawns move diagonally. There are no "light-square" and "dark-square" complexes, no good or bad bishops, and a diagonal can be guarded only by a pawn, the king or the queen. A king behind a wall of pawns is safe from every long diagonal except the queen's.

**No castling.** The king begins on d1 (d6 for Black) and stays in the centre unless it walks. The rooks on a1 and f1 are separated by four pieces (N Q K N), and they cannot see each other until the knights, the queen *and the king* have left the back rank. Notice something odder still: at the start **neither rook is defended**. The b1-knight covers a3, c3 and d2; the e1-knight covers c2, d3 and f3; the king reaches c1, c2, d2, e1 and e2. Nothing guards a1 or f1. That single fact explains a whole family of opening disasters (Chapter III.6).

---

## Chapter III.1 — The First Ten Doors: Development on Six Files

### Learning objectives
- List exactly which pieces can move in the starting position, and what each first move unlocks.
- Explain, with evidence, why "knights before pawns" is poor advice on this board.
- Recognise when a developed piece can be chased away by a single pawn step.

### Prerequisites
Book I (how pieces move) and Book II (basic tactics: forks, hanging pieces).

### Explanation
In the starting position White has exactly **ten** legal moves: six pawn steps (a3, b3, c3, d3, e3, f3) and four knight jumps (Na3, Nc3, Nd3, Nf3). The queen, rooks and king are walled in. So "development" here does not mean "bring out the minor pieces"; it means **open doors**. Each pawn step unlocks squares on the second rank:

- `c3` gives the queen c2 and, along the diagonal, b2–a3 after `b3`;
- `d3` gives the king and the queen d2, and the b1-knight d2;
- `b3` and `e3` open b2 and e2 for queen and king;
- `f3` and `a3` give the rooks a second-rank square (Rf2, Ra2) and later a lift.

Now the crucial six-file fact: **only two ranks separate the armies.** A White knight on c3 stands next door to rank 4, and every Black pawn on rank 5 needs just *one* step to attack rank 4 — and from rank 4 it attacks rank 3. A knight on a3 or c3 can be hit by `...b4`; a knight on c3 or e3 by `...d4`; and so on. A developed knight is a target from move one.

**Engine judgement (method B, depth 14).** Every White first move, scored for White:

| Move | c3 | f3 | d3 | b3 | Nf3 | a3 | e3 | Na3 | Nc3 | Nd3 |
|---|---|---|---|---|---|---|---|---|---|---|
| Score (cp) | +54 | +50 | +35 | +27 | −9 | −51 | −51 | −60 | −101 | −101 |

At depth 12 the order is f3 +54, c3 +46, d3 +37 and again Nc3/Nd3 last at −108. The engine's own six-ply opening tree (method E, depth 7) prefers d3, b3 and c3. All three sources agree on the shape: **central pawn steps first, knight jumps last.** The engine's square tables say the same thing in another voice: a knight on c3 costs it 38 cp and on d3 31 cp in the middlegame, while d2 (+34) and a3 (+21) are its favourite home squares for a knight that is not yet ready to jump forward.

**Evidence (method A).** In the balanced archive, games opening with `c3` scored 64.7% for White (440 games) and `f3` 63.5% (544), while `Nc3` scored 49.5% (596) and `a3` 49.0% (768). Treat this gently: the book chose the openings and Black's reply varied, so these are *associations*, not experiments. But the direction matches the engine.

**Evidence (method E).** Fairy-Stockfish's balanced book contains all ten first moves, so none of them simply loses. Strategy here is a matter of tens of centipawns, not of blunders.

**Evidence (method A).** Contact comes quickly: the median game sees its **first capture on ply 7**, i.e. Black's fourth move.

### Illustrated example

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
caption: The starting position. Ten legal moves: six pawn steps and four knight jumps. The rooks, queen and king are locked in, and both rooks are undefended.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*The starting position. Ten legal moves: six pawn steps and four knight jumps. The rooks, queen and king are locked in, and both rooks are undefended.*
<!-- /diagram -->

### Step-by-step reasoning
Let us test the most "natural" developing move of the older game, the knight to c3.

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Nc3 b4
show: after
caption: After 1. Nc3 b4. One pawn step and the knight must move again. The engine's main line continues 2. Nb1, back home.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ · ♟ ♟ ♟ ♟
4 │ · ♟ · · · ·
3 │ · · ♘ · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*After 1. Nc3 b4. One pawn step and the knight must move again. The engine's main line continues 2. Nb1, back home.*
<!-- /diagram -->

1. `1. Nc3` puts the knight on a square that two Black pawns can attack in a single step: `...b4` and `...d4`.
2. `1...b4` attacks it at once (the engine's own line at depth 14 is 1...c4 2.Nb1 d4, with the same idea).
3. White has spent a move and must spend another. Black's b-pawn now stands on b4, controlling a3 and c3 — *space* gained for free.
4. Compare `1. c3`: the pawn takes b4 and d4 away from Black's pawns and knights, gives the queen c2, and cannot be chased.

### Common mistakes
- Developing knights first "because that is what one does". Here a knight on rank 3 is the most kickable piece on the board.
- Pushing an edge pawn (`a3`, `e3`) with no plan. The engine rates `a3` and `e3` among the weaker moves: they unlock little.
- Forgetting that both rooks begin undefended. An early opened a- or f-file can lose a rook (Chapter III.6).

### Advanced insight
The engine is not against knights; it is against knights *that can be hit*. Once the enemy pawn that could attack a square has advanced past it or been exchanged, that square becomes a fine home. That is why the order matters: first the pawn steps that fix the pawn structure, then the knight jumps to squares that no pawn can reach.

### Worked example
Here is the engine playing itself from the start at depth 11 (method B), eight moves of real contact:

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: c3 b4 d3 bxc3 Nxc3 Na4 Nxa4 Qxa4+ b3 Qb5
show: after
caption: Engine self-play, depth 11: 1. c3 b4 2. d3 bxc3 3. Nxc3 Na4 4. Nxa4 Qxa4+ 5. b3 Qb5. Pawns first, knights only when they can land safely or trade.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ♜
5 │ ♟ ♛ ♟ ♟ ♟ ♟
4 │ · · · · · ·
3 │ · ♙ · ♙ · ·
2 │ ♙ · · · ♙ ♙
1 │ ♖ · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Engine self-play, depth 11: 1. c3 b4 2. d3 bxc3 3. Nxc3 Na4 4. Nxa4 Qxa4+ 5. b3 Qb5. Pawns first, knights only when they can land safely or trade.*
<!-- /diagram -->

Follow the logic. `1. c3` opens c2 and controls b4/d4; Black challenges at once with `1...b4`. `2. d3` opens d2 and prepares to recapture toward the centre. After `2...bxc3 3. Nxc3` the White knight *does* reach c3 — but now Black's b-pawn is gone, so nothing can kick it. Black trades it off with `3...Na4 4. Nxa4 Qxa4+`, and the queen's check on the a4–d1 diagonal (open because the c-pawn left c2) is answered by `5. b3`. Six of the first ten moves were pawn moves or captures.

### Guided exercise
White has played `1. d3`. Black wonders whether `1...Nc4` develops a piece "actively".

```crown
fen: rnqknr/pppppp/6/3P2/PPP1PP/RNQKNR b - - 0 1
caption: After 1. d3. Black to move. Is 1...Nc4 a developing move or a gift?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · · ♙ · ·
2 │ ♙ ♙ ♙ · ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*After 1. d3. Black to move. Is 1...Nc4 a developing move or a gift?*
<!-- /diagram -->

*Hint:* which squares does the pawn on d3 attack? Answer it before reading on: the d3-pawn attacks c4 and e4, so `1...Nc4 2. dxc4` simply wins the knight. **Engine judgement (depth 12):** among Black's ten replies, `1...Nc4` is the worst at −270; the best are the pawn steps `1...c4` (−7), `1...d4` (−14) and `1...f4` (−22).

### Independent exercises
1. Without a board: in the starting position, how many legal moves does Black have, and which pieces make them?
2. White has played `1. Na3`. Which single Black pawn step attacks the knight, and how many moves will White have spent on the knight if it returns home?

```crown
fen: rnqknr/pppppp/6/N5/PPPPPP/R1QKNR b - - 1 1
caption: Exercise 2. After 1. Na3, Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · · · ·
3 │ ♘ · · · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2. After 1. Na3, Black to move.*
<!-- /diagram -->

3. An early queen raid. Black's queen on c6 is attacked by the knight on e5. Find the only move that keeps the game balanced.

```crown
fen: rnqknr/2ppNp/pp2pP/6/PPPPP1/RNQK1R b - - 1 4
claim: puzzle pz-llphgz
caption: Exercise 3 (Academy puzzle pz-llphgz). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ · · ♟ ♟ ♘ ♟
4 │ ♟ ♟ · · ♟ ♙
3 │ · · · · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ·
1 │ ♖ ♘ ♕ ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (Academy puzzle pz-llphgz). Black to move.*
<!-- /diagram -->

4. White to move. Something on the board is loose. Find the only move that holds.

```crown
fen: rn1k1r/1pqppp/pNp3/P1P2P/1P1PP1/RNK2R w - - 1 7
claim: puzzle pz-1rhuqma
caption: Exercise 4 (Academy puzzle pz-1rhuqma). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ♜
5 │ · ♟ ♛ ♟ ♟ ♟
4 │ ♟ ♘ ♟ · · ·
3 │ ♙ · ♙ · · ♙
2 │ · ♙ · ♙ ♙ ·
1 │ ♖ ♘ ♔ · · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 4 (Academy puzzle pz-1rhuqma). White to move.*
<!-- /diagram -->

### Answers with explanations
1. Ten, mirroring White: six pawn steps (`...a4` to `...f4`) and four knight jumps (`...Na4`, `...Nc4`, `...Nd4`, `...Nf4`).
2. `1...b4` attacks the knight. If White retreats with `2. Nb1`, the knight has made two moves to end where it started, and Black has a pawn on b4 for free. **Engine judgement:** this is exactly the engine's line at depth 12, and `1. Na3` scores −72 (depth 12) and −60 (depth 14) for White.
3. `4...Qb5`. White's knight on e5 (it came from e1, supported by the f4-pawn) attacks the queen on c6. The queen must leave, and b5 is the square where it is safe and still active. **Engine judgement (depth 10):** `4...Qb5` scores −115 for Black; every other move loses the queen for the knight and scores −450 or worse. Lesson: a knight that reaches your pawn rank already attacks your back rank.
4. `7. Nxa6`. White's knight on b4 attacks Black's rook on a6, and nothing defends that rook (the b6-knight covers a4, c4 and d5, not a6). Take it. **Engine judgement (depth 10):** +115 for `7. Nxa6`; every other move scores −164 or worse.

### Summary
- Ten first moves; only knights and pawns can move.
- Pawn steps are the real developing moves: they open the second rank for queen, king and rooks.
- A knight on rank 3 can be attacked by one enemy pawn step. The engine rates the knight jumps as the worst first moves, by about one pawn.
- First capture typically comes on ply 7: there is no quiet opening phase.

### Next lesson
The king cannot castle. Chapter III.2 asks where it should live instead.

---

## Chapter III.2 — The Crown Without a Castle: King Safety

### Learning objectives
- Use the engine's king-shield idea: which pawns protect the king, and when that protection stops mattering.
- Understand the danger of an open d-file between the two kings.
- Decide when the king should walk (to c2, e2, or beyond) and when it should stay.

### Prerequisites
Chapter III.1.

### Explanation
**The shield.** The engine counts the own pawns on the three squares directly in front of the king (for a king on d1: c2, d2 and e2) and pays **+18 cp each in the middlegame but −14 cp each in the endgame** (method D). Read that sign change carefully: the same pawns that protect the king early become a cage later, when the king should be walking toward the action. The engine's king square table agrees: in the middlegame its favourite squares are on the first two ranks (f2 +19, b1 +7, f1 +6), in the endgame the centre and beyond (c4 +18, d4 +21, d5 +18).

**The d-file.** The kings start face to face on d1 and d6. If both d-pawns leave the d-file, every rook or queen that reaches it gives check. The queens begin on c1 and c6, one diagonal step from the d-file. This makes the d-pawns the most delicate pawns on the board.

**The king walks.** There is no castling, so a king that wants safety must walk. **Evidence (method A):** in 61.1% of balanced games at least one king moved within the first 20 plies (3,400 of 5,568). The walk usually has two purposes at once: to step away from the d-file and to connect the rooks, which cannot see each other while the king stands on d1.

**Evidence (method A).** Both queens were off the board by ply 40 in 64.5% of balanced games (3,592 of 5,568). Early queen trades are normal here, and after them king safety gives way to king activity.

### Illustrated example

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: d3 c4 dxc4 d4 c3 dxc3 bxc3
show: after
caption: An illustrative sequence: 1. d3 c4 2. dxc4 d4 3. c3 dxc3 4. bxc3. Both d-pawns have left the d-file; the kings now face each other down an open file, and either queen can reach it in one move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ · · ♟ ♟
4 │ · · ♙ · · ·
3 │ · · ♙ · · ·
2 │ ♙ · · · ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*An illustrative sequence: 1. d3 c4 2. dxc4 d4 3. c3 dxc3 4. bxc3. Both d-pawns have left the d-file; the kings now face each other down an open file, and either queen can reach it in one move.*
<!-- /diagram -->

### Step-by-step reasoning
Read the position after `4. bxc3` like a strategist:

1. **Count the shields.** White's king on d1 has only the e2-pawn in front of it (c2 and d2 are empty): shield 1. Black's king on d6 has only the e5-pawn (c5 and d5 are empty): shield 1. Both kings are half-exposed.
2. **Look along the d-file.** d2, d3, d4 and d5 are empty. A queen or rook arriving on the file gives check.
3. **Ask what each side wants.** **Engine judgement (depth 12):** Black's best is `4...Nxc4` (+26 for Black), regaining the pawn; in the engine's main line Black's queen later checks on d5. The safer king is the one whose side controls the open file first.
4. **Plan the escape.** Each king has one sideways step off the open file: White's to c2, Black's to c5 (the other neighbouring squares are occupied by their own pieces and pawns).

### Common mistakes
- Trading the d-pawn off the d-file without asking who will control the file afterwards.
- Keeping the king on d1 "because it is safe there" after the queens are traded. With the queens gone, the shield is worth *less than nothing* to the engine (−14 per pawn).
- Moving the e2- or c2-pawn and then leaving the king on d1 with an open diagonal toward the enemy queen. Only the queen can exploit a diagonal, but she does it very well.

### Advanced insight
Because there are no bishops, a king's diagonal danger comes from one piece only: the enemy queen. When the queens leave the board, the king can walk through diagonals that would be suicidal in the older game. That is why so many games here end with kings in the middle of the board escorting pawns.

### Worked example
A real Academy position (from engine play) shows what an exposed king invites.

```crown
fen: 1r4/3kpp/2p1q1/3P2/4P1/2QK1R b - - 0 16
claim: puzzle pz-y788ac
caption: Academy puzzle pz-y788ac. Black to move. White's king on d1 has the queen on c1 beside it and a pawn on e2 in front. Black's queen is on e4.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♜ · · · ·
5 │ · · · ♚ ♟ ♟
4 │ · · ♟ · ♛ ·
3 │ · · · ♙ · ·
2 │ · · · · ♙ ·
1 │ · · ♕ ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-y788ac. Black to move. White's king on d1 has the queen on c1 beside it and a pawn on e2 in front. Black's queen is on e4.*
<!-- /diagram -->

Black plays `16...cxd3!` — the c4-pawn captures on d3 and lands **next to** the White king. Now the pawn on d3 covers c2 and e2, so `...Qxe2#` is threatened: the queen would take the e2-pawn protected by the d3-pawn, and the king could not escape to c2. **Engine judgement (depth 10):** `16...cxd3` scores +691 for Black; the next best, `16...Qd4`, only +44. One pawn wedge beside the king was worth more than six pawns.

### Guided exercise
Return to the illustrated position after `4. bxc3`. Black to move. List every Black move that gives check, then decide whether checking is the best use of the move.

*Hint:* the queen on c6 reaches d5 in one diagonal step, and the d-file is open down to d1.

*Answer:* `4...Qd5+` is the only check — and it is a blunder: `5. cxd5` and the c4-pawn takes the queen. **Engine judgement (depth 12):** `4...Qd5+` scores −950 for Black; the best moves are `4...Nxc4` (+26) and `4...Qxc4` (0), which win back the pawn. An open file is dangerous for both kings, but a check is only good if the checking piece is safe.

### Independent exercises
1. In the starting position, count the shield pawns of each king, and say what the engine's shield term is worth for White in the middlegame and in the endgame.
2. Mate threats against an uncastled king. White to move: find the quiet move that wins material.

```crown
fen: r1k1qr/2nn1p/ppN3/1P2P1/2PNR1/R1Q1K1 w - - 4 17
claim: puzzle pz-1743ej5
caption: Exercise 2 (Academy puzzle pz-1743ej5). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♚ · ♛ ♜
5 │ · · ♞ ♞ · ♟
4 │ ♟ ♟ ♘ · · ·
3 │ · ♙ · · ♙ ·
2 │ · · ♙ ♘ ♖ ·
1 │ ♖ · ♕ · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-1743ej5). White to move.*
<!-- /diagram -->

3. Black to move. Black is a piece down, but White's king on e1 is surrounded by Black pieces. Find the only move that holds.

```crown
fen: r2k1r/ppp1pp/3p1n/1PN1Pq/PNPP1P/R1Q1KR b - - 2 6
claim: puzzle pz-1xooynn
caption: Exercise 3 (Academy puzzle pz-1xooynn). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ · ♜
5 │ ♟ ♟ ♟ · ♟ ♟
4 │ · · · ♟ · ♞
3 │ · ♙ ♘ · ♙ ♛
2 │ ♙ ♘ ♙ ♙ · ♙
1 │ ♖ · ♕ · ♔ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (Academy puzzle pz-1xooynn). Black to move.*
<!-- /diagram -->

4. True or false: "after the queens are traded, the king should stay behind its pawns."

### Answers with explanations
1. Each king has three shield pawns (c2, d2, e2 / c5, d5, e5). For White that is 3 × 18 = +54 cp in the middlegame and 3 × (−14) = −42 cp in the endgame. The two sides cancel in the starting position, of course; the term matters when the shields differ.
2. `17. Nf3`. The knight heads for d4 with check: the engine's line is `17...Ne4 18. Nd4+`, forking the king on c6 and the queen on e6. **Engine judgement (depth 10):** +421; the next best, `17. Qb2`, +246. A quiet move that prepares a check is still a forcing idea.
3. `6...dxc3`. Black's d4-pawn takes the knight on c3 and restores material, while the queen on f3 and knight on f4 stay right beside White's king. **Engine judgement (depth 10):** +158 for Black; every other move scores −290 or worse, because White would offer the queen trade with `Qd1` and stay a piece up.
4. False, as a rule. With queens off, the engine *penalises* shield pawns (−14 each) and rewards a centralised king. **Guidance:** after the queen trade, walk the king toward the centre unless enemy rooks can still trap it on an open file.

### Summary
- The shield (pawns in front of the king) is good early (+18 each) and a cage late (−14 each).
- The d-file between the two kings is the most dangerous line on the board; trade the d-pawns only when you will control it.
- Kings walk early in most games (61% within 20 plies) — to leave the d-file and to connect the rooks.
- Without bishops, only the queen attacks along diagonals; when queens go, kings come out.

### Next lesson
Where should the pawns and pieces stand? Chapter III.3: the centre and space.

---

## Chapter III.3 — The Heart of the Board: Centre and Space

### Learning objectives
- Identify the central squares that matter on six files: c3, d3, c4, d4 (and their Black mirrors).
- Use the engine's square tables to decide where pawns and knights belong.
- Understand why "space" on this board means pawns on your third rank, not your fourth.

### Prerequisites
Chapters III.1–III.2.

### Explanation
The board has no single centre square; it has a **central block** of four: c3, d3, c4, d4. Every piece is stronger there: a knight on c3 or d4 reaches 8 squares (on a6 only 2), a queen on c3 reaches 19 on an empty board.

**Evidence (method C).** How much is one pawn worth, by file? Removing one Black pawn from the starting position and searching to depth 12 (colours swapped and averaged) gives White the following advantage:

| Missing pawn | a | b | c | d | e | f |
|---|---|---|---|---|---|---|
| Value (cp) | +13 | +182 | +119 | +134 | +178 | −4 |

The four inner pawns are worth well over a pawn each; the edge pawns are worth almost nothing in the opening. (Removing an edge pawn also half-opens a file for the enemy rook, which partly explains the small numbers — that is the honest limit of the experiment.)

**Evidence (method D).** The engine's middlegame square table for White pawns is decisive about *where* the inner pawns want to be:

| Rank | a | b | c | d | e | f |
|---|---|---|---|---|---|---|
| 5 (one step from crowning) | +33 | +33 | +39 | +36 | +39 | +28 |
| 4 | +8 | +7 | **+78** | **+52** | **+44** | +18 |
| 3 | −20 | −14 | +16 | +29 | +9 | −6 |
| 2 (start) | −12 | −28 | −16 | −3 | −2 | −23 |

A pawn on c4 or d4 is worth most — when it can *stay* there. But a White pawn on rank 4 is in contact with Black's starting pawns at once (c4 is attacked from b5 and d5). So the fight for the centre is a fight over **who can support a pawn on the fourth rank**, and the usual first step is a pawn on the third rank that controls the fourth.

**Space.** On this board, space is the territory behind your pawn front. A pawn on d3 controls c4 and e4: enemy knights cannot land there and enemy pawns cannot settle there. A pawn on d4 controls c5 and e5 — the starting squares of the enemy pawns — so it is an immediate *threat*, not territory. **Guidance:** gain space with third-rank pawns; advance to the fourth rank when you can recapture there with a pawn.

### Illustrated example

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: d3 c4
show: after
caption: After 1. d3 c4. The two pawns attack each other: White can play dxc4, Black can play ...cxd3. The question of the centre is asked on move one.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ · ♟ ♟ ♟
4 │ · · ♟ · · ·
3 │ · · · ♙ · ·
2 │ ♙ ♙ ♙ · ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*After 1. d3 c4. The two pawns attack each other: White can play dxc4, Black can play ...cxd3. The question of the centre is asked on move one.*
<!-- /diagram -->

### Step-by-step reasoning
1. **What does d3 do?** It attacks c4 and e4 and opens d2 for the king, queen and b1-knight. It also *removes* one pawn from the king's shield (the shield counts c2, d2 and e2). Every pawn move has a price.
2. **What does ...c4 do?** It challenges d3 at once and controls b3 and d3.
3. **Who should capture?** **Engine judgement (depth 12, method B):** after `1. d3 c4` the engine does *not* capture; it plays `2. c3`, inviting `2...cxd3 3. Nxd3`, so that White recaptures toward the centre with a piece and keeps the c3-pawn controlling b4 and d4.

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: d3 c4 c3 cxd3 Nxd3
show: after
caption: 1. d3 c4 2. c3 cxd3 3. Nxd3. White's pawn on c3 controls b4 and d4; the knight on d3 eyes b4, c5, e5 and f4. Black's c-pawn has been traded for White's d-pawn.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ · ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · ♙ ♘ · ·
2 │ ♙ ♙ · · ♙ ♙
1 │ ♖ ♘ ♕ ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*1. d3 c4 2. c3 cxd3 3. Nxd3. White's pawn on c3 controls b4 and d4; the knight on d3 eyes b4, c5, e5 and f4. Black's c-pawn has been traded for White's d-pawn.*
<!-- /diagram -->

4. **Read the new centre.** White has a pawn on c3 and a knight on d3; Black still has the d5 and e5 pawns. **Engine judgement (depth 12):** roughly level (Black's best `3...e4` scores −29 for Black). The knight on d3 can be hit by `...e4` — every central piece must ask which pawn can reach it.

### Common mistakes
- Treating a fourth-rank pawn as "space". It is contact, and often a target.
- Pushing the a- and f-pawns to "gain space". The engine values those pawns least of all in the opening.
- Recapturing away from the centre (for example with a wing pawn) when a central recapture is available.

### Advanced insight
Because pawns move only one step and there are just two empty ranks, *every* pawn advance hands squares to the opponent: the squares the pawn used to guard can never be guarded by it again. Strategists count not only the squares a move attacks but also the squares it abandons.

### Worked example
**Evidence (method C), the inner pawns compared.** Suppose Black has lost a pawn in the opening. Which pawn would you rather Black had lost? The experiment's answer: b- or e-pawn (about +180 cp for White), then d (+134) and c (+119), and an edge pawn hardly matters (a: +13, f: −4). Why are b and e so high? Because the b- and e-pawns guard the c- and d-files' neighbouring squares (a4/c4 and d4/f4) and shield the knights' natural squares; without them, White's pawns reach the fourth rank unchallenged. **Guidance:** in the opening, trade a wing pawn for a central one whenever you can.

### Guided exercise
In the diagram after `3. Nxd3` above, name the squares White's c3-pawn controls, and the Black pawn steps that could attack White's d3-knight.

*Answer:* c3 controls b4 and d4. The knight on d3 can be attacked by a Black pawn on c4 or e4; the only Black pawn that can get there in one step is the e-pawn (`...e4`), which is exactly the engine's choice.

### Independent exercises
1. Using the pawn table, which is the engine's favourite square for a White pawn in the middlegame, and by how much does it prefer it to the same pawn on a4?
2. Black to move. White's knights are active. Find the only move that holds.

```crown
fen: r1q1kr/p3pp/2p2n/2P1P1/P2NP1/R1Q1KR b - - 0 9
claim: puzzle pz-1x6nwkp
caption: Exercise 2 (Academy puzzle pz-1x6nwkp). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♛ · ♚ ♜
5 │ ♟ · · · ♟ ♟
4 │ · · ♟ · · ♞
3 │ · · ♙ · ♙ ·
2 │ ♙ · · ♘ ♙ ·
1 │ ♖ · ♕ · ♔ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (Academy puzzle pz-1x6nwkp). Black to move.*
<!-- /diagram -->

3. White to move. Black's queen on c4 and pawn on d4 press on the centre. Find the only move that holds.

```crown
fen: r2knr/pp1npp/2qp2/PNP2P/1PN1P1/R1QK1R w - - 4 9
claim: puzzle pz-12d9mta
caption: Exercise 3 (Academy puzzle pz-12d9mta). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ♜
5 │ ♟ ♟ · ♞ ♟ ♟
4 │ · · ♛ ♟ · ·
3 │ ♙ ♘ ♙ · · ♙
2 │ · ♙ ♘ · ♙ ·
1 │ ♖ · ♕ ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (Academy puzzle pz-12d9mta). White to move.*
<!-- /diagram -->

4. Black to move. White's knight on d3 and queen on a3 aim at Black's centre. Find the only move that holds.

```crown
fen: rnqk1r/p1n1pp/3p2/QP1N2/P2PPP/2RK1R b - - 0 8
claim: puzzle pz-7no048
caption: Exercise 4 (Academy puzzle pz-7no048). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ · ♜
5 │ ♟ · ♞ · ♟ ♟
4 │ · · · ♟ · ·
3 │ ♕ ♙ · ♘ · ·
2 │ ♙ · · ♙ ♙ ♙
1 │ · · ♖ ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 4 (Academy puzzle pz-7no048). Black to move.*
<!-- /diagram -->

### Answers with explanations
1. c4 (+78 cp in the middlegame), 70 cp more than a4 (+8).
2. `9...Nd5`. Black's knight on f4 is attacked by the e3-pawn. `9...Nd5` retreats it to the centre, where it attacks the pawns on e3 and c3; in the engine's line it wins the e3-pawn back. **Engine judgement (depth 10):** +18 for Black; `9...Nxe2` and the queen moves score −309 or worse.
3. `9. Nd2`. Black's queen on c4 attacks the b3-knight, and the d4-pawn attacks c3. `9. Nd2` saves the knight with a gain of time: from d2 it attacks the queen. **Engine judgement (depth 10):** 0.00 (the engine sees a repetition after `9...Qc5 10. Nb3 Qc4`); `9. Nbxd4` loses material (−274) after `9...exd4`.
4. `8...Na4`. Black's knight on c5 is pinned to the king on d6 by the queen on a3 (along a3–b4–c5–d6) and is attacked by the queen, the d3-knight and the c1-rook. `8...Na4` — the b6-knight, since the c5-knight cannot move — brings another defender to c5. **Engine judgement (depth 10):** −139 for Black (the least bad); every alternative scores −600 or worse.

### Summary
- The central block is c3, d3, c4, d4; inner pawns are worth more than a pawn each in the opening, edge pawns very little (method C).
- The engine's favourite pawn squares are c4, d4 and e4 — but a fourth-rank pawn is in contact at once.
- Gain space with third-rank pawns; advance when you can support the advance with a pawn.

### Next lesson
Every move counts double on a small board. Chapter III.4: tempo, initiative and coordination.

---

## Chapter III.4 — The Double-Edged Hourglass: Tempo, Initiative and Coordination

### Learning objectives
- Measure the value of a tempo with the engine's own numbers.
- Recognise moves that gain time (threats against pieces) and moves that lose it.
- Coordinate pieces without bishops: the queen–knight team and the rook pair.

### Prerequisites
Chapters III.1–III.3, Book II tactics.

### Explanation
**A tempo is real.** The engine adds **+65 cp** in the middlegame simply for being the side to move (method D). The starting position is +37 to +54 cp for White at depths 12–14 (method B). **Evidence (method A):** White scored **55.9%** in the 5,566 finished balanced games. On this board the first move is a genuine advantage.

**Threats buy time.** The largest middlegame terms after material are the threat terms: a pawn attacking a knight, rook or queen (+128), a rook attacking the queen (+110), a knight attacking a rook or queen (+47). A threat forces a reply; if your threatening move also improves your position, you have *gained* a tempo. If the opponent's reply also improves *their* position, nobody gained anything.

**Initiative** is a chain of such moves: you make threats, the opponent answers, and the answers are worse moves than they would have chosen freely.

**Coordination without bishops.** Your long-range pieces are the queen and two rooks; your short-range pieces are the knights and king. Good teams:
- **Queen + knight.** The knight's jumps cover exactly the squares a queen cannot reach in one move from the same spot, so the two complete each other around an enemy king.
- **Rook + rook.** Doubled on an open file, they are the board's strongest battering ram.
- **Rook + pawn.** A rook behind a passed pawn (Book IV).

**Evidence (method A, the 640-game confirmation match).** On average a position offers only **12.9** legal moves (14.2 in the first 20 plies, 10.5 after ply 60). 21.4% of all moves played were captures and 14.1% gave check. With so few choices, each move's purpose must be sharp.

### Illustrated example

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Na3 b4 Nb1
show: after
caption: 1. Na3 b4 2. Nb1. White has spent two moves to return to the start; Black has a pawn on b4 for free and it is Black's move. That is a tempo gained by a threat.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ · ♟ ♟ ♟ ♟
4 │ · ♟ · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*1. Na3 b4 2. Nb1. White has spent two moves to return to the start; Black has a pawn on b4 for free and it is Black's move. That is a tempo gained by a threat.*
<!-- /diagram -->

### Step-by-step reasoning
1. `1. Na3` develops — but onto a square Black can attack with one pawn step.
2. `1...b4` is a threat (pawn attacks knight: the engine's biggest positional term) *and* an improving move (space, control of a3 and c3).
3. `2. Nb1` answers the threat but improves nothing. Net result: Black gained a full move. **Engine judgement:** this is the engine's own line at depth 12; `1. Na3` scores −72 at depth 12 and −60 at depth 14.

### Common mistakes
- Making a threat that the opponent answers with a move they wanted to make anyway.
- Retreating a piece twice in the opening. Each retreat is a tempo given away.
- Leaving pieces where they do not protect one another. The engine's "hanging piece" term (+25 for the attacker) is small, but the tactical cost is not.

### Advanced insight
On a board with 12.9 moves per position, the defender's resources are fewer than in the older game. A single tempo can turn "I can defend" into "I am one move short". This is why the engine's tempo term is so large compared with the material of a pawn (65 versus 89).

### Worked example
Coordination and a discovered attack, from engine play:

```crown
fen: r1qk1r/1ppn1p/p2p2/N2PpN/PPP1KP/R1Q2R b - - 0 8
claim: puzzle pz-p05pjm
caption: Academy puzzle pz-p05pjm. Black to move. White's king stands on e2; Black's knight on d5 and pawn on e3 are close by.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♛ ♚ · ♜
5 │ · ♟ ♟ ♞ · ♟
4 │ ♟ · · ♟ · ·
3 │ ♘ · · ♙ ♟ ♘
2 │ ♙ ♙ ♙ · ♔ ♙
1 │ ♖ · ♕ · · ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-p05pjm. Black to move. White's king stands on e2; Black's knight on d5 and pawn on e3 are close by.*
<!-- /diagram -->

Black plays `8...Nf4+!`. The knight checks the king on e2 from f4 and, by leaving d5, opens the queen's diagonal c6–d5–e4–f3. After `9. Ke1` the queen takes the knight: `9...Qxf3`. A check and a discovered attack in one move. **Engine judgement (depth 10):** +459 for Black; the quiet `8...Re6` only −132. Knight, queen and the advanced e3-pawn (which keeps the king boxed in) worked together around the exposed king.

### Guided exercise
Black to move. White's knights are in Black's half of the board. Find the only move that holds, and say what it gains.

```crown
fen: r1qknr/1ppn2/p2p1p/P2P1N/1PPNP1/R1QK1R b - - 2 7
claim: puzzle pz-sxwkr
caption: Guided exercise (Academy puzzle pz-sxwkr). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♛ ♚ ♞ ♜
5 │ · ♟ ♟ ♞ · ·
4 │ ♟ · · ♟ · ♟
3 │ ♙ · · ♙ · ♘
2 │ · ♙ ♙ ♘ ♙ ·
1 │ ♖ · ♕ ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise (Academy puzzle pz-sxwkr). Black to move.*
<!-- /diagram -->

*Hint:* a knight move with check can attack two things at once. *Answer:* `7...Ne3+`. The d5-knight checks the king on d1 and attacks the c2-pawn and the f1-rook; at the same time it opens the queen's diagonal c6–d5–e4–f3 toward White's f3-knight. **Engine judgement (depth 10):** −229 for Black, but every other move scores −640 or worse.

### Independent exercises
1. How large is the engine's tempo term compared with a pawn, in the middlegame?
2. White to move. Find the capture that wins material.

```crown
fen: rnqkn1/p3r1/3N2/1Pp2N/P1PP1P/R2K1R w - - 0 11
claim: puzzle pz-72t10s
caption: Exercise 2 (Academy puzzle pz-72t10s). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ·
5 │ ♟ · · · ♜ ·
4 │ · · · ♘ · ·
3 │ · ♙ ♟ · · ♘
2 │ ♙ · ♙ ♙ · ♙
1 │ ♖ · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-72t10s). White to move.*
<!-- /diagram -->

3. White to move. Find the double attack that holds the position.

```crown
fen: 3knr/r3p1/2qp1p/5N/1QPPPP/3K1R w - - 0 9
claim: puzzle pz-5bgv1i
caption: Exercise 3 (Academy puzzle pz-5bgv1i). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ ♞ ♜
5 │ ♜ · · · ♟ ·
4 │ · · ♛ ♟ · ♟
3 │ · · · · · ♘
2 │ · ♕ ♙ ♙ ♙ ♙
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (Academy puzzle pz-5bgv1i). White to move.*
<!-- /diagram -->

4. In 5,566 balanced engine games, what was White's score? What does that suggest about the value of the first move?

### Answers with explanations
1. 65 cp against 89 cp: a tempo is worth about three quarters of a pawn in the engine's middlegame accounting.
2. `11. Nxc6`. The knight on d4 attacks c6, where Black's queen stands, and takes it. **Engine judgement (depth 10):** +320 (Black gets some play with `11...Re4`, which is why it is not more); the next best move, `11. Nxe5`, is −190.
3. `9. Qb6+`. The queen runs up the open b-file and checks the king on d6 along the sixth rank; after `9...Kd5` it takes the undefended rook on a5 with check, `10. Qxa5+`. **Engine judgement (depth 10):** −28 (roughly level — Black's queen and pawns remain active); without it White loses material (−494 or worse).
4. 55.9%. Together with the engine's +37 to +54 cp for the starting position and its 65-cp tempo term, this is consistent evidence that the first move is a real advantage on this board.

### Summary
- Tempo: +65 cp to the engine; White scores 55.9% in balanced engine games.
- Threats gain time only if the threatening move also improves your position.
- Few legal moves per position (12.9 on average) make every tempo count.
- Queen + knight and rook + rook are the natural teams of a bishopless army.

### Next lesson
Pawns are the soul of the position. Chapter III.5: pawn structures in the engine's own words.

---

## Chapter III.5 — The Bones of the Position: Pawn Structures

### Learning objectives
- Recognise the five structures the engine scores: doubled, isolated, supported, phalanx and passed pawns.
- Know how much each is worth to the engine, and how that changes in the endgame.
- Understand why passed pawns dominate the endgame on a six-rank board.

### Prerequisites
Chapters III.1–III.4.

### Explanation
The engine's definitions (method D, `eval4.ts`) are precise; learn them as they are written:

- **Doubled:** two or more own pawns on one file. Each pays −15 (middlegame) / −6 (endgame).
- **Isolated:** no own pawn on either neighbouring file. −8 / **−18**: isolated pawns become weaker as pieces come off.
- **Supported:** defended by an own pawn diagonally behind it. +13 / −4.
- **Phalanx:** an own pawn on the square beside it. +16 / +15: side-by-side pawns are good in every phase.
- **Passed:** no enemy pawn ahead of it on its own file or the two neighbouring files. Worth little in the middlegame but large in the endgame, rising with every step: on its 4th rank −12 / **+90**, on its 5th rank +37 / **+109**, plus up to +56 more if the square in front is empty, plus bonuses when the enemy king is far away (+26 per step of distance, scaled by rank).

**The six-rank fact.** A pawn on its starting rank needs **four single steps** to crown: three quiet ones and the promoting step. There is no two-step first move. A passed pawn in the middle of the board is never more than two or three moves from a new queen.

**Evidence (method A, balanced games).** Promotion is not a rare event here:
- **51.3%** of games (2,859 of 5,568) contained at least one promotion; the median first promotion came on ply 64.
- In **67.2%** of decisive games (2,480 of 3,688) the winner promoted at least once.
- Of 3,855 promotions, 3,682 were to a queen, **121 to a knight** (3.1%) and 52 to a rook. Under-promotion to a knight, usually to give check or fork, is a real weapon.

### Illustrated example

```crown
fen: 3k2/2pp1p/P5/2P1PP/2P3/3K2 w - - 0 1
caption: A gallery of structures. White: a4 is isolated AND passed; c2 and c3 are doubled and isolated; e3 and f3 form a phalanx. Black: c5 and d5 form a phalanx; f5 is isolated.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · ♟ ♟ · ♟
4 │ ♙ · · · · ·
3 │ · · ♙ · ♙ ♙
2 │ · · ♙ · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*A gallery of structures. White: a4 is isolated AND passed; c2 and c3 are doubled and isolated; e3 and f3 form a phalanx. Black: c5 and d5 form a phalanx; f5 is isolated.*
<!-- /diagram -->

### Step-by-step reasoning
Let us read the gallery exactly as the engine does (its term trace for this position confirms each item):

1. **a4.** No White pawn on the b-file: isolated. No Black pawn on the a- or b-file ahead of it: passed, on its 4th rank, with a5 empty: the endgame bonus is +90 +24, plus a bonus because Black's king on d6 is far from a5.
2. **c2, c3.** Two pawns on the c-file: both doubled. No White pawn on b or d: both isolated. They are also blocked from becoming passed by Black's c5 and d5.
3. **e3, f3.** Side by side: both are phalanx pawns. Neither is passed (Black's f5 stands ahead of them on the f-file and controls e4).
4. **Black's c5, d5.** A phalanx. d5 is not passed (White's c3 and e3 guard c4 and e4).
5. **Black's f5.** No Black pawn on e: isolated.

**Engine judgement (static evaluation):** +295 cp for White, mostly because the passed a-pawn is outside the Black king's reach: Black's king needs three moves to reach a6, the pawn needs only two to crown (a5, a6=Q).

### Common mistakes
- Thinking doubled pawns are a disaster. In the middlegame the engine charges only −15 each; they matter when they cannot become passed or defend each other.
- Ignoring isolated pawns because "they are only −8". In the endgame the charge more than doubles (−18), and a lone pawn needs a piece to guard it.
- Underestimating a passed pawn on the fourth rank in the middlegame. It is two steps from crowning; when the pieces come off it is suddenly worth a whole extra pawn to the engine.

### Advanced insight
Why do phalanx pawns keep their value in the endgame while supported pawns lose it (+13 → −4)? A phalanx can advance together and each pawn can protect the other's next square; a supported pawn has a supporter that stands *behind*, which is slower and blocks nothing. When you choose how to recapture, prefer the recapture that makes a phalanx.

### Worked example
A passed pawn changes everything, even when its owner is short of material.

```crown
fen: r4r/1p4/3Pk1/pPP2p/P2K2/1RN3 w - - 0 21
claim: puzzle pz-1h5x471
caption: Academy puzzle pz-1h5x471. White to move. Black's f3-pawn is two steps from f1; White's d4-pawn is passed too.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · · · ♜
5 │ · ♟ · · · ·
4 │ · · · ♙ ♚ ·
3 │ ♟ ♙ ♙ · · ♟
2 │ ♙ · · ♔ · ·
1 │ · ♖ ♘ · · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-1h5x471. White to move. Black's f3-pawn is two steps from f1; White's d4-pawn is passed too.*
<!-- /diagram -->

White must deal with `...f2` and `...f1=Q`. The answer is `21. Nd3!`, covering f2 and preparing `Nc5+`, a fork of the king on e4 and the rook on a6. **Engine judgement (depth 10):** the main line `21...f2 22. Nc5+ Kd5 23. Nxa6 f1=Q 24. Rxf1 Rxf1` gives White the better of it (+130); every other move lets the pawn crown with a large advantage for Black (−60 to −200 and worse).

### Guided exercise
In the gallery diagram, suppose it is White's move. How many moves does the a-pawn need to promote, and how many moves does Black's king need to reach the promotion square a6?

*Answer:* two pawn moves (a5, a6=Q). Black's king on d6 needs three moves to reach a6 (c6, b6, a6) — and it cannot even stop on b6 in time. The pawn is unstoppable: exactly the case the engine's (unweighted) "unstoppable" detector flags.

### Independent exercises
1. Give the engine's middlegame and endgame values for: a doubled pawn; an isolated pawn; a phalanx pawn.
2. White to move. A knight must stop a passed pawn while also holding its own. Find the move that wins.

```crown
fen: 1n4/1Nk2p/p4P/Pp1P2/1P4/2K3 w - - 1 21
claim: puzzle pz-9gpef8
caption: Exercise 2 (Academy puzzle pz-9gpef8). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♞ · · · ·
5 │ · ♘ ♚ · · ♟
4 │ ♟ · · · · ♙
3 │ ♙ ♟ · ♙ · ·
2 │ · ♙ · · · ·
1 │ · · ♔ · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-9gpef8). White to move.*
<!-- /diagram -->

3. Black to move. Find the only move that holds.

```crown
fen: 3knr/4N1/Pp1p2/4Pp/2P2P/3KR1 b - - 0 17
claim: puzzle pz-j9v9yp
caption: Exercise 3 (Academy puzzle pz-j9v9yp). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ ♞ ♜
5 │ · · · · ♘ ·
4 │ ♙ ♟ · ♟ · ·
3 │ · · · · ♙ ♟
2 │ · · ♙ · · ♙
1 │ · · · ♔ ♖ ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (Academy puzzle pz-j9v9yp). Black to move.*
<!-- /diagram -->

4. From a pawn on its starting rank, how many moves to promote? What fraction of balanced engine games contained a promotion?

### Answers with explanations
1. Doubled −15 / −6; isolated −8 / −18; phalanx +16 / +15.
2. `21. Nc3`. White's knight on b5 is attacked by Black's king on c5 and has no defender. `21. Nc3` saves it and attacks Black's a4-pawn, while the passed f4-pawn keeps Black's knight busy. **Engine judgement (depth 10):** +84; the king moves lose the knight (−312 and worse).
3. `17...Kxe5`. White's knight on e5 is undefended; Black's king takes it, and after `18. Kd2 Nc5` Black's knight attacks the passed a4-pawn. **Engine judgement (depth 10):** +202 for Black; `17...dxe3` is −197.
4. Four single steps (three quiet steps and the promotion). 51.3% of balanced games contained at least one promotion.

### Summary
- Five structures, each with a precise engine definition and weight.
- Isolated pawns grow weaker in the endgame; phalanxes stay strong; passed pawns become huge (+90 to +165 on the 4th–5th rank).
- Four steps to crown; half of all engine games see a promotion, and two thirds of winners promote.

### Next lesson
Pawns decide which lines are open. Chapter III.6: files, weak squares and outposts.

---

## Chapter III.6 — Open Roads and Safe Harbours: Files, Weak Squares and Outposts

### Learning objectives
- Use rooks on open and half-open files, and know the engine's large bonus for them.
- Recognise the "facing rooks" pattern on the a- and f-files, unique to this starting array.
- Find weak squares and knight outposts, and know honestly what the engine thinks they are worth.

### Prerequisites
Chapters III.1–III.5.

### Explanation
**Open files.** A rook on a file with no pawns earns **+68 cp** in the middlegame; on a half-open file (only enemy pawns) **+48** (method D). These are among the largest positional terms the engine has. With only six files, a single open file often decides who controls the game.

**Facing rooks.** Remember the opening fact: at the start, nothing defends a1 or f1 (or a6 and f6). When the a-pawns or f-pawns are exchanged early, the two rooks on that file stare at each other with nothing between them and **neither rook defended**. Whoever is on move captures a whole rook. Many Academy puzzles from engine play (for example pz-1alc6nh, pz-1kvvn1q, pz-146whg9, pz-54922z, pz-1cm516w, pz-sawrgf) are exactly this, with the solution "take the rook first".

**Weak squares and outposts.** A square is *weak* for a side when none of its pawns can ever attack it again (because the pawns on the neighbouring files have advanced past it or disappeared). An enemy knight on such a square, defended by a pawn, is called an outpost. The engine's code detects outposts (a knight on its 3rd to 5th rank, defended by a pawn, not attackable by enemy pawns) — but in the shipped weights the outpost term is **zero**. The engine values those knights through its square table instead: in the middlegame a White knight earns +22 on c4, +28 on e5 and +12 on d5, but −38 on c3 and −31 on d3 (method D). So: the engine likes advanced central knights; it does not pay extra merely because a pawn defends them.

### Illustrated example

```crown
fen: r1qknr/pp1n2/4p1/P5/1PP3/RNQKNR w - - 0 7
claim: puzzle pz-1cm516w
caption: Academy puzzle pz-1cm516w. White to move. The f-file is open; Rf1 and Rf6 face each other, and neither is defended.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♛ ♚ ♞ ♜
5 │ ♟ ♟ · ♞ · ·
4 │ · · · · ♟ ·
3 │ ♙ · · · · ·
2 │ · ♙ ♙ · · ·
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-1cm516w. White to move. The f-file is open; Rf1 and Rf6 face each other, and neither is defended.*
<!-- /diagram -->

### Step-by-step reasoning
1. **See the file.** No pawn stands on f2, f3, f4 or f5. The rooks on f1 and f6 attack each other.
2. **Check the defenders.** White's f1-rook: the e1-knight covers c2, d3, f3 — not f1. The king on d1 does not reach f1. Undefended. Black's f6-rook: the e6-knight covers c5, d4, f4 — not f6. Undefended.
3. **Conclusion:** the side to move wins a rook. White plays `7. Rxf6`, and after `7...Nxf6` the material is level again — whereas any other move allows `...Rxf1`, losing a rook. **Engine judgement (depth 10):** `7. Rxf6` −37; every alternative −489 or worse.

### Common mistakes
- Opening the a- or f-file in the opening without checking whether your rook is defended.
- Putting a rook on an open file that the opponent can contest at once with an undefended rook of their own — the same pattern in the middlegame.
- Paying a pawn to plant a knight on an "outpost" that the opponent can simply exchange off with a knight. Without bishops, only knights (and the queen) can challenge a knight on a pawn-proof square.

### Advanced insight
On six files, a half-open file is only one pawn exchange away from an open one, and a rook's whole file is just six squares long. That is why the engine rates the open file at more than half a pawn (68 cp) while rating an outpost at nothing extra: rooks gain far more from a single open line than knights gain from a protected square.

### Worked example
A real outpost, as the engine's code defines it:

```crown
fen: rn1k2/1p3p/p2N2/2P3/P4P/R2K2 w - - 0 1
caption: White's knight on d4 is defended by the c3-pawn, and no Black pawn can ever attack d4 (there are no Black pawns on the c- or e-files). The engine's trace flags it as an outpost — and adds nothing for it, because the outpost weight is zero.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ·
5 │ · ♟ · · · ♟
4 │ ♟ · · ♘ · ·
3 │ · · ♙ · · ·
2 │ ♙ · · · · ♙
1 │ ♖ · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*White's knight on d4 is defended by the c3-pawn, and no Black pawn can ever attack d4 (there are no Black pawns on the c- or e-files). The engine's trace flags it as an outpost — and adds nothing for it, because the outpost weight is zero.*
<!-- /diagram -->

What *can* challenge the knight? Only Black's knight, by reaching a square from which it attacks d4 (b3, c2, c6, e2, e6 or f3) — from b6 that takes three moves, for example `...Nc4`, `...Ne5`, `...Nc6`. **Guidance:** a pawn-proof square is valuable when the opponent has no knight left to contest it. Without bishops, that question is asked of knights alone.

### Guided exercise
White to move. Another pair of facing rooks — this time on the a-file. Find the only move that holds.

```crown
fen: rn1knr/1qpppp/1p4/5P/1PPPP1/RNQKNR w - - 0 4
claim: puzzle pz-1alc6nh
caption: Guided exercise (Academy puzzle pz-1alc6nh). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ ♞ ♜
5 │ · ♛ ♟ ♟ ♟ ♟
4 │ · ♟ · · · ·
3 │ · · · · · ♙
2 │ · ♙ ♙ ♙ ♙ ·
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Guided exercise (Academy puzzle pz-1alc6nh). White to move.*
<!-- /diagram -->

*Answer:* `4. Rxa6`, taking the undefended rook (`4...Qxa6` recaptures). **Engine judgement (depth 10):** −26 for White after the trade; every other move loses a rook and scores −243 or worse.

### Independent exercises
1. Which is larger in the engine's middlegame accounting: a rook on an open file, or a knight on an outpost?
2. Black to move. Find the only move that holds.

```crown
fen: rnqkn1/1ppp1r/4pp/1PP3/1Q1PPP/RN1KNR b - - 0 6
claim: puzzle pz-1kvvn1q
caption: Exercise 2 (Academy puzzle pz-1kvvn1q). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ·
5 │ · ♟ ♟ ♟ · ♜
4 │ · · · · ♟ ♟
3 │ · ♙ ♙ · · ·
2 │ · ♕ · ♙ ♙ ♙
1 │ ♖ ♘ · ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (Academy puzzle pz-1kvvn1q). Black to move.*
<!-- /diagram -->

3. Black to move. The f-file has opened. Find the only move that holds.

```crown
fen: rnqknr/ppppp1/6/P2PP1/1PPN2/R1QKNR b - - 0 5
claim: puzzle pz-54922z
caption: Exercise 3 (Academy puzzle pz-54922z). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ·
4 │ · · · · · ·
3 │ ♙ · · ♙ ♙ ·
2 │ · ♙ ♙ ♘ · ·
1 │ ♖ · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (Academy puzzle pz-54922z). Black to move.*
<!-- /diagram -->

4. Black to move. The king has stepped to e2, defending f1. Is it still right to capture on f1?

```crown
fen: rnqknr/1pppp1/p5/3PP1/PPP1K1/RNQ1NR b - - 0 4
claim: puzzle pz-1m7xdw8
caption: Exercise 4 (Academy puzzle pz-1m7xdw8). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ · ♟ ♟ ♟ ♟ ·
4 │ ♟ · · · · ·
3 │ · · · ♙ ♙ ·
2 │ ♙ ♙ ♙ · ♔ ·
1 │ ♖ ♘ ♕ · ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 4 (Academy puzzle pz-1m7xdw8). Black to move.*
<!-- /diagram -->

### Answers with explanations
1. The rook on the open file: +68 cp. The outpost term is weighted zero (the knight gets only its square-table value).
2. `6...Rxa1`. The a-file is open and Black's a6-rook can take the a1-rook first; `7. Qxa1` recaptures. **Engine judgement (depth 10):** −59 for Black; the knight moves that ignore the rooks score −304 or worse.
3. `5...Rxf1`. White's f1-rook is defended by the d2-knight, but Black's f6-rook is attacked and undefended, so Black must trade first: `5...Rxf1 6. Nxf1`. **Engine judgement (depth 10):** −29; alternatives −439 or worse.
4. Yes: `4...Rxf1 5. Kxf1`. White's f1-rook is defended now, but Black's f6-rook is attacked and undefended, so Black must trade rather than lose it. **Engine judgement (depth 10):** −64 for Black; every other move −349 or worse.

### Summary
- Open file +68, half-open +48: rooks love the few open lines of a six-file board.
- Facing rooks on the a- and f-files: both start undefended; the side to move takes first.
- The engine detects outposts but weights them zero; its knight square table (best: e5, c4, d5) carries the knowledge. Without bishops, only a knight can challenge a pawn-proof knight.

### Next lesson
What is a queen worth against a rook and a knight? Chapter III.7: material imbalances and trades.

---

## Chapter III.7 — Unequal Scales: Material Imbalances and Trading Decisions

### Learning objectives
- Know the engine's material values on this board, and how they change with the phase.
- Use measured evidence to judge common imbalances: queen against rook and knight, rook against knight, knight against pawns.
- Decide which pieces to trade when you are ahead, and which endings to aim for.

### Prerequisites
Chapters III.1–III.6.

### Explanation
**The engine's price list (method D).** Pawn 89 / 89; knight **441** / 262; rook 407 / **463**; queen 934 / 775 (middlegame / endgame). Two surprises:

1. In the middlegame the engine values a **knight slightly above a rook**. On a 36-square board a central knight reaches 8 squares — more than a fifth of the board — and rooks are hemmed in by pawns until files open.
2. In the endgame the rook is worth almost **twice** the knight. Open board, few pawns: the rook's range wins.

**Engine judgement (method C, depth 12, tempo-neutral).** Removing material from the starting position:

| Imbalance (first side has it) | Value for the first side |
|---|---|
| Queen vs rook + knight | +134 |
| Queen vs two rooks | +118 |
| Queen vs two knights | +183 |
| Queen vs rook + knight + pawn | +17 (≈ equal) |
| Rook vs knight | +24 |
| Rook vs knight + pawn | −67 |
| Knight vs one pawn | +222 |
| Knight vs two pawns | +102 |
| Knight vs three pawns | −36 (≈ equal) |
| Rook vs two pawns | +125 |
| Rook vs three pawns | −24 (≈ equal) |

So in the opening phase: **queen ≈ rook + knight + pawn**, **knight ≈ rook** (the rook is slightly better), **knight ≈ three pawns**, **rook ≈ three pawns**.

**Evidence (method A, balanced games).** How did these imbalances actually score when they lasted at least 8 plies (score for the side with the first-named material, pawns equal unless stated)?

| Imbalance | Games | Score |
|---|---|---|
| Rook vs knight | 509 | 67.7% |
| Rook vs knight + pawn | 319 | 45.8% |
| Queen vs rook + knight | 60 | 53.3% |
| Queen vs rook + knight, all pawn counts | 141 | 56.7% |
| Queen vs two rooks | 41 | 43.9% |
| Queen vs two knights | 39 | 79.5% |
| Knight vs one pawn | 913 | 75.2% |
| Knight vs two pawns | 354 | 58.2% |
| Knight vs three pawns | 45 | 43.3% |
| Rook vs two pawns | 118 | 76.3% |

Where the experiment and the games agree, and where they do not:
- **Rook against knight is worth about one pawn**, no more: give the rook side one pawn fewer and the score falls below 50% in the games (45.8%), and below zero in the experiment (−67).
- **Queen against rook and knight** favours the queen a little in both (+134 in the opening experiment, 53–57% in games), and adding one pawn to the rook-and-knight side balances it.
- **Queen against two rooks** is the open question: the opening experiment prefers the queen (+118), but in the 41 games that reached it the rooks scored 56.1%. Open files, which arrive later in the game, favour the rooks. Treat it as roughly balanced and judge by the files and by the safety of the kings.

**Trading decisions: which ending?** **Evidence (method A).** For the four "pure" endings (each side has exactly the same single piece, or only pawns), first reached in the balanced games:

| Ending | Games | Drawn when pawns are equal | Side with more pawns: wins / draws |
|---|---|---|---|
| Pawn ending | 286 | 30.8% | **77.4%** / 17.3% |
| Rook ending | 1,511 | 53.5% | 62.2% / 28.7% |
| Queen ending | 125 | 55.4% | 63.8% / 18.8% |
| Knight ending | 428 | **81.6%** | 49.0% / 46.2% |

The extra pawn wins most often in a **pawn ending** and least often in a **knight ending**. (These are associations from engine games: the extra pawns differ in quality, and the counts for queen endings are small.)

### Illustrated example

```crown
fen: rn1knr/pppppp/6/6/PPPPPP/2QKNR w - - 0 1
caption: Method C, queen against rook and knight. White has kept the queen but lost the a1-rook and b1-knight; Black has lost the queen. Depth 12: +166 for White here (+134 with the first move's value removed).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ · · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Method C, queen against rook and knight. White has kept the queen but lost the a1-rook and b1-knight; Black has lost the queen. Depth 12: +166 for White here (+134 with the first move's value removed).*
<!-- /diagram -->

### Step-by-step reasoning
How to think about an imbalance:

1. **Count with the right price list.** Middlegame: knight ≈ rook. Endgame: rook ≈ knight + pawn and more.
2. **Ask about pawns.** Pawns decide the endgame. Rook vs knight with equal pawns: the rook side scored 67.7%; one pawn less, 45.8%.
3. **Ask about targets.** A queen needs targets (loose pieces, an exposed king) to beat rook and knight; two rooks need an open file.
4. **Ask which ending you are heading for.** If you are a pawn up, aim for a pawn ending; if you are a pawn down, aim for a knight ending.

### Common mistakes
- Using 8×8 values (knight 3, rook 5). Here, in the middlegame, a knight is worth as much as a rook.
- Trading into a knight ending to "simplify" an extra pawn. Knight endings were drawn 46% of the time even with the extra pawn.
- Assuming "the queen always beats two rooks". In the archive the rooks did slightly better (56.1% in 41 games); on open files they are formidable.

### Advanced insight
The engine also has a **drawish-material rule** (method D): when the side ahead has *no pawns* and is ahead by at most a knight's worth of piece material, its whole evaluation is multiplied by 0.25. Without pawns, small material advantages rarely win. You will see this proven exactly for rook against knight in Book IV: in quiet positions with the defender to move, it is a draw 88% of the time.

### Worked example
When to trade queens.

```crown
fen: r2k1r/pp1n1p/2pnq1/2Q1P1/PP4/RN1KNR w - - 1 8
claim: puzzle pz-epqhdh
caption: Academy puzzle pz-epqhdh. White to move. Black's knight on d4 and queen on e4 press against White's king; White's queen is on c3.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ · ♜
5 │ ♟ ♟ · ♞ · ♟
4 │ · · ♟ ♞ ♛ ·
3 │ · · ♕ · ♙ ·
2 │ ♙ ♙ · · · ·
1 │ ♖ ♘ · ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-epqhdh. White to move. Black's knight on d4 and queen on e4 press against White's king; White's queen is on c3.*
<!-- /diagram -->

White's king is the more exposed one. The solution trades the attacker off: `8. Qxd4! Qxd4+ 9. exd4`. **Engine judgement (depth 10):** +36 for White after the exchange; the "greedy" `8. exd4` is −228, because after `8...Nxc3+` Black keeps queen against knight. **Guidance:** trade queens when your king is the one in danger; keep them when theirs is.

### Guided exercise
You are a pawn up with a rook and pawns each. You can trade rooks into a pawn ending, or keep them. Using the table, which choice has the better winning chances, and by how much?

*Answer:* the pawn ending: the side with more pawns won 77.4% of pawn endings versus 62.2% of rook endings in the archive. But check the pawn ending concretely first — Book IV teaches the key squares that tell you, with certainty, whether it wins.

### Independent exercises
1. According to the method C experiment, how many pawns is a knight worth in the opening phase?
2. Black to move. Find the only move that holds.

```crown
fen: r2knr/p1pnpp/2P3/Pq4/2NQPP/R2KNR b - - 0 8
claim: puzzle pz-1ieweog
caption: Exercise 2 (Academy puzzle pz-1ieweog). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ♜
5 │ ♟ · ♟ ♞ ♟ ♟
4 │ · · ♙ · · ·
3 │ ♙ ♛ · · · ·
2 │ · · ♘ ♕ ♙ ♙
1 │ ♖ · · ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (Academy puzzle pz-1ieweog). Black to move.*
<!-- /diagram -->

3. White to move. Find the sequence that wins material by trading queens.

```crown
fen: 4kr/p1Q2p/2nrpP/Pq2N1/4P1/R1K2R w - - 1 16
claim: puzzle pz-1pw6dp5
caption: Exercise 3 (Academy puzzle pz-1pw6dp5). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ♜
5 │ ♟ · ♕ · · ♟
4 │ · · ♞ ♜ ♟ ♙
3 │ ♙ ♛ · · ♘ ·
2 │ · · · · ♙ ·
1 │ ♖ · ♔ · · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (Academy puzzle pz-1pw6dp5). White to move.*
<!-- /diagram -->

4. You are a pawn up in a knight ending with pawns on both wings. Your opponent offers to trade knights. Should you accept? Use the archive.

### Answers with explanations
1. About three: knight vs three pawns came out at −36 cp (roughly level), knight vs two pawns at +102.
2. `8...Qxc4`. White's pawn on c4 attacks Black's knight on d5. Black's queen on b3 removes that pawn, saving the knight and winning a pawn. The tempting `8...Qxc2+` gives the queen for a knight (`9. Qxc2`, or `9. Kxc2`), −842. **Engine judgement (depth 10):** +109 for Black.
3. `16. Qxd4 Qxe3+ 17. Qxe3 Nxe3`. White's queen takes the rook on d4; Black's queen takes the knight on e3 with check; the queens come off. White has won a rook for a knight. **Engine judgement (depth 10):** +30 overall (Black's knight and pawns give some compensation), against −288 for the next best.
4. Yes — if the resulting pawn ending wins. A knight ending with an extra pawn won only 49.0% in the archive, a pawn ending 77.4%. But a pawn ending is either won or not; calculate it (Book IV, key squares) before you agree.

### Summary
- Engine prices: knight 441 / 262, rook 407 / 463: equal in the middlegame, rook far ahead in the endgame.
- Queen ≈ rook + knight + pawn; queen vs two rooks is roughly balanced; knight ≈ three pawns; rook vs knight ≈ one pawn.
- With an extra pawn, pawn endings win most (77%), knight endings least (49%).

### Next lesson
Knowing values is not knowing what to do. Chapter III.8: planning and prophylaxis.

---

## Chapter III.8 — The Long Spell: Planning and Prophylaxis

### Learning objectives
- Build a plan from the position: threats, structure, worst piece, target.
- Practise prophylaxis: asking "what does my opponent want?" before choosing.
- Understand why the engine often sees several plans as nearly equal, and how to choose.

### Prerequisites
Chapters III.1–III.7.

### Explanation
A plan answers four questions, in this order:

1. **What is threatened?** Your first duty is to see the opponent's threat. With 12.9 moves per position and many loose pieces, threats are everywhere.
2. **What does the structure ask for?** Open files for rooks, passed pawns to push or stop, a weak square to occupy.
3. **Which is my worst piece?** Improve it.
4. **Where is the target?** A weak pawn, the exposed king, a loose piece.

**Prophylaxis** is question 1 turned into a habit: before every move, ask what the opponent would play if it were their move again. A prophylactic move stops that idea *and* improves your position.

**Engine judgement.** The engine is not a planner in words; it searches. But when its top choices are equal, each corresponds to a different plan, and you may choose by understanding. When one quiet move is far ahead of all others, that move is usually prophylaxis: it meets a threat you might not have noticed.

### Illustrated example

```crown
fen: r2k1r/1p2pp/p1n3/2P3/PP3P/R1NK1R w - - 0 1
caption: A planning position. Rooks and a knight each, four pawns each. Black's knight on c4 attacks b2. White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ · ♜
5 │ · ♟ · · ♟ ♟
4 │ ♟ · ♞ · · ·
3 │ · · ♙ · · ·
2 │ ♙ ♙ · · · ♙
1 │ ♖ · ♘ ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*A planning position. Rooks and a knight each, four pawns each. Black's knight on c4 attacks b2. White to move.*
<!-- /diagram -->

### Step-by-step reasoning
1. **The threat.** Black's knight on c4 attacks the b2-pawn, and from b2 a knight attacks d1: `...Nxb2+` would win a pawn with check. That must be met.
2. **The structure.** The d-file is fully open. Black's e5-pawn controls d4; if it advances to e4, d4 becomes a fine square for a White knight.
3. **Worst piece.** White's knight on c1 and king on d1 (blocking the rooks).
4. **Candidate plans (Engine judgement, method B, depth 12, every move scored):**

| Move | Score | Plan |
|---|---|---|
| `Nd3` | +31 | defend b2 with the knight, which also eyes c5, e5, b4, f4 |
| `Kc2` | +31 | defend b2 with the king, connect the rooks |
| `Rb1` | −14 | defend b2 with a rook (passive) |
| `Ke2` | −73 | allows `...Nxb2` |
| `b3` | −93 | "kick the knight": after `...axb3 Nxb3` White's a2-, c3- and f2-pawns are all isolated |

Two plans are equal, and both do two jobs at once: they meet the threat **and** improve a piece. The tempting `b3`, which "gains a tempo" on the knight, is the worst of the natural moves.

```crown
fen: r2k1r/1p2pp/p1n3/2P3/PP3P/R1NK1R w - - 0 1
line: Kc2 e4 Ne2 Kc5 Rfe1
show: after
caption: The king plan (engine line at depth 12): 1. Kc2 e4 2. Ne2 Kc5 3. Rfe1. White's king guards b2 and connects the rooks; after ...e4 the d4-square is free of Black pawn control and the knight heads there.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · · · ♜
5 │ · ♟ ♚ · · ♟
4 │ ♟ · ♞ · ♟ ·
3 │ · · ♙ · · ·
2 │ ♙ ♙ ♔ · ♘ ♙
1 │ ♖ · · · ♖ ·
  └─────────────
    a b c d e f    Black to move
```
*The king plan (engine line at depth 12): 1. Kc2 e4 2. Ne2 Kc5 3. Rfe1. White's king guards b2 and connects the rooks; after ...e4 the d4-square is free of Black pawn control and the knight heads there.*
<!-- /diagram -->

At depth 15 the engine switches to `Nd3`; both plans are within a few centipawns. That is a lesson in itself: in balanced positions, good plans are plural.

### Common mistakes
- Choosing a plan before checking the opponent's threat.
- "Gaining a tempo" by attacking a piece that simply steps to a better square (`b3?` above).
- Making a plan with your best piece instead of your worst one.

### Advanced insight
Every pawn move is a plan you cannot take back. In the diagram, Black's `...e4` gains space but hands White the d4-square forever. Before you push a pawn, name the square it stops guarding.

### Worked example
Prophylaxis in its purest form: a quiet rook move that the engine prefers by more than four pawns.

```crown
fen: rn1k1r/pq2pp/1p1p1n/P5/1PPNPP/RNQK1R w - - 1 8
claim: puzzle pz-qcmiyc
caption: Academy puzzle pz-qcmiyc. White to move. Black's queen on b5 and knight on f4 look at e2.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ♜
5 │ ♟ ♛ · · ♟ ♟
4 │ · ♟ · ♟ · ♞
3 │ ♙ · · · · ·
2 │ · ♙ ♙ ♘ ♙ ♙
1 │ ♖ ♘ ♕ ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-qcmiyc. White to move. Black's queen on b5 and knight on f4 look at e2.*
<!-- /diagram -->

What does Black want? `...Qxe2+` (the queen reaches e2 along the b5–e2 diagonal, supported by the f4-knight). White's answer is `8. Re1!`, defending e2 with the rook. **Engine judgement (depth 10):** −24 for White after `8. Re1`; the active-looking `8. Ne4+` is −445 and `8. c3` is −822. One quiet move, found by asking "what does my opponent want?"

### Guided exercise
Black to move. White's pieces are aimed at Black's king. Find the quiet move that holds.

```crown
fen: r4r/1p2kp/pP2qn/N1Pp2/1P1P2/R1QKR1 b - - 4 11
claim: puzzle pz-1hgyd7o
caption: Guided exercise (Academy puzzle pz-1hgyd7o). Black to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · · · ♜
5 │ · ♟ · · ♚ ♟
4 │ ♟ ♙ · · ♛ ♞
3 │ ♘ · ♙ ♟ · ·
2 │ · ♙ · ♙ · ·
1 │ ♖ · ♕ ♔ ♖ ·
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise (Academy puzzle pz-1hgyd7o). Black to move.*
<!-- /diagram -->

*Hint:* White threatens `Rxe4+`, winning the queen for a rook. *Answer:* `11...Ne2`. The knight jumps from f4 to e2, blocking the e-file between White's rook and Black's queen. On e2 it is protected by the d3-pawn and the queen, and it attacks White's queen on c1. **Engine judgement (depth 10):** +11 for Black; every rook move scores −310 or worse.

### Independent exercises
1. State the four planning questions in order.
2. White to move. Black threatens to win material. Find the only move that holds.

```crown
fen: 1n2n1/q1p1kr/1pQp1p/3PpP/PKN1P1/R3R1 w - - 3 18
claim: puzzle pz-1uj8f9i
caption: Exercise 2 (Academy puzzle pz-1uj8f9i). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♞ · · ♞ ·
5 │ ♛ · ♟ · ♚ ♜
4 │ · ♟ ♕ ♟ · ♟
3 │ · · · ♙ ♟ ♙
2 │ ♙ ♔ ♘ · ♙ ·
1 │ ♖ · · · ♖ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-1uj8f9i). White to move.*
<!-- /diagram -->

3. White to move. Find the queen move that meets Black's threats.

```crown
fen: rn1k1r/1qpp1p/3np1/pP1PP1/PQPN1P/R2K1R w - - 0 8
claim: puzzle pz-elm8pn
caption: Exercise 3 (Academy puzzle pz-elm8pn). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ♜
5 │ · ♛ ♟ ♟ · ♟
4 │ · · · ♞ ♟ ·
3 │ ♟ ♙ · ♙ ♙ ·
2 │ ♙ ♕ ♙ ♘ · ♙
1 │ ♖ · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (Academy puzzle pz-elm8pn). White to move.*
<!-- /diagram -->

4. In the planning position, why is `1. b3` worse than `1. Kc2`, even though `b3` attacks a piece?

### Answers with explanations
1. What is threatened? What does the structure ask for? Which is my worst piece? Where is the target?
2. `18. Qb3`. White's queen on c4 is attacked by Black's knight on b6. Most queen moves lose something; `18. Qb3` keeps the queen next to the king on b2 and the knight on c2. The rook moves ignore the threat and lose the queen to `18...Nxc4+`. **Engine judgement (depth 10):** −10; the rook moves −420 or worse.
3. `8. Qc3`. Black's knight on d4 and pawn on e4, with the queen on b5, all aim at d3 and c2. `8. Qc3` attacks the d4-knight and defends d3 along the third rank. **Engine judgement (depth 10):** +36; `8. Qb1` −198, `8. Qc1` −258.
4. `1. b3` is answered by `1...axb3 2. Nxb3`, which leaves White with three isolated pawns (a2, c3, f2) against one; `1. Kc2` meets the real threat (`...Nxb2+`) and also connects the rooks. Engine (depth 12): +31 against −93.

### Summary
- Plans start from threats (prophylaxis), then structure, worst piece and target.
- When the engine shows several equal moves, they are several equal plans; choose the one you understand.
- When one quiet move is far ahead, it is usually prophylaxis.

### Next lesson
Having an advantage is half the work. Chapter III.9: converting it, and knowing whether the position calls for tactics or for patience.

---

## Chapter III.9 — Turning Gold into Crowns: Conversion, Tactics and Patience

### Learning objectives
- Know, from measured evidence, how often a material advantage wins.
- Convert by simplifying into endings whose outcome is certain.
- Distinguish positions that call for calculation from those that call for slow improvement.

### Prerequisites
Chapters III.1–III.8.

### Explanation
**Evidence (method A, balanced games).** At the first quiet moment from ply 40 onward (no capture or pawn move in the previous two plies, side to move not in check), material was counted (pawn 1, knight 3, rook 5, queen 9). How did the side ahead fare?

| Material lead | Games | Win | Draw | Loss |
|---|---|---|---|---|
| Level (White's result) | 1,323 | 24.9% | 54.5% | 20.6% |
| +1 | 1,501 | 48.0% | 39.6% | 12.3% |
| +2 | 1,003 | 68.3% | 23.9% | 7.8% |
| +3 or +4 | 852 | 83.1% | 11.6% | 5.3% |
| +5 or more | 615 | 93.0% | 5.9% | 1.1% |

A single extra pawn wins less than half the time even between engines. Conversion is a skill, not a formality.

**Three rules of conversion (Guidance, built on the evidence above and in III.7):**
1. **Trade pieces, not pawns.** Pawns are what you will crown; and with no pawns the engine's own rule multiplies a small material lead by 0.25.
2. **Aim for the ending that wins most.** With an extra pawn, pawn endings won 77.4% of the time, knight endings 49.0%.
3. **Prefer certainty to brilliance.** If a simplification leads to a position you *know* is won, take it, even if a sharper line wins faster.

**Tactics or patience?** Look at the position's forcing moves: checks, captures, threats. If they exist and lead somewhere, calculate (Book IV). If they do not, improve your worst piece. On this board the share of forcing moves is high — 21.4% of moves played by engines were captures and 14.1% gave check (method A) — so the tactical check is never optional.

### Illustrated example

```crown
fen: 3kr1/6/3K2/3P2/6/4R1 w - - 0 1
line: Rxe6+ Kxe6
show: after
caption: A conversion choice. White traded rooks with 1. Rxe6+ Kxe6, reaching a king-and-pawn ending that is won with certainty: proven by exhaustive enumeration (mate in 9 more moves with best play).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · · ·
4 │ · · · ♔ · ·
3 │ · · · ♙ · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*A conversion choice. White traded rooks with 1. Rxe6+ Kxe6, reaching a king-and-pawn ending that is won with certainty: proven by exhaustive enumeration (mate in 9 more moves with best play).*
<!-- /diagram -->

### Step-by-step reasoning
1. **Before the trade.** White has rook and pawn against rook. **Engine judgement (depth 12):** both `1. Ra1` (+1389, threatening `Ra6+` and a skewer) and `1. Rxe6+` (+1060) win.
2. **After the trade.** White's king on d4 stands directly in front of its pawn on d3, on one of the pawn's *key squares* (Book IV). **Evidence (exhaustive enumeration):** every legal king-and-pawn position was solved by retrograde analysis over `src/rules` for this book, and this one is a forced win: White mates in 9 moves.
3. **The choice.** `Ra1` is stronger in the engine's eyes, but it requires seeing a skewer; `Rxe6+` turns the game into an ending whose result is known. For a human converting under a clock, the second is the safer road.

### Common mistakes
- Trading pawns when ahead: every pawn trade brings you closer to a pawnless ending, which rarely wins.
- Rushing a winning position into complications.
- Playing "slow" moves in a position where the opponent has forcing moves.

### Advanced insight
The engine's evaluation does not "know" which endings are won; it estimates. A strategist who knows the exact facts of simple endings (Book IV) can convert more reliably than an engine's estimate suggests. This is one of the few places where knowledge beats calculation.

### Worked example
Tactics first, even in an ending.

```crown
fen: 6/1kq3/np1p2/1R1P2/2PKpr/1Q2R1 b - - 1 22
claim: puzzle pz-15sshpo
caption: Academy puzzle pz-15sshpo. Black to move. Black is under pressure, but White's pieces on b3, b1 and e1 are loosely placed.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♚ ♛ · · ·
4 │ ♞ ♟ · ♟ · ·
3 │ · ♖ · ♙ · ·
2 │ · · ♙ ♔ ♟ ♜
1 │ · ♕ · · ♖ ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-15sshpo. Black to move. Black is under pressure, but White's pieces on b3, b1 and e1 are loosely placed.*
<!-- /diagram -->

Look first at the second rank: Black's pawn on e2 has almost crowned, defended by the rook on f2, and White's king (d2) and rook (e1) blockade it. Black plays `22...Nc3!`. The knight, protected by the b4- and d4-pawns, attacks White's queen on b1 and also covers d1 and e2's neighbourhood. White cannot save the queen and keep the blockade together. **Engine judgement (depth 10):** +467 for Black; the "patient" `22...Kc6` only +76.

### Guided exercise
In the conversion example, after `1. Rxe6+ Kxe6`, it is White's move. Which king moves keep the win, and which throw it away?

*Answer:* **Evidence (exhaustive enumeration):** `2. Kc5` wins fastest (mate in 9), `2. Kc4` and `2. Ke4` also win (mate in 11), but `2. Kc3` and `2. Ke3` — stepping back beside the pawn — only draw. The principle: keep the king *in front of* the pawn, on its key squares (Book IV).

### Independent exercises
1. In the archive, how often did a one-pawn lead at move 20 or later win? A lead of a minor piece (+3)?
2. White to move. A conversion with tactics: find the only move that holds.

```crown
fen: r2knr/1qpnpp/p5/Pp1NPP/1PQP2/RN2KR w - - 0 9
claim: puzzle pz-1elydfs
caption: Exercise 2 (Academy puzzle pz-1elydfs). White to move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ♜
5 │ · ♛ ♟ ♞ ♟ ♟
4 │ ♟ · · · · ·
3 │ ♙ ♟ · ♘ ♙ ♙
2 │ · ♙ ♕ ♙ · ·
1 │ ♖ ♘ · · ♔ ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (Academy puzzle pz-1elydfs). White to move.*
<!-- /diagram -->

3. You are a pawn up. You can trade either your rook or your knight for the opponent's equivalent piece. With the archive's numbers in mind, which ending do you prefer to reach: rook ending or knight ending?
4. Why does the engine multiply some evaluations by 0.25?

### Answers with explanations
1. A one-pawn lead won 48.0% (drew 39.6%); a lead of 3–4 points won 83.1%.
2. `9. Nc3`. Black's pawn on b3 attacks White's queen on c2. Instead of moving the queen, White counterattacks: the b1-knight jumps to c3 and attacks Black's queen on b5 (and the d5-knight). If `9...bxc2`, then `10. Nxb5+` takes the queen with check. **Engine judgement (depth 10):** +60 (the engine's Black answer is `9...Qc4`); `9. f4` is −219.
3. The rook ending: the side with more pawns won 62.2% of rook endings and 49.0% of knight endings.
4. When the side ahead has no pawns and leads by at most a knight's worth of piece material, it rarely can force a win; the engine scales its score down so that it does not overvalue such leads.

### Summary
- One extra pawn wins about half the time; three points about 83% of the time (balanced engine games).
- Trade pieces, not pawns; head for pawn endings when a pawn up; take certainty over brilliance.
- Always check the forcing moves first: on this board they are frequent.

### Next lesson
The Strategist's work is done. **Book IV — The Master** teaches the precision that strategy rests on: calculation, defence and the exact truths of the endgame.
