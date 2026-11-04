# M6 addendum — Sovereign Live Arena

Scope note: only the "Sovereign Live Arena" addendum and the screenshot requirement were provided; the main
M6 "Crown Legacy" prompt they refer to was not. The Arena is built on the v0.5.0 foundation (one canonical
engine, recalibrated analysis, LMSR markets) and changes none of it. Features named only by the missing prompt
(for example "16 Circuit Grades") were not invented.

## What it is

`#/watch/<fixture>` (Federation → *Watch live*) is one dashboard for a federation engine match:

| Part | Content |
|---|---|
| Board | the actual published position, last move, flip, move navigation |
| Players | portraits, public rating ± RD, division, club and title insignia, validated style, colour; engine thinking time used (featured games are node-limited, so there is no game clock — labelled as such) |
| Context | event, stage, season and round, live/replay status, information-policy note |
| Moves & evaluation | notation; graph of White's expected score from the **published** engine evaluation; after settlement, a dashed **post-game** canonical curve and a quality label on every move (Brilliant … Blunder) with a per-side summary; accessible table version |
| Market | claim prices, live model, pre-match model, price history chart and table, market revision, trade ticket |
| Portfolio | shares, spent/received, executable value, unrealised or realised P&L, maximum loss; cash, open positions, net worth |
| Controls | in-play: next move, auto, window length (6/3/1 s); replay: pause/resume, speed (slow/normal/fast/instant) |

Desktop (≥ 1180 px) shows all three columns together; tablets two columns; phones keep the board on top with
tabs for Moves & eval / Market / Portfolio.

**v0.10 Live Match Center** (docs/V10_PLAN.md Decision 3): an evaluation bar beside the board (the *published*
evaluation of the shown move while the market can trade; the Match Analysis evaluation after settlement; never a
market probability), a context strip (names, ratings, score or move number, thinking clocks, W/D/B prices, current
evaluation), the model forecast labelled as such, match events, turning points, tournament context and Grimoire
links. Between 760 and 1180 px the Trade column (market and portfolio) sits beside the board. Phones (≤ 700 px) use
the tabs **Board · Analysis · Trade** with the context strip and the tabs kept at the top while the page scrolls
(page scroll only, no inner scroll box). A recorded game replays with play/pause, speed, step, jump and flip; the
*recorded* price points, the trades in each move's window, the player's holdings, value at the recorded prices,
and the recorded settlement are synchronised to the replay ply (`src/app/replay.ts`; a ply without a published
point shows the latest earlier point, labelled with its move; nothing is reconstructed). The branching sandbox
(engine help on the sandbox position) opens only after the market is settled or cancelled, and never changes the
recorded game. Journey: `e2e/replay-center.mjs`.

## Information policy (crown-arena-policy-1)

1. **Public live-match information** — published moves, public profiles, thinking time.
2. **Market-authorised public evaluation** — the evaluation the moving engine produced for the move just played.
   It is published to the player and to every NPC trader at the same moment and is what the live model uses.
3. **Privileged deep analysis** — never shown, and never *computed*, while the official market can trade:
   `AppServices.requestWorldAnalysis` refuses while the market is open or closed-awaiting-result.
4. **Post-game analysis** — the canonical engine (`crown-search-2+crown-eval-4`, `crown-grade-v2-experimental`)
   analyses the recorded game only after settlement or cancellation; labels show its provenance. No label is ever
   shown for a move before that analysis exists.

Future moves never exist while trading is possible: in-play moves are computed one at a time, after the previous
trading window.

## Synchronisation

* All views read the same committed `FederationService` state; commands are serialised.
* **Market revision** `revisionOf(m) = <trades>.<published plies>` advances on every trade and every published
  move. Trade tickets send the revision they were quoted on (`expectRevision`); a trade queued while the next move
  is computed is rejected once that move is published, even if no NPC traded (the previous check used the trade
  count only and would have accepted it).
* `liveStep(fixture, expectPly)` refuses duplicate or stale step requests; the market revision is locked for the
  command (asserted before the NPC reactions are applied); move, NPC trades, price point and revision are committed
  in one transaction.
* Every price point stores the revision and time at which its information was published; worker replies from
  superseded generations are discarded (engine event log).
* Completed replays (moves, published evaluations, price history, post-game report) persist in IndexedDB and work
  offline.

## Verification

* `tests/arena.test.ts`: revision advances per move; stale quote rejected after a move without NPC trades;
  duplicate step rejected; price points carry revisions; settlement; replay data survives a reload; ledger
  conserved. Pass.
* `e2e/m6-arena.mjs` (final production build, Chromium; also passed 11/11 on the first build) — **11/11 PASS, 0 console errors**
  ([log](evidence/m6-arena/journey-log.txt)): opened a live Crown Championship round-of-16 match; board, clocks,
  players, odds, portfolio and graph visible with the view's revision equal to the committed one; no labels while
  trading; bought 10 shares through the ticket; the next move advanced the revision (11.1 → 15.2) and the
  notation/graph; a trade quoted on the old revision and a duplicate step were rejected; the match finished
  (79 plies, 1-0) and the market settled exactly (10 shares → 10.00 ₵); post-game analysis of all 79 plies was
  produced only after settlement; after a browser restart the replay reopened with labels and price history;
  on a 390 px phone viewport the board stays on top and the tabs work with no overflow; offline, the replay loaded.
* Not run: a physical iPhone; Windows.

Screenshots: [docs/screenshots/m6/INDEX.md](screenshots/m6/INDEX.md).
