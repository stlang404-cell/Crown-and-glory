/**
 * Played Like calibration data: analyses the stored spectrum corpus (tools/bench/results/spectrum/*.jsonl — engine
 * games with calibrated ratings 71–3,038) with the app's own analysis (analyzeGame, canonical engine, Searcher(18), as
 * src/engine/worker.ts) and writes, per game, the compact per-ply analysis that Played Like features are computed from
 * (only fields a stored AnalysisReport carries, via toLitePly). Resumable; one line per game.
 *
 *   npx tsx tools/playedlike/analyze_corpus.ts <settingsId=std-d7> <worker=0> <workers=2> [limit]
 *
 * Order: games are interleaved across sources (stable shuffle) so any prefix is a stratified sample; worker k takes
 * every workers-th game. Output: tools/playedlike/data/raw-<settings>.<worker>.jsonl
 */
import { readFileSync, existsSync, appendFileSync, readdirSync } from 'node:fs';
import { analyzeGame, ANALYSIS_PRESETS } from '../../src/analysis/analyzer';
import { Searcher } from '../../src/engine/search';
import { toLitePly } from '../../src/analysis/playedLikeFeatures';

const [settingsId = 'std-d7', wArg = '0', nwArg = '2', limitArg] = process.argv.slice(2);
const settings = ANALYSIS_PRESETS.find(s => s.id === settingsId);
if (!settings) throw new Error(`unknown settings ${settingsId}`);
const worker = +wArg, workers = +nwArg, limit = limitArg ? +limitArg : Infinity;
const DIR = 'tools/bench/results/spectrum';
const OUT = `tools/playedlike/data/raw-${settingsId}.${worker}.jsonl`;

interface Side { engine: string; rating: number; rd: number }
interface G { id: string; source: string; startFen: string; white: Side; black: Side; openingPlies: number; moves: string[]; result: string; termination: string }
/** Deterministic string hash (FNV-1a) for a stable shuffle. */
export const fnv = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
const bySource = readdirSync(DIR).filter(f => f.endsWith('.jsonl')).sort().map(f =>
  readFileSync(`${DIR}/${f}`, 'utf8').trim().split('\n').map(l => JSON.parse(l) as G).sort((a, b) => fnv(a.id) - fnv(b.id)));
// interleave proportionally: game j of a source with n games gets key (j + 0.5) / n
const all = bySource.flatMap(gs => gs.map((g, j) => ({ g, k: (j + 0.5) / gs.length }))).sort((a, b) => a.k - b.k || fnv(a.g.id) - fnv(b.g.id)).map(x => x.g);
const mine = all.filter((_, i) => i % workers === worker).slice(0, limit);
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
const searcher = new Searcher(18);
let n = 0; const t00 = Date.now();
for (const g of mine) {
  if (done.has(g.id)) continue;
  const t0 = Date.now();
  const rep = analyzeGame({ gameId: g.id, checksum: g.id, initialFen: g.startFen, moves: g.moves }, settings, {}, searcher);
  appendFileSync(OUT, JSON.stringify({
    id: g.id, source: g.source, opening: g.moves.slice(0, g.openingPlies).join(' '), openingPlies: g.openingPlies,
    white: { engine: g.white.engine, rating: g.white.rating, rd: g.white.rd }, black: { engine: g.black.engine, rating: g.black.rating, rd: g.black.rd },
    result: g.result, termination: g.termination, plies: g.moves.length,
    settings: rep.settings.id, build: rep.engine.buildId, grading: rep.methodology.gradingId,
    accuracy: { white: rep.summary.white.accuracy, black: rep.summary.black.accuracy },
    p: rep.plies.map(toLitePly), ms: Date.now() - t0,
  }) + '\n');
  n++;
  if (n % 10 === 0) console.log(`[w${worker}] ${n} games, ${((Date.now() - t00) / n / 1000).toFixed(1)} s/game avg`);
}
console.log(`[w${worker}] done ${n}`);
