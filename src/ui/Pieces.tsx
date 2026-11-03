/**
 * Original Crown piece set (SVG, viewBox 100x100), designed for this project.
 * White: ivory with an ink outline. Black: ink with a light outline (--piece-b-stroke: brass, champagne or parchment
 * by theme). Every piece stands on the same two-step plinth so a rank of pieces reads as one set.
 */
import { memo } from 'react';

type Kind = 'p' | 'n' | 'r' | 'q' | 'k';

/** Shared plinth (drawn with the slightly deeper "base" gradient). */
const PLINTH = 'M22 88h56a3 3 0 0 0 3-3v-2.5a3 3 0 0 0-3-3H22a3 3 0 0 0-3 3V85a3 3 0 0 0 3 3z';

const SHAPES: Record<Kind, string[]> = {
  p: [
    'M30.5 79.5C32 71 38 65.5 42.5 58h15c4.5 7.5 10.5 13 12 21.5z',
    'M36.5 58.5h27a3.25 3.25 0 0 0 0-6.5h-27a3.25 3.25 0 0 0 0 6.5z',
    'M50 50a13 13 0 1 0 0-26 13 13 0 0 0 0 26z',
  ],
  r: [
    'M30.5 79.5C32.5 69 34 58 34.5 47.5h31c.5 10.5 2 21.5 4 32z',
    'M28 48h44a2.5 2.5 0 0 0 2.5-2.5V38h-49v7.5A2.5 2.5 0 0 0 28 48z',
    'M25.5 38V21.5c0-.83.67-1.5 1.5-1.5h7c.83 0 1.5.67 1.5 1.5V27h8.5v-5.5c0-.83.67-1.5 1.5-1.5h9c.83 0 1.5.67 1.5 1.5V27h8.5v-5.5c0-.83.67-1.5 1.5-1.5h7c.83 0 1.5.67 1.5 1.5V38z',
  ],
  n: [
    'M29.5 79.5C29.5 69 34 61 43.5 54.5 37 57 32.5 58.5 28.5 58.5c-4.5 0-7.5-3.5-6-8.5L27 43.5c3-5 7-9.5 12.5-13.5 1.5-4 4-7.5 7-10L49.5 11c3 3 5 6.5 6 10 13 4 20.5 17 20.5 34 0 9.5-2 17.5-4.5 24.5z',
  ],
  q: [
    'M30 79.5C33 71 36 62 36.5 53h27c.5 9 3.5 18 6.5 26.5z',
    'M34 53.5h32a3.25 3.25 0 0 0 0-6.5H34a3.25 3.25 0 0 0 0 6.5z',
    'M31 47 23 26.5l13 10.5.5-17 9 13.5L50 16.5l4.5 17 9-13.5.5 17 13-10.5L69 47z',
  ],
  k: [
    'M30 79.5C33 71 36 62 36.5 53h27c.5 9 3.5 18 6.5 26.5z',
    'M34 53.5h32a3.25 3.25 0 0 0 0-6.5H34a3.25 3.25 0 0 0 0 6.5z',
    'M30.5 47c-3-10 3.5-17 11-14 1.5-4.5 4.5-7 8.5-7s7 2.5 8.5 7c7.5-3 14 4 11 14z',
    'M47.25 26v-5h-5v-5.5h5v-5h5.5v5h5v5.5h-5v5z',
  ],
};

/** Gilded finials (queen's crown points). */
const ORBS: Record<Kind, [number, number, number][]> = {
  p: [], r: [], n: [], k: [],
  q: [[23, 24.5, 3.6], [36.5, 17.5, 3.4], [50, 13.5, 3.8], [63.5, 17.5, 3.4], [77, 24.5, 3.6]],
};

export const PieceSvg = memo(function PieceSvg({ kind, color, className, style, title }: { kind: Kind; color: 'w' | 'b'; className?: string; style?: React.CSSProperties; title?: string }) {
  const white = color === 'w';
  const fill = white ? 'url(#crown-ivory)' : 'url(#crown-ink)';
  const baseFill = white ? 'url(#crown-ivory-base)' : 'url(#crown-ink-base)';
  const stroke = white ? '#231e17' : 'var(--piece-b-stroke, #d8b56c)';
  const detail = white ? '#a8864f' : 'var(--piece-gild, #d8b56c)';
  const sheen = white ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.16)';
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true, focusable: 'false' })}>
      <g strokeLinejoin="round" strokeLinecap="round" style={{ stroke }}>
        <path d={PLINTH} style={{ fill: baseFill }} strokeWidth={3} />
        {SHAPES[kind].map((d, i) => (
          <path key={i} d={d} style={{ fill }} strokeWidth={3} />
        ))}
        {ORBS[kind].map(([cx, cy, r], i) => <circle key={`o${i}`} cx={cx} cy={cy} r={r} style={{ fill: 'var(--piece-gild, #d8b56c)' }} strokeWidth={2.2} />)}
      </g>
      {/* plinth highlight */}
      <path d="M24 82.75h52" fill="none" style={{ stroke: sheen }} strokeWidth={1.4} strokeLinecap="round" />
      {kind === 'p' && <path d="M43.5 31.5a8.5 8.5 0 0 1 6.5-3" fill="none" style={{ stroke: sheen }} strokeWidth={2.2} strokeLinecap="round" />}
      {kind === 'r' && <path d="M36.5 60h27M35.75 69h28.5" fill="none" style={{ stroke: detail }} strokeWidth={2} strokeLinecap="round" opacity={0.75} />}
      {kind === 'n' && (
        <>
          <path d="M44 30.5c1.6-1.2 3.6-1.4 5.2-.6-1 1.8-3 2.6-5.2.6z" style={{ fill: stroke, stroke }} strokeWidth={1.2} strokeLinejoin="round" />
          <circle cx={28.2} cy={50.6} r={1.7} style={{ fill: stroke }} />
          <path d="M58.5 24.5c7.5 5 11.5 14 11.5 27 0 6.5-1 12-2.5 17" fill="none" style={{ stroke: detail }} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
        </>
      )}
      {(kind === 'k' || kind === 'q') && <path d="M37 64.5h26" style={{ stroke: detail }} strokeWidth={3} strokeLinecap="round" />}
    </svg>
  );
});

/** Shared gradient definitions; rendered once at the app root. */
export function PieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="crown-ivory" x1="0.15" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="0.45" stopColor="#f4ead4" />
          <stop offset="1" stopColor="#d6c29a" />
        </linearGradient>
        <linearGradient id="crown-ivory-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe2c4" />
          <stop offset="1" stopColor="#c5ae80" />
        </linearGradient>
        <linearGradient id="crown-ink" x1="0.15" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#465165" />
          <stop offset="0.45" stopColor="#1d2430" />
          <stop offset="1" stopColor="#0e1219" />
        </linearGradient>
        <linearGradient id="crown-ink-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#323a4a" />
          <stop offset="1" stopColor="#0b0e14" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const PIECE_NAMES: Record<Kind, string> = { p: 'pawn', n: 'knight', r: 'rook', q: 'queen', k: 'king' };
export type { Kind as PieceKind };
