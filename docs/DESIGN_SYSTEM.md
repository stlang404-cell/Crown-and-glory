# Visual design system and asset inventory

Identity: **Obsidian & Crimson** (default) with **Midnight & Gold** and **Ivory & Slate**; modern luxury heraldry
with crisp pixel accents. Everything is original vector art drawn by the game — no image downloads, no external
fonts at runtime (system font stacks), no emoji as interface icons. Copy rules: docs/STYLE_GUIDE.md.

## Tokens (`src/ui/styles.css`, palettes in `src/ui/themes.css`)

| Group | Tokens |
|---|---|
| Type scale | `--fs-xs` .75rem · `--fs-sm` .875 · `--fs-md` 1 · `--fs-lg` 1.125 · `--fs-xl` 1.375 · `--fs-2xl` 1.75 · `--fs-3xl` 2.125; families `--font` (UI sans), `--display` (book serif for titles), `--mono` (numbers, notation) |
| Spacing | 4 px grid: `--sp-1` 4 … `--sp-8` 32 |
| Shape | `--radius-xs` 5 · `--radius-sm` 8 · `--radius` 12 · `--radius-lg` 16 |
| Motion | `--ease`, `--dur` .16 s, `--dur-move` .22 s; all motion off under `prefers-reduced-motion` and Settings → Motion → Reduce |
| Controls | `--control-h` 44 px (touch target), `--control-h-sm` 36 px, `--icon` 20 px |
| Surfaces | flat panel fill, soft border (`--line-soft`), 1 px top highlight, `--shadow-sm`; no decorative gradients on panels |
| Board | `--sq-light/dark`, `--sq-last`/`--sq-last-to` (origin/destination of the last move), `--sq-sel`, `--sq-hint`/`--sq-hint-on`, `--sq-check`, coordinates, frame |

States: one 2 px focus ring everywhere; hover/active/disabled for default, primary, danger and ghost buttons; selected
segmented controls are raised; the current navigation item is filled with a pixel-step marker (desktop rail) or a
filled pill (phone bottom bar).

## Icon family (`src/ui/Icons.tsx`)

24×24 grid, 1.75 px stroke, round caps/joins, strokes on whole/half pixels, checked at 16/20/24/32 px on dark and
light backgrounds. `Icon({ name, title?, size? })` — with `title` it is announced (`role="img"`), without it is
hidden from assistive technology. Unknown names render a small diamond instead of nothing.

| Icon | Used for |
|---|---|
| play | Play |
| world | Federation |
| exchange | Grand Exchange |
| finance | Finance (coin stack) |
| library | Games |
| academy | Crown Academy |
| profile | Career |
| rivals | Rivals (crossed swords) |
| hall | Hall of Fame (trophy) |
| lab | Lab |
| settings | Settings |
| flip | Flip board |
| flag | Resign |
| handshake | Offer draw |
| first · prev · next · last | Move navigation (filled for legibility in small buttons) |
| pause | Pause a replay (paired with play) |

## Chess pieces (`src/ui/Pieces.tsx`) and board (`src/ui/Board.tsx`)

Five original pieces on a 100×100 grid sharing one two-step base: flared pawn, castellated rook, left-facing knight
with gilt mane line, five-point crowned queen with gilt orbs, domed king with a slim cross; ivory and ink gradients;
crisp outlines tuned for the contrast audit. Board: subtle grain, last-move origin/destination tints, selected
square tint with inner border, dots for quiet moves and rings for captures (both grow on hover), soft red glow on a
king in check, scaled coordinates, slim frame, 0.22 s eased piece movement (off with reduced motion). Seven board
palettes (two premium: Royal Marble, Crimson Court) all pass `node tools/contrast/check-themes.mjs`.

## Heraldry (`src/heraldry/`)

One emblem grammar (shape · field division · tinctures · charge · border · crest/wreath/pips · prestige) gives each
family a distinct silhouette: divisions = heater shields, rating ranks = roundels, federation titles = lozenge /
octagon with crests, regions = banners, tournaments = cartouche crests, trophies = five distinct cups/plates,
clubs = chosen shapes, achievements = hexagons, financial tiers = coins. Prestige raises border, crest, wreath and
pixel pips monotonically (tested).

## Match Center (`src/ui/MatchCenter.tsx`, `src/ui/match-center.css`)

One layout for playing (MatchScreen), spectating (Live Arena) and reviewing (Analysis): header with event name,
status chips and a scoreboard strip (players, ratings, result or "vs"); player cards above and below the board
(clock, or thinking time in the Arena); move navigation (first/previous/next/last, flip; play/pause and Replay
Speed in replays); a two-column notation list. Board left, side panels right; under 980 px the panels drop below
the board, and at ≤ 700 px they become tabs (Play: Moves / Assistant or Game Info; Analysis: Moves & Eval /
Summary; Arena: Moves & Eval / Market / Portfolio). The components only render what a screen passes in: grade
icons appear only for moves the screen supplies a grade for.

## Live Arena (`src/ui/SpectatorScreen.tsx`, `src/ui/arena.css`)

Scoreboard header, prominent board with compact player cards, two-column notation (grade icons only after
settlement), Live Odds cards with the change since the previous published move (text + arrow, not colour alone),
price chart with a table alternative, Your Position summary; phone: board on top, tabs for Moves & Eval / Market /
Portfolio; live status dot pulses only when motion is allowed.

## Known visual limitations

* "Sixteen Circuit Grades" do not exist in the game (see the report); their insignia were not designed.
* Alternative piece sets are not available (one original set).
* The handshake icon is the least legible at 16 px.
* On the Slate board the last-move origin tint can look slightly muddy.
* Checked in Chromium at 1×/2× scale and 390–1440 px widths; not on a physical iPhone or Windows high-DPI display.
