/**
 * v0.11 career rating (docs/CAREER_RATING.md): new careers start at 0 (RD 350, σ 0.06, 0 games, provisional) and earn
 * their rating through results only; legacy careers keep their 1500 origin and history; Start New Career backs up
 * first, needs the prepared backup, and restarts the career and its Federation.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { exportBundle, importBundle, validateBundle, ImportError } from '../src/storage/backup';
import { sha256Hex } from '../src/storage/checksum';
import { gameChecksum } from '../src/storage/checksum';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';
import { CAREER_POOL } from '../src/ratings/pools';
import { CENTER, SCALE, expectedScore, isProvisional, updateRating, type Rating } from '../src/ratings/glicko2';
import { computeRatingEvent, newPoolState, replayLedger, type PoolState, type RatingEvent } from '../src/ratings/ledger';
import { CAREER_START, LEGACY_START, careerEloLabel, displayElo, isEstablished, suggestBeginnerBands } from '../src/ratings/career';
import { beginnerRating } from '../src/federation/profiles';
import { BEGINNER_OPPONENTS, playOpponentSnapshot } from '../src/federation/opponents';
import { eligiblePool, QUICK_POOLS } from '../src/federation/quickMatch';
import { prepareNewCareer, startNewCareer } from '../src/app/career';
import { archivedBackup, listArchives } from '../src/storage/archive';
import { FederationService } from '../src/app/federation';
import { DIVISIONS, PLAYER_ID } from '../src/federation/model';
import type { Competitor } from '../src/federation/model';

const L0 = (id: string) => beginnerRating(id)!;
const start: Rating = { rating: 0, rd: 350, sigma: 0.06 };
const opp = (o: { rating: number; rd: number }, score: number) => ({ rating: o.rating, rd: o.rd, score });

let n = 0;
/** A finished rapid game vs a calibrated beginner, from a fresh-career human snapshot. */
function gameVs(beginnerId: string, result: '1-0' | '0-1' | '1/2-1/2', human: { rating: number; rd: number }) {
  const id = `nc-${beginnerId}-${n++}`;
  const o = BEGINNER_OPPONENTS.find(b => b.beginner === beginnerId)!;
  const s = new GameSession(createGameRecord({ id, mode: 'rated', timeControl: TIME_CONTROLS.classical60, humanColor: 'white', human: { kind: 'human', id: 'player', name: 'You', ...human }, engine: playOpponentSnapshot(o), engineSeed: 1, nowIso: '2026-11-04T00:00:00Z' }));
  s.start(0);
  for (const m of ['c2c3', 'c5c4', 'e1f3', 'e6f4']) s.applyMove(m, 1, 'T');
  if (result !== '1/2-1/2') s.resign(result === '1-0' ? 1 : 0, 2, '2026-11-04T00:10:00Z'); // the loser resigns (human = White = 0)
  const g = s.snapshot();
  if (result === '1/2-1/2') { g.status = 'terminal'; g.result = result; g.termination = 'agreement'; g.endedAt = '2026-11-04T00:10:00Z'; }
  return g;
}
const score = (r: string) => (r === '1-0' ? 1 : r === '0-1' ? 0 : 0.5);
async function playRated(db: CrownDB, beginnerId: string, result: '1-0' | '0-1' | '1/2-1/2') {
  const p = await db.ratingState(CAREER_POOL);
  const g = gameVs(beginnerId, result, { rating: p.rating, rd: p.rd });
  await db.saveGame(g);
  return db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: new Date(Date.UTC(2026, 10, 4) + n * 60000).toISOString(), analysisSettingsId: 'std-d7', humanScore: score(result) });
}

describe('Glicko-2 location invariance (why a 0 start is coherent)', () => {
  it('a player at 0 vs 300/450/650 moves exactly like a player at 1500 vs 1800/1950/2150', () => {
    for (const scores of [[1, 0, 0], [0, 0, 0], [1, 1, 0.5], [0.5, 0.5, 0.5]]) {
      const lo = updateRating({ rating: 0, rd: 350, sigma: 0.06 }, [300, 450, 650].map((r, i) => ({ rating: r, rd: 60, score: scores[i] })));
      const hi = updateRating({ rating: 1500, rd: 350, sigma: 0.06 }, [1800, 1950, 2150].map((r, i) => ({ rating: r, rd: 60, score: scores[i] })));
      expect(lo.after.rating + 1500).toBeCloseTo(hi.after.rating, 9);
      expect(lo.after.rd).toBeCloseTo(hi.after.rd, 9);
      expect(lo.after.sigma).toBeCloseTo(hi.after.sigma, 12);
      expect(lo.explanation!.v).toBeCloseTo(hi.explanation!.v, 9);
      expect(lo.explanation!.delta).toBeCloseTo(hi.explanation!.delta, 9);
    }
  });
  it('holds over a whole career: 40 sequential games translated by −1500 give the same history', () => {
    let a: Rating = { rating: 0, rd: 350, sigma: 0.06 }, b: Rating = { rating: 1500, rd: 350, sigma: 0.06 };
    for (let i = 0; i < 40; i++) {
      const o = [71, 302, 446, 664, 900][i % 5], s = [1, 0, 0.5, 1, 0][i % 5];
      a = updateRating(a, [{ rating: o, rd: 50, score: s }]).after;
      b = updateRating(b, [{ rating: o + 1500, rd: 50, score: s }]).after;
      expect(a.rating + 1500).toBeCloseTo(b.rating, 7);
      expect(a.rd).toBeCloseTo(b.rd, 9);
    }
    expect(expectedScore({ rating: 0, rd: 350, sigma: 0.06 }, { rating: 300, rd: 60 })).toBeCloseTo(expectedScore({ rating: 1500, rd: 350, sigma: 0.06 }, { rating: 1800, rd: 60 }), 12);
  });
});

describe('a new career', () => {
  it('starts at exactly 0, RD 350, σ 0.06, 0 rated games, provisional', async () => {
    const db = await CrownDB.open(new IDBFactory());
    expect(db.career.origin).toBe('new');
    expect(db.ratingStart).toBe(CAREER_START);
    for (const pool of ['rapid', 'blitz', 'classical', CAREER_POOL] as const) {
      const p = await db.ratingState(pool);
      expect(p).toMatchObject({ rating: 0, rd: 350, sigma: 0.06, games: 0, wins: 0, draws: 0, losses: 0, peak: null });
      expect(isProvisional(p.games, p.rd)).toBe(true);
      expect(careerEloLabel(p.rating, p.games, p.rd)).toBe('0 · provisional');
    }
    expect(await db.ratingEvents()).toHaveLength(0);
  });

  it('first rated win, draw and loss against the calibrated beginner L0d follow the Glicko-2 formula', async () => {
    const o = L0('L0d'); // 71 ± 56
    // independent one-game Glicko-2 (Glickman 2013 steps 2–7; σ' from the library's root find, which barely moves)
    const mu = (0 - CENTER) / SCALE, phi = 350 / SCALE, muj = (o.rating - CENTER) / SCALE, phij = o.rd / SCALE;
    const g = 1 / Math.sqrt(1 + (3 * phij * phij) / (Math.PI * Math.PI));
    const E = 1 / (1 + Math.exp(-g * (mu - muj)));
    const v = 1 / (g * g * E * (1 - E));
    expect(E).toBeCloseTo(0.4007, 4); // you are expected to score 40% against a 71-rated beginner
    for (const [result, want] of [['1-0', 214.01], ['1/2-1/2', 35.45], ['0-1', -143.11]] as const) {
      const db = await CrownDB.open(new IDBFactory());
      const { event } = await playRated(db, 'L0d', result);
      const s = score(result);
      const sigmaP = event!.after.sigma;
      const phiStar = Math.sqrt(phi * phi + sigmaP * sigmaP);
      const phiP = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
      const muP = mu + phiP * phiP * g * (s - E);
      expect(event!.before).toEqual({ rating: 0, rd: 350, sigma: 0.06 });
      expect(event!.after.rating).toBeCloseTo(muP * SCALE + CENTER, 6);
      expect(event!.after.rd).toBeCloseTo(phiP * SCALE, 6);
      expect(event!.after.rating).toBeCloseTo(want, 1);
      expect(event!.after.rd).toBeCloseTo(251.02, 1);
      expect(event!.expected).toBeCloseTo(E, 9);
      expect(event!.provisionalAfter).toBe(true);
      const st = await db.ratingState(CAREER_POOL);
      expect(st.games).toBe(1);
      expect(displayElo(st.rating)).toBe(Math.max(0, Math.round(want)));
    }
  });

  it('first wins against the other beginners: bigger upsets move more (L0c 302, L0b 446, L0a 664)', () => {
    const after = (id: string, s: number) => updateRating(start, [opp(L0(id), s)]).after.rating;
    expect(after('L0c', 1)).toBeCloseTo(390.56, 1);
    expect(after('L0b', 1)).toBeCloseTo(509.08, 1);
    expect(after('L0a', 1)).toBeCloseTo(628.42, 1);
    expect(after('L0a', 0)).toBeCloseTo(-14.31, 1); // losing to a much stronger beginner costs little
  });

  it('becomes established only after 20 rated games with RD ≤ 100; peak counts from then', () => {
    let s: PoolState = newPoolState(CAREER_POOL, 0);
    const flips: number[] = [];
    for (let i = 0; i < 30; i++) {
      const id = s.rating < 200 ? 'L0d' : s.rating < 380 ? 'L0c' : s.rating < 560 ? 'L0b' : 'L0a';
      const o = L0(id);
      const was = isEstablished(s.games, s.rd);
      s = computeRatingEvent(s, `p${i}`, `2026-11-04T00:${String(i).padStart(2, '0')}:00Z`, { id, name: id, rating: o.rating, rd: o.rd, calibrationId: 'c' }, i % 3 === 2 ? 0 : 1).next;
      if (!was && isEstablished(s.games, s.rd)) flips.push(s.games);
      if (s.games < 20) { expect(isProvisional(s.games, s.rd)).toBe(true); expect(s.peak).toBeNull(); }
    }
    expect(flips).toEqual([20]);
    expect(s.peak).not.toBeNull();
    expect(s.rd).toBeLessThanOrEqual(100);
    expect(s.rating).toBeGreaterThan(400); // 2/3 against the 302–446 beginners: a genuine beginner-band rating
    expect(s.rating).toBeLessThan(700);
  });

  it('repeated losses at 0: the stored rating goes negative (never clamped), the displayed career Elo stays 0', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) { await playRated(db, 'L0d', '0-1'); seen.push((await db.ratingState(CAREER_POOL)).rating); }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1]);
    expect(seen[0]).toBeCloseTo(-143.11, 1);
    expect(seen.at(-1)!).toBeLessThan(-250);
    expect(seen.every(r => displayElo(r) === 0)).toBe(true);
    const ev = await db.ratingEvents(CAREER_POOL);
    expect(replayLedger(CAREER_POOL, ev, 0).rating).toBe(seen.at(-1));
    // a win climbs from the true (negative) value — the floor is display only
    await playRated(db, 'L0d', '1-0');
    const up = (await db.ratingState(CAREER_POOL)).rating;
    expect(up).toBeGreaterThan(seen.at(-1)!);
    expect(ev.at(-1)!.after.rating).toBeLessThan(0);
  });

  it('no participation gains: losses and draws against weaker opponents only lower the rating', () => {
    const run = (from: number, s0: number, n: number) => {
      let s: Rating = { rating: from, rd: 200, sigma: 0.06 };
      const hist = [s.rating];
      for (let i = 0; i < n; i++) { s = updateRating(s, [opp(L0('L0d'), s0)]).after; hist.push(s.rating); }
      return hist;
    };
    const decreasing = (h: number[]) => h.every((r, i) => i === 0 || r < h[i - 1]);
    expect(decreasing(run(0, 0, 10))).toBe(true); // ten losses at 0: down every time, never up for "playing"
    const draws = run(600, 0.5, 10); // draws against a far weaker beginner (71)
    expect(decreasing(draws)).toBe(true);
    expect(draws.at(-1)!).toBeGreaterThan(71); // and it approaches the opponent's level, not below
    // a draw against an equal opponent leaves the rating where it is
    expect(updateRating({ rating: 71, rd: 200, sigma: 0.06 }, [opp({ rating: 71, rd: 56 }, 0.5)]).after.rating).toBeCloseTo(71, 9);
    // casual games never rate: covered by tests/storage.test.ts ('casual games are stored but never rated')
  });

  it('save and reload keep the career origin, rating and history', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const id = db.career.id;
    await playRated(db, 'L0c', '1-0');
    const before = await db.ratingState(CAREER_POOL);
    db.close();
    const again = await CrownDB.open(f);
    expect(again.career.id).toBe(id);
    expect(again.ratingStart).toBe(0);
    expect(await again.ratingState(CAREER_POOL)).toEqual(before);
    expect((await again.ratingState('blitz')).rating).toBe(0);
    expect((await again.ratingEvents(CAREER_POOL))[0].before.rating).toBe(0);
  });
});

describe('display floor and suggestions', () => {
  it('displayElo never shows a negative number', () => {
    expect(displayElo(-143.11)).toBe(0);
    expect(displayElo(-0.4)).toBe(0);
    expect(displayElo(214.5)).toBe(215);
    expect(careerEloLabel(1234.4, 25, 80)).toBe('1,234');
    expect(careerEloLabel(-50, 3, 250)).toBe('0 · provisional');
  });
  it('a provisional new career is pointed at the 0–399 and 400–799 bands', () => {
    expect(suggestBeginnerBands({ rating: 0, rd: 350, games: 0 }, CAREER_START)).toBe(true);
    expect(suggestBeginnerBands({ rating: 1050, rd: 150, games: 8 }, CAREER_START)).toBe(true); // still provisional
    expect(suggestBeginnerBands({ rating: 1050, rd: 90, games: 30 }, CAREER_START)).toBe(false);
    expect(suggestBeginnerBands({ rating: 1500, rd: 350, games: 0 }, LEGACY_START)).toBe(false); // legacy defaults unchanged
    expect(suggestBeginnerBands({ rating: 650, rd: 80, games: 40 }, LEGACY_START)).toBe(true); // under 800
    expect(QUICK_POOLS.map(p => p.id)).toContain('beginner');
    const comps = [100, 450, 799, 800, 1600].map((r, i) => ({ id: `c${i}`, rating: r, status: 'active' }) as Competitor);
    expect(eligiblePool(comps, 'beginner', 0).map(c => c.rating)).toEqual([100, 450, 799]);
  });
});

/** A database as a pre-v0.11 build left it: no `career` record, pools started at 1500. */
async function legacySave(f: IDBFactory) {
  const db = await CrownDB.open(f);
  const tx = db.db.transaction('meta', 'readwrite');
  tx.objectStore('meta').delete('career');
  await new Promise(r => { tx.oncomplete = r; });
  let s = newPoolState('rapid'); // 1500, as v0.9/v0.10 did
  const events: RatingEvent[] = [];
  const games = [];
  for (const [i, sc] of [[0, 1], [1, 0], [2, 0.5]] as const) {
    const g = gameVs('L0a', sc === 1 ? '1-0' : sc === 0 ? '0-1' : '1/2-1/2', { rating: s.rating, rd: s.rd });
    g.status = 'finalized';
    const r = computeRatingEvent(s, g.id, `2026-06-0${i + 1}T00:00:00Z`, { id: 'opp-pip', name: 'Pip', rating: 1700, rd: 60, calibrationId: 'c' }, sc);
    g.ratingEventId = r.event.id; g.checksum = await gameChecksum(g);
    events.push(r.event); games.push(g); s = r.next;
  }
  await db.importRecords({ games, ratingEvents: events, ratingState: [s], reports: [] }, true);
  db.close();
  return { state: s, events };
}

describe('existing careers are never changed', () => {
  it('a v0.9/v0.10 save (no career record, 1500 start) keeps its rating, history and 1500 origin', async () => {
    const f = new IDBFactory();
    const { state, events } = await legacySave(f);
    const db = await CrownDB.open(f);
    expect(db.career.origin).toBe('legacy');
    expect(db.ratingStart).toBe(1500);
    expect(await db.ratingState('rapid')).toEqual(state);
    expect(await db.ratingEvents('rapid')).toEqual(events);
    expect((await db.ratingState('blitz')).rating).toBe(1500); // unplayed pools keep the old start too
    // the decision is stored and stable
    db.close();
    const again = await CrownDB.open(f);
    expect(again.career.origin).toBe('legacy');
    expect(await again.getMeta('career')).toMatchObject({ origin: 'legacy', ratingStart: 1500 });
    // and the next rated game continues from the stored state, not from 0
    const r = await playRated(again, 'L0a', '1-0');
    expect(r.event!.before.rating).toBe(state.rating);
  });
  it('an old database with nothing in it (no games, ratings or Federation) is treated as a new career', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const tx = db.db.transaction('meta', 'readwrite');
    tx.objectStore('meta').delete('career');
    await new Promise(r => { tx.oncomplete = r; });
    db.close();
    const again = await CrownDB.open(f);
    expect(again.career.origin).toBe('new');
    expect((await again.ratingState(CAREER_POOL)).rating).toBe(0);
  });
});

describe('backups carry the career origin', () => {
  it('export → import into an empty profile restores a new career exactly (origin 0, ledger, state)', async () => {
    const a = await CrownDB.open(new IDBFactory());
    await playRated(a, 'L0d', '1-0');
    await playRated(a, 'L0c', '0-1');
    const bundle = await exportBundle(a, 'test');
    expect(bundle.payload.career).toMatchObject({ ratingStart: 0, origin: 'new' });
    const b = await CrownDB.open(new IDBFactory());
    const r = await importBundle(b, JSON.parse(JSON.stringify(bundle)));
    expect(r.mode).toBe('restore');
    expect(b.career.id).toBe(a.career.id);
    expect(await b.ratingState(CAREER_POOL)).toEqual(await a.ratingState(CAREER_POOL));
    expect((await b.ratingState('blitz')).rating).toBe(0);
  });
  it('an older backup (no career record) restores as a 1500-origin career, and its unplayed pools stay at 1500', async () => {
    const f = new IDBFactory();
    const { state } = await legacySave(f);
    const legacy = await CrownDB.open(f);
    const bundle = await exportBundle(legacy, '0.10.0');
    delete bundle.payload.career; // exactly what a v0.10 build wrote
    bundle.payloadSha256 = await sha256Hex(JSON.stringify(bundle.payload));
    const fresh = await CrownDB.open(new IDBFactory());
    expect(fresh.ratingStart).toBe(0);
    await importBundle(fresh, bundle);
    expect(fresh.ratingStart).toBe(1500);
    expect(await fresh.ratingState('rapid')).toEqual(state);
    expect((await fresh.ratingState('blitz')).rating).toBe(1500);
  });
  it('rejects a ledger that does not start at the career origin', async () => {
    const a = await CrownDB.open(new IDBFactory());
    await playRated(a, 'L0d', '1-0');
    const bundle = await exportBundle(a, 'test');
    bundle.payload.career = { ...bundle.payload.career!, ratingStart: 1500 };
    bundle.payloadSha256 = await sha256Hex(JSON.stringify(bundle.payload));
    await expect(validateBundle(bundle)).rejects.toThrow(ImportError);
    bundle.payload.career = { ...bundle.payload.career!, ratingStart: 777 };
    bundle.payloadSha256 = await sha256Hex(JSON.stringify(bundle.payload));
    await expect(validateBundle(bundle)).rejects.toThrow(/career record/);
  });
});

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();

describe('Start New Career', () => {
  it('backs up first, then clears the career and its Federation and starts again at 0; the archive restores the old career', async () => {
    const f = new IDBFactory(), archiveF = new IDBFactory();
    const { state: oldState } = await legacySave(f);
    const db = await CrownDB.open(f);
    const fed = new FederationService(db, async () => { const p = await db.ratingState(CAREER_POOL); return { rating: p.rating, rd: p.rd }; }, now);
    await fed.create(2, 4242);
    expect(fed.state!.world.player.joined).toBe(true);
    await db.put('attempts', { id: 'a1', puzzleId: 'p', at: 'T' });
    await db.setMeta('ach:first-win', { id: 'first-win', at: 'T' });

    // confirmation needs the prepared backup
    await expect(startNewCareer(db, null as never)).rejects.toThrow(/backup/);
    const prepared = await prepareNewCareer(db, 'test', archiveF);
    expect(prepared.archiveId).toMatch(/^archive:/);
    expect(prepared.counts.ratingEvents).toBe(3);
    const oldCareer = db.career.id;
    const rec = await fed.closeForNewCareer(() => startNewCareer(db, prepared));
    expect(rec).toMatchObject({ origin: 'new', ratingStart: 0, previousArchiveId: prepared.archiveId });
    expect(rec.id).not.toBe(oldCareer);
    await expect(fed.create(1, 1)).rejects.toThrow(/new career/); // the old service accepts no more commands

    // everything of the old career is gone from the main database; the new career starts at 0
    expect(await db.allGames()).toHaveLength(0);
    expect(await db.ratingEvents()).toHaveLength(0);
    expect(await db.getAll('attempts')).toHaveLength(0);
    expect(await db.getMeta('ach:first-win')).toBeUndefined();
    expect(await db.loadAll('world')).toHaveLength(0);
    expect(await db.loadAll('competitors')).toHaveLength(0);
    expect(await db.loadAll('journal')).toHaveLength(0);
    expect(await db.metaWithPrefix('schema')).toHaveLength(1);
    db.close();
    const fresh = await CrownDB.open(f);
    expect(fresh.career.id).toBe(rec.id);
    expect(await fresh.ratingState(CAREER_POOL)).toMatchObject({ rating: 0, rd: 350, games: 0 });

    // the Federation restarts with the career: a new world, and the player joins the lowest division
    const fed2 = new FederationService(fresh, async () => { const p = await fresh.ratingState(CAREER_POOL); return { rating: p.rating, rd: p.rd }; }, now);
    await fed2.load();
    expect(fed2.state).toBeNull();
    await fed2.create(5, 99);
    expect(fed2.state!.world.player.division).toBe(DIVISIONS);
    expect(fed2.state!.plan.circuits.find(c => c.members.includes(PLAYER_ID))!.division).toBe(DIVISIONS);

    // the archived backup is intact and restores the old career (1500 origin, rating unchanged) into an empty profile
    const list = await listArchives(archiveF);
    expect(list.map(a => a.id)).toEqual([prepared.archiveId]);
    const text = await archivedBackup(prepared.archiveId!, archiveF);
    expect(text).toBe(prepared.json);
    const restoreTo = await CrownDB.open(new IDBFactory());
    const r = await importBundle(restoreTo, JSON.parse(text!));
    expect(r.mode).toBe('restore');
    expect(restoreTo.ratingStart).toBe(1500);
    expect(await restoreTo.ratingState('rapid')).toEqual(oldState);
    expect((await restoreTo.loadAll('world')).length).toBe(1);
  }, 120_000);
});
