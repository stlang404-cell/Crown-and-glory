/**
 * Club identities (crown-clubs-1). 32 AI clubs (two per region) with stable, deterministic names, colours, mottos
 * and arms; every active competitor is affiliated to one club of their region (stable hash of their id).
 * Club finances are real ledger accounts (`club:<id>`): season dues from members and operating costs to the sink
 * (posted by the federation service). The player's club identity is chosen in the club editor and persisted with
 * the club asset. All names, shapes and symbols are original; nothing imitates a real club or team.
 */
import { REGION_NAMES } from '../federation/model';
import type { ChargeId, ShapeId, Tincture } from './charges';
import type { EmblemSpec } from './spec';

export interface ClubIdentity { name: string; primary: Tincture; secondary: Tincture; shape: ShapeId; symbol: ChargeId; motto: string; division?: EmblemSpec['division'] }
export const CLUB_SHAPES: ShapeId[] = ['heater', 'kite', 'roundel', 'tower', 'octagon', 'banner'];
export const CLUB_SYMBOLS: ChargeId[] = ['rook', 'knight', 'queen', 'king', 'crown', 'star', 'tower', 'key', 'sword', 'sun', 'moon', 'griffin', 'anchor', 'flame', 'quill', 'chalice'];
export const CLUB_COLOURS: Tincture[] = ['gules', 'azure', 'vert', 'purpure', 'sable', 'tenne', 'sanguine', 'steel', 'bronze', 'celeste', 'or', 'argent'];
const LIGHT = new Set<Tincture>(['or', 'argent', 'celeste']);

export function clubEmblem(c: ClubIdentity, level = 1): EmblemSpec {
  return {
    shape: c.shape, division: c.division ?? 'chief', field: [c.primary, c.secondary], charge: c.symbol, chargeColor: LIGHT.has(c.primary) ? 'sable' : LIGHT.has(c.secondary) ? c.secondary : 'argent',
    border: level >= 3 ? 'pixel' : level >= 2 ? 'double' : 'single', crest: level >= 3 ? 'coronet' : null, wreath: false, pips: 0, prestige: level,
  };
}
/** Validation for the editor (and for imported saves). Returns an error message or null. */
export function validateIdentity(c: ClubIdentity): string | null {
  const name = c.name.trim();
  if (name.length < 2 || name.length > 32) return 'Club name must be 2–32 characters';
  if (!/^[\p{L}\p{N} '&.\-]+$/u.test(name)) return 'Club name may use letters, numbers, spaces and ’ & . -';
  if (c.motto.length > 48) return 'Motto must be at most 48 characters';
  if (!CLUB_COLOURS.includes(c.primary) || !CLUB_COLOURS.includes(c.secondary)) return 'Choose colours from the federation palette';
  if (c.primary === c.secondary) return 'Primary and secondary colours must differ';
  if (!CLUB_SHAPES.includes(c.shape) || !CLUB_SYMBOLS.includes(c.symbol)) return 'Choose a shape and symbol from the list';
  return null;
}
export const defaultIdentity = (region: number): ClubIdentity => ({ name: `${REGION_NAMES[region]} Chess Club`, primary: 'sanguine', secondary: 'or', shape: 'heater', symbol: 'rook', motto: '' });

// ---------------------------------------------------------------- AI clubs
const NOUNS = ['Rooks', 'Knights', 'Gambit', 'Citadel', 'Lantern', 'Bastion', 'Compass', 'Harbour', 'Spire', 'Meridian', 'Vanguard', 'Archive', 'Forge', 'Crescent', 'Beacon', 'Sentinel'];
const KIND = ['Chess Club', 'Chess Society', 'Circle', 'Academy'];
const MOTTOS = ['Patience conquers', 'Every square counts', 'Calm in the storm', 'We move together', 'Strength in study', 'First to the centre', 'Never resign', 'Quiet moves, loud results', 'The long game', 'Courage at the board', 'Precision before speed', 'Hold the line',
  'Think twice, move once', 'From pawn to crown', 'The file is ours', 'Steady hands, bright minds', 'No square undefended', 'Seek the initiative', 'Honour in every game', 'We study, we strike', 'Win the endgame', 'Light the long diagonal', 'Learn from every loss', 'Tempo is treasure',
  'Ever forward', 'The quiet move wins', 'Watch the king', 'Craft over chance', 'Together on six squares', 'Bold but sound', 'Patience is a weapon', 'Our word is our move'];
function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export interface AiClub { id: string; region: number; identity: ClubIdentity; founded: number }
/** 32 clubs with arms unique by construction: every club gets its own symbol/shape pair and colour pair. */
export const AI_CLUBS: AiClub[] = Array.from({ length: 32 }, (_, i) => {
  const region = Math.floor(i / 2), h = h32(`club-${i}`);
  const primary = CLUB_COLOURS[(i * 5) % 10];
  let secondary = CLUB_COLOURS[(i * 7 + 3) % 12];
  if (secondary === primary) secondary = primary === 'or' ? 'sable' : 'or';
  return {
    id: `aic${String(i).padStart(2, '0')}`, region, founded: 1 + (h % 3),
    identity: { name: `${REGION_NAMES[region]} ${NOUNS[(i * 7 + (h >>> 9)) % 16]} ${KIND[(h >>> 13) % 4]}`, primary, secondary, shape: CLUB_SHAPES[Math.floor(i / 16) * 3 + (i % 3)], symbol: CLUB_SYMBOLS[i % 16], motto: MOTTOS[i], division: (['fess', 'pale', 'bend', 'chevron', 'chief', 'quarterly'] as const)[(i * 5) % 6] },
  };
});
/** A competitor's club: one of the two clubs of their region, fixed by their id. */
export const clubOf = (competitorId: string, region: number): AiClub => AI_CLUBS[(region % 16) * 2 + (h32(competitorId) & 1)];
// (region % 16: regions 17+ exist only in scale experiments, docs/FEDERATION_SCALE.md; identical for regions 0–15)
export const CLUB_DUES_SHARE = 0.05; // of a member's balance at season end
export const CLUB_OPS_SHARE = 0.6; // of a club's balance spent each season (venue, coaching, travel)
