/**
 * v1.1 Grand Classical update: long time controls, the career pool (seeded once from Rapid), pause-on-exit clocks,
 * save & resume, and the Federation transition rule (docs/CAREER_RATING.md §7, docs/SAVE_FORMAT.md).
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { GameSession, createGameRecord } from '../src/games/session';
import {
  CASUAL_CONTROLS, DEFAULT_RATED_CONTROL, FEDERATION_TIME_CONTROL, RATED_PRESETS, TIME_CONTROLS, customTimeControl, describeControl, isRatedControl, legacyPoolFor,
  poolFor, type GameRecord, type TimeControl,
} from '../src/games/types';
import { ClockKeeper, VisibleClock, fmtClock, incrementText, lowTimeThreshold, spokenClock, MAX_STEP_MS } from '../src/games/clock';
import { CAREER_POOL, LEGACY_CAREER_POOL, SEED_MIN_RD, careerTimeline, ownGames, seededPoolState } from '../src/ratings/pools';
import { CrownDB } from '../src/storage/db';
import { exportBundle, importBundle, validateBundle, ImportError } from '../src/storage/backup';
import { gameChecksum, sha256Hex } from '../src/storage/checksum';
import { computeRatingEvent, newPoolState, replayLedger, type PoolState, type RatingEvent } from '../src/ratings/ledger';
import { TC_PREF_KEY, controlFromPref, loadTimeControl, prefFromControl, resetTimeControlCache, saveTimeControl } from '../src/app/timeControlPref';
import { LEVELS, BEGINNER_LEVELS, MAX_RATED_BUDGET_S, allocateTime, chooseMove, maxProfile } from '../src/engine/levels';
import { profileForStrength } from '../src/federation/profiles';
import { Searcher } from '../src/engine/search';
import { Position } from '../src/rules/position';
import { moveToCcn } from '../src/rules/notation';
import { updateSafety } from '../src/app/updatePolicy';
import { FederationService } from '../src/app/federation';
import { PLAYER_ID } from '../src/federation/model';

const MIN = 60_000;
const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 80 };
const engine = { kind: 'engine' as const, id: 'ai-1', name: 'AI', rating: 1400, rd: 60, engine: { profileId: 'L3', level: 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'cal', style: 'standard' } };
const mk = (tc: TimeControl = DEFAULT_RATED_CONTROL, o: { fen?: string; id?: string; mode?: 'rated' | 'casual' } = {}) => new GameSession(createGameRecord({
  id: o.id ?? 'g1', mode: o.mode ?? 'rated', timeControl: tc, humanColor: 'white', human, engine, engineSeed: 7, nowIso: '2026-11-05T00:00:00Z', initialFen: o.fen,
}));

describe('time-control presets (v1.1)', () => {
  it('defines the six human-rated presets with exact base and increment, shortest first', () => {
    const want: [string, string, number, number][] = [
      ['xrapid30', 'Extended Rapid 30+30', 30, 30], ['classical60', 'Classical 60+60', 60, 60], ['grand90', 'Grand Classical 90+60', 90, 60],
      ['crownmaster120', 'Crownmaster 120+90', 120, 90], ['marathon180', 'Marathon 180+120', 180, 120], ['eternal240', 'Eternal Crown 240+120', 240, 120],
    ];
    expect(RATED_PRESETS).toEqual(want.map(w => w[0]));
    for (const [id, label, b, i] of want) {
      const tc = TIME_CONTROLS[id as keyof typeof TIME_CONTROLS];
      expect(tc).toEqual({ id, label, initialMs: b * MIN, incrementMs: i * 1000 });
      expect(isRatedControl(tc)).toBe(true);
      expect(poolFor(tc)).toBe(CAREER_POOL);
      const s = mk(tc);
      expect(s.record.rated).toBe(true);
      expect(s.record.pool).toBe(CAREER_POOL);
      expect(s.record.clocks).toEqual({ whiteMs: b * MIN, blackMs: b * MIN });
    }
  });
  it('no new human-rated game has a base under 30 minutes; old controls keep their labels and are casual only', () => {
    for (const id of RATED_PRESETS) expect(TIME_CONTROLS[id].initialMs).toBeGreaterThanOrEqual(30 * MIN);
    expect(TIME_CONTROLS.blitz.label).toBe('Blitz 3+2');
    expect(TIME_CONTROLS.rapid.label).toBe('Rapid 5+3');
    expect(TIME_CONTROLS.classical.label).toBe('Classical 15+10');
    for (const id of CASUAL_CONTROLS) {
      expect(poolFor(TIME_CONTROLS[id])).toBeNull();
      const s = mk(TIME_CONTROLS[id]);
      expect(s.record.rated).toBe(false);
      expect(s.record.mode).toBe('casual');
      expect(s.record.pool).toBeNull();
    }
    expect(legacyPoolFor('rapid')).toBe('rapid'); // reading old games only
    // a 29-minute custom control is impossible; 30 is the floor
    expect(customTimeControl(10, 30).initialMs).toBe(30 * MIN);
    expect(customTimeControl(999, 999)).toMatchObject({ initialMs: 240 * MIN, incrementMs: 120_000, label: 'Custom 240+120' });
    expect(isRatedControl({ id: 'custom', initialMs: 29 * MIN, incrementMs: 30_000 })).toBe(false);
  });
  it('the default for new human-rated matches is Classical 60+60 (Play, Quick Match, Federation fixtures)', () => {
    expect(DEFAULT_RATED_CONTROL).toBe(TIME_CONTROLS.classical60);
    expect(FEDERATION_TIME_CONTROL).toBe(TIME_CONTROLS.classical60);
    expect(describeControl(DEFAULT_RATED_CONTROL)).toBe('60 minutes per player, plus 60 seconds after every completed move');
    expect(describeControl(TIME_CONTROLS.untimed)).toBe('No clock');
    expect(incrementText(DEFAULT_RATED_CONTROL)).toBe('+60 s per move');
  });
  it('custom controls are rated only inside the documented envelope (base 30–240 min, increment 30–120 s)', () => {
    expect(poolFor(customTimeControl(45, 30))).toBe(CAREER_POOL);
    expect(poolFor(customTimeControl(240, 120))).toBe(CAREER_POOL);
    expect(poolFor(customTimeControl(45, 0))).toBeNull(); // sudden death: casual
    expect(poolFor(customTimeControl(45, 29))).toBeNull();
    expect(mk(customTimeControl(45, 20)).record.rated).toBe(false);
    const c = mk(customTimeControl(75, 45));
    expect(c.record).toMatchObject({ rated: true, pool: CAREER_POOL, timeControl: { id: 'custom', label: 'Custom 75+45', initialMs: 75 * MIN, incrementMs: 45_000 } });
  });
});

describe('remembered time control (meta pref:timeControl)', () => {
  afterEach(() => resetTimeControlCache());
  it('defaults to 60+60, persists the last selection (presets and custom) and sanitises bad values', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    expect(await loadTimeControl(db)).toBe(TIME_CONTROLS.classical60);
    await saveTimeControl(db, TIME_CONTROLS.marathon180);
    expect(await db.getMeta(TC_PREF_KEY)).toEqual({ v: 1, id: 'marathon180' });
    db.close();
    resetTimeControlCache();
    const again = await CrownDB.open(f);
    expect(await loadTimeControl(again)).toBe(TIME_CONTROLS.marathon180);
    await saveTimeControl(again, customTimeControl(50, 40));
    resetTimeControlCache();
    expect(await loadTimeControl(again)).toEqual(customTimeControl(50, 40));
    expect(controlFromPref(prefFromControl(customTimeControl(31, 0)))).toEqual(customTimeControl(31, 0));
    for (const bad of [null, 7, { id: 'hyper' }, { id: 'custom', baseMin: 5, incS: 1 }, { id: 'custom', baseMin: 'x' }]) expect(controlFromPref(bad)).toBe(DEFAULT_RATED_CONTROL);
  });
});

describe('long clocks: increment, flag, mate/stalemate, formatting', () => {
  it('adds the increment to the player who completes a legal move, at every preset', () => {
    for (const id of RATED_PRESETS) {
      const tc = TIME_CONTROLS[id];
      const s = mk(tc);
      s.start(0);
      expect(s.applyMove('a2a4', 1000, 'T').ok).toBe(false); // illegal: no increment, no clock change
      expect(s.record.clocks!.whiteMs).toBe(tc.initialMs);
      const r = s.applyMove('c2c3', 125_000, 'T');
      expect(r.ok && r.record).toMatchObject({ elapsedMs: 125_000, clockBeforeMs: tc.initialMs, clockAfterMs: tc.initialMs - 125_000 + tc.incrementMs });
      expect(s.record.clocks!.blackMs).toBe(tc.initialMs); // only the mover gains
      const r2 = s.applyMove('c5c4', 125_000 + 7_000, 'T');
      expect(r2.ok && r2.record.clockAfterMs).toBe(tc.initialMs - 7_000 + tc.incrementMs);
    }
  });
  it('time forfeit at 60+60: the flag falls at exactly 60 minutes of thinking', () => {
    const s = mk();
    s.start(0);
    expect(s.tick(60 * MIN - 1, 'T')).toBeNull();
    const o = s.tick(60 * MIN + 1, 'T');
    expect(o).toMatchObject({ termination: 'timeout', result: '0-1' });
    expect(s.record.clocks!.whiteMs).toBe(0);
    // a move submitted after the flag does not count
    const t = mk();
    t.start(0);
    const late = t.applyMove('c2c3', 60 * MIN + 5, 'T');
    expect(late.ok).toBe(false);
    expect(t.record.termination).toBe('timeout');
  });
  it('checkmate ends a long game and stops both clocks', () => {
    const mate = mk(TIME_CONTROLS.eternal240, { fen: '3k2/6/3K2/6/6/R5 w - - 0 1' });
    mate.start(0);
    const r = mate.applyMove('a1a6', 90 * MIN, 'T');
    expect(r.ok && r.outcome).toMatchObject({ termination: 'checkmate', result: '1-0' });
    expect(mate.record.clocks!.whiteMs).toBe(240 * MIN - 90 * MIN + 120_000);
    expect(mate.remaining(1, 10 * 3_600_000)).toBe(240 * MIN); // stopped
    expect(mate.tick(10 * 3_600_000, 'T')).toBeNull();
  });
  it('stalemate with clocks: the result is a draw and the clocks stop', () => {
    // find a stalemating move by search (black king a6, white king b4, white queen c3)
    const pos = Position.fromFen('k5/6/1K4/2Q3/6/6 w - - 0 1');
    const moves = pos.legalMoves();
    let stalemating: string | null = null;
    for (const m of moves) { const p = pos.clone(); p.makeMove(m); if (!p.inCheck() && p.legalMoves().length === 0) { stalemating = moveToCcn(m); break; } }
    expect(stalemating).not.toBeNull();
    const s = mk(TIME_CONTROLS.crownmaster120, { fen: 'k5/6/1K4/2Q3/6/6 w - - 0 1' });
    s.start(0);
    const r = s.applyMove(stalemating!, 3_000, 'T');
    expect(r.ok && r.outcome).toMatchObject({ termination: 'stalemate', result: '1/2-1/2' });
    expect(s.remaining(1, 99 * MIN)).toBe(120 * MIN);
  });
  it('formats values above 99 minutes as h:mm:ss and keeps short values as before', () => {
    expect(fmtClock(240 * MIN)).toBe('4:00:00');
    expect(fmtClock(100 * MIN)).toBe('1:40:00');
    expect(fmtClock(99 * MIN + 59_000)).toBe('1:39:59');
    expect(fmtClock(60 * MIN)).toBe('1:00:00');
    expect(fmtClock(60 * MIN - 1)).toBe('59:59');
    expect(fmtClock(5 * MIN)).toBe('5:00');
    expect(fmtClock(19_400)).toBe('0:19.4');
    expect(fmtClock(-5)).toBe('0:00.0');
    expect(fmtClock(Infinity)).toBe('∞');
    expect(fmtClock(12 * 3_600_000 + 5_000)).toBe('12:00:05'); // increments can pile up
    expect(spokenClock(3_909_000)).toBe('1 hour 5 minutes 9 seconds');
    expect(lowTimeThreshold(TIME_CONTROLS.classical60)).toBe(300_000);
    expect(lowTimeThreshold(TIME_CONTROLS.xrapid30)).toBe(180_000);
    expect(lowTimeThreshold(TIME_CONTROLS.rapid)).toBe(30_000);
    expect(lowTimeThreshold(TIME_CONTROLS.blitz)).toBe(20_000);
  });
});

/** A fake page: visibility, lifecycle events, performance.now and an interval timer, all under test control. */
function fakePage() {
  let t = 1_000;
  const doc = { visibilityState: 'visible', l: new Map<string, Set<() => void>>(), addEventListener(k: string, f: () => void) { (this.l.get(k) ?? this.l.set(k, new Set()).get(k)!).add(f); }, removeEventListener(k: string, f: () => void) { this.l.get(k)?.delete(f); }, fire(k: string) { for (const f of [...(this.l.get(k) ?? [])]) f(); } };
  const win = { l: new Map<string, Set<() => void>>(), addEventListener: doc.addEventListener, removeEventListener: doc.removeEventListener, fire: doc.fire };
  const timers: (() => void)[] = [];
  const ticks: (() => void)[] = [];
  return {
    doc, win, real: () => t, ticks,
    /** Real time passes; the match screen's 100 ms ticker reads the clock meanwhile (as the UI does). */
    advance: (ms: number) => { for (let k = 0; k < ms; k += 100) { t += Math.min(100, ms - k); for (const f of ticks) f(); } },
    setInterval: (f: () => void) => { timers.push(f); return timers.length; }, clearInterval: () => { timers.length = 0; },
    beat: () => { for (const f of timers) f(); },
    hide() { this.doc.visibilityState = 'hidden'; this.doc.fire('visibilitychange'); },
    show() { this.doc.visibilityState = 'visible'; this.doc.fire('visibilitychange'); },
  };
}
function keeperFor(s: GameSession, page: ReturnType<typeof fakePage>, saved: GameRecord[], save?: (r: GameRecord) => Promise<void>) {
  const clock = new VisibleClock(page.real);
  page.ticks.push(() => clock.now());
  s.start(clock.now());
  const k = new ClockKeeper({ session: s, clock, save: save ?? (async r => { saved.push(r); }), doc: page.doc, win: page.win, setInterval: page.setInterval, clearInterval: page.clearInterval, nowIso: () => 'T' });
  k.attach();
  return { k, clock };
}

describe('pause on exit and save & resume (ClockKeeper, VisibleClock)', () => {
  it('VisibleClock advances only while live and caps any single gap', () => {
    let t = 0;
    const c = new VisibleClock(() => t);
    t = 1_000; expect(c.now()).toBe(1_000);
    c.suspend(); t = 1_000_000; expect(c.now()).toBe(1_000);
    c.resume(); t += 500; expect(c.now()).toBe(1_500);
    t += 3_600_000; expect(c.now()).toBe(1_500 + MAX_STEP_MS); // a frozen page without an event is not drained
  });
  it('hidden → paused and committed; no drain while away; visible → resumes from the saved time', () => {
    const page = fakePage(), saved: GameRecord[] = [];
    const s = mk();
    const { clock } = keeperFor(s, page, saved);
    page.advance(4_000); clock.now(); page.advance(3_000);
    page.hide();
    expect(s.paused).toBe(true);
    expect(saved.at(-1)!.clocks!.whiteMs).toBe(60 * MIN - 7_000);
    expect(saved.at(-1)!.pauses.at(-1)).toMatchObject({ reason: 'visibility' });
    page.advance(5 * 3_600_000); // five hours in the background
    expect(s.remaining(0, clock.now())).toBe(60 * MIN - 7_000);
    page.show();
    expect(s.paused).toBe(false);
    page.advance(2_000);
    expect(s.remaining(0, clock.now())).toBe(60 * MIN - 9_000);
    expect(saved.at(-1)!.pauses.at(-1)!.resumedAt).toBe('T');
  });
  it('repeated background/foreground cycles never grant time: all visible time is charged', () => {
    const page = fakePage(), saved: GameRecord[] = [];
    const s = mk();
    const { clock } = keeperFor(s, page, saved);
    for (let i = 0; i < 25; i++) { page.advance(1_000); page.hide(); page.advance(60_000); page.show(); }
    page.advance(500);
    expect(s.remaining(0, clock.now())).toBe(60 * MIN - 25_500);
    expect(s.record.pauses).toHaveLength(25);
  });
  it('pagehide and freeze pause and commit too; pageshow/resume restart', () => {
    for (const ev of ['pagehide', 'freeze'] as const) {
      const page = fakePage(), saved: GameRecord[] = [];
      const s = mk();
      const { clock } = keeperFor(s, page, saved);
      page.advance(10_000);
      (ev === 'pagehide' ? page.win : page.doc).fire(ev);
      expect(s.paused).toBe(true);
      expect(saved.at(-1)!.clocks!.whiteMs).toBe(60 * MIN - 10_000);
      expect(saved.at(-1)!.pauses.at(-1)!.reason).toBe(ev);
      page.advance(999_999);
      (ev === 'pagehide' ? page.win : page.doc).fire(ev === 'pagehide' ? 'pageshow' : 'resume');
      page.advance(1_000);
      expect(s.remaining(0, clock.now())).toBe(60 * MIN - 11_000);
    }
  });
  it('leaving the match screen (detach) pauses and saves; the game stops listening', () => {
    const page = fakePage(), saved: GameRecord[] = [];
    const s = mk();
    const { k } = keeperFor(s, page, saved);
    page.advance(8_000);
    k.detach('leave');
    expect(saved.at(-1)).toMatchObject({ status: 'paused', clocks: { whiteMs: 60 * MIN - 8_000 } });
    expect(saved.at(-1)!.pauses.at(-1)!.reason).toBe('leave');
    page.show(); // no longer attached: nothing resumes
    expect(s.paused).toBe(true);
  });
  it('reload during the human turn: the reloaded game is charged up to the last heartbeat, and per-move time stays exact', () => {
    const page = fakePage(), saved: GameRecord[] = [];
    const s = mk();
    const { clock } = keeperFor(s, page, saved);
    page.advance(12_000); page.beat(); // heartbeat at 12 s
    page.advance(3_000);                // 3 s more, then the tab is killed (no event)
    void clock;
    const last = structuredClone(saved.at(-1)!);
    expect(last.clocks!.whiteMs).toBe(60 * MIN - 12_000);
    expect(last.clockTurn).toEqual({ ply: 0, startMs: 60 * MIN });
    // reopen exactly as the match screen does
    const page2 = fakePage(), saved2: GameRecord[] = [];
    const r = new GameSession(last);
    const { clock: c2 } = keeperFor(r, page2, saved2);
    r.pause(c2.now(), 'reload', 'T'); r.resume(c2.now(), 'T');
    expect(r.remaining(0, c2.now())).toBe(60 * MIN - 12_000);
    page2.advance(5_000);
    const mv = r.applyMove('c2c3', c2.now(), 'T');
    expect(mv.ok && mv.record).toMatchObject({ clockBeforeMs: 60 * MIN, elapsedMs: 17_000, clockAfterMs: 60 * MIN - 17_000 + 60_000 });
  });
  it('reload during the engine turn: the engine clock is restored from the heartbeat and the move is committed once', () => {
    const s = mk();
    s.start(0);
    s.applyMove('c2c3', 5_000, 'T');
    s.checkpoint(9_000); // engine thinking for 4 s, heartbeat
    const saved = s.snapshot();
    const r = new GameSession(saved);
    r.start(0);
    expect(r.remaining(1, 0)).toBe(60 * MIN - 4_000);
    // the engine move computed for ply 1 is applied once; a duplicate (or stale) result is refused
    expect(r.applyMove('c5c4', 1_000, 'T', undefined, 1).ok).toBe(true);
    const dup = r.applyMove('c5c4', 1_100, 'T', undefined, 1);
    expect(dup).toMatchObject({ ok: false, error: expect.stringMatching(/Stale/) });
    expect(r.record.moves).toHaveLength(2);
  });
  it('the engine move is deterministic per position (same seed, node-limited level): recomputing after a reload gives the same move', () => {
    const pos = Position.fromFen(mk().record.initialFen);
    pos.makeMove(pos.legalMoves()[3]);
    for (const p of [LEVELS[2], LEVELS[5], BEGINNER_LEVELS[2]]) {
      const a = chooseMove(new Searcher(16), pos.clone(), p, 12345, { remainingMs: 60 * MIN, incrementMs: 60_000 });
      const b = chooseMove(new Searcher(16), pos.clone(), p, 12345, { remainingMs: 59 * MIN, incrementMs: 60_000 });
      expect(moveToCcn(b.move)).toBe(moveToCcn(a.move));
    }
  });
  it('duplicate human move submission is refused by the ply check', () => {
    const s = mk();
    s.start(0);
    expect(s.applyMove('c2c3', 1_000, 'T', undefined, 0).ok).toBe(true);
    expect(s.applyMove('c2c3', 1_001, 'T', undefined, 0).ok).toBe(false);
    expect(s.record.moves).toHaveLength(1);
  });
  it('an interrupted save is reported and retried by the next heartbeat; the game keeps running', async () => {
    const page = fakePage(), saved: GameRecord[] = [];
    const s = mk();
    let fail = true;
    const errors: unknown[] = [];
    const clock = new VisibleClock(page.real);
    page.ticks.push(() => clock.now());
    s.start(clock.now());
    const k = new ClockKeeper({ session: s, clock, save: async r => { if (fail) throw new Error('QuotaExceededError'); saved.push(r); }, onSaveError: e => errors.push(e), doc: page.doc, win: page.win, setInterval: page.setInterval, clearInterval: page.clearInterval });
    k.attach();
    page.advance(5_000); page.beat();
    await Promise.resolve(); await Promise.resolve();
    expect(errors).toHaveLength(1);
    expect(s.paused).toBe(false);
    fail = false;
    page.advance(5_000); page.beat();
    await Promise.resolve();
    expect(saved.at(-1)!.clocks!.whiteMs).toBe(60 * MIN - 10_000);
  });
  it('persists through the real storage layer: hide → reopen from IndexedDB → same remaining time', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const page = fakePage();
    const s = mk();
    await db.saveGame(s.snapshot());
    const writes: Promise<void>[] = [];
    const { clock } = keeperFor(s, page, [], r => { const p = db.saveGame(r); writes.push(p); return p; });
    page.advance(1_000); s.applyMove('c2c3', clock.now(), 'T'); await db.saveGame(s.snapshot());
    page.advance(20_000); page.hide();
    await Promise.all(writes);
    db.close();
    const again = await CrownDB.open(f);
    const g = (await again.getGame('g1'))!;
    expect(g.status).toBe('paused');
    expect(g.clocks).toEqual({ whiteMs: 60 * MIN - 1_000 + 60_000, blackMs: 60 * MIN - 20_000 });
    expect(await again.unfinishedGames()).toHaveLength(1);
  });
});

describe('AI thinking budget stays separate from the clock', () => {
  it('every level is capped by its profile (≤ 10 s rated), longer controls never shorten it, and it never thinks for minutes', () => {
    const profiles = [...LEVELS, ...BEGINNER_LEVELS, maxProfile(MAX_RATED_BUDGET_S), profileForStrength(1000), profileForStrength(2000), profileForStrength(3600)];
    for (const p of profiles) {
      const short = allocateTime(p, { remainingMs: TIME_CONTROLS.rapid.initialMs, incrementMs: TIME_CONTROLS.rapid.incrementMs });
      for (const id of RATED_PRESETS) {
        const tc = TIME_CONTROLS[id];
        const a = allocateTime(p, { remainingMs: tc.initialMs, incrementMs: tc.incrementMs });
        expect(a).toBe(p.maxTimeMs); // the profile cap decides, so a longer clock never weakens the AI
        expect(a).toBeGreaterThanOrEqual(short);
        expect(a).toBeLessThanOrEqual(10_000);
      }
    }
    expect(maxProfile(60).maxTimeMs).toBe(60_000); // the casual-only Unbound+ budget: still one minute at most
  });
});

describe('update policy with long games', () => {
  it('never activates an update while a long game is open (running or paused); allows it once the player has left', () => {
    for (const status of ['active', 'paused', 'terminal', 'unknown'] as const) {
      expect(updateSafety({ route: 'match', matchGameStatus: status, liveArenaGames: 0, featuredInFlight: false, federationBusy: false, readOnly: false }).safe).toBe(false);
    }
    // a paused game left on the Play screen is saved and paused: reloading is harmless
    expect(updateSafety({ route: 'play', matchGameStatus: null, liveArenaGames: 0, featuredInFlight: false, federationBusy: false, readOnly: false }).safe).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------ career pool
const at = (i: number) => new Date(Date.UTC(2026, 5, 1) + i * 60_000).toISOString();
/** A legacy Rapid history (rapid pool) as a v0.9 (start 1500) or v1.0.0-rc.1 (new career, start 0) build left it. */
function rapidHistory(start: number, results: number[]) {
  let s = newPoolState('rapid', start);
  const events: RatingEvent[] = [];
  results.forEach((sc, i) => { const r = computeRatingEvent(s, `old-${i}`, at(i), { id: `o${i}`, name: `Opp ${i}`, rating: start + 100 - (i % 5) * 60, rd: 60, calibrationId: 'c' }, sc); events.push(r.event); s = r.next; });
  return { state: s, events };
}
async function oldSave(f: IDBFactory, shape: 'v0.9' | 'rc1', results: number[]) {
  const db = await CrownDB.open(f);
  const start = shape === 'v0.9' ? 1500 : 0;
  if (shape === 'v0.9') { const tx = db.db.transaction('meta', 'readwrite'); tx.objectStore('meta').delete('career'); await new Promise(r => { tx.oncomplete = r; }); }
  const { state, events } = rapidHistory(start, results);
  await db.importRecords({ games: [], ratingEvents: events, ratingState: [state], reports: [] }, true);
  db.close();
  return { state, events };
}
function finished(id: string, tc: TimeControl, h: { rating: number; rd: number }, legacyRapid = false): GameRecord {
  const rec = createGameRecord({ id, mode: 'rated', timeControl: tc, humanColor: 'white', human: { ...human, ...h }, engine, engineSeed: 1, nowIso: '2026-11-05T00:00:00Z' });
  if (legacyRapid) Object.assign(rec, { rated: true, mode: 'rated', pool: 'rapid' }); // created before v1.1
  const s = new GameSession(rec);
  s.start(0);
  for (const m of ['c2c3', 'c5c4', 'e1f3', 'e6f4']) s.applyMove(m, 1, 'T');
  s.resign(1, 2, '2026-11-05T01:00:00Z');
  return s.snapshot();
}
async function finalize(db: CrownDB, g: GameRecord) {
  await db.saveGame(g).catch(() => { /* already finalized: the retry below is idempotent */ });
  return db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: '2026-11-05T02:00:00Z', analysisSettingsId: 'std-d7', humanScore: 1 });
}

describe('career pool (classical-long) seeded once from Rapid', () => {
  it('a v0.9-shaped save (1500 origin) is seeded on open: rating and σ kept, RD = max(RD, 150), games carried, provenance recorded', async () => {
    const f = new IDBFactory();
    const results = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? 0 : 1));
    const { state, events } = await oldSave(f, 'v0.9', results);
    expect(state.rd).toBeLessThan(150);
    const db = await CrownDB.open(f);
    expect(db.career.origin).toBe('legacy');
    const p = await db.careerRating();
    expect(p).toMatchObject({ pool: CAREER_POOL, rating: state.rating, rd: SEED_MIN_RD, sigma: state.sigma, games: 30, wins: 0, draws: 0, losses: 0, peak: null });
    expect(ownGames(p)).toBe(0);
    expect(p.seed).toMatchObject({ from: 'rapid', source: { rating: state.rating, rd: state.rd, sigma: state.sigma, games: 30, lastEventId: state.lastEventId } });
    expect(await db.getMeta('careerPoolSeed')).toEqual(p.seed);
    // the legacy history is intact and visible
    expect(await db.ratingState('rapid')).toEqual(state);
    expect(await db.ratingEvents('rapid')).toEqual(events);
    expect(careerTimeline(events)).toEqual(events);
    db.close();
    // reopening never re-seeds, even after the Rapid pool changes (a pre-update Rapid game finishing late)
    const again = await CrownDB.open(f);
    const late = finished('late-rapid', TIME_CONTROLS.rapid, { rating: state.rating, rd: state.rd }, true);
    const r = await finalize(again, late);
    expect(r.event!.pool).toBe('rapid'); // an in-progress match keeps its original pool
    again.close();
    const third = await CrownDB.open(f);
    expect(await third.careerRating()).toEqual(p);
    expect(await third.ensureCareerPool()).toBeNull();
  });
  it('a v1.0.0-rc.1-shaped save (new career at 0 with Rapid games) is seeded from its measured Rapid rating', async () => {
    const f = new IDBFactory();
    const { state } = await oldSave(f, 'rc1', [1, 1, 0, 1, 0.5]);
    const db = await CrownDB.open(f);
    expect(db.ratingStart).toBe(0);
    const p = await db.careerRating();
    expect(p.rating).toBe(state.rating);
    expect(p.rd).toBe(Math.max(state.rd, SEED_MIN_RD));
    expect(p.sigma).toBe(state.sigma);
    expect(p.games).toBe(5);
  });
  it('a brand-new career is not seeded: it starts at 0 ±350 in the career pool', async () => {
    const db = await CrownDB.open(new IDBFactory());
    expect(await db.careerRating()).toMatchObject({ pool: CAREER_POOL, rating: 0, rd: 350, sigma: 0.06, games: 0 });
    expect((await db.careerRating()).seed).toBeUndefined();
    expect(await db.getMeta('careerPoolSeed')).toBeUndefined();
  });
  it('seeding is idempotent under concurrent calls (two tabs opening at once)', async () => {
    const f = new IDBFactory();
    await oldSave(f, 'v0.9', [1, 0, 1]);
    const [a, b] = await Promise.all([CrownDB.open(f), CrownDB.open(f)]);
    const results = await Promise.all([a.ensureCareerPool(), b.ensureCareerPool(), a.ensureCareerPool()].map(p => p.catch(() => null)));
    expect(results.filter(Boolean)).toHaveLength(0); // open() already seeded exactly once
    expect((await a.allRatingStates()).filter(s => s.pool === CAREER_POOL)).toHaveLength(1);
  });
  it('the first long game continues from the seed; no duplicate rating updates; Rapid is untouched', async () => {
    const f = new IDBFactory();
    const { state, events } = await oldSave(f, 'v0.9', [1, 1, 1, 0, 1, 1]);
    const db = await CrownDB.open(f);
    const seed = await db.careerRating();
    const g = finished('long-1', TIME_CONTROLS.classical60, { rating: seed.rating, rd: seed.rd });
    expect(g.pool).toBe(CAREER_POOL);
    const r1 = await finalize(db, g);
    const r2 = await finalize(db, g);
    await Promise.all([1, 2, 3].map(() => finalize(db, g).catch(() => null)));
    expect(r1.event!).toMatchObject({ pool: CAREER_POOL, sequence: 7, gamesBefore: 6, before: { rating: state.rating, rd: Math.max(state.rd, SEED_MIN_RD), sigma: state.sigma } });
    expect(r2.alreadyFinalized).toBe(true);
    expect(await db.ratingEvents(CAREER_POOL)).toHaveLength(1);
    const after = await db.careerRating();
    expect(after.games).toBe(7);
    expect(ownGames(after)).toBe(1);
    expect(after.wins).toBe(1);
    expect(after.seed).toEqual(seed.seed);
    expect(await db.ratingState('rapid')).toEqual(state);
    // the career timeline is one continuous line: Rapid 1..6, then the career pool from 7
    const tl = careerTimeline(await db.ratingEvents());
    expect(tl.map(e => e.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(tl.slice(0, 6)).toEqual(events);
    // replaying the career pool from its seed reproduces the state
    expect(replayLedger(CAREER_POOL, await db.ratingEvents(CAREER_POOL), undefined, seededPoolState(state, seed.seed!.at)).rating).toBeCloseTo(after.rating, 9);
  });
  it('backup round trip keeps the seeded pool; a tampered seed is rejected; a pre-v1.1 backup is seeded on restore', async () => {
    const f = new IDBFactory();
    const { state } = await oldSave(f, 'v0.9', [1, 0, 1, 1]);
    const db = await CrownDB.open(f);
    const seed = await db.careerRating();
    await finalize(db, finished('long-b', TIME_CONTROLS.grand90, { rating: seed.rating, rd: seed.rd }));
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, '1.1.0')));
    const fresh = await CrownDB.open(new IDBFactory());
    const r = await importBundle(fresh, bundle);
    expect(r.mode).toBe('restore');
    expect(await fresh.careerRating()).toEqual(await db.careerRating());
    expect(await fresh.ratingState('rapid')).toEqual(state);
    // tampering with the seed breaks validation
    const bad = JSON.parse(JSON.stringify(bundle));
    const cs = bad.payload.ratingState.find((x: PoolState) => x.pool === CAREER_POOL);
    cs.seed.source.rating += 50;
    bad.payloadSha256 = await sha256Hex(JSON.stringify(bad.payload));
    await expect(validateBundle(bad)).rejects.toThrow(ImportError);
    // a backup written before v1.1 (no career pool) is seeded exactly as an upgrade would
    const old = JSON.parse(JSON.stringify(bundle));
    old.payload.ratingState = old.payload.ratingState.filter((x: PoolState) => x.pool !== CAREER_POOL);
    old.payload.ratingEvents = old.payload.ratingEvents.filter((e: RatingEvent) => e.pool !== CAREER_POOL);
    old.payload.games = old.payload.games.filter((g: GameRecord) => g.pool !== CAREER_POOL);
    old.payloadSha256 = await sha256Hex(JSON.stringify(old.payload));
    const fresh2 = await CrownDB.open(new IDBFactory());
    await importBundle(fresh2, old);
    expect(await fresh2.careerRating()).toMatchObject({ rating: state.rating, rd: Math.max(state.rd, SEED_MIN_RD), games: 4, seed: { from: LEGACY_CAREER_POOL } });
  });
});

describe('Federation transition: fixtures keep their clock; new fixture games are Classical 60+60', () => {
  it('a fixture game created before the update is returned unchanged; a new one is 60+60, rated in the career pool; Quick Match follows the chosen control', async () => {
    let c = 0;
    const now = () => new Date(Date.UTC(2026, 10, 5) + (c++) * 1000).toISOString();
    const db = await CrownDB.open(new IDBFactory());
    const fed = new FederationService(db, async () => { const p = await db.careerRating(); return { rating: p.rating, rd: p.rd }; }, now);
    await fed.create(2, 4242);
    const fx = fed.playerFixtures();
    expect(fx.length).toBeGreaterThan(0);
    const g = await fed.playerGameFor(fx[0].id, { rating: 0, rd: 350 });
    expect(g.timeControl).toEqual(TIME_CONTROLS.classical60);
    expect(g).toMatchObject({ rated: true, pool: CAREER_POOL });
    // an in-progress fixture game from before the update (Rapid 5+3, rapid pool) is never changed mid-match
    const legacy: GameRecord = { ...structuredClone(g), timeControl: TIME_CONTROLS.rapid, pool: 'rapid', clocks: { whiteMs: 200_000, blackMs: 250_000 } };
    await db.saveGame(legacy);
    const again = await fed.playerGameFor(fx[0].id, { rating: 0, rd: 350 });
    expect(again.timeControl).toEqual(TIME_CONTROLS.rapid);
    expect(again.pool).toBe('rapid');
    expect(again.clocks).toEqual({ whiteMs: 200_000, blackMs: 250_000 });
    // Quick Match: default 60+60 rated; a shorter control can only be casual
    const opp = [...fed.state!.competitors.values()].find(x => x.id !== PLAYER_ID && x.status === 'active')!;
    const q = await fed.quickMatchGameFor(opp.id, { rated: true, humanColor: 'white', human: { rating: 0, rd: 350 }, nowMs: 1 });
    expect(q).toMatchObject({ rated: true, pool: CAREER_POOL, timeControl: TIME_CONTROLS.classical60 });
    const q2 = await fed.quickMatchGameFor(opp.id, { rated: true, humanColor: 'white', human: { rating: 0, rd: 350 }, nowMs: 2, timeControl: TIME_CONTROLS.blitz });
    expect(q2).toMatchObject({ rated: false, mode: 'casual', pool: null });
    expect(q2.black.rating).toBeNull();
    const q3 = await fed.quickMatchGameFor(opp.id, { rated: true, humanColor: 'black', human: { rating: 0, rd: 350 }, nowMs: 3, timeControl: TIME_CONTROLS.eternal240 });
    expect(q3).toMatchObject({ rated: true, pool: CAREER_POOL });
  }, 120_000);
});

vi.setConfig({ testTimeout: 60_000 });
