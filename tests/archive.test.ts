import { describe, expect, it } from 'vitest';
import { buildRows } from '../src/ui/LibraryScreen';
import { createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';

describe('archive scale', () => {
  it('builds, filters and sorts a 10,000-game library index quickly', () => {
    const human = { kind: 'human' as const, id: 'p', name: 'You', rating: 1500, rd: 100 };
    const games = Array.from({ length: 10_000 }, (_, i) => {
      const g = createGameRecord({ id: `g${i}`, mode: 'casual', timeControl: TIME_CONTROLS.rapid, humanColor: i % 2 ? 'white' : 'black', human,
        engine: { kind: 'engine', id: 'o' + (i % 8), name: 'Opponent ' + (i % 8), rating: 1400, rd: 60 }, engineSeed: i, nowIso: new Date(1e12 + i * 6e4).toISOString() });
      g.status = 'finalized'; g.result = i % 3 === 0 ? '1-0' : i % 3 === 1 ? '0-1' : '1/2-1/2';
      return g;
    });
    const t0 = performance.now();
    const rows = buildRows(games, [], [], []);
    const filtered = rows.filter(r => r.opponent.includes('3') && r.result === 'Victory').sort((a, b) => b.game.startedAt.localeCompare(a.game.startedAt));
    const ms = performance.now() - t0;
    expect(rows).toHaveLength(10_000);
    expect(filtered.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000);
  });
});
