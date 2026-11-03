/**
 * Glicko-2 (Glickman, "Example of the Glicko-2 system", 2013) — rating model id crown-glicko2-1.
 *
 * Parameters (research doc 06, design decisions): initial r=1500, RD=350, sigma=0.06, tau=0.5,
 * convergence epsilon 1e-6 (Glickman's paper value; the research doc's 1e-7 is also accepted —
 * we use 1e-7). One completed rated match = one rating period for the player. Published RD is
 * capped at 350. Ratings are internal Crown ratings, not FIDE Elo.
 */
export const GLICKO_MODEL = 'crown-glicko2-1';
export const SCALE = 173.7178;
export const DEFAULTS = { rating: 1500, rd: 350, sigma: 0.06, tau: 0.5, epsilon: 1e-7, maxRd: 350 } as const;

export interface Rating {
  rating: number;
  rd: number;
  sigma: number;
}

export interface Opponent {
  rating: number;
  rd: number;
  /** 1 win, 0.5 draw, 0 loss from the rated player's perspective. */
  score: number;
}

export interface UpdateExplanation {
  mu: number;
  phi: number;
  v: number;
  delta: number;
  expected: number[];
  g: number[];
  sigmaPrime: number;
  phiStar: number;
  iterations: number;
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

/** Expected score of a player vs an opponent (Glicko-2 E with opponent RD). */
export function expectedScore(player: Rating, opp: { rating: number; rd: number }): number {
  return E((player.rating - 1500) / SCALE, (opp.rating - 1500) / SCALE, opp.rd / SCALE);
}

/** Update a rating with all results of one rating period. Empty results = inactivity (RD grows). */
export function updateRating(
  player: Rating,
  results: Opponent[],
  tau: number = DEFAULTS.tau,
  epsilon: number = DEFAULTS.epsilon,
): { after: Rating; explanation: UpdateExplanation | null } {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.sigma;
  if (!results.length) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { after: { rating: player.rating, rd: Math.min(phiStar * SCALE, DEFAULTS.maxRd), sigma }, explanation: null };
  }
  const gs: number[] = [], es: number[] = [];
  let vInv = 0, sum = 0;
  for (const o of results) {
    const muj = (o.rating - 1500) / SCALE, phij = o.rd / SCALE;
    const gj = g(phij), ej = E(mu, muj, phij);
    gs.push(gj); es.push(ej);
    vInv += gj * gj * ej * (1 - ej);
    sum += gj * (o.score - ej);
  }
  const v = 1 / vInv;
  const delta = v * sum;

  // Step 5: volatility via the Illinois algorithm (Glickman's stable bracketed root find).
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) ** 2;
    return num / den - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A), fB = f(B);
  let iterations = 0;
  while (Math.abs(B - A) > epsilon && iterations < 200) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA = fA / 2;
    B = C; fB = fC;
    iterations++;
  }
  const sigmaPrime = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * sum;
  return {
    after: { rating: muPrime * SCALE + 1500, rd: Math.min(phiPrime * SCALE, DEFAULTS.maxRd), sigma: sigmaPrime },
    explanation: { mu, phi, v, delta, expected: es, g: gs, sigmaPrime, phiStar, iterations },
  };
}

export const initialRating = (): Rating => ({ rating: DEFAULTS.rating, rd: DEFAULTS.rd, sigma: DEFAULTS.sigma });

/** Provisional until at least 20 eligible games AND RD <= 100 (research doc 06 design thresholds). */
export const isProvisional = (games: number, rd: number): boolean => games < 20 || rd > 100;
