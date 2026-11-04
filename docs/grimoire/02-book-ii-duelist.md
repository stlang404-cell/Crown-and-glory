# Book II — The Duelist

*Being the second book of THE SOVEREIGN'S GRIMOIRE: FROM APPRENTICE TO CHESS SOVEREIGN, for players of Crown & Calculation (rules `crown-la6-v1`).*

An Apprentice knows how the pieces move. A Duelist knows what they *threaten*. This book is a school of tactics: short, forcing sequences that win material or the game. Every motif is taught on the 6 × 6 board, and every chapter asks the same question: **how does the small board change this weapon?**

**About the boards.** Every diagram is a `crown` block checked by `tools/grimoire/check.ts` against the real rules in `src/rules`. A caption that says "mate in N" was proven by trying every defence. A board marked `puzzle pz-…` is a verified Academy puzzle (`src/academy/data/puzzles.json`, policy `crown-puzzle-verify-2`): its solution is the Academy engine's clear best move and every defence in its line is the engine's best or near-best reply. A caption that says "the engine's choice" means the move passed the same puzzle policy (`claim: best`). Engine judgements are strong evidence, **not proofs**; the text says which is which, and marks advice as **Guidance**.

**The Duelist's three questions.** Before every move, ask in this order:
1. **Checks** — which checks do I have, and which does my opponent have?
2. **Captures** — what can be taken, and is it defended?
3. **Threats** — what does each move threaten next?

The final chapter turns these questions into a method of calculation.

---

## Chapter 1 — Double Attacks and Forks

### Learning objectives
- Recognise a **double attack**: one move that creates two threats at once.
- Spot knight, queen, pawn and king forks.
- Use the knight's colour rule to see which pieces can be forked.

### Prerequisites
Book I, especially Chapters 3 (the knight) and 4 (piece safety).

### Explanation
A **fork** is a move by one piece that attacks two (or more) enemy targets at once. The opponent can usually save only one. The strongest forks include a **check**, because the defender must answer the check first and then loses the second target.

**How the small board changes it.** On 6 × 6 the pieces start only two ranks apart, and every square is near the action, so forks appear from the first moves. Three facts matter:
1. **Knights change colour every move**, so a knight only ever attacks squares of one colour. Two targets on opposite colours can never be forked by one knight. White's king (d1, light) and queen (c1, dark) begin on *different* colours: no knight can fork them in the starting position. But the squares **e3** and **b3** (for Black's knights) and **e4** and **b4** (for White's) are deadly: a knight on e3 hits c2, d1 and f1; a knight on b3 hits a1, c1 and d2.
2. In the starting position those fork squares are guarded by two pawns each (e3 by d2 and f2; b3 by a2 and c2). **Guidance:** be careful about letting both guards disappear.
3. The queen reaches more than half the board from the centre (Book I, Chapter 2), so **queen forks** with check are everywhere.

### Illustrated example

```crown
fen: 3k1r/rp1np1/p2P1p/P1R2P/1P1NPq/2KR2 w - - 0 17
claim: puzzle pz-11z7k92
caption: Academy puzzle pz-11z7k92. White to move. One knight jump attacks three pieces.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ♜
5 │ ♜ ♟ · ♞ ♟ ·
4 │ ♟ · · ♙ · ♟
3 │ ♙ · ♖ · · ♙
2 │ · ♙ · ♘ ♙ ♛
1 │ · · ♔ ♖ · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-11z7k92. White to move. One knight jump attacks three pieces.*
<!-- /diagram -->

`Ne4+!` The knight lands on e4 and attacks d6 (the king), f6 (a rook) and f2 (the queen). Nothing Black owns can capture on e4. Black must move the king, and then White collects the queen on f2.

### Step-by-step reasoning
How do you *find* a fork? Use a checklist:
1. **List loose and valuable targets**: the king, the queen, undefended pieces. Here: king d6, rook f6, queen f2.
2. **Ask which squares attack two of them.** For a knight, check the squares a knight's jump away from each target and look for overlap. d6, f6 and f2 are all dark squares, so a knight on a light square can hit them together; e4 hits all three.
3. **Can my piece reach that square, and is it safe there?** The d2-knight reaches e4 in one jump, and no Black piece attacks e4.
4. **Is the first threat forcing?** `Ne4+` is check, so Black has no time to save both the rook and the queen.

Here is the colour rule at work in an opening-like position. Black's knight jumps to e3, a light square, and hits three light squares at once:

```crown
fen: 2qk2/pppnpp/6/6/PPQ1P1/R2K1R b - - 0 1
line: Ne3+
claim: best Ne3+
caption: The engine's choice. With White's d- and f-pawns gone, e3 is unguarded: Ne3+ forks the king on d1, the queen on c2 and the rook on f1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♛ ♚ · ·
5 │ ♟ ♟ ♟ ♞ ♟ ♟
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ ♕ · ♙ ·
1 │ ♖ · · ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*The engine's choice. With White's d- and f-pawns gone, e3 is unguarded: Ne3+ forks the king on d1, the queen on c2 and the rook on f1.*
<!-- /diagram -->

### Common beginner mistakes
- Looking only at captures and missing quiet squares from which a knight attacks two pieces.
- Forgetting that a fork only works if the forking piece cannot simply be captured.
- Defending one forked piece and forgetting the check comes first.
- Trying to fork two pieces of different colours with one knight.

### Advanced insight
On this board a knight that reaches the third rank from the enemy's side (e3/b3 for Black, e4/b4 for White) is often a fork in waiting. A queen fork works best with check, because a queen that attacks two pieces without check can simply be met by a counter-attack on the queen. **Guidance:** when your king and queen stand on the same rank or diagonal with one square between them, look for enemy queen checks that also hit the second piece.

### Worked example

```crown
fen: 3k2/3p1r/1p3P/1n4/2Q1K1/r4R b - - 2 28
claim: puzzle pz-6vlr5l
caption: Academy puzzle pz-6vlr5l. Black to move. The knight on b3 is attacked by the queen.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · ♟ · ♜
4 │ · ♟ · · · ♙
3 │ · ♞ · · · ·
2 │ · · ♕ · ♔ ·
1 │ ♜ · · · · ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-6vlr5l. Black to move. The knight on b3 is attacked by the queen.*
<!-- /diagram -->

*Solution.* Black's knight on b3 is under attack by the queen on c2, so it must do something. The best "something" is `Nd4+`: from d4 it checks the king on e2 and attacks the queen on c2. The check must be answered (`Kd2`, `Kd3`, `Ke3` or `Kf2`), and then `...Nxc2` wins the queen for the knight. Notice the pattern: **when a piece is attacked, look for a move that saves it *with* a threat.**

### Guided exercise

```crown
fen: 4k1/1r3p/6/P1QPq1/2K1P1/6 w - - 0 32
claim: puzzle pz-12a8lx9
caption: Academy puzzle pz-12a8lx9. White to move and win material with a queen fork.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · ♜ · · · ♟
4 │ · · · · · ·
3 │ ♙ · ♕ ♙ ♛ ·
2 │ · · ♔ · ♙ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-12a8lx9. White to move and win material with a queen fork.*
<!-- /diagram -->

*Hint:* Find a queen move that checks the king on e6 and attacks the rook on b5.

### Independent exercises

```crown
fen: 4n1/N3k1/P3p1/K3Pp/3r1P/6 w - - 0 25
claim: puzzle pz-1tc3h8s
caption: Exercise 1 (pz-1tc3h8s). White to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♞ ·
5 │ ♘ · · · ♚ ·
4 │ ♙ · · · ♟ ·
3 │ ♔ · · · ♙ ♟
2 │ · · · ♜ · ♙
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (pz-1tc3h8s). White to move and win material.*
<!-- /diagram -->

```crown
fen: 2qk1r/2nn1p/rp1P2/P1pp2/Q1P2P/RNK1NR b - - 0 11
claim: puzzle pz-vdu64q
caption: Exercise 2 (pz-vdu64q). Black to move. Even a pawn can fork.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♛ ♚ · ♜
5 │ · · ♞ ♞ · ♟
4 │ ♜ ♟ · ♙ · ·
3 │ ♙ · ♟ ♟ · ·
2 │ ♕ · ♙ · · ♙
1 │ ♖ ♘ ♔ · ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (pz-vdu64q). Black to move. Even a pawn can fork.*
<!-- /diagram -->

```crown
fen: 2Q3/4k1/3ppp/N2n2/P1KPq1/R2R2 b - - 0 21
claim: puzzle pz-5popuw
caption: Exercise 3 (pz-5popuw). Black to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♕ · · ·
5 │ · · · · ♚ ·
4 │ · · · ♟ ♟ ♟
3 │ ♘ · · ♞ · ·
2 │ ♙ · ♔ ♙ ♛ ·
1 │ ♖ · · ♖ · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (pz-5popuw). Black to move and win material.*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-12a8lx9):** `Qc6+`. The queen checks along the 6th rank (d6 is empty) and attacks the rook on b5 along the diagonal. Black's only legal reply is `Ke5`, and `Qxb5+` wins the rook with check.
- **1 (pz-1tc3h8s):** `Nc4+`. The a5-knight jumps to c4, checking the king on e5 and attacking the rook on d2. No Black piece can capture on c4. After the king moves (the Academy line is `Kd5`), `Nxd2` wins the rook.
- **2 (pz-vdu64q):** `d2+`. The d3-pawn steps to d2 and attacks both c1 (the king) and e1 (a knight). The pawn is protected by the c3-pawn, so the king cannot take it. A White knight can capture it (`Nxd2`), but then `cxd2+` forks king and knight again, and Black has won material. **Pawn forks are cheap**: the forking piece is worth the least.
- **3 (pz-5popuw):** `Nb4+`. The knight on d3 jumps to b4, checking the king on c2 and attacking the queen on c6. Nothing White owns attacks b4. After `Kb2` (the Academy line), `Nxc6` wins the queen.

### Summary
A fork is one move, two threats. Look for squares that attack two targets of the **same colour** (for knights), make the first threat a check when possible, and make sure the forking piece is safe. On 6 × 6, the fork squares e3/b3 and e4/b4 are always worth a look.

### Next lesson
Chapter 2: the pin, a piece that cannot move because something more valuable stands behind it.

---

## Chapter 2 — Pins

### Learning objectives
- Recognise **absolute pins** (against the king: the pinned piece may not move off the line) and **relative pins** (against a valuable piece: moving is legal but costly).
- Exploit a pin by **attacking the pinned piece again**.
- Avoid walking into pins on the open d-file.

### Prerequisites
Chapter 1; Book I, Chapter 5 (check).

### Explanation
A **pin** happens when a rook or queen attacks an enemy piece that cannot move without exposing a more valuable piece behind it on the same line.
- If the piece behind is the **king**, the pin is **absolute**: moving the pinned piece off the line is illegal. It may still move *along* the line, and it may capture the pinning piece if that is along the line.
- If the piece behind is a queen or rook, the pin is **relative**: the pinned piece may move, but the piece behind will be lost.

A pinned piece is a poor defender and an easy target: attack it with something cheaper (often a pawn), and it cannot run away.

**How the small board changes it.** There are no bishops in Crown & Calculation, so every pin is made by a **rook or queen**, along a rank, a file, or (queen only) a diagonal. The kings start on the **d-file**, facing each other across it, and cannot castle away. The d-file and the back ranks are therefore the natural pinning lines. **Guidance:** once the d-pawns are exchanged, any piece standing on the d-file between your king and an enemy rook or queen is a pin waiting to happen.

### Illustrated example

```crown
fen: 3k2/p2n1p/6/2P3/6/3R1K w - - 0 1
line: c4
claim: best c4
caption: The engine's choice. The knight on d5 is pinned to the king on d6 by the rook on d1. c3-c4 attacks it with a pawn.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ ♟ · · ♞ · ♟
4 │ · · · · · ·
3 │ · · ♙ · · ·
2 │ · · · · · ·
1 │ · · · ♖ · ♔
  └─────────────
    a b c d e f    White to move
```
*The engine's choice. The knight on d5 is pinned to the king on d6 by the rook on d1. c3-c4 attacks it with a pawn.*
<!-- /diagram -->

### Step-by-step reasoning
1. **Find the line.** Rook d1, then d2, d3, d4 empty, then Black's knight on d5, then Black's king on d6. The knight is pinned absolutely.
2. **What can the pinned piece still do?** It may not leave the d-file. It cannot even capture the pawn on c3, which it attacks, because `Nxc3` would expose the king.
3. **Attack it again.** `c4` attacks d5 with a pawn. The knight cannot move away, and the king defends it only once.
4. **Count.** After `cxd5`, White wins a knight for a pawn. Black can unpin by moving the king off the d-file, but that does not save the knight: it is still attacked by the c4-pawn.

### Common beginner mistakes
- Moving a pinned piece "to safety" and losing the king's protection (or making an illegal move).
- Thinking a pinned piece defends the squares it attacks. An absolutely pinned piece cannot capture off the line, so it defends nothing there.
- Forgetting that the pinned piece can sometimes capture **the pinning piece itself**, if it moves along the line.
- Lining up king and queen on the same open file.

### Advanced insight
Pins and forks combine. A pin freezes one defender; a fork then hits two targets that the frozen piece was supposed to cover. And because there are no bishops, **diagonal pins can only come from a queen**: if the enemy queen is gone, your pieces on diagonals are pin-proof. **Guidance:** in the opening, move the king off the d-file or keep a pawn on d2/d5 until the danger is past.

### Worked example

```crown
fen: 1k2r1/p4p/Ppr3/6/4NP/R3KR b - - 0 19
claim: puzzle pz-1tnry0q
caption: Academy puzzle pz-1tnry0q. Black to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ · · ♜ ·
5 │ ♟ · · · · ♟
4 │ ♙ ♟ ♜ · · ·
3 │ · · · · · ·
2 │ · · · · ♘ ♙
1 │ ♖ · · · ♔ ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-1tnry0q. Black to move and win material.*
<!-- /diagram -->

*Solution.* The White knight on e2 stands between Black's rook on e6 and White's king on e1: it is **absolutely pinned** along the e-file (e5, e4 and e3 are empty). It is defended only by the king. Black plays `Rc2!`: the second rook swings to c2 and attacks the knight along the 2nd rank (d2 is empty). Now the knight is attacked twice and defended once, and it cannot move. White cannot add a second defender in time, so Black wins the knight.

### Guided exercise

```crown
fen: 3k2/1p3p/3q2/6/4KP/R5 w - - 0 1
line: Rd1
claim: best Rd1
caption: Guided exercise. White to move. The engine's choice wins the queen. Find it.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · ♟ · · · ♟
4 │ · · · ♛ · ·
3 │ · · · · · ·
2 │ · · · · ♔ ♙
1 │ ♖ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise. White to move. The engine's choice wins the queen. Find it.*
<!-- /diagram -->

*Hint:* Black's king and queen stand on the same file. Which White piece can reach that file, defended?

### Independent exercises

```crown
fen: 2r2r/p2k1p/p2ppQ/P2q2/1P1N1P/1R1K1R b - - 1 14
claim: puzzle pz-rs9hk9
caption: Exercise 1 (pz-rs9hk9). Black to move and win material. Look for a pinned White piece.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♜ · · ♜
5 │ ♟ · · ♚ · ♟
4 │ ♟ · · ♟ ♟ ♕
3 │ ♙ · · ♛ · ·
2 │ · ♙ · ♘ · ♙
1 │ · ♖ · ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 1 (pz-rs9hk9). Black to move and win material. Look for a pinned White piece.*
<!-- /diagram -->

```crown
fen: 5r/Nknn1p/1p3P/3RP1/2P1K1/6 w - - 0 24
claim: puzzle pz-1djzh9p
caption: Exercise 2 (pz-1djzh9p). White to move. A capture that also creates a pin.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♜
5 │ ♘ ♚ ♞ ♞ · ♟
4 │ · ♟ · · · ♙
3 │ · · · ♖ ♙ ·
2 │ · · ♙ · ♔ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (pz-1djzh9p). White to move. A capture that also creates a pin.*
<!-- /diagram -->

```crown
fen: 3k2/p2n1p/6/2P3/6/3R1K w - - 0 1
line: c4 Kc5
show: after
caption: Exercise 3. After 1. c4 Black tries 1...Kc5, attacking the pawn and unpinning the knight. What should White play, and why does the knight still fall?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ ♟ · ♚ ♞ · ♟
4 │ · · ♙ · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · ♖ · ♔
  └─────────────
    a b c d e f    White to move
```
*Exercise 3. After 1. c4 Black tries 1...Kc5, attacking the pawn and unpinning the knight. What should White play, and why does the knight still fall?*
<!-- /diagram -->

### Answers with explanations
- **Guided:** `Rd1!` The rook pins the queen on d4 to the king on d6 (d5 is empty). The rook is defended by White's king on e2, so if the queen takes it, `Qxd1+ Kxd1` gives White a rook for a queen; if not, White plays `Rxd4` next. The queen may not leave the d-file (that would expose the king), and every square it can reach on the file (d5, d3, d2) is still attacked by the rook or the king.
- **1 (pz-rs9hk9):** `Rc2`. White's knight on d2 is pinned to the king on d1 by Black's queen on d3. `Rc2` attacks it a second time along the rank. The rook on c2 cannot be captured by the king because the queen on d3 defends it. The knight, attacked twice, defended once and unable to move, is lost.
- **2 (pz-1djzh9p):** `Rxd5`. The rook on d3 was attacked by Black's knight on c5; it takes the other knight on d5, which nothing defended. Now the knight on c5 is **pinned** to the king on b5 along the 5th rank, and Black must spend time unpinning while White consolidates. White has won a knight.
- **3:** `cxd5`. Moving the king unpinned the knight, but the knight is still attacked by the c4-pawn and Black has spent the move on the king. The pawn takes the knight, and the new pawn on d5 is defended by the rook on d1, so the king cannot take it. White has won a knight for nothing.

### Summary
A pinned piece is frozen. Pile up on it, preferably with a pawn. Pins come only from rooks and queens here, and the d-file, where the kings start, is the most dangerous line on the board.

### Next lesson
Chapter 3: the skewer, which is a pin turned inside out.

---

## Chapter 3 — Skewers

### Learning objectives
- Recognise a **skewer**: an attack on a valuable piece that, when it moves, exposes a piece behind it on the same line.
- Use checks along ranks, files and diagonals to skewer king and rook or king and queen.

### Prerequisites
Chapter 2.

### Explanation
In a pin, the *less* valuable piece is in front. In a **skewer**, the *more* valuable piece is in front: usually the king, in check. When it steps off the line, the piece behind it is captured.

**How the small board changes it.** The board is only six squares wide, so a rook or queen on any rank or file covers the whole line, and kings in the endgame often share a rank or file with their own rooks. The back ranks (1 and 6) are short highways: a check along the back rank frequently skewers the king and a rook standing at the other end. And with no bishops, **only a queen can skewer along a diagonal.**

### Illustrated example

```crown
fen: 6/2knN1/3p2/1P1P1P/r5/2K2R b - - 2 23
claim: puzzle pz-qn6wq1
caption: Academy puzzle pz-qn6wq1. Black to move. King and rook share the 1st rank.
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
*Academy puzzle pz-qn6wq1. Black to move. King and rook share the 1st rank.*
<!-- /diagram -->

`Ra1+!` The rook checks the king on c1 along the 1st rank, and behind the king stands the rook on f1 (d1 and e1 are empty). The king must step off the rank (its legal moves are `Kb2`, `Kc2` and `Kd2`), and then `...Rxf1` wins the rook. After `Kb2` the king attacks the Black rook on a1, but Black moves first and the rook escapes by capturing.

### Step-by-step reasoning
1. **Find two enemy pieces on one line** with the more valuable in front: king c1 and rook f1 on the 1st rank.
2. **Find a square on that line from which your piece checks the front piece**: a1 (b1 is empty between).
3. **Check that your piece is safe**, or that it does not matter: after `Ra1+` the king cannot capture at once.
4. **Check that nothing can block.** A White piece would have to land on b1; none can.

### Common beginner mistakes
- Giving the "skewer" check when the piece behind is defended. Then you only trade.
- Forgetting that the king can sometimes step *towards* your checking piece and attack it.
- Missing that the opponent may block the check with a piece, which can turn the skewer into a pin.

### Advanced insight
Because the board is short, a rook skewer from one corner to the other is common in endgames. **Guidance:** in rook endgames, keep your king off the rank or file where your own rook stands, unless the rook is defended.

### Worked example

```crown
fen: 1Q4/6/6/1Kp1p1/4k1/2r3 b - - 0 61
claim: puzzle pz-1jx5lpm
caption: Academy puzzle pz-1jx5lpm. Black to move. Black has only a rook and two pawns against a queen.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♕ · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · ♔ ♟ · ♟ ·
2 │ · · · · ♚ ·
1 │ · · ♜ · · ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-1jx5lpm. Black to move. Black has only a rook and two pawns against a queen.*
<!-- /diagram -->

*Solution.* White's king on b3 and queen on b6 share the b-file (b4 and b5 are empty). `Rb1+` checks along the file. All six king moves (`Kxc3`, `Kc4`, `Ka4`, `Ka3`, `Ka2`, `Kc2`) leave the b-file, and then `...Rxb6` wins the queen. The Academy line is `1...Rb1+ 2. Kxc3 Rxb6`, after which Black's pawns decide.

### Guided exercise

```crown
fen: 4q1/Q4p/2k3/6/6/5K w - - 0 1
line: Qa2+
claim: best Qa2+
caption: Guided exercise. White to move. The engine's choice is a diagonal skewer. Only a queen can do this here.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♛ ·
5 │ ♕ · · · · ♟
4 │ · · ♚ · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Guided exercise. White to move. The engine's choice is a diagonal skewer. Only a queen can do this here.*
<!-- /diagram -->

*Hint:* Look at the diagonal a2–b3–c4–d5–e6.

### Independent exercises

```crown
fen: r2kn1/5q/1pP1R1/6/2P1K1/RN3r w - - 0 16
claim: puzzle pz-rgmywv
caption: Exercise 1 (pz-rgmywv). White to move. Two checks in a row.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ·
5 │ · · · · · ♛
4 │ · ♟ ♙ · ♖ ·
3 │ · · · · · ·
2 │ · · ♙ · ♔ ·
1 │ ♖ ♘ · · · ♜
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (pz-rgmywv). White to move. Two checks in a row.*
<!-- /diagram -->

```crown
fen: 6/2k3/3p2/2n1pP/r1R1P1/2K2R b - - 2 24
claim: puzzle pz-w6ajb8
caption: Exercise 2 (pz-w6ajb8). Black to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · ♚ · · ·
4 │ · · · ♟ · ·
3 │ · · ♞ · ♟ ♙
2 │ ♜ · ♖ · ♙ ·
1 │ · · ♔ · · ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (pz-w6ajb8). Black to move and win material.*
<!-- /diagram -->

```crown
fen: R5/6/4k1/6/K5/4q1 w - - 0 1
claim: best Re6+
caption: Exercise 3. White to move. The engine's choice wins the queen.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♖ · · · · ·
5 │ · · · · · ·
4 │ · · · · ♚ ·
3 │ · · · · · ·
2 │ ♔ · · · · ·
1 │ · · · · ♛ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3. White to move. The engine's choice wins the queen.*
<!-- /diagram -->

### Answers with explanations
- **Guided:** `Qa2+`. The queen checks the king on c4 along the diagonal; behind the king, on the same diagonal, stands the Black queen on e6. The king must step off the diagonal (d5 is still on it), and `Qxe6` follows. Black cannot block on b3, because its queen's path to b3 runs through its own king.
- **1 (pz-rgmywv):** `Rxa6+`. The a1-rook takes the rook on a6 with check along the 6th rank. Black's only legal move is `Kc5`. Then `Ra5+` checks along the 5th rank, and behind the king stands the Black queen on f5. The king must leave the rank, and the queen falls.
- **2 (pz-w6ajb8):** `Ra1+`. The same pattern as the illustrated example: the check along the 1st rank skewers the king on c1 and the rook on f1. After `Kb2 Rxf1` the Academy line continues `Rxc3+ dxc3+`: White wins back a knight, but Black's pawn recaptures with check and Black has won two rooks for a knight.
- **3:** `Re6+`. The rook checks along the e-file (e5 is empty), and the Black queen stands behind the king on e1. Every king move leaves the e-file, the queen cannot interpose on e5 (its path is blocked by its own king), and `Rxe1` wins the queen.

### Summary
A skewer attacks the front piece and wins the one behind it. Look for an enemy king that shares a line with an undefended rook or queen. On 6 × 6, the back ranks and the d-file are the usual skewer lines, and only queens skewer diagonally.

### Next lesson
Chapter 4: discovered attacks, where the piece that moves is not the piece that attacks.

---

## Chapter 4 — Discovered Attacks and Discovered Check

### Learning objectives
- Recognise a **discovered attack**: moving one piece uncovers an attack by another piece behind it.
- Use **discovered check**, where the uncovered attack is on the king, to win material with the moving piece.

### Prerequisites
Chapters 1–3.

### Explanation
A rook or queen can stand behind one of your own pieces, aimed at an enemy target. When the front piece moves, the line opens and the back piece attacks. If the front piece *also* makes a threat, there are two threats at once, and the opponent can usually meet only one. When the uncovered attack is a check, it is a **discovered check**, and the moving piece is free to capture anything it likes.

**How the small board changes it.** Lines are short and crowded: a rook on the 1st rank sees the whole rank as soon as one knight jumps off it. In the starting position the rooks on a1 and f1 look along the back rank through the knights on b1 and e1. **Every knight move off the back rank opens a rook line.** On 6 × 6, the "front piece" is very often a knight, and its jump is likely to land with check or on a fork square at the same time.

### Illustrated example

```crown
fen: 6/1kPp1r/6/1K3p/5P/rN3R w - - 0 20
claim: puzzle pz-ephpsb
caption: Academy puzzle pz-ephpsb. White to move. The knight on b1 blocks White's own rook.
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
*Academy puzzle pz-ephpsb. White to move. The knight on b1 blocks White's own rook.*
<!-- /diagram -->

`Nc3+!` The knight leaves b1 with check (c3 attacks b5), and at the same moment the rook on f1 sees all the way down the 1st rank to the Black rook on a1. Black must deal with the check (`Kxc5`, `Kc6`, `Ka6` or `Ka5`), and then `Rxa1` wins the rook.

### Step-by-step reasoning
1. **Look for your long-range pieces aimed at enemy pieces through your own pieces.** Rook f1, then e1, d1, c1 empty, then White's own knight b1, then Black's rook a1.
2. **Ask where the front piece can go with a threat of its own.** The knight's best square is c3: it gives check.
3. **Count the threats.** One check plus one attack on an undefended rook. Black can answer only the check.

### Common beginner mistakes
- Not noticing your own discovered attacks because the back piece "isn't doing anything" yet.
- Forgetting the opponent's discovered attacks: a piece standing in front of an enemy rook is a loaded spring.
- Moving the front piece to a square where it is simply captured, when a check was available.

### Advanced insight
A discovered check is the strongest tactic in this book: the moving piece may go anywhere, even capture a defended queen, because the opponent must answer the check. **Guidance:** when the enemy king and your rook or queen share a line with one of your own pieces between them, stop and examine every move of that piece.

### Worked example

```crown
fen: rn1k2/p1Nq2/3p2/QP3r/2PP1P/R2K2 w - - 1 13
claim: puzzle pz-10qk93h
caption: Academy puzzle pz-10qk93h. White to move. The knight on c5 is attacked by the queen on d5.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ·
5 │ ♟ · ♘ ♛ · ·
4 │ · · · ♟ · ·
3 │ ♕ ♙ · · · ♜
2 │ · · ♙ ♙ · ♙
1 │ ♖ · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-10qk93h. White to move. The knight on c5 is attacked by the queen on d5.*
<!-- /diagram -->

*Solution.* White's queen on a3 aims along the diagonal a3–b4–c5–d6 at Black's king, but White's own knight on c5 is in the way. The knight is attacked, so it must move anyway, and it moves with a capture: `Nxa6+`. It takes the rook on a6 and uncovers **discovered check** from the queen. Black must answer the check (`Qc5` to block, or a king move), and White has won a rook.

### Guided exercise

```crown
fen: r1qk1r/1ppn1p/p2p2/N2PpN/PPP1KP/R1Q2R b - - 0 8
claim: puzzle pz-p05pjm
caption: Academy puzzle pz-p05pjm. Black to move. The knight on d5 blocks Black's queen.
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
*Academy puzzle pz-p05pjm. Black to move. The knight on d5 blocks Black's queen.*
<!-- /diagram -->

*Hint:* Draw the diagonal from Black's queen on c6 through d5 and e4. What is at the end of it? Then find a knight move that gives check.

### Independent exercises

```crown
fen: 3k2/6/1q4/3N2/6/3R1K w - - 0 1
claim: best Nxb4+
caption: Exercise 1. White to move. The engine's choice is a discovered check.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · ♛ · · · ·
3 │ · · · ♘ · ·
2 │ · · · · · ·
1 │ · · · ♖ · ♔
  └─────────────
    a b c d e f    White to move
```
*Exercise 1. White to move. The engine's choice is a discovered check.*
<!-- /diagram -->

```crown
fen: r1q1kr/pn1ppp/R5/2PP2/1PNN1P/2QK1R b - - 0 9
claim: puzzle pz-1gfzv5k
caption: Exercise 2 (pz-1gfzv5k). Black to move. Find the only move that holds.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♛ · ♚ ♜
5 │ ♟ ♞ · ♟ ♟ ♟
4 │ ♖ · · · · ·
3 │ · · ♙ ♙ · ·
2 │ · ♙ ♘ ♘ · ♙
1 │ · · ♕ ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (pz-1gfzv5k). Black to move. Find the only move that holds.*
<!-- /diagram -->

```crown
fen: 6/1QPq1p/3p1k/1p1P2/5P/5K w - - 1 22
claim: puzzle pz-1tmu932
caption: Exercise 3 (pz-1tmu932). White to move. A pawn is the front piece.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♕ ♙ ♛ · ♟
4 │ · · · ♟ · ♚
3 │ · ♟ · ♙ · ·
2 │ · · · · · ♙
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (pz-1tmu932). White to move. A pawn is the front piece.*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-p05pjm):** `Nf4+`. The knight leaves d5 with check (f4 attacks e2), uncovering the queen's diagonal c6–d5–e4–f3 onto the White knight on f3. White's only legal replies are `Kd1` and `Ke1`, neither of which guards f3, so `...Qxf3` wins the knight.
- **1:** `Nxb4+`. The knight on d3 captures the queen on b4, and the rook on d1 gives discovered check up the open d-file. Black has no time to recapture the knight.
- **2 (pz-1gfzv5k):** `Nxc3+`. Black's knight takes on c3 with check (c3 attacks d1) and uncovers the queen's diagonal c6–b5–a4 onto the White rook on a4, which the knight on c3 also attacks. After `bxc3`, `...Qxa4` wins the rook.
- **3 (pz-1tmu932):** `c6=Q`. The pawn promotes and, by moving, uncovers the queen on b5's attack along the 5th rank on the Black queen on d5; the new queen on c6 attacks d5 as well. Black's best is `Qxb5`, and `Qxb5` recaptures: White has turned a pawn into a queen.

### Summary
Look behind your own pieces: a rook or queen aimed through them is a hidden weapon. Move the front piece with a threat of its own, ideally a check, and the opponent cannot meet both threats.

### Next lesson
Chapter 5: removing the defender and overloading, the arts of attacking what *protects* a piece.

---

## Chapter 5 — Removing the Defender and Overloading

### Learning objectives
- Win a defended piece by first **removing its defender**: capturing it, driving it away, or blocking its line.
- Recognise an **overloaded** piece: one defender with two jobs.

### Prerequisites
Book I, Chapter 4 (counting attackers and defenders); Chapters 1–4 of this book.

### Explanation
A defended piece is not safe for ever. Ask: *who defends it?* If you can eliminate or distract that defender, the piece becomes hanging.
- **Removing the defender**: capture it (often trading something), chase it with a check, or cut its line.
- **Overloading**: a single piece defends two things. Force it to do one job, and the other collapses.

**How the small board changes it.** Pieces stand close together, so one piece very often defends two or three neighbours at once, and the king is frequently one of the defenders. Kings are easy to chase with checks on 6 × 6, because they have few squares. **Guidance:** when a piece is defended only by its king, look for a check that drives the king away.

### Illustrated example

```crown
fen: 2rk2/5p/p4n/P1N3/RPr2P/3K1R b - - 6 17
claim: puzzle pz-19qx3hv
caption: Academy puzzle pz-19qx3hv. Black to move. The rook on a2 is defended by the knight on c3.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♜ ♚ · ·
5 │ · · · · · ♟
4 │ ♟ · · · · ♞
3 │ ♙ · ♘ · · ·
2 │ ♖ ♙ ♜ · · ♙
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-19qx3hv. Black to move. The rook on a2 is defended by the knight on c3.*
<!-- /diagram -->

`R6xc3!` Black gives a rook for the knight that guards a2. After `bxc3` the recapture opens the 2nd rank, and `...Rxa2` takes the undefended rook. Black has won a knight. (`R6xc3` means "the rook on the 6th rank takes on c3"; both Black rooks could capture there.)

### Step-by-step reasoning
1. **Pick a target**: the White rook on a2.
2. **List its defenders**: only the knight on c3 (c3 attacks a2).
3. **Attack the defender**: the c3-knight is attacked twice (rooks c6 and c2) and defended once (pawn b2).
4. **Remove it**: `R6xc3 bxc3`. Now a2 is undefended, and the b2-pawn has moved out of the c2-rook's way.
5. **Collect**: `...Rxa2`. Count: Black gave a rook (5) and won a knight and a rook.

### Overloading
Here one Black rook has two jobs.

```crown
fen: 1r2k1/3ppp/6/6/1n2PP/1RR1K1 w - - 0 1
line: Rxb2
claim: best Rxb2
caption: The engine's choice. The rook on b6 defends the knight on b2 and also guards the 6th rank against a back-rank mate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♜ · · ♚ ·
5 │ · · · ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · ♞ · · ♙ ♙
1 │ · ♖ ♖ · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*The engine's choice. The rook on b6 defends the knight on b2 and also guards the 6th rank against a back-rank mate.*
<!-- /diagram -->

```crown
fen: 1r2k1/3ppp/6/6/1n2PP/1RR1K1 w - - 0 1
line: Rxb2 Rxb2 Rc6#
claim: checkmate
show: after
caption: If Black recaptures, the 6th rank is unguarded and Rc6 is mate: the king on e6 is walled in by its own pawns.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♖ · ♚ ·
5 │ · · · ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · ♜ · · ♙ ♙
1 │ · · · · ♔ ·
  └─────────────
    a b c d e f    Black to move
```
*If Black recaptures, the 6th rank is unguarded and Rc6 is mate: the king on e6 is walled in by its own pawns.*
<!-- /diagram -->

The Black rook cannot both recapture on b2 and guard c6. Black's best is not to recapture, and White has simply won a knight.

### Common beginner mistakes
- Attacking a defended piece again and again without asking who defends it.
- Forgetting that the defender can be **driven away with check**: kings are defenders too.
- Missing your *own* overloaded pieces: if one piece defends two things, the opponent will find it.

### Advanced insight
Removing the defender often costs material first (an exchange sacrifice, or a check that gives up a pawn). Count to the end of the sequence, not the first move. **Guidance:** in the middlegame on 6 × 6, the most common overloaded piece is a rook on the back rank that must also defend something on its file.

### Worked example

```crown
fen: 1n1knQ/5R/1q4/1p4/4K1/6 w - - 0 16
claim: puzzle pz-e6r29g
caption: Academy puzzle pz-e6r29g. White to move. The knight on e6 is defended only by the king.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♞ · ♚ ♞ ♕
5 │ · · · · · ♖
4 │ · ♛ · · · ·
3 │ · ♟ · · · ·
2 │ · · · · ♔ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-e6r29g. White to move. The knight on e6 is defended only by the king.*
<!-- /diagram -->

*Solution.* `Qxe6+?` at once fails to `Kxe6`. First drive the defender away: `Qe5+!` The queen checks from e5. The king's only legal move is `Kc6`: c5 and d5 are covered by the queen, the queen itself is protected by the rook on f5, and e6 holds Black's own knight. Now the knight on e6 has lost its only defender, and `Qxe6+` wins it with check along the 6th rank.

### Guided exercise

```crown
fen: 3k2/6/3p2/2p1P1/r5/2R2K w - - 0 27
line: exd4
claim: best exd4
caption: Guided exercise. White to move. The engine's choice wins the c3-pawn safely. Why not 1. Rxc3 at once?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · ♟ · ·
3 │ · · ♟ · ♙ ·
2 │ ♜ · · · · ·
1 │ · · ♖ · · ♔
  └─────────────
    a b c d e f    White to move
```
*Guided exercise. White to move. The engine's choice wins the c3-pawn safely. Why not 1. Rxc3 at once?*
<!-- /diagram -->

*Hint:* Who defends the pawn on c3?

### Independent exercises

```crown
fen: 1k1rr1/pp2N1/6/6/PPP3/1K2R1 b - - 0 1
claim: best Rxe5
caption: Exercise 1. Black to move. The engine's choice exploits an overloaded White rook.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ · ♜ ♜ ·
5 │ ♟ ♟ · · ♘ ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ ♙ · · ·
1 │ · ♔ · · ♖ ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 1. Black to move. The engine's choice exploits an overloaded White rook.*
<!-- /diagram -->

```crown
fen: r2knr/2qp1p/p5/N3QP/PP1K2/R3R1 w - - 1 14
claim: puzzle pz-40ozeh
caption: Exercise 2 (pz-40ozeh). White to move. The knight on e6 is defended by the king. Chase the defender.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ♜
5 │ · · ♛ ♟ · ♟
4 │ ♟ · · · · ·
3 │ ♘ · · · ♕ ♙
2 │ ♙ ♙ · ♔ · ·
1 │ ♖ · · · ♖ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (pz-40ozeh). White to move. The knight on e6 is defended by the king. Chase the defender.*
<!-- /diagram -->

```crown
fen: 2rkn1/q5/1r4/2Q2p/1P1N1P/3KR1 w - - 0 15
claim: puzzle pz-11cihvv
caption: Exercise 3 (pz-11cihvv). White to move. White's queen is attacked by the rook on c6. Find the only move that holds.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♜ ♚ ♞ ·
5 │ ♛ · · · · ·
4 │ · ♜ · · · ·
3 │ · · ♕ · · ♟
2 │ · ♙ · ♘ · ♙
1 │ · · · ♔ ♖ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (pz-11cihvv). White to move. White's queen is attacked by the rook on c6. Find the only move that holds.*
<!-- /diagram -->

### Answers with explanations
- **Guided:** `1. Rxc3?` loses the rook to `1...dxc3`: the d4-pawn defends c3. So first remove the defender: `1. exd4!` takes the defending pawn itself, and next move `Rxc3` wins the c-pawn as well. The engine's main line is `1. exd4 Kd5 2. Rxc3 Kxd4`, with a level rook ending instead of a lost one.
- **1:** `Rxe5`. The White rook on e1 defends both the knight on e5 (up the e-file) and the 1st rank. If `Rxe5`, then `Rd1#`: the king on b1 is walled in by its own a2-, b2- and c2-pawns. So Black simply wins the knight.

```crown
fen: 1k1rr1/pp2N1/6/6/PPP3/1K2R1 b - - 0 1
line: Rxe5 Rxe5 Rd1#
claim: checkmate
show: after
caption: Exercise 1, the punishment if White recaptures.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ · · · ·
5 │ ♟ ♟ · · ♖ ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ ♙ · · ·
1 │ · ♔ · ♜ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1, the punishment if White recaptures.*
<!-- /diagram -->

- **2 (pz-40ozeh):** `Qe5+`. The same pattern as the worked example: the queen checks from e5, Black's only legal move is `Kc6`, and the knight on e6 has lost the king as a defender. `Qxe6+` follows with check. (The knight is still defended by the f6-rook, but after `...Rxe6 Rxe6+` White's rook recaptures with check; the engine finds a forced win in every line, which is an engine judgement, not a proof.)
- **3 (pz-11cihvv):** `Rxe6+`. White gives the rook for the knight on e6 with check. The Academy line is `1...Kxe6`, and now the rook on c6 has lost its defender (the king was guarding it from d6), so `2. Qxc6+` wins it back with check along the 6th rank. White has saved the queen and kept the material balance.

### Summary
Every defended piece has a defender. Capture it, chase it (often with check), or overload it, and the piece falls. Count the whole sequence.

### Next lesson
Chapter 6: deflection and decoy, forcing a piece to a square of *your* choosing.

---

## Chapter 6 — Deflection and Decoy

### Learning objectives
- **Deflect** a defender away from a key square or line.
- **Decoy** (lure) an enemy piece, often the king or queen, *onto* a square where it can be attacked.
- Recognise the sacrifice that sets up a fork.

### Prerequisites
Chapters 1 and 5.

### Explanation
- **Deflection** forces a piece to leave the square or line it guards. It is a cousin of removing the defender: the defender is not captured but dragged away.
- **Decoy** forces an enemy piece to *come to* a particular square, usually by offering a piece there. The decoyed piece then falls to a fork, a pin, a skewer or a mate.

Both usually begin with a sacrifice: you offer material that the opponent must, or wants to, take.

**How the small board changes it.** Forks are so common on 6 × 6 that the most frequent decoy is simply **"lure two pieces onto one knight fork."** Kings and queens start on adjacent squares and often stay close to each other; a sacrifice that drags one of them one square sideways can put both on the same knight's colour.

### Illustrated example

```crown
fen: 2qkr1/2pn2/3p1n/Np1P1P/1P1Q1R/2K1N1 b - - 0 14
claim: puzzle pz-uyo7nn
caption: Academy puzzle pz-uyo7nn. Black to move. A knight on d3 would attack the king on c1, but the White queen on d2 is not on one of its squares.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♛ ♚ ♜ ·
5 │ · · ♟ ♞ · ·
4 │ · · · ♟ · ♞
3 │ ♘ ♟ · ♙ · ♙
2 │ · ♙ · ♕ · ♖
1 │ · · ♔ · ♘ ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-uyo7nn. Black to move. A knight on d3 would attack the king on c1, but the White queen on d2 is not on one of its squares.*
<!-- /diagram -->

`Rxe1+!` The rook takes the knight on e1 with check. White must answer with `Qxe1` (the Academy line) or block with `Qd1` (then Black simply takes again). After `Qxe1` the queen has been **decoyed** to e1, and `...Nxd3+` forks the king on c1 and the queen on e1 (the knight on d3 also attacks the rook on f2). The d3-knight cannot be captured, and Black wins the queen.

### Step-by-step reasoning
1. **See the fork square.** A knight on d3 attacks c1, e1, b2, f2, b4, f4, c5 and e5. The White king is on c1. What else could stand on e1?
2. **Find a forcing way to put a valuable piece there.** `Rxe1+` captures on e1 *with check*. The natural recapture brings the queen to e1.
3. **Check the fork is safe.** After `Qxe1 Nxd3+`, no White piece attacks d3.
4. **Count.** Black gave a rook for a knight, then the knight captures the d3-pawn with a fork and wins the queen. A large profit.

### Common beginner mistakes
- Playing the sacrifice without checking that the follow-up really works against *every* reply.
- Forgetting that the opponent may decline the sacrifice.
- Using deflection on a piece that has a second defender behind it.

### Advanced insight
A decoy works best when the sacrifice is a **check** or a **capture**, because the reply is then nearly forced. **Guidance:** when you see "the fork would work if only their king (or queen) were one square over", look for a check or capture on that square.

### Worked example

```crown
fen: rn3R/4k1/p5/6/1PKN2/6 w - - 2 25
claim: puzzle pz-1ng565a
caption: Academy puzzle pz-1ng565a. White to move. Rook and knight against rook and knight.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · · · ♖
5 │ · · · · ♚ ·
4 │ ♟ · · · · ·
3 │ · · · · · ·
2 │ · ♙ ♔ ♘ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-1ng565a. White to move. Rook and knight against rook and knight.*
<!-- /diagram -->

*Solution.* `Rxb6!` White's rook takes the knight on b6; it is defended by the rook on a6, so `Rxb6` recaptures (the Academy line). The Black rook has been **decoyed** to b6, a knight's jump from c4. Now `Nc4+` checks the king on e5 and attacks the rook on b6. Whatever the king does, `Nxb6` follows, and White is a knight up.

### Guided exercise

```crown
fen: r5/1N2k1/pP1qp1/P3np/Q1P2P/R3K1 b - - 0 21
claim: puzzle pz-m2gpo4
caption: Academy puzzle pz-m2gpo4. Black to move. Which White piece guards the rook on a1?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · · · ·
5 │ · ♘ · · ♚ ·
4 │ ♟ ♙ · ♛ ♟ ·
3 │ ♙ · · · ♞ ♟
2 │ ♕ · ♙ · · ♙
1 │ ♖ · · · ♔ ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-m2gpo4. Black to move. Which White piece guards the rook on a1?*
<!-- /diagram -->

*Hint:* The rook on a1 is attacked by Black's queen along the diagonal d4–c3–b2–a1. Deflect its defender.

### Independent exercises

```crown
fen: r2kn1/p5/3qR1/2N2p/1r1N1P/R2K2 w - - 0 17
claim: puzzle pz-1f5g8cf
caption: Exercise 1 (pz-1f5g8cf). White to move. Start with a capture, then look for a knight fork.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ·
5 │ ♟ · · · · ·
4 │ · · · ♛ ♖ ·
3 │ · · ♘ · · ♟
2 │ · ♜ · ♘ · ♙
1 │ ♖ · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (pz-1f5g8cf). White to move. Start with a capture, then look for a knight fork.*
<!-- /diagram -->

```crown
fen: rnq3/p3k1/2Prp1/PP1n2/2NN2/R2K1R w - - 0 14
claim: puzzle pz-mmr0yt
caption: Exercise 2 (pz-mmr0yt, difficulty 4). White to move. Find the only move that holds. Lure the king.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ · · ·
5 │ ♟ · · · ♚ ·
4 │ · · ♙ ♜ ♟ ·
3 │ ♙ ♙ · ♞ · ·
2 │ · · ♘ ♘ · ·
1 │ ♖ · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (pz-mmr0yt, difficulty 4). White to move. Find the only move that holds. Lure the king.*
<!-- /diagram -->

```crown
fen: 2qk2/pppnpp/6/6/PPQ1P1/R2K1R b - - 0 1
line: Ne3+ Kd2 Nxc2
show: after
caption: Exercise 3. Review the fork from Chapter 1: after Ne3+ Kd2 Nxc2, what has the check achieved that a plain attack on the queen would not?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♛ ♚ · ·
5 │ ♟ ♟ ♟ · ♟ ♟
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ ♞ ♔ ♙ ·
1 │ ♖ · · · · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 3. Review the fork from Chapter 1: after Ne3+ Kd2 Nxc2, what has the check achieved that a plain attack on the queen would not?*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-m2gpo4):** `Nxc2+`. The White queen on a2 defends the rook on a1. The knight takes the c2-pawn with check (c2 attacks e1) and also attacks the rook. If `Qxc2`, the queen has been **deflected** from the a-file, and `...Qxa1+` wins the rook with check. (If instead `Kf1`, the knight takes on a1 itself.)
- **1 (pz-1f5g8cf):** `Rxd4+`. The rook takes the queen on d4 with check (rook for queen is already good). Black's best is `Nxd4` (the Academy line). Now the d2-knight jumps with a fork: `Nc4+` attacks the king on d6 and the rook on b2, and nothing can capture on c4. After `Kc5`, `Nxb2` wins the rook.
- **2 (pz-mmr0yt):** `Rf5+!` The rook offers itself on f5, next to the king. The Academy line is `1...Kxf5`, and the king has been **decoyed** to f5: now `2. Nxd4+` takes the rook on d4 with check and also attacks the queen on c6. After `2...Kf4 3. Nxc6`, White has won rook and queen for a rook.
- **3:** Because `Ne3+` is check, White had no time to move the queen. A plain attack on the queen (without check) would let White simply move it away. The check forces the king to move first, so the second threat (`Nxc2`) is carried out.

### Summary
Deflection drags a defender away; decoy drags a target in. Both usually start with a sacrifice that is a check or capture, and both most often end, on this board, in a knight fork.

### Next lesson
Chapter 7: trapped pieces, which are lost not because they are attacked twice but because they have nowhere to go.

---

## Chapter 7 — Trapped Pieces

### Learning objectives
- Recognise a **trapped piece**: a piece that is attacked (or soon will be) and has no safe square to go to.
- Trap enemy pieces that stray to the edge or into your camp.
- Keep your own pieces out of cages.

### Prerequisites
Book I, Chapters 3 (knight reach) and 4 (safety); Chapters 1 and 2 of this book.

### Explanation
A piece is **trapped** when every square it can move to is attacked (or occupied by its own side), so that once it is attacked it cannot escape. A trapped piece is often lost even though it is attacked only once. The winning move is frequently **quiet**: no check, no capture, just a move that takes away the last square or adds the attack.

**How the small board changes it.** On 6 × 6 the edges are close and crowded.
- A knight in a corner has only **2** moves, on an edge square next to the corner **3**, against 8 in the centre (Book I, Chapter 3). A knight that captures a rook in the corner (a1, f1, a6, f6) is very often trapped there.
- The rooks begin in the corners behind a wall of pawns and knights, with nowhere to run if a pawn arrives next to them.
- Pawns are always close to promotion, so a pawn that attacks a trapped piece may also threaten to queen.

### Illustrated example

```crown
fen: 5k/4pp/6/4P1/P1PK1P/n5 w - - 0 1
line: Kc1 Ke6 Kb1 Kd5 Kxa1
show: after
caption: The Black knight has captured on a1 and is trapped there. Its two squares are b3 (attacked by the a2- and c2-pawns) and c2 (a pawn defended by White's king). White's king simply walks over and takes it.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♚ ♟ ♟
4 │ · · · · · ·
3 │ · · · · ♙ ·
2 │ ♙ · ♙ · · ♙
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*The Black knight has captured on a1 and is trapped there. Its two squares are b3 (attacked by the a2- and c2-pawns) and c2 (a pawn defended by White's king). White's king simply walks over and takes it.*
<!-- /diagram -->

Check the knight's moves one by one. `...Nb3+` is met by `axb3` or `cxb3`; `...Nxc2` is met by `Kxc2`. Either way the knight dies, so Black leaves it, and White's king collects it with `Kc1`, `Kb1` and `Kxa1`. **Guidance:** a trapped piece will usually still be there in a few moves, so there is no hurry. The Academy engine actually prefers to push the a-pawn first in this position, because the knight cannot run and the a-pawn is only four steps from a6.

### Step-by-step reasoning
1. **Find the enemy pieces with few squares.** Corners and edges first, then pieces deep in your camp.
2. **List each of their moves and ask whether the landing square is attacked.** If every move loses the piece, it is trapped.
3. **Add an attacker, or remove the last flight square,** with a quiet move if necessary.
4. **Check the opponent's counterplay** while you collect: a trapped piece can still be sold dearly, for example by capturing a defended pawn with check.

### Common beginner mistakes
- Grabbing a corner rook with a knight without checking how the knight will get out.
- Chasing a trapped piece with checks instead of quietly cutting off its last square.
- Forgetting your own trapped pieces, especially a rook in the corner behind its own pawns.

### Advanced insight
Pins and traps are relatives: an absolutely pinned piece has *no* legal squares off the line, so it is "trapped" in place (Chapter 2). And a piece can be trapped by **pawns alone**: two pawns side by side control four squares in front of them, which on a six-file board is two thirds of a rank. **Guidance:** in the opening, do not send a knight to the edge of the enemy camp unless you have checked its way back.

### Worked example

```crown
fen: 1kr2r/q5/p2P2/PpnQPp/3P1P/R3KR b - - 2 57
claim: puzzle pz-1k2b7wn
caption: Academy puzzle pz-1k2b7wn. Black to move. Black is under pressure; find the only move that holds. Look at White's rook on a1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ ♜ · · ♜
5 │ ♛ · · · · ·
4 │ ♟ · · ♙ · ·
3 │ ♙ ♟ ♞ ♕ ♙ ♟
2 │ · · · ♙ · ♙
1 │ ♖ · · · ♔ ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-1k2b7wn. Black to move. Black is under pressure; find the only move that holds. Look at White's rook on a1.*
<!-- /diagram -->

*Solution.* `1...b2!` The pawn steps from b3 to b2 and attacks the rook on a1 (and threatens to promote on b1). Now list the rook's moves: `Rb1`, `Rc1`, `Rd1` and `Ra2`. Every one of those squares is attacked by the Black knight on c3 (or by the b2-pawn, which also covers c1). The rook is **trapped**, and Black will win it, or promote, next move. The Academy verification marks this as the only move that holds Black's position.

### Guided exercise

```crown
fen: 4R1/p4p/n2P2/5k/1P1P2/2K3 w - - 0 1
line: b3
show: after
caption: Guided exercise. After 1. b3, which squares can the Black knight on a4 go to, and what attacks each of them?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♖ ·
5 │ ♟ · · · · ♟
4 │ ♞ · · ♙ · ·
3 │ · ♙ · · · ♚
2 │ · · · ♙ · ·
1 │ · · ♔ · · ·
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise. After 1. b3, which squares can the Black knight on a4 go to, and what attacks each of them?*
<!-- /diagram -->

*Hint:* The knight on a4 has four moves. Look at White's king, rook and pawns.

### Independent exercises

```crown
fen: n4k/4pp/6/2N3/P2NK1/r5 w - - 0 1
claim: best Nb3
caption: Exercise 1. Black's rook has just captured on a1. White to move: the engine's choice traps and wins it.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♞ · · · · ♚
5 │ · · · · ♟ ♟
4 │ · · · · · ·
3 │ · · ♘ · · ·
2 │ ♙ · · ♘ ♔ ·
1 │ ♜ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1. Black's rook has just captured on a1. White to move: the engine's choice traps and wins it.*
<!-- /diagram -->

```crown
fen: 5k/4pp/6/4P1/P3KP/n5 b - - 0 1
caption: Exercise 2. Compare with the illustrated example: White's c-pawn is missing and the king stands on e2. Is the Black knight on a1 still trapped?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · · ♟ ♟
4 │ · · · · · ·
3 │ · · · · ♙ ·
2 │ ♙ · · · ♔ ♙
1 │ ♞ · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2. Compare with the illustrated example: White's c-pawn is missing and the king stands on e2. Is the Black knight on a1 still trapped?*
<!-- /diagram -->

```crown
fen: rn1k2/p4p/1P4/2N3/4PP/5K w - - 0 1
claim: best b5
caption: Exercise 3. White to move. Black's rook on a6 has no legal move at all. The engine's choice exploits it.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♚ · ·
5 │ ♟ · · · · ♟
4 │ · ♙ · · · ·
3 │ · · ♘ · · ·
2 │ · · · · ♙ ♙
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Exercise 3. White to move. Black's rook on a6 has no legal move at all. The engine's choice exploits it.*
<!-- /diagram -->

### Answers with explanations
- **Guided:** the pawn on b3 attacks the knight. The knight's squares are b2 (covered by White's king on c1), b6 (covered by the rook on e6 along the 6th rank), c3 (covered by the d2-pawn) and c5 (covered by the d4-pawn). Every move loses the knight: it is trapped. **Guidance:** in the diagram before `b3`, the engine's first choice is actually the pawn advance `d5` (two steps from promotion); trapping the knight is a second good plan.

- **1:** `Nb3!` The knight attacks the rook on a1 and covers c1. Now every rook move lands on a covered square: b1 and d1 (the knight on c3), c1 (the knight on b3), e1 and f1 (White's king), and `...Rxa2+` loses the rook to `Nxa2`. The rook is trapped, and White wins it next move.
- **2:** No. `...Nb3` is still covered by the a2-pawn, but c2 is now free and unattacked (White's king on e2 does not reach it), so `...Nc2` escapes towards d4, e3 and e1. **Always check every square**: one missing guard is enough.
- **3:** `b5!` The pawn, protected by the knight on c3, attacks the rook. The rook cannot move at all (a5 holds Black's own pawn and b6 Black's own knight), and even if the knight moves away now, it is too late: `bxa6` follows next move. The engine rates this as winning for White.

### Summary
Count the squares of enemy pieces on the edge and in your camp. If every square is covered, attack the piece, quietly if necessary. Corners are cages on a 6 × 6 board, especially for knights.

### Next lesson
Chapter 8: the zwischenzug, the move that interrupts a sequence everyone expected.

---

## Chapter 8 — The Zwischenzug (the In-Between Move)

### Learning objectives
- Resist the automatic recapture.
- Find an **in-between move** (German *Zwischenzug*), usually a check, a capture or a threat, that improves the position before the expected reply.

### Prerequisites
Chapters 1–6.

### Explanation
In a sequence of exchanges, both players expect the "obvious" next move: you took, so I take back. A **zwischenzug** interrupts that sequence with a more forcing move. The recapture is still there afterwards, but in the meantime you have gained something: a tempo, a better square, or extra material.

The in-between move must be **at least as forcing** as the threat it ignores. A check is ideal, because the opponent must answer it first.

**How the small board changes it.** On 6 × 6 almost every capture is answered by another attack, and kings are close to the action, so in-between checks are everywhere. Equally, the opponent's knight that has just captured is often *still attacking something*, and recapturing blindly lets it do a second job.

### Illustrated example

```crown
fen: rnr3/1k1ppp/pP4/P2P2/4nP/2RKNR w - - 0 12
line: Rxc6
claim: best Rxc6
caption: The engine's choice. Black's knight has just captured on e2. The natural recapture Kxe2? loses a rook. First Rxc6!
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♜ · · ·
5 │ · ♚ · ♟ ♟ ♟
4 │ ♟ ♙ · · · ·
3 │ ♙ · · ♙ · ·
2 │ · · · · ♞ ♙
1 │ · · ♖ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*The engine's choice. Black's knight has just captured on e2. The natural recapture Kxe2? loses a rook. First Rxc6!*
<!-- /diagram -->

The Black knight on e2 attacks the White rook on c1, and Black's rook on c6 attacks it too. If `1. Kxe2?`, then `1...Rxc1` (the c-file is open from c6 to c1), and White has lost a rook. Instead `1. Rxc6!` first exchanges the attacking rook. After `1...Kxc6` (the engine's choice for Black), `2. Kxe2` recaptures the knight, and White has come through the exchanges without losing the rook.

### Step-by-step reasoning
1. **Before recapturing, ask: what does the capturing piece attack now?** The knight on e2 attacks c1 (and c3, d4, f4).
2. **What else is attacking my pieces?** The rook on c6 also hits c1. So c1 is attacked twice and not defended at all.
3. **Is there a forcing move that solves this first?** `Rxc6`: a capture that removes one attacker. The knight on e2 is not going anywhere useful in the meantime.
4. **Then recapture.**

### Common beginner mistakes
- Recapturing automatically.
- Playing an "in-between" move that is not forcing, so the opponent simply saves the piece.
- Forgetting that the opponent can play a zwischenzug too.

### Advanced insight
A zwischenzug is the natural partner of the discovered attack and the fork: the in-between check often lands on a square from which the checking piece *also* attacks something. **Guidance:** whenever you are about to recapture, spend two seconds on every check you have.

### Worked example

```crown
fen: 1k4/3n2/1P2Q1/4P1/6/qN2K1 w - - 0 30
claim: puzzle pz-tef4fw
caption: Academy puzzle pz-tef4fw. White to move. The knight on d5 is undefended. So is White's knight on b1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ · · · ·
5 │ · · · ♞ · ·
4 │ · ♙ · · ♕ ·
3 │ · · · · ♙ ·
2 │ · · · · · ·
1 │ ♛ ♘ · · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-tef4fw. White to move. The knight on d5 is undefended. So is White's knight on b1.*
<!-- /diagram -->

*Solution.* `Qxd5?` wins a knight but takes the queen off the diagonal e4–b1, and `...Qxb1+` wins White's knight back with check. Instead `Qe6+!` first: the queen checks the king on b6 along the 6th rank *and still attacks d5*. After `Kb5` (the Academy line) comes `Qxd5+`, again with check, so Black never gets time for `...Qxb1+`. White then saves the b1-knight and is a piece up.

### Guided exercise

```crown
fen: 2kN1r/2p2p/1r1p1n/4QP/P1PKP1/2R1NR b - - 0 13
claim: best dxe3+
caption: Guided exercise. Black to move. White's knight has just captured on d6. Recapture, or first something better? (The engine's choice.)
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ ♘ · ♜
5 │ · · ♟ · · ♟
4 │ · ♜ · ♟ · ♞
3 │ · · · · ♕ ♙
2 │ ♙ · ♙ ♔ ♙ ·
1 │ · · ♖ · ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise. Black to move. White's knight has just captured on d6. Recapture, or first something better? (The engine's choice.)*
<!-- /diagram -->

*Hint:* Look at every capture Black has, not only the recapture on d6. One of them is a check.

### Independent exercises

```crown
fen: 2rk1r/p3pp/2pq2/N1Q3/P2PPP/3K1R w - - 0 11
claim: best Nb5+
caption: Exercise 1. White to move. Black's queen on d4 attacks White's queen. Do not trade at once (the engine's choice).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♜ ♚ · ♜
5 │ ♟ · · · ♟ ♟
4 │ · · ♟ ♛ · ·
3 │ ♘ · ♕ · · ·
2 │ ♙ · · ♙ ♙ ♙
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 1. White to move. Black's queen on d4 attacks White's queen. Do not trade at once (the engine's choice).*
<!-- /diagram -->

```crown
fen: r1qknr/ppp1pp/2n3/NPp3/P2PPP/R1QKNR w - - 0 4
claim: best bxc4
caption: Exercise 2. White to move. A Black pawn has just captured on c3. Before recapturing, deal with the knight on c4 (the engine's choice).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ · ♟ ♟
4 │ · · ♞ · · ·
3 │ ♘ ♙ ♟ · · ·
2 │ ♙ · · ♙ ♙ ♙
1 │ ♖ · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 2. White to move. A Black pawn has just captured on c3. Before recapturing, deal with the knight on c4 (the engine's choice).*
<!-- /diagram -->

```crown
fen: Qn2k1/5r/1q1p1p/1P3P/4PK/2R3 w - - 0 20
claim: puzzle pz-19zizr9
caption: Exercise 3 (pz-19zizr9). White to move. The knight on b6 is attacked by the queen but defended by Black's queen.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♕ ♞ · · ♚ ·
5 │ · · · · · ♜
4 │ · ♛ · ♟ · ♟
3 │ · ♙ · · · ♙
2 │ · · · · ♙ ♔
1 │ · · ♖ · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (pz-19zizr9). White to move. The knight on b6 is attacked by the queen but defended by Black's queen.*
<!-- /diagram -->

### Answers with explanations
- **Guided:** `1...dxe3+!` The d4-pawn captures White's queen on e3 with check (e3 attacks d2). Only after White recaptures does Black deal with the knight on d6. The engine judges every other move, including the immediate recapture `...Rxd6`, as losing heavily.
- **1:** `Nb5+!` The knight checks the king on d6 and attacks the queen on d4. Black's only replies are king moves (`Kd5`, `Kc5` or `Ke6`), and then `Nxd4` wins the queen for a knight. The "natural" `Qxd4+?` only trades queens after `...exd4`, and the engine prefers Black after that.
- **2:** `bxc4!` The knight on c4 attacks White's knight on a3. If White recaptures on c3 first (`Qxc3`), Black plays `...Nxa3`. So the pawn takes the knight first; after `...bxc4`, `Qxc3` takes the pawn back. The engine rates this as winning for White.
- **3 (pz-19zizr9):** `Rc6+!` The rook arrives with check (Black can answer with `Kd5`, `Ke5` or the block `Qd6`). Now the knight on b6 is attacked twice, by the queen and the rook. After `Kd5` (the Academy line), `Rxb6 Qxb6 Qxb6` wins the knight and then the queen for a rook. Taking at once with `Qxb6?` would simply lose the queen to `...Qxb6`.

### Summary
Before you recapture, look for a check or a stronger capture. The recapture will usually still be there afterwards; the opponent's chance to defend may not.

### Next lesson
Chapter 9: mate threats and sacrifices, where the king itself becomes the target.

---

## Chapter 9 — Mate Threats and Sacrifices

### Learning objectives
- Use a **mate threat** as a forcing move: a move that threatens checkmate next turn.
- Combine a mate threat with an attack on a piece (a double threat).
- Recognise **sacrifices** that force mate, including the smothered mate.

### Prerequisites
Book I, Chapters 6 and 8; Chapters 1–6 of this book.

### Explanation
A **mate threat** is almost as forcing as a check: the opponent must stop the mate, so he has no time for anything else. If your move threatens mate *and* attacks a piece, you usually win the piece.

A **sacrifice** gives up material to force a result: mate, or a larger gain later. The sacrifice is only sound if **every** reply loses. For mating sacrifices on this board the checker below proves it by brute force.

**How the small board changes it.** Kings on 6 × 6 have very few squares. The back rank sits one step behind the pawn line, there is no castling to tuck the king into a corner, and the edge of the board is never more than two squares from the king. So mate threats appear early and often, and pieces crowd around their own king, which makes **smothered mates** (a knight mating a king that is boxed in by its own pieces) much more common than on the big board.

### Illustrated example

```crown
fen: rn1rk1/p5/1q2Pp/1P1p2/1Q1P2/RN1K1R w - - 0 16
claim: puzzle pz-lvixyc
caption: Academy puzzle pz-lvixyc. White to move. The Black king on e6 is short of squares.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ · ♜ ♚ ·
5 │ ♟ · · · · ·
4 │ · ♛ · · ♙ ♟
3 │ · ♙ · ♟ · ·
2 │ · ♕ · ♙ · ·
1 │ ♖ ♘ · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-lvixyc. White to move. The Black king on e6 is short of squares.*
<!-- /diagram -->

`Rxf4!` The rook takes the f4-pawn and opens the f-file towards f6. Now White threatens **two** mates on f6: `Rf6#` and `Qf6#` (the queen on b2 sees f6 along the long diagonal b2–c3–d4–e5–f6). Black must spend the next move stopping both threats. Only a handful of replies do (an exhaustive search finds `...Qd4`, `...Qc3`, `...Rd4`, `...Nd5`, `...Qxe4`, `...Qxb3+` and `...Qxd2+`); every other move allows mate on f6. The Academy engine rates White's position as decisive.

### Step-by-step reasoning: a smothered mate

```crown
fen: k1r3/pp1N2/4N1/4Q1/6/4K1 w - - 0 1
line: Qb6+ Rxb6 Nc5#
claim: only-mate-in-2
caption: White mates in 2, and only the queen sacrifice Qb6+ does it. Proven by trying every defence.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · ♜ · · ·
5 │ ♟ ♟ · ♘ · ·
4 │ · · · · ♘ ·
3 │ · · · · ♕ ·
2 │ · · · · · ·
1 │ · · · · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*White mates in 2, and only the queen sacrifice Qb6+ does it. Proven by trying every defence.*
<!-- /diagram -->

1. **The box.** The Black king on a6 is surrounded by its own pawns on a5 and b5. Its only free square is b6.
2. **The mating square.** A knight on c5 would check a6. Right now `Nc5+?` fails because Black's rook on c6 simply captures it, and in any case the king could step to b6.
3. **The sacrifice.** `Qb6+!` The queen checks from b6, protected by the knight on d5, so the king cannot take it. Black's only legal reply is `...Rxb6`.
4. **The mate.** The rook has left the c-file and now blocks the king's last square. `Nc5#`: the king is smothered by its own pieces.

### Common beginner mistakes
- Making a mate threat that the opponent can parry *with a gain of tempo* (for example by attacking your queen).
- Sacrificing without checking every defence.
- Forgetting your own king: before launching an attack, check the opponent's checks.

### Advanced insight
A move that threatens mate on two squares (like `Rxf4` above, threatening both `Rf6#` and `Qf6#`) is hard to meet, because one defensive move must cover both. **Guidance:** when the enemy king has only one or two free squares, look at every check and every sacrifice that takes those squares away.

### Worked example

```crown
fen: 2r1k1/pq4/6/2nPK1/P1P3/2Q1NR b - - 0 20
claim: puzzle pz-10qaias
caption: Academy puzzle pz-10qaias. Black to move and mate in 3.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♜ · ♚ ·
5 │ ♟ ♛ · · · ·
4 │ · · · · · ·
3 │ · · ♞ ♙ ♔ ·
2 │ ♙ · ♙ · · ·
1 │ · · ♕ · ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-10qaias. Black to move and mate in 3.*
<!-- /diagram -->

*Solution.* `1...Qe5+!` The queen centralises with check on the e-file (e4 is empty). White has three replies:
- `2. Kd2` or `2. Kf2`: `2...Qe2#`. The queen is protected by the knight on c3.
- `2. Kf3 Qe2+ 3. Kf4 Nd5#`: the knight jumps from c3 to d5, checking f4, and every flight square is covered.

```crown
fen: 2r1k1/pq4/6/2nPK1/P1P3/2Q1NR b - - 0 20
line: Qe5+ Kf3 Qe2+ Kf4 Nd5#
claim: mate-in-3
caption: Proof by exhaustive search: Black mates in 3 against every defence (the longest line shown).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♜ · ♚ ·
5 │ ♟ ♛ · · · ·
4 │ · · · · · ·
3 │ · · ♞ ♙ ♔ ·
2 │ ♙ · ♙ · · ·
1 │ · · ♕ · ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Proof by exhaustive search: Black mates in 3 against every defence (the longest line shown).*
<!-- /diagram -->

### Guided exercise

```crown
fen: 1k4/6/1q4/1n4/2n1PP/3R1K b - - 0 1
claim: only-mate-in-2
caption: Guided exercise. Black to move and mate in 2. You have seen this idea before, from the other side of the board.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ · · · ·
5 │ · · · · · ·
4 │ · ♛ · · · ·
3 │ · ♞ · · · ·
2 │ · · ♞ · ♙ ♙
1 │ · · · ♖ · ♔
  └─────────────
    a b c d e f    Black to move
```
*Guided exercise. Black to move and mate in 2. You have seen this idea before, from the other side of the board.*
<!-- /diagram -->

*Hint:* The White king on f1 has one free square, e1. Can you force White to fill it? Then which Black knight can reach d2?

### Independent exercises

```crown
fen: 6/3nkp/p3p1/4P1/2r2P/1R2KR b - - 0 25
claim: puzzle pz-mxl0mu
caption: Exercise 1 (pz-mxl0mu). Black to move. A quiet knight move threatens mate and attacks a rook.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♞ ♚ ♟
4 │ ♟ · · · ♟ ·
3 │ · · · · ♙ ·
2 │ · · ♜ · · ♙
1 │ · ♖ · · ♔ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 1 (pz-mxl0mu). Black to move. A quiet knight move threatens mate and attacks a rook.*
<!-- /diagram -->

```crown
fen: k5/p3q1/P5/1PR2P/5K/6 w - - 0 32
line: Rc6#
claim: only-mate-in-1
caption: Exercise 2 (review of pz-1olai4r). Why does the queen on e5 fail to defend against this rook mate?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ ♟ · · · ♛ ·
4 │ ♙ · · · · ·
3 │ · ♙ ♖ · · ♙
2 │ · · · · · ♔
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (review of pz-1olai4r). Why does the queen on e5 fail to defend against this rook mate?*
<!-- /diagram -->

```crown
fen: 2k3/6/p1KQr1/P5/6/6 w - - 19 61
line: Qxe4+ Kb6 Qd5 Ka6 Qb5#
claim: mate-in-3
caption: Exercise 3. After 1. Qxe4+ Kb6, find a quiet queen move that leaves the king one square, then mate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ · · ·
5 │ · · · · · ·
4 │ ♟ · ♔ ♕ ♜ ·
3 │ ♙ · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3. After 1. Qxe4+ Kb6, find a quiet queen move that leaves the king one square, then mate.*
<!-- /diagram -->

### Answers with explanations
- **Guided:** `1...Qe1+! 2. Rxe1 Nd2#`. This is the smothered mate from the step-by-step section, mirrored. The queen checks from e1, protected by the knight on c2, so White must take with the rook. Now e1, e2 and f2 are all occupied by White's own pieces, and the knight from b3 lands on d2 with check: mate.
- **1 (pz-mxl0mu):** `Nc3!` The knight on c3 attacks the rook on b1 and also covers e2 and d1. Black now threatens `...Re2#`: the rook would check from e2, protected by the knight, with d1 and d2 covered. White has to deal with the mate threat first and loses material. The Academy's verification records a forced mate in 6 for Black; that is an engine finding, not proved here.
- **2:** The queen on e5 cannot reach c6 (to capture) or b6 (to block): neither square is on one of her lines from e5. Mate.
- **3:** `2. Qd5!` The queen covers a5, b5, c5 and c6, so the king on b6 has only one square left. Black's only move is `2...Ka6`, and `3. Qb5#` mates, the queen protected by White's king on c4. (`2. Kb4` also works, followed by `3. Qc6#` or `3. Qe6#`; the checker proves the mate in 3 from the start.)

### Summary
Mate threats are forcing moves. Combine them with attacks on pieces. On a small board kings are easy to box in, so look for sacrifices that take away the last square, and remember the smothered mate.

### Next lesson
Chapter 10: promotion tactics, where a pawn three steps away becomes a queen.

---

## Chapter 10 — Promotion Tactics

### Learning objectives
- Treat a pawn one step from promotion as a piece that threatens to become a queen.
- Use promotion **with check**, promotion **with a fork**, and **connected pawns** that a single piece cannot stop.
- Defend against promotion by blockading and by counter-attack.

### Prerequisites
Book I, Chapter 9; Chapters 1, 4 and 6 of this book.

### Explanation
A pawn one step from the last rank (rank 5 for White, rank 2 for Black) threatens to become a queen next move. That threat is as strong as a threat to win a queen, so it can be used like a check: to gain time, to deflect defenders, or to distract a piece from something else.

**How the small board changes it.** Pawns start only **four steps** from promotion, and after one step they are three steps away; many pawn captures move a pawn both sideways and forwards. In Crown & Calculation promotion is therefore a middlegame weapon, not only an endgame one. The promotion square is often next to the enemy king's starting area, so a new queen frequently arrives **with check**. And because promotion to a **knight** is allowed (but not to a bishop), underpromotion forks are a real resource.

### Illustrated example

```crown
fen: 3k2/4p1/4Pp/1p1K1P/p2P2/5R b - - 1 77
claim: puzzle pz-l1g2cx
caption: Academy puzzle pz-l1g2cx. Black to move. Black has two pawns on the a- and b-files; White has a rook.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · ♟ ·
4 │ · · · · ♙ ♟
3 │ · ♟ · ♔ · ♙
2 │ ♟ · · ♙ · ·
1 │ · · · · · ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-l1g2cx. Black to move. Black has two pawns on the a- and b-files; White has a rook.*
<!-- /diagram -->

`1...b2!` Now both Black pawns stand on the 2nd rank, side by side, each one step from promotion. The rook on f1 cannot stop both: if it attacks one promotion square, the other pawn promotes. After `2. Kc2` (the Academy line; the king attacks b2), `2...a1=Q` makes a queen that also protects the b2-pawn. **Two connected pawns on the rank before promotion beat a rook.**

### Step-by-step reasoning
1. **Count steps, not material.** Black's a2-pawn is one step from a1; after `...b2`, the b-pawn is one step from b1.
2. **List what can stop each pawn.** The rook would like to stand on a1, b1 or c1. But the pawns guard each other's promotion squares: the a2-pawn attacks b1, and the b2-pawn attacks a1 and c1. So `Ra1` is met by `...bxa1=Q`, `Rb1` by `...axb1=Q+` and `Rc1` by `...bxc1=Q`: each time a pawn captures the rook *and* promotes.
3. **Check the king.** White's king can reach c2, attacking b2, but then `...a1=Q` makes a queen that defends b2. The engine prefers Black clearly in every line.

### Common beginner mistakes
- Counting the material ("I have a rook against two pawns") instead of counting the steps.
- Promoting to a queen automatically when a knight would check and fork.
- Forgetting that promotion is compulsory: you cannot "keep the pawn" on the last rank.
- Letting a pawn reach the rank before promotion with no blockader in front of it.

### Advanced insight
The new queen arrives on a back-rank square: a1–f1 for Black, a6–f6 for White. Those squares are often on the same rank, file or diagonal as the enemy king or rooks. **Guidance:** before promoting, ask what the new piece will attack *on the move it appears*. A promotion with check or with an attack on a rook is a free tempo.

### Worked example

```crown
fen: 3r2/1p1P1k/p2R2/P1KN1p/4pp/6 b - - 3 27
claim: puzzle pz-oy1e4
caption: Academy puzzle pz-oy1e4. Black to move. Black has two pawns on the 2nd rank, e2 and f2.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♜ · ·
5 │ · ♟ · ♙ · ♚
4 │ ♟ · · ♖ · ·
3 │ ♙ · ♔ ♘ · ♟
2 │ · · · · ♟ ♟
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-oy1e4. Black to move. Black has two pawns on the 2nd rank, e2 and f2.*
<!-- /diagram -->

*Solution.* `1...e1=Q+!` The e-pawn promotes with check along the diagonal e1–d2–c3. White's legal replies are `Kb2`, `Kc2` and `Nxe1`. If `2. Nxe1`, then `2...fxe1=Q+` brings a second queen, again with check. So White must move the king, and Black is a queen up (the Academy engine judges the position decisive).

### Guided exercise

```crown
fen: 5r/pPk3/2P3/3R2/PK2p1/1N4 b - - 0 23
claim: puzzle pz-1rz0zpd
caption: Academy puzzle pz-1rz0zpd. Black to move. Is the e-pawn's promotion square guarded?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♜
5 │ ♟ ♙ ♚ · · ·
4 │ · · ♙ · · ·
3 │ · · · ♖ · ·
2 │ ♙ ♔ · · ♟ ·
1 │ · ♘ · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-1rz0zpd. Black to move. Is the e-pawn's promotion square guarded?*
<!-- /diagram -->

*Hint:* Check every White piece: can any of them attack e1?

### Independent exercises

```crown
fen: 1n2k1/5p/p1P2r/3K2/6/6 w - - 0 27
claim: puzzle pz-1td3for
caption: Exercise 1 (pz-1td3for). White to move. The c4-pawn is attacked by the knight. Find the only move that holds.
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
*Exercise 1 (pz-1td3for). White to move. The c4-pawn is attacked by the knight. Find the only move that holds.*
<!-- /diagram -->

```crown
fen: 1Q2n1/rP3k/6/2RPP1/p5/2K3 b - - 0 28
claim: puzzle pz-12s9mp
caption: Exercise 2 (pz-12s9mp). Black to move. Black's rook on a5 is attacked by the queen. Find the only move that holds.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♕ · · ♞ ·
5 │ ♜ ♙ · · · ♚
4 │ · · · · · ·
3 │ · · ♖ ♙ ♙ ·
2 │ ♟ · · · · ·
1 │ · · ♔ · · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (pz-12s9mp). Black to move. Black's rook on a5 is attacked by the queen. Find the only move that holds.*
<!-- /diagram -->

```crown
fen: 6/1QPq1p/3p1k/1p1P2/5P/5K w - - 1 22
line: c6=Q Qxb5 Qxb5
show: after
caption: Exercise 3 (review of pz-1tmu932 from Chapter 4). After c6=Q Qxb5 Qxb5, count the material. What did the promotion gain?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♕ · · · ♟
4 │ · · · ♟ · ♚
3 │ · ♟ · ♙ · ·
2 │ · · · · · ♙
1 │ · · · · · ♔
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3 (review of pz-1tmu932 from Chapter 4). After c6=Q Qxb5 Qxb5, count the material. What did the promotion gain?*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-1rz0zpd):** `1...e1=Q`. No White piece attacks e1: the knight on b1 covers a3, c3 and d2; the rook on d3 covers the d-file and the 3rd rank; the king on b2 is too far. The pawn simply becomes a queen.
- **1 (pz-1td3for):** `1. c5!` The pawn escapes the knight's attack *and* attacks the knight on b6 (a White pawn on c5 attacks b6 and d6). After `1...Nd5` (the Academy line), `2. c6=Q+` promotes with check along the 6th rank, and the new queen also attacks the knight on d5. The engine judges that this is the only way for White to hold.
- **2 (pz-12s9mp):** `1...a1=Q+!` The a2-pawn promotes with check along the 1st rank, and the new queen also attacks the White rook on c3 (diagonal a1–b2–c3), which nothing defends. White must answer the check; the Academy engine's line ends in perpetual check, a draw, in a position that was otherwise lost for Black.
- **3:** Before: White had a queen and pawns; Black had a queen. After the sequence each side has lost its original queen, and White's c-pawn has become a new queen. White has gained a whole queen for a pawn.

### Summary
Count the steps to promotion, not the material. Two connected pawns one step from the end beat a rook. Promote with check when you can, consider the knight when it forks, and always ask what the new piece attacks the moment it appears.

### Next lesson
Chapter 11: putting it all together, the method of forcing-move calculation.

---

## Chapter 11 — Forcing-Move Calculation

### Learning objectives
- Calculate a tactical sequence in a disciplined order: **checks, captures, threats**.
- Build and prune a small tree of variations.
- Stop calculating at a **quiet, assessable** position.

### Prerequisites
All earlier chapters of this book.

### Explanation
A forcing move limits the opponent's choices. Checks are the most forcing (the reply must deal with the check), then captures (the reply is usually a recapture), then threats (the reply must parry the threat). Calculate them **in that order**, for both sides:
1. **List your candidate forcing moves**: all checks, all captures, all serious threats.
2. **For each candidate, list the opponent's forcing replies first**, then his best quiet defence.
3. **Go one step deeper** only along forcing lines. Stop when the position is quiet (no checks, no hanging pieces) and count the material.
4. **Compare** the end positions and choose.

**How the small board changes it.** On 6 × 6 the number of legal moves is small (there are only 10 in the starting position), and in tactical positions often only one to six replies to a check exist. This makes calculation *easier* than on the big board, and it means that a well-ordered search really can be complete. The flip side: the opponent's forcing moves arrive just as fast. **Guidance:** in every position, look at your opponent's checks before your own.

### Illustrated example

```crown
fen: 1r1k1r/p3p1/n2PPp/P4P/R1P1q1/Q1KRN1 b - - 0 19
claim: puzzle pz-1vh7cy4
caption: Academy puzzle pz-1vh7cy4. Black to move. The knight on e1 is guarded only by the rook on d1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♜ · ♚ · ♜
5 │ ♟ · · · ♟ ·
4 │ ♞ · · ♙ ♙ ♟
3 │ ♙ · · · · ♙
2 │ ♖ · ♙ · ♛ ·
1 │ ♕ · ♔ ♖ ♘ ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-1vh7cy4. Black to move. The knight on e1 is guarded only by the rook on d1.*
<!-- /diagram -->

`1...Qe3+!` checks along the diagonal e3–d2–c1. White's only legal move is `2. Rd2`. Now the rook has left d1, so `2...Qxe1+` takes the knight with check along the 1st rank, and again White has a single legal move, `3. Rd1`. Then `3...Qe3+` repeats the check. Black has won a knight with a chain of checks that left White no choice at all.

### Step-by-step reasoning: the tree
For the illustrated position, a disciplined search looks like this:
1. **Black's checks:** write them all down. There are five: `...Qd2+`, `...Qxc2+`, `...Qxd1+`, `...Rb1+` and `...Qe3+`. The first four simply lose the checking piece (`Rxd2` or `Kxd2`; `Kxc2`; `Kxd1`; `Kxb1` or `Qxb1`). Only `...Qe3+` is safe.
2. **White's replies to `...Qe3+`:** only `Rd2` (the king has no square; nothing else can block). A tree with one branch.
3. **Black's forcing moves now:** `...Qxe1+` (capture with check). White's replies: only `Rd1`.
4. **Stop and assess:** a quiet moment after `...Qe3+` again; count: Black has won a knight.

Four plies, two branches with exactly one reply each. On a 6 × 6 board, such "only move" chains are common, and they are exactly what you should look for first.

### Common beginner mistakes
- Calculating quiet moves first and running out of time before seeing the check.
- Stopping the calculation in the middle of an exchange, with a piece still hanging.
- Forgetting the opponent's forcing replies (a counter-check or a zwischenzug).
- Calculating one line very deeply and not looking at the alternatives at move one.

### Advanced insight
Strong players stop calculating **as soon as the position becomes quiet and clear**, not after a fixed number of moves. **Guidance:** a good rule of thumb is "calculate until no checks, no captures and no threats remain, then evaluate". The Academy engine works in exactly this spirit: its quiescence search keeps looking at captures and promotions until the position is quiet.

### Worked example

```crown
fen: 3k1r/1qpp1p/2n3/Q3P1/P2NnP/1R1K1R b - - 7 16
claim: puzzle pz-z3smsm
caption: Academy puzzle pz-z3smsm. Black to move. Both queens are attacked.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ♜
5 │ · ♛ ♟ ♟ · ♟
4 │ · · ♞ · · ·
3 │ ♕ · · · ♙ ·
2 │ ♙ · · ♘ ♞ ♙
1 │ · ♖ · ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-z3smsm. Black to move. Both queens are attacked.*
<!-- /diagram -->

*Solution, by the method.*
1. **Inventory.** Black's queen on b5 is attacked by the rook on b1 (b-file). White's queen on a3 is attacked by the knight on c4. Both knights on c4 and e2 are Black's.
2. **Black's captures:** `...Nxa3` (takes the queen), `...Nxd2` and others. `...Nxa3` is the biggest.
3. **White's forcing replies to `...Nxa3`:** `Rxb5` (takes the queen back). Now material is level.
4. **Black's forcing moves now:** `...Nc3+!` The e2-knight checks the king on d1 and attacks the rook on b5. White has only two legal replies (`Ke1`, `Kc1`), and then `...Naxb5` or `...Ncxb5` wins the rook.
5. **Assess:** queens traded, Black a rook up. The Academy line is `1...Nxa3 2. Rxb5 Nc3+`.

### Guided exercise

```crown
fen: 6/3Q1p/1p1P1k/6/3PK1/1q4 b - - 0 24
claim: puzzle pz-am6uu4
caption: Academy puzzle pz-am6uu4. Black to move. List every Black check first.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♕ · ♟
4 │ · ♟ · ♙ · ♚
3 │ · · · · · ·
2 │ · · · ♙ ♔ ·
1 │ · ♛ · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-am6uu4. Black to move. List every Black check first.*
<!-- /diagram -->

*Hint:* One queen check hits both the king on e2 and the queen on d5, and is protected by Black's king.

### Independent exercises

```crown
fen: 1q2nk/1p1p2/3Pp1/1P2N1/4P1/1N1K2 w - - 0 20
claim: puzzle pz-1sicldm
caption: Exercise 1 (pz-1sicldm). White to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♛ · · ♞ ♚
5 │ · ♟ · ♟ · ·
4 │ · · · ♙ ♟ ·
3 │ · ♙ · · ♘ ·
2 │ · · · · ♙ ·
1 │ · ♘ · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (pz-1sicldm). White to move and win material.*
<!-- /diagram -->

```crown
fen: 5r/2k3/6/1P3P/3Nn1/1K4 w - - 0 36
claim: puzzle pz-14bci3z
caption: Exercise 2 (pz-14bci3z). White to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♜
5 │ · · ♚ · · ·
4 │ · · · · · ·
3 │ · ♙ · · · ♙
2 │ · · · ♘ ♞ ·
1 │ · ♔ · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (pz-14bci3z). White to move and win material.*
<!-- /diagram -->

```crown
fen: 1r2nr/1pq1k1/pR2Pn/N1p1QR/P1N3/4K1 w - - 4 16
claim: puzzle pz-uo80c3
caption: Exercise 3 (pz-uo80c3, difficulty 3). White to move. Calculate the forcing line to its quiet end.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♜ · · ♞ ♜
5 │ · ♟ ♛ · ♚ ·
4 │ ♟ ♖ · · ♙ ♞
3 │ ♘ · ♟ · ♕ ♖
2 │ ♙ · ♘ · · ·
1 │ · · · · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (pz-uo80c3, difficulty 3). White to move. Calculate the forcing line to its quiet end.*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-am6uu4):** `1...Qe4+!` The queen comes from b1 along the diagonal b1–c2–d3–e4, checks the king on e2 and attacks the queen on d5. It is protected by Black's king on f4, so White cannot take it with the king. White's best is to trade: `2. Qxe4+ Kxe4` (the Academy line), reaching an ending the engine rates as winning for Black.
- **1 (pz-1sicldm):** `1. Nxd5+!` The e3-knight captures the d5-pawn with check (d5 attacks f6) and attacks the queen on b6. Black's only legal move is `1...Kf5`, and `2. Nxb6` wins the queen.
- **2 (pz-14bci3z):** `1. Ne4+!` The knight checks the king on c5 and attacks the rook on f6. The king has six squares, but none of them protects f6. After `1...Kb4` (the Academy line), `2. Nxf6` wins the rook.
- **3 (pz-uo80c3):** `1. Qxc3+!` The queen takes the c3-pawn with check along the diagonal c3–d4–e5 and attacks Black's queen on c5 up the c-file. The Academy line is `1...Qxc3+ 2. Rxc3`: the queens come off, White has won a pawn, and the position is quiet; the engine rates White clearly better. Notice the method: check-capture first, then count at the quiet end.

### Summary
Checks, captures, threats, for both sides, in that order. Build a small tree, follow only forcing lines, stop at a quiet position and count. On 6 × 6 the trees are small and often complete: use that.

### Next lesson
You have finished Book II. The next book of the Grimoire turns from tactics to strategy: what to do when there is no combination.
