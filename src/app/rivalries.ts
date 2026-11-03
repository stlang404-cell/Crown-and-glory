/**
 * Builds rivalry inputs from stored records only: every recorded result (summary or full game), knockout
 * eliminations from each season's plan, and season finishes from career histories. Ratings for upsets come from
 * the player's own game records (snapshots at game time) and competitors' previous-season ratings.
 */
import type { FedState } from './federation';
import { PLAYER_ID } from '../federation/model';
import { computeRivalry, type KoMeeting, type Meeting, type Rivalry, type SeasonFinish } from '../heraldry/rivalry';
import type { GameRecord } from '../games/types';

/** Public rating of a competitor at the start of a season (end of the previous one), or its current rating. */
function seasonRating(st: FedState, id: string, season: number): number | undefined {
  const c = st.competitors.get(id);
  if (!c) return undefined;
  const prev = c.history.find(h => h.season === season - 1);
  return prev ? prev.rating : c.rating;
}

export function collect(st: FedState, involving: Set<string>, playerGames: GameRecord[] = []): { meetings: Meeting[]; kos: KoMeeting[]; finishes: SeasonFinish[] } {
  const meetings: Meeting[] = [];
  const snap = new Map(playerGames.filter(g => g.context.fixtureId).map(g => [g.context.fixtureId!, g]));
  for (const r of st.rounds.values()) {
    for (const [event, w, b, res] of r.abstract) if (involving.has(w) || involving.has(b)) meetings.push({ season: r.season, round: r.round, event, a: w, b, scoreA: res, ratingA: seasonRating(st, w, r.season), ratingB: seasonRating(st, b, r.season) });
    for (const f of r.fixtures) {
      if (!(involving.has(f.white) || involving.has(f.black))) continue;
      const g = snap.get(f.id);
      const rw = f.white === PLAYER_ID ? (g ? (g.humanColor === 'white' ? g.white.rating : g.black.rating) ?? undefined : undefined) : seasonRating(st, f.white, r.season);
      const rb = f.black === PLAYER_ID ? (g ? (g.humanColor === 'black' ? g.black.rating : g.white.rating) ?? undefined : undefined) : seasonRating(st, f.black, r.season);
      if (!f.forfeit) meetings.push({ season: r.season, round: r.round, event: f.event, a: f.white, b: f.black, scoreA: f.result, ratingA: rw ?? undefined, ratingB: rb ?? undefined, gameId: f.gameId });
    }
  }
  const kos: KoMeeting[] = [];
  for (const plan of st.plans.values()) {
    for (const ko of [plan.champ, plan.club]) {
      if (!ko) continue;
      for (const stg of ko.stages) for (const m of stg.matches) {
        if (!m.winner || m.joint) continue;
        const loser = m.winner === m.a ? m.b : m.a;
        if (involving.has(m.winner) || involving.has(loser)) kos.push({ season: plan.season, event: ko.name === 'champ' ? 'champ' : 'club', stage: stg.label, winner: m.winner, loser });
      }
    }
  }
  const finishes: SeasonFinish[] = [];
  for (const c of st.competitors.values()) for (const h of c.history) finishes.push({ season: h.season, region: h.region, division: h.division, rank: h.rank, id: c.id });
  for (const h of st.world.player.history) finishes.push({ season: h.season, region: st.world.player.region, division: h.division, rank: h.rank, id: PLAYER_ID });
  return { meetings, kos, finishes };
}

/** All rivalries of one subject (player or competitor), strongest first. */
export function rivalriesOf(st: FedState, subject: string, playerGames: GameRecord[] = [], name: (id: string) => string = x => x): Rivalry[] {
  const { meetings, kos, finishes } = collect(st, new Set([subject]), playerGames);
  const opponents = new Set<string>();
  for (const m of meetings) if (m.a === subject) opponents.add(m.b); else if (m.b === subject) opponents.add(m.a);
  for (const k of kos) opponents.add(k.winner === subject ? k.loser : k.winner);
  opponents.delete(subject);
  return [...opponents].map(o => computeRivalry(subject, o, meetings, kos, finishes, st.world.season, name)).filter(r => r.meetings > 0 || r.events.length).sort((x, y) => y.intensity - x.intensity || y.meetings - x.meetings);
}

/** Strongest rivalries among the featured rivals (for narratives and previews). */
export function featuredRivalries(st: FedState, name: (id: string) => string = x => x): Rivalry[] {
  const ids = new Set((st.world.featured ?? []).map(f => f.id));
  const { meetings, kos, finishes } = collect(st, ids);
  const pairs = new Set<string>();
  for (const m of meetings) if (ids.has(m.a) && ids.has(m.b)) pairs.add(m.a < m.b ? `${m.a}|${m.b}` : `${m.b}|${m.a}`);
  for (const k of kos) if (ids.has(k.winner) && ids.has(k.loser)) pairs.add(k.winner < k.loser ? `${k.winner}|${k.loser}` : `${k.loser}|${k.winner}`);
  return [...pairs].map(p => { const [a, b] = p.split('|'); return computeRivalry(a, b, meetings, kos, finishes, st.world.season, name); }).sort((x, y) => y.intensity - x.intensity).slice(0, 20);
}
