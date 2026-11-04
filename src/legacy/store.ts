/**
 * Trophy and legacy-preference persistence. Additive use of the existing IndexedDB `meta` store (no schema version
 * change): one record per trophy under `trophy:<key>` written put-if-absent (never overwritten, never removed),
 * ceremony-shown markers under `trophyseen:<key>`, the one-time back-fill marker `legacy:backfilled` and the header
 * customisation `legacy:prefs`. All four prefixes are carried in backups (src/storage/backup.ts PROGRESS_PREFIXES).
 */
import type { TrophyRecord } from './trophies';
import { PREFS_KEY, parsePrefs, type LegacyPrefs } from './customise';

export const TROPHY_PREFIX = 'trophy:';
export const SEEN_PREFIX = 'trophyseen:';
export const LEGACY_BACKFILL_KEY = 'legacy:backfilled';

export interface LegacyDB {
  metaWithPrefix<T = unknown>(prefix: string): Promise<{ key: string; value: T }[]>;
  putMetaIfAbsent(entries: { key: string; value: unknown }[]): Promise<string[]>;
  getMeta<T = unknown>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}

export async function loadAwards(db: LegacyDB): Promise<Map<string, TrophyRecord>> {
  const rows = await db.metaWithPrefix<TrophyRecord>(TROPHY_PREFIX);
  return new Map(rows.filter(r => r.value && typeof r.value.key === 'string').map(r => [r.value.key, r.value]));
}
/** Put-if-absent; returns only the records actually written. */
export async function saveAwards(db: LegacyDB, recs: TrophyRecord[]): Promise<TrophyRecord[]> {
  const written = new Set(await db.putMetaIfAbsent(recs.map(r => ({ key: TROPHY_PREFIX + r.key, value: r }))));
  return recs.filter(r => written.has(TROPHY_PREFIX + r.key));
}
export async function loadSeen(db: LegacyDB): Promise<Set<string>> {
  return new Set((await db.metaWithPrefix(SEEN_PREFIX)).map(r => r.key.slice(SEEN_PREFIX.length)));
}
export async function markSeen(db: LegacyDB, keys: string[], nowIso: string): Promise<void> {
  await db.putMetaIfAbsent(keys.map(k => ({ key: SEEN_PREFIX + k, value: nowIso })));
}
export async function loadPrefs(db: LegacyDB): Promise<LegacyPrefs> { return parsePrefs(await db.getMeta(PREFS_KEY)); }
export async function savePrefs(db: LegacyDB, p: LegacyPrefs): Promise<void> { await db.setMeta(PREFS_KEY, p); }
