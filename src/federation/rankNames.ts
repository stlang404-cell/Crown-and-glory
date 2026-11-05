/**
 * Circuit Grade names (crown-circuit-grades-1, docs/FEUDAL_RANKS.md).
 *
 * APPROVED LIST. The owner approved these 16 names and the 48 sublevels (III → II → I) as they are (v0.11 package Q);
 * they were first written as a proposal in package P. Names live HERE only: every other module, every save and every
 * test refers to grades by their stable id (`cg-01` … `cg-16`) or by their index, never by name. Never renumber or
 * reorder the ids.
 *
 * Order: lowest (cg-01) to highest (cg-16). Two grades per Federation division: division 8 holds cg-01/cg-02,
 * division 7 cg-03/cg-04 … division 1 cg-15/cg-16.
 *
 * Shared words: "Squire" and "Knight" are also two of the four permanent Federation Titles earned by norms
 * (src/heraldry/catalog.ts FED_TITLES). The owner kept both names; instead the UI always separates the two concepts:
 * a grade is a COMPETITIVE RANK, shown with its sublevel ("Knight II"), labelled "Competitive Rank", tagged "Rank",
 * in a square chevron frame; a FEDERATION TITLE is labelled "Federation Title", tagged "Title", in a round medallion
 * (src/ui/RankBadge.tsx). Rank and title are independent fields (`rank`, `fedTitle`).
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

/** Whether the list above is the owner's approved list ('approved') or a proposal ('proposed'). Approved in v0.11. */
export const CIRCUIT_GRADE_LIST_STATUS: 'proposed' | 'approved' = 'approved';
