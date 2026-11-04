# Crown & Calculation v0.9 — master implementation prompt ("The Sovereign Ascension")

Continue from the v0.8.0 release on branch `claude/fervent-brahmagupta-fnui2e`. Read first: docs/V8_SOVEREIGN_STANDARD.md,
docs/ENGINE_STRENGTH_RESEARCH.md, docs/ENGINE_OPTIMIZATION_PLAN.md, docs/FEDERATION_LEAGUE_DESIGN.md, docs/BUG_REGISTER.md.
Standing rules: crown-la6-v1 rules are canonical and untouchable; all money is fictional; never fabricate results;
every strength claim needs a recorded match file; no third-party engine code ships without the owner's licensing
decision; saves migrate additively with a pre-migration backup; verify in a real browser, not only with unit tests.

## Priority 1 — A genuinely stronger Sovereign
1. **Decide approach B with data.** Build Fairy-Stockfish (`losalamos`) to WASM as a separate worker module; play
   it against Crown in Chromium at 1/5/10 s (≥ 128 colour-swapped games per budget, 4-ply book) and on a phone-class
   device. Present the numbers and the licensing options (ENGINE_STRENGTH_RESEARCH.md §B) to the owner; implement the
   chosen option (B2 separate GPL module, B3 Windows user-supplied engine, or none) behind a clearly labelled
   "Sovereign Unbound (Fairy-Stockfish)" choice, with our referee authoritative and the native engine as fallback.
2. **Native engine speed (behaviour-preserving):** incremental material/PST, pawn cache, shared attack maps,
   faster move generation; bitboard prototype. Gate: perft/make-unmake/evaluation differential suites; identical
   `speed_probe` checksum; report nodes/s.
3. **Native search/eval strength:** re-test pruning/extension candidates at 1 s per move; NNUE-style evaluation
   scoped and prototyped (offline labelling, own inference, phone budget). Endgame tablebases for common 6×6 material.
4. **Acceptance:** confirmation rule — 640 games, 4-ply book, adopt only if the 95 % lower bound > 0; report vs v0.8
   and vs Fairy-Stockfish at ≥ 2 time controls; Sovereign Unbound budgets shown to gain with time (doubling ladder).
   Target +200 Elo over v0.8 for the native engine is a target, not a claim.

## Priority 2 — Authentic opponents from beginner to elite
1. Beginner engine profiles below L1 (800): legal-move policies with calibrated error models (temperature, blunder
   probability, missed threats) — never predetermined results. Calibrate by round robins anchored to L1 = 800 down
   to the floor; publish the calibration table.
2. Recalibrate L1–L9 on the final v0.9 engine; difficulty must rise monotonically with measured strength.
3. Extend the federation population below 800 (divisions 7–8) additively; verify every rating band has opponents.

## Priority 3 — Federation progression (design in FEDERATION_LEAGUE_DESIGN.md)
Keep the 8 divisions and 16 regional leagues per division. Add: rating classifications (computed, never stored;
avoid FIDE title words and division names), division rating guidelines, promotion play-offs / relegation play-outs,
division trophies, anti-farming rules, beginner events. Keep concepts distinct: Glicko-2 rating, estimated opponent
strength, classification, division, regional league, Federation title, event titles, financial prestige. Do not
invent a Circuit Grade ladder unless the owner approves a design that measures something no other system does.
Multi-season simulations: promotion rates, rating distribution, wealth concentration, bankruptcy recovery.

## Priority 4 — Played Like
If v0.8 calibration passed, extend the calibration set with beginner profiles and human-like games to cover 1–799;
otherwise fix the methodology (features, difficulty adjustment, more games) and re-validate on held-out games.
Never show a number outside the validated range; keep "Insufficient data" and uncertainty ranges.

## Priority 5 — Career depth and polish
Passport progression for the new classifications and divisions; tournament histories; rivalry rematches; Match
Center consistency; sound/motion polish; mobile performance budget; offline update flow.

## Verification for v0.9 release
Full vitest; all journeys on the final build (analysis, nav audit, motion/sound, motion-extra, rated run, offline,
Live Arena, v5 migration + a new v0.8→v0.9 migration journey); engine benchmark table; calibration tables; economy and
federation simulations; screenshots; source ZIP; Windows and iPhone instructions; known issues.
