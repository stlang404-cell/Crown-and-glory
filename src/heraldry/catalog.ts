/**
 * The federation's emblem catalogue (crown-heraldry-1): every category maps state → EmblemSpec with a fixed
 * family silhouette, so a player learns to read them:
 *   divisions → one shield shape per tier · rating ranks → roundel medals with chevron pips ·
 *   federation titles → standards (pennant → heater → kite → cartouche) · regions → heater arms ·
 *   tournaments → crests · clubs → editor/generator · financial tiers → coins · achievements → hexagon badges.
 * Higher rungs of a ladder gain crests, wreaths, gold borders and pixel pips — more prestige, same clarity.
 */
import { REGION_NAMES } from '../federation/model';
import type { ChargeId, DivisionId, ShapeId, Tincture } from './charges';
import type { EmblemSpec } from './spec';

const base = (o: Partial<EmblemSpec> & Pick<EmblemSpec, 'shape' | 'field' | 'charge'>): EmblemSpec =>
  ({ division: 'plain', chargeColor: 'argent', border: 'single', crest: null, wreath: false, pips: 0, prestige: 0, ...o });

// ---------------------------------------------------------------- league divisions (1 = Crown Division)
const DIV: { shape: ShapeId; charge: ChargeId; field: [Tincture, Tincture]; division: DivisionId }[] = [
  { shape: 'cartouche', charge: 'crown', field: ['sanguine', 'or'], division: 'chief' },
  { shape: 'heater', charge: 'queen', field: ['purpure', 'sable'], division: 'chevron' },
  { shape: 'tower', charge: 'rook', field: ['azure', 'sable'], division: 'fess' },
  { shape: 'kite', charge: 'knight', field: ['vert', 'sable'], division: 'bend' },
  { shape: 'octagon', charge: 'tower', field: ['tenne', 'sable'], division: 'pale' },
  { shape: 'hexagon', charge: 'pawn', field: ['steel', 'sable'], division: 'quarterly' },
  { shape: 'lozenge', charge: 'star', field: ['bronze', 'sable'], division: 'plain' },
  { shape: 'banner', charge: 'gate', field: ['sable', 'steel'], division: 'pily' },
];
export function divisionEmblem(d: number): EmblemSpec {
  const x = DIV[Math.max(1, Math.min(8, d)) - 1];
  const prestige = Math.max(0, 5 - d + 1); // div1 → 5 … div5+ → 0/1
  return base({ ...x, chargeColor: d <= 2 ? 'or' : 'argent', border: d === 1 ? 'pixel' : d <= 3 ? 'double' : 'single', crest: d === 1 ? 'crown' : d === 2 ? 'coronet' : null, wreath: d === 1, pips: 0, prestige: Math.max(0, prestige) });
}

// ---------------------------------------------------------------- rating ranks (temporary, rating-band based)
export const RANK_ORDER = ['Provisional', 'Club', 'District', 'Regional', 'National', 'Master Circuit', 'Crown Contender'];
export function rankEmblem(rank: string): EmblemSpec {
  const i = Math.max(0, RANK_ORDER.indexOf(rank));
  const charges: ChargeId[] = ['hourglass', 'pawn', 'knight', 'rook', 'queen', 'king', 'crown'];
  return base({ shape: 'roundel', field: [i >= 5 ? 'sanguine' : 'sable', 'steel'], division: i >= 3 ? 'chief' : 'plain', charge: charges[i], chargeColor: i >= 5 ? 'or' : 'argent', border: i >= 6 ? 'pixel' : i >= 4 ? 'double' : 'single', crest: i >= 6 ? 'star' : null, pips: Math.min(5, i), prestige: Math.min(5, i) });
}

// ---------------------------------------------------------------- earned federation titles (permanent)
export const FED_TITLES = ['Squire', 'Knight', 'Paladin', 'Sovereign'] as const;
export type FedTitle = typeof FED_TITLES[number];
export const FED_TITLE_ABBR: Record<FedTitle, string> = { Squire: 'SQ', Knight: 'KT', Paladin: 'PL', Sovereign: 'SV' };
export function titleEmblem(t: FedTitle): EmblemSpec {
  const i = FED_TITLES.indexOf(t);
  const shape: ShapeId[] = ['pennant', 'heater', 'kite', 'cartouche'];
  const charge: ChargeId[] = ['pawn', 'knight', 'sword', 'crown'];
  return base({ shape: shape[i], field: [['azure', 'sanguine', 'purpure', 'sable'][i], 'or'], division: i >= 2 ? 'chief' : 'plain', charge: charge[i], chargeColor: i >= 2 ? 'or' : 'argent', border: i === 3 ? 'pixel' : i >= 1 ? 'double' : 'single', crest: i === 3 ? 'crown' : i === 2 ? 'helm' : null, wreath: i === 3, pips: i + 1, monogram: FED_TITLE_ABBR[t], prestige: [1, 2, 4, 5][i] });
}

// ---------------------------------------------------------------- regional federations (distinct arms for 128 regions)
const REGION_CHARGE: ChargeId[] = ['anchor', 'sun', 'moon', 'tower', 'key', 'flame', 'griffin', 'quill', 'scales', 'chalice', 'book', 'star', 'hourglass', 'sword', 'gate', 'laurel'];
const REGION_FIELD: [Tincture, Tincture][] = [['azure', 'argent'], ['or', 'sanguine'], ['sable', 'celeste'], ['vert', 'or'], ['gules', 'argent'], ['tenne', 'sable'], ['purpure', 'or'], ['celeste', 'azure'], ['steel', 'sable'], ['sanguine', 'or'], ['bronze', 'vert'], ['azure', 'or'], ['sable', 'gules'], ['argent', 'gules'], ['vert', 'argent'], ['purpure', 'argent']];
const REGION_DIV: DivisionId[] = ['fess', 'pale', 'bend', 'chevron', 'chief', 'quarterly', 'saltire', 'pily'];
/** Division/charge pairs of regions 17+ (v0.10 larger topologies): every pair not used by regions 1–16, in a fixed
 *  spread order, so each of the 80 named regions has its own silhouette (shape · division · charge). */
const EXTRA_REGION_PAIRS: [number, number][] = (() => {
  const used = new Set(Array.from({ length: 16 }, (_, i) => `${i % 8}:${i % 16}`));
  const free: [number, number][] = [];
  for (let c = 0; c < 16; c++) for (let d = 0; d < 8; d++) if (!used.has(`${d}:${c}`)) free.push([d, c]);
  return Array.from({ length: free.length }, (_, k) => free[(k * 37) % free.length]); // 37 is coprime to 112
})();
export function regionEmblem(r: number): EmblemSpec {
  if (r >= 16 && r < 16 + EXTRA_REGION_PAIRS.length) {
    const [d, c] = EXTRA_REGION_PAIRS[r - 16];
    const [a, b] = REGION_FIELD[(r * 5 + Math.floor(r / 16)) % 16];
    const light = a === 'argent' || a === 'or' || a === 'celeste';
    // a double border keeps these silhouettes apart from the (single-bordered) club and federation emblems
    return base({ shape: 'heater', field: [a, b], division: REGION_DIV[d], charge: REGION_CHARGE[c], chargeColor: light ? 'sable' : 'argent', border: 'double', prestige: 1 });
  }
  const [a, b] = REGION_FIELD[r % 16];
  const light = a === 'argent' || a === 'or' || a === 'celeste';
  return base({ shape: 'heater', field: [a, b], division: REGION_DIV[r % 8], charge: REGION_CHARGE[r % 16], chargeColor: light ? 'sable' : 'argent', border: 'single', prestige: 1 });
}
export const regionTitle = (r: number) => `Arms of ${REGION_NAMES[r]}`;

// ---------------------------------------------------------------- major tournaments
export const TOURNAMENTS = ['league', 'challenger', 'open', 'champ', 'club'] as const;
export type TournamentId = typeof TOURNAMENTS[number];
export const TOURNAMENT_NAME: Record<TournamentId, string> = { league: 'Division League', challenger: 'Challenger Open', open: 'Federation Open', champ: 'Crown Championship', club: 'Club Weekend' };
export function tournamentCrest(t: TournamentId): EmblemSpec {
  switch (t) {
    case 'league': return base({ shape: 'roundel', field: ['sable', 'steel'], division: 'fess', charge: 'rook', border: 'double', prestige: 1 });
    case 'challenger': return base({ shape: 'lozenge', field: ['vert', 'sable'], division: 'plain', charge: 'flame', chargeColor: 'or', border: 'single', pips: 1, prestige: 2 });
    case 'open': return base({ shape: 'octagon', field: ['azure', 'sable'], division: 'saltire', charge: 'knight', chargeColor: 'or', border: 'double', crest: 'star', pips: 2, prestige: 3 });
    case 'champ': return base({ shape: 'cartouche', field: ['sanguine', 'sable'], division: 'chief', charge: 'crown', chargeColor: 'or', border: 'pixel', crest: 'crown', wreath: true, pips: 3, prestige: 5 });
    case 'club': return base({ shape: 'banner', field: ['tenne', 'sable'], division: 'chevron', charge: 'gate', border: 'single', prestige: 1 });
  }
}
/** Trophy silhouette per event (rendered by <Trophy/>). */
export const TROPHY_FOR: Record<TournamentId, string> = { champ: 'grand', open: 'amphora', challenger: 'goblet', league: 'plate', club: 'cup' };

// ---------------------------------------------------------------- financial prestige tiers
export const FIN_TIERS = ['Apprentice', 'Saver', 'Investor', 'Patron', 'Magnate'] as const;
export function financialEmblem(tier: string): EmblemSpec {
  const i = Math.max(0, FIN_TIERS.indexOf(tier as typeof FIN_TIERS[number]));
  return base({ shape: 'roundel', field: [(['bronze', 'steel', 'argent', 'or', 'or'] as Tincture[])[i], 'sable'], division: i >= 3 ? 'chief' : 'plain', charge: (['coin', 'coin', 'scales', 'key', 'crown'] as ChargeId[])[i], chargeColor: i >= 2 ? 'sable' : 'argent', border: i >= 4 ? 'pixel' : i >= 2 ? 'double' : 'single', crest: i >= 4 ? 'coronet' : null, pips: i, prestige: i });
}

// ---------------------------------------------------------------- achievements (badges)
export interface AchievementDef { id: string; name: string; charge: ChargeId; field: Tincture; description: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-win', name: 'First Blood', charge: 'sword', field: 'gules', description: 'Win your first federation game.' },
  { id: 'promotion', name: 'Ascent', charge: 'tower', field: 'vert', description: 'Win promotion to a higher division.' },
  { id: 'league-title', name: 'Division Crown', charge: 'crown', field: 'purpure', description: 'Win a division title.' },
  { id: 'swiss-podium', name: 'Swiss Laurel', charge: 'laurel', field: 'azure', description: 'Finish top three in a Swiss event.' },
  { id: 'giant-slayer', name: 'Giant Slayer', charge: 'griffin', field: 'sanguine', description: 'Beat an opponent rated 250+ points above you in a federation game.' },
  { id: 'norm', name: 'First Norm', charge: 'star', field: 'steel', description: 'Score a federation title norm.' },
  { id: 'forecaster', name: 'Clear Sight', charge: 'sun', field: 'celeste', description: 'Ten resolved paper forecasts with a Brier score below the public model.' },
  { id: 'patron', name: 'Patron of the Game', charge: 'chalice', field: 'or', description: 'Own a Club with Tournament Venue or better.' },
];
export function achievementEmblem(a: AchievementDef, earned: boolean): EmblemSpec {
  return base({ shape: 'hexagon', field: [earned ? a.field : 'sable', 'sable'], division: 'plain', charge: a.charge, chargeColor: earned ? (a.field === 'or' || a.field === 'argent' || a.field === 'celeste' ? 'sable' : 'or') : 'steel', border: earned ? 'double' : 'single', prestige: earned ? 2 : 0 });
}

// ---------------------------------------------------------------- personal insignia of a competitor (deterministic)
const PERSONAL_SHAPES: ShapeId[] = ['heater', 'kite', 'heater', 'roundel', 'lozenge', 'tower'];
const PERSONAL_CHARGES: ChargeId[] = ['knight', 'rook', 'star', 'moon', 'sun', 'key', 'flame', 'anchor', 'griffin', 'quill', 'tower', 'hourglass', 'sword', 'scales', 'chalice', 'book'];
const PALETTE: Tincture[] = ['gules', 'azure', 'vert', 'purpure', 'sable', 'tenne', 'sanguine', 'steel', 'bronze', 'celeste', 'or', 'argent'];
function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function personalEmblem(id: string, titles: number, fedTitle: FedTitle | null): EmblemSpec {
  const h = h32(id);
  const a = PALETTE[h % 10], b = PALETTE[(h >>> 4) % 12 === h % 10 ? 11 : (h >>> 4) % 12];
  const light = a === 'celeste' || a === 'or' || a === 'argent';
  return base({ shape: PERSONAL_SHAPES[(h >>> 8) % PERSONAL_SHAPES.length], field: [a, b], division: (['fess', 'pale', 'bend', 'chevron', 'chief', 'quarterly', 'saltire'] as DivisionId[])[(h >>> 12) % 7], charge: PERSONAL_CHARGES[(h >>> 16) % 16], chargeColor: light ? 'sable' : 'argent', border: titles >= 3 ? 'double' : 'single', crest: fedTitle === 'Sovereign' ? 'crown' : fedTitle === 'Paladin' ? 'helm' : null, wreath: titles >= 5, prestige: Math.min(5, titles) });
}
