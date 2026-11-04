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

## Decision 2 — real-world names (owner request, with a documented limit)
* The roster uses **historical figures who died more than 100 years before 2026 (death year ≤ 1925)**, as clearly
  fictional chess personas. This avoids post-mortem publicity rights (up to 100 years in some jurisdictions) and any
  implication that a living person plays, endorses or is depicted by the game.
* **Not used:** living people (e.g. Taylor Swift, Beyoncé, Serena Williams, any current politician) and people who
  died after 1925 (e.g. Albert Einstein, d. 1955, whose name is commercially licensed by his estate; Marie Curie,
  d. 1934). Also excluded: figures known primarily for atrocities, and religious founders or figures of worship.
  The exclusions and reasons are listed in docs/ROSTER.md (with original alternatives where useful).
* No photographs, likenesses or logos: original heraldic portraits/insignias only. Ratings, styles and careers are
  fictional and assigned independently of the person (seeded, not by fame, nationality, politics or any trait).
* A provenance record per identity (name as commonly written, lifespan, category, region, one-line descriptor,
  reference title) lives in the repository; an in-game note says these are fictional personas.
* Existing federations keep their competitors' names (persistent identity). Roster figures enter new federations
  and existing ones only through normal new-entrant flows. The remainder of the population stays original fictional
  names.

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
