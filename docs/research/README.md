# Project Crown research and Claude Code handoff

Working product: **Crown & Calculation**. Delivery: research blueprint, not a built game.

Read 01–18 in order. The exact implementation directive is **17_CLAUDE_CODE_MASTER_PROMPT.md**. The binding prior intelligence expansion is preserved in `requirements/INTELLIGENCE_EXPANSION.md`; its completeness and no-scope-reduction requirements apply alongside this package. M1 establishes durable game/rating/report foundations; M2 completes the development platform before M4 economics. Existing systems remain in the full implementation scope.

Evidence labels used throughout:

- **[R] Established research/source**: a retrieved source supports the stated fact, with source IDs in document 02.
- **[E] Experimental**: reproduced by a script and linked JSON. Synthetic experiments establish behavior under their assumptions only.
- **[T] Engineering target/estimate**: a budget or proposed target, not a measured device result.
- **[D] Design decision/assumption**: a product choice, not empirical truth.
- **[H] Hypothesis/open validation**: needs further evidence. Missing evidence is never a pass.

## Reproduce

Python 3.12+, standard library only; `pdftotext` is optional for source extraction.

```sh
python research/scripts/fetch_sources.py
python research/scripts/experiments.py
python research/scripts/validation.py
python research/scripts/extended_experiments.py
```

Run from the parent directory of this folder. If this ZIP is unpacked directly as the working directory, omit `research/` in paths. Experiments use fixed seeds. Wall times vary; numbers are hosted-Linux Python prototype measurements, not JavaScript/WASM/iPhone performance. `data/` contains raw observations, fixtures, summaries and the run log. `sources/manifest.json` records URLs, bytes, access time and hashes; failures are retained. Successful download is not equivalent to full-text review. `prototypes/chess6.py` is a small validation engine, not production code or a strength claim.

## Delivery status

All requested document slots and A–J exploratory experiment slots are supplied. This does **not** mean every research question has been resolved: variant balance, human enjoyment, 6×6 accuracy calibration, full competition-adjudication verification, production engine strength, real-device packaging/performance, and economy retuning remain explicit gates. No claim of superhuman play, validated psychometrics, completed release or demonstrated hundreds-hour retention is made.

The final design is actionable with staged evidence gates. Claude must implement missing calibration/verification work rather than treating experimental parameters as established facts. No full game implementation was started here.

Final review corrections are recorded in `reviews/` and document14. Run `python research/scripts/funded_ledger.py` for the added funded retail/settlement study. The Markdown files are the authoritative handoff. `sources/variant_fetches.json` records additional historical-variant access failures.

Optional differential rules verification:

```sh
python -m pip install pyffish==0.0.90
python research/scripts/oracle_validation.py
```

The pyffish binary is not bundled; the pinned version, engine identity and binary hash of the run are in data/oracle_validation.json. It is a GPL-licensed research dependency. Optional figure regeneration requires matplotlib3.10.8 and `scripts/plot_results.py`. See `figures/research_findings.pdf` for an exportable results figure.

## Document index

- [01_EXECUTIVE_VISION.md](01_EXECUTIVE_VISION.md)
- [02_RESEARCH_AND_SOURCES.md](02_RESEARCH_AND_SOURCES.md)
- [03_GAMEPLAY_LOOP_AND_PLAYER_PSYCHOLOGY.md](03_GAMEPLAY_LOOP_AND_PLAYER_PSYCHOLOGY.md)
- [04_SIX_BY_SIX_CHESS_RULES.md](04_SIX_BY_SIX_CHESS_RULES.md)
- [05_ENGINE_ARCHITECTURE_AND_BENCHMARKS.md](05_ENGINE_ARCHITECTURE_AND_BENCHMARKS.md)
- [06_RATINGS_AND_CHESS_INTELLIGENCE.md](06_RATINGS_AND_CHESS_INTELLIGENCE.md)
- [07_MOVE_ANALYSIS_AND_COACHING.md](07_MOVE_ANALYSIS_AND_COACHING.md)
- [08_AI_COMPETITORS_AND_LEAGUES.md](08_AI_COMPETITORS_AND_LEAGUES.md)
- [09_PREDICTION_MARKET_MATHEMATICS.md](09_PREDICTION_MARKET_MATHEMATICS.md)
- [10_ECONOMY_AND_PROGRESSION.md](10_ECONOMY_AND_PROGRESSION.md)
- [11_VISUAL_DESIGN_AND_UX.md](11_VISUAL_DESIGN_AND_UX.md)
- [12_TECHNICAL_ARCHITECTURE.md](12_TECHNICAL_ARCHITECTURE.md)
- [13_SIMULATION_RESULTS.md](13_SIMULATION_RESULTS.md)
- [14_ADVERSARIAL_AUDIT.md](14_ADVERSARIAL_AUDIT.md)
- [15_IMPLEMENTATION_MILESTONES.md](15_IMPLEMENTATION_MILESTONES.md)
- [16_ACCEPTANCE_TESTS.md](16_ACCEPTANCE_TESTS.md)
- [17_CLAUDE_CODE_MASTER_PROMPT.md](17_CLAUDE_CODE_MASTER_PROMPT.md)
- [18_DECISION_LOG_AND_OPEN_RISKS.md](18_DECISION_LOG_AND_OPEN_RISKS.md)

- [Research figure](figures/research_findings.pdf)
- [Original mandatory intelligence expansion](requirements/INTELLIGENCE_EXPANSION.md)
