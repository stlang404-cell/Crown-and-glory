# Executive vision

**Crown & Calculation: The Six-Square Federation** is the selected working name [D]. Alternatives: *Sixfold Crown* (short, variant-focused), *The Calculating Crown* (distinctive but awkward), *Crown Circuit* (competitive but less clear), *The Sixth Rank* (evocative but ambiguous). Keep Crown & Calculation for continuity and the connection between mastery and forecasting. Trademark, domain and store-name availability have not been researched; the subtitle is descriptive, not cleared branding.

## The product

An offline chess career in which every game becomes part of a permanent learning record and every competitor belongs to a persistent federation. Learn a compact but serious chess variant, compete for earned titles, study rivals, watch championships, forecast outcomes with fictional funds, and eventually run a specialist chess institution. The shared resource is **understanding the federation**, acquired through play, analysis, observation and prudent decisions.

The primary loop is academy-to-career: choose a meaningful challenge → play or observe → inspect evidence → choose targeted preparation → re-enter the federation. Markets and institutions extend the same knowledge into other decisions. They never gate ordinary chess, analysis or training.

Seven loops were scored using eleven weighted criteria and 10,000 weight perturbations [D/E, data/loop_evaluation.json]. Academy-world dominates the sampled weight perturbations; exact counts are in data/loop_evaluation.json. These are subjective design scores, not user research. Select academy-world with optional career/exchange/club branches, not a mandatory dynasty dashboard.

## Key decisions

- Los Alamos-derived `crown-la6-v1` competitive rules, matching the documented 6×6 piece setup, pawn movement and promotion set [R, los_alamos/fairy_variant]. Exact draw policies are specified separately as Crown rules.
- Evaluate Fairy-Stockfish first as a GPL-compatible separate local WASM engine module; retain a custom rules oracle and fallback search plan. Ordinary Stockfish is not assumed compatible. Licensing and mobile build gates precede integration.
- Glicko-2 for each time-control pool, plus independent evidence-based skill profiles. Preserve all reports and rating history.
- Fully local, evidence-templated coaching. No paid API or remote inference; optional local language models are outside the critical path.
- Categorical LMSR W/D/L and tournament markets with funded worst-case reserves; immutable inventory-based price paths; no trading on one's own games or events one can influence.
- Deterministic world advancement on explicit simulation ticks, never a real-time chore. All play paths remain viable with no account or cloud.
- Persistent records mean no deliberate game deletion plus export/backup. Browser storage alone cannot guarantee lifetime retention [R, webkit_storage].

## Evidence and decisions that changed

The tiny style test did not establish distinct choices; personality marketing must wait for matched-strength behavior tests. Random-play variants reached the artificial game cap frequently, making balance/draw-rate claims invalid. Glicko-2 behaved sensibly in a stationary synthetic pool but does not anchor its own absolute scale. A naive economy over-accumulates wealth. An external LMSR re-centering test produced an exploit; prohibit it. Synthetic learning tests show raw apparent progress can come from easier or memorized items, motivating held-out matched assessments.

This is an ambitious full product split into playable gates. Engines, reports and save integrity are prerequisites for world/economic depth. The research package is delivered with an evidence backlog, not a claim that these risks have vanished.
