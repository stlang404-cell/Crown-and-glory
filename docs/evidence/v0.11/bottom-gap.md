# Intermittent "bottom gap" in e2e/new-career.mjs (v0.11 package Q)

**Symptom.** `layout … 390 px` failed once on the merged build (bottom gap > 2 px) and passed on a rerun.

**What the check measured (before).** `scrollTo(0, scrollHeight)`, wait 300 ms, then
`gap = scrollHeight − (scrollTop + innerHeight)`. Any content that grows *below* the scroll anchor inside that
300 ms window shows up as a gap, even though the page can be scrolled to its (new) end.

## Reproduction (build of 12c386c, served by scripts/serve.mjs, Playwright Chromium, 4-core VM)

| Runs | Conditions | Result |
|---|---|---|
| 20 full journeys, sequential | load average 2–6 | 20/20 pass; but in 20/20 runs the Career Passport desktop page grew after the measurement (3,754 → 4,517–4,986 px); the other 80 measurements were stable |
| 8 full journeys | CPU throttling ×4 (CDP) | 8/8 pass; same late growth on the desktop Passport |
| 12 full journeys, 4 in parallel | load average 7–10 | 11/12 pass, 1 unrelated timeout (`rating-event` not visible in 30 s) |
| Sweep: the old check started 0…1,600 ms after the Passport loads | 1366 and 390 px | 34/34 pass: growth *above* the viewport (legacy customisation panel, +763 px at ~900 ms) is compensated by scroll anchoring |
| The old check at 390 px repeated while the finished game's **background analysis** is still running | 6 runs | **6/6 produce a failing measurement** at the moment the analysis completes: gap 981, 998, 1,017, 1,017, 1,034, 981 px; 300 ms later gap 0 px in every run |

Failing measurement (typical): height at scroll 7,285 px → 8,266 px at measurement; `scrollTop` 6,441 px;
`innerHeight` 844 px; the last element, the Played Like Records panel (`played-like-slot`), grew from 152 px
(placeholder "Records appear after your finished games are analysed") to 1,133 px; analysis job `running → complete`.
No safe-area padding, fonts, images, update notice, ceremony or identity-header expansion were involved (fonts
`loaded`, header height constant at 74 px desktop, document height constant in the next 2.5 s).

## Root cause

A measurement race, not a layout bug. The Career Passport renders in stages; its **last** panel (Played Like Records)
expands by ~1,000 px at 390 px when the background analysis of the just-played rated game completes. On a loaded
machine that can happen while the check's 300 ms timer is running; because the growth is at the bottom (below the
scroll anchor), scroll anchoring cannot compensate and the measured gap equals the growth. Re-measuring once the page
has settled always gives 0 px: the page is fully scrollable to its end at 390 px.

## Fix (test only; the check stays strict)

`layout()` in `e2e/new-career.mjs` now measures only a settled layout: network idle, `document.fonts.ready`, the same
document height in five samples 200 ms apart, and the same height at the scroll and at the measurement; otherwise it
measures again (up to 8 times, and fails as "never settled" if the page keeps changing). It still requires horizontal
overflow ≤ 1 px and bottom gap ≤ 2 px.

## After

| Runs | Result |
|---|---|
| 15 full journeys (fixed check), sequential, load 5–8 | 15/15 pass; 4/15 needed a second measurement because the Passport grew during the first (these are the runs the old check left to chance) |
| Fixed check at 390 px while the background analysis is running, 2 runs × 3 checks | 6/6 pass (gap 0 px) |
| 5 runs of `e2e/new-career.mjs` on the final build | 5/5 pass (2 needed a second measurement) |
