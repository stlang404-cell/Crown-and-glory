/** Permanent Played Like records: persistence with the game, reload, backup round trip, v0.9 backfill, model-version
 *  separation, exclusion of low-confidence estimates, statistics. */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import MODEL from '../src/analysis/played-like-model.json';
import { CrownDB } from '../src/storage/db';
import { exportBundle, importBundle } from '../src/storage/backup';
import { gameChecksum } from '../src/storage/checksum';
import { backfillPlayedLike, recordPlayedLike } from '../src/storage/playedLikeStore';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS, type GameRecord } from '../src/games/types';
import { CAREER_POOL } from '../src/ratings/pools';
import { PLAYED_LIKE_ID, playedLike, type PlayedLike } from '../src/analysis/playedLike';
import { ADEQUATE_MOVES, PL_RECORD_SCHEMA, confidenceOf, playedLikeCareer, playedLikeStats, upsertRecord, type PlayedLikeGameRecord } from '../src/analysis/playedLikeRecords';
import type { LitePly } from '../src/analysis/playedLikeFeatures';
import type { AnalysisReport } from '../src/analysis/types';

const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 350 };
const engine = { kind: 'engine' as const, id: 'ai-7', name: 'Mira Vell', rating: 1400, rd: 60, engine: { profileId: 'L3', level: 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'cal', style: 'standard' } };

function finishedGame(id: string, at = '2026-11-03T00:10:00Z') {
  const s = new GameSession(createGameRecord({ id, mode: 'rated', timeControl: TIME_CONTROLS.classical60, humanColor: 'white', human, engine, engineSeed: 1, nowIso: '2026-11-03T00:00:00Z' }));
  s.start(0);
  for (const m of ['c2c3', 'c5c4', 'e1f3', 'e6f4']) s.applyMove(m, 1, 'T');
  s.resign(1, 2, at); // ends 1-0: a win for the player (White)
  return s.snapshot();
}
function plies(n: number): LitePly[] {
  const out: LitePly[] = [];
  for (let i = 0; i < n; i++) for (const c of [0, 1] as const) {
    const ub = 0.5, loss = i % 5 === 0 ? 0.08 : 0.01;
    out.push({ ply: 2 * i + 1 + c + 4, c, forced: 0, legal: 12, ph: 1, loss, lossPrev: loss, g: -1, ub, up: ub - loss, cu: [ub, ub - 0.06, ub - 0.12] });
  }
  return out;
}
const report = (gameId: string, n = 30, at = '2026-11-03T00:20:00Z') => ({
  id: `report:${gameId}:x:${MODEL.analysis.engine}:${MODEL.analysis.settings}:${MODEL.analysis.grading}`, gameId, status: 'complete',
  settings: { id: MODEL.analysis.settings }, engine: { buildId: MODEL.analysis.engine }, methodology: { gradingId: MODEL.analysis.grading },
  completedAt: at, plies: plies(n), summary: {},
}) as unknown as AnalysisReport;

async function finalized(db: CrownDB, id: string, at?: string): Promise<GameRecord> {
  const g = finishedGame(id, at);
  await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: at ?? 'N', analysisSettingsId: 'std-d7', humanScore: 1 });
  return (await db.getGame(id))!;
}

const okEst = (rating: number, moves: number, modelId = PLAYED_LIKE_ID): PlayedLike => ({ status: 'ok', rating, low: rating - 200, high: rating + 200, low95: rating - 300, high95: rating + 300, half80: 200, sd: 156, moves, capped: false, modelId });
const rec = (gameId: string, at: string, est: PlayedLike, modelId = PLAYED_LIKE_ID): PlayedLikeGameRecord => ({
  schema: PL_RECORD_SCHEMA, modelId, reportId: 'r', gameId, at, recordedAt: at, pov: 'white', opponent: { id: 'o', name: 'O' }, result: 1, pool: 'rapid', career: { before: 1500, after: 1510, rd: 80 }, estimate: est, confidence: confidenceOf(est),
});

describe('Played Like records in the save', () => {
  it('a completed analysis stores the record with the game: date, opponent, result, career rating, estimate, model', async () => {
    const db = await CrownDB.open(new IDBFactory());
    await finalized(db, 'g1');
    await db.addReport(report('g1'));
    expect(await recordPlayedLike(db, 'g1')).toBe(true);
    const g = (await db.getGame('g1'))!;
    expect(g.playedLike).toHaveLength(1);
    const r = g.playedLike![0];
    expect(r).toMatchObject({ schema: PL_RECORD_SCHEMA, modelId: PLAYED_LIKE_ID, gameId: 'g1', at: '2026-11-03T00:10:00Z', pov: 'white', opponent: { id: 'ai-7', name: 'Mira Vell' }, result: 1, pool: CAREER_POOL });
    const ev = (await db.ratingEvents(CAREER_POOL))[0];
    expect(r.career).toEqual({ before: Math.round(ev.before.rating), after: Math.round(ev.after.rating), rd: Math.round(ev.after.rd) });
    expect(r.estimate).toEqual(playedLike(report('g1'), 'white'));
    expect(r.confidence).toBe(confidenceOf(r.estimate));
    // idempotent; the game's checksum and moves are untouched
    expect(await recordPlayedLike(db, 'g1')).toBe(false);
    expect(await gameChecksum(g)).toBe(g.checksum);
  });

  it('survives reload and a backup export/import round trip', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    await finalized(db, 'g1');
    await db.addReport(report('g1'));
    await recordPlayedLike(db, 'g1');
    const before = (await db.getGame('g1'))!.playedLike;
    db.close();
    const db2 = await CrownDB.open(f);
    expect((await db2.getGame('g1'))!.playedLike).toEqual(before);
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db2, 'test')));
    const fresh = await CrownDB.open(new IDBFactory());
    await importBundle(fresh, bundle);
    expect((await fresh.getGame('g1'))!.playedLike).toEqual(before);
  });

  it('v0.9 saves (games without records) are backfilled where analysis exists; others wait for their analysis', async () => {
    const db = await CrownDB.open(new IDBFactory());
    await finalized(db, 'old1'); await finalized(db, 'old2');
    await db.addReport(report('old1'));
    expect((await db.getGame('old1'))!.playedLike).toBeUndefined();
    expect(await backfillPlayedLike(db)).toBe(1);
    expect((await db.getGame('old1'))!.playedLike).toHaveLength(1);
    expect((await db.getGame('old2'))!.playedLike).toBeUndefined();
    expect(await backfillPlayedLike(db)).toBe(0);
    await db.addReport(report('old2'));
    expect(await backfillPlayedLike(db)).toBe(1);
  });

  it('records of other model versions are kept beside the current one, never replaced', async () => {
    const db = await CrownDB.open(new IDBFactory());
    await finalized(db, 'g1');
    await db.setPlayedLikeRecord('g1', rec('g1', '2026-01-01', okEst(1200, 30, 'crown-played-like-0'), 'crown-played-like-0'));
    await db.addReport(report('g1'));
    await recordPlayedLike(db, 'g1');
    expect((await db.getGame('g1'))!.playedLike!.map(r => r.modelId).sort()).toEqual(['crown-played-like-0', PLAYED_LIKE_ID].sort());
  });
});

describe('Played Like statistics', () => {
  const recs = [
    rec('a', '2026-01-01', okEst(1400, 30)), rec('b', '2026-01-02', okEst(1800, 25)), rec('c', '2026-01-03', okEst(900, 20)),
    rec('low', '2026-01-04', okEst(2900, ADEQUATE_MOVES - 1)), // low confidence: kept, not counted
    rec('ins', '2026-01-05', { status: 'insufficient', moves: 4, needed: 8, modelId: PLAYED_LIKE_ID }),
    rec('old', '2026-01-06', okEst(3000, 40, 'crown-played-like-0'), 'crown-played-like-0'),
  ];
  it('highest / lowest / average / median / most recent count only adequate estimates of the same model', () => {
    const s = playedLikeStats(recs, PLAYED_LIKE_ID);
    expect(s.analysed).toBe(5);
    expect(s.counted).toBe(3);
    expect(s.highest!.gameId).toBe('b');
    expect(s.lowest!.gameId).toBe('c');
    expect(s.average).toBe(Math.round((1400 + 1800 + 900) / 3));
    expect(s.median).toBe(1400);
    expect(s.mostRecent!.gameId).toBe('c');
    expect(s.recent[10]).toBeNull();
    expect(s.series.map(p => p.gameId)).toEqual(['a', 'b', 'c']);
    expect(s.series[1].rolling).toBe(1600);
  });
  it('model versions are reported separately, the current one first', () => {
    const games = [{ playedLike: recs.slice(0, 5) }, { playedLike: [recs[5]] }] as unknown as GameRecord[];
    const { byModel } = playedLikeCareer(games);
    expect(byModel.map(s => s.modelId)).toEqual([PLAYED_LIKE_ID, 'crown-played-like-0']);
    expect(byModel[1].highest!.gameId).toBe('old');
    expect(byModel[0].highest!.gameId).toBe('b');
  });
  it('recent averages and trend need enough counted games', () => {
    const many = Array.from({ length: 25 }, (_, i) => rec(`g${i}`, `2026-02-${String(i + 1).padStart(2, '0')}`, okEst(1000 + 10 * i, 30)));
    const s = playedLikeStats(many, PLAYED_LIKE_ID);
    expect(s.recent[10]).toBe(Math.round(1000 + 10 * 19.5));
    expect(s.recent[50]).toBeNull();
    expect(s.trend).toBe(100);
  });
  it('upsert replaces only the same model id', () => {
    const l = upsertRecord([recs[0], recs[5]], { ...recs[0], estimate: okEst(1500, 30) });
    expect(l).toHaveLength(2);
    expect(l.find(r => r.modelId === PLAYED_LIKE_ID)!.estimate).toMatchObject({ rating: 1500 });
  });
});
