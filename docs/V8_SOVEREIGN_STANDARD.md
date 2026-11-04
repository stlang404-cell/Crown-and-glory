# v0.8.0 "The Sovereign Standard" — release report

Every statement below is backed by a file in the repository (journey logs, match JSON, screenshots) or is marked
**PENDING** / **PLANNED**. Nothing here was tested on a physical iPhone or a Windows machine: browser checks ran in
Chromium (Playwright) on Linux at desktop and 390 px phone sizes.

## 1. Status at a glance

| Area | Status | Evidence |
|---|---|---|
| Analysis opens from navigation, picker, Analyse Game, grades, graph, best lines, replay | **Verified** in browser | `e2e/analysis-journey.mjs` 12/12; screenshots `docs/screenshots/v0.8.0/analysis-*` |
| Career Passport opens (fresh, populated, after Analysis, migrated v0.4.0 save) | **Verified** in browser | `e2e/nav-audit.mjs`; `passport-migrated-save.png` |
| Every navigation destination (desktop rail + phone tabs), fresh and populated | **Verified** | `e2e/nav-audit.mjs` |
| Piece sliding, captures, promotion, check warning, replay, live spectating | **Verified** in browser | `e2e/motion-sound.mjs` 10/10, `e2e/motion-extra.mjs` 8/8; `motion-play-and-replay.gif` |
| Procedural sound, settings persistence, mute, reduced motion | **Verified** (sound calls recorded; audible output not checkable headless) | same journeys |
| Rated game hides engine information; markets/settlement; offline; v0.4→v0.8 migration | **Verified** | `run.mjs`, `m6-arena.mjs` 11/11, `offline.mjs`, `v5-journey.mjs` 20/20 |
| Unit tests | **Verified** | 216+ vitest tests |
| Sovereign Unbound thinking times (1/5/10/15/30/60 s) + thinking indicator | Implemented; strength per budget **PENDING** measurement | §4 |
| Engine strength gain over v0.7 | **None validated** so far | §4 |
| Played Like performance rating | Implemented behind a validation gate; calibration **PENDING** | §5 |
| League rebalance, rating classifications, sub-800 competitors | **PLANNED** (v0.9) | docs/FEDERATION_LEAGUE_DESIGN.md |
| Engine optimisation (incremental eval, movegen, bitboards) | **PLANNED** | docs/ENGINE_OPTIMIZATION_PLAN.md |

## 2. Broken pages: root causes and fixes

### Analysis showed a blank page
* **Reproduced** in Chromium on the pre-fix build (commit 87fb2f1): React error #310 after clicking View Analysis.
* **Root cause:** the v0.8 replay-autoplay `useState`/`useEffect` were declared after `AnalysisScreen`'s
  "Loading game…" early return. The render after the game loaded ran more hooks than the first render; React threw,
  and with no error boundary the entire app unmounted.
* **Fix:** hooks moved above the return; `react-hooks/rules-of-hooks` enforced by a unit test (shown to flag the
  original file); `ScreenBoundary` contains any future render error to one screen; Analysis entry in the navigation
  with a game picker, empty state, Analyse Game action, "Game not found" and load-failure states.

### Career Passport "did not appear"
* **Reproduced** on the same pre-fix build: Career rendered normally (1,663 characters fresh, 1,817 after a game)
  until the player opened a game's analysis; the error above then unmounted the whole app **including the navigation
  rail**, so Career (and everything else) showed nothing until reload.
* **Root cause:** the same Analysis hook-order defect; ProfileScreen itself had no fault (lint clean; renders on fresh,
  populated and migrated saves).
* **Fix / evidence:** as above, plus `e2e/nav-audit.mjs` (every destination, fresh and populated, desktop and phone,
  reload) and a migrated-save check: the v0.4.0 career (5 games, 2 rating events, 5 reports) shows rating 1522,
  record 2–0–0 and rating history; its old service worker was replaced and the new "update ready" notice appeared.
* **Stale assets:** a page still running an older build when a new release activates now offers **Reload Now**.

### Other defects found by the audit
See docs/BUG_REGISTER.md (#12–#16): live-board engine replies skipped animation/sound; replay stepping animated the
wrong move; nine federation screens were dead ends before founding.

## 3. Animation and sound
Diff-based slides (Web Animations), capture ghost, promotion glint, check pulse, legal-move markers, selected-piece
lift; Settings → Motion → Piece Movement (Off/Fast/Normal/Slow, default 200 ms); reduced motion turns slides off.
Procedural Web Audio sounds (no files, no network) for move, capture, check, promotion, checkmate, draw, victory,
defeat, tournament and rank; unlocked by the first tap or key; master switch, volume, categories; persisted.
Measured in the browser: 20/20 plies slid and sounded in a live game (including instant engine replies), 0
extra/missing pieces over 504 sampled frames, rapid scrubbing skipped animation and sound and ended on the right
position, stepping back silent, mute silent, reduced motion 0 slides; promotion a5→a6=Q slid, glinted, sounded once
and showed the check warning on f6; 6/6 live Arena moves slid with one sound each.

## 4. Engine (Sovereign)

### Sovereign audit (real UI games)
`e2e/sovereign-probe.mjs` plays the actual UI against The Sovereign and reads each engine move's record:
* Configuration: crown-search-2 + crown-eval-4, partialRoot, 2^20 table, best move only (no randomness, no
  handicap, no style), same build in the worker as in benchmarks; `navigator.hardwareConcurrency` 4.
* 5 s budget: **2.4–4.6 s used per move**, depth 12–13, 230–285 k nodes/s, stop reason "time".
* **Finding:** the search does not start a new iteration after 40 % of the budget (`elapsed × 2.5 > budget`), although
  Sovereign keeps unfinished-iteration results (partialRoot). Candidate `fullBudget` (start until 62.5 %) is under a
  640-game confirmation — **PENDING**.
* Sovereign's strength is limited by the engine itself (≈ −330 Elo vs Fairy-Stockfish at 100 ms in v0.7), not by a
  silent fallback, cap or noise.

### Candidate results (640 games, 4-ply book, 100 ms, vs v0.7 Max)
| Candidate | Screening (128 g) | Confirmation (640 g) | Adopted |
|---|---|---|---|
| nullAdaptive | +38 [−5, 86] | **+4 [−14, 22]** | No |
| singular | +33 [−3, 69] | PENDING | — |
| seeMain | +22 [−16, 60] | PENDING | — |
| fullBudget (200 ms) | — | PENDING | — |
Others screened and dropped: lmr2 +14, rfpDeep +11, ttBucket+qsTT +11, iir +5, eval refit +3, histGravity+counterMove +3,
razoring 0, lmp −66.

### Fairy-Stockfish
Dev-only benchmark binary (GPL-3.0), **never bundled** (owner's decision in v0.7: "keep it unlicensed").
Compatibility (variant `losalamos`): 6×6, `rnqknr/pppppp/6/6/PPPPPP/RNQKNR`, no bishops, no castling, no double step,
no en passant, promotion to Q/R/N; perft(4) = 14,332 matched our rules; every benchmark game is refereed by our own
crown-la6-v1 rules (0 illegal moves recorded). Draw adjudication in matches is ours (bare kings, 50-move and
threefold claims); Fairy's internal draw rules can differ slightly in its search. Bundling it in the PWA would make
the distributed app a GPL combined work (source offer, GPL-compatible licence for the whole app) — a decision for
the owner, not taken here.
Results at 100 / 300 / 1000 ms: **PENDING**.

## 5. Played Like
See §5 of this document once calibration completes — **PENDING**.

## 6. Economy
**PENDING** (sweep paused while engine benchmarks run).

## 7. Federation, ratings and leagues
Audit and v0.9 design: docs/FEDERATION_LEAGUE_DESIGN.md. Key facts: 8 divisions × 16 regional circuits; 4 permanent
titles; 6 rating ranks; **no "16 Circuit Grades" exist**; nobody below rating ~700 and no engine weaker than the 800
L1 level, so the sub-800 range needs new calibrated beginner engines before it can be populated honestly.
