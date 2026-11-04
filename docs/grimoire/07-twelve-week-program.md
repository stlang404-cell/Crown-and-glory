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
* **Review questions:** (1) Which two styles are validated, and what do they change? (2) What does a high RD tell you
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
