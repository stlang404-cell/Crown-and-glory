/**
 * App-update controller (browser only). Registers the service worker, checks for a new release on launch and when the
 * app comes back to the foreground (this is how an iOS Home Screen app notices updates: it is usually resumed, not
 * relaunched), tracks a downloaded-and-waiting worker, and switches to it only when asked (see updatePolicy.ts for
 * when the UI asks). A reload follows the switch exactly once; a confirmation is shown after it.
 */
export interface BuildInfo { version: string; commit: string; builtAt: string }

export const CURRENT_BUILD: BuildInfo = typeof __BUILD__ !== 'undefined' ? __BUILD__ : { version: 'dev', commit: 'local', builtAt: '' };

export interface UpdateState {
  /** A new worker has installed (all files cached) and is waiting to be switched on. */
  waiting: boolean;
  /** Identity of the release on the server (from version.json), when known. */
  available: BuildInfo | null;
  /** A switch was requested and the page is about to reload. */
  applying: boolean;
  /** Another tab switched the worker while this page runs the previous release. */
  activatedElsewhere: boolean;
  /** Shown once after the reload that installed an update. */
  justUpdated: BuildInfo | null;
  lastCheck: number;
}

const FLAG = 'crown-update-from';
const RELOAD_GUARD = 'crown-update-reloaded-at';
const ss = {
  get(k: string): string | null { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* storage blocked: the reload guard falls back to memory */ } },
  del(k: string) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
const sameBuild = (a: BuildInfo | null, b: BuildInfo | null) => !!a && !!b && a.version === b.version && a.commit === b.commit && a.builtAt === b.builtAt;

class UpdateController {
  state: UpdateState = { waiting: false, available: null, applying: false, activatedElsewhere: false, justUpdated: null, lastCheck: 0 };
  /** Minimum time between automatic checks (launch/foreground). Tests may lower it. */
  throttleMs = 3 * 60_000;
  reg: ServiceWorkerRegistration | null = null;
  private listeners = new Set<() => void>();
  private reloading = false;
  private requested = false;
  private askedWorker: ServiceWorker | null = null;
  private reloadOnSwitch = true;

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;
  private set(p: Partial<UpdateState>) {
    // Notify only on a real change: listeners re-render UpdateNotice, whose effect may call apply() again.
    if ((Object.keys(p) as (keyof UpdateState)[]).every(k => Object.is(this.state[k], p[k]))) return;
    this.state = { ...this.state, ...p }; this.listeners.forEach(l => l());
  }

  start() {
    // confirmation after an update-triggered reload (once)
    const from = ss.get(FLAG);
    if (from !== null) { ss.del(FLAG); if (from !== JSON.stringify(CURRENT_BUILD)) this.set({ justUpdated: CURRENT_BUILD }); }
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const sw = navigator.serviceWorker;
    const hadController = !!sw.controller;
    sw.addEventListener('controllerchange', () => {
      if (!hadController) return; // first install taking control: nothing to reload
      if (this.requested) { if (this.reloadOnSwitch) this.reloadOnce(); else this.set({ waiting: false, applying: false }); return; }
      this.set({ activatedElsewhere: true, waiting: false });
    });
    const go = async () => {
      try {
        this.reg = await sw.register('./sw.js', { updateViaCache: 'none' });
      } catch (e) { console.warn('service worker registration failed', e); return; }
      this.watch(this.reg);
      void this.check(true);
    };
    if (document.readyState === 'complete') void go(); else window.addEventListener('load', () => { void go(); }, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void this.check(); });
    window.addEventListener('pageshow', e => { if ((e as PageTransitionEvent).persisted) void this.check(); });
    window.addEventListener('online', () => { void this.check(); });
  }

  private watch(reg: ServiceWorkerRegistration) {
    const onWaiting = () => {
      if (!reg.waiting || !navigator.serviceWorker.controller) return; // no waiting worker, or first install (activates by itself)
      this.set({ waiting: true });
      void this.fetchVersion();
    };
    onWaiting();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') onWaiting(); });
    });
  }

  /** Ask the server for a newer release (throttled unless forced). Resolves after the check request finished. */
  async check(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.state.lastCheck < this.throttleMs) return;
    this.set({ lastCheck: now });
    if (!navigator.onLine) return;
    await this.fetchVersion();
    try { await this.reg?.update(); } catch { /* offline or server error: try again next time */ }
  }

  async fetchVersion(): Promise<BuildInfo | null> {
    try {
      const r = await fetch('./version.json', { cache: 'no-store' });
      if (!r.ok) return null;
      const v = await r.json() as BuildInfo;
      if (v && typeof v.version === 'string') { if (!sameBuild(v, this.state.available)) this.set({ available: v }); return v; }
    } catch { /* offline */ }
    return null;
  }

  /** Is the waiting release the same code this page already runs (e.g. the page was reloaded online and got the new
   *  index.html from the network)? Then switching needs no reload. */
  runningMatchesWaiting(): boolean { return sameBuild(this.state.available, CURRENT_BUILD); }

  /** Switch to the waiting worker; the page reloads once when it takes over. */
  apply() {
    if (this.state.activatedElsewhere) { this.reloadOnce(); return; }
    const w = this.reg?.waiting;
    if (!w) return;
    // Ask each waiting worker once (re-asking re-rendered UpdateNotice in a loop: React error #185).
    if (this.askedWorker === w) return;
    this.askedWorker = w;
    this.requested = true;
    this.reloadOnSwitch = !this.runningMatchesWaiting();
    this.set({ applying: this.reloadOnSwitch });
    w.postMessage({ type: 'SKIP_WAITING' });
  }

  private reloadOnce() {
    if (this.reloading) return;
    // loop guard: if the previous update reload happened moments ago and did not change the running build, stop here
    const [at, from] = (ss.get(RELOAD_GUARD) ?? '0|').split(/\|(.*)/s);
    if (Date.now() - Number(at) < 10_000 && from === JSON.stringify(CURRENT_BUILD)) { this.set({ applying: false }); return; }
    this.reloading = true;
    ss.set(RELOAD_GUARD, `${Date.now()}|${JSON.stringify(CURRENT_BUILD)}`);
    ss.set(FLAG, JSON.stringify(CURRENT_BUILD));
    location.reload();
  }

  dismissConfirmation() { this.set({ justUpdated: null }); }
}

export const updates = new UpdateController();
