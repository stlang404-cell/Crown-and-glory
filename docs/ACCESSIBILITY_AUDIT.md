# Accessibility audit (v1.0, package V)

Tool: `e2e/a11y.mjs` — axe-core 4.11 (devDependency; rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and
best-practice) plus the game's own checks, on 30 screens (every main screen, a market, a competitor, an analysis, a live
match, a game in progress) at 1366 px and at 390 px (touch, reduced motion), on a populated career. Chromium only
(Playwright); no screen reader, Safari or physical device was used. Contrast is checked for the default theme only.

Before = the same script against a build of the base commit 0b10f79; after = this branch.

| Measure (30 screens) | Before 1366 | Before 390 | After 1366 | After 390 |
|---|---|---|---|---|
| axe violations (nodes) | 49 | 48 | 0 | 0 |
| of which serious + critical | 30 | 30 | 0 | 0 |
| axe rules violated | 8 | 8 | 0 | 0 |
| controls under 24 px (not inline text links) | 110 | 49 | 0 | 0 |
| Tab stops without a visible focus ring (first 40 per screen) | 0 | 2 | 0 | 0 |
| skipped heading levels | 18 | 17 | 0 | 0 |
| screens without exactly one h1 | 0 | 0 | 0 | 0 |

Before, by axe rule (nodes at 1366/390): heading-order 18/17, color-contrast 9/9, aria-allowed-attr 7/7 (aria-pressed on
role="tab"), scrollable-region-focusable 6/6, aria-prohibited-attr 4/4 (aria-label on a plain div), aria-required-children
3/3 (board role="grid" without rows), target-size 1/1, empty-table-header 1/1.

Keyboard and screen-reader checks (before → after): full keyboard-only game pass → pass; promotion chosen with the
keyboard **fail → pass** (the promotion chooser did not take focus); result dialog receives focus **fail → pass**; board
squares named "e5, white pawn" pass → pass; one polite announcement per move pass → pass (the before run's figure came
from an earlier version of this check that counted distinct texts); clocks not in a live region pass → pass;
prefers-reduced-motion: no running infinite animation pass → pass.

## Fixes
* Board: grid → row → gridcell structure, roving focus that remembers the last square, Home/End, Escape cancels a
  selection, instructions via aria-describedby; the promotion chooser is a modal dialog that takes focus (arrow keys move
  between pieces, Escape cancels).
* Result dialog: the primary button takes focus.
* Headings follow the outline (h1 → h2 → h3) on 15 screens; classes keep the previous sizes.
* Scroll containers that overflow become focusable, labelled regions (`src/ui/scrollRegion.ts`), with unique labels.
* Tabs use aria-selected; captured-piece groups have role="group"; the actions column header has text.
* Target sizes: disclosure summaries, sliders, inline name buttons, rank link, arena player names reach 24 px.
* Contrast: locked achievement descriptions are no longer dimmed with the emblem; the "You" chip on the rank ladder.
* Date inputs show a focus ring. All CSS for these is in `src/ui/a11y.css` (layout-neutral, existing tokens).
