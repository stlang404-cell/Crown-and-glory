# The Sovereign's Grimoire
## From Apprentice to Chess Sovereign

*The official strategy textbook of Crown & Calculation — six-square chess (crown-la6-v1), the Federation and the Crown Exchange.*

Every board in this book is checked by `tools/grimoire/check.ts` against the game's real rules: legality, every move
written in a line, and every "mate in N" claim (proved exhaustively). "Best move" claims are the engine's judgement under
the Academy puzzle policy and are labelled as such. The official rules are in [RULEBOOK.md](RULEBOOK.md).
Money in this book is the game's fictional dollars.

## Contents

- Book I — The Apprentice
  - Chapter 1 — The Board and Its Coordinates
  - Chapter 2 — The Pieces I: Rook, Queen and King
  - Chapter 3 — The Pieces II: Knight and Pawn
  - Chapter 4 — Capturing and Piece Safety
  - Chapter 5 — Check and Escaping Check
  - Chapter 6 — Checkmate: King and Queen, King and Rook
  - Chapter 7 — Stalemate and the Other Draws
  - Chapter 8 — Simple Winning Patterns
  - Chapter 9 — The Pawn's Road: Four Steps to the Crown
- Book II — The Duelist
  - Chapter 1 — Double Attacks and Forks
  - Chapter 2 — Pins
  - Chapter 3 — Skewers
  - Chapter 4 — Discovered Attacks and Discovered Check
  - Chapter 5 — Removing the Defender and Overloading
  - Chapter 6 — Deflection and Decoy
  - Chapter 7 — Trapped Pieces
  - Chapter 8 — The Zwischenzug (the In-Between Move)
  - Chapter 9 — Mate Threats and Sacrifices
  - Chapter 10 — Promotion Tactics
  - Chapter 11 — Forcing-Move Calculation
- Book III — The Strategist
  - The Strategist's Ledger: where the numbers come from
  - Chapter III.1 — The First Ten Doors: Development on Six Files
  - Chapter III.2 — The Crown Without a Castle: King Safety
  - Chapter III.3 — The Heart of the Board: Centre and Space
  - Chapter III.4 — The Double-Edged Hourglass: Tempo, Initiative and Coordination
  - Chapter III.5 — The Bones of the Position: Pawn Structures
  - Chapter III.6 — Open Roads and Safe Harbours: Files, Weak Squares and Outposts
  - Chapter III.7 — Unequal Scales: Material Imbalances and Trading Decisions
  - Chapter III.8 — The Long Spell: Planning and Prophylaxis
  - Chapter III.9 — Turning Gold into Crowns: Conversion, Tactics and Patience
- Book IV — The Master
  - Chapter IV.1 — The Branching Path: Candidate Moves and Calculation
  - Chapter IV.2 — The Chain of Compulsion: Evaluating Forcing Lines
  - Chapter IV.3 — The Unbroken Ward: Defensive Resources
  - Chapter IV.4 — The Crown's March: King Activity and King-and-Pawn Endings
  - Chapter IV.5 — The Tower's Patience: Rook Endings
  - Chapter IV.6 — Knights in Moonlight, Queens at Dawn: Knight and Queen Endings
  - Chapter IV.7 — The Law of the Realm: Draws, Fortresses and the Rules
  - Chapter IV.8 — The Sovereign's Hourglass: Conversion, Time and Practical Decisions
- Book V — The Sovereign
  - Chapter V.1 — The Pruned Tree: calculation and candidate discipline
  - Chapter V.2 — Complexity, Imbalance and the Art of Simplifying
  - Chapter V.3 — Reading the Opponent: profiling and style adaptation
  - Chapter V.4 — The Tournament Hall: Swiss, leagues and knockouts
  - Chapter V.5 — Critical Moments, Stronger Opponents and Predictable Mistakes
  - Chapter V.6 — The Engine's Mirror: postgame study, evaluations and losses
  - Chapter V.7 — The Sixty-Four Gates: building a repertoire
  - Chapter V.8 — The Unbound Challenge: preparing to face Sovereign Unbound
- Book VI — The Oracle
  - Chapter VI.1 — The Language of Chance: probability, prices and expected value
  - Chapter VI.2 — The Engine of Prices: the LMSR market maker, liquidity and slippage
  - Chapter VI.3 — Measuring the Oracle: calibration and the Brier score
  - Chapter VI.4 — Sizing the Stake: Kelly as a ceiling, risk as a discipline
  - Chapter VI.5 — Tournament Forecasting: correlated outcomes and hedging
  - Chapter VI.6 — Live Odds and the Uncertain Board
  - Chapter VI.7 — The Crowd and the Mirror: NPC traders, overconfidence and the long run
- The Twelve-Week Program — From Apprentice to Sovereign
  - How the program uses the game
  - Level adjustments
  - Daily session variants
  - Week 1 — The Rules and the Board
  - Week 2 — Piece Safety and Basic Tactics
  - Week 3 — Checkmates and Defence
  - Week 4 — Combinations
  - Week 5 — Openings
  - Week 6 — Pawn Structure
  - Week 7 — Endgames
  - Week 8 — Calculation
  - Week 9 — Positional Play and Defence
  - Week 10 — Tournaments and Time
  - Week 11 — Engine Analysis and Preparation
  - Week 12 — Review and the Sovereign Challenge
  - Final progress assessment
- Glossary of the Grimoire

---

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

---

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

---

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
claim: tablebase win-in-9
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

---

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

---

# Book V — The Sovereign

*Elite competitive thinking for Crown & Calculation (variant crown-la6-v1)*

> The Apprentice learns how the pieces move. The Duellist learns how they strike. The Strategist learns
> why they stand where they stand, and the Master learns how a won position is turned into a won game.
> The Sovereign learns something harder: how to decide well **under pressure, against a particular
> opponent, with a clock running, and then how to learn honestly from what happened.**

This book assumes you have worked through Books I–IV (*The Apprentice*, *The Duellist*, *The Strategist* and
*The Master*) and that you know the rules in the Rulebook: the 6×6 board, kings on the d-file, no bishops, no
castling, no double pawn step and no en passant, promotion on the far rank to a queen, rook or knight, and the Crown
draw rules (bare kings and fivefold repetition are automatic; threefold and the 100-halfmove rule must be claimed).

**Two kinds of statement in this book.** Every claim is marked as one of:

* **[Demonstrated]**: checked against the game itself: a board proven by the Grimoire checker
  (`tools/grimoire/check.ts`, exhaustive for mate claims), a verified Academy puzzle (policy
  crown-puzzle-verify-2), a value read from the game's code, or a measurement in the project's own reports
  (for example docs/V8_SOVEREIGN_STANDARD.md).
* **[Counsel]**: advice from practical experience of competitive games. It is reasonable but **not measured** for
  this variant. Test it in your own games and keep what works for you.

Engine scores are given in **centipawns (cp)** from the side to move. The game turns them into an **expected score**
(0 to 1) with the map crown-outcome-map-v2. Chapter V.6 explains that scale.

---

## Chapter V.1 — The Pruned Tree: calculation and candidate discipline

### Learning objectives
* Build a candidate list in a fixed order and then prune it with reasons, not hunches.
* Recognise the two edges of the 6×6 board (the sixth/first rank and the a/f files) as mating walls.
* Find quiet moves that a checks-first habit would miss.

### Prerequisites
Book II, *The Duellist* (checks, captures, threats; forks and pins). Book III's chapter on king safety.

### Explanation
A **calculation tree** is every line you consider: your candidate moves, the opponent's replies to each, your
answers, and so on. Even on a 6×6 board it grows fast. A position with 25 legal moves and 25 replies already gives
625 two-ply lines. Strong players do not search harder. They **prune**: they stop examining a branch as soon as one
good reply refutes it.

The discipline has three parts.

1. **Order the candidates.** First checks, then captures, then threats (moves that create a new attack), then quiet
   moves that take squares from the enemy king or improve your worst piece. The order affects only *where you start*.
   It never allows you to skip the quiet moves.
2. **Refute, then drop.** To reject a candidate you need **one** defence that holds. You do not need to see every
   defence. To *accept* a candidate you must answer **every** reasonable defence. That asymmetry is the whole art of
   pruning.
3. **Name the refutation.** Write it (in your head or on paper) as "Qe5+? Kxe5". A named refutation stops you
   coming back to a dead branch, and that wastes more clock time in practice than anything else ([Counsel]).

On this board the edges matter more than in orthodox chess. A king on its sixth rank (or White's on its first) has
no squares behind it, and a king on the a- or f-file has no squares to one side. Many Crown mates come from a single
rook or queen sealing the one remaining line. ([Demonstrated] in every board below.)

### Illustrated example

```crown
fen: 3k2/K5/1p3R/4Q1/3Np1/1r1n2 w - - 0 1
line: Qd4+ Kc6 Rf6#
claim: only-mate-in-2
caption: White to move. Ten checks are available; exactly one mates in two.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ ♔ · · · · ·
4 │ · ♟ · · · ♖
3 │ · · · · ♕ ·
2 │ · · · ♘ ♟ ·
1 │ · ♜ · ♞ · ·
  └─────────────
    a b c d e f    White to move
```
*White to move. Ten checks are available; exactly one mates in two.*
<!-- /diagram -->

White's king on a5 is exposed, and Black's e2-pawn is one step from promoting. White cannot afford a slow move.
Every check is a candidate. **[Demonstrated]** The checker proved by exhaustive search that **1.Qd4+** is the only
move that forces mate in two.

### Step-by-step reasoning
List the ten checks and refute each one with a single defence. The refutations below are exact: in each case, after
that defence White has no mate on the next move.

| Candidate | One defence that refutes it | Why |
|---|---|---|
| Ne4+ | …Ke6 (also …Kd5, …Ke5) | the king walks off the edge |
| Nc4+ | …Kc6 (or …Kd5) | same |
| Qd3+ | …Ke6 or …Ke5 | no rook check covers both e-squares |
| Qe5+ | …Kxe5 | the queen is simply lost |
| Qe6+ | …Kxe6 | same |
| Qc5+ | …Kxc5 or …Ke6 | the queen is lost or the king escapes |
| Qb6+ | …Ke5 | the king leaves the sixth rank |
| Rd4+ | …Kc6 or …Kc5 | the king slips onto the c-file |
| Rf6+ | …Kd5 | the king steps down into open space |
| **Qd4+** | none | see below |

After **1.Qd4+** the queen controls the whole d-file and the squares c5 and e5. The king's only moves are **…Kc6**
and **…Ke6**, and both stay on the sixth rank. Then **2.Rf6#** closes the rank: the rook seals the sixth rank, and
the queen and White's own king on a5 cover every square on the fifth. The tree has ten branches, nine of them are cut after one reply,
and the tenth is proven against both replies. That is what a pruned tree looks like.

### Common mistakes
* **Testing the first forcing move to the end before looking at the others.** Read all ten names first and then cut
  them. Seeing the whole list often shows you which one is special (here, the queen check that covers c5 and e5 at
  once).
* **Calling a candidate refuted because of one strong reply you only half saw.** A refutation must be a reply after
  which you have *nothing*. Check it.
* **Forgetting the board is six files wide.** There is no g-file. A king on f4 has no squares to its right.

### Advanced insight
Pruning is safe only if your refutations are correct. If they are, a quiet first move is no harder to find than a
check. It is simply later in the list. The worked example below shows a position where every check fails and the
win is a quiet rook move that leaves Black **in zugzwang**: Black has a move, but every move makes things worse.

### Worked example

```crown
fen: 3k2/6/3N1p/1R2p1/2R3/4K1 w - - 0 1
line: Rb5 e2 Rc6#
claim: only-mate-in-2
caption: White to move and mate in two. Four checks are available, and all of them fail.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · ♘ · ♟
3 │ · ♖ · · ♟ ·
2 │ · · ♖ · · ·
1 │ · · · · ♔ ·
  └─────────────
    a b c d e f    White to move
```
*White to move and mate in two. Four checks are available, and all of them fail.*
<!-- /diagram -->

1. **Checks:** Rc6+, Rb6+, Nf5+ and Nb5+. Each one lets the king leave the sixth rank (…Kd5 or …Ke5 answers the
   rook checks; …Ke6, …Kd5 or …Ke5 answers the knight checks). All four are refuted. **[Demonstrated]**
2. **Captures:** none.
3. **Threats and quiet moves:** look at the king's squares. c6 is covered by the rook on c2, and e6 by the knight.
   c5, d5 and e5 are free. **1.Rb5!** covers all three along the fifth rank.
4. **Black's replies:** the king has no legal move, so Black must move a pawn: …e2 or …f3. After either one,
   **2.Rc6#**. **[Demonstrated]** The checker confirms Rb5 is the only mate in two.

Notice how close this is to stalemate. If Black had no pawn moves, 1.Rb5 would be stalemate and only a draw.
Always ask "does my quiet move leave them a legal move?" before you play it.

### Guided exercise

```crown
fen: Q2r2/6/K4k/1pN1p1/6/1n2R1 w - - 0 1
claim: only-mate-in-2
caption: White to move and mate in two. Six checks are available.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♕ · · ♜ · ·
5 │ · · · · · ·
4 │ ♔ · · · · ♚
3 │ · ♟ ♘ · ♟ ·
2 │ · · · · · ·
1 │ · ♞ · · ♖ ·
  └─────────────
    a b c d e f    White to move
```
*White to move and mate in two. Six checks are available.*
<!-- /diagram -->

Work through it in this order. (a) List all six checks: Rf1+, Nd5+, Ne2+, Qxd6+, Qc4+ and Qf1+. (b) For each one,
find one king move that escapes. Remember the king on f4 cannot go right. (c) The survivor is the check that also
covers e5 *and* removes Black's rook. Find it, then find the mate after each king move.

### Independent exercises
1. **Black to move and mate in three.** (Academy puzzle pz-10qaias, Calculation Chamber pool.)

```crown
fen: 2r1k1/pq4/6/2nPK1/P1P3/2Q1NR b - - 0 20
claim: mate-in-3
caption: Exercise V.1.1. Black to move. White's king has wandered to e3.
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
*Exercise V.1.1. Black to move. White's king has wandered to e3.*
<!-- /diagram -->

2. **White to move and mate in three.** (Academy puzzle pz-1muyn8j.)

```crown
fen: 2k3/6/p1KQr1/P5/6/6 w - - 19 61
claim: mate-in-3
caption: Exercise V.1.2. White to move. Count the king's squares before you calculate.
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
*Exercise V.1.2. White to move. Count the king's squares before you calculate.*
<!-- /diagram -->

3. **White to move: the Academy's goal is "Mate in 5".** Find the first move and the idea. (Academy puzzle
   pz-culn07.)

```crown
fen: 3k1r/1R4/1KPn1p/2nppP/6/R5 w - - 2 35
claim: puzzle pz-culn07
caption: Exercise V.1.3. White to move. Two rooks against an exposed king on the sixth rank.
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
*Exercise V.1.3. White to move. Two rooks against an exposed king on the sixth rank.*
<!-- /diagram -->

4. Go back to the illustrated example and, **without the table**, write the refutation of each of the ten checks
   from memory in under three minutes. This is a drill in naming refutations quickly.

### Answers
* **Guided:** **1.Qxd6+!** removes the rook and covers e5. If 1…Kf5 then 2.Rf1#. If 1…Kf3 then 2.Rf1# or 2.Qf6#.
  The refutations of the others: Rf1+ …Ke5; Nd5+ …Rxd5 (or a king move); Ne2+ …Kf5; Qc4+ …Kf5 (or …Rd4);
  Qf1+ …Ke5. **[Demonstrated]**
* **V.1.1:** **1…Qe5+!** is the only first move that mates in three (exhaustive proof). If 2.Kd2 or 2.Kf2, then
  2…Qe2#. If **2.Kf3**, then **2…Qe2+ 3.Kf4 Nd5#**: the knight from c3 covers f4 and the queen does the rest.
* **V.1.2:** **1.Qxe4+!** (only move, exhaustive proof). The queen takes the rook with check. After **1…Kd6** White
  mates at once with **2.Qd5#**. After **1…Kb6** the quiet **2.Kb4!** leaves only **2…Ka6** (the a4-pawn is
  blocked), and **3.Qc6#** (or 3.Qe6#) follows. The quiet king move is the hard part.
* **V.1.3:** the Academy solution begins **1.Ra6+ Nc6+ 2.Kxc3**. The rook check along the sixth rank is blocked by
  a knight that checks back, and White's king answers by capturing the *other* knight on c3. The verified line
  continues to mate. Solve it in the Academy to see each reply.
* **Exercise 4:** compare your list with the table. Any refutation you could not name is a pattern to drill.

### Summary
Order your candidates (checks, captures, threats, quiet moves), refute each one with a single named defence, and
accept a move only when every defence fails. On this board the sixth rank and the a/f files are walls. Many mates
need only one piece to seal the last line. Quiet moves live at the bottom of the list, not outside it.

### Next lesson
Chapter V.2, where the question changes from "can I calculate it?" to "should I keep it complicated?"

---

## Chapter V.2 — Complexity, Imbalance and the Art of Simplifying

### Learning objectives
* Decide when to keep a position complex and when to trade into a simpler one.
* Describe an imbalance (material, pawn majority, king exposure, piece activity) and judge which side it favours.
* Use exchanges to convert an advantage into a position where the result is easy to secure.

### Prerequisites
Book III, *The Strategist* (pawn structure, weak squares); Book IV, *The Master* (basic endgames, the promotion
race).

### Explanation
**Complexity** is the number of plausible moves and the depth of calculation they need. Complexity is a weapon for
the side that calculates better, or that has more time on the clock. It is a danger for the side that is already
winning.

An **imbalance** is any lasting difference between the two sides. On the 6×6 board the common ones are:

* **Material:** with only 6 pawns and 5 pieces each, every pawn is a large share of the army.
* **Passed pawns:** promotion is only four steps from the starting rank. That is why the Academy coach has a
  topic called "Promotion races (promotion is only four steps away)" ([Demonstrated], src/academy/coach.ts).
* **King exposure:** there is no castling, and the king starts on d1/d6 in the middle of the back rank.
* **Activity:** a rook on an open file or a queen near the enemy king.

The rule of simplification is simple. **Trade when the imbalance that remains after the trade is decisive in your
favour and easy to play. Keep pieces on when the imbalance is unclear or favours your opponent's skill.** A queen
trade that leaves you a running passed pawn is usually the cleanest win on this board ([Counsel], illustrated below
with a verified position).

### Illustrated example

```crown
fen: 6/3Q1p/1p1P1k/6/3PK1/1q4 b - - 0 24
line: Qe4+ Qxe4+ Kxe4
claim: puzzle pz-am6uu4
caption: Black to move. The queens can come off, but is the pawn ending won?
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
*Black to move. The queens can come off, but is the pawn ending won?*
<!-- /diagram -->

**[Demonstrated]** Academy puzzle pz-am6uu4 ("Win material or a decisive advantage", difficulty 3): **1…Qe4+!
2.Qxe4+ Kxe4.** Black forces the queen trade with check. In the pawn ending that remains, Black's king is in the
centre and the b-pawn is far from White's king.

### Step-by-step reasoning
1. **Name the imbalance before the trade:** queens on, Black's king active on f4, Black's passed b-pawn and
   White's d-pawns.
2. **Name it after the trade:** no pieces at all. Black's king stands on e4 next to White's d-pawns, and Black's
   b-pawn has three steps to b1.
3. **Ask who is faster.** White's king on e2 must deal with the b-pawn *and* defend the d-pawns. It cannot do both.
4. **Check the forcing nature.** 1…Qe4+ is check, and 2.Qxe4+ is White's best reply according to the verified line.
   A forcing simplification leaves the opponent no time to complicate.

### Common mistakes
* **Trading because "trades help the side ahead" without checking the ending.** Pawn endings are calculable, and
  calculation sometimes shows they are drawn.
* **Keeping queens on out of greed.** If you are winning, every extra tactical possibility is a chance for *your*
  opponent to swindle you.
* **Forgetting the timeout rule.** Under the Crown timeout rule you lose on time if your opponent has *any*
  non-king piece or pawn left, even one that could never mate. Simplifying into a technical ending with little time
  left is only safe if you can make the moves quickly. ([Demonstrated], src/rules/adjudication.ts, policy
  crown-adj-1.)

### Advanced insight
**Complexity is relative to the clock.** In Blitz 3+2 a position needing a twelve-move calculation is a coin toss
for both players. In Classical 15+10 the better calculator usually wins it ([Counsel]). The Lab's *Time
management* dimension records whether you spend at least your median thinking time on critical decisions. Use it to
see whether you rush the moments that matter ([Demonstrated], src/academy/lab.ts).

### Worked example

```crown
fen: 5R/6/6/2p3/1k4/3K2 b - - 0 46
line: c2+ Ke2 c1=Q
claim: puzzle pz-c0qvzm
caption: Black to move. A rook against a pawn that is two steps from promotion.
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
*Black to move. A rook against a pawn that is two steps from promotion.*
<!-- /diagram -->

The material says White is better (a rook against a pawn). The *imbalance* says otherwise: White's rook is far away
on f6, and the pawn advances with check, so White never has time to stop it. **1…c2+!** **2.Ke2** (the reply in the
verified line) **2…c1=Q** promotes. Black has turned "rook against pawn" into "queen against rook". **[Demonstrated]** puzzle
pz-c0qvzm. The lesson: count tempi, not just material.

### Guided exercise
Academy puzzle pz-19v5xks (goal: "Find the only move that holds").

```crown
fen: 4kr/3p1p/q2pp1/Pp2PP/1QrP2/RN1KR1 w - - 1 15
claim: puzzle pz-19v5xks
caption: White to move. White's queen on b2 and king on d1 are under pressure. Simplify or suffer?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ♜
5 │ · · · ♟ · ♟
4 │ ♛ · · ♟ ♟ ·
3 │ ♙ ♟ · · ♙ ♙
2 │ · ♕ ♜ ♙ · ·
1 │ ♖ ♘ · ♔ ♖ ·
  └─────────────
    a b c d e f    White to move
```
*White to move. White's queen on b2 and king on d1 are under pressure. Simplify or suffer?*
<!-- /diagram -->

Hints: (1) list the pieces attacking White's queen and king; (2) find a capture that offers a queen trade; (3) check
the pawn structure after the recapture.

### Independent exercises
1. Academy puzzle pz-ifalpv. White to move and find the only move that holds.

```crown
fen: r1q1kr/1p1np1/1Q1p1p/NP1P1P/P2P2/R2K1R w - - 2 10
claim: puzzle pz-ifalpv
caption: Exercise V.2.1. White to move. Which trade keeps White's position together?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ · ♛ · ♚ ♜
5 │ · ♟ · ♞ ♟ ·
4 │ · ♕ · ♟ · ♟
3 │ ♘ ♙ · ♙ · ♙
2 │ ♙ · · ♙ · ·
1 │ ♖ · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*Exercise V.2.1. White to move. Which trade keeps White's position together?*
<!-- /diagram -->

2. Academy puzzle pz-12j3cmu. White to move and win.

```crown
fen: 6/p3Pr/k5/4K1/6/6 w - - 0 33
claim: puzzle pz-12j3cmu
caption: Exercise V.2.2. White to move. The simplest win is often the most direct.
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
*Exercise V.2.2. White to move. The simplest win is often the most direct.*
<!-- /diagram -->

3. In the illustrated example, suppose Black did **not** trade and played a slow king move instead. In one sentence
   each, name two ways White's queen could make the position complicated again.
4. Before your next three rated games, write down at move 15 whether the position is *simple* or *complex* and who
   it favours. Afterwards compare your note with the evaluation graph in Analysis.

### Answers
* **Guided:** **1.Qxd4!** Verified line: 1.Qxd4 Qxd4 2.exd4. White captures a pawn and offers the queen trade.
  After the recapture with the e-pawn, Black's most dangerous attacker is gone. The verifier found no other move
  that holds.
* **V.2.1:** **1.Qxb5!** Verified line: 1.Qxb5 Qxb5 2.Nxb5. Capture, trade, recapture: the defending side
  simplifies to reduce the attackers.
* **V.2.2:** **1.e6=Q.** The pawn promotes at once. The verified policy confirms this beats every alternative by a
  clear margin.
* **Exercise 3:** for example, queen checks against Black's exposed king, and an attack on the f5-pawn or b-pawn
  that ties Black's king down. Any two concrete forcing ideas are acceptable.
* **Exercise 4:** there is no fixed answer. The skill being trained is honest self-assessment.

### Summary
Name the imbalance before and after a trade. Simplify when what remains is decisive and easy to play, especially
when you are short of time and the timeout rule applies. Keep the game complex when you are worse, have more time,
or calculate better. Count tempi, not just material.

### Next lesson
Chapter V.3: knowing *who* you are playing changes which positions you should aim for.

---

## Chapter V.3 — Reading the Opponent: profiling and style adaptation

### Learning objectives
* Describe exactly how each engine level L1–L9 chooses its moves, and what that means for you.
* Read a Federation competitor's profile (public rating, RD, division, style) and know what each item does and does
  not reveal.
* Adapt your opening and middlegame choices to an opponent, using only behaviour the game actually has.

### Prerequisites
Chapter V.2. Book III's chapters on planning.

### Explanation
**Opponent profiling** means predicting how an opponent will choose moves, and steering towards positions where
those choices go wrong. In Crown & Calculation every opponent is a program, and its method is documented. That is
an unusual gift. You can profile with facts instead of rumours.

**The engine levels (profile set crown-levels-6). [Demonstrated]** src/engine/levels.ts and the measured
calibration src/engine/calibration.json (500 engine-vs-engine games, L1 anchored at 800; this is the Crown scale,
not FIDE):

| Level | Name | How it chooses | Crown rating (± RD) |
|---|---|---|---|
| L1 | Novice | 1-ply search; random choice among moves within 3.2 pawns of its best | 800 (anchor) |
| L2 | Apprentice | 1-ply plus quiescence; within 2 pawns | 1122 ± 86 |
| L3 | Club | 2-ply; within 1.3 pawns | 1582 ± 116 |
| L4 | District | 2-ply; within 0.7 pawns | 1710 ± 121 |
| L5 | Regional | full search, 600 nodes per move, always its best | 1976 ± 129 |
| L6 | National | full search, 4,000 nodes | 2375 ± 148 |
| L7 | Master | full search, 30,000 nodes | 2641 ± 157 |
| L8 | Crown | full search limited by time (up to 6 s per move) | 2926 ± 169 |
| L9 | Sovereign Unbound | canonical engine, larger hash table, your chosen budget (rated: 10 s) | 3038 ± 171 (derived) |

What this means in practice:

* **L1–L4 never play a move worse than their margin below their own best,** and they choose among the near-best
  moves with a softmax "temperature". They are *loose*, not suicidal. They do not throw games. Their weakness is
  **shallow sight**: a 1- or 2-ply search cannot see a quiet move whose point arrives three plies later. So set
  slow traps: quiet moves that prepare a double attack ([Counsel], based on the documented depth).
* **When L1–L4 find a mate, they play it.** Bounded selection is skipped when the best score is a mate.
* **L5–L7 always play their best move,** but within a fixed node budget. They are consistent, and their horizon is
  short in long, quiet manoeuvring. Positions with a slow plan (a pawn majority that matters only in the ending)
  test them more than sharp tactics do ([Counsel]).
* **L8 and L9 are limited by time, not nodes.** A faster computer makes them stronger, and in timed games their
  clock lowers their thinking time (see Chapter V.8).

**Federation competitors. [Demonstrated]** src/federation/*. Each of the 2,048 competitors has a *public* Glicko-2
rating and RD, a division (1 Crown … 8 Open), a region, and a style label. Their *hidden* playing strength
("latent") chooses their engine profile: below the L5 rating the nearest calibrated level L1–L5 is used. From L5
upward it is a full search whose node budget interpolates the measured ladder (crown-profile-map-1, about 118 Elo
per doubling of nodes). **The hidden strength is never shown and is never used by forecasts or NPC traders.** The
public rating is only an estimate updated from results. So a high-RD competitor's rating is a weak signal, and a
low-RD rating is a better one.

**Styles. [Demonstrated]** src/engine/styles.ts, styles-validation.json and docs/STYLES_REPORT.md. Six labels
exist: Universal, Tactical attacker, Positional strategist, Defensive specialist, Endgame technician, Risk-taking
aggressor. A style is **played only if it passed validation** (validation id styles-5-2026-11-04). Four passed:
**Tactical, Positional, Defensive and Endgame**. Each one changes the engine's evaluation **for the whole game**,
for its own side only, and stays within ±50 Elo of Universal (200 colour-swapped games per style):

* **Tactical** values threats and loose enemy pieces more and avoids draws a little (contempt +15). Measured: 21 %
  draws against Universal's 31 % in self-play.
* **Positional** values supported pawns, pawn chains, outposts and mobility, and threats slightly less.
* **Defensive** values its king's pawn shield and fears the opponent's attackers, loose pieces and queen more, so
  it welcomes queen trades and accepts draws (contempt −20). Measured: about 10 % fewer attacks on its king zone,
  35.5 % draws.
* **Endgame** values passed pawns and an active king in the endgame and likes to simplify. Measured: queens leave
  the board earlier (median ply 28 against 31).

In addition, Tactical and Positional keep their **opening repertoire for the first six plies**: a choice among book
moves the engine judges within **30 cp** of the best at depth 7. Tactical prefers moves that attack pieces, capture,
check, or develop knights and the queen; Positional prefers knight moves, piece development and central files.
**Risk-taking aggressor failed validation** (it did not give more checks than its opponent) and plays as Universal;
its profile says so.

That is the honest profile: a style shapes *tendencies over a whole game* and never the strength. Single moves
barely differ (10–21 % of positions get a different move); the style shows in what kind of game you get.

### Illustrated example

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Nf3 Nf4
show: after
caption: After 1.Nf3 Nf4: knight moves score well with both opening repertoires (Tactical and Positional).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ · ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · · · ♞
3 │ · · · · · ♘
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*After 1.Nf3 Nf4: knight moves score well with both opening repertoires (Tactical and Positional).*
<!-- /diagram -->

Suppose your Federation opponent is a *Positional strategist*. Its repertoire weights favour knight moves (+2), any
piece move (+1) and central c/d files (+1). So from the start position a move such as Nf3 or Nc3 is much more likely
than a3, *provided the move is in its 30 cp book*. You can prepare a reply to its most likely first moves. Its
choices are random, though (seeded per game), so prepare for two or three, not one.

### Step-by-step reasoning
1. **Read the profile:** public rating, RD (is the rating trustworthy?), division, style label.
2. **Translate the label into behaviour:** Tactical, Positional, Defensive and Endgame change the whole game (and
   Tactical and Positional also the first six plies). Aggressive and Universal mean the engine's main moves.
3. **Translate the rating into an engine profile:** under about 1976, a sampling level (loose choices, shallow
   sight); above it, a full search with a node budget (precise but short-sighted in quiet positions).
4. **Choose your battlefield:** against shallow searchers, slow multi-move threats; against node-limited full
   searchers, long quiet plans and endgames where the horizon matters ([Counsel]).
5. **Keep it legal and fair:** you never need hidden information. Everything above comes from what the game shows
   you or from its documentation.

### Common mistakes
* **Expecting a style to change strength or every move.** It changes tendencies (draw rate, king safety, when the
  queens come off), not the level of play, and most single moves are the same as Universal's.
* **Trusting a provisional rating.** A rating with a high RD can be hundreds of points away from the real strength.
* **Treating L1–L4 as random.** They choose among *near-best* moves. A 0.7-pawn margin (L4) is quite strict.
* **Over-adapting.** If you play badly to "exploit" an opponent, you also lose to the moves it plays when it plays
  its best ([Counsel]).

### Advanced insight
**Style adaptation is really self-adaptation.** The opponent's method is fixed. The variable you control is
*which positions you reach*. Keep a short list of positions you play well (from the Lab dimensions with the
narrowest intervals and highest rates) and steer towards them. That is profiling yourself, and it is measured
([Demonstrated], Lab methodology crown-lab-1: every rate has a denominator and a 95 % interval).

### Worked example
*You are rated 1650 (established). Your next league opponent is shown at 1580 ± 60, Tactical attacker, Club
Division.*

* The RD of 60 means the rating is reasonably established.
* The hidden strength picks the engine profile. If it is near 1580, that is close to L3 (1582): a 2-ply search
  choosing within 1.3 pawns of its best.
* "Tactical" means its first three moves favour captures, checks and attacks on pieces.
* **Plan:** in the opening, avoid leaving pieces where a 2-ply search sees a cheap capture. In the middlegame,
  set multi-move traps (a quiet move that prepares a fork), which a 2-ply search often walks into ([Counsel]).
* **Expected score:** the Federation's result model (crown-result-model-1, Davidson model with ν = 0.9) gives a
  70-point favourite about 0.57. A 100-point favourite gets 0.598 (W 0.447, D 0.302, L 0.251). You are a modest
  favourite, not a certainty.

### Guided exercise
Your opponent is shown as "Defensive specialist", 2100 ± 45, Grand Division. Answer: (a) Which style behaviour
will you actually face? (b) Roughly which engine profile is it, sampling or full search? (c) Is the rating
trustworthy?

### Independent exercises
1. Why can L2 never deliberately leave a mate in one on the board when it has a sound alternative? Quote the
   relevant rule of bounded selection.
2. An L4 opponent's best move scores +0.40. Which moves can it choose?
3. A competitor is 1450 ± 220. Give two reasons to be careful about treating it as a weak opponent.
4. Two styled opponents both start a game with White. Which is more likely to begin with a pawn move: the Tactical
   attacker or the Positional strategist? Explain from the preference weights.

### Answers
* **Guided:** (a) Defensive is validated: expect an opponent that guards its king, welcomes queen trades and is
  content with a draw (more draws, fewer attacks on its king). Its strength is unchanged.
  (b) 2100 is above L5's 1976, so it is a **full search** with a node budget between L5 and L6. (c) RD 45 is low,
  so the rating is **fairly trustworthy**.
* **1:** bounded selection keeps only moves within the margin of the best, and drops moves whose score is a mate
  *against* the mover (`!isMateScore(-s.score)`). A move allowing mate in one scores as a mate against it, so it is
  excluded unless no alternative exists.
* **2:** any move scoring at least +0.40 − 0.70 = **−0.30**, weighted by exp((score − best)/35 cp), so moves close to
  the best are much more likely.
* **3:** the high RD means the rating could be far from the real strength, and its hidden strength, not its rating,
  sets its engine profile. It may also improve fast once results arrive.
* **4:** the Tactical weights reward attacks, captures and checks (+2 each) and knight or queen moves (+1). The
  Positional weights reward knight moves (+2), piece moves (+1) and central files (+1), and nothing for pawns. Neither
  rewards pawn moves as such, so both lean to piece moves. Pawn moves can still be chosen, because every book move
  has weight exp(1.2 × preference) > 0.

### Summary
Profile with facts. Levels differ in search depth and selection margin, competitors differ in hidden strength
(mapped to a profile) and in a six-ply opening preference if their style is validated, and ratings differ in
reliability (RD). Adapt by choosing your battlefield, not by playing worse moves.

### Next lesson
Chapter V.4 applies this across a whole event: leagues, Swiss tournaments and knockouts.

---

## Chapter V.4 — The Tournament Hall: Swiss, leagues and knockouts

### Learning objectives
* Know how each Federation event pairs players, breaks ties and decides advancement.
* Plan your risk level by event type and standing.
* Compute a tournament performance rating and check it against Federation title norms.

### Prerequisites
Chapter V.3. The Rulebook section on competition rules.

### Explanation
**The season. [Demonstrated]** src/federation/model.ts: 19 rounds per season. League rounds run 1–15, Swiss events
fill rounds 4–8, the Club Weekend rounds 10–11, and the Crown Championship knockout rounds 16–19. Federation
games for the player use **Rapid 5+3** (src/app/federation.ts). There are 8 divisions × 16 regional leagues × 16
competitors (2,048 competitors).

**Leagues (round robin). [Demonstrated]** src/federation/formats.ts: a circle-method round robin with colour
balancing. **Order:** points, then head-to-head among the tied group, then Sonneborn–Berger, then pre-season seed.
At season end the **top two are promoted and the bottom two are relegated** between adjacent divisions of the same
region.

**Swiss (crown-swiss-1, a simplified score-group system, not FIDE Dutch). [Demonstrated]** Players are sorted by
points then seed. With an odd field, the bye goes to the lowest-ranked player who has not had one. Then each
player meets the nearest-ranked opponent not met before, preferring the same score group. The player with fewer
Whites gets White. **Order:** points, Buchholz Cut-1, Buchholz, Sonneborn–Berger, seed.

**Knockout (Crown Championship). [Demonstrated]** Each match is two classical games with colours swapped. If level,
one rapid pair; if still level, one blitz pair. If still level, the **higher pre-event seed advances**, except in the
championship **final**, where a level match gives **joint champions**.

**Performance and norms. [Demonstrated]** src/heraldry/titles.ts: the performance rating is the average opponent
rating + dp, with dp = −400·log10(1/p − 1) for score fraction p (capped at ±800). An event with **at least 5 games**
counts as a *norm* for a title tier when both the performance and the average opposition reach the tier's
thresholds:

| Federation title | Performance ≥ | Avg. opponents ≥ | Norms needed | Norm games ≥ | Peak rating ≥ | Other |
|---|---|---|---|---|---|---|
| Squire | 1700 | 1100 | 1 | 5 | 1600 | — |
| Knight | 2000 | 1500 | 2 | 15 | 1900 (established) | — |
| Paladin | 2300 | 1800 | 3 | 27 | 2200 (established) | an event title |
| Sovereign | 2600 | 2100 | 3 | 27 | 2500 (established) | a Championship final |

Federation titles are **permanent**. Rating titles (31 bands of 100 points, from *Wandless Wanderer* to *Eternal
Sovereign*) describe your current rating and are a separate system (src/ratings/titles.ts).

**Circuit Grades (v0.11). [Demonstrated]** src/federation/ranks.ts: a rank ladder of 16 feudal grades, each with
three sublevels III → II → I: 48 steps from **Commoner III** to **High Sovereign I** (the names are a proposed list,
docs/FEUDAL_RANKS.md). Each division owns two grades: the Open Division Commoner and Page, the Club Division Squire
and Man-at-Arms, and so on up to King and High Sovereign in the Crown Division. Your **division** decides the pair;
promotion starts you at the new division's lower grade III, relegation puts you at the lower division's upper grade
III. Inside the division a **standing score** (0–100) moves you at two **checkpoints** per season, after round 8 and
at season end: 45 % league position (1st = 100, 16th = 0), 25 % your score in sanctioned rated games (league, the
Opens, the Crown Championship) and 30 % your rating's percentile within the division. The six steps of a division
are reached at 0 / 30 / 42 / 54 / 64 / 76; you drop a step only below the step's mark minus **12**; at most one step
per checkpoint; never down at the checkpoint right after a step up; never up from the bottom two of your league.
Exhibitions, unrated, practice and sandbox games do not count, and nothing can be bought. Your **highest rank ever**
is kept for good. A Circuit Grade is not your Career Elo (the Glicko-2 rating) and not Played Like.

### Illustrated example
*A Swiss, last round.* You are on 3.5/4, half a point clear of three players on 3. You are White against one of
them.

* A **draw** keeps you on 4 and the opponent on 3.5. The other two on 3 can reach 4 by winning, and then
  **Buchholz Cut-1** decides between you. Your Cut-1 depends on your opponents' scores, which you cannot control.
* A **win** makes you sole winner.
* A **loss** drops you into a tie at 3.5, possibly behind several players.

The choice between "play solidly for a draw" and "press for the win" depends on your Cut-1 relative to the chasers.
Look it up in the standings table before the round ([Counsel] on the decision; the tiebreak order is
[Demonstrated]).

### Step-by-step reasoning
1. **Know the format's tiebreak** before the event (table above).
2. **Before each round, list the results you need** and which ones you control.
3. **Set your risk level:** in a league, the target is top two (promotion) or avoiding the bottom two. In a
   knockout, a drawn classical pair leads to rapid and blitz, so your speed-chess level matters.
4. **After the event, compute your performance** and check it against the norm table.

### Common mistakes
* **Playing every round the same way.** Round 1 of a 15-round league and the last round of a Swiss are different
  decisions.
* **Forgetting that knockout tiebreaks are faster games.** If your blitz is much weaker than your classical play,
  a drawn classical pair is bad news.
* **Assuming a high score is a norm.** It needs ≥ 5 games *and* a high enough average opposition.
* **Reading your Circuit Grade as a rating.** "Knight II" says where you stand in your division's ladder, not how
  strong you are: it is tied to your division and your checkpoint standing, while your Career Elo moves with every
  rated game.
* **Entering an event you have traded on.** If you enter an event, its open winner market is **cancelled at the
  published 1/n vector before your entry takes effect** ([Demonstrated], src/exchange/families.ts rules). See Book VI.

### Advanced insight
**Sonneborn–Berger rewards beating strong finishers.** In a league tie, a win against the eventual runner-up is worth
more on SB than a win against the bottom seed. Head-to-head comes first, though. So in a race for second place, the
direct game against your rival counts twice: once in points and once in the head-to-head tiebreak ([Demonstrated]
order; the conclusion follows directly).

### Worked example
*Norm check.* In a league season you play 15 games against an average opposition of 1,820 and score 10.
p = 10/15 = 0.667, so dp = −400·log10(1/0.667 − 1) = −400·log10(0.5) = **+120**. Performance = 1820 + 120 =
**1940**. Squire tier: 1940 ≥ 1700 and 1820 ≥ 1100, so it **qualifies**. Knight tier: 1940 < 2000, so it **does
not**. This season gives one Squire-level norm. (Computed with the formula in src/heraldry/titles.ts.)

### Guided exercise
A five-round Swiss: you score 3.5 against an average of 1,950. (a) Compute p and dp. (b) Compute the performance.
(c) Which tiers does it qualify for?

### Independent exercises
1. A knockout quarter-final: classical games 1–0 and 0–1, rapid ½–½ and ½–½, blitz 1–0 and 0–1. You are seed 3,
   your opponent seed 6. Who advances, and why? What if it were the final?
2. Two league players finish on 9 points. They drew each other, and A has a higher Sonneborn–Berger. Who ranks
   higher?
3. Why does winning every game of a 4-game Swiss give no norm at all?
4. You have 2 Knight-tier norms over 18 games and an established peak of 1880. What is missing for Knight?
5. You are **Squire II** (Club Division, lower grade II). At the mid-season checkpoint you are 4th of 16, you have
   scored 6/8 in league and Challenger games together, and your rating sits at the 70th percentile of the division.
   (a) Compute your standing score. (b) What is your rank after the checkpoint? (c) What would a score of 29 have done?

### Answers
* **Guided:** p = 0.7, dp = −400·log10(1/0.7 − 1) = −400·log10(0.4286) ≈ **+147**. Performance ≈ **2097**. With an
  average of 1950, it qualifies for **Knight** (2097 ≥ 2000, 1950 ≥ 1500). It does not qualify for Paladin
  (2097 < 2300).
* **1:** every pair is level, so the higher pre-event seed (**seed 3, you**) advances. In the **final** the result
  would be **joint champions**.
* **2:** head-to-head among the tied pair is ½–½ (level), so Sonneborn–Berger decides: **A** ranks higher.
* **3:** a norm needs at least **5 games**.
* **4:** the established **peak rating of 1900**. You have the norms (2) and the games (18 ≥ 15).
* **5:** (a) position = 1 − 3/15 = 0.8, results = 6/8 = 0.75, rating = 0.70; score = 100 × (0.45·0.8 + 0.25·0.75 +
  0.30·0.70) = 36 + 18.75 + 21 = **75.75**. (b) Squire II is the Club Division's step 1; the next step (Squire I)
  needs 42, so you rise **one step only**, to **Squire I**, and are protected at the next checkpoint. (c) Squire II
  is reached at 30, so you drop only below 30 − 12 = 18: a score of 29 **keeps Squire II**.

### Summary
Know the pairing rules, tiebreak order and advancement rules of each event, and choose your risk round by round.
The performance rating turns your score into a number, and norms turn sustained performances into permanent titles.

### Next lesson
Chapter V.5: inside each game, a few moments decide the result. How do you recognise them?

---

## Chapter V.5 — Critical Moments, Stronger Opponents and Predictable Mistakes

### Learning objectives
* Recognise a critical moment at the board, and know how Analysis defines one afterwards.
* Use defensive resources, especially checks and repetition, against stronger opponents.
* Identify your predictable mistakes from the coach's topics and the Lab, and train them away.

### Prerequisites
Chapter V.1 (calculation), Book II's defence chapter, Book IV's endgame chapters.

### Explanation
**The game's definition. [Demonstrated]** src/analysis/analyzer.ts (crown-critical-1): a position is **critical**
when the best move is at least **0.10 expected-score points** better than the second-best (or when a mate is
available and the second move is not a mate). The game summary reports how many critical moments you **handled**
(expected-score loss ≤ 0.05). At the board you have no engine, so learn the signs ([Counsel]):

* **Your opponent has just changed the position's character** with a capture, a pawn break or a sacrifice.
* **You have only one or two moves that do not lose material** (an "only move").
* **A pawn is two steps from promotion,** which on this board happens early.
* **Checks are available for either side.**

When you notice a sign, **stop and spend time.** The Lab's *Time management* dimension measures whether you do.

**Against stronger opponents** the honest goal is often the draw. Crown has two automatic draws you can aim for:
**bare kings** and **fivefold repetition**. Threefold repetition and the 100-halfmove rule can be **claimed**.
Perpetual check is the classic defensive weapon: if you can check forever, the position repeats ([Demonstrated],
src/rules/adjudication.ts).

**Predictable mistakes. [Demonstrated]** src/academy/coach.ts lists the coach's topics: hanging pieces, knight
forks, double attacks, mating nets, the opponent's threats before your move, promotion races, converting winning
positions, and calculation. Each note is derived from an actual engine line replayed under the rules. The Lab marks a
pattern as **recurring** only after at least **5 occurrences in at least 3 games**.

### Illustrated example
Academy puzzle pz-1w5drbc (goal: "Find the only move that holds", Defensive Survival pool).

```crown
fen: 6/4R1/K5/6/6/3kq1 w - - 0 35
line: Rxe1+ Kxe1
claim: bare-kings
caption: White to move (Academy puzzle pz-1w5drbc). A rook against a queen. One move holds.
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
*White to move (Academy puzzle pz-1w5drbc). A rook against a queen. One move holds.*
<!-- /diagram -->

**[Demonstrated]** **1.Rxe1+! Kxe1** and only the two kings remain: an **automatic draw by bare kings** (the checker
confirms the final position). Black could decline the rook with a king move, but then K+R against K is lost for
Black. Every other White move loses to the queen. This is a critical moment in its purest form: one move is far
better than every other, and the weaker side saves the game by trading everything off.

### Step-by-step reasoning
1. **Notice the sign:** you are a queen against a rook down in material. That is a critical moment.
2. **List forcing moves first.** Here a capture with check exists, and the board's draw rules (Rulebook: bare
   kings) make the trade a full save.
3. **Ask "what does my opponent threaten if I do nothing?"** This is the coach's *threat-awareness* topic. It
   would have shown you that a quiet move loses.

### Common mistakes
* **Playing fast in critical moments and slowly in quiet ones.** This is the most common time-management fault in
  competitive play ([Counsel]).
* **Going for a perpetual too early.** If the position is objectively fine, repeating throws away chances. Use the
  evaluation graph in later study to judge whether the draw was needed.
* **Forgetting that threefold repetition must be claimed.** It is not automatic until the fifth occurrence.

### Advanced insight
Against a much stronger opponent, **reduce the number of critical moments you face.** Every critical moment is a
chance to lose. Simplifying lines (Chapter V.2) and forcing repetitions reduce them ([Counsel]). The reverse holds
too: against a weaker opponent, *create* critical moments, because each one is a chance for them to err.

### Worked example
Academy puzzle pz-1qogh9k ("Find the only move that holds", difficulty 3).

```crown
fen: 3N2/p5/3k1p/2n1pP/P1K1P1/6 w - - 0 25
line: Nf5+ Kc4 Nd6+ Kd4 Nf5+
claim: puzzle pz-1qogh9k
caption: White to move. Black's king and knight are centralised. Can White's knight hold the game?
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♘ · ·
5 │ ♟ · · · · ·
4 │ · · · ♚ · ♟
3 │ · · ♞ · ♟ ♙
2 │ ♙ · ♔ · ♙ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*White to move. Black's king and knight are centralised. Can White's knight hold the game?*
<!-- /diagram -->

**1.Nf5+ Kc4 2.Nd6+ Kd4 3.Nf5+.** The knight checks from f5 and d6 in turn, and after move 3 the position after
1.Nf5+ has occurred a second time. **[Demonstrated]** this is the verified line of the puzzle. Continuing to repeat
leads to a threefold-repetition claim (or the automatic fivefold draw). The weaker side saved half a point by spotting a
defensive resource at the critical moment.

### Guided exercise
Academy puzzle pz-r2s0tz (difficulty 3). White is under pressure. Look for a knight move that uncovers a check from
the queen on a3, and for a square the knight can return to.

```crown
fen: 3k1r/2Nnpp/2qn2/Q4P/2PP2/3K1R w - - 7 16
claim: puzzle pz-r2s0tz
caption: White to move. Find the only move that holds, and the drawing mechanism.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ♜
5 │ · · ♘ ♞ ♟ ♟
4 │ · · ♛ ♞ · ·
3 │ ♕ · · · · ♙
2 │ · · ♙ ♙ · ·
1 │ · · · ♔ · ♖
  └─────────────
    a b c d e f    White to move
```
*White to move. Find the only move that holds, and the drawing mechanism.*
<!-- /diagram -->

### Independent exercises
1. Academy puzzle pz-j2j4tm. Black to move. A rook against rook and pawn: find the only move that holds.

```crown
fen: 4K1/5P/5k/r5/4R1/6 b - - 22 50
claim: puzzle pz-j2j4tm
caption: Exercise V.5.1. Black to move. White's f5-pawn wants to promote on f6.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♔ ·
5 │ · · · · · ♙
4 │ · · · · · ♚
3 │ ♜ · · · · ·
2 │ · · · · ♖ ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Exercise V.5.1. Black to move. White's f5-pawn wants to promote on f6.*
<!-- /diagram -->

2. Academy puzzle pz-bus7cm. White to move. Find the only move that holds, which begins with a check.

```crown
fen: rnqkr1/pp4/n1pP2/P1p2N/1P3P/R1QK1R w - - 0 11
claim: puzzle pz-bus7cm
caption: Exercise V.5.2. White to move. Black's pawns on c3 and c4 cramp White. A queen check starts the defence.
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
*Exercise V.5.2. White to move. Black's pawns on c3 and c4 cramp White. A queen check starts the defence.*
<!-- /diagram -->

3. Look at your last three analysed losses. For each one, write down the first ply the summary marks as a
   *turning point*. What was the sign at the board?
4. In which situation is a threefold repetition **not** a draw until you claim it, and what happens on the fifth
   occurrence?

### Answers
* **Guided:** **1.Nd3+! Ke6 2.Nc5+ Kd6 3.Nd3+.** This is the verified line. 1.Nd3+ is a *discovered* check: the knight
  leaves c5 and opens the a3–d6 diagonal for the queen. 2.Nc5+ is a direct knight check, and 3.Nd3+ discovers the
  queen again, so the position repeats. The verifier found no other move that holds.
* **V.5.1:** **1…Ra6+! 2.Kd5 Ra5+.** The verified line. Black checks from a distance along the ranks, so White's king
  cannot shelter the pawn.
* **V.5.2:** **1.Qf4+! Kd5 2.Qf5+.** The verified line. Queen checks with tempo against the king in the centre.
* **Exercise 3:** a *turning point* is a ply where the evaluation crosses between "better" (expected score
  > 0.65), "balanced" and "worse" (< 0.35) (src/analysis/analyzer.ts). The sign at the board is your own answer.
* **Exercise 4:** threefold is always only claimable. The draw becomes automatic on the **fifth** occurrence
  (fivefold repetition). The same applies to 100 halfmoves without a capture or pawn move (claimable) and 150
  (automatic).

### Summary
A critical moment is one where the best move is clearly better than the second, and at the board you feel it as
forcing play, only moves, near-promotions and available checks. Spend your time there. Against stronger opponents,
reduce critical moments and look for perpetual checks and repetitions. Learn your predictable mistakes from the
coach's topics and fix them in the Academy.

### Next lesson
Chapter V.6: after the game the engine becomes your mirror. How do you look into it without fooling yourself?

---

## Chapter V.6 — The Engine's Mirror: postgame study, evaluations and losses

### Learning objectives
* Use every Analysis tool in the game: presets, candidate lines, variations, bookmarks, training retries, Replay
  Your Mistakes and the Lab.
* Translate centipawns into expected score with the game's own map, and read the grades with the right caution.
* Follow a fixed routine for analysing a loss.

### Prerequisites
Chapters V.1–V.5.

### Explanation
**The tools. [Demonstrated]** src/analysis/analyzer.ts, src/ui/AnalysisScreen.tsx, src/academy/*:

| Tool | What it does |
|---|---|
| **Presets** | Quick (depth 5), Standard (depth 7, the default), Deep (depth 9; 4 candidate lines instead of 3). Deeper is slower and more reliable. |
| **Candidate lines** | for each move: the best line and alternatives, each with its expected score. |
| **Explore a variation** | step through a candidate line on the board; *Return to Main Line* goes back. |
| **Bookmarks** | *Bookmark Position* and *Mark Memorable* save plies of the game for later study. |
| **Retry from This Position (Unrated)** | shown on your moves that lost more than 0.05; starts an untimed **training** game from the position before your move, against the same opponent. Training games are never rated and are excluded from the Lab's game evidence. |
| **Replay Your Mistakes** (Academy) | turns every move of yours that lost **≥ 0.12** expected score in an analysed game into a puzzle (accepting any move within 0.02 of the best). |
| **The Lab** | chess skill dimensions (Tactical vision, Calculation, Positional understanding, Defensive awareness, Endgame technique, Threat recognition, Opening understanding, Time management, Decision consistency, Adaptability), each a success rate with its denominator and a 95 % interval. It says "insufficient" when there is too little evidence. |

**The expected-score scale. [Demonstrated]** crown-outcome-map-v2 is an isotonic map fitted on 43,305 positions from
engine games and validated on held-out opening families. Values for the side to move:

| Engine score | −500 | −300 | −200 | −100 | −50 | 0 | +50 | +100 | +150 | +200 | +300 | +500 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Expected score | 0.009 | 0.073 | 0.160 | 0.329 | 0.406 | 0.502 | 0.575 | 0.676 | 0.769 | 0.820 | 0.932 | 0.989 |

(Computed by calling `mapV2` from src/analysis/outcomeMap.ts.) A one-pawn edge (+100) is worth about two-thirds of
a point *in engine games*. A three-pawn edge is close to decisive. The map comes from engine games, and humans
convert advantages less reliably, so read it as "how winning the position is", not "how likely *you* are to win".

**Grades. [Demonstrated]** The grading methodology is **crown-grade-v3-experimental**. A move's *loss* is the drop in
expected score compared with the best move. The bins are Best ≤ 0.002, Excellent ≤ 0.02, Good ≤ 0.05, Inaccuracy ≤
0.12, Mistake ≤ 0.25, Blunder above. The **bins and the accuracy constant are uncalibrated placeholders**:
Accuracy = 100·exp(−4 × mean loss). **Great** and **Brilliant** labels are **not validated**, and Brilliant-move
achievements wait for validated grading. **Played Like** is shown as **"Calibrating"** because the model failed its
release gate: it did no better than a naive accuracy baseline. Treat grades as *pointers to look at*, not verdicts.
Where a grade is uncertain between depths, the game says so.

### Illustrated example
You lost a Rapid game. The summary shows two turning points (plies 23 and 31) and one Blunder at ply 31 with a loss
of 0.41. The coach note on ply 31 is under *Threat awareness* and shows the engine line in which your opponent wins a
rook.

Routine:

1. Open ply 23 first. The *first* turning point is usually the real cause; the blunder is often just the
   consequence.
2. **Explore** the best candidate at ply 23 and step through it. Can you explain in words why it is better?
3. **Bookmark** ply 23, and use *Retry from This Position (Unrated)* to play the position again against the same opponent.
4. After the game, open **Replay Your Mistakes**. Ply 31 (loss 0.41 ≥ 0.12) will be there as a puzzle.
5. A week later, check whether the Lab's *Threat recognition* rate has moved, and look at its interval, not just
   its value.

### Step-by-step reasoning: the loss routine
1. **Before the engine:** write down the move where you think you went wrong, and why. (Your own view first: the
   comparison is the lesson.) ([Counsel])
2. **Run Standard analysis.** If a critical moment is graded with an uncertainty warning, rerun with **Deep**.
3. **Find the first turning point,** not the biggest blunder.
4. **Explain the better move in words.** If you cannot, the engine line is not yet knowledge.
5. **Retry** the position against the same opponent until you hold it.
6. **Classify the error** by coach topic, and count it. Five occurrences in three games is a pattern.
7. **Assign training:** puzzles in that theme (Tactical Academy), Defensive Survival, or the Endgame Workshop.

### Common mistakes
* **Analysing only the blunder.** The position was often already difficult.
* **Trusting a single grade.** The bins are experimental, and the label can depend on depth.
* **Reading "+1.0" as "I should have won".** +100 cp ≈ 0.68 expected score: likely, not certain.
* **Counting Brilliant labels as skill.** They are not validated.
* **Using the engine during rated play.** Rated play hides engine information by design, and assisted games are
  excluded from evidence and markets.

### Advanced insight
The Lab aggregates only reports from **one methodology** (the most common grading id + engine build + preset) and
counts the rest as excluded. If you mix Quick and Deep analyses, your Lab evidence splits. **Pick one preset for
your record** (Standard is the default) and use Deep only for extra study ([Demonstrated], src/academy/lab.ts
`eligibleItems`).

### Worked example
A move goes from +150 (expected 0.769) to +50 (0.575) after your reply, while the best move would have kept +150.
Loss = 0.769 − 0.575 = **0.194** → **Mistake** (0.12 < 0.194 ≤ 0.25), and it qualifies for Replay Your Mistakes
(≥ 0.12). In words: you turned a large edge (about three-quarters of a point) into a small one (just over half).

### Guided exercise
Your move took the position from 0 cp to −100 cp; the best move kept 0. (a) Compute the loss. (b) Which grade? (c)
Does it become a Replay Your Mistakes puzzle?

### Independent exercises
1. +300 → +200 with the best move keeping +300. Loss and grade?
2. −50 → −200 with the best keeping −50. Loss and grade?
3. Your mean loss over a game is 0.05. What accuracy does the game report?
4. Why should a fast drop from +500 to +300 worry you less than a drop from +50 to −100?

### Answers
* **Guided:** (a) 0.502 − 0.329 = **0.173**. (b) **Mistake**. (c) **Yes** (≥ 0.12).
* **1:** 0.932 − 0.820 = **0.112** → **Inaccuracy** (0.05 < 0.112 ≤ 0.12).
* **2:** 0.406 − 0.160 = **0.246** → **Mistake** (just under 0.25).
* **3:** 100·exp(−4 × 0.05) = 100·exp(−0.2) ≈ **81.9**.
* **4:** in expected score, +500 → +300 is 0.989 → 0.932 (−0.057), while +50 → −100 is 0.575 → 0.329 (−0.246). The
  scale is flat near decisive positions and steep near balance.

### Summary
Use presets, candidate lines, variations, bookmarks and retries to turn a lost game into training. Read centipawns
through the expected-score map. Treat grades as experimental pointers. Brilliant is unvalidated and Played Like is
Calibrating. Start with the first turning point, explain the better move in words, and train the pattern until the
Lab's interval moves.

### Next lesson
Chapter V.7: a repertoire built on the balanced openings the engine itself trains on.

---

## Chapter V.7 — The Sixty-Four Gates: building a repertoire

### Learning objectives
* Know the 64 balanced two-ply openings in tools/bench/openings.json and what "balanced" means there.
* Build a small, coherent repertoire for White and Black.
* Attach a long-term plan to each opening instead of memorising moves.

### Prerequisites
Book III's opening and pawn-structure chapters.

### Explanation
**[Demonstrated]** The engine's benchmark book has **64 two-ply openings** (one White move, one Black reply), chosen
because Fairy-Stockfish at depth 10 judged each within **±80 cp** from White's view. They range from −76 to +76
(mean +16). The game's opening classifier (crown-open-0) names them descriptively. **No established 6×6 opening
theory exists**, and the Lab's *Opening understanding* dimension measures soundness (loss ≤ 0.05 in the opening
phase), not memorised lines.

White's ten first moves and the replies in the book, with the evaluation (cp, White's view):

| White's first move | Book replies (eval) |
|---|---|
| Nc3 | a4 (−53), e4 (−74), Nc4 (0), Na4 (+15), Nf4 (−23), Nd4 (0) |
| Na3 | a4 (+45), d4 (+7), e4 (−14), Nc4 (+7), Nf4 (+22) |
| Nf3 | a4 (+14), b4 (+14), c4 (−30), d4 (−30), f4 (+30), Nf4 (+76), Nd4 (+22) |
| Nd3 | a4 (+61), b4 (−46), f4 (−76), Nc4 (+71), Na4 (+38), Nd4 (+7) |
| a3 | a4 (+38), c4 (−59), d4 (−23), e4 (+75), f4 (0), Nc4 (+75), Na4 (−17), Nf4 (+30), Nd4 (+69) |
| b3 | a4 (−51), b4 (+75), c4 (−22), d4 (+23), e4 (+71), f4 (+7), Nf4 (+14) |
| c3 | b4 (0), c4 (−7), d4 (+45), f4 (+67), Na4 (+72), Nf4 (+53) |
| d3 | b4 (+15), c4 (0), d4 (+46), e4 (+22), f4 (+67), Nf4 (+76) |
| e3 | a4 (−46), b4 (−23), e4 (+67), Na4 (+36) |
| f3 | a4 (+60), b4 (−7), c4 (+52), d4 (−38), e4 (+75), f4 (−23), Na4 (+56), Nf4 (0) |

(Converted from the book's move codes to SAN by replaying each line under the rules.) Two things matter. First,
**every pawn move is a single step**: there is no double step on this board. Second, after one move each, the
pawns are already one or two steps from contact.

### Illustrated example

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Nc3 e4
show: after
caption: Nc3 e4 — the most Black-favoured book line (−74 for White at Fairy-Stockfish depth 10).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ · ♟
4 │ · · · · ♟ ·
3 │ · · ♘ · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*Nc3 e4 — the most Black-favoured book line (−74 for White at Fairy-Stockfish depth 10).*
<!-- /diagram -->

After 1.Nc3 e4 Black's e-pawn already attacks d3 and f3, the squares White's d- and f-pawns would step to. It is
three steps from promotion. For Black this is a good choice against Nc3. For White it is a reason to choose
another first move.

### Step-by-step reasoning: building a repertoire
1. **White: choose one or two first moves.** Pick ones where *most* book replies are ≥ 0, so that Black's best
   reply still leaves you a playable game. For example, **d3** (lowest reply 0) or **c3** (lowest −7).
2. **Black: prepare one reply to each of White's ten first moves.** Choose the most negative eval from White's
   view, if you understand the resulting structure. Example: against Nc3, …e4 (−74); against Nd3, …f4 (−76);
   against a3, …c4 (−59); against b3, …a4 (−51); against e3, …a4 (−46); against f3, …d4 (−38).
3. **Attach a plan, not a move list:** for each line write one sentence. *Which pawn will advance, where my knights
   go, where my king is safe.*
4. **Test it:** play training games from each line against L5–L7 and check the Lab's *Opening understanding*
   dimension.

### Common mistakes
* **Treating ±76 cp as a big difference.** Read through the game's expected-score map (fitted for the Crown engine,
  so only a rough guide for another engine's centipawns), it is about 0.37–0.63 at the extremes, and these are
  depth-10 judgements. Either side can play all 64 lines.
* **Memorising moves beyond move 3.** There is no theory to memorise. Your plan matters more.
* **Ignoring the styled opponents' preferences.** A Tactical or Positional competitor picks among its own 30 cp book
  for six plies (Chapter V.3).

### Advanced insight
**Long-term plans on 6×6.** With only four steps to promotion, a pawn majority on one wing is a much more
immediate asset than in orthodox chess. Middlegame plans often come down to "which majority promotes first, and
whose king is closer" ([Counsel], consistent with the coach's promotion-race topic). Choose openings whose pawn
structure gives *you* the faster majority.

### Worked example
*A Black repertoire against 1.Nf3.* The book's replies range from −30 (…c4, …d4) to +76 (…Nf4). Choose **1…c4**
or **1…d4** (−30 each). Plan for 1…d4: the pawn gains space and attacks c3 and e3 at once. Develop the knights
towards the queenside, keep the king on d6 until the centre clears, and aim the c-pawn at White's queenside. Avoid
1…Nf4 (+76), the worst book reply for Black.

### Guided exercise
Build a White repertoire with **one** first move. Pick it from the table so that Black's best book reply is as good
as possible for White. Which move, and what is Black's best book reply?

### Independent exercises
1. Which first move for White has the most book replies, and what is its worst one for White?
2. Against 1.f3, which book reply is best for Black, and which is worst?
3. Why might a player prefer 1.c3 (worst reply −7) over 1.Na3 (worst reply −14) even though the difference is
   tiny?
4. Write a one-sentence plan for White after 1.d3 d4.

### Answers
* **Guided:** **d3** or **c3**. 1.d3's lowest book reply is 0 (…c4). 1.c3's lowest is −7 (…c4). Choose d3 for the
  strict answer: Black's best book reply leaves 0.
* **1:** **a3** with 9 replies; its worst for White is **…c4 (−59)**.
* **2:** best for Black **…d4 (−38)**; worst for Black **…e4 (+75)**.
* **3:** with a gap of only 7 cp, choose by *structure and plan*: which middlegames you understand. Both are
  balanced.
* **4:** any concrete plan is acceptable. For example: "The d-pawns block each other. I will develop Nf3 and
  challenge the d4-pawn with e3, keeping my king on d1 behind the blocked centre until the queens come off."

### Summary
The 64 book openings are all balanced at depth 10 (±80 cp). Choose a small repertoire by the worst reply you might
face, attach a plan to each line, and test it in training games. There is no 6×6 theory, so understanding beats
memory.

### Next lesson
Chapter V.8: the final challenge, Sovereign Unbound, described exactly as it is.

---

## Chapter V.8 — The Unbound Challenge: preparing to face Sovereign Unbound

### Learning objectives
* Know exactly what Sovereign Unbound is, what its thinking budgets mean, and how strong it has been measured to be.
* Set honest goals for games against it.
* Prepare with the game's tools rather than with myths.

### Prerequisites
All of Book V.

### Explanation
**What it is. [Demonstrated]** src/engine/levels.ts: L9 *Sovereign Unbound* is the canonical engine
(crown-search-2 + crown-eval-4). It has no random choices, no handicap and no style, uses a 2^20-entry
transposition table (about 11.5 MB), and plays with a thinking budget you choose:

| Budget | Name | Notes |
|---|---|---|
| 1 s | Fast | casual |
| 5 s | Strong | casual |
| **10 s** | **Rated** | **rated games always use 10 s**, so its rating stays meaningful |
| 15 s | Deep | casual |
| 30 s | Unbound | casual |
| 60 s | Unbound+ | casual |

The budget is an **upper bound per move**: in timed games the engine's own clock can lower it. Its allocation is
min(budget, (remaining − reserve)/22 + 0.75 × increment, 0.35 × remaining). At the **first move** of a Blitz 3+2 game
that is about **9.6 s**, in Rapid 5+3 about **15.8 s**, and in Classical 15+10 about **48.3 s**. So the 30 s and 60 s
budgets only take full effect in untimed games or with plenty of clock. (Computed from `allocateTime`, with a reserve
of min(10 % of remaining, 1.5 s).) Since v0.8, *fullBudget* makes the engine keep starting new search iterations
until 62.5 % of its budget is used. At a 5 s budget it was measured using about 81 % of the time.

**How strong. [Demonstrated]** src/engine/calibration.json and docs/V8_SOVEREIGN_STANDARD.md:

* Crown rating **3038 ± 171**: a *derived* point (L8's rating plus a measured L9 − L8 difference of +112 [60, 163]
  over 64 games at time-scaled budgets on one host). It is engine-vs-engine only. There are **no human calibration
  games**. The Crown scale is not FIDE.
* **More time helps:** in 128-game matches against itself, each doubling of thinking time was worth **+103 [55, 153]**
  (50 → 100 ms), **+80 [38, 128]** (100 → 200 ms) and **+106 [63, 150]** (200 → 400 ms) Elo. The gain at
  multi-second budgets **was not measured** (doubling gains usually shrink as time grows). So 15/30/60 s are
  genuinely stronger than 1/5 s, but by an unknown amount.
* **Against Fairy-Stockfish** (a developer benchmark, never bundled), at equal time it scored −379 [−482, −309] Elo at
  100 ms, −330 at 300 ms and −283 [−379, −213] at 1,000 ms. Sovereign is strong on the Crown scale, and far from the
  strongest possible 6×6 player.

**What that means for you.** The calibration's logistic model gives the expected score per game for a rating gap
d as 1/(1 + 10^(d/400)): for d = 400, 0.091; d = 600, 0.031; and for a 2000-rated player against 3038 (d = 1038),
about **0.0025**, roughly one draw in two hundred games. Treat this as order-of-magnitude only: the rating has an
RD of 171, and it says nothing about humans directly. **Honest goal-setting:** below about 2600 on the Crown scale,
aim to *survive critical moments* and to reach drawn endings. A draw against Sovereign Unbound is a real
achievement. A win is extraordinary ([Counsel] on goals; the numbers are [Demonstrated]).

### Illustrated example
The step from L8 to L9 is measured, about +112 Elo. The step from L9 at 10 s to L9 at 60 s is **not**. When you
beat L9 at the Fast budget (1 s), you have beaten a weaker opponent than rated L9. The 5 s and 10 s budgets differ
by one doubling, which at short budgets was worth about +80 to +106. Record the budget with every result.

### Step-by-step reasoning: the preparation cycle
1. **Climb the ladder honestly:** reach a positive score against L7, then L8, before you play rated L9 ([Counsel]).
2. **Play casual L9 games at 1 s** to learn its style: it never errs randomly, so every inaccuracy you see is in
   *your* play.
3. **Study each loss** with the routine in Chapter V.6. Against L9, the first turning point is usually early.
4. **Choose openings** from Chapter V.7 that lead to structures you understand.
5. **Aim for simplification and repetition** (Chapters V.2 and V.5). Fewer critical moments means fewer chances to
   go wrong.
6. **Then play rated L9 at 10 s,** in a time control that gives you enough clock: Classical 15+10 if you calculate
   slowly.

### Common mistakes
* **Believing longer budgets are "unbeatable".** They are stronger, by an unmeasured amount. They are not perfect.
* **Believing short budgets are "weak".** At 1 s it is still a full search with no randomness.
* **Hoping it will "throw" a game.** No level does. L9 has no selection at all.
* **Comparing Crown ratings with FIDE ratings.** The scale is anchored at L1 = 800 by design.

### Advanced insight
Engines are strongest in sharp tactics and relatively weaker in long-horizon plans. Their weakness is the search
horizon, not calculation. On a 6×6 board the horizon covers more of the game than on 8×8, so expect fewer strategic
gifts than in orthodox engine games ([Counsel]: a plausible reading of the depth figures, not a measurement).
In rated play you get no engine hints. Your preparation is all you bring.

### Worked example
*You are 2,250 (established) and play 10 rated games against L9.* Logistic expected score per game for d = 788:
1/(1 + 10^(788/400)) ≈ 0.011, so about **0.1 points over 10 games**. Expect to lose most games. Each game is still a
lesson, and each draw is a clear signal of progress. Afterwards, Glicko-2 moves your rating little for expected
losses and a lot for a surprise draw.

### Guided exercise
At the first move of a Rapid 5+3 game you select the 30 s budget. (a) How long can L9 think on its first move? (b)
Which budget would give the same first-move limit? (c) Why might you still choose 30 s?

### Independent exercises
1. Which budget do rated L9 games always use, and why?
2. Using the doubling table, estimate the Elo difference between 100 ms and 400 ms thinking. Why can you **not**
   apply the same figure to 15 s versus 60 s?
3. In Classical 15+10, with 300 s left and a 10 s increment, how long can L9 think if you chose 60 s?
4. Name two things L9 never does that some lower levels do.

### Answers
* **Guided:** (a) about **15.8 s** (the clock allocation is below the 30 s budget). (b) Any budget ≥ 15.8 s gives
  the same first move. The 15 s budget gives slightly less (15 s). (c) Later in the game, if the engine has saved
  time or with a larger increment, the allocation could rise above 15 s. The 30 s budget sets the upper bound.
* **1:** **10 s** (MAX_RATED_BUDGET_S), so that its measured rating stays meaningful.
* **2:** about +80 + 106 = **+186** Elo for two doublings at those budgets. The multi-second gain was not measured,
  and doubling gains usually shrink as time grows.
* **3:** reserve = min(30 s, 1.5 s) = 1.5 s; (300 − 1.5)/22 + 0.75 × 10 = 13.57 + 7.5 ≈ **21.1 s** (below the
  0.35 × 300 = 105 s cap and below 60 s).
* **4:** it never chooses randomly among near-best moves (L1–L4 do), and it never limits its search to a fixed node
  budget (L5–L7 do). It also never uses a style repertoire.

### Summary
Sovereign Unbound is the full canonical engine with a chosen budget (rated: 10 s). Its rating is 3038 ± 171
(derived, engine games only). More time makes it stronger, by an unmeasured amount at long budgets, and it remains
well below Fairy-Stockfish. Prepare by climbing the ladder, studying losses, simplifying and repeating. Set honest
goals: a draw is a triumph.

### Next lesson
Book VI, *The Oracle*: the other half of a Sovereign's mind, forecasting under uncertainty on the Crown Exchange.

---

# Book VI — The Oracle

*Forecasting and the Crown Exchange*

> A Sovereign who can calculate a mate in three but cannot say how likely a game is to end in a draw has learned
> only half of judgement. The Oracle's discipline is the other half: **stating beliefs as numbers, testing them
> against reality, and never staking more than the evidence supports.**

**Fictional money only.** The Crown Exchange uses the game's **fictional dollars**. Nothing in it is, or can become,
real money, and nothing in this book is advice about real-money betting or investing. The Exchange is in the game
to teach probability, calibration and risk. Its lessons are the same ones that make reckless real-world gambling a
losing proposition, and this book says so wherever it matters.

As in Book V, statements are marked **[Demonstrated]** (read from the game's code or computed with its own
functions) or **[Counsel]** (practical advice, not measured). Every dollar figure in a worked example was computed
by calling the game's own pricing code (src/exchange/lmsr.ts) unless stated otherwise.

**The rules this book relies on. [Demonstrated]** (src/exchange/*, src/app/federation.ts, src/app/markets.ts):

* A market lists **mutually exclusive, exhaustive states**, for example *White wins / Draw / Black wins*. A **share**
  of a claim pays **$1** if the claim's state happens and $0 otherwise.
* Prices come from an automated market maker, the **LMSR**. There is no order book, and you trade against the maker.
* A **fee of 1 %** of the executed amount (rounded up) is charged on every buy *and* every sell.
* Holdings are **long-only**: you can sell only shares you hold. There is no short selling.
* Markets go **open → closed → settled or cancelled**, and are never reopened. **Settlement** pays $1 per winning
  share. **Cancellation** pays the market's published cancellation vector (for a match market, $1/3 per share).
* **Information policy:** official markets **never list your own games**. Rated games never carry markets. If you
  sponsor a competitor, you cannot buy in markets involving them (you may still sell). If you enter an event, its
  open winner market is cancelled at 1/n first. In live games, **move grades stay hidden until the market is
  settled or cancelled**. There is also a separate **Sandbox Exchange** with practice money on your own casual
  quick matches, where you may only back yourself and trading closes at the first move. Sandbox money never touches
  your official cash, net worth, ratings or standings.

---

## Chapter VI.1 — The Language of Chance: probability, prices and expected value

### Learning objectives
* Read a price as an implied probability.
* Compute the expected value (EV) of a trade in dollars, including the fee.
* Find the break-even belief for a trade.

### Prerequisites
Basic arithmetic with decimals. Book V, Chapter V.6 (the expected-score scale).

### Explanation
A **probability** is a number from 0 to 1 that says how likely an outcome is. For a single game, the three outcomes
*White wins, Draw, Black wins* have probabilities that add up to 1.

Because a share pays exactly $1 if its outcome happens, a **price of $0.40 says "40 % likely"**. That is the
**implied probability**. In the LMSR the prices of all states always add up to exactly $1 ([Demonstrated],
`prices()` normalises them). The price of a claim covering several states is the sum of their prices.

The **expected value** of a trade is what it earns on average, if your belief is right:

> EV = (your probability) × $1 × shares − (total paid, including the fee)

For a small trade at price *p*, the total paid per share is about *p* × 1.01, so the trade has positive EV only if
your belief *q* is above **1.01 × p**. That is the **break-even belief**. For larger trades the price moves against
you while you buy (Chapter VI.2), and the break-even rises.

### Illustrated example
A featured match is priced **White $0.40 · Draw $0.30 · Black $0.30**. You believe White wins 50 % of the time.

You buy **10 White shares**. The game's quote is $4.14 in total, fee included (computed with `buyClaimMicro` and
`feeMicro`; the price after your trade is $0.420).

EV = 0.50 × $10 − $4.14 = **+$0.86**. If White wins you receive $10.00 (profit $5.86). Otherwise you receive $0
(loss $4.14). Neither result tells you whether the trade was good. The EV does, and only if your 50 % is right.

### Step-by-step reasoning
1. **Write your probability first,** before you look at the price ([Counsel]: this guards against anchoring).
2. **Read the price** as the market's implied probability.
3. **Compare:** is your belief above 1.01 × price?
4. **Get the quote** for the size you want. It includes the price movement and the fee.
5. **Compute EV** = belief × shares − quoted total.
6. **Decide size** separately (Chapter VI.4). A positive EV does not mean "buy as much as you can".

### Common mistakes
* **Treating the price as the probability of winning *money*.** The price is the probability of the *outcome*. Your
  profit also depends on what you paid.
* **Forgetting the draw.** In chess-like games draws are common. The Federation's result model gives about 31 %
  draws between equals ([Demonstrated], crown-result-model-1, ν = 0.9).
* **Forgetting the fee on the way out.** Selling also costs 1 %.

### Advanced insight
The Federation's **public forecast** for a match uses the Davidson model on public ratings
([Demonstrated], src/federation/resultModel.ts): with π = 10^(rating/400) for each side,
P(W) = π_w / Z, P(D) = ν·√(π_w·π_b) / Z, P(B) = π_b / Z, where Z is the sum of the three numerators and ν = 0.9.
Computed values:

| White − Black (public rating) | P(White) | P(Draw) | P(Black) | White's expected score |
|---|---|---|---|---|
| 0 | 0.345 | 0.310 | 0.345 | 0.500 |
| +100 | 0.447 | 0.302 | 0.251 | 0.598 |
| +200 | 0.549 | 0.278 | 0.174 | 0.688 |
| +400 | 0.722 | 0.206 | 0.072 | 0.825 |

Prices that stray from this public model are either noise or information. Chapter VI.7 shows which.

### Worked example
A promotion market (*Yes / No*) shows **Yes at $0.30**. You think the competitor's chance of finishing in the top two
is 40 %.

* Break-even for a small trade: 1.01 × 0.30 = **0.303**. Your 0.40 is above it.
* Quote for 25 Yes shares (liquidity b = 80 for promotion markets): **$8.44** total, average price $0.334, price after
  $0.369 (computed).
* EV = 0.40 × $25 − $8.44 = **+$1.56**.

### Guided exercise
A match is priced **White $0.55 · Draw $0.25 · Black $0.20**. (a) What probability does the market give a Black win?
(b) What is the break-even belief for a small purchase of Black shares? (c) You believe Black wins 25 % of the time,
and the quote for 20 Black shares is $4.25. What is the EV?

### Independent exercises
1. The draw is priced at $0.31. A small trade costs about $0.313 per share with the fee. What is the lowest belief
   in a draw at which buying is worth it?
2. You buy 1 share of White in a fresh match market (all prices $1/3). The game's quote is $0.3376. Why is it more
   than $0.3333?
3. You hold 20 White shares bought for $9.00 in total. White wins. What is your profit? What would it have been if
   the game had been cancelled (match markets pay $1/3 per share)?
4. Explain in one sentence why "the trade lost money" is not the same as "the trade was a mistake".

### Answers
* **Guided:** (a) **20 %**. (b) **0.202** (1.01 × 0.20). (c) EV = 0.25 × $20 − $4.25 = **+$0.75**.
* **1:** about **0.313**. Below that, the fee makes the expected profit negative even before price movement.
* **2:** the price rises slightly while you buy (the cost is $0.334261 for the share itself), and the 1 % fee
  ($0.003343, rounded up) is added. Total **$0.337604**, which the screen shows rounded.
* **3:** win: $20 − $9 = **+$11**. Cancellation: 20 × $1/3 = $6.67 (rounded down per holding), so **−$2.33**.
* **4:** a trade's quality is its EV at the time of the trade, given what was knowable. Its result also includes
  luck (Chapter VI.7).

### Summary
Price = implied probability. EV = belief × payout − total cost. Break-even belief ≈ 1.01 × price for small trades,
higher for large ones. Write your belief before you look at the price, and judge trades by EV, not by results.

### Next lesson
Chapter VI.2: how the market maker sets those prices, and why buying moves them.

---

## Chapter VI.2 — The Engine of Prices: the LMSR market maker, liquidity and slippage

### Learning objectives
* State the LMSR cost and price formulas and compute a trade's cost by hand.
* Explain liquidity (b), slippage and the maker's funded subsidy.
* Estimate price impact before you trade.

### Prerequisites
Chapter VI.1. Natural logarithms and exponentials (a calculator is fine).

### Explanation
**[Demonstrated]** src/exchange/lmsr.ts: the Crown Exchange uses Hanson's **logarithmic market scoring rule**
with a fixed liquidity parameter *b*. For outstanding shares q = (q₁, …, qₙ) across the n states:

> **Cost function:** C(q) = b · ln( Σᵢ e^(qᵢ / b) )
>
> **Price of state i:** pᵢ = e^(qᵢ / b) / Σⱼ e^(qⱼ / b)
>
> **Cost of a trade** that changes q to q′: **C(q′) − C(q)**

Consequences:

* **Buying a state raises its price and lowers the others.** Prices always add up to 1.
* **Path independence:** buying 30 shares at once costs the same as buying 10 three times (apart from rounding and
  the fee on each trade).
* **Rounding favours the market:** buy costs are rounded *up* to the next micro-dollar and sale proceeds *down*.
* **The maker's worst-case loss is b · ln n,** and that **subsidy is funded before the market opens**. For a match
  market (b = 120, n = 3) it is **$131.83**.
* **Liquidity by market family:** match 120, tournament winner 150, promotion 80, qualification 80, season title
  100, bracket 100; Sandbox 60 (src/exchange/families.ts, src/app/federation.ts).

A larger *b* means **more liquidity**: prices move less per share. **Slippage** is the difference between the price
you see and the average price you pay. Near a price *p*, each share moves the price by about **p(1 − p)/b**.

### Illustrated example
*A fresh match market:* q = (0, 0, 0), b = 120, all prices $0.3333. You buy **30 White shares**.

* C(0,0,0) = 120 · ln 3 = **131.8335**
* C(30,0,0) = 120 · ln(e^0.25 + 2) = 120 · ln(3.284025) = **142.6884**
* Cost = 142.6884 − 131.8335 = **$10.8549** (the game's exact figure: $10.854918)
* Fee: 1 % rounded up = **$0.108550**, so the total is **$10.963468**
* New White price = e^0.25 / (e^0.25 + 2) = 1.284025 / 3.284025 = **$0.3910**; Draw and Black fall to **$0.3045**
* Average price paid: $10.8549 / 30 = **$0.3618**, about 2.9 cents of slippage per share

### Step-by-step reasoning: estimating impact before trading
1. Read the current price *p* and the market's *b*.
2. Estimate the price after *n* shares: about p + n·p(1 − p)/b for small n. Near $0.50 with b = 120, that is about
   0.2 cents per share.
3. The average price you pay is roughly halfway between the start and the end price.
4. Ask the game for the exact quote. The estimate only tells you whether the size is sensible.

Measured slippage when **White is at $0.40** (Draw and Black $0.30), b = 120 (computed):

| Shares bought | Total incl. fee | Average price | White price after |
|---|---|---|---|
| 50 | $22.78 | $0.451 | $0.503 |
| 100 | $50.78 | $0.503 | $0.605 |
| 150 | $83.78 | $0.553 | $0.699 |
| 200 | $121.18 | $0.600 | $0.779 |
| 250 | $162.20 | $0.642 | $0.843 |

### Common mistakes
* **Judging a trade by the displayed price.** You pay the *average* price over the trade. Use the quote.
* **Buying and selling back quickly.** A round trip costs two fees. Buying 10 shares at $0.50 costs $5.1552, and
  selling them straight back nets $5.0531: **$0.10 lost** for nothing.
* **Forgetting quotes expire.** A quote is tied to the market's *revision*, which changes with every trade and every
  published live move. A stale quote is rejected, not filled at a worse price ([Demonstrated], `revisionOf`).

### Advanced insight
Because every claim in a market shares **one inventory**, prices stay coherent across claims. In a bracket market
(8 states: the possible final-four paths), "A is champion" covers 2 states and "A reaches the final" covers 4, so
the champion claim can never cost more than the finalist claim ([Demonstrated], src/exchange/market.ts). In a fresh
bracket market every path costs 1/8, so the champion claim starts at **$0.25**.

### Worked example
*How large can a trade be before it stops making sense?* White is at $0.40 and you believe 0.50. As you buy, the
marginal price rises towards your belief. Buying beyond the point where the marginal price passes your belief
(minus the fee) *loses* EV. Computed EV, belief 0.50:

| Shares | Total paid | EV | Price after |
|---|---|---|---|
| 10 | $4.14 | +$0.86 | $0.420 |
| 25 | $10.74 | +$1.76 | $0.451 |
| 40 | $17.80 | +$2.20 | $0.482 |
| 50 | $22.78 | +$2.22 | $0.503 |
| 60 | $27.96 | +$2.04 | $0.524 |
| 75 | $36.13 | +$1.37 | $0.555 |
| 100 | $50.78 | −$0.78 | $0.605 |

EV peaks at **about 45–50 shares** (the price needed to reach $0.495 is 46 shares). Beyond that, every extra share
costs more than it is worth to you. **The market's liquidity, not your enthusiasm, sets the useful size.**

### Guided exercise
A fresh match market (b = 120). (a) Compute the White price after buying 120 White shares. (b) Compute the cost
before the fee. Use e ≈ 2.71828. (c) Is the average price above or below $0.45?

### Independent exercises
1. What subsidy does the game fund when it opens a binary promotion market (b = 80, n = 2)? And a 16-entrant
   tournament-winner market (b = 150)?
2. The same 30-share purchase in a Sandbox market (b = 60) costs $11.75 before the fee and moves White to $0.452.
   Why is it more expensive than in a match market?
3. Near a price of $0.50 in a b = 80 market, roughly how far does one share move the price?
4. You sell 30 White shares straight back into the market right after the illustrated example's purchase. The
   proceeds are $10.854917 before the fee. Why one micro-dollar less than you paid?

### Answers
* **Guided:** (a) e/(e + 2) = 2.71828/4.71828 ≈ **$0.5761**. (b) 120·ln((e + 2)/3) = 120·ln(1.57276) ≈
  **$54.34** (the game: $54.339892). (c) $54.34 / 120 ≈ **$0.453**, slightly **above** $0.45.
* **1:** 80·ln 2 = **$55.45**. 150·ln 16 = **$415.89** (computed with `subsidyMicro`, rounded up).
* **2:** a smaller b means lower liquidity: each share moves the price more, so the average price is higher.
* **3:** 0.5 × 0.5 / 80 ≈ **0.003**, about 0.3 cents per share.
* **4:** buy costs round **up** and sale proceeds round **down** to the micro-dollar, so rounding residue always stays
  with the market's collateral. The fee is charged again on the sale, giving net proceeds of $10.746367.

### Summary
The LMSR prices states by pᵢ = e^(qᵢ/b)/Σe^(qⱼ/b) and charges C(q′) − C(q) for a trade. Liquidity b sets the slippage,
about p(1 − p)/b per share. The maker's loss is capped at b·ln n, funded in advance. Size your trade by where the
marginal price meets your belief, not by your budget.

### Next lesson
Chapter VI.3: how good are your beliefs? The game measures them.

---

## Chapter VI.3 — Measuring the Oracle: calibration and the Brier score

### Learning objectives
* Compute the Brier score and the log score exactly as the game does.
* Explain why honest forecasts score best (proper scoring).
* Read the calibration chart and the skill tiers, and know how many forecasts it takes to judge them.

### Prerequisites
Chapter VI.1.

### Explanation
**Paper forecasts. [Demonstrated]** src/app/forecasting.ts (crown-forecast-1): for any market you may record a
**free probability vector** over its states. It costs nothing and is **locked when the market closes**. On resolution
it is scored with two proper scoring rules:

> **Brier score:** B = Σₛ (pₛ − yₛ)², summed over **all states**, from 0 (perfect) to 2 (worst). Lower is better.
>
> **Log score:** L = −Σₛ yₛ · ln max(pₛ, 0.001). Lower is better.

Here y is the resolution vector: 1 for the state that happened and 0 for the others (½/½ for joint champions).
**Cancelled markets are not scored.** Because the game sums over every state, a two-state market's Brier score is
**twice** the "binary Brier" you may know from elsewhere.

Your forecasts are compared with two baselines: the **market price** at the time of your forecast, and the
**public forecast** (the model). Over your scored forecasts the game shows a tier ([Demonstrated],
src/ui/ForecastScreen.tsx): **Apprentice** (fewer than 10 scored), **Sharp** (your mean Brier more than 0.02 below the
public forecast's), **Calibrated** (within ±0.02 of it) or **Learning** (more than 0.02 behind it). A rolling chart
shows your mean Brier over your last 10 resolved forecasts.

**Calibration** means that things you call 70 % happen about 70 % of the time. The game pools every (probability,
outcome) pair into **ten bins** (0–10 %, 10–20 %, …) and shows each bin's observed frequency with a **Wilson 95 %
interval**. A wide interval means too few forecasts in that bin to judge.

**Forecast skill is never mixed into chess or financial prestige.** A good forecast is not a profitable trade.
Trading profit depends on prices paid and fees, and is reported separately.

### Illustrated example
You forecast a match **White 0.50 · Draw 0.30 · Black 0.20**. Computed with the game's `brier` and `logScore`:

| Result | Brier | Log |
|---|---|---|
| White wins | (0.5−1)² + 0.3² + 0.2² = **0.38** | −ln 0.5 = **0.693** |
| Draw | 0.5² + (0.3−1)² + 0.2² = **0.78** | −ln 0.3 = **1.204** |
| Black wins | 0.5² + 0.3² + (0.2−1)² = **0.98** | −ln 0.2 = **1.609** |

For comparison: the "know-nothing" forecast (⅓, ⅓, ⅓) always scores **0.667**. A confident miss such as
(0.90, 0.05, 0.05) when Black wins scores **1.715** (log 2.996). The same forecast when White wins scores **0.015**.

### Step-by-step reasoning: why honesty wins
Suppose a promotion is truly 70 % likely. Your expected Brier score (two-state, as the game computes it):

* say **0.70**: 0.7 × 0.18 + 0.3 × 0.98 = **0.42**
* say **0.90** (overconfident): **0.50**
* say **0.50** (timid): **0.50**

Any distortion, in either direction, worsens the expected score ([Demonstrated] arithmetic). That is what "proper
scoring rule" means: **your best strategy is to report what you actually believe.**

### Common mistakes
* **Judging yourself on a handful of forecasts.** For an honest forecaster facing 60 % events, the standard deviation
  of the mean Brier is about **0.062 over 10 forecasts, 0.028 over 50 and 0.014 over 200** (computed). The ±0.02
  band between "Sharp", "Calibrated" and "Learning" needs **well over 50 forecasts** to mean much.
* **Rounding to 0 or 1.** The log score clamps at 0.001, but a near-zero forecast that misses still scores
  −ln 0.001 ≈ 6.9.
* **Copying the market price.** You will match the market's Brier, which is safe, but you learn nothing about your
  own judgement.

### Advanced insight
**Calibration and sharpness are different.** A forecaster who always says (⅓, ⅓, ⅓) is perfectly calibrated in a
trivial sense but scores 0.667 every time. Skill is being calibrated **and** confident when the evidence allows.
The bins show calibration, and the mean Brier against the public forecast shows whether you add anything
([Counsel] on interpretation; the measures are [Demonstrated]).

### Worked example
Five resolved forecasts on match markets:

| Your forecast (W/D/B) | Result | Brier |
|---|---|---|
| 0.50 / 0.30 / 0.20 | White | 0.38 |
| 0.40 / 0.35 / 0.25 | Draw | 0.16 + 0.4225 + 0.0625 = 0.645 |
| 0.60 / 0.25 / 0.15 | White | 0.16 + 0.0625 + 0.0225 = 0.245 |
| 0.30 / 0.30 / 0.40 | White | 0.49 + 0.09 + 0.16 = 0.74 |
| 0.45 / 0.30 / 0.25 | Black | 0.2025 + 0.09 + 0.5625 = 0.855 |

Mean = (0.38 + 0.645 + 0.245 + 0.74 + 0.855)/5 = **0.573**. That beats the uniform 0.667. Whether it beats the
public forecast depends on *its* scores on the same five markets, and five forecasts are far too few to say (see
above).

### Guided exercise
A two-state qualification market. You forecast **Yes 0.80**. (a) Brier if Yes happens? (b) Brier if No happens?
(c) Your expected Brier if the true chance is 0.80?

### Independent exercises
1. Compute the Brier and log scores of (0.25, 0.50, 0.25) when the game is drawn.
2. Why does a cancelled market not count against your forecasting record?
3. You have 12 scored forecasts with mean Brier 0.52; the public forecast has 0.55 on the same markets. Which tier
   does the game show, and how much should you trust it?
4. In your calibration chart the 70–80 % bin shows a frequency of 0.50 with a Wilson interval of 0.24–0.76. What can
   you conclude?

### Answers
* **Guided:** (a) (0.8 − 1)² + (0.2 − 0)² = **0.08**. (b) 0.8² + (0.2 − 1)² = **1.28**. (c) 0.8 × 0.08 + 0.2 × 1.28 =
  **0.32**.
* **1:** Brier 0.0625 + 0.25 + 0.0625 = **0.375**; log −ln 0.5 = **0.693**.
* **2:** a cancelled market has no outcome. The game scores only settled markets.
* **3:** 0.52 < 0.55 − 0.02 = 0.53, so **Sharp**. But with 12 forecasts the noise (about 0.06 per mean) is larger than
  the 0.03 gap. **Do not trust it yet.**
* **4:** almost nothing. The interval includes 0.75 (well calibrated) and 0.50 (overconfident). Gather more forecasts.

### Summary
The game scores paper forecasts with the Brier score (sum over all states, 0–2) and the log score, both lower-is-
better and both proper: honesty minimises your expected score. The calibration chart and the tiers need many
forecasts before they mean anything. Forecast skill is separate from trading profit.

### Next lesson
Chapter VI.4: from belief to stake. How much should you risk?

---

## Chapter VI.4 — Sizing the Stake: Kelly as a ceiling, risk as a discipline

### Learning objectives
* Compute the Kelly fraction for a $1 claim, and use fractional Kelly only as an upper bound.
* Combine Kelly with slippage, and see why liquidity usually binds first.
* Set per-market and total exposure limits, and never go all-in.

### Prerequisites
Chapters VI.1–VI.3.

### Explanation
The **Kelly criterion** gives the fraction of your bankroll that maximises long-run growth *if your probability is
exactly right*. For buying a $1 claim at price *p* when your belief is *q* (ignoring fees and slippage):

> **f\* = (q − p) / (1 − p)**

Three facts make full Kelly dangerous ([Counsel], widely accepted in forecasting practice):

1. **Your q is an estimate.** If it is too high, Kelly over-bets, and over-betting by a factor of two already
   gives zero long-run growth.
2. **Swings are large** even when q is right.
3. **In this game, prices move while you buy,** so the real edge shrinks as size grows (Chapter VI.2).

So use **fractional Kelly (½ or ¼) as a ceiling, never as a target,** and cap it further by liquidity and by fixed
exposure limits. **Never stake your whole bankroll on one market.** Keep cash for entry fees and running costs: your
career pays bills too. The economy simulations in docs/V8_SOVEREIGN_STANDARD.md show strategies that ran cash below
$100 for many rounds ([Demonstrated] that it happens; the rule is [Counsel]).

The game's own NPC traders obey similar discipline ([Demonstrated], src/exchange/npc.ts): each trades at most a
fixed share of its wallet per market (2 %–12 %), and their **open cost basis may not exceed 60 % of the wallet**.

### Illustrated example
Bankroll **$1,000**. White is at **$0.40**, and you believe **0.50**.

* f\* = (0.50 − 0.40)/(1 − 0.40) = **0.1667**, so full Kelly is $167, half Kelly $83 and quarter Kelly $42.
* **Half Kelly in this market:** $83 buys **148 shares** at an average of $0.551 and pushes the price to $0.696.
  The EV at your belief is **−$8.37**. You paid more per share than you think the share is worth!
* **The liquidity limit:** EV peaks at about 45–50 shares, roughly **$20–23** (Chapter VI.2).

In a b = 120 market, **liquidity binds long before Kelly.** The right size here is about $20, or 2 % of the bankroll,
not $83 or $167.

### Step-by-step reasoning: a sizing routine
1. Compute f\* and halve or quarter it. That is the **ceiling**.
2. Find the size at which the marginal price reaches your belief minus the fee. That is the **liquidity limit**.
3. Apply your **per-market cap**, for example 2–5 % of your bankroll ([Counsel]).
4. Check your **total exposure** across all open markets, for example at most 25 % ([Counsel]).
5. Take the **smallest** of these four numbers.

### Common mistakes
* **Doubling up after a loss** ("chasing"). The next market is independent of your last result. Your bankroll is
  smaller, so your size should be too.
* **Treating a closed market as cash.** A closed market cannot be traded. Until settlement, the game values it only at
  its **cancellation vector** (`liquidationValue`).
* **Ignoring cancellation risk.** If you bought 100 White shares in a fresh match market for $43.66 and the game is
  cancelled (for example by the 400-ply playing limit), you receive **$33.33**.
* **All-in on a "sure thing".** In a chess game the favourite at 0.82 still fails nearly one time in five.

### Advanced insight
**Correlated positions count as one.** Positions that depend on the same competitor, say a tournament-winner
claim on them and "they win" in two of their featured match markets, rise and fall together. For sizing, add them up as a single exposure. Chapter VI.5 shows
how.

### Worked example
Bankroll $600. A promotion market (b = 80) shows Yes at $0.30, and you believe 0.40.

* f\* = (0.40 − 0.30)/(0.70) = 0.143. Quarter Kelly is about **$21**.
* Liquidity: the marginal price reaches $0.396 (your belief minus the 1 % fee) after **34 shares**, which cost
  **$11.91** in total (average $0.347). Beyond that, extra shares lose EV. 50 shares would cost $18.70 and move Yes
  to $0.445, with EV down to +$1.30.
* A per-market cap of 3 % gives **$18**.
* The smallest limit is liquidity: buy about **34 shares for $11.91**, with EV = 0.40 × $34 − $11.91 = **+$1.69**
  (all computed with the game's functions). Check the live quote before you confirm.

### Guided exercise
Bankroll $800. A tournament-winner market (b = 150) lists your favourite at $0.25, and you believe 0.30. (a) Full and
quarter Kelly in dollars? (b) Near $0.25, roughly how much does each share move the price? (c) What other check must
you do before buying?

### Independent exercises
1. Compute f\* for q = 0.55, p = 0.50, and for q = 0.30, p = 0.25.
2. Why is a quarter-Kelly stake "safer" if your probabilities tend to be overconfident?
3. You hold positions costing $120, $80 and $60 in three markets on the same competitor, and your bankroll is $1,000.
   What is your exposure on that competitor as a percentage?
4. Name two reasons the NPC traders' 60 % exposure cap is *higher* than a sensible cap for you.

### Answers
* **Guided:** (a) f\* = 0.05/0.75 = 0.0667, so full Kelly ≈ **$53** and quarter ≈ **$13**. (b) 0.25 × 0.75/150 ≈
  **0.00125**, about 0.1 cents per share. (c) **Total and correlated exposure.** Is this competitor already in your
  other positions?
* **1:** (0.55 − 0.50)/0.50 = **0.10**; (0.30 − 0.25)/0.75 = **0.0667**.
* **2:** an overconfident q inflates f\*. A smaller fraction leaves room for the error, and over-betting harms growth
  much more than under-betting.
* **3:** $260 out of $1,000 = **26 %**, as one correlated exposure.
* **4:** for example: NPC wallets are topped up each season from the treasury (up to $4,000), while your losses are
  not refunded. NPCs also have no careers, entry fees or club costs to pay. ([Demonstrated] top-up rule; the
  comparison is [Counsel].)

### Summary
Kelly f\* = (q − p)/(1 − p) is a ceiling, not a target. Use ½ or ¼ of it at most. In the Crown Exchange, slippage
usually limits size first: stop where the marginal price meets your belief minus the fee. Add correlated positions
together, cap per-market and total exposure, keep cash for your career, and never go all-in.

### Next lesson
Chapter VI.5: forecasting whole tournaments, where outcomes are linked.

---

## Chapter VI.5 — Tournament Forecasting: correlated outcomes and hedging

### Learning objectives
* Know every Exchange market family, its states, and how it closes, settles and cancels.
* Reason about correlated outcomes across markets.
* Hedge a position by partial sale and compute the resulting outcomes.

### Prerequisites
Chapters VI.1–VI.4; Book V, Chapter V.4 (formats and tiebreaks).

### Explanation
**Market families. [Demonstrated]** src/exchange/families.ts `RULES`:

| Family | States | Trading closes | Settles on | Cancellation pays |
|---|---|---|---|---|
| Match | White / Draw / Black | the match starts (live: after each published move) | the result | 1/3 per share |
| Winner (Swiss Open, Championship) | every entrant | first round processed or first game started | the champion (joint: shares split) | 1/n |
| Promotion | Yes / No (top two) | last league round starts | the promotion list | ½ |
| Qualification | Yes / No (Crown Championship) | last league round starts | the Championship field | ½ |
| Season title | every division member | last league round starts | the title holder (league order) | 1/16 |
| Bracket | 8 final-four paths | the semifinals start | the realised path | \|S\|/8 per share of claim S |

**The public models** use public ratings and recorded results only: the Davidson match model, and Monte Carlo
simulations of the remaining league rounds, of Swiss events and of the bracket (src/exchange/families.ts). Markets
close **when their closing round starts**, so no result is ever traded after it is known (src/app/markets.ts).

**Correlated outcomes** move together. A competitor who wins their games raises their price in *every* market
they appear in at once. Markets on the same competitor, or on competitors in the same league, are linked. In the
bracket market, claims are subsets of the same 8 paths, so "champion", "finalist" and "beats Y in the final" are
nested. A conjunction claim pays nothing if its condition fails. It is **not refunded**.

**Hedging** means reducing the spread of your possible outcomes, usually by selling part of a position after the
price has moved. In this game you cannot short, so you hedge by **selling what you hold** (or, in a multi-state
market, by buying other states).

### Illustrated example
You bought **100 White shares** at $0.40 for **$50.78** (fee included). Later, other traders move the market to
**White $0.60 · Draw $0.20 · Black $0.20**. Computed with the game's functions (b = 120):

| Choice | Cash now | If White wins | If not |
|---|---|---|---|
| Hold all 100 | $0 | **+$49.22** | **−$50.78** |
| Sell 50 (nets $27.17, price falls to $0.497) | $27.17 | **+$26.39** | **−$23.61** |
| Sell all 100 (nets $49.23, price falls to $0.395) | $49.23 | **−$1.55** | **−$1.55** |

Selling everything at the new price still *loses* money: selling 100 shares pushes the price back down (slippage),
and you pay the fee twice. **Hedging has a price.** It is worth paying only if your belief has changed or your
exposure is too large.

### Step-by-step reasoning: a tournament forecast
1. **Start from the public model,** and know what it uses: public ratings and recorded results.
2. **Ask what it cannot know:** a high-RD rating is a weak signal (Book V, Chapter V.3), and the remaining schedule
   matters (who still plays whom).
3. **Write your probability vector** as a paper forecast before trading.
4. **Map your exposure:** list every market in which this competitor appears.
5. **Trade only the difference** between your belief and the price, sized by Chapter VI.4.

### Common mistakes
* **Thinking you are diversified when you are not.** Three markets on one competitor are one bet.
* **Buying a conjunction expecting a refund.** "X beats Y in the final" pays $0 if Y never reaches the final.
* **Trading a winner market you might enter.** Your entry cancels it at 1/n, so your position returns 1/n per share,
  whatever you paid.
* **Forgetting the conflict rule.** If you sponsor a competitor, the game refuses your buy orders in their markets.

### Advanced insight
In the bracket market every claim is priced from the same 8 path prices, so you can check coherence yourself: the
champion claim must equal the sum of its two paths, and the finalist claim the sum of its four. If you believe one
path is mispriced, the cheapest way to act is the **narrowest claim containing it**. Broader claims carry the other
paths' prices too ([Counsel], following directly from the [Demonstrated] claim structure).

### Worked example
*A 16-player division title market.* The public model gives the leader 0.35 with four rounds to go. The leader's
remaining opponents are the three strongest players in the division, so you estimate 0.28. The leader's price is
$0.34. **Do not buy the leader, and do not "short" it either (impossible).** Your options are a paper forecast of
0.28, or buying a rival you think is underpriced, *if* your belief about that rival is also above its price. A low
opinion of one competitor does not by itself make any other one cheap.

### Guided exercise
In a fresh bracket market (all 8 paths at $0.125), what does a "champion" claim cost? A "finalist" claim? If you
buy 10 champion shares for competitor A, how does the price of A's finalist claim change, and why?

### Independent exercises
1. Using the illustrated example, what is your profit if you sell 50 shares and White then draws?
2. Why do promotion and qualification markets pay ½ per share on cancellation, while season title markets pay 1/16?
3. You hold X in the Federation Open winner market and then buy "X wins" in a featured match market of one of X's
   Open games. Are these positions correlated? In which direction?
4. Why can no result be traded after it is known in the Exchange?

### Answers
* **Guided:** champion = 2 paths = **$0.25**; finalist = 4 paths = **$0.50**. Buying A's champion claim adds shares
  to A's two champion paths, which are also two of A's four finalist paths. So A's finalist price **rises** too. One
  inventory keeps the prices coherent.
* **1:** a draw is "not White": **−$23.61**.
* **2:** cancellation pays the uniform vector 1/n: two states give ½, sixteen states give 1/16.
* **3:** yes, **positively**. Winning that game raises X's chance of winning the Open, so both positions gain
  together, and losing it hurts both. Count them as one exposure.
* **4:** markets close when their closing round starts, and match markets close at the final move. Live trading
  happens only between published moves, and quotes taken before a move are rejected after it.

### Summary
Know each family's states, closing time, settlement and cancellation. Public models use only public information.
Linked markets are one exposure. Hedge by selling what you hold, but remember that slippage and fees make hedging
costly. Trade only the gap between a written belief and the price.

### Next lesson
Chapter VI.6: forecasting a game while it is being played.

---

## Chapter VI.6 — Live Odds and the Uncertain Board

### Learning objectives
* Know exactly how in-play trading works and what information is public.
* Compute the game's live model from an engine evaluation.
* Judge how certain a chess position really is, and what that means for a forecast.

### Prerequisites
Book V, Chapter V.6 (the expected-score scale); Chapters VI.1–VI.5.

### Explanation
**In-play trading. [Demonstrated]** src/app/federation.ts, src/ui/SpectatorScreen.tsx. When you watch a featured
Federation game live, its match market can be traded **between moves**. After each move is published, then before
the next move is computed, you see what every trader sees: the moves, the engine's own evaluation, and the price
history. **Future moves do not exist while you can trade.** Each move is computed only after the trading window
closes, and a trade queued while a move is being computed is rejected once it is published. **Move grades stay
hidden until the market is settled or cancelled,** and Match Analysis runs only then.

**The live model (crown-odds-2) [Demonstrated]** src/exchange/odds.ts, docs/ODDS_MODEL.md. It is a forecast,
never the price. It is an *ordered logit*: one latent number x measures White's advantage, a draw width θ ≥ 0 sits
on both sides of it, and with σ(z) = 1/(1 + e^−z):

> P(White) = σ(x − θ), P(Black) = σ(−x − θ), P(Draw) = 1 − P(White) − P(Black).

Before the game, x comes from the **public rating gap** (deflated by both RDs, as in Glicko) plus a small fitted
first-move edge for White, and θ from the players' **level** (stronger pairs draw more). After each published move
n, with the published evaluation e (White's view, in units of 100 cp, clamped at ±16):

> x = a(n)·x₀ + b(n)·e,  θ = θ₀ · exp(d(n) + m·(material traded)).

a, b and d were *fitted* on 3,200 Federation-style engine games (held-out validated; the report is in
docs/ODDS_MODEL.md). The rating prior keeps a decaying weight: a = 0.83 at ply 10, 0.59 at ply 40, 0.15 at ply 160.
The evaluation's weight b rises to a peak near ply 40. The draw width grows with the ply count and with traded
material, because long, simplified games are drawish. At ply 0 the live model is exactly the pre-game forecast.

Two NPC desks act in-play: *Kestrel Tactical Desk* trades on this model, and *Tidewater Momentum* buys whatever
has risen since the last window (price history only).

**A fact worth noticing. [Demonstrated]** Up to v0.8 the live model used *only* the evaluation, so at 0 cp it gave
about 0.35 / 0.30 / 0.35 whatever the ratings (bug #21 in docs/BUG_REGISTER.md). crown-odds-2 fixed this: at an
equal evaluation the favourite stays the favourite, by a margin that fades as the game goes on. How much the
ratings should still count late in a game is where your own judgement as a forecaster comes in.

### Illustrated example
A featured game between public ratings **1850 (White) and 1750**, both RD 70. Pre-game model:
**0.660 / 0.107 / 0.233**. Live model after ply 20 with all pieces still on the board, computed with the game's own
`liveWdl`, next to an equal pairing (1800 v 1800) for comparison:

| Evaluation (White) | 1850 v 1750: W / D / B | 1800 v 1800: W / D / B |
|---|---|---|
| 0 cp | 0.578 / 0.172 / 0.251 | 0.462 / 0.190 / 0.347 |
| +50 cp | 0.690 / 0.139 / 0.170 | 0.584 / 0.170 / 0.246 |
| +150 cp | 0.855 / 0.073 / 0.072 | 0.788 / 0.102 / 0.109 |
| +300 cp | 0.962 / 0.020 / 0.018 | 0.942 / 0.031 / 0.028 |
| −150 cp | 0.240 / 0.168 / 0.592 | 0.166 / 0.137 / 0.697 |

And the same 1850 v 1750 game at a level 0 cp as the ply count grows (all pieces on): ply 1 **0.662 / 0.107 /
0.231**, ply 10 **0.613 / 0.133 / 0.253**, ply 40 **0.495 / 0.259 / 0.246**, ply 80 **0.341 / 0.447 / 0.212**,
ply 160 **0.230 / 0.587 / 0.184**. A level position late in the game is mostly a draw.

### Step-by-step reasoning: how certain is this board?
An evaluation is an estimate from a search of limited depth, and its certainty varies a lot.

```crown
fen: NK4/2p1Rr/1Q2p1/5k/6/3n2 w - - 0 1
line: Qxe4+
claim: only-mate-in-2
caption: White to move. Here the result is certain: there is a forced mate in two.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♘ ♔ · · · ·
5 │ · · ♟ · ♖ ♜
4 │ · ♕ · · ♟ ·
3 │ · · · · · ♚
2 │ · · · · · ·
1 │ · · · ♞ · ·
  └─────────────
    a b c d e f    White to move
```
*White to move. Here the result is certain: there is a forced mate in two.*
<!-- /diagram -->

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: a3 f4
show: after
caption: After 1.a3 f4, one of the book's dead-level openings (0 cp at Fairy-Stockfish depth 10). Most of the game is still to be played.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ·
4 │ · · · · · ♟
3 │ ♙ · · · · ·
2 │ · ♙ ♙ ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    White to move
```
*After 1.a3 f4, one of the book's dead-level openings (0 cp at Fairy-Stockfish depth 10). Most of the game is still to be played.*
<!-- /diagram -->

1. **Forced mate on the board:** the result is settled (the first board is proven by exhaustive search). A
   forecast should be near 1, and only the remaining time on the clock adds doubt.
2. **A large but unforced edge** (+300 cp): the map says about 0.93 in engine games. But the map was fitted on
   *engine* games, and a weaker or time-pressed player converts less reliably ([Counsel]).
3. **A balanced position** (the second board): the evaluation says little. The draw rate and the players'
   strengths dominate, which is why the live model keeps a share of the rating prior and widens the draw band as
   the game goes on.
4. **Volatile positions:** if the evaluation has swung several times, the search is struggling. Widen your
   uncertainty rather than chasing each swing ([Counsel]).

### Common mistakes
* **Treating the evaluation as the probability.** It is an input to a model that maps it to an expected score.
* **Chasing momentum.** A price that rose in the last window carries no promise about the next one.
* **Trading on a stale quote.** It will be rejected. Read the new position first.
* **Expecting grades during the game.** They appear only after settlement.

### Advanced insight
The logistic σ is steep near balance and flat near decisive positions, like the map of Book V, Chapter V.6. So a
100 cp swing around 0 moves the live model much more than a 100 cp swing around +500. When a featured game is balanced, small evaluation
changes produce large live-model changes, and prices driven by the Tactical Desk can swing. That is where a
forecaster who reads the position calmly can disagree most usefully ([Counsel]).

### Worked example
The 1850 v 1750 game above. After move 18 (ply 36) the evaluation is **+150 cp** for White, and one rook pair has
been exchanged (material 40 of 50). The live model says **0.852 / 0.098 / 0.050**. The price of White is
**$0.80**. You have watched the game: White's advantage is a protected passed pawn, and Black has no counterplay.
You believe **0.88**.

* Small-trade break-even: 1.01 × 0.80 = 0.808 < 0.88, so the trade is in your favour.
* Size it with Chapter VI.4: a match market has b = 120, so at $0.80 each share moves the price about
  0.80 × 0.20/120 ≈ 0.0013. Stop well before the price reaches about 0.87.
* Write the paper forecast as well. It is scored even if you do not trade.

### Guided exercise
The model's latent advantage is x = 0.8 and the draw width θ = 0.5. Compute W, D and B, and check that they add
up to 1 (σ(0.3) ≈ 0.574, σ(−1.3) ≈ 0.214).

### Independent exercises
1. With x = 0 and θ = 0.26, what are W, D and B? What happens to D when θ grows?
2. Why does the game reject a trade that you queued while the next move was being computed?
3. Name the two NPC traders that act in-play and the information each one uses.
4. Why is a featured game that is stopped by the playing-length limit cancelled rather than settled as a draw?

### Answers
* **Guided:** W = σ(0.8 − 0.5) = σ(0.3) ≈ **0.574**, B = σ(−0.8 − 0.5) = σ(−1.3) ≈ **0.214**, D = 1 − 0.574 −
  0.214 = **0.211** (rounded figures; the three add up to 1 by construction). The published vector also floors each
  state at 0.005 and renormalises, which matters only near certainty.
* **1:** W = B = σ(−0.26) ≈ **0.435**, D ≈ **0.129**. A larger θ pushes both σ terms down, so **D grows**: θ is the
  width of the draw band.
* **2:** the market's **revision** changes when a move is published. A quote taken before new public information can
  never execute after it.
* **3:** **Kestrel Tactical Desk** (the public engine evaluation of the current position, through the live model)
  and **Tidewater Momentum** (price history only). The fans and novices also trade live, on the live model plus their
  noise and bias.
* **4:** a game stopped by the limit has no real result. It is *censored*. The market pays its published
  cancellation vector (1/3), and the standings record an adjudicated draw, labelled as such.

### Summary
Live trading happens between published moves, on public information only. Grades stay hidden until settlement. The
live model (crown-odds-2) combines a fading share of the rating gap with the evaluation through an ordered logit,
with a draw band that widens in long and simplified games. Judge how certain the board really is: proven mate, large edge, balanced, volatile.

### Next lesson
Chapter VI.7: the other traders, your own biases, and the long run.

---

## Chapter VI.7 — The Crowd and the Mirror: NPC traders, overconfidence and the long run

### Learning objectives
* Describe the NPC traders exactly as the code defines them.
* Recognise overconfidence and the other common forecasting and trading errors.
* Separate luck from skill with sample sizes.

### Prerequisites
All earlier chapters of Book VI.

### Explanation
**The NPC traders (crown-npc-traders-2). [Demonstrated]** src/exchange/npc.ts. All eight trade through the same LMSR
as you, long-only, with funded wallets. They use **only** information available when they decide: the published
model (public ratings), the live engine evaluation during play, and public price history. They **never** see hidden
strength or any future move or result. **No trader is guaranteed to profit.**

| Trader | Behaviour | Noise | Margin | Budget per market | Acts |
|---|---|---|---|---|---|
| Old Harbour Fund | conservative value; trades only large mispricings | 0.05 | 0.06 | 2 % | pre-game, between rounds |
| Crown Supporters Club | overconfident fans of the favourite (+0.06 on the favourite) | 0.08 | 0.02 | 5 % | pre-game, live |
| Lantern Contrarians | back the underdog (+0.06) | 0.08 | 0.04 | 3 % | pre-game, between rounds |
| First-Time Forecasters | noisy novices | 0.14 | 0.02 | 3 % | pre-game, live |
| Tidewater Momentum | buys what has risen since the last window | — | 0.03 | 2 % | live, between rounds |
| Summit Tournament Partners | tournament specialist (season and tournament markets) | 0.03 | 0.02 | 6 % | pre-game, between rounds |
| Kestrel Tactical Desk | trades in-play on the public evaluation | 0.03 | 0.03 | 4 % | live |
| Meridian Analytics | calibrated fundamental trader on the public model | 0.03 | 0.02 | 12 % | pre-game, between rounds |

*Noise* is the standard deviation added to the public belief, and *margin* is the minimum edge a value trader
demands. A value trader buys the claim with the largest (belief − price − margin) up to a target price of
(belief − margin). Biased and noisy traders act **first** and the informed ones **last**, so prices usually end near
the public consensus, with residual noise. Wallets are topped up each season to at most $4,000, and open exposure is
capped at 60 % of the wallet.

**What this means for you** ([Counsel], reasoned from the [Demonstrated] design): the price you see usually reflects
the *public model* closely. If you have an edge at all, it comes from **better judgement** than the public ratings
contain: about rating reliability (RD), about the remaining schedule, and about what the board shows in live games.
It does not come from tricks. If you have no view, do not trade. A paper forecast is free.

### Illustrated example: overconfidence
A forecaster says 0.9 to every "favourite wins" question. The favourites truly win 70 % of the time. Expected Brier
(two-state, game formula): honest 0.70 gives **0.42**, while the overconfident 0.90 gives **0.50**. In trading,
overconfidence makes Kelly-sized stakes far too large, and in this game it also makes you push prices past your
true break-even (Chapter VI.4).

### Step-by-step reasoning: luck versus skill
Suppose every trade is like the Chapter VI.2 example: 50 shares bought at $0.40 for **$22.78**, in an outcome that is
truly 50 %. EV = **+$2.22** per trade. The outcome alone has a standard deviation of $25 per trade. With independent
trades (computed with a normal approximation):

| Trades | Expected profit | Standard deviation | Chance of being behind anyway |
|---|---|---|---|
| 1 | $2 | $25 | 46.5 % |
| 10 | $22 | $79 | 38.9 % |
| 100 | $222 | $250 | 18.7 % |
| 400 | $889 | $500 | 3.8 % |
| 1,000 | $2,222 | $791 | 0.2 % |

**A genuine edge can lose for a long time, and a bad trader can be ahead after ten trades.** Results tell you about
skill only over hundreds of comparable decisions. Your Brier score against the public forecast is usually a faster,
cleaner signal than your profit.

### Common mistakes
1. **Outcome bias:** "I lost, so it was a bad trade." Judge EV at the time of the trade.
2. **Overconfidence:** probabilities too close to 0 or 1.
3. **Anchoring** on the price: write your belief first.
4. **Chasing** losses, or doubling up after a win.
5. **Ignoring the fee and slippage,** especially on round trips.
6. **Mistaking correlation for diversification.**
7. **Trading without a view:** when you have no view, the fee is your only certainty.
8. **Letting the Exchange take over your career.** Forecasting skill is not chess skill, and cash lost on the
   Exchange is cash you no longer have for entry fees and club costs.

### Advanced insight
**Base rates first.** Before any specific reasoning, start from the base rate (for example the ≈ 31 % draw rate
between equals in the result model), then adjust for specifics. Forecasters who start from the specifics tend to
overreact to vivid details such as a dramatic last game ([Counsel], a well-established finding in forecasting
practice, not measured in this game).

### Worked example: a forecaster's journal entry
*Market:* season title, 4 rounds left. *Price* of competitor K: $0.22. *Public model:* 0.24. *My belief:* 0.30.
*Reason:* K's rating is provisional (RD 180) after a strong run of results. I think K is better than the rating
says, and K's remaining opponents are the weakest four. *Exposure on K elsewhere:* none. *Size:* quarter Kelly =
(0.30 − 0.22)/0.78/4 ≈ 2.6 % of the bankroll, capped to 2 %. *Paper forecast:* recorded. *Review date:* after
settlement. Check the Brier score and whether the provisional rating moved the way I expected.

### Guided exercise
A trader tells you: "I've made money on 7 of my last 10 trades, so I'm skilled." Using the table, write two
questions you would ask before agreeing.

### Independent exercises
1. Which NPC trader would you expect to buy the favourite in a pre-game match market, even when the price already
   matches the public model? Why?
2. Can any NPC trader see a competitor's hidden strength? Quote the rule.
3. Your mean Brier is 0.55 over 200 forecasts, and the public forecast's is 0.58 on the same markets. Is that
   stronger evidence of skill than a $300 profit over 30 trades? Explain.
4. Give one reason why the order in which NPC traders act matters for the price you see.

### Answers
* **Guided:** for example: *What was the expected value of those trades at the time?* *How large were they, and
  how many would it take to separate luck from skill?* (Ten trades leave a 39 % chance of being behind with a real
  edge, so a lucky player can easily be ahead.)
* **1:** **Crown Supporters Club**: its belief adds +0.06 to the favourite, and its margin is only 0.02.
* **2:** **no**. "Information available at decision time only: the published model (public ratings), the board
  position's public engine evaluation during live play, and public price history — never hidden strength, never a
  future move or result." The competitor model also notes that hidden strength is "never used by forecasts or NPC
  traders".
* **3:** yes, very likely. Over 200 forecasts the noise in a mean Brier is roughly 0.014, so a 0.03 gap is about two
  standard deviations. A $300 profit over 30 trades can easily come from luck (see the table).
* **4:** the biased and noisy traders act first and the informed ones last, so the informed traders correct much of
  the noise and the final price ends near the public consensus.

### Summary
The NPC traders trade on public information only, with documented biases, noise and limits, and no one is
guaranteed a profit. Prices therefore tend to sit near the public model. Any edge you have must come from better
judgement, and a paper forecast is the free way to test it. Beware overconfidence, outcome bias and correlation.
Skill shows only over large samples, and the Brier score shows it faster than profit.

### Next lesson
The **Twelve-Week Program** (docs/grimoire/07-twelve-week-program.md) puts Books I–VI into a schedule, and the
**Glossary** (docs/grimoire/08-glossary.md) defines every term used in them.

---

# The Twelve-Week Program — From Apprentice to Sovereign

*A training schedule for Crown & Calculation that uses Books I–VI, the Academy, the Lab and the Federation.*

This program turns the six books into twelve weeks of practice. Each week has the same parts: **objective, reading,
Academy work, practice games, skills to demonstrate, review questions and a progress check.** Three adjustments
(Beginner, Intermediate, Advanced) and four daily lengths (10, 20, 30 and 60 minutes) let you fit it to your level
and your time.

## How the program uses the game

**[Demonstrated]** All of the following come from the game's code (src/academy/*, src/ui/AcademyScreen.tsx,
src/engine/levels.ts, src/games/types.ts):

* **Academy modes:** *Tactical Academy* (themed puzzles; choose a theme button, or let difficulty adapt), *Puzzle Rush*
  (3 minutes, three strikes; any solve with a hint or a wrong move counts as a strike), *Calculation Chamber*
  (puzzles needing two or more of your moves; 72 in the practice pool), *Defensive Survival* (251), *Endgame
  Workshop* (116; solve, then play the position out against the engine), *Replay Your Mistakes* (moves from your
  analysed games that lost ≥ 0.12 expected score), *Adaptive Training* (your weakest themes) and *Held-out
  Assessment* (10 puzzles you have never seen).
* **Puzzle pools by theme** (practice split, retired puzzles excluded): Defensive resource 173, Endgame technique
  116, Hanging piece 109, Calculation 83, Position evaluation 76, Fork 44, Skewer 34, Pin 30, Discovered attack 13,
  Promotion race 10, Mate threat 9, Checkmate 1. A puzzle can carry several themes.
* **Assessments are a scarce resource.** There are 81 held-out puzzles, and each is shown **at most once**, so you
  have about **eight** ten-puzzle assessments in total. This program uses **four**: weeks 1, 4, 8 and 12. Do not
  spend them casually. Each one is a measurement, not training.
* **Opponents:** engine levels L1 Novice (800) to L8 Crown (2926) and L9 Sovereign Unbound (3038, derived), plus
  Federation competitors via *Random Federation Quick Match* or your league fixtures. These ratings are on the Crown
  scale, not FIDE.
* **Time controls:** Blitz 3+2, Rapid 5+3 (used for Federation games), Classical 15+10, Untimed. **Untimed games are
  never rated.** Each timed control has its own rating pool.
* **Review:** Analysis (Quick, Standard and Deep presets), *Retry from This Position (Unrated)*, bookmarks, the Lab
  (with 95 % intervals and "insufficient evidence" flags) and Paper Forecasts with Brier scoring.

**Keep one analysis preset** (Standard) for your record. The Lab combines only reports of one methodology
(Book V, Chapter V.6).

## Level adjustments

| | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Who | new to chess, or rated below about 1200 (Crown) | about 1200–1900 | about 1900 and above |
| Main opponents | L1–L3 | L3–L5, Federation 1300–1900 | L5–L8, Federation 1900+ |
| Main time control | Untimed, then Rapid 5+3 | Rapid 5+3, Classical 15+10 | Classical 15+10, Rapid 5+3 |
| Puzzle difficulty | let the Academy adapt from 1–2 | adapt from 2–3 | adapt from 3–5 |
| Reading | every chapter fully, all exercises | skim chapters you know; do every exercise | read Books V–VI fully; Books I–IV only for review |
| Book VI strand | paper forecasts only, no trading | paper forecasts; small trades (≤ 2 % of cash) from week 8 | full strand, sized by Book VI, Chapter VI.4 |

## Daily session variants

Pick the length you can keep up **every day**. Consistency beats length ([Counsel]).

| Daily time | Shape of a session |
|---|---|
| **10 minutes** | 5 themed puzzles in the week's theme, or one Puzzle Rush, then 2 minutes rereading one *Summary* section. Play one game per week at the weekend. |
| **20 minutes** | 10 themed puzzles + one Rush; *or* one Rapid 5+3 game with a 5-minute review of its first turning point. |
| **30 minutes** | 10 puzzles (week theme) + one Rapid game + a review using Retry from This Position on your worst move. |
| **60 minutes** | 15 minutes reading and exercises, 15 minutes Academy (week theme + one Rush), one Classical 15+10 *or* two Rapid games, 10 minutes Analysis review, and one paper forecast. |

The weekly targets below assume the **30-minute** session. With 10 minutes, halve the puzzle and game counts. With
60 minutes, use the upper numbers.

---

## Week 1 — The Rules and the Board

* **Objective:** play legal, complete games without hesitation, and know every Crown rule that differs from
  orthodox chess.
* **Read:** Book I, Chapters 1–3 (*The Board and Its Coordinates*; *The Pieces I: Rook, Queen and King*; *The
  Pieces II: Knight and Pawn*) and Chapter 7 (*Stalemate and the Other Draws*). Rulebook §§3–5 and §10.
* **Academy:** take **Assessment 1** (baseline: 10 held-out puzzles; write down your score). Then 20 Tactical Academy
  puzzles at the adaptive difficulty.
* **Practice games:** 5 Untimed games against L1 (Beginner), L2 (Intermediate) or L4 (Advanced). Every game ends
  in checkmate, a draw rule or resignation. Note which rule ended it.
* **Demonstrate:** no illegal-move attempts; correctly predict when a position is **bare kings**, **stalemate** or a
  **claimable** threefold repetition.
* **Review questions:** (1) Why is there no double pawn step or en passant? (2) Which draws are automatic, and which
  must be claimed? (3) If you flag on time while your opponent has a single pawn left, what is the result?
* **Progress check:** a written baseline: Assessment 1 score, and your first five game results by termination type.

## Week 2 — Piece Safety and Basic Tactics

* **Objective:** stop losing pieces for nothing, and win the ones your opponent leaves hanging.
* **Read:** Book I, Chapter 4 (*Capturing and Piece Safety*) and Chapter 5 (*Check and Escaping Check*). Book II,
  *The Duellist*: its chapters on double attacks, forks and pins.
* **Academy:** 40 puzzles: *Hanging piece* (20), *Fork* (10), *Pin* (10). Two Puzzle Rush runs (record the best).
* **Practice games:** 5 Rapid 5+3 games: L2 (Beginner), L3–L4 (Intermediate), L5 (Advanced). Analyse each game with
  Standard.
* **Demonstrate:** no **Blunder** grades caused by a hanging piece in your last three games. Use the coach's
  *Hanging pieces* topic as the check.
* **Review questions:** (1) What three questions do you ask before every move? (2) Why are knight forks especially
  common on a 6×6 board? (3) What does the coach mean by "threat awareness"?
* **Progress check:** Rush best score compared with week 1, and the number of hanging-piece notes per game.

## Week 3 — Checkmates and Defence

* **Objective:** deliver the basic mates quickly, and survive attacks by finding the only move.
* **Read:** Book I, Chapter 6 (*Checkmate: King and Queen, King and Rook*) and Chapter 8 (*Simple Winning
  Patterns*). Book II: its chapters on mating patterns and defence. Book V, Chapter V.5 (*Critical Moments, Stronger
  Opponents and Predictable Mistakes*), "Explanation" section only.
* **Academy:** 30 *Defensive Survival* puzzles; all 9 *Mate threat* puzzles; the Grimoire's mate-in-1 and mate-in-2
  boards in Book I. (The Academy's *Checkmate* pool has only one puzzle; the Grimoire boards are exhaustively
  verified substitutes.)
* **Practice games:** 4 Rapid games; in two of them, start a **training** game from a position where you have K+Q or
  K+R against K and mate within 20 moves (Untimed).
* **Demonstrate:** K+Q vs K and K+R vs K mates from any start position; one game saved with a defensive only-move.
* **Review questions:** (1) Why is the sixth rank (first rank for White) a mating wall? (2) How does a stalemate
  trap arise when you are mating with K+Q? (3) What is a "critical moment" in the game's Analysis?
* **Progress check:** your Defensive Survival first-try clean rate (Academy statistics) with its sample size.

## Week 4 — Combinations

* **Objective:** chain two or three forcing moves into a combination, and verify it before playing it.
* **Read:** Book II's chapters on combinations, discovered attacks and skewers. Book V, Chapter V.1 (*The Pruned
  Tree: calculation and candidate discipline*), complete with exercises.
* **Academy:** 15 *Calculation Chamber* puzzles; *Skewer* (10) and *Discovered attack* (all 13). Then take
  **Assessment 2**.
* **Practice games:** 4 Rapid games against an opponent 100–200 points above you (a level or a Federation
  competitor).
* **Demonstrate:** solve Book V's exercises V.1.1–V.1.3 without hints; in a game, play one combination that you had
  calculated to the end.
* **Review questions:** (1) Why do you need only **one** good defence to reject a candidate, but must refute
  **every** defence to accept one? (2) Why is the quiet move Rb5 in Book V's worked example easy to miss? (3) Did
  your Assessment 2 score change from Assessment 1, and is a ten-puzzle difference meaningful?
* **Progress check:** Assessment 2 compared with Assessment 1. Remember that 10 puzzles is a small sample. The Lab
  combines all assessments and shows the uncertainty.

## Week 5 — Openings

* **Objective:** have a small, sound repertoire as White and a reply to each of White's ten first moves as Black.
* **Read:** Book III, *The Strategist*: its opening-principles chapter. Book V, Chapter V.7 (*The Sixty-Four Gates:
  building a repertoire*). Book VI, Chapter VI.1 (*The Language of Chance*).
* **Academy:** 20 puzzles of your choice, plus Adaptive Training (10).
* **Practice games:** 6 Rapid games, three as White with your chosen first move, and three as Black with your
  prepared replies. Opponents: L3 (Beginner), L5 (Intermediate), L6–L7 (Advanced).
* **Oracle strand:** record **3 paper forecasts** on featured match markets (Book VI, VI.1).
* **Demonstrate:** a one-sentence plan for each of your repertoire lines; no opening-phase Mistake in three games.
* **Review questions:** (1) What does "balanced" mean for the 64 book openings? (2) Why is memorising beyond move 3
  of little use here? (3) What is the implied probability of a $0.31 Draw price?
* **Progress check:** the Lab's *Opening understanding* rate (or "insufficient evidence"; it needs at least 10
  opportunities from 3 games).

## Week 6 — Pawn Structure

* **Objective:** read pawn structures and play for the faster majority.
* **Read:** Book III's chapters on pawn structure, passed pawns and weak squares. Book I, Chapter 9 (*The Pawn's
  Road: Four Steps to the Crown*). Book V, Chapter V.2 (*Complexity, Imbalance and the Art of Simplifying*).
* **Academy:** all 10 *Promotion race* puzzles; *Position evaluation* (15).
* **Practice games:** 4 Rapid or 2 Classical games. In each, write at move 12 which side has the faster pawn
  majority, and check your note against the evaluation graph afterwards.
* **Oracle strand:** 3 more paper forecasts. Read Book VI, Chapter VI.2 (*The Engine of Prices*).
* **Demonstrate:** win or hold one game by pawn play; solve Book V exercises V.2.1–V.2.2.
* **Review questions:** (1) Why are passed pawns more dangerous on 6×6 than on 8×8? (2) When should you trade into a
  pawn ending? (3) How much does the price move when you buy 30 shares in a fresh match market?
* **Progress check:** your Promotion-race solve rate and the coach's *Promotion races* note count per game.

## Week 7 — Endgames

* **Objective:** convert won endings and hold drawn ones, with the Crown draw and timeout rules in mind.
* **Read:** Book IV, *The Master*: its endgame chapters. Rulebook §10 (draws) and §13 (clocks).
* **Academy:** 25 *Endgame Workshop* puzzles. For five of them, use **play out against the engine** after solving.
* **Practice games:** 4 Rapid games. In two of them, use *Retry from This Position (Unrated)* from an endgame you
  mishandled.
* **Oracle strand:** 3 paper forecasts; read Book VI, Chapter VI.3 (*Measuring the Oracle*).
* **Demonstrate:** convert one winning ending against L4+; hold one inferior ending to a draw (repetition, bare
  kings or stalemate).
* **Review questions:** (1) What happens on time-out when your opponent has only a king? (2) When is a 100-halfmove
  draw automatic, and when must it be claimed? (3) Compute the Brier score of a forecast (0.5, 0.3, 0.2) that ends in a
  draw.
* **Progress check:** the Lab's *Endgame technique* rate with its interval.

## Week 8 — Calculation

* **Objective:** calculate forcing lines three moves deep, accurately and in reasonable time.
* **Read:** Book V, Chapter V.1 again (redo the guided exercise from memory) and Chapter V.5. Book VI, Chapter VI.4
  (*Sizing the Stake*).
* **Academy:** 25 *Calculation Chamber* puzzles; 3 Puzzle Rush runs. Then take **Assessment 3**.
* **Practice games:** 3 Classical 15+10 games. Before each critical-looking move, write your candidate list with
  one named refutation each.
* **Oracle strand:** Intermediate and Advanced may start **small trades** (Intermediate ≤ 2 % of cash per market).
  Beginners keep to paper forecasts.
* **Demonstrate:** in a Classical game, a correct three-move forcing line. Assessment 3 completed.
* **Review questions:** (1) In what order do you list candidates? (2) What is the Kelly fraction for q = 0.5,
  p = 0.4, and why is half of it still too much in a b = 120 market? (3) Did your clean rate in the Calculation
  Chamber rise compared with week 4?
* **Progress check:** Assessment 3 compared with Assessments 1–2; the Lab's *Calculation* dimension.

## Week 9 — Positional Play and Defence

* **Objective:** make good quiet moves, and defend worse positions patiently.
* **Read:** Book III's chapters on planning and piece activity. Book IV's chapter on defence. Book V, Chapter V.3
  (*Reading the Opponent: profiling and style adaptation*).
* **Academy:** 20 *Position evaluation* puzzles; 20 *Defensive Survival* puzzles; Adaptive Training (10).
* **Practice games:** 4 games against **Federation competitors** (Quick Match or league fixtures). Before each,
  write a profile: rating, RD, style (is it validated?), and your plan.
* **Oracle strand:** 3 paper forecasts on Federation markets; read Book VI, Chapter VI.5 (*Tournament
  Forecasting*).
* **Demonstrate:** one game with no Mistake in its quiet (non-critical) moves; a written opponent profile that
  correctly states which styles affect play.
* **Review questions:** (1) Which four styles are validated, and what does each change? (2) What does a high RD tell you
  about a rating? (3) Why are three markets on one competitor a single exposure?
* **Progress check:** the Lab's *Positional understanding* and *Defensive awareness* rates.

## Week 10 — Tournaments and Time

* **Objective:** manage the clock and the standings across an event.
* **Read:** Book V, Chapter V.4 (*The Tournament Hall: Swiss, leagues and knockouts*). Rulebook §§16–17. Book VI,
  Chapter VI.6 (*Live Odds and the Uncertain Board*).
* **Academy:** 3 Puzzle Rush runs (speed under pressure); 15 mixed puzzles.
* **Practice games:** play the league/Swiss rounds that fall in your season, or simulate a 5-round Swiss: five Rapid
  5+3 games against opponents within ±150 of you. Add 3 Blitz 3+2 games to practise knockout tie-breaks.
* **Oracle strand:** watch one featured game live. Write a paper forecast before the game and a second one at
  move 20, and compare both with the live model (Book VI, VI.6).
* **Demonstrate:** no time forfeits; compute your event performance rating and check it against the Squire norm.
* **Review questions:** (1) What is the Swiss tiebreak order? (2) How is a level knockout match resolved, and what
  changes in the final? (3) At an evaluation of +150 cp, what does the live model give?
* **Progress check:** the Lab's *Time management* dimension; your performance rating for the event.

## Week 11 — Engine Analysis and Preparation

* **Objective:** turn every loss into training, and prepare for specific opponents.
* **Read:** Book V, Chapter V.6 (*The Engine's Mirror*) and Chapter V.8 (*The Unbound Challenge*). Book VI,
  Chapter VI.7 (*The Crowd and the Mirror*).
* **Academy:** **Replay Your Mistakes**: every puzzle it offers. Then 15 Adaptive Training puzzles.
* **Practice games:** 4 games against L7 (Advanced: L8), Classical or Rapid. Analyse each one with the full loss
  routine from Chapter V.6, and use *Retry from This Position (Unrated)* at the first turning point.
* **Oracle strand:** review all your scored forecasts. Which tier does the game show, and how many forecasts is it
  based on?
* **Demonstrate:** for two losses, a written explanation in words of the better move at the first turning point.
* **Review questions:** (1) Convert +100 cp and −200 cp into expected scores. (2) Why are Brilliant labels and
  Played Like not to be trusted yet? (3) What does a 3.8 % chance of being behind after 400 good trades tell you
  about short-term results?
* **Progress check:** count recurring patterns (5 occurrences in 3 games) and check that each one has assigned
  training.

## Week 12 — Review and the Sovereign Challenge

* **Objective:** measure your progress honestly, and challenge Sovereign Unbound with realistic goals.
* **Read:** the *Summary* section of every chapter in Books V and VI. Book V, Chapter V.8 again.
* **Academy:** **Assessment 4**. Then one Rush and 10 Adaptive Training puzzles.
* **Practice games:** 2 casual games against **L9 at the Fast (1 s) budget** to learn it, then **2 rated games
  against L9 (always 10 s per move)** at Classical 15+10. Beginners: replace L9 with the strongest level against
  which you scored at least 25 % this program, and play L9 only casually.
* **Oracle strand:** write a final forecasting review: number of forecasts, mean Brier against the public forecast,
  and the calibration bins with their intervals.
* **Demonstrate:** survive the opening and the first critical moment against L9 in at least one game. (A draw is a
  triumph: the calibration model gives a 2000-rated player about 0.25 % expected score per game against it.)
* **Review questions:** (1) What do the budgets 1/5/10/15/30/60 s mean, and how does the clock limit them?
  (2) How was L9's 3038 rating obtained, and what does its RD of 171 mean? (3) Compare Assessments 1–4. What
  changed, and how sure can you be?
* **Progress check (final):** see below.

---

## Final progress assessment

Fill in this table at the end of week 12. Every row has a source in the game, so no number has to be guessed.

| Measure | Week 1 | Week 12 | Source |
|---|---|---|---|
| Held-out assessment score (of 10) | | | Academy (Assessments 1 and 4) |
| Puzzle Rush best | | | Academy statistics |
| First-try clean rate (with n) | | | Academy statistics |
| Rapid rating (state whether provisional) | | | Passport; provisional while games < 20 or RD > 100 |
| Lab: Tactical vision, Calculation, Endgame technique (rate and 95 % interval) | | | Lab |
| Recurring coach patterns | | | Lab / coach notes |
| Paper forecasts: n, mean Brier, public-forecast Brier | | | Forecasting screen |
| Best result against L7 / L8 / L9 | | | Game history |

**How to read it ([Counsel]):** look for changes larger than the intervals. Ten-puzzle assessments and fewer than 50
forecasts are noisy. If a measure did not move, choose that topic's week and repeat it, before you move on to the
next cycle. The program is meant to be run more than once, at a higher level each time.

---

# Glossary of the Grimoire

Terms are defined **as Crown & Calculation uses them** (variant crown-la6-v1, Federation crown-federation-1, Exchange
crown-exchange-2). Where a term means something different in orthodox chess or in real-world markets, the entry says
so. Pointers: **RB §n** = docs/RULEBOOK.md section n; **I.n** = Book I, Chapter n; **V.n / VI.n** = Book V or VI,
Chapter n; **P-Wk n** = Twelve-Week Program, week n.

---

**100-halfmove rule.** If 100 consecutive halfmoves (50 by each side) pass without a capture or a pawn move, either
player may **claim** a draw. At **150** halfmoves the draw is automatic. → RB §10; I.7.

**Accuracy.** 100·exp(−4 × mean expected-score loss) over a player's graded moves (crown-accuracy-v2), always between
0 and 100. The constant 4 is an uncalibrated placeholder, so accuracy is labelled experimental. → V.6.

**Adaptive Training.** Academy mode that picks puzzles from the themes where your first-try record is weakest, or
from repeated engine-verified errors in your games. → P-Wk 5.

**Agreement, draw by.** A draw both players accept. Allowed only after each side has made at least ten moves. → RB
§10.

**Analysis presets.** Quick (depth 5), Standard (depth 7, default) and Deep (depth 9, four candidate lines). The
Lab combines only reports of one preset and methodology. → V.6.

**Assessment (Held-out Assessment).** Ten puzzles from the 81-puzzle held-out split, each shown to a player at most
once and never used in practice. It measures; it does not train. → V.6; P-Wk 1.

**b (liquidity parameter).** The LMSR constant that sets how far prices move per share: match markets 120,
tournament winner 150, promotion and qualification 80, season title and bracket 100, Sandbox 60. → VI.2.

**Bare kings.** Only the two kings remain. This is an **automatic draw**, the only insufficient-material case drawn
automatically in Crown. → RB §10; V.5.

**Blitz / Rapid / Classical / Untimed.** Time controls 3+2, 5+3, 15+10 (minutes + seconds per move) and none. Each
timed control has its own rating pool. Untimed games are never rated. Federation games use Rapid 5+3. → RB §13.

**Bookmark / Memorable move.** Analysis markers that save a ply of a game for later study. → V.6.

**Bounded selection.** How engine levels L1–L4 choose: at random (softmax with a temperature) among the moves
whose score is within a fixed margin of their own best (L1 320 cp … L4 70 cp). It is never used when a mate is
found. → V.3.

**Bracket market.** An Exchange family over the 8 possible final-four paths of the Crown Championship. Claims (champion,
finalist, "X beats Y in the final") are sets of paths. A conjunction claim pays $0 if its condition fails. → VI.5.

**Brier score.** The game's forecast score: B = Σ over all states of (p − y)², from 0 (perfect) to 2 (worst); lower is
better. For a two-state market this is twice the usual binary Brier. → VI.3.

**Brilliant / Great.** Special grades for a best move that is clearly better than every alternative (Great), and
that also invests verified material (Brilliant). **Not validated**; Brilliant-move achievements wait for validated
grading. → V.6.

**Buchholz / Buchholz Cut-1.** Swiss tiebreaks: the sum of your opponents' scores, and that sum minus the lowest one.
→ V.4; RB §16.

**Calculation Chamber.** Academy mode with puzzles needing two or more of your own moves against best defence. → V.1.

**Calibration.** Agreement between stated probabilities and observed frequencies. The game shows ten probability
bins, each with a Wilson 95 % interval. (*Calibration* also names the engine-strength measurement in
src/engine/calibration.json.) → VI.3.

**Cancellation (market).** Resolving a market without a result. Holders receive the published cancellation vector:
1/n per share for most families, |S|/n for a claim on S states, and the opening prices for Sandbox markets.
Cancelled markets are not scored as forecasts. → VI.1; RB §20.

**Candidate move.** A move you seriously consider. Order: checks, captures, threats, then quiet moves. → V.1.

**Centipawn (cp).** One hundredth of a pawn: the unit of engine evaluation, from the side to move. → V.6.

**Checkmate.** The side to move is in check and has no legal move. It takes precedence over every draw rule. → RB §8;
I.6.

**Circuit Grade.** A rank of the 16-grade feudal ladder (crown-circuit-grades-1, names proposed), each with sublevels
III → II → I: 48 steps from Commoner III to High Sovereign I, two grades per division. Set by your division and by
the standing score at two checkpoints a season (after round 8 and at season end), with hysteresis. Your highest
rank ever is permanent. Not a rating, not a Federation title. → V.4.

**Claim (draw).** A request by a player for a draw that is not automatic: threefold repetition or the 100-halfmove
rule. → RB §10.

**Claim (Exchange).** A tradable set of a market's states. A share of the claim pays the sum of the payouts of its
states. → VI.2.

**Closed (market).** No trading is possible; the market awaits settlement or cancellation. Positions in a closed
market are valued only at the cancellation vector. → VI.4.

**Coach note.** An evidence-based explanation attached to an analysed move (coach crown-coach-0), under topics such
as Hanging pieces, Knight forks, Mating patterns, Threat awareness, Promotion races and Calculation. → V.5.

**Conflict of interest (Exchange).** Official markets never list your own games. While you sponsor a competitor, you
cannot buy in markets involving them. Entering an event cancels its winner market at 1/n first. → VI (introduction);
RB §20.

**Critical moment.** A position where the best move is at least 0.10 expected score better than the second best,
or where a mate is available (crown-critical-1). The summary counts how many you *handled* (loss ≤ 0.05). → V.5.

**Crown scale.** The engine-strength rating scale, anchored at L1 = 800 by design. It is not FIDE. → V.3; V.8.

**Davidson model.** The Federation result model: P(W) ∝ π_w, P(D) ∝ ν√(π_wπ_b), P(B) ∝ π_b, with π = 10^(rating/400)
and ν = 0.9 (crown-result-model-1). Used on public ratings for forecasts. → VI.1.

**Defensive Survival.** Academy mode: find the only move that holds. → V.5.

**Division.** One of 8 ordered tiers of the Federation: 1 Crown, 2 Grand, 3 Premier, 4 Masters, 5 Senior,
6 District, 7 Club, 8 Open. Each division has 16 regional leagues. → V.4; RB §17.

**Endgame Workshop.** Academy mode of endgame puzzles, which can then be played out against the engine. → P-Wk 7.

**Expected score.** The average result (win 1, draw ½, loss 0) a position or pairing is worth. For positions the game
uses the map crown-outcome-map-v2 (for example +100 cp ≈ 0.68). For pairings it uses the Davidson model. → V.6;
VI.1.

**Expected value (EV).** The average profit of a trade at your probability: belief × $1 × shares − total paid. →
VI.1.

**Exposure.** The total cost basis at risk in open or closed markets. Correlated positions count together. → VI.4.

**Featured game.** A Federation engine game chosen for a match market and live spectating. → VI.6.

**Fee.** 1 % of the executed amount (rounded up) on every buy and every sell. → VI.1.

**Federation.** The Six-Square Federation: 2,048 AI competitors in 16 regions × 8 divisions × 16-player leagues, with
19 rounds per season. → V.4; RB §§14–17.

**Federation title.** A permanent honour earned by performance norms: Squire, Knight, Paladin and Sovereign
(crown-titles-1). Not a FIDE title, and distinct from rating titles. → V.4; RB §21.

**Fivefold repetition.** The same position (board and side to move) for the fifth time: an **automatic draw**. →
RB §10.

**fullBudget.** An engine option (since v0.8) for L8 and L9: keep starting search iterations until 62.5 % of the
move's time budget is used. Measured gain: +23 [6, 41] Elo. → V.8.

**Glicko-2.** The rating system for players and competitors (rating, RD, volatility). New players start at 1500,
RD 350. → RB §15.

**Grade.** The label for a move's expected-score loss (crown-grade-v3-experimental): Best ≤ 0.002, Excellent ≤ 0.02,
Good ≤ 0.05, Inaccuracy ≤ 0.12, Mistake ≤ 0.25, Blunder above. The bins are experimental. → V.6.

**Hedging.** Reducing the spread of possible outcomes, in this game by selling shares you hold (no short selling).
It costs fees and slippage. → VI.5.

**Highest rank ever achieved.** The best Circuit Grade (with sublevel) you have held, with the season it was first
reached. Only a genuine step up raises it; demotion, relegation and rating losses never lower it. → V.4.

**Implied probability.** The probability a price expresses: a $0.40 share implies 40 %. → VI.1.

**Kelly criterion.** The growth-optimal stake fraction f\* = (q − p)/(1 − p) for a $1 claim at price p with belief q.
Use fractional Kelly only as a ceiling, never as a target. → VI.4.

**Knockout.** Crown Championship format: two-game matches, then a rapid pair, then a blitz pair. If still level, the
higher seed advances, except in the final, which gives joint champions. → V.4; RB §16.

**Lab (Personal Chess Intelligence Lab).** Skill dimensions measured as success rates with denominators and 95 %
intervals (crown-lab-1). They are performance summaries, not psychometric scores. → V.6.

**Latent strength.** A competitor's hidden playing strength, which chooses their engine profile. It is never shown,
and never used by forecasts or NPC traders. → V.3.

**Level (L1–L9).** Engine strength profiles (crown-levels-6): L1 Novice … L8 Crown, L9 Sovereign Unbound. → V.3.

**Live model.** The in-play W/D/B forecast computed from the published engine evaluation and the pre-game draw
probability. It is never the price. → VI.6.

**LMSR (logarithmic market scoring rule).** The automated market maker: C(q) = b·ln Σ e^(qᵢ/b),
pᵢ = e^(qᵢ/b)/Σ e^(qⱼ/b), and a trade costs C(q′) − C(q). → VI.2.

**Log score.** −Σ y·ln max(p, 0.001); lower is better. → VI.3.

**Long-only.** You can sell only shares you hold. There is no short selling. → VI.5.

**Market family.** A kind of Exchange market: match, winner, promotion, qualification, season, bracket, sandbox. →
VI.5.

**Market revision.** A counter that advances with every trade and every published live move. A quote from an older
revision is rejected. → VI.2; VI.6.

**Norm.** An event of at least 5 games whose performance rating and average opposition reach a title tier's
thresholds. → V.4.

**NPC trader.** One of eight simulated traders (crown-npc-traders-2) that trade on public information only, with
documented noise, bias, margins and budgets. → VI.7.

**Opening book (benchmark).** The 64 two-ply openings in tools/bench/openings.json, each within ±80 cp at
Fairy-Stockfish depth 10. → V.7.

**Paper forecast.** A free probability vector over a market's states, locked at market close and scored on
settlement. → VI.3.

**Performance rating.** Average opponent rating + dp, with dp = −400·log10(1/p − 1) for score fraction p (±800 cap).
→ V.4.

**Played Like.** An estimate of the rating at which a game was played. Shown as **"Calibrating"**: the model failed
its release gate (no better than a naive baseline). → V.6.

**Playing-length limit.** Featured engine games stop at 400 plies. Such a game is *censored*: its market is
cancelled, and the standings record an adjudicated draw, labelled as such. → VI.6.

**Promotion (pawn).** A pawn reaching the far rank becomes a queen, rook or knight (there are no bishops). It is
only four steps from the starting rank. → RB §11; I.9.

**Promotion and relegation (league).** At season end, the top two of each regional league move up a division and
the bottom two move down. → V.4; RB §17.

**Provisional rating.** A rating with fewer than 20 games or RD > 100. It is excluded from peaks and title
collections. → RB §15.

**Puzzle Rush.** Academy mode: 3 minutes, three strikes. Any solve that is not clean counts as a strike. → P-Wk 2.

**Rating pool.** A separate rating per timed control (Blitz, Rapid, Classical). → RB §15.

**Rating title.** A descriptive band of 100 rating points (31 bands, crown-rating-titles-1), from *Wandless Wanderer*
(0–99) to *Eternal Sovereign* (3000+). It is not a Federation title. → V.4; RB §15.

**RD (rating deviation).** Glicko-2's uncertainty in a rating. The higher it is, the less the rating means. → V.3.

**Regional league.** One of the 16 leagues of 16 competitors within each division; a 15-round round robin. → V.4.

**Replay Your Mistakes.** Academy mode built from your analysed moves that lost ≥ 0.12 expected score. → V.6.

**Repertoire (style).** The opening preference of a validated style: a choice among book moves within 30 cp of the
best at depth 7, for the first six plies only. → V.3.

**Retry from This Position (Unrated).** Starts an untimed training game from the position before an analysed move,
against the same opponent. → V.6.

**Sandbox Exchange.** Practice markets with separate practice money on your own casual quick matches. You may only
back yourself, and trading closes at the first move. → VI (introduction); RB §20.

**Settlement.** Resolving a market on its result: each winning share pays $1 (joint champions split). → VI.1.

**Share.** A unit of a claim that pays $1 if the claim's state occurs. → VI.1.

**Slippage.** The gap between the price shown and the average price paid, caused by your own trade moving the price.
→ VI.2.

**Sonneborn–Berger.** A tiebreak: the sum of the scores of the opponents you beat, plus half the scores of those you
drew. → V.4.

**Sovereign Unbound (L9).** The canonical engine with no handicap and a chosen budget of 1/5/10/15/30/60 s per move
(rated: 10 s). Rated 3038 ± 171 (derived). → V.8.

**Stalemate.** The side to move is not in check and has no legal move: a draw. → RB §9; I.7.

**Standing score.** 0–100 at a Circuit Grade checkpoint: 45 % league position, 25 % score in sanctioned rated games,
30 % rating percentile in your division. → V.4.

**Style.** A competitor's label (Universal, Tactical, Positional, Defensive, Endgame, Aggressive). Only validated
styles change play: Tactical, Positional, Defensive and Endgame, through a whole-game styled evaluation (Tactical and
Positional also through an opening repertoire). Aggressive is not validated and plays as Universal. → V.3.

**Sublevel.** The III / II / I part of a Circuit Grade (III lowest). Shown by one, two or three chevrons under the
grade's insignia. → V.4.

**Subsidy.** The maker's worst-case loss b·ln n, funded before a market opens (match market: $131.83). → VI.2.

**Swiss.** A pairing system matching players on similar scores who have not met (crown-swiss-1, simplified). → V.4;
RB §16.

**Threefold repetition.** The same position for the third time. The draw is **claimable**, not automatic. → RB §10.

**Timeout rule.** If you flag, you lose if your opponent has any non-king piece or pawn; otherwise the game is a
draw. → RB §13; V.2.

**Training game.** An unrated game (for example a retry). It is excluded from the Lab's game evidence. → V.6.

**Turning point.** A ply where the evaluation crosses between better (> 0.65), balanced and worse (< 0.35). → V.5.

**Zugzwang.** A position where any move worsens the mover's position. → V.1.
