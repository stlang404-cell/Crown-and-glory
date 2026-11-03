/**
 * Tactical corpus: positions sampled from the oracle fixture where Fairy-Stockfish (depth 14,
 * MultiPV 2) finds a uniquely best move — a forced mate, or a ≥ 250 cp gap to the second move.
 * The reference engine is independent of the Crown engine, so solve rates are not self-graded.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { UciEngine } from './uci';
import { FAIRY_PATH } from './players';

const fx = JSON.parse(readFileSync(new URL('../../tests/fixtures/oracle_positions.json', import.meta.url), 'utf8')).positions as { fen: string; moves: string[] }[];
const e = new UciEngine(FAIRY_PATH);
await e.init();
e.send('setoption name MultiPV value 2');
const items: { fen: string; best: string[]; kind: string; gapCp: number | null }[] = [];
let scanned = 0;
for (let i = 0; i < fx.length && items.length < 150; i += 7) {
  const r = fx[i];
  if (r.moves.length < 3) continue;
  scanned++;
  e.lines = [];
  e.send(`position fen ${r.fen}`);
  e.send('go depth 14');
  await e.wait(l => l.startsWith('bestmove'));
  const last = (k: number) => [...e.lines].reverse().find(l => l.startsWith('info depth 14 ') && l.includes(` multipv ${k} `)) ?? '';
  const parse = (l: string) => ({ cp: /score cp (-?\d+)/.exec(l)?.[1], mate: /score mate (-?\d+)/.exec(l)?.[1], mv: / pv (\S+)/.exec(l)?.[1] });
  const a = parse(last(1)), b = parse(last(2));
  if (!a.mv || !b.mv) continue;
  if (a.mate && +a.mate > 0 && !(b.mate && +b.mate > 0)) items.push({ fen: r.fen, best: [a.mv], kind: `mate-in-${a.mate}`, gapCp: null });
  else if (a.cp && b.cp && +a.cp - +b.cp >= 250 && Math.abs(+a.cp) < 2000) items.push({ fen: r.fen, best: [a.mv], kind: 'material', gapCp: +a.cp - +b.cp });
}
e.quit();
writeFileSync(new URL('./tactics.json', import.meta.url), JSON.stringify({ generator: `${e.name} depth 14 MultiPV 2; unique best (mate, or >=250cp gap)`, scanned, count: items.length, items }, null, 1));
console.log('scanned', scanned, 'items', items.length);
process.exit(0);
