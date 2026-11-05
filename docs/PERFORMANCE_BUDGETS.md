# Performance budgets (v1.0, package V)

Measured by `e2e/perf-budgets.mjs` against the production build (`npx vite build`, `scripts/serve.mjs`) in Chromium
(Playwright), on a **10,240-competitor** save, in two configurations:

* **Desktop**: 1366×900, no throttling.
* **Phone proxy**: 390×844, mobile + touch emulation, Chromium CPU throttling 4×. This is a *proxy* for a phone, not a
  phone: nothing here was measured on an iPhone, in Safari or on WebKit. Chromium's throttling slowed the engine workers
  only slightly (engine-reported time of a 30,000-node search: 116 ms desktop vs 156 ms phone proxy), so the phone engine
  figures understate a real phone.

Each budget is checked on **p95** over ≥ 10 runs (the median is reported too). Budgets were set before measuring, from the
interaction they serve: 100 ms for a direct response on a phone (half that on desktop), 300 ms/1 s for a screen change,
engine moves within their level's own time cap plus worker overhead.

**Host:** shared 4-core VM (Intel Xeon 2.8 GHz) that was running other packages' work at the same time. Load average
during the reported run: 9.2 → 10.6 (on 4 cores), i.e. the browser had well under one core on average. Time-based
results are therefore pessimistic and noisy; the same build measured 12 minutes earlier (run 2, load 9.7 → 10.2) is
shown for comparison. A rerun on an idle machine is still needed before release.

UI latencies (transition, move input, quote, replay, search) stop at the first DOM change the action causes **plus two
animation frames** (the frame that paints it), so about 16–33 ms of every figure is frame scheduling. Move input uses
real Playwright clicks and starts at the click event's timestamp. Engine, trade, round, tick and save call the same
service methods the screens use.

## Results (run 3, 2026-11-05 01:00 UTC; run 2 in brackets)

| Budget | Desktop limit | Desktop median / p95 | Verdict | Phone limit | Phone median / p95 | Verdict |
|---|---|---|---|---|---|---|
| Startup → interactive Dashboard (warm cache, 10,240 save) | 3,000 | 452 / 1,022 (446 / 653) | pass | 8,000 | 1,261 / 1,548 (1,182 / 1,411) | pass |
| Screen transition (main navigation) | 300 | 101 / 660 (59 / 275) | **FAIL** (pass) | 1,000 | 240 / 733 (205 / 334) | pass |
| Move input → board painted | 50 | 34 / 122 (57 / 91) | **FAIL** | 100 | 137 / 249 (129 / 278) | **FAIL** |
| Engine move L1 (cap 400 ms) | 600 | 4 / 11 | pass | 900 | 9 / 22 | pass |
| Engine move L2 (cap 400 ms) | 600 | 1 / 4 | pass | 900 | 4 / 11 | pass |
| Engine move L3 (cap 500 ms) | 700 | 2 / 16 | pass | 1,000 | 5 / 54 | pass |
| Engine move L4 (cap 600 ms) | 800 | 2 / 6 | pass | 1,100 | 3 / 8 | pass |
| Engine move L5 (600 nodes) | 600 | 4 / 15 | pass | 900 | 8 / 22 | pass |
| Engine move, featured budget (30,000 nodes, full search) | 2,000 | 124 / 405 | pass | 6,000 | 158 / 365 | pass |
| Market quote (shares typed → quote painted) | 100 | 23 / 552 (20 / 79) | **FAIL** (pass) | 250 | 22 / 67 | pass |
| Market trade (buy committed) | 300 | 27 / 108 | pass | 1,000 | 65 / 124 | pass |
| Federation round advance (world + commit; featured games excluded) | 1,500 | 602 / 1,399 (400 / 801) | pass | 3,000 | 2,057 / 5,673 (1,885 / 4,482) | **FAIL** |
| Live scheduler tick (scheduling pass) | 50 | 0.2 / 0.5 | pass | 150 | 1.0 / 3.8 | pass |
| Save a game record (IndexedDB) | 50 | 0.7 / 2.3 | pass | 150 | 5.6 / 7.7 | pass |
| Replay playback step (→ painted, analysis finished) | 50 | 30 / 81 (27 / 38) | **FAIL** (pass) | 100 | 115 / 391 (109 / 220) | **FAIL** |
| Roster search at 10,240 (query → results painted) | 200 | 39 / 149 | pass | 600 | 78 / 116 | pass |
| JS heap after the tour, after GC | 300 MB | 27.6 MB | pass | 300 MB | 30.8 MB | pass |

Engine levels L1–L5 are node-capped (600–8,000 nodes) and finish far inside their time caps; the figures are real
searches on middlegame positions outside the opening book (engine-reported nodes recorded in the results file).
Replay steps while the game's own analysis was still running: desktop 69 / 228 ms, phone 140 / 691 ms (not budgeted;
the analysis worker's progress updates re-render the screen).

## Violations: what they are and what was done

* **Roster search (fixed before the reported runs).** The Competitors screen re-rendered all 100 rows (three emblems
  each) on every keystroke and on every live-scheduler notification (about twice a second). Rows are now a memoised
  component and the list follows a deferred copy of the query (`useDeferredValue`), so typing paints first. The only
  measurement of the old code was taken under a load average of ~34 (desktop 729 / 1,560 ms) and is not comparable, so
  no improvement figure is claimed; the new code passes both budgets in both runs.
* **Move input and replay step (consistent, both runs).** A desktop probe measured the synchronous handler work of a move at
  0.2–5 ms; a CPU profile of replay steps on the phone proxy shows the time is layout (the board's slide animation reads
  the squares' positions, forcing a layout of the whole page, ~29 ms per step at 4×) and frame scheduling on a starved
  CPU. No change was made: the layout cost belongs to the page's size and styling (package U is restyling the same
  screens) and a containment change would need its own visual verification. Proposal: `contain: layout paint` on the
  board and the move list, then re-measure on an idle machine.
* **Phone round advance (consistent).** Medians 1.9–2.1 s, p95 4.5–5.7 s at 4× under load (v0.11 measured a 799 ms median
  at 4× on a quieter machine). The slowest rounds are season ends. Federation round processing is not this package's
  area (packages S and T are changing competition and economy code); left to them, with these numbers.
* **Desktop transition and quote (run 3 only).** Single outliers (660 ms, 552 ms) among otherwise 20–340 ms samples;
  both passed in run 2. Treated as load noise, not fixed; to be confirmed on an idle machine.
* Startup is package R's area: measured only (passes both budgets).

Raw results: `e2e/artifacts/perf-budgets/results.json` (all samples, load averages, engine-reported times) and `log.txt`.
