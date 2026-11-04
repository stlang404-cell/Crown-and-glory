/**
 * Wealth-loop simulation (crown-wealth-sim-1, v0.11) through the REAL FederationService: same commands, ledger
 * validation, prize payouts, NPC market making, club dues, upkeep, administration and recovery as the app.
 * Shortcuts, stated honestly (as in tools/sim/economy.ts):
 *  - the player's games are not played on a board: each result is sampled from the Davidson model with the
 *    archetype's assumed playing strength vs the opponent's hidden latent strength;
 *  - featured engine games are replaced by a result sampled the same way from the two latents (no moves);
 *  - storage is an in-memory stub instead of IndexedDB (the service keeps its whole state in memory and the
 *    database only receives the commit; `--check-idb` runs one season both ways and compares every balance);
 *  - archetypes are scripted decision rules, not a human.
 * Usage: npx tsx tools/sim/wealth.ts <seasons> <out.json> <regions:16|80> <seeds,comma> [archetypes,comma] [--check-idb]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { FederationService } from '../../src/app/federation';
import { wdl } from '../../src/federation/resultModel';
import { PLAYER_ID, ROUNDS_PER_SEASON, TOPOLOGY_V1, TOPOLOGY_V3, populationOf } from '../../src/federation/model';
import { swissEventFor } from '../../src/federation/world';
import { MICRO, type Journal } from '../../src/exchange/ledger';
import { prices } from '../../src/exchange/lmsr';
import { claimPrices, claimsOf } from '../../src/exchange/market';
import { CLUB_LEVELS, RECOVERY_THRESHOLD } from '../../src/economy/economy';
import { FACILITIES, ESTATES, SPONSOR_TIERS, type FacilityId } from '../../src/economy/wealth';
import { COSMETICS } from '../../src/economy/cosmetics';
import { lifetimeStats } from '../../src/economy/stats';
import { rng01, hashSeed } from '../../src/federation/generator';
import type { GameRecord } from '../../src/games/types';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SEASONS = +(args[0] ?? 24);
const OUT = args[1] ?? 'docs/sim/wealth/out.json';
const REGIONS = +(args[2] ?? 16);
const SEEDS = (args[3] ?? '101').split(',').map(Number);
const ONLY = args[4] ? args[4].split(',') : null;
const CHECK_IDB = process.argv.includes('--check-idb');
const TOPO = REGIONS === 80 ? TOPOLOGY_V3 : TOPOLOGY_V1;

interface Archetype { id: string; label: string; strength: number }
const ARCHETYPES: Archetype[] = [
  { id: 'chess-only', label: 'Chess only: enters its Swiss event every season, buys nothing', strength: 1600 },
  { id: 'club-owner', label: 'Club owner: club, Tournament Venue upgrade, Members\' Lounge and Spectator Gallery when affordable (keeps $300 spare)', strength: 1600 },
  { id: 'sponsor', label: 'Sponsor: sponsors its own league circuit (largest tier leaving $300) and its Swiss event (Supporter) every season', strength: 1600 },
  { id: 'trader', label: 'Trader: Analyst Office; 10 shares on any claim whose model edge is ≥ 4 points, in every listed market', strength: 1600 },
  { id: 'magnate', label: 'Magnate: club to Federation Club, all facilities, contracts on its region\'s top players, estates and Title sponsorships when rich', strength: 1600 },
  { id: 'reckless', label: 'Reckless spender: every tool and cosmetic, estates whenever affordable, 60 shares on every match market; takes the recovery loan', strength: 1600 },
  { id: 'chess-weak', label: 'Chess only, weaker player (1200)', strength: 1200 },
  { id: 'chess-strong', label: 'Chess only, stronger player (2000)', strength: 2000 },
];

const sample = (a: number, b: number, u: number) => { const p = wdl(a, b); return u < p.w ? 1 : u < p.w + p.d ? 0.5 : 0; };
const cls = (a: string) => a === 'player:cash' ? 'player' : a.startsWith('comp:') ? 'competitors' : a.startsWith('prize:') ? 'prize escrow' : a.startsWith('sponsor:') ? 'sponsor budget' : a.startsWith('npc:') ? 'NPC traders' : a.startsWith('club:') ? 'AI clubs' : a.startsWith('asset:') ? 'player deposits' : a.startsWith('sponsorship:') ? 'sponsorship escrow' : a.startsWith('mk') || a.startsWith('market') ? 'markets' : a;

function memDb(onJournal: (j: Journal) => void) {
  return { loadAll: async () => [], allGames: async () => [], getGame: async () => undefined,
    commit: async (writes: { store: string; put?: unknown[] }[]) => { for (const w of writes) if (w.store === 'journal') for (const j of w.put ?? []) onJournal(j as Journal); } } as never;
}

async function run(a: Archetype, seed: number, regions: number) {
  let clock = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
  const playerJournals: Journal[] = [];
  const flows = new Map<string, Map<string, number>>(); // kind → class → signed total (all seasons)
  const seasonFlow = { minted: 0, sunk: 0 };
  const onJournal = (j: Journal) => {
    if (j.lines.some(l => l.account === 'player:cash')) playerJournals.push(j);
    const m = flows.get(j.kind) ?? new Map<string, number>();
    for (const l of j.lines) { m.set(cls(l.account), (m.get(cls(l.account)) ?? 0) + l.amount); if (l.account === 'mint') seasonFlow.minted -= l.amount; if (l.account === 'sink') seasonFlow.sunk += l.amount; }
    flows.set(j.kind, m);
  };
  const svc = new FederationService(memDb(onJournal), async () => ({ rating: a.strength, rd: 120 }), now);
  const latentOf = (id: string) => svc.state!.competitors.get(id)!.latent;
  svc.runSelfplay = async req => {
    const fx = svc.featuredFixtures().find(f => hashSeed(svc.state!.world.seed, 'featured', f.id) === req.seed)!;
    const r = sample(latentOf(fx.white), latentOf(fx.black), rng01(hashSeed(req.seed, 'sim'))());
    return { moves: [], result: r === 1 ? '1-0' : r === 0 ? '0-1' : '1/2-1/2', termination: 'simulated' };
  };
  const topo = regions === 80 ? TOPOLOGY_V3 : TOPOLOGY_V1;
  await svc.create(seed % topo.regions, seed, topo);
  const pop = populationOf(topo);
  const cash = () => svc.balance('player:cash');
  const D = (x: number) => x * MICRO;
  const tryDo = async (fn: () => Promise<unknown>) => { try { await fn(); return true; } catch { return false; } };
  const seasons: Record<string, unknown>[] = [];
  let trades = 0;
  const circ0 = { v: 0 };
  for (let season = 1; season <= SEASONS; season++) {
    seasonFlow.minted = 0; seasonFlow.sunk = 0;
    let minCash = Infinity;
    for (let r = 1; r <= ROUNDS_PER_SEASON; r++) {
      const st = svc.state!;
      const admin = svc.inAdministration();
      if (admin && !svc.wealthState().loan && !svc.wealthState().admin?.loanTaken && cash() < D(100)) await tryDo(() => svc.takeRecoveryLoan());
      if (r === 1) {
        const ev = swissEventFor(st.world.player.division);
        const sw = ev ? st.plan.swiss.find(x => x.event === ev) : null;
        if (sw && !sw.entrants.includes(PLAYER_ID) && a.id !== 'trader') await tryDo(() => svc.registerChallenger(cash() < RECOVERY_THRESHOLD && !st.extra.vouchers.includes(st.world.season)));
        const league = `league:${st.world.player.region}:${st.world.player.division}`;
        if (!admin) {
          if (a.id === 'club-owner' || a.id === 'magnate') {
            if (!svc.state!.assets.has('club') && cash() >= D(600)) await tryDo(() => svc.buyAsset('club'));
            const top = a.id === 'magnate' ? 3 : 2;
            const lv = svc.clubLevelOf();
            if (lv > 0 && lv < top && cash() >= CLUB_LEVELS[lv].cost + D(300)) await tryDo(() => svc.upgradeClub());
            const facs: FacilityId[] = a.id === 'magnate' ? ['lounge', 'gallery', 'library'] : ['lounge', 'gallery'];
            for (const f of facs) { const F = FACILITIES.find(x => x.id === f)!; if (svc.clubLevelOf() && !svc.wealthState().facilities.some(x => x.id === f) && cash() >= F.cost + D(300)) await tryDo(() => svc.buildFacility(f)); }
          }
          if (a.id === 'magnate') {
            const slots = svc.clubLevelOf() ? CLUB_LEVELS[svc.clubLevelOf() - 1].contractSlots : 0;
            const cands = [...svc.state!.competitors.values()].filter(c => c.status === 'active' && c.region === st.world.player.region).sort((x, y) => y.rating - x.rating);
            for (const c of cands) { if (svc.activeContracts().length >= slots || cash() < D(800)) break; await tryDo(() => svc.signContract(c.id)); }
            for (const e of ESTATES) if (!svc.wealthState().estates.some(x => x.id === e.id) && cash() >= e.price + D(1_500)) await tryDo(() => svc.buyEstate(e.id));
            if (cash() >= D(2_000)) await tryDo(() => svc.sponsorEvent(league, 'title'));
          }
          if (a.id === 'sponsor') {
            const tier = [...SPONSOR_TIERS].reverse().find(t => cash() - t.stake >= D(300));
            if (tier) await tryDo(() => svc.sponsorEvent(league, tier.id));
            if (ev && cash() >= D(400)) await tryDo(() => svc.sponsorEvent(ev, 'supporter'));
          }
          if (a.id === 'trader' && !svc.state!.assets.has('analyst') && cash() >= D(600)) await tryDo(() => svc.buyAsset('analyst'));
          if (a.id === 'reckless') {
            for (const t of ['club', 'analyst', 'scouting', 'training']) if (!svc.state!.assets.has(t) && cash() >= D(200)) await tryDo(() => svc.buyAsset(t));
            for (const c of COSMETICS) if (c.price && cash() >= c.price) await tryDo(() => svc.buyCosmetic(c.id));
            for (const e of ESTATES) if (!svc.wealthState().estates.some(x => x.id === e.id) && cash() >= e.price) await tryDo(() => svc.buyEstate(e.id));
          }
        }
      }
      if (a.id === 'reckless') {
        for (const f of svc.featuredFixtures()) {
          const m = svc.marketFor(f.id);
          if (!m || m.status !== 'open') continue;
          const p = prices(m.q, m.b), model = [m.forecast.w, m.forecast.d, m.forecast.l];
          const edges = model.map((x, i) => x - p[i]);
          const i = edges.indexOf(Math.max(...edges));
          if (await tryDo(() => svc.trade(m.id, i, svc.inAdministration() ? 20 : 60, 'buy'))) trades++;
        }
      }
      if (a.id === 'trader') {
        for (const m of [...svc.state!.markets.values()]) {
          if (m.status !== 'open' || m.sandbox) continue;
          const pr = m.kind && m.kind !== 'match' && m.model ? claimPrices(m) : prices(m.q, m.b);
          const model = m.kind && m.kind !== 'match' && m.model ? claimsOf(m).map(c => c.states.reduce((s, x) => s + m.model![x], 0)) : [m.forecast.w, m.forecast.d, m.forecast.l];
          let best = -1, edge = 0.04;
          model.forEach((x, i) => { if (x - pr[i] > edge) { edge = x - pr[i]; best = i; } });
          if (best >= 0 && await tryDo(() => svc.trade(m.id, best, 10, 'buy'))) trades++;
        }
      }
      for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) {
        const g = await svc.playerGameFor(f.id, { rating: a.strength, rd: 120 });
        const opp = f.white === PLAYER_ID ? f.black : f.white;
        const white = f.white === PLAYER_ID;
        const res = sample(white ? a.strength : latentOf(opp), white ? latentOf(opp) : a.strength, rng01(hashSeed(seed, 'pg', f.id))());
        await svc.recordPlayerGame({ ...g, result: res === 1 ? '1-0' : res === 0 ? '0-1' : '1/2-1/2', status: 'finalized' } as GameRecord);
      }
      await svc.advanceRound();
      minCash = Math.min(minCash, cash());
    }
    const st = svc.state!;
    const fin = svc.finance();
    const bal = (prefix: string) => [...st.balances].filter(([k]) => k.startsWith(prefix)).reduce((x, [, v]) => x + v, 0);
    const total = [...st.balances.values()].reduce((x, y) => x + y, 0);
    const neg = [...st.balances].filter(([k, v]) => k !== 'mint' && v < 0).length;
    const circulating = -svc.balance('mint') - svc.balance('sink');
    const active = [...st.competitors.values()].filter(c => c.status === 'active');
    const w = svc.wealthState();
    seasons.push({
      season, division: st.world.player.division, cash: fin.cash / MICRO, netWorth: fin.netWorth / MICRO, liabilities: fin.liabilities / MICRO, minCash: minCash / MICRO,
      inAdministration: !!w.admin, reputation: w.reputation, clubLevel: svc.clubLevelOf(), facilities: w.facilities.length, estates: w.estates.length,
      mintedThisSeason: seasonFlow.minted / MICRO, sunkThisSeason: seasonFlow.sunk / MICRO, circulating: circulating / MICRO, circulatingPerCompetitor: +(circulating / MICRO / pop).toFixed(3),
      circulatingGrowth: circ0.v ? +((circulating - circ0.v) / circ0.v).toFixed(4) : null,
      treasury: svc.balance('treasury') / MICRO, competitorAccounts: bal('comp:') / MICRO, meanCompetitorBalance: +(bal('comp:') / MICRO / active.length).toFixed(3), npcWallets: bal('npc:') / MICRO, aiClubs: bal('club:') / MICRO,
      conserved: total === 0, negativeAccounts: neg,
    });
    circ0.v = circulating;
  }
  const w = svc.wealthState();
  const episodes = [...w.episodes, ...(w.admin ? [w.admin] : [])];
  const stats = lifetimeStats(playerJournals, svc.state!.finance.points, episodes);
  const flowOut: Record<string, Record<string, number>> = {};
  for (const [k, m] of flows) flowOut[k] = Object.fromEntries([...m].map(([c, v]) => [c, +(v / MICRO / SEASONS).toFixed(2)]));
  // exact check: lifetime cash net from the ledger equals the final cash balance
  const exact = stats.cashNet === svc.balance('player:cash');
  return {
    archetype: a.id, label: a.label, strength: a.strength, seed, regions, population: pop, seasons,
    final: { netWorth: svc.finance().netWorth / MICRO, cash: svc.balance('player:cash') / MICRO, division: svc.state!.world.player.division, titles: svc.state!.world.player.titles.length },
    lifetime: { earnings: stats.earnings / MICRO, expenses: stats.expenses / MICRO, exchangeNet: stats.exchangeNet / MICRO, capitalNet: stats.capitalNet / MICRO, financingNet: stats.financingNet / MICRO, byCategory: stats.byCategory.map(c => ({ ...c, inflow: c.inflow / MICRO, outflow: c.outflow / MICRO, net: c.net / MICRO })), milestones: stats.milestones.map(m => m.id), ledgerExact: exact },
    administration: { episodes: episodes.map(e => ({ since: e.since, until: e.until, reason: e.reason, liquidated: e.liquidated, loan: e.loanTaken })) },
    sponsorships: w.sponsorships.filter(s => s.status === 'settled').map(s => ({ season: s.season, event: s.event, stake: s.stake / MICRO, ret: (s.ret ?? 0) / MICRO, multiplier: s.multiplier })),
    trades, flowsPerSeason: flowOut,
  };
}

async function checkIdb() {
  // the same seed, archetype and one season through fake IndexedDB and through the in-memory stub: every balance equal
  const auto = 'fake-indexeddb/auto'; await import(auto); // installs the IndexedDB globals
  const { IDBFactory } = await import('fake-indexeddb');
  const { CrownDB } = await import('../../src/storage/db');
  const go = async (db: unknown) => {
    let clock = 0;
    const svc = new FederationService(db as never, async () => ({ rating: 1600, rd: 120 }), () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString());
    const latentOf = (id: string) => svc.state!.competitors.get(id)!.latent;
    svc.runSelfplay = async req => { const fx = svc.featuredFixtures().find(f => hashSeed(svc.state!.world.seed, 'featured', f.id) === req.seed)!; const r = sample(latentOf(fx.white), latentOf(fx.black), rng01(hashSeed(req.seed, 'sim'))()); return { moves: [], result: r === 1 ? '1-0' : r === 0 ? '0-1' : '1/2-1/2', termination: 'simulated' }; };
    await svc.create(5, 101, TOPO);
    await svc.buyAsset('club');
    for (let r = 0; r < ROUNDS_PER_SEASON; r++) {
      for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) { const g = await svc.playerGameFor(f.id, { rating: 1600, rd: 120 }); const opp = f.white === PLAYER_ID ? f.black : f.white; const wt = f.white === PLAYER_ID; const res = sample(wt ? 1600 : latentOf(opp), wt ? latentOf(opp) : 1600, rng01(hashSeed(101, 'pg', f.id))()); await svc.recordPlayerGame({ ...g, result: res === 1 ? '1-0' : res === 0 ? '0-1' : '1/2-1/2', status: 'finalized' } as GameRecord); }
      await svc.advanceRound();
    }
    return new Map(svc.state!.balances);
  };
  const a = await go(await CrownDB.open(new IDBFactory()));
  const b = await go(memDb(() => {}));
  const diff = [...new Set([...a.keys(), ...b.keys()])].filter(k => (a.get(k) ?? 0) !== (b.get(k) ?? 0));
  console.log(`check-idb: ${a.size} accounts, ${diff.length} differ`, diff.slice(0, 5));
  if (diff.length) process.exit(1);
}

if (CHECK_IDB) await checkIdb();
const t0 = Date.now();
const results = [];
for (const a of ARCHETYPES) {
  if (ONLY && !ONLY.includes(a.id)) continue;
  for (const sd of SEEDS) {
    const t = Date.now();
    const r = await run(a, sd, REGIONS);
    results.push(r);
    console.log(`${a.id} seed ${sd} regions ${REGIONS}: net worth ${r.final.netWorth.toFixed(0)} admin ${r.administration.episodes.length} (${Math.round((Date.now() - t) / 1000)} s)`);
  }
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ id: 'crown-wealth-sim-1', seasons: SEASONS, regions: REGIONS, seeds: SEEDS, generatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), results }, null, 1));
console.log('wrote', OUT, Math.round((Date.now() - t0) / 1000), 's');
