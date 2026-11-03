import { describe, expect, it } from 'vitest';
import { Books, MICRO, LedgerError } from '../src/exchange/ledger';
import { cost, prices, tradeCost, buyCostMicro, sellProceedsMicro, subsidyMicro, logSumExp, feeMicro } from '../src/exchange/lmsr';
import { openMarket, trade, closeMarket, settleMarket, cancelMarket, quote, MarketError, Market, Position, acct, liquidationValue, maxLiability } from '../src/exchange/market';
import { npcRound, NPC_TRADERS } from '../src/exchange/npc';
import { mulberry32 } from '../src/rules/tables';

const fc = { w: 0.45, d: 0.3, l: 0.25, source: 'test' };
function setup(b = 100, cash = 10_000) {
  const books = new Books();
  books.post({ id: 'genesis', at: 'T', kind: 'mint', memo: '', lines: [{ account: 'mint', amount: -(1_000_000 * MICRO) }, { account: 'treasury', amount: 1_000_000 * MICRO }] });
  books.post({ id: 'grant', at: 'T', kind: 'grant', memo: '', lines: [{ account: 'treasury', amount: -(cash * MICRO) }, { account: 'player:cash', amount: cash * MICRO }] });
  const { market, journal } = openMarket({ id: 'm1', sandbox: false, fixtureId: 'f', title: 'A–B', white: 'a', black: 'b', season: 1, round: 1, b, forecast: fc, at: 'T' });
  books.post(journal);
  return { books, market };
}

describe('LMSR mathematics', () => {
  it('prices are a probability vector and equal the cost gradient', () => {
    const r = mulberry32(1);
    for (let k = 0; k < 200; k++) {
      const b = [10, 100, 1000][k % 3];
      const q = [0, 1, 2].map(() => ((r() / 4294967296) - 0.5) * 20 * b);
      const p = prices(q, b);
      expect(p.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 12);
      for (let i = 0; i < 3; i++) {
        const h = 1e-4 * b;
        const q2 = [...q]; q2[i] += h;
        expect((cost(q2, b) - cost(q, b)) / h).toBeCloseTo(p[i], 4);
      }
    }
  });
  it('log-sum-exp is stable at extreme inventories', () => {
    expect(Number.isFinite(cost([1e6, 0, -1e6], 10))).toBe(true);
    expect(logSumExp([1000, 1000])).toBeCloseTo(1000 + Math.log(2), 10);
    expect(prices([1e6, 0, 0], 10)[0]).toBeCloseTo(1, 12);
  });
  it('a complete set costs exactly its payout (no complete-set arbitrage)', () => {
    const q = [3, 50, -7], b = 40;
    expect(cost(q.map(x => x + 25), b) - cost(q, b)).toBeCloseTo(25, 9);
  });
  it('directed rounding: buys round up, sells round down', () => {
    const q = [0, 0, 0];
    expect(buyCostMicro(q, 100, 0, 7)).toBeGreaterThanOrEqual(tradeCost(q, 100, 0, 7) * MICRO);
    expect(sellProceedsMicro([7, 0, 0], 100, 0, 7)).toBeLessThanOrEqual(-tradeCost([7, 0, 0], 100, 0, -7) * MICRO);
    expect(feeMicro(1_000_001)).toBe(10_001);
  });
});

describe('market lifecycle and accounting', () => {
  it('buy then sell at unchanged inventory loses exactly fees plus rounding', () => {
    const { books, market } = setup();
    const before = books.balance('player:cash');
    const a = trade(market, null, 'player:cash', 0, 10, 'buy', 'T', 1); books.post(a.journal);
    const s = trade(a.market, a.position, 'player:cash', 0, 10, 'sell', 'T', 2); books.post(s.journal);
    const loss = before - books.balance('player:cash');
    expect(loss).toBe(a.quote.fee + s.quote.fee + (a.quote.amount - s.quote.amount));
    expect(a.quote.amount - s.quote.amount).toBeGreaterThanOrEqual(0);
    expect(a.quote.amount - s.quote.amount).toBeLessThanOrEqual(2);
    expect(books.total()).toBe(0);
  });
  it('random trading: conservation, solvency at every step, bounded maker loss for every possible outcome', () => {
    for (let run = 0; run < 30; run++) {
      const { books, market } = setup(50 + run * 10, 100_000);
      const r = mulberry32(run + 7);
      const holders = ['player:cash', 'npc:x', 'npc:y'];
      for (const h of holders.slice(1)) books.post({ id: `fund-${h}`, at: 'T', kind: 'grant', memo: '', lines: [{ account: 'treasury', amount: -50_000 * MICRO }, { account: h, amount: 50_000 * MICRO }] });
      let m: Market = market; const pos = new Map<string, Position>(); let seq = 1;
      for (let k = 0; k < 150; k++) {
        const h = holders[r() % 3], o = r() % 3, sh = 1 + (r() % 40);
        const p = pos.get(`m1|${h}`) ?? null;
        const side = p && p.shares[o] >= sh && r() % 3 === 0 ? 'sell' : 'buy';
        try { const t = trade(m, p, h, o, sh, side, 'T', seq++); books.post(t.journal); m = t.market; pos.set(t.position.id, t.position); } catch (e) { if (!(e instanceof LedgerError) && !(e instanceof MarketError)) throw e; }
        expect(books.balance(acct(m, 'collateral')) + books.balance(acct(m, 'subsidy'))).toBeGreaterThanOrEqual(maxLiability(m));
        expect(books.total()).toBe(0);
      }
      const closed = closeMarket(m, 'T');
      for (let outcome = 0; outcome < 3; outcome++) {
        const b2 = new Books(); b2.balances = new Map(books.balances); b2.journals = new Map(books.journals);
        const treasuryBefore = b2.balance('treasury') + closed.subsidy;
        const st = settleMarket(closed, [...pos.values()], outcome, 'T', b2.balance(acct(closed, 'collateral')), null);
        b2.post(st.journal);
        expect(b2.balance(acct(closed, 'collateral'))).toBe(0);
        expect(b2.balance(acct(closed, 'subsidy'))).toBe(0);
        // maker loss (treasury change net of fees and the returned subsidy) never exceeds the funded b·ln 3
        const makerLoss = treasuryBefore - b2.balance('treasury');
        expect(makerLoss).toBeLessThanOrEqual(subsidyMicro(closed.b, 3));
        expect(b2.total()).toBe(0);
        for (const [a, v] of b2.balances) if (a !== 'mint') expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('settlement is idempotent; closed markets refuse trades and cannot reopen', () => {
    const { books, market } = setup();
    const a = trade(market, null, 'player:cash', 2, 5, 'buy', 'T', 1); books.post(a.journal);
    const closed = closeMarket(a.market, 'T');
    expect(() => trade(closed, a.position, 'player:cash', 0, 1, 'buy', 'T', 2)).toThrow(MarketError);
    expect(closeMarket(closed, 'T2')).toBe(closed);
    const st = settleMarket(closed, [a.position], 2, 'T', books.balance(acct(closed, 'collateral')), 'g1');
    expect(books.post(st.journal)).toBe(true);
    expect(books.post(st.journal)).toBe(false); // retry is a no-op
    expect(() => settleMarket(st.market, st.positions, 2, 'T', 0, 'g1')).toThrow(MarketError);
    expect(st.positions[0].received).toBe(5 * MICRO);
    expect(() => settleMarket(market, [], 0, 'T', 0, null)).toThrow(/Close the market/);
  });
  it('no short selling, no unfunded purchases', () => {
    const { books, market } = setup(100, 1);
    expect(() => trade(market, null, 'player:cash', 0, 1, 'sell', 'T', 1)).toThrow(/no short/);
    const t = trade(market, null, 'player:cash', 0, 5, 'buy', 'T', 1); // ~1.7 crowns > 1 crown cash
    expect(() => books.post(t.journal)).toThrow(LedgerError);
  });
  it('cancellation pays 1/3 per share and keeps fees', () => {
    const { books, market } = setup();
    const a = trade(market, null, 'player:cash', 0, 9, 'buy', 'T', 1); books.post(a.journal);
    const c = cancelMarket(closeMarket(a.market, 'T'), [a.position], 'T', books.balance(acct(market, 'collateral')));
    books.post(c.journal);
    expect(c.positions[0].received).toBe(3 * MICRO);
    expect(books.balance('fees')).toBe(a.quote.fee);
    expect(books.total()).toBe(0);
  });
  it('sandbox and official money never mix', () => {
    const books = new Books();
    expect(() => books.post({ id: 'x', at: 'T', kind: 'k', memo: '', lines: [{ account: 'sandbox:mint', amount: -5 }, { account: 'player:cash', amount: 5 }] })).toThrow(/Sandbox/);
  });
  it('quotes disclose fee, max payout and max loss; liquidation value is executable', () => {
    const { market } = setup();
    const q = quote(market, 1, 10, 'buy');
    expect(q.total).toBe(q.amount + q.fee);
    expect(q.maxPayout).toBe(10 * MICRO);
    const t = trade(market, null, 'player:cash', 1, 10, 'buy', 'T', 1);
    const lv = liquidationValue(t.market, t.position);
    expect(lv).toBeLessThan(t.quote.total);
    expect(lv).toBeGreaterThan(0);
  });
});

describe('NPC traders', () => {
  it('use only the published forecast; never touch a closed market; spend within budgets', () => {
    const { books, market } = setup();
    for (const t of NPC_TRADERS) books.post({ id: `f-${t.id}`, at: 'T', kind: 'g', memo: '', lines: [{ account: 'treasury', amount: -1000 * MICRO }, { account: t.id, amount: 1000 * MICRO }] });
    const res = npcRound(market, new Map(), a => books.balance(a), 5, 'T', 1);
    for (const j of res.journals) books.post(j);
    const p = prices(res.market.q, res.market.b);
    expect(p[0]).toBeGreaterThan(1 / 3); // moved toward the 45% favourite
    for (const t of NPC_TRADERS) expect(1000 * MICRO - books.balance(t.id)).toBeLessThanOrEqual(1000 * MICRO * t.budgetShare + 1);
    const closed = npcRound(closeMarket(res.market, 'T'), res.positions, a => books.balance(a), 5, 'T', 99);
    expect(closed.journals).toHaveLength(0);
    // the forecast is the only strength input: changing hidden information cannot change NPC behaviour
    const again = npcRound(market, new Map(), a => (a.startsWith('npc') ? 1000 * MICRO : 0), 5, 'T', 1);
    expect(again.market.q).toEqual(res.market.q);
  });
});
