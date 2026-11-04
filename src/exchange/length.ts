/**
 * Match-length model (crown-length-1) for the "Over/Under X.5 plies" market on featured matches.
 *
 * Exact contract definition: the official game record of the fixture (WorldGame.moves) has N plies (half-moves).
 * "Over X.5" pays $1 if N ≥ X + 1; "Under X.5" pays $1 if N ≤ X. A game stopped by the 400-ply playing limit has
 * N = 400 on its record and therefore settles Over (any listed line is below 400). VOID (cancelled at ½ per share): the
 * fixture never gets an official game record (e.g. the market is cancelled by the federation).
 *
 * Information policy: public ratings only (never latent strength). Coefficients come from tools/market/fit-length.ts
 * (maximum likelihood on 2,400 federation-style engine games, validated on 800 held-out games); nothing is hand-tuned.
 *   logit P(N > X) = c · [1, u, L, G, L·u, G·u],  u = ln(X/60),  L = clamp((mean rating − 2200)/400),  G = clamp(|gap|/400)
 */
import COEF from './length-coefficients.json';

export interface LengthCoefficients { id: string; c: number[]; levelMin: number; levelMax: number; gapMax: number }
export const LENGTH: LengthCoefficients = COEF as LengthCoefficients;
export const LENGTH_MODEL_ID: string = LENGTH.id;

export function lengthFeatures(white: { rating: number }, black: { rating: number }, X: number, c: LengthCoefficients = LENGTH): number[] {
  const L = Math.max(c.levelMin, Math.min(c.levelMax, ((white.rating + black.rating) / 2 - 2200) / 400));
  const G = Math.min(c.gapMax, Math.abs(white.rating - black.rating) / 400);
  const u = Math.log(Math.max(1, X) / 60);
  return [1, u, L, G, L * u, G * u];
}
/** P(official ply count > X) from public ratings. */
export function pOver(white: { rating: number }, black: { rating: number }, X: number, c: LengthCoefficients = LENGTH): number {
  const z = lengthFeatures(white, black, X, c).reduce((a, x, i) => a + x * c.c[i], 0);
  return 1 / (1 + Math.exp(-z));
}
/** The listed line X (integer, contract "X.5"): the whole number in [20, 200] whose P(N > X) is closest to ½. */
export function lengthLine(white: { rating: number }, black: { rating: number }, c: LengthCoefficients = LENGTH): number {
  let best = 20, gap = Infinity;
  for (let X = 20; X <= 200; X++) { const d = Math.abs(pOver(white, black, X, c) - 0.5); if (d < gap) { gap = d; best = X; } }
  return best;
}
/** Settlement state of the over/under market for an official ply count: 0 = Over, 1 = Under. */
export const lengthOutcome = (plies: number, line: number): 0 | 1 => (plies > line ? 0 : 1);
