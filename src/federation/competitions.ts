/**
 * Shared-Federation competition rules (crown-competition-2, v0.11). Pure functions, no I/O, no randomness: every
 * field below is a deterministic function of recorded results and public ratings. Published rules:
 * docs/V3_COMPETITION_RULES.md § "crown-competition-2".
 *
 * Why: in a 10,240 world (80 regions) only 8 of 80 Crown Division winners reached the Crown Championship through the
 * league (docs/FEDERATION_SCALE.md §0.7), and the 99% of the Federation that is not in the Championship had no
 * competition in rounds 16–19. crown-competition-2 adds two knockout formats in those idle rounds, each with a
 * place in qualification, and changes nothing in rounds 1–15:
 *
 *  * Zonal Championships (rounds 16–19, one per zone, 8 zones): 16 Crown Division finishers of the zone's regions,
 *    taken by finishing rank (every rank-1 finisher first, then rank 2, …; inside a rank by points, then public
 *    rating, then id), skipping this season's Crown Championship qualifiers. The ZONAL CHAMPION qualifies for NEXT
 *    season's Crown Championship (a zone place). A zone is ⌈regions / 8⌉ consecutive regions, so the league route
 *    scales with the world: 2 regions per zone at 2,048, 10 at 10,240.
 *  * Regional Cups (rounds 17–19, one per region): the champions of the region's divisions 2–8 and the runner-up of
 *    division 2 (8 players), each replaced by the next finisher of the same division if they already play in the
 *    Crown Championship or a Zonal Championship. The 8 highest-rated cup winners (any division 2–8 next season) are
 *    INVITED to next season's Federation Open — the route into the Open for players below division 4.
 *  * Crown Championship (16, unchanged size and bracket): up to 8 zone places (last season's zonal champions who are
 *    still active), the remaining league places by the v1 rule (best Crown Division winners by points, then rating),
 *    and 8 Federation Open places (unchanged). Season 1 of a crown-competition-2 world has no zonal champions yet,
 *    so it uses the v1 rule for all 8 league places.
 *  * Federation Open field: the invited cup winners first (at most 8), then the highest-rated competitors of
 *    divisions 2–4 up to 32; seeds by public rating. Player registration (fee, voucher or invitation) is unchanged:
 *    the player takes the place of the lowest seed.
 *
 * Worlds founded before v0.11 keep crown-competition-1 for the season they are in and adopt crown-competition-2 at
 * their next season start (src/federation/driver.ts). Every function here is only reached when a plan has rules 2,
 * so crown-competition-1 results are byte-identical (tools/sim/determinism_check.mts with RULES=1).
 */
import { DIVISIONS, PLAYER_ID, regionName } from './model';
import type { KoMatch, StandingRow } from './formats';
import type { KoState } from './world';

export const COMPETITION_RULES_ID = 'crown-competition-2';
/** Rules number stored in a world / plan (absent = 1, the v0.3–v0.10 rules). */
export const RULES_V2 = 2;
export const ZONES = 8;
export const ZONAL_SIZE = 16;
export const ZONAL_ROUNDS = [16, 17, 18, 19];
export const ZONAL_LABELS = ['Zonal Round of 16', 'Zonal Quarterfinal', 'Zonal Semifinal', 'Zonal Final'];
export const CUP_SIZE = 8;
export const CUP_ROUNDS = [17, 18, 19];
export const CUP_LABELS = ['Cup Quarterfinal', 'Cup Semifinal', 'Cup Final'];
/** Federation Open places reserved for Regional Cup winners. */
export const OPEN_INVITES = 8;
/** Bracket order for 16 (same as the Crown Championship) and for 8. */
export const BRACKET_16 = [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
export const BRACKET_8 = [1, 8, 4, 5, 3, 6, 2, 7];

export const rulesOf = (x?: { rules?: number } | null): number => x?.rules ?? 1;

/** Zone of a region: ZONES contiguous blocks (2 regions each at 16 regions, 4 at 32, 10 at 80). */
export function zoneOf(region: number, regions: number): number {
  const per = Math.ceil(regions / ZONES);
  return Math.min(ZONES - 1, Math.floor(region / per));
}
export function zoneRegions(zone: number, regions: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < regions; r++) if (zoneOf(r, regions) === zone) out.push(r);
  return out;
}
/** Zones that contain at least one region (a world with fewer than 8 regions has fewer zones). */
export function zonesOf(regions: number): number[] {
  const set = new Set<number>();
  for (let r = 0; r < regions; r++) set.add(zoneOf(r, regions));
  return [...set].sort((a, b) => a - b);
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const zoneShort = (zone: number) => `Zone ${ROMAN[zone] ?? zone + 1}`;
export function zoneName(zone: number, regions: number): string {
  const rs = zoneRegions(zone, regions);
  return `Zone ${ROMAN[zone] ?? zone + 1} (${regionName(rs[0])}${rs.length > 1 ? `–${regionName(rs[rs.length - 1])}` : ''})`;
}

export const zonalEvent = (zone: number) => `zonal-${zone}`;
export const cupEvent = (region: number) => `cup-${region}`;
export const isZonalEvent = (e: string) => e.startsWith('zonal-');
export const isCupEvent = (e: string) => e.startsWith('cup-');
export function koTitle(ko: Pick<KoState, 'name'> & { title?: string }): string {
  if (ko.title) return ko.title;
  return ko.name === 'champ' ? 'Crown Championship' : ko.name === 'club' ? 'Club Weekend' : ko.name;
}

/** First-stage matches of a seeded bracket. */
export function seededMatches(ids: string[], rating: (id: string) => number): { seeds: Record<string, number>; first: KoMatch[] } {
  const seeds = Object.fromEntries([...ids].sort((a, b) => rating(b) - rating(a) || a.localeCompare(b)).map((id, i) => [id, i + 1]));
  const bySeed = [...ids].sort((a, b) => seeds[a] - seeds[b]);
  const order = ids.length === 16 ? BRACKET_16 : ids.length === 8 ? BRACKET_8 : null;
  const first: KoMatch[] = [];
  if (!order) throw new Error(`Unsupported bracket size ${ids.length}`);
  for (let i = 0; i < order.length; i += 2) {
    const a = bySeed[order[i] - 1], b = bySeed[order[i + 1] - 1];
    first.push({ a, b, seedA: seeds[a], seedB: seeds[b], games: [], winner: null, joint: false, decidedBy: null });
  }
  return { seeds, first };
}

type Tables = Map<string, StandingRow[]>; // `${region}:${division}` → final league order

/**
 * Zonal Championship fields (16 per zone). `tables` are the final league tables; `excluded` = this season's Crown
 * Championship qualifiers. Zones whose regions cannot supply 16 players (tiny test worlds) are skipped.
 */
export function zonalFields(regions: number, tables: Tables, excluded: Set<string>, rating: (id: string) => number): { zone: number; ids: string[] }[] {
  const out: { zone: number; ids: string[] }[] = [];
  for (const zone of zonesOf(regions)) {
    const rs = zoneRegions(zone, regions);
    const ids: string[] = [];
    for (let rank = 0; rank < 16 && ids.length < ZONAL_SIZE; rank++) {
      const tier: StandingRow[] = [];
      for (const r of rs) { const row = tables.get(`${r}:1`)?.[rank]; if (row && !excluded.has(row.id)) tier.push(row); }
      tier.sort((a, b) => b.points - a.points || rating(b.id) - rating(a.id) || a.id.localeCompare(b.id));
      for (const row of tier) if (ids.length < ZONAL_SIZE) ids.push(row.id);
    }
    if (ids.length === ZONAL_SIZE) out.push({ zone, ids });
  }
  return out;
}

/**
 * Regional Cup fields (8 per region): champions of divisions 2..8 + runner-up of division 2, each replaced by the
 * next finisher of the same division when excluded (already in the Crown Championship or a Zonal Championship).
 */
export function cupFields(regions: number, tables: Tables, excluded: Set<string>): { region: number; ids: string[] }[] {
  const out: { region: number; ids: string[] }[] = [];
  for (let region = 0; region < regions; region++) {
    const ids: string[] = [];
    const take = (division: number, n: number) => {
      const t = tables.get(`${region}:${division}`) ?? [];
      let got = 0;
      for (const row of t) { if (got >= n) break; if (excluded.has(row.id) || ids.includes(row.id)) continue; ids.push(row.id); got++; }
    };
    take(2, 2);
    for (let d = 3; d <= DIVISIONS; d++) take(d, 1);
    if (ids.length === CUP_SIZE) out.push({ region, ids });
  }
  return out;
}

export function zonalKo(zone: number, regions: number, ids: string[], rating: (id: string) => number): KoState {
  const { seeds, first } = seededMatches(ids, rating);
  return { name: zonalEvent(zone), title: `${zoneName(zone, regions)} Championship`, kind: 'zonal', zone, qualifiers: ids, seeds,
    stages: ZONAL_ROUNDS.map((round, i) => ({ round, label: ZONAL_LABELS[i], matches: i === 0 ? first : [] })), champions: [] };
}
export function cupKo(region: number, ids: string[], rating: (id: string) => number): KoState {
  const { seeds, first } = seededMatches(ids, rating);
  return { name: cupEvent(region), title: `${regionName(region)} Regional Cup`, kind: 'cup', region, qualifiers: ids, seeds,
    stages: CUP_ROUNDS.map((round, i) => ({ round, label: CUP_LABELS[i], matches: i === 0 ? first : [] })), champions: [] };
}

/** League places of a crown-competition-2 Championship: zone places from last season first, then v1 league winners. */
export function crownLeaguePlaces(zonePlaces: string[], winnersByRule: string[], isActive: (id: string) => boolean): string[] {
  const out: string[] = [];
  for (const id of zonePlaces) if (out.length < 8 && isActive(id) && !out.includes(id)) out.push(id);
  for (const id of winnersByRule) if (out.length < 8 && !out.includes(id)) out.push(id);
  return out;
}

/** Federation Open invitations for next season: the 8 highest-rated cup winners who will play in divisions 2–8. */
export function openInvitations(cupWinners: string[], divisionNext: (id: string) => number, rating: (id: string) => number): string[] {
  return cupWinners.filter(id => divisionNext(id) >= 2).sort((a, b) => rating(b) - rating(a) || a.localeCompare(b)).slice(0, OPEN_INVITES);
}

/** Federation Open field under crown-competition-2: AI invitees (the player's invitation is taken up by registering). */
export function openField(invited: string[], ratingField: string[], rating: (id: string) => number): string[] {
  const inv = invited.filter(id => id !== PLAYER_ID);
  const rest = ratingField.filter(id => !inv.includes(id));
  return [...inv, ...rest].slice(0, 32).sort((a, b) => rating(b) - rating(a) || a.localeCompare(b));
}

/** The stage reached by each entrant of a decided knockout (for prizes): champion, final, semi, quarter, r16. */
export function koPlacings(ko: KoState): { id: string; place: 'champion' | 'final' | 'semi' | 'quarter' | 'r16' }[] {
  const out: { id: string; place: 'champion' | 'final' | 'semi' | 'quarter' | 'r16' }[] = [];
  const n = ko.stages.length;
  const placeOf = (fromEnd: number) => (['final', 'semi', 'quarter', 'r16'] as const)[fromEnd];
  ko.stages.forEach((sg, i) => {
    for (const m of sg.matches) {
      if (i === n - 1) {
        if (m.joint) { out.push({ id: m.a, place: 'champion' }, { id: m.b, place: 'champion' }); continue; }
        if (!m.winner) continue;
        out.push({ id: m.winner, place: 'champion' }, { id: m.winner === m.a ? m.b : m.a, place: 'final' });
      } else if (m.winner) out.push({ id: m.winner === m.a ? m.b : m.a, place: placeOf(n - 1 - i) });
    }
  });
  return out;
}

/** Knockout event ids of a crown-competition-2 season (for prize escrow at season start). */
export function cupEventsOf(rules: number, regions: number): string[] {
  if (rules < RULES_V2) return [];
  return [...zonesOf(regions).map(zonalEvent), ...Array.from({ length: regions }, (_, r) => cupEvent(r))];
}

/** Display name of a crown-competition-2 event id (null for any other event). */
export function cupEventName(event: string, regions = 16): string | null {
  if (isZonalEvent(event)) return `${zoneName(+event.slice(6), regions)} Championship`;
  if (isCupEvent(event)) return `${regionName(+event.slice(4))} Regional Cup`;
  return null;
}
