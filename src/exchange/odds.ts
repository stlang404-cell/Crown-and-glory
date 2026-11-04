/**
 * Match odds model (crown-odds-2) — pre-game and in-play W/D/L for featured AI matches.
 *
 * Information policy: inputs are PUBLIC only — the two public ratings and RDs, the ply count, the published
 * position's material (from the published moves) and the moving engine's own published evaluation. Hidden
 * latent strength is never an input. Every coefficient is read from `odds-coefficients.json`, written by the
 * fitter (tools/odds/fit.ts) together with its fit metadata; nothing here is hand-tuned.
 *
 * Model (an ordered logit on one latent "White advantage" x with symmetric draw thresholds ±θ):
 *   P(White wins) = σ(x − θ),  P(Black wins) = σ(−x − θ),  P(draw) = 1 − both.
 * Pre-game:
 *   g  = 1 / √(1 + γ·3q²(RDw² + RDb²)/π²),  q = ln10/400            (Glicko-style RD deflation of the gap)
 *   x0 = β·q·g·(Rw − Rb) + α                                         (α = White's first-move advantage)
 *   θ0 = exp(t0 + t1·L),  L = ((Rw + Rb)/2 − 2200)/400               (draw width rises or falls with level;
 *        L is clamped to the range of mean ratings seen in the fit data — no extrapolation)
 *   γ = 1 is Glicko's own g(RD) (the fit data cannot identify a free γ; see docs/ODDS_MODEL.md).
 * In play, after ply n ≥ 1 with the published evaluation e (White's point of view):
 *   s  = clamp(e_cp, ±C)/100   (mate scores → ±C/100)
 *   x  = a(n)·x0 + b(n)·s,   θ = θ0·exp(d(n) + m·(1 − material/startMaterial))
 * a, b, d are piecewise linear in ply over fitted knots with a(0) = 1, b(0) = 0, d(0) = 0, so the ply-0 live
 * forecast is exactly the pre-game forecast and the weight moves from the rating prior to the evaluation as
 * the fit dictates. Coherence: the three probabilities are positive and sum to 1; P(White) is non-decreasing and
 * P(Black) non-increasing in e when b ≥ 0 (the fitter constrains b ≥ 0); swapping colours (ratings swapped,
 * e → −e) mirrors the forecast exactly except for the fitted first-move term α.
 */
import COEF from './odds-coefficients.json';
import type { EngineScore } from '../analysis/types';

export interface OddsCoefficients {
  id: string;
  pre: { beta: number; gamma: number; alpha: number; t0: number; t1: number; levelMin: number; levelMax: number };
  live: { knots: number[]; a: number[]; b: number[]; d: number[]; m: number; clampCp: number };
  fit?: unknown;
}
export const ODDS: OddsCoefficients = COEF as OddsCoefficients;
export const ODDS_MODEL_ID: string = ODDS.id;

export interface PublicRating { rating: number; rd: number }
export interface Wdl { w: number; d: number; l: number }

const Q = Math.LN10 / 400;
const sig = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
/** Starting non-pawn material of the Crown position (2 rooks, 2 knights, 1 queen per side; N3 R5 Q9). */
export const START_MATERIAL = 2 * (2 * 5 + 2 * 3 + 9);

export function ordered(x: number, theta: number): Wdl {
  const w = sig(x - theta), l = sig(-x - theta);
  return { w, d: Math.max(0, 1 - w - l), l };
}

export function pregameLatent(white: PublicRating, black: PublicRating, c: OddsCoefficients = ODDS): { x: number; theta: number } {
  const p = c.pre;
  const g = 1 / Math.sqrt(1 + (p.gamma * 3 * Q * Q * (white.rd ** 2 + black.rd ** 2)) / (Math.PI ** 2));
  const L = Math.max(p.levelMin, Math.min(p.levelMax, ((white.rating + black.rating) / 2 - 2200) / 400));
  return { x: p.beta * Q * g * (white.rating - black.rating) + p.alpha, theta: Math.exp(p.t0 + p.t1 * L) };
}

/** Pre-game W/D/L from public ratings and RDs (White first). */
export function pregameWdl(white: PublicRating, black: PublicRating, c: OddsCoefficients = ODDS): Wdl {
  const { x, theta } = pregameLatent(white, black, c);
  return ordered(x, theta);
}

/** Piecewise-linear interpolation over the knots (constant beyond the last knot). */
export function knotValue(knots: number[], values: number[], ply: number): number {
  if (ply <= knots[0]) return values[0];
  for (let i = 1; i < knots.length; i++) if (ply <= knots[i]) return values[i - 1] + ((values[i] - values[i - 1]) * (ply - knots[i - 1])) / (knots[i] - knots[i - 1]);
  return values[values.length - 1];
}

/** Published evaluation (any point of view) → White-POV centipawns, mates/terminal as ±∞. */
export function whiteCp(s: EngineScore): number {
  const sign = s.pov === 'white' ? 1 : -1;
  if (s.kind === 'cp') return sign * s.value;
  if (s.kind === 'mate') return sign * (s.plies > 0 ? Infinity : -Infinity);
  return s.outcome === 'draw' ? 0 : sign * (s.outcome === 'win' ? Infinity : -Infinity);
}

/** Non-pawn material on a published FEN board (both sides). */
export function materialOfFen(fen: string): number {
  const v: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };
  let m = 0;
  for (const ch of fen.split(' ')[0]) m += v[ch.toLowerCase()] ?? 0;
  return m;
}

export interface LiveInput { white: PublicRating; black: PublicRating; ply: number; evalCp: number; material: number }

/** In-play W/D/L after `ply` published moves. At ply 0 this is the pre-game forecast. */
export function liveWdl(inp: LiveInput, c: OddsCoefficients = ODDS): Wdl {
  const { x: x0, theta: th0 } = pregameLatent(inp.white, inp.black, c);
  if (inp.ply <= 0) return ordered(x0, th0);
  const L = c.live;
  const cp = Number.isNaN(inp.evalCp) ? 0 : Math.max(-L.clampCp, Math.min(L.clampCp, inp.evalCp));
  const a = knotValue(L.knots, L.a, inp.ply), b = knotValue(L.knots, L.b, inp.ply), d = knotValue(L.knots, L.d, inp.ply);
  const lost = 1 - Math.max(0, Math.min(START_MATERIAL, inp.material)) / START_MATERIAL;
  return ordered(a * x0 + b * (cp / 100), th0 * Math.exp(d + L.m * lost));
}

/** The live forecast as the market's state vector [White, Draw, Black], each ≥ `floor`, summing to 1. */
export function liveModelVector(inp: LiveInput, floor = 0.005, c: OddsCoefficients = ODDS): number[] {
  const p = liveWdl(inp, c);
  const v = [p.w, p.d, p.l].map(x => Math.max(floor, x));
  const s = v[0] + v[1] + v[2];
  return v.map(x => x / s);
}
