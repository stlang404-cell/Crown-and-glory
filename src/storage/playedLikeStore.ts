/**
 * Permanent Played Like records in the save (v0.10, additive, no IndexedDB version change): stored on the finalized
 * GameRecord as `playedLike` (one crown-pl-record-1 entry per model id), so they are carried by backups and survive
 * reloads exactly like the game. Saves from v0.9 and earlier have no such field; `backfillPlayedLike` gives every
 * finalized game whose analysis exists its record (games without analysis get one when their analysis completes).
 */
import type { CrownDB } from './db';
import type { AnalysisReport } from '../analysis/types';
import { buildPlayedLikeRecord, needsRecord } from '../analysis/playedLikeRecords';

/** Store (or refresh) the record of one finalized player game, if its analysis supports one. Idempotent. */
export async function recordPlayedLike(db: CrownDB, gameId: string, reports?: AnalysisReport[], nowIso?: string): Promise<boolean> {
  const g = await db.getGame(gameId);
  if (!g) return false;
  const rep = needsRecord(g, reports ?? await db.reportsForGame(gameId));
  if (!rep) return false;
  const ev = g.ratingEventId && g.pool ? (await db.ratingEvents(g.pool)).find(e => e.id === g.ratingEventId) ?? null : null;
  const rec = buildPlayedLikeRecord(g, rep, ev, nowIso);
  if (!rec) return false;
  return db.setPlayedLikeRecord(gameId, rec);
}

/** Records for every finalized game that has analysis but no current record. Returns how many were written. */
export async function backfillPlayedLike(db: CrownDB, nowIso?: string): Promise<number> {
  const [games, reports] = await Promise.all([db.allGames(), db.allReports()]);
  const byGame = new Map<string, AnalysisReport[]>();
  for (const r of reports) byGame.set(r.gameId, [...(byGame.get(r.gameId) ?? []), r]);
  let n = 0;
  for (const g of games) {
    const rs = byGame.get(g.id) ?? [];
    if (needsRecord(g, rs) && await recordPlayedLike(db, g.id, rs, nowIso)) n++;
  }
  return n;
}
