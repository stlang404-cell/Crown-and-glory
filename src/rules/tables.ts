/** Precomputed geometry tables for the 6x6 board. */
import { NUM_SQUARES, fileOf, rankOf, squareOf } from './types';

function build(deltas: ReadonlyArray<readonly [number, number]>): Int8Array[] {
  const out: Int8Array[] = [];
  for (let sq = 0; sq < NUM_SQUARES; sq++) {
    const list: number[] = [];
    const f = fileOf(sq), r = rankOf(sq);
    for (const [df, dr] of deltas) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 6 && nr >= 0 && nr < 6) list.push(squareOf(nf, nr));
    }
    out.push(Int8Array.from(list));
  }
  return out;
}

export const KNIGHT_TARGETS = build([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
export const KING_TARGETS = build([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]);

/** Directions 0–3 orthogonal (rook), 4–7 diagonal. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

/** RAYS[sq][dir] = squares in order moving away from sq. */
export const RAYS: Int8Array[][] = [];
for (let sq = 0; sq < NUM_SQUARES; sq++) {
  const perDir: Int8Array[] = [];
  for (const [df, dr] of DIRS) {
    const list: number[] = [];
    let f = fileOf(sq) + df, r = rankOf(sq) + dr;
    while (f >= 0 && f < 6 && r >= 0 && r < 6) {
      list.push(squareOf(f, r));
      f += df; r += dr;
    }
    perDir.push(Int8Array.from(list));
  }
  RAYS.push(perDir);
}

/** Squares from which a pawn of `color` attacks `sq` (i.e. reverse pawn attacks). */
export const PAWN_ATTACKERS: [Int8Array[], Int8Array[]] = [
  // white pawns attack upward, so a white pawn attacking sq sits one rank below
  build([[-1, -1], [1, -1]]),
  build([[-1, 1], [1, 1]]),
];
/** Squares a pawn of `color` on `sq` attacks. */
export const PAWN_ATTACKS: [Int8Array[], Int8Array[]] = [
  build([[-1, 1], [1, 1]]),
  build([[-1, -1], [1, -1]]),
];

/** Deterministic 32-bit PRNG (mulberry32) used for Zobrist keys. Seed is fixed and versioned. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

export const ZOBRIST_SEED = 0xc0a1a6; // crown-la6 zobrist v1
const rng = mulberry32(ZOBRIST_SEED);
/** ZOBRIST_LO/HI[piece * 36 + sq], piece code 0..15. */
export const ZOBRIST_LO = new Int32Array(16 * NUM_SQUARES);
export const ZOBRIST_HI = new Int32Array(16 * NUM_SQUARES);
for (let i = 0; i < 16 * NUM_SQUARES; i++) {
  ZOBRIST_LO[i] = rng() | 0;
  ZOBRIST_HI[i] = rng() | 0;
}
export const ZOBRIST_SIDE_LO = rng() | 0;
export const ZOBRIST_SIDE_HI = rng() | 0;
