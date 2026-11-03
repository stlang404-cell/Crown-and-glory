import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Emblem, Trophy, TROPHY_KINDS } from '../src/ui/Emblem';
import { signature } from '../src/heraldry/spec';
import { CHARGES, SHAPES, TINCTURES } from '../src/heraldry/charges';
import { divisionEmblem, rankEmblem, RANK_ORDER, titleEmblem, FED_TITLES, regionEmblem, tournamentCrest, TOURNAMENTS, financialEmblem, FIN_TIERS, ACHIEVEMENTS, achievementEmblem, personalEmblem } from '../src/heraldry/catalog';
import { performance, normTier, makeNorm, earnedTitle, TITLE_RULES } from '../src/heraldry/titles';
import { computeRivalry, type Meeting } from '../src/heraldry/rivalry';
import { AI_CLUBS, clubOf, validateIdentity, defaultIdentity, clubEmblem } from '../src/heraldry/clubs';
import { selectFeatured } from '../src/heraldry/rivals';
import { generateFederation } from '../src/federation/generator';

const all = [
  ...Array.from({ length: 8 }, (_, i) => divisionEmblem(i + 1)), ...RANK_ORDER.map(rankEmblem), ...FED_TITLES.map(titleEmblem),
  ...Array.from({ length: 16 }, (_, i) => regionEmblem(i)), ...TOURNAMENTS.map(tournamentCrest), ...FIN_TIERS.map(financialEmblem),
  ...ACHIEVEMENTS.map(a => achievementEmblem(a, true)), ...AI_CLUBS.map(c => clubEmblem(c.identity)),
];

describe('emblem design system', () => {
  it('every ladder has distinct silhouettes and non-decreasing prestige', () => {
    const ladders = [Array.from({ length: 8 }, (_, i) => divisionEmblem(8 - i)), RANK_ORDER.map(rankEmblem), FED_TITLES.map(titleEmblem), FIN_TIERS.map(financialEmblem)];
    for (const l of ladders) {
      expect(new Set(l.map(signature)).size).toBe(l.length);
      for (let i = 1; i < l.length; i++) expect(l[i].prestige).toBeGreaterThanOrEqual(l[i - 1].prestige);
    }
    expect(divisionEmblem(1).crest).toBe('crown');
    expect(new Set(Array.from({ length: 8 }, (_, i) => divisionEmblem(i + 1).shape)).size).toBe(8); // one shape per division
    expect(new Set(Array.from({ length: 16 }, (_, i) => signature(regionEmblem(i)))).size).toBe(16);
    expect(new Set(TOURNAMENTS.map(t => signature(tournamentCrest(t)))).size).toBe(TOURNAMENTS.length);
  });
  it('renders every emblem at every size as self-contained SVG (no external assets, valid references)', () => {
    for (const spec of all) {
      expect(SHAPES[spec.shape]).toBeTruthy();
      if (spec.charge) expect(CHARGES[spec.charge]).toBeTruthy();
      for (const t of spec.field) expect(t in TINCTURES || t.startsWith('#')).toBe(true);
      for (const size of ['sm', 'md', 'lg'] as const) {
        const html = renderToStaticMarkup(createElement(Emblem, { spec, size, title: 'x' }));
        expect(html).toMatch(/^<svg[^>]*role="img"/);
        expect(html).not.toMatch(/https?:|xlink:href|<image/);
        expect(html).toContain('<title>x</title>');
      }
    }
    for (const k of TROPHY_KINDS) expect(renderToStaticMarkup(createElement(Trophy, { kind: k, title: k }))).toMatch(/^<svg/);
  });
  it('personal insignia are deterministic and gain prestige from real titles', () => {
    expect(signature(personalEmblem('c0001', 0, null))).toBe(signature(personalEmblem('c0001', 0, null)));
    expect(personalEmblem('c0001', 5, 'Sovereign').crest).toBe('crown');
    expect(personalEmblem('c0001', 0, null).wreath).toBe(false);
  });
});

describe('federation titles (fictional, norm-based)', () => {
  it('performance and norm tiers follow the published rules', () => {
    expect(performance(1500, 5, 5)).toBe(2300); // 100% → +800 (cap)
    expect(performance(1500, 4, 5)).toBe(1741); // 80% → +241
    expect(performance(1500, 2.5, 5)).toBe(1500);
    expect(normTier(1800, 1200, 5)).toBe('Squire');
    expect(normTier(1800, 1000, 5)).toBeNull(); // opposition below the floor
    expect(normTier(2400, 1900, 4)).toBeNull(); // too few games
    expect(makeNorm('x', 1, [1, 1, 1, 0.5, 1].map(score => ({ score, oppRating: 1400 })))!.tier).toBe('Squire'); // 4.5/5 vs 1400 → 1782
    expect(makeNorm('x', 1, [1, 1, 1, 0.5, 1].map(score => ({ score, oppRating: 1200 })))).toBeNull(); // 1582 < 1700
  });
  it('titles need several norms, enough norm games, a peak rating and honours; they are never lost', () => {
    const n = (tier: 'Squire' | 'Knight' | 'Paladin' | 'Sovereign', games = 15) => ({ event: 'e', season: 1, games, score: 10, avgOpp: 2000, tpr: 2400, tier });
    expect(earnedTitle({ norms: [n('Knight')], peakRating: 2000, establishedPeak: 2000, honours: [], current: null })).toBe('Squire'); // one Knight norm is not enough for Knight
    expect(earnedTitle({ norms: [n('Knight'), n('Knight')], peakRating: 2000, establishedPeak: 1800, honours: [], current: null })).toBe('Squire'); // established peak too low
    expect(earnedTitle({ norms: [n('Knight'), n('Knight')], peakRating: 2000, establishedPeak: 1950, honours: [], current: null })).toBe('Knight');
    expect(earnedTitle({ norms: [n('Paladin'), n('Paladin'), n('Paladin')], peakRating: 2300, establishedPeak: 2300, honours: [], current: null })).toBe('Knight'); // Paladin needs an event title
    expect(earnedTitle({ norms: [], peakRating: 0, establishedPeak: 0, honours: [], current: 'Knight' })).toBe('Knight'); // permanent
    expect(TITLE_RULES.map(r => r.title)).toEqual(FED_TITLES);
  });
});

describe('rivalry model', () => {
  const m = (season: number, round: number, scoreA: number, ra?: number, rb?: number): Meeting => ({ season, round, event: 'league:0:8', a: 'p', b: 'x', scoreA, ratingA: ra, ratingB: rb });
  it('is bounded, decays, counts upsets once and resists farming', () => {
    const farm = Array.from({ length: 30 }, (_, i) => m(1, i + 1, i % 2));
    const r = computeRivalry('p', 'x', farm, [], [], 1);
    expect(r.meetings).toBe(30);
    expect(r.events.filter(e => e.kind === 'meeting')).toHaveLength(2); // only two meetings per season count
    expect(r.intensity).toBeLessThan(15);
    const big = computeRivalry('p', 'x', Array.from({ length: 40 }, (_, i) => m(1 + Math.floor(i / 2), 1, 1, 1500, 1800)), Array.from({ length: 10 }, (_, s) => ({ season: s + 1, event: 'champ' as const, stage: 'Final', winner: 'p', loser: 'x' })), [], 20);
    expect(big.intensity).toBeLessThanOrEqual(100);
    const recent = computeRivalry('p', 'x', [m(5, 1, 1, 1500, 1800)], [], [], 5).intensity, old = computeRivalry('p', 'x', [m(1, 1, 1, 1500, 1800)], [], [], 5).intensity;
    expect(recent).toBeGreaterThan(old); // decay
    expect(computeRivalry('p', 'x', [m(1, 1, 1, 1500, 1800), m(1, 2, 1, 1500, 1800)], [], [], 1).events.filter(e => e.kind === 'upset')).toHaveLength(1);
  });
  it('is a pure function of its inputs (never mutates records)', () => {
    const meetings = [m(1, 1, 1), m(1, 2, 0), m(2, 1, 0.5)];
    const copy = JSON.stringify(meetings);
    computeRivalry('x', 'p', meetings, [{ season: 1, event: 'club', stage: 'Final', winner: 'x', loser: 'p' }], [], 2);
    expect(JSON.stringify(meetings)).toBe(copy);
    const r = computeRivalry('x', 'p', meetings, [], [], 2);
    expect([r.w, r.d, r.l]).toEqual([1, 1, 1]);
  });
});

describe('clubs and featured rivals', () => {
  it('32 AI clubs with unique names; affiliation is stable; identity validation', () => {
    expect(AI_CLUBS).toHaveLength(32);
    expect(new Set(AI_CLUBS.map(c => c.identity.name)).size).toBe(32);
    expect(new Set(AI_CLUBS.map(c => `${c.identity.shape}|${c.identity.symbol}|${c.identity.primary}|${c.identity.secondary}`)).size).toBe(32);
    expect(new Set(AI_CLUBS.map(c => c.identity.motto)).size).toBe(32);
    for (const c of AI_CLUBS) expect(validateIdentity(c.identity)).toBeNull();
    expect(clubOf('c0007', 3)).toBe(clubOf('c0007', 3));
    expect(clubOf('c0007', 3).region).toBe(3);
    expect(validateIdentity({ ...defaultIdentity(0), name: 'x' })).toMatch(/2–32/);
    expect(validateIdentity({ ...defaultIdentity(0), primary: 'or', secondary: 'or' })).toMatch(/differ/);
    expect(validateIdentity({ ...defaultIdentity(0), name: '<script>' })).toBeTruthy();
  });
  it('selects 28 stable featured rivals (24 legends + 4 from the player division)', () => {
    const comps = generateFederation(77);
    const a = selectFeatured(comps, 3, 8, 1), b = selectFeatured(comps, 3, 8, 1);
    expect(a).toHaveLength(28);
    expect(a.map(x => x.id)).toEqual(b.map(x => x.id));
    expect(a.filter(x => x.tag === 'circle')).toHaveLength(4);
    for (const x of a.filter(x => x.tag === 'circle')) { const c = comps.find(y => y.id === x.id)!; expect([c.region, c.division]).toEqual([3, 8]); }
  });
});
