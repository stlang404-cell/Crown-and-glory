/**
 * Larger deterministic opening corpus for ≥400-game matches: every balanced 2-ply opening from
 * openings.json extended by every legal 2-ply continuation, re-filtered by a Fairy-Stockfish depth-10
 * evaluation within ±80 cp, then thinned deterministically (stride) to at most MAX lines.
 * Written once to tools/bench/openings-4ply.json; selected in run.ts with OPENINGS=4ply.
 *   FAIRY_STOCKFISH=/path/to/stockfish npx tsx tools/bench/openings4.ts [max=320]
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { Position } from '../../src/rules/position';
import { moveToCcn, parseLegalCcn } from '../../src/rules/notation';
import { UciEngine, parseInfoScore } from './uci';
import { FAIRY_PATH } from './players';
import { START } from './match';

const FILE = new URL('./openings-4ply.json', import.meta.url);

export function loadOpenings4(): string[][] {
  if (!existsSync(FILE)) throw new Error('tools/bench/openings-4ply.json missing: run tools/bench/openings4.ts');
  return JSON.parse(readFileSync(FILE, 'utf8')).openings;
}

async function main() {
  const MAX = +(process.argv[2] ?? 320);
  const base: string[][] = JSON.parse(readFileSync(new URL('./openings.json', import.meta.url), 'utf8')).openings;
  const cands: string[][] = [];
  for (const line of base) {
    const p = Position.fromFen(START);
    for (const m of line) p.makeMove(parseLegalCcn(p, m));
    for (const a of p.legalMoves()) {
      p.makeMove(a);
      for (const b of p.legalMoves()) cands.push([...line, moveToCcn(a), moveToCcn(b)]);
      p.unmakeMove();
    }
  }
  // deterministic thinning before evaluation keeps the generator cheap: evaluate ~3x the target
  const stride = Math.max(1, Math.floor(cands.length / (MAX * 3)));
  const sample = cands.filter((_, i) => i % stride === 0);
  const e = new UciEngine(FAIRY_PATH);
  await e.init();
  const kept: { line: string[]; cp: number }[] = [];
  for (const line of sample) {
    const r = await e.go(START, line, 'depth 10');
    const s = parseInfoScore(r.info);
    if (s.cp !== undefined && Math.abs(s.cp) <= 80) kept.push({ line, cp: s.cp });
  }
  e.quit();
  const stride2 = Math.max(1, kept.length / MAX);
  const out: typeof kept = [];
  for (let k = 0; out.length < MAX && Math.floor(k * stride2) < kept.length; k++) out.push(kept[Math.floor(k * stride2)]);
  writeFileSync(FILE, JSON.stringify({ generator: `${e.name} depth 10, |cp|<=80, 4 plies, ${cands.length} candidates, stride ${stride}, kept ${kept.length}`, count: out.length, openings: out.map(o => o.line), evals: out }, null, 1));
  console.log(`candidates ${cands.length}, evaluated ${sample.length}, balanced ${kept.length}, written ${out.length}`);
}
if (process.argv[1]?.endsWith('openings4.ts')) main();
