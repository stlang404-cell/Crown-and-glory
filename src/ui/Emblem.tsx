import { useId } from 'react';
import { CHARGES, CRESTS, SHAPES, TINCTURES, divisionPath, type MotifId, type Tincture } from '../heraldry/charges';
import { EMBLEM_PX, type EmblemSize, type EmblemSpec } from '../heraldry/spec';

const tint = (t: Tincture | string) => (t in TINCTURES ? TINCTURES[t as Tincture] : t);
const OUTLINE = 'var(--her-outline, #111318)';
const LINE = 'var(--her-line, #f2ede3)';

/**
 * Renders any EmblemSpec as inline SVG (no external assets). Line weight is constant in screen pixels per size;
 * small sizes drop fine ornaments (wreath, monogram, pips, motifs, shading) so silhouettes stay legible on phones.
 *
 * v1.0 rendering (crown-heraldry-2, same specs and silhouettes): a soft top-left light and lower shade over the field,
 * an inner bevel, partition edges drawn as fine dark lines (with wavy / embattled / indented / engrailed lines of
 * partition), a cast shadow under the charge, gilded crests, outlined rank chevrons, per-event tournament motifs and
 * the gold order star behind Federation Title emblems.
 */
export function Emblem({ spec, size = 'md', title, className }: { spec: EmblemSpec; size?: EmblemSize; title: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const px = EMBLEM_PX[size];
  const small = size === 'sm';
  const deco = !small && (spec.motif || spec.order);
  const top = Math.min(spec.crest ? -16 : -2, deco ? (spec.motif === 'pennants' ? -14 : -8) : 0);
  const bottom = Math.max(spec.marks ? (small ? 92 : 88) : !small && spec.pips ? 84 : 74, deco ? (spec.motif === 'ribbon' ? 82 : 80) : 0);
  const wide = (spec.wreath || deco) && !small;
  const left = wide ? -10 : -2, right = wide ? 74 : 66;
  const vb = `${left} ${top} ${right - left} ${bottom - top}`;
  const h = Math.round(px * ((bottom - top) / (right - left)));
  const stroke = small ? 3.6 : size === 'md' ? 2.6 : 2;
  const shape = SHAPES[spec.shape];
  const metal = spec.prestige >= 4 ? TINCTURES.or : LINE;
  const crestFill = spec.prestige >= 3 ? `url(#g${uid})` : LINE;
  return (
    <svg className={`emblem ${className ?? ''}`} width={(px * (right - left)) / 68} height={h} viewBox={vb} role="img" aria-label={title || 'Heraldic emblem'} data-emblem={spec.shape} data-motif={spec.motif} data-order={spec.order ? '' : undefined}>
      <title>{title}</title>
      <defs>
        <clipPath id={`c${uid}`}><path d={shape} /></clipPath>
        {!small && (
          <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0.55" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.26} />
            <stop offset="0.42" stopColor="#fff" stopOpacity={0} />
            <stop offset="0.7" stopColor="#000" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.3} />
          </linearGradient>
        )}
        {(spec.prestige >= 3 || spec.order || spec.motif === 'rays') && (
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3dc93" />
            <stop offset="0.55" stopColor={TINCTURES.or} />
            <stop offset="1" stopColor="#a87d2a" />
          </linearGradient>
        )}
      </defs>
      {spec.order && <OrderStar small={small} fill={`url(#g${uid})`} />}
      {spec.motif && !small && <Motif motif={spec.motif} gold={`url(#g${uid})`} />}
      {spec.prestige >= 4 && !small && <path d={shape} fill="none" stroke={TINCTURES.or} strokeOpacity={0.35} strokeWidth={stroke * 4} />}
      {spec.wreath && !small && (
        <g fill={TINCTURES.or} stroke={OUTLINE} strokeWidth={0.5} opacity={0.95}>
          {[0, 1, 2, 3, 4, 5].map(i => <ellipse key={`l${i}`} cx={-4 + i * 1.2} cy={64 - i * 10} rx={3} ry={6} transform={`rotate(${-25 + i * 6} ${-4 + i * 1.2} ${64 - i * 10})`} />)}
          {[0, 1, 2, 3, 4, 5].map(i => <ellipse key={`r${i}`} cx={68 - i * 1.2} cy={64 - i * 10} rx={3} ry={6} transform={`rotate(${25 - i * 6} ${68 - i * 1.2} ${64 - i * 10})`} />)}
        </g>
      )}
      <g clipPath={`url(#c${uid})`}>
        <rect x={0} y={0} width={64} height={72} fill={tint(spec.field[0])} />
        {spec.division !== 'plain' && <path d={divisionPath(spec.division, spec.line)} fill={tint(spec.field[1])} stroke={small ? 'none' : OUTLINE} strokeWidth={0.9} strokeOpacity={0.55} strokeLinejoin="round" />}
        {spec.motif === 'compony' && !small && <path d={shape} fill="none" stroke={TINCTURES.or} strokeWidth={9} strokeDasharray="6 6" opacity={0.9} />}
        {!small && <rect x={0} y={0} width={64} height={72} fill={`url(#s${uid})`} />}
      </g>
      {!small && <path d={shape} fill="none" stroke="#fff" strokeOpacity={0.16} strokeWidth={1.2} transform="translate(32 37) scale(0.9) translate(-32 -37)" />}
      {spec.charge && (
        <g transform="translate(14 19) scale(1.12)">
          {!small && <path d={CHARGES[spec.charge]} fill="#000" fillOpacity={0.32} transform="translate(0.9 1.1)" />}
          <path d={CHARGES[spec.charge]} fill={tint(spec.chargeColor)} stroke={OUTLINE} strokeWidth={small ? 1.6 : 1.1} strokeLinejoin="round" paintOrder="stroke" />
        </g>
      )}
      <path d={shape} fill="none" stroke={metal} strokeWidth={stroke + (spec.prestige >= 3 ? 0.8 : 0)} strokeLinejoin="round" />
      {spec.border === 'double' && !small && <path d={shape} fill="none" stroke={metal} strokeWidth={1} transform="translate(32 37) scale(0.86) translate(-32 -37)" />}
      {spec.border === 'pixel' && [[4, 4], [56, 4], [4, 58], [56, 58]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width={small ? 6 : 4} height={small ? 6 : 4} fill={metal} stroke={small ? 'none' : OUTLINE} strokeWidth={0.6} />)}
      {spec.crest && <path d={CRESTS[spec.crest]} transform="translate(0 -16)" fill={crestFill} stroke={OUTLINE} strokeWidth={0.8} strokeLinejoin="round" />}
      {spec.monogram && size === 'lg' && <text x={32} y={66} textAnchor="middle" fontSize={9} fontWeight={700} fill={metal} stroke={OUTLINE} strokeWidth={0.6} paintOrder="stroke" fontFamily="var(--mono, monospace)">{spec.monogram}</text>}
      {spec.marks && <RankMarks count={spec.marks} small={small} />}
      {!small && spec.pips > 0 && Array.from({ length: spec.pips }, (_, i) => <rect key={i} x={32 - spec.pips * 4 + i * 8 + 1} y={76} width={6} height={6} fill={spec.prestige >= 3 ? TINCTURES.or : LINE} stroke={OUTLINE} strokeWidth={0.6} />)}
    </svg>
  );
}

/** Federation Title order star: eight gold points and a ring behind the shield (a ring alone at the small size is
 *  covered by the round title frame, so the star is drawn from md upwards). Ranks never carry it. */
function OrderStar({ small, fill }: { small: boolean; fill: string }) {
  if (small) return null;
  const pts = Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8 - Math.PI / 2, r = i % 2 ? 31 : 42; return `${(32 + r * Math.cos(a)).toFixed(1)} ${(37 + r * Math.sin(a)).toFixed(1)}`; });
  return (
    <g data-order-star="">
      <path d={`M${pts.join('L')}Z`} fill={fill} stroke={OUTLINE} strokeWidth={0.9} strokeLinejoin="round" />
      <circle cx={32} cy={37} r={35} fill="none" stroke={OUTLINE} strokeWidth={4.5} />
      <circle cx={32} cy={37} r={35} fill="none" stroke={TINCTURES.or} strokeWidth={2.6} />
    </g>
  );
}

/** Tournament motifs (one per event kind, src/heraldry/charges.ts MOTIFS), drawn behind the shield. */
function Motif({ motif, gold }: { motif: MotifId; gold: string }) {
  const o = { stroke: OUTLINE, strokeWidth: 0.9, strokeLinejoin: 'round' as const };
  switch (motif) {
    case 'compony': return null; // drawn inside the field as a bordure
    case 'rays': {
      const d = Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8, w = 0.12; const p = (r: number, t: number) => `${(32 + r * Math.cos(t)).toFixed(1)} ${(37 + r * Math.sin(t)).toFixed(1)}`; return `M${p(14, a - w)}L${p(i % 2 ? 37 : 42, a)}L${p(14, a + w)}Z`; }).join('');
      return <path data-motif-art="rays" d={d} fill={gold} {...o} />;
    }
    case 'compass': {
      const pts = Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8 - Math.PI / 2, r = i % 4 === 0 ? 42 : i % 2 ? 16 : 33; return `${(32 + r * Math.cos(a)).toFixed(1)} ${(37 + r * Math.sin(a)).toFixed(1)}`; });
      return <path data-motif-art="compass" d={`M${pts.join('L')}Z`} fill={TINCTURES.argent} {...o} />;
    }
    case 'swords': return (
      <g data-motif-art="swords" fill={TINCTURES.argent} {...o}>
        {[-40, 40].map(r => (
          <g key={r} transform={`rotate(${r} 32 37)`}>
            <path d="M30.5 -6L32 -10L33.5 -6V70H30.5Z" />
            <rect x={23} y={70} width={18} height={3.4} rx={1} fill={TINCTURES.or} />
            <rect x={30.6} y={73} width={2.8} height={7} fill={TINCTURES.bronze} />
            <circle cx={32} cy={82} r={2.4} fill={TINCTURES.or} />
          </g>
        ))}
      </g>
    );
    case 'pennants': return (
      <g data-motif-art="pennants" {...o}>
        <path d="M9 8L-2 -12" fill="none" stroke={TINCTURES.bronze} strokeWidth={1.8} />
        <path d="M55 8L66 -12" fill="none" stroke={TINCTURES.bronze} strokeWidth={1.8} />
        <path d="M-2 -12L-9 -1L1 -6Z" fill={TINCTURES.gules} />
        <path d="M66 -12L73 -1L63 -6Z" fill={TINCTURES.azure} />
      </g>
    );
    case 'battlement': return <path data-motif-art="battlement" d="M-8 22V2H-2V-4H6V2H14V-4H22V2H42V-4H50V2H58V-4H66V2H72V22Z" fill={TINCTURES.steel} {...o} />;
    case 'ribbon': return (
      <g data-motif-art="ribbon" {...o}>
        <path d="M-9 60L4 58L4 72L-9 74L-4 67Z" fill={TINCTURES.sanguine} />
        <path d="M73 60L60 58L60 72L73 74L68 67Z" fill={TINCTURES.sanguine} />
        <path d="M2 57H62V71H2Z" fill={TINCTURES.gules} />
      </g>
    );
  }
}

/** Circuit Grade sublevel chevrons (III = one, II = two, I = three) under the shield; thicker at the small size.
 *  Drawn in the theme's text colour (not gold) over a dark outline, so they keep full contrast on light and dark themes. */
function RankMarks({ count, small }: { count: 1 | 2 | 3; small: boolean }) {
  const w = small ? 18 : 16, gap = small ? 3 : 4, total = count * w + (count - 1) * gap;
  const y = small ? 76 : 75, h = small ? 13 : 10;
  const paths = Array.from({ length: count }, (_, i) => { const x = 32 - total / 2 + i * (w + gap); return `M${x} ${y + h}L${x + w / 2} ${y}L${x + w} ${y + h}`; });
  return (
    <g data-marks={count} fill="none" strokeLinejoin="miter" strokeLinecap="square">
      {!small && paths.map((d, i) => <path key={`o${i}`} d={d} stroke={OUTLINE} strokeWidth={5.4} />)}
      {paths.map((d, i) => <path key={i} d={d} stroke={LINE} strokeWidth={small ? 5 : 3.2} />)}
    </g>
  );
}
/** Trophy silhouettes for real recorded titles (original vector drawings). */
const TROPHY: Record<string, string> = {
  grand: 'M16 6H48V18C48 30 40 38 34 40V48H42V54H22V48H30V40C24 38 16 30 16 18ZM8 10H16V14H12V18C12 22 14 24 16 25V29C11 28 8 24 8 18ZM56 10H48V14H52V18C52 22 50 24 48 25V29C53 28 56 24 56 18ZM18 56H46V62H18Z',
  amphora: 'M24 6H40V10C46 14 48 22 46 30C44 38 38 42 36 44V50H42V56H22V50H28V44C26 42 20 38 18 30C16 22 18 14 24 10ZM14 16L20 20V26L14 22ZM50 16L44 20V26L50 22ZM18 58H46V62H18Z',
  goblet: 'M18 6H46C46 22 40 30 34 32V48H42V54H22V48H30V32C24 30 18 22 18 6ZM18 56H46V62H18Z',
  plate: 'M32 4A24 24 0 1 1 31.99 4ZM32 12A16 16 0 1 0 32.01 12ZM24 56H40V62H24Z',
  cup: 'M20 12H44V20C44 28 38 32 34 33V46H40V52H24V46H30V33C26 32 20 28 20 20ZM14 14H20V18H17V20C17 23 18 25 20 26V29C16 28 14 25 14 20ZM50 14H44V18H47V20C47 23 46 25 44 26V29C48 28 50 25 50 20ZM20 54H44V60H20Z',
};
/** v1.0 polished metal: light, base and shade stops for gold, silver and bronze (trophies and trophy art). */
export const METAL_STOPS: Record<'or' | 'argent' | 'bronze', [string, string, string]> = {
  or: ['#f3dc93', TINCTURES.or, '#9c7322'],
  argent: ['#f7f9fb', TINCTURES.argent, '#8d96a2'],
  bronze: ['#d9a774', TINCTURES.bronze, '#5e3f1f'],
};
/** A vertical metal gradient definition (one per SVG; ids come from useId so many trophies can share a page). */
export function MetalGradient({ id, metal }: { id: string; metal: 'or' | 'argent' | 'bronze' }) {
  const [a, b, c] = METAL_STOPS[metal];
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stopColor={a} />
      <stop offset="0.5" stopColor={b} />
      <stop offset="1" stopColor={c} />
    </linearGradient>
  );
}
export function Trophy({ kind, size = 'md', title, metal = 'or' }: { kind: keyof typeof TROPHY | string; size?: EmblemSize; title: string; metal?: 'or' | 'argent' | 'bronze' }) {
  const uid = useId().replace(/:/g, '');
  const px = EMBLEM_PX[size];
  const small = size === 'sm';
  return (
    <svg className="trophy" width={px} height={px} viewBox="0 0 64 64" role="img" aria-label={title || 'Trophy'}>
      <title>{title}</title>
      {!small && <defs><MetalGradient id={`m${uid}`} metal={metal} /></defs>}
      {!small && <ellipse cx={32} cy={62} rx={18} ry={2} fill="#000" opacity={0.22} />}
      <path d={TROPHY[kind] ?? TROPHY.cup} fill={small ? TINCTURES[metal] : `url(#m${uid})`} fillRule="evenodd" stroke="var(--her-outline, #111318)" strokeWidth={small ? 2 : 1.4} strokeLinejoin="round" />
      {!small && <path d="M24 9C23 18 25 26 29 30" fill="none" stroke="var(--her-shine, #fff8e6)" strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />}
    </svg>
  );
}
export const TROPHY_KINDS = Object.keys(TROPHY);
