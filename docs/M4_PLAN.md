# M4 plan (v0.4.0) — “The Open Market”

Starting point: v0.3.0 (this release). Every item below names its acceptance evidence; nothing ships as
"complete" because a screen exists. Order is by dependency and player value.

## 1. Sandbox Exchange (deferred from v0.3.0)

Goal: speculate on your **own casual games** with a separate fictional sandbox balance that never touches
official wealth, records or achievements.

- Accounts: `sandbox:*` only (the ledger already rejects mixed journals); a one-time 500 ₵ sandbox grant
  from `sandbox:mint`; separate Finance tab; excluded from net worth, prestige and achievements.
- Markets: open when a casual game starts (before move 1), close at move 1; only W/D/L on the game.
- Integrity: positions are limited to *backing yourself* (no position that pays when you lose), so throwing a
  game can never pay; resignation before move 10 cancels the market at ⅓; assisted games are excluded.
- Acceptance: unit tests for isolation (no official account ever changes), "cannot profit by losing" property
  test over random games, browser journey (grant → back yourself → win → settle → official finance unchanged).

## 2. More validated personalities

M3 validated two opening-repertoire styles (Tactical, Positional; docs/V3_STYLES.md). Next:

- Aggressive: redefine the preference around king-side pawn storms and queen activity (the engine already
  pushes pawns, so pawn pushes are not a distinguishing signature); Defensive: draw-weighted contempt in search.
- Middlegame character: style-specific search terms (contempt, king-safety weights) tuned with the parity harness.
- Endgame technician: a separate endgame-position suite (behaviour = conversion rate in won endgames).
- Bigger samples: 128 parity pairs and two node budgets; measure the book's effect on weak (L1–L4) competitors.
- Acceptance: each new style passes behaviour (Δ ≥ 10 pp, CI > 0) and parity at both budgets.

## 2b. Tournament-winner and in-match markets

- Tournament-winner markets (Federation Open, Crown Championship): one LMSR over all entrants with funded
  subsidy b·ln n; joint champions settle each share at 1/k; trading closes before round 1; property tests for
  solvency with n up to 32 and leakage tests that no round result exists while trading is open.
- In-match trading: only between featured games' moves when the game is generated move by move after the
  previous trading window closes (no precomputed result); window and price-update rules to be specified.

## 3. Deeper federation life

- Rivalries and storylines from stored results (repeated finals, upset streaks), shown in a news feed —
  generated only from recorded facts, with links to the underlying fixtures.
- Head-to-head and season pages for every competitor (pagination for 2,048 profiles).
- Player-visible federation calendar with notifications for your fixtures and watchlist matches.
- Championship history page (all seasons, brackets, finals replays).
- Acceptance: 20-season soak test (tools/sim) with bounded storage growth (target < 25 MB) and constant-time
  round processing; UI pages tested at phone width.

## 4. Exchange depth

- Pre-match markets for championship matches the round before they are played (closing before round start).
- Multi-outcome tournament-winner markets with fixed b and the same funded-subsidy rule (worst case
  b·ln n), settled at the final; cancellation rule for joint champions documented and tested.
- Analyst Office: forecast calibration chart from your settled paper forecasts and trades.
- Acceptance: solvency/property tests per market type; leakage tests that no market is tradable after its
  first move or after any relevant result exists.

## 5. Economy balance

v0.3.0 simulation results (docs/V3_ECONOMY.md) drive the tuning:

- Longer-horizon soak (20 seasons × 7 strategies) and a treasury stress test (aggressive trading by the player
  plus NPCs at their caps).
- Add a second meaningful money sink tied to play value (e.g. coaching sessions that unlock Academy packs,
  tournament travel for invitational events) and verify it does not make the losing strategy unrecoverable.
- Acceptance: circulating supply growth < 2% per season after season 5; every strategy's median net
  worth stays within the documented band; no strategy depends on trading to stay solvent.

## 6. Platform

- Windows: run `Start-Crown.bat` / `.ps1` on a real Windows machine (or CI runner) and record evidence.
- iPhone: test the HTTPS-hosted PWA on a physical device (install, offline, eviction, backups).
- Performance: move featured-game generation fully off the UI thread notifications (batch per 4 plies).
- Accessibility: screen-reader pass of World, Exchange and Finance; table semantics; focus order.

## 7. Release checks for v0.4.0

Typecheck, full Vitest suite, build, all browser journeys (rated, Academy, offline, federation, sandbox),
save upgrade from a real v0.3.0 build, economy simulation report regenerated, docs updated with measured
numbers only.
