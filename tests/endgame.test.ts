import { describe, expect, it } from 'vitest';
import { solve, summarise, probeFen, probeMoves } from '../tools/grimoire/endgame';

// Exhaustive retrograde solver (tools/grimoire/endgame.ts) — the 3-man tables solve in well under a second each.
describe('endgame solver (Grimoire Book IV evidence)', () => {
  it('KQK: every White-to-move position is won, at most 7 moves', () => {
    const t0 = Date.now();
    const s = summarise(solve('KQvK'));
    expect(s.wins[0]).toBe(s.positions[0]);
    expect(s.maxWinMoves[0]).toBe(7);
    expect(probeFen('6/6/4k1/6/1Q4/K5 w')).toMatchObject({ result: 'win', moves: 7 });
    expect(Date.now() - t0).toBeLessThan(15_000);
  });

  it('KRK: 25,440 positions with White to move, all won, longest 12 moves', () => {
    const s = summarise(solve('KRvK'));
    expect(s.positions[0]).toBe(25_440);
    expect(s.wins[0]).toBe(25_440);
    expect(s.maxWinMoves[0]).toBe(12);
    expect(probeFen('6/6/6/6/2k3/KR4 w')).toMatchObject({ result: 'win', moves: 12 });
  });

  it('KNK: no position is a win for either side', () => {
    const s = summarise(solve('KNvK'));
    expect(s.wins).toEqual([0, 0]);
    expect(s.losses).toEqual([0, 0]);
  });

  it('KPK: 22,484 positions, 76.0% won; the published opposition and conversion examples', () => {
    const s = summarise(solve('KPvK'));
    expect(s.positions[0]).toBe(22_484);
    expect((100 * s.wins[0] / s.positions[0]).toFixed(1)).toBe('76.0');
    expect(s.maxWinMoves[0]).toBe(20);
    expect(probeFen('6/3k2/6/3K2/3P2/6 w').result).toBe('draw');
    expect(probeFen('6/3k2/6/3K2/3P2/6 b')).toMatchObject({ result: 'loss', moves: 12 });
    const moves = Object.fromEntries(probeMoves('4k1/6/3K2/3P2/6/6 w').map(m => [m.san, m.result === 'draw' ? 'draw' : `${m.result}-${m.moves}`]));
    expect(moves).toMatchObject({ Kc5: 'win-9', Kc4: 'win-11', Ke4: 'win-11', Kc3: 'draw', Ke3: 'draw' });
  });
});
