/**
 * Competitor engine profiles (crown-profile-map-1). A competitor's hidden strength (engine-scale latent
 * rating) maps onto the calibrated level ladder: below L5 the nearest calibrated sampling level is
 * used; from L5 upward a full search whose node budget interpolates the measured ladder, capped for speed in
 * featured games. crown-levels-3 calibration (M4 play engine): 600 nodes ≈ 1976, 4k ≈ 2375, 30k ≈ 2641 →
 * ≈ 118 Elo per doubling over 600→30k (146 for 600→4k, 92 for 4k→30k); M3 was 1911/2302/2628 → 133.
 * The interpolation between calibrated points is an assumption, not separately measured.
 */
import calibration from '../engine/calibration.json';
import { LEVELS, StrengthProfile } from '../engine/levels';

/** Elo per doubling of nodes above L5, fitted end-to-end on the calibrated L5–L7 node budgets. */
export const ELO_PER_DOUBLING = 118;

const CAL = (calibration as { levels: { level: number; rating: number }[] }).levels;

export function profileForStrength(latent: number, nodeCap = 2_000_000): StrengthProfile {
  const l5 = CAL.find(c => c.level === 5)!.rating;
  if (latent < l5) {
    let best = LEVELS[0], d = Infinity;
    for (const lv of LEVELS.slice(0, 5)) { const r = CAL.find(c => c.level === lv.level)!.rating; if (Math.abs(r - latent) < d) { d = Math.abs(r - latent); best = lv; } }
    return { ...best, id: `fed-${best.id}` };
  }
  const nodes = Math.min(nodeCap, Math.round(600 * Math.pow(2, (latent - l5) / ELO_PER_DOUBLING)));
  return { level: 0, id: `fed-n${nodes}`, name: 'Federation', depth: 64, nodes, maxTimeMs: 6_000, selection: null, description: `Full search, ${nodes.toLocaleString('en')} nodes per move` };
}
