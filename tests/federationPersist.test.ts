/**
 * v0.10 federation at scale (docs/FEDERATION_SCALE.md §0.2): compact persistence (competitor and account chunks,
 * packed round results) is lossless, reads v0.9 saves unchanged and replaces their records on the next write; the
 * exact fast paths of the season-market models and the record copy give the same values as the reference code.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB, FEDERATION_STORES } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { exportBundle, importBundle } from '../src/storage/backup';
import { sha256Hex } from '../src/storage/checksum';
import {
  ACCT_CHUNK_PREFIX, COMP_CHUNK_PREFIX, accountWrites, competitorWrites, decodeAccounts, decodeCompetitors, decodeFederationStores, decodeRound, encodeRound,
} from '../src/federation/persist';
import { copyData } from '../src/federation/copy';
import { generateFederation, hashSeed } from '../src/federation/generator';
import { leagueModel, qualificationModel } from '../src/exchange/families';
import { leagueOrder, roundRobin, standings, type StandingRow } from '../src/federation/formats';
import { wdl, NU } from '../src/federation/resultModel';
import { mulberry32 } from '../src/rules/tables';
import type { RoundRecord } from '../src/federation/world';
import type { Competitor } from '../src/federation/model';

const sortKeys = (v: unknown): unknown => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys((v as Record<string, unknown>)[k])])) : v);
/**
 * Names the differing records of two federations (store → ids), or '' when equal. Journal lines are compared as a
 * set: after a reload the positions map iterates in key order rather than creation order, so a settlement lists the
 * same holders' lines in another order (unchanged since v0.3; the amounts are identical).
 */
async function diff(x: CrownDB, y: CrownDB): Promise<string> {
  const a = decodeFederationStores((await x.dump()).federation), b = decodeFederationStores((await y.dump()).federation);
  const out: string[] = [];
  const key = (r: unknown) => { const o = r as Record<string, unknown>; return String(o.id ?? o.key ?? o.account); };
  const norm = (k: string, r: unknown) => {
    if (k !== 'journal') return JSON.stringify(sortKeys(r));
    const j = r as { lines: { account: string; amount: number }[] };
    return JSON.stringify(sortKeys({ ...j, lines: [...j.lines].sort((p, q) => (p.account < q.account ? -1 : p.account > q.account ? 1 : p.amount - q.amount)) }));
  };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const A = new Map((a[k] ?? []).map(r => [key(r), norm(k, r)])), B = new Map((b[k] ?? []).map(r => [key(r), norm(k, r)]));
    const ids = [...new Set([...A.keys(), ...B.keys()])].filter(id => A.get(id) !== B.get(id));
    if (ids.length) out.push(`${k}: ${ids.length} [${ids.slice(0, 3).map(id => `${id} ${(A.get(id) ?? '-').slice(0, 300)} VS ${(B.get(id) ?? '-').slice(0, 300)}`).join(' | ')}]`);
  }
  return out.join('\n');
}

function makeSvc(f = new IDBFactory(), start = 0) {
  let clock = start;
  const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
  return CrownDB.open(f).then(db => {
    const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
    svc.runSelfplay = async req => {
      const h = hashSeed(req.seed, 'stub') % 3;
      return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: 'checkmate' };
    };
    return { svc, db, f, tick: () => clock };
  });
}
async function round(svc: FederationService) {
  for (const f of svc.playerFixtures()) await svc.forfeit(f.id);
  await svc.advanceRound();
}

describe('compact persistence codecs', () => {
  it('round records: packed tier-3 results decode to the identical record; unpackable data is stored as it is', () => {
    const r = mulberry32(7);
    const abstract: RoundRecord['abstract'] = Array.from({ length: 3000 }, (_, i) => [`league:${i % 80}:${1 + (i % 8)}`, `c${String(r() % 12000).padStart(4, '0')}`, `c${String(r() % 12000).padStart(4, '0')}`, [1, 0.5, 0, null][r() % 4]]);
    const rec: RoundRecord = { id: '3:7', season: 3, round: 7, status: 'done', fixtures: [{ id: 'x', season: 3, round: 7, event: 'swiss', white: 'player', black: 'c0001', result: 1, tier: 1, gameId: 'g' }], abstract, processedAt: 'T' };
    const enc = encodeRound(rec);
    expect(enc.abstract).toEqual([]);
    expect(enc.packed!.n).toBe(3000);
    expect(JSON.stringify(enc).length).toBeLessThan(JSON.stringify(rec).length * 0.6);
    const dec = decodeRound(JSON.parse(JSON.stringify(enc)));
    expect(JSON.stringify(dec)).toBe(JSON.stringify(rec)); // same keys in the same order
    expect(encodeRound(decodeRound(enc))).toEqual(enc);
    // an old (unpacked) record and an empty one are returned unchanged
    expect(decodeRound(rec)).toBe(rec);
    const empty = { ...rec, abstract: [] };
    expect(encodeRound(empty)).toBe(empty);
    // a result that is not 1 / ½ / 0 / null, or an id with the separator, is never packed
    const odd = { ...rec, abstract: [['e', 'a', 'b', 0.25]] as RoundRecord['abstract'] };
    expect(encodeRound(odd)).toBe(odd);
    const comma = { ...rec, abstract: [['e', 'a,b', 'c', 1]] as RoundRecord['abstract'] };
    expect(encodeRound(comma)).toBe(comma);
    // damaged packed data is rejected, not misread
    expect(() => decodeRound({ ...enc, packed: { ...enc.packed!, r: enc.packed!.r.slice(1) } })).toThrow(/damaged/);
    expect(() => decodeRound({ ...enc, packed: { ...enc.packed!, r: 'x' + enc.packed!.r.slice(1) } })).toThrow(/damaged/);
  });

  it('competitors: chunks hold every record once; only changed chunks are rewritten; legacy records are deleted with their chunk', () => {
    const comps = generateFederation(5);
    const next = new Map(comps.map(c => [c.id, c]));
    const all = competitorWrites(next, null, new Set());
    expect(all.put).toHaveLength(4); // 2,048 / 512
    expect(all.put.every(ch => ch.id.startsWith(COMP_CHUNK_PREFIX) && ch.records.length === 512)).toBe(true);
    expect(decodeCompetitors(all.put).competitors).toEqual([...comps].sort((a, b) => (a.id < b.id ? -1 : 1)));
    // unchanged copies → nothing to write; one changed record → exactly its chunk
    const copy = new Map([...next].map(([k, v]) => [k, copyData(v)]));
    expect(competitorWrites(copy, next, new Set()).put).toHaveLength(0);
    copy.get('c1500')!.milestones.push({ season: 1, round: 2, text: 'x' });
    const one = competitorWrites(copy, next, new Set());
    expect(one.put.map(c => c.id)).toEqual([`${COMP_CHUNK_PREFIX}0002`]);
    // a new entrant writes its chunk
    const entrant: Competitor = { ...copyData(comps[0]), id: 'c2048' };
    const withNew = new Map(next); withNew.set(entrant.id, entrant);
    expect(competitorWrites(withNew, next, new Set()).put.map(c => c.id)).toEqual([`${COMP_CHUNK_PREFIX}0004`]);
    // legacy individual records: their chunks are written and the individual records deleted
    const legacy = new Set(['c0003', 'c1600']);
    const w = competitorWrites(next, next, legacy);
    expect(w.put.map(c => c.id)).toEqual([`${COMP_CHUNK_PREFIX}0000`, `${COMP_CHUNK_PREFIX}0003`]);
    expect(w.del.sort()).toEqual(['c0003', 'c1600']);
    // a store with both forms: the chunk wins
    const stale = { ...copyData(comps[3]), rating: 1 };
    const dec = decodeCompetitors([stale, ...all.put]);
    expect(dec.competitors.find(c => c.id === 'c0003')!.rating).toBe(comps[3].rating);
    expect(dec.legacyIds).toEqual(['c0003']);
  });

  it('accounts: competitor accounts in chunks, other accounts individual; decoding is exact', () => {
    const balances = new Map<string, number>([['treasury', 5], ['player:cash', 7], ...Array.from({ length: 1200 }, (_, i) => [`comp:c${String(i).padStart(4, '0')}`, i * 3] as [string, number])]);
    const w = accountWrites(['treasury', 'comp:c0007', 'comp:c1100'], balances, new Set(['comp:c0001', 'comp:c0600']));
    const chunks = w.put.filter(x => (x as { account: string }).account.startsWith(ACCT_CHUNK_PREFIX)) as { account: string; accounts: string[] }[];
    expect(chunks.map(c => c.account)).toEqual([`${ACCT_CHUNK_PREFIX}0000`, `${ACCT_CHUNK_PREFIX}0002`]);
    expect(chunks[0].accounts).toHaveLength(512);
    expect(w.put).toContainEqual({ account: 'treasury', balance: 5 });
    expect(w.del).toEqual(['comp:c0001']); // c0600 is in chunk 0001, which was not rewritten
    const full = accountWrites([...balances.keys()], balances, new Set());
    const dec = decodeAccounts(full.put);
    expect(dec.accounts).toEqual([...balances].map(([account, balance]) => ({ account, balance })).sort((a, b) => (a.account < b.account ? -1 : 1)));
    expect(() => decodeAccounts([{ account: `${ACCT_CHUNK_PREFIX}0000`, kind: 'accounts', v: 1, accounts: ['comp:c0000'], balances: [] }])).toThrow(/damaged/);
  });
});

describe('compact persistence in the federation service', () => {
  it('a world reloaded after every round ends in the same state as one that never reloads, and stores far fewer records', async () => {
    const a = await makeSvc();
    await a.svc.create(4, 99);
    const b = await makeSvc();
    await b.svc.create(4, 99);
    for (let r = 0; r < 21; r++) { // across a season end
      await round(a.svc);
      const fresh = new FederationService(b.db, async () => ({ rating: 1500, rd: 200 }), b.svc.now);
      fresh.runSelfplay = b.svc.runSelfplay;
      await fresh.load();
      b.svc = fresh;
      await round(b.svc);
    }
    expect(await diff(b.db, a.db)).toBe('');
    const raw = (await a.db.dump()).federation;
    expect(raw.competitors.map(c => (c as { id: string }).id)).toEqual(['~c:0000', '~c:0001', '~c:0002', '~c:0003', '~c:0004']); // ~2,100 competitors in chunks of 512
    expect((raw.accounts as { account: string }[]).filter(x => x.account.startsWith('comp:'))).toHaveLength(0);
    expect((raw.rounds as { abstract: unknown[]; packed?: unknown }[]).every(r => !r.abstract.length)).toBe(true);
  }, 120_000);

  it('a v0.9 save (individual records) loads unchanged, continues identically, and its records are replaced by chunks when written', async () => {
    const a = await makeSvc();
    await a.svc.create(2, 1234);
    for (let r = 0; r < 3; r++) await round(a.svc);
    // write the same federation as v0.9 stored it: every competitor and account individually, rounds unpacked
    const legacy = decodeFederationStores((await a.db.dump()).federation);
    const f2 = new IDBFactory();
    const db2 = await CrownDB.open(f2);
    await db2.commit(FEDERATION_STORES.map(store => ({ store, put: legacy[store] ?? [] })));
    const before = (await db2.dump()).federation;
    expect(before.competitors.length).toBeGreaterThan(2000);
    const b = await makeSvc(f2, a.tick());
    await b.svc.load();
    expect(JSON.stringify(sortKeys([...b.svc.state!.competitors.values()]))).toBe(JSON.stringify(sortKeys([...a.svc.state!.competitors.values()])));
    // a command that does not change competitors leaves the old records as they are
    await b.svc.setFavorites(['c0001']); await a.svc.setFavorites(['c0001']);
    expect((await db2.dump()).federation.competitors.length).toBe(before.competitors.length);
    for (let r = 0; r < 18; r++) { await round(a.svc); await round(b.svc); } // through the season end
    expect(await diff(db2, a.db)).toBe('');
    const after = (await db2.dump()).federation;
    expect(after.competitors.every(c => (c as { id: string }).id.startsWith(COMP_CHUNK_PREFIX))).toBe(true);
    expect((after.accounts as { account: string }[]).filter(x => x.account.startsWith('comp:'))).toHaveLength(0);
  }, 180_000);

  it('backups carry the chunks; a tampered competitor account in a chunk is rejected', async () => {
    const a = await makeSvc();
    await a.svc.create(7, 31);
    for (let r = 0; r < 15; r++) await round(a.svc); // league prizes credit competitor accounts
    const bundle = JSON.parse(JSON.stringify(await exportBundle(a.db, 'test')));
    const c = await makeSvc(new IDBFactory());
    await importBundle(c.db, bundle);
    await c.svc.load();
    expect([...c.svc.state!.balances].sort().join()).toBe([...a.svc.state!.balances].sort().join());
    expect(await diff(c.db, a.db)).toBe('');
    const bad = structuredClone(bundle);
    const ch = (bad.payload.federation.accounts as { account: string; balances?: number[] }[]).find(x => x.account.startsWith(ACCT_CHUNK_PREFIX) && x.balances!.some(v => v > 0))!;
    ch.balances![ch.balances!.findIndex(v => v > 0)] += 1;
    bad.payloadSha256 = await sha256Hex(JSON.stringify(bad.payload));
    const d = await makeSvc(new IDBFactory());
    await expect(importBundle(d.db, bad)).rejects.toThrow(/does not match/);
  }, 120_000);
});

// ------------------------------------------------------------------ exact fast paths of the market models
type G = { white: string; black: string; result: number | null };
const drawRef = (ra: number, rb: number, u: number) => { const p = wdl(ra, rb, NU); return u < p.w ? 1 : u < p.w + p.d ? 0.5 : 0; };
/** The v0.9 qualification model, kept as the reference. */
function qualificationReference(target: string, circuits: { members: string[]; played: G[] }[], fromRound: number, lastRound: number, rating: (id: string) => number, N: number, seed: number): number {
  const rnd = mulberry32(seed);
  let hit = 0;
  const rrs = circuits.map(c => roundRobin(c.members));
  const idx = circuits.map(c => new Map(c.members.map((m, i) => [m, i])));
  const base = circuits.map((c, ci) => { const a = new Float64Array(c.members.length); for (const g of c.played) if (g.result !== null) { const wi = idx[ci].get(g.white), bi = idx[ci].get(g.black); if (wi !== undefined) a[wi] += g.result; if (bi !== undefined) a[bi] += 1 - g.result; } return a; });
  const ratings = circuits.map(c => c.members.map(m => rating(m)));
  for (let k = 0; k < N; k++) {
    const winners: StandingRow[] = [];
    circuits.forEach((c, ci) => {
      const pts = base[ci].slice();
      const extra: G[] = [];
      for (let r = fromRound; r <= lastRound; r++) for (const [w, b] of rrs[ci][(r - 1) % rrs[ci].length] ?? []) {
        const wi = idx[ci].get(w)!, bi = idx[ci].get(b)!;
        const res = drawRef(ratings[ci][wi], ratings[ci][bi], rnd() / 4294967296);
        pts[wi] += res; pts[bi] += 1 - res;
        extra.push({ white: w, black: b, result: res });
      }
      let max = -1, n = 0, at = -1;
      for (let i = 0; i < pts.length; i++) { if (pts[i] > max + 1e-9) { max = pts[i]; n = 1; at = i; } else if (Math.abs(pts[i] - max) <= 1e-9) n++; }
      if (n === 1) { winners.push({ id: c.members[at], points: max } as StandingRow); return; }
      const games = c.played.concat(extra);
      winners.push(leagueOrder(standings(c.members, games, new Map(c.members.map((m, i) => [m, i + 1]))), games)[0]);
    });
    const top8 = winners.sort((a, b) => b.points - a.points || rating(b.id) - rating(a.id) || a.id.localeCompare(b.id)).slice(0, 8).map(r => r.id);
    if (top8.includes(target)) hit++;
  }
  return hit / N;
}
/** The v0.9 league model, kept as the reference. */
function leagueReference(members: string[], played: G[], fromRound: number, lastRound: number, rating: (id: string) => number, N: number, seed: number) {
  const rr = roundRobin(members);
  const rnd = mulberry32(seed);
  const title = new Map(members.map(m => [m, 0])), top2 = new Map(members.map(m => [m, 0]));
  const seeds = new Map(members.map((m, i) => [m, i + 1]));
  const ix = new Map(members.map((m, i) => [m, i]));
  const rt = members.map(m => rating(m));
  const base = new Float64Array(members.length);
  for (const g of played) if (g.result !== null) { const wi = ix.get(g.white), bi = ix.get(g.black); if (wi !== undefined) base[wi] += g.result; if (bi !== undefined) base[bi] += 1 - g.result; }
  for (let k = 0; k < N; k++) {
    const pts = base.slice();
    const extra: G[] = [];
    for (let r = fromRound; r <= lastRound; r++) for (const [w, b] of rr[(r - 1) % rr.length] ?? []) {
      const wi = ix.get(w)!, bi = ix.get(b)!;
      const res = drawRef(rt[wi], rt[bi], rnd() / 4294967296);
      pts[wi] += res; pts[bi] += 1 - res;
      extra.push({ white: w, black: b, result: res });
    }
    let a = -1, b2 = -1;
    for (let i = 0; i < pts.length; i++) { if (a < 0 || pts[i] > pts[a]) { b2 = a; a = i; } else if (b2 < 0 || pts[i] > pts[b2]) b2 = i; }
    let unique = true;
    for (let i = 0; i < pts.length; i++) if (i !== a && i !== b2 && Math.abs(pts[i] - pts[b2]) <= 1e-9) unique = false;
    if (Math.abs(pts[a] - pts[b2]) <= 1e-9) unique = false;
    let first: string, second: string;
    if (unique) { first = members[a]; second = members[b2]; }
    else { const games = played.concat(extra); const order = leagueOrder(standings(members, games, seeds), games); first = order[0].id; second = order[1].id; }
    title.set(first, title.get(first)! + 1 / N);
    top2.set(first, top2.get(first)! + 1 / N); top2.set(second, top2.get(second)! + 1 / N);
  }
  return { title, top2 };
}

describe('season-market models: exact fast paths', () => {
  it('the qualification model equals the reference on random worlds with many points ties (including the shortcut cases)', () => {
    const r = mulberry32(2026);
    let shortcutTies = 0;
    for (let t = 0; t < 40; t++) {
      const regions = [2, 5, 9, 16, 24][t % 5];
      const circuits = Array.from({ length: regions }, (_, ci) => ({ members: Array.from({ length: 16 }, (_, i) => `c${String(ci * 16 + i).padStart(4, '0')}`), played: [] as G[] }));
      // coarse ratings (many exact ties) so the rating and id tiebreaks between winners are exercised
      const rt = new Map(circuits.flatMap(c => c.members).map(m => [m, 1500 + 50 * (r() % 5)]));
      const rating = (id: string) => rt.get(id) ?? 1500;
      const from = 1 + (r() % 15);
      for (const c of circuits) {
        const rr = roundRobin(c.members);
        for (let k = 1; k < from; k++) for (const [w, b] of rr[k - 1]) c.played.push({ white: w, black: b, result: [1, 0.5, 0][r() % 3] });
      }
      const target = circuits[r() % regions].members[r() % 16];
      const seed = r();
      const fast = qualificationModel(target, circuits, from, 15, rating, 60, seed);
      const ref = qualificationReference(target, circuits, from, 15, rating, 60, seed);
      expect(fast).toBe(ref);
      if (from > 10) shortcutTies++;
    }
    expect(shortcutTies).toBeGreaterThan(5);
    expect(qualificationModel('nobody', [{ members: ['a', 'b'], played: [] }], 1, 15, () => 1500, 10, 1)).toBe(0);
  });

  it('the league model equals the reference', () => {
    const r = mulberry32(99);
    for (let t = 0; t < 30; t++) {
      const members = Array.from({ length: 16 }, (_, i) => `c${String(i).padStart(4, '0')}`);
      const rt = new Map(members.map(m => [m, 1200 + 40 * (r() % 6)]));
      const from = 1 + (r() % 15), played: G[] = [];
      const rr = roundRobin(members);
      for (let k = 1; k < from; k++) for (const [w, b] of rr[k - 1]) played.push({ white: w, black: b, result: [1, 0.5, 0][r() % 3] });
      const seed = r();
      const fast = leagueModel(members, played, from, 15, id => rt.get(id)!, 120, seed);
      const ref = leagueReference(members, played, from, 15, id => rt.get(id)!, 120, seed);
      expect([...fast.title]).toEqual([...ref.title]);
      expect([...fast.top2]).toEqual([...ref.top2]);
    }
  });

  it('copyData gives the same records as structuredClone and refuses non-plain data', () => {
    const comps = generateFederation(3).slice(0, 50).map(c => ({ ...c, balanceSeen: undefined, milestones: [{ season: 1, round: 2, text: 'x' }], fedTitle: null }));
    for (const c of comps) {
      const a = copyData(c), b = structuredClone(c);
      expect(a).toEqual(b);
      expect(Object.keys(a)).toEqual(Object.keys(b));
      expect(a).not.toBe(c);
      expect(a.milestones).not.toBe(c.milestones);
    }
    expect(() => copyData(new Map())).toThrow(/plain data/);
  });
});
