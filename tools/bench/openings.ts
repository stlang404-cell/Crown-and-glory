/**
 * Deterministic opening corpus: all 2-ply openings (100) filtered by a Fairy-Stockfish depth-12
 * evaluation within ±80 cp, generated once into tools/bench/openings.json.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { Position } from '../../src/rules/position';
import { moveToCcn } from '../../src/rules/notation';
import { UciEngine, parseInfoScore } from './uci';
import { FAIRY_PATH } from './players';
import { START } from './match';

const FILE = new URL('./openings.json', import.meta.url);

export async function buildOpenings(): Promise<string[][]> {
  if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf8')).openings;
  const e = new UciEngine(FAIRY_PATH);
  await e.init();
  const out: { line: string[]; cp: number }[] = [];
  const p = Position.fromFen(START);
  for (const a of p.legalMoves()) {
    p.makeMove(a);
    for (const b of p.legalMoves()) {
      const line = [moveToCcn(a), moveToCcn(b)];
      const r = await e.go(START, line, 'depth 12');
      const s = parseInfoScore(r.info);
      if (s.cp !== undefined && Math.abs(s.cp) <= 80) out.push({ line, cp: s.cp });
    }
    p.unmakeMove();
  }
  e.quit();
  writeFileSync(FILE, JSON.stringify({ generator: `${e.name} depth 12, |cp|<=80, white-to-move perspective`, count: out.length, openings: out.map(o => o.line), evals: out }, null, 1));
  return out.map(o => o.line);
}
