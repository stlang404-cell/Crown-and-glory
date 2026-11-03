/** FROZEN COPY of src/engine/search.ts at crown-search-1 (M3 head) — the M4 baseline opponent. Do not edit. */
/**
 * Crown search (engine id crown-search-1): iterative-deepening PVS negamax with aspiration windows,
 * transposition table, check-aware quiescence, killer/history ordering, SEE capture pruning in
 * quiescence, null-move pruning, late-move reductions, mate-distance pruning and repetition-aware
 * draw detection. Every technique can be toggled for ablation benchmarks (tools/bench).
 *
 * Scores are integers in centipawns from the side-to-move perspective; |score| >= MATE_BOUND
 * encodes a mate distance in plies (MATE - plies).
 */
import { Position } from '../../../src/rules/position';
import { Move, KING, PAWN, QUEEN, moveFrom, movePromo, moveTo, Color, KNIGHT, ROOK, WHITE } from '../../../src/rules/types';
import { KING_TARGETS, KNIGHT_TARGETS, PAWN_ATTACKERS, RAYS } from '../../../src/rules/tables';
import { DEFAULT_WEIGHTS, EvalWeights, evaluate } from './eval3';

export const SEARCH_ID = 'crown-search-1';
export const MATE = 30000;
export const MATE_BOUND = MATE - 1000;
export const INF = 32000;
export const MAX_PLY = 96;

const SEE_VALUE = [0, 100, 320, 480, 920, 20000];

export interface SearchFeatures {
  tt: boolean;
  quiescence: boolean;
  nullMove: boolean;
  lmr: boolean;
  aspiration: boolean;
  killers: boolean;
  history: boolean;
  seePruning: boolean;
  checkExtension: boolean;
  futility: boolean;
  /** Logarithmic late-move reductions (experiment). */
  lmrLog: boolean;
  /** Late-move pruning of quiet moves near the leaves (experiment). */
  lmp: boolean;
}

export const DEFAULT_FEATURES: SearchFeatures = {
  tt: true,
  quiescence: true,
  nullMove: true,
  lmr: true,
  aspiration: true,
  killers: true,
  history: true,
  seePruning: true,
  checkExtension: true,
  futility: true,
  lmrLog: false,
  lmp: false,
};

export interface SearchLimits {
  depth?: number;
  nodes?: number;
  /** Hard wall-clock budget in ms. */
  timeMs?: number;
}

export interface IterationInfo {
  depth: number;
  seldepth: number;
  score: number;
  bestMove: Move;
  pv: Move[];
  nodes: number;
  timeMs: number;
}

export type StopReason = 'depth' | 'nodes' | 'time' | 'mate' | 'single-move' | 'external';

export interface SearchResult {
  bestMove: Move;
  score: number;
  depth: number;
  seldepth: number;
  nodes: number;
  qnodes: number;
  timeMs: number;
  pv: Move[];
  iterations: IterationInfo[];
  stopReason: StopReason;
  ttHits: number;
}

export interface SearchOptions {
  limits: SearchLimits;
  features?: Partial<SearchFeatures>;
  weights?: EvalWeights;
  /** Restrict the root to these moves (must be legal). */
  rootMoves?: Move[];
  onIteration?: (info: IterationInfo) => void;
  /** Return as soon as a forced single legal move exists (play mode only). */
  stopOnSingleMove?: boolean;
  now?: () => number;
}

class StopSearch extends Error {}

const TT_EXACT = 1, TT_LOWER = 2, TT_UPPER = 3;

/** Fixed-size transposition table backed by typed arrays. */
export class TranspositionTable {
  readonly mask: number;
  keys: Int32Array;
  moves: Uint16Array;
  scores: Int16Array;
  depths: Int8Array;
  flags: Uint8Array;
  constructor(bits = 18) {
    const size = 1 << bits;
    this.mask = size - 1;
    this.keys = new Int32Array(size);
    this.moves = new Uint16Array(size);
    this.scores = new Int16Array(size);
    this.depths = new Int8Array(size);
    this.flags = new Uint8Array(size);
  }
  clear(): void {
    this.keys.fill(0); this.moves.fill(0); this.scores.fill(0); this.depths.fill(0); this.flags.fill(0);
  }
  /** Approximate memory footprint in bytes. */
  get bytes(): number {
    return (this.mask + 1) * (4 + 2 + 2 + 1 + 1);
  }
}

export function scoreToTT(score: number, ply: number): number {
  if (score >= MATE_BOUND) return score + ply;
  if (score <= -MATE_BOUND) return score - ply;
  return score;
}
export function scoreFromTT(score: number, ply: number): number {
  if (score >= MATE_BOUND) return score - ply;
  if (score <= -MATE_BOUND) return score + ply;
  return score;
}

export const isMateScore = (s: number): boolean => Math.abs(s) >= MATE_BOUND;
/** Signed plies to mate from side-to-move perspective (positive = side to move mates). */
export const mateInPlies = (s: number): number => (s > 0 ? MATE - s : -(MATE + s));

export class Searcher {
  tt: TranspositionTable;
  private pos!: Position;
  private features: SearchFeatures = DEFAULT_FEATURES;
  private weights: EvalWeights = DEFAULT_WEIGHTS;
  private killers = new Uint16Array(MAX_PLY * 2);
  private history = new Int32Array(2 * 36 * 36);
  private pvTable = new Uint16Array(MAX_PLY * MAX_PLY);
  private pvLen = new Uint8Array(MAX_PLY);
  private moveBufs: Int32Array[] = [];
  private scoreBufs: Int32Array[] = [];
  private nodes = 0;
  private qnodes = 0;
  private ttHits = 0;
  private seldepth = 0;
  private nodeLimit = Infinity;
  private deadline = Infinity;
  private now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  private rootIndex = 0;
  private rootMovesFilter: Move[] | null = null;

  constructor(ttBits = 18) {
    this.tt = new TranspositionTable(ttBits);
    for (let i = 0; i < MAX_PLY + 4; i++) {
      this.moveBufs.push(new Int32Array(256));
      this.scoreBufs.push(new Int32Array(256));
    }
  }

  newGame(): void {
    this.tt.clear();
    this.history.fill(0);
    this.killers.fill(0);
  }

  search(position: Position, opts: SearchOptions): SearchResult {
    this.pos = position.clone();
    this.features = { ...DEFAULT_FEATURES, ...(opts.features ?? {}) };
    this.weights = opts.weights ?? DEFAULT_WEIGHTS;
    if (opts.now) this.now = opts.now;
    const start = this.now();
    const maxDepth = Math.min(opts.limits.depth ?? MAX_PLY - 8, MAX_PLY - 8);
    this.nodeLimit = opts.limits.nodes ?? Infinity;
    this.deadline = opts.limits.timeMs !== undefined ? start + opts.limits.timeMs : Infinity;
    this.nodes = 0; this.qnodes = 0; this.ttHits = 0; this.seldepth = 0;
    this.rootIndex = this.pos.ply;
    this.killers.fill(0);
    // age history
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 2;

    const legal = this.pos.legalMoves();
    const rootMoves = opts.rootMoves ? opts.rootMoves.filter(m => legal.includes(m)) : legal;
    if (rootMoves.length === 0) {
      const score = this.pos.inCheck() ? -MATE : 0;
      return {
        bestMove: 0, score, depth: 0, seldepth: 0, nodes: 0, qnodes: 0, timeMs: 0, pv: [], iterations: [],
        stopReason: 'mate', ttHits: 0,
      };
    }
    this.rootMovesFilter = opts.rootMoves ? rootMoves : null;

    const iterations: IterationInfo[] = [];
    let best: IterationInfo | null = null;
    let stopReason: StopReason = 'depth';
    if (rootMoves.length === 1 && opts.stopOnSingleMove) {
      // Still run a shallow search for a score, but stop immediately after.
    }
    let prevScore = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let score: number;
      try {
        if (this.features.aspiration && depth >= 4 && !isMateScore(prevScore)) {
          let delta = 30;
          let alpha = prevScore - delta, beta = prevScore + delta;
          for (;;) {
            score = this.searchNode(depth, alpha, beta, 0, true, false);
            if (score <= alpha) { alpha = Math.max(-INF, alpha - delta * 2); delta *= 2; }
            else if (score >= beta) { beta = Math.min(INF, beta + delta * 2); delta *= 2; }
            else break;
            if (delta > 600) { alpha = -INF; beta = INF; }
          }
        } else {
          score = this.searchNode(depth, -INF, INF, 0, true, false);
        }
      } catch (e) {
        if (e instanceof StopSearch) {
          stopReason = this.nodes >= this.nodeLimit ? 'nodes' : 'time';
          break;
        }
        throw e;
      }
      prevScore = score;
      const pv = this.extractPv();
      const info: IterationInfo = {
        depth, seldepth: this.seldepth, score, bestMove: pv[0] ?? rootMoves[0], pv,
        nodes: this.nodes + this.qnodes, timeMs: this.now() - start,
      };
      best = info;
      iterations.push(info);
      opts.onIteration?.(info);
      if (rootMoves.length === 1 && opts.stopOnSingleMove) { stopReason = 'single-move'; break; }
      if (isMateScore(score) && depth > mateInPliesAbs(score) + 1) { stopReason = 'mate'; break; }
      if (this.nodes + this.qnodes >= this.nodeLimit) { stopReason = 'nodes'; break; }
      const elapsed = this.now() - start;
      // Do not start an iteration we very likely cannot finish (branching factor heuristic).
      if (this.deadline !== Infinity && start + elapsed * 2.5 > this.deadline) { stopReason = 'time'; break; }
    }
    if (!best) {
      // Depth 1 could not complete (extremely small budget): fall back to the first ordered legal move.
      best = { depth: 0, seldepth: 0, score: 0, bestMove: rootMoves[0], pv: [rootMoves[0]], nodes: this.nodes, timeMs: this.now() - start };
    }
    return {
      bestMove: best.bestMove,
      score: best.score,
      depth: best.depth,
      seldepth: best.seldepth,
      nodes: this.nodes + this.qnodes,
      qnodes: this.qnodes,
      timeMs: this.now() - start,
      pv: validatePv(position, best.pv),
      iterations,
      stopReason,
      ttHits: this.ttHits,
    };
  }

  /**
   * Exact (full-window) scores for each given root move at a fixed depth, from the root side-to-move
   * perspective. Used by analysis so that the played move and alternatives share one search policy.
   */
  scoreRootMoves(position: Position, moves: Move[], depth: number, opts: { features?: Partial<SearchFeatures>; weights?: EvalWeights; nodeLimitPerMove?: number } = {}): { move: Move; score: number; pv: Move[]; nodes: number }[] {
    this.pos = position.clone();
    this.features = { ...DEFAULT_FEATURES, ...(opts.features ?? {}) };
    this.weights = opts.weights ?? DEFAULT_WEIGHTS;
    this.rootIndex = this.pos.ply;
    this.rootMovesFilter = null;
    this.deadline = Infinity;
    const out: { move: Move; score: number; pv: Move[]; nodes: number }[] = [];
    for (const m of moves) {
      this.nodes = 0; this.qnodes = 0;
      this.nodeLimit = opts.nodeLimitPerMove ?? Infinity;
      this.pos.makeMove(m);
      let score: number;
      let pv: Move[] = [m];
      try {
        score = -this.searchNode(depth - 1, -INF, INF, 1, true, false);
        pv = [m, ...this.extractPvFrom(1)];
      } catch (e) {
        if (!(e instanceof StopSearch)) throw e;
        score = NaN;
      }
      this.pos.unmakeMove();
      out.push({ move: m, score, pv: validatePv(position, pv), nodes: this.nodes + this.qnodes });
    }
    return out;
  }

  private extractPv(): Move[] {
    return this.extractPvFrom(0);
  }
  private extractPvFrom(ply: number): Move[] {
    const len = this.pvLen[ply];
    const out: Move[] = [];
    for (let i = 0; i < len; i++) out.push(this.pvTable[ply * MAX_PLY + ply + i]);
    return out;
  }

  private checkLimits(): void {
    if (this.nodes + this.qnodes >= this.nodeLimit) throw new StopSearch();
    if (((this.nodes + this.qnodes) & 1023) === 0 && this.deadline !== Infinity && this.now() >= this.deadline) throw new StopSearch();
  }

  private searchNode(depth: number, alpha: number, beta: number, ply: number, pvNode: boolean, wasNull: boolean): number {
    const pos = this.pos;
    this.pvLen[ply] = ply;
    if (ply > this.seldepth) this.seldepth = ply;
    if (ply > 0) {
      if (pos.halfmove >= 100) {
        // 100-halfmove rule is claimable; checkmate still takes precedence.
        if (pos.inCheck() && !pos.hasLegalMove()) return -MATE + ply;
        return 0;
      }
      if (pos.isRepeatedSince(this.rootIndex).repeated) return 0;
      // mate distance pruning
      const mAlpha = Math.max(alpha, -MATE + ply);
      const mBeta = Math.min(beta, MATE - ply - 1);
      if (mAlpha >= mBeta) return mAlpha;
      alpha = mAlpha; beta = mBeta;
    }
    if (ply >= MAX_PLY - 2) return evaluate(pos, this.weights);
    const inCheck = pos.inCheck();
    if (inCheck && this.features.checkExtension && ply < MAX_PLY / 2) depth++;
    if (depth <= 0) return this.features.quiescence ? this.qsearch(alpha, beta, ply) : evaluate(pos, this.weights);

    this.nodes++;
    this.checkLimits();

    const tt = this.tt;
    const idx = pos.hashLo & tt.mask;
    let ttMove = 0;
    if (this.features.tt && tt.keys[idx] === pos.hashHi && tt.flags[idx]) {
      ttMove = tt.moves[idx];
      if (ply > 0 && !pvNode && tt.depths[idx] >= depth) {
        const s = scoreFromTT(tt.scores[idx], ply);
        const f = tt.flags[idx];
        this.ttHits++;
        if (f === TT_EXACT || (f === TT_LOWER && s >= beta) || (f === TT_UPPER && s <= alpha)) return s;
      }
    }

    const staticEval = inCheck ? -INF : evaluate(pos, this.weights);

    // Reverse futility pruning (static null move) near the leaves.
    if (this.features.futility && !pvNode && !inCheck && depth <= 3 && !isMateScore(beta) && staticEval - 110 * depth >= beta) {
      return staticEval;
    }

    // Null-move pruning, guarded against pawn-only zugzwang positions.
    if (this.features.nullMove && !pvNode && !inCheck && !wasNull && depth >= 3 && staticEval >= beta && hasPieces(pos, pos.side)) {
      const R = 2 + (depth >= 6 ? 1 : 0);
      pos.makeNullMove();
      let s: number;
      try {
        s = -this.searchNode(depth - 1 - R, -beta, -beta + 1, ply + 1, false, true);
      } finally {
        pos.unmakeNullMove();
      }
      if (s >= beta) return isMateScore(s) ? beta : s;
    }

    const moves = this.moveBufs[ply];
    const scores = this.scoreBufs[ply];
    let n = pos.generatePseudo(moves);
    if (ply === 0 && this.rootMovesFilter) {
      let k = 0;
      for (let i = 0; i < n; i++) if (this.rootMovesFilter.includes(moves[i])) moves[k++] = moves[i];
      n = k;
    }
    this.scoreMoves(moves, scores, n, ttMove, ply);

    let bestScore = -INF;
    let bestMove = 0;
    let legal = 0;
    const origAlpha = alpha;
    const us = pos.side;
    for (let i = 0; i < n; i++) {
      // selection sort step
      let bi = i;
      for (let j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      if (bi !== i) {
        const tm = moves[i]; moves[i] = moves[bi]; moves[bi] = tm;
        const ts = scores[i]; scores[i] = scores[bi]; scores[bi] = ts;
      }
      const m = moves[i];
      const isCapture = pos.board[moveTo(m)] !== 0;
      const isPromo = movePromo(m) !== 0;
      pos.makeMove(m);
      if (pos.lastMoveLeftKingInCheck()) { pos.unmakeMove(); continue; }
      legal++;
      const givesCheck = pos.inCheck();
      let s: number;
      try {
        if (legal === 1) {
          s = -this.searchNode(depth - 1, -beta, -alpha, ply + 1, pvNode, false);
        } else {
          const quiet = !inCheck && !givesCheck && !isCapture && !isPromo && scores[i] < 800000;
          if (this.features.lmp && quiet && !pvNode && depth <= 3 && legal > 3 + depth * depth * 2 && bestScore > -MATE_BOUND) {
            continue; // pruned (the finally block unmakes the move)
          }
          let reduction = 0;
          if (this.features.lmr && depth >= 3 && legal > 3 && quiet) {
            if (this.features.lmrLog) {
              reduction = Math.floor(0.75 + (Math.log(depth) * Math.log(legal)) / 2.25);
              if (pvNode) reduction--;
              if (scores[i] >= 850000) reduction--; // killers
              reduction = Math.max(0, Math.min(reduction, depth - 2));
            } else {
              reduction = legal > 8 ? 2 : 1;
              if (pvNode) reduction = Math.max(0, reduction - 1);
            }
          }
          s = -this.searchNode(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, false, false);
          if (s > alpha && reduction > 0) s = -this.searchNode(depth - 1, -alpha - 1, -alpha, ply + 1, false, false);
          if (s > alpha && s < beta) s = -this.searchNode(depth - 1, -beta, -alpha, ply + 1, true, false);
        }
      } finally {
        pos.unmakeMove();
      }
      if (s > bestScore) {
        bestScore = s;
        bestMove = m;
        if (s > alpha) {
          alpha = s;
          // update PV
          const base = ply * MAX_PLY;
          this.pvTable[base + ply] = m;
          const childLen = this.pvLen[ply + 1];
          for (let k = ply + 1; k < childLen; k++) this.pvTable[base + k] = this.pvTable[(ply + 1) * MAX_PLY + k];
          this.pvLen[ply] = Math.max(childLen, ply + 1);
          if (s >= beta) {
            if (!isCapture && !isPromo) {
              if (this.features.killers && this.killers[ply * 2] !== m) {
                this.killers[ply * 2 + 1] = this.killers[ply * 2];
                this.killers[ply * 2] = m;
              }
              if (this.features.history) {
                const h = us * 1296 + moveFrom(m) * 36 + moveTo(m);
                this.history[h] = Math.min(this.history[h] + depth * depth, 1 << 20);
              }
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;

    if (this.features.tt) {
      const flag = bestScore >= beta ? TT_LOWER : bestScore > origAlpha ? TT_EXACT : TT_UPPER;
      if (tt.keys[idx] !== pos.hashHi || depth >= tt.depths[idx] || flag === TT_EXACT) {
        tt.keys[idx] = pos.hashHi;
        tt.moves[idx] = bestMove;
        tt.scores[idx] = scoreToTT(bestScore, ply);
        tt.depths[idx] = depth;
        tt.flags[idx] = flag;
      }
    }
    return bestScore;
  }

  private qsearch(alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    this.qnodes++;
    this.checkLimits();
    this.pvLen[ply] = ply;
    if (ply > this.seldepth) this.seldepth = ply;
    if (ply >= MAX_PLY - 2) return evaluate(pos, this.weights);
    const inCheck = pos.inCheck();
    let bestScore: number;
    if (inCheck) {
      // No stand-pat while in check: every legal evasion is examined.
      bestScore = -MATE + ply;
    } else {
      const stand = evaluate(pos, this.weights);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      bestScore = stand;
    }
    const moves = this.moveBufs[ply];
    const scores = this.scoreBufs[ply];
    const n = pos.generatePseudo(moves, !inCheck);
    this.scoreMoves(moves, scores, n, 0, ply);
    let legal = 0;
    for (let i = 0; i < n; i++) {
      let bi = i;
      for (let j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      if (bi !== i) {
        const tm = moves[i]; moves[i] = moves[bi]; moves[bi] = tm;
        const ts = scores[i]; scores[i] = scores[bi]; scores[bi] = ts;
      }
      const m = moves[i];
      if (!inCheck && this.features.seePruning && movePromo(m) === 0 && see(pos, m) < 0) continue;
      pos.makeMove(m);
      if (pos.lastMoveLeftKingInCheck()) { pos.unmakeMove(); continue; }
      legal++;
      let s: number;
      try {
        s = -this.qsearch(-beta, -alpha, ply + 1);
      } finally {
        pos.unmakeMove();
      }
      if (s > bestScore) {
        bestScore = s;
        if (s > alpha) {
          alpha = s;
          const base = ply * MAX_PLY;
          this.pvTable[base + ply] = m;
          const childLen = this.pvLen[ply + 1];
          for (let k = ply + 1; k < childLen; k++) this.pvTable[base + k] = this.pvTable[(ply + 1) * MAX_PLY + k];
          this.pvLen[ply] = Math.max(childLen, ply + 1);
          if (s >= beta) break;
        }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return bestScore;
  }

  private scoreMoves(moves: Int32Array, scores: Int32Array, n: number, ttMove: number, ply: number): void {
    const b = this.pos.board;
    const us = this.pos.side;
    const k1 = this.killers[ply * 2], k2 = this.killers[ply * 2 + 1];
    for (let i = 0; i < n; i++) {
      const m = moves[i];
      if (m === ttMove) { scores[i] = 10_000_000; continue; }
      const victim = b[moveTo(m)] & 7;
      const attacker = b[moveFrom(m)] & 7;
      const promo = movePromo(m);
      if (victim || promo) {
        let s = 1_000_000 + SEE_VALUE[victim] * 10 - SEE_VALUE[attacker] / 100 + (promo === QUEEN ? 9000 : promo ? 1000 : 0);
        if (victim && SEE_VALUE[attacker] > SEE_VALUE[victim] && see(this.pos, m) < 0) s = 200_000 + SEE_VALUE[victim];
        scores[i] = s;
      } else if (m === k1) scores[i] = 900_000;
      else if (m === k2) scores[i] = 850_000;
      else scores[i] = this.features.history ? Math.min(this.history[us * 1296 + moveFrom(m) * 36 + moveTo(m)], 700_000) : 0;
    }
  }
}

function mateInPliesAbs(s: number): number {
  return Math.abs(mateInPlies(s));
}

function hasPieces(pos: Position, color: Color): boolean {
  for (let sq = 0; sq < 36; sq++) {
    const p = pos.board[sq];
    if (p && (p >> 3) === color) {
      const t = p & 7;
      if (t !== PAWN && t !== KING) return true;
    }
  }
  return false;
}

/** Keep only the legal prefix of a principal variation (defence in depth: every displayed PV is legal). */
export function validatePv(root: Position, pv: Move[]): Move[] {
  const p = root.clone();
  const out: Move[] = [];
  for (const m of pv) {
    if (!m || !p.legalMoves().includes(m)) break;
    out.push(m);
    p.makeMove(m);
  }
  return out;
}

/** Least valuable attacker of `sq` belonging to `color` on the (temporarily modified) board; -1 if none. */
function leastValuableAttacker(pos: Position, sq: number, color: Color): number {
  const b = pos.board;
  const flag = color << 3;
  const pa = PAWN_ATTACKERS[color][sq];
  for (let i = 0; i < pa.length; i++) if (b[pa[i]] === (PAWN | flag)) return pa[i];
  const kn = KNIGHT_TARGETS[sq];
  for (let i = 0; i < kn.length; i++) if (b[kn[i]] === (KNIGHT | flag)) return kn[i];
  let rookSq = -1, queenSq = -1;
  const rays = RAYS[sq];
  for (let d = 0; d < 8; d++) {
    const ray = rays[d];
    for (let i = 0; i < ray.length; i++) {
      const p = b[ray[i]];
      if (!p) continue;
      if ((p >> 3) === color) {
        const t = p & 7;
        if (t === ROOK && d < 4 && rookSq < 0) rookSq = ray[i];
        else if (t === QUEEN && queenSq < 0) queenSq = ray[i];
      }
      break;
    }
  }
  if (rookSq >= 0) return rookSq;
  if (queenSq >= 0) return queenSq;
  const kg = KING_TARGETS[sq];
  for (let i = 0; i < kg.length; i++) if (b[kg[i]] === (KING | flag)) return kg[i];
  return -1;
}

/** Static exchange evaluation of a capture from the mover's perspective (centipawns). */
export function see(pos: Position, m: Move): number {
  const b = pos.board;
  const from = moveFrom(m), to = moveTo(m);
  const gain: number[] = [];
  const removed: [number, number][] = [];
  let d = 0;
  gain[0] = SEE_VALUE[b[to] & 7];
  let onSquare = SEE_VALUE[b[from] & 7];
  let side = (pos.side ^ 1) as Color;
  removed.push([from, b[from]]);
  b[from] = 0;
  for (;;) {
    const att = leastValuableAttacker(pos, to, side);
    if (att < 0) break;
    d++;
    gain[d] = onSquare - gain[d - 1];
    onSquare = SEE_VALUE[b[att] & 7];
    removed.push([att, b[att]]);
    b[att] = 0;
    side = (side ^ 1) as Color;
    if (Math.max(-gain[d - 1], gain[d]) < 0) break;
  }
  for (let i = removed.length - 1; i >= 0; i--) b[removed[i][0]] = removed[i][1];
  for (let k = d; k > 0; k--) gain[k - 1] = -Math.max(-gain[k - 1], gain[k]);
  return gain[0];
}

export const colorName = (c: Color): 'white' | 'black' => (c === WHITE ? 'white' : 'black');
