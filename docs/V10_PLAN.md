# v0.10 "The Living Arena" — binding plan and decisions

Source: the owner's v0.10 → v1.0.0 directive ("The Sovereign Legacy"). Baseline: v0.9.0 (gated commit 249f451; `main` =
77282c3, deployed and confirmed working on the owner's iPhone, including scrolling). This file records the decisions
every v0.10 work package must follow. Later milestones (v0.11, v1.0.0) get their own plan files.

## Global rules (all packages)
* Offline-first, free, no accounts, no servers, no paid or cloud APIs, fictional money only (micro-units, 1 unit = $1).
* **Protected invariants:** the iPhone Home Screen app keeps working — page scrolling, safe areas, touch, board input,
  automatic updates (docs/IPHONE_PAGES.md) and IndexedDB saves. No change may regress `e2e/pages-check.mjs`,
  `e2e/nav-audit.mjs` (390 px, no overflow) or `e2e/v5-journey.mjs` (v0.4.0 save migration).
* Saves: additive, versioned, tested migrations only (docs/SAVE_FORMAT.md). Existing competitors keep their IDs,
  names, ratings and histories. **The player's earned rating is never changed.**
* Never fabricate results, benchmarks, screenshots or tests. Mark anything unmeasured as such. No claims of human
  grandmaster/FIDE strength. Fairy-Stockfish is a development reference only and is never bundled.
* Rated play: no engine help, no evaluation bar, no live analysis. The bar is for spectating, replays, analysis and
  unrated/assisted modes only. Markets publish only what docs/ODDS_MODEL.md's information policy allows.
* Do not invent "Circuit Grades": they do not exist in this game (docs/DESIGN_SYSTEM.md). Titles, divisions and
  Glicko-2 are preserved as they are.
* Commits: clear messages, no model identifiers, the session's Co-Authored-By/Claude-Session trailer. Run
  `npx tsc --noEmit -p .` and the relevant vitest files before every commit; the full suite before handing back.
* CPU: the VM has 4 cores shared by several packages. Prefer node-capped searches for measurements (deterministic,
  load-independent); when a measurement must be time-based, record the load average and run old/new interleaved.
  Use at most 2 worker threads for long runs.

## Decision 1 — the rating spectrum (0 to 4,000+)
* The Crown scale stays anchored where it is (L1 = 800, docs/ENGINE_BENCHMARKS.md), so every existing rating keeps
  its meaning.
* **Below 800:** add genuinely weaker engine levels (e.g. shallow search plus a calibrated error model: random
  legal moves with probability p, blunder-prone selection, short horizon). Calibrate them by engine-vs-engine matches
  chained down from L1 (each link ~150–250 points), so that "0–399" players really lose to "400–799" players.
* **Above the measured top (~3,040, L9):** a competitor's rating may exceed what any affordable engine budget has
  been measured to play. Such a competitor's *simulated* results follow its latent strength, but when its moves are
  actually computed (player games, featured and scheduled games) the engine plays at the strongest budget allowed on
  that device. The UI and docs must say this plainly ("plays at the Federation's strongest measured engine,
  ~3,050"). No unsupported precision above the measured range.
* The population must cover the bands 0–399 … 3200–3999 (+ a very small 4,000+ apex) with believable counts, and the
  lower divisions must actually contain beginners. Existing saves migrate additively (e.g. new entrants and an
  expanded lower tier), never by rescaling existing competitors.

## Decision 2 — real-world names (owner request; revised after the owner's explicit instruction)
* **Historical set (merged, package F):** 407 historical figures who died in 1925 or earlier (docs/ROSTER.md).
* **Contemporary set (owner explicitly requested living and recent figures, e.g. Taylor Swift, Beyoncé, Drake,
  Barack Obama, Donald Trump, Albert Einstein, Marie Curie, LeBron James, Serena Williams):** included as clearly
  fictional chess personas in the owner's own free, non-commercial game, with these safeguards:
  * adult, widely known public figures only; no minors, no private individuals; still excluded: people known
    primarily for atrocities or violent crime, and religious figures of worship;
  * names only: no photographs, likenesses, logos or official branding (original heraldic insignias only); no
    invented claims about anyone's life, views or private matters; the descriptor is a neutral profession line;
  * rating, style, region, division and career are assigned by the world seed, independently of the person (a
    famous politician can be rated 300 or 3,500 by chance), and the game says so;
  * the disclosure "fictional chess persona — not the real person, no endorsement" on every persona surface;
  * a Settings switch (default on, as the owner asked) to hide contemporary personas, which reverts their display to
    their stable original fictional name without changing ids or history;
  * stated residual risk: the GitHub Pages site is public; if any person or representative objects, the entry is
    removed from the data file (its competitor keeps its id and history under an original name).

## Decision 3 — evaluation bar and match surfaces
* One `EvalBar` (vertical, White at the bottom when the board is White-up, flips with the board, numeric value, mate
  as "M3"), driven by real engine evaluations, part of the shared `MatchCenter` used by spectating, replay and
  analysis. The bar shows evaluation, never market probability; probabilities are shown separately and labelled.

## Work packages (v0.10)
| Package | Owns (primary files) | Must not change |
|---|---|---|
| A. Rating spectrum & calibrated weak/strong play | `src/engine/levels.ts`, `src/engine/calibration.json`, `src/federation/profiles.ts`, population/latent generation in `src/federation/world.ts`, Play opponent list | search/eval behaviour of existing levels |
| B. Federation at 10,000 | round advance/storage hot paths, `src/federation/*` performance, topology switch, mobile mode, docs/FEDERATION_SCALE.md | competition rules, results (determinism checks) |
| C. Match Center: eval bar, Live Match Center, Replay & Analysis Center | `src/ui/MatchCenter.tsx`, `SpectatorScreen.tsx`, `AnalysisScreen.tsx`, replay library | rated-play fairness |
| D. Personalities: Aggressive + new styles | `src/engine/styles.ts`, `styles-validation.json`, `tools/styles/*` | Universal behaviour (tested identical) |
| E. Exchange depth & integrity | `src/exchange/*`, `ExchangeScreen.tsx`, `FinanceScreen.tsx`, market sims | settlement of existing markets |
| F. Historical roster | `src/federation/roster*`, docs/ROSTER.md, roster browser UI | existing competitors' identities |

Each package works on its own branch/worktree, commits there, and reports: what changed, measurements with method,
tests run, what was not done. The integrator merges, runs every gate on a clean checkout, and fixes conflicts.

## Owner's consolidated requirements (binding additions, v1.0 acceptance)
* Population: 10,000+ persistent competitors with a calibrated pyramid (illustrative target per 10,000: 0–399 500,
  400–799 1,500, 800–1199 2,500, 1200–1599 2,600, 1600–1999 1,700, 2000–2399 800, 2400–2799 280, 2800–3199 90,
  3200+ 30), refined for balance; no rewriting earned ratings to keep quotas; deterministic catch-up; a Federation
  population analytics screen (counts per band, distribution chart, mean/median, player percentile, top competitors,
  strongest per division, rating movement) from saved data.
* Numerical career Elo (the Glicko-2 rating, documented) everywhere a competitor appears, with the change after each
  rated match (previous → new, ±), career graph, peak and history.
* **Played Like Performance Elo (mandatory):** a numerical, calibrated per-game performance rating for both sides
  after every analysed completed game (player games, AI-vs-AI archives, replays, summaries), from move-by-move
  analysis features, calibrated on games of engines with measured strengths across the whole spectrum, validated on
  held-out games, with uncertainty and "insufficient information" for short/uninformative games; persisted;
  deferred analysis on mobile. Never derived from career rating or result.
* One shared Federation: the player enters the same leagues, cups, Swiss events, round robins, invitationals,
  championships and finals as the AI, with schedules, standings, brackets, qualification, promotion/relegation,
  prizes, titles, trophies, banners, rivalries and records; the player's own games are never auto-played.
* "Circuit Grade" is named by the owner again; it does not exist in the codebase. Not invented under that name
  unless a later plan defines it as an explicit, documented mapping (e.g. to the existing division/circuit).
