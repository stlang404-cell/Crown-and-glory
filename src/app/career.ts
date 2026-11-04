/**
 * The player's season in the shared Federation (v0.11, package K): upcoming matches, the competitions they are in,
 * their league standing and every qualification opportunity with "what you need". Read-only selectors over saved
 * state; nothing is estimated (no probabilities), every statement follows from the published rules
 * (docs/V3_COMPETITION_RULES.md) and recorded results.
 */
import type { FedState } from './federation';
import { POSTPONE_DEADLINE, POSTPONE_LIMIT, eventName } from './federation';
import { DIVISIONS, DIVISION_SIZE, LEAGUE_ROUNDS, PLAYER_ID, ROUNDS_PER_SEASON, SWISS_ROUNDS, divisionLabel, regionName, topologyOf } from '../federation/model';
import { roundRobin } from '../federation/formats';
import { allKos, leagueTable, leagueZone, swissEventsOpenTo, swissTable, PROMOTION_PLACES, RELEGATION_PLACES, type KoState } from '../federation/world';
import { CUP_ROUNDS, OPEN_INVITES, RULES_V2, ZONAL_ROUNDS, ZONAL_SIZE, koTitle, rulesOf, zoneName, zoneOf, zoneRegions } from '../federation/competitions';
import type { SeasonGame } from '../federation/driver';
import { CHALLENGER_FEE } from '../economy/economy';
import { fmtCrowns } from '../exchange/ledger';

export interface UpcomingMatch { key: string; round: number; event: string; eventName: string; opponent: string | null; colour: 'White' | 'Black' | null; status: 'play-now' | 'postponed' | 'scheduled' | 'to-be-paired'; note: string; fixtureId?: string }

/** Your next matches: this round's games, postponed games (with their deadline), the next league rounds from the
 *  fixed round-robin schedule, and Swiss / knockout rounds you are still in (paired when the round opens). */
export function upcomingMatches(st: FedState, limit = 8): UpcomingMatch[] {
  const w = st.world, out: UpcomingMatch[] = [];
  const rec = st.rounds.get(`${w.season}:${w.round}`);
  const opp = (f: { white: string; black: string }) => (f.white === PLAYER_ID ? f.black : f.white);
  for (const f of rec?.fixtures ?? []) if (f.tier === 1 && f.result === null) out.push({ key: f.id, round: w.round, event: f.event, eventName: eventName(f.event), opponent: opp(f), colour: f.white === PLAYER_ID ? 'White' : 'Black', status: 'play-now', note: f.stage ?? `Round ${w.round}`, fixtureId: f.id });
  for (const f of w.player.postponed ?? []) out.push({ key: f.id, round: f.postponedFrom ?? f.round, event: f.event, eventName: eventName(f.event), opponent: opp(f), colour: f.white === PLAYER_ID ? 'White' : 'Black', status: 'postponed', note: `Postponed from round ${f.postponedFrom ?? f.round} · play by the end of round ${POSTPONE_DEADLINE}`, fixtureId: f.id });
  const circuit = st.plan.circuits.find(c => c.members.includes(PLAYER_ID));
  if (circuit) {
    const rr = roundRobin(circuit.members);
    for (let r = w.round + 1; r <= LEAGUE_ROUNDS; r++) {
      const p = (rr[(r - 1) % rr.length] ?? []).find(([a, b]) => a === PLAYER_ID || b === PLAYER_ID);
      if (p) out.push({ key: `league:${r}`, round: r, event: `league:${circuit.region}:${circuit.division}`, eventName: `${divisionLabel(circuit.division)} · ${regionName(circuit.region)}`, opponent: p[0] === PLAYER_ID ? p[1] : p[0], colour: p[0] === PLAYER_ID ? 'White' : 'Black', status: 'scheduled', note: `League round ${r}` });
    }
  }
  const sw = st.plan.swiss.find(s => s.entrants.includes(PLAYER_ID));
  if (sw) for (const r of SWISS_ROUNDS) if (r > w.round) out.push({ key: `${sw.event}:${r}`, round: r, event: sw.event, eventName: sw.name, opponent: null, colour: null, status: 'to-be-paired', note: `Swiss round ${r - SWISS_ROUNDS[0] + 1} · paired when round ${r} opens` });
  for (const ko of allKos(st.plan)) {
    if (!ko.qualifiers.includes(PLAYER_ID) || !koAliveIds(ko).includes(PLAYER_ID)) continue;
    for (const sg of ko.stages) if (sg.round > w.round) out.push({ key: `${ko.name}:${sg.round}`, round: sg.round, event: ko.name, eventName: koTitle(ko), opponent: null, colour: null, status: 'to-be-paired', note: `${sg.label} · round ${sg.round} if you advance` });
  }
  return out.sort((a, b) => (a.status === 'play-now' ? -1 : 0) - (b.status === 'play-now' ? -1 : 0) || (a.status === 'postponed' ? -1 : 0) - (b.status === 'postponed' ? -1 : 0) || a.round - b.round).slice(0, limit);
}

/** Entrants of a knockout not yet eliminated (champions once decided). */
export function koAliveIds(ko: KoState): string[] {
  if (ko.champions.length) return ko.champions;
  const out = new Set<string>();
  for (const sg of ko.stages) for (const m of sg.matches) if (m.winner) out.add(m.winner === m.a ? m.b : m.a);
  return ko.qualifiers.filter(id => !out.has(id));
}

export interface MyStanding { region: number; division: number; rank: number; size: number; points: number; played: number; zone: 'promotion' | 'relegation' | null; roundsLeft: number; gapToPromotion: number | null; gapToSafety: number | null }
export function myStanding(st: FedState, games: SeasonGame[]): MyStanding | null {
  const c = st.plan.circuits.find(x => x.members.includes(PLAYER_ID));
  if (!c) return null;
  const t = leagueTable(c, games);
  const i = t.findIndex(r => r.id === PLAYER_ID);
  if (i < 0) return null;
  const me = t[i];
  const roundsLeft = Math.max(0, LEAGUE_ROUNDS - me.played);
  const promo = c.division > 1 && i >= PROMOTION_PLACES ? t[PROMOTION_PLACES - 1].points - me.points : null;
  const safe = c.division < DIVISIONS && i >= t.length - RELEGATION_PLACES ? t[t.length - RELEGATION_PLACES - 1].points - me.points : null;
  return { region: c.region, division: c.division, rank: i + 1, size: t.length, points: me.points, played: me.played, zone: leagueZone(c.division, i + 1, t.length), roundsLeft, gapToPromotion: promo, gapToSafety: safe };
}

export interface Opportunity { id: string; name: string; status: 'qualified' | 'entered' | 'open' | 'in-reach' | 'next-season' | 'closed' | 'eliminated' | 'won'; need: string; action?: { kind: 'register'; event: 'open' | 'challenger'; free: boolean } }

/** Every competition the player can reach this season or next, with the exact rule that gets them in. */
export function opportunities(st: FedState, games: SeasonGame[]): Opportunity[] {
  const w = st.world, p = w.player, out: Opportunity[] = [];
  const rules = rulesOf(st.plan), regions = topologyOf(w).regions;
  const s = myStanding(st, games);
  const leagueOver = w.round > LEAGUE_ROUNDS;
  const pts = (x: number) => `${x} point${x === 1 ? '' : 's'}`;
  // league: promotion / relegation
  if (s) {
    const left = LEAGUE_ROUNDS - s.played;
    if (s.division > 1) out.push({ id: 'promotion', name: `Promotion to the ${divisionLabel(s.division - 1)}`, status: leagueOver ? (s.zone === 'promotion' ? 'won' : 'closed') : s.zone === 'promotion' ? 'in-reach' : left * 1 >= (s.gapToPromotion ?? 0) ? 'in-reach' : 'closed',
      need: leagueOver ? (s.zone === 'promotion' ? `Promoted: you finished ${s.rank}.` : `You finished ${s.rank}; the top ${PROMOTION_PLACES} were promoted.`)
        : s.zone === 'promotion' ? `You are ${s.rank} of ${s.size} — hold a top-${PROMOTION_PLACES} place with ${left} game${left === 1 ? '' : 's'} left.`
          : `Finish in the top ${PROMOTION_PLACES}: you are ${s.rank}, ${pts(s.gapToPromotion ?? 0)} behind ${PROMOTION_PLACES === 2 ? '2nd' : 'the last promotion place'}, ${left} game${left === 1 ? '' : 's'} left.` });
    if (s.division < DIVISIONS && s.zone === 'relegation' && !leagueOver) out.push({ id: 'safety', name: 'Avoid relegation', status: 'in-reach', need: `You are ${s.rank} of ${s.size}: climb out of the bottom ${RELEGATION_PLACES} (${pts(s.gapToSafety ?? 0)} behind safety).` });
  }
  // Swiss events
  const events = swissEventsOpenTo(w);
  for (const sw of st.plan.swiss) {
    const mine = sw.entrants.includes(PLAYER_ID);
    const allowed = events.includes(sw.event);
    if (!mine && !allowed) continue;
    const invited = sw.event === 'open' && p.invite?.season === w.season;
    if (mine) {
      const t = games.some(g => g.event === sw.event && g.result !== null) ? swissTable(sw, games) : [];
      const at = t.findIndex(r => r.id === PLAYER_ID);
      out.push({ id: sw.event, name: sw.name, status: 'entered', need: at >= 0 ? `Entered · ${at + 1} of ${sw.entrants.length} after ${sw.rounds.length} round${sw.rounds.length === 1 ? '' : 's'}.${sw.event === 'open' ? ' The top 8 not already qualified reach the Crown Championship.' : ''}` : `Entered · ${sw.entrants.length} players, rounds ${SWISS_ROUNDS[0]}–${SWISS_ROUNDS[SWISS_ROUNDS.length - 1]}.` });
    } else if (w.round < SWISS_ROUNDS[0]) out.push({ id: sw.event, name: sw.name, status: 'open', action: { kind: 'register', event: sw.event, free: invited },
      need: `${invited ? `Invited (${p.invite!.reason}): free entry` : `Entry ${fmtCrowns(CHALLENGER_FEE, 0)}`} — register by the end of round ${SWISS_ROUNDS[0] - 1}.${sw.event === 'open' ? ' Top 8 reach the Crown Championship.' : ''}` });
    else out.push({ id: sw.event, name: sw.name, status: 'closed', need: `Registration closed before round ${SWISS_ROUNDS[0]}.` });
  }
  if (rules >= RULES_V2) {
    const champQ = st.plan.champ?.qualifiers.includes(PLAYER_ID);
    // Regional Cup (divisions 2–8)
    const myCup = st.plan.cups?.find(k => k.kind === 'cup' && k.qualifiers.includes(PLAYER_ID));
    const myZonal = st.plan.cups?.find(k => k.kind === 'zonal' && k.qualifiers.includes(PLAYER_ID));
    const koStatus = (ko: KoState) => (ko.champions.includes(PLAYER_ID) ? 'won' : koAliveIds(ko).includes(PLAYER_ID) ? 'qualified' : 'eliminated') as Opportunity['status'];
    if (myCup) out.push({ id: myCup.name, name: koTitle(myCup), status: koStatus(myCup), need: myCup.champions.includes(PLAYER_ID) ? `Won. The ${OPEN_INVITES} highest-rated cup winners are invited to next season's Federation Open.` : `Qualified · rounds ${CUP_ROUNDS[0]}–${CUP_ROUNDS[CUP_ROUNDS.length - 1]}. Winning it can earn a Federation Open invitation.` });
    else if (p.division >= 2 && !st.plan.cups?.length) out.push({ id: 'cup', name: `${regionName(p.region)} Regional Cup`, status: leagueOver ? 'closed' : 'in-reach', need: `${p.division === 2 ? 'Finish in the top 2 of the Grand Division' : `Win the ${divisionLabel(p.division)}`} of ${regionName(p.region)} (rounds ${CUP_ROUNDS[0]}–${CUP_ROUNDS[CUP_ROUNDS.length - 1]}, 8 players). Winners can be invited to next season's Federation Open.` });
    // Zonal Championship (Crown Division)
    const zone = zoneOf(p.region, regions), zr = zoneRegions(zone, regions).length;
    const sure = Math.floor(ZONAL_SIZE / zr);
    if (myZonal) out.push({ id: myZonal.name, name: koTitle(myZonal), status: koStatus(myZonal), need: myZonal.champions.includes(PLAYER_ID) ? 'Won: you hold a zone place in next season’s Crown Championship.' : `Qualified · rounds ${ZONAL_ROUNDS[0]}–${ZONAL_ROUNDS[ZONAL_ROUNDS.length - 1]}. The zonal champion qualifies for next season's Crown Championship.` });
    else if (p.division === 1 && !st.plan.cups?.length) out.push({ id: 'zonal', name: `${zoneName(zone, regions)} Championship`, status: 'in-reach', need: `Finish in the top ${sure} of your Crown Division (${zr} region${zr === 1 ? '' : 's'} in your zone; rank ${sure + 1} may get a place on points). The zonal champion qualifies for next season's Crown Championship.` });
    // Crown Championship
    const held = w.crownQualified?.season === w.season && w.crownQualified.ids.includes(PLAYER_ID);
    if (st.plan.champ) out.push({ id: 'champ', name: 'Crown Championship', status: champQ ? koStatus(st.plan.champ) : 'closed', need: champQ ? (st.plan.champ.champions.includes(PLAYER_ID) ? 'Crown Champion.' : 'Qualified · rounds 16–19.') : 'Not qualified this season. Routes: win a Zonal Championship (next season) or the top 8 of the Federation Open.' });
    else out.push({ id: 'champ', name: 'Crown Championship', status: held ? 'qualified' : 'next-season',
      need: held ? 'Qualified through your zonal title (zone place); the bracket is drawn after round 15.'
        : p.division === 1 ? 'Win your Zonal Championship (next season), be among the best Crown Division winners if zone places are left, or (from division 2–4) finish in the Open’s top 8.'
          : p.division <= 4 ? 'Finish in the Federation Open’s top 8 (register by round 3), or reach the Crown Division and win your Zonal Championship.'
            : `Reach division 4 or win your Regional Cup for a Federation Open invitation; the Open’s top 8 qualify.` });
  } else {
    const champQ = st.plan.champ?.qualifiers.includes(PLAYER_ID);
    out.push({ id: 'champ', name: 'Crown Championship', status: champQ ? 'qualified' : st.plan.champ ? 'closed' : 'next-season', need: champQ ? 'Qualified · rounds 16–19.' : 'Win your Crown Division among the 8 best winners, or finish in the Federation Open’s top 8 (divisions 2–4).' });
  }
  return out;
}

/** The deadline / forfeit rule as shown to the player before it applies. */
export function deadlineRule(st: FedState): string {
  const n = st.world.player.postponed?.length ?? 0;
  return `Nothing is ever played for you. A round advances only when you press Advance; you can play a game now, postpone a league game (at most ${POSTPONE_LIMIT} at a time; every league game is due by the end of round ${POSTPONE_DEADLINE}), or forfeit it (a loss, no game, unrated). Swiss and knockout games cannot be postponed.${n ? ` You have ${n} postponed game${n === 1 ? '' : 's'}.` : ''}`;
}

export { ROUNDS_PER_SEASON, DIVISION_SIZE };
