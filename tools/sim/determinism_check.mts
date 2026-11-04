/**
 * Byte-identity check for behaviour-preserving optimisations (docs/FEDERATION_SCALE.md): runs a seeded federation for
 * N rounds (forfeits, stubbed featured games with seeded results, a player trade per round) and prints the SHA-256 of
 * the complete federation dump. Run the same command on the old and the new code: the hashes must be equal.
 *   npx tsx tools/sim/determinism_check.mts [rounds=40] [seed=4242] [regions=16]
 * With regions = 16 (the default) it works on code that predates topologies (create(region, seed) only); any other
 * value founds a world of that many regions (topologyWithRegions, v0.9+).
 * Prints two hashes. `sha256` is over the stored records exactly as dumped. `canonical` is over the federation as the
 * app reads it (v0.10 compact persistence decoded: competitor and account chunks expanded, packed round results
 * unpacked; src/federation/persist.ts) with object keys sorted. Compare `canonical` across a change of storage format,
 * `sha256` otherwise.
 */
import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { CrownDB } from '../../src/storage/db.ts';
import { FederationService } from '../../src/app/federation.ts';
import { hashSeed } from '../../src/federation/generator.ts';

const ROUNDS = +(process.argv[2] ?? 40), SEED = +(process.argv[3] ?? 4242), REGIONS = +(process.argv[4] ?? 16);
const db = await CrownDB.open(new IDBFactory());
let c = 0; const now = () => new Date(Date.UTC(2026, 0, 1) + (c++) * 1000).toISOString();
const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
svc.runSelfplay = async req => {
  const h = hashSeed(req.seed, 'stub') % 3;
  return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: h === 2 ? 'threefold-claim' : 'checkmate' };
};
if (REGIONS === 16) await svc.create(3, SEED);
else { const { topologyWithRegions } = await import('../../src/federation/model.ts'); await svc.create(3, SEED, topologyWithRegions(REGIONS)); }
const t0 = performance.now();
for (let r = 0; r < ROUNDS; r++) {
  const mk = svc.featuredFixtures().map(f => svc.marketFor(f.id)).find(m => m && m.status === 'open');
  if (mk) { try { await svc.trade(mk.id, r % 3, 2, 'buy'); } catch { /* insufficient funds etc. are part of the run */ } }
  for (const f of svc.playerFixtures()) await svc.forfeit(f.id);
  await svc.advanceRound();
}
const ms = performance.now() - t0;
const d = await db.dump();
const json = JSON.stringify(d.federation);
// canonical form: decode the compact persistence when this code has it (older code stores plain records)
let fed = { ...d.federation } as Record<string, unknown[]>;
try {
  const p = await import('../../src/federation/persist.ts');
  fed = p.decodeFederationStores(fed);
} catch (e) { if (!String(e).includes('Cannot find module') && !String(e).includes('ERR_MODULE_NOT_FOUND')) throw e; }
const sortKeys = (v: unknown): unknown => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys((v as Record<string, unknown>)[k])])) : v);
const canonical = JSON.stringify(sortKeys(fed));
console.log(JSON.stringify({ regions: REGIONS, rounds: ROUNDS, seed: SEED, season: svc.state!.world.season, round: svc.state!.world.round, bytes: json.length, sha256: createHash('sha256').update(json).digest('hex'), canonical: createHash('sha256').update(canonical).digest('hex'), ms: Math.round(ms) }));
process.exit(0);
