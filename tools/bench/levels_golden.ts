/**
 * Writes tests/fixtures/levels-golden.json: the moves L1–L9 choose on a fixed position set with fixed seeds.
 * Generated once from the v0.9 code (before the sub-800 error-model levels were added) so tests/levelsGolden.test.ts
 * can prove the calibrated levels L1–L9 still choose identical moves. L8/L9 are clock-limited in play; here they are
 * depth-capped (depth 5, generous clock) so the same code path (partialRoot/fullBudget) is deterministic.
 *   npx tsx tools/bench/levels_golden.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Position } from '../../src/rules/position';
import { moveToCcn } from '../../src/rules/notation';
import { Searcher } from '../../src/engine/search';
import { chooseMove, getLevel, StrengthProfile } from '../../src/engine/levels';

export const goldenProfile = (level: number): StrengthProfile => {
  const p = getLevel(level);
  return level >= 8 ? { ...p, depth: 5, maxTimeMs: 600_000 } : p;
};
export function goldenFens(): string[] {
  const t = JSON.parse(readFileSync(new URL('./tactics.json', import.meta.url), 'utf8')) as { items: { fen: string }[] };
  return ['rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'r1qk1r/pp1ppp/2n1n1/2p3/PPPPPP/RNQKNR w - - 0 4', ...t.items.filter((_, i) => i % 6 === 0).map(x => x.fen)];
}
export function goldenMoves(): { level: number; fen: string; seed: number; move: string }[] {
  const out: { level: number; fen: string; seed: number; move: string }[] = [];
  for (let level = 1; level <= 9; level++) {
    const s = new Searcher(goldenProfile(level).ttBits ?? 18);
    goldenFens().forEach((fen, i) => {
      for (const seed of [1, 7919 + i]) {
        s.newGame();
        const r = chooseMove(s, Position.fromFen(fen), goldenProfile(level), seed);
        out.push({ level, fen, seed, move: moveToCcn(r.move) });
      }
    });
  }
  return out;
}
if (process.argv[1]?.endsWith('levels_golden.ts')) {
  const items = goldenMoves();
  writeFileSync(new URL('../../tests/fixtures/levels-golden.json', import.meta.url), JSON.stringify({ generatedFrom: 'v0.9.0 levels (crown-levels-6, commit 5c73a73), before the crown-error-1 beginner levels', items }) + '\n');
  console.log(items.length, 'moves');
}
