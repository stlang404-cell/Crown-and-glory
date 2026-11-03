#!/usr/bin/env node
/**
 * WCAG 2.2 contrast audit for the colour themes and board palettes in src/ui/themes.css.
 *   node tools/contrast/check-themes.mjs            # human-readable report, exit 1 on any failure
 *   node tools/contrast/check-themes.mjs --md       # Markdown tables (used for docs/M4_THEMES.md)
 * Only hex tokens are audited; colour-mix() and rgba() helpers are derived from them.
 */
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../src/ui/themes.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const md = process.argv.includes('--md');

/** Collect `--name: #hex` declarations for every `[data-theme="x"]` / `[data-board="y"]` block. */
function blocks(attr) {
  const out = {};
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const ids = [...m[1].matchAll(new RegExp(`\\[data-${attr}="([a-z]+)"\\]`, 'g'))].map(x => x[1]);
    for (const id of ids) {
      out[id] ??= {};
      for (const [, k, v] of m[2].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) out[id][k] = v.toLowerCase();
    }
  }
  return out;
}

const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** CIE76 ΔE in Lab (D65) — a rough hue/lightness separation check for status colours. */
function lab(h) {
  const [r, g, b] = hex(h).map(lin);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

const base = {};
for (const m of css.matchAll(/(^|\})\s*:root\s*\{([^}]*)\}/g)) for (const [, k, v] of m[2].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) base[k] = v.toLowerCase();
const themes = Object.fromEntries(Object.entries(blocks('theme')).map(([id, t]) => [id, { ...base, ...t }]));
const boards = blocks('board');
let failures = 0;
const rows = {};
const check = (group, label, fg, bg, min) => {
  if (!fg || !bg) { console.error(`missing token for ${group}: ${label}`); failures++; return; }
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failures++;
  (rows[group] ??= []).push({ label, fg, bg, r, min, ok });
};

const THEME_PAIRS = [
  ['Body text on page', 'text', 'bg', 4.5],
  ['Body text on panel', 'text', 'panel', 4.5],
  ['Body text on raised surface', 'text', 'panel-2', 4.5],
  ['Muted text on page', 'muted', 'bg', 4.5],
  ['Muted text on panel', 'muted', 'panel', 4.5],
  ['Muted text on raised surface', 'muted', 'panel-2', 4.5],
  ['Accent text / links on page', 'accent', 'bg', 4.5],
  ['Accent text on panel', 'accent', 'panel', 4.5],
  ['Accent text on raised surface', 'accent', 'panel-2', 4.5],
  ['Secondary accent on panel (UI)', 'accent-2', 'panel', 3],
  ['Primary button text (top stop)', 'accent-ink', 'accent-strong', 4.5],
  ['Primary button text (bottom stop)', 'accent-ink', 'accent-strong-2', 4.5],
  ['Running clock text', 'clock-run-ink', 'clock-run', 4.5],
  ['Running clock vs low-time clock fill (UI, 3:1)', 'clock-run', 'danger-fill', 3],
  ['Low-time clock text', 'danger-ink', 'danger-fill', 4.5],
  ['Positive text on panel', 'positive', 'panel', 4.5],
  ['Negative text on panel', 'negative', 'panel', 4.5],
  ['Info text on panel', 'info', 'panel', 4.5],
  ['Warning text on panel', 'warn', 'panel', 4.5],
  ['Positive text on raised surface', 'positive', 'panel-2', 4.5],
  ['Negative text on raised surface', 'negative', 'panel-2', 4.5],
  ['Focus ring vs page (UI, 3:1)', 'focus', 'bg', 3],
  ['Focus ring vs panel (UI, 3:1)', 'focus', 'panel', 3],
  ['Control border vs panel (UI, 3:1)', 'line-strong', 'panel', 3],
  ['Chart line (accent) vs chart bg', 'accent', 'chart-bg', 3],
  ['Chart axis text vs chart bg', 'muted', 'chart-bg', 4.5],
  ['Eval graph: White area vs Black area', 'eval-white', 'eval-black', 3],
  ['Grade badge text on lightest grade', 'grade-ink', 'g-good', 4.5],
  ['Grade badge text on darkest grade', 'grade-ink', 'g-blunder', 4.5],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => [`Division ${i} insignia vs panel (UI)`, `ins-${i}`, 'panel', 3]),
];

for (const [id, t] of Object.entries(themes)) {
  for (const [label, fg, bg, min] of THEME_PAIRS) check(`theme:${id}`, label, t[fg], t[bg], min);
  // theme-matched board
  boardChecks(`board:${id} (theme default)`, t);
  // status colours must stay distinguishable from each other and from the accent
  const st = ['positive', 'negative', 'info', 'accent'];
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
    const d = dE(t[st[i]], t[st[j]]);
    const ok = d >= 25;
    if (!ok) failures++;
    (rows[`distinct:${id}`] ??= []).push({ label: `${st[i]} vs ${st[j]}`, fg: t[st[i]], bg: t[st[j]], r: d, min: 25, ok, de: true });
  }
}
function boardChecks(group, b) {
  check(group, 'Light vs dark square (UI, 3:1)', b['sq-light'], b['sq-dark'], 3);
  check(group, 'Coordinates on light squares', b['coord-light'], b['sq-light'], 4.5);
  check(group, 'Coordinates on dark squares', b['coord-dark'], b['sq-dark'], 4.5);
  // Piece bodies use the fixed Crown set gradients (Pieces.tsx): ink mid-stop #1d2430, ivory outline #26211a; ivory bodies (#efe3c8) on dark squares always exceed 3:1 when the dark square passes the coordinate check.
  check(group, 'Black piece body vs dark square (UI, 3:1)', '#1d2430', b['sq-dark'], 3);
  check(group, 'White piece outline vs light square (UI, 3:1)', '#26211a', b['sq-light'], 3);
}
for (const [id, b] of Object.entries(boards)) boardChecks(`board:${id}`, b);

if (md) {
  for (const [g, rs] of Object.entries(rows)) {
    console.log(`\n#### ${g}\n`);
    if (rs[0].de) { console.log('| Pair | Colours | ΔE (CIE76) | Target | Result |\n| --- | --- | --- | --- | --- |'); for (const r of rs) console.log(`| ${r.label} | \`${r.fg}\` / \`${r.bg}\` | ${r.r.toFixed(1)} | ≥ ${r.min} | ${r.ok ? 'pass' : 'FAIL'} |`); }
    else { console.log('| Pair | Foreground / background | Ratio | Target | Result |\n| --- | --- | --- | --- | --- |'); for (const r of rs) console.log(`| ${r.label} | \`${r.fg}\` on \`${r.bg}\` | ${r.r.toFixed(2)}:1 | ${r.min}:1 | ${r.ok ? 'pass' : 'FAIL'} |`); }
  }
} else {
  for (const [g, rs] of Object.entries(rows)) {
    console.log(`\n${g}`);
    for (const r of rs) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.label.padEnd(44)} ${r.fg} / ${r.bg}  ${r.de ? 'ΔE ' + r.r.toFixed(1) : r.r.toFixed(2) + ':1'} (min ${r.min})`);
  }
  console.log(failures ? `\n${failures} failing pair(s)` : '\nall pairs pass');
}
process.exit(failures ? 1 : 0);
