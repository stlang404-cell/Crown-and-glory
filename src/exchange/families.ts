/**
 * Grand Exchange market families (crown-markets-2) — outcome spaces, published models and rules.
 * Every model reads PUBLIC ratings only (never hidden strength) and is information, not price: the LMSR
 * inventory moves only through funded trades (research doc 09).
 *
 * Canonical event clusters per season (no two concurrently listed contracts duplicate a payoff):
 *   match       — featured AI match W/D/L (pre-match, and in-play when watched live)
 *   winner      — Federation Open champion (32 states) and Crown Championship champion (16 states)
 *   promotion   — binary: one contender in another region's division finishes top two
 *   qualification — binary: one Crown Division contender of a third region qualifies for the Championship
 *   season      — categorical: the Crown Division title of a fourth region (16 states)
 *   bracket     — bounded conditional model: the Championship final four, 2^3 = 8 bracket paths, with
 *                 champion, finalist and conjunction ("X beats Y in the final") claims on one ledger
 */
import { wdl, NU } from '../federation/resultModel';
import { roundRobin, standings, leagueOrder, swissOrder, swissPairing, StandingRow } from '../federation/formats';
import { mulberry32 } from '../rules/tables';

export const MARKETS_ID = 'crown-markets-2';
export const FAMILY_B: Record<string, number> = { match: 120, winner: 150, promotion: 80, qualification: 80, season: 100, bracket: 100 };

// ---------------------------------------------------------------- knockout match probabilities
/** Distribution of a's score over a two-game pair: [P(>1), P(=1), P(<1)]. Colours alternate, so W/L are symmetric. */
function pairDist(ra: number, rb: number): [number, number, number] {
  const g = wdl(ra, rb, NU), h = wdl(rb, ra, NU); // a as White, then a as Black (h.l = a wins as Black)
  const A = [g.l, g.d, g.w], B = [h.w, h.d, h.l]; // a's score distribution per game: index = 0, ½, 1
  const dist = [0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dist[i + j] += A[i] * B[j];
  return [dist[3] + dist[4], dist[2], dist[0] + dist[1]];
}
/** Probability that a advances (and, in the final, of a joint title) under the finite tiebreak policy:
 *  classical pair → rapid pair → blitz pair → higher seed (final: joint champions). */
export function koMatchProb(ra: number, rb: number, seedA: number, seedB: number, final: boolean): { a: number; joint: number } {
  const [w, t] = pairDist(ra, rb);
  const outright = w * (1 + t + t * t);
  const tie3 = t * t * t;
  if (final) return { a: outright, joint: tie3 };
  return { a: outright + (seedA < seedB ? tie3 : 0), joint: 0 };
}

/** Champion probability for a 16-player bracket (stage-0 order; winners of matches 2k and 2k+1 meet).
 *  Joint final titles count half for each finalist (the settlement payout vector does the same). */
export function bracketChampionModel(first: { a: string; b: string; seedA: number; seedB: number }[], rating: (id: string) => number, seed: (id: string) => number): Map<string, number> {
  let slots: Map<string, number>[] = first.map(m => {
    const p = koMatchProb(rating(m.a), rating(m.b), m.seedA, m.seedB, false).a;
    return new Map([[m.a, p], [m.b, 1 - p]]);
  });
  while (slots.length > 1) {
    const final = slots.length === 2;
    const next: Map<string, number>[] = [];
    for (let i = 0; i < slots.length; i += 2) {
      const out = new Map<string, number>();
      for (const [x, px] of slots[i]) for (const [y, py] of slots[i + 1]) {
        const r = koMatchProb(rating(x), rating(y), seed(x), seed(y), final);
        const both = px * py;
        out.set(x, (out.get(x) ?? 0) + both * (r.a + r.joint / 2));
        out.set(y, (out.get(y) ?? 0) + both * (1 - r.a - r.joint / 2));
      }
      next.push(out);
    }
    slots = next;
  }
  return slots[0];
}

// ---------------------------------------------------------------- 8-state final-four model
export interface BracketState { label: string; semi1: string; semi2: string; champion: string }
/** All 2^3 bracket paths for semifinals [p0–p1] and [p2–p3] and the final. State ids include the full path. */
export function bracketStates(p: string[]): BracketState[] {
  const out: BracketState[] = [];
  for (const s1 of [p[0], p[1]]) for (const s2 of [p[2], p[3]]) for (const ch of [s1, s2]) out.push({ label: `${s1} & ${s2} reach the final; ${ch} wins`, semi1: s1, semi2: s2, champion: ch });
  return out;
}
/** Canonical claims: champion (2 states each), finalist (4 states each) and conjunctions "X beats Y in the final"
 *  (1 state each — equivalently "Y reaches the final AND X wins the title"). Identical subsets are never listed twice. */
export function bracketClaims(p: string[], states: BracketState[], name: (id: string) => string = x => x): { id: string; label: string; states: number[] }[] {
  const idx = (f: (s: BracketState) => boolean) => states.map((s, i) => (f(s) ? i : -1)).filter(i => i >= 0);
  const claims: { id: string; label: string; states: number[] }[] = [];
  for (const x of p) claims.push({ id: `champ:${x}`, label: `${name(x)} wins the Championship`, states: idx(s => s.champion === x) });
  for (const x of p) claims.push({ id: `final:${x}`, label: `${name(x)} reaches the final`, states: idx(s => s.semi1 === x || s.semi2 === x) });
  states.forEach((s, i) => {
    const loser = s.champion === s.semi1 ? s.semi2 : s.semi1;
    claims.push({ id: `beats:${s.champion}>${loser}`, label: `${name(s.champion)} beats ${name(loser)} in the final (= ${name(loser)} reaches the final AND ${name(s.champion)} wins)`, states: [i] });
  });
  const seen = new Set<string>();
  return claims.filter(c => { const k = [...c.states].sort((a, b) => a - b).join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
/** Model over the 8 states from public ratings and seeds (joint final split equally between its two paths). */
export function bracketModel(p: string[], states: BracketState[], rating: (id: string) => number, seed: (id: string) => number): number[] {
  const s1 = koMatchProb(rating(p[0]), rating(p[1]), seed(p[0]), seed(p[1]), false).a;
  const s2 = koMatchProb(rating(p[2]), rating(p[3]), seed(p[2]), seed(p[3]), false).a;
  return states.map(s => {
    const ps1 = s.semi1 === p[0] ? s1 : 1 - s1, ps2 = s.semi2 === p[2] ? s2 : 1 - s2;
    const f = koMatchProb(rating(s.semi1), rating(s.semi2), seed(s.semi1), seed(s.semi2), true);
    const pf = s.champion === s.semi1 ? f.a + f.joint / 2 : 1 - f.a - f.joint / 2;
    return ps1 * ps2 * pf;
  });
}
/** Settlement vector for a decided final four: the winning path, or (joint final) half on each finalist's path. */
export function bracketPayout(states: BracketState[], semi1: string, semi2: string, champions: string[]): number[] {
  return states.map(s => (s.semi1 === semi1 && s.semi2 === semi2 && champions.includes(s.champion) ? 1 / champions.length : 0));
}

// ---------------------------------------------------------------- Monte Carlo models (public ratings)
type G = { white: string; black: string; result: number | null };
const draw = (ra: number, rb: number, u: number) => { const p = wdl(ra, rb, NU); return u < p.w ? 1 : u < p.w + p.d ? 0.5 : 0; };

/** Remaining league rounds of one circuit simulated N times. Returns P(rank 1) and P(top 2) per member. */
export function leagueModel(members: string[], played: G[], fromRound: number, lastRound: number, rating: (id: string) => number, N = 400, seed = 1): { title: Map<string, number>; top2: Map<string, number> } {
  const rr = roundRobin(members);
  const rnd = mulberry32(seed);
  const title = new Map(members.map(m => [m, 0])), top2 = new Map(members.map(m => [m, 0]));
  const seeds = new Map(members.map((m, i) => [m, i + 1]));
  for (let k = 0; k < N; k++) {
    const games: G[] = played.slice();
    for (let r = fromRound; r <= lastRound; r++) for (const [w, b] of rr[(r - 1) % rr.length] ?? []) games.push({ white: w, black: b, result: draw(rating(w), rating(b), rnd() / 4294967296) });
    const order = leagueOrder(standings(members, games, seeds), games);
    title.set(order[0].id, title.get(order[0].id)! + 1 / N);
    top2.set(order[0].id, top2.get(order[0].id)! + 1 / N); top2.set(order[1].id, top2.get(order[1].id)! + 1 / N);
  }
  return { title, top2 };
}

/** Probability that `target` (a Crown Division member) qualifies: wins its division AND is among the 8 best of the
 *  16 division-1 winners by points (then rating). All 16 division-1 leagues are simulated jointly. */
export function qualificationModel(target: string, circuits: { members: string[]; played: G[] }[], fromRound: number, lastRound: number, rating: (id: string) => number, N = 300, seed = 2): number {
  const rnd = mulberry32(seed);
  let hit = 0;
  const rrs = circuits.map(c => roundRobin(c.members));
  for (let k = 0; k < N; k++) {
    const winners: StandingRow[] = [];
    circuits.forEach((c, ci) => {
      const games: G[] = c.played.slice();
      for (let r = fromRound; r <= lastRound; r++) for (const [w, b] of rrs[ci][(r - 1) % rrs[ci].length] ?? []) games.push({ white: w, black: b, result: draw(rating(w), rating(b), rnd() / 4294967296) });
      winners.push(leagueOrder(standings(c.members, games, new Map(c.members.map((m, i) => [m, i + 1]))), games)[0]);
    });
    const top8 = winners.sort((a, b) => b.points - a.points || rating(b.id) - rating(a.id) || a.id.localeCompare(b.id)).slice(0, 8).map(r => r.id);
    if (top8.includes(target)) hit++;
  }
  return hit / N;
}

/** Swiss event (5 rounds) simulated N times with the production pairing and tiebreak code. */
export function swissWinnerModel(entrants: string[], seeds: Record<string, number>, rounds: number, rating: (id: string) => number, N = 300, seed = 3): Map<string, number> {
  const rnd = mulberry32(seed);
  const win = new Map(entrants.map(e => [e, 0]));
  const sd = new Map(Object.entries(seeds));
  for (let k = 0; k < N; k++) {
    const games: G[] = [];
    const byes = new Map<string, number>();
    const whites = new Map<string, number>();
    const met = new Set<string>();
    for (let r = 0; r < rounds; r++) {
      const rows = standings(entrants, games, sd, byes);
      const p = swissPairing(rows.map(x => ({ id: x.id, points: x.points, seed: x.seed, whites: whites.get(x.id) ?? 0, hadBye: !!byes.get(x.id) })), met);
      if (p.bye) byes.set(p.bye, (byes.get(p.bye) ?? 0) + 1);
      for (const [w, b] of p.pairs) {
        games.push({ white: w, black: b, result: draw(rating(w), rating(b), rnd() / 4294967296) });
        whites.set(w, (whites.get(w) ?? 0) + 1);
        met.add(w < b ? `${w}|${b}` : `${b}|${w}`);
      }
    }
    const top = swissOrder(standings(entrants, games, sd, byes))[0].id;
    win.set(top, win.get(top)! + 1 / N);
  }
  return win;
}

/** Normalise a model, flooring every state at `floor` so no published probability is exactly 0. */
export function normaliseModel(xs: number[], floor = 0.002): number[] {
  const f = xs.map(x => Math.max(floor, x));
  const s = f.reduce((a, b) => a + b, 0);
  return f.map(x => x / s);
}

// ---------------------------------------------------------------- published rules
export const RULES: Record<string, string> = {
  match: 'States: White wins / Draw / Black wins. Trading: from round opening until the match starts; if you watch it live, also in-play between moves (after each move is published, before the next is computed). Closure: the final move. Settlement: the result. Cancellation (match never played): 1/3 per share.',
  winner: 'States: every entrant. Trading: until the event\'s first round is processed or its first game starts. Settlement: the champion; joint champions split each share equally. Cancellation: 1/n per share.',
  promotion: 'States: Yes (finishes top two of the division and is promoted) / No. Trading: until the last league round starts. Settlement: the promotion list at season end. Cancellation: ½ per share.',
  qualification: 'States: Yes (qualifies for the Crown Championship as one of the 8 best regional Crown Division winners) / No. Trading: until the last league round starts. Settlement: the Championship field. Cancellation: ½ per share.',
  season: 'States: every member of the division. Trading: until the last league round starts. Settlement: the division title holder (league order: points, head-to-head, Sonneborn–Berger, seed). Cancellation: 1/16 per share.',
  bracket: 'States: the 8 possible final-four paths (both semifinal winners and the champion). Claims pay 1 crown in each state of their set: champion (2 paths), finalist (4 paths), "X beats Y in the final" (1 path). Condition-false pays 0 — a conjunction claim is not refunded if its condition fails. Trading: until the semifinals start. Settlement: the realised path; a joint final splits ½/½ between the two finalists\' paths. Cancellation: |S|/8 per share.',
};
