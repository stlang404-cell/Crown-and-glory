/**
 * Screen loads in flight (every RecordsReloader pass counts). The background start (src/app/backgroundStart.ts) does
 * not begin its next step while a screen is loading the records it shows, so the player's own data comes first.
 */
let foregroundLoads = 0;
const foregroundWaiters = new Set<() => void>();
export function foregroundBusy(): boolean { return foregroundLoads > 0; }
/** Resolves once no screen load is in flight, or after `maxMs` (a stuck load can never block the background). */
export function whenForegroundIdle(maxMs: number): Promise<void> {
  if (!foregroundLoads) return Promise.resolve();
  return new Promise(res => {
    const done = () => { foregroundWaiters.delete(done); clearTimeout(t); res(); };
    const t = setTimeout(done, maxMs);
    foregroundWaiters.add(done);
  });
}
function foregroundEnd(): void { if (--foregroundLoads === 0) for (const w of [...foregroundWaiters]) w(); }

/**
 * Coalescing, change-keyed reloads of saved records for a screen (v1.0 package R, docs/evidence/v1.0/reload-flake.md).
 *
 * The app publishes a change notification for everything (Federation commits of scheduled games twice a second, Vault
 * and legacy evaluations, analysis start and end). A screen that re-read every store it shows on each notification
 * kept IndexedDB and the main thread busy exactly while a reloaded app was trying to show its first screen. A
 * RecordsReloader instead:
 *  - loads at once on the first request;
 *  - afterwards reads only a cheap change key (record counts) and reloads only when it moved;
 *  - never runs two loads at once: requests during a load are coalesced into one more pass after it, so the newest
 *    data always lands last (no out-of-order overwrite) and a stream of notifications cannot starve a slow load;
 *  - stops applying anything once stopped (the screen unmounted).
 * A failed key read or load is reported and retried on the next request; nothing is written.
 */
export class RecordsReloader<K = string> {
  private running: Promise<void> | null = null;
  private dirty = false;
  private stopped = false;
  private applied: { key: K } | null = null;
  /** Diagnostics and tests: loads and change-key checks performed. */
  loads = 0;
  checks = 0;

  constructor(private readonly key: () => Promise<K>, private readonly load: (alive: () => boolean) => Promise<void>, private readonly onError: (e: unknown) => void = e => console.error('reload', e)) {}

  get alive(): boolean { return !this.stopped; }

  /** A change notification. Resolves when the pass it joined has finished. */
  request(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) { this.dirty = true; return this.running; }
    this.running = (async () => {
      try {
        do {
          this.dirty = false;
          this.checks++;
          const k = await this.key();
          if (this.stopped) return;
          if (this.applied && Object.is(this.applied.key, k)) continue;
          this.loads++;
          foregroundLoads++;
          try { await this.load(() => !this.stopped); } finally { foregroundEnd(); }
          if (this.stopped) return;
          this.applied = { key: k };
        } while (this.dirty && !this.stopped);
      } catch (e) {
        this.onError(e);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** Force the next request to reload even if the change key did not move. */
  invalidate(): void { this.applied = null; }
  stop(): void { this.stopped = true; }
}
