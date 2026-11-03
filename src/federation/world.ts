/**
 * Deterministic federation simulation (crown-world-1). Pure functions: no I/O, no clocks, no Math.random.
 * Every random draw comes from mulberry32 seeded by hashSeed(worldSeed, purpose, season, round, key), so a
 * world replays identically. Results of a round are drawn only when the round is processed — never stored
 * in advance — so markets and forecasts opened during the round cannot read them (docs/V3_FEDERATION.md).
 */
import { updateRating } from '../ratings/glicko2';
import {
  CHAMPIONSHIP_ROUNDS, Competitor, DIVISIONS, Fixture, LEAGUE_EVENT, LEAGUE_ROUNDS, PLAYER_ID, REGIONS, ROUNDS_PER_SEASON, SWISS_ROUNDS,
} from './model';
import { KoMatch, koNext, leagueOrder, roundRobin, standings, swissOrder, swissPairing, StandingRow } from './formats';
import { ageOf, hashSeed, makeCompetitor, normal, rng01 } from './generator';
import { sampleResult } from './resultModel';

export const WORLD_ID = 'crown-world-1';

export interface Circuit { region: number; division: number; members: string[] }
export interface SwissState { event: 'open' | 'challenger'; name: string; entrants: string[]; seeds: Record<string, number>; byes: Record<string, number>; rounds: { round: number; pairs: [string, string][]; bye: string | null; repeats: number }[] }
export interface KoState { name: string; qualifiers: string[]; seeds: Record<string, number>; stages: { round: number; label: string; matches: KoMatch[] }[]; champions: string[] }

export interface SeasonPlan {
  id: string; // `season:${n}`
  season: number;
  circuits: Circuit[];
  /** Federation Open (divisions 2–4, top 8 qualify for the Championship) and Challenger Open (divisions 5–8, player may register). */
  swiss: SwissState[];
  champ: KoState | null;
  club: KoState | null;
  status: 'active' | 'complete';
}

export interface WorldState {
  key: 'world';
  version: 1;
  seed: number;
  season: number;
  round: number; // the currently open round (1..ROUNDS_PER_SEASON)
  nextIndex: number; // next competitor index for entrants
  player: { joined: boolean; region: number; division: number; swissRegistered: boolean; titles: { season: number; title: string }[]; history: { season: number; division: number; rank: number; points: number }[]; displaced: string | null };
  createdAt: string;
}

export interface RoundRecord {
  id: string; // `${season}:${round}`
  season: number;
  round: number;
  status: 'open' | 'done';
  /** Player and featured (engine) fixtures and all knockout games, with full detail. */
  fixtures: Fixture[];
  /** Compact tier-3 fixtures: [event, white, black, result|null]. */
  abstract: [string, string, string, number | null][];
  processedAt: string | null;
}

export interface Ctx {
  world: WorldState;
  plan: SeasonPlan;
  competitors: Map<string, Competitor>;
  player: { rating: number; rd: number; name: string };
  /** Swiss games of the current season (for pairings and standings). */
  swissHistory?: { event: string; white: string; black: string; result: number | null }[];
}

const isPlayer = (id: string) => id === PLAYER_ID;

/** Initial world state and season-1 plan. */
export function createWorld(seed: number, competitors: Competitor[], nowIso: string): { world: WorldState; plan: SeasonPlan } {
  const world: WorldState = {
    key: 'world', version: 1, seed, season: 1, round: 1, nextIndex: competitors.length,
    player: { joined: false, region: 0, division: DIVISIONS, swissRegistered: false, titles: [], history: [], displaced: null },
    createdAt: nowIso,
  };
  return { world, plan: makePlan(seed, 1, competitors, null) };
}

export function makePlan(seed: number, season: number, competitors: Competitor[], player: WorldState['player'] | null): SeasonPlan {
  const active = competitors.filter(c => c.status === 'active');
  const circuits: Circuit[] = [];
  for (let region = 0; region < REGIONS; region++) for (let division = 1; division <= DIVISIONS; division++) {
    const members = active.filter(c => c.region === region && c.division === division).sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id)).map(c => c.id);
    if (player?.joined && player.region === region && player.division === division) members.push(PLAYER_ID);
    circuits.push({ region, division, members });
  }
  // Swiss events: the 32 highest-rated active competitors of divisions 2–4 (Federation Open) and of 5–8 (Challenger Open)
  const field = (lo: number, hi: number) => active.filter(c => c.division >= lo && c.division <= hi).sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id)).slice(0, 32).map(c => c.id);
  const sw = (event: 'open' | 'challenger', name: string, ids: string[]): SwissState => ({ event, name, entrants: ids, seeds: Object.fromEntries(ids.map((id, i) => [id, i + 1])), byes: {}, rounds: [] });
  void seed;
  return { id: `season:${season}`, season, circuits, swiss: [sw('open', 'Federation Open', field(2, 4)), sw('challenger', 'Challenger Open', field(5, 8))], champ: null, club: null, status: 'active' };
}

/** Player joins: takes the slot of the lowest-rated competitor of the chosen bottom-division circuit (who becomes a reserve). */
export function joinPlayer(ctx: Ctx, region: number): { displaced: string } {
  const { world, plan } = ctx;
  if (world.player.joined) throw new Error('Already joined');
  if (world.round !== 1) throw new Error('Players join at the start of a season');
  const circuit = plan.circuits.find(c => c.region === region && c.division === DIVISIONS)!;
  const displaced = circuit.members[circuit.members.length - 1];
  circuit.members = [...circuit.members.filter(m => m !== displaced), PLAYER_ID];
  const c = ctx.competitors.get(displaced)!;
  c.status = 'reserve';
  world.player = { ...world.player, joined: true, region, division: DIVISIONS, displaced };
  return { displaced };
}

/** Register the player for the Challenger Open (before its first round); replaces the lowest seed. */
export function registerChallenger(ctx: Ctx): { replaced: string } {
  const sw = ctx.plan.swiss.find(x => x.event === 'challenger')!;
  if (!ctx.world.player.joined) throw new Error('Join the federation first');
  if (ctx.world.round > SWISS_ROUNDS[0] - 1 && ctx.world.round !== SWISS_ROUNDS[0]) throw new Error('Registration is closed');
  if (sw.rounds.length) throw new Error('Registration is closed');
  if (sw.entrants.includes(PLAYER_ID)) throw new Error('Already registered');
  const replaced = sw.entrants[sw.entrants.length - 1];
  sw.entrants = [...sw.entrants.slice(0, -1), PLAYER_ID];
  // seed the player by rating
  const order = [...sw.entrants].sort((a, b) => ratingOf(ctx, b) - ratingOf(ctx, a) || a.localeCompare(b));
  sw.seeds = Object.fromEntries(order.map((id, i) => [id, i + 1]));
  ctx.world.player.swissRegistered = true;
  return { replaced };
}

/** Pairings for a round (no results). */
export function openRound(ctx: Ctx): RoundRecord {
  const { world, plan } = ctx;
  const season = world.season, round = world.round;
  const fixtures: Fixture[] = [];
  const abstract: RoundRecord['abstract'] = [];
  const add = (event: string, white: string, black: string, board: number, stage?: string) => {
    const id = `${season}:${round}:${event}:${board}`;
    if (isPlayer(white) || isPlayer(black)) fixtures.push({ id, season, round, event, white, black, result: null, tier: 1, gameId: null, stage });
    else if (stage) fixtures.push({ id, season, round, event, white, black, result: null, tier: 3, gameId: null, stage });
    else abstract.push([event, white, black, null]);
  };
  if (round <= LEAGUE_ROUNDS) {
    for (const c of plan.circuits) {
      const rr = roundRobin(c.members);
      const pairs = rr[(round - 1) % rr.length] ?? [];
      pairs.forEach(([w, b], i) => add(LEAGUE_EVENT(c.region, c.division), w, b, i));
    }
  }
  if (SWISS_ROUNDS.includes(round)) {
    for (const sw of plan.swiss) {
      const prevGames = (ctx.swissHistory ?? []).filter(g => g.event === sw.event);
      const rows = standings(sw.entrants, prevGames, new Map(Object.entries(sw.seeds)), new Map(Object.entries(sw.byes)));
      const met = new Set(prevGames.map(g => (g.white < g.black ? `${g.white}|${g.black}` : `${g.black}|${g.white}`)));
      const whites = new Map<string, number>();
      for (const g of prevGames) whites.set(g.white, (whites.get(g.white) ?? 0) + 1);
      const p = swissPairing(rows.map(r => ({ id: r.id, points: r.points, seed: r.seed, whites: whites.get(r.id) ?? 0, hadBye: !!sw.byes[r.id] })), met);
      sw.rounds.push({ round, pairs: p.pairs, bye: p.bye, repeats: p.repeats });
      if (p.bye) sw.byes[p.bye] = (sw.byes[p.bye] ?? 0) + 1;
      p.pairs.forEach(([w, b], i) => add(sw.event, w, b, i));
    }
  }
  const rec: RoundRecord = { id: `${season}:${round}`, season, round, status: 'open', fixtures, abstract, processedAt: null };
  koFill(ctx, rec);
  return rec;
}

/**
 * Schedule every knockout game that can be scheduled now (first game of a pairing, or the next game once the
 * previous one has a result). Returns the number of new fixtures. Matches resolve with koNext's finite rules.
 */
export function koFill(ctx: Ctx, rec: RoundRecord): number {
  let added = 0;
  for (const ko of [ctx.plan.champ, ctx.plan.club]) {
    if (!ko) continue;
    const st = ko.stages.find(x => x.round === rec.round);
    if (!st) continue;
    st.matches.forEach((m, mi) => {
      const nx = koNext(m, st.label === 'Final' && ko.name === 'champ');
      if (!nx) return;
      m.games.push({ white: nx.white, black: nx.black, result: null, phase: nx.phase });
      const gi = m.games.length - 1;
      const id = `${rec.season}:${rec.round}:${ko.name}:${mi}:${gi}`;
      const tier = isPlayer(nx.white) || isPlayer(nx.black) ? 1 : 3;
      rec.fixtures.push({ id, season: rec.season, round: rec.round, event: ko.name, white: nx.white, black: nx.black, result: null, tier, gameId: null, stage: `${st.label} · ${nx.phase} ${gi + 1}` });
      added++;
    });
  }
  return added;
}

/** Copy knockout fixture results into their matches (by fixture id). */
export function koSync(ctx: Ctx, rec: RoundRecord): void {
  for (const ko of [ctx.plan.champ, ctx.plan.club]) {
    if (!ko) continue;
    const st = ko.stages.find(x => x.round === rec.round);
    if (!st) continue;
    for (const f of rec.fixtures.filter(x => x.event === ko.name && x.result !== null)) {
      const [, , , mi, gi] = f.id.split(':');
      const g = st.matches[+mi]?.games[+gi];
      if (g && g.result === null) g.result = f.result;
    }
  }
}

/**
 * Resolve everything that does not need the player or a featured engine game: tier-3 draws, knockout
 * follow-ups (tiebreak pairs) and their draws, until only tier-1/2 games remain or the round is complete.
 */
export function settleRound(ctx: Ctx, rec: RoundRecord): { waiting: Fixture[] } {
  for (let guard = 0; guard < 50; guard++) {
    resolveAbstract(ctx, rec);
    koSync(ctx, rec);
    // koNext only schedules a match's next game once its current games are decided, so pending league or
    // featured games elsewhere in the round never delay a knockout follow-up (e.g. the player's game 2).
    if (!koFill(ctx, rec)) break;
  }
  return { waiting: rec.fixtures.filter(f => f.result === null) };
}


/** Draw tier-3 results from hidden strengths (seeded per fixture). */
export function resolveAbstract(ctx: Ctx, rec: RoundRecord): void {
  const strength = (id: string) => (isPlayer(id) ? ctx.player.rating : ctx.competitors.get(id)!.latent);
  for (const f of rec.abstract) {
    if (f[3] !== null) continue;
    const u = rng01(hashSeed(ctx.world.seed, 'result', rec.season, rec.round, f[0], f[1], f[2]))();
    f[3] = sampleResult(strength(f[1]), strength(f[2]), u);
  }
  for (const f of rec.fixtures) {
    if (f.tier !== 3 || f.result !== null) continue;
    const u = rng01(hashSeed(ctx.world.seed, 'result', rec.season, rec.round, f.id))();
    f.result = sampleResult(strength(f.white), strength(f.black), u);
  }
}

export interface RoundOutcome {
  /** Prize, title and milestone events for the economy/career layers (idempotent ids). */
  events: { id: string; kind: 'title' | 'promotion' | 'relegation' | 'milestone' | 'qualified' | 'ko-advance'; subject: string; text: string; amountKey?: string }[];
  seasonComplete: boolean;
}

/** Apply a fully resolved round: ratings, form, stats, knockout progress. Mutates ctx. */
export function applyRound(ctx: Ctx, rec: RoundRecord, allSeasonGames: { event: string; white: string; black: string; result: number | null }[]): RoundOutcome {
  const events: RoundOutcome['events'] = [];
  const games: { event: string; white: string; black: string; result: number }[] = [
    ...rec.abstract.map(([e, w, b, r]) => ({ event: e, white: w, black: b, result: r! })),
    ...rec.fixtures.map(f => ({ event: f.event, white: f.white, black: f.black, result: f.result! })),
  ];
  if (games.some(g => g.result === null || g.result === undefined)) throw new Error('Round has unresolved fixtures');
  // Glicko-2: one rating period per round for every active competitor (inactive ones age their RD)
  const snapshot = new Map<string, { rating: number; rd: number }>();
  for (const c of ctx.competitors.values()) snapshot.set(c.id, { rating: c.rating, rd: c.rd });
  snapshot.set(PLAYER_ID, { rating: ctx.player.rating, rd: ctx.player.rd });
  const results = new Map<string, { rating: number; rd: number; score: number }[]>();
  for (const g of games) {
    for (const [me, opp, s] of [[g.white, g.black, g.result], [g.black, g.white, 1 - g.result]] as [string, string, number][]) {
      if (isPlayer(me)) continue;
      results.set(me, [...(results.get(me) ?? []), { ...snapshot.get(opp)!, score: s }]);
      const c = ctx.competitors.get(me)!;
      if (s === 1) c.stats.w++; else if (s === 0) c.stats.l++; else c.stats.d++;
      c.form = (c.form + (s === 1 ? 'W' : s === 0 ? 'L' : 'D')).slice(-5);
      const o = snapshot.get(opp)!;
      if (s === 1 && o.rating - c.rating > 250) c.milestones.push({ season: rec.season, round: rec.round, text: `Upset win against ${isPlayer(opp) ? 'the player' : ctx.competitors.get(opp)!.name} (+${Math.round(o.rating - c.rating)} rated)` });
    }
  }
  for (const c of ctx.competitors.values()) {
    if (c.status !== 'active') continue;
    const r = updateRating({ rating: c.rating, rd: c.rd, sigma: c.sigma }, results.get(c.id) ?? []);
    c.rating = r.after.rating; c.rd = Math.max(40, r.after.rd); c.sigma = r.after.sigma;
    if (c.milestones.length > 30) c.milestones.splice(0, c.milestones.length - 30);
  }
  // swiss history for pairings
  ctx.swissHistory = [...(ctx.swissHistory ?? []), ...games.filter(g => g.event === 'open' || g.event === 'challenger')];
  const seasonComplete = rec.round === ROUNDS_PER_SEASON;
  void allSeasonGames;
  return { events, seasonComplete };
}

/** League table for a circuit from a season's games. */
export function leagueTable(circuit: Circuit, games: { event: string; white: string; black: string; result: number | null }[], seeds?: Map<string, number>): StandingRow[] {
  const ev = LEAGUE_EVENT(circuit.region, circuit.division);
  const gs = games.filter(g => g.event === ev);
  const sd = seeds ?? new Map(circuit.members.map((m, i) => [m, i + 1]));
  return leagueOrder(standings(circuit.members, gs, sd), gs);
}

export function swissTable(sw: SwissState, games: { event: string; white: string; black: string; result: number | null }[]): StandingRow[] {
  return swissOrder(standings(sw.entrants, games.filter(g => g.event === sw.event), new Map(Object.entries(sw.seeds)), new Map(Object.entries(sw.byes))));
}

/** After the league and Swiss finish (end of round 15): build the 16-player championship. */
export function buildChampionship(ctx: Ctx, games: { event: string; white: string; black: string; result: number | null }[]): KoState {
  const winners = ctx.plan.circuits.filter(c => c.division === 1).map(c => leagueTable(c, games)[0])
    .sort((a, b) => b.points - a.points || (ratingOf(ctx, b.id) - ratingOf(ctx, a.id)) || a.id.localeCompare(b.id)).slice(0, 8).map(r => r.id);
  const swiss = swissTable(ctx.plan.swiss.find(x => x.event === 'open')!, games).map(r => r.id).filter(id => !winners.includes(id)).slice(0, 8);
  const qualifiers = [...winners, ...swiss];
  const seeds = Object.fromEntries([...qualifiers].sort((a, b) => ratingOf(ctx, b) - ratingOf(ctx, a) || a.localeCompare(b)).map((id, i) => [id, i + 1]));
  const bySeed = [...qualifiers].sort((a, b) => seeds[a] - seeds[b]);
  const order = [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
  const first: KoMatch[] = [];
  for (let i = 0; i < 16; i += 2) {
    const a = bySeed[order[i] - 1], b = bySeed[order[i + 1] - 1];
    first.push({ a, b, seedA: seeds[a], seedB: seeds[b], games: [], winner: null, joint: false, decidedBy: null });
  }
  const labels = ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];
  return { name: 'champ', qualifiers, seeds, stages: CHAMPIONSHIP_ROUNDS.map((round, i) => ({ round, label: labels[i], matches: i === 0 ? first : [] })), champions: [] };
}

/** Advance knockout winners into the next stage once a stage is decided. */
export function advanceKo(ko: KoState, round: number): string[] {
  const idx = ko.stages.findIndex(s => s.round === round);
  if (idx < 0) return [];
  const st = ko.stages[idx];
  if (st.matches.some(m => !m.winner && !m.joint)) throw new Error('Knockout stage undecided');
  if (idx === ko.stages.length - 1) {
    const m = st.matches[0];
    ko.champions = m.joint ? [m.a, m.b] : [m.winner!];
    return ko.champions;
  }
  const next = ko.stages[idx + 1];
  const w = st.matches.map(m => m.winner!);
  next.matches = [];
  for (let i = 0; i < w.length; i += 2) next.matches.push({ a: w[i], b: w[i + 1], seedA: ko.seeds[w[i]], seedB: ko.seeds[w[i + 1]], games: [], winner: null, joint: false, decidedBy: null });
  return w;
}

export const ratingOf = (ctx: Ctx, id: string) => (isPlayer(id) ? ctx.player.rating : ctx.competitors.get(id)!.rating);

export interface SeasonEndResult {
  promotions: { id: string; region: number; from: number; to: number }[];
  relegations: { id: string; region: number; from: number; to: number }[];
  titles: { id: string; title: string }[];
  standings: { region: number; division: number; order: string[]; points: Record<string, number> }[];
  retirements: string[];
  entrants: Competitor[];
}

/**
 * Season end: final tables, titles, promotion/relegation (top/bottom 2 between adjacent divisions of a region),
 * careers (ageing drift, retirements) and entrants placed in the vacated slots. Mutates ctx; returns a summary.
 */
export function endSeason(ctx: Ctx, games: { event: string; white: string; black: string; result: number | null }[]): SeasonEndResult {
  const { world, plan, competitors } = ctx;
  const season = world.season;
  const res: SeasonEndResult = { promotions: [], relegations: [], titles: [], standings: [], retirements: [], entrants: [] };
  const tables = new Map<string, StandingRow[]>();
  for (const c of plan.circuits) {
    const t = leagueTable(c, games);
    tables.set(`${c.region}:${c.division}`, t);
    res.standings.push({ region: c.region, division: c.division, order: t.map(r => r.id), points: Object.fromEntries(t.map(r => [r.id, r.points])) });
    t.forEach((r, i) => {
      if (isPlayer(r.id)) world.player.history.push({ season, division: c.division, rank: i + 1, points: r.points });
      else {
        const comp = competitors.get(r.id)!;
        comp.history.push({ season, region: c.region, division: c.division, rank: i + 1, points: r.points, played: r.played, rating: Math.round(comp.rating), earnings: 0 });
      }
    });
    const champ = t[0].id;
    const title = `${['Crown', 'Grand', 'Premier', 'Masters', 'Senior', 'District', 'Club', 'Open'][c.division - 1]} Division champion (${c.region + 1}) S${season}`;
    res.titles.push({ id: champ, title });
  }
  for (const ev of plan.swiss) {
    const t = swissTable(ev, games);
    if (t[0]) res.titles.push({ id: t[0].id, title: `${ev.name} winner S${season}` });
  }
  if (plan.champ?.champions.length) for (const id of plan.champ.champions) res.titles.push({ id, title: plan.champ.champions.length > 1 ? `Joint Crown Champion S${season}` : `Crown Champion S${season}` });
  for (const t of res.titles) {
    if (isPlayer(t.id)) world.player.titles.push({ season, title: t.title });
    else { const c = competitors.get(t.id)!; c.titles.push({ season, title: t.title }); c.reputation = Math.min(100, c.reputation + (t.title.startsWith('Crown Champion') || t.title.startsWith('Joint') ? 25 : t.title.startsWith('Federation') ? 10 : 4)); }
  }
  // promotion / relegation (simultaneous exchange between adjacent divisions within a region)
  const moves: { id: string; region: number; from: number; to: number }[] = [];
  for (let region = 0; region < REGIONS; region++) for (let d = 1; d < DIVISIONS; d++) {
    const upper = tables.get(`${region}:${d}`)!, lower = tables.get(`${region}:${d + 1}`)!;
    for (const r of upper.slice(-2)) moves.push({ id: r.id, region, from: d, to: d + 1 });
    for (const r of lower.slice(0, 2)) moves.push({ id: r.id, region, from: d + 1, to: d });
  }
  for (const m of moves) {
    (m.to < m.from ? res.promotions : res.relegations).push(m);
    if (isPlayer(m.id)) world.player.division = m.to;
    else competitors.get(m.id)!.division = m.to;
  }
  // reputation drift and careers
  const r = rng01(hashSeed(world.seed, 'careers', season));
  for (const c of competitors.values()) {
    if (c.status === 'retired') continue;
    c.reputation = Math.max(0, Math.round(c.reputation * 0.9));
    const age = ageOf(c, season);
    const drift = age < 24 ? 25 + 30 * normal(r) : age <= 31 ? 25 * normal(r) : -20 + 25 * normal(r);
    c.latent = Math.round(Math.max(750, Math.min(3050, c.latent + Math.max(-90, Math.min(90, drift)))));
    if (c.status === 'active') {
      const pRetire = age >= 40 ? 0.45 : age >= 36 ? 0.12 : 0.004;
      if (r() < pRetire) { c.status = 'retired'; c.retiredSeason = season; res.retirements.push(c.id); }
    }
  }
  // entrants fill vacated slots in each region's bottom division; a reserve (displaced by the player) re-enters first
  const used = new Set([...competitors.values()].map(c => c.name));
  for (const id of res.retirements) {
    const old = competitors.get(id)!;
    const region = old.region, division = old.division;
    // The competitor displaced when the player joined re-enters first; otherwise a new entrant is
    // calibrated for the destination band (latent ~ N(division mean, 120²), public rating = band mean, RD 300).
    const reserve = world.player.displaced ? competitors.get(world.player.displaced) : undefined;
    if (reserve && reserve.status === 'reserve') {
      reserve.status = 'active'; reserve.region = region; reserve.division = division; world.player.displaced = null;
      continue;
    }
    const e = makeCompetitor(world.seed, world.nextIndex++, region, division, season + 1, used, true);
    competitors.set(e.id, e);
    res.entrants.push(e);
  }
  plan.status = 'complete';
  return res;
}
