/**
 * Heraldry & honours lifecycle (crown-heraldry-1), called inside FederationService commands (single atomic commit).
 * Everything is derived from recorded results; nothing here influences pairings, results or ratings.
 */
import type { FedState, Ceremony } from './federation';
import { PLAYER_ID, LEAGUE_ROUNDS, SWISS_ROUNDS, divisionLabel, REGION_NAMES } from '../federation/model';
import { makeNorm, earnedTitle, type Norm } from '../heraldry/titles';
import { FED_TITLES, type FedTitle } from '../heraldry/catalog';
import { selectFeatured } from '../heraldry/rivals';
import { AI_CLUBS, clubOf, CLUB_DUES_SHARE, CLUB_OPS_SHARE } from '../heraldry/clubs';
import type { Journal } from '../exchange/ledger';
import type { KoState } from '../federation/world';

type G = { event: string; white: string; black: string; result: number | null };
const MAX_NORMS = 24;

export function ensureFeatured(st: FedState): boolean {
  if (st.world.featured?.length) return false;
  // the circle is chosen from the player's division at the time (their starting division for new federations)
  st.world.featured = selectFeatured([...st.competitors.values()], st.world.player.region, st.world.player.division, st.world.season);
  return true;
}

/** Track peak public ratings (and established peaks, RD ≤ 100) for competitors and the player. */
export function trackPeaks(st: FedState, player: { rating: number; rd: number }): void {
  for (const c of st.competitors.values()) {
    if (c.status !== 'active') continue;
    if (c.rating > (c.peakRating ?? 0)) c.peakRating = Math.round(c.rating);
    if (c.rd <= 100 && c.rating > (c.establishedPeak ?? 0)) c.establishedPeak = Math.round(c.rating);
  }
  const p = st.world.player;
  if (player.rating > (p.peakRating ?? 0)) p.peakRating = Math.round(player.rating);
  if (player.rd <= 100 && player.rating > (p.establishedPeak ?? 0)) p.establishedPeak = Math.round(player.rating);
}

const nameOf = (st: FedState, id: string) => (id === PLAYER_ID ? 'You' : st.competitors.get(id)?.name ?? id);

/** Norms for every participant of the finished event(s) and any resulting federation titles. */
export function awardNorms(st: FedState, season: number, round: number, label: string, games: G[], playerRating: number, ceremonies: Ceremony[], finalists: string[] = []): number {
  const per = new Map<string, { score: number; oppRating: number }[]>();
  const rating = (id: string) => (id === PLAYER_ID ? playerRating : st.competitors.get(id)?.rating ?? 1500);
  for (const g of games) {
    if (g.result === null) continue;
    for (const [me, opp, sc] of [[g.white, g.black, g.result], [g.black, g.white, 1 - g.result]] as const) {
      const arr = per.get(me) ?? [];
      arr.push({ score: sc, oppRating: rating(opp) });
      per.set(me, arr);
    }
  }
  let awarded = 0;
  for (const [id, results] of per) {
    const norm = makeNorm(label, season, results);
    const holder = id === PLAYER_ID ? st.world.player : st.competitors.get(id);
    if (!holder) continue;
    if (norm) holder.norms = [...(holder.norms ?? []), norm].slice(-MAX_NORMS);
    const titles = (id === PLAYER_ID ? st.world.player.titles : st.competitors.get(id)!.titles).map(t => t.title);
    const honours = finalists.includes(id) ? [...titles, `Championship finalist S${season}`] : titles;
    const before = holder.fedTitle ?? null;
    const after = earnedTitle({ norms: holder.norms ?? [], peakRating: holder.peakRating ?? 0, establishedPeak: holder.establishedPeak ?? 0, honours, current: before });
    if (after && after !== before) {
      holder.fedTitle = after;
      awarded++;
      if (id === PLAYER_ID) ceremonies.push({ id: `fed-title:${after}`, season, round, kind: 'fed-title', title: `Federation title: ${after}`, ids: [PLAYER_ID], detail: `Earned through ${(holder.norms ?? []).filter(n => n.tier && FED_TITLES.indexOf(n.tier) >= FED_TITLES.indexOf(after)).length} norm(s) — most recently ${norm ? `${label}, performance ${norm.tpr} over ${norm.games} games` : 'earlier events'}.`, seen: false });
      else st.competitors.get(id)!.milestones.push({ season, round, text: `Earned the federation title ${after}` });
    }
  }
  return awarded;
}

/** Which recorded games belong to an event in this season. */
export function eventGames(games: G[], kind: 'league' | 'open' | 'challenger' | 'champ'): G[] {
  return games.filter(g => (kind === 'league' ? g.event.startsWith('league:') : g.event === kind));
}
export const NORM_EVENTS = { swissRound: SWISS_ROUNDS[SWISS_ROUNDS.length - 1], leagueRound: LEAGUE_ROUNDS };

/** Season-end AI club finances: dues from members, operating costs to the sink. Real, balanced journals. */
export function clubFinances(st: FedState, season: number, post: (j: Journal[]) => void, now: string): void {
  const dues = new Map<string, number>();
  const lines: { account: string; amount: number }[] = [];
  for (const c of st.competitors.values()) {
    if (c.status !== 'active') continue;
    const bal = st.balances.get(`comp:${c.id}`) ?? 0;
    const amt = Math.floor(bal * CLUB_DUES_SHARE);
    if (amt <= 0) continue;
    const club = clubOf(c.id, c.region).id;
    lines.push({ account: `comp:${c.id}`, amount: -amt });
    dues.set(club, (dues.get(club) ?? 0) + amt);
  }
  for (const [club, amt] of dues) lines.push({ account: `club:${club}`, amount: amt });
  if (lines.length) post([{ id: `club-dues:${season}`, at: now, kind: 'club-dues', memo: 'AI club membership dues (5% of member balances)', lines, season }]);
  const ops: { account: string; amount: number }[] = [];
  let total = 0;
  for (const k of AI_CLUBS) {
    const bal = st.balances.get(`club:${k.id}`) ?? 0;
    const amt = Math.floor(bal * CLUB_OPS_SHARE);
    if (amt > 0) { ops.push({ account: `club:${k.id}`, amount: -amt }); total += amt; }
  }
  if (total) post([{ id: `club-ops:${season}`, at: now, kind: 'club-ops', memo: 'AI club operating costs (venues, coaching, travel)', lines: [...ops, { account: 'sink', amount: total }], season }]);
}

/** Ceremonies from the season's recorded titles and promotions. */
export function seasonCeremonies(st: FedState, season: number, round: number, ko: KoState | null, playerTitlesBefore: number, playerDivisionBefore: number, ceremonies: Ceremony[]): void {
  if (ko?.champions.length) ceremonies.push({ id: `championship:${season}`, season, round, kind: 'championship', title: `${ko.champions.length > 1 ? 'Joint Crown Champions' : 'Crown Champion'} — season ${season}`, ids: [...ko.champions], detail: ko.champions.map(id => nameOf(st, id)).join(' & '), seen: false });
  const p = st.world.player;
  for (const t of p.titles.slice(playerTitlesBefore)) ceremonies.push({ id: `event-title:${t.season}:${t.title}`, season, round, kind: 'event-title', title: t.title.replace(/ S\d+$/, ''), ids: [PLAYER_ID], detail: `Season ${t.season}`, seen: false });
  if (p.division < playerDivisionBefore) ceremonies.push({ id: `promotion:${season}:${p.division}`, season, round, kind: 'promotion', title: `Promoted to the ${divisionLabel(p.division)}`, ids: [PLAYER_ID], detail: `${REGION_NAMES[p.region]} · from the ${divisionLabel(playerDivisionBefore)}`, seen: false });
}

export type { Norm, FedTitle };
