/**
 * crown-exchange-2: n-state markets, subset (conditional/conjunction) claims, payout vectors and the
 * 8-state bounded knockout model (research doc 09), under randomized adversarial trading.
 */
import { describe, expect, it } from 'vitest';
import { Books, MICRO, LedgerError } from '../src/exchange/ledger';
import { subsidyMicro, claimCost, cost } from '../src/exchange/lmsr';
import { openGenericMarket, trade, closeMarket, resolveMarket, settleMarket, cancelMarket, MarketError, Market, Position, acct, claimPrices, claimsOf, uniformPayout, unitPayout, liquidationValue, quote } from '../src/exchange/market';
import { bracketStates, bracketClaims } from '../src/exchange/families';
import { mulberry32 } from '../src/rules/tables';

function fund(books: Books, holders: string[], each = 50_000) {
  books.post({ id: 'genesis', at: 'T', kind: 'mint', memo: '', lines: [{ account: 'mint', amount: -(10_000_000 * MICRO) }, { account: 'treasury', amount: 10_000_000 * MICRO }] });
  for (const h of holders) books.post({ id: `fund-${h}`, at: 'T', kind: 'grant', memo: '', lines: [{ account: 'treasury', amount: -each * MICRO }, { account: h, amount: each * MICRO }] });
}

function randomTrading(m0: Market, books: Books, holders: string[], seed: number, steps: number) {
  const r = mulberry32(seed);
  let m = m0; const pos = new Map<string, Position>(); let seq = 1;
  const nClaims = claimsOf(m).length;
  for (let k = 0; k < steps; k++) {
    const h = holders[r() % holders.length], c = r() % nClaims, sh = 1 + (r() % 60);
    const p = pos.get(`${m.id}|${h}`) ?? null;
    const side = p && (p.shares[c] ?? 0) >= sh && r() % 3 === 0 ? 'sell' : 'buy';
    try { const t = trade(m, p, h, c, sh, side, 'T', seq++); books.post(t.journal); m = t.market; pos.set(t.position.id, t.position); }
    catch (e) { if (!(e instanceof LedgerError) && !(e instanceof MarketError)) throw e; }
    // inventory = issued exposure per state, never negative; collateral + subsidy cover the worst state
    for (const x of m.q) expect(x).toBeGreaterThanOrEqual(0);
    expect(books.balance(acct(m, 'collateral')) + books.balance(acct(m, 'subsidy'))).toBeGreaterThanOrEqual(Math.max(...m.q) * MICRO);
    expect(books.total()).toBe(0);
  }
  return { m, pos };
}

describe('n-state categorical markets (tournament winner)', () => {
  it('16-state market: conservation, solvency, bounded maker loss for every winner and for joint winners', () => {
    for (let run = 0; run < 8; run++) {
      const n = 16, books = new Books(), holders = ['player:cash', 'npc:a', 'npc:b', 'npc:c'];
      fund(books, holders);
      const outcomes = Array.from({ length: n }, (_, i) => `P${i}`);
      const { market, journal } = openGenericMarket({ id: `w${run}`, kind: 'winner', sandbox: false, title: 'Winner', outcomes, model: uniformPayout(n), rules: 'r', season: 1, round: 1, b: 150, at: 'T' });
      books.post(journal);
      expect(market.subsidy).toBe(subsidyMicro(150, 16));
      const { m, pos } = randomTrading(market, books, holders, 100 + run, 200);
      const closed = closeMarket(m, 'T');
      const vectors = [...Array.from({ length: n }, (_, w) => unitPayout(n, w)), Array.from({ length: n }, (_, i) => (i === 2 || i === 9 ? 0.5 : 0)), uniformPayout(n)];
      for (const v of vectors) {
        const b2 = new Books(); b2.balances = new Map(books.balances); b2.journals = new Map(books.journals);
        const treasuryBefore = b2.balance('treasury') + closed.subsidy;
        const r = resolveMarket(closed, [...pos.values()], v, 'settle', 'T', b2.balance(acct(closed, 'collateral')), null, 'x');
        b2.post(r.journal);
        expect(b2.total()).toBe(0);
        expect(treasuryBefore - b2.balance('treasury')).toBeLessThanOrEqual(subsidyMicro(150, n));
        for (const [a, val] of b2.balances) if (a !== 'mint') expect(val).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('rejects payout vectors that are not in the simplex and double resolution', () => {
    const books = new Books(); fund(books, ['player:cash']);
    const { market, journal } = openGenericMarket({ id: 'x', kind: 'winner', sandbox: false, title: 'X', outcomes: ['a', 'b', 'c', 'd'], model: uniformPayout(4), rules: 'r', season: 1, round: 1, b: 100, at: 'T' });
    books.post(journal);
    const t = trade(market, null, 'player:cash', 1, 10, 'buy', 'T', 1); books.post(t.journal);
    const closed = closeMarket(t.market, 'T');
    expect(() => resolveMarket(closed, [t.position], [0.6, 0.6, 0, 0], 'settle', 'T', books.balance(acct(closed, 'collateral')), null, 'x')).toThrow(MarketError);
    const s = settleMarket(closed, [t.position], 1, 'T', books.balance(acct(closed, 'collateral')), null);
    books.post(s.journal);
    expect(books.balance('player:cash')).toBe(50_000 * MICRO - t.quote.total + 10 * MICRO);
    expect(() => settleMarket(s.market, s.positions, 1, 'T', 0, null)).toThrow(/already resolved/);
    expect(() => books.post(s.journal)).not.toThrow(); // idempotent journal id: re-post is a no-op
    expect(books.balance('player:cash')).toBe(50_000 * MICRO - t.quote.total + 10 * MICRO);
  });
  it('model probabilities never move inventory; prices start uniform and move only by trades', () => {
    const { market } = openGenericMarket({ id: 'y', kind: 'winner', sandbox: false, title: 'Y', outcomes: ['a', 'b', 'c'], model: [0.7, 0.2, 0.1], rules: 'r', season: 1, round: 1, b: 100, at: 'T' });
    expect(market.q).toEqual([0, 0, 0]);
    for (const p of claimPrices(market)) expect(p).toBeCloseTo(1 / 3, 12);
  });
});

describe('8-state bounded knockout model (conditional / conjunction claims)', () => {
  const players = ['A', 'B', 'C', 'D']; // semifinal 1: A–B, semifinal 2: C–D
  it('enumerates 2^3 bracket paths; claims are canonical subsets; claim prices are coherent', () => {
    const states = bracketStates(players);
    expect(states).toHaveLength(8);
    expect(new Set(states.map(s => s.label)).size).toBe(8);
    const claims = bracketClaims(players, states);
    const keys = claims.map(c => [...c.states].sort().join(','));
    expect(new Set(keys).size).toBe(keys.length); // no duplicated payoff claims
    const champ = claims.filter(c => c.id.startsWith('champ:'));
    expect(champ).toHaveLength(4);
    expect(champ.flatMap(c => c.states).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // champion claims partition the states
    const { market } = openGenericMarket({ id: 'k', kind: 'bracket', sandbox: false, title: 'Final four', outcomes: states.map(s => s.label), claims, model: uniformPayout(8), rules: 'r', season: 1, round: 18, b: 120, at: 'T' });
    const pr = claimPrices(market);
    expect(champ.reduce((a, c) => a + pr[claims.indexOf(c)], 0)).toBeCloseTo(1, 12);
    // complete-set identity on the shared ledger: buying every state once costs exactly 1 crown
    expect(claimCost(market.q, market.b, [0, 1, 2, 3, 4, 5, 6, 7], 1)).toBeCloseTo(1, 9);
    expect(cost(market.q, market.b)).toBeCloseTo(market.b * Math.log(8), 9);
  });
  it('random trading in overlapping claims: solvent for every bracket path, joint final split and cancellation', () => {
    const states = bracketStates(players), claims = bracketClaims(players, states);
    for (let run = 0; run < 10; run++) {
      const books = new Books(), holders = ['player:cash', 'npc:a', 'npc:b'];
      fund(books, holders);
      const { market, journal } = openGenericMarket({ id: `k${run}`, kind: 'bracket', sandbox: false, title: 'K', outcomes: states.map(s => s.label), claims, model: uniformPayout(8), rules: 'r', season: 1, round: 18, b: 120, at: 'T' });
      books.post(journal);
      const { m, pos } = randomTrading(market, books, holders, 900 + run, 250);
      const closed = closeMarket(m, 'T');
      const vectors = [...Array.from({ length: 8 }, (_, w) => unitPayout(8, w)), [0.5, 0.5, 0, 0, 0, 0, 0, 0], uniformPayout(8)];
      for (const v of vectors) {
        const b2 = new Books(); b2.balances = new Map(books.balances); b2.journals = new Map(books.journals);
        const before = b2.balance('treasury') + closed.subsidy;
        b2.post(resolveMarket(closed, [...pos.values()], v, 'settle', 'T', b2.balance(acct(closed, 'collateral')), null, 'x').journal);
        expect(b2.total()).toBe(0);
        expect(before - b2.balance('treasury')).toBeLessThanOrEqual(subsidyMicro(120, 8));
      }
      // cancellation pays |S|/8 per share of claim S
      const c = cancelMarket(closed, [...pos.values()], 'T', books.balance(acct(closed, 'collateral')));
      for (const p of c.positions) {
        const exp = Math.floor(p.shares.reduce((a, x, i) => a + x * (claims[i].states.length / 8), 0) * MICRO + 1e-6);
        expect(p.received - (pos.get(p.id)!.received)).toBe(exp);
      }
    }
  });
  it('liquidation value is executable and never exceeds what a sale returns', () => {
    const states = bracketStates(players), claims = bracketClaims(players, states);
    const books = new Books(); fund(books, ['player:cash']);
    const { market, journal } = openGenericMarket({ id: 'L', kind: 'bracket', sandbox: false, title: 'L', outcomes: states.map(s => s.label), claims, model: uniformPayout(8), rules: 'r', season: 1, round: 18, b: 120, at: 'T' });
    books.post(journal);
    const t = trade(market, null, 'player:cash', 5, 20, 'buy', 'T', 1);
    const lv = liquidationValue(t.market, t.position);
    expect(lv).toBe(quote(t.market, 5, 20, 'sell').total);
  });
});

describe('prior-priced markets (sandbox) — research doc 09 initial-prior funding', () => {
  it('opens at p0, funds b·ln(1/min p0), stays solvent for every outcome and cancels on the published vector', async () => {
    const { exposure } = await import('../src/exchange/market');
    for (let run = 0; run < 12; run++) {
      const books = new Books(); fund(books, ['player:cash', 'npc:a']);
      const p0 = [[0.08, 0.22, 0.7], [0.6, 0.3, 0.1], [0.33, 0.34, 0.33]][run % 3];
      const { market, journal } = openGenericMarket({ id: `p${run}`, kind: 'sandbox', sandbox: false, title: 'P', outcomes: ['Win', 'Draw', 'Loss'], claims: [{ id: 'win', label: 'Win', states: [0] }, { id: 'nolose', label: 'Draw or win', states: [0, 1] }], model: p0, prior: p0, rules: 'r', season: 1, round: 1, b: 60, at: 'T' });
      market.cancelVector = p0;
      books.post(journal);
      expect(market.subsidy).toBe(Math.ceil(60 * Math.log(1 / Math.min(...p0)) * MICRO));
      claimPrices(market).forEach((x, i) => expect(x).toBeCloseTo([p0[0], p0[0] + p0[1]][i], 9));
      const r = mulberry32(50 + run);
      let m = market; const pos = new Map<string, Position>(); let seq = 1;
      for (let k = 0; k < 150; k++) {
        const h = ['player:cash', 'npc:a'][r() % 2], c = r() % 2, sh = 1 + (r() % 30);
        const p = pos.get(`${m.id}|${h}`) ?? null;
        const side = p && p.shares[c] >= sh && r() % 3 === 0 ? 'sell' : 'buy';
        try { const t = trade(m, p, h, c, sh, side, 'T', seq++); books.post(t.journal); m = t.market; pos.set(t.position.id, t.position); } catch (e) { if (!(e instanceof LedgerError) && !(e instanceof MarketError)) throw e; }
        expect(books.balance(acct(m, 'collateral')) + books.balance(acct(m, 'subsidy'))).toBeGreaterThanOrEqual(Math.max(...exposure(m)) * MICRO);
      }
      const closed = closeMarket(m, 'T');
      for (const v of [unitPayout(3, 0), unitPayout(3, 1), unitPayout(3, 2), p0]) {
        const b2 = new Books(); b2.balances = new Map(books.balances); b2.journals = new Map(books.journals);
        b2.post(resolveMarket(closed, [...pos.values()], v, 'settle', 'T', b2.balance(acct(closed, 'collateral')), null, 'x').journal);
        expect(b2.total()).toBe(0);
        for (const [a, val] of b2.balances) if (a !== 'mint') expect(val).toBeGreaterThanOrEqual(0);
      }
      // cancellation pays the published prior: buying at the opening price then forcing a cancellation gains nothing
      const fresh = openGenericMarket({ id: `q${run}`, kind: 'sandbox', sandbox: false, title: 'Q', outcomes: ['Win', 'Draw', 'Loss'], claims: [{ id: 'win', label: 'Win', states: [0] }], model: p0, prior: p0, rules: 'r', season: 1, round: 1, b: 60, at: 'T' }).market;
      fresh.cancelVector = p0;
      const t = trade(fresh, null, 'player:cash', 0, 10, 'buy', 'T', 1);
      const c = cancelMarket(closeMarket(t.market, 'T'), [t.position], 'T', t.quote.amount);
      expect(c.positions[0].received).toBeLessThanOrEqual(t.quote.total);
    }
  });
});
