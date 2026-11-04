import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { exportBundle, importBundle } from '../src/storage/backup';
import { gameChecksum } from '../src/storage/checksum';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';
import { displayCareerElo, fmtCareerElo, ratingChange } from '../src/ratings/display';
import { TROPHIES, TROPHY_KINDS, classifyTitle, deriveAwards, newAwards, trophyDef, type LegacyInput, type TrophyAward } from '../src/legacy/trophies';
import { ACCENTS, LegacyError, defaultPrefs, earnedAccents, effective, equip, parsePrefs, type Earned } from '../src/legacy/customise';
import { loadAwards, saveAwards, loadPrefs, savePrefs } from '../src/legacy/store';
import { LegacyService } from '../src/legacy/service';
import { currentRankOf, highestRankOf, rankModuleAvailable, registerRankModule } from '../src/legacy/ranks';
import { TROPHY_ART } from '../src/ui/TrophyArt';
import type { RatingEvent } from '../src/ratings/ledger';
import type { FederationService } from '../src/app/federation';

const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 350 };
const engine = { kind: 'engine' as const, id: 'ai-1', name: 'AI', rating: 1400, rd: 60, engine: { profileId: 'L3', level: 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'cal', style: 'standard' } };
function finishedGame(id: string) {
  const s = new GameSession(createGameRecord({ id, mode: 'rated', timeControl: TIME_CONTROLS.rapid, humanColor: 'white', human, engine, engineSeed: 1, nowIso: '2026-11-03T00:00:00Z' }));
  s.start(0);
  for (const m of ['c2c3', 'c5c4', 'e1f3', 'e6f4']) s.applyMove(m, 1, 'T');
  s.resign(1, 2, `2026-11-03T00:${id.padStart(2, '0').slice(-2)}:00Z`);
  return s.snapshot();
}
async function career(n: number, f = new IDBFactory()) {
  const db = await CrownDB.open(f);
  for (let i = 0; i < n; i++) {
    const g = finishedGame(String(i + 10));
    await db.saveGame(g);
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: `2026-11-03T01:${String(i).padStart(2, '0')}:00Z`, analysisSettingsId: 'std-d7', humanScore: 0 });
  }
  return db;
}
const noFed = { ready: false, state: null } as unknown as FederationService;
const host = (db: CrownDB, readOnly = false) => ({ db, fed: noFed, readOnly, matchActive: false, subscribe: () => () => {} });

/** A recorded career: two seasons, titles of every family, norms, a Knight title and an established rating line. */
function ev(seq: number, rating: number, rd: number, gameId = `g${seq}`): RatingEvent {
  return { id: `rating:${gameId}:rapid`, schemaVersion: 1, model: 'm', policy: 'p', pool: 'rapid', sequence: seq, gameId, at: `2026-01-01T00:00:${String(seq).padStart(2, '0')}Z`,
    opponent: { id: 'o', name: 'Opp', rating: 1500, rd: 60, calibrationId: 'c' }, score: 1, expected: 0.5, before: { rating: rating - 10, rd: rd + 1, sigma: 0.06 }, after: { rating, rd, sigma: 0.06 },
    delta: 10, provisionalBefore: false, provisionalAfter: false, gamesBefore: seq - 1, rankBefore: 'Club', rankAfter: 'Club', explanation: { v: 0, delta: 0, g: 0, tau: 0.5, iterations: 1 } };
}
const INPUT: LegacyInput = {
  titles: [{ season: 1, title: 'Senior Division champion (Aurelia) S1' }, { season: 2, title: 'Federation Open winner S2' }, { season: 2, title: 'Crown Champion S2' }, { season: 2, title: 'Club Weekend winner S2' }],
  history: [{ season: 1, division: 5, rank: 1, points: 20 }, { season: 2, division: 4, rank: 3, points: 15 }],
  currentDivision: 3,
  norms: [{ event: 'Federation Open S2', season: 2, games: 5, score: 4, avgOpp: 1700, tpr: 2050, tier: 'Knight' }],
  fedTitle: 'Knight',
  ratingEvents: [ev(19, 1180, 120), ev(20, 1210, 99), ev(21, 1405, 90)],
  games: [],
  rivalries: [{ opponentId: 'c-7', opponentName: 'Ines Vale', level: 'Nemesis', w: 4, d: 1, l: 1, meetings: 6, lastSeason: 2 }, { opponentId: 'c-8', opponentName: 'Low', level: 'Rival', w: 9, d: 0, l: 0, meetings: 9, lastSeason: 2 }],
  forecastChampionSeasons: [1],
};

describe('career Elo display', () => {
  it('never prints a negative career Elo and rounds to whole points', () => {
    expect(displayCareerElo(-40)).toBe(0);
    expect(displayCareerElo(1427.4)).toBe(1427);
    expect(fmtCareerElo(1427.4, { rd: 45.2 })).toBe('1,427 ±45');
    expect(fmtCareerElo(-3, { provisional: true, compact: true, rd: 350 })).toBe('0 · provisional');
  });
  it('the change line uses displayed values', () => {
    expect(ratingChange(1427.3, 1445.4).text).toBe('Previous 1,427 → New 1,445 (+18)');
    expect(ratingChange(1500, 1488.6).text).toBe('Previous 1,500 → New 1,489 (−11)');
    expect(ratingChange(0, 112).text).toBe('Previous 0 → New 112 (+112)');
    expect(ratingChange(-40, -10).text).toBe('Previous 0 → New 0 (+0)');
  });
});

describe('trophy registry', () => {
  it('has unique ids, a rule for each, and original art for each of the ten kinds', () => {
    expect(new Set(TROPHIES.map(t => t.id)).size).toBe(TROPHIES.length);
    expect(TROPHY_KINDS).toHaveLength(10);
    for (const t of TROPHIES) { expect(t.rule.length).toBeGreaterThan(20); expect(TROPHY_KINDS).toContain(t.kind); }
    for (const k of TROPHY_KINDS) expect(TROPHIES.some(t => t.kind === k), k).toBe(true);
    expect(Object.keys(TROPHY_ART).sort()).toEqual([...TROPHY_KINDS].sort());
    expect(new Set(Object.values(TROPHY_ART)).size).toBe(TROPHY_KINDS.length); // a distinct silhouette per kind
  });
  it('classifies the season engine\'s recorded title strings', () => {
    expect(classifyTitle('Crown Division champion (Aurelia) S3')).toMatchObject({ defId: 'div-champion', tier: 4 });
    expect(classifyTitle('Open Division champion (Aurelia) S3')).toMatchObject({ defId: 'div-champion', tier: 2 });
    expect(classifyTitle('Joint Crown Champion S4')).toMatchObject({ defId: 'crown-champion', tier: 5 });
    expect(classifyTitle('Challenger Open winner S1')).toMatchObject({ defId: 'open-winner', tier: 2 });
    expect(classifyTitle('Club Weekend winner S1')).toMatchObject({ defId: 'regional-cup' });
    expect(classifyTitle('Something else entirely')).toBeNull();
  });
  it('derives every supported trophy from recorded facts, deterministically', () => {
    const a = deriveAwards(INPUT);
    const keys = a.map(x => x.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining([
      'div-champion:s1:senior-division-champion-aurelia', 'open-winner:s2:federation-open-winner', 'crown-champion:s2:crown-champion', 'regional-cup:s2:club-weekend-winner',
      'season-podium:s1', 'season-podium:s2', 'season-promotion:s1', 'season-promotion:s2', 'norm-medal:s2:federation-open-s2', 'fed-title:squire', 'fed-title:knight',
      'rating-milestone:1200', 'rating-milestone:1400', 'rivalry:c-7', 'forecast-champion:s1', 'monument-seasons:1',
    ]));
    // 1180 was provisional (RD 120): established ratings only, so every line up to 1200 is credited to game 20
    expect(a.find(x => x.key === 'rating-milestone:1000')!.replay).toEqual({ gameId: 'g20' });
    expect(keys).not.toContain('rating-milestone:1600');
    expect(keys).not.toContain('rivalry:c-8'); // below Nemesis level
    expect(keys).not.toContain('fed-title:paladin');
    expect(a.find(x => x.key === 'rating-milestone:1200')!.replay).toEqual({ gameId: 'g20' });
    expect(deriveAwards(structuredClone(INPUT))).toEqual(a);
    for (const x of a) expect(trophyDef(x.defId)!.kind).toBe(x.kind);
  });
  it('an empty career has no trophies', () => {
    expect(deriveAwards({ titles: [], history: [], currentDivision: null, norms: [], fedTitle: null, ratingEvents: [], games: [], rivalries: [], forecastChampionSeasons: [] })).toEqual([]);
  });
});

describe('trophy awarding is idempotent', () => {
  it('put-if-absent: re-processing and reloads never duplicate or rewrite', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const derived = deriveAwards(INPUT);
    const first = await saveAwards(db, newAwards(derived, new Map(), 'T1', true));
    expect(first).toHaveLength(derived.length);
    // same facts processed again, even ignoring what is held: nothing new is written, nothing rewritten
    expect(await saveAwards(db, newAwards(derived, new Map(), 'T2', false))).toHaveLength(0);
    db.close();
    const db2 = await CrownDB.open(f);
    const held = await loadAwards(db2);
    expect(held.size).toBe(derived.length);
    expect([...held.values()].every(r => r.at === 'T1' && r.backfill)).toBe(true);
    expect(newAwards(derived, held, 'T3', false)).toHaveLength(0);
  });
  it('the service back-fills an existing save once, then awards new results with a ceremony', async () => {
    const f = new IDBFactory();
    const db = await career(10, f);
    const s = new LegacyService(host(db), () => '2026-11-04T00:00:00Z');
    await s.start(); s.stop();
    expect([...s.awards.keys()]).toEqual(['monument-games:10']);
    expect(s.awards.get('monument-games:10')!.backfill).toBe(true);
    expect(s.awards.get('monument-games:10')!.replay?.gameId).toBe('19');
    expect(s.pending).toHaveLength(0); // back-filled trophies get no ceremony
    // reload: no duplicates, no new back-fill
    const s2 = new LegacyService(host(db));
    await s2.start(); await s2.evaluate(); await s2.evaluate(); s2.stop();
    expect(s2.awards.size).toBe(1);
    expect((await db.metaWithPrefix('trophy:')).length).toBe(1);
    expect(s2.career.pool?.games).toBe(10);
  });
  it('a new result after the back-fill gets one ceremony, acknowledged for good', async () => {
    const f = new IDBFactory();
    const db = await career(10, f);
    const s = new LegacyService(host(db));
    await s.start(); s.stop();
    for (let i = 10; i < 50; i++) {
      const g = finishedGame(String(i + 10));
      await db.saveGame(g);
      await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: `2026-11-03T02:${String(i).padStart(2, '0')}:00Z`, analysisSettingsId: 'std-d7', humanScore: 0 });
    }
    await s.evaluate();
    expect(s.pending.map(p => p.key)).toEqual(['monument-games:50']);
    expect(s.awards.get('monument-games:50')!.backfill).toBe(false);
    await s.acknowledge(['monument-games:50']);
    const s2 = new LegacyService(host(db));
    await s2.start(); s2.stop();
    expect(s2.pending).toHaveLength(0);
    expect(s2.awards.size).toBe(2);
  });
  it('a read-only tab never writes', async () => {
    const db = await career(10);
    const s = new LegacyService(host(db, true));
    await s.start(); s.stop();
    expect((await db.metaWithPrefix('trophy:')).length).toBe(0);
  });
});

describe('customisation constraints', () => {
  const t = (key: string, defId: string, tier: 1 | 2 | 3 | 4 | 5): TrophyAward => ({ key, defId, kind: trophyDef(defId)!.kind, tier, name: key, season: 1, event: '', evidence: '', earnedAt: null });
  const earned: Earned = {
    trophies: [t('season-podium:s1', 'season-podium', 1), t('season-promotion:s1', 'season-promotion', 2)],
    banners: [{ id: 'region:3', name: 'Arms', colors: ['#000', '#fff'], source: 'x' }], insignias: [8, 9], vault: [{ id: 'first-win', name: 'First Win' }], exchangeTitles: [{ id: 'xt-1', name: 'Trader' }],
  };
  it('cannot equip anything unearned', () => {
    const p = defaultPrefs();
    expect(() => equip(p, { field: 'banner', value: 'cosmetic:banner-victor' }, earned)).toThrow(LegacyError);
    expect(() => equip(p, { field: 'featured', value: ['crown-champion:s1:x'] }, earned)).toThrow(LegacyError);
    expect(() => equip(p, { field: 'insignia', value: 20 }, earned)).toThrow(LegacyError);
    expect(() => equip(p, { field: 'accent', value: 'gold' }, earned)).toThrow(LegacyError);
    expect(() => equip(p, { field: 'showcase', value: ['not-mine'] }, earned)).toThrow(LegacyError);
    expect(() => equip(p, { field: 'honour', value: 'xt-oracle' }, earned)).toThrow(LegacyError);
    expect(() => equip(p, { field: 'featured', value: ['a', 'b', 'c', 'd'] }, earned)).toThrow(/at most 3/);
  });
  it('equips earned items, and accents follow their rules', () => {
    let p = defaultPrefs();
    p = equip(p, { field: 'banner', value: 'region:3' }, earned);
    p = equip(p, { field: 'featured', value: ['season-promotion:s1'] }, earned);
    p = equip(p, { field: 'insignia', value: 9 }, earned);
    p = equip(p, { field: 'accent', value: 'emerald' }, earned);
    p = equip(p, { field: 'showcase', value: ['first-win'] }, earned);
    p = equip(p, { field: 'honour', value: 'xt-1' }, earned);
    p = equip(p, { field: 'name', value: '  Lady   Ines  ' }, earned);
    expect(p).toMatchObject({ banner: 'region:3', featured: ['season-promotion:s1'], insignia: 9, accent: 'emerald', showcase: ['first-win'], honour: 'xt-1', name: 'Lady Ines' });
    expect(earnedAccents(earned.trophies)).toEqual(['crimson', 'steel', 'royal-blue', 'emerald']);
    expect(ACCENTS.length).toBe(8);
  });
  it('stored choices that are not (or no longer) earned are never shown', () => {
    const raw = { v: 1, name: 'X'.repeat(80), banner: 'cosmetic:banner-victor', featured: ['season-podium:s1', 'forged', 7], insignia: 30, accent: 'gold', showcase: ['first-win', 'forged'], honour: 'xt-oracle', junk: true };
    const p = parsePrefs(raw);
    expect(p.name).toHaveLength(24);
    const e = effective(p, earned);
    expect(e).toMatchObject({ banner: null, featured: ['season-podium:s1'], insignia: null, accent: 'crimson', showcase: ['first-win'], honour: null });
    expect(parsePrefs('garbage')).toEqual(defaultPrefs());
  });
});

describe('save and backup round trip', () => {
  it('trophies and header customisation are carried in backups; restore keeps them, merge never imports them', async () => {
    const db = await career(10);
    const s = new LegacyService(host(db));
    await s.start(); s.stop();
    await savePrefs(db, { ...defaultPrefs(), name: 'Ines', featured: ['monument-games:10'] });
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, 'test')));
    const keys = bundle.payload.progress.map((e: { key: string }) => e.key).sort();
    expect(keys).toEqual(expect.arrayContaining(['legacy:backfilled', 'legacy:prefs', 'trophy:monument-games:10']));
    const fresh = await CrownDB.open(new IDBFactory());
    expect((await importBundle(fresh, bundle)).mode).toBe('restore');
    expect((await loadAwards(fresh)).get('monument-games:10')?.defId).toBe('monument-games');
    expect(await loadPrefs(fresh)).toMatchObject({ name: 'Ines', featured: ['monument-games:10'] });
    // restored career re-evaluates without duplicating or re-back-filling
    const s2 = new LegacyService(host(fresh));
    await s2.start(); s2.stop();
    expect((await fresh.metaWithPrefix('trophy:')).length).toBe(1);
    expect(s2.shown().featured).toEqual(['monument-games:10']);
    // merging into another career: trophies belong to the career that earned them
    const other = await career(1);
    expect((await importBundle(other, bundle)).mode).toBe('merge');
    expect((await other.metaWithPrefix('trophy:')).length).toBe(0);
    expect(await other.getMeta('legacy:prefs')).toBeUndefined();
  });
  it('the service refuses an unearned change and persists an earned one', async () => {
    const db = await career(10);
    const s = new LegacyService(host(db));
    await s.start(); s.stop();
    await expect(s.change({ field: 'featured', value: ['crown-champion:s1:x'] })).rejects.toThrow(LegacyError);
    await s.change({ field: 'featured', value: ['monument-games:10'] });
    expect((await loadPrefs(db)).featured).toEqual(['monument-games:10']);
  });
});

describe('feudal rank adapter (package P interface)', () => {
  it('falls back to null without a ranks module, and passes a valid module through', () => {
    const had = rankModuleAvailable();
    registerRankModule(null);
    expect(currentRankOf({})).toBeNull();
    registerRankModule({ currentRank: () => ({ gradeId: 'duke-2', rankName: 'Duke', sublevel: 'II', label: '', insignia: null }), highestRank: () => ({ gradeId: 'duke-1', rankName: 'Duke', sublevel: 'I', label: 'Duke I', insignia: null, season: 4 }) });
    expect(currentRankOf({})).toMatchObject({ label: 'Duke II', sublevel: 'II' });
    expect(highestRankOf({})).toMatchObject({ label: 'Duke I', season: 4 });
    expect(currentRankOf(null)).toBeNull();
    registerRankModule({ currentRank: () => { throw new Error('x'); }, highestRank: () => ({ gradeId: 'x', rankName: 'X', sublevel: 'IV' as never, label: 'X', insignia: null }) });
    expect(currentRankOf({})).toBeNull();
    expect(highestRankOf({})).toBeNull();
    registerRankModule(null);
    void had;
  });
});
