/**
 * Game clocks (crown-clock-2, v1.1): formatting, low-time thresholds, a visible-time source and the pause-on-exit
 * keeper used by local human-vs-AI games (Play, Quick Match, Rivals, Federation fixtures).
 *
 * POLICY (docs/SAVE_FORMAT.md "Pause on exit"):
 *  - Time is charged only while the game is on screen. The clock reads a monotonic VisibleClock built from
 *    performance.now() deltas; it stops advancing while the page is hidden, frozen or closed, and any single gap
 *    between two readings is capped (MAX_STEP_MS) so a page that was suspended without an event is not drained.
 *  - When the page is hidden (visibilitychange), frozen (freeze), closed (pagehide) or the match screen is left, the
 *    running clock is charged up to that instant, the game is paused (a pause event is recorded) and the record is
 *    saved. When the page is visible again the clock restarts from the saved remaining time.
 *  - While a clock runs, its remaining time is committed and saved every HEARTBEAT_MS (heartbeat). After an
 *    unexpected termination (crash, killed tab) the reloaded game is charged up to the last heartbeat and no more.
 *  - No background timer is relied on (iOS suspends them): pausing happens in the lifecycle event handlers.
 *  - Repeated background/foreground cycles never grant time: each cycle charges the visible time first.
 */
import type { GameRecord, PauseEvent, TimeControl } from './types';
import type { GameSession } from './session';

/** "1:05:09" (an hour or more), "59:59", "0:19.4" (under 20 s: tenths). */
export function fmtClock(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  const t = Math.max(0, ms);
  const h = Math.floor(t / 3_600_000), m = Math.floor((t % 3_600_000) / 60_000), s = Math.floor((t % 60_000) / 1000);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return t < 20_000 ? `${m}:${String(s).padStart(2, '0')}.${Math.floor((t % 1000) / 100)}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Spoken form for screen readers: "1 hour 5 minutes 9 seconds". */
export function spokenClock(ms: number): string {
  if (!Number.isFinite(ms)) return 'no clock';
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const part = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`;
  return [h ? part(h, 'hour') : '', h || m ? part(m, 'minute') : '', part(s, 'second')].filter(Boolean).join(' ');
}

/** Low-time warning: 10 % of the base, at least 20 s and at most 5 minutes (60+60 → 5:00, 30+30 → 3:00, 5+3 → 0:30). */
export const lowTimeThreshold = (tc: Pick<TimeControl, 'initialMs'>): number => Math.max(20_000, Math.min(300_000, tc.initialMs * 0.1));
/** Critical: under 20 s (tenths are shown). */
export const CRITICAL_MS = 20_000;

/** "+60 s per move" / "no increment". */
export const incrementText = (tc: Pick<TimeControl, 'incrementMs'>): string => (tc.incrementMs > 0 ? `+${tc.incrementMs / 1000} s per move` : 'no increment');

export const MAX_STEP_MS = 5_000;
export const HEARTBEAT_MS = 5_000;

/**
 * Monotonic time that advances only while the clock source is live (page visible). Each reading adds the real
 * elapsed time since the previous reading, capped at `cap`.
 */
export class VisibleClock {
  private t = 0;
  private last: number | null;
  constructor(private readonly real: () => number = () => performance.now(), private readonly cap: number = MAX_STEP_MS) { this.last = real(); }
  now(): number {
    if (this.last !== null) {
      const r = this.real();
      this.t += Math.min(Math.max(0, r - this.last), this.cap);
      this.last = r;
    }
    return this.t;
  }
  /** Stop advancing (the page is hidden/frozen/closing). */
  suspend(): void { this.now(); this.last = null; }
  /** Advance again from now. */
  resume(): void { if (this.last === null) this.last = this.real(); }
  get suspended(): boolean { return this.last === null; }
}

interface LifecycleTarget {
  addEventListener(type: string, l: () => void): void;
  removeEventListener(type: string, l: () => void): void;
}
export interface KeeperDeps {
  session: GameSession;
  clock: VisibleClock;
  /** Persist a snapshot (the storage layer serialises writes; the newest snapshot is the last one written). */
  save: (rec: GameRecord) => Promise<void>;
  /** The UI should re-render (paused/resumed/heartbeat). */
  onChange?: () => void;
  /** Called before a pause (e.g. cancel the engine's search). */
  onPause?: (reason: PauseEvent['reason']) => void;
  onSaveError?: (e: unknown) => void;
  nowIso?: () => string;
  heartbeatMs?: number;
  /** Lifecycle event sources (default: document and window). */
  doc?: LifecycleTarget & { visibilityState: string };
  win?: LifecycleTarget;
  setInterval?: (f: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
}

/**
 * Pause-on-exit keeper for one open game. attach() starts it; detach() (leaving the match screen) pauses and saves.
 * Every handler is synchronous up to the save call, so the committed clock is in the snapshot even if the page is
 * discarded right after the event.
 */
export class ClockKeeper {
  private timer: unknown = null;
  private attached = false;
  private readonly iso: () => string;
  private readonly hb: number;
  saves = 0;
  constructor(private readonly d: KeeperDeps) {
    this.iso = d.nowIso ?? (() => new Date().toISOString());
    this.hb = d.heartbeatMs ?? HEARTBEAT_MS;
  }
  private get doc() { return this.d.doc ?? (typeof document !== 'undefined' ? (document as unknown as LifecycleTarget & { visibilityState: string }) : undefined); }
  private get win() { return this.d.win ?? (typeof window !== 'undefined' ? (window as unknown as LifecycleTarget) : undefined); }

  private onVisibility = () => { if (this.doc?.visibilityState === 'hidden') this.pause('visibility'); else this.resume(); };
  private onPageHide = () => this.pause('pagehide');
  private onFreeze = () => this.pause('freeze');
  private onShow = () => { if (this.doc?.visibilityState !== 'hidden') this.resume(); };

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    const doc = this.doc, win = this.win;
    doc?.addEventListener('visibilitychange', this.onVisibility);
    doc?.addEventListener('freeze', this.onFreeze);
    doc?.addEventListener('resume', this.onShow);
    win?.addEventListener('pagehide', this.onPageHide);
    win?.addEventListener('pageshow', this.onShow);
    const si = this.d.setInterval ?? ((f: () => void, ms: number) => setInterval(f, ms));
    this.timer = si(() => this.heartbeat(), this.hb);
    if (doc?.visibilityState === 'hidden') this.pause('visibility');
  }

  /** Leave the game (match screen closed): pause, save, stop listening. */
  detach(reason: PauseEvent['reason'] = 'leave'): void {
    if (!this.attached) return;
    this.pause(reason);
    this.attached = false;
    const doc = this.doc, win = this.win;
    doc?.removeEventListener('visibilitychange', this.onVisibility);
    doc?.removeEventListener('freeze', this.onFreeze);
    doc?.removeEventListener('resume', this.onShow);
    win?.removeEventListener('pagehide', this.onPageHide);
    win?.removeEventListener('pageshow', this.onShow);
    if (this.timer !== null) (this.d.clearInterval ?? ((id: unknown) => clearInterval(id as ReturnType<typeof setInterval>)))(this.timer);
    this.timer = null;
  }

  private persist(): void {
    this.saves++;
    void this.d.save(this.d.session.snapshot()).catch(e => this.d.onSaveError?.(e));
  }

  /** Commit the running clock and save (every HEARTBEAT_MS while visible). */
  heartbeat(): void {
    if (this.d.clock.suspended) return;
    if (this.d.session.checkpoint(this.d.clock.now())) this.persist();
  }

  pause(reason: PauseEvent['reason']): void {
    const s = this.d.session;
    const now = this.d.clock.now();
    this.d.clock.suspend();
    if (s.isOver || s.paused || !s.timed) { if (!s.isOver && !s.timed) this.persist(); this.d.onChange?.(); return; }
    this.d.onPause?.(reason);
    s.pause(now, reason, this.iso());
    this.persist();
    this.d.onChange?.();
  }

  resume(): void {
    if (!this.attached) return;
    this.d.clock.resume();
    const s = this.d.session;
    if (s.isOver || !s.paused) { this.d.onChange?.(); return; }
    s.resume(this.d.clock.now(), this.iso());
    this.persist();
    this.d.onChange?.();
  }
}
