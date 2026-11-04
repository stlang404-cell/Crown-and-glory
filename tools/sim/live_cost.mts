/**
 * CPU cost of a scheduled live game (docs/FEDERATION_SCALE.md): plays federation pairings move by move exactly as the
 * live scheduler does (fresh seeded search per move, Searcher(18) like the worker, featured node cap 30,000) and
 * reports per-move and per-game engine time by division.
 *   npx tsx tools/sim/live_cost.mts [gamesPerDivision=3] [divisions=0,1,2,4,6,8] [seed=4242]   (0 = both sides at the cap)
 */
import { generateFederation, hashSeed } from '../../src/federation/generator.ts';
import { profileForStrength } from '../../src/federation/profiles.ts';
import { playLiveMove, liveTerminal, START_FEN } from '../../src/app/schedulerEngine.ts';
import { Position } from '../../src/rules/position.ts';

const G = +(process.argv[2] ?? 3);
const DIVS = (process.argv[3] ?? '0,1,2,4,6,8').split(',').map(Number);
const SEED = +(process.argv[4] ?? 4242);
const comps = generateFederation(SEED);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const out: unknown[] = [];
for (const d of DIVS) {
  const perMove: number[] = [], perGame: number[] = [], plies: number[] = [], nodes: number[] = [];
  for (let g = 0; g < G; g++) {
    const circuit = comps.filter(c => c.region === g % 16 && c.division === Math.max(1, d));
    const w = circuit[0], b = circuit[1 + (g % 7)];
    // division 0 = both sides at the featured node cap (the worst case for a scheduled game)
    const pw = profileForStrength(d === 0 ? 3050 : w.latent, 30_000), pb = profileForStrength(d === 0 ? 3050 : b.latent, 30_000);
    const seed = hashSeed(SEED, 'featured', `probe:${d}:${g}`);
    const moves: string[] = [];
    let total = 0;
    const pos = Position.fromFen(START_FEN);
    for (let ply = 0; ply < 400; ply++) {
      if (liveTerminal(pos, ply)) break;
      const side = pos.side === 0 ? { p: pw, s: w.style } : { p: pb, s: b.style };
      const t0 = performance.now();
      const r = playLiveMove(pos, side.p, side.s, (seed + ply * 7919) >>> 0);
      pos.makeMove(r.move);
      const ms = performance.now() - t0;
      perMove.push(ms); total += ms; nodes.push(r.nodes);
      moves.push(r.ccn);
    }
    perGame.push(total); plies.push(moves.length);
  }
  out.push({ division: d, games: G, profileWhite: profileForStrength(d === 0 ? 3050 : comps.find(c => c.division === d)!.latent, 30_000).id,
    moveMs: { median: +q(perMove, 0.5).toFixed(1), p90: +q(perMove, 0.9).toFixed(1), mean: +(perMove.reduce((a, x) => a + x, 0) / perMove.length).toFixed(1) },
    gameMs: { median: Math.round(q(perGame, 0.5)), max: Math.round(Math.max(...perGame)) }, plies: { median: q(plies, 0.5), max: Math.max(...plies) }, nodesMedian: q(nodes, 0.5) });
}
console.log(JSON.stringify(out));
