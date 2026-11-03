/**
 * Competitor engine profiles (crown-profile-map-1). A competitor's hidden strength (engine-scale latent
 * rating) maps onto the calibrated level ladder: below L5 (1911) the nearest calibrated sampling level is
 * used; from L5 upward a full search whose node budget interpolates the measured ladder
 * (600 nodes ≈ 1911, 4k ≈ 2302, 30k ≈ 2628 → ≈ 133 Elo per doubling), capped for speed in featured games.
 * The interpolation between calibrated points is an assumption, not separately measured.
 */
import calibration from '../engine/calibration.json';
import { LEVELS, StrengthProfile } from '../engine/levels';

const CAL = (calibration as { levels: { level: number; rating: number }[] }).levels;

export function profileForStrength(latent: number, nodeCap = 2_000_000): StrengthProfile {
  const l5 = CAL.find(c => c.level === 5)!.rating;
  if (latent < l5) {
    let best = LEVELS[0], d = Infinity;
    for (const lv of LEVELS.slice(0, 5)) { const r = CAL.find(c => c.level === lv.level)!.rating; if (Math.abs(r - latent) < d) { d = Math.abs(r - latent); best = lv; } }
    return { ...best, id: `fed-${best.id}` };
  }
  const nodes = Math.min(nodeCap, Math.round(600 * Math.pow(2, (latent - l5) / 133)));
  return { level: 0, id: `fed-n${nodes}`, name: 'Federation', depth: 64, nodes, maxTimeMs: 6_000, selection: null, description: `Full search, ${nodes.toLocaleString('en')} nodes per move` };
}
