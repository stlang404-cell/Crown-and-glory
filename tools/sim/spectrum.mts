/**
 * Band counts of the federation population over seasons (docs/RATING_SPECTRUM.md): a crown-population-2 world and a
 * legacy crown-population-1 world (as v0.9 founded it), simulated headless with the v0.10 rules.
 *   npx tsx tools/sim/spectrum.mts [seed=42] [seasons=8]
 */
import { generateFederation } from '../../src/federation/generator';
import { createWorld, Ctx, RoundRecord } from '../../src/federation/world';
import { runRoundHeadless } from '../../src/federation/driver';
import { bandCounts, POPULATION_V1, POPULATION_V2 } from '../../src/federation/population';
import { TOPOLOGY_V1, ROUNDS_PER_SEASON } from '../../src/federation/model';

const seed = +(process.argv[2] ?? 42), seasons = +(process.argv[3] ?? 8);
for (const model of [POPULATION_V2, POPULATION_V1]) {
  const comps = generateFederation(seed, TOPOLOGY_V1, model);
  const { world, plan } = createWorld(seed, comps, 'T', TOPOLOGY_V1, model);
  const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 350, name: 'You' }, swissHistory: [] };
  let rounds: RoundRecord[] = [];
  let entrants = 0;
  const active = () => [...ctx.competitors.values()].filter(c => c.status === 'active');
  const show = (label: string) => {
    const a = active();
    console.log(`${model} ${label} entrants=${entrants} latent ${JSON.stringify(bandCounts(a.map(c => c.latent)))} public ${JSON.stringify(bandCounts(a.map(c => c.rating)))} minRating=${Math.round(Math.min(...a.map(c => c.rating)))} maxRating=${Math.round(Math.max(...a.map(c => c.rating)))}`);
  };
  show('season 1 start');
  for (let s = 1; s <= seasons; s++) {
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      const p = runRoundHeadless(ctx, rounds);
      if (p.seasonEnd) entrants += p.seasonEnd.entrants.length;
      rounds = p.seasonEnd ? [] : [...rounds, p.record];
    }
    if (s % 4 === 0 || s === seasons) show(`after season ${s}`);
  }
}
