/**
 * Monte Carlo market simulation (crown-market-sim-1). Every trader here is SIMULATED and reads PUBLIC information only
 * (public ratings and RDs → crown-odds-2 / crown-length-1, and current prices), except the clearly labelled
 * "Oracle (benchmark, impossible in game)" that reads hidden strength to show what an informational edge is worth.
 *
 *   npx tsx tools/market/simulate.ts [seeds=5] [out=docs/sim/market-sim-crown-market-sim-1.json]
 *
 * Events: the 800 HELD-OUT federation-style engine games of tools/odds/data (FNV-1a(id) mod 4 = 0; never used to fit
 * crown-odds-2 or crown-length-1). Each game lists the two v0.10 match markets exactly as the federation does — W/D/B
 * with the Decisive claim (b = 120) and Over/Under X.5 plies (b = 60) — and they settle on the game's REAL result and
 * REAL ply count. Markets go through the production code: openMarket/openGenericMarket, trade(), settleMarket(), the
 * double-entry Books (integer µ, every journal validated).
 *
 * Per game: (1) the agent population trades in a seeded random order for three passes (skilled, mediocre, contrarian,
 * noisy; wallets start at $10,000 and persist across games); (2) each PLAYER STRATEGY is evaluated on its own copy of
 * that market (no interference between strategies), then settled. Seeds replicate the agents' randomness.
 * A second population ("shipped roster") runs the game's own NPC_TRADERS through npcTrade('pre').
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Books, MICRO } from '../../src/exchange/ledger';
import { Market, Position, openMarket, openGenericMarket, trade, closeMarket, settleMarket, claimsOf, claimPrices, acct, MATCH_CLAIMS, quote } from '../../src/exchange/market';
import { feeMicro, buyClaimMicro } from '../../src/exchange/lmsr';
import { sharesToClaimTarget, npcTrade, NPC_TRADERS } from '../../src/exchange/npc';
import { pregameWdl, liveModelVector } from '../../src/exchange/odds';
import { pOver, lengthLine } from '../../src/exchange/length';
import { hashSeed, normal, rng01 } from '../../src/federation/generator';

interface Side { rating: number; rd: number; latent: number }
interface Game { id: string; white: Side; black: Side; result: string; termination: string; plies: number; evals: number[]; material: number[][] }
const SEEDS = Number(process.argv[2] ?? 5), OUT = process.argv[3] ?? 'docs/sim/market-sim-crown-market-sim-1.json';
// --legacy-analyst: re-run with the v0.9 analyst (noisy one-claim value trader, no in-play role) for the bug #33 comparison
const LEGACY = process.argv.includes('--legacy-analyst');
if (LEGACY) Object.assign(NPC_TRADERS.find(t => t.id === 'npc:analyst')!, { noise: 0.03, margin: 0.02, strategy: 'value', roles: ['pre', 'round'] });
const DIR = 'tools/odds/data';
const fnv = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const games: Game[] = readdirSync(DIR).filter(f => f.endsWith('.json')).sort().flatMap(f => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Game[])
  .filter(g => fnv(g.id) % 4 === 0 && g.termination !== 'playing-limit');
const resultState = (g: Game) => (g.result === '1-0' ? 0 : g.result === '0-1' ? 2 : 1);

// ---------------------------------------------------------------- simulated agents (public information only)
interface Agent { id: string; label: string; belief: (pub: number[], r: () => number, prices: number[]) => number[]; margin: number; budgetShare: number }
const normv = (v: number[]) => { const s = v.reduce((a, x) => a + x, 0); return v.map(x => x / s); };
const AGENTS: Agent[] = [
  { id: 'sim:skilled', label: 'Skilled (public model, calibrated)', belief: pub => pub, margin: 0.02, budgetShare: 0.02 },
  { id: 'sim:mediocre', label: 'Mediocre (public model + noise σ = 0.06)', belief: (pub, r) => normv(pub.map(p => Math.max(0.01, p + 0.06 * normal(r)))), margin: 0.02, budgetShare: 0.02 },
  { id: 'sim:contrarian', label: 'Contrarian (adds 8 points to the cheapest state)', belief: (pub, _r, pr) => { const k = pr.indexOf(Math.min(...pr)); return normv(pub.map((p, i) => (i === k ? p + 0.08 : p))); }, margin: 0.01, budgetShare: 0.02 },
  { id: 'sim:noisy', label: 'Noisy (random beliefs, no model)', belief: (pub, r) => normv(pub.map(() => 0.05 + r())), margin: 0, budgetShare: 0.01 },
];
const START = 10_000 * MICRO;

/** Value trade toward belief − margin on the single best state claim (same rule as the shipped NPC value traders). */
function valueTrade(m: Market, pos: Position | null, holder: string, beliefStates: number[], margin: number, limit: number, seq: number, singletons: number[]) {
  const pr = claimPrices(m);
  let pick = -1, best = 0;
  for (const c of singletons) { const s = claimsOf(m)[c].states; const b = s.reduce((a, x) => a + beliefStates[x], 0); const e = b - pr[c] - margin; if (e > best) { best = e; pick = c; } }
  if (pick < 0) return null;
  const S = claimsOf(m)[pick].states;
  const target = Math.min(0.97, S.reduce((a, x) => a + beliefStates[x], 0) - margin);
  let k = Math.floor(sharesToClaimTarget(m.q, m.b, S, target));
  const costOf = (n: number) => { const c = buyClaimMicro(m.q, m.b, S, n); return c + feeMicro(c); };
  while (k > 0 && costOf(k) > limit) k = Math.floor(k / 2);
  if (k <= 0) return null;
  return trade(m, pos, holder, pick, k, 'buy', 'T', seq);
}

// ---------------------------------------------------------------- player strategies (each on its own market copy)
type Ctx = { m: Market; pub: number[]; truth: number[]; budget: number; singletons: number[]; kind: 'match' | 'length' };
interface Strategy { id: string; label: string; legit: boolean; run: (c: Ctx) => { m: Market; pos: Position | null; fees: number } }
function buyUpTo(m: Market, pos: Position | null, c: number, budget: number, seq: number) {
  let k = 1;
  while (quote(m, c, k * 2, 'buy').total <= budget && k < 5000) k *= 2;
  while (k > 0 && quote(m, c, k, 'buy').total > budget) k--;
  return k > 0 ? trade(m, pos, 'player', c, k, 'buy', 'T', seq) : null;
}
const STRATS: Strategy[] = [
  { id: 'favourite', label: 'Always back the favourite (budget $50)', legit: true, run: c => { const pr = claimPrices(c.m); const i = c.singletons.reduce((a, j) => (pr[j] > pr[a] ? j : a), c.singletons[0]); const t = buyUpTo(c.m, null, i, c.budget, 9001); return t ? { m: t.market, pos: t.position, fees: t.quote.fee } : { m: c.m, pos: null, fees: 0 }; } },
  { id: 'longshot', label: 'Always back the longshot (budget $50)', legit: true, run: c => { const pr = claimPrices(c.m); const i = c.singletons.reduce((a, j) => (pr[j] < pr[a] ? j : a), c.singletons[0]); const t = buyUpTo(c.m, null, i, c.budget, 9001); return t ? { m: t.market, pos: t.position, fees: t.quote.fee } : { m: c.m, pos: null, fees: 0 }; } },
  { id: 'complete-set', label: 'Buy one of every outcome (complete set, 20 each)', legit: true, run: c => { let m = c.m, pos: Position | null = null, fees = 0; for (const i of c.singletons) { const t = trade(m, pos, 'player', i, 20, 'buy', 'T', 9001 + i); m = t.market; pos = t.position; fees += t.quote.fee; } return { m, pos, fees }; } },
  { id: 'scalper', label: 'Round-trip scalper (buy then sell 30 shares, 5 times)', legit: true, run: c => { let m = c.m, pos: Position | null = null, fees = 0; for (let k = 0; k < 5; k++) { const i = c.singletons[k % c.singletons.length]; const a = trade(m, pos, 'player', i, 30, 'buy', 'T', 9001 + 2 * k); const s = trade(a.market, a.position, 'player', i, 30, 'sell', 'T', 9002 + 2 * k); m = s.market; pos = s.position; fees += a.quote.fee + s.quote.fee; } return { m, pos, fees }; } },
  { id: 'decisive-arb', label: 'Decisive vs White + Black "arbitrage" (buy the cheaper side of the identity)', legit: true, run: c => { if (c.kind !== 'match') return { m: c.m, pos: null, fees: 0 }; const pr = claimPrices(c.m); const viaPair = quote(c.m, 0, 10, 'buy').total + quote(c.m, 2, 10, 'buy').total; const direct = quote(c.m, 3, 10, 'buy').total; if (direct <= viaPair) { const t = trade(c.m, null, 'player', 3, 10, 'buy', 'T', 9001); const s = trade(t.market, t.position, 'player', 1, 10, 'buy', 'T', 9002); void pr; return { m: s.market, pos: s.position, fees: t.quote.fee + s.quote.fee }; } let m = c.m, pos: Position | null = null, fees = 0; for (const i of [0, 1, 2]) { const t = trade(m, pos, 'player', i, 10, 'buy', 'T', 9001 + i); m = t.market; pos = t.position; fees += t.quote.fee; } return { m, pos, fees }; } },
  { id: 'model-edge', label: 'Public-model edge (buy where the public forecast exceeds the price by > 3 points, budget $50)', legit: true, run: c => { const t = valueTrade(c.m, null, 'player', c.pub, 0.03, c.budget, 9001, c.singletons); return t ? { m: t.market, pos: t.position, fees: t.quote.fee } : { m: c.m, pos: null, fees: 0 }; } },
  { id: 'oracle', label: 'Oracle (benchmark, impossible in game: reads hidden strength; budget $50)', legit: false, run: c => { const t = valueTrade(c.m, null, 'player', c.truth, 0.03, c.budget, 9001, c.singletons); return t ? { m: t.market, pos: t.position, fees: t.quote.fee } : { m: c.m, pos: null, fees: 0 }; } },
];

/** In-play strategies, one trade per published-move window (after plies 10/20/40/60), each held to settlement. */
const INPLAY: Strategy[] = [
  { id: 'live-model-edge', label: 'In play: buy where the published live forecast beats the price by > 3 points (budget $50 per window)', legit: true, run: STRATS.find(s => s.id === 'model-edge')!.run },
  { id: 'live-favourite', label: 'In play: back the current favourite (budget $50 per window)', legit: true, run: STRATS.find(s => s.id === 'favourite')!.run },
];

// ---------------------------------------------------------------- run
const pubW = (g: Game) => { const p = pregameWdl({ rating: g.white.rating, rd: g.white.rd }, { rating: g.black.rating, rd: g.black.rd }); return [p.w, p.d, p.l]; };
const truthW = (g: Game) => { const p = pregameWdl({ rating: g.white.latent, rd: 0 }, { rating: g.black.latent, rd: 0 }); return [p.w, p.d, p.l]; };
interface Acc { n: number; sum: number; sum2: number; fees: number; traded: number }
const acc = (): Acc => ({ n: 0, sum: 0, sum2: 0, fees: 0, traded: 0 });
const add = (a: Acc, x: number, fees: number, traded: boolean) => { a.n++; a.sum += x; a.sum2 += x * x; a.fees += fees; if (traded) a.traded++; };
const summ = (a: Acc) => { const mean = a.sum / Math.max(1, a.n); const sd = Math.sqrt(Math.max(0, a.sum2 / Math.max(1, a.n) - mean * mean)); return { markets: a.n, traded: a.traded, meanPnl: +(mean / MICRO).toFixed(4), ci95: [+((mean - 1.96 * sd / Math.sqrt(Math.max(1, a.n))) / MICRO).toFixed(4), +((mean + 1.96 * sd / Math.sqrt(Math.max(1, a.n))) / MICRO).toFixed(4)], meanFees: +(a.fees / Math.max(1, a.n) / MICRO).toFixed(4) }; };
const gini = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), n = s.length, tot = s.reduce((a, x) => a + x, 0); if (!tot) return 0; let g = 0; s.forEach((x, i) => { g += (2 * (i + 1) - n - 1) * x; }); return g / (n * tot); };

function runPopulation(pop: 'agents' | 'roster') {
  const strat = Object.fromEntries(['match', 'length'].map(k => [k, Object.fromEntries(STRATS.map(s => [s.id, acc()]))])) as Record<string, Record<string, Acc>>;
  const calib = { match: Array.from({ length: 10 }, () => ({ n: 0, sp: 0, sy: 0 })), length: Array.from({ length: 10 }, () => ({ n: 0, sp: 0, sy: 0 })) };
  const brier = { match: { close: 0, open: 0, model: 0, truth: 0, n: 0 }, length: { close: 0, open: 0, model: 0, n: 0 } };
  const maker = { match: { loss: 0, worst: 0, subsidy: 0, n: 0, fees: 0 }, length: { loss: 0, worst: 0, subsidy: 0, n: 0, fees: 0 } };
  const finalWealth: Record<string, number[]> = {};
  const inplay = Object.fromEntries(INPLAY.map(s => [s.id, acc()]));
  for (let seed = 1; seed <= SEEDS; seed++) {
    const books = new Books();
    books.post({ id: 'genesis', at: 'T', kind: 'mint', memo: '', lines: [{ account: 'mint', amount: -(1e9 * MICRO) }, { account: 'treasury', amount: 1e9 * MICRO }] });
    const ids = pop === 'agents' ? AGENTS.map(a => a.id) : NPC_TRADERS.map(t => t.id);
    for (const id of [...ids, 'player']) books.post({ id: `fund:${id}`, at: 'T', kind: 'grant', memo: '', lines: [{ account: 'treasury', amount: -START }, { account: id, amount: START }] });
    const r = rng01(hashSeed(seed, pop));
    games.forEach((g, gi) => {
      const pub = pubW(g), truth = truthW(g), y = resultState(g);
      const line = lengthLine(g.white, g.black), po = pOver(g.white, g.black, line), yl = g.plies > line ? 0 : 1;
      const specs: { kind: 'match' | 'length'; open: () => { market: Market; journal: Parameters<Books['post']>[0] }; pub: number[]; truth: number[]; y: number; singletons: number[] }[] = [
        { kind: 'match', open: () => openMarket({ id: `m${seed}:${gi}`, sandbox: false, fixtureId: g.id, title: g.id, white: 'w', black: 'b', season: 1, round: 1, b: 120, forecast: { w: pub[0], d: pub[1], l: pub[2], source: 'crown-odds-2' }, at: 'T', claims: MATCH_CLAIMS }), pub, truth, y, singletons: [0, 1, 2] },
        // the length market has no hidden-strength truth beyond its own public model: the oracle uses the same model there
        { kind: 'length', open: () => openGenericMarket({ id: `l${seed}:${gi}`, kind: 'length', sandbox: false, title: g.id, outcomes: ['Over', 'Under'], model: [po, 1 - po], rules: 'r', season: 1, round: 1, b: 60, at: 'T' }), pub: [po, 1 - po], truth: [po, 1 - po], y: yl, singletons: [0, 1] },
      ];
      for (const sp of specs) {
        const { market, journal } = sp.open();
        books.post(journal);
        let m = market;
        const pos = new Map<string, Position>();
        let seq = 1;
        if (pop === 'agents') {
          for (let pass = 0; pass < 3; pass++) {
            const order = AGENTS.map(a => [r(), a] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
            for (const a of order) {
              const bel = a.belief(sp.pub, r, claimPrices(m).slice(0, sp.singletons.length));
              const wallet = books.balance(a.id);
              const t = valueTrade(m, pos.get(a.id) ?? null, a.id, bel, a.margin, Math.floor(wallet * a.budgetShare), seq, sp.singletons);
              if (!t) continue;
              books.post(t.journal); m = t.market; pos.set(a.id, t.position); seq++;
            }
          }
        } else {
          const res = npcTrade({ ...m, model: sp.pub }, new Map(), a => books.balance(a), seed * 7919 + gi, 'T', 1, { role: 'pre', belief: sp.pub });
          for (const j of res.journals) books.post(j);
          m = res.market; for (const p of res.positions.values()) pos.set(p.holder, p);
        }
        const close = claimPrices(m).slice(0, sp.singletons.length);
        // calibration of the pre-game closing price of every state
        close.forEach((p, s) => { const b = calib[sp.kind][Math.min(9, Math.floor(p * 10))]; b.n++; b.sp += p; b.sy += s === sp.y ? 1 : 0; });
        const bs = (v: number[]) => v.reduce((a, p, s) => a + (p - (s === sp.y ? 1 : 0)) ** 2, 0);
        const B = brier[sp.kind] as { close: number; open: number; model: number; truth?: number; n: number };
        B.close += bs(close); B.open += bs(close.map(() => 1 / close.length)); B.model += bs(sp.pub); if (B.truth !== undefined) B.truth += bs(sp.truth); B.n++;
        // player strategies on copies of this market (each settled on the real outcome)
        for (const s of STRATS) {
          const outp = s.run({ m, pub: sp.pub, truth: sp.truth, budget: 50 * MICRO, singletons: sp.singletons, kind: sp.kind });
          if (!outp.pos) { add(strat[sp.kind][s.id], 0, 0, false); continue; }
          const res = settleMarket(closeMarket(outp.m, 'T'), [outp.pos], sp.y, 'T', 1e15, null);
          add(strat[sp.kind][s.id], res.positions[0].received - res.positions[0].spent, outp.fees, true);
        }
        // in play (shipped roster, match markets): windows after plies 10, 20, 40 and 60 with the published evaluation
        if (pop === 'roster' && sp.kind === 'match') {
          let prev = claimPrices(m);
          for (const n of [10, 20, 40, 60]) {
            if (n >= g.plies) break;
            const live = liveModelVector({ white: { rating: g.white.rating, rd: g.white.rd }, black: { rating: g.black.rating, rd: g.black.rd }, ply: n, evalCp: Math.abs(g.evals[n - 1]) >= 100000 ? Math.sign(g.evals[n - 1]) * Infinity : g.evals[n - 1], material: g.material[n - 1][0] + g.material[n - 1][1] });
            m = { ...m, live: { plies: n, lastEval: null } };
            const keyed = new Map([...pos.values()].map(p => [p.id, p]));
            const res2 = npcTrade(m, keyed, a => books.balance(a), seed * 7919 + gi * 31 + n, 'T', m.history.length, { role: 'live', belief: live, previousClaimPrices: prev });
            for (const j of res2.journals) books.post(j);
            m = res2.market; for (const p of res2.positions.values()) pos.set(p.holder, p);
            prev = claimPrices(m);
            for (const s of INPLAY) {
              const outp = s.run({ m, pub: live, truth: live, budget: 50 * MICRO, singletons: [0, 1, 2], kind: 'match' });
              if (!outp.pos) { add(inplay[s.id], 0, 0, false); continue; }
              const st2 = settleMarket(closeMarket(outp.m, 'T'), [outp.pos], sp.y, 'T', 1e15, null);
              add(inplay[s.id], st2.positions[0].received - st2.positions[0].spent, outp.fees, true);
            }
          }
        }
        // settle the real market (agents only; the player strategies never touched it)
        const coll = books.balance(acct(m, 'collateral'));
        const treasuryBefore = books.balance('treasury');
        const st = settleMarket(closeMarket(m, 'T'), [...pos.values()], sp.y, 'T', coll, g.id);
        books.post(st.journal);
        const loss = m.subsidy - (books.balance('treasury') - treasuryBefore); // subsidy funded − what came back
        const mk = maker[sp.kind];
        mk.loss += loss; mk.worst = Math.max(mk.worst, loss); mk.subsidy = m.subsidy; mk.n++;
        mk.fees += st.positions.reduce((a, p) => a + p.fees, 0);
        if (books.total() !== 0) throw new Error('conservation violated');
      }
    });
    for (const id of ids) (finalWealth[id] ??= []).push(books.balance(id));
  }
  const wealth = Object.fromEntries(Object.entries(finalWealth).map(([id, xs]) => [id, { label: (AGENTS.find(a => a.id === id)?.label ?? NPC_TRADERS.find(t => t.id === id)?.name ?? id), meanFinal: +(xs.reduce((a, x) => a + x, 0) / xs.length / MICRO).toFixed(2), min: +(Math.min(...xs) / MICRO).toFixed(2), max: +(Math.max(...xs) / MICRO).toFixed(2) }]));
  const allFinal = Object.values(finalWealth).flat();
  return {
    population: pop === 'agents' ? 'simulated agents: skilled, mediocre, contrarian, noisy (3 passes per market)' : 'shipped NPC roster (npcTrade, opening role)',
    marketsPerKind: games.length * SEEDS,
    brierPerMarket: Object.fromEntries(Object.entries(brier).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([x]) => x !== 'n').map(([x, s]) => [x, +((s as number) / v.n).toFixed(4)]))])),
    calibrationOfClosingPrices: Object.fromEntries(Object.entries(calib).map(([k, bins]) => [k, bins.map((b, i) => ({ bin: `${i * 10}–${i * 10 + 10}%`, n: b.n, meanPrice: b.n ? +(b.sp / b.n).toFixed(3) : null, freq: b.n ? +(b.sy / b.n).toFixed(3) : null }))])),
    maker: Object.fromEntries(Object.entries(maker).map(([k, v]) => [k, { fundedSubsidy: +(v.subsidy / MICRO).toFixed(4), meanSubsidyUsed: +(v.loss / v.n / MICRO).toFixed(4), worstSubsidyUsed: +(v.worst / MICRO).toFixed(4), meanFeesPerMarket: +(v.fees / v.n / MICRO).toFixed(4) }])),
    agentWealth: wealth, startWealth: START / MICRO, giniOfFinalWealth: +gini(allFinal).toFixed(4),
    inPlayStrategies: pop === 'roster' ? INPLAY.map(s => ({ id: s.id, label: s.label, legitimate: true, ...summ(inplay[s.id]) })) : null,
    strategies: Object.fromEntries(Object.entries(strat).map(([k, v]) => [k, STRATS.map(s => ({ id: s.id, label: s.label, legitimate: s.legit, ...summ(v[s.id]) }))])),
  };
}

const t0 = Date.now();
const report = {
  id: 'crown-market-sim-1',
  analyst: LEGACY ? 'v0.9 analyst (--legacy-analyst)' : 'v0.10 anchoring analyst',
  events: `${games.length} held-out engine games (tools/odds/data, FNV-1a mod 4 = 0), real results and real ply counts; ${SEEDS} seeds`,
  note: 'All traders are simulated. Public information only, except the Oracle benchmark (hidden strength; impossible in game). Player strategies trade on private copies of each market after the population has traded, and are settled on the real outcome.',
  agents: runPopulation('agents'),
  roster: runPopulation('roster'),
  seconds: 0,
};
report.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ ...report, agents: { ...report.agents, calibrationOfClosingPrices: '…' }, roster: { ...report.roster, calibrationOfClosingPrices: '…' } }, null, 1));
