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

### Answers
* **Guided:** p = 0.7, dp = −400·log10(1/0.7 − 1) = −400·log10(0.4286) ≈ **+147**. Performance ≈ **2097**. With an
  average of 1950, it qualifies for **Knight** (2097 ≥ 2000, 1950 ≥ 1500). It does not qualify for Paladin
  (2097 < 2300).
* **1:** every pair is level, so the higher pre-event seed (**seed 3, you**) advances. In the **final** the result
  would be **joint champions**.
* **2:** head-to-head among the tied pair is ½–½ (level), so Sonneborn–Berger decides: **A** ranks higher.
* **3:** a norm needs at least **5 games**.
* **4:** the established **peak rating of 1900**. You have the norms (2) and the games (18 ≥ 15).

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
