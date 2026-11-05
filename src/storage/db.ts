/**
 * IndexedDB persistence (database "crown-calculation", schema version DB_VERSION).
 *
 * Rules (research doc 12): never await engine/worker/network work inside a live transaction;
 * compute first, then open one short transaction that re-reads state, validates and commits.
 * Game finalization, the rating ledger entry, pool state and the analysis intent commit atomically
 * in ONE transaction, keyed by idempotency keys so retries never duplicate a rating update.
 */
import { isStudyGame } from '../app/study';
import type { GameRecord } from '../games/types';
import { PoolState, RatingEvent, computeRatingEvent, newPoolState } from '../ratings/ledger';
import type { PoolId } from '../games/types';
import type { AnalysisReport } from '../analysis/types';
import { CareerRecord, KNOWN_STARTS, legacyCareerRecord, newCareerRecord } from '../ratings/career';
import { CAREER_POOL, LEGACY_CAREER_POOL, seededPoolState, shouldSeed } from '../ratings/pools';

export const DB_NAME = 'crown-calculation';
export const DB_VERSION = 4;
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
  {
    to: 2,
    description: 'M2: Academy attempts, training runs and position bookmarks (additive; v1 data untouched)',
    upgrade(db) {
      const att = db.createObjectStore('attempts', { keyPath: 'id' });
      att.createIndex('puzzleId', 'puzzleId');
      att.createIndex('at', 'at');
      db.createObjectStore('trainingRuns', { keyPath: 'id' });
      const bm = db.createObjectStore('bookmarks', { keyPath: 'id' });
      bm.createIndex('gameId', 'gameId');
    },
  },
  {
    to: 3,
    description: 'v0.3.0: federation (world, seasons, competitors, rounds, world games) and economy (journal, accounts, markets, positions, assets, finance) — additive; v1/v2 data untouched',
    upgrade(db) {
      for (const s of FEDERATION_STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'world' || s === 'finance' ? 'key' : s === 'accounts' ? 'account' : 'id' });
    },
  },
  {
    to: 4,
    description: 'v0.4.0: live in-play featured games and sponsorship contracts — additive; v1–v3 data untouched',
    upgrade(db) {
      for (const s of ['liveGames', 'contracts']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    },
  },
];

/** Stores written by the federation/economy commit protocol (one transaction per command). */
export const FEDERATION_STORES = ['world', 'seasons', 'competitors', 'rounds', 'worldGames', 'journal', 'accounts', 'markets', 'positions', 'assets', 'finance', 'liveGames', 'contracts'] as const;
export type FederationStore = typeof FEDERATION_STORES[number];

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction): Promise<void> => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error ?? new Error('Transaction aborted'));
});

export class StorageError extends Error {}

export class CrownDB {
  /** This career's rating origin (meta record `career`, docs/CAREER_RATING.md). Set by open(). */
  career: CareerRecord = legacyCareerRecord('');
  private constructor(readonly db: IDBDatabase, readonly factory: IDBFactory) {}
  /** Initial rating of every pool of this career: 0 for careers created from v0.11, 1500 for older careers. */
  get ratingStart(): number { return this.career.ratingStart; }

  static async open(factory: IDBFactory = indexedDB, name = DB_NAME, version = DB_VERSION): Promise<CrownDB> {
    const r = factory.open(name, version);
    r.onupgradeneeded = ev => {
      const db = r.result;
      const tx = r.transaction!;
      for (const m of MIGRATIONS) if (m.to > ev.oldVersion && m.to <= version) m.upgrade(db, tx);
      const meta = tx.objectStore('meta');
      meta.put({ key: 'schema', appSchema: APP_SCHEMA, dbVersion: version, migratedFrom: ev.oldVersion, at: new Date().toISOString() });
      // a brand-new database is a brand-new career: it starts at 0 (crown-career-1). Upgrades never get this record here.
      if (ev.oldVersion === 0) meta.put({ key: 'career', value: newCareerRecord(new Date().toISOString()) });
    };
    const db = await new Promise<IDBDatabase>((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new StorageError('Database upgrade blocked by another open tab'));
    });
    db.onversionchange = () => db.close();
    const c = new CrownDB(db, factory);
    await c.loadCareer();
    // v1.1: seed the career pool once from the measured Rapid rating (idempotent; docs/CAREER_RATING.md §7)
    await c.ensureCareerPool().catch(e => console.error('career pool seed', e));
    return c;
  }

  /**
   * Read (or, once, decide) this career's rating origin. A database without a `career` record was created before
   * v0.11: if it holds any game, rating event, rating state or Federation it is a legacy career and keeps its 1500
   * start forever; a database with none of these has no career yet and starts at 0. The decision is written once.
   */
  private async loadCareer(): Promise<void> {
    const have = (await req(this.store('meta').get('career')))?.value as CareerRecord | undefined;
    if (have && Number.isFinite(have.ratingStart)) { this.career = have; return; }
    const tx = this.db.transaction(this.db.objectStoreNames.contains('world') ? ['games', 'ratingEvents', 'ratingState', 'world'] : ['games', 'ratingEvents', 'ratingState'], 'readonly');
    const counts = await Promise.all(['games', 'ratingEvents', 'ratingState', ...(this.db.objectStoreNames.contains('world') ? ['world'] : [])].map(n => req(tx.objectStore(n).count())));
    const now = new Date().toISOString();
    const record = counts.some(n => n > 0) ? legacyCareerRecord(now) : newCareerRecord(now);
    try { await this.setMeta('career', record); } catch { /* read-only quota trouble: decided again next time, same answer */ }
    this.career = record;
  }

  /**
   * Start New Career (docs/CAREER_RATING.md): in ONE transaction, clear every store of this database — games, rating
   * ledger, analysis, Academy, Vault/Grimoire progress, the Federation world and the economy — and write the new
   * career record (rating start 0). The caller must have exported and archived a full backup first; the archive lives
   * in a separate database (src/storage/archive.ts) and is not touched.
   */
  async startNewCareer(record: CareerRecord): Promise<void> {
    if (!KNOWN_STARTS.includes(record.ratingStart)) throw new StorageError('Unknown career rating origin');
    const names = [...this.db.objectStoreNames];
    const tx = this.db.transaction(names, 'readwrite');
    const meta = tx.objectStore('meta');
    const schema = await req(meta.get('schema'));
    for (const n of names) tx.objectStore(n).clear();
    if (schema) meta.put(schema);
    meta.put({ key: 'career', value: record });
    await done(tx);
    this.career = record;
  }

  /**
   * v1.1 career pool seeding (src/ratings/pools.ts): in ONE transaction, if the career pool has never been written
   * (no state, no events) and the legacy Rapid pool has rated games, write the seeded state (rating kept, RD =
   * max(RD, 150), σ kept, games carried) with its provenance, and the audit record `careerPoolSeed`. Otherwise
   * nothing is written. `add()` aborts the transaction if another tab seeded first, so it can never run twice.
   * Returns the seeded state when this call seeded.
   */
  async ensureCareerPool(nowIso: string = new Date().toISOString()): Promise<PoolState | null> {
    const tx = this.db.transaction(['ratingState', 'ratingEvents', 'meta'], 'readwrite');
    const states = tx.objectStore('ratingState');
    const cur = (await req(states.get(CAREER_POOL))) as PoolState | undefined;
    const src = (await req(states.get(LEGACY_CAREER_POOL))) as PoolState | undefined;
    const n = await req(tx.objectStore('ratingEvents').index('pool').count(CAREER_POOL));
    if (!shouldSeed(cur, n, src)) { await done(tx); return null; }
    const seeded = seededPoolState(src, nowIso);
    states.add(seeded);
    tx.objectStore('meta').put({ key: 'careerPoolSeed', value: seeded.seed });
    await done(tx);
    return seeded;
  }

  /** The career pool's state (THE career Elo, src/ratings/pools.ts). */
  careerRating(): Promise<PoolState> { return this.ratingState(CAREER_POOL); }

  /** Restore of a backup into an empty career adopts the backup's career origin (used by importBundle only). */
  async adoptCareer(record: CareerRecord): Promise<void> {
    if (!KNOWN_STARTS.includes(record.ratingStart)) throw new StorageError('Unknown career rating origin');
    await this.setMeta('career', record);
    this.career = record;
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

  /** Delete one meta record (v0.11: exhibition archive entries; absent keys are a no-op). */
  async deleteMeta(key: string): Promise<void> {
    const tx = this.db.transaction('meta', 'readwrite');
    tx.objectStore('meta').delete(key);
    await done(tx);
  }

  /** Every meta record whose key starts with `prefix` (e.g. "ach:" for Vault unlocks). */
  async metaWithPrefix<T = unknown>(prefix: string): Promise<{ key: string; value: T }[]> {
    return (await req(this.store('meta').getAll(IDBKeyRange.bound(prefix, prefix + '￿')))) as { key: string; value: T }[];
  }
  /** Put-if-absent for meta records, in one transaction: existing keys are never overwritten. Returns the keys written. */
  async putMetaIfAbsent(entries: { key: string; value: unknown }[]): Promise<string[]> {
    if (!entries.length) return [];
    const tx = this.db.transaction('meta', 'readwrite');
    const s = tx.objectStore('meta');
    const written: string[] = [];
    for (const e of entries) {
      if ((await req(s.getKey(e.key))) !== undefined) continue;
      s.add({ key: e.key, value: e.value });
      written.push(e.key);
    }
    await done(tx);
    return written;
  }
  /** Cheap change key for event-driven evaluation: record counts only (no values are read). */
  async recordCounts(): Promise<Record<string, number>> {
    const names = ['ratingEvents', 'reports', 'attempts', 'trainingRuns', 'bookmarks'];
    const tx = this.db.transaction(['games', 'meta', ...names], 'readonly');
    const [finalized, grimoire, ...rest] = await Promise.all([req(tx.objectStore('games').index('status').count('finalized')),
      req(tx.objectStore('meta').count(IDBKeyRange.bound('grim:', 'grim:\uffff'))), ...names.map(n => req(tx.objectStore(n).count()))]);
    // grimoire: Grimoire lesson records in the meta store (attempt sessions, completions, reads)
    return Object.fromEntries([['finalized', finalized], ...names.map((n, i) => [n, rest[i]]), ['grimoire', grimoire]]);
  }

  /** Change key of the player's saved records for screens that show them (record counts of every store they read,
   *  all games included); no values are read. */
  async savedRecordsKey(): Promise<string> {
    const [c, games] = await Promise.all([this.recordCounts(), req(this.store('games').count())]);
    return `${Object.values(c).join(':')}:${games}`;
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

  /** Played Like records (v0.10, additive field `playedLike` on finalized games): insert or replace the record of the
   *  same model id. Only this metadata field is touched; the game's moves, result and checksum never change. */
  async setPlayedLikeRecord(id: string, rec: import('../analysis/playedLikeRecords').PlayedLikeGameRecord): Promise<boolean> {
    const tx = this.db.transaction('games', 'readwrite');
    const s = tx.objectStore('games');
    const g = (await req(s.get(id))) as GameRecord | undefined;
    if (!g || g.status !== 'finalized') { await done(tx); return false; }
    g.playedLike = [...(g.playedLike ?? []).filter(r => r.modelId !== rec.modelId), rec];
    s.put(g);
    await done(tx);
    return true;
  }

  /**
   * Atomically finalize a terminal game: game record (immutable afterwards), rating event + pool
   * state (rated games only) and the analysis intent. Idempotent: a second call returns the
   * already-committed state without changing anything.
   */
  async finalizeGame(
    g: GameRecord,
    opts: { checksum: string; nowIso: string; analysisSettingsId: string; humanScore: number | null; analysisJobId?: string },
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
    // a Study Match (src/app/study.ts) is never rated, whatever its record says
    if (final.rated && final.pool && opts.humanScore !== null && final.assistance.length === 0 && !isStudyGame(final)) {
      const eventId = `rating:${g.id}:${final.pool}`;
      const dup = await req(events.get(eventId));
      if (dup) throw new StorageError('Rating event exists for an unfinalized game (corrupt state)');
      const state = ((await req(states.get(final.pool))) as PoolState | undefined) ?? newPoolState(final.pool as PoolId, this.ratingStart);
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
    const jobId = opts.analysisJobId ?? `job:${g.id}:${opts.analysisSettingsId}`;
    const job: AnalysisJob = {
      id: jobId, gameId: g.id, settingsId: opts.analysisSettingsId, status: 'queued', createdAt: opts.nowIso, updatedAt: opts.nowIso,
      progress: 0, total: g.moves.length, generation: 0,
    };
    jobs.put(job);
    await done(tx);
    return { game: final, event, alreadyFinalized: false };
  }

  async ratingState(pool: PoolId): Promise<PoolState> {
    return ((await req(this.store('ratingState').get(pool))) as PoolState | undefined) ?? newPoolState(pool, this.ratingStart);
  }
  async allRatingStates(): Promise<PoolState[]> {
    return (await req(this.store('ratingState').getAll())) as PoolState[];
  }
  /** Every pool's rating state and the whole rating ledger, read in ONE short transaction (the Career Passport's own
   *  data, loaded before anything else on the screen). Same ordering as ratingEvents(). */
  async careerRatings(): Promise<{ states: PoolState[]; events: RatingEvent[] }> {
    const tx = this.db.transaction(['ratingState', 'ratingEvents'], 'readonly');
    const [states, events] = await Promise.all([req(tx.objectStore('ratingState').getAll()), req(tx.objectStore('ratingEvents').getAll())]) as [PoolState[], RatingEvent[]];
    return { states, events: events.sort((a, b) => (a.pool === b.pool ? a.sequence - b.sequence : a.at.localeCompare(b.at))) };
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
  async deleteJob(id: string): Promise<void> {
    const tx = this.db.transaction('analysisJobs', 'readwrite');
    tx.objectStore('analysisJobs').delete(id);
    await done(tx);
  }
  async getJob(id: string): Promise<AnalysisJob | undefined> {
    return (await req(this.store('analysisJobs').get(id))) as AnalysisJob | undefined;
  }
  async allJobs(): Promise<AnalysisJob[]> {
    return (await req(this.store('analysisJobs').getAll())) as AnalysisJob[];
  }

  async put(store: 'attempts' | 'trainingRuns' | 'bookmarks', value: unknown): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await done(tx);
  }
  async remove(store: 'bookmarks', key: string): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await done(tx);
  }
  async getAll<T>(store: 'attempts' | 'trainingRuns' | 'bookmarks'): Promise<T[]> {
    return (await req(this.store(store).getAll())) as T[];
  }

  /** The keys of a whole federation store (no values are read). */
  async loadKeys(store: FederationStore): Promise<string[]> {
    return (await req(this.store(store).getAllKeys())) as string[];
  }

  /** Load a whole federation store. */
  async loadAll<T>(store: FederationStore): Promise<T[]> {
    return (await req(this.store(store).getAll())) as T[];
  }

  /**
   * Atomic multi-store commit: every put/delete happens in ONE IndexedDB transaction or not at all.
   * `guard` runs inside the transaction first (re-reading committed state, e.g. the world cursor) and may
   * throw to abort — this is the idempotency/fencing check against duplicate or stale commands.
   */
  async commit(writes: { store: FederationStore | 'games'; put?: unknown[]; del?: string[] }[], guard?: (get: (store: FederationStore, key: string) => Promise<unknown>) => Promise<void>): Promise<void> {
    const stores = [...new Set([...writes.map(w => w.store), 'world' as const])];
    const tx = this.db.transaction(stores, 'readwrite');
    const finished = done(tx);
    try {
      if (guard) await guard((store, key) => req(tx.objectStore(store).get(key)));
      for (const w of writes) {
        const os = tx.objectStore(w.store);
        for (const v of w.put ?? []) os.put(v);
        for (const k of w.del ?? []) os.delete(k);
      }
    } catch (e) {
      try { tx.abort(); } catch { /* already finished */ }
      await finished.catch(() => {});
      throw e;
    }
    await finished;
  }

  /** Raw dump for export. */
  async dump(): Promise<{ games: GameRecord[]; ratingEvents: RatingEvent[]; ratingState: PoolState[]; reports: AnalysisReport[]; jobs: AnalysisJob[]; attempts: unknown[]; trainingRuns: unknown[]; bookmarks: unknown[]; federation: Record<string, unknown[]> }> {
    const fed: Record<string, unknown[]> = {};
    if (this.db.objectStoreNames.contains('world')) {
      const ftx = this.db.transaction([...FEDERATION_STORES], 'readonly');
      for (const st of FEDERATION_STORES) fed[st] = (await req(ftx.objectStore(st).getAll())) as unknown[];
    }
    const tx = this.db.transaction(['games', 'ratingEvents', 'ratingState', 'reports', 'analysisJobs', 'attempts', 'trainingRuns', 'bookmarks'], 'readonly');
    const [games, ratingEvents, ratingState, reports, jobs, attempts, trainingRuns, bookmarks] = await Promise.all([
      req(tx.objectStore('games').getAll()), req(tx.objectStore('ratingEvents').getAll()), req(tx.objectStore('ratingState').getAll()),
      req(tx.objectStore('reports').getAll()), req(tx.objectStore('analysisJobs').getAll()),
      req(tx.objectStore('attempts').getAll()), req(tx.objectStore('trainingRuns').getAll()), req(tx.objectStore('bookmarks').getAll()),
    ]);
    return { games, ratingEvents, ratingState, reports, jobs, attempts, trainingRuns, bookmarks, federation: fed } as never;
  }

  /** Import records in one transaction, never overwriting existing records with the same id. */
  async importRecords(d: { games: GameRecord[]; ratingEvents: RatingEvent[]; ratingState: PoolState[]; reports: AnalysisReport[]; attempts?: { id: string }[]; trainingRuns?: { id: string }[]; bookmarks?: { id: string }[] }, replaceRatingState: boolean): Promise<{ games: number; events: number; reports: number; skipped: number }> {
    const tx = this.db.transaction(['games', 'ratingEvents', 'ratingState', 'reports', 'attempts', 'trainingRuns', 'bookmarks'], 'readwrite');
    for (const [store, list] of [['attempts', d.attempts], ['trainingRuns', d.trainingRuns], ['bookmarks', d.bookmarks]] as const) {
      for (const r of list ?? []) if (!(await req(tx.objectStore(store).get(r.id)))) tx.objectStore(store).add(r);
    }
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
