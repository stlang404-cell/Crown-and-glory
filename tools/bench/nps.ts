/**
 * Paired speed benchmark: the frozen M3 engine (tools/bench/baseline) and the current engine search the
 * same positions to the same fixed node count, interleaved (base, current, base, current, …) so that
 * machine load affects both alike. Reports nodes/s per position (median of REPS) and the speed ratio.
 *
 *   npx tsx tools/bench/nps.ts [nodes] [reps] [outTag]                  (Node + tsx loader)
 *   npx esbuild tools/bench/nps.ts --bundle --platform=node --format=esm --outfile=<tmp>/nps.mjs && node <tmp>/nps.mjs …
 * The esbuild bundle puts all modules in one scope like the production Vite build, so it is the more
 * representative of in-app speed; the tsx numbers include the loader's cross-module binding overhead.
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { Position } from '../../src/rules/position';
import { Searcher, PLAY_SEARCH_ID as SEARCH_ID, PLAY_FEATURES, DEFAULT_FEATURES } from '../../src/engine/search';
import { PLAY_EVAL_ID as EVAL_ID, PLAY_WEIGHTS, DEFAULT_WEIGHTS } from '../../src/engine/evaluate';
// PROFILE=default measures the current code with the analysis defaults (crown-search-1 + crown-eval-3)
const play = process.env.PROFILE !== 'default';
import { Searcher as BaseSearcher } from './baseline/search1';

const FENS = [
  'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
  'r1qk1r/pp1ppp/2n1n1/2p3/PPPPPP/RNQKNR w - - 0 4',
  'r2k1r/1p3p/2n3/3Q2/PP3P/R2K1R b - - 0 1',
  '3k2/1p3p/6/1P2P1/6/3K2 w - - 0 1',
  '2rk2/1q3p/p1n3/3N2/PP1Q1P/3K1R w - - 0 20',
];
const nodes = +(process.argv[2] ?? 300_000);
const reps = +(process.argv[3] ?? 5);
const tag = process.argv[4] ?? 'tsx';
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const rows: Record<string, unknown>[] = [];
for (const fen of FENS) {
  const base: number[] = [], cur: number[] = [];
  let bd = 0, cd = 0;
  for (let r = 0; r < reps; r++) {
    for (const which of ['base', 'cur'] as const) {
      const s = which === 'base' ? new BaseSearcher(18) : new Searcher(18);
      const t0 = performance.now();
      const res = which === 'base' ? s.search(Position.fromFen(fen), { limits: { nodes } }) : (s as Searcher).search(Position.fromFen(fen), { limits: { nodes }, features: play ? PLAY_FEATURES : DEFAULT_FEATURES, weights: play ? PLAY_WEIGHTS : DEFAULT_WEIGHTS });
      const nps = res.nodes / ((performance.now() - t0) / 1000);
      if (which === 'base') { base.push(nps); bd = res.depth; } else { cur.push(nps); cd = res.depth; }
    }
  }
  const row = { fen, baseNps: Math.round(med(base)), curNps: Math.round(med(cur)), ratio: +(med(cur) / med(base)).toFixed(2), baseDepth: bd, curDepth: cd };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const out = { env: { node: process.version, cpu: os.cpus()[0]?.model, cores: os.cpus().length, load: os.loadavg(), searchId: SEARCH_ID, evalId: EVAL_ID, date: new Date().toISOString() }, mode: tag, profile: play ? 'play' : 'default', nodesPerSearch: nodes, reps, rows };
writeFileSync(`tools/bench/results/nps-${tag}.json`, JSON.stringify(out, null, 1));
