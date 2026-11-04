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
import { decodeAccounts } from '../federation/persist';
import { CAREER_MODEL, KNOWN_STARTS, LEGACY_START, legacyCareerRecord, type CareerRecord } from '../ratings/career';

export const BACKUP_FORMAT = 'crown-backup-1';

export interface BackupBundle {
  format: typeof BACKUP_FORMAT;
  appSchema: string;
  variantId: string;
  exportedAt: string;
  appVersion: string;
  counts: { games: number; ratingEvents: number; reports: number };
  payloadSha256: string;
  payload: { games: GameRecord[]; ratingEvents: RatingEvent[]; ratingState: PoolState[]; reports: AnalysisReport[]; attempts?: { id: string }[]; trainingRuns?: { id: string }[]; bookmarks?: { id: string }[]; federation?: Record<string, unknown[]>;
    /** v0.9: Vault unlocks/notices (ach:, achtoast:, vault:) and Grimoire progress (grim:) from the meta store. Optional: older backups have none. */
    progress?: { key: string; value: unknown }[];
    /** v0.11: the career's rating origin (crown-career-1). Optional: a backup without it is from a career created
     *  before v0.11, whose pools started at 1500. */
    career?: CareerRecord };
}

/** The rating origin a backup's ledger replays from. */
export const bundleCareer = (b: BackupBundle): CareerRecord => b.payload.career ?? legacyCareerRecord(b.exportedAt);

/** Meta-store prefixes carried in backups. */
export const PROGRESS_PREFIXES = ['ach:', 'achtoast:', 'vault:', 'grim:'] as const;
const CAREER_ONLY = ['ach:', 'achtoast:', 'vault:'];

export async function exportBundle(db: CrownDB, appVersion: string): Promise<BackupBundle> {
  const d = await db.dump();
  const progress: { key: string; value: unknown }[] = [];
  for (const p of PROGRESS_PREFIXES) progress.push(...(await db.metaWithPrefix(p)));
  const payload = { games: d.games, ratingEvents: d.ratingEvents, ratingState: d.ratingState, reports: d.reports, attempts: d.attempts as { id: string }[], trainingRuns: d.trainingRuns as { id: string }[], bookmarks: d.bookmarks as { id: string }[], federation: d.federation, progress, career: db.career };
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
  if (p.progress !== undefined && (!Array.isArray(p.progress) || p.progress.some(e => !e || typeof e.key !== 'string' || !PROGRESS_PREFIXES.some(pre => e.key.startsWith(pre)))))
    throw new ImportError('Backup progress records are malformed.');
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
  // The rating ledger must replay to the stored pool states, from the career's own rating origin.
  const c = p.career;
  if (c !== undefined && (!c || c.model !== CAREER_MODEL || !KNOWN_STARTS.includes(c.ratingStart))) throw new ImportError('Backup career record is malformed.');
  const start = c?.ratingStart ?? LEGACY_START;
  for (const e of p.ratingEvents) if (e.sequence === 1 && e.before.rating !== start) throw new ImportError(`Rating pool ${e.pool} does not start at this career's initial rating.`);
  for (const s of p.ratingState) {
    const r = replayLedger(s.pool, p.ratingEvents.filter(e => e.pool === s.pool), start);
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
    // the restored career keeps its own rating origin (a pre-v0.11 career restored into a new profile stays at 1500)
    await db.adoptCareer(bundleCareer(b));
    const r = await db.importRecords(b.payload, true);
    // federation & economy state is restored only into an empty career (it is one consistent world)
    const fed = b.payload.federation;
    if (fed && fed.world?.length) {
      const { FEDERATION_STORES } = await import('./db');
      validateFederation(fed);
      await db.commit(FEDERATION_STORES.map(store => ({ store, put: fed[store] ?? [] })));
    }
    if (b.payload.progress?.length) await db.putMetaIfAbsent(b.payload.progress);
    return { mode: 'restore', ...r };
  }
  const r = await db.importRecords({ games: b.payload.games, reports: b.payload.reports, ratingEvents: [], ratingState: [], attempts: b.payload.attempts, trainingRuns: b.payload.trainingRuns, bookmarks: b.payload.bookmarks }, false);
  // merging into another career: learning progress only (achievements belong to the career that earned them)
  const learning = (b.payload.progress ?? []).filter(e => !CAREER_ONLY.some(pre => e.key.startsWith(pre)));
  if (learning.length) await db.putMetaIfAbsent(learning);
  return { mode: 'merge', ...r };
}

/** Structural checks on an imported federation snapshot: ledger balances must equal the journal replay. */
export function validateFederation(fed: Record<string, unknown[]>): void {
  const journals = (fed.journal ?? []) as { id: string; lines: { account: string; amount: number }[] }[];
  const bal = new Map<string, number>();
  let total = 0;
  for (const jr of journals) {
    let s = 0;
    for (const l of jr.lines) { if (!Number.isSafeInteger(l.amount)) throw new ImportError(`Journal ${jr.id} has a non-integer amount.`); s += l.amount; bal.set(l.account, (bal.get(l.account) ?? 0) + l.amount); }
    if (s !== 0) throw new ImportError(`Journal ${jr.id} does not balance.`);
    total += s;
  }
  // v0.10 compact persistence: competitors' accounts are stored in chunk records (src/federation/persist.ts)
  let accounts: { account: string; balance: number }[];
  try { accounts = decodeAccounts(fed.accounts ?? []).accounts; } catch (e) { throw new ImportError(`Federation accounts are damaged: ${(e as Error).message}`); }
  for (const a of accounts) {
    if ((bal.get(a.account) ?? 0) !== a.balance) throw new ImportError(`Account ${a.account} does not match its journal history.`);
  }
  if (total !== 0) throw new ImportError('Ledger does not conserve money.');
}

/** Single-game portable export (crown-game-1): lossless record plus report references. */
export function exportGame(g: GameRecord): string {
  return JSON.stringify({ format: 'crown-game-1', notation: 'ccn-1 (from-square to-square [q|r|n]; a1 = White queenside corner)', canonical: JSON.parse(canonicalGame(g)), record: g }, null, 2);
}
