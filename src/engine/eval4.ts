/**
 * Evaluation crown-eval-4: a tapered evaluation that is LINEAR in its parameters (every term adds
 * coefficient × (mg, eg) parameter pair), so the parameters can be fitted by logistic regression
 * (tools/bench/tune). Non-tuned extras: mop-up toward the edge against a bare king and a drawish-material
 * scale factor. Score in centipawns from the side-to-move perspective.
 *
 * Parameter layout: pair i occupies p[2i] (middlegame) and p[2i+1] (endgame). Square tables are indexed
 * from each side's own perspective (Black's squares mirrored by rank), a1 = 0 … f6 = 35.
 */
import type { Position } from '../rules/position';
import { KING_TARGETS, KNIGHT_TARGETS, PAWN_ATTACKS, RAYS } from '../rules/tables';

const P_PAWN = 1, P_KNIGHT = 2, P_ROOK = 3, P_QUEEN = 4, P_KING = 5;

// ---- parameter layout (pair indices) ----
let next = 0;
const alloc = (n: number) => { const s = next; next += n; return s; };
export const OFF = {
  MAT: alloc(6), // by piece type (0 and 5 unused)
  PST: alloc(6 * 36), // [type * 36 + relSq]
  MOB: alloc(6), // per safe target beyond a base count, by type (N, R, Q, K)
  PASSED: alloc(6), // by relative rank
  PASSED_FREE: alloc(6), // passed pawn with an empty square ahead, by relative rank
  PASSED_OWNK: alloc(1), // × king distance of own king to the square ahead (scaled by rank)
  PASSED_ENK: alloc(1), // × king distance of the enemy king to the square ahead (scaled by rank)
  DOUBLED: alloc(1),
  ISOLATED: alloc(1),
  SUPPORTED: alloc(1), // pawn defended by a pawn
  PHALANX: alloc(1), // pawn with a friendly pawn beside it
  KING_SHIELD: alloc(1),
  KING_ATTACK: alloc(1), // × (attacks on the enemy king zone)² / 4
  KING_ATTACKERS: alloc(1), // × number of pieces attacking the enemy king zone
  ROOK_OPEN: alloc(1),
  ROOK_SEMI: alloc(1),
  THREAT_PAWN: alloc(1), // pawn attacks an enemy knight/rook/queen
  THREAT_MINOR: alloc(1), // knight attacks an enemy rook/queen
  THREAT_ROOK: alloc(1), // rook attacks an enemy queen
  HANGING: alloc(1), // enemy non-pawn piece attacked and undefended
  TEMPO: alloc(1),
  // ---- appended in the second fit (older parameter arrays stay a valid prefix) ----
  MOBT: alloc(6 * 16), // safe-mobility table by type and count (on top of the linear MOB term)
  OUTPOST: alloc(1), // knight on relative rank 3–5 defended by a pawn and not attackable by enemy pawns
  TROPISM: alloc(6), // × (6 − king distance to the enemy king), by type
  UNSTOPPABLE: alloc(1), // passed pawn outside the enemy king's square while the enemy has no pieces
  KING_OPEN: alloc(1), // × own king file and neighbours without own pawns (0–3)
} as const;
export const NUM_PAIRS = next;
/** Parameter array of the current layout from a (possibly shorter, older-layout) list; missing terms are 0. */
export function paramsFrom(list: ArrayLike<number>): Int32Array {
  const p = new Int32Array(NUM_PAIRS * 2);
  for (let i = 0; i < Math.min(list.length, p.length); i++) p[i] = list[i];
  return p;
}

const MOB_BASE = [0, 0, 4, 5, 9, 3];
const PHASE_WEIGHT = [0, 0, 1, 2, 4, 0];
export const MAX_PHASE4 = 20;

const FILE = new Int8Array(36), RANK = new Int8Array(36), MIRROR = new Int8Array(36);
for (let sq = 0; sq < 36; sq++) { FILE[sq] = sq % 6; RANK[sq] = (sq / 6) | 0; MIRROR[sq] = (5 - RANK[sq]) * 6 + FILE[sq]; }
const DIST = new Int8Array(36 * 36);
for (let a = 0; a < 36; a++) for (let b = 0; b < 36; b++) DIST[a * 36 + b] = Math.max(Math.abs(FILE[a] - FILE[b]), Math.abs(RANK[a] - RANK[b]));
const ZONE = new Uint8Array(36 * 36);
for (let k = 0; k < 36; k++) { ZONE[k * 36 + k] = 1; for (const s of KING_TARGETS[k]) ZONE[k * 36 + s] = 1; }
const KNT = KNIGHT_TARGETS, KGT = KING_TARGETS, RAY = RAYS, PAWN_ATT = PAWN_ATTACKS;

export interface Eval4Weights {
  version: 4;
  /** 2 × NUM_PAIRS integers (mg, eg per pair). */
  p: Int32Array;
  /** Style parameters for the styled side's own terms (asymmetric evaluation); the search sets styleColor. */
  own?: Int32Array;
  /** Style parameters for the opponent's terms as seen by the styled side (default p). */
  opp?: Int32Array;
  /** Endgame-conversion style: bonus × (traded phase / 20) for the styled side while it is ahead. */
  simplify?: number;
  styleColor?: 0 | 1;
}

// scratch buffers (single-threaded use)
const pawnFiles = new Int8Array(12);
const attacks = new Int8Array(72); // attack counts per colour per square
const pawnAtt = new Int8Array(72); // pawn attack counts per colour per square
const zoneAtt = new Int32Array(2);
const zoneAttackers = new Int32Array(2);

/** Optional coefficient trace for tuning: trace[pair] += signed coefficient. */
let TRACE: Float64Array | null = null;
let traceScale = 1;
export function setTrace(t: Float64Array | null): void { TRACE = t; }
/** Scale factor applied to the last traced evaluation (drawish material). */
export function lastTraceScale(): number { return traceScale; }

// hot-path copies of the layout offsets
const { MAT: O_MAT, PST: O_PST, MOB: O_MOB, PASSED: O_PASSED, PASSED_FREE: O_PASSED_FREE, PASSED_OWNK: O_PASSED_OWNK, PASSED_ENK: O_PASSED_ENK, DOUBLED: O_DOUBLED, ISOLATED: O_ISOLATED, SUPPORTED: O_SUPPORTED, PHALANX: O_PHALANX, KING_SHIELD: O_KING_SHIELD, KING_ATTACK: O_KING_ATTACK, KING_ATTACKERS: O_KING_ATTACKERS, ROOK_OPEN: O_ROOK_OPEN, ROOK_SEMI: O_ROOK_SEMI, THREAT_PAWN: O_THREAT_PAWN, THREAT_MINOR: O_THREAT_MINOR, THREAT_ROOK: O_THREAT_ROOK, HANGING: O_HANGING, TEMPO: O_TEMPO, MOBT: O_MOBT, OUTPOST: O_OUTPOST, TROPISM: O_TROPISM, UNSTOPPABLE: O_UNSTOPPABLE, KING_OPEN: O_KING_OPEN } = OFF;

export function evaluate4(pos: Position, w: Eval4Weights): number {
  const P = w.p;
  // style: the styled side (styleColor) reads its own terms from `own`; the other side uses p
  const Q = w.own ?? P;
  const R = w.opp ?? P;
  const sc = (w.own || w.opp || w.simplify) && w.styleColor !== undefined ? w.styleColor : -1;
  const b = pos.board;
  const T = TRACE;
  let mg = 0, eg = 0, phase = 0;
  pawnFiles.fill(0); attacks.fill(0); pawnAtt.fill(0);
  zoneAtt[0] = 0; zoneAtt[1] = 0; zoneAttackers[0] = 0; zoneAttackers[1] = 0;
  const kingSq = pos.kingSq;
  let wPawns = 0, bPawns = 0, wNonPawn = 0, bNonPawn = 0;

  // pass 1: pawns (files, pawn attacks) and piece material per side
  for (let sq = 0; sq < 36; sq++) {
    const p = b[sq];
    if (!p) continue;
    if ((p & 7) !== P_PAWN) {
      if ((p & 7) !== P_KING) { if (p >> 3) bNonPawn += PHASE_WEIGHT[p & 7]; else wNonPawn += PHASE_WEIGHT[p & 7]; }
      continue;
    }
    const c = p >> 3;
    pawnFiles[c * 6 + FILE[sq]]++;
    const at = PAWN_ATT[c][sq];
    for (let i = 0; i < at.length; i++) { pawnAtt[c * 36 + at[i]]++; attacks[c * 36 + at[i]]++; }
  }

  // pass 2: pieces
  for (let sq = 0; sq < 36; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = p & 7;
    const c = p >> 3;
    const s = c === 0 ? 1 : -1;
    const Pc = c === sc ? Q : R;
    const rel = c === 0 ? sq : MIRROR[sq];
    phase += PHASE_WEIGHT[t];
    // material + square table
    let k = O_MAT + t;
    mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
    k = O_PST + t * 36 + rel;
    mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
    const enemyKing = kingSq[c ^ 1];
    const zb = enemyKing * 36;
    const own = c * 36, opp = (c ^ 1) * 36;
    if (t === P_PAWN) {
      if (c === 0) wPawns++; else bPawns++;
      const f = FILE[sq];
      const relRank = RANK[rel];
      const pf = c * 6;
      if (pawnFiles[pf + f] > 1) { k = O_DOUBLED; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      const left = f > 0 ? pawnFiles[pf + f - 1] : 0;
      const right = f < 5 ? pawnFiles[pf + f + 1] : 0;
      if (!left && !right) { k = O_ISOLATED; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      if (pawnAtt[own + sq]) { k = O_SUPPORTED; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      if ((f > 0 && b[sq - 1] === p) || (f < 5 && b[sq + 1] === p)) { k = O_PHALANX; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      if (isPassed(b, sq, c)) {
        k = O_PASSED + relRank; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
        const ahead = c === 0 ? sq + 6 : sq - 6;
        if (ahead >= 0 && ahead < 36) {
          if (b[ahead] === 0) { k = O_PASSED_FREE + relRank; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
          const rw = relRank - 1; // rank weight: 0 for rank 1 … 3 for rank 4
          if (rw > 0) {
            const dOwn = DIST[kingSq[c] * 36 + ahead] * rw, dEn = DIST[enemyKing * 36 + ahead] * rw;
            k = O_PASSED_OWNK; mg += s * Pc[2 * k] * dOwn; eg += s * Pc[2 * k + 1] * dOwn; if (T) T[k] += s * dOwn;
            k = O_PASSED_ENK; mg += s * Pc[2 * k] * dEn; eg += s * Pc[2 * k + 1] * dEn; if (T) T[k] += s * dEn;
          }
        }
        if ((c === 0 ? bNonPawn : wNonPawn) === 0) {
          const promo = c === 0 ? 30 + f : f;
          const kd = DIST[enemyKing * 36 + promo] - (pos.side !== c ? 1 : 0);
          if (5 - relRank < kd) { k = O_UNSTOPPABLE; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
        }
      }
      const at = PAWN_ATT[c][sq];
      let hitsZone = false;
      for (let i = 0; i < at.length; i++) if (ZONE[zb + at[i]]) { zoneAtt[c]++; hitsZone = true; }
      if (hitsZone) zoneAttackers[c]++;
      continue;
    }
    if (t === P_KING) {
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
      if (shield) { k = O_KING_SHIELD; mg += s * Pc[2 * k] * shield; eg += s * Pc[2 * k + 1] * shield; if (T) T[k] += s * shield; }
      let open = 0;
      for (let df = -1; df <= 1; df++) { const nf = f + df; if (nf >= 0 && nf <= 5 && !pawnFiles[c * 6 + nf]) open++; }
      if (open) { k = O_KING_OPEN; mg += s * Pc[2 * k] * open; eg += s * Pc[2 * k + 1] * open; if (T) T[k] += s * open; }
      const tg = KGT[sq];
      for (let i = 0; i < tg.length; i++) attacks[own + tg[i]]++;
      continue;
    }
    let mob = 0;
    let zoneHits = 0;
    if (t === P_KNIGHT) {
      const tg = KNT[sq];
      for (let i = 0; i < tg.length; i++) {
        const to = tg[i];
        attacks[own + to]++;
        const q = b[to];
        if ((!q || (q >> 3) !== c) && !pawnAtt[opp + to]) mob++;
        if (ZONE[zb + to]) zoneHits++;
      }
    } else {
      const rays = RAY[sq];
      const dEnd = t === P_ROOK ? 4 : 8;
      for (let d = 0; d < dEnd; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          const to = ray[i];
          attacks[own + to]++;
          const q = b[to];
          if ((!q || (q >> 3) !== c) && !pawnAtt[opp + to]) mob++;
          if (ZONE[zb + to]) zoneHits++;
          if (q) break;
        }
      }
      if (t === P_ROOK) {
        const f = FILE[sq];
        if (!pawnFiles[c * 6 + f]) {
          k = pawnFiles[(c ^ 1) * 6 + f] ? O_ROOK_SEMI : O_ROOK_OPEN;
          mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
        }
      }
    }
    const mc = mob - MOB_BASE[t];
    k = O_MOB + t; mg += s * Pc[2 * k] * mc; eg += s * Pc[2 * k + 1] * mc; if (T) T[k] += s * mc;
    k = O_MOBT + t * 16 + (mob > 15 ? 15 : mob); mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
    const tro = 6 - DIST[sq * 36 + enemyKing];
    k = O_TROPISM + t; mg += s * Pc[2 * k] * tro; eg += s * Pc[2 * k + 1] * tro; if (T) T[k] += s * tro;
    if (t === P_KNIGHT && RANK[rel] >= 2 && RANK[rel] <= 4 && pawnAtt[own + sq] && !pawnCanAttack(b, sq, c)) {
      k = O_OUTPOST; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
    }
    if (zoneHits) { zoneAtt[c] += zoneHits; zoneAttackers[c]++; }
  }

  // king zone pressure
  for (let c = 0; c < 2; c++) {
    const s = c === 0 ? 1 : -1;
    const Pc = c === sc ? Q : R;
    const a = zoneAtt[c];
    if (a) {
      const q = (a * a) / 4;
      let k = O_KING_ATTACK; mg += s * Pc[2 * k] * q; eg += s * Pc[2 * k + 1] * q; if (T) T[k] += s * q;
      const n = zoneAttackers[c];
      k = O_KING_ATTACKERS; mg += s * Pc[2 * k] * n; eg += s * Pc[2 * k + 1] * n; if (T) T[k] += s * n;
    }
  }

  // threats against non-pawn, non-king pieces
  for (let sq = 0; sq < 36; sq++) {
    const p = b[sq];
    const t = p & 7;
    if (!p || t === P_PAWN || t === P_KING) continue;
    const c = p >> 3; // victim colour
    const att = c ^ 1; // attacker colour
    const s = att === 0 ? 1 : -1;
    const Pc = att === sc ? Q : R;
    const ao = att * 36;
    if (!attacks[ao + sq]) continue;
    let k: number;
    if (pawnAtt[ao + sq]) { k = O_THREAT_PAWN; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
    if (t === P_ROOK || t === P_QUEEN) {
      if (knightAttacks(b, sq, att)) { k = O_THREAT_MINOR; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      if (t === P_QUEEN && rookAttacks(b, sq, att)) { k = O_THREAT_ROOK; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
    }
    if (!attacks[c * 36 + sq]) { k = O_HANGING; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
  }

  const ph = phase > MAX_PHASE4 ? MAX_PHASE4 : phase;
  let score = (mg * ph + eg * (MAX_PHASE4 - ph)) / MAX_PHASE4;
  // drawish material: the side ahead has no pawns and at most a knight's worth more piece material
  let scale = 1;
  if (score > 0 ? wPawns === 0 && wNonPawn - bNonPawn <= 1 : score < 0 ? bPawns === 0 && bNonPawn - wNonPawn <= 1 : false) scale = 0.25;
  traceScale = scale;
  score *= scale;
  if (sc >= 0 && w.simplify) {
    const ahead = sc === 0 ? score : -score;
    if (ahead > 80) score += (sc === 0 ? 1 : -1) * w.simplify * (MAX_PHASE4 - ph) / MAX_PHASE4;
  }
  score += mopUp(pos, score);
  const stm = Math.round(pos.side === 0 ? score : -score);
  const k = O_TEMPO;
  if (T) T[k] += pos.side === 0 ? 1 : -1; // tempo is reported in White's view for tracing
  return stm + ((P[2 * k] * ph + P[2 * k + 1] * (MAX_PHASE4 - ph)) / MAX_PHASE4 | 0);
}

/** Can an enemy pawn ever attack `sq` (an enemy pawn on an adjacent file further up the board)? */
function pawnCanAttack(b: Int8Array, sq: number, c: number): boolean {
  const f = FILE[sq], r = RANK[sq];
  const ep = P_PAWN | ((c ^ 1) << 3);
  for (let df = -1; df <= 1; df += 2) {
    const nf = f + df;
    if (nf < 0 || nf > 5) continue;
    if (c === 0) { for (let nr = r + 1; nr < 6; nr++) if (b[nr * 6 + nf] === ep) return true; }
    else { for (let nr = r - 1; nr >= 0; nr--) if (b[nr * 6 + nf] === ep) return true; }
  }
  return false;
}

function knightAttacks(b: Int8Array, sq: number, c: number): boolean {
  const tg = KNT[sq], kn = P_KNIGHT | (c << 3);
  for (let i = 0; i < tg.length; i++) if (b[tg[i]] === kn) return true;
  return false;
}
function rookAttacks(b: Int8Array, sq: number, c: number): boolean {
  const rk = P_ROOK | (c << 3);
  const rays = RAY[sq];
  for (let d = 0; d < 4; d++) {
    const ray = rays[d];
    for (let i = 0; i < ray.length; i++) { const q = b[ray[i]]; if (q) { if (q === rk) return true; break; } }
  }
  return false;
}

function isPassed(b: Int8Array, sq: number, c: number): boolean {
  const f = FILE[sq], r = RANK[sq];
  const enemyPawn = P_PAWN | ((c ^ 1) << 3);
  for (let df = -1; df <= 1; df++) {
    const nf = f + df;
    if (nf < 0 || nf > 5) continue;
    if (c === 0) { for (let nr = r + 1; nr < 6; nr++) if (b[nr * 6 + nf] === enemyPawn) return false; }
    else { for (let nr = r - 1; nr >= 0; nr--) if (b[nr * 6 + nf] === enemyPawn) return false; }
  }
  return true;
}

/** Drive a bare enemy king to the edge and bring our king closer when clearly winning. */
function mopUp(pos: Position, whiteScore: number): number {
  if (Math.abs(whiteScore) < 400) return 0;
  const strong = whiteScore > 0 ? 0 : 1;
  const weak = strong ^ 1;
  const b = pos.board;
  for (let sq = 0; sq < 36; sq++) { const p = b[sq]; if (p && (p >> 3) === weak && (p & 7) !== P_KING) return 0; }
  const wk = pos.kingSq[weak], sk = pos.kingSq[strong];
  const centerDist = Math.max(Math.abs(FILE[wk] * 2 - 5), Math.abs(RANK[wk] * 2 - 5));
  const bonus = centerDist * 10 + (6 - DIST[wk * 36 + sk]) * 6;
  return strong === 0 ? bonus : -bonus;
}

/** Game phase (0 = bare endgame … 20 = all pieces), same weights as crown-eval-3. */
export function phaseOf(pos: Position): number {
  let ph = 0;
  for (let sq = 0; sq < 36; sq++) { const p = pos.board[sq]; if (p) ph += PHASE_WEIGHT[p & 7]; }
  return Math.min(ph, MAX_PHASE4);
}
