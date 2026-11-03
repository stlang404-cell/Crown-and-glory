/**
 * Search-speed probe (v0.8): fixed 300k-node searches from 24 benchmark openings with the canonical play
 * configuration. Prints nodes, time, nodes/s and a checksum of best moves + scores, so behaviour-preserving
 * optimisations can be verified (identical checksum) and their speed measured.
 *   npx tsx tools/bench/speed_probe.ts [nodes=300000] [positions=24]
 */
import { Position } from '../../src/rules/position';
import { parseLegalCcn, moveToCcn } from '../../src/rules/notation';
import { Searcher } from '../../src/engine/search';
import { CANON_OPTS } from '../../src/engine/canonical';
import { readFileSync } from 'node:fs';

const N = +(process.argv[2] ?? 300_000), P = +(process.argv[3] ?? 24);
const ops = JSON.parse(readFileSync(new URL('./openings.json', import.meta.url), 'utf8')).openings as string[][];
const fens = ops.slice(0, P).map(o => { const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'); for (const m of o) p.makeMove(parseLegalCcn(p, m)); return p.toFen(); });
const s = new Searcher(18);
let nodes = 0, sig = '';
const t0 = performance.now();
for (const f of fens) { s.newGame(); const r = s.search(Position.fromFen(f), { limits: { nodes: N }, ...CANON_OPTS }); nodes += r.nodes; sig += `${moveToCcn(r.bestMove)}:${r.score}:${r.depth};`; }
const ms = performance.now() - t0;
let h = 0; for (let i = 0; i < sig.length; i++) h = (Math.imul(h, 31) + sig.charCodeAt(i)) | 0;
console.log(JSON.stringify({ positions: fens.length, nodes, ms: Math.round(ms), nps: Math.round((nodes / ms) * 1000), checksum: (h >>> 0).toString(16) }));
