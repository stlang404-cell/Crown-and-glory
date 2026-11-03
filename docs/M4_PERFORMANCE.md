# v0.4.0 performance measurements

All numbers were measured in this session on a 4-core cloud Linux container (Node 22, headless Chromium), often
while other CPU-heavy work (engine benchmarks, simulations) ran concurrently, so they are conservative for a
desktop and optimistic for a phone. No physical phone was measured.

| What | Measurement | Source |
| --- | --- | --- |
| Production bundle | app 623 kB (≈ 200 kB gzip), engine worker 73 kB, puzzle bank 272 kB lazily loaded | `vite build` |
| Headless season (2,048 competitors, ≈ 19,500 results, no player) | 0.29 – 0.73 s per season; 40 seasons in 15–16 s | tools/sim/federation.ts, 3 seeds |
| Season through the full service with market families (models, NPC trading, ledger, IndexedDB commits) | ≈ 13–20 s per season in Node with fake IndexedDB | tests/markets.test.ts timings |
| Browser round cycle (play the player's games with the robot + Advance, incl. up to 3 background featured engine games) | 7 – 53 s per round, median ≈ 20 s | e2e/m4-journey.mjs timestamps (18 rounds) |
| Live in-play steps (featured moves at ≤ 30k nodes in the worker + publication + NPC reaction + commit) | 8 steps plus page navigation and the in-play start completed in 2.4 s in the journey (≈ 0.3 s per step for those opening moves; middlegame moves search longer); the trading window (1–6 s) dominates | journey timestamps, steps 14→15 |
| Postgame analysis per move | Quick d5 ≈ 29 ms · Standard d7 ≈ 159 ms · Deep d9 ≈ 919 ms | tools/bench/analysis_speed.ts → src/analysis/analysis-speed.json |
| Market-family models per round (league / qualification / Swiss Monte Carlo) | included in the season figure above; bounded by fixed sample counts (150–300) | src/exchange/families.ts |

## Bounded work and responsiveness

- Federation commands are serialized (one at a time) and each commits in one IndexedDB transaction.
- Engine work runs in Web Workers (play, spectator, analysis); the UI thread never searches.
- Featured games are node-limited (≤ 30k nodes per move) and at most three per round; background (tier-3) results
  are O(1) draws per pairing.
- Monte Carlo models use fixed sample counts; live in-play publication is one move per window.

## Known bottlenecks (M5)

- Advancing a round can take tens of seconds when three featured games are played in the background; there is no
  per-round progress bar beyond the button label.
- A single shared spectator worker serves featured games and live steps; there is no global prioritised engine
  queue yet (docs/M5_ROADMAP.md §6).
- Every federation command clones the in-memory state (Maps of 2,048 competitors); this costs a few milliseconds per
  command and grows with stored rounds.
