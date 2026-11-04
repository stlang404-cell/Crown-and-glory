/**
 * v0.10 market-integrity properties (docs/MARKET_INTEGRITY.md). Seeded property-based / fuzz tests: every property is
 * checked on hundreds of randomly generated markets, inventories and trade sequences (mulberry32 seeds, reproducible).
 */
import { describe, expect, it } from 'vitest';
import { Books, MICRO, validateJournal, LedgerError } from '../src/exchange/ledger';
import { cost, prices, claimCost, buyClaimMicro, sellClaimMicro, feeMicro, FEE_BPS } from '../src/exchange/lmsr';
import {
  Market, Position, openMarket, openGenericMarket, trade, closeMarket, resolveMarket, cancelMarket, settleMarket, acct, claimsOf, claimPrices, statesOf,
  unitPayout, uniformPayout, liquidationValue, quote, MATCH_CLAIMS, revisionOf, MarketError, basisOf,
} from '../src/exchange/market';
import { positionView, portfolioSummary, payoutUnder } from '../src/exchange/portfolio';
import { bracketStates, bracketClaims, advancementStates, advancementClaims, advancementModel, advancementState } from '../src/exchange/families';
import { mulberry32 } from '../src/rules/tables';

const rngOf = (seed: number) => { const r = mulberry32(seed); return () => r() / 4294967296; };
const fc = { w: 0.4, d: 0.3, l: 0.3, source: 't' };
/** Independent reference for a claim cost: the difference of costs on the translated inventory q − max(q) (the LMSR is
 *  translation invariant, C(q + c·1) = C(q) + c), where both costs are small and the difference is accurate. */
function refClaimCost(q: number[], b: number, S: number[], k: number): number {
  const mx = Math.max(...q);
  const z = q.map(x => x - mx), z2 = [...z];
  for (const s of S) z2[s] += k;
  return cost(z2, b) - cost(z, b);
}
function fund(books: Books, holders: string[], amount = 1_000_000) {
  books.post({ id: 'genesis', at: 'T', kind: 'mint', memo: '', lines: [{ account: 'mint', amount: -(100_000_000 * MICRO) }, { account: 'treasury', amount: 100_000_000 * MICRO }] });
  holders.forEach((h, i) => books.post({ id: `grant:${i}`, at: 'T', kind: 'grant', memo: '', lines: [{ account: 'treasury', amount: -(amount * MICRO) }, { account: h, amount: amount * MICRO }] }));
}
type Spec = { states: number; claims?: { id: string; label: string; states: number[] }[]; prior?: number[]; b: number };
function randomSpec(r: () => number): Spec {
  const pick = Math.floor(r() * 5);
  const b = [20, 60, 120, 150][Math.floor(r() * 4)];
  if (pick === 0) return { states: 3, claims: MATCH_CLAIMS, b };
  if (pick === 1) { const st = bracketStates(['A', 'B', 'C', 'D']); return { states: 8, claims: bracketClaims(['A', 'B', 'C', 'D'], st), b }; }
  if (pick === 2) { const qf: [string, string][] = [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']]; return { states: 16, claims: advancementClaims(qf), b }; }
  if (pick === 3) { const p = [0.1 + r(), 0.1 + r(), 0.1 + r()]; const s = p[0] + p[1] + p[2]; return { states: 3, prior: p.map(x => x / s), claims: [{ id: 'win', label: 'W', states: [0] }, { id: 'nolose', label: 'W or D', states: [0, 1] }], b }; }
  return { states: 2 + Math.floor(r() * 15), b };
}
function openSpec(id: string, spec: Spec): { market: Market; journal: ReturnType<typeof openGenericMarket>['journal'] } {
  const n = spec.states;
  return openGenericMarket({ id, kind: spec.prior ? 'sandbox' : 'winner', sandbox: false, title: id, outcomes: Array.from({ length: n }, (_, i) => `s${i}`), claims: spec.claims, model: uniformPayout(n), prior: spec.prior, rules: 'r', season: 1, round: 1, b: spec.b, at: 'T' });
}

describe('LMSR prices and cost function', () => {
  it('prices are strictly positive probability vectors, translation invariant, and the cost gradient', () => {
    const r = rngOf(11);
    for (let t = 0; t < 400; t++) {
      const n = 2 + Math.floor(r() * 15), b = 10 + r() * 200;
      const q = Array.from({ length: n }, () => (r() - 0.5) * 30 * b);
      const p = prices(q, b);
      expect(p.every(x => x >= 0 && x <= 1)).toBe(true);
      expect(Math.abs(p.reduce((a, x) => a + x, 0) - 1)).toBeLessThan(1e-12);
      const c = r() * 1e4;
      prices(q.map(x => x + c), b).forEach((x, i) => expect(Math.abs(x - p[i])).toBeLessThan(1e-9));
      expect(cost(q.map(x => x + c), b) - cost(q, b)).toBeCloseTo(c, 6);
      const i = Math.floor(r() * n), h = 1e-5 * b;
      expect(claimCost(q, b, [i], h) / h).toBeCloseTo(p[i], 4);
    }
  });
  it('claim cost (closed form) matches the translated-difference reference to 1e-9 $ at any inventory, including 10^5 shares', () => {
    const r = rngOf(12);
    for (const scale of [10, 1e3, 1e4, 1e5]) for (let t = 0; t < 300; t++) {
      const n = 2 + Math.floor(r() * 6), b = [20, 60, 120, 150][t % 4];
      const q = Array.from({ length: n }, () => scale * (1 + r()));
      const S = [...new Set(Array.from({ length: 1 + Math.floor(r() * (n - 1)) }, () => Math.floor(r() * n)))];
      const k = (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 400));
      expect(Math.abs(claimCost(q, b, S, k) - refClaimCost(q, b, S, k))).toBeLessThan(1e-9 * Math.max(1, Math.abs(k)));
    }
  });
  it('directed rounding holds at every inventory: buys never round below, sales never above, the exact cost (bug #26)', () => {
    const r = rngOf(13);
    let checked = 0;
    for (const scale of [100, 1e3, 1e4, 1e5]) for (let t = 0; t < 2000; t++) {
      const q = [0, 0, 0].map(() => scale * (1 + r())), b = 120, S = [Math.floor(r() * 3)], k = 1 + Math.floor(r() * 200);
      expect(buyClaimMicro(q, b, S, k)).toBeGreaterThanOrEqual(refClaimCost(q, b, S, k) * MICRO - 1e-7);
      expect(sellClaimMicro(q, b, S, k)).toBeLessThanOrEqual(-refClaimCost(q, b, S, -k) * MICRO + 1e-7);
      checked++;
    }
    expect(checked).toBe(8000);
  });
  it('large orders stay finite (no Infinity quotes) and the complete set costs exactly its payout', () => {
    const q = [5000, 0, -3000];
    for (const k of [1, 1e3, 1e5, 1e7]) {
      expect(Number.isFinite(claimCost(q, 120, [1], k))).toBe(true);
      expect(Number.isFinite(claimCost(q, 120, [0], -k))).toBe(true);
      expect(claimCost(q, 120, [0, 1, 2], k)).toBe(k);
    }
    expect(claimCost([20000, 0, 0], 120, [1, 2], -1e6)).toBeLessThanOrEqual(0); // selling a near-zero claim: finite, ≤ 0
    expect(Number.isFinite(claimCost([20000, 0, 0], 120, [1, 2], -1e6))).toBe(true);
  });
  it('buying raises the bought claim\'s price and lowers every disjoint claim; selling does the opposite', () => {
    const r = rngOf(14);
    for (let t = 0; t < 300; t++) {
      const spec = randomSpec(r);
      const { market } = openSpec('m', spec);
      const claims = claimsOf(market), c = Math.floor(r() * claims.length);
      const before = claimPrices(market);
      const after = trade(market, null, 'h', c, 1 + Math.floor(r() * 50), 'buy', 'T', 1).market;
      const pa = claimPrices(after);
      expect(pa[c]).toBeGreaterThan(before[c]);
      claims.forEach((d, j) => { if (!d.states.some(s => claims[c].states.includes(s))) expect(pa[j]).toBeLessThan(before[j]); });
    }
  });
});

describe('fees and micro-unit accounting', () => {
  it('fee = ⌈1% of the cash amount⌉: never below 1%, at most 1 µ above, zero only on zero', () => {
    const r = rngOf(21);
    expect(feeMicro(0)).toBe(0);
    for (let t = 0; t < 5000; t++) {
      const a = Math.floor(r() * 1e12);
      const f = feeMicro(a);
      expect(Number.isSafeInteger(f)).toBe(true);
      expect(f * 10_000).toBeGreaterThanOrEqual(a * FEE_BPS);
      expect(f - (a * FEE_BPS) / 10_000).toBeLessThan(1);
      if (a > 0) expect(f).toBeGreaterThan(0);
    }
  });
  it('every quote is integer µ, buy total = amount + fee, sale total = amount − fee ≥ 0', () => {
    const r = rngOf(22);
    for (let t = 0; t < 500; t++) {
      const spec = randomSpec(r);
      let { market } = openSpec('m', spec);
      const claims = claimsOf(market);
      for (let k = 0; k < 5; k++) market = trade(market, null, 'x', Math.floor(r() * claims.length), 1 + Math.floor(r() * 80), 'buy', 'T', k + 1).market;
      const c = Math.floor(r() * claims.length), sh = 1 + Math.floor(r() * 40);
      const b = quote(market, c, sh, 'buy'), s = quote(market, c, sh, 'sell');
      for (const x of [b.amount, b.fee, b.total, s.amount, s.fee, s.total]) expect(Number.isSafeInteger(x)).toBe(true);
      expect(b.total).toBe(b.amount + b.fee);
      expect(s.total).toBe(s.amount - s.fee);
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(b.amount).toBeGreaterThanOrEqual(s.amount); // the spread from directed rounding never favours the trader
    }
  });
  it('the ledger rejects non-integer, unbalanced, overdrawn and mixed sandbox/official entries', () => {
    const bal = (a: string) => (a === 'x' ? 5 : 0);
    expect(() => validateJournal({ id: 'a', at: '', kind: '', memo: '', lines: [{ account: 'x', amount: -1.5 }, { account: 'y', amount: 1.5 }] }, bal)).toThrow(LedgerError);
    expect(() => validateJournal({ id: 'a', at: '', kind: '', memo: '', lines: [{ account: 'x', amount: -1 }, { account: 'y', amount: 2 }] }, bal)).toThrow(LedgerError);
    expect(() => validateJournal({ id: 'a', at: '', kind: '', memo: '', lines: [{ account: 'x', amount: -6 }, { account: 'y', amount: 6 }] }, bal)).toThrow(LedgerError);
    expect(() => validateJournal({ id: 'a', at: '', kind: '', memo: '', lines: [{ account: 'x', amount: -1 }, { account: 'sandbox:y', amount: 1 }] }, bal)).toThrow(LedgerError);
    expect(() => validateJournal({ id: 'a', at: '', kind: '', memo: '', lines: [{ account: 'x', amount: -Infinity }, { account: 'y', amount: Infinity }] }, bal)).toThrow(LedgerError);
  });
});

describe('no free money: round trips, splitting and rounding farming', () => {
  it('any trade sequence that returns to its starting holdings loses at least the fees paid (fuzz, 600 sequences)', () => {
    const r = rngOf(31);
    for (let t = 0; t < 600; t++) {
      const spec = randomSpec(r);
      const books = new Books(); fund(books, ['p', 'other']);
      let { market, journal } = openSpec(`m${t}`, spec); books.post(journal);
      const claims = claimsOf(market);
      // another trader moves the market first (random state)
      for (let k = 0; k < 3; k++) { const x = trade(market, null, 'other', Math.floor(r() * claims.length), 1 + Math.floor(r() * 100), 'buy', 'T', 100 + k); books.post(x.journal); market = x.market; }
      const start = books.balance('p');
      let pos: Position | null = null, seq = 1, fees = 0;
      const n = 1 + Math.floor(r() * 12);
      for (let k = 0; k < n; k++) {
        const c = Math.floor(r() * claims.length);
        const held = pos?.shares[c] ?? 0;
        const side = held > 0 && r() < 0.5 ? 'sell' : 'buy';
        const sh = side === 'sell' ? 1 + Math.floor(r() * held) : 1 + Math.floor(r() * 60);
        const x = trade(market, pos, 'p', c, sh, side, 'T', seq++); books.post(x.journal); market = x.market; pos = x.position; fees += x.quote.fee;
      }
      // unwind every holding
      for (let c = 0; c < claims.length; c++) if (pos!.shares[c] > 0) { const x = trade(market, pos, 'p', c, pos!.shares[c], 'sell', 'T', seq++); books.post(x.journal); market = x.market; pos = x.position; fees += x.quote.fee; }
      const pnl = books.balance('p') - start;
      expect(pnl).toBeLessThanOrEqual(-fees);
      expect(pnl).toBeLessThan(0);
      expect(books.total()).toBe(0);
    }
  });
  it('splitting an order into small pieces never costs less (buys) or returns more (sales) than one order', () => {
    const r = rngOf(32);
    for (let t = 0; t < 300; t++) {
      const spec = randomSpec(r);
      const { market } = openSpec('m', spec);
      const c = Math.floor(r() * claimsOf(market).length), total = 2 + Math.floor(r() * 200), parts = 2 + Math.floor(r() * 10);
      const one = quote(market, c, total, 'buy').total;
      let m = market, sum = 0, left = total, pos: Position | null = null;
      for (let i = 0; i < parts && left > 0; i++) { const k = i === parts - 1 ? left : Math.max(1, Math.floor(left / (parts - i))); const x = trade(m, pos, 'p', c, k, 'buy', 'T', i + 1); sum += x.quote.total; m = x.market; pos = x.position; left -= k; }
      if (left > 0) { const x = trade(m, pos, 'p', c, left, 'buy', 'T', 99); sum += x.quote.total; m = x.market; pos = x.position; }
      expect(sum).toBeGreaterThanOrEqual(one);
      const sellOne = quote(m, c, total, 'sell').total;
      let sold = 0, mm = m, pp = pos, rest = total;
      for (let i = 0; rest > 0; i++) { const k = Math.min(rest, 1 + Math.floor(r() * 30)); const x = trade(mm, pp, 'p', c, k, 'sell', 'T', 200 + i); sold += x.quote.total; mm = x.market; pp = x.position; rest -= k; }
      expect(sold).toBeLessThanOrEqual(sellOne);
    }
  });
  it('a complete set of any partition costs at least its payout and sells for at most it (no complete-set arbitrage)', () => {
    const r = rngOf(33);
    for (let t = 0; t < 300; t++) {
      const n = 2 + Math.floor(r() * 10), b = 30 + r() * 150;
      const q = Array.from({ length: n }, () => (r() - 0.3) * 4 * b);
      const k = 1 + Math.floor(r() * 100);
      // random partition of the states into blocks, bought one block after another
      const blocks: number[][] = []; for (let s = 0; s < n; s++) { if (!blocks.length || r() < 0.5) blocks.push([]); blocks[blocks.length - 1].push(s); }
      let qq = [...q], paid = 0;
      for (const B of blocks) { paid += buyClaimMicro(qq, b, B, k); for (const s of B) qq[s] += k; }
      expect(paid).toBeGreaterThanOrEqual(k * MICRO);
      let got = 0;
      for (const B of blocks) { got += sellClaimMicro(qq, b, B, k); for (const s of B) qq[s] -= k; }
      expect(got).toBeLessThanOrEqual(k * MICRO);
    }
  });
  it('linked claims are coherent: Decisive = 1 − Draw at every inventory; Decisive + Draw is a complete set', () => {
    const r = rngOf(34);
    for (let t = 0; t < 400; t++) {
      let { market } = openMarket({ id: 'm', sandbox: false, fixtureId: 'f', title: 'A–B', white: 'a', black: 'b', season: 1, round: 1, b: 120, forecast: fc, at: 'T', claims: MATCH_CLAIMS });
      for (let k = 0; k < 6; k++) market = trade(market, null, 'x', Math.floor(r() * 4), 1 + Math.floor(r() * 150), 'buy', 'T', k + 1).market;
      const p = claimPrices(market);
      expect(Math.abs(p[3] - (1 - p[1]))).toBeLessThan(1e-12);
      expect(Math.abs(p[3] - (p[0] + p[2]))).toBeLessThan(1e-12);
      const k = 1 + Math.floor(r() * 80);
      const a = trade(market, null, 'y', 3, k, 'buy', 'T', 50);
      const bq = quote(a.market, 1, k, 'buy');
      expect(a.quote.amount + bq.amount).toBeGreaterThanOrEqual(k * MICRO);
    }
  });
});

describe('solvency, conservation and settlement', () => {
  it('fuzz: random multi-holder trading on random markets — after every trade the books sum to zero, collateral covers C(q) − C(q0), and every resolution is solvent with maker loss ≤ the funded subsidy', () => {
    const r = rngOf(41);
    for (let run = 0; run < 60; run++) {
      const spec = randomSpec(r);
      const books = new Books(); const holders = ['p', 'n1', 'n2', 'n3']; fund(books, holders);
      let { market, journal } = openSpec(`f${run}`, spec); books.post(journal);
      const q0 = [...market.q];
      const pos = new Map<string, Position>();
      const claims = claimsOf(market);
      for (let k = 0; k < 120; k++) {
        const h = holders[Math.floor(r() * holders.length)], c = Math.floor(r() * claims.length);
        const p = pos.get(h) ?? null;
        const held = p?.shares[c] ?? 0;
        const side = held > 0 && r() < 0.4 ? 'sell' : 'buy';
        const sh = side === 'sell' ? 1 + Math.floor(r() * held) : 1 + Math.floor(r() * 120);
        const x = trade(market, p, h, c, sh, side, 'T', k + 1);
        books.post(x.journal); market = x.market; pos.set(h, x.position);
        expect(books.total()).toBe(0);
        expect(books.balance(acct(market, 'collateral'))).toBeGreaterThanOrEqual((cost(market.q, market.b) - cost(q0, market.b)) * MICRO - 1e-6);
      }
      const closed = closeMarket(market, 'T');
      const n = statesOf(closed).length;
      const vectors = [...Array.from({ length: n }, (_, w) => unitPayout(n, w)), uniformPayout(n), ...Array.from({ length: 5 }, () => { const v = Array.from({ length: n }, () => r()); const s = v.reduce((a, x) => a + x, 0); return v.map(x => x / s); })];
      if (closed.cancelVector) vectors.push(closed.cancelVector);
      for (const v of vectors) {
        const b2 = new Books(); b2.balances = new Map(books.balances); b2.journals = new Map(books.journals);
        const treasuryBefore = b2.balance('treasury') + closed.subsidy;
        const res = resolveMarket(closed, [...pos.values()], v, 'settle', 'T', b2.balance(acct(closed, 'collateral')), null, 'x');
        b2.post(res.journal);
        expect(b2.total()).toBe(0);
        for (const [a, bal] of b2.balances) if (a !== 'mint') expect(bal).toBeGreaterThanOrEqual(0);
        expect(b2.balance(acct(closed, 'collateral'))).toBe(0);
        expect(b2.balance(acct(closed, 'subsidy'))).toBe(0);
        expect(treasuryBefore - b2.balance('treasury')).toBeLessThanOrEqual(closed.subsidy); // maker loss ≤ funded subsidy
        // every holder is paid exactly its floored claim payout
        for (const p of res.positions) expect(p.received - pos.get(p.holder)!.received).toBe(payoutUnder(closed, pos.get(p.holder)!, v));
      }
    }
  });
  it('a market resolves once: a second settlement or cancellation is rejected and a re-posted journal is a no-op', () => {
    const books = new Books(); fund(books, ['p']);
    const { market, journal } = openMarket({ id: 'd', sandbox: false, fixtureId: 'f', title: 'A–B', white: 'a', black: 'b', season: 1, round: 1, b: 120, forecast: fc, at: 'T', claims: MATCH_CLAIMS });
    books.post(journal);
    const t = trade(market, null, 'p', 3, 40, 'buy', 'T', 1); books.post(t.journal);
    const closed = closeMarket(t.market, 'T');
    expect(() => trade(closed, t.position, 'p', 0, 1, 'buy', 'T', 2)).toThrow(MarketError);
    const s = settleMarket(closed, [t.position], 2, 'T', books.balance(acct(closed, 'collateral')), 'g');
    expect(books.post(s.journal)).toBe(true);
    const cash = books.balance('p');
    expect(books.post(s.journal)).toBe(false);
    expect(() => settleMarket(s.market, s.positions, 2, 'T', 0, null)).toThrow(/already resolved/);
    expect(() => cancelMarket(s.market, s.positions, 'T', 0)).toThrow(/already resolved/);
    expect(books.balance('p')).toBe(cash);
    // Decisive paid $1 per share on a Black win
    expect(s.positions[0].received).toBe(40 * MICRO);
  });
  it('the market revision advances on every trade and every published move, so a stale quote can be detected', () => {
    let { market } = openMarket({ id: 'r', sandbox: false, fixtureId: 'f', title: 'A–B', white: 'a', black: 'b', season: 1, round: 1, b: 120, forecast: fc, at: 'T' });
    const seen = new Set([revisionOf(market)]);
    for (let k = 0; k < 20; k++) {
      if (k % 2) market = trade(market, null, 'x', 0, 1, 'buy', 'T', k + 1).market;
      else market = { ...market, live: { plies: (market.live?.plies ?? 0) + 1, lastEval: null } };
      expect(seen.has(revisionOf(market))).toBe(false);
      seen.add(revisionOf(market));
    }
  });
});

describe('cost basis and P&L identities', () => {
  it('fuzz: realised + unrealised = exit value + received − spent; basis + closed basis = spent; settlement realises received − spent', () => {
    const r = rngOf(51);
    for (let run = 0; run < 200; run++) {
      const spec = randomSpec(r);
      let { market } = openSpec(`b${run}`, spec);
      const claims = claimsOf(market);
      let p: Position | null = null;
      for (let k = 0; k < 15; k++) {
        const c = Math.floor(r() * claims.length), held = p?.shares[c] ?? 0;
        const side = held > 0 && r() < 0.45 ? 'sell' : 'buy';
        const sh = side === 'sell' ? 1 + Math.floor(r() * held) : 1 + Math.floor(r() * 60);
        const x = trade(market, p, 'p', c, sh, side, 'T', k + 1); market = x.market; p = x.position;
        const v = positionView(market, p);
        expect(v.basisKnown).toBe(true);
        expect(v.realised! + v.unrealised!).toBe(v.exitValue + p.received - p.spent);
        expect(v.exitValue).toBe(liquidationValue(market, p));
        const rec = basisOf(p, claims.length)!;
        rec.basis.forEach((b, i) => { expect(Number.isSafeInteger(b)).toBe(true); expect(b).toBeGreaterThanOrEqual(0); if (!p!.shares[i]) expect(b).toBe(0); });
        expect(v.atRisk).toBeLessThanOrEqual(p.spent); // long-only: never more than paid
        v.scenarios.forEach(s => expect(s.pnl).toBe(s.payout + p!.received - p!.spent));
      }
      const res = settleMarket(closeMarket(market, 'T'), [p!], Math.floor(r() * statesOf(market).length), 'T', 1e15, null);
      const sp = res.positions[0];
      expect(sp.realised).toBe(sp.received - sp.spent);
      expect(positionView(res.market, sp).holdings).toHaveLength(0);
    }
  });
  it('legacy positions (no recorded basis) report aggregate P&L only and never invent a per-claim basis', () => {
    let { market } = openMarket({ id: 'l', sandbox: false, fixtureId: 'f', title: 'A–B', white: 'a', black: 'b', season: 1, round: 1, b: 120, forecast: fc, at: 'T' });
    const t = trade(market, null, 'p', 0, 10, 'buy', 'T', 1); market = t.market;
    const legacy: Position = { ...t.position, basis: undefined, realised: undefined };
    const v = positionView(market, legacy);
    expect(v.basisKnown).toBe(false);
    expect(v.holdings[0].basis).toBeNull();
    expect(v.netIfClosedNow).toBe(liquidationValue(market, legacy) + legacy.received - legacy.spent);
    const after = trade(market, legacy, 'p', 0, 10, 'sell', 'T', 2).position; // full exit: a zero holding has an exact basis
    expect(basisOf(after, 3)).toEqual({ basis: [0, 0, 0], realised: after.received - after.spent });
    const sum = portfolioSummary(new Map([[market.id, market]]), [legacy]);
    expect(sum.legacy).toBe(1);
  });
});

describe('v0.10 market definitions', () => {
  it('quarterfinal advancement: 16 exhaustive states, canonical claims, exact model, settlement state from the four winners', () => {
    const qf: [string, string][] = [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']];
    const states = advancementStates(qf);
    expect(new Set(states.map(s => s.winners.join())).size).toBe(16);
    const claims = advancementClaims(qf);
    const keys = claims.map(c => c.states.join(','));
    expect(new Set(keys).size).toBe(claims.length);
    for (const x of 'abcdefgh') expect(claims.find(c => c.id === `semi:${x}`)!.states).toHaveLength(8);
    expect(claims.filter(c => c.id.startsWith('meet:'))).toHaveLength(8);
    const model = advancementModel(qf, id => 2000 - id.charCodeAt(0), id => id.charCodeAt(0));
    expect(model.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 12);
    const s = advancementState(qf, ['b', 'c', 'f', 'g']);
    expect(states[s].winners).toEqual(['b', 'c', 'f', 'g']);
    expect(() => advancementState(qf, ['x', 'c', 'f', 'g'])).toThrow();
    // the claim "a reaches the semifinals" pays in exactly the states where a won
    const semiA = claims.find(c => c.id === 'semi:a')!;
    states.forEach((st, i) => expect(semiA.states.includes(i)).toBe(st.winners.includes('a')));
  });
});
