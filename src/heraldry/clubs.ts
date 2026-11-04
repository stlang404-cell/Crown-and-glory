/**
 * Club identities (crown-clubs-1). AI clubs, two per region (32 for the original 16 regions; 160 for 80 regions
 * since v0.10), with stable, deterministic names, colours, mottos and arms; every active competitor is affiliated to one club of their region (stable hash of their id).
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
/** The original 32 clubs (regions 1–16) with arms unique by construction: every club gets its own symbol/shape pair
 *  and colour pair. Unchanged since v0.5. */
const FIRST_CLUBS: AiClub[] = Array.from({ length: 32 }, (_, i) => {
  const region = Math.floor(i / 2), h = h32(`club-${i}`);
  const primary = CLUB_COLOURS[(i * 5) % 10];
  let secondary = CLUB_COLOURS[(i * 7 + 3) % 12];
  if (secondary === primary) secondary = primary === 'or' ? 'sable' : 'or';
  return {
    id: `aic${String(i).padStart(2, '0')}`, region, founded: 1 + (h % 3),
    identity: { name: `${REGION_NAMES[region]} ${NOUNS[(i * 7 + (h >>> 9)) % 16]} ${KIND[(h >>> 13) % 4]}`, primary, secondary, shape: CLUB_SHAPES[Math.floor(i / 16) * 3 + (i % 3)], symbol: CLUB_SYMBOLS[i % 16], motto: MOTTOS[i], division: (['fess', 'pale', 'bend', 'chevron', 'chief', 'quarterly'] as const)[(i * 5) % 6] },
  };
});
/** Mottos of the clubs of regions 17–80 (v0.10): an original verb and object, 8 × 16 = 128 distinct mottos. */
const MOTTO_VERBS = ['Guard', 'Seek', 'Hold', 'Trust', 'Honour', 'Study', 'Open', 'Master'];
const MOTTO_OBJECTS = ['the centre', 'the long file', 'every tempo', 'the quiet square', 'the last rank', 'the open road', 'the narrow board', 'the second wave', 'the high ground', 'the small advantage', 'the hidden move', 'the patient plan', 'the shared crown', 'the steady pawn', 'the bright diagonal', 'the final hour'];
/** Clubs of regions 17–80 (v0.10 larger topologies). Names are the region's name with a noun and kind chosen to fit
 *  32 characters; arms (shape · symbol · colours) are unique across all 160 clubs (tests/heraldry.test.ts). */
const MORE_CLUBS: AiClub[] = (() => {
  const out: AiClub[] = [];
  const arms = new Set(FIRST_CLUBS.map(c => `${c.identity.shape}|${c.identity.symbol}|${c.identity.primary}|${c.identity.secondary}`));
  const names = new Set(FIRST_CLUBS.map(c => c.identity.name));
  for (let i = 32; i < 160; i++) {
    const region = Math.floor(i / 2), h = h32(`club-${i}`);
    let name = '';
    for (let t = 0; t < 64 && !name; t++) {
      const cand = `${REGION_NAMES[region]} ${NOUNS[(i * 7 + (h >>> 9) + t) % 16]} ${KIND[((h >>> 13) + (t >> 4)) % 4]}`;
      if (cand.length <= 32 && !names.has(cand)) name = cand;
    }
    if (!name) name = `${REGION_NAMES[region]} ${i % 2 ? 'Circle' : 'Club'}`.slice(0, 32);
    names.add(name);
    let identity: ClubIdentity | null = null;
    for (let t = 0; !identity; t++) {
      const primary = CLUB_COLOURS[(i * 5 + t) % 12];
      let secondary = CLUB_COLOURS[(i * 7 + 3 + 3 * t) % 12];
      if (secondary === primary) secondary = primary === 'or' ? 'sable' : 'or';
      const shape = CLUB_SHAPES[(Math.floor(i / 16) + t) % 6], symbol = CLUB_SYMBOLS[(i + t) % 16];
      const key = `${shape}|${symbol}|${primary}|${secondary}`;
      if (arms.has(key)) continue;
      arms.add(key);
      identity = { name, primary, secondary, shape, symbol, motto: `${MOTTO_VERBS[(i - 32) % 8]} ${MOTTO_OBJECTS[Math.floor((i - 32) / 8) % 16]}`, division: (['fess', 'pale', 'bend', 'chevron', 'chief', 'quarterly'] as const)[(i * 5) % 6] };
    }
    out.push({ id: `aic${String(i).padStart(2, '0')}`, region, founded: 1 + (h % 3), identity });
  }
  return out;
})();
/** Every AI club: two per region for the 80 named regions. A world uses the clubs of its own regions (`clubsOf`). */
export const AI_CLUBS: AiClub[] = [...FIRST_CLUBS, ...MORE_CLUBS];
/** The AI clubs of a world with this many regions. */
export const clubsOf = (regions: number): AiClub[] => AI_CLUBS.slice(0, Math.min(AI_CLUBS.length, regions * 2));
/** A competitor's club: one of the two clubs of their region, fixed by their id. */
export const clubOf = (competitorId: string, region: number): AiClub => AI_CLUBS[(region % 80) * 2 + (h32(competitorId) & 1)];
// (region % 80: regions beyond 80 exist only in scale experiments, docs/FEDERATION_SCALE.md; identical for regions 0–15)
export const CLUB_DUES_SHARE = 0.05; // of a member's balance at season end
export const CLUB_OPS_SHARE = 0.6; // of a club's balance spent each season (venue, coaching, travel)
