# Implementation plan: M2 – M5

The research package (docs/research) remains the binding specification. Each milestone must ship a
playable build plus automated and interface evidence; compilation alone never completes a gate.
Module boundaries already exist in `src/` (`academy`, `federation`, `exchange`, plus storage
migrations) so later work does not reshape M1 code.

## M2 — Analysis, intelligence lab, coach, training (next)

Exact next steps, in order:

1. **Calibration corpus.** Generate ≥ 2,000 engine-vs-engine games across levels with full move
   records (tools/bench already stores them), label positions with outcomes, fit the expected-score
   map u(cp) by held-out (opening-family split) logistic and isotonic fits, compare Brier/log loss
   and reliability curves; publish `crown-accuracy-v1` only if it beats the placeholder.
2. **Grade calibration + human review.** Recompute bin boundaries on the fitted map; build a
   reviewed fixture set for all eight grades incl. sound/unsound sacrifice, forced moves, mate
   preservation; keep v0 reports untouched (new report versions only).
3. **Report re-analysis UX.** Batch re-analysis queue with compatibility filters; comparisons never
   mix methodologies.
4. **Motif detectors** (forks, pins, skewers, discovered attacks, mating nets, hanging pieces,
   promotion races) verified by bounded legal search; tactical evidence graph stored per ply.
5. **Academy item bank:** positions mined from engine games with verified unique solutions,
   motif/difficulty labels, content-family IDs, training vs held-out splits; attempt history.
6. **Ten-skill profile:** per-skill rubrics from doc 06 with Beta/cluster intervals, insufficient-
   evidence states, scheduled non-overlapping comparison windows, Holm correction for any
   improvement badge.
7. **Coach:** recurring-pattern detection (≥ 5 opportunities over ≥ 3 games), tentative vs
   established labels, recommended exercises, effectiveness tracking vs prior opportunities.
8. **Bookmarks of positions, Library date-range/opponent filters, 100-game fixture history test.**

Acceptance: doc 16 "Analysis and skill measurement" plus the 100-game fixture scenario.

## M3 — Federation and competitions

- 2,048 persistent identities (128 circuits × 16, 16 regions × 8 divisions) with seeded PRNG streams.
- Tiered simulation: Tier 1 player/marquee games with the real engine; Tier 2 watched games with
  bounded searches in the worker queue; Tier 3 abstract W/D/L sampled from calibrated strength —
  labelled `abstract-result`, never given fake move lists.
- Round robin (circle method), Swiss with documented pairing priorities (not "FIDE-compliant"),
  elimination with two-game mini-matches, championship format and finite tiebreaks from doc 08.
- Deterministic tick transaction with staged commit markers and crash recovery; Continue Round /
  Season previews; promotion/relegation; rank history; rivalries from repeated consequential games.
- Spectator board for Tier 1/2 matches; style differentiation only after an equal-strength
  behavioural test passes (research experiment D was negative).

## M4 — Crown Exchange, economy, institutions

- Ledger first: integer microcrowns, balanced journals, idempotent settlement keys, rounding account.
- Fixed-b categorical LMSR (log-sum-exp), q only changed by paid trades, no naked shorts, funded
  worst-case reserves per market and portfolio-wide, published cancellation vector 1/n.
- Markets: match W/D/L, draw, tournament winner, promotion, qualification, season; bounded
  conditional contracts only with explicit state spaces. Closure before outcome information.
- **Official exchange:** no trading on events the player influences (own games, own events).
- **Sandbox Exchange:** separate sandbox wallet and ledger where players may trade on their own
  games; visually distinct, excluded from official wealth, market records, prestige and achievements.
- Portfolios, watchlists, charts from actual trade history, NPC traders without future access,
  forecast league with proper scoring rules.
- Prizes, sponsors, clubs, academies, analyst teams, hosting; funded transfers only, sinks/upkeep,
  noncash bankruptcy recovery; integrated long-career sensitivity simulation before claiming balance.
  Nothing purchasable affects rated play.

## M5 — Release quality

- Real-device validation on iPhone Safari/PWA (install, airplane mode, suspend/resume clocks,
  memory/thermal) and Windows (launchers, Edge/Chrome, keyboard, screen reader).
- Optional Fairy-Stockfish WASM engine module behind cross-origin isolation with single-thread
  fallback, only if the owner accepts GPL distribution terms (see DECISION_LOG I01).
- Safe migrations with recovery backups, quota handling, corrupted-save recovery, automatic backup
  rotation on Windows, service-worker update staging, accessibility audit (contrast, 200% zoom,
  reduced motion, screen-reader board), licence/source package.
