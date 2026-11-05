/**
 * v1.0 royal visual identity (package U): insignia and emblem distinctness at the rendered level.
 *   • 48 Competitive Rank insignia: ids, the III/II/I chevron rule and distinct rendered markup are kept.
 *   • Federation Title emblems carry the gold order star (never a rank's chevrons) and stay apart from every rank.
 *   • One tournament emblem per event kind, each with its own motif.
 *   • 80 regional arms render distinctly, with valid lines of partition.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Emblem } from '../src/ui/Emblem';
import { RankBadge, TitleBadge } from '../src/ui/RankBadge';
import { signature, type EmblemSpec } from '../src/heraldry/spec';
import { divisionPath, LINES, MOTIFS, DIVISIONS } from '../src/heraldry/charges';
import { regionEmblem, tournamentCrest, TOURNAMENTS, titleEmblem, FED_TITLES, divisionEmblem } from '../src/heraldry/catalog';
import { ALL_RANKS } from '../src/federation/ranks';

let n = 0;
const svg = (spec: EmblemSpec, size: 'sm' | 'md' | 'lg' = 'md') =>
  renderToStaticMarkup(createElement(Emblem, { spec, size, title: 'x' }), { identifierPrefix: `t${n++}-` }).replace(/t\d+-/g, '');

describe('Competitive Rank insignia (48)', () => {
  it('keep ids, the III/II/I chevron rule, and render 48 distinct images at md and sm', () => {
    expect(ALL_RANKS).toHaveLength(48);
    expect(new Set(ALL_RANKS.map(r => `${r.gradeId}:${r.sublevel}`)).size).toBe(48);
    for (const r of ALL_RANKS) {
      const marks = ({ III: 1, II: 2, I: 3 } as const)[r.sublevel];
      expect(r.insignia.marks).toBe(marks);
      for (const size of ['sm', 'md'] as const) expect(svg(r.insignia, size)).toContain(`data-marks="${marks}"`);
      expect(r.insignia.order).toBeFalsy();
      expect(r.insignia.motif).toBeFalsy();
    }
    expect(new Set(ALL_RANKS.map(r => svg(r.insignia))).size).toBe(48);
    expect(new Set(ALL_RANKS.map(r => svg(r.insignia, 'sm'))).size).toBe(48);
  });
});

describe('Federation Title emblems are clearly distinct from ranks', () => {
  it('every title has the order star and no chevrons; no title shares a signature or rendering with a rank', () => {
    const rankSigs = new Set(ALL_RANKS.map(r => signature(r.insignia)));
    const rankSvgs = new Set(ALL_RANKS.map(r => svg(r.insignia)));
    for (const t of FED_TITLES) {
      const s = titleEmblem(t);
      expect(s.order).toBe(true);
      expect(s.marks).toBeUndefined();
      expect(rankSigs.has(signature(s))).toBe(false);
      const md = svg(s);
      expect(md).toContain('data-order-star');
      expect(md).not.toContain('data-marks');
      expect(rankSvgs.has(md)).toBe(false);
    }
    for (const r of ALL_RANKS) expect(svg(r.insignia, 'lg')).not.toContain('data-order-star');
  });
  it('badges keep package Q semantics: frame, tag and tooltip differ for the same word', () => {
    const knightRank = ALL_RANKS.find(r => r.label === 'Knight II')!;
    const rank = renderToStaticMarkup(createElement(RankBadge, { rank: knightRank }));
    const title = renderToStaticMarkup(createElement(TitleBadge, { title: 'Knight' }));
    expect(rank).toContain('data-honour-frame="rank"');
    expect(rank).toContain('data-honour-tag="rank"');
    expect(rank).toMatch(/title="Competitive Rank: Knight II\./);
    expect(title).toContain('data-honour-frame="title"');
    expect(title).toContain('data-honour-tag="title"');
    expect(title).toMatch(/title="Federation Title: Knight\./);
    expect(title).toContain('data-order=""'); // small badges: the round gold frame and star come from CSS; the emblem is flagged as an order
    expect(rank).not.toContain('data-order');
    expect(renderToStaticMarkup(createElement(TitleBadge, { title: 'Knight', size: 'md' }))).toContain('data-order-star');
  });
});

describe('tournament emblems', () => {
  it('one emblem per event kind, each with its own motif and silhouette', () => {
    expect(TOURNAMENTS).toEqual(['league', 'challenger', 'open', 'champ', 'club', 'zonal', 'cup']);
    const motifs = TOURNAMENTS.map(t => tournamentCrest(t).motif);
    expect(new Set(motifs).size).toBe(TOURNAMENTS.length);
    for (const m of motifs) expect(MOTIFS).toContain(m);
    expect(new Set(TOURNAMENTS.map(t => signature(tournamentCrest(t)))).size).toBe(TOURNAMENTS.length);
    for (const t of TOURNAMENTS) {
      const spec = tournamentCrest(t);
      const md = svg(spec);
      expect(md).toContain(`data-motif="${spec.motif}"`);
      if (spec.motif !== 'compony') expect(md).toContain(`data-motif-art="${spec.motif}"`);
      expect(svg(spec, 'sm')).not.toContain('data-motif-art'); // small sizes drop ornaments
    }
    // tournament emblems never look like a division emblem or a rank
    const others = new Set([...Array.from({ length: 8 }, (_, i) => signature(divisionEmblem(i + 1))), ...ALL_RANKS.map(r => signature(r.insignia))]);
    for (const t of TOURNAMENTS) expect(others.has(signature(tournamentCrest(t)))).toBe(false);
  });
});

describe('regional arms (80) and lines of partition', () => {
  it('80 distinct renderings; several lines of partition are in use', () => {
    const specs = Array.from({ length: 80 }, (_, r) => regionEmblem(r));
    expect(new Set(specs.map(s => svg(s))).size).toBe(80);
    const used = new Set(specs.filter(s => ['fess', 'chief', 'pale'].includes(s.division)).map(s => s.line));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
  it('every division × line produces a closed, well-formed path', () => {
    for (const d of Object.keys(DIVISIONS) as (keyof typeof DIVISIONS)[]) for (const l of LINES) {
      const p = divisionPath(d, l);
      if (d === 'plain') { expect(p).toBe(''); continue; }
      expect(p).toMatch(/^M[-\d. ]/);
      expect(p).toMatch(/Z$/);
      expect(p).not.toMatch(/NaN|Infinity|undefined/);
    }
    expect(divisionPath('fess', 'straight')).toBe(DIVISIONS.fess);
  });
});
