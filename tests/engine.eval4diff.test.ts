/**
 * v0.9 differential tests for the optimised crown-eval-4 (incremental material/PST, pawn cache, shared attack
 * maps): evaluate4 must equal the frozen v0.8 reference (tests/helpers/eval4Reference.ts) exactly — score,
 * trace coefficients and trace scale — on ≥ 100 000 positions, under plain and styled weights, with positions
 * reached both from FEN and incrementally (make/unmake, null moves). Also checks that Position's incremental
 * evaluation state equals a from-scratch recomputation at every node of perft trees.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Position } from '../src/rules';
import { mulberry32 } from '../src/rules/tables';
import { NUM_PAIRS, evaluate4, setTrace, lastTraceScale, type Eval4Weights } from '../src/engine/eval4';
import { EVAL4_WEIGHTS } from '../src/engine/evaluate';
import { styledWeights } from '../src/engine/styles';
import { evaluate4Reference, referenceTraceScale } from './helpers/eval4Reference';

const corpus = (JSON.parse(readFileSync(new URL('../tools/bench/tune/positions.json', import.meta.url), 'utf8')) as { positions: { fen: string }[] }).positions.map(p => p.fen);

const P = EVAL4_WEIGHTS.p;
const perturb = (seed: number) => { const r = mulberry32(seed); return Int32Array.from(P, v => v + ((r() % 41) - 20)); };
const OWN = perturb(11), OPP = perturb(23);
const WEIGHTS: Eval4Weights[] = [
  EVAL4_WEIGHTS,
  { version: 4, p: P, own: OWN, opp: OPP, simplify: 40, styleColor: 0 },
  { version: 4, p: P, own: OWN, opp: OPP, simplify: 40, styleColor: 1 },
  { version: 4, p: P, own: OWN, styleColor: 1 },
  { version: 4, p: P, opp: OPP }, // style arrays without styleColor: both sides read `opp`
  { version: 4, p: P, simplify: 100, styleColor: 0 },
  { version: 4, p: OWN },
];
for (const s of ['tactical', 'positional', 'aggressive', 'defensive', 'endgame'] as const) {
  const sw = styledWeights(s, EVAL4_WEIGHTS);
  if (sw && sw.weights.version === 4) for (const c of [0, 1] as const) WEIGHTS.push({ ...sw.weights, styleColor: c });
}

const trA = new Float64Array(NUM_PAIRS), trB = new Float64Array(NUM_PAIRS);
let evaluated = 0, traced = 0;
function check(pos: Position, w: Eval4Weights, trace: boolean): void {
  const ref = evaluate4Reference(pos, w);
  const got = evaluate4(pos, w);
  if (got !== ref) expect({ fen: pos.toFen(), w: WEIGHTS.indexOf(w), got }).toEqual({ fen: pos.toFen(), w: WEIGHTS.indexOf(w), got: ref });
  evaluated++;
  if (trace) {
    trA.fill(0); trB.fill(0);
    evaluate4Reference(pos, w, trA);
    const refScale = referenceTraceScale();
    setTrace(trB);
    const t = evaluate4(pos, w);
    setTrace(null);
    expect(t).toBe(ref);
    expect(lastTraceScale()).toBe(refScale);
    for (let i = 0; i < NUM_PAIRS; i++) if (trA[i] !== trB[i]) expect({ fen: pos.toFen(), pair: i, v: trB[i] }).toEqual({ fen: pos.toFen(), pair: i, v: trA[i] });
    traced++;
  }
}

function randomLegal(pos: Position, rng: () => number): number | null {
  const ms = pos.legalMoves();
  return ms.length ? ms[rng() % ms.length] : null;
}

/** From-scratch recomputation of Position's incremental evaluation state. */
function expectIncrementalConsistent(pos: Position): void {
  const fresh = Position.fromFen(pos.toFen());
  fresh.setPsqTable(pos.psqTab);
  expect(Array.from(pos.pieceCnt)).toEqual(Array.from(fresh.pieceCnt));
  expect(Array.from(pos.pawnBits)).toEqual(Array.from(fresh.pawnBits));
  expect(Array.from(pos.occ)).toEqual(Array.from(fresh.occ));
  expect(pos.psqMg).toBe(fresh.psqMg);
  expect(pos.psqEg).toBe(fresh.psqEg);
}

describe('crown-eval-4 v0.9 optimisations are exact', () => {
  it('evaluate4 == v0.8 reference on ≥ 100 000 positions (corpus + make/unmake/null-move walks + random games), all weight sets, trace path', () => {
    const rng = mulberry32(0x5eed);
    let k = 0;
    for (let i = 0; i < corpus.length; i++) {
      const pos = Position.fromFen(corpus[i]);
      const trace = i % 16 === 0;
      check(pos, WEIGHTS[k++ % WEIGHTS.length], trace);
      let made = 0;
      for (let d = 0; d < 2; d++) {
        const m = randomLegal(pos, rng);
        if (m === null) break;
        pos.makeMove(m); made++;
        check(pos, WEIGHTS[k++ % WEIGHTS.length], trace);
      }
      if (!pos.inCheck()) { pos.makeNullMove(); check(pos, WEIGHTS[k++ % WEIGHTS.length], trace); pos.unmakeNullMove(); }
      while (made--) pos.unmakeMove();
      check(pos, WEIGHTS[k++ % WEIGHTS.length], false);
      if (i % 997 === 0) expectIncrementalConsistent(pos);
    }
    // random games from the start position: promotions, checks, mates, stalemates, bare kings (mop-up)
    for (let g = 0; g < 400; g++) {
      const r = mulberry32(1000 + g);
      const pos = Position.start();
      for (let ply = 0; ply < 160; ply++) {
        const m = randomLegal(pos, r);
        if (m === null) break;
        pos.makeMove(m);
        check(pos, WEIGHTS[k++ % WEIGHTS.length], ply % 8 === 0);
      }
      expectIncrementalConsistent(pos);
    }
    expect(evaluated).toBeGreaterThanOrEqual(100_000);
    expect(traced).toBeGreaterThan(5_000);
    console.log(`eval4 differential: ${evaluated} evaluations (${traced} traced) identical to the reference`);
  }, 600_000);

  it('incremental state equals a from-scratch recomputation at every node of perft trees', () => {
    const tab = new Int32Array(16 * 36 * 2);
    const r = mulberry32(77);
    for (let i = 72; i < tab.length; i++) tab[i] = (r() % 2001) - 1000; // piece code 0 (empty) must map to 0
    const fens = corpus.filter((_, i) => i % 487 === 0).slice(0, 200);
    let nodes = 0;
    const walk = (pos: Position, depth: number) => {
      expectIncrementalConsistent(pos);
      nodes++;
      if (depth === 0) return;
      for (const m of pos.legalMoves()) {
        const h = pos.hashKey(), f = pos.toFen();
        pos.makeMove(m);
        walk(pos, depth - 1);
        pos.unmakeMove();
        expect(pos.hashKey()).toBe(h);
        expect(pos.toFen()).toBe(f);
      }
    };
    for (const f of fens) { const p = Position.fromFen(f); p.setPsqTable(tab); walk(p, 2); }
    expect(nodes).toBeGreaterThan(10_000);
  }, 600_000);
});
