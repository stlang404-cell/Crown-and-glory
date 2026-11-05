/**
 * Background start after the first screen (v1.0 package R, docs/evidence/v1.0/reload-flake.md).
 *
 * Before v1.0 the analysis queue started before the first render, and the Vault/legacy back-fills, the Played Like
 * back-fill and the live scheduler (with its reopen catch-up) on fixed timers 0.8, 1.2 and 1.5 s after boot —
 * whether or not the first screen had rendered. On a slow or loaded device (and a cold iPhone start is one) they ran
 * while the first screen was still loading the player's own records, competing for the main thread and IndexedDB.
 *
 * Now they run as one ordered queue that starts only once the first screen has been committed and painted (plus a
 * quiet second for that screen), and each
 * step waits until no screen is loading its records (bounded) and for an idle moment (requestIdleCallback with a
 * deadline, else a short timeout) before it starts:
 *   1. analysis queue (its search runs in a worker)  2. Vault (incl. the crown-vault-2 back-fill)
 *   3. legacy trophies back-fill   4. Played Like back-fill   5. live scheduler + reopen catch-up.
 * The order is fixed (deterministic); every step is idempotent and put-if-absent, so a reload in the middle of the
 * queue loses nothing — the next start simply runs the remaining (and the already-done, no-op) steps again.
 * A step that fails is reported and the queue goes on. If no first screen is reported (no UI), the queue starts
 * after `fallbackMs` anyway, so background work can never be left unstarted.
 */
export interface BackgroundStep { name: string; run: () => Promise<unknown> | unknown }

export interface BackgroundEnv {
  /** Wait for an idle moment (at most `timeoutMs`). */
  idle(timeoutMs: number): Promise<void>;
  /** Wait for the next painted frame. */
  afterPaint(): Promise<void>;
  /** Wait until no screen is loading its records (bounded). Optional. */
  foregroundIdle?(): Promise<void>;
  setTimeout(f: () => void, ms: number): unknown;
  /** Wait `ms` (the quiet moment after the first paint). Optional: tests run without it. */
  delay?(ms: number): Promise<void>;
  mark?(name: string): void;
  onError?(step: string, e: unknown): void;
}

export const browserEnv = (mark?: (n: string) => void, foregroundIdle?: () => Promise<void>): BackgroundEnv => ({
  foregroundIdle,
  idle: timeoutMs => new Promise<void>(res => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => res(), { timeout: timeoutMs }); else setTimeout(res, Math.min(50, timeoutMs));
  }),
  // a frame callback, then a task after it: the frame that shows the first screen has been produced
  afterPaint: () => new Promise<void>(res => {
    if (typeof requestAnimationFrame === 'undefined' || (typeof document !== 'undefined' && document.hidden)) { setTimeout(res, 0); return; }
    requestAnimationFrame(() => setTimeout(res, 0));
  }),
  setTimeout: (f, ms) => setTimeout(f, ms),
  delay: ms => new Promise<void>(res => setTimeout(res, ms)),
  mark,
  onError: (step, e) => console.error(`background start: ${step}`, e),
});

export class BackgroundStart {
  private steps: BackgroundStep[] = [];
  private started = false;
  private stopped = false;
  private done: Promise<void> | null = null;
  /** Names of the steps that have finished (in order); for diagnostics and tests. */
  readonly finished: string[] = [];

  constructor(private readonly env: BackgroundEnv, readonly opts: { idleTimeoutMs?: number; fallbackMs?: number; quietMs?: number } = {}) {}

  add(name: string, run: BackgroundStep['run']): this {
    if (this.started) throw new Error('background start: steps are fixed before it starts');
    this.steps.push({ name, run });
    return this;
  }

  /** Arm the no-UI fallback (call once, right after boot). */
  arm(): void { this.env.setTimeout(() => { void this.firstScreen(); }, this.opts.fallbackMs ?? 4000); }

  /** The first screen has been committed: start after it has been painted. Idempotent; resolves when the queue is done. */
  firstScreen(): Promise<void> {
    if (this.done) return this.done;
    this.started = true;
    this.done = (async () => {
      await this.env.afterPaint();
      // a quiet moment for the first screen (taps, its own record loads) before any background work begins
      await this.env.delay?.(this.opts.quietMs ?? 1000);
      this.env.mark?.('bg:start');
      for (const s of this.steps) {
        if (this.stopped) return;
        // a screen loading its records (e.g. the Career Passport after a navigation) goes first, then an idle moment
        await this.env.foregroundIdle?.();
        await this.env.idle(this.opts.idleTimeoutMs ?? 1000);
        await this.env.foregroundIdle?.();
        if (this.stopped) return;
        this.env.mark?.(`bg:${s.name}:start`);
        try { await s.run(); } catch (e) { this.env.onError?.(s.name, e); }
        this.env.mark?.(`bg:${s.name}:end`);
        this.finished.push(s.name);
      }
      this.env.mark?.('bg:done');
    })();
    return this.done;
  }

  /** No further step starts (Start New Career); a step already running finishes. */
  stop(): void { this.stopped = true; }
  get isStarted(): boolean { return this.started; }
}
