/**
 * Original Crown piece set (SVG, viewBox 100x100), designed for this project.
 * White: ivory with ink outline. Black: ink with brass outline.
 */
import { memo } from 'react';

type Kind = 'p' | 'n' | 'r' | 'q' | 'k';

const BASE = 'M24 88 h52 a4 4 0 0 0 4 -4 v-3 a4 4 0 0 0 -4 -4 h-52 a4 4 0 0 0 -4 4 v3 a4 4 0 0 0 4 4z';

const SHAPES: Record<Kind, string[]> = {
  p: [
    BASE,
    'M34 77 C 36 67, 42 62, 43 55 h14 c1 7 7 12 9 22z',
    'M37 56 h26 a3.5 3.5 0 0 0 0 -7 h-26 a3.5 3.5 0 0 0 0 7z',
    'M63 37 a13 13 0 1 1 -26 0 a13 13 0 1 1 26 0z',
  ],
  r: [
    BASE,
    'M30 77 L33 44 h34 L70 77z',
    'M28 44 h44 a3 3 0 0 0 3 -3 v-4 h-50 v4 a3 3 0 0 0 3 3z',
    'M25 37 V20 h10 v7 h8 v-7 h14 v7 h8 v-7 h10 v17z',
  ],
  n: [
    BASE,
    'M30 77 C 30 62, 40 56, 46 50 C 38 52, 31 56, 26 52 C 22 48, 24 42, 30 38 L 44 28 C 46 22, 50 17, 55 14 L 57 21 C 70 24, 77 38, 76 56 C 75 66, 72 72, 70 77 z',
  ],
  q: [
    BASE,
    'M28 77 L32 50 h36 L72 77z',
    'M30 50 h40 a3 3 0 0 0 0 -6 h-40 a3 3 0 0 0 0 6z',
    'M27 44 L22 22 L36 35 L42 16 L50 32 L58 16 L64 35 L78 22 L73 44 z',
  ],
  k: [
    BASE,
    'M28 77 L32 50 h36 L72 77z',
    'M30 50 h40 a3 3 0 0 0 0 -6 h-40 a3 3 0 0 0 0 6z',
    'M28 44 C 26 34, 34 28, 42 31 C 44 26, 47 24, 50 24 C 53 24, 56 26, 58 31 C 66 28, 74 34, 72 44 z',
    'M46 24 v-6 h-5 v-6 h5 v-6 h8 v6 h5 v6 h-5 v6z',
  ],
};

const ORBS: Record<Kind, [number, number, number][]> = {
  p: [], r: [], n: [], k: [],
  q: [[22, 20, 4], [42, 14, 4], [58, 14, 4], [78, 20, 4]],
};

export const PieceSvg = memo(function PieceSvg({ kind, color, className, style, title }: { kind: Kind; color: 'w' | 'b'; className?: string; style?: React.CSSProperties; title?: string }) {
  const white = color === 'w';
  const fill = white ? 'url(#crown-ivory)' : 'url(#crown-ink)';
  const stroke = white ? '#26211a' : '#d8b56c';
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} role="img" aria-label={title}>
      {SHAPES[kind].map((d, i) => (
        <path key={i} d={d} fill={fill} stroke={stroke} strokeWidth={3.2} strokeLinejoin="round" />
      ))}
      {ORBS[kind].map(([cx, cy, r], i) => <circle key={`o${i}`} cx={cx} cy={cy} r={r} fill={white ? '#d8b56c' : '#d8b56c'} stroke={stroke} strokeWidth={2} />)}
      {kind === 'n' && <circle cx={58} cy={30} r={3} fill={stroke} />}
      {kind === 'n' && <path d="M60 22 C 66 30, 70 44, 68 60" fill="none" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />}
      {(kind === 'k' || kind === 'q') && <path d="M34 62 h32" stroke={white ? '#b8924a' : '#d8b56c'} strokeWidth={3} strokeLinecap="round" />}
    </svg>
  );
});

/** Shared gradient definitions; rendered once at the app root. */
export function PieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="crown-ivory" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.55" stopColor="#efe3c8" />
          <stop offset="1" stopColor="#cdbb94" />
        </linearGradient>
        <linearGradient id="crown-ink" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#3b4658" />
          <stop offset="0.6" stopColor="#1d2430" />
          <stop offset="1" stopColor="#0d1118" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const PIECE_NAMES: Record<Kind, string> = { p: 'pawn', n: 'knight', r: 'rook', q: 'queen', k: 'king' };
export type { Kind as PieceKind };
