/** Rating titles (one per 100 points) and their insignias; collection/peak from established rating history only. */
import { describe, expect, it } from 'vitest';
import { RATING_TITLES, titleFor, titleProgress, insigniaSpec, collectedTitles } from '../src/ratings/titles';
import { isProvisional } from '../src/ratings/glicko2';

describe('rating titles', () => {
  it('a distinct title for every 100 points from 0 to 3000+, uncapped', () => {
    expect(RATING_TITLES).toHaveLength(31);
    expect(new Set(RATING_TITLES.map(t => t.name)).size).toBe(31);
    for (let r = 0; r < 3000; r += 100) expect(titleFor(r + 50).min).toBe(r);
    expect(titleFor(1).name).toBe('Wandless Wanderer');
    expect(titleFor(99).name).toBe('Wandless Wanderer');
    expect(titleFor(100).name).toBe('First-Year Initiate');
    expect(titleFor(3000).name).toBe('Eternal Sovereign');
    expect(titleFor(4200).name).toBe('Eternal Sovereign');
    expect(titleFor(-20).name).toBe('Wandless Wanderer');
  });
  it('progress to the next title', () => {
    expect(titleProgress(1250)).toMatchObject({ toNext: 50, fraction: 0.5 });
    expect(titleProgress(1250).next?.name).toBe('Runic Tactician');
    expect(titleProgress(3100)).toMatchObject({ next: null, toNext: null });
  });
  it('every insignia is unique and prestige never decreases up the ladder', () => {
    const keys = RATING_TITLES.map(t => JSON.stringify(insigniaSpec(t)));
    expect(new Set(keys).size).toBe(31);
    const p = RATING_TITLES.map(t => insigniaSpec(t).prestige);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
  });
  const ev = (rating: number, games: number, rd: number, i: number) => ({ after: { rating, rd }, games, at: `2026-01-${String(i + 1).padStart(2, '0')}` });
  it('provisional ratings never collect titles', () => {
    expect(collectedTitles([ev(1500, 1, 330, 0), ev(1700, 5, 250, 1)], isProvisional)).toEqual({ collected: [], peak: null, peakRating: null });
  });
  it('collection keeps titles after a fall, includes bands crossed while rising, not bands below the start', () => {
    const r = collectedTitles([ev(1420, 20, 90, 0), ev(1630, 21, 88, 1), ev(1380, 22, 86, 2)], isProvisional);
    expect(r.collected.map(t => t.min)).toEqual([1300, 1400, 1500, 1600]);
    expect(r.peak?.name).toBe('Mystic Duelist');
    expect(r.peakRating).toBe(1630);
  });
  it('is deterministic and order-independent of input order', () => {
    const pts = [ev(1420, 20, 90, 0), ev(1630, 21, 88, 1), ev(1380, 22, 86, 2)];
    expect(collectedTitles([...pts].reverse(), isProvisional)).toEqual(collectedTitles(pts, isProvisional));
  });
});
