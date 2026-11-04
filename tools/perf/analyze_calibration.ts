/**
 * "Played Like" calibration data (v0.8): analyses every game of the L1–L8 calibration suite
 * (tools/bench/results/suite-calibrate-games.json; level strengths measured by results in src/engine/calibration.json)
 * with the app's canonical analysis (DEFAULT_ANALYSIS) and writes one line per game with per-side features.
 * Resumable: games already in the output are skipped.
 *   npx tsx tools/perf/analyze_calibration.ts [out=tools/perf/calibration-features.jsonl]
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { analyzeGame, DEFAULT_ANALYSIS } from '../../src/analysis/analyzer';
import { START_FEN } from '../../src/rules/types';
import { Searcher } from '../../src/engine/search';
import type { PlyAnalysis } from '../../src/analysis/types';

const OUT = process.argv[2] ?? 'tools/perf/calibration-features.jsonl';
const suite = JSON.parse(readFileSync('tools/bench/results/suite-calibrate-games.json', 'utf8')) as Record<string, { white: string; black: string; moves: string[]; result: string; reason: string; plies: number }[]>;
const cal = JSON.parse(readFileSync('src/engine/calibration.json', 'utf8'));
const levelRating = new Map<string, number>(cal.levels.map((l: { level: number; rating: number }) => [`L${l.level}`, l.rating]));
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).key) : []);
const searcher = new Searcher(18);
const side = (plies: PlyAnalysis[], pov: 'white' | 'black') => {
  const mine = plies.filter(p => p.color === pov);
  const elig = mine.filter(p => !p.forced && p.loss !== null);
  return {
    moves: mine.length, forced: mine.filter(p => p.forced).length,
    losses: elig.map(p => +p.loss!.toFixed(4)),
    plies: elig.map(p => p.ply),
    grades: mine.map(p => p.grade),
  };
};
let n = 0;
for (const [match, games] of Object.entries(suite)) {
  for (let i = 0; i < games.length; i++) {
    const g = games[i]; const key = `${match}#${i}`;
    if (done.has(key)) continue;
    const t0 = Date.now();
    const rep = analyzeGame({ gameId: key, checksum: key, initialFen: START_FEN, moves: g.moves }, DEFAULT_ANALYSIS, {}, searcher);
    appendFileSync(OUT, JSON.stringify({
      key, match, white: g.white, black: g.black, whiteRating: levelRating.get(g.white), blackRating: levelRating.get(g.black),
      result: g.result, reason: g.reason, plies: g.moves.length, engine: rep.engine.buildId, grading: rep.methodology.gradingId, settings: rep.settings.id,
      accuracy: { white: rep.summary.white.accuracy, black: rep.summary.black.accuracy },
      w: side(rep.plies, 'white'), b: side(rep.plies, 'black'), ms: Date.now() - t0,
    }) + '\n');
    if (++n % 20 === 0) console.log(`${n} games analysed (last ${Date.now() - t0} ms)`);
  }
}
console.log('done', n);
