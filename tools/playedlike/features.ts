/**
 * Played Like: turns the analysed corpus (tools/playedlike/data/raw-<settings>.*.jsonl) into one feature row per side
 * with the true calibrated rating of the engine that played it, using the app's own feature code
 * (src/analysis/playedLikeFeatures.ts). Also assigns the train / held-out split:
 *   held out ⇔ hash(opening sequence) % 4 === 0 (FNV-1a + murmur3 finaliser)  — every game from an opening (both colours, every pairing, every
 *   source that reused it) falls on the same side, so no opening line is seen in fitting and in testing.
 *
 *   npx tsx tools/playedlike/features.ts [settings=std-d7]   → tools/playedlike/data/features-<settings>.jsonl
 * (reads raw-<settings>.*.jsonl and raw-<settings>.*.jsonl.gz; a game id seen twice is used once)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { sideFeatures, type LitePly } from '../../src/analysis/playedLikeFeatures';

const settings = process.argv[2] ?? 'std-d7';
const DIR = 'tools/playedlike/data';
/** FNV-1a followed by a murmur3 finaliser (FNV's low bits alone are poorly mixed for short ASCII keys). */
export const hash = (s: string) => {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return x >>> 0;
};
const rows: string[] = [];
const seen = new Set<string>();
// raw files are stored gzipped in the repository (raw-<settings>.<worker>.jsonl.gz); plain .jsonl while a run is going
for (const f of readdirSync(DIR).filter(f => f.startsWith(`raw-${settings}.`) && (f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))).sort()) {
  const text = f.endsWith('.gz') ? gunzipSync(readFileSync(`${DIR}/${f}`)).toString('utf8') : readFileSync(`${DIR}/${f}`, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const g = JSON.parse(line) as { id: string; source: string; opening: string; white: { engine: string; rating: number }; black: { engine: string; rating: number }; accuracy: { white: number | null; black: number | null }; plies: number; settings: string; build: string; grading: string; p: LitePly[] };
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    const test = hash(g.opening) % 4 === 0;
    for (const pov of ['white', 'black'] as const) {
      const me = g[pov], opp = g[pov === 'white' ? 'black' : 'white'];
      rows.push(JSON.stringify({
        id: g.id, pov, source: g.source, opening: g.opening, test, engine: me.engine, rating: me.rating, oppEngine: opp.engine,
        pairing: [me.engine, opp.engine].sort().join('-'), plies: g.plies, settings: g.settings, build: g.build, grading: g.grading, accuracy: g.accuracy[pov], ...sideFeatures(g.p, pov),
      }));
    }
  }
}
writeFileSync(`${DIR}/features-${settings}.jsonl`, rows.join('\n') + '\n');
console.log(`${seen.size} games, ${rows.length} side rows → ${DIR}/features-${settings}.jsonl`);
