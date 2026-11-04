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
 *
 * crown-competition-3 (v1.0, package S): the Crown Path. Under -2 a player below ~1,900 never reached the Crown
 * Championship in 10–12 simulated seasons: the Federation Open's top 8 are ~2,000–2,200 players, and the Regional
 * Cup (the only route from divisions 5–8) was won by Grand Division players, who are promoted and cannot use the
 * invitation. At 10,240 a strong Crown Division player who finished 2nd–3rd rarely entered a zonal field. Changes
 * (rounds 1–15 and the calendar are unchanged; every branch is gated on rules ≥ 3, so -1 and -2 are byte-identical):
 *  * Regional Cup field: champions and runners-up of divisions 3–4 + champions of 5–8 (no Grand Division).
 *  * Open invitations: per zone the best-rated cup winner(s) (one per 5 regions of the zone, at least one) + the
 *    Challenger Open winner; an invitee is never displaced by the player's registration.
 *  * Crown Championship: of the Open's 8 places, the last 2 are Crown Path places for the best invited entrants
 *    with ≥ 3 / 5 (otherwise the Open order continues).
 *  * Zonal field when a zone has more than 5 regions (10,240): the regional winners, then the highest-rated 2nd and
 *    3rd places (was: the runners-up with most points).
 * Worlds under -1 or -2 finish their season under it and adopt -3 at the next season start (driver.ts).
 */
import { DIVISIONS, PLAYER_ID, regionName } from './model';
import type { KoMatch, StandingRow } from './formats';
import type { KoState } from './world';

/** Published id of the rules given to new federations (crown-competition-3 since v1.0). */
export const COMPETITION_RULES_ID = 'crown-competition-3';
export const competitionRulesId = (rules: number) => `crown-competition-${Math.max(1, rules)}`;
/** Rules number stored in a world / plan (absent = 1, the v0.3–v0.10 rules). */
export const RULES_V2 = 2;
/** v1.0 (package S): the Crown Path — see the crown-competition-3 block below. */
export const RULES_V3 = 3;
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
 *
 * crown-competition-2: by finishing rank across the zone (all rank-1 finishers, then rank 2, …; inside a rank by
 * points, rating, id). crown-competition-3 (`rules` ≥ 3): every region of the zone first sends its top
 * g = ⌊16 / regions in the zone⌋ finishers (by rank, as before); when g < ZONAL_DEPTH (3) the remaining places go to
 * the highest-RATED of the finishers ranked g+1 … ZONAL_DEPTH (top 3 per region), then, if any place is still free,
 * the crown-competition-2 rank order continues. With 2 or 4 regions per zone (2,048 / 4,096, g = 8 / 4) the rule is
 * crown-competition-2 exactly; at 10,240 (10 regions per zone) it is the 10 regional winners + the 6 highest-rated
 * runners-up and third places (crown-competition-2: the 6 runners-up with most points).
 */
export const ZONAL_DEPTH = 3;
export function zonalFields(regions: number, tables: Tables, excluded: Set<string>, rating: (id: string) => number, rules = RULES_V2): { zone: number; ids: string[] }[] {
  const out: { zone: number; ids: string[] }[] = [];
  for (const zone of zonesOf(regions)) {
    const rs = zoneRegions(zone, regions);
    const ids: string[] = [];
    const tierOrder = (maxRank: number, from = 0) => {
      for (let rank = from; rank < maxRank && ids.length < ZONAL_SIZE; rank++) {
        const tier: StandingRow[] = [];
        for (const r of rs) { const row = tables.get(`${r}:1`)?.[rank]; if (row && !excluded.has(row.id) && !ids.includes(row.id)) tier.push(row); }
        tier.sort((a, b) => b.points - a.points || rating(b.id) - rating(a.id) || a.id.localeCompare(b.id));
        for (const row of tier) if (ids.length < ZONAL_SIZE) ids.push(row.id);
      }
    };
    const g = Math.max(1, Math.floor(ZONAL_SIZE / rs.length));
    if (rules >= RULES_V3 && g < ZONAL_DEPTH) {
      tierOrder(g);
      const depth = ZONAL_DEPTH;
      const pool: StandingRow[] = [];
      for (const r of rs) for (const row of (tables.get(`${r}:1`) ?? []).slice(g, depth)) if (!excluded.has(row.id) && !ids.includes(row.id)) pool.push(row);
      pool.sort((a, b) => rating(b.id) - rating(a.id) || b.points - a.points || a.id.localeCompare(b.id));
      for (const row of pool) if (ids.length < ZONAL_SIZE) ids.push(row.id);
      tierOrder(16, g);
    } else tierOrder(16);
    if (ids.length === ZONAL_SIZE) out.push({ zone, ids });
  }
  return out;
}

/**
 * Regional Cup fields (8 per region), each place replaced by the next finisher of the same division when excluded
 * (already in the Crown Championship or a Zonal Championship).
 * crown-competition-2: champions of divisions 2..8 + runner-up of division 2.
 * crown-competition-3 (`rules` ≥ 3): champions and runners-up of divisions 3 and 4 + champions of divisions 5..8. The
 * Grand Division (2) leaves the cup: its top two are promoted to the Crown Division (where an Open invitation cannot
 * be used) and its other players reach the Open by rating, so the cup becomes the first rung of the Crown Path for
 * divisions 3–8.
 */
export function cupFields(regions: number, tables: Tables, excluded: Set<string>, rules = RULES_V2): { region: number; ids: string[] }[] {
  const out: { region: number; ids: string[] }[] = [];
  for (let region = 0; region < regions; region++) {
    const ids: string[] = [];
    const take = (division: number, n: number) => {
      const t = tables.get(`${region}:${division}`) ?? [];
      let got = 0;
      for (const row of t) { if (got >= n) break; if (excluded.has(row.id) || ids.includes(row.id)) continue; ids.push(row.id); got++; }
    };
    if (rules >= RULES_V3) { take(3, 2); take(4, 2); for (let d = 5; d <= DIVISIONS; d++) take(d, 1); }
    else { take(2, 2); for (let d = 3; d <= DIVISIONS; d++) take(d, 1); }
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

/**
 * crown-competition-3 Federation Open invitations for next season (the Crown Path's second rung):
 *  * per zone, the openInvitesPerZone(regions) highest-rated Regional Cup winners who will play in divisions 2–8:
 *    one invitation per REGIONS_PER_INVITE regions of the zone, at least one (1 of 2 cups per zone at 2,048, 1 of 4
 *    at 4,096, 2 of 10 at 10,240), and
 *  * the CHALLENGER_INVITES best finishers of this season's Challenger Open (divisions 5–8), if they will play in
 *    divisions 2–8 (they always do: nobody is promoted from the Challenger band to the Crown Division).
 * At most 8 · per-zone + 1 invitations (9 at 2,048, 17 at 10,240), ordered by public rating (ties: id); a competitor
 * qualifying both ways counts once.
 */
export const REGIONS_PER_INVITE = 5;
export const CHALLENGER_INVITES = 1;
export const openInvitesPerZone = (regions: number): number => Math.max(1, Math.round(Math.ceil(regions / ZONES) / REGIONS_PER_INVITE));
/** Most Open invitations a season can carry (for display). */
export const openInvitesMax = (regions: number): number => zonesOf(regions).length * openInvitesPerZone(regions) + CHALLENGER_INVITES;
export function openInvitationsV3(cupWinners: { id: string; region: number }[], challengerOrder: string[], regions: number, divisionNext: (id: string) => number, rating: (id: string) => number): string[] {
  const byRating = (a: string, b: string) => rating(b) - rating(a) || a.localeCompare(b);
  const out: string[] = [];
  const per = openInvitesPerZone(regions);
  for (const zone of zonesOf(regions)) {
    const ws = cupWinners.filter(w => zoneOf(w.region, regions) === zone && divisionNext(w.id) >= 2).map(w => w.id).sort(byRating);
    for (const id of ws.slice(0, per)) if (!out.includes(id)) out.push(id);
  }
  for (const id of challengerOrder.filter(id => divisionNext(id) >= 2).slice(0, CHALLENGER_INVITES)) if (!out.includes(id)) out.push(id);
  return out.sort(byRating);
}

/**
 * crown-competition-3 Championship places of the Federation Open (the Crown Path's last rung). The Open still gives
 * 8 places, but the last PATH_PLACES of them are **Crown Path places**: they go to the best-placed INVITED entrants
 * (Regional Cup winners and Challenger Open finishers of last season, the player included when invited) who are not
 * already qualified and scored at least PATH_MIN_POINTS of the 5 Swiss rounds (a plus score, 60 %). A path place
 * nobody meets the threshold for goes to the next finisher of the Open as before. The first 8 − PATH_PLACES places
 * are the Open order (invited or not), unchanged.
 */
export const PATH_PLACES = 2;
export const PATH_MIN_POINTS = 3;
export function openChampionshipPlaces(order: StandingRow[], invited: Set<string>, already: string[]): { ids: string[]; path: string[] } {
  const rest = order.filter(r => !already.includes(r.id));
  const regular = rest.slice(0, 8 - PATH_PLACES).map(r => r.id);
  const path = rest.filter(r => !regular.includes(r.id) && invited.has(r.id) && r.points >= PATH_MIN_POINTS).slice(0, PATH_PLACES).map(r => r.id);
  const ids = [...regular, ...path];
  for (const r of rest) if (ids.length < 8 && !ids.includes(r.id)) ids.push(r.id);
  return { ids, path };
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

/** Knockout event ids of a crown-competition-2 (or -3) season (for prize escrow at season start). */
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
