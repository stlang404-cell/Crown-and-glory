# Next-release roadmap (after v0.5.0)

Every item names its acceptance evidence. Ordered by the directive's priorities: strength and correctness,
reliability, then features.

## 1. Device verification (blocking for 1.0)

- Physical iPhone: HTTPS-hosted PWA install, Add to Home Screen, airplane-mode cold start, Sovereign Max at 5 s
  (depth reached, memory with the 11.5 MB table), suspend/resume during a match and during analysis, storage
  eviction, backup export/import through Files. Evidence: device screen recordings and a written log.
- Windows 10/11: `Start-Crown.bat` and `Start-Crown.ps1` first run, the "already running" reuse path and the
  port-conflict warning, PowerShell fallback server. Evidence: screenshots and console logs.
- Screen-reader pass (VoiceOver, NVDA) of Play, Analysis, Exchange, Passport.

## 2. Engine strength

- Per-node improvements, each behind paired colour-swapped evidence at two budgets on held-out openings:
  using the best root move of an interrupted iteration (time-limited play), TT buckets with aging at long time
  controls, singular extensions re-tested at Max budgets.
- Full-length (10 s vs 6 s) L9–L8 confirmation match and a multi-point Max calibration (5/10/20/40 s).
- Fairy-Stockfish integration only after an owner licensing decision and a single-threaded, ≤ 32 MiB,
  non-isolated WASM build is shown to work offline on iPhone.

## 3. Analysis

- Human-outcome calibration of grade bins and k: opt-in local study recording human games against fixed levels
  (no data leaves the device unless exported).
- Re-analysis prompt for libraries with many legacy reports (batch, scheduled when idle).
- A registered improvement-claim protocol (pre-specified windows, multiplicity control) before any badge exists.

## 4. Federation and spectating

- Spectator browsing/filtering beyond three featured games per round (requires a cheaper move-generation tier for
  replayable games, or user-selected broadcasts).
- Balance: review how quickly AI competitors can reach Paladin/Sovereign in their first season.

## 5. Economy

- Act on the 20-season sweep findings in docs/V5_INTEGRITY_REPORT.md (strategy dominance, recovery time) with a
  parameter grid across ≥ 5 seeds.
- More meaningful sinks tied to accomplishments (e.g. hosting a chosen event format with a budget).

## 6. Reliability

- Service-worker update policy that never activates during a match; quota check before any future migration;
  per-store validation on load with a recovery-backup prompt.
