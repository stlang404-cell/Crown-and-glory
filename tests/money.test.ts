/** v0.8 dollar display: integer micro-units are shown as dollars without rescaling; prices are per-$1 share. */
import { describe, expect, it } from 'vitest';
import { fmtMoney, fmtMoneyDelta, fmtPrice, fmtPriceDelta, MICRO, toMicro } from '../src/exchange/ledger';

describe('money display', () => {
  it('shows whole currency units as dollars, sign first', () => {
    expect(fmtMoney(1_000 * MICRO)).toBe('$1,000.00');
    expect(fmtMoney(8_450 * MICRO)).toBe('$8,450.00');
    expect(fmtMoney(toMicro(125.5))).toBe('$125.50');
    expect(fmtMoney(-toMicro(19.2))).toBe('-$19.20');
    expect(fmtMoney(1_000 * MICRO, 0)).toBe('$1,000');
  });
  it('signed changes', () => {
    expect(fmtMoneyDelta(toMicro(250))).toBe('+$250.00');
    expect(fmtMoneyDelta(-toMicro(19.2))).toBe('-$19.20');
    expect(fmtMoneyDelta(0)).toBe('$0.00');
  });
  it('a share price is a dollar price of a $1 payout, not a probability string', () => {
    expect(fmtPrice(0.485)).toBe('$0.485');
    expect(fmtPriceDelta(0.006)).toBe('+$0.006');
    expect(fmtPriceDelta(-0.012)).toBe('−$0.012');
  });
});
