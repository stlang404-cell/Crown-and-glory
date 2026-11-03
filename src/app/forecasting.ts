/**
 * Forecasting companion (crown-forecast-1). Paper forecasts are free probability vectors over a market's
 * states, locked when the market closes and scored on resolution with two proper scoring rules:
 *   Brier  B = Σ_s (p_s − y_s)²            (0 perfect … 2 worst; lower is better)
 *   Log    L = −Σ_s y_s · ln max(p_s, ε)   (ε = 0.001; lower is better)
 * y is the market's resolution payout vector (a unit vector, or ½/½ for joint champions). Cancelled markets
 * are not scored. Calibration pools every (p_s, y_s) pair into ten probability bins with Wilson intervals.
 * A good forecast is not a profitable trade: trading P&L depends on prices paid and fees, and is reported
 * separately (Finance). Forecast skill is never mixed into chess or financial prestige.
 */
import type { Market } from '../exchange/market';
import { statesOf, unitPayout } from '../exchange/market';

export const FORECAST_ID = 'crown-forecast-1';
export interface ForecastRecord { marketId: string; probs: number[]; at: string; outcome: number | null; prices?: number[]; model?: number[] }
export interface ScoredForecast { f: ForecastRecord; market: Market; y: number[]; brier: number; log: number; priceBrier: number | null; modelBrier: number | null }

export const brier = (p: number[], y: number[]) => p.reduce((a, x, i) => a + (x - (y[i] ?? 0)) ** 2, 0);
export const logScore = (p: number[], y: number[]) => -y.reduce((a, yi, i) => a + (yi > 0 ? yi * Math.log(Math.max(p[i] ?? 0, 0.001)) : 0), 0);

/** Resolution vector of a market, or null if unresolved/cancelled. */
export function resolution(m: Market): number[] | null {
  if (m.status !== 'settled') return null;
  if (m.payout) return m.payout;
  return m.result !== null && m.result >= 0 ? unitPayout(statesOf(m).length, m.result) : null;
}

export function scoreAll(forecasts: ForecastRecord[], markets: Map<string, Market>): ScoredForecast[] {
  const out: ScoredForecast[] = [];
  for (const f of forecasts) {
    const m = markets.get(f.marketId);
    if (!m) continue;
    const y = resolution(m);
    if (!y || f.probs.length !== y.length) continue;
    const model = f.model ?? m.model ?? (y.length === 3 ? [m.forecast.w, m.forecast.d, m.forecast.l] : null);
    out.push({ f, market: m, y, brier: brier(f.probs, y), log: logScore(f.probs, y), priceBrier: f.prices && f.prices.length === y.length ? brier(f.prices, y) : null, modelBrier: model ? brier(model, y) : null });
  }
  return out.sort((a, b) => a.f.at.localeCompare(b.f.at));
}

export interface CalibrationBin { lo: number; hi: number; n: number; meanP: number; freq: number; ciLo: number; ciHi: number }
export function calibration(scored: ScoredForecast[], bins = 10): CalibrationBin[] {
  const acc = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, n: 0, sp: 0, sy: 0 }));
  for (const s of scored) s.f.probs.forEach((p, i) => { const k = Math.min(bins - 1, Math.floor(p * bins)); acc[k].n++; acc[k].sp += p; acc[k].sy += s.y[i]; });
  return acc.map(a => {
    const freq = a.n ? a.sy / a.n : 0, z = 1.96;
    const den = 1 + (z * z) / Math.max(1, a.n), c = (freq + (z * z) / (2 * Math.max(1, a.n))) / den, half = (z * Math.sqrt((freq * (1 - freq)) / Math.max(1, a.n) + (z * z) / (4 * Math.max(1, a.n) ** 2))) / den;
    return { lo: a.lo, hi: a.hi, n: a.n, meanP: a.n ? a.sp / a.n : 0, freq, ciLo: a.n ? Math.max(0, c - half) : 0, ciHi: a.n ? Math.min(1, c + half) : 0 };
  });
}

/** Rolling mean Brier (window w) for the skill-progression chart. */
export function rollingBrier(scored: ScoredForecast[], w = 10): { i: number; you: number; market: number | null; model: number | null }[] {
  return scored.map((_, i) => {
    const win = scored.slice(Math.max(0, i - w + 1), i + 1);
    const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    return { i: i + 1, you: mean(win.map(x => x.brier))!, market: mean(win.map(x => x.priceBrier)), model: mean(win.map(x => x.modelBrier)) };
  });
}
export function summary(scored: ScoredForecast[]) {
  const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return { n: scored.length, brier: mean(scored.map(s => s.brier)), log: mean(scored.map(s => s.log)), priceBrier: mean(scored.map(s => s.priceBrier)), modelBrier: mean(scored.map(s => s.modelBrier)) };
}
