/**
 * Start New Career (v0.11, docs/CAREER_RATING.md). Two steps, both required:
 *  1. `prepareNewCareer`: export a FULL backup of the current career (crown-backup-1, the same file as Library →
 *     Export Backup), hand its text to the UI to download, and keep a second copy in the career archive
 *     (src/storage/archive.ts) if storage allows;
 *  2. `startNewCareer` (only after the player confirms): clear the main database in one transaction and write a new
 *     career record — rating 0, RD 350, 0 rated games, provisional. The Federation world restarts with it (the career
 *     is the player's identity in the Federation): it is empty until the player founds a new one.
 * The archived backup and any downloaded file are never touched; either can be imported later (into an empty
 * career it restores the old career exactly, at its own rating origin).
 */
import type { CrownDB } from '../storage/db';
import { exportBundle } from '../storage/backup';
import { archiveBackup } from '../storage/archive';
import { newCareerRecord, type CareerRecord } from '../ratings/career';

export interface PreparedCareerChange {
  /** The backup file text (crown-backup-1). */
  json: string;
  filename: string;
  exportedAt: string;
  counts: { games: number; ratingEvents: number; reports: number };
  /** Id of the archived copy, or null when it could not be kept (then `archiveReason` says why). */
  archiveId: string | null;
  archiveReason?: string;
}

export async function prepareNewCareer(db: CrownDB, appVersion: string, factory?: IDBFactory): Promise<PreparedCareerChange> {
  const b = await exportBundle(db, appVersion);
  const json = JSON.stringify(b);
  const a = await archiveBackup(json, { at: b.exportedAt, careerId: db.career.id, appVersion, games: b.counts.games, ratingEvents: b.counts.ratingEvents }, factory);
  await db.setMeta('lastBackup', b.exportedAt);
  return {
    json, filename: `crown-backup-${b.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}-before-new-career.json`, exportedAt: b.exportedAt, counts: b.counts,
    archiveId: a.id, archiveReason: a.reason,
  };
}

/** Clear the career and start a new one at 0. `prepared` proves that step 1 ran in this session. */
export async function startNewCareer(db: CrownDB, prepared: PreparedCareerChange, nowIso: string = new Date().toISOString()): Promise<CareerRecord> {
  if (!prepared?.json || !prepared.exportedAt) throw new Error('Export a backup of your current career first.');
  const record = newCareerRecord(nowIso, prepared.archiveId);
  await db.startNewCareer(record);
  return record;
}
