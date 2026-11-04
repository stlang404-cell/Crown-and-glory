/** Forecasting League and Calibration Challenge (crown-forecast-league-1). */
import { describe, expect, it } from 'vitest';
import { leagueTable, calibrationGrade, SIM_FORECASTERS, MIN_FORECASTS, CAL_MIN_PAIRS, leagueSeasons } from '../src/app/forecastLeague';
import { openMarket, Market } from '../src/exchange/market';
import type { ForecastRecord } from '../src/app/forecasting';
import { mulberry32 } from '../src/rules/tables';

function world(n: number, season: number, seed: number, you: (model: number[], y: number) => number[]) {
  const r = mulberry32(seed), u = () => r() / 4294967296;
  const markets = new Map<string, Market>(), forecasts: ForecastRecord[] = [];
  for (let i = 0; i < n; i++) {
    const w = 0.2 + 0.6 * u(), d = (1 - w) * 0.3, model = [w, d, 1 - w - d];
    const x = u(), y = x < model[0] ? 0 : x < model[0] + model[1] ? 1 : 2;
    const { market } = openMarket({ id: `m${season}:${i}`, sandbox: false, fixtureId: 'f', title: 't', white: 'a', black: 'b', season, round: 1, b: 120, forecast: { w: model[0], d: model[1], l: model[2], source: 't' }, at: 'T' });
    markets.set(market.id, { ...market, status: 'settled', result: y, payout: [0, 1, 2].map(k => (k === y ? 1 : 0)) });
    forecasts.push({ marketId: market.id, probs: you(model, y), at: `T${i}`, outcome: y, prices: [1 / 3, 1 / 3, 1 / 3], model });
  }
  return { markets, forecasts };
}

describe('forecasting league', () => {
  it('ranks you against simulated forecasters on exactly your markets and information', () => {
    const { markets, forecasts } = world(40, 1, 7, m => m);
    const t = leagueTable(forecasts, markets, 1);
    expect(t.n).toBe(40);
    expect(t.qualified).toBe(true);
    expect(t.rows).toHaveLength(1 + SIM_FORECASTERS.length);
    // stating the public model exactly ties the simulated model forecaster
    const you = t.rows.find(r => r.id === 'you')!, model = t.rows.find(r => r.id === 'sim:model')!;
    expect(you.brier).toBeCloseTo(model.brier, 12);
    expect(t.rows.every(r => r.simulated === (r.id !== 'you'))).toBe(true);
    expect(t.rows.map(r => r.rank)).toEqual(t.rows.map((_, i) => i + 1));
    // the crowd snapshot here is the uniform opening price; the model beats it on these model-drawn outcomes
    expect(t.skillVsPrice!).toBeGreaterThan(0);
  });
  it('needs MIN_FORECASTS resolved forecasts to rank; seasons are separate; cancelled markets do not count', () => {
    const a = world(MIN_FORECASTS - 1, 2, 9, m => m);
    const t = leagueTable(a.forecasts, a.markets, 2);
    expect(t.qualified).toBe(false);
    expect(t.youRank).toBeNull();
    expect(leagueTable(a.forecasts, a.markets, 3).n).toBe(0);
    const id = a.forecasts[0].marketId;
    a.markets.set(id, { ...a.markets.get(id)!, status: 'cancelled' });
    expect(leagueTable(a.forecasts, a.markets, 2).n).toBe(MIN_FORECASTS - 2);
    expect(leagueSeasons(a.forecasts, a.markets)).toEqual([2]);
  });
  it('simulated forecasters are deterministic and read only the stored snapshot', () => {
    const f: ForecastRecord = { marketId: 'x', probs: [0.5, 0.2, 0.3], at: 'T', outcome: null, prices: [0.4, 0.3, 0.3], model: [0.6, 0.25, 0.15] };
    for (const s of SIM_FORECASTERS) {
      const p = s.forecast(f)!;
      expect(p).toEqual(s.forecast(structuredClone(f)));
      expect(p.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 12);
      expect(s.name).toMatch(/simulated/);
    }
    expect(SIM_FORECASTERS.find(s => s.id === 'sim:crowd')!.forecast(f)).toEqual(f.prices);
  });
});

describe('calibration challenge', () => {
  it('unrated below the minimum; a calibrated forecaster grades well, an overconfident one poorly and overconfident', () => {
    const small = world(5, 1, 3, m => m);
    expect(calibrationGrade(small.forecasts, small.markets).grade).toBe('Unrated');
    expect(calibrationGrade(small.forecasts, small.markets).pairs).toBeLessThan(CAL_MIN_PAIRS);
    const good = world(3000, 1, 4, m => m);
    const g = calibrationGrade(good.forecasts, good.markets);
    expect(g.grade).toBe('Well calibrated');
    const sharp = (m: number[]) => { const k = m.indexOf(Math.max(...m)); return m.map((_, i) => (i === k ? 0.97 : 0.015)); };
    const bad = world(3000, 1, 4, sharp);
    const b = calibrationGrade(bad.forecasts, bad.markets);
    expect(b.grade).toBe('Poorly calibrated');
    expect(b.direction).toBe('overconfident');
  });
});
