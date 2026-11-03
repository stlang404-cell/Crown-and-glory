/** Expected-score maps by methodology version. Old reports are always displayed with their own map. */
import v1 from './outcome-map-v1.json';

const KNOTS = (v1 as unknown as { knots: [number, number][] }).knots;

export function logisticU(cp: number, s = 200): number {
  return 1 / (1 + Math.exp(-cp / s));
}

/** crown-outcome-map-v1: monotone piecewise-linear interpolation of the isotonic fit. */
export function mapV1(cp: number): number {
  const x = Math.max(-2000, Math.min(2000, cp));
  if (x <= KNOTS[0][0]) return KNOTS[0][1];
  if (x >= KNOTS[KNOTS.length - 1][0]) return KNOTS[KNOTS.length - 1][1];
  let i = 1;
  while (KNOTS[i][0] < x) i++;
  const [x0, y0] = KNOTS[i - 1], [x1, y1] = KNOTS[i];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

export const OUTCOME_MAP_V1 = (v1 as { id: string }).id;
