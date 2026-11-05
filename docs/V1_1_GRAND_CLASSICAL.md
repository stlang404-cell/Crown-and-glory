# v1.1.0 "The Grand Classical Update" — release notes

Code gated at **0d51d11** (clean worktree); later commits change only journeys, docs and evidence.
Chromium (Playwright) on a Linux VM; **not tested on a physical iPhone, in Safari or on Windows.**

## New
* **Long rated games.** Rated human-vs-AI presets: Extended Rapid 30+30 · **Classical 60+60 (default)** · Grand
  Classical 90+60 · Crownmaster 120+90 · Marathon 180+120 · Eternal Crown 240+120 (Fischer increment). No new rated
  game has < 30 min base. Custom 30–240 min / 0–120 s (rated only inside the preset envelope, increment ≥ 30 s;
  otherwise casual). Blitz 3+2, Rapid 5+3, Classical 15+10 remain casual only. The last choice is remembered.
  Applies to Play, Quick Match, Rivals challenges and new Federation fixtures (games created before the update keep
  Rapid 5+3; nothing changes mid-event).
* **Career rating pool.** New "Long Classical" career pool, seeded once from the measured Rapid rating with
  RD = max(RD, 150) and the rated-game count carried (no reset, nothing invented); Rapid history kept as legacy.
  New careers start at 0. docs/CAREER_RATING.md §7.
* **Save & Resume with pause on exit.** Time is charged only while the game is on screen; leaving the board,
  locking the phone, switching apps or closing the app pauses and saves the clock; a 5 s heartbeat bounds any loss
  after a crash; one engine move per position (no duplicates after a reload); a second tab is read-only; app updates
  never activate during a game. docs/SAVE_FORMAT.md (v1.1).
* **Crownmaster Study Match.** Unrated, unlimited time, any opponent; optional hint, best move, evaluation bar,
  move feedback and take-back; explanations only from engine data ("engine estimate, depth N"). Never affects
  ratings, Federation, markets, Vault or Played Like records.
* **AI vs AI Arena** (`#/arena`, Dashboard "Watch AI Match"): custom exhibitions between any two competitors with
  filters, display clocks (incl. the long presets; separate from the AI's per-move budget), Slow/Normal/Fast/Instant,
  pause/restart/skip, optional practice-money market (settles once; void on restart); live official matches with
  their real markets (cutoff, fee, settlement, exposure, payout on one screen); upcoming matches; replays.
  Exhibitions never change official ratings, standings or markets. docs/AI_ARENA.md.

## Release gate (logs: docs/evidence/v1.1-gate/)
TypeScript pass · vitest **871/871** · build + verify-dist (1.1.0 · 0d51d11) · journeys: run, offline, analysis 16,
nav-audit (390 + 375 px), motion-sound 11, motion-extra 9, quick-match 10, vault 15, grimoire, dashboard 11,
practice, academy, replay-center 17/17, market-integrity 10, population 11, legacy 13, new-career 19,
federation-career 12, exhibition 18, ranks 27, finance 9, onboarding 17, **grand-classical 35**, **study 65**,
**ai-arena 17**, a11y strict 12, startup race 10/10, m6-arena 11/11, **v0.4 migration 20/20**, **pages-check**
(Pages subpath; update keeps saves). Five journeys first failed on test drift and were fixed (selectors for the new
time-control groups and career pool; a reused browser profile; two timing races) — re-run on the same build: pass.

## Known limits
* Physical iPhone not tested; whether iOS completes the save started on `pagehide` is unmeasured (the 5 s heartbeat
  bounds the loss).
* Leaving the match screen saves the in-memory game; an external edit to the same record while the board is open
  would be overwritten (only seen in a test harness).
* Sparring stays Rapid 5+3 casual; rematching an old rated Rapid game is casual.
* Deferred: wealth rebalance; L2 recalibration (needs Codex coordination).
