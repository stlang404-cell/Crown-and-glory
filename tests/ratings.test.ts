import { describe, expect, it } from 'vitest';
import { updateRating, expectedScore, isProvisional, initialRating } from '../src/ratings/glicko2';
import { computeRatingEvent, newPoolState, replayLedger, explainEvent, rankFor } from '../src/ratings/ledger';

describe('Glicko-2', () => {
  it("reproduces Glickman's published worked example", () => {
    const { after } = updateRating({ rating: 1500, rd: 200, sigma: 0.06 }, [
      { rating: 1400, rd: 30, score: 1 }, { rating: 1550, rd: 100, score: 0 }, { rating: 1700, rd: 300, score: 0 },
    ]);
    expect(after.rating).toBeCloseTo(1464.05, 1);
    expect(after.rd).toBeCloseTo(151.52, 1);
    expect(after.sigma).toBeCloseTo(0.059996, 5);
  });
  it('inactivity only increases RD (capped at 350)', () => {
    const { after } = updateRating({ rating: 1600, rd: 100, sigma: 0.06 }, []);
    expect(after.rating).toBe(1600);
    expect(after.rd).toBeGreaterThan(100);
    expect(updateRating({ rating: 1600, rd: 349, sigma: 0.06 }, []).after.rd).toBeLessThanOrEqual(350);
  });
  it('wins raise, losses lower, draws vs equal leave rating ~unchanged', () => {
    const p = initialRating();
    expect(updateRating(p, [{ rating: 1500, rd: 50, score: 1 }]).after.rating).toBeGreaterThan(1500);
    expect(updateRating(p, [{ rating: 1500, rd: 50, score: 0 }]).after.rating).toBeLessThan(1500);
    expect(updateRating(p, [{ rating: 1500, rd: 50, score: 0.5 }]).after.rating).toBeCloseTo(1500, 6);
  });
  it('beating a stronger opponent gains more than beating a weaker one', () => {
    const p = { rating: 1500, rd: 120, sigma: 0.06 };
    const strong = updateRating(p, [{ rating: 1800, rd: 50, score: 1 }]).after.rating - 1500;
    const weak = updateRating(p, [{ rating: 1200, rd: 50, score: 1 }]).after.rating - 1500;
    expect(strong).toBeGreaterThan(weak);
    expect(expectedScore(p, { rating: 1800, rd: 50 })).toBeLessThan(0.5);
  });
  it('volatility stays bounded and the result is finite under extreme inputs', () => {
    let r = { rating: 1500, rd: 350, sigma: 0.06 };
    for (let i = 0; i < 200; i++) r = updateRating(r, [{ rating: i % 2 ? 3000 : 100, rd: 30, score: i % 2 }]).after;
    expect(Number.isFinite(r.rating)).toBe(true);
    expect(r.sigma).toBeGreaterThan(0);
    expect(r.sigma).toBeLessThan(1);
  });
  it('provisional until 20 games and RD <= 100', () => {
    expect(isProvisional(19, 50)).toBe(true);
    expect(isProvisional(20, 101)).toBe(true);
    expect(isProvisional(20, 100)).toBe(false);
  });
});

describe('rating ledger', () => {
  it('events are reproducible by replay and explainable', () => {
    let s = newPoolState('rapid');
    const events = [];
    const opps = [[1200, 60, 1], [1400, 60, 0.5], [1600, 60, 0], [1500, 60, 1]] as const;
    opps.forEach(([rating, rd, score], i) => {
      const r = computeRatingEvent(s, `g${i}`, `2026-01-0${i + 1}T00:00:00Z`, { id: 'o', name: 'Opp', rating, rd, calibrationId: 'c' }, score);
      events.push(r.event);
      s = r.next;
    });
    const replayed = replayLedger('rapid', events);
    expect(replayed.rating).toBe(s.rating);
    expect(replayed.rd).toBe(s.rd);
    expect(replayed.games).toBe(4);
    expect(s.wins).toBe(2); expect(s.draws).toBe(1); expect(s.losses).toBe(1);
    expect(events[0].id).toBe('rating:g0:rapid');
    expect(explainEvent(events[0])).toMatch(/expected score/);
    expect(s.peak).toBeNull(); // provisional: no established peak yet
  });
  it('rank is Provisional until established', () => {
    expect(rankFor(1800, 5, 300)).toBe('Provisional');
    expect(rankFor(1800, 25, 80)).toBe('National');
  });
});
