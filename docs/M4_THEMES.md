# M4 visual identity: themes, board palettes and accessibility

> **v1.0 update (package U):** the themes were retuned to the royal palette (royal blue, emerald, amethyst,
> burgundy, gold, silver), Obsidian is now "Obsidian & Burgundy" (gold accent, burgundy buttons), Midnight uses
> royal-blue buttons, and a fourth theme, **Emerald & Gold** (`emerald`), was added. Theme ids are unchanged. The
> contrast audit below is historical; the current gate is `tests/contrast.test.ts` (see docs/DESIGN_SYSTEM.md).

Crown & Calculation now ships three complete colour themes and an independent board palette. Every screen
reads its colours from CSS custom properties, so the theme applies to the shell, panels, chips, charts,
insignia, the brand mark, clocks, focus rings and the board without per-screen code.

## How it works

| Piece | Where |
| --- | --- |
| Theme and board tokens (hex only, audited) | `src/ui/themes.css`: `[data-theme="obsidian" \| "midnight" \| "ivory"]` and `[data-board="walnut" \| "slate" \| "green" \| "mono"]` blocks |
| Derived tints (`--accent-soft`, `--accent-line`, `--sq-last`, `--sq-sel`) | `src/ui/styles.css`, built with `color-mix()` and re-declared on every `[data-theme]` / `[data-board]` element so previews resolve their own colours |
| Preference module | `src/ui/theme.ts`: `THEMES`, `BOARDS`, `MOTIONS`, `getPrefs` / `setPrefs` / `setTheme` / `setBoard` / `setMotion`, `applyPrefs`, `prefersReducedMotion`, `subscribePrefs` |
| Storage | `localStorage["crown.display.v1"] = {theme, board, motion}`. Every read and write is wrapped in try/catch; anything missing, invalid or unreadable falls back to the defaults (Obsidian & Crimson, theme board, follow system motion). Display preferences are not part of the IndexedDB save schema or backups |
| Pre-paint | An inline script in `index.html` sets `data-theme`, `data-board`, `data-motion` and the `theme-color` meta before the stylesheet paints, so there is no flash of the wrong theme. `src/main.tsx` calls `applyPrefs()` again (idempotent). `tests/theme.test.ts` checks that the inline script knows every theme and board id |
| Settings screen | `#/settings` (`src/ui/SettingsScreen.tsx`): theme cards with a live preview (each card carries its own `data-theme`), board cards with mini boards, a motion control, an about/version section and a reset button. It's in the side rail and is the sixth phone tab |
| Motion | `data-motion="system"` respects `prefers-reduced-motion`. `reduce` always disables piece slides and transitions. `full` keeps them even when the OS asks for reduced motion |
| Contrast audit | `node tools/contrast/check-themes.mjs` (add `--md` for the tables below). It exits non-zero on any failing pair |
| Screenshots | `node e2e/m4-themes.mjs http://127.0.0.1:4600/` against `node scripts/serve.mjs --dir dist --port 4600` writes to `docs/evidence/m4-themes/` and fails on horizontal overflow |

## Themes

### Obsidian & Crimson (default)

The brief's starting palette was background `#111318`, surface `#252932`, text `#F2EDE3`, accent `#C84C5A`
and secondary `#8EA7C1`. The refinements below keep those colours where they pass WCAG and move them only where they fail:

* `#C84C5A` on the panel is only about 3.6:1, which is too low for text. It became two tokens.
  `--accent` `#ea8592` is a lighter rose crimson that passes for text and links (5.7–7.3:1).
  `--accent-strong` `#b23c4b` → `#9c3140` is the deeper crimson for fills. The primary button shows warm white `#fff8f2` on it (5.5–6.8:1).
* Surfaces are graphite rather than navy: page `#111318`, panel `#1a1d24`, raised `#252932` (the brief's surface), with a faint crimson glow at the top of the page.
* Ivory text `#f2ede3`. Muted text `#aeb3bd` is a neutral grey, never below 6.9:1.
* `#8ea7c1` stays as the restrained cool secondary (`--accent-2`), used for one exchange price series and similar marks.
* **Status colours were re-tuned so they don't collide with crimson.** Negative is a coral/vermilion `#f4a173`, not red.
  That keeps losses distinct from the brand accent (ΔE 30), and losses always carry a "−" sign or a label as well.
  Positive is mint `#7fd3a6` and info is steel blue `#93bde6`.
* The running clock is a lit ivory face `#f2ede3` with ink text. The low-time clock is a red fill `#b8323f`, so "your clock is running" no longer looks like "you are low on time" (5.05:1 between the two fills).
* The board is ivory `#e8e1d4` / graphite `#696f7d` with a crimson move highlight. The black-piece outline is champagne `#d9c6a4` rather than brass.

### Midnight & Gold

This is the v0.3 look, kept close to the original tokens. Dark squares moved from `#5a6c80` to `#5f7187` so the black
piece bodies reach 3:1 against them. The running clock stays gold.

### Ivory & Slate (light)

This is the light theme. Warm paper surfaces (`#f2efe8` page, `#fcfbf8` panel) carry slate-ink text `#1c2129` and
a slate-blue accent `#34567c` with white button text. The oxblood `#8c3445` is the secondary and appears in the brand crown,
which ties the theme back to the Crimson identity. The status colours are deep and saturated for a light
background: green `#1b6e45`, brick red `#b0352b` and violet-indigo info `#5a45a8`. Info is violet rather than blue so it stays apart from the slate accent.
The running clock is pale slate `#d3e0ee`, which separates it from the red low-time fill.
The default board is ivory `#ede7db` on slate `#627489`, with an amber move highlight.

## Board palettes

The board is chosen independently of the theme. "Theme default" uses the theme's own board.

| Board | Light | Dark | Highlight | Coordinates (light / dark sq.) | Frame |
| --- | --- | --- | --- | --- | --- |
| Theme default: Obsidian | `#e8e1d4` | `#696f7d` | `#d9566a` crimson | `#40444d` / `#ffffff` | graphite |
| Theme default: Midnight | `#e9dcc0` | `#5f7187` | `#d8b56c` gold | `#3d4b5a` / `#ffffff` | dark walnut and brass |
| Theme default: Ivory | `#ede7db` | `#627489` | `#e0a43a` amber | `#3e4a58` / `#ffffff` | slate |
| Walnut | `#eed8b4` | `#94694a` | `#f2cc55` | `#5a3c22` / `#fff7ea` | walnut |
| Slate | `#dfe5ec` | `#5f7288` | `#f0c45a` | `#36475a` / `#ffffff` | blue-grey |
| Green | `#ecedd3` | `#587f41` | `#f3e15a` | `#3f5c2e` / `#ffffff` | dark green |
| Monochrome | `#e6e6e6` | `#6e6e6e` | `#4f95e0` blue | `#3a3a3a` / `#ffffff` | charcoal |

The last move is shown with the highlight colour at 44 % opacity and the selected square at 72 %. Check is a radial
glow in a separate vermilion `--sq-check`, so it never reads as a move highlight. Legal-move dots and rings are
translucent ink. Each dark square sits in a narrow luminance window (relative luminance ≈ 0.15–0.18) that satisfies three limits at once:

* white coordinates at ≥ 4.5:1;
* ≥ 3:1 against the light square;
* ≥ 3:1 against the ink body of the black pieces (`#1d2430`).

The ivory pieces keep their dark outline, so they stay readable on light squares at more than 12:1.

## Design rationale and polish

* **Typography.** The system UI sans (Inter, Segoe UI and others) is used for all text. Display headings, the brand name and the result title use a
  system serif stack (Iowan Old Style, Palatino, Book Antiqua, Charter, Georgia) for a federation or almanac feel.
  No webfonts are downloaded, so the app stays fully offline. Uppercase micro-labels have wider tracking, and numbers use tabular figures.
* **Shell.** The rail has a separated brand block and a theme-tinted active gradient. The current section is marked by a small
  *pixel-stepped* indicator, and the active icon takes the accent colour. The phone tab bar has six columns (Settings added), a blurred
  translucent background and a pixel-stepped top marker on the active tab. Labels ellipsise instead of overflowing.
* **Panels and chips.** Panels use a subtle two-stop surface gradient with a hairline top highlight. Chips are squarer (6 px
  radius, a quiet nod to the pixel art) with a 9 % tinted fill in their status colour. Grid children no longer inherit the
  stacked-panel top margin, which fixes the misaligned first card on the Play screen.
* **Pixel art** stays where it was: portraits, the brand mark (now theme-coloured: crimson crown, gold or oxblood), division
  insignia (`--ins-1…8` per theme, all at least 3:1 on the panel) and a faint stepped motif in the hero corner.
* **Charts** read only tokens:
  * The eval graph and eval bar use `--eval-black` and `--eval-white`. White's share is always the light area in every theme.
  * Grid lines use `--chart-grid` and axis text uses `--muted`.
  * The rating band is an `--info` tint and the rating line is `--accent`.
  * The exchange price chart now has a legend, and the draw series is dashed, so the series don't rely on colour alone.
* **Focus.** `--focus` gives a 3 px outline at ≥ 5:1 against page and panel in every theme. Board squares draw the ring inside
  the square, so it isn't clipped. The Settings radio cards show focus with `:has(:focus-visible)`.

## Measured contrast (WCAG 2.2, computed from the hex tokens)

Body text needs at least 4.5:1. UI components and non-text graphics need at least 3:1. "Distinct" rows give CIE76 ΔE between status colours. The target is ΔE ≥ 25, and every status
also carries a sign, word or symbol. All pairs pass. Regenerate these tables with `node tools/contrast/check-themes.mjs --md`.

#### theme:obsidian

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Body text on page | `#f2ede3` on `#111318` | 15.93:1 | 4.5:1 | pass |
| Body text on panel | `#f2ede3` on `#1a1d24` | 14.45:1 | 4.5:1 | pass |
| Body text on raised surface | `#f2ede3` on `#252932` | 12.48:1 | 4.5:1 | pass |
| Muted text on page | `#aeb3bd` on `#111318` | 8.83:1 | 4.5:1 | pass |
| Muted text on panel | `#aeb3bd` on `#1a1d24` | 8.02:1 | 4.5:1 | pass |
| Muted text on raised surface | `#aeb3bd` on `#252932` | 6.92:1 | 4.5:1 | pass |
| Accent text / links on page | `#ea8592` on `#111318` | 7.32:1 | 4.5:1 | pass |
| Accent text on panel | `#ea8592` on `#1a1d24` | 6.64:1 | 4.5:1 | pass |
| Accent text on raised surface | `#ea8592` on `#252932` | 5.73:1 | 4.5:1 | pass |
| Secondary accent on panel (UI) | `#8ea7c1` on `#1a1d24` | 6.78:1 | 3:1 | pass |
| Primary button text (top stop) | `#fff8f2` on `#b23c4b` | 5.48:1 | 4.5:1 | pass |
| Primary button text (bottom stop) | `#fff8f2` on `#9c3140` | 6.82:1 | 4.5:1 | pass |
| Running clock text | `#111318` on `#f2ede3` | 15.93:1 | 4.5:1 | pass |
| Running clock vs low-time clock fill (UI, 3:1) | `#f2ede3` on `#b8323f` | 5.05:1 | 3:1 | pass |
| Low-time clock text | `#ffffff` on `#b8323f` | 5.89:1 | 4.5:1 | pass |
| Positive text on panel | `#7fd3a6` on `#1a1d24` | 9.45:1 | 4.5:1 | pass |
| Negative text on panel | `#f4a173` on `#1a1d24` | 8.19:1 | 4.5:1 | pass |
| Info text on panel | `#93bde6` on `#1a1d24` | 8.56:1 | 4.5:1 | pass |
| Warning text on panel | `#e8c477` on `#1a1d24` | 10.11:1 | 4.5:1 | pass |
| Positive text on raised surface | `#7fd3a6` on `#252932` | 8.16:1 | 4.5:1 | pass |
| Negative text on raised surface | `#f4a173` on `#252932` | 7.07:1 | 4.5:1 | pass |
| Focus ring vs page (UI, 3:1) | `#f09aa6` on `#111318` | 8.74:1 | 3:1 | pass |
| Focus ring vs panel (UI, 3:1) | `#f09aa6` on `#1a1d24` | 7.93:1 | 3:1 | pass |
| Control border vs panel (UI, 3:1) | `#6a707e` on `#1a1d24` | 3.40:1 | 3:1 | pass |
| Chart line (accent) vs chart bg | `#ea8592` on `#15171d` | 7.05:1 | 3:1 | pass |
| Chart axis text vs chart bg | `#aeb3bd` on `#15171d` | 8.52:1 | 4.5:1 | pass |
| Eval graph: White area vs Black area | `#e9e2d4` on `#23262e` | 11.74:1 | 3:1 | pass |
| Grade badge text on lightest grade | `#10121a` on `#c9cfa0` | 11.50:1 | 4.5:1 | pass |
| Grade badge text on darkest grade | `#10121a` on `#ef7d7d` | 7.03:1 | 4.5:1 | pass |
| Division 1 insignia vs panel (UI) | `#ea8592` on `#1a1d24` | 6.64:1 | 3:1 | pass |
| Division 2 insignia vs panel (UI) | `#e4dccd` on `#1a1d24` | 12.38:1 | 3:1 | pass |
| Division 3 insignia vs panel (UI) | `#d49a6a` on `#1a1d24` | 6.93:1 | 3:1 | pass |
| Division 4 insignia vs panel (UI) | `#93bde6` on `#1a1d24` | 8.56:1 | 3:1 | pass |
| Division 5 insignia vs panel (UI) | `#7fd3a6` on `#1a1d24` | 9.45:1 | 3:1 | pass |
| Division 6 insignia vs panel (UI) | `#b6bbc6` on `#1a1d24` | 8.76:1 | 3:1 | pass |
| Division 7 insignia vs panel (UI) | `#ab9ce0` on `#1a1d24` | 6.88:1 | 3:1 | pass |
| Division 8 insignia vs panel (UI) | `#8a93a3` on `#1a1d24` | 5.45:1 | 3:1 | pass |

#### board:obsidian (theme default)

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Light vs dark square (UI, 3:1) | `#e8e1d4` on `#696f7d` | 3.87:1 | 3:1 | pass |
| Coordinates on light squares | `#40444d` on `#e8e1d4` | 7.51:1 | 4.5:1 | pass |
| Coordinates on dark squares | `#ffffff` on `#696f7d` | 5.04:1 | 4.5:1 | pass |
| Black piece body vs dark square (UI, 3:1) | `#1d2430` on `#696f7d` | 3.10:1 | 3:1 | pass |
| White piece outline vs light square (UI, 3:1) | `#26211a` on `#e8e1d4` | 12.28:1 | 3:1 | pass |

#### distinct:obsidian

| Pair | Colours | ΔE (CIE76) | Target | Result |
| --- | --- | --- | --- | --- |
| positive vs negative | `#7fd3a6` / `#f4a173` | 65.6 | ≥ 25 | pass |
| positive vs info | `#7fd3a6` / `#93bde6` | 50.4 | ≥ 25 | pass |
| positive vs accent | `#7fd3a6` / `#ea8592` | 76.5 | ≥ 25 | pass |
| negative vs info | `#f4a173` / `#93bde6` | 68.4 | ≥ 25 | pass |
| negative vs accent | `#f4a173` / `#ea8592` | 30.5 | ≥ 25 | pass |
| info vs accent | `#93bde6` / `#ea8592` | 56.9 | ≥ 25 | pass |

#### theme:midnight

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Body text on page | `#f1ebdd` on `#10151e` | 15.39:1 | 4.5:1 | pass |
| Body text on panel | `#f1ebdd` on `#1b2431` | 13.15:1 | 4.5:1 | pass |
| Body text on raised surface | `#f1ebdd` on `#222d3d` | 11.69:1 | 4.5:1 | pass |
| Muted text on page | `#b3bfcd` on `#10151e` | 9.80:1 | 4.5:1 | pass |
| Muted text on panel | `#b3bfcd` on `#1b2431` | 8.38:1 | 4.5:1 | pass |
| Muted text on raised surface | `#b3bfcd` on `#222d3d` | 7.45:1 | 4.5:1 | pass |
| Accent text / links on page | `#d8b56c` on `#10151e` | 9.36:1 | 4.5:1 | pass |
| Accent text on panel | `#d8b56c` on `#1b2431` | 8.00:1 | 4.5:1 | pass |
| Accent text on raised surface | `#d8b56c` on `#222d3d` | 7.11:1 | 4.5:1 | pass |
| Secondary accent on panel (UI) | `#b8924a` on `#1b2431` | 5.40:1 | 3:1 | pass |
| Primary button text (top stop) | `#1a1408` on `#e3c37f` | 10.79:1 | 4.5:1 | pass |
| Primary button text (bottom stop) | `#1a1408` on `#c79f55` | 7.42:1 | 4.5:1 | pass |
| Running clock text | `#1a1408` on `#d8b56c` | 9.36:1 | 4.5:1 | pass |
| Running clock vs low-time clock fill (UI, 3:1) | `#d8b56c` on `#a43d3d` | 3.24:1 | 3:1 | pass |
| Low-time clock text | `#ffffff` on `#a43d3d` | 6.34:1 | 4.5:1 | pass |
| Positive text on panel | `#83d6b0` on `#1b2431` | 9.09:1 | 4.5:1 | pass |
| Negative text on panel | `#ed9b9b` on `#1b2431` | 7.27:1 | 4.5:1 | pass |
| Info text on panel | `#8fc3ee` on `#1b2431` | 8.34:1 | 4.5:1 | pass |
| Warning text on panel | `#f0c96a` on `#1b2431` | 9.88:1 | 4.5:1 | pass |
| Positive text on raised surface | `#83d6b0` on `#222d3d` | 8.08:1 | 4.5:1 | pass |
| Negative text on raised surface | `#ed9b9b` on `#222d3d` | 6.46:1 | 4.5:1 | pass |
| Focus ring vs page (UI, 3:1) | `#d8b56c` on `#10151e` | 9.36:1 | 3:1 | pass |
| Focus ring vs panel (UI, 3:1) | `#d8b56c` on `#1b2431` | 8.00:1 | 3:1 | pass |
| Control border vs panel (UI, 3:1) | `#6a7a90` on `#1b2431` | 3.57:1 | 3:1 | pass |
| Chart line (accent) vs chart bg | `#d8b56c` on `#1d2532` | 7.88:1 | 3:1 | pass |
| Chart axis text vs chart bg | `#b3bfcd` on `#1d2532` | 8.25:1 | 4.5:1 | pass |
| Eval graph: White area vs Black area | `#e9dcc0` on `#1d2532` | 11.35:1 | 3:1 | pass |
| Grade badge text on lightest grade | `#10151e` on `#c9cfa0` | 11.25:1 | 4.5:1 | pass |
| Grade badge text on darkest grade | `#10151e` on `#ef7d7d` | 6.88:1 | 4.5:1 | pass |
| Division 1 insignia vs panel (UI) | `#d8b56c` on `#1b2431` | 8.00:1 | 3:1 | pass |
| Division 2 insignia vs panel (UI) | `#c9c2b0` on `#1b2431` | 8.80:1 | 3:1 | pass |
| Division 3 insignia vs panel (UI) | `#c58b52` on `#1b2431` | 5.35:1 | 3:1 | pass |
| Division 4 insignia vs panel (UI) | `#8fc3ee` on `#1b2431` | 8.34:1 | 3:1 | pass |
| Division 5 insignia vs panel (UI) | `#83d6b0` on `#1b2431` | 9.09:1 | 3:1 | pass |
| Division 6 insignia vs panel (UI) | `#b3bfcd` on `#1b2431` | 8.38:1 | 3:1 | pass |
| Division 7 insignia vs panel (UI) | `#9a8cc9` on `#1b2431` | 5.19:1 | 3:1 | pass |
| Division 8 insignia vs panel (UI) | `#7d90a5` on `#1b2431` | 4.77:1 | 3:1 | pass |

#### board:midnight (theme default)

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Light vs dark square (UI, 3:1) | `#e9dcc0` on `#5f7187` | 3.68:1 | 3:1 | pass |
| Coordinates on light squares | `#3d4b5a` on `#e9dcc0` | 6.57:1 | 4.5:1 | pass |
| Coordinates on dark squares | `#ffffff` on `#5f7187` | 5.00:1 | 4.5:1 | pass |
| Black piece body vs dark square (UI, 3:1) | `#1d2430` on `#5f7187` | 3.12:1 | 3:1 | pass |
| White piece outline vs light square (UI, 3:1) | `#26211a` on `#e9dcc0` | 11.76:1 | 3:1 | pass |

#### distinct:midnight

| Pair | Colours | ΔE (CIE76) | Target | Result |
| --- | --- | --- | --- | --- |
| positive vs negative | `#83d6b0` / `#ed9b9b` | 64.8 | ≥ 25 | pass |
| positive vs info | `#83d6b0` / `#8fc3ee` | 46.6 | ≥ 25 | pass |
| positive vs accent | `#83d6b0` / `#d8b56c` | 48.5 | ≥ 25 | pass |
| negative vs info | `#ed9b9b` / `#8fc3ee` | 54.2 | ≥ 25 | pass |
| negative vs accent | `#ed9b9b` / `#d8b56c` | 39.8 | ≥ 25 | pass |
| info vs accent | `#8fc3ee` / `#d8b56c` | 69.0 | ≥ 25 | pass |

#### theme:ivory

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Body text on page | `#1c2129` on `#f2efe8` | 14.08:1 | 4.5:1 | pass |
| Body text on panel | `#1c2129` on `#fcfbf8` | 15.62:1 | 4.5:1 | pass |
| Body text on raised surface | `#1c2129` on `#f0ece4` | 13.72:1 | 4.5:1 | pass |
| Muted text on page | `#535a66` on `#f2efe8` | 6.05:1 | 4.5:1 | pass |
| Muted text on panel | `#535a66` on `#fcfbf8` | 6.71:1 | 4.5:1 | pass |
| Muted text on raised surface | `#535a66` on `#f0ece4` | 5.90:1 | 4.5:1 | pass |
| Accent text / links on page | `#34567c` on `#f2efe8` | 6.61:1 | 4.5:1 | pass |
| Accent text on panel | `#34567c` on `#fcfbf8` | 7.33:1 | 4.5:1 | pass |
| Accent text on raised surface | `#34567c` on `#f0ece4` | 6.44:1 | 4.5:1 | pass |
| Secondary accent on panel (UI) | `#8c3445` on `#fcfbf8` | 7.54:1 | 3:1 | pass |
| Primary button text (top stop) | `#ffffff` on `#3b5f88` | 6.61:1 | 4.5:1 | pass |
| Primary button text (bottom stop) | `#ffffff` on `#2e4d70` | 8.71:1 | 4.5:1 | pass |
| Running clock text | `#1c2129` on `#d3e0ee` | 12.06:1 | 4.5:1 | pass |
| Running clock vs low-time clock fill (UI, 3:1) | `#d3e0ee` on `#b0352b` | 4.62:1 | 3:1 | pass |
| Low-time clock text | `#ffffff` on `#b0352b` | 6.19:1 | 4.5:1 | pass |
| Positive text on panel | `#1b6e45` on `#fcfbf8` | 6.03:1 | 4.5:1 | pass |
| Negative text on panel | `#b0352b` on `#fcfbf8` | 5.99:1 | 4.5:1 | pass |
| Info text on panel | `#5a45a8` on `#fcfbf8` | 7.12:1 | 4.5:1 | pass |
| Warning text on panel | `#855600` on `#fcfbf8` | 6.10:1 | 4.5:1 | pass |
| Positive text on raised surface | `#1b6e45` on `#f0ece4` | 5.30:1 | 4.5:1 | pass |
| Negative text on raised surface | `#b0352b` on `#f0ece4` | 5.26:1 | 4.5:1 | pass |
| Focus ring vs page (UI, 3:1) | `#2e5f9a` on `#f2efe8` | 5.68:1 | 3:1 | pass |
| Focus ring vs panel (UI, 3:1) | `#2e5f9a` on `#fcfbf8` | 6.30:1 | 3:1 | pass |
| Control border vs panel (UI, 3:1) | `#8a8578` on `#fcfbf8` | 3.56:1 | 3:1 | pass |
| Chart line (accent) vs chart bg | `#34567c` on `#f4f2ed` | 6.78:1 | 3:1 | pass |
| Chart axis text vs chart bg | `#535a66` on `#f4f2ed` | 6.21:1 | 4.5:1 | pass |
| Eval graph: White area vs Black area | `#fbf8f1` on `#48505e` | 7.66:1 | 3:1 | pass |
| Grade badge text on lightest grade | `#10121a` on `#c9cfa0` | 11.50:1 | 4.5:1 | pass |
| Grade badge text on darkest grade | `#10121a` on `#ef7d7d` | 7.03:1 | 4.5:1 | pass |
| Division 1 insignia vs panel (UI) | `#8c3445` on `#fcfbf8` | 7.54:1 | 3:1 | pass |
| Division 2 insignia vs panel (UI) | `#6c7280` on `#fcfbf8` | 4.66:1 | 3:1 | pass |
| Division 3 insignia vs panel (UI) | `#95582a` on `#fcfbf8` | 5.47:1 | 3:1 | pass |
| Division 4 insignia vs panel (UI) | `#2e5f9a` on `#fcfbf8` | 6.30:1 | 3:1 | pass |
| Division 5 insignia vs panel (UI) | `#1b6e45` on `#fcfbf8` | 6.03:1 | 3:1 | pass |
| Division 6 insignia vs panel (UI) | `#535a66` on `#fcfbf8` | 6.71:1 | 3:1 | pass |
| Division 7 insignia vs panel (UI) | `#5a45a8` on `#fcfbf8` | 7.12:1 | 3:1 | pass |
| Division 8 insignia vs panel (UI) | `#7a7f89` on `#fcfbf8` | 3.88:1 | 3:1 | pass |

#### board:ivory (theme default)

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Light vs dark square (UI, 3:1) | `#ede7db` on `#627489` | 3.89:1 | 3:1 | pass |
| Coordinates on light squares | `#3e4a58` on `#ede7db` | 7.33:1 | 4.5:1 | pass |
| Coordinates on dark squares | `#ffffff` on `#627489` | 4.80:1 | 4.5:1 | pass |
| Black piece body vs dark square (UI, 3:1) | `#1d2430` on `#627489` | 3.25:1 | 3:1 | pass |
| White piece outline vs light square (UI, 3:1) | `#26211a` on `#ede7db` | 12.97:1 | 3:1 | pass |

#### distinct:ivory

| Pair | Colours | ΔE (CIE76) | Target | Result |
| --- | --- | --- | --- | --- |
| positive vs negative | `#1b6e45` / `#b0352b` | 86.0 | ≥ 25 | pass |
| positive vs info | `#1b6e45` / `#5a45a8` | 95.9 | ≥ 25 | pass |
| positive vs accent | `#1b6e45` / `#34567c` | 54.1 | ≥ 25 | pass |
| negative vs info | `#b0352b` / `#5a45a8` | 86.5 | ≥ 25 | pass |
| negative vs accent | `#b0352b` / `#34567c` | 77.7 | ≥ 25 | pass |
| info vs accent | `#5a45a8` / `#34567c` | 42.6 | ≥ 25 | pass |

#### board:walnut

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Light vs dark square (UI, 3:1) | `#eed8b4` on `#94694a` | 3.45:1 | 3:1 | pass |
| Coordinates on light squares | `#5a3c22` on `#eed8b4` | 7.18:1 | 4.5:1 | pass |
| Coordinates on dark squares | `#fff7ea` on `#94694a` | 4.51:1 | 4.5:1 | pass |
| Black piece body vs dark square (UI, 3:1) | `#1d2430` on `#94694a` | 3.25:1 | 3:1 | pass |
| White piece outline vs light square (UI, 3:1) | `#26211a` on `#eed8b4` | 11.50:1 | 3:1 | pass |

#### board:slate

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Light vs dark square (UI, 3:1) | `#dfe5ec` on `#5f7288` | 3.90:1 | 3:1 | pass |
| Coordinates on light squares | `#36475a` on `#dfe5ec` | 7.51:1 | 4.5:1 | pass |
| Coordinates on dark squares | `#ffffff` on `#5f7288` | 4.94:1 | 4.5:1 | pass |
| Black piece body vs dark square (UI, 3:1) | `#1d2430` on `#5f7288` | 3.15:1 | 3:1 | pass |
| White piece outline vs light square (UI, 3:1) | `#26211a` on `#dfe5ec` | 12.59:1 | 3:1 | pass |

#### board:green

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Light vs dark square (UI, 3:1) | `#ecedd3` on `#587f41` | 3.89:1 | 3:1 | pass |
| Coordinates on light squares | `#3f5c2e` on `#ecedd3` | 6.33:1 | 4.5:1 | pass |
| Coordinates on dark squares | `#ffffff` on `#587f41` | 4.64:1 | 4.5:1 | pass |
| Black piece body vs dark square (UI, 3:1) | `#1d2430` on `#587f41` | 3.36:1 | 3:1 | pass |
| White piece outline vs light square (UI, 3:1) | `#26211a` on `#ecedd3` | 13.40:1 | 3:1 | pass |

#### board:mono

| Pair | Foreground / background | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Light vs dark square (UI, 3:1) | `#e6e6e6` on `#6e6e6e` | 4.09:1 | 3:1 | pass |
| Coordinates on light squares | `#3a3a3a` on `#e6e6e6` | 9.11:1 | 4.5:1 | pass |
| Coordinates on dark squares | `#ffffff` on `#6e6e6e` | 5.10:1 | 4.5:1 | pass |
| Black piece body vs dark square (UI, 3:1) | `#1d2430` on `#6e6e6e` | 3.06:1 | 3:1 | pass |
| White piece outline vs light square (UI, 3:1) | `#26211a` on `#e6e6e6` | 12.80:1 | 3:1 | pass |

## Verification and known limitations

* `npx tsc -b`, `npx vitest run` (including `tests/theme.test.ts`) and `npx vite build` pass.
* Screenshots are in `docs/evidence/m4-themes/`:
  * every theme at 1366×900 for Play, Federation, Exchange, Finance, Library, Academy, Passport and Settings;
  * a live match, the analysis screen and the rated Passport in each theme;
  * Play and match boards with each board palette;
  * phone (390×844) Play, Federation, Exchange and Settings in every theme, plus a phone match.

  The script found no horizontal overflow at 390 px.
* The squares meet 3:1 against each other but not 4.5:1. That is the WCAG non-text threshold. Squares are also distinguished by position, and coordinates are drawn on them.
* Text drawn over a *highlighted* square was not audited for every highlight/opacity combination. Coordinates sit above the highlight
  layer and stayed legible in the screenshots.
* The Obsidian negative/accent pair (ΔE ≈ 30) is the closest status separation. Negative values always carry "−", the word "loss",
  or a labelled chip as well.
* The grade palette (`--g-*`) is shared by all themes. Grade badges use dark ink at ≥ 4.5:1 and carry symbols and labels.
* Pixel portraits keep their own fixed palettes, so their dark tiles show as small framed tiles in the light theme.
* No formal screen-reader or real-device audit was performed in this milestone.
