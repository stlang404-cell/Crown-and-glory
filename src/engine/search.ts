/**
 * Crown search (profiles crown-search-1 = defaults, crown-search-2 = PLAY_FEATURES): iterative-deepening PVS negamax with aspiration windows,
 * transposition table, check-aware quiescence, killer/history ordering, SEE capture pruning in
 * quiescence, null-move pruning, late-move reductions, mate-distance pruning and repetition-aware
 * draw detection. Every technique can be toggled for ablation benchmarks (tools/bench); the M4
 * additions (docs/M4_ENGINE_STRENGTH.md) are individually switchable so each one could be measured.
 *
 * Node-limited searches are fully deterministic (no clock reads influence the tree), which federation
 * games rely on.
 *
 * Scores are integers in centipawns from the side-to-move perspective; |score| >= MATE_BOUND
 * encodes a mate distance in plies (MATE - plies).
 */
import { Position } from '../rules/position';
import { Move, Color, WHITE } from '../rules/types';
import { KING_TARGETS, KNIGHT_TARGETS, PAWN_ATTACKERS, RAYS } from '../rules/tables';
import { DEFAULT_WEIGHTS, EvalWeights, evaluate } from './evaluate';

/**
 * Identifier of the DEFAULT search profile: with DEFAULT_FEATURES this code reproduces crown-search-1 node for
 * node (analysis, puzzle verification and assistance rely on that). Play uses PLAY_FEATURES = crown-search-2.
 */
export const SEARCH_ID = 'crown-search-1';
export const PLAY_SEARCH_ID = 'crown-search-2';
export const MATE = 30000;
export const MATE_BOUND = MATE - 1000;
export const INF = 32000;
export const MAX_PLY = 96;

// Module-local copies of rule constants/tables (hot loops read locals instead of imported bindings).
const P_PAWN = 1, P_KNIGHT = 2, P_ROOK = 3, P_QUEEN = 4, P_KING = 5;
const KNT = KNIGHT_TARGETS, KGT = KING_TARGETS, PAT = PAWN_ATTACKERS, RAY = RAYS;

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
  /** Logarithmic late-move reductions (M2 experiment, rejected). */
  lmrLog: boolean;
  /** Late-move pruning of quiet moves near the leaves (M2 experiment, rejected). */
  lmp: boolean;
  // ---- M4 experiments ----
  /** Two-slot TT buckets with depth/age-preferred replacement (instead of always-replace). */
  ttBucket: boolean;
  /** TT probe/store in quiescence (requires ttBucket). */
  qsTT: boolean;
  /** History with gravity (bounded) + malus for quiets that failed before the cutoff move; bad captures last. */
  histGravity: boolean;
  /** Countermove heuristic. */
  counterMove: boolean;
  /** Table-driven LMR adjusted by history, improving, PV and killer status. */
  lmr2: boolean;
  /** Forward futility pruning of quiet moves at depth ≤ 3. */
  fwdFutility: boolean;
  /** Razoring at depth ≤ 2. */
  razoring: boolean;
  /** Null-move reduction growing with depth and eval margin. */
  nullAdaptive: boolean;
  /** Internal iterative reduction when no TT move exists at depth ≥ 4. */
  iir: boolean;
  /** Delta pruning in quiescence. */
  deltaPruning: boolean;
  /** SEE pruning of losing captures in the main search at depth ≤ 4. */
  seeMain: boolean;
  /** Extend pawn pushes to the 5th relative rank (one step from promotion). */
  pawnExt: boolean;
  /** Reverse futility up to depth 6 with an improving-aware margin. */
  rfpDeep: boolean;
  /** Singular extension of the TT move (with multi-cut). */
  singular: boolean;
  /** v0.7: when time runs out mid-iteration, play a root move that already fully beat the previous best. */
  partialRoot: boolean;
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
  ttBucket: false,
  qsTT: false,
  histGravity: false,
  counterMove: false,
  lmr2: false,
  fwdFutility: false,
  razoring: false,
  nullAdaptive: false,
  iir: false,
  deltaPruning: false,
  seeMain: false,
  pawnExt: false,
  rfpDeep: false,
  singular: false,
  partialRoot: false,
};

/** The crown-search-1 feature set (all M4 additions off): reproduces the M3 engine node for node. */
export const SEARCH1_FEATURES: SearchFeatures = { ...DEFAULT_FEATURES };
/** crown-search-2: the play profile (M4 additions accepted by paired matches; docs/M4_ENGINE_STRENGTH.md). */
export const PLAY_FEATURES: SearchFeatures = { ...DEFAULT_FEATURES, fwdFutility: true, deltaPruning: true };

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
  /** Draw value in cp from the root side's view is −contempt (positive = avoids draws). Default 0. */
  contempt?: number;
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
  gens: Uint8Array;
  constructor(bits = 18) {
    const size = 1 << bits;
    this.mask = size - 1;
    this.keys = new Int32Array(size);
    this.moves = new Uint16Array(size);
    this.scores = new Int16Array(size);
    this.depths = new Int8Array(size);
    this.flags = new Uint8Array(size);
    this.gens = new Uint8Array(size);
  }
  clear(): void {
    this.keys.fill(0); this.moves.fill(0); this.scores.fill(0); this.depths.fill(0); this.flags.fill(0); this.gens.fill(0);
  }
  /** Approximate memory footprint in bytes. */
  get bytes(): number {
    return (this.mask + 1) * (4 + 2 + 2 + 1 + 1 + 1);
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

/** LMR table: reductions by depth and move number (lmr2). */
const LMR_TABLE = new Int8Array(64 * 64);
for (let d = 1; d < 64; d++) for (let m = 1; m < 64; m++) LMR_TABLE[d * 64 + m] = Math.floor(0.5 + (Math.log(d) * Math.log(m)) / 2.1);

const HIST_MAX = 16384;

export class Searcher {
  tt: TranspositionTable;
  private pos!: Position;
  private features: SearchFeatures = DEFAULT_FEATURES;
  private weights: EvalWeights = DEFAULT_WEIGHTS;
  private killers = new Uint16Array(MAX_PLY * 2);
  private history = new Int32Array(2 * 36 * 36);
  private counters = new Uint16Array(2 * 36 * 36);
  private moveStack = new Int32Array(MAX_PLY + 4);
  private evalStack = new Int32Array(MAX_PLY + 4);
  private pvTable = new Uint16Array(MAX_PLY * MAX_PLY);
  private pvLen = new Uint8Array(MAX_PLY);
  private moveBufs: Int32Array[] = [];
  private scoreBufs: Int32Array[] = [];
  private quietBufs: Int32Array[] = [];
  private nodes = 0;
  private qnodes = 0;
  private ttHits = 0;
  private seldepth = 0;
  private nodeLimit = Infinity;
  private deadline = Infinity;
  private gen = 0;
  private contempt = 0;
  private now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  private rootMovesFilter: Move[] | null = null;
  /** Best root move found so far in the current (possibly unfinished) iteration (partialRoot). */
  private rootBest: Move = 0;
  private rootBestScore = 0;

  constructor(ttBits = 18) {
    this.tt = new TranspositionTable(ttBits);
    for (let i = 0; i < MAX_PLY + 4; i++) {
      this.moveBufs.push(new Int32Array(256));
      this.scoreBufs.push(new Int32Array(256));
      this.quietBufs.push(new Int32Array(256));
    }
  }

  newGame(): void {
    this.tt.clear();
    this.history.fill(0);
    this.killers.fill(0);
    this.counters.fill(0);
    this.gen = 0;
  }

  private setup(position: Position, features: Partial<SearchFeatures> | undefined, weights: EvalWeights | undefined, contempt: number | undefined): void {
    this.pos = position.clone();
    this.features = { ...DEFAULT_FEATURES, ...(features ?? {}) };
    if (this.features.qsTT && !this.features.ttBucket) this.features.qsTT = false;
    this.weights = weights ?? DEFAULT_WEIGHTS;
    // asymmetric (styled) evaluation: the root side is the styled side
    if (this.weights.version === 4 && (this.weights.own || this.weights.opp || this.weights.simplify)) this.weights = { ...this.weights, styleColor: position.side };
    this.contempt = contempt ?? 0;
  }

  search(position: Position, opts: SearchOptions): SearchResult {
    this.setup(position, opts.features, opts.weights, opts.contempt);
    if (opts.now) this.now = opts.now;
    const start = this.now();
    const maxDepth = Math.min(opts.limits.depth ?? MAX_PLY - 8, MAX_PLY - 8);
    this.nodeLimit = opts.limits.nodes ?? Infinity;
    this.deadline = opts.limits.timeMs !== undefined ? start + opts.limits.timeMs : Infinity;
    this.nodes = 0; this.qnodes = 0; this.ttHits = 0; this.seldepth = 0;
    this.gen = (this.gen + 1) & 255;
    this.killers.fill(0);
    // age history
    const h = this.history;
    for (let i = 0; i < h.length; i++) h[i] >>= 2;

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
    let prevScore = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let score: number;
      this.rootBest = 0; this.rootBestScore = -INF;
      try {
        if (this.features.aspiration && depth >= 4 && !isMateScore(prevScore)) {
          let delta = 30;
          let alpha = prevScore - delta, beta = prevScore + delta;
          for (;;) {
            score = this.searchNode(depth, alpha, beta, 0, true, false, -1);
            if (score <= alpha) { alpha = Math.max(-INF, alpha - delta * 2); delta *= 2; }
            else if (score >= beta) { beta = Math.min(INF, beta + delta * 2); delta *= 2; }
            else break;
            if (delta > 600) { alpha = -INF; beta = INF; }
          }
        } else {
          score = this.searchNode(depth, -INF, INF, 0, true, false, -1);
        }
      } catch (e) {
        if (e instanceof StopSearch) {
          stopReason = this.nodes + this.qnodes >= this.nodeLimit ? 'nodes' : 'time';
          // partialRoot: a different root move already searched to completion in this iteration and scored above
          // the previous iteration's best is the better choice than discarding the unfinished iteration
          if (this.features.partialRoot && best && this.rootBest && this.rootBest !== best.bestMove && this.rootBestScore > best.score && !isMateScore(this.rootBestScore)) {
            best = { ...best, bestMove: this.rootBest, pv: [this.rootBest] };
          }
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
  scoreRootMoves(position: Position, moves: Move[], depth: number, opts: { features?: Partial<SearchFeatures>; weights?: EvalWeights; nodeLimitPerMove?: number; contempt?: number } = {}): { move: Move; score: number; pv: Move[]; nodes: number }[] {
    this.setup(position, opts.features, opts.weights, opts.contempt);
    this.rootMovesFilter = null;
    this.deadline = Infinity;
    const out: { move: Move; score: number; pv: Move[]; nodes: number }[] = [];
    for (const m of moves) {
      this.nodes = 0; this.qnodes = 0;
      this.nodeLimit = opts.nodeLimitPerMove ?? Infinity;
      this.pos.makeMove(m);
      this.moveStack[0] = m;
      let score: number;
      let pv: Move[] = [m];
      try {
        score = -this.searchNode(depth - 1, -INF, INF, 1, true, false, -1);
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

  /** Draw value for the side to move at `ply` (contempt is from the root side's view). */
  private drawScore(ply: number): number {
    const c = this.contempt;
    return c === 0 ? 0 : (ply & 1) === 0 ? -c : c;
  }

  /** Has the current position occurred before since the last irreversible move (allocation-free)? */
  private repeated(): boolean {
    const pos = this.pos;
    const hl = pos.histLo, hh = pos.histHi;
    const n = hl.length - 1;
    const limit = Math.max(0, n - pos.halfmove);
    const lo = pos.hashLo, hi = pos.hashHi;
    for (let i = n - 4; i >= limit; i -= 2) if (hl[i] === lo && hh[i] === hi) return true;
    return false;
  }

  /** TT slot holding the current position, or -1. */
  private ttProbe(): number {
    const tt = this.tt;
    const pos = this.pos;
    if (this.features.ttBucket) {
      const b0 = pos.hashLo & tt.mask & ~1;
      if (tt.keys[b0] === pos.hashHi && tt.flags[b0]) return b0;
      if (tt.keys[b0 + 1] === pos.hashHi && tt.flags[b0 + 1]) return b0 + 1;
      return -1;
    }
    const idx = pos.hashLo & tt.mask;
    return tt.keys[idx] === pos.hashHi && tt.flags[idx] ? idx : -1;
  }

  private ttStore(depth: number, flag: number, score: number, move: Move, ply: number): void {
    const tt = this.tt;
    const pos = this.pos;
    const hi = pos.hashHi;
    let idx: number;
    if (this.features.ttBucket) {
      const b0 = pos.hashLo & tt.mask & ~1, b1 = b0 + 1;
      if (tt.keys[b0] === hi && tt.flags[b0]) idx = b0;
      else if (tt.keys[b1] === hi && tt.flags[b1]) idx = b1;
      else {
        // victim: empty slot, else the one from an older search, else the shallower one
        const v0 = tt.flags[b0] === 0 ? -1000 : tt.depths[b0] - (tt.gens[b0] !== this.gen ? 64 : 0);
        const v1 = tt.flags[b1] === 0 ? -1000 : tt.depths[b1] - (tt.gens[b1] !== this.gen ? 64 : 0);
        idx = v1 < v0 ? b1 : b0;
        tt.keys[idx] = hi; tt.moves[idx] = move; tt.scores[idx] = scoreToTT(score, ply); tt.depths[idx] = depth; tt.flags[idx] = flag; tt.gens[idx] = this.gen;
        return;
      }
      if (depth >= tt.depths[idx] - 2 || flag === TT_EXACT || tt.gens[idx] !== this.gen) {
        if (move || tt.keys[idx] !== hi) tt.moves[idx] = move;
        tt.scores[idx] = scoreToTT(score, ply); tt.depths[idx] = depth; tt.flags[idx] = flag; tt.gens[idx] = this.gen;
      }
      return;
    }
    idx = pos.hashLo & tt.mask;
    if (tt.keys[idx] !== hi || depth >= tt.depths[idx] || flag === TT_EXACT) {
      tt.keys[idx] = hi;
      tt.moves[idx] = move;
      tt.scores[idx] = scoreToTT(score, ply);
      tt.depths[idx] = depth;
      tt.flags[idx] = flag;
    }
  }

  private updateHistory(us: number, m: Move, bonus: number): void {
    const h = us * 1296 + (m & 63) * 36 + ((m >> 6) & 63);
    if (this.features.histGravity) {
      const cur = this.history[h];
      this.history[h] = cur + bonus - Math.trunc((cur * Math.abs(bonus)) / HIST_MAX);
    } else {
      this.history[h] = Math.min(this.history[h] + bonus, 1 << 20);
    }
  }

  private searchNode(depth: number, alpha: number, beta: number, ply: number, pvNode: boolean, wasNull: boolean, inCheckIn: number, excluded = 0): number {
    const pos = this.pos;
    const F = this.features;
    this.pvLen[ply] = ply;
    if (ply > this.seldepth) this.seldepth = ply;
    if (ply > 0) {
      if (pos.halfmove >= 100) {
        // 100-halfmove rule is claimable; checkmate still takes precedence.
        if (pos.inCheck() && !pos.hasLegalMove()) return -MATE + ply;
        return this.drawScore(ply);
      }
      if (this.repeated()) return this.drawScore(ply);
      // mate distance pruning
      const mAlpha = Math.max(alpha, -MATE + ply);
      const mBeta = Math.min(beta, MATE - ply - 1);
      if (mAlpha >= mBeta) return mAlpha;
      alpha = mAlpha; beta = mBeta;
    }
    if (ply >= MAX_PLY - 2) return evaluate(pos, this.weights);
    const inCheck = inCheckIn >= 0 ? inCheckIn === 1 : pos.inCheck();
    if (inCheck && F.checkExtension && ply < MAX_PLY / 2) depth++;
    if (depth <= 0) return F.quiescence ? this.qsearch(alpha, beta, ply, inCheck) : evaluate(pos, this.weights);

    this.nodes++;
    this.checkLimits();

    const tt = this.tt;
    let ttMove = 0, ttScore = 0, ttDepth = -1, ttFlag = 0;
    if (F.tt && !excluded) {
      const slot = this.ttProbe();
      if (slot >= 0) {
        ttMove = tt.moves[slot];
        ttScore = scoreFromTT(tt.scores[slot], ply); ttDepth = tt.depths[slot]; ttFlag = tt.flags[slot];
        if (ply > 0 && !pvNode && tt.depths[slot] >= depth) {
          const s = scoreFromTT(tt.scores[slot], ply);
          const f = tt.flags[slot];
          this.ttHits++;
          if (f === TT_EXACT || (f === TT_LOWER && s >= beta) || (f === TT_UPPER && s <= alpha)) return s;
        }
      }
    }

    const staticEval = inCheck ? -INF : evaluate(pos, this.weights);
    this.evalStack[ply] = staticEval;
    const improving = !inCheck && ply >= 2 && this.evalStack[ply - 2] !== -INF && staticEval > this.evalStack[ply - 2];

    if (!pvNode && !inCheck && !excluded && !isMateScore(beta)) {
      // Reverse futility pruning (static null move) near the leaves.
      if (F.rfpDeep) {
        if (depth <= 6 && staticEval - (100 * depth - (improving ? 40 : 0)) >= beta) return staticEval;
      } else if (F.futility && depth <= 3 && staticEval - 110 * depth >= beta) {
        return staticEval;
      }
      // Razoring: hopeless quiet positions drop into quiescence.
      if (F.razoring && depth <= 2 && staticEval + 220 * depth < alpha) {
        const q = this.qsearch(alpha, alpha + 1, ply, false);
        if (q <= alpha) return q;
      }
    }

    // Null-move pruning, guarded against pawn-only zugzwang positions.
    if (F.nullMove && !pvNode && !inCheck && !wasNull && !excluded && depth >= 3 && staticEval >= beta && hasPieces(pos, pos.side)) {
      const R = F.nullAdaptive ? 3 + (depth >= 8 ? 1 : 0) + Math.min(2, Math.floor((staticEval - beta) / 200)) : 2 + (depth >= 6 ? 1 : 0);
      pos.makeNullMove();
      this.moveStack[ply] = 0;
      let s: number;
      try {
        s = -this.searchNode(depth - 1 - R, -beta, -beta + 1, ply + 1, false, true, 0);
      } finally {
        pos.unmakeNullMove();
      }
      if (s >= beta) return isMateScore(s) ? beta : s;
    }

    // Internal iterative reduction: without a TT move, this node's ordering is poor anyway.
    if (F.iir && depth >= 4 && !ttMove && !excluded) depth--;

    // Singular extension: if every alternative to the TT move fails well below its score, extend it;
    // if even the alternatives beat beta, cut (multi-cut).
    let singularExt = 0;
    if (F.singular && ply > 0 && depth >= 6 && ttMove && !excluded && ttDepth >= depth - 3 && ttFlag !== TT_UPPER && !isMateScore(ttScore) && ply < MAX_PLY / 2) {
      const sBeta = ttScore - 2 * depth;
      const sv = this.searchNode((depth - 1) >> 1, sBeta - 1, sBeta, ply, false, wasNull, inCheck ? 1 : 0, ttMove);
      if (sv < sBeta) singularExt = 1;
      else if (!pvNode && sBeta >= beta) return sBeta;
      this.pvLen[ply] = ply;
    }

    const moves = this.moveBufs[ply];
    const scores = this.scoreBufs[ply];
    const quiets = this.quietBufs[ply];
    let nQuiets = 0;
    let n = pos.generatePseudo(moves);
    if (ply === 0 && this.rootMovesFilter) {
      let k = 0;
      for (let i = 0; i < n; i++) if (this.rootMovesFilter.includes(moves[i])) moves[k++] = moves[i];
      n = k;
    }
    const us = pos.side;
    const prev = ply > 0 ? this.moveStack[ply - 1] : 0;
    const counter = F.counterMove && prev ? this.counters[(us ^ 1) * 1296 + (prev & 63) * 36 + ((prev >> 6) & 63)] : 0;
    this.scoreMoves(moves, scores, n, ttMove, ply, counter);

    let bestScore = -INF;
    let bestMove = 0;
    let legal = 0;
    const origAlpha = alpha;
    const b = pos.board;
    for (let i = 0; i < n; i++) {
      // selection sort step
      let bi = i;
      for (let j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      if (bi !== i) {
        const tm = moves[i]; moves[i] = moves[bi]; moves[bi] = tm;
        const ts = scores[i]; scores[i] = scores[bi]; scores[bi] = ts;
      }
      const m = moves[i];
      if (m === excluded) continue;
      const from = m & 63, to = (m >> 6) & 63;
      const isCapture = b[to] !== 0;
      const isPromo = ((m >> 12) & 7) !== 0;
      const movedPawn = (b[from] & 7) === P_PAWN;
      // SEE pruning of clearly losing captures at shallow depth.
      if (F.seeMain && !pvNode && !inCheck && legal > 0 && depth <= 4 && isCapture && !isPromo && bestScore > -MATE_BOUND
        && SEE_VALUE[b[from] & 7] > SEE_VALUE[b[to] & 7] && see(pos, m) < -90 * depth) continue;
      pos.makeMove(m);
      if (pos.lastMoveLeftKingInCheck()) { pos.unmakeMove(); continue; }
      legal++;
      this.moveStack[ply] = m;
      const givesCheck = pos.inCheck();
      const gc = givesCheck ? 1 : 0;
      const quietMove = !isCapture && !isPromo;
      let ext = m === ttMove ? singularExt : 0;
      if (F.pawnExt && ext === 0 && movedPawn && !isPromo && ply < MAX_PLY / 2) {
        const r = (to / 6) | 0;
        if ((us === 0 ? r : 5 - r) === 4) ext = 1;
      }
      let s: number;
      try {
        if (legal === 1) {
          s = -this.searchNode(depth - 1 + ext, -beta, -alpha, ply + 1, pvNode, false, gc);
        } else {
          const quiet = !inCheck && !givesCheck && quietMove && scores[i] < 800000;
          if (F.lmp && quiet && !pvNode && depth <= 3 && legal > 3 + depth * depth * 2 && bestScore > -MATE_BOUND) {
            continue; // pruned (the finally block unmakes the move)
          }
          if (F.fwdFutility && quiet && !pvNode && ext === 0 && depth <= 3 && bestScore > -MATE_BOUND && staticEval + 80 + 90 * depth <= alpha) {
            continue;
          }
          let reduction = 0;
          if (F.lmr2) {
            if (F.lmr && depth >= 3 && legal > 2 && quietMove && !inCheck && !givesCheck && ext === 0) {
              let r = LMR_TABLE[Math.min(depth, 63) * 64 + Math.min(legal, 63)];
              if (pvNode) r--;
              if (!improving) r++;
              if (scores[i] >= 800000) r--; // killer / countermove
              if (F.histGravity) r -= Math.trunc(this.history[us * 1296 + from * 36 + to] / 6000);
              reduction = Math.max(0, Math.min(r, depth - 2));
            }
          } else if (F.lmr && depth >= 3 && legal > 3 && quiet) {
            if (F.lmrLog) {
              reduction = Math.floor(0.75 + (Math.log(depth) * Math.log(legal)) / 2.25);
              if (pvNode) reduction--;
              if (scores[i] >= 850000) reduction--; // killers
              reduction = Math.max(0, Math.min(reduction, depth - 2));
            } else {
              reduction = legal > 8 ? 2 : 1;
              if (pvNode) reduction = Math.max(0, reduction - 1);
            }
          }
          s = -this.searchNode(depth - 1 + ext - reduction, -alpha - 1, -alpha, ply + 1, false, false, gc);
          if (s > alpha && reduction > 0) s = -this.searchNode(depth - 1 + ext, -alpha - 1, -alpha, ply + 1, false, false, gc);
          if (s > alpha && s < beta) s = -this.searchNode(depth - 1 + ext, -beta, -alpha, ply + 1, true, false, gc);
        }
      } finally {
        pos.unmakeMove();
      }
      if (s > bestScore) {
        bestScore = s;
        bestMove = m;
        if (s > alpha) {
          if (ply === 0) { this.rootBest = m; this.rootBestScore = s; }
          alpha = s;
          // update PV
          const base = ply * MAX_PLY;
          this.pvTable[base + ply] = m;
          const childLen = this.pvLen[ply + 1];
          for (let k = ply + 1; k < childLen; k++) this.pvTable[base + k] = this.pvTable[(ply + 1) * MAX_PLY + k];
          this.pvLen[ply] = Math.max(childLen, ply + 1);
          if (s >= beta) {
            if (quietMove) {
              if (F.killers && this.killers[ply * 2] !== m) {
                this.killers[ply * 2 + 1] = this.killers[ply * 2];
                this.killers[ply * 2] = m;
              }
              if (F.history) {
                if (F.histGravity) {
                  const bonus = Math.min(16 * depth * depth + 32 * depth, 2000);
                  this.updateHistory(us, m, bonus);
                  for (let k = 0; k < nQuiets; k++) this.updateHistory(us, quiets[k], -bonus);
                } else this.updateHistory(us, m, depth * depth);
              }
              if (F.counterMove && prev) this.counters[(us ^ 1) * 1296 + (prev & 63) * 36 + ((prev >> 6) & 63)] = m;
            }
            break;
          }
        }
      }
      if (quietMove && nQuiets < 256) quiets[nQuiets++] = m;
    }
    if (legal === 0) return excluded ? alpha : inCheck ? -MATE + ply : this.drawScore(ply);

    if (F.tt && !excluded) {
      const flag = bestScore >= beta ? TT_LOWER : bestScore > origAlpha ? TT_EXACT : TT_UPPER;
      this.ttStore(depth, flag, bestScore, bestMove, ply);
    }
    return bestScore;
  }

  private qsearch(alpha: number, beta: number, ply: number, inCheck: boolean): number {
    const pos = this.pos;
    const F = this.features;
    this.qnodes++;
    this.checkLimits();
    this.pvLen[ply] = ply;
    if (ply > this.seldepth) this.seldepth = ply;
    if (ply >= MAX_PLY - 2) return evaluate(pos, this.weights);
    let ttMove = 0;
    if (F.qsTT) {
      const slot = this.ttProbe();
      if (slot >= 0) {
        const s = scoreFromTT(this.tt.scores[slot], ply);
        const f = this.tt.flags[slot];
        if (f === TT_EXACT || (f === TT_LOWER && s >= beta) || (f === TT_UPPER && s <= alpha)) { this.ttHits++; return s; }
        ttMove = this.tt.moves[slot];
      }
    }
    const origAlpha = alpha;
    let bestScore: number;
    let stand = -INF;
    if (inCheck) {
      // No stand-pat while in check: every legal evasion is examined.
      bestScore = -MATE + ply;
    } else {
      stand = evaluate(pos, this.weights);
      if (stand >= beta) {
        if (F.qsTT) this.ttStore(0, TT_LOWER, stand, 0, ply);
        return stand;
      }
      if (stand > alpha) alpha = stand;
      bestScore = stand;
    }
    const moves = this.moveBufs[ply];
    const scores = this.scoreBufs[ply];
    const n = pos.generatePseudo(moves, !inCheck);
    this.scoreMoves(moves, scores, n, ttMove, ply, 0);
    const b = pos.board;
    let legal = 0;
    let bestMove = 0;
    for (let i = 0; i < n; i++) {
      let bi = i;
      for (let j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      if (bi !== i) {
        const tm = moves[i]; moves[i] = moves[bi]; moves[bi] = tm;
        const ts = scores[i]; scores[i] = scores[bi]; scores[bi] = ts;
      }
      const m = moves[i];
      const promo = (m >> 12) & 7;
      if (!inCheck && promo === 0) {
        if (F.deltaPruning && stand + SEE_VALUE[b[(m >> 6) & 63] & 7] + 150 <= alpha) continue;
        if (F.seePruning && see(pos, m) < 0) continue;
      }
      pos.makeMove(m);
      if (pos.lastMoveLeftKingInCheck()) { pos.unmakeMove(); continue; }
      legal++;
      let s: number;
      try {
        s = -this.qsearch(-beta, -alpha, ply + 1, pos.inCheck());
      } finally {
        pos.unmakeMove();
      }
      if (s > bestScore) {
        bestScore = s;
        if (s > alpha) {
          alpha = s;
          bestMove = m;
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
    if (F.qsTT) this.ttStore(0, bestScore >= beta ? TT_LOWER : bestScore > origAlpha ? TT_EXACT : TT_UPPER, bestScore, bestMove, ply);
    return bestScore;
  }

  private scoreMoves(moves: Int32Array, scores: Int32Array, n: number, ttMove: number, ply: number, counter: number): void {
    const b = this.pos.board;
    const us = this.pos.side;
    const k1 = this.killers[ply * 2], k2 = this.killers[ply * 2 + 1];
    const useHist = this.features.history;
    const grav = this.features.histGravity;
    const hist = this.history;
    for (let i = 0; i < n; i++) {
      const m = moves[i];
      if (m === ttMove) { scores[i] = 10_000_000; continue; }
      const from = m & 63, to = (m >> 6) & 63;
      const victim = b[to] & 7;
      const attacker = b[from] & 7;
      const promo = (m >> 12) & 7;
      if (victim || promo) {
        let s = 1_000_000 + SEE_VALUE[victim] * 10 - SEE_VALUE[attacker] / 100 + (promo === P_QUEEN ? 9000 : promo ? 1000 : 0);
        if (victim && SEE_VALUE[attacker] > SEE_VALUE[victim] && see(this.pos, m) < 0) s = (grav ? -200_000 : 200_000) + SEE_VALUE[victim];
        scores[i] = s;
      } else if (m === k1) scores[i] = 900_000;
      else if (m === k2) scores[i] = 850_000;
      else if (m === counter) scores[i] = 800_000;
      else scores[i] = useHist ? Math.min(hist[us * 1296 + from * 36 + to], 700_000) : 0;
    }
  }
}

function mateInPliesAbs(s: number): number {
  return Math.abs(mateInPlies(s));
}

function hasPieces(pos: Position, color: Color): boolean {
  const b = pos.board;
  for (let sq = 0; sq < 36; sq++) {
    const p = b[sq];
    if (p && (p >> 3) === color) {
      const t = p & 7;
      if (t !== P_PAWN && t !== P_KING) return true;
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
function leastValuableAttacker(b: Int8Array, sq: number, color: Color): number {
  const flag = color << 3;
  const pa = PAT[color][sq];
  for (let i = 0; i < pa.length; i++) if (b[pa[i]] === (P_PAWN | flag)) return pa[i];
  const kn = KNT[sq];
  for (let i = 0; i < kn.length; i++) if (b[kn[i]] === (P_KNIGHT | flag)) return kn[i];
  let rookSq = -1, queenSq = -1;
  const rays = RAY[sq];
  for (let d = 0; d < 8; d++) {
    const ray = rays[d];
    for (let i = 0; i < ray.length; i++) {
      const p = b[ray[i]];
      if (!p) continue;
      if ((p >> 3) === color) {
        const t = p & 7;
        if (t === P_ROOK && d < 4 && rookSq < 0) rookSq = ray[i];
        else if (t === P_QUEEN && queenSq < 0) queenSq = ray[i];
      }
      break;
    }
  }
  if (rookSq >= 0) return rookSq;
  if (queenSq >= 0) return queenSq;
  const kg = KGT[sq];
  for (let i = 0; i < kg.length; i++) if (b[kg[i]] === (P_KING | flag)) return kg[i];
  return -1;
}

const seeGain = new Int32Array(40);
const seeSq = new Int8Array(40);
const seePc = new Int8Array(40);

/** Static exchange evaluation of a capture from the mover's perspective (centipawns). */
export function see(pos: Position, m: Move): number {
  const b = pos.board;
  const from = m & 63, to = (m >> 6) & 63;
  const gain = seeGain;
  let nRemoved = 0;
  let d = 0;
  gain[0] = SEE_VALUE[b[to] & 7];
  let onSquare = SEE_VALUE[b[from] & 7];
  let side = (pos.side ^ 1) as Color;
  seeSq[nRemoved] = from; seePc[nRemoved++] = b[from];
  b[from] = 0;
  for (;;) {
    const att = leastValuableAttacker(b, to, side);
    if (att < 0) break;
    d++;
    gain[d] = onSquare - gain[d - 1];
    onSquare = SEE_VALUE[b[att] & 7];
    seeSq[nRemoved] = att; seePc[nRemoved++] = b[att];
    b[att] = 0;
    side = (side ^ 1) as Color;
    if (Math.max(-gain[d - 1], gain[d]) < 0) break;
  }
  for (let i = nRemoved - 1; i >= 0; i--) b[seeSq[i]] = seePc[i];
  for (let k = d; k > 0; k--) gain[k - 1] = -Math.max(-gain[k - 1], gain[k]);
  return gain[0];
}

export const colorName = (c: Color): 'white' | 'black' => (c === WHITE ? 'white' : 'black');
