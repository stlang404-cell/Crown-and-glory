# Implementation decision log

Research decisions D01–D12 (docs/research/18_DECISION_LOG_AND_OPEN_RISKS.md) remain binding. The
entries below record implementation decisions and conflicts resolved during M0/M1.

| ID | Decision | Reason / evidence |
| --- | --- | --- |
| I01 | **Production engine = custom TypeScript engine** (`crown-search-1` + `crown-eval-2`) in a Web Worker. Fairy-Stockfish is used only as a development oracle and benchmark reference, not shipped. | The npm WASM build `fairy-stockfish-nnue.wasm@1.1.12` (GPL-3.0) is compiled with pthreads and requires `SharedArrayBuffer`, i.e. cross-origin isolation (COOP/COEP). That is not available from the PowerShell fallback server or `file://`, is fragile for an iPhone home-screen PWA, has no single-thread fallback, and bundling it would make the distributed app a GPL combined work — a licensing choice that belongs to the project owner. Research D04 explicitly allows the documented custom fallback. |
| I02 | Rules verified against two independent references: pyffish 0.0.90 (5,000 positions, 47,884 successor states) and a native Fairy-Stockfish build from commit `3a95e072f8e60b94ad4d04a3c6d98129c772a301` (perft 1–5). | Research doc 04 gate "reproduce against the production implementation". |
| I03 | Search features kept only where self-play ablation showed benefit or no harm (docs/ENGINE_BENCHMARKS.md). Null-move and aspiration windows were neutral within error; kept because they did not hurt and reduce node counts at depth. | Research doc 05: "Use evidence to choose optimizations." |
| I04 | Difficulty = node budgets + bounded near-best sampling for L1–L4. Ratings of levels come from measured engine-vs-engine matches anchored at L1 = 800 (`src/engine/calibration.json`). | Hardware-independent strength; research forbids difficulty labels as ratings. The anchor value is arbitrary (no human data). |
| I05 | AI opponents are fixed anchors: their rating/RD snapshot (from calibration) is used in the player's Glicko-2 update and they never change. | Research doc 06: anchor agents with fixed versions do not drift. |
| I06 | One rated game = one Glicko-2 rating period; pools per time control (blitz, rapid, classical). Untimed games are never rated. Any assistance event makes a game unrated (no in-game assistance exists in M1). | Research doc 06 policy. |
| I07 | Rated clocks pause when the app is hidden and when a saved game is reopened; pauses are recorded with the game. Time between closing and reopening is not charged. | Research doc 04: pause on suspension to avoid iOS background penalties. |
| I08 | Engine draw behaviour: the engine accepts a draw offer / claims an available draw only if its own last evaluation is ≤ −60 cp (or level and ≥ 60 plies). This is a player decision, never an adjudication. | Crown rules: no engine evaluation decides a result. |
| I09 | Analysis policy `std-d7`: exact full-window scores at depth 7 and 6 for {top screened moves, engine best, played move}; screening of all legal moves at depth 3. Grading/accuracy = research v0 (s = 200 cp, k = 4, fixed bins) labelled **experimental**. Additional rule: an immediately winning capture (SEE > 0) is never "Great". | Research doc 07 (root-constrained comparable policy; uncalibrated thresholds must be disclosed). The SEE rule was added after a real report labelled recapturing a hanging knight as Great. |
| I10 | Brilliant requires: Great conditions + ≥ 200 cp material investment along the engine line + not a recapture + a deeper (depth + 2) verification where the move keeps expected score ≥ 0.5 and ≥ 0.10 above the alternative. It is heuristic, never claimed as proof. | Research doc 07. |
| I11 | Storage: hand-written IndexedDB wrapper (no Dexie) to avoid an unaudited dependency; `fake-indexeddb` only in tests. Single-writer lease via Web Locks; second tabs are read-only. | Research doc 12. |
| I12 | Training retries store `setupMoves` (the original history) so repetition state is exact, are untimed and unrated, and never modify the source game. | Research doc 07 "replay the mistake from the original pre-move state". |
| I13 | Lab (M2 foundation) shows only descriptive rates with ≥ 10 opportunities across ≥ 3 games and game-clustered bootstrap intervals; dimensions without an M1 rubric say "not measured". | Research doc 06 evidence rules; no fabricated scores. |
| I14 | Repository license left `UNLICENSED` in package.json. | Choosing an open-source license is the owner's decision. |
| I15 | Sandbox Exchange (own-game speculation with fictional sandbox balances, excluded from official wealth/records/achievements) is adopted into the M4 design. | Directive §11; resolves the research "no trading on own games" rule by separating a sandbox ledger from the official exchange. |

## Conflicts noted

- Directive asks to "investigate Fairy-Stockfish… If infeasible use the fallback": feasibility was investigated (I01). Integration as an optional, separately licensed engine module behind cross-origin isolation remains possible later (see ROADMAP).
- Research recommends Tauri for a Windows wrapper; the directive asks for a BAT/PowerShell launcher. M1 ships the launcher (no native wrapper).
