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

**Style.** A competitor's label (Universal, Tactical, Positional, Defensive, Endgame, Aggressive). Only validated
styles (currently Tactical and Positional) change play, and only through their opening repertoire. → V.3.

**Subsidy.** The maker's worst-case loss b·ln n, funded before a market opens (match market: $131.83). → VI.2.

**Swiss.** A pairing system matching players on similar scores who have not met (crown-swiss-1, simplified). → V.4;
RB §16.

**Threefold repetition.** The same position for the third time. The draw is **claimable**, not automatic. → RB §10.

**Timeout rule.** If you flag, you lose if your opponent has any non-king piece or pawn; otherwise the game is a
draw. → RB §13; V.2.

**Training game.** An unrated game (for example a retry). It is excluded from the Lab's game evidence. → V.6.

**Turning point.** A ply where the evaluation crosses between better (> 0.65), balanced and worse (< 0.35). → V.5.

**Zugzwang.** A position where any move worsens the mover's position. → V.1.
