# Visual identity and interaction specifications

Original direction [D]: “a nocturnal federation observatory.” Deep ink surfaces, warm ivory board, restrained brass achievement accents and cool mint information highlights. Pixel portraits and venue scenes establish character; text and chart axes remain crisp scalable typography, not tiny raster letters. No copied proprietary chess pieces, logos or financial-terminal layouts.

Research references are functional: chess interfaces center the board; sports-management interfaces surface schedules/standings; financial interfaces distinguish positions and quotes. This package did not conduct a systematic screenshot study or asset-license clearance. Treat the direction as an original proposal requiring design/playtest validation, not a demonstrated superior style.

Tokens [D]: background#10151E, panel#1B2431, primary text#F1EBDD, muted#B3BFCD, accent#D8B56C, positive#83D6B0, negative#ED9B9B. Verify every actual pairing against WCAG instead of assuming these colors pass. Body16px minimum; labels14px; board coordinates12–14px with optional enlargement. Use an open licensed font pinned in the asset manifest; system font fallback offline. Pixel art rendered nearest-neighbor at integer scales, never used for analytical text.

## Information architecture

Bottom tabs on phone: Play, Learn, World, Exchange, Profile. Exchange can be hidden; Library accessible directly from Profile and postgame. Desktop adds a left navigation rail. Main dashboard shows one recommended next action, recent actual game, current event and pending reports. Wealth is not the dominant first-launch number.

Desktop match wireframe:

```text
[Opponent portrait | name | rating/RD | clock]
[6x6 board, dominant ~60% width] [moves | event | draw/resign]
[Player | assistance badge | clock]
[Legal move input / accessible square description]
```

Phone: opponent/clock → full-width board → own clock → move strip → collapsed details. Never require horizontal scrolling for the board; drag and tap-to-move both supported, with promotion sheet, cancel and clear selected-square state. Keyboard coordinates, move announcements and screen-reader board alternatives required. Resign confirmation prevents accidental destructive taps; routine moves never require double confirmation.

Postgame wireframe:

```text
[Result | accuracy + coverage | rating delta and explanation]
[Board] [selected move, grade, before/after, best line, evidence]
[Evaluation graph, keyboard/touch accessible]
[Move timeline]
[One training recommendation → more detail]
```

At narrow widths stack board/details, keep next/previous controls persistent and show text equivalents for graphs. Evaluation bars use bounded visual scaling and a separate mate badge; never draw mate as a giant centipawn spike. Timeline grade colors also have icons/labels; Brilliant is withheld when unverified.

## Screen contracts

| Screen | Primary action and evidence |
| --- | --- |
| Dashboard | Play next match or resume, factual recent progress and report status. |
| Chessboard | Board, clocks, legal input, assistance state, result. |
| Postgame | Exact move review, alternatives, retry mistake. |
| Personal profile | Records, ranks, peak/uncertainty, career filters. |
| Rating history | Rating band and dated promotion/relegation events; pool selector. |
| Intelligence lab | Ten skills with evidence n, intervals, assessments; insufficient-data states. |
| Academy | Targeted verified exercises, training/held-out distinction, attempt history. |
| Chess Library | Search/sort/filter, bookmark, replay, analyze/export, report versions. |
| Tournament hub | Format, schedule, rules, registration/qualification, escrowed prizes. |
| League | Standings, tie-break explanations, promotion zone and fixtures. |
| Match viewer | Live legal board, public clocks, commentary templates; abstract match labeled summary-only. |
| Exchange | W/D/L quotes and history, event restrictions, order preview, risk. |
| Portfolio | Cash/reserve/exposure, executable liquidation value, realized P&L/fees. |
| Club | Capacity, upkeep, budget forecast, strategic projects, conflicts. |
| Career history | Chronological games, titles, institutions and economic events, all linked. |

## Accessibility and ergonomics

WCAG2.2 AA target:4.5:1 ordinary text and3:1 large text/essential nontext [R: wcag]. Prefer44×44 CSS-pixel controls as product standard (enhanced AAA size; AA floor24 has exceptions). Six board squares at360px viewport can remain near50px after margins. Support safe-area insets and200% text zoom, landscape, right/left-hand preferences and screen-reader interaction without drag dependency. Reduced motion disables move travel, chart animation and portrait loops. Optional sound never carries unique information. Color-blind-safe labels, visible focus, no hover-only controls.

Analysis remains responsive with progress/cancel controls. Never show fake chart lines while analysis is pending. Progressive disclosure: summary first, detailed PV/uncertainty on demand. Backup prompts are informative and nonblocking, triggered by meaningful storage status changes, never a daily retention nudge.

Validation must test actual iPhone Safari/PWA and Windows with touch/keyboard/screen reader where available. None of those device checks was completed in this research package.
