# Crown & Calculation — Official Rulebook

Rules version: chess variant **crown-la6-v1** (rules 1.0.0), adjudication policy **crown-adj-1**, notation
**ccn-1** (record) and **csan-1** (display), federation **crown-federation-1**, exchange **crown-exchange-2** and
market families **crown-markets-2**.

This rulebook describes what the game actually does. It was written from the source code and the automated
tests. Where an older design document says something different, this rulebook follows the code. The evidence for
every rule (code location and test) is listed in [RULES_TRACEABILITY.md](RULES_TRACEABILITY.md).

Every board below is checked by the repository tool `npx tsx tools/grimoire/check.ts`: the position is legal,
every move in it is legal and correctly written, and every claim ("checkmate", "stalemate", "mate in 1" …) is
proved against the real rules.

**Contents**

* **Part I — Chess Rules:** 1 What the game is · 2 Objective · 3 Board and coordinates · 4 Starting position ·
  5 How the pieces move · 6 Capturing · 7 Check · 8 Checkmate · 9 Stalemate · 10 Draws · 11 Pawns and promotion ·
  12 Legal and illegal moves · 13 Clocks and time controls
* **Part II — Federation Competition Rules:** 14 Rated and casual games · 15 Federation rating · 16 Tournaments ·
  17 Leagues, divisions, promotion and relegation · 18 Spectating · 19 Analysis and replays · 21 Career progression
* **Part III — Exchange Rules:** 20 The Crown Exchange
* **Quick Reference** (one page)

---

# Part I — Chess Rules

## 1. What the game is

Crown & Calculation is an offline game built around a small chess variant played on a **6×6 board**. Each side
has six pieces and six pawns: two rooks, two knights, one queen, one king. **There are no bishops.** Around the
chess game sits a career: a federation of 2,048 computer-controlled competitors with leagues and tournaments, a
rating, titles and collectibles, and a prediction market (the Crown Exchange) that uses **fictional dollars**.

You always play against the game's engine. Nothing is played online and no real money exists anywhere in the game.

## 2. Objective

You win by **checkmating** the opposing king: attacking it so that no legal move removes the attack (section 8).
You also win if your opponent **resigns**, or if your opponent's **time runs out** while you still have at least
one piece other than your king (section 13).

A game can also end in a **draw** (section 10). A win scores 1 point, a draw ½, a loss 0.

## 3. Board and coordinates

* The board has 6 files and 6 ranks: 36 squares.
* **Files** are the columns **a–f**, from left to right as White sees the board.
* **Ranks** are the rows **1–6**, from White's side (rank 1) to Black's side (rank 6).
* A square is named by file then rank: **a1** is White's bottom-left corner, **f1** the bottom-right, **a6** and
  **f6** are Black's corners.
* White's pieces start on ranks 1–2, Black's on ranks 5–6. **White moves first**; the players then alternate.

**How moves are written.**

* The game record stores moves in **coordinate notation** (CCN): from-square, to-square, and a lowercase letter
  for a promotion — `c2c3`, `b1c3`, `b5b6q`.
* Screens show **short algebraic notation** (SAN): piece letter **K** king, **Q** queen, **R** rook, **N** knight
  (no letter for a pawn), `x` for a capture, `=Q`/`=R`/`=N` for promotion, `+` for check and `#` for checkmate.
  When two identical pieces can reach the same square, the file (or rank, or both) of the moving piece is added:
  `Nac2`, `Nec2`. Examples: `Nc3`, `cxd4`, `a6=Q+`, `Ra6#`.
* This SAN uses familiar chess conventions but is **not** standard-chess PGN: there are no bishop moves, no
  castling (`O-O`) and no en passant.

## 4. Starting position

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
caption: The starting position. Rank 1 from a to f: rook, knight, queen, king, knight, rook. Black mirrors it on rank 6. Pawns fill ranks 2 and 5. White moves first.
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
*The starting position. Rank 1 from a to f: rook, knight, queen, king, knight, rook. Black mirrors it on rank 6. Pawns fill ranks 2 and 5. White moves first.*
<!-- /diagram -->

Starting position (FEN): `rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1`.

* The queens stand on the **c-file** and the kings on the **d-file**, facing each other.
* There are only two empty ranks (3 and 4) between the armies, so contact happens at once.
* White has exactly **ten** legal first moves: each of the six pawns one square forward, and the four knight moves
  `Na3`, `Nc3`, `Nd3`, `Nf3`.

## 5. How the pieces move

A piece moves to an empty square or captures an opposing piece by moving onto its square (section 6). No piece may
move onto a square occupied by a piece of its own colour. Rooks and queens may not jump over pieces; knights may.

### King (K)

The king moves **one square in any direction**. It may never move onto a square attacked by an opposing piece,
and the two kings may never stand on adjacent squares.

```crown
fen: 4k1/6/6/2K3/6/6 w - - 0 1
caption: The king on c3 can step to any of the eight neighbouring squares (b2, c2, d2, b3, d3, b4, c4, d4).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♔ · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The king on c3 can step to any of the eight neighbouring squares (b2, c2, d2, b3, d3, b4, c4, d4).*
<!-- /diagram -->

### Queen (Q)

The queen moves **any number of empty squares in a straight line**: along a rank, a file or a diagonal.

```crown
fen: 4k1/6/6/2Q3/6/K5 w - - 0 1
caption: The queen on c3 reaches the whole c-file and 3rd rank and both diagonals through c3 (a1 is blocked by its own king).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♕ · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The queen on c3 reaches the whole c-file and 3rd rank and both diagonals through c3 (a1 is blocked by its own king).*
<!-- /diagram -->

### Rook (R)

The rook moves **any number of empty squares along a rank or a file**.

```crown
fen: 4k1/6/6/2R3/6/K5 w - - 0 1
caption: The rook on c3 moves along the c-file and the 3rd rank.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♖ · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The rook on c3 moves along the c-file and the 3rd rank.*
<!-- /diagram -->

### Knight (N)

The knight moves in an **L-shape**: two squares along a rank or file and then one square sideways. It is the only
piece that **jumps** over other pieces.

```crown
fen: 4k1/6/6/2N3/6/K5 w - - 0 1
caption: The knight on c3 can go to a2, a4, b1, b5, d1, d5, e2 and e4.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · ♘ · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The knight on c3 can go to a2, a4, b1, b5, d1, d5, e2 and e4.*
<!-- /diagram -->

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Nc3
show: after
caption: Knights jump: after Nc3 the knight has jumped over the pawn wall.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · ♘ · · ·
2 │ ♙ ♙ ♙ ♙ ♙ ♙
1 │ ♖ · ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Knights jump: after Nc3 the knight has jumped over the pawn wall.*
<!-- /diagram -->

### Pawn

* A pawn moves **exactly one square straight forward** (towards the opponent), and only onto an **empty** square.
* A pawn **captures one square diagonally forward**.
* A pawn on the last rank must promote (section 11).

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: c3
show: after
caption: Pawns move one square only. From the start, c2–c3 is possible; there is no two-square step c2–c4.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♜ ♞ ♛ ♚ ♞ ♜
5 │ ♟ ♟ ♟ ♟ ♟ ♟
4 │ · · · · · ·
3 │ · · ♙ · · ·
2 │ ♙ ♙ · ♙ ♙ ♙
1 │ ♖ ♘ ♕ ♔ ♘ ♖
  └─────────────
    a b c d e f    Black to move
```
*Pawns move one square only. From the start, c2–c3 is possible; there is no two-square step c2–c4.*
<!-- /diagram -->

### What is not in this game (differences from standard chess)

| Standard chess | Crown & Calculation |
|---|---|
| Bishops | **None.** A position containing a bishop is rejected. |
| Castling | **None.** The king only ever moves one square. |
| Pawn double step from the starting rank | **None.** Every pawn move is one square. |
| En passant | **None** (it would need a double step). |
| Promotion to queen, rook, bishop or knight | **Queen, rook or knight** only. |
| Insufficient-material draws (e.g. king and knight vs king) | Only **king vs king** is drawn automatically (section 10). |
| Timeout against insufficient material is a draw | You lose on time if your opponent has **any** non-king piece (section 13). |

## 6. Capturing

* You capture by moving a piece onto a square occupied by an opposing piece. The captured piece is removed from
  the game. Captures are never compulsory.
* Every piece captures the way it moves, **except the pawn**, which moves straight but captures diagonally forward.
* The king can be attacked but is never captured: a position where a king could be taken never arises, because
  every move that would leave your own king attacked is illegal (section 12).

```crown
fen: 4k1/6/1p1n2/2P3/6/K5 w - - 0 1
line: cxd4
caption: The pawn on c3 can step to c4, or capture diagonally on b4 or d4. Here it takes the knight: cxd4.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · ♚ ·
5 │ · · · · · ·
4 │ · ♟ · ♞ · ·
3 │ · · ♙ · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*The pawn on c3 can step to c4, or capture diagonally on b4 or d4. Here it takes the knight: cxd4.*
<!-- /diagram -->

## 7. Check

A king is **in check** when an opposing piece attacks its square. The player in check **must** get out of check
on the very next move, by:

1. moving the king to a square that is not attacked,
2. capturing the checking piece, or
3. putting a piece between the king and a checking rook or queen.

A move that leaves (or puts) your own king in check is illegal. A check is written with `+`.

```crown
fen: 3k2/r5/6/6/6/3K2 b - - 0 1
line: Ra1+ Ke2
caption: Black plays Ra1+, checking the white king along the first rank. White must answer the check at once; Ke2 steps off the rank.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ ♜ · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    Black to move
```
*Black plays Ra1+, checking the white king along the first rank. White must answer the check at once; Ke2 steps off the rank.*
<!-- /diagram -->

## 8. Checkmate

**Checkmate** is a check that cannot be answered by any legal move. The side that delivers checkmate **wins
immediately**. Checkmate is written with `#`.

```crown
fen: 3k2/6/3K2/6/6/R5 w - - 0 1
line: Ra6#
claim: checkmate
show: after
caption: Ra6# — the rook checks along the sixth rank, the white king on d4 covers c5, d5 and e5, and the rook covers c6 and e6.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♖ · · ♚ · ·
5 │ · · · · · ·
4 │ · · · ♔ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Ra6# — the rook checks along the sixth rank, the white king on d4 covers c5, d5 and e5, and the rook covers c6 and e6.*
<!-- /diagram -->

```crown
fen: 3k2/6/3K2/6/6/5Q w - - 0 1
line: Qf6#
claim: mate-in-1
caption: Exercise: White to move and mate in one. Answers: Qf6# or Qa6# (the queen checks along the sixth rank, the king on d4 covers the fifth).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · ♔ · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ♕
  └─────────────
    a b c d e f    White to move
```
*Exercise: White to move and mate in one. Answers: Qf6# or Qa6# (the queen checks along the sixth rank, the king on d4 covers the fifth).*
<!-- /diagram -->

Checkmate takes precedence over every draw rule: a move that checkmates wins even if the same move would also have
reached a draw limit (section 10).

## 9. Stalemate

**Stalemate** happens when the player to move is **not** in check but has **no legal move**. A stalemate is an
immediate **draw**.

```crown
fen: k5/6/6/1Q4/6/5K w - - 0 1
line: Qb4
claim: stalemate
show: after
caption: A careless Qb4 stalemates: the black king on a6 is not in check, but a5, b5 and b6 are all covered. Draw.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ ♚ · · · · ·
5 │ · · · · · ·
4 │ · ♕ · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · · · ♔
  └─────────────
    a b c d e f    Black to move
```
*A careless Qb4 stalemates: the black king on a6 is not in check, but a5, b5 and b6 are all covered. Draw.*
<!-- /diagram -->

## 10. Draws — all conditions exactly as implemented

The game uses **two kinds** of draw rule. **Automatic** draws end the game the moment they occur; nobody has to do
anything. **Claimable** draws are only available: the player to move may claim them, or play on.

"Halfmove" means one move by one side (a *ply*). "N moves each" means 2N halfmoves.

| Draw | Kind | Exact condition |
|---|---|---|
| **Stalemate** | Automatic | The side to move has no legal move and is not in check. |
| **Bare kings** | Automatic | Only the two kings are left on the board. |
| **Fivefold repetition** | Automatic | The same position has occurred for the **5th** time. |
| **150-halfmove rule** ("75 moves each") | Automatic | **150** halfmoves in a row without any pawn move or capture. |
| **Threefold repetition** | Claimable | The current position has occurred for at least the **3rd** time. |
| **100-halfmove rule** ("50 moves each") | Claimable | At least **100** halfmoves in a row without any pawn move or capture. |
| **Agreement** | By both players | Only after each side has made at least **ten** moves (20 halfmoves played in the game). |
| **Timeout against a bare king** | Automatic | Your time runs out but your opponent has only a king (section 13). |

**Details.**

* **Order of checks after each move:** checkmate, then stalemate, then bare kings, then fivefold repetition, then
  the 150-halfmove rule. So a move that gives checkmate on the 150th halfmove **wins**; it is not a draw.
* **Same position** means the same pieces on the same squares **and** the same side to move. (There are no
  castling or en-passant rights, so nothing else matters.) Repetitions are counted over the whole game, including
  the current position. A pawn move or a capture can never be undone, so positions before it can never recur.
* The **halfmove counter** resets to 0 after every pawn move and every capture (including a promotion) and
  otherwise goes up by one per move.
* **Claims are made on your own turn**, about the position on the board. You cannot claim in advance for a move
  you are about to play, as some standard-chess rules allow. In the game, a **Claim Draw** button appears when a
  claim is available and it is your move.
* **Your engine opponent** claims an available repetition or 100-halfmove draw on its turn only when its own
  evaluation says it is not better. It accepts your draw offer only when its own evaluation says it is worse, or
  the position is level and at least 60 halfmoves have been played. This is the opponent's choice; an engine
  evaluation never decides a result by itself.
* **Federation engine-vs-engine games** (the games you watch, section 18) always take an available threefold or
  100-halfmove draw at once, and stop at **400 halfmoves** (the *playing-length limit*): such a game is recorded as
  a draw and its match market is cancelled (section 20).
* **Low material does not draw** (except bare kings). King and knight against king, for example, plays on until a
  draw is agreed, claimed or reached automatically. This is a deliberate difference from standard chess.

```crown
fen: 3k2/6/6/6/r5/3K2 b - - 0 1
line: Rd2+ Kxd2
claim: bare-kings
show: after
caption: Rd2+ Kxd2 — the capture removes the last piece other than the kings, and the game is drawn automatically (bare kings).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · ♔ · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Rd2+ Kxd2 — the capture removes the last piece other than the kings, and the game is drawn automatically (bare kings).*
<!-- /diagram -->

```crown
fen: 3k2/6/6/6/6/2NK2 w - - 0 1
caption: King and knight against king is NOT an automatic draw: play continues. (If Black's flag falls here, White wins — section 13.)
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · ♘ ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*King and knight against king is NOT an automatic draw: play continues. (If Black's flag falls here, White wins — section 13.)*
<!-- /diagram -->

```crown
fen: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
line: Nc3 Nc4 Nb1 Nb6 Nc3 Nc4 Nb1 Nb6
show: after
caption: After these eight halfmoves the starting position stands on the board for the third time. White, to move, may claim a draw by threefold repetition — or play on. Two more full cycles would make it fivefold and end the game automatically.
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
*After these eight halfmoves the starting position stands on the board for the third time. White, to move, may claim a draw by threefold repetition — or play on. Two more full cycles would make it fivefold and end the game automatically.*
<!-- /diagram -->

**Other ways a game ends.**

* **Resignation:** a player may resign at any time; the opponent wins.
* **Unfinished games** are saved and can be resumed later. The game never ends a game by abandonment on its own
  (the result type "abandoned" exists in the record format but nothing in the current game sets it).

## 11. Pawns and promotion

* Pawns move one square forward, capture one square diagonally forward, and never move backwards or sideways.
* White pawns start on rank 2 and promote on **rank 6**; Black pawns start on rank 5 and promote on **rank 1**.
  Because there is no double step, a pawn needs four moves to promote from its starting square.
* **Promotion is mandatory.** A pawn reaching the last rank — by a forward step or by a capture — must be
  exchanged, as part of the same move, for a **queen, rook or knight** of the same colour. A pawn may not stay a
  pawn and may not become a king. There is no bishop to choose.
* The promoted piece acts at once; it can give check or checkmate on the same move.
* A pawn can never stand on rank 1 or rank 6, so such a position is rejected.

```crown
fen: 5k/P5/6/6/6/K5 w - - 0 1
line: a6=Q+ Ke5
caption: Promotion with check: a6=Q+ and the black king steps out with Ke5.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ♚
5 │ ♙ · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Promotion with check: a6=Q+ and the black king steps out with Ke5.*
<!-- /diagram -->

```crown
fen: 1r1k2/P5/6/6/6/3K2 w - - 0 1
line: axb6=Q+
show: after
caption: Promotion by capture: the a5 pawn takes the rook on b6 and becomes a queen, giving check along the sixth rank.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♕ · ♚ · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    Black to move
```
*Promotion by capture: the a5 pawn takes the rook on b6 and becomes a queen, giving check along the sixth rank.*
<!-- /diagram -->

```crown
fen: 6/1P1k2/6/6/6/K5 w - - 0 1
line: b6=N+
show: after
caption: Underpromotion: only a knight gives check here (b6=N+). Queen, rook and knight are all allowed.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · ♘ · · · ·
5 │ · · · ♚ · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · · · ·
1 │ ♔ · · · · ·
  └─────────────
    a b c d e f    Black to move
```
*Underpromotion: only a knight gives check here (b6=N+). Queen, rook and knight are all allowed.*
<!-- /diagram -->

```crown
fen: 3k2/6/6/6/p5/3K2 b - - 0 1
line: a1=Q+
caption: Black promotes on rank 1: a1=Q+ checks the white king along the first rank.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♚ · ·
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ ♟ · · · · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    Black to move
```
*Black promotes on rank 1: a1=Q+ checks the white king along the first rank.*
<!-- /diagram -->

## 12. Legal and illegal moves

A move is **legal** when it follows the movement rules of section 5 **and** does not leave the mover's own king in
check. Consequences:

* A piece that shields its own king from a rook or queen is **pinned**: it may not leave the line if that would
  expose the king.
* A king may not move into check or next to the other king.
* When in check, only moves that end the check are legal.
* If you have no legal move, the game is over: checkmate if you are in check, stalemate otherwise.

The game **only accepts legal moves**. An illegal move is simply refused, has no penalty, and you move again; there
is no "touch move" rule. A move submitted after your time has run out does not count (section 13).

```crown
fen: 3r1k/6/6/6/3N2/3K2 w - - 0 1
caption: Pinned: the white knight on d2 shields its king on d1 from the rook on d6, so the knight has no legal move.
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · ♜ · ♚
5 │ · · · · · ·
4 │ · · · · · ·
3 │ · · · · · ·
2 │ · · · ♘ · ·
1 │ · · · ♔ · ·
  └─────────────
    a b c d e f    White to move
```
*Pinned: the white knight on d2 shields its king on d1 from the rook on d6, so the knight has no legal move.*
<!-- /diagram -->

```crown
fen: 6/6/2k3/6/2K3/6 w - - 0 1
caption: Kings may not touch: the white king on c3 cannot go to b4, c4 or d4 (all next to the black king on c5).
```
<!-- diagram -->
```text
  ┌─────────────
6 │ · · · · · ·
5 │ · · · · · ·
4 │ · · ♚ · · ·
3 │ · · · · · ·
2 │ · · ♔ · · ·
1 │ · · · · · ·
  └─────────────
    a b c d e f    White to move
```
*Kings may not touch: the white king on c3 cannot go to b4, c4 or d4 (all next to the black king on c5).*
<!-- /diagram -->

**Positions you can set up** (FEN) must also be legal: exactly one king each, no bishops, no pawn on rank 1 or 6,
no castling or en-passant field (both must be `-`), and the side **not** to move must not be in check.

## 13. Clocks and time controls

| Time control | Starting time per player | Increment per move |
|---|---|---|
| Blitz 3+2 | 3 minutes | +2 seconds |
| Rapid 5+3 | 5 minutes | +3 seconds |
| Classical 15+10 | 15 minutes | +10 seconds |
| Untimed | no clock | — |

* Only the clock of the side to move runs. The **increment** is added to your clock **after** you complete a move
  (Fischer increment), so a fast move can increase your time.
* At the moment you submit a move, the game first checks your clock: **if your time has already run out, the move
  does not count** and the timeout rule applies. Then the move is checked for legality, then the increment is
  added, then the automatic results (checkmate, stalemate, bare kings, fivefold, 150 halfmoves) are checked.
* **Timeout rule (crown-adj-1):** when your time runs out, you **lose** if your opponent has **any** piece other
  than the king — even a single knight or pawn that could never checkmate. If your opponent has only a king, the
  game is a **draw**. (Standard chess would draw some of these cases; Crown & Calculation does not.)
* **Pauses:** the clocks stop while the game is in the background (for example when you switch apps) and when a
  saved game is reopened, time while the game was closed is not charged. Every pause is recorded in the game.
* Untimed games have no clock and therefore no timeout; they are never rated.

---

# Part II — Federation Competition Rules

## 14. Rated and casual games

**Rated games** change your rating (section 15). **Casual games** are saved and analysed but never change your
rating.

A game is rated only if **all** of these hold when it starts:

1. you chose **Rated**;
2. the game has a clock (Blitz, Rapid or Classical) — **untimed games are never rated**;
3. the opponent has a calibrated rating. In the Play screen this means an engine level with a rating; the strongest
   setting ("Sovereign Unbound") is rated only at its **10-second** thinking budget, other budgets are casual.

If you pick Rated but rule 2 or 3 fails, the game is created as a casual game and the screen tells you why.

Federation league and tournament games and rated Random Matches are rated **Rapid 5+3** games against the
competitor's public rating. **Training Hall sparring** and **training retries** are never rated.

**Assistance rules.**

* In a **rated** game **no engine help is available at all**: hints, candidate moves, threat checks, evaluations
  and best-move explanations are refused by the game itself (not only hidden). The game offers no takebacks.
* In a **casual** game you may use the Assistant (Hint, Candidate Moves, Threat Check, Evaluation, Explain Best
  Move). Each use is recorded in the game as an *assistance event*; an assisted game is marked "Assisted" and can
  never be rated.
* A finished game produces a rating change only if it is rated, has a rating pool, has a result for you, and
  contains **no** assistance events.
* Each game produces **at most one** rating change, keyed by the game's id, written in the same step as the final
  game record (it cannot be applied twice, even after a reload or crash).
* Rated games never carry a practice market (section 20).

## 15. Federation rating

* Ratings use the **Glicko-2** system (Glickman 2013), model crown-glicko2-1. Each rating has three numbers: the
  **rating**, the **rating deviation (RD)** — how uncertain the rating is — and the **volatility**.
* New ratings start at **1500**, RD **350**, volatility **0.06**; system constant τ = **0.5**. RD is never shown
  above 350.
* For you, **one completed rated game is one rating period**: your rating is updated once, right after the game.
  Your rating moves more when your RD is high and when the result is surprising (beating a stronger opponent
  gains more than beating a weaker one).
* There are **three separate rating pools**: Blitz, Rapid and Classical. Your **Federation rating** is your
  **Rapid** rating — the one the Federation, rating titles and Random Match use.
* Federation competitors have public Glicko-2 ratings too. They are updated **once per federation round** from that
  round's results (an inactive competitor's RD grows), and a competitor's RD never drops below 40.
* **Provisional:** a rating is provisional while you have played **fewer than 20** rated games in that pool **or**
  your RD is **above 100**. It becomes *established* when both conditions are met (20+ games **and** RD ≤ 100).
  Peak and lowest ratings, the insignia collection and rating-based achievements count established ratings only.
* **Not FIDE Elo.** This is the game's own rating on the game's own scale. It is not a FIDE, national or online
  rating, and the numbers cannot be compared with them.
* **Rank labels** (crown-rank-0) are a short description of an established rating: Club (below 1300), District
  (1300+), Regional (1500+), National (1700+), Master Circuit (1900+), Crown Contender (2100+); "Provisional" while
  provisional.

### Rating titles (crown-rating-titles-1)

There is one **rating title for every 100 points**: 31 titles from 0 to 3000+, each with its own insignia. Your
title is simply the band of your current Federation (Rapid) rating: it goes **up and down with your rating** and is
marked "provisional" while the rating is provisional. Ratings below 0 use the first title; 3000 and above is the
last title, with no upper limit.

| Rating | Title | Rating | Title | Rating | Title |
|---|---|---|---|---|---|
| 0–99 | Wandless Wanderer | 1100–1199 | Enchanted Tactician | 2200–2299 | Elder Magister |
| 100–199 | First-Year Initiate | 1200–1299 | Arcane Strategist | 2300–2399 | Crown Sorcerer |
| 200–299 | Candlelight Apprentice | 1300–1399 | Runic Tactician | 2400–2499 | Supreme Arcanist |
| 300–399 | Spellbook Novice | 1400–1499 | Spellweaver | 2500–2599 | Grand Runelord |
| 400–499 | Charmed Pawn | 1500–1599 | Wardbreaker | 2600–2699 | Imperial Archmage |
| 500–599 | Potion Scholar | 1600–1699 | Mystic Duelist | 2700–2799 | Elder of the Crown |
| 600–699 | Wandcraft Student | 1700–1799 | Grand Enchanter | 2800–2899 | Sovereign Magister |
| 700–799 | Hex Apprentice | 1800–1899 | High Arcanist | 2900–2999 | Astral Archon |
| 800–899 | Arcane Challenger | 1900–1999 | Archmage's Heir | 3000+ | Eternal Sovereign |
| 900–999 | Rune Reader | 2000–2099 | Royal Spellmaster | | |
| 1000–1099 | Dueling Scholar | 2100–2199 | Grand Runemaster | | |

* **Eras:** Apprentice (0–799), Scholarly (800–1599), Master (1600–2399), Legendary (2400–2999), Sovereign (3000+).
* **Insignia collection:** you collect the insignia of every band your **established** rating has been in,
  including every band passed through between two consecutive established ratings (rising or falling). A collected
  insignia is kept after your rating falls. Bands below your first established rating are not collected;
  provisional ratings never collect.
* **Peak title:** the band of your highest established rating.
* A rating title is a description, **not** an honour: it is not a Federation title (section 21), not a division and
  not a money ranking. Titles and the collection are computed from your saved rating history every time.

## 16. Tournaments

A federation **season** has **19 rounds**. You play your games in a round, then **Advance** to process the rest of
the round (computer games are resolved, ratings are updated) and open the next one.

| Rounds | Event |
|---|---|
| 1–15 | Regional league (single round robin, section 17) |
| 4–8 | Swiss events: Federation Open and Challenger Open (5 rounds) |
| 10–11 (12) | Club Weekend (club owners only) |
| 16–19 | Crown Championship knockout (round of 16, quarterfinals, semifinals, final) |

**Scoring:** win 1, draw ½, loss 0. **Forfeit:** if you forfeit one of your fixtures you score 0; no game is
played and your rating does not change.

### Swiss events (rounds 4–8)

* **Federation Open:** the 32 highest-rated active competitors of divisions 2–4 at season start.
  **Challenger Open:** the 32 highest-rated of divisions 5–8.
* **Entering:** if you are in division 2–4 you may enter the Federation Open; in division 5–8 the Challenger Open.
  Crown Division (division 1) players qualify for the Championship through their league instead. Entry costs **$25**,
  or a **recovery voucher** if you have less than **$100** cash (one voucher per season). Registration is open in
  **rounds 1–3** and closes before round 4. You replace the 32nd seed and the field is re-seeded by rating.
* **Pairing (crown-swiss-1, a simplified score-group system — not the FIDE Dutch system):** players are sorted by
  points, then seed. With an odd number of players, the lowest-ranked player who has not yet had a bye gets a
  **bye worth 1 point**. Then the highest-ranked unpaired player meets the nearest-ranked opponent he or she has
  **not met before**, preferring the same score group; a full search guarantees a pairing without rematches
  whenever one exists. If none exists, the fewest possible rematches are used and recorded. Colours: the player
  with fewer Whites so far gets White; ties go by seed.
* **Final order:** points → Buchholz Cut-1 → Buchholz → Sonneborn–Berger → pre-event seed.
* **Prizes:** Federation Open $1,500, Challenger Open $600, split 30 / 20 / 12 / 12 / 6.5 / 6.5 / 6.5 / 6.5 % to
  places 1–8. The winner receives the title "*Event* winner S*n*".

### Crown Championship (rounds 16–19)

* **Field of 16:** the **8 best regional Crown Division winners** (of the 16 regions; ranked by points, then
  rating) plus the **top 8 of the Federation Open** who are not already qualified.
* **Seeding:** by rating; bracket 1–16, 8–9, 5–12, 4–13, 3–14, 6–11, 7–10, 2–15. Winners meet in bracket order.
* **Matches:** two games with colours swapped. If the score is 1–1, a two-game "rapid" pair follows; if still
  level, a two-game "blitz" pair; if still level, the **higher seed advances**. In the **final**, a level match
  after all three pairs makes **joint Crown Champions**. A match can need several games in one round; the next game
  of a match is scheduled as soon as that match's previous games are decided.
* **Prizes:** $8,000: champion 40 %, finalist 20 %, semifinalists 10 % each, quarterfinalists 5 % each (joint
  champions share 60 % equally).

### Club Weekend (rounds 10–11, club owners only)

If you own a club, you and the members of your own division closest to you in rating play a knockout seeded by
rating, with the same two-game match rule. A level-1 club holds a **4-player** event (semifinals round 10, final
round 11); a level-2 or level-3 club holds an **8-player** event over rounds 10–12. Hosting costs and the prize
escrow are paid from your cash; guests pay attendance; a sponsor pays when the event is completed.

### Titles and reputation

Event titles come **only from results** (league champion, Swiss winner, Crown Champion or Joint Crown Champion) and
can never be bought. Competitors' reputation rises with titles and decays each season.

## 17. Leagues, divisions, regional leagues, promotion and relegation

* The Federation has **16 regions** and **8 divisions** (1 Crown, 2 Grand, 3 Premier, 4 Masters, 5 Senior,
  6 District, 7 Club, 8 Open). Each division of each region is a **regional league of 16 players**:
  8 × 16 leagues × 16 players = **2,048** places.
* **Joining:** you join at the start of a season (round 1) in the **Open Division (8)** of the region you choose.
  You take the place of that league's lowest-rated competitor, who becomes a reserve.
* **League format:** a **single round robin** — everyone plays everyone else once — over **rounds 1–15**, one
  game per round. Colours are balanced: the player with fewer Whites so far gets White.
* **League order:** points → head-to-head points among the tied players → Sonneborn–Berger → pre-season seed.
  (Seeds are the league's member order at season start, by rating; you, as the player, are always listed last and
  so hold the lowest seed — see the traceability notes.)
* **Promotion and relegation** happen at season end, at the same time everywhere, between **adjacent divisions of
  the same region**: places **1–2** of a league move **up** one division (not from division 1), places **15–16**
  move **down** one division (not from division 8).
* **League prizes** (escrowed at season start): $2,000 in division 1 falling to $120 in division 8
  (2,000 / 1,338 / 895 / 599 / 401 / 268 / 179 / 120), split 50 / 30 / 20 % to places 1–3. The league winner
  receives the title "*Division* Division champion (*region number*) S*n*".

## 18. Spectating

* Each round has **featured** computer games between federation competitors. You can watch one **live** (move by
  move, in the Live Arena) or let it be played in the background.
* Featured games are played by the engine at each competitor's calibrated strength, from the standard start, under
  the normal rules — with the engine-vs-engine draw handling and the 400-halfmove playing-length limit of section 10.
* While a featured game's market can still trade, you see only **public information**: the moves already
  published, the players' public profiles and thinking time, and the evaluation the moving engine produced for the
  move just played (published to every trader at the same moment). **No move-quality grades and no deeper analysis
  are shown or computed until the market is settled or cancelled.**
* Watching does not change any result: the moves are fixed by the competitors' engines and a seed.

## 19. Analysis and replays

* **Every game is saved** with its starting position and its full list of legal moves, so it can be **replayed
  exactly**, move by move, at any time — including your own games and the featured games you watched.
* After a game ends it is **analysed automatically** (Match Analysis): an evaluation graph, best lines and a
  move-by-move grade and accuracy figure.
* **Grading is experimental.** The grade boundaries and the accuracy formula are the game's own, still being
  tuned, and **not** calibrated against any official standard. Treat grades and accuracy as guidance, not as a
  verdict. Achievements based on grades (for example Brilliant moves) cannot be earned until the grading is
  validated (section 21).
* The **Played Like** strength estimate is shown as "Calibrating": it did not pass validation, so no number is shown.
* Analysis never changes a result or a rating.

## 21. Career progression

*(Section 20, the Exchange, is in Part III.)*

### Federation titles (crown-titles-1)

Four permanent honours of the game's own fictional federation — **Squire, Knight, Paladin, Sovereign**. They are
**not FIDE titles**. They are earned by **norms**:

* A **norm** is one completed event (league season, Swiss event or Crown Championship) of **at least 5 games**
  where your **performance rating** (average opponent rating + a score bonus: −400·log₁₀(1/p − 1) for score
  fraction *p*, capped at ±800 for 100 % / 0 %) reaches a tier's threshold **and** your opponents' average rating
  reaches that tier's floor.

| Title | Performance | Opponents' average | Norms needed | Norm games | Peak rating | Also needs |
|---|---|---|---|---|---|---|
| Squire | 1700+ | 1100+ | 1 | 5 | 1600 (any) | — |
| Knight | 2000+ | 1500+ | 2 | 15 | 1900 (established) | — |
| Paladin | 2300+ | 1800+ | 3 | 27 | 2200 (established) | an event title |
| Sovereign | 2600+ | 2100+ | 3 | 27 | 2500 (established) | a Crown Championship final |

A norm of a higher tier also counts toward lower titles. Titles are **never lost**.

### Rating titles

See section 15. They follow your rating up and down and are descriptions, not honours.

### Achievements — the Sovereign Vault (crown-vault-2)

* The Vault holds **210 collectibles**: **170 achievements**, the **9-step Exchange title ladder** and the **31
  rating-title insignias**, in nine collections (Chess Mastery, Brilliant Mind, Federation Career, Rivals,
  Tournaments, Grand Exchange, Patron's Treasury, Legacy, Insignias). v0.11 added 68 achievements; every earlier
  collectible and every earlier unlock is unchanged.
* Every collectible belongs to one of **20 families** (e.g. Defensive Resilience, Endgame Technique, Win Streaks,
  Regional Conquest, Forecasting Calibration, Financial Recovery, Career Longevity) and has a **tier**: Bronze
  (Common or Uncommon), Silver (Rare), Gold (Epic or Legendary) or Sovereign (Mythic). The Vault shows each family's
  progress, the count earned per rarity and the collectibles closest to unlocking.
* Each achievement is a fixed rule over your saved records (games, rating history, federation history, ledger and
  forecasts). It is unlocked once and kept; reloading or re-analysing never unlocks it twice.
* **11 achievements** depend on move grading (Brilliant moves, accuracy, Played Like) and show as "Awaiting
  validated grading": they **cannot be earned** while grading is experimental. So **159 achievements** are earnable
  today.
* **Anti-exploit rules** (examples): assisted, abandoned, training and unfinished games never count as wins; win
  counters count the same opponent once per day; rating-gap achievements need both ratings recorded; provisional
  ratings never unlock rating thresholds; volume alone (many trades) never qualifies.
* **Anti-farming (v0.11 achievements):** only rated games count; a win against an opponent rated more than 400 below
  you never counts; win counters count one win per opponent per day and at most 10 wins a day; streaks skip (never
  count) such wins; material comebacks need the deficit held for 4 plies; calibration uses your latest forecast per
  market and must not be worse than the market price; profit must hold after removing your single best market.
* **8 achievements are secret**: their conditions are shown only once earned.
* **Exchange titles** (Apprentice Forecaster … Sovereign of Probability) need a sample of resolved paper forecasts
  that beat the market price by a margin and, for the higher steps, realized profit that holds even after removing
  your single best market.

### Random Match (Random Federation Quick Match)

* One button picks an opponent **uniformly at random** from the **active** federation competitors — every eligible
  competitor has the same chance; it is **not** weighted by rating. Reserves and retired players are never picked.
* Optional filters only narrow the pool: **Anyone**; **Near My Rating** (within 200 points of your rating);
  **Higher Rated** (rated above you); **Elite and Sovereign** (rated 2400 or more).
* **Reroll** avoids repeating the previous opponent when someone else is available.
* The game is **Rapid 5+3**, your colour is random, and it is **Rated** by default (you may choose Casual). A rated
  Random Match changes your Rapid rating once, at the end. It is **not** a league game: standings, prize pools and
  markets are unaffected.

---

# Part III — Exchange Rules

## 20. The Crown Exchange

### Money

* All money in the game is **fictional dollars** ($). It cannot be bought, sold, withdrawn or exchanged for
  anything real. You start a federation career with **$1,000**.
* All amounts are kept exactly in millionths of a dollar in a double-entry ledger: every transaction balances, and
  no account except the issuing account may go below zero. You cannot spend money you do not have.

### What you trade

* A **market** asks a question with a fixed list of outcomes that are exhaustive and mutually exclusive — for
  example a featured match (**White wins / Draw / Black wins**), a tournament winner, or "Will X be promoted?
  (Yes / No)".
* You buy **shares** of an outcome. **Each share pays exactly $1 if its outcome happens, and $0 otherwise.** Some
  markets also offer combined claims that pay $1 if any outcome in a set happens (for example "X reaches the final").
* A share's **price** is shown in dollars, from $0.000 to $1.000 (for example $0.485). The prices of all outcomes of
  a market add up to $1.

### A price is not a guaranteed probability

A price is what the market currently charges for a $1 payout. It reflects the trades made so far (yours and those
of the computer traders), not a promise. **A price of $0.70 does not mean the outcome happens 70 % of the time**,
and it can be wrong. The market also shows a separate **model** forecast; the model is information only and never
moves the price.

### How prices move (LMSR)

* Each market is a **logarithmic market scoring rule** (LMSR) market maker with a fixed liquidity *b*: cost
  C(q) = b · ln Σ exp(qᵢ / b), price pᵢ = exp(qᵢ / b) / Σ exp(qⱼ / b). Buying an outcome raises its price; selling
  lowers it. The cost of a trade is the change in C.
* Liquidity *b* by market family: match 120, tournament winner 150, promotion 80, qualification 80, season title
  100, Championship bracket 100 (practice markets 60).
* Every market is **fully funded before it opens**: its worst-case loss is set aside, so every winning share can
  always be paid.

### Trading rules

* You trade **whole numbers of shares** (at least 1).
* **Buy cost** rounds **up** to the next millionth of a dollar; **sale proceeds** round **down**.
* **Fee: 1 %** of the executed amount (rounded up), on **every buy and every sale**. A buy costs amount + fee; a
  sale pays amount − fee. Fees are **not** refunded, even if the market is cancelled.
* **Long only:** you can only sell shares you hold (no short selling), and a sale is refused if its proceeds would
  not cover the fee.
* Before you confirm, the ticket shows the cost, the fee, the **maximum payout** (shares × $1) and the **maximum
  loss** (everything you pay).
* **Stale quotes are refused:** if the market moved (another trade, or a new published move in a live game) after
  your ticket was priced, the trade is rejected and you must check the new price. You may also set a cost limit; a
  buy that would cost more is refused.

### Market states

**Trading Open → Trading Closed → Market Settled** or **Market Cancelled**. A closed, settled or cancelled market
never reopens, and a market is resolved only once.

| Family | Outcomes | Trading closes | Settles on | Cancellation pays |
|---|---|---|---|---|
| Match (featured game) | White wins / Draw / Black wins | When the game starts; if you watch it live, also traded between moves until the final move | The game result | $1/3 per share |
| Winner (Federation Open, Crown Championship) | Every entrant | When the event's first round starts | The champion; joint champions split each share equally | $1/n per share |
| Promotion | Yes / No | When the last league round (15) starts | The season-end promotion list | $0.50 per share |
| Qualification | Yes / No | When round 15 starts | The Championship field | $0.50 per share |
| Season | Each member of a Crown Division league | When round 15 starts | The league champion | $1/16 per share |
| Bracket (Championship final four) | 8 possible paths | When the semifinals start | The actual path (a joint final splits ½ / ½) | \|S\|/8 per share (S = the claim's set) |

* A market closes when its closing round **starts** — when the first game of that round is played or the round is
  processed.
* **Settlement** happens only from **recorded results**. Each winning share pays $1 (or its exact share of $1 for
  joint results); losing shares pay nothing. Settlement pays everyone at once, exactly once.
* **Cancellation (void)** pays every share the market's **published cancellation amount** (the table above:
  normally $1 divided by the number of outcomes; for a claim, $1 × its number of outcomes ÷ the total). A market is
  cancelled when its subject can never be decided normally:
  * a featured match is never played, or is stopped by the **400-halfmove playing-length limit** (the standings
    record a draw, but the market is cancelled);
  * you enter the Federation Open: its champion market is cancelled at $1/32 per share **before** your entry takes
    effect (conflict rule).
* In a bracket market a combined claim such as "X beats Y in the final" pays nothing if its condition fails; it is
  not refunded.

### Integrity rules (information policy)

* **No markets on your own games.** Official markets never list a game you play; a trade on one is refused. The
  Championship markets are not listed when you are in the field, and the season families are about other regions.
* **Conflict of interest:** while you sponsor a competitor (a sponsorship contract), you may not **buy** in a
  market where that competitor plays; you may still sell shares you already hold.
* **Public information only:** the model forecasts and the computer traders use public ratings and recorded
  results only — never a competitor's hidden strength. Results of a round are not decided until the round is
  played, so no one can trade on a result that already exists.
* **Grades hidden until settlement:** Match Analysis of a featured game (move grades, the analysis curve) is not
  run or shown while its market can still trade; it runs after settlement or cancellation.
* **Live trading windows:** in a live featured game, trading pauses while the next move is computed and reopens
  after it is published; any quote from before the new move is refused.
* **Paper forecasts:** you may enter a free probability forecast on an open market (no money). You can revise it
  until the market closes; the latest one counts. Forecasts are scored against the result and against the market
  price (Brier score) for the Exchange title ladder.

### Practice markets on your own casual games (Sandbox)

* A **practice market** may be opened only on your own **casual** game started from Play or Random Match, from
  the standard starting position, before the first move, with no assistance used. Rated games, federation games
  and training retries never carry markets.
* It uses separate **practice money**: $500 to start; when your practice balance is below $20 it is topped up to
  $200, but only after five more practice markets have resolved since the last top-up. Practice money can never
  mix with real game money and never affects your cash, net worth, rating, standings or prestige.
* You may only **back yourself**: "You win" or "You draw or win" — never your own loss. Trading closes at the first
  move. The market opens at the rating-based starting prices.
* It **settles** on the result, or is **cancelled at the opening prices** if you used the Assistant, the game was
  abandoned, or the game ended in fewer than 20 halfmoves (fewer than ten moves each) other than by checkmate.

---

# Quick Reference

**Board:** 6×6, files a–f, ranks 1–6, White moves first.
**Start:** `rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1` — R N Q K N R; queens on c, kings on d.

**Pieces:** King 1 square any direction · Queen any distance straight or diagonal · Rook any distance straight ·
Knight L-shape, jumps · Pawn 1 square forward, captures 1 square diagonally forward.
**Not in the game:** bishops, castling, pawn double step, en passant.
**Promotion:** mandatory on the last rank, to **Q, R or N** only.

**Win:** checkmate · opponent resigns · opponent's time runs out while you have any non-king piece.

| Draw | Automatic or claim | Number |
|---|---|---|
| Stalemate | automatic | — |
| King vs king | automatic | — |
| Repetition | claim at **3**, automatic at **5** | occurrences of the same position (pieces + side to move) |
| No pawn move or capture | claim at **100**, automatic at **150** | halfmoves |
| Agreement | both players | allowed after **10 moves each** |
| Timeout vs bare king | automatic | — |

Checkmate beats every draw rule. Claims are made on your own turn. Other low-material endings play on.

**Clocks:** Blitz 3+2 · Rapid 5+3 · Classical 15+10 · Untimed. Increment added after each move. A move made after
your flag falls does not count. Clocks pause in the background.

**Rated:** timed + Rated chosen + calibrated opponent. No engine help in rated games. Any assistance = never
rated. One rating change per game.
**Rating:** Glicko-2 (not FIDE Elo), start 1500 / RD 350; provisional until **20 games and RD ≤ 100**. Federation
rating = Rapid rating. **31 rating titles**, one per 100 points (0 → 3000+).

**Federation:** 16 regions × 8 divisions × leagues of 16 = 2,048. Season = **19 rounds**: league 1–15 (single
round robin), Swiss 4–8, Club Weekend 10–11, Crown Championship 16–19. Top **2 up**, bottom **2 down**.
Win 1, draw ½, loss 0, forfeit 0.
League order: points → head-to-head → Sonneborn–Berger → seed. Swiss order: points → Buchholz Cut-1 → Buchholz →
Sonneborn–Berger → seed. Knockout: 2 games → 2 "rapid" → 2 "blitz" → higher seed (final: joint champions).
**Federation titles:** Squire, Knight, Paladin, Sovereign — by norms, permanent, not FIDE titles.

**Exchange:** fictional dollars only. A share pays **$1** if its outcome happens. Price in dollars ($0–$1), **not a
guaranteed probability**. Fee **1 %** on every buy and sale, not refunded. Long only. Stale quotes refused.
Open → Closed → Settled or Cancelled (never reopened). Cancellation pays the published amount ($1/n per share).
**No markets on your own games**; no buying in markets of competitors you sponsor; grades hidden until settlement.

**Analysis:** every game replayable exactly; grades and accuracy are **experimental**.
