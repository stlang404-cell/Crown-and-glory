import { useId } from 'react';
import { CHARGES, CRESTS, DIVISIONS, SHAPES, TINCTURES, type Tincture } from '../heraldry/charges';
import { EMBLEM_PX, type EmblemSize, type EmblemSpec } from '../heraldry/spec';

const tint = (t: Tincture | string) => (t in TINCTURES ? TINCTURES[t as Tincture] : t);

/**
 * Renders any EmblemSpec as inline SVG (no external assets). Line weight is constant in screen pixels per size;
 * small sizes drop fine ornaments (wreath, monogram, pips) so silhouettes stay legible on phones.
 */
export function Emblem({ spec, size = 'md', title, className }: { spec: EmblemSpec; size?: EmblemSize; title: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const px = EMBLEM_PX[size];
  const small = size === 'sm';
  const top = spec.crest ? -16 : -2;
  const bottom = !small && spec.pips ? 84 : 74;
  const left = spec.wreath && !small ? -10 : -2, right = spec.wreath && !small ? 74 : 66;
  const vb = `${left} ${top} ${right - left} ${bottom - top}`;
  const h = Math.round(px * ((bottom - top) / (right - left)));
  const stroke = small ? 3.6 : size === 'md' ? 2.6 : 2;
  const shape = SHAPES[spec.shape];
  const metal = spec.prestige >= 4 ? TINCTURES.or : 'var(--her-line, #f2ede3)';
  return (
    <svg className={`emblem ${className ?? ''}`} width={(px * (right - left)) / 68} height={h} viewBox={vb} role="img" aria-label={title || 'Heraldic emblem'} data-emblem={spec.shape}>
      <title>{title}</title>
      <defs><clipPath id={`c${uid}`}><path d={shape} /></clipPath></defs>
      {spec.prestige >= 4 && !small && <path d={shape} fill="none" stroke={TINCTURES.or} strokeOpacity={0.35} strokeWidth={stroke * 4} />}
      {spec.wreath && !small && (
        <g fill={TINCTURES.or} opacity={0.95}>
          {[0, 1, 2, 3, 4, 5].map(i => <ellipse key={`l${i}`} cx={-4 + i * 1.2} cy={64 - i * 10} rx={3} ry={6} transform={`rotate(${-25 + i * 6} ${-4 + i * 1.2} ${64 - i * 10})`} />)}
          {[0, 1, 2, 3, 4, 5].map(i => <ellipse key={`r${i}`} cx={68 - i * 1.2} cy={64 - i * 10} rx={3} ry={6} transform={`rotate(${25 - i * 6} ${68 - i * 1.2} ${64 - i * 10})`} />)}
        </g>
      )}
      <g clipPath={`url(#c${uid})`}>
        <rect x={0} y={0} width={64} height={72} fill={tint(spec.field[0])} />
        {spec.division !== 'plain' && <path d={DIVISIONS[spec.division]} fill={tint(spec.field[1])} />}
      </g>
      {spec.charge && (
        <g transform="translate(14 19) scale(1.12)">
          <path d={CHARGES[spec.charge]} fill={tint(spec.chargeColor)} stroke="var(--her-outline, #111318)" strokeWidth={small ? 1.6 : 1.1} strokeLinejoin="round" paintOrder="stroke" />
        </g>
      )}
      <path d={shape} fill="none" stroke={metal} strokeWidth={stroke + (spec.prestige >= 3 ? 0.8 : 0)} strokeLinejoin="round" />
      {spec.border === 'double' && !small && <path d={shape} fill="none" stroke={metal} strokeWidth={1} transform="translate(32 37) scale(0.86) translate(-32 -37)" />}
      {spec.border === 'pixel' && [[4, 4], [56, 4], [4, 58], [56, 58]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width={small ? 6 : 4} height={small ? 6 : 4} fill={metal} />)}
      {spec.crest && <path d={CRESTS[spec.crest]} transform="translate(0 -16)" fill={spec.prestige >= 3 ? TINCTURES.or : 'var(--her-line, #f2ede3)'} stroke="var(--her-outline, #111318)" strokeWidth={0.8} />}
      {spec.monogram && size === 'lg' && <text x={32} y={66} textAnchor="middle" fontSize={9} fontWeight={700} fill={metal} fontFamily="var(--mono, monospace)">{spec.monogram}</text>}
      {!small && spec.pips > 0 && Array.from({ length: spec.pips }, (_, i) => <rect key={i} x={32 - spec.pips * 4 + i * 8 + 1} y={76} width={6} height={6} fill={spec.prestige >= 3 ? TINCTURES.or : 'var(--her-line, #f2ede3)'} />)}
    </svg>
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
export function Trophy({ kind, size = 'md', title, metal = 'or' }: { kind: keyof typeof TROPHY | string; size?: EmblemSize; title: string; metal?: 'or' | 'argent' | 'bronze' }) {
  const px = EMBLEM_PX[size];
  return (
    <svg className="trophy" width={px} height={px} viewBox="0 0 64 64" role="img" aria-label={title || 'Trophy'}>
      <title>{title}</title>
      <path d={TROPHY[kind] ?? TROPHY.cup} fill={TINCTURES[metal]} stroke="var(--her-outline, #111318)" strokeWidth={size === 'sm' ? 2 : 1.4} strokeLinejoin="round" />
      {size !== 'sm' && <rect x={30} y={13} width={4} height={4} fill="var(--her-shine, #fff8e6)" opacity={0.8} />}
    </svg>
  );
}
export const TROPHY_KINDS = Object.keys(TROPHY);
