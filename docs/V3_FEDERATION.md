# The Living Federation — architecture (v0.3.0)

Identifiers: federation `crown-federation-1`, result model `crown-result-model-1`, profile map
`crown-profile-map-1`, exchange `crown-exchange-1`, economy `crown-economy-1`, save schema IndexedDB v3.

## 1. World

- **2,048 persistent AI competitors** = 16 regions × 8 ordered divisions × 16, generated deterministically
  from the world seed (`src/federation/generator.ts`). Every competitor has a stable id, name, pixel
  portrait seed, region, division, birth season (age), listed style, public Glicko-2 rating (r, RD, σ),
  form, reputation, titles, lifetime earnings, W-D-L, per-season history, milestones and a career status
  (`active`, `reserve`, `retired`).
- **Hidden strength.** Each competitor also has a hidden `latent` strength on the calibrated engine scale
  (division mean 2500 − 190·(d − 1), N(mean, 120²), clamped to [750, 3050]). It drives results and the
  engine profile when they play. It is **never** displayed and is never used by forecasts, NPC traders or
  market research — those use the public rating only. The simulation measured the public ratings
  converging on it (correlation 0.986–0.987 after one season; `docs/sim/`).
- **Careers.** At season end: reputation decays ×0.9, latent drifts with age (younger improve, 24–31 stable,
  older decline; capped ±90 per season), retirement probability 0.4% below 36, 12% at 36–39, 45% from 40.
  Each retirement frees a slot that is refilled in the same region and division — first by the competitor
  displaced when the player joined, otherwise by a new entrant (latent ~ the band, public rating = band mean
  with RD 300, so their rating must be earned). The active population therefore stays at exactly 2,047 + you.
- **The player** joins their chosen region's Open Division (division 8), displacing its lowest-rated member
  into reserve. Your federation games are real rated rapid (5+3) games recorded in the normal rating ledger.

## 2. Tiered simulation (what is a real game and what is not)

| Tier | What | Record |
| --- | --- | --- |
| 1 | Your fixtures (league, Swiss, Club Weekend, Championship) | Full legal `GameRecord`, Glicko-2 rated, analysable |
| 2 | Featured AI-vs-AI matches (≤ 3 per round; championship first, then your division's region top division, Federation Open, another top division, Challenger Open) | Full legal game played move by move by the Crown engine with each competitor's strength profile; replayable in the spectator |
| 3 | Every other AI-vs-AI pairing (≈ 1,020 per round) | **Summary result only**, drawn from the Davidson model on the two hidden strengths. Shown as "summary result"; never presented as a game or replay |

Result model (`src/federation/resultModel.ts`): Davidson extension of Bradley–Terry,
P(W) = π_w/Z, P(D) = ν√(π_wπ_b)/Z, π = 10^(s/400), **ν = 0.9** (maximum-likelihood fit over 1,779 recorded
Crown engine games; ≈ 31% draws between equals). White's measured first-move advantage (50.5% over 1,280
games) is treated as zero.

Profile map (`src/federation/profiles.ts`): latent < 1911 → nearest calibrated level L1–L5; otherwise a
node budget 600·2^((latent − 1911)/133) (featured games capped at 30k nodes). Featured games are seeded
and node-limited, so they are deterministic (a crash replays the same game).

## 3. Information timing (no leakage)

- A featured game **does not exist** until it is started. Its market is closed and that closure is
  **committed** before the engine produces the first move (`FederationService.playFeatured`, asserted in
  `tests/federationService.test.ts` and in the browser journey).
- Tier-3 results are drawn only when the round is processed (after all of your fixtures are played).
- The spectator never shows the final result or the settlement before the replay reaches the end.
- Forecasts and NPC traders read public ratings only; the hidden strength is not exposed by any UI or API
  the forecasts use.
- Official markets never list a game involving the player (enforced in `trade` and in featured selection).

## 4. Command architecture (authoritative, atomic, idempotent)

`src/app/federation.ts` (`FederationService`) is the only writer of federation, exchange and economy state.
Every command:

1. clones the cached state;
2. computes the next state with pure domain functions (`src/federation/*`, `src/exchange/*`, `src/economy/*`);
3. validates every ledger journal (integers, balanced, no account below zero except issuance, no mixing of
   sandbox and official accounts) against the cloned balances;
4. writes **all** changed records — world, plans, competitors, rounds, games, journals, accounts, markets,
   positions, assets, finance history — in **one IndexedDB transaction**, guarded by the committed world
   cursor (season, round). A stale tab or a duplicate command finds a different cursor and aborts;
5. only then swaps the in-memory cache. A failed commit leaves state and storage unchanged.

Idempotency keys: journal ids (`prize-pay:<season>:<pool>`, `settle:<market>`, `sponsor:<season>:<milestone>`,
`mint:season:<n>`, …) are unique and re-posting one is a no-op; the round cursor makes "advance" a
one-shot per round; a player game result is recorded once per fixture; featured games in flight are shared
(a second caller joins the same run). On launch, finalized federation games whose fixture is still pending
(app closed between the two commits) are reconciled.

Rated-game finalization keeps the v0.2.0 path (game + rating event + pool state in one transaction);
the federation then records the fixture result in its own transaction. The reconciliation step above
closes the gap if the app stops between them.

## 5. Season calendar

Rounds 1–15 league (a single round robin: 15 rounds for each 16-player division); rounds 4–8 Federation Open (divisions 2–4) and Challenger Open (divisions 5–8 + the player if
registered) — 5-round Swiss; rounds 10–11 Club Weekend (club owners); rounds 16–19 Crown Championship
(round of 16 → final). Details: `docs/V3_COMPETITION_RULES.md`.

## 6. Performance

A full season (19 rounds, ≈ 19,500 games of which ≈ 19,400 summary results) processes in ≈ 0.3 s headless;
in the app each "Advance" additionally plays up to three featured engine games in a Web Worker (typically
5–20 s). Storage: rounds keep compact tier-3 tuples `[event, white, black, result]`.

## 7. Long-horizon stability (40 seasons)

`npx tsx tools/sim/federation.ts 40 42` runs the shipped world code headless for 40 seasons (without the
player; `docs/sim/federation-results.json`, 15 s in total, at most 0.51 s per season):

| Measure | Result |
| --- | --- |
| Mean public rating | 1,831.5 – 1,839.7 in every season (no inflation or deflation trend) |
| Rating spread (SD) | 445 – 449 (stable) |
| Public rating vs hidden strength | correlation ≥ 0.982 every season; mean rating − mean strength drifts to −20 at most as the aging model slowly raises average strength while Glicko-2 stays zero-sum |
| League mobility | 20.5 – 21.6% of competitors change division each season |
| Careers | ≈ 96 retirements and as many entrants per season; active population constant at 2,048 |
| Champions | 41 Crown titles (joint titles count twice), 18 different champions, at most 7 by one competitor |
