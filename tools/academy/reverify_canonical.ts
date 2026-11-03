/**
 * v0.5 re-verification of the SHIPPED puzzle library under the canonical engine (crown-puzzle-verify-2:
 * crown-search-2 + crown-eval-4, unique best first move, best-defence replies, fresh TT per check).
 * Nothing is deleted (players' attempt records keep pointing at real puzzles):
 *  - fully verified puzzles stay active with a `canonical` record;
 *  - puzzles whose first move is no longer uniquely best, or whose first stored defence is not the engine's best
 *    reply, are marked `retired` (never served again, kept for history);
 *  - longer lines that verify only for a prefix are truncated to that prefix, recording the original line.
 *   npx tsx tools/academy/reverify_canonical.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const FILE = new URL('../../src/academy/data/puzzles.json', import.meta.url);
type Pz = { id: string; fen: string; solution: string[]; solutionSan: string[]; playerMoves: number; themes: string[]; retired?: unknown; canonical?: unknown; revisedFrom?: unknown };
if (isMainThread) {
  const src = JSON.parse(readFileSync(FILE, 'utf8')) as { puzzles: Pz[] } & Record<string, unknown>;
  const n = Math.max(1, +(process.env.THREADS ?? os.cpus().length));
  const t0 = Date.now();
  const parts = await Promise.all(Array.from({ length: n }, (_, k) => new Promise<{ id: string; ok: boolean; gap: number; steps: number; defence?: boolean }[]>((res, rej) => {
    const w = new Worker(new URL('./reverify-boot.mjs', import.meta.url), { workerData: src.puzzles.filter((_, i) => i % n === k) });
    w.on('message', res); w.on('error', rej);
  })));
  const res = new Map(parts.flat().map(r => [r.id, r]));
  let active = 0, retired = 0, truncated = 0, defence = 0;
  const puzzles = src.puzzles.map(p => {
    const r = res.get(p.id)!;
    const canonical = { verifyId: 'crown-puzzle-verify-2', engine: 'crown-search-2+crown-eval-4', ok: r.ok, gap: +r.gap.toFixed(3), steps: r.steps };
    if (r.defence === false) defence++;
    if (r.steps === 0) { retired++; return { ...p, canonical, retired: { verifyId: 'crown-puzzle-verify-2', reason: 'first move not uniquely best for the canonical engine' } }; }
    if (!r.ok || r.steps < p.playerMoves) {
      if (r.steps === 0) { retired++; return { ...p, canonical, retired: { verifyId: 'crown-puzzle-verify-2', reason: 'line not confirmed' } }; }
      truncated++; active++;
      const len = r.steps * 2 - 1;
      const themes = p.themes.filter(t => t !== 'calculation' || r.steps >= 2);
      // the verified prefix is a fully verified (shorter) puzzle
      return { ...p, canonical: { ...canonical, ok: true }, revisedFrom: { solution: p.solution, playerMoves: p.playerMoves, reason: r.defence === false ? 'stored defence was not the best reply' : 'later move not uniquely best' },
        solution: p.solution.slice(0, len), solutionSan: p.solutionSan.slice(0, len), playerMoves: r.steps, themes: themes.length ? themes : ['evaluation'] };
    }
    active++;
    return { ...p, canonical };
  });
  const report = { verifyId: 'crown-puzzle-verify-2', engine: 'crown-search-2+crown-eval-4', total: puzzles.length, active, retired, truncated, defenceRejections: defence, seconds: Math.round((Date.now() - t0) / 1000), at: new Date().toISOString() };
  writeFileSync(FILE, JSON.stringify({ ...src, engine: 'crown-search-2+crown-eval-4', verification: 'crown-puzzle-verify-2', canonicalReport: report, puzzles }));
  writeFileSync(new URL('./verification-report-v2.json', import.meta.url), JSON.stringify(report, null, 1));
  console.log(report);
  process.exit(0);
} else {
  const { Searcher } = await import('../../src/engine/search');
  const { verifyPuzzle } = await import('../../src/academy/verify');
  const s = new Searcher(18);
  // the original (pre-v0.5) line is always the one re-verified
  const out = (workerData as Pz[]).map(p => { const line = (p.revisedFrom as { solution: string[] } | undefined)?.solution ?? p.solution; return { id: p.id, ...verifyPuzzle(s, { fen: p.fen, solution: line }) }; });
  parentPort!.postMessage(out);
}
