/**
 * Tuning corpus, step 2: label every quiet position with a Fairy-Stockfish search score (development-only
 * reference, never bundled). Several UCI engines run concurrently; results are appended to labels.jsonl
 * so an interrupted run resumes. Mate scores are kept as ±mate in plies.
 *   FAIRY_STOCKFISH=… npx tsx tools/bench/tune/label.ts [depth=9] [engines=2]
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { UciEngine, parseInfoScore } from '../uci';
import { FAIRY_PATH } from '../players';

const depth = +(process.argv[2] ?? 9);
const nEng = +(process.argv[3] ?? 2);
const corpus = JSON.parse(readFileSync(new URL('./positions.json', import.meta.url), 'utf8')) as { positions: { fen: string }[] };
const outFile = new URL('./labels.jsonl', import.meta.url);
const done = new Set<string>();
if (existsSync(outFile)) for (const l of readFileSync(outFile, 'utf8').split('\n')) if (l) done.add(JSON.parse(l).fen);
const todo = corpus.positions.map(p => p.fen).filter(f => !done.has(f));
console.log('todo', todo.length, 'done', done.size);
let next = 0, count = 0;
const t0 = Date.now();
async function worker() {
  const e = new UciEngine(FAIRY_PATH);
  await e.init();
  while (next < todo.length) {
    const fen = todo[next++];
    await e.newGame(); // independent of position order (deterministic labels)
    const r = await e.go(fen, [], `depth ${depth}`);
    const s = parseInfoScore(r.info);
    const stm = fen.split(' ')[1] === 'w' ? 1 : -1;
    appendFileSync(outFile, JSON.stringify({ fen, cpW: s.cp !== undefined ? s.cp * stm : null, mateW: s.mate !== undefined ? s.mate * stm : null, depth: s.depth }) + '\n');
    if (++count % 2000 === 0) console.log(count, 'labelled', ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
  e.quit();
}
await Promise.all(Array.from({ length: nEng }, worker));
console.log('finished', count);
process.exit(0);
