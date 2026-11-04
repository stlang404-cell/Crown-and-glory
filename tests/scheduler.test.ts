/**
 * Live match scheduler (crown-live-scheduler-1, docs/FEDERATION_SCALE.md): capacity bounds, persistence and resume,
 * settlement exactly once and independent of pacing, abstract vs simulated labelling, determinism under seed.
 * Engines run in-process with a tiny node budget (the production budget is measured by tools/sim/live_cost.mts).
 */
import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { LiveScheduler, LiveSettings, MoveRequest, capacityFor, defaultLiveSettings, inProcessEngines, planCatchUp, sanitize, loadLiveSettings, saveLiveSettings, HARD_MAX_LIVE } from '../src/app/scheduler';
import { gamesOf } from '../src/federation/driver';
import { hashSeed, rng01 } from '../src/federation/generator';
import { sampleResult } from '../src/federation/resultModel';
import { playSelfplay } from '../src/engine/selfplay';

const small = (r: MoveRequest): MoveRequest => ({ ...r, profile: { ...r.profile, nodes: 120, depth: 3, selection: null } });

function clockFrom(startMs: number) {
  let t = startMs;
  return { now: () => new Date(t += 1000).toISOString(), ms: () => t, jump: (d: number) => { t += d; } };
}

async function make(f = new IDBFactory(), clock = clockFrom(Date.UTC(2026, 0, 1))) {
  const db = await CrownDB.open(f);
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), clock.now);
  // featured games (played at round advance) on a tiny budget too
  const tiny = <T extends { profile: MoveRequest['profile'] }>(x: T): T => ({ ...x, profile: { ...x.profile, nodes: 120, depth: 3, selection: null } });
  svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, tiny(req.white), tiny(req.black), req.seed, req.maxPlies, m => onMove(m));
  return { db, svc, f, clock };
}

const settings = (over: Partial<LiveSettings> = {}): LiveSettings => sanitize({ ...defaultLiveSettings({ cores: 8, mobile: false }), mode: 'fixed', fixed: 4, plyIntervalMs: 250, ...over });

async function scheduler(svc: FederationService, clock: { ms: () => number }, s: LiveSettings, engines = 2) {
  return new LiveScheduler(svc, await inProcessEngines(engines, small), { settings: () => s, nowMs: clock.ms });
}

/** Tick until `pred` holds (every tick waits for its moves to commit). */
async function runUntil(sch: LiveScheduler, clock: { jump: (d: number) => void }, pred: () => boolean, maxTicks = 5000, onTick?: () => void) {
  for (let i = 0; i < maxTicks && !pred(); i++) { clock.jump(1000); await sch.tick(); await sch.idle(); onTick?.(); }
  expect(pred()).toBe(true);
}

const liveDump = (svc: FederationService) => createHash('sha256').update(JSON.stringify({
  live: [...svc.state!.liveGames.values()].map(g => [g.id, g.moves.map(m => m.ccn), g.status, g.resolution]).sort(),
  fixtures: svc.slateFixtures().map(f => [f.id, f.result, f.resolution, f.gameId]).sort(),
})).digest('hex');

describe('live scheduler: capacity', () => {
  it('capacity follows the settings and the measured move cost, within hard bounds', () => {
    const s = settings({ mode: 'auto', maxAuto: 24, plyIntervalMs: 3000, utilization: 0.5 });
    expect(capacityFor(s, null, 2)).toBe(4); // unmeasured: start small
    expect(capacityFor(s, 48, 2)).toBe(24); // desktop, Crown Division move ≈ 48 ms → limited by maxAuto
    expect(capacityFor(s, 250, 1)).toBe(6); // ≈ 5× slower device, one worker
    expect(capacityFor(s, 5000, 1)).toBe(1); // never below one
    expect(capacityFor({ ...s, mode: 'off' }, 10, 4)).toBe(0);
    expect(capacityFor({ ...s, mode: 'fixed', fixed: 99 }, 10, 4)).toBe(HARD_MAX_LIVE);
    expect(defaultLiveSettings({ cores: 4, mobile: true }).maxAuto).toBeLessThan(defaultLiveSettings({ cores: 8, mobile: false }).maxAuto);
  });

  it('settings persist per device and are sanitised', () => {
    const m = new Map<string, string>();
    const kv = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    saveLiveSettings({ ...settings(), fixed: 1000, plyIntervalMs: -5 }, kv);
    const back = loadLiveSettings({ cores: 8, mobile: false }, kv);
    expect(back.fixed).toBe(HARD_MAX_LIVE);
    expect(back.plyIntervalMs).toBe(250);
    expect(loadLiveSettings({ cores: 8, mobile: false }, { getItem: () => '{broken', setItem: () => {} }).mode).toBe('auto');
  });

  it('never has more games in progress than the capacity, nor more computing than engines', async () => {
    const { svc, clock } = await make();
    await svc.create(5, 9101);
    const s = settings({ fixed: 5 });
    const sch = await scheduler(svc, clock, s, 2);
    let maxActive = 0, maxInflight = 0, finished = 0;
    for (let i = 0; i < 400 && svc.slateFixtures().length <= 6; i++) {
      clock.jump(1000);
      await sch.tick();
      maxActive = Math.max(maxActive, svc.activeScheduled().length);
      maxInflight = Math.max(maxInflight, sch.stats().inflight);
      await sch.idle();
      finished = svc.slateFixtures().filter(f => f.result !== null).length;
    }
    expect(maxActive).toBe(5);
    expect(maxInflight).toBeLessThanOrEqual(2);
    expect(finished).toBeGreaterThan(0);
    // finished games free their slot: more fixtures were promoted than the capacity
    expect(svc.slateFixtures().length).toBeGreaterThan(5);
    // lowering the capacity: no new games start, extra games wait
    s.fixed = 2;
    const before = svc.slateFixtures().length;
    clock.jump(1000); await sch.tick(); await sch.idle();
    expect(svc.slateFixtures().length).toBe(before);
    expect(sch.stats().capacity).toBe(2);
  }, 300_000);
});

describe('live scheduler: settlement, persistence, labels, determinism', () => {
  it('a scheduled game settles once, through the featured path; stale and duplicate steps are discarded', async () => {
    const { svc, clock } = await make();
    await svc.create(2, 4321);
    const sch = await scheduler(svc, clock, settings({ fixed: 3 }), 2);
    await runUntil(sch, clock, () => svc.slateFixtures().some(f => f.result !== null));
    const done = svc.slateFixtures().find(f => f.result !== null)!;
    const lg = svc.liveGame(done.id)!;
    expect(lg.status).toBe('done');
    expect(done.resolution).toBe('simulated');
    expect(lg.resolution).toBe('simulated');
    const wg = (await svc.worldGame(`wg:${done.id}`))!;
    expect(wg.mode).toBe('scheduled-live');
    expect(wg.moves.map(m => m.ccn)).toEqual(lg.moves.map(m => m.ccn));
    expect(done.gameId).toBe(wg.id);
    // a late duplicate of the last move (e.g. a second worker / tab) is not applied
    const last = lg.moves[lg.moves.length - 1];
    const res = await svc.scheduledStep(done.id, lg.moves.length - 1, { ccn: last.ccn, score: last.score, depth: 1, nodes: 1, ms: 1 });
    expect(res.applied).toBe(false);
    expect(svc.liveGame(done.id)!.moves.length).toBe(lg.moves.length);
    // a stale ply for a running game is discarded too
    const running = svc.activeScheduled()[0];
    if (running) expect((await svc.scheduledStep(running.id, running.moves.length + 3, { ccn: 'a2a3', score: { kind: 'cp', value: 0 }, depth: 1, nodes: 1, ms: 1 })).applied).toBe(false);
    // advancing: every pairing appears exactly once in the season's games, with the recorded result
    for (const f of svc.playerFixtures()) await svc.forfeit(f.id);
    const statsBefore = svc.state!.competitors.get(done.white)!.stats;
    const playedBefore = statsBefore.w + statsBefore.d + statsBefore.l;
    await svc.advanceRound();
    const games = gamesOf(svc.seasonRounds(done.season)).filter(g => g.white === done.white && g.black === done.black && g.event === done.event);
    expect(games).toHaveLength(1);
    expect(games[0].result).toBe(done.result);
    const st = svc.state!.competitors.get(done.white)!.stats;
    expect(st.w + st.d + st.l).toBe(playedBefore + 1);
    expect([...svc.state!.balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
    // after the round is processed nothing more can be applied
    expect((await svc.scheduledStep(done.id, lg.moves.length, { ccn: last.ccn, score: last.score, depth: 1, nodes: 1, ms: 1 })).applied).toBe(false);
  }, 300_000);

  it('unfinished games take exactly their tier-3 draw when the round closes, labelled abstract, with no replay', async () => {
    // world A: no scheduler — the background results of round 1
    const A = await make();
    await A.svc.create(2, 5555);
    const candidates = A.svc.slateCandidates().slice(0, 3);
    for (const f of A.svc.playerFixtures()) await A.svc.forfeit(f.id);
    await A.svc.advanceRound();
    const rec = A.svc.seasonRounds(1).find(r => r.round === 1)!;
    const expected = candidates.map(([e, w, b]) => rec.abstract.find(a => a[0] === e && a[1] === w && a[2] === b)![3]);
    // world B: same seed; the same three fixtures are promoted and a few moves played, then the round is advanced
    const B = await make();
    await B.svc.create(2, 5555);
    const sch = await scheduler(B.svc, B.clock, settings({ fixed: 3 }), 1);
    await runUntil(sch, B.clock, () => B.svc.activeScheduled().length === 3 && B.svc.activeScheduled().every(g => g.moves.length >= 2) || B.svc.slateFixtures().some(f => f.result !== null));
    const slate = B.svc.slateFixtures();
    expect(slate.map(f => [f.event, f.white, f.black])).toEqual(candidates);
    const unfinished = slate.filter(f => f.result === null).map(f => f.id);
    expect(unfinished.length).toBeGreaterThan(0);
    for (const f of B.svc.playerFixtures()) await B.svc.forfeit(f.id);
    await B.svc.advanceRound();
    const recB = B.svc.seasonRounds(1).find(r => r.round === 1)!;
    candidates.forEach(([e, w, b], i) => {
      const f = recB.fixtures.find(x => x.slate && x.event === e && x.white === w && x.black === b)!;
      if (unfinished.includes(f.id)) {
        expect(f.result).toBe(expected[i]);
        expect(f.resolution).toBe('abstract');
        expect(f.gameId).toBeNull();
        const lg = B.svc.liveGame(f.id)!;
        expect(lg.status).toBe('done');
        expect(lg.resolution).toBe('abstract');
        expect(lg.note).toMatch(/round closed/);
      }
    });
    for (const id of unfinished) expect(await B.svc.worldGame(`wg:${id}`)).toBeUndefined();
    // the abstract draw formula is the tier-3 one
    const f0 = recB.fixtures.find(x => x.id === unfinished[0])!;
    const u = rng01(hashSeed(5555, 'result', 1, 1, f0.event, f0.white, f0.black))();
    expect(f0.result).toBe(sampleResult(B.svc.state!.competitors.get(f0.white)!.latent, B.svc.state!.competitors.get(f0.black)!.latent, u));
  }, 300_000);

  it('resumes after a reload on exactly the same timeline; results do not depend on pacing or worker count', async () => {
    // reference: one uninterrupted run, 3 engines, every game due at once
    const R = await make();
    await R.svc.create(7, 2468);
    const sR = await scheduler(R.svc, R.clock, settings({ fixed: 3, maxPerRound: 3 }), 3);
    await runUntil(sR, R.clock, () => R.svc.slateFixtures().length === 3 && R.svc.slateFixtures().every(f => f.result !== null));
    // interrupted run: 1 engine, slower pace, stopped mid-game, reloaded from IndexedDB into a new service
    const f = new IDBFactory();
    const A = await make(f);
    await A.svc.create(7, 2468);
    const sA = await scheduler(A.svc, A.clock, settings({ fixed: 3, maxPerRound: 3, plyIntervalMs: 2500 }), 1);
    await runUntil(sA, A.clock, () => A.svc.activeScheduled().some(g => g.moves.length >= 6));
    sA.stop();
    const partial = A.svc.activeScheduled().map(g => [g.id, g.moves.length]).sort();
    const B = await make(f, A.clock);
    await B.svc.load();
    expect(B.svc.activeScheduled().map(g => [g.id, g.moves.length]).sort()).toEqual(partial);
    const sB = await scheduler(B.svc, A.clock, settings({ fixed: 3, maxPerRound: 3 }), 2);
    const plan = await sB.catchUp(); // reopened seconds later: nothing to catch up
    expect(plan!.fastForward).toEqual([]);
    expect(plan!.abstract).toEqual([]);
    await runUntil(sB, A.clock, () => B.svc.slateFixtures().length === 3 && B.svc.slateFixtures().every(x => x.result !== null));
    expect(liveDump(B.svc)).toBe(liveDump(R.svc));
    for (const x of R.svc.slateFixtures()) {
      const a = (await R.svc.worldGame(`wg:${x.id}`))!, b = (await B.svc.worldGame(`wg:${x.id}`))!;
      expect(b.moves.map(m => m.ccn)).toEqual(a.moves.map(m => m.ccn));
      expect(b.result).toBe(a.result);
    }
  }, 300_000);

  it('reopen catch-up is bounded: K games fast-forwarded (real moves), the rest abstract, all labelled', async () => {
    const f = new IDBFactory();
    const A = await make(f);
    await A.svc.create(4, 1357);
    const s = settings({ fixed: 5, catchUpK: 2, catchUpAfterMs: 10 * 60_000 });
    const sA = await scheduler(A.svc, A.clock, s, 2);
    await runUntil(sA, A.clock, () => A.svc.activeScheduled().length === 5 && A.svc.activeScheduled().every(g => g.moves.length >= 2));
    sA.stop();
    const active = A.svc.activeScheduled().map(g => g.id);
    // the app stays closed for two hours: nothing is computed meanwhile
    A.clock.jump(2 * 3600_000);
    const B = await make(f, A.clock);
    await B.svc.load();
    expect(B.svc.activeScheduled().map(g => g.id).sort()).toEqual([...active].sort());
    const sB = await scheduler(B.svc, A.clock, s, 2);
    const plan = (await sB.catchUp())!;
    expect(plan.fastForward).toHaveLength(2);
    expect(plan.abstract).toHaveLength(3);
    expect(plan.closedMs).toBeGreaterThanOrEqual(2 * 3600_000);
    for (const id of plan.fastForward) {
      const fx = B.svc.slateFixtures().find(x => x.id === id)!;
      expect(fx.result).not.toBeNull();
      expect(fx.resolution).toBe('fast-forwarded');
      const wg = (await B.svc.worldGame(`wg:${id}`))!;
      expect(wg.mode).toBe('fast-forwarded');
      expect(wg.moves.length).toBe(B.svc.liveGame(id)!.moves.length);
    }
    for (const id of plan.abstract) {
      const fx = B.svc.slateFixtures().find(x => x.id === id)!;
      expect(fx.resolution).toBe('abstract');
      expect(B.svc.liveGame(id)!.note).toMatch(/reopened/);
      expect(await B.svc.worldGame(`wg:${id}`)).toBeUndefined(); // never a fabricated replay
    }
    // the pure plan: a short absence resumes everything
    expect(planCatchUp([{ id: 'x', startedAt: new Date(0).toISOString(), lastMoveAt: new Date(1000).toISOString(), marketId: null }], 5000, s).resume).toEqual(['x']);
  }, 300_000);

  it('two runs with the same seed and settings produce identical games and results', async () => {
    const run = async () => {
      const X = await make(new IDBFactory(), clockFrom(Date.UTC(2026, 5, 1)));
      await X.svc.create(9, 8642);
      const sch = await scheduler(X.svc, X.clock, settings({ fixed: 4, maxPerRound: 6 }), 2);
      await runUntil(sch, X.clock, () => X.svc.slateFixtures().length === 6 && X.svc.slateFixtures().every(f => f.result !== null));
      return liveDump(X.svc);
    };
    expect(await run()).toBe(await run());
  }, 300_000);

  it('user commands wait for a scheduler commit instead of failing', async () => {
    const { svc, clock } = await make();
    await svc.create(1, 777);
    const sch = await scheduler(svc, clock, settings({ fixed: 2 }), 1);
    clock.jump(1000);
    const t = sch.tick();
    // a user command issued while the scheduler is committing is queued behind it, not rejected
    await svc.setFavorites(['c0001']);
    await t; await sch.idle();
    expect(svc.state!.extra.favorites).toEqual(['c0001']);
  }, 120_000);
});
