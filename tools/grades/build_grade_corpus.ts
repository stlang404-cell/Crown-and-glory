/**
 * Grade regression corpus (crown-grade-corpus-2 since v0.5: canonical engine; the frozen corpus-1 is tests/fixtures/grades-v1.json): real positions (Academy puzzle starts and positions
 * from benchmark games) analysed with the production analyser at the standard policy. For each label we
 * keep up to 3 examples where the grade was produced; plus negative fixtures:
 *  - a recapture that is the best move must NOT be Brilliant,
 *  - a material sacrifice that is not the best move (unsound) must NOT be Brilliant/Great,
 *  - a forced single legal move must be Best (forced), never Great/Brilliant.
 * The test (tests/grades.corpus.test.ts) re-analyses every fixture and requires the same label.
 *   npx tsx tools/grades/build_grade_corpus.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Position } from '../../src/rules/position';
import { parseLegalCcn, moveToCcn } from '../../src/rules/notation';
import { analyzeGame, ANALYSIS_PRESETS } from '../../src/analysis/analyzer';
import { Searcher } from '../../src/engine/search';
import { sacrificedMaterial } from '../../src/academy/coach';
import type { Grade } from '../../src/analysis/types';

const settings = ANALYSIS_PRESETS.find(p => p.id === 'quick-d5')!;
const puzzles = JSON.parse(readFileSync(new URL('../../src/academy/data/puzzles.json', import.meta.url), 'utf8')).puzzles as { fen: string; solution: string[] }[];
const out: { fen: string; move: string; grade: Grade | null; kind: string; note: string }[] = [];
const want: Record<string, number> = { brilliant: 3, great: 3, best: 3, excellent: 3, good: 3, inaccuracy: 3, mistake: 3, blunder: 3 };
const searcher = new Searcher(16);
const analyse = (fen: string, move: string) => analyzeGame({ gameId: 'fx', checksum: '0'.repeat(64), initialFen: fen, moves: [move] }, settings, {}, searcher).plies[0];

let negRecapture = false, negUnsound = false, negForced = false;
for (const pz of puzzles) {
  if (Object.values(want).every(v => v <= 0) && negRecapture && negUnsound) break;
  const pos = Position.fromFen(pz.fen);
  // the solution move plus up to 5 other legal moves give a spread of grades
  const legal = pos.legalMoves().map(moveToCcn);
  const tryMoves = [pz.solution[0], ...legal.filter(m => m !== pz.solution[0]).slice(0, 5)];
  for (const mv of tryMoves) {
    const pl = analyse(pz.fen, mv);
    if (pl.grade && want[pl.grade] > 0 && !pl.uncertainGrades) { want[pl.grade]--; out.push({ fen: pz.fen, move: mv, grade: pl.grade, kind: 'label', note: pl.gradeReasons.join(' ') }); }
    const m = parseLegalCcn(pos, mv);
    const invested = sacrificedMaterial(pos, m, pl.played.pv);
    if (!negUnsound && invested >= 300 && pl.best.ccn !== mv && pl.loss !== null && pl.loss > 0.12) { negUnsound = true; out.push({ fen: pz.fen, move: mv, grade: pl.grade, kind: 'unsound-sacrifice', note: `invests ~${invested} cp, not best` }); }
  }
}
// quieter positions from recorded benchmark games fill the remaining labels (Excellent/Good are rare in puzzles)
{
  const { readdirSync } = await import('node:fs');
  const RES = new URL('../bench/results/', import.meta.url);
  let scanned = 0;
  outer: for (const f of readdirSync(RES).filter(x => x.endsWith('-games.json'))) {
    const all = JSON.parse(readFileSync(new URL(f, RES), 'utf8')) as Record<string, { moves: string[] }[]>;
    for (const gs of Object.values(all)) for (const g of gs) {
      if (Object.values(want).every(v => v <= 0)) break outer;
      const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
      for (let i = 0; i < g.moves.length; i++) {
        if (i >= 8 && i % 9 === 0 && !p.inCheck()) {
          if (++scanned > 150) break outer; // bounded scan (Excellent/Good are rare outside uncertainty bands)
          const fen = p.toFen();
          for (const mv of p.legalMoves().map(moveToCcn).slice(0, 8)) {
            const pl = analyse(fen, mv);
            if (pl.grade && want[pl.grade] > 0 && !pl.uncertainGrades && (pl.grade === 'excellent' || pl.grade === 'good' || pl.grade === 'inaccuracy')) { want[pl.grade]--; out.push({ fen, move: mv, grade: pl.grade, kind: 'label', note: pl.gradeReasons.join(' ') }); }
          }
        }
        p.makeMove(parseLegalCcn(p, g.moves[i]));
      }
    }
  }
}
// recapture fixture: play a capture, then analyse the best recapture
for (const pz of puzzles) {
  if (negRecapture) break;
  const pos = Position.fromFen(pz.fen);
  for (const m of pos.legalMoves()) {
    if (!pos.board[(m >> 6) & 63]) continue;
    const q = pos.clone(); q.makeMove(m);
    const sq = (m >> 6) & 63;
    const best = searcher.search(q, { limits: { depth: 5 } }).bestMove;
    if (((best >> 6) & 63) !== sq) continue;
    const r = analyzeGame({ gameId: 'fx', checksum: '0'.repeat(64), initialFen: pz.fen, moves: [moveToCcn(m), moveToCcn(best)] }, settings, {}, searcher).plies[1];
    if (r.best.ccn === moveToCcn(best)) { negRecapture = true; out.push({ fen: q.toFen(), move: moveToCcn(best), grade: r.grade, kind: 'recapture', note: `recapture on ${moveToCcn(best).slice(2, 4)} after ${moveToCcn(m)}`, ...{ prior: moveToCcn(m), priorFen: pz.fen } } as never); break; }
  }
}
// forced fixture
const forcedFen = 'k1Q3/6/6/6/6/5K b - - 0 1';
const fp = Position.fromFen(forcedFen);
if (fp.legalMoves().length === 1) { const mv = moveToCcn(fp.legalMoves()[0]); const pl = analyse(forcedFen, mv); negForced = true; out.push({ fen: forcedFen, move: mv, grade: pl.grade, kind: 'forced', note: 'single legal move' }); }
writeFileSync(new URL('../../tests/fixtures/grades.json', import.meta.url), JSON.stringify({ id: 'crown-grade-corpus-3', engine: 'crown-search-2+crown-eval-4', grading: 'crown-grade-v3-experimental', settings: settings.id, missing: Object.entries(want).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`), negatives: { recapture: negRecapture, unsound: negUnsound, forced: negForced }, fixtures: out }, null, 1));
console.log('fixtures', out.length, 'missing', JSON.stringify(want), { negRecapture, negUnsound, negForced });
