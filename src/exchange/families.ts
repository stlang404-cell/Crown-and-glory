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

/**
 * The remaining fixtures of one circuit, prepared once for a Monte Carlo run: member indices and the cumulative
 * W / W+D thresholds of each pairing. wdl depends only on the two public ratings, so computing it once per pairing
 * instead of once per simulated game gives exactly the same draws (`u < w ? 1 : u < w + d ? ½ : 0`) as before —
 * the per-game work is then one PRNG call and two comparisons (docs/FEDERATION_SCALE.md §1.5).
 */
interface PreparedCircuit { members: string[]; played: G[]; base: Float64Array; wi: Int32Array; bi: Int32Array; pw: Float64Array; pwd: Float64Array; pairs: [string, string][]; res: Float64Array; pts: Float64Array }
function prepareCircuit(members: string[], played: G[], fromRound: number, lastRound: number, rating: (id: string) => number): PreparedCircuit {
  const rr = roundRobin(members);
  const ix = new Map(members.map((m, i) => [m, i]));
  const rt = members.map(m => rating(m));
  const base = new Float64Array(members.length);
  for (const g of played) if (g.result !== null) { const wi = ix.get(g.white), bi = ix.get(g.black); if (wi !== undefined) base[wi] += g.result; if (bi !== undefined) base[bi] += 1 - g.result; }
  const wi: number[] = [], bi: number[] = [], pw: number[] = [], pwd: number[] = [], pairs: [string, string][] = [];
  for (let r = fromRound; r <= lastRound; r++) for (const [w, b] of rr[(r - 1) % rr.length] ?? []) {
    const a = ix.get(w)!, d = ix.get(b)!;
    const p = wdl(rt[a], rt[d], NU);
    wi.push(a); bi.push(d); pw.push(p.w); pwd.push(p.w + p.d); pairs.push([w, b]);
  }
  return { members, played, base, wi: Int32Array.from(wi), bi: Int32Array.from(bi), pw: Float64Array.from(pw), pwd: Float64Array.from(pwd), pairs, res: new Float64Array(wi.length), pts: new Float64Array(members.length) };
}
/** One simulated completion of a prepared circuit (fills `pts` and `res`, consuming one PRNG draw per game in order). */
function simulateCircuit(c: PreparedCircuit, rnd: () => number): void {
  const { pts, res, wi, bi, pw, pwd } = c;
  pts.set(c.base);
  for (let g = 0; g < wi.length; g++) {
    const u = rnd() / 4294967296;
    const x = u < pw[g] ? 1 : u < pwd[g] ? 0.5 : 0;
    res[g] = x; pts[wi[g]] += x; pts[bi[g]] += 1 - x;
  }
}
/** The full league order of a simulated completion (points, head-to-head, Sonneborn–Berger, seed). */
function simulatedOrder(c: PreparedCircuit): StandingRow[] {
  const games = c.played.concat(c.pairs.map(([w, b], g) => ({ white: w, black: b, result: c.res[g] })));
  return leagueOrder(standings(c.members, games, new Map(c.members.map((m, i) => [m, i + 1]))), games);
}

/** Remaining league rounds of one circuit simulated N times. Returns P(rank 1) and P(top 2) per member. */
export function leagueModel(members: string[], played: G[], fromRound: number, lastRound: number, rating: (id: string) => number, N = 400, seed = 1): { title: Map<string, number>; top2: Map<string, number> } {
  const rnd = mulberry32(seed);
  const title = new Map(members.map(m => [m, 0])), top2 = new Map(members.map(m => [m, 0]));
  // exact fast path: points by array; the full tiebreak order only when 1st or 2nd place is tied on points
  const c = prepareCircuit(members, played, fromRound, lastRound, rating);
  const pts = c.pts;
  for (let k = 0; k < N; k++) {
    simulateCircuit(c, rnd);
    let a = -1, b2 = -1;
    for (let i = 0; i < pts.length; i++) { if (a < 0 || pts[i] > pts[a]) { b2 = a; a = i; } else if (b2 < 0 || pts[i] > pts[b2]) b2 = i; }
    let unique = true;
    for (let i = 0; i < pts.length; i++) if (i !== a && i !== b2 && Math.abs(pts[i] - pts[b2]) <= 1e-9) unique = false;
    if (Math.abs(pts[a] - pts[b2]) <= 1e-9) unique = false;
    let first: string, second: string;
    if (unique) { first = members[a]; second = members[b2]; }
    else { const order = simulatedOrder(c); first = order[0].id; second = order[1].id; }
    title.set(first, title.get(first)! + 1 / N);
    top2.set(first, top2.get(first)! + 1 / N); top2.set(second, top2.get(second)! + 1 / N);
  }
  return { title, top2 };
}

/** Probability that `target` (a Crown Division member) qualifies: wins its division AND is among the 8 best of the
 *  division-1 winners by points (then rating, then id). All division-1 leagues are simulated jointly.
 *
 *  Exact shortcuts (same value as sorting all winners, docs/FEDERATION_SCALE.md §1.5): the winners' order is a strict
 *  total order (points, rating, id), so "target is in the top 8" is "target won its league and fewer than 8 other
 *  winners rank above it". Another league's winner only needs its tiebreaks resolved when its points equal the
 *  target's (otherwise its points alone decide), so the full league order is computed only in that case or when the
 *  target's own league is tied at the top. The PRNG stream is consumed in the same order as before. */
export function qualificationModel(target: string, circuits: { members: string[]; played: G[] }[], fromRound: number, lastRound: number, rating: (id: string) => number, N = 300, seed = 2): number {
  const tc = circuits.findIndex(c => c.members.includes(target));
  if (tc < 0) return 0; // never a division-1 winner
  const rnd = mulberry32(seed);
  let hit = 0;
  const prep = circuits.map(c => prepareCircuit(c.members, c.played, fromRound, lastRound, rating));
  const max = new Float64Array(prep.length), top = new Int32Array(prep.length), tied = new Uint8Array(prep.length);
  const rTarget = rating(target);
  for (let k = 0; k < N; k++) {
    for (let ci = 0; ci < prep.length; ci++) {
      const c = prep[ci];
      simulateCircuit(c, rnd);
      const pts = c.pts;
      let mx = -1, n = 0, at = -1;
      for (let i = 0; i < pts.length; i++) { if (pts[i] > mx + 1e-9) { mx = pts[i]; n = 1; at = i; } else if (Math.abs(pts[i] - mx) <= 1e-9) n++; }
      max[ci] = mx; top[ci] = at; tied[ci] = n === 1 ? 0 : 1;
    }
    const winnerOf = (ci: number) => (tied[ci] ? simulatedOrder(prep[ci])[0].id : prep[ci].members[top[ci]]);
    if (winnerOf(tc) !== target) continue;
    const T = max[tc];
    let above = 0;
    for (let ci = 0; ci < prep.length && above < 8; ci++) {
      if (ci === tc) continue;
      if (max[ci] !== T) { if (max[ci] > T) above++; continue; }
      const w = winnerOf(ci), rw = rating(w);
      if (rTarget - rw < 0 || (rTarget - rw === 0 && w.localeCompare(target) < 0)) above++;
    }
    if (above < 8) hit++;
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
  winner: 'States: every entrant. Trading: until the event\'s first round is processed or its first game starts. Settlement: the champion; joint champions split each share equally. Cancellation: 1/n per share — published conflict rule: if you (the player) enter this event, the market is cancelled at 1/n before your entry takes effect.',
  promotion: 'States: Yes (finishes top two of the division and is promoted) / No. Trading: until the last league round starts. Settlement: the promotion list at season end. Cancellation: ½ per share.',
  qualification: 'States: Yes (qualifies for the Crown Championship as one of the 8 best regional Crown Division winners) / No. Trading: until the last league round starts. Settlement: the Championship field. Cancellation: ½ per share.',
  season: 'States: every member of the division. Trading: until the last league round starts. Settlement: the division title holder (league order: points, head-to-head, Sonneborn–Berger, seed). Cancellation: 1/16 per share.',
  bracket: 'States: the 8 possible final-four paths (both semifinal winners and the champion). Claims pay 1 crown in each state of their set: champion (2 paths), finalist (4 paths), "X beats Y in the final" (1 path). Condition-false pays 0 — a conjunction claim is not refunded if its condition fails. Trading: until the semifinals start. Settlement: the realised path; a joint final splits ½/½ between the two finalists\' paths. Cancellation: |S|/8 per share.',
};
