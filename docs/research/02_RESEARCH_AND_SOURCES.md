# Research register and evidence limits

All retrieved artifacts are in `sources/`, with hashes and retrieval results in `manifest.json` and `additional_manifest.json`. Review here means targeted reading of relevant sections, not comprehensive replication of every paper. URLs below are source links; local snapshots make the evidence auditable. A 200 response can still be a landing page. Do not cite a blocked full text as read.

| ID | Source and URL | What was actually used |
| --- | --- | --- |
| los_alamos | ChessVariants, https://www.chessvariants.com/small.dir/losalamos.html | Specialist secondary rules reference: no bishops, no initial double pawn move, en passant or castling; historical context, not balance evidence. |
| fairy_variant | Fairy-Stockfish variant.cpp, https://raw.githubusercontent.com/fairy-stockfish/Fairy-Stockfish/master/src/variant.cpp | Retrieved source `losalamos_variant`: RNQKNR setup, six ranks/files, Q/R/N promotions, no double step/castling. Direct implementation evidence, not proof its build is correct. |
| fairy_docs | https://fairy-stockfish.github.io/variants/ | Variant-oriented engine capabilities; must test exact pinned build. |
| fairy_license / stockfish_license | Corresponding repository Copying.txt | GPLv3-family terms require source/license compliance; no claim a WASM boundary eliminates obligations. |
| glicko2 | Mark Glickman, https://www.glicko.net/glicko/glicko2.pdf | Original algorithm, iterative volatility root solve and worked example. Used directly in code. |
| glicko | https://www.glicko.net/glicko/glicko.pdf | Rating uncertainty and periods. |
| elo_fide | FIDE rating regulations, https://handbook.fide.com/chapter/B022024 | Standard chess administration context, not a mapping from Crown to FIDE ratings. |
| lmsr | Robin Hanson, https://mason.gmu.edu/~rhanson/mktscore.pdf | Market scoring rules, logarithmic structure and conditional information aggregation. |
| combinatorial | Hanson, https://mason.gmu.edu/~rhanson/combobet.pdf | Combinatorial-market motivation/complexity; arbitrary conditional markets are deliberately not a launch primitive. |
| proper_scores | Gneiting & Raftery (2007), https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf | Proper scoring definitions and probabilistic evaluation; used for Brier/log scoring. |
| sdt | Ryan & Deci (2000), https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf | Autonomy, competence, relatedness; contextual design guidance, not proof our progression works. |
| alpha_zero | Silver et al., https://arxiv.org/pdf/1712.01815 | Neural/self-play feasibility at a very different compute scale; not evidence local mobile training is feasible. |
| wcag | W3C WCAG 2.2, https://www.w3.org/TR/WCAG22/ | Contrast, keyboard access, target sizes. AA target-size floor and AAA enhanced targets are distinct; choose 44px product targets. |
| webkit_storage | WebKit, https://webkit.org/blog/14403/updates-to-storage-policy/ | Quota, eviction, best-effort vs persistent storage; motivates backup/export. |
| workers / indexeddb | MDN Web Workers and IndexedDB guides | Worker isolation and transactional local storage architecture. |
| wasm | https://web.dev/articles/webassembly-threads | Threading/isolation considerations; single-thread fallback required. |
| swiss | FIDE Dutch system, https://handbook.fide.com/chapter/C0403 | Pairing complexity reference. Do not advertise full FIDE Swiss compliance for a simplified scheduler. |
| react_license / vite_license / dexie_license | Retrieved repository licenses | MIT React/Vite; inspect Dexie's complete license for chosen files. Pin exact versions at implementation. |
| tauri_license_fixed | https://raw.githubusercontent.com/tauri-apps/tauri/dev/LICENSE-MIT | Tauri MIT option; initial filename failed. Audit bundled dependencies separately. |

## Sources located but not substantively reviewed

- Ericsson, Krampe & Tesch-Römer (1993), DOI 10.1037/0033-295X.100.3.363: blocked. Deliberate practice is a research direction, not a quantified guarantee here.
- Sala & Gobet (2016), DOI 10.1016/j.edurev.2016.02.002: blocked. Do not assert a numerical chess-to-IQ transfer benefit.
- Burgoyne et al. (2016), DOI 10.1016/j.intell.2016.08.002: blocked. Cognitive correlation is not treated as causal improvement.
- Handbook of Modern Item Response Theory, DOI 10.1007/978-1-4757-2691-6: landing page retrieved, not book text. The 2PL equations below are a proposed familiar statistical model requiring validation.
- Bradley–Terry DOI 10.1093/biomet/39.3-4.324: blocked. Formula selection is specified as our modeling choice, not a replication.
- MCTS survey DOI 10.1109/TCIAIG.2012.2186810 returned 202 with zero bytes. No full-text review claim.
- Flow chapter DOI 10.1007/978-94-017-9088-8_15 returned a landing page. Flow and challenge matching remain design hypotheses, not a demonstrated engagement result.
- Wikipedia Minichess and Shannon history fetches blocked. No comparative historical variant data inferred from these failures.

## Evidence discipline

No reliable game-tree/state-space counts for this exact ruleset were established. Initial branching/perft is not total complexity. Standard-board complexity numbers are not imported. No claim of 6×6 first-player advantage, competitive draw rate, solved status, or optimal game duration is made. The B variant in experiments is explicitly invented and not mislabeled as Diana or another historical variant.

A follow-up research gate must obtain additional credible historical 6×6 rulesets and human play data. The default choice is justified by clear rules and an existing engine implementation, not by experimentally proven superiority. Open-source branches retrieved at `master` are mutable; snapshots have hashes but implementation must pin commit IDs and build provenance.

## Executed implementation reference

PyPI `pyffish==0.0.90` was installed as an isolated optional research dependency and executed as a second move-generation implementation. Its reported engine is Fairy-Stockfish230826 LB. The10,000-position and perft comparison is in document13. This is a specific available Los Alamos-compatible native library, not evidence that the newest Fairy master, a WASM build or an iPhone engine was benchmarked. No dependency binary is redistributed in this package.
