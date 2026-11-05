/**
 * Original heraldic trophy art (crown-trophies-1): one silhouette per trophy kind, drawn on a 64×64 grid as local SVG.
 * The prestige tier sets the metal (bronze, silver, gold, gold with a jewel, gold with a crown and laurel), so a
 * trophy's family reads from its outline and its standing from its finish. No downloaded images.
 */
import type { TrophyKind, Tier } from '../legacy/trophies';
import { useId } from 'react';
import { TINCTURES } from '../heraldry/charges';
import { MetalGradient } from './Emblem';

/** Body silhouettes per kind (filled with the tier metal). */
export const TROPHY_ART: Record<TrophyKind, string> = {
  // two-handled cup on a stepped plinth
  'regional-cup': 'M20 10H44V22C44 30 38 34 34 35V44H40V48H24V44H30V35C26 34 20 30 20 22ZM13 13H20V17H16V21C16 24 18 26 20 27V31C15 30 13 26 13 21ZM51 13H44V17H48V21C48 24 46 26 44 27V31C49 30 51 26 51 21ZM18 50H46V55H18ZM14 56H50V60H14Z',
  // heater shield standing on a plinth
  'division-trophy': 'M14 6H50V26C50 40 41 47 32 51C23 47 14 40 14 26ZM26 52H38V55H26ZM18 56H46V60H18Z',
  // swallow-tailed banner on a pole with a finial
  'seasonal-banner': 'M10 4H14V60H10ZM9 2H15V5H9ZM14 8H54L46 20L54 32H14Z',
  // tall lidded goblet with a finial
  invitational: 'M30 2H34V6H30ZM24 6H40V9H24ZM20 10H44C44 24 39 30 34 31V46H41V50H23V46H30V31C25 30 20 24 20 10ZM17 52H47V58H17Z',
  // crossed swords behind a roundel
  'rivalry-trophy': 'M8 6L12 4L36 30L33 33ZM56 6L52 4L28 30L31 33ZM32 22A14 14 0 1 1 31.99 22ZM9 52L14 47L17 50L12 55ZM55 52L50 47L47 50L52 55ZM20 56H44V60H20Z',
  // starburst medallion on a short stand
  'rating-milestone': 'M32 2L36 12L46 8L44 18L55 20L47 28L54 36L44 38L46 48L36 44L32 54L28 44L18 48L20 38L10 36L17 28L9 20L20 18L18 8L28 12ZM24 56H40V60H24Z',
  // medal on a V ribbon
  medal: 'M16 2H28L36 22H24ZM48 2H36L28 22H40ZM32 22A16 16 0 1 1 31.99 22ZM32 28A10 10 0 1 0 32.01 28Z',
  // crown on a tasselled cushion
  'elite-honour': 'M10 30L18 38L24 22L32 34L40 22L46 38L54 30L50 46H14ZM12 48H52L56 56H8ZM6 56H10V60H6ZM54 56H58V60H54Z',
  // armillary orb on a stand
  'forecasting-championship': 'M32 6A18 18 0 1 1 31.99 6ZM32 11A13 13 0 1 0 32.01 11ZM14 24H50V26H14ZM31 6H33V42H31ZM28 42H36V48H28ZM20 50H44V55H20ZM16 56H48V60H16Z',
  // obelisk on a two-step base
  'career-monument': 'M28 2H36L40 10V46H24V10ZM20 48H44V53H20ZM14 54H50V60H14Z',
};

const METAL: Record<Tier, string> = { 1: TINCTURES.bronze, 2: TINCTURES.argent, 3: TINCTURES.or, 4: TINCTURES.or, 5: TINCTURES.or };
const METAL_ID: Record<Tier, 'or' | 'argent' | 'bronze'> = { 1: 'bronze', 2: 'argent', 3: 'or', 4: 'or', 5: 'or' };

export function TrophyArt({ kind, tier, size = 56, title }: { kind: TrophyKind; tier: Tier; size?: number; title: string }) {
  const small = size < 32;
  const uid = useId().replace(/:/g, '');
  return (
    <svg className={`trophy-art tier-${tier}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title || `${kind.replace(/-/g, ' ')} trophy`} data-kind={kind} data-tier={tier}>
      <title>{title}</title>
      {tier >= 5 && !small && <path d="M6 44C2 32 4 18 12 10L14 12C8 20 7 32 10 42ZM58 44C62 32 60 18 52 10L50 12C56 20 57 32 54 42Z" fill={TINCTURES.vert} opacity={0.9} />}
      {!small && <defs><MetalGradient id={`m${uid}`} metal={METAL_ID[tier]} /></defs>}
      <path d={TROPHY_ART[kind]} fill={small ? METAL[tier] : `url(#m${uid})`} fillRule="evenodd" stroke="var(--her-outline, #111318)" strokeWidth={small ? 2.2 : 1.4} strokeLinejoin="round" />
      {tier >= 4 && !small && <rect x={29} y={kind === 'seasonal-banner' ? 17 : kind === 'medal' ? 35 : 16} width={6} height={6} transform={`rotate(45 32 ${kind === 'seasonal-banner' ? 20 : kind === 'medal' ? 38 : 19})`} fill={tier >= 5 ? TINCTURES.gules : TINCTURES.purpure} stroke="var(--her-outline, #111318)" strokeWidth={0.8} />}
      {!small && <rect x={kind === 'seasonal-banner' ? 20 : 30} y={kind === 'seasonal-banner' ? 11 : 12} width={3} height={3} fill="var(--her-shine, #fff8e6)" opacity={0.75} />}
    </svg>
  );
}
