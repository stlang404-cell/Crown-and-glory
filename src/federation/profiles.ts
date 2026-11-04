/**
 * Competitor engine profiles. A competitor's hidden strength (engine-scale latent rating) maps onto calibrated engines.
 *
 * crown-profile-map-2 (v0.10) = crown-profile-map-1 from L1 (800) up to the measured top, plus:
 *  * below L1, the v0.10 beginner levels (crown-error-1, src/engine/calibration-beginners.json, chained down from
 *    L1 = 800): between two calibrated beginner points the error-model parameters are interpolated linearly in the
 *    latent (each parameter is monotone along the chain, so strength should be too; the interpolation itself is an
 *    assumption, not separately measured). From the strongest beginner level (L0a) up to L1 the nearer of the two is
 *    used, exactly as map-1 already does between L1 and L5. Below the weakest measured level (L0d) the competitor
 *    plays L0d: nothing weaker has been calibrated.
 *  * above the measured top (L9 Sovereign Unbound, the strongest configuration ever measured), the engine plays at
 *    the strongest budget allowed on the device (the node cap of the call site); its simulated results still follow
 *    the latent. `strengthNote` says so in words for the UI. No precision is claimed above the measured range.
 * map-1 (unchanged part): below L5 the nearest calibrated sampling level is used; from L5 upward a full search whose
 * node budget interpolates the measured ladder. crown-levels-3 calibration (M4 play engine): 600 nodes ≈ 1976,
 * 4k ≈ 2375, 30k ≈ 2641 → ≈ 118 Elo per doubling over 600→30k (146 for 600→4k, 92 for 4k→30k); M3 was
 * 1911/2302/2628 → 133. The interpolation between calibrated points is an assumption, not separately measured.
 */
import calibration from '../engine/calibration.json';
import beginnerCalibration from '../engine/calibration-beginners.json';
import { BEGINNER_LEVELS, ErrorModel, LEVELS, StrengthProfile } from '../engine/levels';

export const PROFILE_MAP_ID = 'crown-profile-map-2';
/** Elo per doubling of nodes above L5, fitted end-to-end on the calibrated L5–L7 node budgets. */
export const ELO_PER_DOUBLING = 118;

const CAL = (calibration as { levels: { level: number; rating: number }[] }).levels;
const BCAL = (beginnerCalibration as { id: string; levels: { id: string; rating: number; rd: number }[] });
export const BEGINNER_CALIBRATION_ID = BCAL.id;
/** Measured beginner points, weakest first. */
const BEGINNER_POINTS = BEGINNER_LEVELS
  .map(p => ({ profile: p, rating: BCAL.levels.find(l => l.id === p.id)!.rating }))
  .sort((a, b) => a.rating - b.rating);
const rating = (level: number) => CAL.find(c => c.level === level)!.rating;
/** The weakest and strongest measured engine strengths on the Crown scale. */
export const MEASURED_FLOOR = BEGINNER_POINTS[0].rating;
export const MEASURED_TOP = rating(9);

/** Calibrated rating of a beginner level (L0a…L0d), or null. */
export function beginnerRating(id: string): { rating: number; rd: number } | null {
  const l = BCAL.levels.find(x => x.id === id);
  return l ? { rating: l.rating, rd: l.rd } : null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

function beginnerProfile(latent: number): StrengthProfile {
  const pts = BEGINNER_POINTS;
  if (latent <= pts[0].rating) return { ...pts[0].profile, id: `fed-${pts[0].profile.id}` };
  for (let i = 0; i < pts.length - 1; i++) {
    const lo = pts[i], hi = pts[i + 1];
    if (latent > hi.rating) continue;
    if (latent === hi.rating) return { ...hi.profile, id: `fed-${hi.profile.id}` };
    const t = (latent - lo.rating) / (hi.rating - lo.rating);
    const a = lo.profile.error!, b = hi.profile.error!;
    const error: ErrorModel = {
      pRandom: round3(lerp(a.pRandom, b.pRandom, t)), pBlind: round3(lerp(a.pBlind, b.pBlind, t)),
      temperatureCp: Math.round(lerp(a.temperatureCp, b.temperatureCp, t)), marginCp: Math.round(lerp(a.marginCp, b.marginCp, t)),
    };
    const L = Math.round(latent);
    return {
      ...lo.profile, id: `fed-e${L}`, name: 'Federation beginner', error,
      description: `Beginner error model between ${lo.profile.id} and ${hi.profile.id} (random ${Math.round(error.pRandom * 100)} %, blind ${Math.round(error.pBlind * 100)} %)`,
    };
  }
  return { ...pts[pts.length - 1].profile, id: `fed-${pts[pts.length - 1].profile.id}` };
}

export function profileForStrength(latent: number, nodeCap = 2_000_000): StrengthProfile {
  const l1 = rating(1), l5 = rating(5);
  const top = BEGINNER_POINTS[BEGINNER_POINTS.length - 1];
  if (latent < l1) {
    // L0a … L1: nearer of the two (as between L1 and L5); below L0a: interpolated error model
    if (latent >= top.rating) return latent - top.rating < l1 - latent ? { ...top.profile, id: `fed-${top.profile.id}` } : { ...LEVELS[0], id: `fed-${LEVELS[0].id}` };
    return beginnerProfile(latent);
  }
  if (latent < l5) {
    let best = LEVELS[0], d = Infinity;
    for (const lv of LEVELS.slice(0, 5)) { const r = rating(lv.level); if (Math.abs(r - latent) < d) { d = Math.abs(r - latent); best = lv; } }
    return { ...best, id: `fed-${best.id}` };
  }
  // above the measured top the engine plays at the strongest budget allowed here (Decision 1, docs/V10_PLAN.md)
  const nodes = latent > MEASURED_TOP ? nodeCap : Math.min(nodeCap, Math.round(600 * Math.pow(2, (latent - l5) / ELO_PER_DOUBLING)));
  return { level: 0, id: `fed-n${nodes}`, name: 'Federation', depth: 64, nodes, maxTimeMs: 6_000, selection: null, description: `Full search, ${nodes.toLocaleString('en')} nodes per move` };
}

export interface StrengthNote {
  /** below-measured: plays the weakest measured level; beginner: calibrated error model (sub-800); ladder: L1–L5;
   *  budget: node budget inside the measured range; capped: budget reduced to the call site's cap (e.g. featured
   *  games); beyond-measured: rated above the strongest measured engine. */
  kind: 'below-measured' | 'beginner' | 'ladder' | 'budget' | 'capped' | 'beyond-measured';
  /** Plain words for the UI, or null when nothing needs saying. */
  text: string | null;
}

/** What the engine behind a strength actually does, in words (used where competitors' games are computed). */
export function strengthNote(latentOrRating: number, nodeCap = 2_000_000): StrengthNote {
  const r = latentOrRating;
  const top = (Math.round(MEASURED_TOP / 50) * 50).toLocaleString('en');
  if (r > MEASURED_TOP) return { kind: 'beyond-measured', text: `Above the measured range: when moves at this level are actually computed (your games, featured and scheduled games), the engine plays at the Federation's strongest measured engine (~${top}) within this device's budget. Simulated results follow the full strength.` };
  if (r < MEASURED_FLOOR) return { kind: 'below-measured', text: `Below the weakest measured engine: games at this level are played by ${BEGINNER_POINTS[0].profile.id} ${BEGINNER_POINTS[0].profile.name} (~${MEASURED_FLOOR}), the weakest calibrated beginner engine.` };
  if (r < rating(1)) return { kind: 'beginner', text: 'Beginner level (under 800): games at this level are played by calibrated beginner engines that miss threats and sometimes move at random.' };
  if (r < rating(5)) return { kind: 'ladder', text: null };
  const p = profileForStrength(r, nodeCap);
  const uncapped = profileForStrength(r);
  if (p.nodes < uncapped.nodes) return { kind: 'capped', text: `Plays with a reduced budget here (${p.nodes.toLocaleString('en')} nodes per move).` };
  return { kind: 'budget', text: null };
}
