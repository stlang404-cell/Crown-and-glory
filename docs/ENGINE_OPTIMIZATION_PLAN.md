# Engine optimisation plan (next milestone)

Status: **plan only — nothing in this document is implemented in v0.8.0.** It follows from the v0.8 measurements in
docs/V8_SOVEREIGN_STANDARD.md (§ Engine).

## Why speed and evaluation, not more search heuristics

* v0.8 screened ten search heuristics and an evaluation refit at 128 games each; the best screening result
  (nullAdaptive, +38) measured **+4 [−14, 22]** when confirmed over 640 games. Small search tweaks on top of
  crown-search-2 are at or below the noise floor of affordable matches.
* Fairy-Stockfish compiled to WASM runs at **190–350 k nodes/s** on this machine, the same order as our TypeScript
  engine (**≈ 280–300 k nodes/s**), yet beats it by ≈ 330 Elo at equal time. The gap is search *quality* and
  evaluation, not raw speed — but at equal quality, speed is the one lever that converts reliably into Elo
  (a 2× speed-up is typically worth a few dozen Elo at these time controls; to be **measured**, not assumed).
* Profile of the canonical play search (`tools/bench/speed_probe.ts`, 12 openings × 300 k nodes, Node 22):

| Function | Self time |
|---|---|
| `evaluate4` (eval4.ts) | **43.5 %** |
| `generatePseudo` (position.ts) | 16.4 % |
| `searchNode` | 11.2 % |
| `scoreMoves` | 6.0 % |
| `qsearch` | 5.4 % |
| `inCheck` | 3.7 % |
| `makeMove` | 2.9 % |
| `see` | 2.2 % |
| everything else | < 2 % each |

## Ground rules (all steps)

1. **Canonical rules are untouchable.** `src/rules/` (crown-la6-v1) stays the reference implementation; any faster
   move generator or board representation is a *second* implementation that must agree with it exactly.
2. **Differential correctness tests before any speed claim:**
   * perft to depth 5 from the start position and from ≥ 200 positions drawn from benchmark games (all opening
     books, promotions, checks, stalemates), comparing node counts *and* the move lists at every leaf parent;
   * make/unmake round-trip: hash, board, king squares, counters identical after every move of every perft tree;
   * evaluation equality: new evaluation == `evaluate4` (to the centipawn) on ≥ 100 000 positions from
     `tools/bench/tune/positions.json`, including style weights (`own`/`opp`/`simplify`) and the trace path;
   * search equality where the change is meant to be behaviour-preserving: `tools/bench/speed_probe.ts` checksum
     (best move, score, depth for 24 positions at fixed nodes) unchanged.
3. **Behaviour-changing steps** (e.g. lazy evaluation) get a 640-game confirmation on the 4-ply book
   (`tools/bench/confirm_chunked.sh`) at 100 ms and one other time budget, against the current play
   configuration; adopted only if the 95 % interval excludes a loss.
4. Every step is its own commit with the probe numbers (nodes/s, checksum) in the message.

## Steps, in order of expected value per risk

### 1. Incremental material + piece-square terms (behaviour-preserving)
`evaluate4` recomputes material and PST for every piece on every call. Maintain `mg`/`eg` material+PST sums and
the phase incrementally in `Position.makeMove/unmakeMove` (two small Int32Arrays per side, updated with the moved,
captured and promoted piece). The evaluation then only adds the positional terms.
*Tests:* incremental sums == from-scratch sums after every move in perft trees; `evaluate4` output identical.
*Expected:* −10–15 % of evaluation time.

### 2. Pawn-structure cache (behaviour-preserving)
Pawn terms that depend only on pawns (files, doubled, isolated, supported, phalanx, passed status, pawn attack
maps) keyed by a pawn-only Zobrist hash (maintained in make/unmake). King-dependent parts (passed-pawn king
distances, unstoppable pawns, shield/open files) stay per call.
*Tests:* cached == uncached on the 100 k corpus; hit rate reported.

### 3. Attack maps without repeated ray walks (behaviour-preserving)
Mobility, king-zone attacks, threats and hanging pieces each walk rays; compute one attack map per side per call
(shared by mobility, threats and the HANGING term) and reuse it in `see` and `inCheck` where possible.

### 4. Lazy evaluation in quiescence (behaviour-changing — must be confirmed)
With step 1 in place, material+PST is available for free: in `qsearch`, if `materialPST − margin ≥ beta` (or
`+ margin ≤ alpha`) return without the full evaluation. Margin tuned on the corpus (largest observed
|full − materialPST|, 99.9th percentile). Confirm with 640 games.

### 5. Move generation
`generatePseudo` allocates and walks rays per call. Replace with pre-sized move buffers per ply, piece lists
(no 36-square scans), and staged generation (captures first; quiets only if no cutoff).
*Tests:* perft and move-list equality vs `src/rules` as in rule 2.

### 6. Bitboard architecture (largest change — prototype first)
A 6×6 board fits in 36 bits. JavaScript numbers are exact to 2⁵³ but bitwise operators are 32-bit, so use two
uint32 halves (ranks 1–3 / 4–6, 18 bits each) or a 64-bit `BigInt` only off the hot path. Sliding attacks via
precomputed ray masks + first-blocker scans (magic multiplication is not available on 32-bit halves without
BigInt; use small occupancy-indexed tables per ray: ≤ 5 squares per ray ⇒ 32 entries).
*Plan:* prototype in `src/engine/bb/` behind the same `Position` interface; differential perft against
`src/rules`; benchmark nodes/s; adopt only if ≥ 1.5× faster on the probe with identical checksum.

### 7. WASM (only after 1–6)
Compiling the engine core (not the GPL Fairy-Stockfish) to WASM — e.g. AssemblyScript for the bitboard core —
is only worthwhile once the data layout is array/bitboard based. Requires the same differential suite and a
worker build for the PWA; measure startup cost on iPhone-class hardware before adopting.

## Strength architecture beyond speed (research)
* **Evaluation learning:** the 97 k-position Texel refit gave +3 [−41, 49]. A small NNUE-style network needs
  millions of labelled positions; labelling with Fairy-Stockfish offline is allowed (dev-only, never bundled),
  but the network and its inference must be our own code and small enough for phones.
* **Search:** singular extensions / SEE pruning confirmation results (v0.8) decide whether search work continues.

## Not acceptable
Bundling or linking Fairy-Stockfish (GPL); any change to `src/rules` semantics; any adoption without the
confirmation match; claims of strength not backed by a recorded match file.
