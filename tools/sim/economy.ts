/**
 * Long-horizon economy + federation simulation (crown-sim-1) through the REAL FederationService
 * (same commands, ledger validation and atomic commits as the app; fake-indexeddb storage).
 * Shortcuts, stated honestly:
 *  - The player's games are not played on a board: each result is sampled from the Davidson model with the
 *    strategy's assumed player strength vs the opponent's hidden latent strength.
 *  - Featured engine games are replaced by a result sampled the same way from the two latents (moves: []),
 *    because running thousands of 30k-node engine games is too slow for a multi-season sweep.
 * Everything else (pairings, ratings, prizes, sponsors, NPC market making, fees, upkeep, issuance) is the
 * shipped code.  Usage: npx tsx tools/sim/economy.ts [seasons=4] [out=docs/sim/economy-results.json]
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CrownDB } from '../../src/storage/db';
import { FederationService } from '../../src/app/federation';
import { wdl } from '../../src/federation/resultModel';
import { PLAYER_ID, ROUNDS_PER_SEASON } from '../../src/federation/model';
import { MICRO } from '../../src/exchange/ledger';
import { prices, cost } from '../../src/exchange/lmsr';
import { claimPrices, claimsOf } from '../../src/exchange/market';
import { CLUB_LEVELS } from '../../src/economy/economy';
import { rng01, hashSeed } from '../../src/federation/generator';
import type { GameRecord } from '../../src/games/types';

const SEASONS = +(process.argv[2] ?? 4);
const OUT = process.argv[3] ?? 'docs/sim/economy-results.json';

interface Strategy { id: string; label: string; strength: number; trade: 'none' | 'conservative' | 'aggressive'; assets: string[]; challenger: boolean; families?: boolean; magnate?: boolean }
const STRATEGIES: Strategy[] = [
  { id: 'chess-only', label: 'Chess only (1600-strength player, no trading, no assets)', strength: 1600, trade: 'none', assets: [], challenger: true },
  { id: 'successful', label: 'Successful competitor (2100 strength)', strength: 2100, trade: 'none', assets: [], challenger: true },
  { id: 'losing', label: 'Losing player (800 strength)', strength: 800, trade: 'none', assets: [], challenger: true },
  { id: 'conservative-trader', label: 'Conservative trader (1300 strength; 5 shares when model − price ≥ 5 pts)', strength: 1300, trade: 'conservative', assets: [], challenger: false },
  { id: 'aggressive-trader', label: 'Aggressive trader (1300 strength; 60 shares on the largest model edge, every market)', strength: 1300, trade: 'aggressive', assets: [], challenger: false },
  { id: 'hybrid', label: 'Hybrid (1700 strength, conservative trading, Analyst Office)', strength: 1700, trade: 'conservative', assets: ['analyst'], challenger: true },
  { id: 'business', label: 'Business owner (1500 strength; club + scouting + analyst)', strength: 1500, trade: 'none', assets: ['club', 'scouting', 'analyst'], challenger: true },
  { id: 'market-specialist', label: 'Market specialist (1300 strength; conservative match trading + 10 shares on the largest model edge in every season/tournament family market)', strength: 1300, trade: 'conservative', assets: ['analyst'], challenger: false, families: true },
  { id: 'magnate', label: 'Business magnate (1500 strength; club upgraded when affordable, sponsorship contracts on the strongest affordable Crown Division players)', strength: 1500, trade: 'none', assets: ['club'], challenger: true, magnate: true },
];

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
const sample = (a: number, b: number, u: number) => { const p = wdl(a, b); return u < p.w ? 1 : u < p.w + p.d ? 0.5 : 0; };

async function run(s: Strategy, seed: number) {
  const db = await CrownDB.open(new IDBFactory());
  const svc = new FederationService(db, async () => ({ rating: s.strength, rd: 120 }), now);
  // featured games: result from the two hidden latents (see header)
  const latentOf = (id: string) => svc.state!.competitors.get(id)!.latent;
  svc.runSelfplay = async (req) => {
    const fx = svc.featuredFixtures().find(f => hashSeed(svc.state!.world.seed, 'featured', f.id) === req.seed)!;
    const r = sample(latentOf(fx.white), latentOf(fx.black), rng01(hashSeed(req.seed, 'sim'))());
    return { moves: [], result: r === 1 ? '1-0' : r === 0 ? '0-1' : '1/2-1/2', termination: 'simulated' };
  };
  await svc.create(seed % 16, seed);
  const seasons: unknown[] = [];
  let trades = 0, tradeSpent = 0, tradeReceived = 0, gamesW = 0, gamesD = 0, gamesL = 0;
  for (let season = 1; season <= SEASONS; season++) {
    const supply0 = -svc.balance('mint');
    for (let r = 1; r <= ROUNDS_PER_SEASON; r++) {
      const st = svc.state!;
      if (r === 1) for (const a of s.assets) if (!svc.state!.assets.has(a) && svc.balance('player:cash') >= 600 * MICRO) await svc.buyAsset(a).catch(() => {});
      if (r === 1 && s.challenger && st.world.player.division >= 5 && !st.plan.swiss.find(x => x.event === 'challenger')!.entrants.includes(PLAYER_ID)) {
        const cash = svc.balance('player:cash');
        await svc.registerChallenger(cash < 100 * MICRO).catch(() => {});
      }
      // trading on open markets
      if (s.trade !== 'none') {
        for (const f of svc.featuredFixtures()) {
          const m = svc.marketFor(f.id);
          if (!m || m.status !== 'open') continue;
          const p = prices(m.q, m.b), model = [m.forecast.w, m.forecast.d, m.forecast.l];
          const edges = model.map((x, i) => x - p[i]);
          const i = edges.indexOf(Math.max(...edges));
          const shares = s.trade === 'aggressive' ? 60 : edges[i] >= 0.05 ? 5 : 0;
          if (!shares) continue;
          const cashBefore = svc.balance('player:cash');
          try { await svc.trade(m.id, i, shares, 'buy'); trades++; tradeSpent += cashBefore - svc.balance('player:cash'); } catch { /* insufficient cash */ }
        }
      }
      if (s.families) {
        for (const m of [...svc.state!.markets.values()]) {
          if (m.status !== 'open' || !m.kind || m.kind === 'match' || m.kind === 'sandbox' || !m.model) continue;
          const pr = claimPrices(m), claims = claimsOf(m);
          const model = claims.map(c => c.states.reduce((a, x) => a + m.model![x], 0));
          let best = -1, edge = 0.04;
          claims.forEach((_, i) => { if (model[i] - pr[i] > edge) { edge = model[i] - pr[i]; best = i; } });
          if (best < 0) continue;
          const cashBefore = svc.balance('player:cash');
          try { await svc.trade(m.id, best, 10, 'buy'); trades++; tradeSpent += cashBefore - svc.balance('player:cash'); } catch { /* conflict, cash */ }
        }
      }
      if (s.magnate && r === 2) {
        const lv = svc.clubLevelOf();
        if (lv > 0 && lv < 3) { const cost = CLUB_LEVELS[lv].cost; if (svc.balance('player:cash') > cost + 300 * MICRO) await svc.upgradeClub().catch(() => {}); }
        const slots = lv ? CLUB_LEVELS[Math.min(3, svc.clubLevelOf()) - 1].contractSlots : 0;
        if (svc.activeContracts().length < slots) {
          const cands = [...svc.state!.competitors.values()].filter(c => c.status === 'active' && c.division === 1).sort((a, b) => b.rating - a.rating);
          for (const c of cands) { if (svc.activeContracts().length >= slots || svc.balance('player:cash') < 400 * MICRO) break; await svc.signContract(c.id).catch(() => {}); }
        }
      }
      for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) { // knockout follow-up games appear after each result
        const g = await svc.playerGameFor(f.id, { rating: s.strength, rd: 120 });
        const opp = f.white === PLAYER_ID ? f.black : f.white;
        const white = f.white === PLAYER_ID;
        const res = sample(white ? s.strength : latentOf(opp), white ? latentOf(opp) : s.strength, rng01(hashSeed(seed, 'pg', f.id))());
        const mine = white ? res : 1 - res;
        if (mine === 1) gamesW++; else if (mine === 0) gamesL++; else gamesD++;
        await svc.recordPlayerGame({ ...g, result: res === 1 ? '1-0' : res === 0 ? '0-1' : '1/2-1/2', status: 'finalized' } as GameRecord);
      }
      const cashPre = svc.balance('player:cash');
      await svc.advanceRound();
      void cashPre;
    }
    const st = svc.state!;
    const fin = svc.finance();
    const bal = (prefix: string) => [...st.balances].filter(([a]) => a.startsWith(prefix)).reduce((x, [, v]) => x + v, 0);
    const total = [...st.balances.values()].reduce((a, b) => a + b, 0);
    const neg = [...st.balances].filter(([a, v]) => a !== 'mint' && v < 0).length;
    const ratings = [...st.competitors.values()].filter(c => c.status === 'active').map(c => c.rating);
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const latents = [...st.competitors.values()].filter(c => c.status === 'active');
    const corr = (() => { const xs = latents.map(c => c.latent), ys = latents.map(c => c.rating); const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); })();
    const settledMine = [...st.positions.values()].filter(p => p.holder === 'player:cash');
    tradeReceived = settledMine.reduce((a, p) => a + p.received, 0);
    // wealth concentration among competitors (lifetime earnings) and market-maker results on settled markets
    const earn = [...st.competitors.values()].map(c => c.earnings).sort((a, b) => a - b);
    const gini = (() => { const n = earn.length, sum = earn.reduce((a, b) => a + b, 0); if (!sum) return 0; let acc = 0; earn.forEach((x, i) => { acc += (2 * (i + 1) - n - 1) * x; }); return acc / (n * sum); })();
    const top1 = earn.slice(-Math.ceil(earn.length / 100)).reduce((a, b) => a + b, 0) / Math.max(1, earn.reduce((a, b) => a + b, 0));
    const settled = [...st.markets.values()].filter(m => m.status === 'settled' && !m.sandbox);
    // maker P&L per market (crowns, before fees): collected C(q) − C(0) minus the payout-weighted issued shares
    const makerOf = (m: typeof settled[number]) => { const pay = m.payout ?? m.q.map((_, i) => (i === m.result ? 1 : 0)); return cost(m.q, m.b) - cost(m.q.map(() => 0), m.b) - m.q.reduce((a, x, i) => a + x * pay[i], 0); };
    const makerPnl = settled.reduce((a, m) => a + makerOf(m), 0);
    const worstMaker = settled.reduce((a, m) => Math.min(a, makerOf(m)), 0);
    const byKind: Record<string, number> = {};
    for (const m of settled) byKind[m.kind ?? 'match'] = (byKind[m.kind ?? 'match'] ?? 0) + 1;
    const contracts = [...st.contracts.values()];
    seasons.push({
      clubLevel: svc.clubLevelOf(), contractsPaid: contracts.reduce((a, c) => a + c.paid, 0) / MICRO, contractsEarned: contracts.reduce((a, c) => a + c.earned, 0) / MICRO, settledByKind: byKind,
      earningsGini: +gini.toFixed(3), top1pctEarningsShare: +top1.toFixed(3), settledMarkets: settled.length, makerPnlTotal: +makerPnl.toFixed(1), makerWorstMarket: +worstMaker.toFixed(1),
      season, playerDivision: st.world.player.division, cash: fin.cash / MICRO, netWorth: fin.netWorth / MICRO, assets: fin.owned.map(a => a.typeId + (a.suspended ? '(suspended)' : '')),
      titles: st.world.player.titles.filter(t => t.season === season).map(t => t.title),
      moneySupply: -svc.balance('mint') / MICRO, circulating: (-svc.balance('mint') - svc.balance('sink')) / MICRO, sink: svc.balance('sink') / MICRO, issuedThisSeason: (-svc.balance('mint') - supply0) / MICRO, treasury: svc.balance('treasury') / MICRO, fees: svc.balance('fees') / MICRO,
      npcWallets: bal('npc:') / MICRO, competitorAccounts: bal('comp:') / MICRO, escrow: (bal('prize:') + bal('sponsor:')) / MICRO,
      conserved: total === 0, negativeAccounts: neg, ratingMean: +mean.toFixed(1), latentRatingCorr: +corr.toFixed(3),
      active: latents.length, retired: [...st.competitors.values()].filter(c => c.status === 'retired').length,
    });
    console.log(s.id, JSON.stringify(seasons[seasons.length - 1]));
  }
  db.close();
  return { strategy: s.id, label: s.label, seasons, trades, tradeSpent: tradeSpent / MICRO, tradeReceived: tradeReceived / MICRO, record: { w: gamesW, d: gamesD, l: gamesL } };
}

const results = [];
const t0 = Date.now();
const only = process.argv[4]?.split(',');
const SEEDS = (process.argv[5] ?? '1000').split(',').map(Number);
for (const [i, s] of STRATEGIES.entries()) if (!only || only.includes(s.id)) for (const sd of SEEDS) results.push({ seed: sd + i * 17, ...(await run(s, sd + i * 17)) });
mkdirSync('docs/sim', { recursive: true });
writeFileSync(OUT, JSON.stringify({ id: 'crown-sim-2', seasons: SEASONS, seeds: SEEDS, generatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), results }, null, 1));
console.log('wrote', OUT, Math.round((Date.now() - t0) / 1000), 's');
