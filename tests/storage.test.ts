import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { exportBundle, importBundle, validateBundle, ImportError } from '../src/storage/backup';
import { gameChecksum } from '../src/storage/checksum';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';
import { replayLedger } from '../src/ratings/ledger';

const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 350 };
const engine = { kind: 'engine' as const, id: 'ai-1', name: 'AI', rating: 1400, rd: 60, engine: { profileId: 'L3', level: 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'cal', style: 'standard' } };

function finishedGame(id: string, mode: 'rated' | 'casual' = 'rated') {
  const s = new GameSession(createGameRecord({ id, mode, timeControl: TIME_CONTROLS.rapid, humanColor: 'white', human, engine, engineSeed: 1, nowIso: '2026-11-03T00:00:00Z' }));
  s.start(0);
  for (const m of ['c2c3', 'c5c4', 'e1f3', 'e6f4']) s.applyMove(m, 1, 'T');
  s.resign(1, 2, '2026-11-03T00:10:00Z');
  return s.snapshot();
}

describe('storage', () => {
  it('finalization is atomic and idempotent: exactly one rating update', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const g = finishedGame('g1');
    await db.saveGame(g);
    const checksum = await gameChecksum(g);
    const a = await db.finalizeGame(g, { checksum, nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    const b = await db.finalizeGame(g, { checksum, nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    // concurrent retries too
    await Promise.all([1, 2, 3].map(() => db.finalizeGame(g, { checksum, nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 })));
    expect(a.alreadyFinalized).toBe(false);
    expect(b.alreadyFinalized).toBe(true);
    const events = await db.ratingEvents('rapid');
    expect(events).toHaveLength(1);
    const state = await db.ratingState('rapid');
    expect(state.games).toBe(1);
    expect(state.rating).toBeGreaterThan(1500);
    expect(replayLedger('rapid', events).rating).toBe(state.rating);
    expect((await db.getGame('g1'))?.status).toBe('finalized');
    expect((await db.allJobs()).map(j => j.id)).toEqual(['job:g1:std-d7']);
    await expect(db.saveGame({ ...g, result: '0-1' })).rejects.toThrow(/immutable/);
  });
  it('casual games are stored but never rated', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const g = finishedGame('c1', 'casual');
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    expect(await db.ratingEvents()).toHaveLength(0);
    expect((await db.getGame('c1'))?.status).toBe('finalized');
  });
  it('data survives closing and reopening the database', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const g = finishedGame('p1');
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    db.close();
    const db2 = await CrownDB.open(f);
    expect((await db2.getGame('p1'))?.moves).toHaveLength(4);
    expect(await db2.ratingEvents()).toHaveLength(1);
  });
  it('export → import round trip into a fresh career restores games, ledger and state', async () => {
    const db = await CrownDB.open(new IDBFactory());
    for (const id of ['a', 'b', 'c']) {
      const g = finishedGame(id);
      await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'N' + id, analysisSettingsId: 'std-d7', humanScore: 1 });
    }
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, 'test')));
    const fresh = await CrownDB.open(new IDBFactory());
    const r = await importBundle(fresh, bundle);
    expect(r.mode).toBe('restore');
    expect((await fresh.allGames()).map(g => g.id).sort()).toEqual(['a', 'b', 'c']);
    expect((await fresh.ratingState('rapid')).rating).toBe((await db.ratingState('rapid')).rating);
    // importing again merges nothing new
    const again = await importBundle(fresh, bundle);
    expect(again.mode).toBe('merge');
    expect(again.games).toBe(0);
  });
  it('rejects tampered or illegal backups', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const g = finishedGame('t1');
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, 'test')));
    const tampered = structuredClone(bundle);
    tampered.payload.games[0].moves[0].ccn = 'a2a4';
    await expect(validateBundle(tampered)).rejects.toThrow(ImportError);
    await expect(validateBundle({ format: 'nope' })).rejects.toThrow(ImportError);
  });
});
