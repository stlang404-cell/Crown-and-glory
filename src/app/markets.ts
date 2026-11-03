/**
 * Grand Exchange lifecycle for the season/tournament market families (crown-markets-2).
 * Called only from FederationService commands, inside their single atomic commit. Pure with respect to
 * storage: every money movement is a validated journal posted through `ops.post`.
 *
 * Timing (information integrity): a market closes when its closing round starts — the first game of that
 * round is played or the round is processed — and is settled only from recorded results. Models read public
 * ratings and recorded results only.
 */
import type { FedState } from './federation';
import type { Ctx, RoundRecord } from '../federation/world';
import { leagueTable, swissTable } from '../federation/world';
import { LEAGUE_EVENT, PLAYER_ID, LEAGUE_ROUNDS, SWISS_ROUNDS, CHAMPIONSHIP_ROUNDS, divisionLabel, REGION_NAMES } from '../federation/model';
import { hashSeed } from '../federation/generator';
import { Journal, validateJournal } from '../exchange/ledger';
import { Market, Position, openGenericMarket, closeMarket, resolveMarket, acct, unitPayout, MarketKind } from '../exchange/market';
import { npcTrade } from '../exchange/npc';
import { subsidyMicro } from '../exchange/lmsr';
import {
  FAMILY_B, RULES, bracketStates, bracketClaims, bracketModel, bracketPayout, bracketChampionModel, leagueModel,
  qualificationModel, swissWinnerModel, normaliseModel,
} from '../exchange/families';

type G = { event: string; white: string; black: string; result: number | null };
export interface MarketOps {
  st: FedState;
  post: (journals: Journal[]) => void;
  now: () => string;
  markets: Map<string, Market>;
  positions: Map<string, Position>;
}

const rating = (st: FedState) => (id: string) => st.competitors.get(id)?.rating ?? 1500;
const name = (st: FedState) => (id: string) => (id === PLAYER_ID ? 'You' : st.competitors.get(id)?.name ?? id);
const setMarket = (ops: MarketOps, m: Market) => { ops.st.markets.set(m.id, m); ops.markets.set(m.id, m); };
const setPos = (ops: MarketOps, p: Position) => { ops.st.positions.set(p.id, p); ops.positions.set(p.id, p); };
export const positionsOf = (st: FedState, marketId: string) => [...st.positions.values()].filter(p => p.marketId === marketId);
/** Open cost basis of a holder across open/closed markets (exposure cap input). */
export const exposureOf = (st: FedState, holder: string) => [...st.positions.values()].filter(p => p.holder === holder && ['open', 'closed'].includes(st.markets.get(p.marketId)?.status ?? '')).reduce((a, p) => a + Math.max(0, p.spent - p.received), 0);

/** NPC trading as one all-or-nothing batch (the market and the ledger never diverge). */
export function npcBatch(ops: MarketOps, m: Market, role: 'pre' | 'live' | 'round', belief: number[], previousClaimPrices?: number[]): Market {
  const st = ops.st;
  const pos = new Map(positionsOf(st, m.id).map(p => [p.id, p] as const));
  const res = npcTrade(m, pos, a => st.balances.get(a) ?? 0, st.world.seed, ops.now(), m.history.length, { role, belief, previousClaimPrices, exposure: h => exposureOf(st, h) });
  const trial = new Map(st.balances);
  for (const j of res.journals) {
    try { validateJournal(j, a => trial.get(a) ?? 0); for (const l of j.lines) trial.set(l.account, (trial.get(l.account) ?? 0) + l.amount); } catch { return m; }
  }
  ops.post(res.journals);
  for (const p of res.positions.values()) if (p.holder !== 'player:cash') setPos(ops, p);
  setMarket(ops, res.market);
  return res.market;
}

function openFamily(ops: MarketOps, spec: { id: string; kind: MarketKind; title: string; outcomes: string[]; claims?: Market['claims']; model: number[]; closeRound: number; ref: Record<string, string | number> }): Market | null {
  const st = ops.st;
  if (st.markets.has(spec.id)) return null;
  const b = FAMILY_B[spec.kind];
  if ((st.balances.get('treasury') ?? 0) < subsidyMicro(b, spec.outcomes.length) + 5_000_000_000) return null; // keep a 5,000 ₵ floor for match markets
  const { market, journal } = openGenericMarket({
    id: spec.id, kind: spec.kind, sandbox: false, title: spec.title, outcomes: spec.outcomes, claims: spec.claims, model: normaliseModel(spec.model, 0.001),
    rules: RULES[spec.kind], season: st.world.season, round: st.world.round, b, at: ops.now(), ref: { ...spec.ref, closeRound: spec.closeRound },
  });
  ops.post([journal]);
  setMarket(ops, market);
  return npcBatch(ops, market, 'pre', market.model!);
}

function settle(ops: MarketOps, m: Market, payout: number[], memo: string): void {
  if (m.status === 'settled' || m.status === 'cancelled') return;
  const st = ops.st;
  const closed = m.status === 'open' ? closeMarket(m, ops.now()) : m;
  const r = resolveMarket(closed, positionsOf(st, m.id), payout, 'settle', ops.now(), st.balances.get(acct(m, 'collateral')) ?? 0, null, memo);
  ops.post([r.journal]);
  setMarket(ops, r.market);
  for (const p of r.positions) setPos(ops, p);
  const fc = st.extra.forecasts.find(x => x.marketId === m.id);
  if (fc) fc.outcome = r.market.result ?? payout.indexOf(Math.max(...payout));
}

// ---------------------------------------------------------------- subjects of the season families
function subjects(st: FedState) {
  const pr = st.world.player.region;
  const circuit = (region: number, division: number) => st.plan.circuits.find(c => c.region === region && c.division === division)!;
  const rp = (pr + 5) % 16, rq = (pr + 9) % 16, rs = (pr + 13) % 16;
  const promoDiv = 3 + (st.world.season % 5); // divisions 3..7 rotate by season
  const promoCircuit = circuit(rp, promoDiv);
  const byRating = (ids: string[]) => [...ids].sort((a, b) => rating(st)(b) - rating(st)(a) || a.localeCompare(b));
  return {
    promo: { circuit: promoCircuit, id: byRating(promoCircuit.members)[2] }, // the third seed: a genuine borderline case
    qual: { circuit: circuit(rq, 1), id: byRating(circuit(rq, 1).members)[0] },
    season: { circuit: circuit(rs, 1) },
  };
}
function playedIn(st: FedState, event: string): G[] {
  const out: G[] = [];
  for (const r of st.rounds.values()) {
    if (r.season !== st.world.season) continue;
    for (const [e, w, b, res] of r.abstract) if (e === event && res !== null) out.push({ event: e, white: w, black: b, result: res });
    for (const f of r.fixtures) if (f.event === event && f.result !== null) out.push({ event: f.event, white: f.white, black: f.black, result: f.result });
  }
  return out;
}
const lastLeagueRoundPlayed = (st: FedState) => Math.min(LEAGUE_ROUNDS, [...st.rounds.values()].filter(r => r.season === st.world.season && r.status === 'done').reduce((a, r) => Math.max(a, r.round), 0));

function models(st: FedState, m: Market): number[] {
  const S = st.world.season, seed = hashSeed(st.world.seed, 'model', m.id, st.world.round);
  const from = lastLeagueRoundPlayed(st) + 1;
  const sub = subjects(st);
  switch (m.kind) {
    case 'promotion': { const c = sub.promo.circuit; const p = leagueModel(c.members, playedIn(st, LEAGUE_EVENT(c.region, c.division)), from, LEAGUE_ROUNDS, rating(st), 300, seed).top2.get(String(m.ref!.subject)) ?? 0; return normaliseModel([p, 1 - p], 0.002); }
    case 'season': { const c = sub.season.circuit; const t = leagueModel(c.members, playedIn(st, LEAGUE_EVENT(c.region, c.division)), from, LEAGUE_ROUNDS, rating(st), 300, seed).title; return normaliseModel(c.members.map(x => t.get(x) ?? 0)); }
    case 'qualification': {
      const div1 = st.plan.circuits.filter(c => c.division === 1).map(c => ({ members: c.members, played: playedIn(st, LEAGUE_EVENT(c.region, 1)) }));
      const p = qualificationModel(String(m.ref!.subject), div1, from, LEAGUE_ROUNDS, rating(st), 150, seed);
      return normaliseModel([p, 1 - p], 0.002);
    }
    case 'winner': {
      if (m.ref!.event === 'open') { const sw = st.plan.swiss.find(x => x.event === 'open')!; const w = swissWinnerModel(sw.entrants, sw.seeds, 5, rating(st), 200, seed); return normaliseModel(sw.entrants.map(e => w.get(e) ?? 0)); }
      const ko = st.plan.champ!; const w = bracketChampionModel(ko.stages[0].matches, rating(st), id => ko.seeds[id]); return normaliseModel(ko.qualifiers.map(e => w.get(e) ?? 0));
    }
    default: return m.model!;
  }
  void S;
}

// ---------------------------------------------------------------- lifecycle hooks
/** Season start (round 1 of season S has just been opened). */
export function openSeasonMarkets(ops: MarketOps): void {
  const st = ops.st, S = st.world.season, nm = name(st);
  const sub = subjects(st);
  const open = st.plan.swiss.find(x => x.event === 'open')!;
  const winner = openFamily(ops, { id: `mk:open-winner:${S}`, kind: 'winner', title: `Federation Open S${S} — champion`, outcomes: open.entrants.map(nm), model: open.entrants.map(() => 1 / open.entrants.length), closeRound: SWISS_ROUNDS[0], ref: { event: 'open', season: S, ids: open.entrants.join(',') } });
  if (winner) { const mdl = models(st, winner); setMarket(ops, { ...winner, model: mdl }); }
  const pc = sub.promo.circuit;
  const promo = openFamily(ops, { id: `mk:promo:${S}`, kind: 'promotion', title: `Will ${nm(sub.promo.id)} be promoted from the ${divisionLabel(pc.division)} (${REGION_NAMES[pc.region]})?`, outcomes: ['Yes', 'No'], model: [0.5, 0.5], closeRound: LEAGUE_ROUNDS, ref: { season: S, subject: sub.promo.id, region: pc.region, division: pc.division } });
  if (promo) refreshModel(ops, promo);
  const qual = openFamily(ops, { id: `mk:qual:${S}`, kind: 'qualification', title: `Will ${nm(sub.qual.id)} (${REGION_NAMES[sub.qual.circuit.region]}) qualify for the Crown Championship?`, outcomes: ['Yes', 'No'], model: [0.5, 0.5], closeRound: LEAGUE_ROUNDS, ref: { season: S, subject: sub.qual.id, region: sub.qual.circuit.region } });
  if (qual) refreshModel(ops, qual);
  const sc = sub.season.circuit;
  const season = openFamily(ops, { id: `mk:season:${S}`, kind: 'season', title: `${REGION_NAMES[sc.region]} Crown Division title S${S}`, outcomes: sc.members.map(nm), model: sc.members.map(() => 1 / 16), closeRound: LEAGUE_ROUNDS, ref: { season: S, region: sc.region, division: 1, ids: sc.members.join(',') } });
  if (season) refreshModel(ops, season);
}

function refreshModel(ops: MarketOps, m: Market): Market {
  const mdl = models(ops.st, m);
  const next = { ...m, model: mdl };
  setMarket(ops, next);
  return next;
}

/** Close every open family market whose closing round has started (idempotent). */
export function closeDue(ops: MarketOps, round: number): number {
  let n = 0;
  for (const m of [...ops.st.markets.values()]) {
    if (m.status !== 'open' || !m.ref || m.ref.closeRound === undefined || m.ref.season !== ops.st.world.season) continue;
    if (round >= Number(m.ref.closeRound)) { setMarket(ops, closeMarket(m, ops.now())); n++; }
  }
  return n;
}

/** After round `round` of season `season` has been processed (ctx/plan are the pre-season-rollover objects). */
export function afterRound(ops: MarketOps, season: number, round: number, rec: RoundRecord, games: G[], oldPlan: Ctx['plan'], seasonEnd: { promotions: { id: string }[] } | null): void {
  const st = ops.st, nm = name(st);
  const get = (id: string) => st.markets.get(id);
  // ---- settlements from recorded results
  if (round === SWISS_ROUNDS[SWISS_ROUNDS.length - 1]) {
    const m = get(`mk:open-winner:${season}`);
    if (m) { const sw = oldPlan.swiss.find(x => x.event === 'open')!; const w = swissTable(sw, games)[0].id; settle(ops, m, unitPayout(m.outcomes!.length, String(m.ref!.ids).split(',').indexOf(w)), `Settle ${m.title}: ${nm(w)}`); }
  }
  if (round === LEAGUE_ROUNDS) {
    const q = get(`mk:qual:${season}`);
    if (q && oldPlan.champ) { const yes = oldPlan.champ.qualifiers.includes(String(q.ref!.subject)); settle(ops, q, unitPayout(2, yes ? 0 : 1), `Settle ${q.title}: ${yes ? 'Yes' : 'No'}`); }
    const s = get(`mk:season:${season}`);
    if (s) { const c = oldPlan.circuits.find(x => x.region === Number(s.ref!.region) && x.division === 1)!; const w = leagueTable(c, games)[0].id; settle(ops, s, unitPayout(16, String(s.ref!.ids).split(',').indexOf(w)), `Settle ${s.title}: ${nm(w)}`); }
  }
  if (seasonEnd) {
    const p = get(`mk:promo:${season}`);
    if (p) { const yes = seasonEnd.promotions.some(x => x.id === String(p.ref!.subject)); settle(ops, p, unitPayout(2, yes ? 0 : 1), `Settle ${p.title}: ${yes ? 'Yes' : 'No'}`); }
    const c = get(`mk:champ:${season}`);
    const ko = oldPlan.champ;
    if (c && ko?.champions.length) { const ids = String(c.ref!.ids).split(','); settle(ops, c, ids.map(id => (ko.champions.includes(id) ? 1 / ko.champions.length : 0)), `Settle ${c.title}: ${ko.champions.map(nm).join(' & ')}`); }
    const k = get(`mk:bracket:${season}`);
    if (k && ko?.champions.length) {
      const p4 = String(k.ref!.ids).split(',');
      const semis = ko.stages[2].matches;
      settle(ops, k, bracketPayout(bracketStates(p4), semis[0].winner!, semis[1].winner!, ko.champions), `Settle ${k.title}: ${ko.champions.map(nm).join(' & ')}`);
    }
  }
  // ---- new listings
  const ko = oldPlan.champ;
  const playerIn = (ids: string[]) => ids.includes(PLAYER_ID);
  if (round === LEAGUE_ROUNDS && ko && !playerIn(ko.qualifiers)) {
    const ids = ko.qualifiers;
    const m = openFamily(ops, { id: `mk:champ:${season}`, kind: 'winner', title: `Crown Championship S${season} — champion`, outcomes: ids.map(nm), model: ids.map(() => 1 / 16), closeRound: CHAMPIONSHIP_ROUNDS[0], ref: { event: 'champ', season, ids: ids.join(',') } });
    if (m) refreshModel(ops, m);
  }
  if (round === CHAMPIONSHIP_ROUNDS[1] && ko && !playerIn(ko.qualifiers)) {
    const semis = ko.stages[2].matches;
    if (semis.length === 2) {
      const p4 = [semis[0].a, semis[0].b, semis[1].a, semis[1].b];
      const states = bracketStates(p4);
      const r = rating(st), sd = (id: string) => ko.seeds[id];
      openFamily(ops, { id: `mk:bracket:${season}`, kind: 'bracket', title: `Crown Championship S${season} — final four (conditional claims)`, outcomes: states.map(s => `${nm(s.semi1)} & ${nm(s.semi2)} reach the final; ${nm(s.champion)} wins`), claims: bracketClaims(p4, states, nm), model: bracketModel(p4, states, r, sd), closeRound: CHAMPIONSHIP_ROUNDS[2], ref: { event: 'champ-final-four', season, ids: p4.join(',') } });
    }
  }
  // ---- model refresh + NPC re-trading on open family markets (public results only)
  if (!seasonEnd) {
    for (const m of [...st.markets.values()]) {
      if (m.status !== 'open' || !m.kind || m.kind === 'match' || m.kind === 'sandbox' || m.ref?.season !== season) continue;
      if (m.kind === 'bracket') continue; // listed this round; models do not change before the semifinals
      const next = refreshModel(ops, m);
      const prev = next.history.length > 1 ? next.history[Math.max(0, next.history.length - 2)].prices : undefined;
      npcBatch(ops, next, 'round', next.model!, prev);
    }
  }
  void rec;
}
