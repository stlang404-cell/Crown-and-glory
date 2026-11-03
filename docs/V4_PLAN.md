# v0.4.0 plan — “The Open Market” (detailed)

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

## 2. Validated personalities (v0.3.0 shipped none)

v0.3.0 measured the bounded move-choice styles and none passed (docs/V3_STYLES.md). Next:

- Widen the candidate set adaptively (margin by depth and phase, e.g. 30–60 cp in quiet positions only)
  and add style-specific *search* changes (e.g. aggressive: king-safety-weighted eval terms; defensive:
  draw-score contempt), each tuned with the existing parity harness.
- Behaviour suite: 1,000 positions, features with confidence intervals; strength parity on 128 pairs.
- Acceptance: at least two styles pass both criteria at two node budgets; the UI shows only those.

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
