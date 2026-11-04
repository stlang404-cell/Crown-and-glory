/**
 * Live match scheduler (crown-live-scheduler-1, docs/FEDERATION_SCALE.md).
 *
 * Keeps up to N watchable AI-vs-AI games of the open round in progress at once. Each is a real engine game played
 * move by move — one fresh, seeded search per move (src/app/schedulerEngine.ts) on a pool of spectator workers — and
 * every move is committed (IndexedDB liveGames store) as soon as it exists, so a reload resumes exactly where the game
 * was. Results go through the featured-game settlement path once (FederationService.scheduledStep); the viewing speed
 * of any screen never affects which move is played or when a game ends.
 *
 *  - Capacity N: 'auto' measures the engine time per move on this device and keeps
 *      N = ⌊workers × utilisation × plyInterval / medianMoveMs⌋, clamped to [1, maxAuto];
 *    'fixed' uses the Settings value; 'off' plays nothing.
 *  - Nothing computes while the app is closed (or hidden). On reopen after more than `catchUpAfterMs`, at most
 *    `catchUpK` of the interrupted games are fast-forwarded (every move still computed by the engine, labelled
 *    "fast-forwarded", not "live"); the others are resolved abstractly with the exact tier-3 draw of the pairing,
 *    labelled as such and without a replay. Games with a market are never scheduled.
 *  - When the round is advanced, unfinished scheduled games are resolved abstractly in the same commit.
 */
import type { FederationService, LiveGame } from './federation';
import type { SelfplayMove } from '../engine/selfplay';
import type { StrengthProfile } from '../engine/levels';
import type { StyleId } from '../federation/model';

export const SCHEDULER_ID = 'crown-live-scheduler-1';
/** Absolute bound on concurrent scheduled games regardless of settings. */
export const HARD_MAX_LIVE = 32;

export interface LiveSettings {
  mode: 'off' | 'auto' | 'fixed';
  /** Games in progress when mode = 'fixed'. */
  fixed: number;
  /** Upper bound for 'auto'. */
  maxAuto: number;
  /** Target time between two moves of one game (watchable pace). */
  plyIntervalMs: number;
  /** Fraction of the worker pool the scheduler may keep busy. */
  utilization: number;
  /** Reopen catch-up: at most this many interrupted games are fast-forwarded. */
  catchUpK: number;
  /** Reopen catch-up applies only after the app was away this long. */
  catchUpAfterMs: number;
  /** At most this many fixtures of one round are promoted to scheduled games. */
  maxPerRound: number;
}

export interface DeviceInfo { cores: number; mobile: boolean }

export function detectDevice(): DeviceInfo {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const cores = Math.max(1, nav?.hardwareConcurrency ?? 4);
  let mobile = false;
  try { mobile = /iPhone|iPad|Android|Mobile/i.test(nav?.userAgent ?? '') || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches); } catch { mobile = false; }
  return { cores, mobile };
}

/** Worker pool size for scheduled games: leave cores for the UI, the play engine and analysis. */
export const poolSizeFor = (d: DeviceInfo) => (d.mobile ? 1 : Math.max(1, Math.min(4, d.cores - 2)));

export function defaultLiveSettings(d: DeviceInfo): LiveSettings {
  return d.mobile
    ? { mode: 'auto', fixed: 4, maxAuto: 6, plyIntervalMs: 3000, utilization: 0.4, catchUpK: 2, catchUpAfterMs: 10 * 60_000, maxPerRound: 24 }
    : { mode: 'auto', fixed: 12, maxAuto: 24, plyIntervalMs: 3000, utilization: 0.5, catchUpK: 4, catchUpAfterMs: 10 * 60_000, maxPerRound: 64 };
}

export const LIVE_SETTINGS_KEY = 'crown.liveScheduler.v1';
type KV = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): KV | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

/** Per-device settings (localStorage: N depends on this device's CPU, so it is not part of the save). */
export function loadLiveSettings(d: DeviceInfo = detectDevice(), kv: KV | null = store()): LiveSettings {
  const def = defaultLiveSettings(d);
  try {
    const raw = kv?.getItem(LIVE_SETTINGS_KEY);
    if (!raw) return def;
    const v = JSON.parse(raw) as Partial<LiveSettings>;
    return sanitize({ ...def, ...v });
  } catch { return def; }
}
export function saveLiveSettings(s: LiveSettings, kv: KV | null = store()): void {
  try { kv?.setItem(LIVE_SETTINGS_KEY, JSON.stringify(sanitize(s))); } catch { /* storage unavailable: session only */ }
}
export function sanitize(s: LiveSettings): LiveSettings {
  const int = (x: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(x)) ? Math.max(lo, Math.min(hi, Math.round(Number(x)))) : d);
  return {
    mode: s.mode === 'off' || s.mode === 'fixed' ? s.mode : 'auto',
    fixed: int(s.fixed, 1, HARD_MAX_LIVE, 4), maxAuto: int(s.maxAuto, 1, HARD_MAX_LIVE, 12),
    plyIntervalMs: int(s.plyIntervalMs, 250, 60_000, 3000), utilization: Math.max(0.05, Math.min(1, Number(s.utilization) || 0.5)),
    catchUpK: int(s.catchUpK, 0, HARD_MAX_LIVE, 4), catchUpAfterMs: int(s.catchUpAfterMs, 0, 7 * 86_400_000, 600_000), maxPerRound: int(s.maxPerRound, 0, 512, 64),
  };
}

/** Concurrent games for these settings, given the measured median engine time per move (null = not measured yet). */
export function capacityFor(s: LiveSettings, medianMoveMs: number | null, workers: number): number {
  if (s.mode === 'off' || workers <= 0) return 0;
  if (s.mode === 'fixed') return Math.max(1, Math.min(HARD_MAX_LIVE, s.fixed));
  const max = Math.max(1, Math.min(HARD_MAX_LIVE, s.maxAuto));
  if (medianMoveMs === null) return Math.min(max, 4); // start small until this device has been measured
  return Math.max(1, Math.min(max, Math.floor((workers * s.utilization * s.plyIntervalMs) / Math.max(1, medianMoveMs))));
}

export interface CatchUpPlan { closedMs: number; fastForward: string[]; abstract: string[]; resume: string[] }

/** Reopen catch-up (bounded): nothing ran while the app was away; if it was away longer than catchUpAfterMs, the K
 *  longest-running interrupted games are fast-forwarded and the rest resolved abstractly. Deterministic order. */
export function planCatchUp(active: Pick<LiveGame, 'id' | 'startedAt' | 'lastMoveAt' | 'marketId'>[], nowMs: number, s: LiveSettings): CatchUpPlan {
  const games = active.filter(g => !g.marketId);
  const last = Math.max(...games.map(g => Date.parse(g.lastMoveAt ?? g.startedAt)), -Infinity);
  const closedMs = Number.isFinite(last) ? Math.max(0, nowMs - last) : 0;
  if (!games.length || closedMs < s.catchUpAfterMs) return { closedMs, fastForward: [], abstract: [], resume: games.map(g => g.id) };
  const order = [...games].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id)).map(g => g.id);
  return { closedMs, fastForward: order.slice(0, s.catchUpK), abstract: order.slice(s.catchUpK), resume: [] };
}

export interface MoveRequest { moves: string[]; profile: StrengthProfile; style: StyleId; seed: number }
export type MoveResult = { ccn: string; score: SelfplayMove['score']; depth: number; nodes: number; ms: number };
/** One engine slot (a spectator worker in the app, an in-process search in tests). One request at a time. */
export interface MoveEngine { compute(req: MoveRequest): Promise<MoveResult> }

export interface SchedulerStats { capacity: number; active: number; inflight: number; workers: number; medianMoveMs: number | null; moves: number; finished: number; stale: number; errors: number; paused: string[]; lastCatchUp: CatchUpPlan | null }

export class LiveScheduler {
  private inflight = new Map<string, Promise<void>>();
  private free: number[];
  private recent: number[] = [];
  private pausedBy = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private ticking = false;
  private counters = { moves: 0, finished: 0, stale: 0, errors: 0 };
  lastCatchUp: CatchUpPlan | null = null;
  lastError: string | null = null;
  onChange: (() => void) | null = null;

  constructor(private fed: FederationService, private engines: MoveEngine[], private opts: { settings: () => LiveSettings; nowMs?: () => number; readOnly?: () => boolean }) {
    this.free = engines.map((_, i) => i);
  }

  private now(): number { return this.opts.nowMs ? this.opts.nowMs() : Date.now(); }
  get settings(): LiveSettings { return this.opts.settings(); }
  medianMoveMs(): number | null { if (this.recent.length < 5) return null; const s = [...this.recent].sort((a, b) => a - b); return s[s.length >> 1]; }
  capacity(): number { return capacityFor(this.settings, this.medianMoveMs(), this.engines.length); }
  stats(): SchedulerStats {
    return { capacity: this.capacity(), active: this.fed.activeScheduled().length, inflight: this.inflight.size, workers: this.engines.length, medianMoveMs: this.medianMoveMs(), ...this.counters, paused: [...this.pausedBy], lastCatchUp: this.lastCatchUp };
  }

  pause(reason: string): void { this.pausedBy.add(reason); this.onChange?.(); }
  resume(reason: string): void { this.pausedBy.delete(reason); this.onChange?.(); if (this.running) this.arm(0); }
  get paused(): boolean { return this.pausedBy.size > 0; }

  /** Start: run the reopen catch-up once, then tick on a timer. */
  async start(): Promise<CatchUpPlan | null> {
    if (this.running) return this.lastCatchUp;
    this.running = true;
    const plan = await this.catchUp().catch(e => { this.fail(e); return null; });
    this.arm(0);
    return plan;
  }
  stop(): void { this.running = false; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private arm(ms: number): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.tick().finally(() => this.arm(Math.max(100, Math.min(500, this.settings.plyIntervalMs / 4)))); }, ms);
  }
  private fail(e: unknown): void { this.counters.errors++; this.lastError = (e as Error)?.message ?? String(e); }

  /** Bounded reopen catch-up (see planCatchUp). Fast-forwarded games are computed move by move to their end. */
  async catchUp(): Promise<CatchUpPlan | null> {
    if (!this.fed.ready || this.opts.readOnly?.()) return null;
    const plan = planCatchUp(this.fed.activeScheduled(), this.now(), this.settings);
    this.lastCatchUp = plan;
    if (plan.abstract.length) await this.fed.resolveScheduledAbstract(plan.abstract, `Resolved abstractly when the app reopened after ${Math.round(plan.closedMs / 60_000)} min away (catch-up limit ${this.settings.catchUpK} games).`);
    if (plan.fastForward.length) {
      // fast-forward runs one game per engine slot in parallel; every move is a real engine move
      const queue = [...plan.fastForward];
      await Promise.all(this.engines.map(async (_, slot) => {
        for (let id = queue.shift(); id; id = queue.shift()) await this.playOut(id, slot);
      }));
    }
    this.onChange?.();
    return plan;
  }

  private async playOut(id: string, slot: number): Promise<void> {
    for (let guard = 0; guard < 500; guard++) {
      const req = this.fed.scheduledRequest(id);
      if (!req) return;
      const r = await this.engines[slot].compute(req);
      const res = await this.fed.scheduledStep(id, req.ply, r, true);
      this.record(r, res);
      if (!res.applied || res.done) return;
    }
  }

  private record(r: MoveResult, res: { applied: boolean; done: boolean }): void {
    if (res.applied) { this.counters.moves++; this.recent.push(r.ms); if (this.recent.length > 60) this.recent.shift(); }
    else this.counters.stale++;
    if (res.done) this.counters.finished++;
  }

  /** One scheduling pass: fill free slots up to capacity, then hand due moves to free engines. Returns moves dispatched. */
  async tick(): Promise<number> {
    if (this.ticking || this.paused || !this.fed.ready || this.opts.readOnly?.()) return 0;
    this.ticking = true;
    try {
      const s = this.settings, cap = this.capacity();
      let active = this.fed.activeScheduled();
      if (active.length < cap) {
        try { await this.fed.startSlate(cap - active.length, s.maxPerRound); } catch (e) { this.fail(e); }
        active = this.fed.activeScheduled();
      }
      // only the first `cap` games (in start order) advance; extra games (capacity was lowered) wait for a slot
      const runnable = [...active].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id)).slice(0, cap);
      const now = this.now();
      const due = runnable.filter(g => !this.inflight.has(g.id) && now - Date.parse(g.lastMoveAt ?? g.startedAt) >= s.plyIntervalMs)
        .sort((a, b) => (a.lastMoveAt ?? a.startedAt).localeCompare(b.lastMoveAt ?? b.startedAt) || a.id.localeCompare(b.id));
      let n = 0;
      for (const g of due) {
        const slot = this.free.shift();
        if (slot === undefined) break;
        const req = this.fed.scheduledRequest(g.id);
        if (!req) { this.free.push(slot); continue; }
        n++;
        const p = this.engines[slot].compute(req)
          .then(r => this.fed.scheduledStep(g.id, req.ply, r).then(res => this.record(r, res)))
          .catch(e => this.fail(e))
          .finally(() => { this.inflight.delete(g.id); this.free.push(slot); this.onChange?.(); });
        this.inflight.set(g.id, p);
      }
      return n;
    } finally { this.ticking = false; }
  }

  /** Wait for every dispatched move to be committed (tests, shutdown). */
  async idle(): Promise<void> { while (this.inflight.size) await Promise.all([...this.inflight.values()]); }
}

/** In-process engines (Node tools and tests): the same fresh seeded search as the spectator worker. */
export async function inProcessEngines(n: number, adjust?: (r: MoveRequest) => MoveRequest): Promise<MoveEngine[]> {
  const [{ Position }, { parseLegalCcn }, { playLiveMove, START_FEN }] = await Promise.all([import('../rules/position'), import('../rules/notation'), import('./schedulerEngine')]);
  const one: MoveEngine = {
    async compute(req0) {
      const req = adjust ? adjust(req0) : req0;
      const pos = Position.fromFen(START_FEN);
      for (const c of req.moves) pos.makeMove(parseLegalCcn(pos, c));
      const r = playLiveMove(pos, req.profile, req.style, req.seed);
      await Promise.resolve();
      return { ccn: r.ccn, score: r.score, depth: r.depth, nodes: r.nodes, ms: r.ms };
    },
  };
  return Array.from({ length: n }, () => one);
}
