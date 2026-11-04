/**
 * Federation scale probe (docs/FEDERATION_SCALE.md): create time, per-round advance time, season time, stored size and
 * JS heap for a federation of `regions` × 8 divisions × 16 competitors, on fake-indexeddb (in-memory IndexedDB).
 *   node --expose-gc --import tsx tools/sim/scale_probe.mts [regions=16] [rounds=19] [seed=4242]
 * Prints one JSON line. Featured games are stubbed (no engine): this measures the world simulation and persistence.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { CrownDB } from '../../src/storage/db.ts';
import { FederationService } from '../../src/app/federation.ts';
import { topologyWithRegions, populationOf } from '../../src/federation/model.ts';

const REGIONS = +(process.argv[2] ?? 16), ROUNDS = +(process.argv[3] ?? 19), SEED = +(process.argv[4] ?? 4242);
const gc = (globalThis as { gc?: () => void }).gc;
const heapMB = () => { gc?.(); gc?.(); return +(process.memoryUsage().heapUsed / 1048576).toFixed(1); };
const topo = topologyWithRegions(REGIONS);
const heap0 = heapMB();
const db = await CrownDB.open(new IDBFactory());
let c = 0; const now = () => new Date(Date.UTC(2026, 0, 1) + (c++) * 1000).toISOString();
const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
svc.runSelfplay = async () => ({ moves: [], result: '1/2-1/2', termination: 'simulated' });
let t = performance.now(); await svc.create(3, SEED, topo); const createMs = performance.now() - t;
const heapAfterCreate = heapMB();
const roundMs: number[] = [];
const tSeason = performance.now();
for (let r = 0; r < ROUNDS; r++) {
  for (const f of svc.playerFixtures()) await svc.forfeit(f.id);
  t = performance.now(); await svc.advanceRound(); roundMs.push(performance.now() - t);
}
const seasonMs = performance.now() - tSeason;
const heapAfter = heapMB();
const d = await db.dump();
const fed = d.federation as Record<string, unknown[]>;
const sizes = Object.fromEntries(Object.entries(fed).map(([k, v]) => [k, +(JSON.stringify(v).length / 1048576).toFixed(2)]));
const bytes = JSON.stringify(fed).length;
const sorted = [...roundMs].sort((a, b) => a - b);
console.log(JSON.stringify({
  regions: REGIONS, population: populationOf(topo), competitors: svc.state!.competitors.size, rounds: ROUNDS, season: svc.state!.world.season,
  createMs: Math.round(createMs), roundMedianMs: Math.round(sorted[sorted.length >> 1]), roundMaxMs: Math.round(sorted[sorted.length - 1]),
  roundMs: roundMs.map(Math.round), seasonMs: Math.round(seasonMs),
  federationJsonMB: +(bytes / 1048576).toFixed(2), storeMB: sizes,
  heapMB: { base: heap0, afterCreate: heapAfterCreate, afterRounds: heapAfter, stateApprox: +(heapAfter - heap0).toFixed(1) },
}));
process.exit(0);
