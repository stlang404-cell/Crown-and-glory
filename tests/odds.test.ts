/** crown-odds-2 match odds model: coherence, monotonicity, colour symmetry, rating-gap direction (bug #21), draw rates. */
import { describe, it, expect } from 'vitest';
import { ODDS, ODDS_MODEL_ID, OddsCoefficients, liveWdl, liveModelVector, pregameWdl, pregameLatent, whiteCp, materialOfFen, START_MATERIAL } from '../src/exchange/odds';
import { mulberry32 } from '../src/rules/tables';

const pr = (rating: number, rd = 80) => ({ rating, rd });
const live = (rw: number, rb: number, ply: number, evalCp: number, material = START_MATERIAL, c?: OddsCoefficients) => liveWdl({ white: pr(rw), black: pr(rb), ply, evalCp, material }, c);
const noWhiteEdge: OddsCoefficients = { ...ODDS, pre: { ...ODDS.pre, alpha: 0 } };

describe('crown-odds-2 coefficients', () => {
  it('carry an id and fit metadata from the fitter (no hand-set coefficients)', () => {
    expect(ODDS_MODEL_ID).toBe('crown-odds-2');
    const fit = ODDS.fit as { trainGames: number; testGames: number; method: string };
    expect(fit.trainGames).toBeGreaterThan(1000);
    expect(fit.testGames).toBeGreaterThan(300);
    expect(ODDS.live.b.every(x => x >= 0)).toBe(true); // monotonicity constraint of the fit
    expect(ODDS.live.a[0]).toBe(1);
    expect(ODDS.live.b[0]).toBe(0);
  });
});

describe('coherence', () => {
  it('probabilities are in (0,1) and sum to 1 for random public inputs', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 3000; i++) {
      const rw = 900 + 2100 * r(), rb = 900 + 2100 * r();
      const inp = { white: pr(rw, 40 + 300 * r()), black: pr(rb, 40 + 300 * r()), ply: Math.floor(400 * r()), evalCp: (r() - 0.5) * 4000, material: Math.floor(60 * r()) };
      const p = liveWdl(inp);
      for (const x of [p.w, p.d, p.l]) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1); }
      expect(p.w + p.d + p.l).toBeCloseTo(1, 12);
      const v = liveModelVector(inp);
      expect(v.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 12);
      expect(Math.min(...v)).toBeGreaterThan(0.004);
    }
  });
  it('mate scores give finite, extreme forecasts', () => {
    const p = live(2300, 2300, 30, whiteCp({ kind: 'mate', plies: 3, pov: 'black', proven: false }));
    expect(p.l).toBeGreaterThan(0.9);
    expect(Number.isFinite(p.w + p.d + p.l)).toBe(true);
  });
  it('ply 0 of the live model is exactly the pre-game forecast', () => {
    const a = live(2400, 2250, 0, 0), b = pregameWdl(pr(2400), pr(2250));
    expect(a).toEqual(b);
  });
  it('is deterministic', () => {
    expect(live(2310, 2280, 17, 35, 41)).toEqual(live(2310, 2280, 17, 35, 41));
  });
});

describe('monotone in the published evaluation', () => {
  it('P(White) never falls and P(Black) never rises as the evaluation improves for White', () => {
    for (const ply of [1, 5, 10, 20, 40, 80, 160, 300]) for (const [rw, rb] of [[2300, 2300], [2500, 2200], [1800, 2300]]) {
      let prev = live(rw, rb, ply, -3000);
      for (let cp = -2950; cp <= 3000; cp += 50) {
        const p = live(rw, rb, ply, cp);
        expect(p.w).toBeGreaterThanOrEqual(prev.w - 1e-12);
        expect(p.l).toBeLessThanOrEqual(prev.l + 1e-12);
        prev = p;
      }
    }
  });
});

describe('colour symmetry', () => {
  it('swapping colours (ratings swapped, evaluation negated) mirrors the forecast exactly without the first-move term', () => {
    const r = mulberry32(11);
    for (let i = 0; i < 500; i++) {
      const rw = 1200 + 1600 * r(), rb = 1200 + 1600 * r(), ply = Math.floor(200 * r()), cp = (r() - 0.5) * 1200, mat = Math.floor(50 * r());
      const p = live(rw, rb, ply, cp, mat, noWhiteEdge), q = live(rb, rw, ply, -cp, mat, noWhiteEdge);
      expect(p.w).toBeCloseTo(q.l, 12); expect(p.l).toBeCloseTo(q.w, 12); expect(p.d).toBeCloseTo(q.d, 12);
    }
  });
  it('with the fitted first-move term, the mirror differs only by 2α on the latent scale', () => {
    const a = pregameLatent(pr(2450), pr(2300)), b = pregameLatent(pr(2300), pr(2450));
    expect(a.x + b.x).toBeCloseTo(2 * ODDS.pre.alpha, 12);
    expect(a.theta).toBeCloseTo(b.theta, 12);
  });
});

describe('the rating gap moves prices in the right direction (bug #21)', () => {
  it('pre-game: a higher-rated White is more likely to win and less likely to lose', () => {
    let prev = pregameWdl(pr(2300), pr(2600));
    for (let gap = -250; gap <= 300; gap += 50) {
      const p = pregameWdl(pr(2300 + gap), pr(2300));
      expect(p.w).toBeGreaterThan(prev.w); expect(p.l).toBeLessThan(prev.l);
      prev = p;
    }
  });
  it('early live: at an equal evaluation the favourite is still the favourite', () => {
    for (const ply of [1, 10, 20]) {
      const fav = live(2500, 2200, ply, 0), dog = live(2200, 2500, ply, 0), eq = live(2350, 2350, ply, 0);
      expect(fav.w).toBeGreaterThan(eq.w + 0.05);
      expect(fav.w - fav.l).toBeGreaterThan(0.15);
      expect(dog.l - dog.w).toBeGreaterThan(0.1);
    }
  });
  it('a wider rating uncertainty (RD) shrinks the favourite\'s edge', () => {
    const sure = pregameWdl(pr(2500, 50), pr(2200, 50)), unsure = pregameWdl(pr(2500, 300), pr(2200, 300));
    expect(unsure.w).toBeLessThan(sure.w);
    expect(unsure.l).toBeGreaterThan(sure.l);
  });
});

describe('draw rates between equal ratings', () => {
  it('are sensible and rise with the level of play (fitted on engine games)', () => {
    const d = [1500, 1900, 2300, 2600].map(x => pregameWdl(pr(x), pr(x)).d);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
    expect(d[0]).toBeGreaterThan(0.01); expect(d[0]).toBeLessThan(0.25);
    expect(d[3]).toBeGreaterThan(0.15); expect(d[3]).toBeLessThan(0.5);
    const p = pregameWdl(pr(2400), pr(2400));
    expect(Math.abs(p.w - p.l)).toBeLessThan(0.25); // only the first-move edge separates them
  });
});

describe('public inputs', () => {
  it('reads material from the published FEN', () => {
    expect(materialOfFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1')).toBe(START_MATERIAL);
    expect(materialOfFen('3k2/6/6/6/6/2K1R1 w - - 0 1')).toBe(5);
  });
});
