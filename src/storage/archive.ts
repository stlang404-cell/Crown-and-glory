/**
 * Career archive (v0.11, docs/CAREER_RATING.md): full crown-backup-1 bundles of earlier careers, kept on this device
 * in a SEPARATE IndexedDB database ("crown-calculation-archive"), so Start New Career — which clears the main
 * database — never touches them. Each record holds the exact backup file text that was offered as a download.
 *
 * Best effort: browser storage can be evicted, so the downloaded file is the real backup; the archive is a second
 * copy, written only if the storage estimate leaves room for it.
 */
export const ARCHIVE_DB = 'crown-calculation-archive';
const STORE = 'backups';

export interface ArchivedBackup {
  id: string; // archive:<exportedAt>
  at: string;
  careerId: string;
  appVersion: string;
  games: number;
  ratingEvents: number;
  bytes: number;
  /** The backup file, exactly as downloaded (JSON text of a crown-backup-1 bundle). */
  json: string;
}

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

function openArchive(factory: IDBFactory): Promise<IDBDatabase> {
  const r = factory.open(ARCHIVE_DB, 1);
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('Archive blocked by another tab')); });
}

/** Is there room for `bytes` more (with a 2× margin)? Unknown estimate = try anyway. */
async function roomFor(bytes: number): Promise<boolean> {
  try {
    const e = await (typeof navigator !== 'undefined' ? navigator.storage?.estimate?.() : undefined);
    if (!e || e.quota === undefined || e.usage === undefined) return true;
    return e.quota - e.usage > bytes * 2;
  } catch { return true; }
}

/** Keep a backup in the archive. Returns the record id, or null (with the reason) if it could not be stored. */
export async function archiveBackup(json: string, meta: { at: string; careerId: string; appVersion: string; games: number; ratingEvents: number }, factory: IDBFactory = indexedDB): Promise<{ id: string | null; reason?: string }> {
  if (!(await roomFor(json.length * 2))) return { id: null, reason: 'Not enough browser storage for a second copy.' };
  let db: IDBDatabase | null = null;
  try {
    db = await openArchive(factory);
    const rec: ArchivedBackup = { id: `archive:${meta.at}`, ...meta, bytes: json.length, json };
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('aborted')); });
    return { id: rec.id };
  } catch (e) {
    return { id: null, reason: (e as Error)?.message ?? 'The browser refused to store it.' };
  } finally { db?.close(); }
}

/** Archived backups, newest first, without their contents. */
export async function listArchives(factory: IDBFactory = indexedDB): Promise<Omit<ArchivedBackup, 'json'>[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openArchive(factory);
    const all = (await req(db.transaction(STORE).objectStore(STORE).getAll())) as ArchivedBackup[];
    return all.map(({ json: _json, ...rest }) => rest).sort((a, b) => b.at.localeCompare(a.at));
  } catch { return []; } finally { db?.close(); }
}

/** One archived backup's file text (to download it again or import it). */
export async function archivedBackup(id: string, factory: IDBFactory = indexedDB): Promise<string | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openArchive(factory);
    const r = (await req(db.transaction(STORE).objectStore(STORE).get(id))) as ArchivedBackup | undefined;
    return r?.json ?? null;
  } catch { return null; } finally { db?.close(); }
}
