/** Procedural, original 12x12 pixel-art portraits (deterministic from a seed; nearest-neighbour). */
import { memo } from 'react';
import { mulberry32 } from '../rules/tables';

const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6646', '#6e4630', '#f5d7bd'];
const HAIR = ['#2b1d14', '#5a3a22', '#a8743a', '#d9c07a', '#c8c8c8', '#7a2e2e', '#1d2a44'];
const COAT = ['#2f4a6b', '#5b3a5e', '#2f5b4b', '#6b4a2f', '#3c3f58', '#7a6230', '#1f2a3a'];
const BG = ['#1b2431', '#22304a', '#2a2238', '#1f2f2c', '#30261a'];

export const Portrait = memo(function Portrait({ seed, size = 56, crown = false }: { seed: number; size?: number; crown?: boolean }) {
  const r = mulberry32(seed * 2654435761);
  const pick = <T,>(a: T[]) => a[Math.floor((r() / 4294967296) * a.length)];
  const skin = pick(SKIN), hair = pick(HAIR), coat = pick(COAT), bg = pick(BG);
  const style = Math.floor((r() / 4294967296) * 4);
  const glasses = r() / 4294967296 < 0.25;
  const px: [number, number, string][] = [];
  const set = (x: number, y: number, c: string) => px.push([x, y, c]);
  // face 4..7 x, 3..8 y
  for (let y = 3; y <= 8; y++) for (let x = 3; x <= 8; x++) if (!((y === 3 || y === 8) && (x === 3 || x === 8))) set(x, y, skin);
  // hair
  for (let x = 3; x <= 8; x++) set(x, 2, hair);
  for (let x = 2; x <= 9; x++) if (style !== 3) set(x, 3, x === 2 || x === 9 || style === 0 ? hair : skin);
  if (style === 1) { set(2, 4, hair); set(9, 4, hair); set(2, 5, hair); set(9, 5, hair); }
  if (style === 2) for (let y = 3; y <= 7; y++) { set(2, y, hair); set(9, y, hair); }
  if (style === 3) { for (let x = 4; x <= 7; x++) set(x, 1, hair); }
  // eyes / glasses
  const eye = '#1a1410';
  set(4, 5, eye); set(7, 5, eye);
  if (glasses) { set(3, 5, '#d8b56c'); set(5, 5, '#d8b56c'); set(6, 5, '#d8b56c'); set(8, 5, '#d8b56c'); }
  set(5, 7, '#8a4a3a'); set(6, 7, '#8a4a3a');
  // body
  for (let y = 9; y <= 11; y++) for (let x = 1; x <= 10; x++) if (!(y === 9 && (x < 3 || x > 8))) set(x, y, coat);
  set(5, 9, '#e9dcc0'); set(6, 9, '#e9dcc0'); set(5, 10, '#d8b56c');
  if (crown) { for (let x = 3; x <= 8; x++) set(x, 1, '#d8b56c'); set(3, 0, '#d8b56c'); set(5, 0, '#d8b56c'); set(6, 0, '#d8b56c'); set(8, 0, '#d8b56c'); }
  return (
    <svg className="portrait" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
      <rect width="12" height="12" fill={bg} />
      {px.map(([x, y, c], i) => <rect key={i} x={x} y={y} width="1" height="1" fill={c} />)}
    </svg>
  );
});

export function BrandMark({ size = 38 }: { size?: number }) {
  // 12x12 pixel crown over a 6x6 board motif
  const gold = '#d8b56c', ink = '#10151e', ivory = '#e9dcc0', slate = '#6f8296';
  const px: [number, number, string][] = [];
  [[1, 1], [4, 1], [7, 1], [10, 1]].forEach(([x, y]) => px.push([x, y, gold]));
  for (let x = 1; x <= 10; x++) { px.push([x, 2, gold]); px.push([x, 3, gold]); }
  [[2, 1], [5, 0], [6, 0], [9, 1]].forEach(([x, y]) => px.push([x, y, gold]));
  for (let y = 5; y <= 10; y++) for (let x = 3; x <= 8; x++) px.push([x, y, (x + y) % 2 ? ivory : slate]);
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
      <rect width="12" height="12" rx="2" fill={ink} />
      {px.map(([x, y, c], i) => <rect key={i} x={x} y={y} width="1" height="1" fill={c} />)}
    </svg>
  );
}
