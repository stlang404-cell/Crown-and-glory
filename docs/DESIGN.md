# Visual design notes

Direction (research doc 11): "nocturnal federation observatory" — deep ink surfaces, warm ivory
board, brass/gold accents, mint information highlights, original pixel-art portraits and brand mark,
crisp vector text and charts. All artwork (SVG pieces, procedural 12×12 portraits, icons) is original.

## Measured WCAG 2.2 contrast (computed from the CSS tokens)

| Pair | Ratio |
| --- | --- |
| text #f1ebdd on bg #10151e | 15.39:1 |
| text #f1ebdd on panel #1b2431 | 13.15:1 |
| muted #b3bfcd on panel #1b2431 | 8.38:1 |
| accent #d8b56c on panel #1b2431 | 8.00:1 |
| positive #83d6b0 on panel | 9.09:1 |
| negative #ed9b9b on panel | 7.27:1 |
| info #8fc3ee on panel | 8.34:1 |
| primary button text #1a1408 on #c79f55 | 7.42:1 |
| running clock #1a1408 on #d8b56c | 9.36:1 |
| light square #e9dcc0 vs dark square #5a6c80 (non-text, needs 3:1) | 3.97:1 |
| coordinates #3d4b5a on light square | 6.57:1 |
| coordinates #ffffff on dark square | 5.40:1 |

The first version used dark squares #6f8296 (2.91:1 against light squares and coordinates); it failed
AA and was changed after this measurement. Grades are distinguished by symbol (!!, !, ★, ✓, ·, ?!, ?, ??)
and text label as well as colour. Controls are ≥ 44 CSS px. `prefers-reduced-motion` disables piece
animation and transitions. No formal screen-reader audit has been performed yet.
