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
// Shared attack map (v0.9), built once per call in the piece pass and reused by the threat / hanging terms:
// attStamp[c * 36 + sq] === stamp ⇔ a non-pawn piece of colour c attacks sq (pawn attacks come from the pawn
// cache); knStamp / rkStamp record knight and rook attacks separately (minor / rook threats). Stamping avoids
// clearing the maps on every call.
const attStamp = new Int32Array(72), knStamp = new Int32Array(72), rkStamp = new Int32Array(72);
let stamp = 0;
const victims = new Int8Array(36);
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

// ---- incremental material + piece-square sums (v0.9) ----
// The material and square-table terms of both sides are folded into one table per (own, opp, styleColor)
// parameter combination: tab[(piece * 36 + sq) * 2] = signed (White-positive) mg, + 1 = eg. Position keeps the
// table's sums up to date in makeMove/unmakeMove, so evaluate4 reads them instead of summing 36 squares.
// Parameter arrays are treated as immutable once used (a changed array must be a new array).
interface PsqEntry { q: Int32Array; r: Int32Array; sc: number; tab: Int32Array }
const psqCache: PsqEntry[] = [];
let psqLast: PsqEntry | null = null;
function buildPsq(Q: Int32Array, R: Int32Array, sc: number): Int32Array {
  const tab = new Int32Array(16 * 36 * 2);
  for (let c = 0; c < 2; c++) {
    const Pc = c === sc ? Q : R;
    const s = c === 0 ? 1 : -1;
    for (let t = P_PAWN; t <= P_KING; t++) {
      const pc = t | (c << 3);
      for (let sq = 0; sq < 36; sq++) {
        const rel = c === 0 ? sq : MIRROR[sq];
        const km = O_MAT + t, kp = O_PST + t * 36 + rel;
        tab[(pc * 36 + sq) * 2] = s * (Pc[2 * km] + Pc[2 * kp]);
        tab[(pc * 36 + sq) * 2 + 1] = s * (Pc[2 * km + 1] + Pc[2 * kp + 1]);
      }
    }
  }
  return tab;
}
function psqTableFor(Q: Int32Array, R: Int32Array, sc: number): Int32Array {
  const l = psqLast;
  if (l && l.q === Q && l.r === R && l.sc === sc) return l.tab;
  for (let i = 0; i < psqCache.length; i++) {
    const e = psqCache[i];
    if (e.q === Q && e.r === R && e.sc === sc) { psqLast = e; return e.tab; }
  }
  const e = { q: Q, r: R, sc, tab: buildPsq(Q, R, sc) };
  if (psqCache.length >= 16) psqCache.shift();
  psqCache.push(e);
  psqLast = e;
  return e.tab;
}

// ---- pawn-structure cache (v0.9) ----
// Everything that depends on the pawns alone, keyed EXACTLY by the two pawn masks Position maintains
// incrementally (pawnBits; no hash collisions possible): pawns per file, pawn attack counts, per-colour counts of
// doubled / isolated / supported / phalanx pawns and the passed-pawn masks. King- and piece-dependent pawn
// terms (passed-pawn king distances, free square ahead, unstoppable pawns, king-zone pawn attacks, shield and
// open files) are evaluated per call.
// Pawn masks: bit sq for sq < 32 (pawns only ever stand on squares 6..29).
/** FRONT_SPAN[c * 36 + sq]: pawn-square mask of the same and adjacent files strictly ahead of sq (passed pawns). */
const FRONT_SPAN = new Int32Array(72);
/** ATT_SPAN[c * 36 + sq]: pawn-square mask of the adjacent files strictly ahead of sq (an enemy pawn there can
 *  still attack sq: outposts). */
const ATT_SPAN = new Int32Array(72);
/** ADJ_FILES[f]: pawn-square mask of the files next to f (isolated pawns). */
const ADJ_FILES = new Int32Array(6);
for (let c = 0; c < 2; c++) for (let sq = 0; sq < 36; sq++) {
  let front = 0, side = 0;
  for (let s2 = 6; s2 < 30; s2++) {
    const df = Math.abs(FILE[s2] - FILE[sq]);
    const ahead = c === 0 ? RANK[s2] > RANK[sq] : RANK[s2] < RANK[sq];
    if (df <= 1 && ahead) front |= 1 << s2;
    if (df === 1 && ahead) side |= 1 << s2;
  }
  FRONT_SPAN[c * 36 + sq] = front; ATT_SPAN[c * 36 + sq] = side;
}
for (let f = 0; f < 6; f++) for (let s2 = 6; s2 < 30; s2++) if (Math.abs(FILE[s2] - f) === 1) ADJ_FILES[f] |= 1 << s2;

/** ZONE_LIST[k]: the king zone of k (k and its neighbours). */
const ZONE_LIST: Int8Array[] = [];
for (let k = 0; k < 36; k++) ZONE_LIST.push(Int8Array.from([k, ...KING_TARGETS[k]]));
/** ZONE_PAWNS[c * 36 + k]: pawn-square mask of the squares from which a pawn of colour c attacks the zone of k. */
const ZONE_PAWNS = new Int32Array(72);
for (let c = 0; c < 2; c++) for (let k = 0; k < 36; k++) for (let s2 = 6; s2 < 30; s2++) {
  const a = PAWN_ATTACKS[c][s2];
  for (let i = 0; i < a.length; i++) if (ZONE[k * 36 + a[i]]) ZONE_PAWNS[c * 36 + k] |= 1 << s2;
}
function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

const PC_BITS = 14, PC_SIZE = 1 << PC_BITS, PC_MASK = PC_SIZE - 1;
const pcKeyW = new Int32Array(PC_SIZE), pcKeyB = new Int32Array(PC_SIZE);
const pcUsed = new Uint8Array(PC_SIZE);
const pcFiles = new Int8Array(PC_SIZE * 12); // [c * 6 + file]
const pcAtt = new Int8Array(PC_SIZE * 72); // [c * 36 + sq] pawn attack counts
const pcCounts = new Int16Array(PC_SIZE * 8); // [c * 4 + (doubled, isolated, supported, phalanx)]
const pcPassed = new Int32Array(PC_SIZE * 2); // passed-pawn mask per colour
let pcProbes = 0, pcHits = 0;
/** Pawn-cache statistics since start (or the last reset). */
export function pawnCacheStats(reset = false): { probes: number; hits: number } {
  const r = { probes: pcProbes, hits: pcHits };
  if (reset) { pcProbes = 0; pcHits = 0; }
  return r;
}

function pawnEntry(wBits: number, bBits: number): number {
  let h = Math.imul(wBits, 0x9e3779b1) ^ Math.imul(bBits ^ (bBits >>> 15), 0x85ebca77);
  h ^= h >>> 16;
  const e = h & PC_MASK;
  pcProbes++;
  if (pcUsed[e] && pcKeyW[e] === wBits && pcKeyB[e] === bBits) { pcHits++; return e; }
  pcUsed[e] = 1; pcKeyW[e] = wBits; pcKeyB[e] = bBits;
  const fo = e * 12, ao = e * 72, co = e * 8;
  pcFiles.fill(0, fo, fo + 12);
  pcAtt.fill(0, ao, ao + 72);
  for (let c = 0; c < 2; c++) {
    let m = c === 0 ? wBits : bBits;
    const at = PAWN_ATT[c];
    while (m) {
      const sq = 31 - Math.clz32(m & -m); m &= m - 1;
      pcFiles[fo + c * 6 + FILE[sq]]++;
      const a = at[sq];
      for (let i = 0; i < a.length; i++) pcAtt[ao + c * 36 + a[i]]++;
    }
  }
  for (let c = 0; c < 2; c++) {
    const own = c === 0 ? wBits : bBits, enemy = c === 0 ? bBits : wBits;
    let m = own;
    let doubled = 0, isolated = 0, supported = 0, phalanx = 0, passed = 0;
    while (m) {
      const sq = 31 - Math.clz32(m & -m); m &= m - 1;
      const f = FILE[sq];
      if (pcFiles[fo + c * 6 + f] > 1) doubled++;
      if (!(own & ADJ_FILES[f])) isolated++;
      if (pcAtt[ao + c * 36 + sq]) supported++;
      if ((f > 0 && (own >>> (sq - 1)) & 1) || (f < 5 && (own >>> (sq + 1)) & 1)) phalanx++;
      if (!(enemy & FRONT_SPAN[c * 36 + sq])) passed |= 1 << sq;
    }
    pcCounts[co + c * 4] = doubled; pcCounts[co + c * 4 + 1] = isolated;
    pcCounts[co + c * 4 + 2] = supported; pcCounts[co + c * 4 + 3] = phalanx;
    pcPassed[e * 2 + c] = passed;
  }
  return e;
}

export function evaluate4(pos: Position, w: Eval4Weights): number {
  const P = w.p;
  // style: the styled side (styleColor) reads its own terms from `own`; the other side uses p
  const Q = w.own ?? P;
  const R = w.opp ?? P;
  const sc = (w.own || w.opp || w.simplify) && w.styleColor !== undefined ? w.styleColor : -1;
  const b = pos.board;
  const T = TRACE;
  // material + square tables: incremental sums maintained by Position
  const tab = psqTableFor(Q, R, sc);
  if (pos.psqTab !== tab) pos.setPsqTable(tab);
  let mg = pos.psqMg, eg = pos.psqEg;
  const cnt = pos.pieceCnt;
  const wNonPawn = cnt[P_KNIGHT] + 2 * cnt[P_ROOK] + 4 * cnt[P_QUEEN];
  const bNonPawn = cnt[8 | P_KNIGHT] + 2 * cnt[8 | P_ROOK] + 4 * cnt[8 | P_QUEEN];
  const wPawns = cnt[P_PAWN], bPawns = cnt[8 | P_PAWN];
  const phase = wNonPawn + bNonPawn;
  if (T) {
    for (let sq = 0; sq < 36; sq++) {
      const p = b[sq];
      if (!p) continue;
      const t = p & 7, c = p >> 3, s = c === 0 ? 1 : -1;
      T[O_MAT + t] += s; T[O_PST + t * 36 + (c === 0 ? sq : MIRROR[sq])] += s;
    }
  }
  zoneAtt[0] = 0; zoneAtt[1] = 0; zoneAttackers[0] = 0; zoneAttackers[1] = 0;
  const kingSq = pos.kingSq;

  // pawn structure (cached by pawn masks)
  const pb = pos.pawnBits;
  const pe = pawnEntry(pb[0], pb[1]);
  const pfo = pe * 12, pao = pe * 72;
  const pawnFiles = pcFiles, pawnAtt = pcAtt;
  if (++stamp > 0x3fffffff) { stamp = 1; attStamp.fill(0); knStamp.fill(0); rkStamp.fill(0); }
  const st = stamp;
  let nv = 0;
  for (let c = 0; c < 2; c++) {
    const s = c === 0 ? 1 : -1;
    const Pc = c === sc ? Q : R;
    const co = pe * 8 + c * 4;
    let k: number, n: number;
    n = pcCounts[co]; if (n) { k = O_DOUBLED; mg += s * Pc[2 * k] * n; eg += s * Pc[2 * k + 1] * n; if (T) T[k] += s * n; }
    n = pcCounts[co + 1]; if (n) { k = O_ISOLATED; mg += s * Pc[2 * k] * n; eg += s * Pc[2 * k + 1] * n; if (T) T[k] += s * n; }
    n = pcCounts[co + 2]; if (n) { k = O_SUPPORTED; mg += s * Pc[2 * k] * n; eg += s * Pc[2 * k + 1] * n; if (T) T[k] += s * n; }
    n = pcCounts[co + 3]; if (n) { k = O_PHALANX; mg += s * Pc[2 * k] * n; eg += s * Pc[2 * k + 1] * n; if (T) T[k] += s * n; }
    const enemyKing = kingSq[c ^ 1];
    // passed pawns: king distances, free square ahead, unstoppable
    let m = pcPassed[pe * 2 + c];
    while (m) {
      const sq = 31 - Math.clz32(m & -m); m &= m - 1;
      const relRank = c === 0 ? RANK[sq] : 5 - RANK[sq];
      k = O_PASSED + relRank; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
      const ahead = c === 0 ? sq + 6 : sq - 6;
      if (b[ahead] === 0) { k = O_PASSED_FREE + relRank; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      const rw = relRank - 1; // rank weight: 0 for rank 1 … 3 for rank 4
      if (rw > 0) {
        const dOwn = DIST[kingSq[c] * 36 + ahead] * rw, dEn = DIST[enemyKing * 36 + ahead] * rw;
        k = O_PASSED_OWNK; mg += s * Pc[2 * k] * dOwn; eg += s * Pc[2 * k + 1] * dOwn; if (T) T[k] += s * dOwn;
        k = O_PASSED_ENK; mg += s * Pc[2 * k] * dEn; eg += s * Pc[2 * k + 1] * dEn; if (T) T[k] += s * dEn;
      }
      if ((c === 0 ? bNonPawn : wNonPawn) === 0) {
        const promo = c === 0 ? 30 + FILE[sq] : FILE[sq];
        const kd = DIST[enemyKing * 36 + promo] - (pos.side !== c ? 1 : 0);
        if (5 - relRank < kd) { k = O_UNSTOPPABLE; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      }
    }
    // pawn attacks on the enemy king zone: (pawn, zone square) attack pairs and the number of such pawns
    const zl = ZONE_LIST[enemyKing], po = pao + c * 36;
    let za = 0;
    for (let i = 0; i < zl.length; i++) za += pawnAtt[po + zl[i]];
    if (za) { zoneAtt[c] += za; zoneAttackers[c] += popcount(pb[c] & ZONE_PAWNS[c * 36 + enemyKing]); }
  }

  // pass 2: pieces
  for (let sq = 0; sq < 36; sq++) {
    const p = b[sq];
    const t = p & 7;
    if (!p || t === P_PAWN) continue;
    const c = p >> 3;
    const s = c === 0 ? 1 : -1;
    const Pc = c === sc ? Q : R;
    const rel = c === 0 ? sq : MIRROR[sq];
    let k: number;
    const enemyKing = kingSq[c ^ 1];
    const zb = enemyKing * 36;
    const own = c * 36, opp = (c ^ 1) * 36;
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
      for (let df = -1; df <= 1; df++) { const nf = f + df; if (nf >= 0 && nf <= 5 && !pawnFiles[pfo + c * 6 + nf]) open++; }
      if (open) { k = O_KING_OPEN; mg += s * Pc[2 * k] * open; eg += s * Pc[2 * k + 1] * open; if (T) T[k] += s * open; }
      const tg = KGT[sq];
      for (let i = 0; i < tg.length; i++) attStamp[own + tg[i]] = st;
      continue;
    }
    victims[nv++] = sq;
    let mob = 0;
    let zoneHits = 0;
    if (t === P_KNIGHT) {
      const tg = KNT[sq];
      for (let i = 0; i < tg.length; i++) {
        const to = tg[i];
        attStamp[own + to] = st; knStamp[own + to] = st;
        const q = b[to];
        if ((!q || (q >> 3) !== c) && !pawnAtt[pao + opp + to]) mob++;
        if (ZONE[zb + to]) zoneHits++;
      }
    } else {
      const rays = RAY[sq];
      const isRook = t === P_ROOK;
      const dEnd = isRook ? 4 : 8;
      for (let d = 0; d < dEnd; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          const to = ray[i];
          attStamp[own + to] = st;
          if (isRook) rkStamp[own + to] = st;
          const q = b[to];
          if ((!q || (q >> 3) !== c) && !pawnAtt[pao + opp + to]) mob++;
          if (ZONE[zb + to]) zoneHits++;
          if (q) break;
        }
      }
      if (t === P_ROOK) {
        const f = FILE[sq];
        if (!pawnFiles[pfo + c * 6 + f]) {
          k = pawnFiles[pfo + (c ^ 1) * 6 + f] ? O_ROOK_SEMI : O_ROOK_OPEN;
          mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
        }
      }
    }
    const mc = mob - MOB_BASE[t];
    k = O_MOB + t; mg += s * Pc[2 * k] * mc; eg += s * Pc[2 * k + 1] * mc; if (T) T[k] += s * mc;
    k = O_MOBT + t * 16 + (mob > 15 ? 15 : mob); mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s;
    const tro = 6 - DIST[sq * 36 + enemyKing];
    k = O_TROPISM + t; mg += s * Pc[2 * k] * tro; eg += s * Pc[2 * k + 1] * tro; if (T) T[k] += s * tro;
    if (t === P_KNIGHT && RANK[rel] >= 2 && RANK[rel] <= 4 && pawnAtt[pao + own + sq] && !(pb[c ^ 1] & ATT_SPAN[own + sq])) {
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
  for (let v = 0; v < nv; v++) {
    const sq = victims[v];
    const t = b[sq] & 7;
    const c = b[sq] >> 3; // victim colour
    const att = c ^ 1; // attacker colour
    const s = att === 0 ? 1 : -1;
    const Pc = att === sc ? Q : R;
    const ao = att * 36 + sq, vo = c * 36 + sq;
    const byPawn = pawnAtt[pao + ao];
    if (!byPawn && attStamp[ao] !== st) continue;
    let k: number;
    if (byPawn) { k = O_THREAT_PAWN; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
    if (t === P_ROOK || t === P_QUEEN) {
      if (knStamp[ao] === st) { k = O_THREAT_MINOR; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
      if (t === P_QUEEN && rkStamp[ao] === st) { k = O_THREAT_ROOK; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
    }
    if (attStamp[vo] !== st && !pawnAtt[pao + vo]) { k = O_HANGING; mg += s * Pc[2 * k]; eg += s * Pc[2 * k + 1]; if (T) T[k] += s; }
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
  score += mopUp(pos, score, cnt);
  const stm = Math.round(pos.side === 0 ? score : -score);
  const k = O_TEMPO;
  if (T) T[k] += pos.side === 0 ? 1 : -1; // tempo is reported in White's view for tracing
  return stm + ((P[2 * k] * ph + P[2 * k + 1] * (MAX_PHASE4 - ph)) / MAX_PHASE4 | 0);
}

/** Drive a bare enemy king to the edge and bring our king closer when clearly winning. */
function mopUp(pos: Position, whiteScore: number, cnt: Int8Array): number {
  if (Math.abs(whiteScore) < 400) return 0;
  const strong = whiteScore > 0 ? 0 : 1;
  const weak = strong ^ 1;
  const wf = weak << 3;
  if (cnt[wf | P_PAWN] || cnt[wf | P_KNIGHT] || cnt[wf | P_ROOK] || cnt[wf | P_QUEEN]) return 0;
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
