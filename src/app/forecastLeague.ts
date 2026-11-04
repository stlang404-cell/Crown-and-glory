/**
 * Forecasting League and Calibration Challenge (crown-forecast-league-1). No money: forecasting never pays, costs or
 * counts toward chess or financial prestige.
 *
 * The league: every season, your resolved paper forecasts are ranked against SIMULATED forecasters (clearly labelled;
 * they are formulas, not people). Fairness by construction: each simulated forecaster forecasts exactly the markets
 * you forecast, from exactly the public information you had — the published model and market-price snapshot stored
 * with your forecast at the moment you made it (crown-forecast-1). None of them sees a result, a hidden strength or
 * anything published later. Ranking: mean Brier score over those markets (lower is better); you qualify for a rank
 * with at least MIN_FORECASTS resolved forecasts in the season. Brier skill score against the market price:
 * BSS = 1 − B_you / B_price (above 0 = more accurate than the price you could have traded at).
 *
 * The calibration challenge: expected calibration error ECE = Σ_bins (n_b / N)·|mean p_b − observed freq_b| over every
 * probability you gave (ten 10%-bins, crown-forecast-1 pooling). Grades need at least CAL_MIN_PAIRS probabilities.
 */
import type { Market } from '../exchange/market';
import { brier, calibration, scoreAll, ScoredForecast, ForecastRecord } from './forecasting';

export const LEAGUE_ID = 'crown-forecast-league-1';
export const MIN_FORECASTS = 5;
export const CAL_MIN_PAIRS = 30;

export interface SimForecaster { id: string; name: string; description: string; forecast: (f: ForecastRecord) => number[] | null }

const norm = (v: number[]) => { const s = v.reduce((a, x) => a + x, 0); return s > 0 ? v.map(x => x / s) : v.map(() => 1 / v.length); };
/** Deterministic noise in [−1, 1) from the market id (no Math.random: the league table is reproducible). */
function noise(id: string, i: number): number {
  let h = 2166136261;
  for (const ch of `${id}#${i}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h / 4294967296) * 2 - 1;
}

/** The simulated field. Each reads only the snapshot stored with your forecast (public model and market price). */
export const SIM_FORECASTERS: SimForecaster[] = [
  { id: 'sim:model', name: 'Meridian Model (simulated)', description: 'States the published public forecast exactly.', forecast: f => f.model ?? null },
  { id: 'sim:crowd', name: 'The Crowd (simulated)', description: 'States the market prices at the time of your forecast.', forecast: f => f.prices ?? null },
  { id: 'sim:hot', name: 'Hot Hand (simulated)', description: 'Overconfident: sharpens the public forecast (probabilities raised to the power 1.6).', forecast: f => (f.model ? norm(f.model.map(p => p ** 1.6)) : null) },
  { id: 'sim:hedger', name: 'Steady Hedger (simulated)', description: 'Underconfident: 60% public forecast, 40% equal chances.', forecast: f => (f.model ? f.model.map(p => 0.6 * p + 0.4 / f.model!.length) : null) },
  { id: 'sim:fan', name: 'Favourite Fans (simulated)', description: 'Adds 8 points to the public favourite.', forecast: f => { if (!f.model) return null; const k = f.model.indexOf(Math.max(...f.model)); return norm(f.model.map((p, i) => (i === k ? p + 0.08 : p))); } },
  { id: 'sim:novice', name: 'Noisy Novice (simulated)', description: 'The public forecast plus seeded noise of up to ±10 points per outcome.', forecast: f => (f.model ? norm(f.model.map((p, i) => Math.max(0.01, p + 0.1 * noise(f.marketId, i)))) : null) },
  { id: 'sim:coin', name: 'Coin Flipper (simulated)', description: 'Equal chances for every outcome.', forecast: f => f.probs.map(() => 1 / f.probs.length) },
];

export interface LeagueRow { id: string; name: string; simulated: boolean; n: number; brier: number; rank: number; description: string }
export interface LeagueTable { season: number; n: number; qualified: boolean; rows: LeagueRow[]; youRank: number | null; skillVsPrice: number | null }

/** League table for one season (markets of that season with your resolved forecasts). */
export function leagueTable(forecasts: ForecastRecord[], markets: Map<string, Market>, season: number): LeagueTable {
  const sc = scoreAll(forecasts, markets).filter(s => s.market.season === season);
  return tableOf(sc, season);
}
function tableOf(sc: ScoredForecast[], season: number): LeagueTable {
  const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
  const rows: Omit<LeagueRow, 'rank'>[] = [{ id: 'you', name: 'You', simulated: false, n: sc.length, brier: mean(sc.map(s => s.brier)), description: 'Your paper forecasts.' }];
  for (const f of SIM_FORECASTERS) {
    const scores = sc.map(s => { const p = f.forecast(s.f); return p && p.length === s.y.length ? brier(p, s.y) : null; }).filter((x): x is number => x !== null);
    if (scores.length === sc.length && sc.length) rows.push({ id: f.id, name: f.name, simulated: true, n: scores.length, brier: mean(scores), description: f.description });
  }
  const sorted = [...rows].sort((a, b) => a.brier - b.brier || (a.simulated === b.simulated ? a.id.localeCompare(b.id) : a.simulated ? 1 : -1));
  const ranked = sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  const qualified = sc.length >= MIN_FORECASTS;
  const price = sc.map(s => s.priceBrier).filter((x): x is number => x !== null);
  const you = mean(sc.map(s => s.brier));
  return { season, n: sc.length, qualified, rows: ranked, youRank: qualified ? ranked.find(r => r.id === 'you')!.rank : null, skillVsPrice: sc.length && price.length === sc.length && mean(price) > 0 ? 1 - you / mean(price) : null };
}

export interface CalibrationGrade { pairs: number; ece: number | null; grade: 'Unrated' | 'Well calibrated' | 'Fairly calibrated' | 'Poorly calibrated'; direction: 'overconfident' | 'underconfident' | 'balanced' | null }
/** Calibration challenge over all resolved forecasts. Thresholds: ECE ≤ 0.05 well, ≤ 0.10 fairly, else poorly. */
export function calibrationGrade(forecasts: ForecastRecord[], markets: Map<string, Market>): CalibrationGrade {
  const sc = scoreAll(forecasts, markets);
  const bins = calibration(sc);
  const N = bins.reduce((a, b) => a + b.n, 0);
  if (N < CAL_MIN_PAIRS) return { pairs: N, ece: null, grade: 'Unrated', direction: null };
  const ece = bins.reduce((a, b) => a + (b.n / N) * Math.abs(b.meanP - b.freq), 0);
  // over/underconfidence: high-probability bins happening less often than stated (and low ones more often) = overconfident
  let signed = 0;
  for (const b of bins) if (b.n) signed += (b.n / N) * (b.meanP - b.freq) * (b.meanP >= 0.5 ? 1 : -1);
  return { pairs: N, ece, grade: ece <= 0.05 ? 'Well calibrated' : ece <= 0.1 ? 'Fairly calibrated' : 'Poorly calibrated', direction: Math.abs(signed) < 0.01 ? 'balanced' : signed > 0 ? 'overconfident' : 'underconfident' };
}

/** Seasons with at least one resolved forecast, newest first. */
export function leagueSeasons(forecasts: ForecastRecord[], markets: Map<string, Market>): number[] {
  return [...new Set(scoreAll(forecasts, markets).map(s => s.market.season))].sort((a, b) => b - a);
}
