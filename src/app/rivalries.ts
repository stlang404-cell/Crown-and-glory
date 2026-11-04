/**
 * Builds rivalry inputs from stored records only: every recorded result (summary or full game), knockout
 * eliminations from each season's plan, and season finishes from career histories. Ratings for upsets come from
 * the player's own game records (snapshots at game time) and competitors' previous-season ratings.
 */
import type { FedState } from './federation';
import { PLAYER_ID } from '../federation/model';
import { computeRivalry, type KoMeeting, type Meeting, type Rivalry, type SeasonFinish } from '../heraldry/rivalry';
import type { GameRecord } from '../games/types';
import { allKos, type SeasonPlan } from '../federation/world';
import { roundRobin } from '../federation/formats';
import { LEAGUE_ROUNDS } from '../federation/model';
import { koTitle } from '../federation/competitions';

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
    for (const ko of allKos(plan)) {
      for (const stg of ko.stages) for (const m of stg.matches) {
        if (!m.winner || m.joint) continue;
        const loser = m.winner === m.a ? m.b : m.a;
        if (involving.has(m.winner) || involving.has(loser)) kos.push({ season: plan.season, event: ko.name === 'champ' ? 'champ' : ko.name === 'club' ? 'club' : 'cup', stage: stg.label, winner: m.winner, loser, title: ko.name === 'champ' || ko.name === 'club' ? undefined : koTitle(ko) });
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

// ---------------------------------------------------------------- v0.11: head-to-head, challenges, rivalry events, trophies
export interface HeadToHead { federation: { w: number; d: number; l: number }; challenges: { w: number; d: number; l: number } }
/** Head-to-head with a rival: federation meetings (every recorded result) and finished Rivalry Challenges / Quick
 *  Matches against them (the player's finalized game records). Challenges are shown separately and never add
 *  rivalry intensity (anti-farming: intensity counts only scheduled federation meetings). */
export function headToHead(r: Pick<Rivalry, 'w' | 'd' | 'l'>, rivalId: string, playerGames: GameRecord[]): HeadToHead {
  const ch = { w: 0, d: 0, l: 0 };
  for (const g of playerGames) {
    if (g.context.kind !== 'quick-match' || g.status !== 'finalized' || !g.result) continue;
    const eng = g.humanColor === 'white' ? g.black : g.white;
    if (eng.id !== rivalId) continue;
    const mine = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.humanColor === 'white') ? 1 : 0;
    if (mine === 1) ch.w++; else if (mine === 0) ch.l++; else ch.d++;
  }
  return { federation: { w: r.w, d: r.d, l: r.l }, challenges: ch };
}

/** The player's most recent federation meeting with a rival lost? (rematch offer) */
export function lostLastMeeting(st: FedState, rivalId: string): boolean {
  let last: { season: number; round: number; score: number } | null = null;
  for (const r of st.rounds.values()) for (const f of r.fixtures) {
    if (f.result === null || f.forfeit) continue;
    const mine = f.white === PLAYER_ID && f.black === rivalId ? f.result : f.black === PLAYER_ID && f.white === rivalId ? 1 - f.result : null;
    if (mine === null) continue;
    if (!last || r.season > last.season || (r.season === last.season && r.round > last.round)) last = { season: r.season, round: r.round, score: mine };
  }
  return !!last && last.score === 0;
}

export interface RivalryFixture { rival: string; round: number; kind: 'league' | 'knockout'; text: string }
/** Scheduled meetings with rivals this season: league rounds from the fixed round-robin schedule, and knockout
 *  matches already drawn. */
export function rivalryFixtures(plan: SeasonPlan, currentRound: number, rivals: Set<string>, name: (id: string) => string): RivalryFixture[] {
  const out: RivalryFixture[] = [];
  const c = plan.circuits.find(x => x.members.includes(PLAYER_ID));
  if (c) {
    const rr = roundRobin(c.members);
    for (let r = currentRound; r <= LEAGUE_ROUNDS; r++) {
      const p = (rr[(r - 1) % rr.length] ?? []).find(([a, b]) => a === PLAYER_ID || b === PLAYER_ID);
      const o = p ? (p[0] === PLAYER_ID ? p[1] : p[0]) : null;
      if (o && rivals.has(o)) out.push({ rival: o, round: r, kind: 'league', text: `League round ${r}: you meet ${name(o)}` });
    }
  }
  for (const ko of allKos(plan)) for (const sg of ko.stages) for (const m of sg.matches) {
    const o = m.a === PLAYER_ID ? m.b : m.b === PLAYER_ID ? m.a : null;
    if (o && rivals.has(o) && sg.round >= currentRound && !m.winner && !m.joint) out.push({ rival: o, round: sg.round, kind: 'knockout', text: `${koTitle(ko)} ${sg.label}: you face ${name(o)}` });
  }
  return out.sort((a, b) => a.round - b.round);
}

/**
 * Rivalry trophies (crown-rivalry-trophies-1), earned from recorded results only. HOOK for package I's trophy
 * registry: each entry has a stable id, name, rule and `earned`; when the registry is merged it registers these ids
 * (kind 'rivalry trophy') and reads `earned` from here — nothing else needs to change.
 */
export const RIVALRY_TROPHIES = [
  { id: 'rivalry-laurel', name: 'Rivalry Laurel', rule: 'Reach Nemesis level (intensity 30+) with a rival and lead the federation head-to-head.' },
  { id: 'rivalry-crown', name: 'Arch-rival Crown', rule: 'Reach Arch-rival level (intensity 60+) and lead the federation head-to-head.' },
  { id: 'rivalry-knockout', name: 'Knockout Verdict', rule: 'Eliminate the rival in a knockout (Crown Championship, Zonal Championship, Regional Cup or Club Weekend).' },
] as const;
export function rivalryTrophies(r: Rivalry, kos: { winner: string; loser: string }[] = []): { id: string; name: string; rule: string; earned: boolean }[] {
  const lead = r.w > r.l;
  const ko = kos.some(k => k.winner === r.a && k.loser === r.b);
  return RIVALRY_TROPHIES.map(t => ({ ...t, earned: t.id === 'rivalry-laurel' ? r.intensity >= 30 && lead : t.id === 'rivalry-crown' ? r.intensity >= 60 && lead : ko }));
}
