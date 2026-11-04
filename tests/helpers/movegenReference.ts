/**
 * Frozen reference copies of Position.generatePseudo and isAttacked as of v0.8.0 (full-board scan, all rays),
 * used by the v0.9
 * differential move-generation tests. Do not optimise this file.
 */
import type { Position } from '../../src/rules/position';
import { EMPTY, KING, KNIGHT, Move, NUM_SQUARES, PAWN, PROMOTION_TYPES, QUEEN, ROOK, WHITE, encodeMove, rankOf } from '../../src/rules/types';
import { KING_TARGETS, KNIGHT_TARGETS, PAWN_ATTACKERS, PAWN_ATTACKS, RAYS } from '../../src/rules/tables';

export function generatePseudoReference(pos: Position, out: Move[] | Int32Array, capturesOnly = false): number {
  const b = pos.board;
  const us = pos.side;
  let n = 0;
  for (let from = 0; from < NUM_SQUARES; from++) {
    const p = b[from];
    if (p === EMPTY || (p >> 3) !== us) continue;
    const t = p & 7;
    if (t === PAWN) {
      const dir = us === WHITE ? 6 : -6;
      const to = from + dir;
      const promoRank = us === WHITE ? 5 : 0;
      const toRank = rankOf(to);
      if (b[to] === EMPTY) {
        if (toRank === promoRank) {
          for (const pt of PROMOTION_TYPES) out[n++] = encodeMove(from, to, pt);
        } else if (!capturesOnly) out[n++] = encodeMove(from, to);
      }
      const caps = PAWN_ATTACKS[us][from];
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i];
        const q = b[c];
        if (q !== EMPTY && (q >> 3) !== us) {
          if (toRank === promoRank) {
            for (const pt of PROMOTION_TYPES) out[n++] = encodeMove(from, c, pt);
          } else out[n++] = encodeMove(from, c);
        }
      }
    } else if (t === KNIGHT || t === KING) {
      const targets = t === KNIGHT ? KNIGHT_TARGETS[from] : KING_TARGETS[from];
      for (let i = 0; i < targets.length; i++) {
        const to = targets[i];
        const q = b[to];
        if (q === EMPTY) { if (!capturesOnly) out[n++] = encodeMove(from, to); }
        else if ((q >> 3) !== us) out[n++] = encodeMove(from, to);
      }
    } else {
      const d0 = 0;
      const d1 = t === ROOK ? 4 : 8;
      const rays = RAYS[from];
      for (let d = d0; d < d1; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          const to = ray[i];
          const q = b[to];
          if (q === EMPTY) { if (!capturesOnly) out[n++] = encodeMove(from, to); continue; }
          if ((q >> 3) !== us) out[n++] = encodeMove(from, to);
          break;
        }
      }
    }
  }
  return n;
}

/** Frozen v0.8 Position.isAttacked: is `sq` attacked by any piece of colour `by`? */
export function isAttackedReference(pos: Position, sq: number, by: number): boolean {
  const b = pos.board;
  const byFlag = by << 3;
  const pa = PAWN_ATTACKERS[by][sq];
  for (let i = 0; i < pa.length; i++) if (b[pa[i]] === (PAWN | byFlag)) return true;
  const kn = KNIGHT_TARGETS[sq];
  for (let i = 0; i < kn.length; i++) if (b[kn[i]] === (KNIGHT | byFlag)) return true;
  const kg = KING_TARGETS[sq];
  for (let i = 0; i < kg.length; i++) if (b[kg[i]] === (KING | byFlag)) return true;
  const rays = RAYS[sq];
  for (let d = 0; d < 8; d++) {
    const ray = rays[d];
    for (let i = 0; i < ray.length; i++) {
      const p = b[ray[i]];
      if (p === EMPTY) continue;
      if ((p >> 3) === by) {
        const t = p & 7;
        if (t === QUEEN || (d < 4 && t === ROOK)) return true;
      }
      break;
    }
  }
  return false;
}
