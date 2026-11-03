import type { ChargeId, CrestId, DivisionId, ShapeId, Tincture } from './charges';

/** A complete, serialisable emblem description. Every emblem in the game is one of these. */
export interface EmblemSpec {
  shape: ShapeId;
  division: DivisionId;
  field: [Tincture | string, Tincture | string];
  charge: ChargeId | null;
  chargeColor: Tincture | string;
  /** single = one outline; double = inner rule; pixel = stepped pixel corners (higher prestige). */
  border: 'single' | 'double' | 'pixel';
  crest: CrestId | null;
  wreath: boolean;
  /** Pixel pips under the shield (0–5) — the tier count of a ladder. */
  pips: number;
  /** Optional 1–3 letter monogram shown at medium/large sizes (e.g. a title abbreviation). */
  monogram?: string;
  /** Prestige 0–5: thicker border and glow at the top of a ladder. */
  prestige: number;
}
export type EmblemSize = 'sm' | 'md' | 'lg';
export const EMBLEM_PX: Record<EmblemSize, number> = { sm: 22, md: 44, lg: 104 };

/** Stable signature of an emblem's silhouette-relevant features (used to test distinctiveness). */
export const signature = (s: EmblemSpec) => [s.shape, s.division, s.charge, s.crest, s.wreath ? 'w' : '', s.pips, s.border].join('|');
