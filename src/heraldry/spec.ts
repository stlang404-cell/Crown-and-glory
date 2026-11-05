import type { ChargeId, CrestId, DivisionId, LineId, MotifId, ShapeId, Tincture } from './charges';

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
  /** v0.11 Circuit Grade sublevel embellishment (src/heraldry/ranks.ts): 1–3 chevrons under the shield, drawn at
   *  every size (unlike pips) so sublevels III / II / I stay distinguishable at 22 px. Absent on every other emblem. */
  marks?: 1 | 2 | 3;
  /** v1.0 line of partition for fess / chief / pale divisions (rendering detail; default straight). */
  line?: LineId;
  /** v1.0 tournament-crest motif drawn around the shield at md/lg (one per event kind; src/heraldry/catalog.ts). */
  motif?: MotifId;
  /** v1.0 Federation Title: the shield sits on a gold order star and ring, so a title never reads like a rank insignia. */
  order?: boolean;
}
export type EmblemSize = 'sm' | 'md' | 'lg';
export const EMBLEM_PX: Record<EmblemSize, number> = { sm: 22, md: 44, lg: 104 };

/** Stable signature of an emblem's silhouette-relevant features (used to test distinctiveness). */
export const signature = (s: EmblemSpec) => [s.shape, s.division, s.charge, s.crest, s.wreath ? 'w' : '', s.pips, s.border].join('|') + (s.marks ? `|m${s.marks}` : '') + (s.order ? '|o' : '') + (s.motif ? `|t:${s.motif}` : '');
