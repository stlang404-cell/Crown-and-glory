/**
 * Re-verify every candidate puzzle with the reproducible policy (src/academy/verify.ts) using a worker
 * pool; failures are dropped (never shipped), multi-move lines are truncated to their verified prefix.
 * Writes src/academy/data/puzzles.json and tools/academy/verification-report.json.
 *   npx tsx tools/academy/verify_puzzles.ts <candidates.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

if (isMainThread) {
  const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const cands = src.puzzles as { id: string; solution: string[]; solutionSan: string[]; playerMoves: number; themes: string[]; verification: { gap: number } }[];
  const n = Math.max(1, os.cpus().length);
  const parts = await Promise.all(Array.from({ length: n }, (_, k) => new Promise<{ id: string; ok: boolean; gap: number; steps: number }[]>((res, rej) => {
    const w = new Worker(new URL('./verify-boot.mjs', import.meta.url), { workerData: cands.filter((_, i) => i % n === k) });
    w.on('message', res); w.on('error', rej);
  })));
  const res = new Map(parts.flat().map(r => [r.id, r]));
  const kept = [];
  let dropped = 0, truncated = 0;
  for (const p of cands) {
    const r = res.get(p.id)!;
    if (!r.ok && r.steps === 0) { dropped++; continue; }
    const keep = { ...p, verification: { ...p.verification, gap: +r.gap.toFixed(3), policy: 'crown-puzzle-verify-1 (fresh TT)' } };
    if (!r.ok || r.steps < p.playerMoves) {
      truncated++;
      const len = r.steps * 2 - 1;
      keep.solution = p.solution.slice(0, len); keep.solutionSan = p.solutionSan.slice(0, len); keep.playerMoves = r.steps;
      keep.themes = keep.themes.filter(t => t !== 'calculation' || r.steps >= 2);
    }
    kept.push(keep);
  }
  const out = { ...src, verification: 'crown-puzzle-verify-1', count: kept.length, puzzles: kept };
  writeFileSync(new URL('../../src/academy/data/puzzles.json', import.meta.url), JSON.stringify(out));
  writeFileSync(new URL('./verification-report.json', import.meta.url), JSON.stringify({ candidates: cands.length, kept: kept.length, dropped, truncated, at: new Date().toISOString() }, null, 1));
  console.log({ candidates: cands.length, kept: kept.length, dropped, truncated });
  process.exit(0);
} else {
  const { Searcher } = await import('../../src/engine/search');
  const { verifyPuzzle } = await import('../../src/academy/verify');
  const s = new Searcher(18);
  const out = (workerData as { id: string; fen: string; solution: string[] }[]).map(p => ({ id: p.id, ...verifyPuzzle(s, p) }));
  parentPort!.postMessage(out);
}
