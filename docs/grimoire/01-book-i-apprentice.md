# Book I — The Apprentice

*Being the first book of THE SOVEREIGN'S GRIMOIRE: FROM APPRENTICE TO CHESS SOVEREIGN, for players of Crown & Calculation (rules `crown-la6-v1`).*

Welcome to the Academy, Apprentice. Before any spell is cast, a student learns the shape of the room and the names of things. This book teaches you the six-by-six board, how every piece moves, how to keep your pieces safe, how to give and escape check, how to deliver checkmate, how to avoid the stalemate trap, and how a humble pawn walks to its crown.

**How to read this book.** Every board below is a *checked* board. Each one was written as a `crown` block and tested by the Academy's position checker (`tools/grimoire/check.ts`) against the real rules of the game in `src/rules`. When a caption says "mate in 2", the checker proved it by trying *every* defence. When a caption says "the engine's choice", that is the judgement of the Academy engine (the puzzle policy `crown-puzzle-verify-2`), which is strong but is not a proof. Where this book offers advice rather than fact, it says so with the word **Guidance**.

Moves are written in short algebraic notation (SAN): a piece letter (K king, Q queen, R rook, N knight; no letter for a pawn), then the square it lands on. `x` means a capture, `+` check, `#` checkmate, `=Q` promotion to a queen.

---

## Chapter 1 — The Board and Its Coordinates

### Learning objectives
- Name every one of the 36 squares.
- Set up the starting position from memory.
- Read and write a move such as `Nd3` or `exd4`.

### Prerequisites
None. This is the first door of the Academy.

### Explanation
The board has six **files** (columns), lettered **a** to **f** from White's left to White's right, and six **ranks** (rows), numbered **1** to **6** from White's side to Black's side. A square is named by its file then its rank: `a1` is White's left-hand corner, `f6` is Black's left-hand corner (White's far right). There are 6 × 6 = **36 squares**, 18 light and 18 dark. As in the older game, the corner square on each player's right-hand side is light, so `f1` and `a6` are light and `a1` and `f6` are dark.

Each side has twelve pieces: one king, one queen, two rooks, two knights and six pawns. **There are no bishops.** White's back rank, from a1 to f1, reads **R N Q K N R**: rooks on a1 and f1, knights on b1 and e1, the queen on c1 and the king on d1. White's six pawns stand on rank 2. Black mirrors this on ranks 6 and 5: Black's queen is on c6 and king on d6, directly opposite White's.

In the standard notation for positions (FEN), the starting position is written `rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1`. Capital letters are White, small letters are Black, digits count empty squares, and the ranks are listed from 6 down to 1.

Notice the shape: only **two empty ranks** (3 and 4) separate the armies. In the older eight-by-eight game there are four. Everything in Crown & Calculation happens sooner: contact, tactics and promotion.

### Illustrated example

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
caption: The starting position. Kings face each other on d1 and d6, queens on c1 and c6. Only ranks 3 and 4 lie between the pawns.
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
*The starting position. Kings face each other on d1 and d6, queens on c1 and c6. Only ranks 3 and 4 lie between the pawns.*
<!-- /diagram -->

### Step-by-step reasoning
How do we read a move? Take the line below: White plays a knight to d3, and Black answers with a knight to d4.

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Nd3 Nd4
show: after
caption: After 1. Nd3 Nd4. White's e1-knight jumped to d3; Black's e6-knight jumped to d4.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ · ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · ♞ · ·
3 │ · · · ♘ · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*After 1. Nd3 Nd4. White's e1-knight jumped to d3; Black's e6-knight jumped to d4.*
<!-- /diagram -->

1. `Nd3` — the letter N says "a knight", `d3` says where it lands. Only one White knight can reach d3 (the one on e1), so nothing more is needed.
2. `Nd4` — Black's e6-knight lands on d4. Again, only one knight can get there.
3. If two identical pieces could reach the same square, we add the starting file or rank, for example `Nbd3` or `R1a3`. The checker insists on the shortest correct spelling.

### Common beginner mistakes
- Reading the board from the wrong side. White's a1 is at White's bottom-left; from Black's chair it is at the top-right.
- Placing the king and queen the "old" way. Here the queen is on **c1** and the king on **d1** for White, and the queen on **c6** and king on **d6** for Black.
- Looking for bishops, castling or the pawn's two-square first move. None of them exist in this game.

### Advanced insight
With 36 squares instead of 64, each piece is a larger share of the whole army, and every square nearer to the enemy. A knight on d3 already touches squares on Black's half of the board (c5 and e5). In this game "the opening" and "the middlegame" overlap from the first move.

### Worked example
*Question:* In the starting position, which White pieces can move at all?

*Answer:* Only the two knights and the six pawns. The rooks, queen and king are hemmed in by their own pieces. Each pawn can step forward one square (a3, b3, c3, d3, e3, f3), the b1-knight can go to a3 or c3, and the e1-knight to d3 or f3. That is 6 + 2 + 2 = **10 legal first moves**, as the rules engine confirms.

### Guided exercise
Find the square names. In the starting position: (a) Where is Black's queen? (b) Which square is directly in front of White's king? (c) Which square is two squares in front of White's queen?

*Hint:* White's king is on d1; "in front" for White means a higher rank number.

### Independent exercises
1. How many squares are there, and how many are light?
2. Write White's move that brings the e1-knight to f3, and Black's reply that moves the c-pawn one square.

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Nf3 c4
show: after
caption: Exercise 2 — the position after the two moves. Check your answer below.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ · ♟ ♟ ♟
4 │ · · ♟ · · ·
3 │ · · · · · ♘
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 — the position after the two moves. Check your answer below.*
<!-- /diagram -->

3. Name every piece and its square in this position.

```crown
fen: k5/6/2n3/6/3R2/5K w - - 0 1
caption: Exercise 3 — name each piece and its square.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · · ♞ · · ·
3 │ · · · · · ·
2 │ · · · ♖ · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 — name each piece and its square.*
<!-- /diagram -->

### Answers with explanations
- **Guided:** (a) c6. (b) d2 (a White pawn stands there). (c) c3.
- **1.** 36 squares; 18 are light.
- **2.** `1. Nf3 c4`. The knight from e1 lands on f3; Black's c5-pawn steps to c4. Black pawns move *down* the board, towards rank 1.
- **3.** Black king a6, Black knight c4, White rook d2, White king f1.

### Summary
Files a–f, ranks 1–6, 36 squares. White: R N Q K N R on rank 1 with the king on d1; Black mirrors on rank 6 with the king on d6. Two empty ranks between the pawns. No bishops, no castling, no two-square pawn step.

### Next lesson
Chapter 2 teaches the long-range pieces and the king, and measures exactly how far each one reaches on this small board.

---

## Chapter 2 — The Pieces I: Rook, Queen and King

### Learning objectives
- Move the rook, queen and king correctly.
- Count how many squares each one controls on the 6 × 6 board.
- Understand why a piece's reach depends on where it stands.

### Prerequisites
Chapter 1 (square names).

### Explanation
- The **rook** moves any number of squares along a rank or a file, but cannot jump over pieces.
- The **queen** moves like a rook *or* diagonally any number of squares; it cannot jump either.
- The **king** moves one square in any direction. It may never move to a square attacked by an enemy piece.

A piece **controls** (or **attacks**) every square it could move to, and it can capture an enemy piece standing on such a square.

On an empty 6 × 6 board the numbers are small and exact:

| Piece | Corner | Other edge square | Second ring (b2–e2–e5–b5) | Centre (c3, d3, c4, d4) |
|---|---|---|---|---|
| Rook | 10 | 10 | 10 | 10 |
| Queen | 15 | 15 | 17 | 19 |
| King | 3 | 5 | 8 | 8 |

A rook always reaches **10 squares** on an empty board: 5 along its file and 5 along its rank, wherever it stands. The queen adds the diagonals: 5 on any edge square, 7 on the second ring, 9 in the centre. (These counts were made with the rules engine's own move generator.)

### Illustrated example

```crown
fen: k5/6/6/2Q3/6/5K w - - 0 1
caption: The queen on c3 has 19 moves: 10 along the c-file and 3rd rank, and 9 along the two diagonals.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♕ · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*The queen on c3 has 19 moves: 10 along the c-file and 3rd rank, and 9 along the two diagonals.*
<!-- /diagram -->

### Step-by-step reasoning
Count the queen's moves in the diagram one direction at a time:
1. Up the c-file: c4, c5, c6 (3). Down: c2, c1 (2).
2. Along rank 3: d3, e3, f3 (3) and b3, a3 (2). Rook-like total: 10.
3. Diagonal up-right: d4, e5, f6 (3). Down-left: b2, a1 (2).
4. Diagonal up-left: b4, a5 (2). Down-right: d2, e1 (2). Diagonal total: 9.
5. 10 + 9 = **19**. Several of these moves give check to the Black king on a6 (for example `Qa3+`, `Qc6+` and `Qa5+`).

```crown
fen: k5/6/6/2R3/6/5K w - - 0 1
caption: A rook on c3: 10 moves, exactly as on any other square of an empty board.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♖ · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*A rook on c3: 10 moves, exactly as on any other square of an empty board.*
<!-- /diagram -->

```crown
fen: 4k1/6/6/6/6/Q4K w - - 0 1
caption: A queen in the corner a1 reaches 14 squares here (15 if her own king were not standing on f1).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♕ · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*A queen in the corner a1 reaches 14 squares here (15 if her own king were not standing on f1).*
<!-- /diagram -->

### Common beginner mistakes
- Letting a rook or queen "jump". If a piece is in the way, the line stops there (on it, if it is an enemy piece you can capture; before it, if it is your own).
- Moving the king next to the enemy king. Two kings may never stand on neighbouring squares, because each would be attacking the other.
- Forgetting that the king cannot step onto a square that is attacked, even by a piece that seems far away.

### Advanced insight
On the big board a queen in the centre controls 27 squares, 42% of 64. On this board a central queen controls 19 of 36, more than half. A queen can cross the whole board in one move, so **no square is far from her.** This is why queen checks and queen forks (Book II) are so dangerous here. **Guidance:** never leave your queen where an enemy rook or knight can attack it with tempo.

The engine that runs the Academy measures piece values by statistical fitting (`crown-eval-4`). Its middlegame values, in pawns, are roughly: pawn 0.9, rook 4.1, knight 4.4, queen 9.3; in the endgame: pawn 0.9, knight 2.6, rook 4.6, queen 7.8. **Guidance:** these are engine estimates, not laws. The surprise is the knight: in a crowded middlegame on this small board the engine values a knight about as highly as a rook.

### Worked example
In the position below, how many moves does the White rook on c2 have?

```crown
fen: k5/6/1p2n1/6/2R1P1/5K w - - 0 1
caption: Worked example — count the rook's moves.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · ♟ · · ♞ ·
3 │ · · · · · ·
2 │ · · ♖ · ♙ ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Worked example — count the rook's moves.*
<!-- /diagram -->

*Solution.* Along rank 2 to the right: d2, then e2 is White's own pawn, so the rook stops (1). To the left: b2, a2 (2; `Ra2+` is even check). Up the c-file: c3, c4, c5, c6 (4). Down: c1 (1). Total **8**. The Black pawn on b4 and knight on e4 are not on the rook's lines, so it cannot capture them.

### Guided exercise
Put a queen on c2 in place of the rook in the worked example. How many moves does she have now, and which piece can she capture?

*Hint:* Keep the 8 rook moves, then add the diagonals c2–d3–e4 and c2–b3–a4, c2–d1 and c2–b1.

```crown
fen: k5/6/1p2n1/6/2Q1P1/5K w - - 0 1
caption: Guided exercise — the queen on c2.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · ♟ · · ♞ ·
3 │ · · · · · ·
2 │ · · ♕ · ♙ ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Guided exercise — the queen on c2.*
<!-- /diagram -->

### Independent exercises
1. How many moves does the White king on a1 have here? Why?

```crown
fen: k5/6/1r4/6/6/K5 w - - 0 1
caption: Exercise 1 — the cornered king.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · ♜ · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 — the cornered king.*
<!-- /diagram -->

2. How many moves does a king have on c1 on an empty board? On c3?
3. True or false: a rook in the corner controls fewer squares than a rook in the centre (empty board).
4. In the starting position, how many legal moves does White's queen have?

### Answers with explanations
- **Guided:** 14 moves. The 8 rook moves, plus d3 and the capture `Qxe4` on one diagonal, b3 and a4 (`Qa4+`) on the other, and d1 and b1. She captures the knight on e4.
- **1.** One move: `Ka2`. The Black rook on b4 controls the whole b-file, so b1 and b2 are forbidden. The king may only go to a2.
- **2.** Five on c1 (b1, b2, c2, d2, d1); eight on c3.
- **3.** False. A rook on an empty board always controls 10 squares.
- **4.** Zero. The queen on c1 is surrounded by the b1-knight, the d1-king and the pawns on b2, c2 and d2.

### Summary
Rook: 10 squares anywhere on an empty board. Queen: 15 in a corner, 19 in the centre. King: 3, 5 or 8. Lines are blocked by pieces in the way. A king can never move into check or next to the other king.

### Next lesson
Chapter 3 introduces the two "short-range" pieces with special rules: the jumping knight and the pawn.

---

## Chapter 3 — The Pieces II: Knight and Pawn

### Learning objectives
- Move the knight and know its reach on every square.
- Move and capture with pawns under Crown rules: one step only, no en passant.
- Know that promotion is compulsory, to a queen, rook or knight.

### Prerequisites
Chapters 1–2.

### Explanation
**The knight** moves in an "L": two squares in one direction and one square to the side. It is the only piece that **jumps** over others. A knight always lands on a square of the *opposite colour* from where it started.

The knight's reach depends strongly on where it stands. On an empty board:

```text
rank 6:  2 3 4 4 3 2
rank 5:  3 4 6 6 4 3
rank 4:  4 6 8 8 6 4
rank 3:  4 6 8 8 6 4
rank 2:  3 4 6 6 4 3
rank 1:  2 3 4 4 3 2
         a b c d e f
```

Only the four centre squares (c3, d3, c4, d4) give a knight all 8 moves, which is 4 of 36 squares, compared with 16 of 64 on the big board. Averaged over the board, a knight here has about 4.4 moves.

**The pawn** moves straight forward **one square**, never backwards, and only onto an empty square. **There is no two-square first move and no en passant.** A pawn captures one square diagonally forward. White pawns move up the board (towards rank 6), Black pawns move down (towards rank 1).

When a pawn reaches the last rank (rank 6 for White, rank 1 for Black) it **must** be promoted, in the same move, to a **queen, rook or knight** of its own colour. There is no bishop to choose and no option to stay a pawn.

### Illustrated example

```crown
fen: k5/6/6/2N3/6/5K w - - 0 1
caption: A knight on c3 has 8 moves: b1, d1, a2, e2, a4, e4, b5, d5. All are light squares; c3 is dark.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♘ · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*A knight on c3 has 8 moves: b1, d1, a2, e2, a4, e4, b5, d5. All are light squares; c3 is dark.*
<!-- /diagram -->

```crown
fen: k5/6/6/6/6/N4K w - - 0 1
caption: The same knight in the corner a1 has only 2 moves: b3 and c2.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♘ · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*The same knight in the corner a1 has only 2 moves: b3 and c2.*
<!-- /diagram -->

### Step-by-step reasoning
Here are pawns in contact. White to move.

```crown
fen: k5/6/2p3/1P1P2/6/5K w - - 0 1
caption: White pawns on b3 and d3, a Black pawn on c4.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · · ♟ · · ·
3 │ · ♙ · ♙ · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*White pawns on b3 and d3, a Black pawn on c4.*
<!-- /diagram -->

1. The b3-pawn may step to b4 (empty) or capture diagonally on c4: `bxc4`.
2. The d3-pawn may step to d4 or capture `dxc4`.
3. The Black pawn on c4 also attacks b3 and d3 (diagonally *downwards*): if White does nothing, Black can capture.
4. Neither White pawn may move two squares, and neither may capture straight ahead. Together with the king's three moves, White has exactly 7 legal moves.

Now a promotion. White's pawn on d5 must promote when it moves. Which piece?

```crown
fen: 6/1q1P1k/6/P5/6/K5 w - - 0 1
line: d6=N+
claim: best d6=N+
caption: The engine's choice is to promote to a knight with check, forking the king on f5 and the queen on b5.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♛ · ♙ · ♚
4 │ · · · · · ·
3 │ ♙ · · · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The engine's choice is to promote to a knight with check, forking the king on f5 and the queen on b5.*
<!-- /diagram -->

5. A new queen on d6 would only give queen against queen; the engine rates it far lower.
6. A new knight on d6 checks the king on f5 *and* attacks the queen on b5. After the king moves, `Nxb5` wins the queen. White is left with knight and pawn against a bare king, which the engine judges winning (a lone knight could not mate, so the a3-pawn matters).

### Common beginner mistakes
- Trying to move a pawn two squares on its first move. Illegal here.
- Trying to capture *en passant*. That rule does not exist here.
- Forgetting that promotion is compulsory and that a bishop cannot be chosen.
- Moving a knight and landing on a square of the same colour. If you did, the move was wrong.

### Advanced insight
Because knights always change colour, **a knight can never attack two squares of different colours at once.** The White king (d1, light) and queen (c1, dark) stand on different colours, so no single knight can attack both at the start. But a knight on e3 attacks d1 *and* f1 (both light), and a knight on b3 attacks a1 *and* c1 (both dark). Book II builds on this.

The longest knight journey on the 6 × 6 board takes 4 moves. For example a1 to f6 goes a1–c2–e3–d5–f6. Curiously, reaching the diagonal neighbour b2 from a1 *also* needs 4 moves.

### Worked example
How many moves does the White knight on d3 have, and which of them are special?

```crown
fen: k5/4p1/6/3N2/6/5K w - - 0 1
caption: Worked example — the knight on d3.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · ♟ ·
4 │ · · · · · ·
3 │ · · · ♘ · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Worked example — the knight on d3.*
<!-- /diagram -->

*Solution.* d3 is a centre square, so 8: b2, b4, c1, c5, e1, e5, f2, f4. On e5 stands a Black pawn, so that move is the capture `Nxe5`. Two moves give check to the king on a6: `Nb4+` and `Nc5+`.

### Guided exercise
In the starting position, how many moves does each knight have, and why so few?

*Hint:* b1 and e1 are edge squares (3 moves each on an empty board), and one of those squares is occupied by a White pawn.

### Independent exercises
1. How many moves does a knight have on b2 (empty board)? On a2? On c2?
2. A White pawn stands on c2 and the c3 square is occupied by a Black knight. Can the pawn capture it?
3. Black's pawn on e2 reaches e1. List every piece it may become.
4. Name a knight route from a1 to f6 in four moves (different from the one above, if you can).

### Answers with explanations
- **Guided:** 2 each. The b1-knight reaches a3 and c3 (d2 holds a White pawn); the e1-knight reaches d3 and f3 (c2 holds a pawn).
- **1.** b2: 4. a2: 3. c2: 6.
- **2.** No. Pawns capture diagonally only. The pawn is simply blocked.
- **3.** A Black queen, rook or knight, chosen by Black. It may not stay a pawn and may not become a bishop or a king.
- **4.** One example: a1–b3–c5–e4–f6 (b3 to c5 is one up two, c5 to e4 is two across one down, e4 to f6 is one across two up). Any correct four-move route counts.

### Summary
Knights jump in an L, change square colour every move, and are strongest on the four centre squares (8 moves) and weakest in the corners (2). Pawns step one square, capture diagonally, have no double step and no en passant, and must promote to Q, R or N on the last rank.

### Next lesson
Chapter 4: capturing, and the most important beginner skill of all, knowing which of your pieces are safe.

---

## Chapter 4 — Capturing and Piece Safety

### Learning objectives
- Recognise when a piece is **attacked**, **defended** or **hanging** (attacked and undefended).
- Count attackers and defenders before capturing.
- Capture with the least valuable piece first.

### Prerequisites
Chapters 2–3.

### Explanation
You capture by moving onto a square occupied by an enemy piece, which is removed from the board. A piece is:
- **attacked** if an enemy piece could capture it next move;
- **defended** (protected) if one of your own pieces could recapture on its square;
- **hanging** if it is attacked and not defended. A hanging piece can be taken for free.

Before capturing on a square, **count**: how many of your pieces attack it, and how many enemy pieces defend it? Then imagine the exchanges in order, each side recapturing with its *cheapest* piece first. A useful scale of values (**Guidance**, see Chapter 2 for the engine's figures): pawn 1, knight 3 to 4, rook 5, queen 9. The king can never be "traded"; it may only capture a piece that is not defended.

### Illustrated example

```crown
fen: r2k2/p2n2/1p4/1P1Q2/P5/3K2 w - - 3 25
claim: puzzle pz-cfbmy9
caption: Academy puzzle pz-cfbmy9. White to move. Which Black piece is hanging?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ · ·
5 │ ♟ · · ♞ · ·
4 │ · ♟ · · · ·
3 │ · ♙ · ♕ · ·
2 │ ♙ · · · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-cfbmy9. White to move. Which Black piece is hanging?*
<!-- /diagram -->

The Black rook on a6 is attacked by the queen along the diagonal d3–c4–b5–a6. Is it defended? The pawn on a5 cannot defend it, because pawns capture forwards (for Black, downwards), and the knight on d5 does not reach a6. The rook is **hanging**: `Qxa6+` wins a whole rook, with check along the 6th rank.

### Step-by-step reasoning
Counting matters most when a piece *is* defended. Here White can capture the Black knight on d4 in two ways.

```crown
fen: 5k/2p3/3n2/1N4/6/3R1K w - - 0 1
caption: The knight on d4 is attacked twice (Nb3, Rd1) and defended once (pawn c5).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · ♟ · · ·
4 │ · · · ♞ · ·
3 │ · ♘ · · · ·
2 │ · · · · · ·
1 │ · · · ♖ · ♔
  └─────────────
    a b c d e f    White to move
```
*The knight on d4 is attacked twice (Nb3, Rd1) and defended once (pawn c5).*
<!-- /diagram -->

1. Attackers: White's knight on b3 and rook on d1. Defenders: Black's pawn on c5 (it captures diagonally down onto d4).
2. Two attackers against one defender: White will end up owning d4. But *which piece captures first* decides the profit.
3. Capture first with the cheaper piece, the knight:

```crown
fen: 5k/2p3/3n2/1N4/6/3R1K w - - 0 1
line: Nxd4 cxd4 Rxd4
show: after
caption: Correct order: knight takes, pawn takes back, rook takes. White gave a knight and won a knight and a pawn.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · · · ·
4 │ · · · ♖ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    Black to move
```
*Correct order: knight takes, pawn takes back, rook takes. White gave a knight and won a knight and a pawn.*
<!-- /diagram -->

4. The wrong order loses material:

```crown
fen: 5k/2p3/3n2/1N4/6/3R1K w - - 0 1
line: Rxd4 cxd4 Nxd4
show: after
caption: Wrong order: White gave a rook (5) and won only a knight and a pawn (about 4).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · · · ·
4 │ · · · ♘ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    Black to move
```
*Wrong order: White gave a rook (5) and won only a knight and a pawn (about 4).*
<!-- /diagram -->

### Common beginner mistakes
- Seeing only the piece you want to take and not the piece that will take back.
- Capturing first with the queen. If the target is defended, the queen is usually lost for less.
- Forgetting that your own king can be a defender of nearby squares, and that the enemy king can capture an undefended piece next to it.
- Leaving your own piece hanging after making a capture. Always ask: "after my move, what is attacked?"

### Advanced insight
On a 6 × 6 board pieces stand close together, so almost every piece is attacked or defended by several others at once. A capture often opens a line for *another* piece, which is the root of the tactics in Book II. **Guidance:** after every enemy move, ask two questions: *What does it attack now? What did it stop defending?*

### Worked example

```crown
fen: q2k2/2n1p1/1Q1pr1/3N2/2PP1P/3K1R w - - 2 14
claim: puzzle pz-kqfffd
caption: Academy puzzle pz-kqfffd. White to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♛ · · ♚ · ·
5 │ · · ♞ · ♟ ·
4 │ · ♕ · ♟ ♜ ·
3 │ · · · ♘ · ·
2 │ · · ♙ ♙ · ♙
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Academy puzzle pz-kqfffd. White to move and win material.*
<!-- /diagram -->

*Solution.* The Black knight on c5 is attacked by the White queen on b4. Its only possible defender is the Black king on d6, which stands next to c5. If White plays `Qxc5+`, the queen gives check, and can the king take back? No: the queen on c5 is defended by the White knight on d3. Count: one attacker (the queen) against one "defender" that cannot legally recapture, because a king may never capture a defended piece. **`Qxc5+` wins a knight for nothing.**

### Guided exercise

```crown
fen: 2Q3/6/p2n1p/P3k1/6/2K3 b - - 0 32
claim: puzzle pz-1u23ob3
caption: Academy puzzle pz-1u23ob3. Black to move. Is any White piece hanging?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♕ · · ·
5 │ · · · · · ·
4 │ ♟ · · ♞ · ♟
3 │ ♙ · · · ♚ ·
2 │ · · · · · ·
1 │ · · ♔ · · ·
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-1u23ob3. Black to move. Is any White piece hanging?*
<!-- /diagram -->

*Hint:* Look at every square the Black knight on d4 attacks.

### Independent exercises

```crown
fen: 2k3/r2n2/1p4/2p2P/P1Nr2/R3KR b - - 0 29
claim: puzzle pz-1xa5t37
caption: Exercise 1 (pz-1xa5t37). Black to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ · · ·
5 │ ♜ · · ♞ · ·
4 │ · ♟ · · · ·
3 │ · · ♟ · · ♙
2 │ ♙ · ♘ ♜ · ·
1 │ ♖ · · · ♔ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 1 (pz-1xa5t37). Black to move and win material.*
<!-- /diagram -->

```crown
fen: 2qr2/1r2kp/1R4/2p3/P1Q1PP/4KR b - - 2 16
claim: puzzle pz-1c8fjp0
caption: Exercise 2 (pz-1c8fjp0). Black to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♛ ♜ · ·
5 │ · ♜ · · ♚ ♟
4 │ · ♖ · · · ·
3 │ · · ♟ · · ·
2 │ ♙ · ♕ · ♙ ♙
1 │ · · · · ♔ ♖
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2 (pz-1c8fjp0). Black to move and win material.*
<!-- /diagram -->

```crown
fen: 3k1r/p2q2/3Q1p/2PP1N/1rNK1P/6 w - - 0 19
claim: puzzle pz-ra3qk4
caption: Exercise 3 (pz-ra3qk4). White to move and win material.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ♜
5 │ ♟ · · ♛ · ·
4 │ · · · ♕ · ♟
3 │ · · ♙ ♙ · ♘
2 │ · ♜ ♘ ♔ · ♙
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3 (pz-ra3qk4). White to move and win material.*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-1u23ob3):** `Nxc6`. The White queen on c6 is attacked by the knight on d4 and nothing defends it: the White king on c1 is far away. Black wins the queen.
- **1 (pz-1xa5t37):** `Rxc2`. The White knight on c2 is attacked by the Black rook on d2. Its only nearby piece, the king on e1, does not touch c2 (only d1, d2, e2, f1 and f2). The knight is hanging.
- **2 (pz-1c8fjp0):** `Rxb4`. The White rook on b4 is attacked by the Black rook on b5. The queen on c2 defends b3 and c3, not b4, and the a2-pawn defends b3. The rook is hanging.
- **3 (pz-ra3qk4):** `Qxf6+`. The Black rook on f6 is attacked by the White queen on d4 along the diagonal d4–e5–f6. It is defended by nothing (the queen on d5 does not reach f6, and the king on d6 is two files away). The capture also gives check along the 6th rank.

### Summary
Before you capture, count attackers and defenders, and capture with the cheapest piece first. A hanging piece is a gift; taking it is the first winning pattern every Apprentice learns. Never leave your own pieces hanging.

### Next lesson
Chapter 5: check, the attack on the king, and the three ways to escape it.

---

## Chapter 5 — Check and Escaping Check

### Learning objectives
- Recognise check.
- Know the three ways to escape check: **move** the king, **block** the line, **capture** the checking piece.
- Understand why a knight check cannot be blocked.

### Prerequisites
Chapters 2–4.

### Explanation
A king is in **check** when an enemy piece attacks its square. You must get out of check *at once*; no other move is legal. There are three ways:
1. **Move** the king to a square that is not attacked.
2. **Block**: put one of your pieces between the king and a checking rook or queen. (A knight or pawn check cannot be blocked: there is no line.)
3. **Capture** the checking piece, with any piece, including the king if the checker is undefended.

If none of these is possible, the king is **checkmated** and the game is over (Chapter 6).

### Illustrated example

```crown
fen: 5k/4r1/1N4/R5/2P1P1/3K2 b - - 0 1
line: Rd5+
show: after
caption: Black has just played Rd5+. White is in check from the rook on d5, and all three escapes are available.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · ♜ · ·
4 │ · ♘ · · · ·
3 │ ♖ · · · · ·
2 │ · · ♙ · ♙ ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Black has just played Rd5+. White is in check from the rook on d5, and all three escapes are available.*
<!-- /diagram -->

White's legal moves are exactly five:
- **Move:** `Kc1` or `Ke1`. (Not `Kd2`: that square is still on the d-file, attacked by the rook. Not `Kc2` or `Ke2`: White's own pawns stand there.)
- **Block:** `Rd3` (the a3-rook steps into the line) or `Nd3` (the knight jumps into the line).
- **Capture:** `Nxd5+`, which removes the rook and gives check to the king on f6.

### Step-by-step reasoning
How do you find every escape without missing one? Use the same order each time.
1. **Who gives check, and from where?** The rook on d5, along the d-file.
2. **Can I capture it?** List every piece that attacks d5: the knight on b4 does. `Nxd5+`.
3. **Can I block?** The squares between d5 and d1 are d4, d3, d2. Which pieces can reach them? The rook (a3 to d3) and the knight (b4 to d3).
4. **Where can the king go?** Check each neighbouring square: c1 (safe), c2 and e2 (own pawns), d2 (on the d-file), e1 (safe).
5. **Choose the best.** Here capturing a free rook is best. In general, check all three before choosing.

### Common beginner mistakes
- Moving the king *along* the line of the check (here `Kd2`). The rook still attacks that square.
- Trying to block a knight check. It is impossible.
- Making a "good" move elsewhere and ignoring the check. Illegal.
- Capturing the checker with the king when it is defended.

### Advanced insight
On the crowded 6 × 6 board the king often has very few flight squares. In the starting position White's king has none at all: c1 holds the queen, e1 a knight, and c2, d2, e2 pawns. **A check in the opening is therefore dangerous by itself**, because the only defences are blocking or capturing. **Guidance:** early in the game, keep a piece ready to block on the d-file and the a4–d1 and d1–f3 diagonals, and do not open your king's lines carelessly.

### Worked example

```crown
fen: 5k/q5/6/6/6/3K2 b - - 0 1
line: Qd2+
show: after
caption: Black's queen has just checked from d2, right next to White's king.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · ♛ · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Black's queen has just checked from d2, right next to White's king.*
<!-- /diagram -->

*Solution.* The queen attacks c1, e1, c2 and e2 as well as d1, so every flight square is covered. Nothing can block a piece that is adjacent. But the queen is **undefended**, so the king may capture it: `Kxd2` is White's only legal move, and it wins the queen.

Now give Black one more piece:

```crown
fen: 5k/q5/6/5n/6/3K2 b - - 0 1
line: Qd2#
claim: checkmate
show: after
caption: The same queen check, but the knight on f3 now defends d2. The king cannot capture, cannot flee and cannot block. Checkmate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ♞
2 │ · · · ♛ · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*The same queen check, but the knight on f3 now defends d2. The king cannot capture, cannot flee and cannot block. Checkmate.*
<!-- /diagram -->

### Guided exercise

```crown
fen: 5k/6/4n1/6/PPP3/1K4 b - - 0 1
line: Nc3+
show: after
caption: Guided exercise. Black's knight has just checked from c3. List every legal move for White.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♞ · · ·
2 │ ♙ ♙ ♙ · · ·
1 │ · ♔ · · · ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise. Black's knight has just checked from c3. List every legal move for White.*
<!-- /diagram -->

*Hint:* A knight check cannot be blocked. Look for king moves and for captures of c3.

### Independent exercises

```crown
fen: q1k3/6/6/6/2PP2/2KR2 b - - 0 1
line: Qa3+
show: after
caption: Exercise 1. After Black's Qa3+, how many legal moves does White have?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ ♛ · · · · ·
2 │ · · ♙ ♙ · ·
1 │ · · ♔ ♖ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1. After Black's Qa3+, how many legal moves does White have?*
<!-- /diagram -->

```crown
fen: r4k/6/6/6/PP4/3K2 b - - 0 1
line: Rd6+
show: after
caption: Exercise 2. After Black's Rd6+, list all of White's legal moves. Why is Kd2 illegal?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♜ · ♚
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♙ ♙ · · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2. After Black's Rd6+, list all of White's legal moves. Why is Kd2 illegal?*
<!-- /diagram -->

```crown
fen: 5k/4r1/1N4/R5/2P1P1/3K2 b - - 0 1
line: Rd5+ Nd3
show: after
caption: Exercise 3. White blocked with Nd3 instead of capturing. Is Black's rook now attacking anything new? Is White's knight safe?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ · · · ♜ · ·
4 │ · · · · · ·
3 │ ♖ · · ♘ · ·
2 │ · · ♙ · ♙ ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 3. White blocked with Nd3 instead of capturing. Is Black's rook now attacking anything new? Is White's knight safe?*
<!-- /diagram -->

### Answers with explanations
- **Guided:** Three moves: `Ka1`, `Kc1` and `bxc3`. The b2-pawn captures diagonally; the a2- and c2-pawns cannot (a2 attacks only b3; c2 attacks b3 and d3). `bxc3` wins the knight and is clearly best.
- **1.** Exactly one: `Kb1`. The queen checks along a3–b2–c1. The king cannot go to b2 (still on the diagonal), c2 and d2 hold White pawns, d1 holds a White rook. Nothing can capture on a3 or block on b2.
- **2.** Four moves: `Kc1`, `Kc2`, `Ke1`, `Ke2`. `Kd2` is illegal because d2 is still on the d-file, attacked by the rook.
- **3.** After `Nd3` the knight on d3 stands in front of the rook and is attacked by it, but it is defended by the c2- and e2-pawns, so `Rxd3+` would lose the rook for a knight. White is safe, yet `Nxd5+` was better: it simply won a rook.

### Summary
Check must be answered at once: move the king (not along the line!), block a line check, or capture the checker. Always look at all three before you choose.

### Next lesson
Chapter 6: checkmate, and the two essential mates with king and queen and with king and rook.

---

## Chapter 6 — Checkmate: King and Queen, King and Rook

### Learning objectives
- Recognise checkmate.
- Mate a lone king with **king and queen**.
- Mate a lone king with **king and rook**.
- Use the "box" method and avoid stalemate on the way.

### Prerequisites
Chapters 2 and 5.

### Explanation
**Checkmate** is check with no escape: the king cannot move, the check cannot be blocked, and the checker cannot be captured. Checkmate ends the game at once and wins it, even on a move that would otherwise complete a repetition or the move-count limit.

A lone queen or rook cannot mate by itself: **the attacking king must help.** On the 6 × 6 board the process is short, because the enemy king never stands more than two squares from an edge. A typical mate has the defending king on the edge, the attacking king two squares in front of it (in "opposition", one square between them), and the queen or rook checking along the edge.

### Illustrated example

```crown
fen: 3k2/6/3K2/6/6/Q5 w - - 0 1
line: Qa6#
claim: mate-in-1
caption: King and queen mate. The kings face each other on d6 and d4; the queen checks along the 6th rank.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · ♔ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♕ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*King and queen mate. The kings face each other on d6 and d4; the queen checks along the 6th rank.*
<!-- /diagram -->

After `Qa6#` the Black king cannot go to c5, d5 or e5 (all next to White's king) nor to c6 or e6 (on the queen's rank). Nothing can capture or block. Checkmate.

```crown
fen: 1k4/6/1K4/3R2/6/6 w - - 0 1
line: Rd6#
claim: only-mate-in-1
caption: King and rook mate, the same picture: the kings face each other on b6 and b4, and the rook checks along the edge.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ · · · ·
5 │ · · · · · ·
4 │ · ♔ · · · ·
3 │ · · · ♖ · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*King and rook mate, the same picture: the kings face each other on b6 and b4, and the rook checks along the edge.*
<!-- /diagram -->

### Step-by-step reasoning: the queen's box
The queen should stand a **knight's move away** from the enemy king. That leaves the king a small "box" without ever checking it pointlessly. Then bring your own king up.

```crown
fen: 6/4Q1/1k4/6/2K3/6 w - - 0 1
line: Qd5
claim: only-mate-in-3
caption: White mates in 3, and Qd5 (a knight's move from b4) is the only first move that does it. Proven by trying every defence.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · ♕ ·
4 │ · ♚ · · · ·
3 │ · · · · · ·
2 │ · · ♔ · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*White mates in 3, and Qd5 (a knight's move from b4) is the only first move that does it. Proven by trying every defence.*
<!-- /diagram -->

1. `Qd5` takes away rank 5 and the d-file. The Black king on b4 is confined to a3, a4, b3 and the squares around them.
2. Black's king shuffles (for example `Ka4`). White's king comes closer: `Kc3`.
3. Now the box is tiny, and the queen delivers mate on the edge.

The position after `Qd5 Ka4` shows the second step:

```crown
fen: 6/3Q2/k5/6/2K3/6 w - - 0 1
line: Kc3
claim: only-mate-in-2
caption: Mate in 2. The quiet king move Kc3 is the only move that forces it.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♕ · ·
4 │ ♚ · · · · ·
3 │ · · · · · ·
2 │ · · ♔ · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Mate in 2. The quiet king move Kc3 is the only move that forces it.*
<!-- /diagram -->

And after `Kc3 Ka3` there are two different mates:

```crown
fen: 6/3Q2/6/k1K3/6/6 w - - 0 1
line: Qa5#
claim: mate-in-1
caption: Mate in 1. Both Qa5# and Qb3# work here.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · ♕ · ·
4 │ · · · · · ·
3 │ ♚ · ♔ · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Mate in 1. Both Qa5# and Qb3# work here.*
<!-- /diagram -->

Here is a whole king-and-queen mate from a central start, as the Academy engine plays it. (This is one good line; the defence is the engine's choice, not a proof that nothing lasts longer.)

```crown
fen: 6/6/2k3/6/6/Q2K2 w - - 0 1
line: Kc2 Kb4 Qc3+ Ka4 Qe5 Kb4 Qd5 Ka4 Kc3 Ka3 Qa5#
claim: checkmate
caption: From the centre to mate in eleven half-moves: king up, queen boxes, king closes in, mate on the a-file.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · ♚ · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♕ · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*From the centre to mate in eleven half-moves: king up, queen boxes, king closes in, mate on the a-file.*
<!-- /diagram -->

### Step-by-step reasoning: the rook's method
The rook cuts the king off along a rank or file; the attacking king walks up to face the enemy king; then the rook checks along the edge. When the kings are not yet facing each other, a **waiting move** with the rook hands the move to the defender.

```crown
fen: 2k3/3R2/1K4/6/6/6 w - - 0 1
line: Rd3
claim: mate-in-2
caption: Mate in 2. The rook confines the king to the 6th rank; a waiting move along the d-file (Rd1, Rd2, Rd3 or Rd4) forces the king to b6, where Rd6 is mate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ · · ·
5 │ · · · ♖ · ·
4 │ · ♔ · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Mate in 2. The rook confines the king to the 6th rank; a waiting move along the d-file (Rd1, Rd2, Rd3 or Rd4) forces the king to b6, where Rd6 is mate.*
<!-- /diagram -->

After `Rd3` the Black king on c6 cannot go to d5 or d6 (the rook's file) or to b5 or c5 (next to White's king on b4). It must go to b6, and `Rd6#` follows.

```crown
fen: 6/6/2k3/6/6/R2K2 w - - 0 1
line: Kc2 Kd4 Ra4+ Kc5 Kc3 Kd5 Rd4+ Kc5 Rd3 Kb5 Rd5+ Kc6 Kc4 Kb6 Kb4 Kc6 Rd3 Kb6 Rd6#
claim: checkmate
caption: A whole king-and-rook mate as the engine plays it: cut off, approach, check the king back, wait, and mate on the 6th rank.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · ♚ · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♖ · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*A whole king-and-rook mate as the engine plays it: cut off, approach, check the king back, wait, and mate on the 6th rank.*
<!-- /diagram -->

### Common beginner mistakes
- Checking again and again with the queen, chasing the king around. Checks are not progress; **shrinking the box** is.
- Forgetting the king. Without the attacking king's help no mate is possible.
- Putting the queen next to the enemy king without protection: it is simply captured.
- Taking away the king's last square without giving check: that is **stalemate**, a draw (Chapter 7).

### Advanced insight
The 6 × 6 board helps the attacker. From any starting position the engine finds king-and-rook mates in a handful of moves, because the defending king is never more than two steps from an edge. Even so, the **50-move rule exists here in the form of 100 halfmoves (claimable) and 150 halfmoves (automatic)**: a careless attacker can still run out of moves. **Guidance:** practise these mates until you can do them without thinking.

### Worked example

```crown
fen: 5k/R5/2K3/6/6/6 w - - 0 1
line: Kd5 Kf5 Ra4 Kf6 Rf4#
claim: only-mate-in-3
caption: White mates in 3, and only the king move Kd5 achieves it. Proven exhaustively; the line shows the forced play.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ ♖ · · · · ·
4 │ · · ♔ · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*White mates in 3, and only the king move Kd5 achieves it. Proven exhaustively; the line shows the forced play.*
<!-- /diagram -->

*Reasoning.*
1. `Kd5`. The king steps towards the Black king. Notice that it now stands *on the rook's rank*, so the rook no longer covers e5 and f5, but the king itself covers e5 and e6. Black's only legal move is `Kf5`.
2. `Ra4`. The rook drops one rank and seals the 4th rank. On f5 the Black king has only one square left: f6 (e4 and f4 are on the rook's rank, e5 and e6 are next to White's king).
3. `Kf6` is forced, and `Rf4#` checks up the f-file. f5 is on the file; e5, e6 and e... every square on the e-file next to the Black king is covered by White's king on d5. There is no g-file to run to. Checkmate.

Notice how the **edge of the board** did half the work: on the 6 × 6 board the f-file *is* the edge.

### Guided exercise

```crown
fen: 3R2/6/6/3K1k/6/6 w - - 0 1
claim: only-mate-in-1
caption: Guided exercise. White to move and mate in 1. There is only one way.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♖ · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · ♔ · ♚
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise. White to move and mate in 1. There is only one way.*
<!-- /diagram -->

*Hint:* The kings already face each other on the 3rd rank (d3 and f3) with one square between them.

### Independent exercises

```crown
fen: 6/R5/6/4K1/6/4k1 w - - 0 1
claim: only-mate-in-1
caption: Exercise 1. Mate in 1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ ♖ · · · · ·
4 │ · · · · · ·
3 │ · · · · ♔ ·
2 │ · · · · · ·
1 │ · · · · ♚ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1. Mate in 1.*
<!-- /diagram -->

```crown
fen: 6/6/2K2k/6/6/4Q1 w - - 0 1
claim: only-mate-in-2
caption: Exercise 2. King and queen: mate in 2. The first move is quiet.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · ♔ · · ♚
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · ♕ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2. King and queen: mate in 2. The first move is quiet.*
<!-- /diagram -->

```crown
fen: 6/6/3R2/k5/3K2/6 w - - 0 1
claim: only-mate-in-2
caption: Exercise 3. King and rook: mate in 2. The first move is quiet.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · · ♖ · ·
3 │ ♚ · · · · ·
2 │ · · · ♔ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 3. King and rook: mate in 2. The first move is quiet.*
<!-- /diagram -->

### Answers with explanations
- **Guided:** `Rf6#`. The rook checks down the f-file. The Black king on f3 cannot use f2 or f4 (on the file) or e2, e3, e4 (all next to White's king on d3). Checkmate.
- **1.** `Ra1#`. The kings face each other on e3 and e1. The rook checks along the 1st rank, covering d1 and f1, and White's king covers d2, e2 and f2.
- **2.** `Kd4!` (the only move that mates in 2). The queen on e1 already keeps the Black king on f4 away from the e-file and the 1st rank. After `Kd4` Black has two moves: `Kf5`, met by `Qe5#`, or `Kf3`, met by `Qf1#` or `Qe3#`.
- **3.** `Kc2!` The rook on d4 seals the 4th rank. After `Kc2` the Black king on a3 cannot go to b2 or b3 (next to White's king) or to a4 or b4 (the rook's rank), so `Ka2` is forced, and `Ra4#` mates along the a-file: a1, b1, b2 and b3 are all covered.

### Summary
Checkmate needs teamwork: the queen or rook builds a box or cuts off the king; your king walks up to face the enemy king; then the major piece mates on the edge. Do not chase with checks. Watch out for stalemate.

### Next lesson
Chapter 7: stalemate, the trap that turns a won game into a draw, and how to use it when you are losing.

---

## Chapter 7 — Stalemate and the Other Draws

### Learning objectives
- Recognise **stalemate**: no legal move, but not in check. It is a draw.
- Avoid stalemating the opponent when you are winning.
- Use stalemate as a rescue when you are losing.
- Know the other ways a Crown game is drawn.

### Prerequisites
Chapters 5–6.

### Explanation
If the player to move has **no legal move** and is **not in check**, the game ends at once in a draw by **stalemate**. The side that was "winning" gets only half a point. This is the commonest way Apprentices throw away won endings.

Crown & Calculation (adjudication policy `crown-adj-1`) also draws a game:
- **automatically**, when only the two kings remain (bare kings), after the same position occurs for the fifth time, or after 150 halfmoves (75 moves each) with no capture and no pawn move;
- **on a claim** by the player to move, after the third occurrence of the same position or after 100 halfmoves without a capture or pawn move;
- **by agreement**, but only after each side has made at least ten moves.

Note one Crown difference: only *bare kings* is an automatic "dead position". King and knight against king, for example, is **not** drawn automatically; play continues until a repetition or move-count draw (or agreement). And checkmate on the final move always beats every draw rule.

### Illustrated example

```crown
fen: 6/1Q4/6/2K3/6/k5 w - - 0 1
line: Qb3
claim: stalemate
caption: The trap. Qb3 looks like it tightens the net, but the Black king on a1 has no legal move and is not in check: stalemate, a draw.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♕ · · · ·
4 │ · · · · · ·
3 │ · · ♔ · · ·
2 │ · · · · · ·
1 │ ♚ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The trap. Qb3 looks like it tightens the net, but the Black king on a1 has no legal move and is not in check: stalemate, a draw.*
<!-- /diagram -->

```crown
fen: 6/1Q4/6/2K3/6/k5 w - - 0 1
line: Qb2#
claim: only-mate-in-1
caption: The same position. Qb2# is the only mate: the queen stands next to the king, protected by White's king on c3.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♕ · · · ·
4 │ · · · · · ·
3 │ · · ♔ · · ·
2 │ · · · · · ·
1 │ ♚ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The same position. Qb2# is the only mate: the queen stands next to the king, protected by White's king on c3.*
<!-- /diagram -->

### Step-by-step reasoning
Before every move in a winning ending, ask: **"After my move, does my opponent have a legal move?"**
1. List the defending king's squares: in the diagram a2, b1 and b2.
2. After `Qb3`: a2 is covered by the queen (diagonal), b1 and b2 by the queen (b-file) and b2 also by White's king. Zero squares.
3. Is the king in check after `Qb3`? No: b3 does not attack a1. Zero moves and no check means **stalemate**.
4. After `Qb2#`: the same three squares are covered, *and* the king is in check. That is mate.

### Common beginner mistakes
- Grabbing the last enemy pawn or piece and leaving the king with no moves.
- Making a "quiet" queen move a knight's distance away when the enemy king is already in the corner. In the corner, a knight's-move box means stalemate.
- Thinking a big material lead makes the result safe. Stalemate ignores material.

### Advanced insight
When **you** are losing, look for stalemate. If your king has no legal moves, every one of your other pieces becomes a "desperado": you would be glad to lose it. A rook that checks again and again, and is stalemate if captured, can save a hopeless game.

```crown
fen: 6/1r4/1P4/1K2Q1/6/5k b - - 0 1
line: Rxb4+
claim: best Rxb4+
caption: Black is a queen down, but the king on f1 has no legal move. The engine's choice: Rxb4+, offering the rook.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♜ · · · ·
4 │ · ♙ · · · ·
3 │ · ♔ · · ♕ ·
2 │ · · · · · ·
1 │ · · · · · ♚
  └─────────────
    a b c d e f    Black to move
```
*Black is a queen down, but the king on f1 has no legal move. The engine's choice: Rxb4+, offering the rook.*
<!-- /diagram -->

```crown
fen: 6/1r4/1P4/1K2Q1/6/5k b - - 0 1
line: Rxb4+ Kxb4
claim: stalemate
show: after
caption: If White's king takes the rook, Black has no legal move and is not in check: stalemate. If the king walks away instead, the rook keeps checking.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · ♔ · · · ·
3 │ · · · · ♕ ·
2 │ · · · · · ·
1 │ · · · · · ♚
  └─────────────
    a b c d e f    Black to move
```
*If White's king takes the rook, Black has no legal move and is not in check: stalemate. If the king walks away instead, the rook keeps checking.*
<!-- /diagram -->

### Worked example
Why is this position a draw, with Black to move?

```crown
fen: 2k3/2P3/2K3/6/6/6 b - - 0 1
claim: stalemate
caption: Black to move has no legal move. Stalemate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ · · ·
5 │ · · ♙ · · ·
4 │ · · ♔ · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Black to move has no legal move. Stalemate.*
<!-- /diagram -->

*Solution.* The Black king on c6 could go to b6 or d6, but both are attacked by the White pawn on c5 (a White pawn attacks diagonally *forwards*, here b6 and d6). b5 and d5 are next to White's king on c4. c5 itself is occupied by the pawn, which is defended by the king. Black is not in check. Stalemate. **Guidance:** in king-and-pawn endings, a defending king that blocks the square in front of the pawn very often reaches a stalemate like this one.

### Guided exercise

```crown
fen: 5Q/6/6/6/k5/2K3 w - - 0 1
claim: only-mate-in-1
caption: Guided exercise. White mates in 1. One natural queen move would stalemate instead. Which?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♕
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♚ · · · · ·
1 │ · · ♔ · · ·
  └─────────────
    a b c d e f    White to move
```
*Guided exercise. White mates in 1. One natural queen move would stalemate instead. Which?*
<!-- /diagram -->

*Hint:* The Black king on a2 has a1, a3, b1, b2 and b3 to think about.

### Independent exercises

```crown
fen: 3Q2/6/4K1/6/5k/6 w - - 0 1
claim: only-mate-in-3
caption: Exercise 1. Mate in 3. First find the queen move that stalemates at once, and avoid it.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♕ · ·
5 │ · · · · · ·
4 │ · · · · ♔ ·
3 │ · · · · · ·
2 │ · · · · · ♚
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1. Mate in 3. First find the queen move that stalemates at once, and avoid it.*
<!-- /diagram -->

```crown
fen: 2K2k/1r4/4QP/6/6/6 b - - 0 1
claim: best Rc5+
caption: Exercise 2. Black is lost on material. Find the engine's saving idea.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♔ · · ♚
5 │ · ♜ · · · ·
4 │ · · · · ♕ ♙
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise 2. Black is lost on material. Find the engine's saving idea.*
<!-- /diagram -->

3. A game reaches White king on d4 and Black king on c6, with nothing else on the board. What happens?
4. After 100 halfmoves with no capture and no pawn move, is the game drawn automatically?

### Answers with explanations
- **Guided:** `Qb2#` mates (the queen is protected by the king on c1 and covers a1, a3, b1 and b3). The trap is `Qc3`, which covers a1, a3, b2 and b3 while the king covers b1: stalemate.
- **1.** The stalemate trap is `Qd1`: the Black king on f2 would have no square (e1, f1 and e2 are covered by the queen; e3 and f3 by White's king). The solution is `Kd3!`, the only move that mates in 3. Black has three replies: `Kf3` (met by `Qf6#`), `Ke1` and `Kf1`; after either of the last two, White's king or queen closes the last door and the queen mates on the next move. The checker proves every line.
- **2.** `Rc5+`. Black's king on f6 has no legal move (e5, e6 and f5 are covered by the queen and the f4-pawn), so the rook is a desperado. If `Kxc5`, Black is stalemated. This is the engine's judgement of the best try; it rates the alternatives as lost.
- **3.** Bare kings: the game is drawn **automatically** at once.
- **4.** No. At 100 halfmoves the player to move may *claim* a draw. The draw is automatic only at 150 halfmoves.

### Summary
Stalemate (no legal move, no check) is a draw. When winning, always check that the opponent will have a legal move. When losing, look for stalemate tricks. Bare kings, fivefold repetition and 150 halfmoves draw automatically; threefold repetition and 100 halfmoves may be claimed.

### Next lesson
Chapter 8 collects the simplest winning patterns: the back-rank mate, the rook ladder, the protected queen mate, and grabbing what hangs.

---

## Chapter 8 — Simple Winning Patterns

### Learning objectives
- Recognise four patterns that win games: **free material**, the **back-rank mate**, the **two-rook ladder**, and the **protected queen mate**.
- Look for them in every position.

### Prerequisites
Chapters 4–7.

### Explanation
Most games between beginners are decided by a few simple patterns. Learn their shapes.
1. **Free material.** A hanging piece (Chapter 4) is simply taken.
2. **Back-rank mate.** A king on its first or last rank, walled in by its own pawns, is mated by a rook or queen along that rank. On a 6 × 6 board this is frequent, because the pawns start right in front of the king, and the king cannot castle away.
3. **The ladder.** Two rooks (or rook and queen) take turns checking on neighbouring ranks or files, pushing the king to the edge. No help from the king is needed.
4. **The protected queen.** A queen placed right next to the enemy king, protected by another piece (often its own king), gives mate whenever the king's other squares are covered.

### Illustrated example

```crown
fen: 4k1/3ppp/6/6/6/R2K2 w - - 0 1
line: Ra6#
claim: only-mate-in-1
caption: Back-rank mate. The Black king on e6 is walled in by its own pawns on d5, e5 and f5. Ra6 checks along the 6th rank.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♖ · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Back-rank mate. The Black king on e6 is walled in by its own pawns on d5, e5 and f5. Ra6 checks along the 6th rank.*
<!-- /diagram -->

### Step-by-step reasoning: the ladder

```crown
fen: K5/6/6/5k/1R4/R5 w - - 0 1
line: Ra3+ Ke4 Rb4+ Ke5 Ra5+ Ke6 Rb6#
claim: checkmate
caption: The two-rook ladder. One rook guards a rank, the other checks on the next rank; then they swap roles. The king is pushed up to the 6th rank and mated.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♔ · · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ♚
2 │ · ♖ · · · ·
1 │ ♖ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The two-rook ladder. One rook guards a rank, the other checks on the next rank; then they swap roles. The king is pushed up to the 6th rank and mated.*
<!-- /diagram -->

1. The rook on b2 guards the 2nd rank. `Ra3+` checks on the 3rd rank: the king must climb to the 4th.
2. Now the a3-rook guards the 3rd rank, and `Rb4+` checks on the 4th: the king climbs again.
3. `Ra5+` and `Rb6#` repeat the step. On the 6th rank there is nowhere further to climb.
4. Keep the rooks **far from the enemy king**: here they work on the a- and b-files while the king is on the e- and f-files, so it can never attack them.

### Common beginner mistakes
- Opening the back rank for the enemy by moving the wrong pieces, or forgetting that your own king can be back-rank mated as well.
- Running the ladder with a rook next to the enemy king, where it can be captured.
- Placing the queen next to the enemy king without protection.
- Looking only for mates and missing a free piece (or the other way round).

### Advanced insight
On this board the back rank is exactly **one pawn-step** away from the pawn line, and there is no castling to tuck the king into a corner. **Guidance:** in the opening and middlegame, check every enemy rook and queen move for a back-rank threat, and when your king has no flight square, consider making one with a pawn move.

### Worked example

```crown
fen: 2k3/1p2p1/pPr1q1/P1Q1Pp/2P2P/3K1R b - - 0 26
claim: puzzle pz-21w88z
caption: Academy puzzle pz-21w88z. Black to move. Free material and a mate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ · · ·
5 │ · ♟ · · ♟ ·
4 │ ♟ ♙ ♜ · ♛ ·
3 │ ♙ · ♕ · ♙ ♟
2 │ · · ♙ · · ♙
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Academy puzzle pz-21w88z. Black to move. Free material and a mate.*
<!-- /diagram -->

*Solution.* The White queen on c3 stands right in front of Black's rook on c4 and nothing defends it: the king on d1 does not touch c3, and the c2-pawn only defends b3 and d3. `Rxc3` takes the queen. It is more than material: Black now threatens `Qxc2` with mate. The checker proves that Black mates in 3 from the start:

```crown
fen: 2k3/1p2p1/pPr1q1/P1Q1Pp/2P2P/3K1R b - - 0 26
line: Rxc3 Ke1 Qxc2 e4 Qe2#
claim: mate-in-3
caption: Proof: after Rxc3, every White defence loses to Qxc2 and a queen mate (one line shown).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · ♚ · · ·
5 │ · ♟ · · ♟ ·
4 │ ♟ ♙ ♜ · ♛ ·
3 │ ♙ · ♕ · ♙ ♟
2 │ · · ♙ · · ♙
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    Black to move
```
*Proof: after Rxc3, every White defence loses to Qxc2 and a queen mate (one line shown).*
<!-- /diagram -->

For example `1...Rxc3 2. Ke1 Qxc2` (threatening both `Qe2#` and `Qc1#`) `3. e4 Qe2#`. If `2. Kc1` or `2. Re1`, then `2...Qxc2#` at once.

### Guided exercise

```crown
fen: k5/p3q1/P5/1PR2P/5K/6 w - - 0 32
claim: puzzle pz-1olai4r
caption: Academy puzzle pz-1olai4r. White to move and mate in 1.
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
*Academy puzzle pz-1olai4r. White to move and mate in 1.*
<!-- /diagram -->

*Hint:* The Black king on a6 is boxed in by its own a5-pawn and by White's a4-pawn, which attacks b5.

### Independent exercises

```crown
fen: r2k2/1R1p2/p1nN1r/5P/5K/4R1 w - - 0 20
claim: puzzle pz-ewndyc
caption: Exercise 1 (pz-ewndyc). White to move and mate in 1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ · ·
5 │ · ♖ · ♟ · ·
4 │ ♟ · ♞ ♘ · ♜
3 │ · · · · · ♙
2 │ · · · · · ♔
1 │ · · · · ♖ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 1 (pz-ewndyc). White to move and mate in 1.*
<!-- /diagram -->

```crown
fen: r2kn1/pR1p2/2PN1r/5P/5K/6 w - - 0 21
claim: puzzle pz-1lq92r
caption: Exercise 2 (pz-1lq92r). White to move and mate in 1.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · · ♚ ♞ ·
5 │ ♟ ♖ · ♟ · ·
4 │ · · ♙ ♘ · ♜
3 │ · · · · · ♙
2 │ · · · · · ♔
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (pz-1lq92r). White to move and mate in 1.*
<!-- /diagram -->

```crown
fen: 2k3/6/p1KQr1/P5/6/6 w - - 19 61
claim: puzzle pz-1muyn8j
caption: Exercise 3 (pz-1muyn8j). White to move and mate in 3. Start by taking something.
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
*Exercise 3 (pz-1muyn8j). White to move and mate in 3. Start by taking something.*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-1olai4r):** `Rc6#`. The rook runs up the open c-file and checks along the 6th rank. b6 is on the rook's rank, a5 holds Black's own pawn and b5 is attacked by White's a4-pawn. The Black queen on e5 cannot capture on c6 or block on b6.
- **1 (pz-ewndyc):** `Re6#`. The rook flies from e1 to e6 and checks the king on d6. The rook is protected by the knight on d4, so the king cannot take it; c5 is covered by the rook on b5, e5 by the rook on e6 (file), c6 by the knight on d4 and by the e6-rook through the king. The protected rook acts like the protected queen of pattern 4.
- **2 (pz-1lq92r):** `Rxd5#`. The rook takes the d5-pawn with check on the d-file. It is protected by the c4-pawn, so the king cannot recapture. c5 and e5 are on the rook's rank, c6 is covered by the d4-knight, and e6 is Black's own knight.
- **3 (pz-1muyn8j):** `Qxe4+`. Free material with check, and then a protected-queen mate:

```crown
fen: 2k3/6/p1KQr1/P5/6/6 w - - 19 61
line: Qxe4+ Kd6 Qd5#
claim: mate-in-3
caption: Proof of the mate in 3, with one line: 1. Qxe4+ Kd6 2. Qd5#.
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
*Proof of the mate in 3, with one line: 1. Qxe4+ Kd6 2. Qd5#.*
<!-- /diagram -->

  If `1...Kd6 2. Qd5#`: the queen stands next to the king, protected by White's king on c4. If `1...Kb6`, then `2. Kb4` (or `2. Qd5`) forces `2...Ka6`, and the queen mates on the next move (`3. Qc6#` or `3. Qe6#` after `2. Kb4`; `3. Qb5#` after `2. Qd5`).

### Summary
Take free material. Watch the back rank. Ladder with two rooks kept far from the king. Mate with a protected queen. These four patterns win most beginner games, and they remain the raw material of every combination in Book II.

### Next lesson
Chapter 9, the last of Book I: the pawn's road to the crown.

---

## Chapter 9 — The Pawn's Road: Four Steps to the Crown

### Learning objectives
- Count how many moves a pawn needs to promote.
- Win (or stop) a pawn race with the **rule of the square**.
- Choose the right promotion piece: queen, rook or knight.

### Prerequisites
Chapters 3, 6 and 7.

### Explanation
A White pawn starts on rank 2 and promotes on rank 6. Because pawns move only one square at a time, it needs exactly **four moves**: to rank 3, 4, 5 and then 6. Its **first step** already brings it into the middle of the board; after that it is only **three steps** from the crown. The same is true for Black, from rank 5 down to rank 1.

Three steps is very close. On the eight-by-eight board a pawn that has moved once is usually five or six steps from promotion. Here, **promotion is a real threat from the opening onwards.** Pawns meet almost at once (after one move each, pawns on the same file block each other) and every pawn capture moves a pawn one file sideways *and* one step nearer to promotion.

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: c3 f4 d3 c4 d4 exd4 Nf3 d3 b3 dxe2+ Kxe2
show: after
caption: A line the Academy engine likes from the start. Black's e-pawn captures on d4, steps to d3 and captures on e2 with check: one step from promotion on move 5. White must take it.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ · ♟ · ·
4 │ · · ♟ · · ♟
3 │ · ♙ ♙ · · ♘
2 │ ♙ · · · ♔ ♙
1 │ ♖ ♘ ♕ · · ♖
  └─────────────
    a b c d e f    Black to move
```
*A line the Academy engine likes from the start. Black's e-pawn captures on d4, steps to d3 and captures on e2 with check: one step from promotion on move 5. White must take it.*
<!-- /diagram -->

### Illustrated example: the rule of the square

```crown
fen: 6/6/5k/1P4/6/5K w - - 0 1
line: b4 Ke5 b5 Kd6 b6=Q+
claim: best b4
caption: White to move. The pawn on b3 needs three moves. Black's king on f4 is outside the pawn's "square", so the pawn promotes.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · · · · ♚
3 │ · ♙ · · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*White to move. The pawn on b3 needs three moves. Black's king on f4 is outside the pawn's "square", so the pawn promotes.*
<!-- /diagram -->

The **square** of a pawn: draw a square with one side running from the pawn to its promotion square, extending towards the defending king. For the b3-pawn (three moves to b6) the square has corners b3, e3, e6 and b6. **If the defending king can step inside the square on its move, it catches the pawn; otherwise the pawn promotes** (when no other pieces interfere).
1. White to move plays `b4`; the square shrinks to b4–d4–d6–b6.
2. Black's king on f4 can only reach e-file squares: still outside. After `b5` and `b6=Q+` the queen arrives with check.
3. With **Black to move**, the king steps into the square at once (`Ke3`, a corner of the square) and catches the pawn:

```crown
fen: 6/6/5k/1P4/6/5K b - - 0 1
line: Ke3 b4 Kd4 b5 Kc5 b6=Q+ Kxb6
show: after
caption: Black to move: the king enters the square with Ke3 and wins the pawn.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♚ · · · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    White to move
```
*Black to move: the king enters the square with Ke3 and wins the pawn.*
<!-- /diagram -->

**Guidance:** the rule of the square is a quick count, not a proof. On a small board the attacking king is often close enough to help. Here, for example, if Black chooses `Ke4` instead of `Ke3`, the engine shows that White's king can walk over in support with `Ke2`, and White keeps winning chances.

### Step-by-step reasoning: choosing the promotion piece
1. **Queen** by default: it is the strongest piece.
2. **Knight** when the knight's jump gives a check or fork the queen cannot (Chapter 3, `d6=N+`).
3. **Rook** when a queen would stalemate the opponent:

```crown
fen: 6/1P4/k5/6/K5/6 w - - 0 1
line: b6=Q
claim: stalemate
caption: The careless promotion b6=Q leaves the Black king on a4 with no legal move: stalemate.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♙ · · · ·
4 │ ♚ · · · · ·
3 │ · · · · · ·
2 │ ♔ · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The careless promotion b6=Q leaves the Black king on a4 with no legal move: stalemate.*
<!-- /diagram -->

```crown
fen: 6/1P4/k5/6/K5/6 w - - 0 1
line: b6=R
claim: best b6=R
caption: The engine's choice is b6=R. The rook does not cover the diagonal a5–b6, so Black keeps a legal move, and king and rook win (Chapter 6).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · ♙ · · · ·
4 │ ♚ · · · · ·
3 │ · · · · · ·
2 │ ♔ · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The engine's choice is b6=R. The rook does not cover the diagonal a5–b6, so Black keeps a legal move, and king and rook win (Chapter 6).*
<!-- /diagram -->

### Common beginner mistakes
- Pushing a pawn without counting whether the enemy king can catch it.
- Promoting to a queen automatically and stalemating the opponent.
- Forgetting that promotion is compulsory: a pawn on the 5th rank (for Black, the 2nd) *must* become a piece if it moves.
- Leaving a promotion square undefended when the new piece will be captured at once.

### Advanced insight
A White pawn on rank 4 (a Black pawn on rank 3) is only **two moves** from promotion, which is as close as a queen check. **Guidance:** in the middlegame, treat an advanced pawn as a piece that threatens to become a queen; often the right defence is not to win material but to blockade the pawn with a piece on the square in front of it.

### Worked example

```crown
fen: 5R/6/6/2p3/1k4/3K2 b - - 0 46
claim: puzzle pz-c0qvzm
caption: Academy puzzle pz-c0qvzm. Black to move. The pawn on c3 is two steps from c1.
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
*Academy puzzle pz-c0qvzm. Black to move. The pawn on c3 is two steps from c1.*
<!-- /diagram -->

*Solution.* `1...c2+` (the pawn steps forward with check: a Black pawn on c2 attacks b1 and d1). White's king cannot take it, because Black's king on b2 defends c2. After `2. Ke2` (the Academy's line), `2...c1=Q` promotes, and the new queen on c1 is protected by the king on b2. Black wins: queen against rook.

### Guided exercise

```crown
fen: 6/p3Pr/k5/4K1/6/6 w - - 0 33
claim: puzzle pz-12j3cmu
caption: Academy puzzle pz-12j3cmu. White to move and win.
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
*Academy puzzle pz-12j3cmu. White to move and win.*
<!-- /diagram -->

*Hint:* The pawn on e5 is attacked by the rook on f5 and is not defended. What can it do before it is captured?

### Independent exercises

```crown
fen: 5k/6/1Pp1P1/2K3/p5/6 b - - 0 36
claim: puzzle pz-1cphbbp
caption: Exercise 1 (pz-1cphbbp). Black to move and win.
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
*Exercise 1 (pz-1cphbbp). Black to move and win.*
<!-- /diagram -->

```crown
fen: 6/rP2k1/3p1p/6/2N1P1/4K1 w - - 0 25
claim: puzzle pz-13ahfji
caption: Exercise 2 (pz-13ahfji). White to move and win.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ ♜ ♙ · · ♚ ·
4 │ · · · ♟ · ♟
3 │ · · · · · ·
2 │ · · ♘ · ♙ ·
1 │ · · · · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*Exercise 2 (pz-13ahfji). White to move and win.*
<!-- /diagram -->

```crown
fen: 3K2/2P3/3k2/6/2n3/6 w - - 0 52
claim: puzzle pz-1ftvz6i
caption: Exercise 3 (pz-1ftvz6i). White to move and win.
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
*Exercise 3 (pz-1ftvz6i). White to move and win.*
<!-- /diagram -->

### Answers with explanations
- **Guided (pz-12j3cmu):** `e6=Q`. The pawn steps to the last rank and becomes a queen. The rook on f5 cannot touch e6 (it moves only in straight lines), while the new queen attacks the rook along the diagonal e6–f5. White wins: queen against rook.
- **1 (pz-1cphbbp):** `a1=Q+`. The a2-pawn promotes with check along the diagonal a1–b2–c3. Nothing can stop or capture the new queen.
- **2 (pz-13ahfji):** `b6=Q`. The rook on a5 attacks the b5-pawn along the rank but cannot stop it moving forward, and it cannot attack b6. The new queen even attacks the rook on a5.
- **3 (pz-1ftvz6i):** `c6=Q`. The promotion square c6 is next to White's king on d6, so the new queen is protected; the Black king on d4 and knight on c2 are too far away to win it.

### Summary
A pawn needs four moves from its starting square, so after its first step it is three steps from the crown. Count races with the rule of the square, but remember that kings can help on this small board. Promote to a queen unless a knight's fork or a rook's safety (no stalemate) is better.

### Next lesson
You have finished Book I. **Book II: The Duelist** begins with the fork, the most important tactic on the 6 × 6 board.
