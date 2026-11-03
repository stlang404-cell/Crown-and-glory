import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { CrownDB } from '../../src/storage/db.ts';
import { FederationService } from '../../src/app/federation.ts';
const db = await CrownDB.open(new IDBFactory());
let c = 0; const now = () => new Date(Date.UTC(2026, 0, 1) + (c++) * 1000).toISOString();
const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
svc.runSelfplay = async () => ({ moves: [], result: '1/2-1/2', termination: 'simulated' });
let t = performance.now(); await svc.create(3, 4242); const tCreate = performance.now() - t;
const times: number[] = [];
for (let r = 0; r < 5; r++) { for (const f of svc.playerFixtures()) await svc.forfeit(f.id); t = performance.now(); await svc.advanceRound(); times.push(performance.now() - t); }
const d = await db.dump();
const bytes = JSON.stringify(d.federation).length;
console.log(JSON.stringify({ competitors: svc.state!.competitors.size, createMs: Math.round(tCreate), roundMs: times.map(Math.round), federationJsonMB: +(bytes / 1048576).toFixed(2) }));
process.exit(0);
