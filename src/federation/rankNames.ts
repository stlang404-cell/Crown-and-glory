/**
 * Circuit Grade names (crown-circuit-grades-1, docs/FEUDAL_RANKS.md).
 *
 * PROPOSED LIST. The owner referred to an approved 16-rank Medieval Feudal hierarchy with 16 stable Circuit Grade
 * ids; that list was never delivered, so this list was written for v0.11 as a proposal. The owner can rename any
 * grade HERE, and only here: every other module, every save and every test refers to grades by their stable id
 * (`cg-01` … `cg-16`) or by their index, never by name. Never renumber or reorder the ids.
 *
 * Order: lowest (cg-01) to highest (cg-16). Two grades per Federation division: division 8 holds cg-01/cg-02,
 * division 7 cg-03/cg-04 … division 1 cg-15/cg-16.
 *
 * Naming note: "Squire" and "Knight" are also two of the four permanent Federation titles earned by norms
 * (src/heraldry/catalog.ts FED_TITLES). The UI always shows a grade with its sublevel ("Knight II") and as a
 * "Circuit Grade", and its insignia uses the rank family, so the two never read the same; rename here if wanted.
 */
export interface GradeName { id: string; name: string }

export const CIRCUIT_GRADE_NAMES: readonly GradeName[] = [
  { id: 'cg-01', name: 'Commoner' },
  { id: 'cg-02', name: 'Page' },
  { id: 'cg-03', name: 'Squire' },
  { id: 'cg-04', name: 'Man-at-Arms' },
  { id: 'cg-05', name: 'Knight' },
  { id: 'cg-06', name: 'Knight Banneret' },
  { id: 'cg-07', name: 'Baronet' },
  { id: 'cg-08', name: 'Baron' },
  { id: 'cg-09', name: 'Viscount' },
  { id: 'cg-10', name: 'Earl' },
  { id: 'cg-11', name: 'Marquess' },
  { id: 'cg-12', name: 'Duke' },
  { id: 'cg-13', name: 'Grand Duke' },
  { id: 'cg-14', name: 'Prince' },
  { id: 'cg-15', name: 'King' },
  { id: 'cg-16', name: 'High Sovereign' },
];

/** Whether the list above is the owner's approved list ('approved') or this package's proposal ('proposed'). */
export const CIRCUIT_GRADE_LIST_STATUS: 'proposed' | 'approved' = 'proposed';
