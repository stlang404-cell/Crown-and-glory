/** Re-analyses every fixture of the grade regression corpus and requires the stored label (Gate B). */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { analyzeGame, ANALYSIS_PRESETS } from '../src/analysis/analyzer';
import { Searcher } from '../src/engine/search';

type Corpus = { settings: string; fixtures: { fen: string; move: string; grade: string | null; kind: string; prior?: string; priorFen?: string }[] };
const load = (name: string) => { const f = new URL(`./fixtures/${name}`, import.meta.url); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as Corpus : null; };

/** v2 = canonical engine + grading v2 (new reports); v1 = the frozen pre-v0.5 corpus, reproduced in legacy mode so
 *  historical reports stay explainable and reproducible. */
for (const [name, engine] of [['grades.json', 'canonical'], ['grades-v1.json', 'legacy-v1']] as const) {
const corpus = load(name);
describe.skipIf(!corpus)(`grade regression corpus (${engine})`, () => {
  const settings = ANALYSIS_PRESETS.find(p => p.id === corpus!.settings)!;
  it('every fixture reproduces its label; negatives never earn exceptional grades', () => {
    const s = new Searcher(16);
    for (const fx of corpus!.fixtures) {
      const pl = fx.prior
        ? analyzeGame({ gameId: 'fx', checksum: '0'.repeat(64), initialFen: fx.priorFen!, moves: [fx.prior, fx.move] }, settings, {}, s, engine).plies[1]
        : analyzeGame({ gameId: 'fx', checksum: '0'.repeat(64), initialFen: fx.fen, moves: [fx.move] }, settings, {}, s, engine).plies[0];
      expect(pl.grade, `${fx.kind} ${fx.fen} ${fx.move}`).toBe(fx.grade);
      if (fx.kind !== 'label') expect(['brilliant', 'great']).not.toContain(pl.grade);
      if (fx.kind === 'forced') { expect(pl.forced).toBe(true); expect(pl.grade).toBe('best'); }
    }
  }, 300_000);
});
}
