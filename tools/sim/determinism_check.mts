/**
 * Byte-identity check for behaviour-preserving optimisations (docs/FEDERATION_SCALE.md): runs a seeded federation for
 * N rounds (forfeits, stubbed featured games with seeded results, a player trade per round) and prints the SHA-256 of
 * the complete federation dump. Run the same command on the old and the new code: the hashes must be equal.
 *   npx tsx tools/sim/determinism_check.mts [rounds=40] [seed=4242]
 * Works on code that predates topologies (create(region, seed) only).
 */
import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { CrownDB } from '../../src/storage/db.ts';
import { FederationService } from '../../src/app/federation.ts';
import { hashSeed } from '../../src/federation/generator.ts';

const ROUNDS = +(process.argv[2] ?? 40), SEED = +(process.argv[3] ?? 4242);
const db = await CrownDB.open(new IDBFactory());
let c = 0; const now = () => new Date(Date.UTC(2026, 0, 1) + (c++) * 1000).toISOString();
const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
svc.runSelfplay = async req => {
  const h = hashSeed(req.seed, 'stub') % 3;
  return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: h === 2 ? 'threefold-claim' : 'checkmate' };
};
await svc.create(3, SEED);
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
console.log(JSON.stringify({ rounds: ROUNDS, seed: SEED, season: svc.state!.world.season, round: svc.state!.world.round, bytes: json.length, sha256: createHash('sha256').update(json).digest('hex'), ms: Math.round(ms) }));
process.exit(0);
