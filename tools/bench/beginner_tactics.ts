/**
 * Tactics solve rate (tools/bench/tactics.json, 87 Fairy-Stockfish-verified positions) of L1 and the beginner levels
 * L0a…L0d over fixed seeds: a direct, match-independent check that the error model makes play monotonically weaker.
 *   npx tsx tools/bench/beginner_tactics.ts [seeds=8]
 */
import { readFileSync } from 'node:fs';
import { Position } from '../../src/rules/position';
import { moveToCcn } from '../../src/rules/notation';
import { Searcher } from '../../src/engine/search';
import { BEGINNER_LEVELS, chooseMove, getLevel, StrengthProfile } from '../../src/engine/levels';

export function tacticsSolveRate(profile: StrengthProfile, seeds: number[]): { solved: number; tries: number } {
  const suite = JSON.parse(readFileSync(new URL('./tactics.json', import.meta.url), 'utf8')) as { items: { fen: string; best: string[] }[] };
  const s = new Searcher(16);
  let solved = 0, tries = 0;
  for (const it of suite.items) for (const seed of seeds) {
    s.newGame();
    const r = chooseMove(s, Position.fromFen(it.fen), profile, seed);
    if (it.best.includes(moveToCcn(r.move))) solved++;
    tries++;
  }
  return { solved, tries };
}
if (process.argv[1]?.endsWith('beginner_tactics.ts')) {
  const n = +(process.argv[2] ?? 8);
  const seeds = Array.from({ length: n }, (_, i) => 1000 + i * 7919);
  for (const p of [getLevel(1), ...BEGINNER_LEVELS]) {
    const r = tacticsSolveRate(p, seeds);
    console.log(`${p.id}: ${r.solved}/${r.tries} = ${(100 * r.solved / r.tries).toFixed(1)}%`);
  }
}
