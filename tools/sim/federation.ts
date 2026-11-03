/**
 * Long-horizon federation simulation (crown-sim-fed-1): the shipped world code (generator, pairings, Glicko-2,
 * promotion/relegation, Swiss, championship, aging, retirement, entrants) run headless for many seasons,
 * without the player. Measures rating inflation/deflation, rating–strength agreement, league mobility,
 * champion diversity, careers and CPU time.
 *   npx tsx tools/sim/federation.ts [seasons=40] [seed=42] [out=docs/sim/federation-results.json]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateFederation } from '../../src/federation/generator';
import { createWorld, Ctx, RoundRecord } from '../../src/federation/world';
import { runRoundHeadless } from '../../src/federation/driver';
import { ROUNDS_PER_SEASON } from '../../src/federation/model';

const SEASONS = +(process.argv[2] ?? 40), SEED = +(process.argv[3] ?? 42), OUT = process.argv[4] ?? 'docs/sim/federation-results.json';
const comps = generateFederation(SEED);
const { world, plan } = createWorld(SEED, comps, 'T');
const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 350, name: 'You' }, swissHistory: [] };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2))); };
const corr = (xs: number[], ys: number[]) => { const mx = mean(xs), my = mean(ys); let a = 0, b = 0, c = 0; for (let i = 0; i < xs.length; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; } return a / Math.sqrt(b * c); };

const seasons: unknown[] = [];
const champions: string[] = [];
const t0 = Date.now();
for (let s = 1; s <= SEASONS; s++) {
  const before = new Map([...ctx.competitors.values()].filter(c => c.status === 'active').map(c => [c.id, c.division]));
  const ts = Date.now();
  const rounds: RoundRecord[] = [];
  let end = null;
  for (let r = 0; r < ROUNDS_PER_SEASON; r++) { const p = runRoundHeadless(ctx, rounds); rounds.push(p.record); if (p.seasonEnd) end = p.seasonEnd; }
  const active = [...ctx.competitors.values()].filter(c => c.status === 'active');
  const ratings = active.map(c => c.rating), latents = active.map(c => c.latent);
  const moved = active.filter(c => before.has(c.id) && before.get(c.id) !== c.division).length;
  const champ = end!.titles.filter(t => t.title.startsWith('Crown Champion') || t.title.startsWith('Joint Crown')).map(t => t.id);
  champions.push(...champ);
  const top = [...active].sort((a, b) => b.rating - a.rating).slice(0, 16);
  seasons.push({
    season: s, ms: Date.now() - ts, active: active.length, retired: end!.retirements.length, entrants: end!.entrants.length,
    ratingMean: +mean(ratings).toFixed(1), ratingSd: +sd(ratings).toFixed(1), latentMean: +mean(latents).toFixed(1), ratingMinusLatent: +(mean(ratings) - mean(latents)).toFixed(1),
    corrRatingLatent: +corr(ratings, latents).toFixed(3), meanRd: +mean(active.map(c => c.rd)).toFixed(1), maxRating: Math.round(Math.max(...ratings)),
    divisionMoves: moved, mobility: +(moved / active.length).toFixed(3), champions: champ.map(id => ctx.competitors.get(id)!.name),
    top16MeanAge: +mean(top.map(c => 20 + (s + 1 - c.birthSeason))).toFixed(1),
  });
  if (s % 5 === 0 || s === 1) console.log(JSON.stringify(seasons[seasons.length - 1]));
}
const distinct = new Set(champions).size;
const repeat = [...new Set(champions)].map(id => champions.filter(x => x === id).length).sort((a, b) => b - a);
mkdirSync('docs/sim', { recursive: true });
writeFileSync(OUT, JSON.stringify({ id: 'crown-sim-fed-1', seed: SEED, seasons: SEASONS, seconds: Math.round((Date.now() - t0) / 1000), championTitles: champions.length, distinctChampions: distinct, mostTitles: repeat[0] ?? 0, results: seasons }, null, 1));
console.log(`wrote ${OUT}: ${SEASONS} seasons in ${Math.round((Date.now() - t0) / 1000)} s; ${distinct} distinct champions for ${champions.length} titles (max ${repeat[0]} by one competitor)`);
