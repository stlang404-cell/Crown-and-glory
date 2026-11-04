# Sovereign engine strength: findings and v0.9 research plan

## Where Sovereign stands (measured)
* The UI plays exactly the benchmark configuration (crown-search-2 + crown-eval-4 + partialRoot, 2^20 table, best
  move only, no noise, no handicap, no style); verified from real UI games by `e2e/sovereign-probe.mjs`.
* In real UI games at a 5 s budget it searched depth 12–13 at 230–285 k nodes/s and used only 2.4–4.6 s per move
  (time-management rule; candidate fix `fullBudget` — result in V8_SOVEREIGN_STANDARD.md §4).
* Versus Fairy-Stockfish (variant `losalamos`, dev-only binary) at equal move time: ≈ −330 Elo at 100 ms (v0.7,
  128 games); v0.8 numbers at 100/300/1000 ms in V8_SOVEREIGN_STANDARD.md §4.
* Ten search heuristics and an evaluation refit gave no validated gain (best confirmed: +4 [−14, 22]).
* Fairy-Stockfish compiled to WASM runs at 190–350 k nodes/s, the same order as our engine; its advantage is search
  and evaluation quality, not speed.

## Approach A — strengthen the native Crown engine
Order of work (each step gated by the differential tests and confirmation rules in ENGINE_OPTIMIZATION_PLAN.md):
1. **Speed without behaviour change:** incremental material/PST, pawn cache, shared attack maps, faster move
   generation, then a bitboard prototype (two uint32 halves). Target ≥ 1.5× nodes/s at identical checksum.
2. **Search quality, measured at more than one time control:** the v0.8 screen used 100 ms only; re-test
   singular/SEE/LMR variants at 1 s once speed work lands (pruning gains often appear only at depth).
3. **Evaluation:** a small NNUE-style network trained on millions of positions labelled offline by Fairy-Stockfish
   (labelling is allowed: the labels are data, the engine is not shipped); our own inference code, sized for phones
   (≤ 1–2 MB weights, int8/int16), evaluated incrementally. This is the step most likely to close a 300+ Elo gap,
   and the most expensive.
4. **Endgames:** 6×6 endgames with few pieces are small enough for generated tablebases of the most common
   material (K+Q vs K, K+R vs K, K+P vs K, K+Q vs K+R …) — exact play where the engine is weakest at fast budgets.

Expected outcome: steps 1–2 a few dozen Elo (to be measured); step 3 is the only realistic path to parity on our own.
Cost: high (weeks of compute for labelling and training, careful phone performance work).

## Approach B — a stronger third-party engine as an optional maximum-strength opponent
### Compatibility (tested)
Fairy-Stockfish `losalamos`: 6×6, `rnqknr/pppppp/6/6/PPPPPP/RNQKNR`, no bishops, no castling, no double step, no en
passant, promotion to Q/R/N; perft(4) = 14,332, identical to our rules. Differences to handle: draw/adjudication rules
inside its search (our referee always adjudicates), and the 50-move/threefold claim semantics. Any integration must
keep our rules as the referee and reject any move our generator does not list (as the benchmark harness does).

### Performance
WASM build measured at 190–350 k nodes/s single-threaded (≈ 40–55 % of native) with 1.5 s start-up in Node; browser
and iPhone numbers still to be measured. Even at WASM speed it is expected to stay far stronger than our engine at
equal time — **to be confirmed by a WASM-vs-Crown match before any decision.**

### Licensing (not legal advice; the owner decides)
Fairy-Stockfish is GPL-3.0. The obligations depend on how it is combined and distributed:

| Option | What ships | GPL position (FSF interpretation) | Practicality |
|---|---|---|---|
| B1. Relicense Crown & Calculation under GPL-3.0 | App + engine as one program | Clearly compliant (source of everything offered) | Simple; changes the project's licence |
| B2. Separate program, arm's length | Our app (own licence) + unmodified/modified Fairy WASM as a **separate module in its own Web Worker**, talking UCI text over `postMessage`; Fairy's licence, notices and complete corresponding source (incl. build scripts) shipped or offered alongside | The FSF treats separate programs communicating through pipes/sockets/command-line-like interfaces as separate works ("aggregate"), unless they exchange complex internal data structures. UCI text over messages fits that pattern; the Fairy part stays GPL | Likely compliant if done carefully; grey area exists for web bundles — keep the engine as its own file, separately replaceable, never bundled into our JS |
| B3. User-supplied engine | Nothing of Fairy ships; on Windows the launcher (`scripts/serve.mjs`, Node) can run a UCI engine the player installs and bridge it to the browser over localhost | We distribute no GPL code | Compliant; Windows/desktop only (not iPhone); extra setup for players |
| B4. Not integrated (current) | Benchmark only, never shipped | Nothing distributed | Status quo |

Whatever is chosen: our referee stays authoritative, the native engine remains the default and the fallback for all
lower levels, and the maximum-strength opponent clearly states which engine it uses.

### Recommendation
1. **v0.9 first measurement:** Fairy WASM vs Crown in the browser (desktop and a phone-class device) at 1/5/10 s —
   the numbers decide whether B is worth the licensing step.
2. If the owner accepts B2 (separate GPL module) or B3 (Windows-only user-supplied), ship it as **"Sovereign Unbound
   (Fairy-Stockfish)"**, clearly labelled, optional, with the native Sovereign kept as the default and fallback.
3. In parallel, pursue Approach A steps 1–2 (low risk) and scope step 3 (NNUE) as the long-term path to a strong
   engine we own outright.
