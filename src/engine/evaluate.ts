/**
 * Static evaluation for crown-la6-v1.
 *
 * Two evaluators share one entry point, selected by the weights' `version`:
 *  - crown-eval-3 (version 3, below): the M2/M3 hand-written tapered evaluation;
 *  - crown-eval-4 (version 4, ./eval4.ts): linear-in-parameters evaluation fitted in M4.
 * Returned score is in centipawns from the side-to-move perspective.
 */
import { Position } from '../rules/position';
import { BLACK, WHITE } from '../rules/types';
import { KING_TARGETS, KNIGHT_TARGETS, RAYS } from '../rules/tables';
import { Eval4Weights, evaluate4 } from './eval4';
import { EVAL4_PARAMS } from './eval4-params';

export const EVAL_ID = 'crown-eval-3';

export interface Eval3Weights {
  version?: 3;
  material: [number, number, number, number, number, number]; // index by piece type (0,P,N,R,Q,K)
  materialEg: [number, number, number, number, number, number];
  mobility: [number, number, number, number, number, number];
  passedMg: number[]; // by relative rank 0..5
  passedEg: number[];
  kingShield: number;
  kingAttack: number;
  rookOpenFile: number;
  doubledPawn: number;
  isolatedPawn: number;
  tempo: number;
  /** Feature switches used for ablation benchmarks. */
  usePst: boolean;
  usePassed: boolean;
  useMobility: boolean;
  useKingSafety: boolean;
}

export type EvalWeights = Eval3Weights | Eval4Weights;

/** crown-eval-3 weights (M2/M3 evaluator). */
export const EVAL3_WEIGHTS: Eval3Weights = {
  material: [0, 100, 330, 470, 920, 0],
  materialEg: [0, 125, 300, 520, 960, 0],
  // crown-eval-3: mobility raised from [4,3,2] (eval-2) after +66 Elo replicated on held-out openings.
  mobility: [0, 0, 6, 5, 3, 0],
  passedMg: [0, 0, 10, 25, 50, 0],
  passedEg: [0, 0, 25, 55, 110, 0],
  kingShield: 12,
  kingAttack: 9,
  rookOpenFile: 18,
  doubledPawn: 14,
  isolatedPawn: 10,
  tempo: 10,
  usePst: true,
  usePassed: true,
  useMobility: true,
  useKingSafety: true,
};

// Piece-square tables from White's perspective, index a1=0 .. f6=35 (rank-major).
const KNIGHT_PST = [
  -30, -15, -10, -10, -15, -30,
  -15, 0, 8, 8, 0, -15,
  -10, 8, 18, 18, 8, -10,
  -10, 10, 20, 20, 10, -10,
  -15, 5, 12, 12, 5, -15,
  -30, -15, -10, -10, -15, -30,
];
const PAWN_PST_MG = [
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  4, 6, 12, 12, 6, 4,
  10, 14, 22, 22, 14, 10,
  30, 34, 40, 40, 34, 30,
  0, 0, 0, 0, 0, 0,
];
const PAWN_PST_EG = [
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  10, 10, 10, 10, 10, 10,
  25, 25, 25, 25, 25, 25,
  55, 55, 55, 55, 55, 55,
  0, 0, 0, 0, 0, 0,
];
const KING_PST_MG = [
  5, 10, 4, 4, 10, 5,
  -5, -8, -14, -14, -8, -5,
  -20, -25, -30, -30, -25, -20,
  -30, -35, -40, -40, -35, -30,
  -40, -45, -50, -50, -45, -40,
  -50, -50, -50, -50, -50, -50,
];
const KING_PST_EG = [
  -25, -15, -10, -10, -15, -25,
  -15, 0, 8, 8, 0, -15,
  -10, 8, 18, 18, 8, -10,
  -10, 8, 18, 18, 8, -10,
  -15, 0, 8, 8, 0, -15,
  -25, -15, -10, -10, -15, -25,
];
const CENTER_PST = [
  -6, -3, 0, 0, -3, -6,
  -3, 2, 5, 5, 2, -3,
  0, 5, 9, 9, 5, 0,
  0, 5, 9, 9, 5, 0,
  -3, 2, 5, 5, 2, -3,
  -6, -3, 0, 0, -3, -6,
];

/** ZONE[k*36+s] = 1 if s is the king square k or adjacent to it. */
const ZONE = new Uint8Array(36 * 36);
for (let k = 0; k < 36; k++) {
  ZONE[k * 36 + k] = 1;
  for (const s of KING_TARGETS[k]) ZONE[k * 36 + s] = 1;
}

const PHASE_WEIGHT = [0, 0, 1, 2, 4, 0];
export const MAX_PHASE = 20; // 2 * (2N*1 + 2R*2 + Q*4)


export function gamePhase(pos: Position): number {
  let phase = 0;
  for (let sq = 0; sq < 36; sq++) {
    const p = pos.board[sq];
    if (p) phase += PHASE_WEIGHT[p & 7];
  }
  return Math.min(phase, MAX_PHASE);
}

// Module-local copies of rule constants and tables: hot loops read plain locals instead of imported
// bindings (measurably faster under Node module loaders; identical results).
const P_PAWN = 1, P_KNIGHT = 2, P_ROOK = 3, P_QUEEN = 4, P_KING = 5;
const KNT = KNIGHT_TARGETS, RAY = RAYS;
const FILE = new Int8Array(36), RANK = new Int8Array(36), MIRROR = new Int8Array(36);
for (let sq = 0; sq < 36; sq++) { FILE[sq] = sq % 6; RANK[sq] = (sq / 6) | 0; MIRROR[sq] = (5 - RANK[sq]) * 6 + FILE[sq]; }
const pawnFilesBuf = new Int8Array(12);
const kingZoneBuf = new Int32Array(2);

/** crown-eval-4 weights (fitted parameters in eval4-params.ts). */
export const EVAL4_WEIGHTS: Eval4Weights = { version: 4, p: Int32Array.from(EVAL4_PARAMS) };

export const DEFAULT_WEIGHTS: EvalWeights = EVAL3_WEIGHTS;

/** Overlay partial weights on a base set (fields of the base's own evaluator version). */
export function mergeWeights(base: EvalWeights, partial?: Partial<Eval3Weights> | Partial<Eval4Weights>): EvalWeights {
  return { ...base, ...(partial ?? {}) } as EvalWeights;
}

export function evaluate(pos: Position, wAny: EvalWeights = DEFAULT_WEIGHTS): number {
  if (wAny.version === 4) return evaluate4(pos, wAny);
  const w = wAny;
  const b = pos.board;
  let mg = 0, eg = 0, phase = 0;
  // pawn counts per file per colour: index c * 6 + file
  const pawnFiles = pawnFilesBuf;
  pawnFiles.fill(0);
  for (let sq = 0; sq < 36; sq++) {
    const p = b[sq];
    if ((p & 7) === P_PAWN) pawnFiles[(p >> 3) * 6 + FILE[sq]]++;
  }
  const kingZoneAttacks = kingZoneBuf;
  kingZoneAttacks[0] = 0; kingZoneAttacks[1] = 0;
  const kingSq = pos.kingSq;

  for (let sq = 0; sq < 36; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = p & 7;
    const c = p >> 3;
    const rel = c === 0 ? sq : MIRROR[sq];
    phase += PHASE_WEIGHT[t];
    let smg = w.material[t];
    let seg = w.materialEg[t];
    const enemyKing = kingSq[c ^ 1];
    const zoneBase = enemyKing * 36;

    if (t === P_PAWN) {
      if (w.usePst) { smg += PAWN_PST_MG[rel]; seg += PAWN_PST_EG[rel]; }
      const f = FILE[sq];
      const relRank = RANK[rel];
      const own = c * 6;
      if (pawnFiles[own + f] > 1) { smg -= w.doubledPawn; seg -= w.doubledPawn; }
      const left = f > 0 ? pawnFiles[own + f - 1] : 0;
      const right = f < 5 ? pawnFiles[own + f + 1] : 0;
      if (!left && !right) { smg -= w.isolatedPawn; seg -= w.isolatedPawn; }
      if (w.usePassed && isPassed(pos, sq, c)) {
        smg += w.passedMg[relRank];
        seg += w.passedEg[relRank];
        // free path bonus
        const ahead = c === 0 ? sq + 6 : sq - 6;
        if (ahead >= 0 && ahead < 36 && b[ahead] === 0) seg += w.passedEg[relRank] >> 2;
      }
    } else if (t === P_KNIGHT) {
      if (w.usePst) { smg += KNIGHT_PST[rel]; seg += KNIGHT_PST[rel] >> 1; }
      const tg = KNT[sq];
      let mob = 0;
      for (let i = 0; i < tg.length; i++) {
        const q = b[tg[i]];
        if (!q || (q >> 3) !== c) mob++;
        if (ZONE[zoneBase + tg[i]]) kingZoneAttacks[c]++;
      }
      if (w.useMobility) { smg += w.mobility[P_KNIGHT] * (mob - 4); seg += w.mobility[P_KNIGHT] * (mob - 4); }
    } else if (t === P_ROOK || t === P_QUEEN) {
      if (w.usePst) { smg += CENTER_PST[rel] >> (t === P_ROOK ? 1 : 0); }
      const rays = RAY[sq];
      const dEnd = t === P_ROOK ? 4 : 8;
      let mob = 0;
      for (let d = 0; d < dEnd; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          const s2 = ray[i];
          const q = b[s2];
          if (!q || (q >> 3) !== c) mob++;
          if (ZONE[zoneBase + s2]) kingZoneAttacks[c]++;
          if (q) break;
        }
      }
      if (w.useMobility) {
        const base = t === P_ROOK ? 5 : 9;
        smg += w.mobility[t] * (mob - base);
        seg += w.mobility[t] * (mob - base);
      }
      if (t === P_ROOK) {
        const f = FILE[sq];
        if (!pawnFiles[c * 6 + f]) {
          const bonus = pawnFiles[(c ^ 1) * 6 + f] ? w.rookOpenFile >> 1 : w.rookOpenFile;
          smg += bonus; seg += bonus >> 1;
        }
      }
    } else if (t === P_KING) {
      if (w.usePst) { smg += KING_PST_MG[rel]; seg += KING_PST_EG[rel]; }
      if (w.useKingSafety) {
        // pawn shield directly in front
        const fwd = c === 0 ? 6 : -6;
        const f = FILE[sq];
        const ownPawn = P_PAWN | (c << 3);
        let shield = 0;
        for (let df = -1; df <= 1; df++) {
          const nf = f + df;
          if (nf < 0 || nf > 5) continue;
          const s2 = sq + fwd + df;
          if (s2 >= 0 && s2 < 36 && b[s2] === ownPawn) shield++;
        }
        smg += shield * w.kingShield;
      }
    }
    if (c === 0) { mg += smg; eg += seg; } else { mg -= smg; eg -= seg; }
  }

  if (w.useKingSafety) {
    // attackers near king: quadratic-ish penalty, middlegame only
    const atkW = kingZoneAttacks[0], atkB = kingZoneAttacks[1];
    mg += w.kingAttack * (atkW * atkW) / 4 - w.kingAttack * (atkB * atkB) / 4;
  }

  const ph = Math.min(phase, MAX_PHASE);
  let score = ((mg * ph) + (eg * (MAX_PHASE - ph))) / MAX_PHASE;
  // Lone-king-ish endgames: drive enemy king to edge when ahead with mating material.
  score += mopUp(pos, score);
  score = Math.round(score);
  const stm = pos.side === 0 ? score : -score;
  return stm + w.tempo;
}

function isPassed(pos: Position, sq: number, c: number): boolean {
  const f = FILE[sq], r = RANK[sq];
  const enemyPawn = P_PAWN | ((c ^ 1) << 3);
  const b = pos.board;
  for (let df = -1; df <= 1; df++) {
    const nf = f + df;
    if (nf < 0 || nf > 5) continue;
    if (c === 0) {
      for (let nr = r + 1; nr < 6; nr++) if (b[nr * 6 + nf] === enemyPawn) return false;
    } else {
      for (let nr = r - 1; nr >= 0; nr--) if (b[nr * 6 + nf] === enemyPawn) return false;
    }
  }
  return true;
}

function mopUp(pos: Position, whiteScore: number): number {
  if (Math.abs(whiteScore) < 400) return 0;
  const strong = whiteScore > 0 ? WHITE : BLACK;
  const weak = strong ^ 1;
  const b = pos.board;
  for (let sq = 0; sq < 36; sq++) { const p = b[sq]; if (p && (p >> 3) === weak && (p & 7) !== P_KING) return 0; }
  const wk = pos.kingSq[weak], sk = pos.kingSq[strong];
  const centerDist = Math.max(Math.abs(FILE[wk] * 2 - 5), Math.abs(RANK[wk] * 2 - 5));
  const kingDist = Math.max(Math.abs(FILE[wk] - FILE[sk]), Math.abs(RANK[wk] - RANK[sk]));
  const bonus = centerDist * 10 + (6 - kingDist) * 6;
  return strong === WHITE ? bonus : -bonus;
}
