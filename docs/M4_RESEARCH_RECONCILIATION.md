# M4 research reconciliation (v0.3.0 → v0.4.0)

Purpose: reconcile the binding research package (`docs/research/`: README, 01–18, `reviews/`,
`requirements/INTELLIGENCE_EXPANSION.md`) against what v0.3.0 actually contains, requirement by
requirement, and fix the scope and decisions for v0.4.0 (“M4: The Open Market”). Where this document and
`docs/M4_PLAN.md` disagree, this document records the research requirement and the decision; M4_PLAN.md
should be updated to match.

Method. Every research document was read in full. Implementation claims were checked against code, not
only against the v0.3 reports: `src/rules`, `src/engine`, `src/analysis`, `src/academy`, `src/ratings`,
`src/federation`, `src/exchange`, `src/economy`, `src/app/federation.ts`, `src/app/services.ts`,
`src/storage`, `src/ui`, `scripts/vite-plugin-sw.ts`, the test names in `tests/`, and the e2e scripts.
The raw research experiment package (data/, scripts/, prototypes/, not in the repo) was used only to
classify experiments as provisional (section 4). Nothing here is a new measurement.

Status tags in the “v0.3.0” column:
**IMPL** = code found and covered by a named test or journey · **PART** = code found, scope or evidence
incomplete · **MISS** = no code found · **CONF** = implemented differently from the research (see section 3).
“Verify” marks a claim inferred from code reading that should be confirmed by a test before relying on it.

Decision column: **v0.4.0** = implement in this milestone · **M5** = defer, with reason · **Keep** =
current behaviour accepted, conflict resolved as stated · **Gate** = cannot be closed without data or
hardware the project does not have; stays an open, disclosed gate.

---

## 1. Summary of the reconciliation

- Research doc 15 puts **match, draw, tournament, promotion, qualification, season and bounded conditional
  markets, forecasts, portfolio, NPC traders, reserves, ledger, clubs/facilities/sponsors/hosting and
  recovery** in M4, plus an **integrated specialist/hybrid economy sensitivity study**. v0.3.0 already ships
  the ledger, funded W/D/L match markets, NPC traders, paper forecasts, prizes, sponsors, four facilities,
  recovery and prestige. Missing M4 scope: tournament-winner, promotion, qualification, season and
  conditional markets; a canonical payoff registry; live trading; Sandbox Exchange; forecast league/proper
  scoring beyond a Brier average; Research Department and Tournament Hosting institutions; the integrated
  strategy/parameter grid.
- `docs/M4_PLAN.md` omits promotion, qualification, season and conditional markets and the payoff registry
  entirely, and mixes in M5 platform work. Those omissions are a scope reduction the research forbids
  (doc 17: “do not silently shrink … markets”); this document restores them.
- Several M3-scope research items are still open and are pulled into v0.4.0 because the new markets depend
  on them: the Continue-Round preview (market locks, costs), a player qualification path through the
  Federation Open, the rank policy beyond rating bands, and user-requested broadcasts.
- Foundations (rules, engine, analysis, ratings, storage, federation tiers, leakage control, atomic
  commits) are sound and verified to the level their documents claim. Device, human and licensing gates
  remain open and are carried, not closed.

---

## 2. Requirement matrix

### 2.1 Rules (`crown-la6-v1`)

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Exact setup RNQKNR, no bishops, start FEN `rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1` | 04 “Exact state and move rules” | **IMPL** `src/rules/position.ts`; tests/rules.test.ts “parses and round-trips the start FEN”, “rejects bishops, castling rights and en passant” | — | Keep | Existing suite stays green |
| R-02 | One-step pawns, no double step / en passant / castling; mandatory Q/R/N promotion incl. by capture, both colours | 04 | **IMPL** tests/rules.test.ts “pawns never double-step”, “promotion is mandatory…”, “black promotes on rank 1” | — | Keep | Existing suite |
| R-03 | No king capture; pins, check evasion, king adjacency | 04; 16 “Rules and engine” | **IMPL** tests “pinned pieces cannot leave the pin line”, “kings may not move adjacent”, “check must be answered” | — | Keep | Existing suite |
| R-04 | Halfmove/fullmove counters; repetition identity excludes counters | 04 | **IMPL** tests “halfmove clock resets…”, “incremental hash equals recomputed hash” | — | Keep | Existing suite |
| R-05 | Draw by agreement only after each side moved ≥ 10 times | 04 “Crown competition policies” | **IMPL** `src/rules/adjudication.ts`; tests “draw by agreement only after each side moved ten times”, session “draw agreement only after 20 plies” | — | Keep | Existing suite |
| R-06 | Claimable threefold / 100 halfmoves; automatic fivefold / 150; mate on last move takes precedence | 04 | **IMPL** tests “threefold is claimable, fivefold automatic”, “100 halfmoves claimable, 150 automatic”, “checkmate on the 150th halfmove takes precedence” | — | Keep | Existing suite |
| R-07 | Bare kings automatic draw; other material not adjudicated (declared Crown difference) | 04 | **IMPL** test “bare kings is an automatic draw, but K+N vs K continues” | User comprehension untested (18 risk 1) | Gate (human testing) | Playtest note when available |
| R-08 | Crown timeout rule: flag loses if opponent has any non-king piece, else draw; terminal states checked before clocks; only running clock flags | 04 | **IMPL** session tests “flag falls on tick…”, “timeout against a bare king is a draw”, “a move submitted after the flag fell is a timeout” | Simultaneous-flag-at-resume case not named in tests | v0.4.0: add explicit test | New session test |
| R-09 | Independent oracle: 10,000 positions + perft 1–4 vs pinned Fairy | 04 “Canonical fixtures”; 13 final differential | **IMPL (different sample)** 5,000 pyffish 0.0.90 positions / 47,884 successors + native Fairy perft 1–5 (DECISION_LOG I02; tests/rules.oracle.test.ts) | Sample is half the research size but adds depth-5 perft against a second build; acceptable | Keep | — |
| R-10 | Metamorphic colour symmetry | 16 | **IMPL** “mirrored positions have mirrored move counts and perft” | — | Keep | — |
| R-11 | Portable notation, not labelled PGN | 04; INTELLIGENCE_EXPANSION §6 | **IMPL** ccn-1/csan-1, `src/rules/notation.ts`, docs/SAVE_FORMAT.md | — | Keep | — |
| R-12 | Never use a ply cap as a draw rule (a cap is censoring, not a result) | 04; 13 A | **CONF** benchmarks count 300-ply caps separately (ENGINE_BENCHMARKS), but `playSelfplay` (`src/engine/selfplay.ts`) returns `1/2-1/2` with termination `playing-limit` at `maxPlies` (400 for featured games), so a capped featured game counts as a draw in standings and its market settles on Draw. Rare (the automatic 150-halfmove rule usually ends first) but possible | Cap must not settle a market or a standing as a draw | v0.4.0: capped featured game → market cancelled at 1/n and the fixture resolved by the summary model (labelled), never as a game draw | Unit test with a small maxPlies: market cancelled, fixture labelled |

### 2.2 Engine

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | Evaluate pinned, licence-compliant Fairy-Stockfish WASM first; custom fallback if infeasible | 05 “Options”; 17; 18 D04 | **CONF** custom TS engine shipped; Fairy WASM rejected (pthreads/COOP-COEP, no single-thread fallback, GPL combined work) — DECISION_LOG I01 | Licensing choice belongs to owner | Keep (section 3.1) | — |
| E-02 | Iterative deepening PVS, aspiration, TT with bounds, quiescence with check evasions, mate-ply normalisation, repetition-aware search | 05 “Search design” | **IMPL** `src/engine/search.ts`; tests “mate scores survive TT storage”, “treats repetition as a draw inside search” | — | Keep | — |
| E-03 | Pruning features only with evidence | 05; I03 | **IMPL** ablations, held-out replication (ENGINE_BENCHMARKS, M2_ENGINE_STRENGTH) | Null move/aspiration neutral but retained (disclosed) | Keep | — |
| E-04 | Legal PV and fallback move under limits/cancellation | 16 | **IMPL** “obeys node and time limits and always returns a legal move”, “every best move and PV is legal across 300 oracle positions” | — | Keep | — |
| E-05 | Strength protocol: pinned openings, colour-swapped pairs, bootstrap by pair, no FIDE claim | 05 “Strength testing protocol” | **IMPL** tools/bench, ENGINE_BENCHMARKS | Gap to Fairy ≈ 10× per node | M5 (strength work is not M4 scope) | — |
| E-06 | Difficulty from resource profiles calibrated against an anchor ladder; no difficulty labels as ratings | 05 “Difficulty”; 06 | **IMPL** crown-levels-2, 500 calibration games, `src/engine/calibration.json` | Anchor L1 = 800 arbitrary; no human data | Gate (human data) | — |
| E-07 | Worker isolation; cancellation via terminate-and-recreate; stale replies discarded | 12 “Review resolutions”; reviews/architecture #1 | **IMPL** `src/engine/client.ts` (terminate + generation counter) | No measured 250 ms cancellation budget on devices | M5 (device budgets) | Device timing record |
| E-08 | One prioritised engine queue (foreground > replay > report > batch) | 12 “Modules” | **PART** four separate worker channels (`play`, `analysis`, `assist`, `spectator` in `src/app/services.ts`); analysis is cancelled during matches; featured games can run concurrently with analysis | Concurrent workers on phones untested; featured-game generation in v0.4.0 live trading adds load | v0.4.0: pause/serialise spectator generation while a player match is active; M5: memory/thermal | Unit test of scheduling rule; M5 device test |
| E-09 | Device budgets (32 MiB TT mobile, < 50 ms main-thread tasks, 60 fps) measured on Windows/iPhone | 05 “Local performance budgets”; 12 “Budgets” | **MISS** Node and headless Chromium only (ENGINE_BENCHMARKS “Browser speed”) | No device | M5 / Gate | Real-device log |

### 2.3 Analysis, intelligence and Academy

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | Typed cp/mate/terminal scores with perspective, requested vs achieved depth | 07 “Score semantics”; IE §2 | **IMPL** `src/analysis/types.ts`, analyzer; tests/analysis.test.ts mate handling | — | Keep | — |
| A-02 | Root-constrained comparable searches for best vs played | 07 | **IMPL** policy std-d7 (I09) | — | Keep | — |
| A-03 | Calibrated expected-outcome map replacing s = 200 placeholder | 07 “Accuracy v0”; 17 M2 | **IMPL** crown-outcome-map-v1 isotonic, leave-one-family-out (M2_ANALYSIS_CALIBRATION) | Engine-vs-engine data only | Gate (human games) | — |
| A-04 | Fixed grade bins, Great/Brilliant eligibility, forced-move exclusion, uncertainty labels | 07 “Classification v0” | **IMPL** grades corpus (26 fixtures) + boundary tests; bins/k = 4 still experimental and labelled | No clean second Brilliant fixture; bins/k not fitted | Gate (no human labels) | — |
| A-05 | Accuracy 100·exp(−k·mean L), null for empty, forced moves excluded, partial coverage | 07; IE §3 | **IMPL** `src/analysis/methodology.ts`; tests/analysis.test.ts | — | Keep | — |
| A-06 | Monotone phase rules from pre-move state | 07 “Phases”; reviews/chess #6 | **IMPL** crown-phase-1 (M2_INTELLIGENCE_METHODOLOGY) | — | Keep | — |
| A-07 | Immutable report versions; full-history cache keys | 07 “Persistence”; IE §10 | **IMPL** report id includes checksum/engine/settings/grading (SAVE_FORMAT) | — | Keep | — |
| A-08 | Postgame: interactive ply 0..n, variations, retry from pre-move state (unrated) | 11 “Postgame”; IE §7 | **IMPL** e2e/run.mjs; I12 setupMoves | — | Keep | — |
| A-09 | Ten-dimension lab with denominators, intervals, insufficient-evidence; descriptive language | 06 “Chess intelligence laboratory”; reviews/learning | **IMPL** crown-lab-1, tests/history100.test.ts | No human cohort, no IRT | Gate | — |
| A-10 | Improvement claims only by planned non-overlapping windows with Holm/alpha spending | 06 “Review resolutions” | **PART** last-10 vs earlier with bootstrap; “single planned comparison is not called validated” | No predeclared confirmatory plan / Holm correction stored | M5 (needs longitudinal data to matter; no badge is issued today, so no false claim) | — |
| A-11 | Held-out item families never served in practice; exposure counted | 06 “Items”; IE §5 | **IMPL** 87 held-out / 397 training, leakage test (tests/academy.test.ts) | Held-out bank ≈ 8 assessments | M5 (content) | — |
| A-12 | Coach: patterns ≥ 5 opportunities over ≥ 3 games, evidence links, observational effectiveness | 07 “Full report and coach” | **IMPL** `src/academy/coach.ts`, lab.ts | Template/motif only | Keep | — |
| A-13 | Assisted games unrated; assistance locked in rated games | 07; 06 | **IMPL** session tests; e2e Gate G | — | Keep | — |
| A-14 | Academy-only endgame: verified unseen-item mastery certificates, separate from money | 10 last paragraph; reviews/game_design #8 | **MISS** no certificates/portfolio | Specialist path lacks a long-term goal | M5 (content/UX; not money-related, but must not be bought with money — already true) | — |

### 2.4 Ratings and ranks

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| RT-01 | Glicko-2 with 1500/350/0.06/τ 0.5, ε 1e-7, RD cap 350, reference example | 06 “Rating model” | **IMPL** `src/ratings/glicko2.ts` DEFAULTS; tests/ratings.test.ts | — | Keep | — |
| RT-02 | Separate pools per time control; one period per round/quick match | 06 | **IMPL** I06 | — | Keep | — |
| RT-03 | Provisional until ≥ 20 games AND RD ≤ 100 | 06 | **IMPL** `isProvisional = games < 20 \|\| rd > 100` (`src/ratings/glicko2.ts`) | No named test | v0.4.0: add a boundary test | Unit test |
| RT-04 | Immutable, replayable, explained rating events; idempotent | 06; IE §4 | **IMPL** `rating:<gameId>:<pool>` keys; import replays ledger | — | Keep | — |
| RT-05 | Fixed-version anchors outside drifting population | 06 | **IMPL** I05 (AI opponents fixed) | Federation competitors drift by design; no anchor check of the federation scale | v0.4.0: report federation mean/strength drift in the soak test (already in tools/sim/federation.ts) | 20-season soak output |
| RT-06 | Rank hierarchy Provisional…Crown Champion combining rating eligibility with qualifier achievements; dated rank events with policy | 08 “Rank and prestige”; 06 | **PART** crown-rank-0 is rating bands only (`RANKS` in `src/ratings/ledger.ts`); titles separate | Qualification component missing; “Crown Champion” rank not reachable | v0.4.0: crown-rank-1 as a new policy version (old events keep crown-rank-0) | Rank event tests incl. policy id |
| RT-07 | Dynamic-population rating study (entrants, retirements, selection) | 06; 14; 18 risk 8 | **PART** 40-season headless run (V3_FEDERATION §7): mean rating stable, r ≥ 0.982 | Single seed; player not included | v0.4.0: multi-seed (≥ 5) soak | docs/sim output with seeds |

### 2.5 Federation and competitors

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 2,048 persistent identities, 16 regions × 8 divisions × 16, deterministic seed | 08 “Identity”, “Complete topology” | **IMPL** `src/federation/generator.ts`; tests/federation.test.ts | — | Keep | — |
| F-02 | Hidden latent strength separate from public rating; never used by forecasts/markets | 08; 09 “Information” | **IMPL** I17; leakage test in tests/federationService.test.ts | New market families need the same guarantee | v0.4.0: extend leakage tests to every new forecast model | Leakage tests per family |
| F-03 | Careers: bounded drift, retirements, calibrated entrants, records kept | 08 | **IMPL** V3_FEDERATION §1 | — | Keep | — |
| F-04 | Tier 1/2/3 with honest summary-only labels, no fabricated replays | 08 “Simulation tiers” | **IMPL** I16; Spectator/Competitor screens label “summary result” | — | Keep | — |
| F-05 | User can promote a match to replayable before it starts; preannounced marquee selection | 08 “Simulation tiers”; reviews/game_design #7 | **PART** system picks ≤ 3 featured per round (`chooseFeatured`); user cannot request one | No user request path | v0.4.0: a watchlist competitor's next non-player fixture may take a featured slot when the round opens (still ≤ cap, chosen before any move) | Unit test: selection happens at round open; leakage test |
| F-06 | Explicit Continue Round with preview of own matches, deadlines, market locks, facility costs; block while player match active; explicit withdraw | 08 “Complete topology and world-advance contract”; reviews/game_design #1 | **PART** Advance disabled while player fixtures pending, explicit Forfeit with confirm (WorldScreen.tsx); no preview of market closures/upkeep/prizes | Preview missing; becomes essential once multi-round markets close at advance | v0.4.0: Advance preview listing fixtures, markets that will close/settle, upkeep, prize payouts | e2e step: preview text matches committed effects |
| F-07 | Continue Season repeats previews and stops at every decision | 08 | **MISS** only single-round advance | Not needed if only per-round advance exists | Keep (no season skip offered; nothing can be silently forfeited) | — |
| F-08 | Tick ordering lock markets → resolve → ratings → standings → settle → economy → commit; publish marker | 08; 12 “Review resolutions” | **IMPL** one IndexedDB transaction per advance guarded by (season, round) cursor (`commit` in src/app/federation.ts) | — | Keep | — |
| F-09 | Promotion/relegation top/bottom 2 between adjacent divisions of a region | 08 | **IMPL** V3_COMPETITION_RULES; tests | — | Keep | — |
| F-10 | Rivalries from repeated consequential games; news only from recorded facts | 08 “Rank and prestige”; 03 | **PART** competitor rivalries list (CompetitorScreen.tsx); ProfileScreen still says “Rivalries (M3) will be derived…” (stale placeholder) | No player rivalry view, no news feed | v0.4.0: player rivalry list from stored results; remove stale text. News feed: M5 | UI test at phone width |
| F-11 | Hall of Fame / championship history; relegation never erases titles | 08; 03 “First hundred hours” | **PART** titles kept on player and competitors | No history page | M5 (presentation) | — |
| F-12 | Federation page performance at 2,048 profiles; bounded storage growth | M4_PLAN §3; 12 budgets | **PART** 0.3–0.51 s per season headless | Storage growth not measured | v0.4.0: 20-season soak with storage size (< 25 MB target from M4_PLAN) | docs/sim output |

### 2.6 Tournaments and integrity

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Round robin by circle method, colour balance, one game per round | 08 “Time and scheduling” | **IMPL** tests “round robin: every pair meets exactly once…” | Home/away reversal next season not verified | Keep | — |
| T-02 | Division tiebreak: points → H2H → SB → two-game playoff → pre-season seed | 08 “Complete topology” | **CONF** points → H2H → SB → pre-season seed; **no playoff** (`src/federation/formats.ts`) | Playoff omitted | Keep (section 3.5) | — |
| T-03 | Swiss with repeat avoidance, colour balance, documented relaxation; not called FIDE | 08 | **IMPL** crown-swiss-1 with backtracking; rematches recorded | — | Keep | — |
| T-04 | World championship: 16 qualifiers, four groups of 4 RR, top 2 to 8-player bracket | 08 “Format choices” | **CONF** straight 16-player two-game knockout (V3_COMPETITION_RULES) | Group stage absent | Keep (section 3.5) | — |
| T-05 | Qualification: 8 via regional-champions qualifier (16 top-division winners, two groups of 8), 8 via a federation-wide open Swiss | 08 “Complete topology” | **CONF** best 8 of 16 division-1 winners by points then rating + top 8 of Federation Open (divisions 2–4 only) (`buildChampionship`, `createSeasonPlan` in world.ts) | Confirmed in code: the Swiss fields are built from `competitors.filter(c => c.status === 'active')` and the player is not a competitor record, so the player can never enter the Federation Open; the only route to the Championship is a division-1 title in the top 8 of 16 winners | v0.4.0: include the player in the Federation Open field by the same rating rule when in divisions 2–4; keep the rest (section 3.5) | Unit test: player in division 2–4 with qualifying rating is seeded into the Open |
| T-06 | Bracket tiebreak: rapid pair → blitz pair → higher seed; final tie → joint champions; no coin flips | 08 | **IMPL** `koNext` in formats.ts; test “knockout matches always terminate” | Seeds by rating rather than qualifier points (research: prior qualifier points → rating → draw order) | Keep, documented | — |
| T-07 | Titles never bought; prestige from results | 08; 10 | **IMPL** titles only from results; separate ladders | — | Keep | — |
| T-08 | First tournament: 4-player round robin, free entry, modest funded prizes | 03 “First hour” | **MISS** first event is the 16-player league | Onboarding only | M5 (onboarding) | — |
| T-09 | No trading on events the player or an owned institution can influence; entering blocks new trades | 09 “Information, timing and integrity”; 10 | **IMPL for W/D/L** `trade` rejects markets with the player; featured selection excludes player games | Tournament/promotion/qualification markets must also be blocked when the player is entered, qualified or in the same division; Club Weekend is player-hosted | v0.4.0: conflict check by event membership (player entrant, player's division, player-hosted event) at list time and at every trade | Property test: no listed/tradable market on an event containing the player or a player-owned event |
| T-10 | Close before information; no order after terminal information | 09; 16 | **IMPL** featured market closed and committed before first move (I18) | Multi-round markets need per-round closure rules | v0.4.0: tournament markets halt during each round and settle only from committed results | Leakage test per family |
| T-11 | Withdrawal/forfeit recorded, unrated, no invented moves | 08 | **IMPL** `forfeit` in FederationService | — | Keep | — |

### 2.7 AI styles

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | Styles must be demonstrated by equal-strength behaviour tests before naming | 08 “Identity and strength”; 14; reviews/game_design #4 | **IMPL** validation harness; failing styles play Universal and are labelled (V3_STYLES) | — | Keep | — |
| S-02 | Six listed styles (tactical, positional, defensive, pawn-racer, time-pressure, repertoire) | 08 | **PART** 2 of 5 validated (Tactical, Positional; opening-only, first 6 plies); Aggressive/Defensive/Endgame failed | Middlegame character absent; time-pressure style meaningless with node-limited featured games | v0.4.0 only if time allows (M4_PLAN §2); otherwise M5 — not M4-critical | Each new style passes Δ ≥ 10 pp and parity at two budgets |
| S-03 | Parity sample large enough | V3_STYLES limits | **PART** 48 games, lower bound −89 Elo | — | M5 (128 pairs) | — |
| S-04 | Rival adaptation only from observed games, never hidden omniscience | 03; 05 | **IMPL (trivially)** no adaptation exists | Adaptation not built | M5 | — |

### 2.8 Spectator

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| SP-01 | Live legal board, pause/speed/navigation, replay, result hidden to end | 11 “Match viewer”; 08 | **IMPL** SpectatorScreen.tsx; e2e steps 8/12 | — | Keep | — |
| SP-02 | Public clocks | 11 | **CONF** per-side engine thinking time instead of a game clock (I26) | Node-limited games have no real clock | Keep | — |
| SP-03 | Commentary templates from verified evidence | 11 | **MISS** only the engine eval line | — | M5 | — |
| SP-04 | Abstract matches labelled summary-only | 08; 11 | **IMPL** “SUMMARY RESULT” status | — | Keep | — |
| SP-05 | Live trading view tied to the spectator | 09 “Information, timing” | **MISS** | See M-LIVE | v0.4.0 (with M-LIVE) | — |

### 2.9 Markets

#### Match markets (W/D/L)

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-MATCH-01 | Categorical LMSR, fixed b, log-sum-exp, uniform q0 | 09 “Cost and prices” | **IMPL** `src/exchange/lmsr.ts`, b = 120, q0 = 0; tests “prices are a probability vector…”, “log-sum-exp is stable” | — | Keep | — |
| M-MATCH-02 | Worst-case subsidy b·ln n funded per market before open; no shared reserve double spend | 09 “Money, fees and reserves” | **IMPL** `openMarket` journal treasury → `market:<id>:subsidy`; treasury guard in `openRoundWithMarkets` | Portfolio-wide proof only trivially true (each market has its own account) | Keep; extend to new families | Property test across concurrent families |
| M-MATCH-03 | q changes only through paid trades; no external recentre | 09; 13 F adversarial | **IMPL** market.ts contract; test “buy then sell at unchanged inventory loses exactly fees plus rounding” | Explicit regression for the recentre exploit not named | v0.4.0: add a named regression that no API mutates q/b of an open market | Test |
| M-MATCH-04 | Long-only retail, no naked shorts | 09 | **IMPL** test “no short selling, no unfunded purchases” | — | Keep | — |
| M-MATCH-05 | Integer microcrowns, directed rounding (buy up, sell down), fixed-point/decimal quotes | 09 “Money, fees and reserves” | **CONF** integer ledger and directed rounding implemented; quotes computed in float64 with a 1e-6 µ guard, not decimal | See section 3.3 | v0.4.0: keep float quotes, add a 40-digit reference comparison test (BigInt/decimal) for rounding direction at extreme q and n ≤ 32 | Property test vs reference |
| M-MATCH-06 | 1 % fee on buy and sell, rounded up, separate fee account | 09 “Fees, payoff identities” | **IMPL** `FEE_BPS = 100`, `fees` account, recycled to treasury at season end | — | Keep | — |
| M-MATCH-07 | Quote preview: execution cost, fee, shares, max loss, payout, cancellation terms | 09; 11 “Exchange” | **PART** ExchangeScreen shows cost, fee, max payout, max loss | Cancellation terms not shown in preview | v0.4.0: show the 1/n cancellation vector in every preview | UI test |
| M-MATCH-08 | Stale quote rejected or max-spend re-confirmed; order keyed by quote revision | 12 “Order/Trade”; 16 | **MISS** `trade()` executes at current q without a quote revision; trade id uses `Math.random()` seq | Not exploitable today (NPCs trade only at open, single writer) but becomes real with live trading | v0.4.0: quote revision = market history length; order carries max total; reject mismatch; deterministic command id | Unit test: stale quote rejected; double-submit posts once |
| M-MATCH-09 | States draft → funded → open → halted/closed → resolved → settled | 09 | **PART** open → closed → settled/cancelled | `halted` needed for live and multi-round markets | v0.4.0: add `halted` (reversible, no trading) | Lifecycle tests |
| M-MATCH-10 | Idempotent settlement with unique key; winner paid from collateral + subsidy | 09; 16 | **IMPL** `settle:<market>`; test “settlement is idempotent…”, solvency assert | — | Keep | — |
| M-MATCH-11 | Fixed cancellation vector 1/n, fees kept, no retroactive reversal | 09 “Cancellation policy”; reviews/markets #1 | **IMPL** `cancelMarket`; test “cancellation pays 1/3 per share and keeps fees” | `FederationService.cancel` is never called from any code path (grep) — no automatic cancellation trigger exists | v0.4.0: wire cancellation to the defined triggers (unplayable fixture, ply cap, sandbox early resignation) | Integration test per trigger |
| M-MATCH-12 | Random-order solvency/conservation stress | 09 funded_ledger; 16 | **IMPL** 30 runs × 150 trades (4,500) in tests/exchange.test.ts | Smaller than research's 25,000-order reference | v0.4.0: raise to ≥ 25,000 orders across families in a slow test tier | Test run log |

#### Tournament-winner markets

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-TOUR-01 | One categorical ledger per tournament winner; exhaustive outcomes | 09 “Cost and prices”; 15 M4 | **MISS** (I27; M4_PLAN §2b) | Entire family | v0.4.0: Federation Open, Challenger Open, Crown Championship winner markets | Solvency/property tests n ≤ 32 |
| M-TOUR-02 | Joint champions handled by a payoff vector published at creation | 09 “Cancellation” (simplex payout argument); 08 joint final | **MISS** | Payout 1/2 to each joint champion lies in the simplex, so the b·ln n bound still covers it | v0.4.0: declare `joint → 1/k each` in contract terms and preview | Test: joint settlement solvent and conserved |
| M-TOUR-03 | Initial prices: uniform q0 by default; non-uniform q0 only with reserve b·ln(1/min p0) and tests | 09 “Cost and prices”; reviews/markets #2 | **MISS** | With 16–32 entrants uniform 1/n prices are far from the public model; see section 3.4 | v0.4.0: non-uniform q0 from the public-rating bracket model with p0 floor and the larger reserve; store q0 and holdings h separately, pay h_w never q_w | Tests: Σ holdings = h, liability = h_w, reserve ≥ b·ln(1/min p0) |
| M-TOUR-04 | Trading only while no relevant result exists; halt during rounds | 09; M4_PLAN §2b | **MISS** | — | v0.4.0: open at field publication, halt from round start to round commit, may reopen between rounds only for Swiss/KO with all results committed; close before final round | Leakage test: no trade accepted with an uncommitted round |
| M-TOUR-05 | Conflict: player-entered events not listed | 09; T-09 | **MISS** | Challenger Open (player may register) and Championship (player may qualify) | v0.4.0: not listed, or halted permanently with no new trades once the player enters/qualifies (prepublished rule) | Test |

#### Promotion, qualification and season markets

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-PROMO-01 | Promotion markets per canonical event cluster; no overlapping deterministic claims | 09 “Bounded conditional mechanism” last paragraph; 15 M4 | **MISS**; omitted from M4_PLAN | Entire family | v0.4.0: per listed division one family only — either the division-title categorical (16 outcomes) or one binary “X promoted” market, enforced by the payoff registry (M-REG) | Registry test rejects a second overlapping family |
| M-QUAL-01 | Qualification markets (Championship qualification) | 15 M4; 17 M4 | **MISS**; omitted from M4_PLAN | Overlaps the Championship winner market and Federation Open winner | v0.4.0: binary “X qualifies” on at most a few listed competitors, closed when the bracket is drawn (before the Championship winner market opens) | Registry + timing tests |
| M-SEASON-01 | Season markets | 15 M4; 17 M4 | **MISS**; omitted from M4_PLAN | Must not duplicate the Championship winner claim concurrently | v0.4.0: “Region of the Crown Champion” (16 outcomes, joint → 1/2 per region) opened at season start, closed when the bracket is drawn | Registry + timing tests |
| M-REG-01 | Canonical event/payoff registry; aliases share one book; overlapping families not concurrently listed | 09 “Fees, payoff identities”; reviews/markets #3 | **MISS** (only one family exists today) | Required before M-TOUR/PROMO/QUAL/SEASON/COND | v0.4.0: implement first | Unit tests over all family pairs |

#### Conditional markets

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-COND-01 | Bounded state-space LMSR; reference = 4-player knockout, 8 states, claims as subsets, conjunction semantics with explicit condition-false payout | 09 “Bounded conditional mechanism”; 12 last paragraph | **MISS**; M4_PLAN has no conditional markets | Entire family | v0.4.0: Crown Championship final four (after quarterfinals), see section 3.4 for the joint-champion state change (12 states) | Tests: claim = payoff vector over canonical states; equivalent subsets share one id; reserve = max_s liability |
| M-COND-02 | Indicative P(B\|A) displayed separately from the joint-claim price | 09 | **MISS** | — | v0.4.0 | UI test |
| M-COND-03 | Cancellation: average payout of the claim over states (\|S\|/N) | 09 | **MISS** | — | v0.4.0 | Settlement test |
| M-COND-04 | Larger combinatorial families only with explicit bounds | 09; 02 combinatorial | **IMPL (by absence)** | — | Keep: no general combinatorial markets | — |

#### Live trading

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-LIVE-01 | At a live move: advance full state, publish board/clock, then reopen; halt during adjudication/terminal info | 09 “Information, timing and integrity” | **MISS** (I27) | Featured games are generated as one worker run; a legitimate design needs generation paused at each window | v0.4.0: windows at fixed ply checkpoints in watched-live featured games only; the next segment is generated after the window closes and is committed; quote revision required (M-MATCH-08) | Leakage test: no move beyond the published ply exists while open; crash replays the same game (seeded) |
| M-LIVE-02 | Engine WDL/live evals are features, not stamped prices | 09 | **IMPL** pre-match (model ≠ price shown side by side) | Must hold in live windows | v0.4.0: same separation | UI test |
| M-LIVE-03 | NPC traders receive only public/noisy information in live windows | 09 | **MISS** | NPC may only see the public board and published eval line | v0.4.0 | Leakage test |

#### NPC traders

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-NPC-01 | Funded wallets, public/noisy signals, explicit order sizes and risk limits, no unlimited smart money | 09 “Forecast and trader analytics” | **IMPL** `src/exchange/npc.ts` (5 traders, wallets cap 4,000 ₵ from treasury) | — | Keep | — |
| M-NPC-02 | Trader types: noisy novice, conservative analyst, overconfident fan, calibrated fundamental, limited-budget value seeker | 09 | **PART** novice, conservative fund, fan, contrarian, analyst; no value seeker | Minor | Keep (document mapping) | — |
| M-NPC-03 | Multi-outcome and binary markets | — (needed by M-TOUR etc.) | **MISS** `npcRound` hard-codes three outcomes (`[f.w, f.d, f.l]`) | Generalise to n outcomes and state claims | v0.4.0 | NPC tests per family |
| M-NPC-04 | Test zero-information and correlated-signal populations | 09 | **MISS** | — | v0.4.0 (simulation tool) | docs/sim output |
| M-NPC-05 | NPCs trade more than once (between rounds/live windows) | implied by multi-round markets | **MISS** NPCs trade once at open | — | v0.4.0: NPC passes at each reopen | Test |

#### Forecasting and proper scoring

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-FC-01 | Paper forecasts without bankroll, indefinitely | 09; 03 | **IMPL** `forecast()` (one per market, open markets only) | Only on listed featured markets | v0.4.0: forecast-only events for every family and for unlisted events (“nonfinancial forecasts can cover every event”) | Test |
| M-FC-02 | Brier and log loss, calibration bins with n and intervals, baseline comparison | 09 “Forecast and trader analytics” | **PART** Brier average vs the model on the same markets (ExchangeScreen.tsx) | Log loss, calibration bins, intervals missing | v0.4.0 (Analyst Office calibration chart per M4_PLAN §4 + log loss) | Unit tests of scoring functions |
| M-FC-03 | Forecast skill separate from trading P&L and chess strength; verified forecast prestige | 03 “Unified resources”; 08 “Rank and prestige” | **PART** financial prestige uses net worth and realised trading, not forecast skill (`prestige()` in economy.ts) | No forecast prestige | v0.4.0: forecast ladder from proper scores (min-n gated), separate from financial | Unit test |
| M-FC-04 | Proper-score forecast league with capped, separately funded prizes | 09 “Five mechanisms” | **MISS** | — | v0.4.0: season forecast league, prize pool from season issuance (explicit, capped), min forecasts to qualify | Ledger + scoring tests |
| M-FC-05 | Forecast model W/D/L temporal-block validation | 09 | **PART** Davidson ν = 0.9 fitted on 1,779 engine games (V3_FEDERATION §2) | No temporal hold-out; tournament model is new | v0.4.0: hold-out check of the bracket simulator on recorded seasons | Calibration report |

#### Sandbox own-game markets

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| M-SB-01 | Research forbids trading one's own games; directive allows a separated sandbox | 09; DECISION_LOG I15/I23 | **PART** ledger rejects mixed sandbox/official journals (test “sandbox and official money never mix”); no sandbox markets | Entire feature | v0.4.0 (M4_PLAN §1) | — |
| M-SB-02 | Cannot profit by losing | M4_PLAN §1 | **MISS** | “Back yourself only” prevents throwing for profit | v0.4.0 | Property test over random games |
| M-SB-03 | Opening prices vs the chosen engine level | section 3.4 | **MISS** | With uniform 1/3 prices, backing yourself against L1 is near-certain profit in the sandbox | v0.4.0: open at the level-calibrated W/D/L prior (non-uniform q0 + larger reserve), or uniform with that known flaw disclosed; decision: prior | Test: expected sandbox value ≈ −fees when prior is calibrated |
| M-SB-04 | Assisted games excluded; early resignation cancels at 1/n | M4_PLAN §1 | **MISS** | — | v0.4.0 | Tests |
| M-SB-05 | Excluded from net worth, prestige, achievements | M4_PLAN §1 | **MISS** | — | v0.4.0 | Test: official accounts unchanged after a sandbox journey |

### 2.10 Economy

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| EC-01 | Unified double-entry ledger; issuance only via explicit mint; sinks explicit | 10 “Design principles” | **IMPL** `src/exchange/ledger.ts`, `src/economy/economy.ts`; test asserting only `mint:*` creates money | — | Keep | — |
| EC-02 | Prizes escrowed before registration; transfers not minted per win | 10 “Flows” | **IMPL** `seasonStartJournals` escrow; `payPool` | Remainders to treasury | Keep | — |
| EC-03 | Season issuance explicit, bounded, logged; monitor before expansion | 10 | **IMPL** 104,100 ₵/season + capped treasury replenishment (V3_ECONOMY §1) | New forecast-league and tournament subsidies add issuance | v0.4.0: re-measure supply growth (< 2 %/season after season 5, M4_PLAN §5) | docs/sim output |
| EC-04 | Sponsors pay earned milestones from season budgets, not infinite achievements | 10 | **IMPL** `SPONSOR_MILESTONES`, once per season per milestone | Repeats every season (bounded by budget) | Keep | — |
| EC-05 | Funded sponsor contracts | 10 “Starter Club” | **PART** single season budget, no contracts | — | M5 | — |
| EC-06 | Starter Club 500 ₵ (300 bond + 200 setup), upkeep 40, hosting 20, prize escrow 40, attendance 5/member, sponsor ≤ 30 for completed nonconflicted event | 10 “Fully costed first institution” | **IMPL** same constants (`ASSETS`, `setupClubWeekend`) | Attendance only from 3 guests (research: 0–16 members); owner plays and can win the escrowed prize (research: own funded prizes cannot farm net money — upkeep keeps net negative) | Keep constants; v0.4.0: document the owner-prize case and assert “club cannot be net positive with upkeep” in the strategy grid | Sim assertion |
| EC-07 | Capacity 16 members; one club = sole initial management slot | 10 | **MISS** capacity/membership; all assets can be owned at once | — | v0.4.0: management slot for club/hosting institutions only; facilities unaffected | Unit test |
| EC-08 | Training facility, analyst desk, scouting with disclosed effects | 10 | **IMPL** Training Hall, Analyst Office, Scouting Department (I25; e2e) | — | Keep | — |
| EC-09 | Research department (exploration workflows under same engine limits) | 10 | **MISS** | — | v0.4.0: small institution — saved analysis-board study positions with engine at the normal free limits (convenience only) | Test: no deeper engine than free analysis |
| EC-10 | Tournament hosting: escrowed budget, chosen format/schedule, prestige from completed fair events | 10 | **PART** fixed Club Weekend only | No format/budget choice | v0.4.0: hosting choice (4- or 8-player, knockout or round robin) inside the club slot, escrow before the event | Ledger tests; conflict rule (no markets) |
| EC-11 | No passive-income runaway; returns from actual attendance/sponsorship | 10 | **IMPL** club is a prestige purchase (V3_ECONOMY §4) | — | Keep | — |
| EC-12 | Recovery: no debt; free event path; nontransferable vouchers once per season under explicit budget; cannot buy shares | 10 “Recovery” | **IMPL** voucher (< 100 ₵, once per season, Challenger entry, treasury → sink); unpaid upkeep suspends (I24) | Voucher budget not explicitly capped per season (one player only, so bounded) | Keep | — |
| EC-13 | Net worth with executable liquidation value; realised vs unrealised P&L, fees | 09; 11 “Portfolio” | **IMPL** `finance()`, `liquidationValue`, FinanceScreen | Marked value shown? (`markValue` exists) | Keep | — |
| EC-14 | Exposure limits and capped-size tutorial trade; exchange can be hidden | 03 “First hour”, “Behavioral rationale”; 11 IA | **MISS** no exposure cap; Exchange is a fixed phone tab (`TABS` in App.tsx) | — | v0.4.0: settings toggle hides Exchange/Finance; per-market and per-season player spend caps; first-trade tutorial quote | UI + unit tests |
| EC-15 | Integrated strategy grid: chess-only, puzzle-only, conservative, aggressive, hybrid, institutional, struggling, expert; wealth quantiles/Gini, issuance/sinks, bankruptcies, recovery time, reserve insolvency, parameter grids | 10 “Experiments and corrections”, “Anti-dominance”; 16 | **PART** 7 strategies × 6 seasons × 1 seed, results sampled (V3_ECONOMY; tools/sim/economy.ts) | No seeds sweep, no parameter grid, no puzzle-only/expert cohorts, no recovery time | v0.4.0: ≥ 5 seeds × 20 seasons × 8 cohorts × 3 parameter settings including new markets | docs/sim report with quantiles |
| EC-16 | Two prestige ladders, money never buys chess prestige | 03; 10 | **IMPL** `prestige()` | Add forecast ladder (M-FC-03) | v0.4.0 | — |
| EC-17 | Competitor wealth bounded | (implementation finding) | **IMPL** 75 % season expenses to sink (I20) — not in research | Accepted invention | Keep | — |

### 2.11 UI and visual design

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | Tokens #10151E/#1B2431/#F1EBDD/#B3BFCD/#D8B56C/#83D6B0/#ED9B9B, measured contrast | 11 “Tokens” | **IMPL** styles.css `:root`; docs/DESIGN.md contrast table | — | Keep | — |
| UI-02 | Phone tabs Play/Learn/World/Exchange/Profile; desktop rail | 11 “Information architecture” | **CONF** tabs play/world/exchange/finance/profile; Learn (Academy) only in rail/World | Research makes Learn a primary tab and Exchange hideable | v0.4.0: with the hide toggle, Learn takes the Exchange slot when hidden; M5: revisit IA | UI test |
| UI-03 | 44 px targets, reduced motion, colour-independent grades | 11 “Accessibility” | **IMPL** DESIGN.md; `prefers-reduced-motion` | — | Keep | — |
| UI-04 | Screen-reader board alternative, keyboard input | 11 | **PART** board `role="grid"` with square labels; no formal audit | — | M5 (audit) | Audit record |
| UI-05 | 200 % zoom, safe areas, landscape, handedness | 11 | **MISS** evidence | — | M5 | Device evidence |
| UI-06 | Original pixel portraits/venues, licensed offline font | 11; 17 | **PART** procedural 12×12 portraits; font stack lists “Inter” but no bundled font file found | Venue art absent | M5 | Asset manifest |
| UI-07 | Exchange screens: odds/history, watchlists, dossiers, filters, preview, exposure, holdings, P&L, settlement history, forecast record | 09 “Exchange screens” | **PART** most present; exposure and settlement history views partial | New families need list filters | v0.4.0: family filter, settlement history | e2e |
| UI-08 | Wealth not dominant on first launch | 11 | **PART** Finance is a primary phone tab | — | v0.4.0 via hide toggle | — |
| UI-09 | Evaluation graph bounded with mate badge | 11 | **IMPL** Charts.tsx / analysis | — | Keep | — |

### 2.12 Architecture, persistence, migrations, offline, PWA, Windows

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| AR-01 | Pure domain modules; UI never mutates money/ratings | 12 “Modules” | **IMPL** FederationService is sole writer (V3_FEDERATION §4) | — | Keep | — |
| AR-02 | Short transactions, no awaits on engine inside IDB tx, fence check in same tx | 12 “Review resolutions”; reviews/architecture #3 | **IMPL** `CrownDB.commit` re-reads world cursor inside the transaction | Verify the guard callback only awaits IDB requests | Keep | — |
| AR-03 | Atomic finalization of game + rating + report intent | 12; IE §1 | **IMPL** tests/storage.test.ts | Federation fixture result is a second transaction, reconciled on launch | Keep | — |
| AR-04 | Multi-tab single writer with fencing; fallback lease | 12 | **PART** Web Locks; read-only second tab; when `navigator.locks` is absent the tab is writable without a lease | Fallback lease missing | M5 | Test with locks undefined |
| AR-05 | Additive and copy-safe migrations with quota preflight, recovery export, validate before switch | 12 “Saves”; reviews/architecture #4 | **PART** v1→v2→v3 additive, tested; no data-transforming migration yet, no quota preflight | v0.4.0 market contract fields (q0, holdings h, family, payoff vector) change the `markets`/`positions` shape | v0.4.0: DB v4 additive (new stores or versioned records; old W/D/L markets read with defaults, never rewritten); if any transform is unavoidable, implement the doc-12 procedure | v3→v4 migration test + real v0.3.0 build upgrade journey |
| AR-06 | Backup/export with checksums, legal replay, ledger replay; restore federation only into empty career | 12; SAVE_FORMAT | **IMPL** crown-backup-1; tests “rejects tampered or illegal backups”, backup of active season | New stores must be included | v0.4.0 | Round-trip test incl. new stores |
| AR-07 | Persistent storage request, quota/backup status, no silent truncation | 12 | **PART** `requestPersistentStorage` and status in Library | Low-quota behaviour untested | M5 | — |
| AR-08 | Service-worker updates staged until matches/transactions are safe; rollback | 12 “Saves, offline and packaging” | **MISS** generated sw.js calls `skipWaiting()` and deletes old caches on activate (`scripts/vite-plugin-sw.ts`) | Update can activate during a match | M5 (release) | Upgrade test |
| AR-09 | Offline PWA verified on iPhone Safari | 12; 16 | **PART** desktop Chromium only | No device | Gate / M5 | Device log |
| AR-10 | Windows packaging (Tauri suggested) | 12 | **CONF** .bat/.ps1 launcher, not executed on Windows (DECISION_LOG “Conflicts noted”) | — | Keep launcher; M5 real-Windows run | Windows log |
| AR-11 | Licence/source package; pinned dependency licences | 12 “Budgets and dependencies”; 17 M5 | **PART** THIRD_PARTY_NOTICES.md; Fairy not shipped | — | M5 | — |
| AR-12 | Deterministic seeded RNG per subsystem; no UI timing as randomness | 08 “Identity” | **PART** world uses `hashSeed`; `trade()` seq uses `Math.random()` (key only, not outcome) | Non-deterministic idempotency key | v0.4.0: deterministic command ids (M-MATCH-08) | Test |
| AR-13 | Honest offline integrity disclosure; no false security claim | 14; 18 D11 | **PART** not stated in the in-app Exchange | — | v0.4.0: one-line disclosure on Exchange/Sandbox | UI text check |

### 2.13 Testing and acceptance

| ID | Requirement | Research source | v0.3.0 implementation (evidence) | Gap / missing work | Decision for v0.4.0 | Verification expected |
| --- | --- | --- | --- | --- | --- | --- |
| TS-01 | Vitest property tests for pure domain logic; Playwright for UI | 16 | **IMPL** tests/*.test.ts; e2e/*.mjs | — | Keep | — |
| TS-02 | p sums to 1, bounded cost, log-sum-exp extremes, complete-set identity, slippage, rounding, zero/huge orders, stale quotes | 16 “World, market and economy” | **PART** all except stale quotes and huge-order bounds | — | v0.4.0 | Tests |
| TS-03 | Correlated portfolio bounds; no shared reserve double spend | 16 | **MISS** (only one family) | — | v0.4.0 with M-REG | Property test |
| TS-04 | Buy/sell/resolve/settle/void/retry idempotency; fixed cancellation vector | 16 | **PART** settle/cancel idempotent; no void trigger, no trade retry idempotency | — | v0.4.0 | Tests |
| TS-05 | Market closure precedes terminal information; own-event conflicts rejected; NPCs cannot read future | 16 | **IMPL** for W/D/L | Extend to every family and live windows | v0.4.0 | Leakage suite |
| TS-06 | Economy long-career strategy grid tracks distribution, issuance/sinks, reserve failures, recovery, dominance | 16 | **PART** (EC-15) | — | v0.4.0 | docs/sim |
| TS-07 | Seeded tick replay incl. crash recovery, odd counts, byes, repeat-avoidance failure, retirements | 16 | **PART** tests for byes/impossible Swiss, determinism, stale/duplicate commands | Crash mid-advance fault injection not named | v0.4.0: fault-inject commit failure during advance with open tournament markets | Test |
| TS-08 | Real-device airplane-mode, suspend/resume, quota, SW upgrade | 16 “Interface and packaging” | **MISS** | No device | M5 / Gate | — |
| TS-09 | End-to-end: follow a tournament, forecast/trade a permitted NPC event, settle, fund an institution, recover from losses | 16 “End-to-end release scenario” | **PART** e2e/federation.mjs 18 steps (W/D/L only) | Tournament market and recovery-from-trading-loss steps | v0.4.0: extend journey (tournament-winner trade → settle; sandbox journey; hosting) | e2e log |
| TS-10 | Save upgrade from a real previous build | M4_PLAN §7 | **IMPL** v0.2.0 → v0.3.0 journey | — | v0.4.0: real v0.3.0 → v0.4.0 | e2e log |
| TS-11 | Missing evidence is never a pass; NOT RUN rows recorded | README research; 17 | **IMPL** IMPLEMENTATION_STATUS honest about devices | — | Keep | — |

---

## 3. Conflicts between research and implementation or newer evidence

### 3.1 Engine backend and Fairy-Stockfish licensing
- **Research (05, 17, 18 D04):** evaluate a pinned Fairy-Stockfish WASM build first, ship GPL-compatible,
  keep a TS oracle and custom fallback.
- **Implementation (I01):** the available WASM build needs pthreads/SharedArrayBuffer (COOP/COEP),
  has no single-thread fallback, does not work from the PowerShell server or a home-screen PWA reliably,
  and would make the app a GPL combined work; the licence choice is the owner's (package.json `UNLICENSED`,
  I14). The custom engine ships; Fairy-Stockfish is used only as a development oracle and benchmark
  (native build commit 3a95e072, pyffish 0.0.90), never distributed.
- **Newer evidence:** the custom engine is ≈ 10× less efficient per node (Crown 40k nodes ≈ Fairy 1k–4k).
- **Resolution:** keep (research explicitly allows the fallback). Note for M5: the puzzle bank and tactical
  suite were filtered with Fairy-Stockfish output; no Fairy code or binary is shipped. Whether any
  attribution is wanted for engine-verified data is an owner/licence-review question, not decided here.

### 3.2 Style validation outcome
- **Research (08):** six styles as desired behaviours; the research test found 0/5 differences.
- **Implementation:** move-filter styles failed on 400 positions; opening-repertoire styles passed for
  Tactical and Positional only (first six plies), Aggressive/Defensive/Endgame failed and play Universal.
- **Resolution:** keep the honest labelling. Styles are an opening character, not personalities; the
  time-pressure style is not meaningful while featured games are node-limited. Not M4-critical.

### 3.3 Market numerics and rules vs doc 09

| Item | Research doc 09 | v0.3.0 | Resolution |
| --- | --- | --- | --- |
| b | fixed per market, no value given | b = 120 ₵ for every W/D/L market (`MARKET_B`) | Keep; each new family records its own fixed b on the market; never changed while open |
| q0 | uniform by default; non-uniform needs b·ln(1/min p0) | uniform (0,0,0) | Keep for W/D/L; non-uniform only for tournament/sandbox families with the larger reserve and q0/h separation (3.4) |
| Subsidy | b·ln n funded per market, no double use | ⌈120·ln 3⌉ µ funded from treasury per market; market not opened if treasury short | Matches |
| Fee | 1 % of absolute executed cash, buy and sell, rounded up | same (`FEE_BPS = 100`) | Matches; bundles not offered (gross-leg rule needed only if bundles are added) |
| Quote arithmetic | fixed-point/decimal (research used 40-digit Decimal) | float64 + 1e-6 µ guard, integer ledger | Conflict: keep float, add decimal reference test (M-MATCH-05) |
| Lifecycle | draft→funded→open→halted/closed→resolved→settled | open→closed→settled/cancelled | Add `halted` in v0.4.0 |
| Cancellation | fixed 1/n vector, fees kept, no reversal | 1/3 per share (floor per holding), fees kept | Matches; but no trigger wired (M-MATCH-11) |
| Treasury | not specified | 25,000 ₵ genesis, replenished toward 25,000, cap 8,000/season | Accepted implementation choice |
| Trader set | 5 named types | 5 traders, analyst last (I21) | Accepted; order is a measured fix |
| Stale quotes | reject or reconfirm max spend | not checked | Fix in v0.4.0 |

### 3.4 Conditional and multi-outcome market design vs the Crown competition rules
- **Joint champions.** Doc 09's reference assumes each knockout match settles to a single winner. The
  Crown Championship final (doc 08, implemented) can end in joint champions. The 4-player reference is
  therefore 2 × 2 × 3 = **12 states**, not 8 (each final has A wins, B wins, joint). A claim “X wins the
  title” must state its joint-state payoff; decision: canonical subset claims pay only in the sole-title
  states, and a separate canonical claim “X wins or shares the title” covers joint states. The championship
  winner categorical market pays 1/2 to each joint champion (a simplex vector, so the b·ln n bound holds).
- **Uniform priors with many outcomes.** Doc 09 defaults to uniform q0 until non-uniform funding is
  tested. With 16–32 entrants (or a sandbox game against a much weaker level), uniform prices are
  systematically wrong and would hand the first trader the edge. Decision: v0.4.0 implements and tests
  non-uniform q0 from the public-rating model (floor p0 ≥ 0.005), reserves b·ln(1/min p0), stores virtual
  q0 separately from actual holdings h, and pays h_w only (reviews/markets #2). This satisfies the research
  condition (“until supported initial-prior funding is tested”) rather than overriding it.
- **Non-concurrency instead of joint models.** Season (region of champion) → closes at bracket draw;
  qualification → closes at bracket draw; Championship winner → opens at bracket draw, closes before
  round 16; final-four conditional → opens after quarterfinals, closes before semifinals. Overlapping
  deterministic claims are never open at the same time, which doc 09 permits as the alternative to a joint
  state model.
- **M4_PLAN vs research.** M4_PLAN §2b/§4 lists only tournament-winner and in-match markets; research
  doc 15 also requires promotion, qualification, season and conditional markets. Resolution: research
  wins; M4_PLAN must be amended.

### 3.5 Competition format vs doc 08
- Doc 08 specifies groups of four followed by an 8-player bracket, a regional-champions qualifier and a
  federation-wide open Swiss; v0.3.0 uses a straight 16-player two-game knockout, the 8 best division-1
  winners and a Federation Open restricted to divisions 2–4, with no division playoff before the
  pre-season seed tiebreak. These were M3 choices recorded in V3_COMPETITION_RULES. Resolution: keep for
  save compatibility and because markets are being built on the current format; record as a documented
  deviation in DECISION_LOG. One substantive fix is taken into v0.4.0: the player must have an open
  qualification path (T-05).

### 3.6 Economy constants vs doc 10
- The Starter Club matches doc 10 exactly (500 = 300 bond + 200 setup; upkeep 40; hosting 20; prize 40;
  attendance 5; sponsor 30). Differences: 3 paying guests instead of up to 16 members; the owner competes
  in and can win the escrowed prize; no management-slot rule. Upkeep keeps the club net negative, so no
  farming was observed (V3_ECONOMY: business strategy net worth fell to 819 ₵).
- Not in doc 10 but added after simulation: competitor 75 % season expenses, capped treasury replenishment,
  NPC wallet cap. These are accepted implementation decisions (I20) with measured effect.
- Doc 10 requires an integrated grid before M4 is claimed; v0.3.0 ran one seed of 7 strategies for
  6 seasons with sampled results. Not sufficient; carried into v0.4.0 (EC-15).

### 3.7 Other
- **Rated clocks** pause on hide (I07) as doc 04 requires; featured games have no clock (SP-02).
- **Windows wrapper:** research suggests Tauri; directive asked for a BAT/PowerShell launcher (kept).
- **Rank ladder:** research rank names are reused but mapped to rating bands only (RT-06).
- **Phone IA:** Finance replaced Learn as a primary tab (UI-02).

---

## 4. Provisional research experiments and what replaced them

The research README labels every experiment [E] under its stated assumptions. Raw files reviewed in the
research package's `data/` (seeded run `seed 20261103`, `run_manifest.json`; the architecture review notes
the original shared RNG across experiments, later corrected to per-experiment streams).

| Experiment | Research result (data file) | Why provisional | Later evidence in this repo | Still open |
| --- | --- | --- | --- | --- |
| A — random-play variant comparison | 80 games/variant, 49 LA games hit the 160-ply cap (`A_summary.json`, `A_games.json`) | Random policy, censored caps | None replaces it; engine games are draw-heavy (Davidson ν = 0.9 ≈ 31 % draws between equals) | Variant balance and human duration |
| B — search features | 5 positions, depth 2/3, single timings (`B_benchmarks.json`) | Tiny, Python | ENGINE_BENCHMARKS ablations (64-game paired matches, held-out replication) | Device speed |
| Extended engine matches | 6 opening pairs, depth 2 vs 1 (`extended_engine.json`) | Very small, shared engine | Calibrated 8-level ladder (500 games), Fairy reference matches | Human calibration |
| C — Glicko-2 stationary pool | 144k synthetic matches, RMSE 36–46 (`C_rating.json`) | Stationary, no draws/entrants | tests/ratings.test.ts reference vector; 40-season federation run with entrants/retirements (V3_FEDERATION §7) | Multi-seed dynamic study with the player |
| D — styles | 0/5 positions differ (`D_styles.json`) | 5 positions, one family | V3_STYLES: move filter failed on 400 positions; opening repertoire passed for 2 styles | Middlegame styles |
| E — forecast calibration | synthetic binary logistic, Brier 0.180 vs 0.187 (`E_calibration.json`) | Not chess, not W/D/L | M2 calibration of the eval map (19,187 positions, isotonic); Davidson ν fitted on 1,779 engine games | W/D/L temporal hold-out; tournament model |
| F — LMSR math | 18,000 signed-inventory float trades (`F_lmsr.json`); recentre exploit +3.80 (`adversarial_market_reset.json`) | Allows shorts, float only | tests/exchange.test.ts: integer ledger, long-only, 4,500 random trades, solvency per outcome | Multi-family portfolio, stale quotes |
| Funded retail ledger | 50 markets, 25,000 Decimal-quoted orders, exact conservation (`funded_ledger.json`) | Reference model, single market | Same properties re-tested on the production code at smaller scale | Scale to ≥ 25,000 orders; correlated families |
| G/H — careers/affordability | toy grants, wealth over-accumulation, 65 aggressive rescues (`G_H_careers.json`) | No sinks, Gaussian trading | V3_ECONOMY: real FederationService sim, sinks added, supply growth 0.6 % in season 6 | Seeds × parameter grid, more cohorts |
| Economy retest | 60 funded runs, conservation only (`economy_retest.json`) | Conservation ≠ balance | Ledger conservation asserted in every federation test | Integrated balance |
| I — learning vs noise | synthetic confounding (`I_learning.json`) | Held-out rate fixed by construction | Lab uses first-exposure and held-out families (M2_INTELLIGENCE_METHODOLOGY) | Validation of matching/leakage on a generator with latent ability |
| J — world arithmetic | 46,080 abstract matches in 0.51 s Python (`world_schedule.json`, `J_environment.json`) | No storage/UI/markets | Full season ≈ 0.3–0.51 s headless in Node incl. ratings and ledger | Browser/device timing with markets |
| Oracle validation | 10,000 positions, perft 1–4 vs pyffish (`oracle_validation.json`) | One native build | 5,000 pyffish positions + native Fairy perft 1–5 in tests | — (accepted) |
| Accuracy v0 (s = 200, k = 4, bins) | design placeholders (doc 07) | Uncalibrated | s replaced by crown-outcome-map-v1; k and bins unchanged and labelled experimental | Human-labelled grades |
| Loop evaluation | subjective weighted scores (`loop_evaluation.json`) | Author judgments | None (no playtest) | Human playtest |

---

## 5. v0.4.0 scope derived from the matrix (dependency order)

1. Contract layer: payoff registry (M-REG-01), market families with stored q0/h/b/payoff vectors, `halted`
   state, quote revisions and deterministic command ids (M-MATCH-08/09), DB v4 additive migration (AR-05).
2. Wired cancellation triggers, including the 400-ply cap that currently settles as a draw (M-MATCH-11,
   R-12), and the decimal reference test (M-MATCH-05).
3. Conflict/influence engine by event membership (T-09, M-TOUR-05).
4. Tournament-winner markets with non-uniform priors and joint-champion vectors (M-TOUR-*), bracket
   forecast model on public ratings with leakage tests (F-02, M-FC-05).
5. Season, qualification and promotion families under the non-concurrency schedule (M-SEASON/QUAL/PROMO).
6. Final-four conditional market, 12 states (M-COND-*).
7. NPC generalisation and repeated passes (M-NPC-03/05).
8. Live windows on watched featured games (M-LIVE-*), serialised against player matches (E-08).
9. Sandbox Exchange with calibrated priors (M-SB-*).
10. Forecasting: forecasts on every event, log loss, calibration chart, forecast ladder and funded league
    (M-FC-*).
11. Economy: management slot, Research Department, hosting choice, exposure caps, hide toggle, tutorial
    quote (EC-07/09/10/14).
12. Federation fixes needed by markets: Advance preview (F-06), player Open qualification path (T-05),
    user-influenced broadcast selection (F-05), crown-rank-1 (RT-06), rivalry view (F-10).
13. Evidence: integrated strategy grid and multi-seed 20-season soak (EC-15, RT-07, F-12), ≥ 25,000-order
    stress, extended e2e journey and a real v0.3.0 → v0.4.0 save upgrade (TS-*).

Deferred to M5, with the reason in each row: device budgets and real Windows/iPhone runs, staged service
worker updates, accessibility audit, licensed font/art, licence/source package, Academy certificates,
commentary, news feed and history pages, further styles and engine strength, confirmatory improvement
plan. Open gates that no milestone can close without new data: human calibration of levels, grades and
puzzles; human enjoyment; variant balance.
