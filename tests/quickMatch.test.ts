/** Random Federation Quick Match selection: default pool is everyone active, filters only narrow, choice is uniform. */
import { describe, expect, it } from 'vitest';
import { eligiblePool, pickOpponent, seededRng, NEAR_RANGE, ELITE_MIN } from '../src/federation/quickMatch';
import type { Competitor } from '../src/federation/model';

const comp = (i: number, rating: number, status: Competitor['status'] = 'active') => ({ id: `c${i}`, rating, status } as unknown as Competitor);
const roster = Array.from({ length: 2048 }, (_, i) => comp(i, 700 + (i * 37) % 2200, i % 97 === 0 ? 'retired' : 'active')).concat([{ id: 'player', rating: 1500, status: 'active' } as unknown as Competitor]);

describe('quick match', () => {
  it('Anyone = every active competitor except the player; filters narrow correctly', () => {
    const any = eligiblePool(roster, 'anyone', 1500);
    expect(any.length).toBe(roster.filter(c => c.status === 'active' && c.id !== 'player').length);
    expect(eligiblePool(roster, 'near', 1500).every(c => Math.abs(c.rating - 1500) <= NEAR_RANGE)).toBe(true);
    expect(eligiblePool(roster, 'higher', 1500).every(c => c.rating > 1500)).toBe(true);
    expect(eligiblePool(roster, 'elite', 1500).every(c => c.rating >= ELITE_MIN)).toBe(true);
    expect(eligiblePool(roster, 'elite', 1500).length).toBeGreaterThan(0);
  });
  it('is deterministic under a seed and can select every eligible competitor', () => {
    const pool = eligiblePool(roster, 'anyone', 1500).slice(0, 50);
    const a = seededRng(7), b = seededRng(7);
    expect(Array.from({ length: 20 }, () => pickOpponent(pool, a)!.id)).toEqual(Array.from({ length: 20 }, () => pickOpponent(pool, b)!.id));
    const seen = new Set<string>(); const r = seededRng(11);
    for (let i = 0; i < 5000; i++) seen.add(pickOpponent(pool, r)!.id);
    expect(seen.size).toBe(50);
  });
  it('is not rating-weighted: low and high halves are drawn equally often (chi-square-style bound)', () => {
    const pool = eligiblePool(roster, 'anyone', 1500);
    const median = [...pool].map(c => c.rating).sort((x, y) => x - y)[pool.length >> 1];
    const r = seededRng(3); let hi = 0; const N = 20000;
    for (let i = 0; i < N; i++) if (pickOpponent(pool, r)!.rating >= median) hi++;
    const expected = pool.filter(c => c.rating >= median).length / pool.length;
    expect(Math.abs(hi / N - expected)).toBeLessThan(0.015);
  });
  it('reroll avoids repeating the same opponent when others exist; empty pool gives null', () => {
    const pool = eligiblePool(roster, 'anyone', 1500).slice(0, 2);
    const r = seededRng(5);
    for (let i = 0; i < 20; i++) expect(pickOpponent(pool, r, pool[0].id)!.id).toBe(pool[1].id);
    expect(pickOpponent([], r)).toBeNull();
    expect(eligiblePool(roster, 'elite', 5000).length).toBeGreaterThan(0);
    expect(eligiblePool(roster, 'higher', 9999)).toEqual([]);
  });
});
