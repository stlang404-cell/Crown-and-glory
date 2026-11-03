/**
 * Portable backup format crown-backup-1 (JSON). Documented in docs/SAVE_FORMAT.md.
 * Import validates structure, checksums and legal replay of every game before writing anything.
 */
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import { VARIANT_ID } from '../rules/types';
import type { GameRecord } from '../games/types';
import type { RatingEvent, PoolState } from '../ratings/ledger';
import { replayLedger } from '../ratings/ledger';
import type { AnalysisReport } from '../analysis/types';
import { CrownDB, APP_SCHEMA } from './db';
import { canonicalGame, gameChecksum, sha256Hex } from './checksum';

export const BACKUP_FORMAT = 'crown-backup-1';

export interface BackupBundle {
  format: typeof BACKUP_FORMAT;
  appSchema: string;
  variantId: string;
  exportedAt: string;
  appVersion: string;
  counts: { games: number; ratingEvents: number; reports: number };
  payloadSha256: string;
  payload: { games: GameRecord[]; ratingEvents: RatingEvent[]; ratingState: PoolState[]; reports: AnalysisReport[] };
}

export async function exportBundle(db: CrownDB, appVersion: string): Promise<BackupBundle> {
  const d = await db.dump();
  const payload = { games: d.games, ratingEvents: d.ratingEvents, ratingState: d.ratingState, reports: d.reports };
  return {
    format: BACKUP_FORMAT, appSchema: APP_SCHEMA, variantId: VARIANT_ID, exportedAt: new Date().toISOString(), appVersion,
    counts: { games: d.games.length, ratingEvents: d.ratingEvents.length, reports: d.reports.length },
    payloadSha256: await sha256Hex(JSON.stringify(payload)),
    payload,
  };
}

export class ImportError extends Error {}

/** Validate a bundle completely. Throws ImportError with a clear message on the first problem. */
export async function validateBundle(raw: unknown): Promise<BackupBundle> {
  const b = raw as BackupBundle;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) throw new ImportError('Not a Crown & Calculation backup (format crown-backup-1 expected).');
  if (b.variantId !== VARIANT_ID) throw new ImportError(`Backup is for variant ${b.variantId}, not ${VARIANT_ID}.`);
  if (b.appSchema !== APP_SCHEMA) throw new ImportError(`Unsupported save schema ${b.appSchema}.`);
  const p = b.payload;
  if (!p || !Array.isArray(p.games) || !Array.isArray(p.ratingEvents) || !Array.isArray(p.reports) || !Array.isArray(p.ratingState)) throw new ImportError('Backup payload is incomplete.');
  if ((await sha256Hex(JSON.stringify(p))) !== b.payloadSha256) throw new ImportError('Backup checksum mismatch: the file is corrupted or was modified.');
  for (const g of p.games) {
    if (typeof g.id !== 'string' || g.variantId !== VARIANT_ID || !Array.isArray(g.moves)) throw new ImportError(`Game ${g?.id ?? '?'} is malformed.`);
    let pos: Position;
    try { pos = Position.fromFen(g.initialFen); } catch (e) { throw new ImportError(`Game ${g.id}: invalid initial position (${(e as Error).message}).`); }
    for (const s of g.setupMoves ?? []) {
      const mv = parseLegalCcn(pos, s);
      if (mv < 0) throw new ImportError(`Game ${g.id}: illegal setup move ${s}.`);
      pos.makeMove(mv);
    }
    for (const m of g.moves) {
      const mv = parseLegalCcn(pos, m.ccn);
      if (mv < 0) throw new ImportError(`Game ${g.id}: illegal move ${m.ccn} at ply ${m.ply}.`);
      pos.makeMove(mv);
      if (pos.toFen() !== m.fenAfter) throw new ImportError(`Game ${g.id}: stored position after ply ${m.ply} does not match legal replay.`);
    }
    if (g.status === 'finalized' && g.checksum && g.checksum !== (await gameChecksum(g))) throw new ImportError(`Game ${g.id}: checksum mismatch.`);
  }
  // The rating ledger must replay to the stored pool states.
  for (const s of p.ratingState) {
    const r = replayLedger(s.pool, p.ratingEvents.filter(e => e.pool === s.pool));
    if (Math.abs(r.rating - s.rating) > 1e-6 || Math.abs(r.rd - s.rd) > 1e-6 || r.games !== s.games) throw new ImportError(`Rating pool ${s.pool} does not match its event ledger.`);
  }
  return b;
}

/**
 * Restore: into an empty career everything is imported (including rating ledger/state).
 * Into an existing career only games and reports with new ids are merged; rating events are not
 * merged into the active ledger (that would rewrite rating history) — those games stay viewable.
 */
export async function importBundle(db: CrownDB, raw: unknown): Promise<{ mode: 'restore' | 'merge'; games: number; events: number; reports: number; skipped: number }> {
  const b = await validateBundle(raw);
  const existing = await db.allGames();
  const empty = existing.length === 0 && (await db.ratingEvents()).length === 0;
  if (empty) {
    const r = await db.importRecords(b.payload, true);
    return { mode: 'restore', ...r };
  }
  const r = await db.importRecords({ games: b.payload.games.map(g => ({ ...g, context: { ...g.context, kind: g.context.kind } })), reports: b.payload.reports, ratingEvents: [], ratingState: [] }, false);
  return { mode: 'merge', ...r };
}

/** Single-game portable export (crown-game-1): lossless record plus report references. */
export function exportGame(g: GameRecord): string {
  return JSON.stringify({ format: 'crown-game-1', notation: 'ccn-1 (from-square to-square [q|r|n]; a1 = White queenside corner)', canonical: JSON.parse(canonicalGame(g)), record: g }, null, 2);
}
