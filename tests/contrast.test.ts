/**
 * v1.0 contrast gate (package U): every colour pair the interface actually paints, in every theme, measured with the
 * WCAG 2.2 relative-luminance formula. Body/small text ≥ 4.5:1; large text, icons and UI boundaries ≥ 3:1.
 * Tinted surfaces (chips, tags, the current row, the current navigation item) are composited the way the browser does
 * it (`color-mix(in srgb, X p%, transparent)` over the surface beneath), using the strongest tint the CSS applies.
 * Source of truth: src/ui/themes.css (hex tokens only). The human-readable report is `node tools/contrast/check-themes.mjs`.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { THEMES } from '../src/ui/theme';


const css = fs.readFileSync(new URL('../src/ui/themes.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const styles = fs.readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

function tokens(): Record<string, Record<string, string>> {
  const base: Record<string, string> = {};
  const out: Record<string, Record<string, string>> = {};
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = m[1].trim();
    const decl = Object.fromEntries([...m[2].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)].map(x => [x[1], x[2].toLowerCase()]));
    if (/^:root$/.test(sel)) Object.assign(base, decl);
    for (const id of [...sel.matchAll(/\[data-theme="([a-z]+)"\]/g)].map(x => x[1])) out[id] = { ...(out[id] ?? {}), ...decl };
    if (/^:root,/.test(sel)) Object.assign(base, decl);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { ...base, ...v }]));
}
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h: string) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** `color-mix(in srgb, fg p, transparent)` painted over `bg`. */
const tint = (fg: string, p: number, bg: string) => '#' + rgb(fg).map((c, i) => Math.round(c * p + rgb(bg)[i] * (1 - p)).toString(16).padStart(2, '0')).join('');

const T = tokens();
type Pair = [label: string, fg: (t: Record<string, string>) => string, bg: (t: Record<string, string>) => string, min: number];
const tok = (k: string) => (t: Record<string, string>) => t[k];
const tinted = (k: string, p: number, under: string) => (t: Record<string, string>) => tint(t[k], p, t[under]);

const SURFACES = ['bg', 'panel', 'panel-2', 'panel-3'];
const TEXT_TONES = ['accent', 'positive', 'negative', 'info', 'warn', 'royal', 'emerald', 'amethyst', 'burgundy', 'gold', 'silver'];
const PAIRS: Pair[] = [
  ...['text', 'muted'].flatMap(f => SURFACES.map(s => [`${f} text on ${s}`, tok(f), tok(s), 4.5] as Pair)),
  ...TEXT_TONES.flatMap(f => ['panel', 'panel-2'].map(s => [`${f} text on ${s}`, tok(f), tok(s), 4.5] as Pair)),
  ['accent links on page', tok('accent'), tok('bg'), 4.5],
  // chips / honour tags / rarity chips: tone text over its own tint (strongest tint used: 14 %)
  ...[...TEXT_TONES, 'ins-1', 'ins-4', 'ins-6', 'ins-7', 'ins-3'].flatMap(f => ['panel', 'panel-2'].map(s => [`${f} chip text on its tint over ${s}`, tok(f), tinted(f, 0.14, s), 4.5] as Pair)),
  // the current table row, current move, current navigation item and coach box: body text over the accent tint
  ...['bg', 'panel', 'panel-2'].map(s => [`text on accent tint over ${s}`, tok('text'), tinted('accent', 0.14, s), 4.5] as Pair),
  ['muted text on accent tint over panel', tok('muted'), tinted('accent', 0.12, 'panel'), 4.5],
  ['muted text on the hero banner (accent-strong 14 % over the page)', tok('muted'), tinted('accent-strong', 0.14, 'bg'), 4.5],
  ['gold text on the gilt tint over panel (chip.gold)', tok('gold'), tinted('gold', 0.12, 'panel'), 4.5],
  ['current tab icon (accent) on its pill', tok('accent'), tinted('accent', 0.14, 'bg'), 3],
  // controls
  ['primary button text (top stop)', tok('accent-ink'), tok('accent-strong'), 4.5],
  ['primary button text (bottom stop)', tok('accent-ink'), tok('accent-strong-2'), 4.5],
  ['running clock text', tok('clock-run-ink'), tok('clock-run'), 4.5],
  ['low-time clock text', tok('danger-ink'), tok('danger-fill'), 4.5],
  ['focus ring vs page', tok('focus'), tok('bg'), 3],
  ['focus ring vs panel', tok('focus'), tok('panel'), 3],
  ['control border vs panel', tok('line-strong'), tok('panel'), 3],
  ['control border vs input fill', tok('line-strong'), tok('bg-2'), 3],
  // charts (eval graph, rating / Played Like, market and finance charts)
  ['chart line (accent) vs chart bg', tok('accent'), tok('chart-bg'), 3],
  ['chart line (info) vs chart bg', tok('info'), tok('chart-bg'), 3],
  ['chart line (muted, dashed) vs chart bg', tok('muted'), tok('chart-bg'), 3],
  ['chart marker (warn) vs chart bg', tok('warn'), tok('chart-bg'), 3],
  ['chart axis labels vs chart bg', tok('muted'), tok('chart-bg'), 4.5],
  ['chart line (accent) vs panel', tok('accent'), tok('panel'), 3],
  ['eval graph: White area vs Black area', tok('eval-white'), tok('eval-black'), 3],
  // heraldry: outlines and rank chevrons follow --text / --bg
  ['rank chevrons (--her-line) vs panel', tok('text'), tok('panel'), 3],
];

describe('v1.0 contrast (every theme, every painted pair)', () => {
  it('every theme in theme.ts has a token block with the royal palette', () => {
    for (const th of THEMES) {
      expect(T[th.id], th.id).toBeTruthy();
      for (const k of ['royal', 'emerald', 'amethyst', 'burgundy', 'gold', 'silver']) expect(T[th.id][k], `${th.id} --${k}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  for (const th of THEMES) {
    it(`${th.name} (${th.id})`, () => {
      const t = T[th.id];
      const fails = PAIRS.map(([label, fg, bg, min]) => ({ label, r: ratio(fg(t), bg(t)), min })).filter(x => x.r < x.min);
      expect(fails.map(f => `${f.label}: ${f.r.toFixed(2)} < ${f.min}`)).toEqual([]);
    });
  }
  it('grade badges keep their ink in every theme', () => {
    const g = Object.fromEntries([...css.matchAll(/--(g-[a-z]+)\s*:\s*(#[0-9a-f]{6})/g)].map(m => [m[1], m[2]]));
    for (const th of THEMES) for (const [k, v] of Object.entries(g)) expect(ratio(T[th.id]['grade-ink'], v), `${th.id} ${k}`).toBeGreaterThanOrEqual(4.5);
  });
  it('styles.css paints tone text only through theme tokens (no fixed hex text colours on surfaces)', () => {
    // fixed hex inside `color:` declarations would bypass this gate
    const fixed = [...styles.matchAll(/(?<![\w-])color:\s*(#[0-9a-fA-F]{3,8})/g)].map(m => m[0]);
    expect(fixed).toEqual([]);
    expect(styles).not.toMatch(/--tier:\s*#/);
  });
});
