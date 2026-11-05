import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { exportBundle, importBundle, validateBundle, ImportError } from '../src/storage/backup';
import { gameChecksum } from '../src/storage/checksum';
import { GameSession, createGameRecord } from '../src/games/session';
import { CAREER_POOL } from '../src/ratings/pools';
import { TIME_CONTROLS } from '../src/games/types';
import { replayLedger } from '../src/ratings/ledger';

const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 350 };
const engine = { kind: 'engine' as const, id: 'ai-1', name: 'AI', rating: 1400, rd: 60, engine: { profileId: 'L3', level: 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'cal', style: 'standard' } };

/** A finished game: Classical 60+60 (the career pool) by default; `legacy` builds a pre-v1.1 rated Rapid 5+3 record. */
function finishedGame(id: string, mode: 'rated' | 'casual' = 'rated', legacy = false) {
  const rec = createGameRecord({ id, mode, timeControl: legacy ? TIME_CONTROLS.rapid : TIME_CONTROLS.classical60, humanColor: 'white', human, engine, engineSeed: 1, nowIso: '2026-11-03T00:00:00Z' });
  if (legacy && mode === 'rated') Object.assign(rec, { mode: 'rated', rated: true, pool: 'rapid' });
  const s = new GameSession(rec);
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
    const events = await db.ratingEvents(CAREER_POOL);
    expect(events).toHaveLength(1);
    const state = await db.ratingState(CAREER_POOL);
    expect(state.games).toBe(1);
    expect(state.rating).toBeGreaterThan(0); // a fresh profile is a new career: it starts at 0 (docs/CAREER_RATING.md)
    expect(replayLedger(CAREER_POOL, events).rating).toBe(state.rating);
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
    expect((await fresh.ratingState(CAREER_POOL)).rating).toBe((await db.ratingState(CAREER_POOL)).rating);
    // importing again merges nothing new
    const again = await importBundle(fresh, bundle);
    expect(again.mode).toBe('merge');
    expect(again.games).toBe(0);
  });
  it('backups carry Vault unlocks and Grimoire progress; restore keeps both, merge keeps only learning progress', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const g = finishedGame('x');
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'Nx', analysisSettingsId: 'std-d7', humanScore: 1 });
    await db.putMetaIfAbsent([{ key: 'ach:first-win', value: { id: 'first-win', at: 'T' } }, { key: 'grim:done:b1-1', value: { at: 'T' } }, { key: 'unrelated', value: 1 }]);
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, 'test')));
    expect(bundle.payload.progress.map((e: { key: string }) => e.key).sort()).toEqual(['ach:first-win', 'grim:done:b1-1']);
    const fresh = await CrownDB.open(new IDBFactory());
    await importBundle(fresh, bundle);
    expect(await fresh.getMeta('ach:first-win')).toEqual({ id: 'first-win', at: 'T' });
    expect(await fresh.getMeta('grim:done:b1-1')).toEqual({ at: 'T' });
    // merging into a different career: learning progress only, never someone else's achievements; never overwrites
    const other = await CrownDB.open(new IDBFactory());
    const g2 = finishedGame('y');
    await other.finalizeGame(g2, { checksum: await gameChecksum(g2), nowIso: 'Ny', analysisSettingsId: 'std-d7', humanScore: 1 });
    await other.putMetaIfAbsent([{ key: 'grim:done:b1-1', value: { at: 'EARLIER' } }]);
    const r = await importBundle(other, bundle);
    expect(r.mode).toBe('merge');
    expect(await other.getMeta('ach:first-win')).toBeUndefined();
    expect(await other.getMeta('grim:done:b1-1')).toEqual({ at: 'EARLIER' });
  });
  it('older backups without progress records still import', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const g = finishedGame('z');
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'Nz', analysisSettingsId: 'std-d7', humanScore: 1 });
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, 'test')));
    delete bundle.payload.progress;
    const { sha256Hex } = await import('../src/storage/checksum');
    bundle.payloadSha256 = await sha256Hex(JSON.stringify(bundle.payload));
    const r = await importBundle(await CrownDB.open(new IDBFactory()), bundle);
    expect(r.mode).toBe('restore');
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

describe('schema migration v1 → v2', () => {
  it('upgrades a v1 database without touching existing games or ratings', async () => {
    const f = new IDBFactory();
    const v1 = await CrownDB.open(f, 'crown-calculation', 1);
    const g = finishedGame('m1', 'rated', true);
    await v1.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    expect([...v1.db.objectStoreNames]).not.toContain('attempts');
    const before = await v1.ratingState('rapid');
    v1.close();
    const v2 = await CrownDB.open(f, 'crown-calculation', 2);
    expect([...v2.db.objectStoreNames]).toEqual(expect.arrayContaining(['attempts', 'trainingRuns', 'bookmarks', 'games']));
    expect((await v2.getGame('m1'))?.moves).toHaveLength(4);
    expect((await v2.ratingState('rapid')).rating).toBe(before.rating);
    await v2.put('attempts', { id: 'a1', puzzleId: 'p', at: 'T' });
    expect(await v2.getAll('attempts')).toHaveLength(1);
  });
});

describe('schema migration v2 → v3 (federation)', () => {
  it('adds the federation and economy stores without touching games, ratings or Academy data', async () => {
    const f = new IDBFactory();
    const v2 = await CrownDB.open(f, 'crown-calculation', 2);
    const g = finishedGame('m2', 'rated', true);
    await v2.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    await v2.put('attempts', { id: 'a1', puzzleId: 'p', at: 'T' });
    const before = await v2.ratingState('rapid');
    v2.close();
    const v3 = await CrownDB.open(f, 'crown-calculation', 3);
    expect([...v3.db.objectStoreNames]).toEqual(expect.arrayContaining(['world', 'competitors', 'rounds', 'journal', 'accounts', 'markets', 'positions', 'assets', 'finance', 'games', 'attempts']));
    expect((await v3.getGame('m2'))?.moves).toHaveLength(4);
    expect((await v3.ratingState('rapid')).rating).toBe(before.rating);
    expect(await v3.getAll('attempts')).toHaveLength(1);
    expect(await v3.loadAll('world')).toHaveLength(0); // no federation until the player founds one
  });
});

describe('schema migration v3 → v4 (live games, contracts)', () => {
  it('adds liveGames and contracts without touching games, ratings or federation stores', async () => {
    const f = new IDBFactory();
    const v3 = await CrownDB.open(f, 'crown-calculation', 3);
    const g = finishedGame('m3', 'rated', true);
    await v3.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
    await v3.commit([{ store: 'journal', put: [{ id: 'j1', at: 'T', kind: 'mint', memo: '', lines: [] }] }, { store: 'world', put: [{ key: 'world', season: 2, round: 7 }] }]);
    const before = await v3.ratingState('rapid');
    v3.close();
    const v4 = await CrownDB.open(f, 'crown-calculation', 4);
    expect([...v4.db.objectStoreNames]).toEqual(expect.arrayContaining(['liveGames', 'contracts', 'journal', 'world', 'games']));
    expect((await v4.getGame('m3'))?.moves).toHaveLength(4);
    expect((await v4.ratingState('rapid')).rating).toBe(before.rating);
    expect(await v4.loadAll('journal')).toHaveLength(1);
    expect((await v4.loadAll<{ round: number }>('world'))[0].round).toBe(7);
    expect(await v4.loadAll('liveGames')).toHaveLength(0);
  });
});
