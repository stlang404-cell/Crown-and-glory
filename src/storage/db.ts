/**
 * IndexedDB persistence (database "crown-calculation", schema version DB_VERSION).
 *
 * Rules (research doc 12): never await engine/worker/network work inside a live transaction;
 * compute first, then open one short transaction that re-reads state, validates and commits.
 * Game finalization, the rating ledger entry, pool state and the analysis intent commit atomically
 * in ONE transaction, keyed by idempotency keys so retries never duplicate a rating update.
 */
import type { GameRecord } from '../games/types';
import { PoolState, RatingEvent, computeRatingEvent, newPoolState } from '../ratings/ledger';
import type { PoolId } from '../games/types';
import type { AnalysisReport } from '../analysis/types';

export const DB_NAME = 'crown-calculation';
export const DB_VERSION = 1;
export const APP_SCHEMA = 'crown-save-1';

export interface AnalysisJob {
  id: string; // job:<gameId>:<settingsId>
  gameId: string;
  settingsId: string;
  status: 'queued' | 'running' | 'complete' | 'partial' | 'cancelled' | 'failed';
  createdAt: string;
  updatedAt: string;
  progress: number; // plies analysed
  total: number;
  error?: string;
  reportId?: string;
  generation: number;
}

export interface Migration {
  to: number;
  description: string;
  upgrade(db: IDBDatabase, tx: IDBTransaction): void;
}

/** Ordered migrations. Each adds stores/indexes; data-transforming migrations must be copy-safe. */
export const MIGRATIONS: Migration[] = [
  {
    to: 1,
    description: 'Initial schema: games, ratingEvents, ratingState, reports, analysisJobs, meta',
    upgrade(db) {
      const games = db.createObjectStore('games', { keyPath: 'id' });
      games.createIndex('startedAt', 'startedAt');
      games.createIndex('status', 'status');
      const ev = db.createObjectStore('ratingEvents', { keyPath: 'id' });
      ev.createIndex('pool', 'pool');
      ev.createIndex('gameId', 'gameId');
      db.createObjectStore('ratingState', { keyPath: 'pool' });
      const rep = db.createObjectStore('reports', { keyPath: 'id' });
      rep.createIndex('gameId', 'gameId');
      const jobs = db.createObjectStore('analysisJobs', { keyPath: 'id' });
      jobs.createIndex('status', 'status');
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  },
];

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction): Promise<void> => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error ?? new Error('Transaction aborted'));
});

export class StorageError extends Error {}

export class CrownDB {
  private constructor(readonly db: IDBDatabase, readonly factory: IDBFactory) {}

  static async open(factory: IDBFactory = indexedDB, name = DB_NAME, version = DB_VERSION): Promise<CrownDB> {
    const r = factory.open(name, version);
    r.onupgradeneeded = ev => {
      const db = r.result;
      const tx = r.transaction!;
      for (const m of MIGRATIONS) if (m.to > ev.oldVersion && m.to <= version) m.upgrade(db, tx);
      const meta = tx.objectStore('meta');
      meta.put({ key: 'schema', appSchema: APP_SCHEMA, dbVersion: version, migratedFrom: ev.oldVersion, at: new Date().toISOString() });
    };
    const db = await new Promise<IDBDatabase>((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new StorageError('Database upgrade blocked by another open tab'));
    });
    db.onversionchange = () => db.close();
    return new CrownDB(db, factory);
  }

  close(): void { this.db.close(); }

  private store(name: string, mode: IDBTransactionMode = 'readonly') {
    return this.db.transaction(name, mode).objectStore(name);
  }

  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    const r = await req(this.store('meta').get(key));
    return r?.value as T | undefined;
  }
  async setMeta(key: string, value: unknown): Promise<void> {
    const tx = this.db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value });
    await done(tx);
  }

  /** Save an in-progress (or terminal-not-yet-finalized) game. Refuses to overwrite a finalized game. */
  async saveGame(g: GameRecord): Promise<void> {
    const tx = this.db.transaction('games', 'readwrite');
    const s = tx.objectStore('games');
    const existing = (await req(s.get(g.id))) as GameRecord | undefined;
    if (existing?.status === 'finalized') { tx.abort(); await done(tx).catch(() => {}); throw new StorageError('Finalized games are immutable'); }
    s.put(g);
    await done(tx);
  }

  async getGame(id: string): Promise<GameRecord | undefined> {
    return (await req(this.store('games').get(id))) as GameRecord | undefined;
  }

  async allGames(): Promise<GameRecord[]> {
    return (await req(this.store('games').getAll())) as GameRecord[];
  }

  /** Find an unfinished game to resume (active/paused/terminal-not-finalized). */
  async unfinishedGames(): Promise<GameRecord[]> {
    const all = await this.allGames();
    return all.filter(g => g.status === 'active' || g.status === 'paused' || g.status === 'terminal');
  }

  /** Bookmarks / metadata edits on finalized games only touch the bookmark list. */
  async setBookmarks(id: string, bookmarks: number[]): Promise<void> {
    const tx = this.db.transaction('games', 'readwrite');
    const s = tx.objectStore('games');
    const g = (await req(s.get(id))) as GameRecord | undefined;
    if (!g) throw new StorageError('No such game');
    g.bookmarks = [...new Set(bookmarks)].sort((a, b) => a - b);
    s.put(g);
    await done(tx);
  }

  /**
   * Atomically finalize a terminal game: game record (immutable afterwards), rating event + pool
   * state (rated games only) and the analysis intent. Idempotent: a second call returns the
   * already-committed state without changing anything.
   */
  async finalizeGame(
    g: GameRecord,
    opts: { checksum: string; nowIso: string; analysisSettingsId: string; humanScore: number | null },
  ): Promise<{ game: GameRecord; event: RatingEvent | null; alreadyFinalized: boolean }> {
    if (g.status !== 'terminal' || !g.result) throw new StorageError('Only terminal games can be finalized');
    const tx = this.db.transaction(['games', 'ratingEvents', 'ratingState', 'analysisJobs'], 'readwrite');
    const games = tx.objectStore('games');
    const events = tx.objectStore('ratingEvents');
    const states = tx.objectStore('ratingState');
    const jobs = tx.objectStore('analysisJobs');
    const existing = (await req(games.get(g.id))) as GameRecord | undefined;
    if (existing?.status === 'finalized') {
      const ev = existing.ratingEventId ? ((await req(events.get(existing.ratingEventId))) as RatingEvent) : null;
      await done(tx);
      return { game: existing, event: ev, alreadyFinalized: true };
    }
    const final: GameRecord = structuredClone(g);
    final.status = 'finalized';
    final.finalizationKey = `final:${g.id}`;
    final.checksum = opts.checksum;
    let event: RatingEvent | null = null;
    if (final.rated && final.pool && opts.humanScore !== null && final.assistance.length === 0) {
      const eventId = `rating:${g.id}:${final.pool}`;
      const dup = await req(events.get(eventId));
      if (dup) throw new StorageError('Rating event exists for an unfinalized game (corrupt state)');
      const state = ((await req(states.get(final.pool))) as PoolState | undefined) ?? newPoolState(final.pool as PoolId);
      const opp = final.humanColor === 'white' ? final.black : final.white;
      if (opp.rating === null || opp.rd === null) throw new StorageError('Opponent rating snapshot missing');
      const { event: e, next } = computeRatingEvent(state, g.id, opts.nowIso, {
        id: opp.id, name: opp.name, rating: opp.rating, rd: opp.rd, calibrationId: opp.engine?.calibrationId ?? 'none',
      }, opts.humanScore);
      event = e;
      events.add(e); // add() fails (aborting the whole transaction) if the key already exists
      states.put(next);
      final.ratingEventId = e.id;
    }
    games.put(final);
    const jobId = `job:${g.id}:${opts.analysisSettingsId}`;
    const job: AnalysisJob = {
      id: jobId, gameId: g.id, settingsId: opts.analysisSettingsId, status: 'queued', createdAt: opts.nowIso, updatedAt: opts.nowIso,
      progress: 0, total: g.moves.length, generation: 0,
    };
    jobs.put(job);
    await done(tx);
    return { game: final, event, alreadyFinalized: false };
  }

  async ratingState(pool: PoolId): Promise<PoolState> {
    return ((await req(this.store('ratingState').get(pool))) as PoolState | undefined) ?? newPoolState(pool);
  }
  async allRatingStates(): Promise<PoolState[]> {
    return (await req(this.store('ratingState').getAll())) as PoolState[];
  }
  async ratingEvents(pool?: PoolId): Promise<RatingEvent[]> {
    const s = this.store('ratingEvents');
    const all = (pool ? await req(s.index('pool').getAll(pool)) : await req(s.getAll())) as RatingEvent[];
    return all.sort((a, b) => (a.pool === b.pool ? a.sequence - b.sequence : a.at.localeCompare(b.at)));
  }

  /** Reports are immutable: adding an existing id fails. */
  async addReport(r: AnalysisReport, job?: AnalysisJob): Promise<void> {
    const tx = this.db.transaction(['reports', 'games', 'analysisJobs'], 'readwrite');
    const reports = tx.objectStore('reports');
    const games = tx.objectStore('games');
    const existing = await req(reports.get(r.id));
    if (existing) { await done(tx); return; }
    reports.add(r);
    const g = (await req(games.get(r.gameId))) as GameRecord | undefined;
    if (g && !g.reportIds.includes(r.id)) { g.reportIds = [...g.reportIds, r.id]; games.put(g); }
    if (job) tx.objectStore('analysisJobs').put(job);
    await done(tx);
  }
  async getReport(id: string): Promise<AnalysisReport | undefined> {
    return (await req(this.store('reports').get(id))) as AnalysisReport | undefined;
  }
  async reportsForGame(gameId: string): Promise<AnalysisReport[]> {
    const all = (await req(this.store('reports').index('gameId').getAll(gameId))) as AnalysisReport[];
    return all.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  }
  async allReports(): Promise<AnalysisReport[]> {
    return (await req(this.store('reports').getAll())) as AnalysisReport[];
  }

  async putJob(job: AnalysisJob): Promise<void> {
    const tx = this.db.transaction('analysisJobs', 'readwrite');
    tx.objectStore('analysisJobs').put(job);
    await done(tx);
  }
  async getJob(id: string): Promise<AnalysisJob | undefined> {
    return (await req(this.store('analysisJobs').get(id))) as AnalysisJob | undefined;
  }
  async allJobs(): Promise<AnalysisJob[]> {
    return (await req(this.store('analysisJobs').getAll())) as AnalysisJob[];
  }

  /** Raw dump for export. */
  async dump(): Promise<{ games: GameRecord[]; ratingEvents: RatingEvent[]; ratingState: PoolState[]; reports: AnalysisReport[]; jobs: AnalysisJob[] }> {
    const tx = this.db.transaction(['games', 'ratingEvents', 'ratingState', 'reports', 'analysisJobs'], 'readonly');
    const [games, ratingEvents, ratingState, reports, jobs] = await Promise.all([
      req(tx.objectStore('games').getAll()), req(tx.objectStore('ratingEvents').getAll()), req(tx.objectStore('ratingState').getAll()),
      req(tx.objectStore('reports').getAll()), req(tx.objectStore('analysisJobs').getAll()),
    ]);
    return { games, ratingEvents, ratingState, reports, jobs } as never;
  }

  /** Import records in one transaction, never overwriting existing records with the same id. */
  async importRecords(d: { games: GameRecord[]; ratingEvents: RatingEvent[]; ratingState: PoolState[]; reports: AnalysisReport[] }, replaceRatingState: boolean): Promise<{ games: number; events: number; reports: number; skipped: number }> {
    const tx = this.db.transaction(['games', 'ratingEvents', 'ratingState', 'reports'], 'readwrite');
    let games = 0, events = 0, reports = 0, skipped = 0;
    for (const g of d.games) {
      if (await req(tx.objectStore('games').get(g.id))) { skipped++; continue; }
      tx.objectStore('games').add(g); games++;
    }
    for (const e of d.ratingEvents) {
      if (await req(tx.objectStore('ratingEvents').get(e.id))) { skipped++; continue; }
      tx.objectStore('ratingEvents').add(e); events++;
    }
    for (const r of d.reports) {
      if (await req(tx.objectStore('reports').get(r.id))) { skipped++; continue; }
      tx.objectStore('reports').add(r); reports++;
    }
    if (replaceRatingState) for (const s of d.ratingState) tx.objectStore('ratingState').put(s);
    await done(tx);
    return { games, events, reports, skipped };
  }
}
