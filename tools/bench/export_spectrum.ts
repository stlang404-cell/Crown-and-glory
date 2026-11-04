/**
 * Export every calibration game with measured engine strengths into one reusable corpus:
 * tools/bench/results/spectrum/<source>.jsonl (one game per line) + index.json.
 * Intended for later work (e.g. a "Played Like" performance-rating model, docs/V10_PLAN.md) that needs games of engines
 * with known strength across the whole Crown scale. Each game carries both engines' calibrated ratings (rating, RD,
 * calibration id), the exact engine configuration, the full move list (ccn-1 and csan SAN) and a PGN-like text.
 *   npx tsx tools/bench/export_spectrum.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Position } from '../../src/rules/position';
import { moveToSan, parseLegalCcn } from '../../src/rules/notation';
import { VARIANT_ID } from '../../src/rules/types';
import { BEGINNER_LEVELS, getLevel } from '../../src/engine/levels';
import calibration from '../../src/engine/calibration.json';
import beginners from '../../src/engine/calibration-beginners.json';
import { START, GameRecord } from './match';

const RES = new URL('./results/', import.meta.url);
const OUT = new URL('./results/spectrum/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const CAL = calibration as { id: string; levels: { level: number; rating: number; rd: number }[] };
const BCAL = beginners as { id: string; levels: { id: string; rating: number; rd: number }[] };

interface Side { engine: string; rating: number; rd: number; calibrationId: string; config: string }
function side(engineId: string, note: Record<string, string>): Side {
  const id = engineId.replace(/^crown-/, '');
  const b = BCAL.levels.find(l => l.id === id);
  if (b) {
    const e = BEGINNER_LEVELS.find(l => l.id === id)!.error!;
    return { engine: id, rating: b.rating, rd: b.rd, calibrationId: BCAL.id, config: `crown-error-1 pRandom ${e.pRandom} pBlind ${e.pBlind} T ${e.temperatureCp} margin ${e.marginCp}, ≤4,000 nodes` };
  }
  const level = +id.slice(1);
  const c = CAL.levels.find(l => l.level === level)!;
  const p = getLevel(level);
  const cfg = note[id] ?? (p.selection ? `depth ${p.depth}, ${p.nodes} nodes, bounded selection margin ${p.selection.marginCp} T ${p.selection.temperatureCp}` : `full search, ${p.nodes} nodes`);
  return { engine: id, rating: c.rating, rd: c.rd, calibrationId: CAL.id, config: cfg };
}
function pgnOf(g: GameRecord, w: Side, b: Side, source: string, round: number): { san: string[]; pgn: string } {
  const pos = Position.fromFen(START);
  const san: string[] = [];
  for (const m of g.moves) { const mv = parseLegalCcn(pos, m); san.push(moveToSan(pos, mv)); pos.makeMove(mv); }
  const body = san.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).join(' ');
  const res = g.result === '*' ? '*' : g.result;
  const tags = [['Event', `Crown engine calibration (${source})`], ['Variant', VARIANT_ID], ['FEN', START], ['Round', String(round)],
    ['White', w.engine], ['Black', b.engine], ['WhiteElo', String(w.rating)], ['BlackElo', String(b.rating)], ['Result', res], ['Termination', g.reason]];
  return { san, pgn: `${tags.map(([k, v]) => `[${k} "${v}"]`).join('\n')}\n\n${body} ${res}` };
}

const sources: { name: string; file: string; note: string; levels?: Record<string, string>; matches: (d: unknown) => GameRecord[] }[] = [
  { name: 'beginners-r2', file: 'suite-beginners-r2-games.json', note: 'beginner chain, final parameters, 4-ply openings offset 60 (used in the beginner fit)', matches: d => Object.values(d as Record<string, GameRecord[]>).flat() },
  { name: 'beginners-r3', file: 'suite-beginners-r3-games.json', note: 'beginner chain, final parameters, 4-ply openings offset 120 (used in the beginner fit)', matches: d => Object.values(d as Record<string, GameRecord[]>).flat() },
  { name: 'beginners-far', file: 'suite-beginners-far-games.json', note: 'held-out validation (not used in any fit): long gaps and L2/L3 vs beginners, 4-ply openings offset 240', matches: d => Object.values(d as Record<string, GameRecord[]>).flat() },
  { name: 'levels-calibrate', file: 'suite-calibrate-games.json', note: 'L1–L8 calibration games (cal-2026-11-03, crown-levels-3 play engine crown-search-2+crown-eval-4, 2-ply openings); L8 had a 2 s cap and predates the crown-levels-5/6 partialRoot/fullBudget change',
    levels: { L8: 'full search, clock-limited (2 s cap in calibration; crown-levels-3 L8, before partialRoot/fullBudget)' }, matches: d => Object.values(d as Record<string, GameRecord[]>).flat() },
  { name: 'levels-L9-L8', file: 'match-crown-L9-vs-crown-L8-v5max.json', note: 'v0.5 L9 vs L8 time-scaled match (L9 3.33 s cap + 2^20 table, L8 2 s cap); L9 rating is derived from it',
    levels: { L9: 'full search, 3.33 s cap, 2^20 table (v0.5 time-scaled)', L8: 'full search, 2 s cap (v0.5)' }, matches: d => (d as { games: GameRecord[] }).games },
];
const index: Record<string, unknown>[] = [];
for (const s of sources) {
  const games = s.matches(JSON.parse(readFileSync(new URL(s.file, RES), 'utf8')));
  const lines = games.map((g, i) => {
    const w = side(g.white, s.levels ?? {}), b = side(g.black, s.levels ?? {});
    const { san, pgn } = pgnOf(g, w, b, s.name, i + 1);
    return JSON.stringify({ id: `${s.name}:${i + 1}`, source: s.name, variant: VARIANT_ID, startFen: START, white: w, black: b, openingPlies: g.opening.length, moves: g.moves, san, result: g.result, termination: g.reason, plies: g.plies, pgn });
  });
  writeFileSync(new URL(`${s.name}.jsonl`, OUT), lines.join('\n') + '\n');
  const engines = [...new Set(games.flatMap(g => [g.white, g.black]))].map(e => side(e, s.levels ?? {})).sort((a, b) => a.rating - b.rating);
  index.push({ source: s.name, file: `${s.name}.jsonl`, from: `tools/bench/results/${s.file}`, games: games.length, capped: games.filter(g => g.result === '*').length, note: s.note, engines: engines.map(e => ({ engine: e.engine, rating: e.rating, rd: e.rd, calibrationId: e.calibrationId, config: e.config })) });
  console.log(s.name, games.length);
}
writeFileSync(new URL('index.json', OUT), JSON.stringify({
  format: 'crown-spectrum-games-1',
  description: 'Engine-vs-engine games with calibrated strengths on the Crown scale (L1 = 800). One JSON object per line: white/black {engine, rating, rd, calibrationId, config}, moves (ccn-1, including the opening plies), san (csan), result, termination, plies, pgn (PGN-like, Variant crown-la6-v1). Ratings are engine-vs-engine, not human or FIDE. Capped games (result "*") are kept but were excluded from fits.',
  generatedBy: 'npx tsx tools/bench/export_spectrum.ts',
  sources: index,
}, null, 1) + '\n');
