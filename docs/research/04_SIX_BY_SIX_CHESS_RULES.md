# Definitive competitive rules

## Selection and comparison

Choose Los Alamos-derived `crown-la6-v1` [D], documented by ChessVariants and Fairy-Stockfish source [R]. Its established identity and implementation support make it a lower-risk starting point. The prototype compares it with an invented bishop-substitution variant `crown-bishop6-exp1`, back rank RBQKBR, to test branching and composition differences. This second candidate is not an established historical variant. Additional historical 6×6 variant comparison is still an open research item; do not misrepresent the comparison as exhaustive.

Random-policy results in `data/A_summary.json` are censored exploratory samples, not competitive balance evidence. In particular, reaching a cap is neither a draw nor a natural game end. Tactical richness, positional depth, opening theory and human game duration cannot be established by those samples. Do not claim the chosen variant is balanced or solved. Conduct mirrored engine matches and human tournaments before adjusting the default.

## Exact state and move rules

Coordinates a–f left to right from White; ranks 1–6 bottom to top. White: a1 R, b1 N, c1 Q, d1 K, e1 N, f1 R; pawns a2–f2. Black mirrors by rank: a6 r, b6 n, c6 q, d6 k, e6 n, f6 r; pawns a5–f5. Ranks 3–4 empty. White moves first. Initial six-file FEN:

`rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1`

Rooks, knights, queens and kings move as their standard chess counterparts within 6×6 boundaries. No bishops in the competitive piece set. Pawns advance one empty square toward promotion; capture one square diagonally forward. No two-step pawn move; no en passant; no castling. On rank 6 for White/rank 1 for Black a pawn must promote to Q, R or N, regardless of captured-piece inventory. Promotion choice is part of the move. No king capture: moves leaving one's king attacked are illegal. Kings attack adjacent squares, including squares they could not legally move to because of the other king. Stalemate is a draw, checkmate a loss.

State: board, side to move, halfmove clock, fullmove index, repetition history, rules ID/version, clocks and outcome. Portable repetition identity excludes counters but includes all legal-move-affecting state. No castling or en passant flags may be set. Halfmove increments except on pawn move or capture, which resets it. Fullmove increments after Black.

## Crown competition policies [D]

- Draw by agreement after each side has moved at least ten times. No model probability involved.
- Claimable threefold repetition/100 halfmoves without pawn move or capture. Also automatic fivefold/150 halfmoves; checkmate on the last move takes precedence.
- Crown draw adjudication intentionally differs from orthodox automatic dead-position rules: automatically draw bare kings; do not automatically adjudicate other material combinations. Such positions continue until agreement, repetition or the no-progress rules apply. This finite policy avoids an unimplemented exact mate-possibility oracle; it is a declared Crown variant policy, not a claim of orthodox equivalence.
- Crown timeout rule: a player flagging loses if the opponent has any nonking piece, otherwise the result is a draw. This simple, explicit competition rule can award a timeout win even in a position where that piece could not force or legally achieve mate; disclose this difference from orthodox rules. Check terminal checkmate/stalemate/bare-kings before clocks at the move-commit boundary. Simultaneous flags at resume draw; while active, the currently running clock alone can flag. No engine evaluation decides the result.
- Resignation loses. Disconnect/suspension pauses local casual games. Rated human-vs-AI clocks pause on app suspension to avoid iOS background penalties; record pauses. No real-world asynchronous competition is claimed.
- Never use the experiment's 160-ply cap as a production rated draw rule.

Default rapid is 5 minutes + 3 seconds increment per move [D], blitz 3+2, untimed unrated. Assess actual game duration through playtesting; “shorter board” does not prove a short match.

## Canonical fixtures

`data/positions.json` holds full benchmark boards (a1-first flat encoding). `scripts/validation.py` constructs explicit pin, promotion, mate, stalemate, single-legal-reply and queen-capture tests. LA initial perft depths1/2/3/4 =10/100/1212/14332 [E], matching the pinned pyffish0.0.90 independent Fairy-Stockfish binding. Differential testing across10,000 positions from75 seeded games found no legal-move or board/counter transition mismatches. This is substantial sampled agreement, not exhaustive correctness or validation of Crown-specific competition policies. `data/replay_fixtures.json` supplies 20 full JSON move/state sequences for position alignment.

Research now supplies10,000-position differential agreement and depth4 matching perft; before M0 passes, reproduce these against the production implementation, extend deeper/edge fixtures, and test the explicit Crown draw/timeout policy. The third-party engine adapter supplies move/search support, while Crown competition adjudication remains the application authority. Experiment board strings are research format, not the final portable save schema. Curated openings start as named move sequences only after engine legality checks; no standard ECO assignment unless an explicit 6×6 taxonomy exists.
