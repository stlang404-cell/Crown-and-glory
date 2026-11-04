/**
 * v1.0 package R — reload robustness and startup ordering (docs/evidence/v1.0/reload-flake.md):
 *  - the hash route survives a change between the first render and the App's subscription (the lost-navigation race);
 *  - the background start runs after the first screen, in a fixed order, one idle step at a time, never twice;
 *  - change-keyed, coalescing screen reloads: newest data lands last, a stream of notifications cannot starve a load;
 *  - per-move analysis progress no longer bumps the data revision;
 *  - a reload in the middle of the background back-fills loses nothing and duplicates nothing.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import MODEL from '../src/analysis/played-like-model.json';
import { parseHash, subscribeHash, syncView, toHash, type View } from '../src/ui/route';
import { BackgroundStart, type BackgroundEnv } from '../src/app/backgroundStart';
import { RecordsReloader, foregroundBusy, whenForegroundIdle } from '../src/app/reloader';
import { mark, markTime, startupMarks } from '../src/app/startup';
import { AppServices } from '../src/app/services';
import { CrownDB } from '../src/storage/db';
import { gameChecksum } from '../src/storage/checksum';
import { backfillPlayedLike } from '../src/storage/playedLikeStore';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';
import { LegacyService } from '../src/legacy/service';
import { loadAwards } from '../src/legacy/store';
import type { AnalysisReport } from '../src/analysis/types';
import type { FederationService } from '../src/app/federation';
import type { LitePly } from '../src/analysis/playedLikeFeatures';

// ------------------------------------------------------------------ hash route
class FakeWindow {
  location = { hash: '' };
  private ls = new Set<() => void>();
  addEventListener(_t: 'hashchange', l: () => void) { this.ls.add(l); }
  removeEventListener(_t: 'hashchange', l: () => void) { this.ls.delete(l); }
  /** Browser behaviour: the hash changes at once, the event is dispatched later to whoever listens then. */
  navigate(hash: string) { this.location.hash = hash; }
  dispatch() { for (const l of [...this.ls]) l(); }
  get listeners() { return this.ls.size; }
}
/** A minimal React-like state cell: setState accepts updaters; counts the renders an update would cause. */
function cell(initial: View) {
  const c = { v: initial, renders: 0, set: (u: (v: View) => View) => { const n = u(c.v); if (n !== c.v) { c.v = n; c.renders++; } } };
  return c;
}

describe('hash route: no navigation is lost between the first render and the subscription', () => {
  it('parses and formats every route as before', () => {
    expect(parseHash('')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/profile')).toEqual({ name: 'profile' });
    expect(parseHash('#/federation')).toEqual({ name: 'world' });
    expect(parseHash('#/match/g%2F1')).toEqual({ name: 'match', gameId: 'g/1' });
    expect(parseHash('#/analysis/g1/7')).toEqual({ name: 'analysis', gameId: 'g1', ply: 7 });
    expect(parseHash('#/nonsense')).toEqual({ name: 'dashboard' });
    for (const h of ['#/profile', '#/match/g1', '#/analysis/g1/3', '#/analysis', '#/exchange/m1', '#/grimoire/a%2Fb', '#/watch/f1']) expect(toHash(parseHash(h))).toBe(h);
  });

  it('a hash change after the first render but before the subscription is picked up (it was lost before v1.0)', () => {
    const w = new FakeWindow();
    w.navigate('#/match/g1');
    const view = cell(parseHash(w.location.hash)); // the first render reads the hash
    w.navigate('#/profile'); // e.g. the test's goto('#/profile') while the first render commits …
    w.dispatch(); // … its hashchange is dispatched before the App's effect has subscribed: nobody hears it
    expect(view.v.name).toBe('match');
    const off = subscribeHash(w, view.set); // the App's effect
    expect(view.v).toEqual({ name: 'profile' }); // re-read at subscription
    w.navigate('#/settings'); w.dispatch();
    expect(view.v).toEqual({ name: 'settings' });
    off();
    expect(w.listeners).toBe(0);
    w.navigate('#/play'); w.dispatch();
    expect(view.v.name).toBe('settings'); // unsubscribed
  });

  it('re-reading an unchanged route keeps the same view object (no extra render)', () => {
    const w = new FakeWindow();
    w.navigate('#/federation');
    const view = cell(parseHash(w.location.hash));
    const first = view.v;
    subscribeHash(w, view.set);
    expect(view.v).toBe(first);
    expect(view.renders).toBe(0);
    expect(syncView(first, { name: 'world' })).toBe(first);
    expect(syncView(first, { name: 'play' })).toEqual({ name: 'play' });
  });
});

// ------------------------------------------------------------------ background start
function env(log: string[]) {
  let paint: (() => void) | null = null;
  const idles: (() => void)[] = [];
  const timers: (() => void)[] = [];
  const e: BackgroundEnv = {
    afterPaint: () => new Promise<void>(r => { log.push('paint?'); paint = r; }),
    idle: () => new Promise<void>(r => { idles.push(r); }),
    setTimeout: f => { timers.push(f); return 0; },
    mark: n => log.push(n),
    onError: (s, err) => log.push(`error ${s}: ${(err as Error).message}`),
  };
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return {
    e, flush,
    paint: async () => { paint?.(); await flush(); },
    idle: async () => { const r = idles.shift(); r?.(); await flush(); },
    fireTimers: async () => { for (const t of timers.splice(0)) t(); await flush(); },
    get pendingIdle() { return idles.length; },
  };
}

describe('background start: after the first screen, fixed order, one idle step at a time', () => {
  it('nothing runs before the first screen is painted; then each step waits for an idle moment, in order', async () => {
    const log: string[] = [];
    const E = env(log);
    const ran: string[] = [];
    const b = new BackgroundStart(E.e)
      .add('analysis', () => { ran.push('analysis'); })
      .add('vault', async () => { ran.push('vault'); })
      .add('legacy', async () => { ran.push('legacy'); })
      .add('playedLike', async () => { ran.push('playedLike'); })
      .add('live', () => { ran.push('live'); });
    b.arm();
    await E.flush();
    expect(ran).toEqual([]); // boot finished, first screen not reported: nothing yet
    const done = b.firstScreen();
    await E.flush();
    expect(ran).toEqual([]); // reported, not yet painted
    await E.paint();
    expect(ran).toEqual([]); // painted: the first step still waits for idle
    for (const want of ['analysis', 'vault', 'legacy', 'playedLike', 'live']) {
      await E.idle();
      expect(ran.at(-1)).toBe(want);
    }
    await done;
    expect(ran).toEqual(['analysis', 'vault', 'legacy', 'playedLike', 'live']);
    expect(b.finished).toEqual(ran);
    expect(log.filter(l => l.startsWith('bg:') && l.endsWith(':start'))).toEqual(['bg:start', 'bg:analysis:start', 'bg:vault:start', 'bg:legacy:start', 'bg:playedLike:start', 'bg:live:start']);
  });

  it('is started once however often the first screen is reported (StrictMode, remounts) or the fallback fires', async () => {
    const E = env([]);
    let n = 0;
    const b = new BackgroundStart(E.e).add('vault', () => { n++; });
    b.arm();
    const p1 = b.firstScreen(); const p2 = b.firstScreen();
    expect(p1).toBe(p2);
    await E.fireTimers(); // the fallback timer: same run
    await E.paint(); await E.idle(); await p1;
    expect(n).toBe(1);
    await b.firstScreen();
    expect(n).toBe(1);
  });

  it('with no UI the fallback timer starts it anyway', async () => {
    const E = env([]);
    let n = 0;
    const b = new BackgroundStart(E.e, { fallbackMs: 10 }).add('vault', () => { n++; });
    b.arm();
    expect(b.isStarted).toBe(false);
    await E.fireTimers();
    expect(b.isStarted).toBe(true);
    await E.paint(); await E.idle();
    expect(n).toBe(1);
  });

  it('a failing step is reported and the queue goes on; stop() prevents later steps', async () => {
    const log: string[] = [];
    const E = env(log);
    const ran: string[] = [];
    const b = new BackgroundStart(E.e)
      .add('vault', async () => { throw new Error('boom'); })
      .add('legacy', () => { ran.push('legacy'); })
      .add('live', () => { ran.push('live'); });
    const done = b.firstScreen();
    await E.paint(); await E.idle(); await E.idle();
    expect(log).toContain('error vault: boom');
    expect(ran).toEqual(['legacy']);
    b.stop();
    await E.idle(); await done;
    expect(ran).toEqual(['legacy']); // stopped before 'live'
  });

  it('a screen loading its records goes first: the next step waits until that load is done (bounded)', async () => {
    const E = env([]);
    E.e.foregroundIdle = () => whenForegroundIdle(5000);
    const ran: string[] = [];
    const g = deferred();
    const screen = new RecordsReloader(async () => 'k', async () => { await g.p; ran.push('screen'); });
    const b = new BackgroundStart(E.e).add('vault', () => { ran.push('vault'); });
    const loading = screen.request();
    await tick();
    expect(foregroundBusy()).toBe(true);
    const done = b.firstScreen();
    await E.paint(); await E.idle(); await tick();
    expect(ran).toEqual([]); // the Vault step has not started while the screen loads
    g.res(); await loading; await tick(); await E.idle(); await done;
    expect(ran).toEqual(['screen', 'vault']);
    expect(foregroundBusy()).toBe(false);
    // bounded: a load that never ends cannot block the background for good
    const stuck = new RecordsReloader(async () => 'k', () => new Promise<void>(() => {}));
    void stuck.request(); await tick();
    const t0 = Date.now(); await whenForegroundIdle(30); expect(Date.now() - t0).toBeGreaterThanOrEqual(25);
  });

  it('steps are fixed before the start', () => {
    const b = new BackgroundStart(env([]).e);
    void b.firstScreen();
    expect(() => b.add('late', () => {})).toThrow();
  });
});

// ------------------------------------------------------------------ change-keyed, coalescing reloads
const tick = () => new Promise(r => setTimeout(r, 0));
function deferred<T = void>() { let res!: (v: T) => void; const p = new Promise<T>(r => { res = r; }); return { p, res }; }

describe('RecordsReloader', () => {
  it('loads at once, then only when the change key moves', async () => {
    let key = 'k1'; let loads = 0;
    const r = new RecordsReloader(async () => key, async () => { loads++; });
    await r.request(); expect(loads).toBe(1);
    await r.request(); await r.request(); expect(loads).toBe(1); // nothing changed: two cheap key reads only
    expect(r.checks).toBe(3);
    key = 'k2';
    await r.request(); expect(loads).toBe(2);
    r.invalidate();
    await r.request(); expect(loads).toBe(3);
  });

  it('never runs two loads at once; requests during a load coalesce into one more pass, so the newest data lands last', async () => {
    let version = 0; let running = 0; let maxRunning = 0;
    const applied: number[] = [];
    const gates: { res: () => void }[] = [];
    const r = new RecordsReloader(async () => String(version), async alive => {
      running++; maxRunning = Math.max(maxRunning, running);
      const seen = version; // the load reads the records as they are now
      const g = deferred(); gates.push(g); await g.p;
      running--;
      if (alive()) applied.push(seen);
    });
    const first = r.request();
    await tick();
    version = 1; void r.request(); version = 2; void r.request(); version = 3; void r.request(); // a burst of notifications
    gates.shift()!.res(); await tick(); await tick();
    expect(gates).toHaveLength(1); // exactly one more pass for the whole burst
    gates.shift()!.res();
    await first;
    expect(maxRunning).toBe(1);
    expect(applied).toEqual([0, 3]); // in order, newest last
    expect(r.loads).toBe(2);
  });

  it('a stream of notifications faster than the load cannot starve it (every pass completes and is applied)', async () => {
    let version = 0;
    const applied: number[] = [];
    const r = new RecordsReloader(async () => String(version), async () => { const v = version; await new Promise(res => setTimeout(res, 5)); applied.push(v); });
    const stream = setInterval(() => { version++; void r.request(); }, 1);
    void r.request();
    await new Promise(res => setTimeout(res, 60));
    clearInterval(stream);
    await r.request();
    expect(applied.length).toBeGreaterThanOrEqual(3);
    expect([...applied].sort((a, b) => a - b)).toEqual(applied); // never out of order
  });

  it('applies nothing once stopped (the screen unmounted); a failure is reported and retried on the next request', async () => {
    const errs: unknown[] = [];
    let fail = true; let applied = 0;
    const r = new RecordsReloader(async () => 'k', async alive => { if (fail) throw new Error('idb'); if (alive()) applied++; }, e => errs.push(e));
    await r.request();
    expect(errs).toHaveLength(1);
    fail = false;
    await r.request();
    expect(applied).toBe(1);
    r.invalidate(); r.stop();
    await r.request();
    expect(applied).toBe(1);
    const g = deferred();
    let late = 0;
    const r2 = new RecordsReloader(async () => 'k', async alive => { await g.p; if (alive()) late++; });
    const p = r2.request(); await tick();
    r2.stop(); g.res(); await p;
    expect(late).toBe(0);
  });
});

// ------------------------------------------------------------------ progress channel
describe('analysis progress has its own channel', () => {
  it('a per-move progress update re-renders progress subscribers only; data changes notify both', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const s = new AppServices(db);
    let data = 0, prog = 0;
    s.subscribe(() => data++); s.subscribeProgress(() => prog++);
    const rev = s.revision;
    (s as unknown as { notifyProgress(): void }).notifyProgress();
    expect(s.revision).toBe(rev); // screens keyed on the revision do not reload their records
    expect([data, prog]).toEqual([0, 1]);
    s.notify();
    expect(s.revision).toBe(rev + 1);
    expect([data, prog]).toEqual([1, 2]);
  });

  it('the services report the first screen to the background start (no work starts before it)', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const s = new AppServices(db);
    expect(s.background.isStarted).toBe(false);
  });
});

// ------------------------------------------------------------------ marks
describe('startup marks', () => {
  it('records named phases in order and keeps the first time of a name', () => {
    mark('test:a'); mark('test:b'); mark('test:a');
    const names = startupMarks().map(m => m.name).filter(n => n.startsWith('test:'));
    expect(names).toEqual(['test:a', 'test:b', 'test:a']);
    expect(markTime('test:a')).toBeLessThanOrEqual(markTime('test:b')!);
  });
});

// ------------------------------------------------------------------ reload in the middle of the back-fills
const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 350 };
const engine = { kind: 'engine' as const, id: 'ai-7', name: 'Mira Vell', rating: 1400, rd: 60, engine: { profileId: 'L3', level: 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'cal', style: 'standard' } };
function finishedGame(id: string, minute: number) {
  const s = new GameSession(createGameRecord({ id, mode: 'rated', timeControl: TIME_CONTROLS.rapid, humanColor: 'white', human, engine, engineSeed: 1, nowIso: '2026-11-03T00:00:00Z' }));
  s.start(0);
  for (const m of ['c2c3', 'c5c4', 'e1f3', 'e6f4']) s.applyMove(m, 1, 'T');
  s.resign(1, 2, `2026-11-03T01:${String(minute).padStart(2, '0')}:00Z`);
  return s.snapshot();
}
function plies(n: number): LitePly[] {
  const out: LitePly[] = [];
  for (let i = 0; i < n; i++) for (const c of [0, 1] as const) {
    const ub = 0.5, loss = i % 5 === 0 ? 0.08 : 0.01;
    out.push({ ply: 2 * i + 1 + c + 4, c, forced: 0, legal: 12, ph: 1, loss, lossPrev: loss, g: -1, ub, up: ub - loss, cu: [ub, ub - 0.06, ub - 0.12] });
  }
  return out;
}
const report = (gameId: string) => ({
  id: `report:${gameId}:x:${MODEL.analysis.engine}:${MODEL.analysis.settings}:${MODEL.analysis.grading}`, gameId, status: 'complete',
  settings: { id: MODEL.analysis.settings }, engine: { buildId: MODEL.analysis.engine }, methodology: { gradingId: MODEL.analysis.grading },
  completedAt: '2026-11-03T02:00:00Z', plies: plies(30), summary: {},
}) as unknown as AnalysisReport;
const noFed = { ready: false, state: null } as unknown as FederationService;

/** A v0.9-style save: 10 finalized, analysed games without Played Like records and without legacy trophies. */
async function oldSave(f: IDBFactory): Promise<CrownDB> {
  const db = await CrownDB.open(f);
  for (let i = 0; i < 10; i++) {
    const g = finishedGame(`g${i}`, i);
    await db.saveGame(g);
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: `2026-11-03T01:${String(i).padStart(2, '0')}:00Z`, analysisSettingsId: 'std-d7', humanScore: 1 });
    await db.addReport(report(`g${i}`));
  }
  return db;
}
function queue(db: CrownDB, E: ReturnType<typeof env>, hooks: { afterPlayedLike?: () => void } = {}) {
  const legacy = new LegacyService({ db, fed: noFed, readOnly: false, matchActive: false, subscribe: () => () => {} }, () => '2026-11-04T00:00:00Z');
  const b = new BackgroundStart(E.e)
    .add('legacy', async () => { await legacy.start(); legacy.stop(); })
    .add('playedLike', async () => { await backfillPlayedLike(db, '2026-11-04T00:00:00Z'); hooks.afterPlayedLike?.(); })
    .add('live', () => {});
  return b;
}
async function runAll(b: BackgroundStart, E: ReturnType<typeof env>) {
  const done = b.firstScreen();
  await E.paint();
  while (E.pendingIdle || !b.finished.includes('live')) { await E.idle(); if (b.finished.includes('live')) break; await new Promise(r => setTimeout(r, 0)); }
  await done;
}

describe('a reload in the middle of the background back-fills loses nothing and duplicates nothing', () => {
  it('interrupted inside the Played Like back-fill (the page dies between two game writes), then a full start', async () => {
    const f = new IDBFactory();
    const db = await oldSave(f);
    // the page "dies" after the 4th record write: every later write of this page fails
    let writes = 0;
    const orig = db.setPlayedLikeRecord.bind(db);
    db.setPlayedLikeRecord = vi.fn(async (id, rec) => { if (++writes > 4) throw new Error('page closed'); return orig(id, rec); });
    const E1 = env([]);
    const b1 = queue(db, E1);
    const done = b1.firstScreen();
    await E1.paint();
    await E1.idle(); await new Promise(r => setTimeout(r, 20)); // legacy back-fill completes
    await E1.idle(); await new Promise(r => setTimeout(r, 20)); // Played Like back-fill: fails after 4 records
    b1.stop(); await E1.idle(); await done;
    const awards1 = await loadAwards(db);
    const partial = (await db.allGames()).filter(g => g.playedLike?.length).map(g => g.id).sort();
    expect(partial).toHaveLength(4);
    db.close();

    // reload: a new page, a new queue — every step runs again (the finished ones are no-ops)
    const db2 = await CrownDB.open(f);
    const E2 = env([]);
    await runAll(queue(db2, E2), E2);
    const games = await db2.allGames();
    expect(games.every(g => g.playedLike?.length === 1)).toBe(true); // all ten, exactly one record each
    const firstFour = games.filter(g => partial.includes(g.id)).map(g => g.playedLike![0].recordedAt);
    expect(new Set(firstFour).size).toBe(1); // the four written before the reload were not rewritten
    const awards2 = await loadAwards(db2);
    expect([...awards2.keys()].sort()).toEqual([...awards1.keys()].sort()); // trophies back-filled once, not duplicated
    expect([...awards2.values()].every(a => a.backfill)).toBe(true);
    // and a third start changes nothing
    const E3 = env([]);
    await runAll(queue(db2, E3), E3);
    expect((await db2.allGames()).map(g => g.playedLike!.length)).toEqual(games.map(() => 1));
    expect((await loadAwards(db2)).size).toBe(awards2.size);
  });

  it('the rating ledger and games are never touched by the background start', async () => {
    const f = new IDBFactory();
    const db = await oldSave(f);
    const before = { events: await db.ratingEvents(), states: await db.allRatingStates(), sums: (await db.allGames()).map(g => g.checksum) };
    const E = env([]);
    await runAll(queue(db, E), E);
    expect(await db.ratingEvents()).toEqual(before.events);
    expect(await db.allRatingStates()).toEqual(before.states);
    expect((await db.allGames()).map(g => g.checksum)).toEqual(before.sums);
    const own = await db.careerRatings();
    expect(own.events).toEqual(before.events);
    expect(own.states).toEqual(before.states);
  });
});
