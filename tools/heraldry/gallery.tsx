/**
 * Heraldry gallery (v1.0 package U): renders every emblem family at every size on dark and light grounds into one
 * self-contained HTML page for visual review and screenshots.
 *   npx tsx tools/heraldry/gallery.tsx /tmp/heraldry.html
 */
import fs from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Emblem, Trophy, TROPHY_KINDS } from '../../src/ui/Emblem';
import { TrophyArt, TROPHY_ART } from '../../src/ui/TrophyArt';
import { divisionEmblem, regionEmblem, tournamentCrest, TOURNAMENTS, TOURNAMENT_NAME, titleEmblem, FED_TITLES } from '../../src/heraldry/catalog';
import { gradeEmblem } from '../../src/heraldry/ranks';
import { CIRCUIT_GRADE_NAMES } from '../../src/federation/rankNames';
import { REGION_NAMES } from '../../src/federation/model';
import type { EmblemSpec } from '../../src/heraldry/spec';

const out = process.argv[2] ?? '/tmp/heraldry.html';
let n = 0;
/** Each emblem is its own React root here, so give every root its own id prefix (gradient and clip ids stay unique). */
const R = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el, { identifierPrefix: `e${n++}-` });
const cell = (spec: EmblemSpec, label: string, sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg']) =>
  `<figure>${sizes.map(s => R(h(Emblem, { spec, size: s, title: label }))).join('')}<figcaption>${label}</figcaption></figure>`;
const section = (title: string, body: string) => `<h2>${title}</h2><div class="g">${body}</div>`;
const grades = CIRCUIT_GRADE_NAMES;
const body = [
  section('Tournament emblems (one per event kind)', TOURNAMENTS.map(t => cell(tournamentCrest(t), TOURNAMENT_NAME[t])).join('')),
  section('Federation Titles (order star; never a rank)', FED_TITLES.map(t => cell(titleEmblem(t), `Title ${t}`)).join('')),
  section('Competitive Rank insignia (16 grades × III/II/I)', grades.flatMap((g, i) => [0, 1, 2].map(s => cell(gradeEmblem(i, s), `${g.name} ${['III', 'II', 'I'][s]}`, ['sm', 'md'])).join('')).join('')),
  section('Divisions', Array.from({ length: 8 }, (_, i) => cell(divisionEmblem(i + 1), `Division ${i + 1}`)).join('')),
  section('Regional arms (80)', Array.from({ length: 80 }, (_, r) => cell(regionEmblem(r), REGION_NAMES[r] ?? `Region ${r}`, ['sm', 'md'])).join('')),
  section('Trophies', TROPHY_KINDS.map(k => `<figure>${(['bronze', 'argent', 'or'] as const).map(m => R(h(Trophy, { kind: k, size: 'lg', title: k, metal: m }))).join('')}<figcaption>${k}</figcaption></figure>`).join('')
    + Object.keys(TROPHY_ART).map(k => `<figure>${([1, 3, 5] as const).map(t => R(h(TrophyArt, { kind: k as keyof typeof TROPHY_ART, tier: t, size: 64, title: k }))).join('')}<figcaption>${k}</figcaption></figure>`).join('')),
].join('');
const css = fs.readFileSync(new URL('../../src/ui/themes.css', import.meta.url), 'utf8');
const page = `<!doctype html><meta charset="utf-8"><title>Crown heraldry gallery</title><style>${css}
:root,[data-theme]{--her-line:var(--text);--her-outline:var(--bg)}
body{margin:0;font:13px system-ui;background:var(--bg);color:var(--text)} .wrap{padding:16px;color:var(--text);background:var(--bg)}
h2{font:600 16px Georgia,serif;margin:18px 0 8px} .g{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;max-width:260px}
figcaption{width:100%;font-size:11px;color:var(--muted)} svg{overflow:visible}</style>
<div class="wrap" data-theme="obsidian">${body}</div><div class="wrap" data-theme="ivory" style="background:var(--bg)">${body}</div>`;
fs.writeFileSync(out, page);
console.log(`wrote ${out}`);
