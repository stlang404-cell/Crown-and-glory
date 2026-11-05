/**
 * Application command layer: the UI calls these commands; they validate, run one transactional
 * domain operation and notify subscribers. React never mutates history or ratings directly.
 */
import { showContemporaryNames, subscribeContemporaryNames } from './namePrefs';
import { CrownDB, AnalysisJob } from '../storage/db';
import { gameChecksum, sha256Hex } from '../storage/checksum';
import { EngineChannel, ENGINE_EVENTS } from '../engine/client';
import { CANON_BUILD } from '../engine/canonical';
import { DEFAULT_ANALYSIS, ANALYSIS_PRESETS, recommendationsFor, ENGINE_BUILD } from '../analysis/analyzer';
import { playedLikeRecord } from '../analysis/playedLike';
import { backfillPlayedLike as backfillPlayedLikeIn, recordPlayedLike as recordPlayedLikeIn } from '../storage/playedLikeStore';
import { GRADING_ID } from '../analysis/methodology';
import type { AnalysisReport, AnalysisSettings, PlyAnalysis } from '../analysis/types';
import type { GameRecord } from '../games/types';
import type { PoolState, RatingEvent } from '../ratings/ledger';
import { FederationService } from './federation';
import { VaultService } from '../vault/service';
import { LegacyService } from '../legacy/service';
import { LiveScheduler, detectDevice, loadLiveSettings, poolSizeFor, saveLiveSettings, type LiveSettings } from './scheduler';
import { START_FEN } from './schedulerEngine';
import { prepareNewCareer, startNewCareer, type PreparedCareerChange } from './career';
import type { CareerRecord } from '../ratings/career';
import { ExhibitionRunner, isExhibitionId, loadExhibition, saveExhibitionReport } from './exhibition';
import { mark, phase } from './startup';
import { BackgroundStart, browserEnv } from './backgroundStart';
import { whenForegroundIdle } from './reloader';

/** The release version, from the build identity (package.json); '0.0.0-dev' only outside a Vite build. */
export const APP_VERSION: string = typeof __BUILD__ !== 'undefined' ? __BUILD__.version : '0.0.0-dev';

type Listener = () => void;

export interface AnalysisProgress {
  jobId: string;
  gameId: string;
  done: number;
  total: number;
  status: AnalysisJob['status'];
  partial: PlyAnalysis[];
}

export class AppServices {
  readonly play = new EngineChannel(undefined, 'play');
  readonly analysis = new EngineChannel(undefined, 'analysis');
  readonly assist = new EngineChannel(undefined, 'assist');
  readonly spectator = new EngineChannel(undefined, 'spectator');
  fed!: FederationService;
  /** v0.9 live scheduler: watchable AI-vs-AI games in progress, on their own pool of spectator workers. */
  readonly device = detectDevice();
  liveSettings: LiveSettings = loadLiveSettings(this.device);
  readonly livePool = Array.from({ length: poolSizeFor(this.device) }, (_, i) => new EngineChannel(undefined, `live-${i}`));
  live!: LiveScheduler;
  /** v0.11 Exhibition Arena: one unofficial AI-vs-AI exhibition at a time, on its own engine worker (src/app/exhibition.ts). */
  readonly exhibitionEngine = new EngineChannel(undefined, 'exhibition');
  readonly exhibitions: ExhibitionRunner;
  private makeExhibitions(): ExhibitionRunner { return new ExhibitionRunner({
    db: this.db,
    compute: req => this.exhibitionEngine.move({ initialFen: START_FEN, moves: req.moves, level: 0, seed: req.seed, profile: req.profile, style: req.style, newGame: true, purpose: 'spectator' })
      .then(r => ({ ccn: r.move, score: r.score, depth: r.depth, nodes: r.nodes, ms: r.timeMs })),
    cancel: () => this.exhibitionEngine.cancel(),
    now: () => new Date().toISOString(),
    onChange: () => this.notify(),
    onFinished: g => {
      void this.requestExhibitionAnalysis(g.id).catch(e => console.error('exhibition analysis', e));
      // v1.1 practice market: settled exactly once on the result (void at the playing limit)
      void this.fed?.resolveExhibitionMarket(g).catch(e => console.error('exhibition market settle', e));
    },
    // v1.1 practice market (sandbox money only, src/app/exhibitionMarket.ts): prices follow the published moves only
    onMoved: async g => { await this.fed?.publishExhibitionMove(g); },
    onSkip: async g => { await this.fed?.closeExhibitionMarket(g.id); },
    onRestart: async old => { if (old.status !== 'finished') await this.fed?.resolveExhibitionMarket(old, 'restarted'); },
    // phones run one scheduled-game worker: it pauses while an exhibition computes (mobile limits)
    onBusy: busy => { if (this.live && this.device.mobile) { if (busy) this.live.pause('exhibition'); else this.live.resume('exhibition'); } },
    readOnly: () => this.readOnly,
  }); }
  /** The Sovereign Vault (permanent collectibles), evaluated from saved records after boot. */
  vault!: VaultService;
  /** Played Like record writes (the Vault re-evaluates on them; they do not change record counts). */
  playedLikeVersion = 0;
  /** v0.11 legacy: trophies from recorded results and the identity-header customisation (src/legacy). */
  legacy!: LegacyService;
  private listeners = new Set<Listener>();
  progress: AnalysisProgress | null = null;
  matchActive = false;
  writerLease: 'held' | 'unavailable' | 'unsupported' = 'unsupported';
  private processing = false;
  /** Set while a new career replaces this one: no more background writes. */
  private closing = false;
  revision = 0;
  /** The rating states and ledger as read at boot, valid while `revision` is unchanged (ProfileScreen's first render). */
  ownRatings: { states: PoolState[]; events: RatingEvent[]; revision: number } | null = null;
  /** Ordered background start after the first screen (App reports it; src/app/backgroundStart.ts). */
  readonly background = new BackgroundStart(browserEnv(mark, () => whenForegroundIdle(3000)));

  constructor(readonly db: CrownDB) { this.exhibitions = this.makeExhibitions(); }
  /** Engine job log (diagnostics, e2e inspection). */
  engineEvents() { return [...ENGINE_EVENTS]; }

  static async boot(): Promise<AppServices> {
    mark('boot:start');
    const db = await phase('db:open', () => CrownDB.open());
    const s = new AppServices(db);
    await phase('lease', () => s.acquireLease());
    s.fed = new FederationService(db, async () => { const p = await db.ratingState('rapid'); return { rating: p.rating, rd: p.rd }; });
    s.fed.runSelfplay = (req, onMove) => s.spectator.selfplay(req, m => onMove(m)).then(r => ({ moves: r.moves, result: r.result, termination: r.termination }));
    s.fed.computeMove = req => s.spectator.move({ initialFen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', moves: req.moves, level: 0, seed: req.seed, profile: req.profile, style: req.style, newGame: true, purpose: 'spectator' })
      .then(r => ({ ccn: r.move, score: r.score, depth: r.depth, nodes: r.nodes, ms: r.timeMs }));
    s.fed.onChange = () => s.notify();
    subscribeContemporaryNames(() => s.fed.setContemporaryNames(showContemporaryNames()));
    // scheduled-game commits arrive several times a second: re-render at most twice a second for them
    let pending: ReturnType<typeof setTimeout> | null = null;
    s.fed.onLiveChange = () => { if (!pending) pending = setTimeout(() => { pending = null; s.notify(); }, 500); };
    // the player's own rating data is read alongside the Federation (one short transaction), so the Career Passport's
    // first render already has it instead of queueing a read behind the first screen's other work
    await Promise.all([
      phase('fed:load', () => s.fed.load()),
      db.careerRatings().then(r => { s.ownRatings = { ...r, revision: s.revision }; }, () => {}),
    ]);
    mark('fed:ensure:start');
    if (!s.readOnly) await s.fed.reconcilePlayerGames().catch(e => console.error('federation reconcile', e));
    if (!s.readOnly) await s.fed.ensureSeasonMarkets().catch(e => console.error('season markets', e));
    if (!s.readOnly) await s.fed.ensureHeraldry().catch(e => console.error('heraldry', e));
    if (!s.readOnly) await s.fed.ensureEngineCommitment(CANON_BUILD).catch(e => console.error('engine commitment', e));
    mark('fed:ensure:end');
    // Jobs left "running" by a closed tab are re-queued (their partial work was never committed).
    for (const j of await db.allJobs()) if (j.status === 'running') await db.putJob({ ...j, status: 'queued', updatedAt: new Date().toISOString() });
    mark('jobs:requeued');
    // Live scheduler: starts after the first screen; nothing runs while the app is closed or hidden (docs/FEDERATION_SCALE.md)
    s.live = new LiveScheduler(s.fed, s.livePool.map(ch => ({
      compute: req => ch.move({ initialFen: START_FEN, moves: req.moves, level: 0, seed: req.seed, profile: req.profile, style: req.style, newGame: true, purpose: 'spectator' })
        .then(r => ({ ccn: r.move, score: r.score, depth: r.depth, nodes: r.nodes, ms: r.timeMs })),
    })), { settings: () => s.liveSettings, readOnly: () => s.readOnly });
    if (!s.readOnly && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { s.live.pause('hidden'); s.exhibitions.pause(); }
        else { s.live.resume('hidden'); void s.live.catchUp().catch(e => console.error('live catch-up', e)); }
      });
    }
    s.vault = new VaultService(s);
    s.legacy = new LegacyService(s);
    // Background work starts after the first screen has been painted, one idle step at a time, in this fixed order
    // (src/app/backgroundStart.ts): the analysis queue (left "running" jobs were re-queued above), the Vault (first
    // evaluation and its one-time back-fills), legacy trophies (back-fill), Played Like records for analysed games saved
    // before v0.10 / before the current model, then the live scheduler with its reopen catch-up.
    s.background
      .add('analysis', () => { void s.processQueue(); })
      .add('vault', () => s.vault.start())
      .add('legacy', () => s.legacy.start())
      .add('playedLike', () => s.backfillPlayedLike())
      .add('live', () => { if (!s.readOnly && typeof document !== 'undefined') void s.live.start().catch(e => console.error('live start', e)); });
    s.background.arm();
    mark('boot:end');
    return s;
  }

  /** Single-writer lease across tabs (Web Locks). A second tab is read-only. */
  private acquireLease(): Promise<void> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) { this.writerLease = 'unsupported'; return Promise.resolve(); }
    return new Promise(resolve => {
      locks.request('crown-writer', { ifAvailable: true }, lock => {
        if (!lock) { this.writerLease = 'unavailable'; resolve(); return; }
        this.writerLease = 'held';
        resolve();
        return new Promise<void>(() => {}); // hold for the lifetime of the tab
      });
    });
  }

  get readOnly(): boolean { return this.writerLease === 'unavailable'; }

  subscribe(l: Listener): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }
  notify(): void { this.revision++; for (const l of this.listeners) l(); this.notifyProgress(); }
  /** Per-move analysis progress: its own channel (useAnalysisProgress). Before v1.0 every analysed move bumped
   *  `revision`, so every open screen re-read its saved records several times a second during a background analysis
   *  — right when a reloaded app was loading its first screen (docs/evidence/v1.0/reload-flake.md). */
  progressRevision = 0;
  private progressListeners = new Set<Listener>();
  subscribeProgress(l: Listener): () => void { this.progressListeners.add(l); return () => this.progressListeners.delete(l); }
  private notifyProgress(): void { this.progressRevision++; for (const l of this.progressListeners) l(); }

  async saveGame(g: GameRecord): Promise<void> {
    if (this.readOnly) return;
    await this.db.saveGame(g);
  }

  /** Atomic finalization (game + rating event + analysis intent), then start analysis. */
  async finalize(g: GameRecord): Promise<{ game: GameRecord; event: RatingEvent | null }> {
    if (this.readOnly) throw new Error('This tab is read-only because Crown & Calculation is open in another tab. Close the other tab and reload this one.');
    const checksum = await gameChecksum(g);
    const human = g.humanColor;
    const score = g.result === '1/2-1/2' ? 0.5 : g.result === '1-0' ? (human === 'white' ? 1 : 0) : g.result === '0-1' ? (human === 'black' ? 1 : 0) : null;
    const r = await this.db.finalizeGame(g, { checksum, nowIso: new Date().toISOString(), analysisSettingsId: DEFAULT_ANALYSIS.id, analysisJobId: AppServices.jobId(g.id, DEFAULT_ANALYSIS.id), humanScore: score });
    // federation fixtures learn their result from the finalized (rated) game; idempotent
    if (r.game.context.kind === 'federation' && this.fed?.ready) { try { await this.fed.recordPlayerGame(r.game); } catch (e) { console.error('federation result', e); } }
    // sandbox markets on own casual games settle (or cancel) from the finalized record; idempotent
    if (this.fed?.ready && this.fed.sandboxMarketFor(r.game.id)) { try { await this.fed.settleSandbox(r.game); } catch (e) { console.error('sandbox settlement', e); } }
    this.notify();
    void this.processQueue();
    return r;
  }

  /** Job ids include the engine build and grading version, so a game analysed by an older engine can always be
   *  re-analysed by the current one (both reports are kept). */
  static jobId(gameId: string, settingsId: string): string { return `job:${gameId}:${settingsId}:${ENGINE_BUILD}:${GRADING_ID}`; }
  /** Is there a complete report for this game from the CURRENT engine and grading with these settings? */
  static isCurrent(r: AnalysisReport, settingsId: string): boolean { return r.settings.id === settingsId && r.status === 'complete' && r.engine.buildId === ENGINE_BUILD && r.methodology.gradingId === GRADING_ID; }

  async requestAnalysis(gameId: string, settings: AnalysisSettings): Promise<void> {
    const id = AppServices.jobId(gameId, settings.id);
    const existing = await this.db.getJob(id);
    if (existing && (existing.status === 'complete' || existing.status === 'running' || existing.status === 'queued')) return;
    const g = await this.db.getGame(gameId);
    if (!g) return;
    const now = new Date().toISOString();
    await this.db.putJob({ id, gameId, settingsId: settings.id, status: 'queued', createdAt: now, updatedAt: now, progress: 0, total: g.moves.length, generation: (existing?.generation ?? 0) + 1 });
    this.notify();
    void this.processQueue();
  }

  /**
   * Post-game analysis of a federation engine game (Live Arena), on the canonical engine through the same queue,
   * priority and cancellation rules as the player's own games. Information policy (crown-arena-policy-1): only once
   * the game is recorded AND its official market can no longer trade (settled, cancelled, or none) — so no deep
   * engine evaluation of a position is ever available while money can still be placed on it.
   */
  async requestWorldAnalysis(fixtureId: string, settings: AnalysisSettings = DEFAULT_ANALYSIS): Promise<'queued' | 'exists' | 'blocked' | 'missing'> {
    const wg = await this.fed.worldGame(`wg:${fixtureId}`);
    if (!wg) return 'missing';
    const m = this.fed.marketFor(fixtureId);
    if (m && (m.status === 'open' || m.status === 'closed')) return 'blocked';
    const gid = `wg:${fixtureId}`;
    const id = AppServices.jobId(gid, settings.id);
    const existing = await this.db.getJob(id);
    if (existing && (existing.status === 'complete' || existing.status === 'running' || existing.status === 'queued')) return 'exists';
    const now = new Date().toISOString();
    await this.db.putJob({ id, gameId: gid, settingsId: settings.id, status: 'queued', createdAt: now, updatedAt: now, progress: 0, total: wg.moves.length, generation: (existing?.generation ?? 0) + 1 });
    this.notify();
    void this.processQueue();
    return 'queued';
  }
  /**
   * Match Analysis of a finished exhibition: the standard queue and settings (DEFAULT_ANALYSIS, canonical engine), as
   * for official games. The report is kept with the exhibition (meta `exhrep:<id>`), never in the `reports` store, so
   * no career record, Vault fact or Played Like history can read it.
   */
  async requestExhibitionAnalysis(id: string, settings: AnalysisSettings = DEFAULT_ANALYSIS): Promise<'queued' | 'exists' | 'missing' | 'unfinished'> {
    if (this.readOnly) return 'missing';
    const g = await loadExhibition(this.db, id);
    if (!g) return 'missing';
    if (g.status !== 'finished' || !g.checksum) return 'unfinished';
    const jid = AppServices.jobId(id, settings.id);
    const existing = await this.db.getJob(jid);
    if (existing && (existing.status === 'complete' || existing.status === 'running' || existing.status === 'queued')) return 'exists';
    const now = new Date().toISOString();
    await this.db.putJob({ id: jid, gameId: id, settingsId: settings.id, status: 'queued', createdAt: now, updatedAt: now, progress: 0, total: g.moves.length, generation: (existing?.generation ?? 0) + 1 });
    this.notify();
    void this.processQueue();
    return 'queued';
  }
  private async exhibitionAsRecord(id: string): Promise<(Pick<GameRecord, 'id' | 'initialFen' | 'setupMoves' | 'humanColor' | 'checksum'> & { moves: { ccn: string }[] }) | null> {
    const g = await loadExhibition(this.db, id);
    if (!g || g.status !== 'finished') return null;
    return { id: g.id, initialFen: g.initialFen, setupMoves: undefined, humanColor: 'white', checksum: g.checksum, moves: g.moves };
  }

  /** A recorded federation engine game in the shape the analysis queue needs (checksum over the move record). */
  private async worldGameAsRecord(gid: string): Promise<(Pick<GameRecord, 'id' | 'initialFen' | 'setupMoves' | 'humanColor' | 'checksum'> & { moves: { ccn: string }[] }) | null> {
    const wg = await this.fed.worldGame(gid);
    if (!wg) return null;
    const checksum = await sha256Hex(JSON.stringify({ id: wg.id, moves: wg.moves.map(m => m.ccn), result: wg.result }));
    return { id: wg.id, initialFen: wg.initialFen, setupMoves: undefined, humanColor: 'white', checksum, moves: wg.moves };
  }

  /** Queue re-analysis of every finalized game lacking a complete report with these settings. */
  async batchReanalyze(settings: AnalysisSettings): Promise<number> {
    const [games, reports] = await Promise.all([this.db.allGames(), this.db.allReports()]);
    const have = new Set(reports.filter(r => AppServices.isCurrent(r, settings.id)).map(r => r.gameId));
    let n = 0;
    for (const g of games) if (g.status === 'finalized' && !have.has(g.id)) {
      const id = AppServices.jobId(g.id, settings.id);
      const ex = await this.db.getJob(id);
      if (ex && (ex.status === 'queued' || ex.status === 'running')) continue;
      const now = new Date().toISOString();
      await this.db.putJob({ id, gameId: g.id, settingsId: settings.id, status: 'queued', createdAt: now, updatedAt: now, progress: 0, total: g.moves.length, generation: (ex?.generation ?? 0) + 1 });
      n++;
    }
    this.notify();
    void this.processQueue();
    return n;
  }

  /** Cancel the running job and every queued job. Completed reports are untouched. */
  async cancelAllAnalysis(): Promise<void> {
    for (const j of await this.db.allJobs()) if (j.status === 'queued') await this.db.putJob({ ...j, status: 'cancelled', updatedAt: new Date().toISOString() });
    await this.cancelAnalysis();
  }

  async cancelAnalysis(): Promise<void> {
    const p = this.progress;
    this.analysis.cancel();
    if (p) {
      const j = await this.db.getJob(p.jobId);
      if (j) await this.db.putJob({ ...j, status: 'cancelled', progress: p.done, updatedAt: new Date().toISOString() });
    }
    this.progress = null;
    this.notify();
  }

  /** Change the live-scheduler settings (stored on this device). */
  setLiveSettings(next: LiveSettings): void {
    saveLiveSettings(next);
    this.liveSettings = loadLiveSettings(this.device);
    this.notify();
  }

  setMatchActive(active: boolean): void {
    this.matchActive = active;
    // your own game has the CPU: scheduled games pause while it is on the board
    if (this.live) { if (active) this.live.pause('match'); else this.live.resume('match'); }
    if (active) this.exhibitions.pause();
    if (active && this.progress) {
      // Foreground play has priority: pause (cancel and re-queue) background analysis.
      const p = this.progress;
      this.analysis.cancel();
      this.progress = null;
      void this.db.getJob(p.jobId).then(j => j && this.db.putJob({ ...j, status: 'queued', updatedAt: new Date().toISOString() })).then(() => this.notify());
    }
    if (!active) void this.processQueue();
  }

  async processQueue(): Promise<void> {
    if (this.processing || this.readOnly || this.closing) return;
    this.processing = true;
    try {
      for (;;) {
        if (this.matchActive) return;
        const jobs = (await this.db.allJobs()).filter(j => j.status === 'queued').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const job = jobs[0];
        if (!job) return;
        mark('analysis:job');
        const exh = isExhibitionId(job.gameId);
        const game = job.gameId.startsWith('wg:') ? await this.worldGameAsRecord(job.gameId) : exh ? await this.exhibitionAsRecord(job.gameId) : await this.db.getGame(job.gameId);
        const settings = ANALYSIS_PRESETS.find(s => s.id === job.settingsId);
        if (!game || !settings || !game.checksum) {
          await this.db.putJob({ ...job, status: 'failed', error: 'The game or its analysis settings could not be found.', updatedAt: new Date().toISOString() });
          continue;
        }
        const running: AnalysisJob = { ...job, status: 'running', updatedAt: new Date().toISOString(), total: game.moves.length };
        await this.db.putJob(running);
        this.progress = { jobId: job.id, gameId: game.id, done: 0, total: game.moves.length, status: 'running', partial: [] };
        this.notify();
        try {
          const report = await this.analysis.analyze(
            { gameId: game.id, checksum: game.checksum, initialFen: game.initialFen, setupMoves: game.setupMoves, moves: game.moves.map(m => m.ccn), settings },
            (ply, i, n) => {
              if (this.progress?.jobId !== job.id) return;
              this.progress = { ...this.progress, done: i + 1, total: n, partial: [...this.progress.partial, ply] };
              this.notifyProgress();
            },
          );
          if (exh) {
            // exhibitions: the report (with its Played Like for both sides) stays with the exhibition — never in
            // `reports` and never a permanent Played Like record (isolation from career records)
            if (report.status === 'complete') report.playedLike = playedLikeRecord(report);
            await saveExhibitionReport(this.db, report);
            await this.db.putJob({ ...running, status: report.status === 'complete' ? 'complete' : 'partial', progress: report.plies.length, reportId: report.id, updatedAt: new Date().toISOString() });
            continue;
          }
          if (!job.gameId.startsWith('wg:')) report.recommendations = recommendationsFor(report, game.humanColor);
          // Played Like for both sides, persisted with the report (pure function of the analysed plies; cheap)
          if (report.status === 'complete') report.playedLike = playedLikeRecord(report);
          await this.db.addReport(report, { ...running, status: report.status === 'complete' ? 'complete' : 'partial', progress: report.plies.length, reportId: report.id, updatedAt: new Date().toISOString() });
          if (!job.gameId.startsWith('wg:') && report.status === 'complete') await this.recordPlayedLike(job.gameId).catch(e => console.error('played like record', e));
        } catch (e) {
          if ((e as Error).message === 'cancelled') return; // state already written by the canceller
          await this.db.putJob({ ...running, status: 'failed', error: (e as Error).message, updatedAt: new Date().toISOString() });
        } finally {
          if (this.progress?.jobId === job.id) this.progress = null;
          this.notify();
        }
      }
    } finally {
      this.processing = false;
    }
  }

  async reportsFor(gameId: string): Promise<AnalysisReport[]> { return this.db.reportsForGame(gameId); }

  /** Start New Career, step 1: full backup (returned for download) plus an archived copy if storage allows. */
  async prepareNewCareer(): Promise<PreparedCareerChange> {
    if (this.readOnly) throw new Error('This tab is read-only. Close the other tab first.');
    return prepareNewCareer(this.db, APP_VERSION);
  }
  /** Start New Career, step 2 (after confirmation): stop background work, then clear the career as the Federation's
   *  last command. The caller reloads the app afterwards. */
  async startNewCareer(prepared: PreparedCareerChange): Promise<CareerRecord> {
    if (this.readOnly) throw new Error('This tab is read-only. Close the other tab first.');
    this.closing = true;
    this.background.stop();
    this.live?.stop();
    this.exhibitions?.pause(); // an exhibition in progress stops (its in-flight reply is discarded)
    // the Vault stops listening; an evaluation in flight finishes (into the OLD career) before the wipe
    if (this.vault) { this.vault.stop(); await this.vault.evaluate().catch(() => {}); }
    this.analysis.cancel();
    this.progress = null;
    const wipe = () => startNewCareer(this.db, prepared);
    const rec = this.fed ? await this.fed.closeForNewCareer(wipe) : await wipe();
    this.notify();
    return rec;
  }

  /** Store (or refresh) the permanent Played Like record of one of the player's finalized games (src/storage/playedLikeStore.ts). */
  async recordPlayedLike(gameId: string): Promise<boolean> {
    if (this.readOnly) return false;
    const ok = await recordPlayedLikeIn(this.db, gameId);
    if (ok) { this.playedLikeVersion++; this.notify(); }
    return ok;
  }

  /** Backfill for saves from before v0.10 (and after a model update): every finalized game whose analysis exists gets
   *  its record for the current model. Games without analysis get one when their analysis completes. */
  async backfillPlayedLike(): Promise<number> {
    if (this.readOnly) return 0;
    const n = await backfillPlayedLikeIn(this.db);
    if (n) { this.playedLikeVersion++; this.notify(); }
    return n;
  }
}

export async function requestPersistentStorage(): Promise<{ persisted: boolean | null; usage: number | null; quota: number | null }> {
  const st = navigator.storage;
  if (!st) return { persisted: null, usage: null, quota: null };
  let persisted: boolean | null = null;
  try { persisted = (await st.persisted?.()) ?? null; if (!persisted && st.persist) persisted = await st.persist(); } catch { persisted = null; }
  let usage: number | null = null, quota: number | null = null;
  try { const e = await st.estimate(); usage = e.usage ?? null; quota = e.quota ?? null; } catch { /* unsupported */ }
  return { persisted, usage, quota };
}
