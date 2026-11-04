/**
 * crown-population-2 band counts at creation against the owner's target per 10,000 (docs/RATING_SPECTRUM.md).
 *   npx tsx tools/sim/spectrum_target.mts [seed=42]
 */
import { generateFederation } from '../../src/federation/generator';
import { BANDS, POPULATION_V2, TARGET_PER_10K, bandCounts } from '../../src/federation/population';
import { TOPOLOGY_V1, TOPOLOGY_V2, topologyWithRegions, populationOf } from '../../src/federation/model';

const seed = +(process.argv[2] ?? 42);
const target: Record<string, number> = Object.fromEntries(BANDS.map(b => [b.label, TARGET_PER_10K.filter(t => t.lo >= b.lo && t.hi <= b.hi).reduce((a, t) => a + t.n, 0)]));
for (const topo of [TOPOLOGY_V1, TOPOLOGY_V2, topologyWithRegions(78)]) {
  const n = populationOf(topo);
  const c = generateFederation(seed, topo, POPULATION_V2);
  const lat = bandCounts(c.map(x => x.latent)), pub = bandCounts(c.map(x => x.rating));
  console.log(`${n} competitors (seed ${seed})`);
  for (const b of BANDS) console.log(`  ${b.label.padEnd(10)} target ${String(Math.round(target[b.label] * n / 10000)).padStart(5)}  latent ${String(lat[b.label]).padStart(5)}  public ${String(pub[b.label]).padStart(5)}`);
}
