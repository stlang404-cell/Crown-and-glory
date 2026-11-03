import { useRef } from 'react';
import type { EngineScore, PlyAnalysis } from '../analysis/types';
import { expectedU, toPov } from '../analysis/methodology';

/** White-perspective expected score in [0,1]; mate is drawn at the bounded edge, never as a giant cp spike. */
export const whiteU = (s: EngineScore) => expectedU(toPov(s, 'white'));

export function formatScore(s: EngineScore | null, pov: 'white' | 'black' = 'white'): string {
  if (!s) return '—';
  const t = s.pov === pov ? s : flip(s);
  if (t.kind === 'cp') return `${t.value >= 0 ? '+' : ''}${(t.value / 100).toFixed(2)}`;
  if (t.kind === 'mate') return `${t.plies > 0 ? '+' : '-'}M${Math.ceil(Math.abs(t.plies) / 2)}`;
  return t.outcome === 'draw' ? '½ (drawn)' : t.outcome === 'win' ? '1–0 (won)' : '0–1 (lost)';
}
function flip(s: EngineScore): EngineScore {
  const pov = s.pov === 'white' ? 'black' : 'white';
  if (s.kind === 'cp') return { kind: 'cp', value: -s.value, pov };
  if (s.kind === 'mate') return { kind: 'mate', plies: -s.plies, pov, proven: false };
  return { kind: 'terminal', outcome: s.outcome === 'win' ? 'loss' : s.outcome === 'loss' ? 'win' : 'draw', pov };
}

const GRADE_COLOR: Record<string, string> = {
  brilliant: 'var(--g-brilliant)', great: 'var(--g-great)', mistake: 'var(--g-mistake)', blunder: 'var(--g-blunder)', inaccuracy: 'var(--g-inaccuracy)',
};

export function EvalGraph({ plies, total, selected, onSelect }: { plies: PlyAnalysis[]; total: number; selected: number; onSelect: (ply: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 600, H = 150, n = Math.max(total, 1);
  const x = (ply: number) => (ply / n) * W;
  const y = (u: number) => H - u * H;
  const pts: [number, number][] = [[0, 0.5]];
  for (const p of plies) pts.push([p.ply, whiteU(p.evalAfter)]);
  const path = pts.map(([px, u], i) => `${i ? 'L' : 'M'}${x(px).toFixed(1)},${y(u).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts[pts.length - 1][0]).toFixed(1)},${H} L0,${H} Z`;
  const pick = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const ply = Math.round(((clientX - r.left) / r.width) * n);
    onSelect(Math.max(0, Math.min(plies.length, ply)));
  };
  return (
    <svg ref={ref} className="graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
      aria-label={`Evaluation graph over ${plies.length} analysed plies, white advantage upward`}
      onPointerDown={e => pick(e.clientX)} onPointerMove={e => e.buttons && pick(e.clientX)}>
      <rect width={W} height={H} fill="#1d2532" />
      <path d={area} fill="rgba(233,220,192,.88)" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="rgba(216,181,108,.5)" strokeDasharray="4 4" />
      {plies.filter(p => p.grade && GRADE_COLOR[p.grade]).map(p => (
        <circle key={p.ply} cx={x(p.ply)} cy={y(whiteU(p.evalAfter))} r={4} fill={GRADE_COLOR[p.grade!]} stroke="#10151e" strokeWidth={1.5} />
      ))}
      {plies.length < total && <rect x={x(plies.length)} y="0" width={W - x(plies.length)} height={H} fill="url(#pending-hatch)" opacity={0.5} />}
      <defs>
        <pattern id="pending-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="#2e3a4d" /></pattern>
      </defs>
      <line x1={x(selected)} x2={x(selected)} y1="0" y2={H} stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}

export interface RatingPoint { at: string; rating: number; rd: number; label: string }

export function RatingChart({ points, height = 220 }: { points: RatingPoint[]; height?: number }) {
  if (points.length < 2) return <p className="muted">The rating chart appears after your first rated game in this pool.</p>;
  const W = 640, H = height, pad = 36;
  const lo = Math.min(...points.map(p => p.rating - p.rd));
  const hi = Math.max(...points.map(p => p.rating + p.rd));
  const min = Math.floor((lo - 20) / 50) * 50, max = Math.ceil((hi + 20) / 50) * 50;
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad - 10);
  const y = (r: number) => 10 + (1 - (r - min) / (max - min)) * (H - 40);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.rating)}`).join(' ');
  const band = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.rating + p.rd)}`).join(' ') + ' ' +
    [...points].reverse().map((p, j) => `L${x(points.length - 1 - j)},${y(p.rating - p.rd)}`).join(' ') + ' Z';
  const ticks: number[] = [];
  const step = Math.max(50, Math.ceil((max - min) / 5 / 50) * 50);
  for (let t = min; t <= max; t += step) ticks.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`Rating history with uncertainty band, ${points.length} points, latest ${Math.round(points[points.length - 1].rating)}`}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={pad} x2={W - 10} y1={y(t)} y2={y(t)} stroke="#2e3a4d" />
          <text x={pad - 6} y={y(t) + 4} fill="#b3bfcd" fontSize="11" textAnchor="end">{t}</text>
        </g>
      ))}
      <path d={band} fill="rgba(143,195,238,.14)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.rating)} r="3.5" fill="#10151e" stroke="var(--accent)" strokeWidth="2"><title>{p.label}</title></circle>)}
      <text x={pad} y={H - 6} fill="#b3bfcd" fontSize="11">Band = ±1 RD (model uncertainty, not a guarantee)</text>
    </svg>
  );
}
