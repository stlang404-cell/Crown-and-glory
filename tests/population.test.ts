/**
 * v0.10 population analytics and competitor discovery at 10,240 competitors (docs/FEDERATION_SCALE.md §0.5):
 * correct counts, bands, mean/median, percentile, top and per-division leaders, season movement, filters and pages,
 * and both well inside the desktop budget (< 100 ms; measured here in Node).
 */
import { describe, expect, it } from 'vitest';
import { generateFederation } from '../src/federation/generator';
import { TOPOLOGY_V3 } from '../src/federation/model';
import type { Competitor } from '../src/federation/model';
import { RATING_BANDS, bandOf, populationStats } from '../src/app/population';
import { filterCompetitors, pageOf, PAGE_SIZE } from '../src/app/discovery';

const world = (): Competitor[] => {
  const comps = generateFederation(11, TOPOLOGY_V3);
  // spread the public ratings over the whole spectrum and give three seasons of history (deterministic)
  comps.forEach((c, i) => {
    c.rating = (i * 7919) % 4300;
    c.history = [1, 2, 3].map(s => ({ season: s, region: c.region, division: c.division, rank: 1, points: 0, played: 15, rating: 1000 + s * 100 + (i % 3), earnings: 0 }));
  });
  comps[0].status = 'retired'; comps[1].status = 'reserve';
  return comps;
};
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

describe('population analytics', () => {
  it('bands, mean, median, percentile, top, strongest per division and season movement match a direct computation', () => {
    const comps = world();
    const active = comps.filter(c => c.status === 'active');
    const s = populationStats(comps, 2000);
    expect(s.onRecord).toBe(10240);
    expect(s.active).toBe(10238);
    expect([s.retired, s.reserve]).toEqual([1, 1]);
    expect(s.bands.reduce((a, b) => a + b, 0)).toBe(s.active);
    RATING_BANDS.forEach((b, i) => expect(s.bands[i]).toBe(active.filter(c => Math.round(c.rating) >= (b.lo === -Infinity ? -1e9 : b.lo) && Math.round(c.rating) < b.hi).length));
    expect(s.bands[9]).toBeGreaterThan(0); // the 4000+ apex band
    expect(s.mean).toBeCloseTo(active.reduce((a, c) => a + c.rating, 0) / active.length, 9);
    expect(s.median).toBe(median(active.map(c => c.rating)));
    const below = active.filter(c => c.rating < 2000).length, eq = active.filter(c => c.rating === 2000).length;
    expect(s.playerPercentile).toBeCloseTo((100 * (below + eq / 2)) / active.length, 9);
    expect(populationStats(comps, null).playerPercentile).toBeNull();
    expect(s.top.map(c => c.id)).toEqual([...active].sort((a, b) => b.rating - a.rating).slice(0, 10).map(c => c.id).filter((id, i, a) => a.indexOf(id) === i));
    for (let d = 1; d <= 8; d++) expect(s.strongestPerDivision[d - 1]!.rating).toBe(Math.max(...active.filter(c => c.division === d).map(c => c.rating)));
    expect(s.seasons.map(x => x.season)).toEqual([1, 2, 3]);
    expect(s.seasons[0].count).toBe(10240);
    expect(s.seasons[1].median).toBe(1201);
    expect(bandOf(-5)).toBe(0); expect(bandOf(399.4)).toBe(0); expect(bandOf(399.6)).toBe(1); expect(bandOf(4000)).toBe(9);
  });

  it('is fast at 10,240 competitors', () => {
    const comps = world();
    populationStats(comps, 1500); // warm-up
    const t = performance.now();
    for (let k = 0; k < 5; k++) populationStats(comps, 1500);
    const ms = (performance.now() - t) / 5;
    console.log(`populationStats at 10,240: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(100);
  });
});

describe('competitor discovery', () => {
  const sets = { watchlist: new Set<string>(), featured: new Set<string>(), rivals: null, upcoming: new Set<string>(), favorites: new Set<string>() };
  const none = { q: '', region: -1, division: 0, minR: 0, maxR: 4000, title: '', style: '', club: '', special: '' as const };
  it('filters by name, rating, region and division, ordered by rating, in pages', () => {
    const comps = world();
    const all = filterCompetitors(comps, { ...none, maxR: 1e9 }, sets);
    expect(all).toHaveLength(10238);
    for (let i = 1; i < all.length; i++) expect(all[i - 1].rating >= all[i].rating).toBe(true);
    const q = comps[500].name.slice(0, 4).toLowerCase();
    const byName = filterCompetitors(comps, { ...none, q, maxR: 1e9 }, sets);
    expect(byName.length).toBeGreaterThan(0);
    expect(byName.every(c => c.name.toLowerCase().includes(q))).toBe(true);
    const narrow = filterCompetitors(comps, { ...none, region: 47, division: 3, minR: 1000, maxR: 3000 }, sets);
    expect(narrow.every(c => c.region === 47 && c.division === 3 && c.rating >= 1000 && c.rating <= 3000)).toBe(true);
    const p = pageOf(all, 3);
    expect(p.rows).toHaveLength(PAGE_SIZE);
    expect(p.from).toBe(300);
    expect(p.pages).toBe(Math.ceil(10238 / PAGE_SIZE));
    expect(pageOf(all, 9999).page).toBe(p.pages - 1);
    expect(pageOf([], 0)).toEqual({ rows: [], page: 0, pages: 1, from: 0 });
  });
  it('searches 10,240 competitors in well under 100 ms', () => {
    const comps = world();
    const runs = [{ ...none, q: 'an' }, { ...none, minR: 1800, maxR: 2200 }, { ...none, region: 12 }, { ...none, division: 1, q: 'e' }, { ...none, club: 'aic90' }];
    filterCompetitors(comps, runs[0], sets);
    const t = performance.now();
    for (const f of runs) filterCompetitors(comps, f, sets);
    const ms = (performance.now() - t) / runs.length;
    console.log(`filterCompetitors at 10,240: ${ms.toFixed(1)} ms per search`);
    expect(ms).toBeLessThan(100);
  });
});
