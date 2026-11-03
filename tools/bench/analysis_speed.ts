/**
 * Analysis preset speed (honest performance information for the configuration picker).
 * Three seeded engine games are analysed with every preset in Node; reports ms per analysed ply.
 *   npx tsx tools/bench/analysis_speed.ts
 */
import { writeFileSync } from 'node:fs';
import { playSelfplay } from '../../src/engine/selfplay';
import { analyzeGame, ANALYSIS_PRESETS } from '../../src/analysis/analyzer';
import { getLevel } from '../../src/engine/levels';
import os from 'node:os';

const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const games = [11, 22, 33].map(seed => playSelfplay(START, { profile: { ...getLevel(4), selection: null } }, { profile: { ...getLevel(4), selection: null } }, seed, 120).moves.map(m => m.ccn));
const out: Record<string, { msPerPly: number; plies: number; games: number }> = {};
for (const p of ANALYSIS_PRESETS) {
  let ms = 0, plies = 0;
  for (const [i, moves] of games.entries()) {
    const t0 = performance.now();
    analyzeGame({ gameId: `bench-${i}`, checksum: 'x', initialFen: START, moves } as never, p);
    ms += performance.now() - t0; plies += moves.length;
  }
  out[p.id] = { msPerPly: Math.round(ms / plies), plies, games: games.length };
  console.log(p.id, JSON.stringify(out[p.id]));
}
writeFileSync(new URL('../../src/analysis/analysis-speed.json', import.meta.url), JSON.stringify({ measuredAt: new Date().toISOString(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, note: 'Node, single thread, other workloads running concurrently; browsers on phones are typically slower', presets: out }, null, 1));
