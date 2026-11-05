# AI vs AI Match Arena (package Z)

## Entry points
* Dashboard: "AI vs AI Match Arena" card (`dash-open-arena` → `#/arena`, `dash-start-exhibition` → `#/exhibition`).
* Federation screen: "Watch AI Match · AI vs AI Arena" (`arena-link`). The Exhibition Arena link stays.
* Hub `#/arena` (src/ui/ArenaHub.tsx, read only): Custom Exhibition (start / continue), Watch Live Official Matches
  (featured games in play with their markets, and the scheduled live slate), Upcoming Federation Matches, Completed
  Match Replays (official recorded games and exhibitions; Replay Library link), Search AI Competitors ("As White" /
  "As Black" sends a competitor to the exhibition picker).

## Audit: what already existed (reused, not rebuilt)
Exhibition Arena (any two competitors, each with its own profile/style at the featured-game node cap, pause / step /
skip, Match Analysis, Played Like, separate `exh:` archive, backup round trip, isolation tests); the Live Match Center for
official featured games (EvalBar, odds, trade ticket with fee / payout / max loss, portfolio, phone tabs
Board·Analysis·Trade, information policy); the live scheduler and Live Now; the Replay Library (exhibitions filter);
the casual Sandbox Exchange (sandbox:* accounts the ledger never mixes with official ones); discovery filters for title,
style and region (only the exhibition picker lacked them); the Web Worker exhibition engine channel and pause-when-hidden
(`visibilitychange` → `exhibitions.pause()`).

## Added
* Picker filters: title, style, region (plus name, rating band, division).
* Display clock (src/app/exhibition.ts `EXHIBITION_TIME_CONTROLS`): No clock, the legacy 3+2, 5+3, 15+10 and the
  official presets of src/games/types.ts (30+30, 60+60, 90+60, 120+90, 180+120, 240+120; v1.1 integration — saved games
  keep the clock they were played with, and the retired 60+30, 90+30, 180+60 ids still resolve). **Display/accounting only**: each move is charged the engine's real measured thinking time
  (recorded in the move, so replays show the same clocks) plus the increment. It never changes a search request — each
  side keeps its own profile budget, shown as "AI thinking budget: up to X s per move (N nodes)" — and never decides a
  game (no time forfeits). Integrator note: the long presets duplicate package X's rated presets; unify with
  `src/games/types.ts` `TIME_CONTROLS` when merging.
* Watch speed chosen before the start (Slow / Normal / Fast / Instant result) and in the match.
* Restart (below), match statistics, W/D/L model estimate (crown-odds-2, labelled "a model, not a price"), clocks,
  division and club emblems in the player bars, a Market tab.
* Official arena: trading cutoff, fee and settlement/void rules and per-outcome potential payout / exposure on the match
  screen (desktop single screen; phone Trade tab).

## Restart semantics
A restart creates a **new exhibition record** (new id): the same two sides exactly as recorded at the start (same engine
profiles and styles, read from the record — not re-read from the competitors, whose ratings may have moved), same colours
and display clock, from the start position.
* **Same seed**: every move is a fresh seeded search of the recorded seed, so the identical game is replayed move for move.
* **New seed**: a new seed is drawn, so usually a different game.
The old record stays in the archive, marked `restartedAs: <new id>` (the new one carries `restartOf: { id, seed }`); it
can still be opened and replayed. A practice market on an unfinished restarted game is voided.

## Practice market (sandbox money)
src/app/exhibitionMarket.ts + FederationService `openExhibitionMarket / publishExhibitionMove / exhibitionTrade /
closeExhibitionMarket / resolveExhibitionMarket`. Reuses the casual Sandbox Exchange: LMSR market kind `sandbox`, id
`sbx:<exhibition id>`, practice wallet `sandbox:player`; all money in `sandbox:*` accounts (ledger-enforced separation).
* Opens at the public pre-game forecast; after each published move a practice maker (`sandbox:maker`, explicit sandbox
  mint) re-anchors prices to the public live model (public ratings, published evaluation, ply, material). Prices change
  only from published moves and the player's trades. No NPC traders, no hidden strength, no future moves.
* Trades carry the published ply; rejected once another move is published. Trading stops at Skip to Result.
* Settles exactly once on the result (`settle:<market>` journal, idempotent); VOID (cancelled at the published opening
  prices) on restart, deletion before the end, or the 400-ply playing limit. Reconciled on reopening an exhibition.

## Tests
* tests/aiArena.test.ts: filters; clock vs budget separation (identical engine requests with and without 120+90; clock
  arithmetic); restart semantics; practice market (sandbox-only journals, official balances/markets unchanged, re-pricing
  only on publish, stale quotes rejected, single settlement, reload); restart voids; isolation with clocks, restart and a
  market (official hash and the following season simulation identical to a world without them).
* e2e/ai-arena.mjs (desktop, 375 px, 390 px); e2e/a11y.mjs now also audits `#/arena`.
