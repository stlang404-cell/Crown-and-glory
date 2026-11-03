/**
 * Crown engine benchmark harness.
 *
 *   FAIRY_STOCKFISH=/path/to/stockfish npx tsx tools/bench/run.ts <command> [options]
 *
 * Commands:
 *   speed                      repeated fixed-depth/time searches → nodes/s median & p95
 *   tactics                    solve rate on the Fairy-Stockfish-verified tactical corpus
 *   match <A> <B> [pairs]      colour-swapped opening-pair match between two named specs
 *   suite <ablation|vsfairy|calibrate> [pairs]
 * Results are written to tools/bench/results/*.json. Fairy-Stockfish is a development-only
 * reference opponent (GPL-3.0) and is never bundled with the game.
 */
import { Worker } from 'node:worker_threads';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import { Spec, specId } from './specs';
import { buildOpenings } from './openings';
import { GameRecord, pairBootstrap, scoreFor, eloFromScore } from './match';
import { Position } from '../../src/rules/position';
import { moveToCcn } from '../../src/rules/notation';
import { Searcher, SEARCH_ID } from '../../src/engine/search';
import { EVAL_ID } from '../../src/engine/evaluate';

const RESULTS = new URL('./results/', import.meta.url);
mkdirSync(RESULTS, { recursive: true });

export const REGISTRY: Record<string, Spec> = {
  full40k: { kind: 'config', id: 'full40k', nodes: 40_000 },
  noNull40k: { kind: 'config', id: 'noNull40k', nodes: 40_000, features: { nullMove: false } },
  noLmr40k: { kind: 'config', id: 'noLmr40k', nodes: 40_000, features: { lmr: false } },
  noFut40k: { kind: 'config', id: 'noFut40k', nodes: 40_000, features: { futility: false } },
  noAsp40k: { kind: 'config', id: 'noAsp40k', nodes: 40_000, features: { aspiration: false } },
  noTT40k: { kind: 'config', id: 'noTT40k', nodes: 40_000, features: { tt: false } },
  noSee40k: { kind: 'config', id: 'noSee40k', nodes: 40_000, features: { seePruning: false } },
  noQ40k: { kind: 'config', id: 'noQ40k', nodes: 40_000, features: { quiescence: false } },
  full160k: { kind: 'config', id: 'full160k', nodes: 160_000 },
  fairy1k: { kind: 'fairy', id: 'fairy-n1k', limit: 'nodes 1000' },
  fairy4k: { kind: 'fairy', id: 'fairy-n4k', limit: 'nodes 4000' },
  fairy16k: { kind: 'fairy', id: 'fairy-n16k', limit: 'nodes 16000' },
  fairy64k: { kind: 'fairy', id: 'fairy-n64k', limit: 'nodes 64000' },
  fairy256k: { kind: 'fairy', id: 'fairy-n256k', limit: 'nodes 256000' },
  fairy1s: { kind: 'fairy', id: 'fairy-1s', limit: 'movetime 1000' },
};
for (let l = 1; l <= 8; l++) REGISTRY[`L${l}`] = { kind: 'level', level: l, timeCapMs: l === 8 ? 2000 : undefined };

function pool(n: number) {
  const workers: Worker[] = [];
  const queue: { job: unknown; resolve: (g: GameRecord) => void; reject: (e: unknown) => void }[] = [];
  const idle: Worker[] = [];
  const pending = new Map<number, { resolve: (g: GameRecord) => void; reject: (e: unknown) => void; w: Worker }>();
  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop()!;
      const q = queue.shift()!;
      const job = q.job as { id: number };
      pending.set(job.id, { resolve: q.resolve, reject: q.reject, w });
      w.postMessage(job);
    }
  };
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./worker-boot.mjs', import.meta.url));
    w.on('message', (msg: { id: number; game?: GameRecord; error?: string }) => {
      const p = pending.get(msg.id)!;
      pending.delete(msg.id);
      idle.push(p.w);
      if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg.game!);
      pump();
    });
    workers.push(w); idle.push(w);
  }
  let nextId = 1;
  return {
    run(job: Record<string, unknown>): Promise<GameRecord> {
      return new Promise((resolve, reject) => { queue.push({ job: { ...job, id: nextId++ }, resolve, reject }); pump(); });
    },
    close() { workers.forEach(w => w.terminate()); },
  };
}

interface MatchSummary {
  a: string; b: string; pairs: number; games: number; wins: number; draws: number; losses: number; capped: number; illegal: number;
  score: number; scoreCI: [number, number]; eloDiff: number | null; eloCI: [number | null, number | null];
  avgDepth: Record<string, number>; avgNodes: Record<string, number>; avgMs: Record<string, number>; reasons: Record<string, number>;
}

async function match(p: ReturnType<typeof pool>, A: Spec, B: Spec, openings: string[][], pairs: number, seed = 1): Promise<{ summary: MatchSummary; games: GameRecord[] }> {
  const a = specId(A), b = specId(B);
  const chosen = openings.slice(0, pairs);
  const jobs = chosen.flatMap((op, i) => [
    p.run({ white: A, black: B, opening: op, seed: seed * 7919 + i * 2 }),
    p.run({ white: B, black: A, opening: op, seed: seed * 7919 + i * 2 + 1 }),
  ]);
  const games = await Promise.all(jobs);
  const pairScores: number[] = [];
  let wins = 0, draws = 0, losses = 0, capped = 0, illegal = 0;
  const reasons: Record<string, number> = {};
  const agg: Record<string, { d: number; n: number; ms: number; m: number }> = {};
  for (let i = 0; i < games.length; i += 2) {
    const s1 = scoreFor(a, games[i]), s2 = scoreFor(a, games[i + 1]);
    if (s1 !== null && s2 !== null) pairScores.push((s1 + s2) / 2);
  }
  for (const g of games) {
    reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
    if (g.reason === 'illegal-move') illegal++;
    const s = scoreFor(a, g);
    if (s === null) capped++; else if (s === 1) wins++; else if (s === 0) losses++; else draws++;
    for (const [k, v] of Object.entries(g.stats)) {
      const id = k.split('#')[0];
      agg[id] ??= { d: 0, n: 0, ms: 0, m: 0 };
      agg[id].d += v.depth; agg[id].n += v.nodes; agg[id].ms += v.ms; agg[id].m += v.moves;
    }
  }
  const score = pairScores.length ? pairScores.reduce((x, y) => x + y, 0) / pairScores.length : NaN;
  const ci = pairBootstrap(pairScores);
  const finite = (x: number) => (x > 0.001 && x < 0.999 ? Math.round(eloFromScore(x)) : null);
  const summary: MatchSummary = {
    a, b, pairs: chosen.length, games: games.length, wins, draws, losses, capped, illegal, score, scoreCI: ci,
    eloDiff: finite(score), eloCI: [finite(ci[0]), finite(ci[1])],
    avgDepth: Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, +(v.d / Math.max(1, v.m)).toFixed(2)])),
    avgNodes: Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, Math.round(v.n / Math.max(1, v.m))])),
    avgMs: Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, Math.round(v.ms / Math.max(1, v.m))])),
    reasons,
  };
  console.log(`${a} vs ${b}: +${wins} =${draws} -${losses} (cap ${capped}, illegal ${illegal}) score ${score.toFixed(3)} CI [${ci.map(x => x.toFixed(3)).join(', ')}] elo ${summary.eloDiff} [${summary.eloCI.join(', ')}]`);
  return { summary, games };
}

function env() {
  return { node: process.version, platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length, searchId: SEARCH_ID, evalId: EVAL_ID, date: new Date().toISOString() };
}

async function speed() {
  const fens = [
    'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    'r1qk1r/pp1ppp/2n1n1/2p3/PPPPPP/RNQKNR w - - 0 4',
    'r2k1r/1p3p/2n3/3Q2/PP3P/R2K1R b - - 0 1',
    '3k2/1p3p/6/1P2P1/6/3K2 w - - 0 1',
    '2rk2/1q3p/p1n3/3N2/PP1Q1P/3K1R w - - 0 20',
  ];
  const out: Record<string, unknown>[] = [];
  for (const fen of fens) {
    const samples: { nps: number; depth: number; ms: number }[] = [];
    for (let rep = 0; rep < 5; rep++) {
      const s = new Searcher(18);
      const r = s.search(Position.fromFen(fen), { limits: { timeMs: 1000 } });
      samples.push({ nps: r.nodes / (r.timeMs / 1000), depth: r.depth, ms: r.timeMs });
    }
    const nps = samples.map(x => x.nps).sort((a, b) => a - b);
    const depths = samples.map(x => x.depth).sort((a, b) => a - b);
    out.push({ fen, npsMedian: Math.round(nps[2]), npsMin: Math.round(nps[0]), depthMedian: depths[2], depthRange: [depths[0], depths[4]] });
    console.log(fen, Math.round(nps[2]), 'nps median, depth', depths[2]);
  }
  writeFileSync(new URL('speed.json', RESULTS), JSON.stringify({ env: env(), budget: '1000 ms per search, 5 repetitions, fresh TT', results: out }, null, 1));
}

async function tactics() {
  const file = new URL('./tactics.json', import.meta.url);
  if (!existsSync(file)) throw new Error('tactics.json missing: run tools/bench/build_tactics.ts');
  const suite = JSON.parse(readFileSync(file, 'utf8')) as { items: { fen: string; best: string[]; kind: string }[] };
  const budgets = [10_000, 40_000, 160_000, 640_000];
  const res: Record<string, unknown> = {};
  for (const nodes of budgets) {
    let solved = 0;
    const s = new Searcher(18);
    for (const it of suite.items) {
      s.newGame();
      const r = s.search(Position.fromFen(it.fen), { limits: { nodes } });
      if (it.best.includes(moveToCcn(r.bestMove))) solved++;
    }
    res[nodes] = { solved, total: suite.items.length, rate: +(solved / suite.items.length).toFixed(3) };
    console.log(`tactics @${nodes} nodes: ${solved}/${suite.items.length}`);
  }
  writeFileSync(new URL('tactics.json', RESULTS), JSON.stringify({ env: env(), suite: 'tools/bench/tactics.json', results: res }, null, 1));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'speed') return speed();
  if (cmd === 'tactics') return tactics();
  const openings = await buildOpenings();
  const threads = Math.max(1, os.cpus().length);
  const p = pool(threads);
  try {
    if (cmd === 'match') {
      const [A, B, pairs] = args;
      const r = await match(p, REGISTRY[A], REGISTRY[B], openings, +(pairs ?? 20));
      writeFileSync(new URL(`match-${A}-vs-${B}.json`, RESULTS), JSON.stringify({ env: env(), ...r }, null, 1));
    } else if (cmd === 'suite') {
      const [name, pairsArg] = args;
      const pairs = +(pairsArg ?? 20);
      const plan: [string, string][] =
        name === 'ablation' ? [['full40k', 'noNull40k'], ['full40k', 'noLmr40k'], ['full40k', 'noFut40k'], ['full40k', 'noAsp40k'], ['full40k', 'noSee40k'], ['full40k', 'noTT40k'], ['full40k', 'noQ40k'], ['full160k', 'full40k']]
        : name === 'vsfairy' ? [['full40k', 'fairy1k'], ['full40k', 'fairy4k'], ['full40k', 'fairy16k'], ['full160k', 'fairy16k'], ['full160k', 'fairy64k']]
        : name === 'calibrate' ? [['L2', 'L1'], ['L3', 'L2'], ['L4', 'L3'], ['L5', 'L4'], ['L6', 'L5'], ['L7', 'L6'], ['L8', 'L7'], ['L3', 'L1'], ['L5', 'L3'], ['L7', 'L5'], ['L6', 'fairy16k'], ['L7', 'fairy64k']]
        : [];
      if (!plan.length) throw new Error('unknown suite');
      const summaries: MatchSummary[] = [];
      const allGames: Record<string, GameRecord[]> = {};
      for (const [A, B] of plan) {
        const r = await match(p, REGISTRY[A], REGISTRY[B], openings, pairs);
        summaries.push(r.summary);
        allGames[`${A}-vs-${B}`] = r.games;
        writeFileSync(new URL(`suite-${name}.json`, RESULTS), JSON.stringify({ env: env(), pairsPerMatch: pairs, openings: 'tools/bench/openings.json', summaries }, null, 1));
      }
      writeFileSync(new URL(`suite-${name}-games.json`, RESULTS), JSON.stringify(allGames));
    } else throw new Error('usage: run.ts speed|tactics|match A B [pairs]|suite name [pairs]');
  } finally { p.close(); }
}

main().catch(e => { console.error(e); process.exit(1); });
