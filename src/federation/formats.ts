/**
 * Competition formats (crown-formats-1). Published rules: docs/V3_COMPETITION_RULES.md.
 */

/** Circle-method round robin. Returns rounds of [white, black] pairs; odd counts get a bye (null). */
export function roundRobin(ids: string[]): [string, string][][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds: [string, string][][] = [];
  const arr = [...list];
  const whites = new Map<string, number>();
  const lastWhite = new Map<string, boolean>();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      // colour balance: fewer whites so far gets White; then whoever did not have White last round; then rotation parity
      const wa = whites.get(a) ?? 0, wb = whites.get(b) ?? 0;
      const aWhite = wa !== wb ? wa < wb : lastWhite.get(a) !== lastWhite.get(b) ? !lastWhite.get(a) : (i + r) % 2 === 0;
      const [w, bl] = aWhite ? [a, b] : [b, a];
      whites.set(w, (whites.get(w) ?? 0) + 1);
      lastWhite.set(w, true); lastWhite.set(bl, false);
      pairs.push([w, bl]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!); // rotate all but the first
  }
  return rounds;
}

export interface StandingRow { id: string; points: number; played: number; w: number; d: number; l: number; sb: number; buchholz: number; buchholzCut1: number; seed: number }
export interface Game { white: string; black: string; result: number | null }

/** Standings with Sonneborn–Berger, Buchholz and Buchholz Cut-1. `seed` = pre-event seed (lower = better). */
export function standings(ids: string[], games: Game[], seeds: Map<string, number>, byes: Map<string, number> = new Map()): StandingRow[] {
  const pts = new Map(ids.map(id => [id, 0]));
  const rows = new Map(ids.map(id => [id, { id, points: 0, played: 0, w: 0, d: 0, l: 0, sb: 0, buchholz: 0, buchholzCut1: 0, seed: seeds.get(id) ?? 9999 }]));
  const opps = new Map<string, { opp: string; score: number }[]>(ids.map(id => [id, []]));
  for (const g of games) {
    if (g.result === null) continue;
    const ws = g.result, bs = 1 - g.result;
    for (const [id, s, o] of [[g.white, ws, g.black], [g.black, bs, g.white]] as [string, number, string][]) {
      const r = rows.get(id); if (!r) continue;
      r.played++; r.points += s; if (s === 1) r.w++; else if (s === 0) r.l++; else r.d++;
      opps.get(id)!.push({ opp: o, score: s });
    }
  }
  for (const [id, b] of byes) { const r = rows.get(id); if (r) { r.points += b; } }
  for (const r of rows.values()) pts.set(r.id, r.points);
  for (const r of rows.values()) {
    const os = opps.get(r.id)!;
    r.sb = os.reduce((a, o) => a + o.score * (pts.get(o.opp) ?? 0), 0);
    const bs = os.map(o => pts.get(o.opp) ?? 0).sort((a, b) => a - b);
    r.buchholz = bs.reduce((a, b) => a + b, 0);
    r.buchholzCut1 = r.buchholz - (bs[0] ?? 0);
  }
  return [...rows.values()];
}

/** League order: points, head-to-head among the tied group, Sonneborn–Berger, pre-season seed. */
export function leagueOrder(rows: StandingRow[], games: Game[]): StandingRow[] {
  const byPts = new Map<number, StandingRow[]>();
  for (const r of rows) byPts.set(r.points, [...(byPts.get(r.points) ?? []), r]);
  const out: StandingRow[] = [];
  for (const p of [...byPts.keys()].sort((a, b) => b - a)) {
    const group = byPts.get(p)!;
    if (group.length < 2) { out.push(...group); continue; }
    // head-to-head score inside the tied group, computed once per group (previously re-filtered all games on every
    // comparison). Each player's sum adds the same terms in the same game order, so the values are bit-identical.
    const ids = new Set(group.map(r => r.id));
    const h2h = new Map<string, number>(group.map(r => [r.id, 0]));
    for (const g of games) {
      if (g.result === null || !ids.has(g.white) || !ids.has(g.black)) continue;
      h2h.set(g.white, h2h.get(g.white)! + g.result);
      h2h.set(g.black, h2h.get(g.black)! + (1 - g.result));
    }
    out.push(...group.sort((a, b) => h2h.get(b.id)! - h2h.get(a.id)! || b.sb - a.sb || a.seed - b.seed));
  }
  return out;
}

/** Swiss order: points, Buchholz Cut-1, Buchholz, Sonneborn–Berger, pre-event seed. */
export function swissOrder(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => b.points - a.points || b.buchholzCut1 - a.buchholzCut1 || b.buchholz - a.buchholz || b.sb - a.sb || a.seed - b.seed);
}

/**
 * Swiss pairing (crown-swiss-1, a simplified score-group system — not FIDE Dutch):
 * players sorted by points then seed; the bye (if odd) goes to the lowest-ranked player without a previous
 * bye; then depth-first search pairs the highest-ranked unpaired player with the nearest-ranked opponent
 * not met before, preferring the same score group; full backtracking guarantees a pairing without repeats
 * whenever one exists. If none exists, repeats are allowed (minimum number, recorded). Colours: the player
 * with fewer whites gets White; ties by seed.
 */
export function swissPairing(players: { id: string; points: number; seed: number; whites: number; hadBye: boolean }[], met: Set<string>):
  { pairs: [string, string][]; bye: string | null; repeats: number } {
  const order = [...players].sort((a, b) => b.points - a.points || a.seed - b.seed);
  let bye: string | null = null;
  let pool = order;
  if (order.length % 2) {
    const cand = [...order].reverse().find(p => !p.hadBye) ?? order[order.length - 1];
    bye = cand.id;
    pool = order.filter(p => p.id !== cand.id);
  }
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  let budget = 200_000; // bounded search: falls back to minimum-repeat pairing when exhausted
  const solve = (rest: typeof pool, allowRepeat: boolean): [string, string][] | null => {
    if (!rest.length) return [];
    if (--budget < 0 && !allowRepeat) return null;
    const [first, ...others] = rest;
    const cands = others.map((o, i) => ({ o, i })).sort((x, y) => Math.abs(x.o.points - first.points) - Math.abs(y.o.points - first.points) || x.i - y.i);
    for (const { o } of cands) {
      if (!allowRepeat && met.has(key(first.id, o.id))) continue;
      const sub = solve(others.filter(x => x.id !== o.id), allowRepeat);
      if (sub) return [[first.id, o.id], ...sub];
    }
    return null;
  };
  let pairs = solve(pool, false);
  let repeats = 0;
  if (!pairs) { budget = Infinity; pairs = solve(pool, true)!; repeats = pairs.filter(([a, b]) => met.has(key(a, b))).length; }
  const byId = new Map(players.map(p => [p.id, p]));
  return {
    pairs: pairs.map(([a, b]) => { const pa = byId.get(a)!, pb = byId.get(b)!; return pa.whites < pb.whites || (pa.whites === pb.whites && pa.seed < pb.seed) ? [a, b] : [b, a]; }),
    bye, repeats,
  };
}

/**
 * Knockout match resolution (research doc 08): two-game mini-match with colours swapped; if level,
 * one rapid pair, then one blitz pair; if still level, the higher pre-event seed advances — except in a
 * championship final, where a level match after all pairs gives joint champions. Always terminates.
 */
export interface KoMatch { a: string; b: string; seedA: number; seedB: number; games: { white: string; black: string; result: number | null; phase: 'classical' | 'rapid' | 'blitz' }[]; winner: string | null; joint: boolean; decidedBy: string | null }

export function koScore(m: KoMatch, id: string): number {
  return m.games.filter(g => g.result !== null).reduce((s, g) => s + (g.white === id ? g.result! : g.black === id ? 1 - g.result! : 0), 0);
}

/** Returns the next game needed, or resolves the match. */
export function koNext(m: KoMatch, isFinal: boolean): { white: string; black: string; phase: 'classical' | 'rapid' | 'blitz' } | null {
  if (m.winner || m.joint) return null;
  const phases: ('classical' | 'rapid' | 'blitz')[] = ['classical', 'rapid', 'blitz'];
  for (const ph of phases) {
    const g = m.games.filter(x => x.phase === ph);
    if (g.some(x => x.result === null)) return null; // waiting on a game
    if (g.length < 2) return g.length === 0 ? { white: m.a, black: m.b, phase: ph } : { white: m.b, black: m.a, phase: ph };
    const sa = g.reduce((s, x) => s + (x.white === m.a ? x.result! : 1 - x.result!), 0);
    if (sa !== 1) { m.winner = sa > 1 ? m.a : m.b; m.decidedBy = ph; return null; }
  }
  if (isFinal) { m.joint = true; m.decidedBy = 'joint title (level after all pairs)'; return null; }
  m.winner = m.seedA <= m.seedB ? m.a : m.b;
  m.decidedBy = 'pre-event seed';
  return null;
}
