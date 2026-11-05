/**
 * Circuit Grade insignia (crown-circuit-grades-1, docs/FEUDAL_RANKS.md §6), built from the heraldry grammar:
 *   shape  = the Federation division the grade belongs to (the same shield shape as that division's emblem),
 *   charge = the grade (16 distinct charges, none equal to its division emblem's charge),
 *   field  = the division's tincture; the upper grade of a division adds a gold chief,
 *   border / crest / wreath / prestige rise with the division,
 *   marks  = the sublevel: one chevron for III, two for II, three for I (drawn at every size).
 * 16 grades × 3 sublevels = 48 distinct specs (unit-tested by signature).
 */
import type { ChargeId, ShapeId, Tincture } from './charges';
import type { EmblemSpec } from './spec';

/** Division (1 = Crown … 8 = Open) → its shield shape (identical to divisionEmblem's shape) and field tincture. */
const DIV_STYLE: Record<number, { shape: ShapeId; field: Tincture }> = {
  1: { shape: 'cartouche', field: 'sable' }, 2: { shape: 'heater', field: 'sanguine' }, 3: { shape: 'tower', field: 'gules' },
  4: { shape: 'kite', field: 'purpure' }, 5: { shape: 'octagon', field: 'vert' }, 6: { shape: 'hexagon', field: 'azure' },
  7: { shape: 'lozenge', field: 'steel' }, 8: { shape: 'banner', field: 'bronze' },
};
/** Grade index 0..15 (cg-01 … cg-16) → charge. */
const GRADE_CHARGE: ChargeId[] = ['pawn', 'quill', 'key', 'sword', 'knight', 'flame', 'rook', 'scales', 'moon', 'griffin', 'star', 'chalice', 'laurel', 'sun', 'king', 'crown'];

/** The insignia of grade `gradeIndex` (0 = cg-01 … 15 = cg-16) at sublevel `sub` (0 = III, 1 = II, 2 = I). */
export function gradeEmblem(gradeIndex: number, sub: number): EmblemSpec {
  const g = Math.max(0, Math.min(15, Math.floor(gradeIndex)));
  const division = 8 - Math.floor(g / 2);
  const upper = g % 2 === 1;
  const { shape, field } = DIV_STYLE[division];
  const tier = 8 - division; // 0 (Open) … 7 (Crown)
  const goldCharge = tier >= 4 || (upper && tier >= 2);
  return {
    shape,
    field: [field, upper ? 'or' : 'sable'],
    division: upper ? 'chief' : 'plain',
    charge: GRADE_CHARGE[g],
    chargeColor: goldCharge ? 'or' : 'argent',
    border: tier >= 5 ? 'pixel' : tier >= 2 ? 'double' : 'single',
    crest: tier >= 6 ? 'crown' : tier >= 4 ? 'coronet' : tier >= 3 ? 'helm' : null,
    wreath: g === 15 || g === 14,
    pips: 0,
    prestige: Math.min(5, Math.floor(g / 3)),
    marks: (Math.max(0, Math.min(2, Math.floor(sub))) + 1) as 1 | 2 | 3,
  };
}
