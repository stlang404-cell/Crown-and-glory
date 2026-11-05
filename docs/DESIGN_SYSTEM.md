# Visual design system and asset inventory

Identity (v1.0, package U): **royal medieval** — royal blue, emerald, amethyst, burgundy, gold and silver over ink
or parchment neutrals, polished original heraldry with crisp pixel accents. Four themes: **Obsidian & Burgundy**
(default, id `obsidian`), **Midnight & Gold** (`midnight`), **Emerald & Gold** (`emerald`, new in v1.0) and
**Ivory & Slate** (`ivory`, light). Theme ids are unchanged, so saved preferences still resolve; an unknown stored id
falls back to the default. Everything is original vector art drawn by the game — no image downloads, no external
fonts at runtime (system font stacks), no emoji as interface icons. Copy rules: docs/STYLE_GUIDE.md.

## Royal palette (v1.0, `src/ui/themes.css`)

Every theme defines the six royal tones as **text-safe** tokens — each reaches 4.5:1 on `--panel` and `--panel-2`
and over its own 12–14 % tint — so they can colour text, chips, tags, chart lines and rules without a contrast check
at the call site:

| Token | Obsidian | Midnight | Emerald | Ivory | Used for |
|---|---|---|---|---|---|
| `--royal` | `#8fb0ec` | `#93b4f0` | `#98b6ee` | `#284a8a` | Competitive Rank tone (`--rank-tone`), `.chip.royal` |
| `--emerald` | `#6fd1a0` | `#74d4a6` | `#74d6a6` | `#1b6a45` | `.chip.emerald` |
| `--amethyst` | `#c4a5ef` | `#c3a8f0` | `#c7abf0` | `#6a3f9a` | `.chip.amethyst` |
| `--burgundy` | `#ef8f9f` | `#f0929f` | `#f2949f` | `#8a2b3e` | `.chip.burgundy` |
| `--gold` | `#e2c074` | `#dcb96e` | `#dfbd6c` | `#74520f` | Federation Title tone (`--title-tone`), `.chip.gold`, gilt rules |
| `--silver` | `#c3cad4` | `#c3ccd8` | `#c4ccd0` | `#4d5666` | rating-title tone (`--rating-tone`), `.chip.silver`, silver tier |

Theme roles: Obsidian = graphite ink, **burgundy** primary buttons, **gold** accent (links, current navigation,
focus); Midnight = navy ink, **royal-blue** buttons, gold accent, amethyst secondary; Emerald = forest ink,
**emerald** buttons, gold accent and a green tournament board; Ivory = parchment, royal-blue accent and buttons,
burgundy secondary. Derived tints (`styles.css`): `--gilt-line` (gold-tinged card top edge), `--gilt-soft`,
`--royal-soft`, `--burgundy-soft`.

**Contrast gate.** `tests/contrast.test.ts` (vitest, part of `npx vitest run`) checks every pair the interface
actually paints, in every theme: body and muted text on page, panels and raised surfaces (4.5:1); all eleven tone
colours as text on panels and over their own chip tint (4.5:1); body text over the accent tint used for the current
row, move and navigation item; hero banner; primary buttons, clocks, focus ring, control borders (3:1); chart lines
(accent, info, muted, warn), axis labels and the eval graph's White/Black areas; rank chevrons; and the grade badges.
It also forbids fixed hex text colours in `styles.css`. v1.0 fixed real failures it found: Ivory positive / negative
/ warning / bronze chips on raised surfaces (4.0–4.4:1), Ivory input borders on the input fill (2.85:1), Midnight
bronze and amethyst rarity chips (3.7–4.4:1) and the fixed bronze/silver vault tier pips (2.8:1 on Ivory). The
human-readable report remains `node tools/contrast/check-themes.mjs` (now also lists the royal tones).

## Tokens (`src/ui/styles.css`, palettes in `src/ui/themes.css`)

| Group | Tokens |
|---|---|
| Type scale | `--fs-xs` .75rem · `--fs-sm` .875 · `--fs-md` 1 · `--fs-lg` 1.125 · `--fs-xl` 1.375 · `--fs-2xl` 1.75 · `--fs-3xl` 2.125; families `--font` (UI sans), `--display` (book serif for titles), `--mono` (numbers, notation) |
| Spacing | 4 px grid: `--sp-1` 4 … `--sp-8` 32 |
| Shape | `--radius-xs` 5 · `--radius-sm` 8 · `--radius` 12 · `--radius-lg` 16 |
| Motion | `--ease`, `--dur` .16 s, `--dur-move` .22 s; all motion off under `prefers-reduced-motion` and Settings → Motion → Reduce |
| Controls | `--control-h` 44 px (touch target), `--control-h-sm` 36 px, `--icon` 20 px |
| Surfaces | flat panel fill, soft border (`--line-soft`) with a gold-tinged top edge (`--gilt-line`), 1 px top highlight, `--shadow-sm`; no decorative gradients on panels (the hero banner and ceremony cards are the only gradient surfaces) |
| Card hierarchy | page title `h1` and section titles `h2` in the book serif (`--display`); `h3` and body in the UI sans; a panel's first title carries a 3 px gilt rule; stat labels are small caps-style uppercase in `--muted` |
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

**v1.0 rendering (crown-heraldry-2; `src/ui/Emblem.tsx`).** Same specs and silhouettes, polished drawing:

* Tinctures tuned to the royal palette (azure = royal blue, vert = emerald, purpure = amethyst, sanguine = burgundy,
  or = gold, argent = silver).
* From 44 px up: a soft top-left light and lower shade over the field, an inner bevel, partition edges drawn as fine
  dark lines, a cast shadow under the charge, gilded (gradient) crests at prestige ≥ 3, outlined pips and monograms.
  The 22 px size keeps the flat, high-contrast drawing.
* **Lines of partition** (`LINES`, `divisionPath`): fess, chief and pale divisions may be straight, wavy, embattled,
  indented or engrailed. Every one of the 80 regions has a fixed line (`regionLine`), so the regional arms read as
  richer, more varied heraldry; the Crown Championship chief is embattled and the Zonal pale indented.
* **Tournament emblems — one per event kind** (`tournamentCrest`, `MOTIFS`): Division League = compony (gold and
  sable) bordure on a roundel; Federation Open (Swiss) = compass rose; Challenger Open (Swiss) = crossed swords;
  Club Weekend = two pennants; Crown Championship = gilt sunburst plus wreath and crown; Zonal Championship =
  battlement; Regional Cup = ribbon. Motifs are drawn at 44 px and above; at 22 px the distinct shapes carry the
  difference.
* **Competitive Rank insignia (48)**: ids, specs and the III/II/I chevron rule are unchanged; chevrons now sit on a
  dark outline so they hold contrast on any surface.
* **Federation Title emblems**: `order: true` puts the shield on a **gold order star and ring** (from 44 px), which
  no rank, division or tournament emblem has; at 22 px the round gold medallion frame and star of package Q mark
  it. Package Q's semantics stay: square royal-blue chevron frame + "Rank" tag for a Competitive Rank, round gold
  double frame + "Title" tag for a Federation Title, dashed silver + "Rating" for a rating title, and the same
  tooltips. `--rank-tone` = `--royal`, `--title-tone` = `--gold`, `--rating-tone` = `--silver`.
* Trophies (`Trophy`, `TrophyArt`): polished metal gradients (gold, silver, bronze stops from `METAL_STOPS`), a soft
  floor shadow and a highlight stroke; flat metal at small sizes.
* Tests: `tests/heraldry-v1.test.ts` (48 rank insignia render distinctly at 22 and 44 px and keep their chevrons;
  titles carry the order star and never a rank's chevrons or signature; one motif per event kind; 80 regional
  renderings distinct; every division × line path well formed) alongside `tests/heraldry.test.ts` and
  `tests/ranks.test.ts`. Gallery for review: `npx tsx tools/heraldry/gallery.tsx /tmp/heraldry.html`.

## Motion and ceremonies (v1.0)

Restrained by design: promotion, rank change, Federation Title, trophy unlock and tournament victory share one
ceremony card (`src/ui/Ceremony.tsx`, `styles.css`) with a gilt top rule and a static radiance behind the art; it
enters once (0.5 s), passes one light sheen (1.4 s) and lets the art glow for two breaths, then stays still (before
v1.0 the glow pulsed forever). The overlay respects safe areas and scrolls inside itself if a card is taller than a
short phone screen. With `prefers-reduced-motion` (unless Settings → Motion is Full) or Settings → Motion → Reduce,
every ceremony animation and the sheen are off. Match animations (piece slides, capture fade, hint grow, check pulse)
are unchanged and already obey the same switches.

## Charts (v1.0)

Eval graph: quarter guides, a crisp edge on the evaluation line and the even-position midline, all drawn with
non-scaling strokes so they stay 1–2 px on every width. Rating / Career Elo chart: larger axis labels (13 px at
full width, semibold) and a wider label gutter. Chart colours come only from tokens audited by the contrast gate
(accent, info, muted and warn lines ≥ 3:1 on `--chart-bg`, axis labels ≥ 4.5:1).

## Performance (v1.0)

No fonts or images were added: type stays on system stacks and all art is inline SVG, so offline caching is
unchanged (`node scripts/verify-dist.mjs`: 11 precached files verified, the same set as v0.11). Production build
before → after package U: CSS 71.34 → 75.73 kB (gzip 15.12 → 16.13 kB, +1.0 kB); main script 1,450.38 → 1,456.77 kB
(gzip 437.06 → 439.27 kB, +2.2 kB) for the emblem renderer, lines of partition, motifs and metal gradients. Emblems
add one small gradient per SVG only at 44 px and above; list rows that use 22 px insignia keep the flat drawing.

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

* The sixteen Circuit Grades are the approved feudal list (docs/FEUDAL_RANKS.md); their 48 insignia (16 grades ×
  sublevel chevrons III/II/I) are built from the heraldry grammar in `src/heraldry/ranks.ts`.
* v1.0: the Federation Title order star and the tournament motifs are drawn from 44 px; at 22 px titles rely on the
  round gold frame and tournaments on their distinct shapes.
* v1.0 screenshots (docs/screenshots/v1.0/INDEX.md) are Chromium captures at 1366 × 900 and 390 × 844 (2×); no
  physical-device claims.
* Alternative piece sets are not available (one original set).
* The handshake icon is the least legible at 16 px.
* On the Slate board the last-move origin tint can look slightly muddy.
* Checked in Chromium at 1×/2× scale and 390–1440 px widths; not on a physical iPhone or Windows high-DPI display.
