/**
 * Federation population audit (v0.8): rating and division distribution of a newly founded federation and after N
 * simulated seasons' worth of rounds (results simulated from latent strength, as in the economy simulator).
 *   npx tsx tools/sim/population_audit.mts [rounds=0] [seed=4242]
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { CrownDB } from '../../src/storage/db.ts';
import { FederationService } from '../../src/app/federation.ts';
const ROUNDS = +(process.argv[2] ?? 0), SEED = +(process.argv[3] ?? 4242);
const db = await CrownDB.open(new IDBFactory());
let c = 0; const now = () => new Date(Date.UTC(2026, 0, 1) + (c++) * 1000).toISOString();
const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
await svc.create(3, SEED);
for (let r = 0; r < ROUNDS; r++) { for (const f of svc.playerFixtures()) await svc.forfeit(f.id); await svc.advanceRound(); }
const st = svc.state!;
const comps = [...st.competitors.values()].filter(x => x.id !== 'player' && !(x as { retired?: boolean }).retired);
const bands = [0, 400, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
const hist = (v: (x: typeof comps[number]) => number) => bands.map((lo, i) => ({ band: `${lo}–${(bands[i + 1] ?? 9999) - 1}`, n: comps.filter(x => v(x) >= lo && v(x) < (bands[i + 1] ?? 1e9)).length })).filter(b => b.n);
const byDiv = [1, 2, 3, 4, 5, 6, 7, 8].map(d => {
  const m = comps.filter(x => x.division === d).map(x => x.rating).sort((a, b) => a - b);
  return { division: d, n: m.length, min: Math.round(m[0]), median: Math.round(m[m.length >> 1]), max: Math.round(m[m.length - 1]) };
});
const r = comps.map(x => x.rating).sort((a, b) => a - b);
console.log(JSON.stringify({ seed: SEED, rounds: ROUNDS, season: st.world.season, competitors: comps.length, rating: { min: Math.round(r[0]), p05: Math.round(r[Math.floor(r.length * .05)]), median: Math.round(r[r.length >> 1]), p95: Math.round(r[Math.floor(r.length * .95)]), max: Math.round(r[r.length - 1]) }, byRating: hist(x => x.rating), byLatent: hist(x => x.latent), byDivision: byDiv }, null, 1));
process.exit(0);
