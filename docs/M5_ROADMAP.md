# M5 roadmap (after v0.4.0 "The Grand Exchange")

Every item names its acceptance evidence. Nothing is "done" because a screen exists.

## 1. Platform verification (blocking for a 1.0)

- Run `Start-Crown.bat` / `Start-Crown.ps1` on a real Windows 10/11 machine (or a Windows CI runner): first-run
  install/build, port fallback, PowerShell fallback server; record screenshots and logs.
- Physical iPhone: HTTPS-hosted PWA install, airplane-mode play, storage eviction behaviour, backup export/import
  through the Files app, touch drag on the 6×6 board, safe areas.
- Accessibility: screen-reader pass of Play, Exchange, Finance, Spectator; 200% text zoom; focus order audit.

## 2. Engine and personalities

- Continue the engine work documented in docs/M4_ENGINE_STRENGTH.md (whatever it left open), keeping every
  change behind paired, colour-swapped evidence; re-calibrate the ladder after each accepted change.
- Full-game styles beyond the opening (where M4 did not validate them): style-specific search terms tuned with
  the parity harness at two node budgets and 128 pairs; endgame-technician suite measured on conversion rate.
- Human calibration: an opt-in local study mode that records human results against fixed levels to anchor the
  internal scale (still offline; nothing leaves the device unless the player exports it).

## 3. Federation

- Regional champions qualifier, and the research's group
  stage + 8-player knockout championship format as an option (documented deviation in v0.3/v0.4).
- Rank titles tied to federation results (crown-rank-1), replacing rating bands.
- Broadcast requests: let the player choose which match is featured before the round opens.
- Advance preview: list market closures, upkeep, prizes and fixtures before advancing a round.

## 4. Exchange

- Tournament-winner trading during the event (per-round windows) with pre-published suspension rules.
- Additional bounded conditional families (e.g. Swiss top-four) with explicit state enumeration and solver bounds.
- Forecast league: separately funded, capped prizes for calibrated forecasting (proper score), never from trading.
- Exchange visibility and spending limits (player-set), and an option to hide the Exchange entirely.

## 5. Economy and institutions

- More institution decisions: hosting a chosen event format with a budget, a research department, staff.
- Multi-seed, 20-season economy sweeps with a parameter grid; acceptance: circulating-supply growth < 2%/season
  after season 5; no single strategy dominates across seeds; the losing strategy recovers within 3 seasons.

## 6. Reliability

- A single prioritised engine job queue across workers (analysis, spectator, assistant) with cancellation.
- Service-worker update policy that never activates during a match; quota check before migrations; Web Locks
  fallback.
- Corrupted-record recovery: per-store validation on load with a recovery-backup export prompt.
