/**
 * Circuit Grades: the 16-rank feudal hierarchy with sublevels III → II → I (crown-circuit-grades-1,
 * docs/FEUDAL_RANKS.md). 48 steps, Commoner III (step 0) … High Sovereign I (step 47).
 *
 * A Circuit Grade is a RANK. It is not the Career Elo (the Glicko-2 rating), not Played Like Performance Elo, not a
 * rating title, not a Federation title (norms) and not a division — although it is tied to the division:
 *
 *  * Division membership decides the PAIR of grades: division 8 → cg-01/cg-02 … division 1 → cg-15/cg-16
 *    (six steps per division). Divisions change only by the existing league promotion/relegation at season end.
 *  * Inside the division, the grade (lower/upper) and the sublevel come from a STANDING SCORE (0–100) evaluated at two
 *    checkpoints per season — mid-season (after round 8: 8 league rounds and the whole Swiss) and season end — from
 *    league position, results in sanctioned rated games (league, Federation/Challenger Open, Crown Championship) and
 *    the rating's percentile within the division. Hysteresis: a step up needs THRESHOLDS[k+1]; a step down happens
 *    only below THRESHOLDS[k] − HYSTERESIS; at most one step per checkpoint; no step down at the checkpoint right
 *    after any step up (demotion protection); no step up from the league's relegation places.
 *  * Nothing else counts: no purchase, fee, club, sponsorship or cosmetic, and no exhibition, unrated, assisted,
 *    practice, sandbox or quick-match game is an input (the inputs are the Federation's recorded fixtures only).
 *
 * Highest rank ever achieved is permanent and only ever raised by a genuine step up (checkpoint or division
 * promotion), never lowered. Pure functions over the world data; the service persists the records.
 */
import { CIRCUIT_GRADE_NAMES } from './rankNames';
import { DIVISIONS, LEAGUE_ROUNDS, PLAYER_ID, ROUNDS_PER_SEASON, type Competitor } from './model';
import { gamesByEvent, leagueTable, type SeasonEndResult, type SeasonPlan, type WorldState } from './world';
import { gradeEmblem } from '../heraldry/ranks';
import type { EmblemSpec } from '../heraldry/spec';

export const RANK_RULE_ID = 'crown-circuit-grades-1';
export const GRADES = 16;
export const STEPS = 48;
export const STEPS_PER_DIVISION = 6;
export type Sublevel = 'III' | 'II' | 'I';
export const SUBLEVELS: Sublevel[] = ['III', 'II', 'I'];
/** A new career starts here: Commoner III. (Package N's new-career setup can call `initialPlayerRank`.) */
export const INITIAL_STEP = 0;

// ------------------------------------------------------------------ the rule (docs/FEUDAL_RANKS.md §4–5)
/** Weights of the standing score's parts (each part 0..1); a part that has no data yet is left out and the others
 *  are renormalised. */
export const RANK_WEIGHTS = { position: 0.45, results: 0.25, rating: 0.3 } as const;
/** Standing score (0–100) needed to REACH local step k of a division (k = 0..5: lower grade III, II, I, upper grade
 *  III, II, I). Chosen by simulation (tools/sim/ranks_sim.mts, docs/FEUDAL_RANKS.md §5). */
export const THRESHOLDS = [0, 30, 42, 54, 64, 76] as const;
/** A step down happens only when the score is this far below the threshold of the current step. */
export const HYSTERESIS = 12;
/** Mid-season checkpoint: after this round is processed (league round 8 and the last Swiss round). */
export const MID_ROUND = 8;
/** Local step after a division promotion (lower grade III of the new division) and after relegation (upper grade
 *  III of the new division: the senior grade of the lower division, its sublevels to be re-earned). */
export const PROMOTION_LANDING = 0;
export const RELEGATION_LANDING = 3;
/** Events that count toward the results part: sanctioned rated Federation events — leagues, the two Opens, the
 *  Crown Championship and (crown-competition-2) the Zonal Championships (`zonal-…`) and Regional Cups (`cup-…`), whose
 *  fields qualify by results and charge no entry. The Club Weekend is excluded (a hosted event the player pays for), as
 *  is anything outside the Federation's fixtures (exhibitions, quick matches, practice, sandbox). */
export const SANCTIONED = (event: string) => event.startsWith('league:') || event === 'open' || event === 'challenger' || event === 'champ' || event.startsWith('zonal-') || event.startsWith('cup-');

// ------------------------------------------------------------------ steps, labels, insignia
export const clampStep = (s: number) => Math.max(0, Math.min(STEPS - 1, Math.floor(s)));
export const gradeIndexOf = (step: number) => Math.floor(clampStep(step) / 3);
export const sublevelOf = (step: number): Sublevel => SUBLEVELS[clampStep(step) % 3];
export const divisionOfStep = (step: number) => DIVISIONS - Math.floor(clampStep(step) / STEPS_PER_DIVISION);
/** First (lowest) step of a division. */
export const divisionBase = (division: number) => (DIVISIONS - Math.max(1, Math.min(DIVISIONS, division))) * STEPS_PER_DIVISION;
export const localOf = (step: number) => clampStep(step) % STEPS_PER_DIVISION;
export const stepOf = (gradeIndex: number, sub: number) => clampStep(gradeIndex * 3 + sub);
export const rankLabel = (step: number) => `${CIRCUIT_GRADE_NAMES[gradeIndexOf(step)].name} ${sublevelOf(step)}`;

export interface RankView {
  step: number;
  /** Stable id `cg-01` … `cg-16`. */
  gradeId: string;
  /** 1 … 16. */
  grade: number;
  rankName: string;
  sublevel: Sublevel;
  /** Full label, e.g. "Knight II". */
  label: string;
  /** The division this grade belongs to (1 = Crown … 8 = Open). */
  division: number;
  insignia: EmblemSpec;
  /** Accessible description of the insignia. */
  ariaLabel: string;
}
const VIEWS: RankView[] = Array.from({ length: STEPS }, (_, step) => {
  const g = Math.floor(step / 3), sub = step % 3;
  const label = `${CIRCUIT_GRADE_NAMES[g].name} ${SUBLEVELS[sub]}`;
  return {
    step, gradeId: CIRCUIT_GRADE_NAMES[g].id, grade: g + 1, rankName: CIRCUIT_GRADE_NAMES[g].name, sublevel: SUBLEVELS[sub], label,
    division: DIVISIONS - Math.floor(step / STEPS_PER_DIVISION), insignia: gradeEmblem(g, sub),
    ariaLabel: `${label}: Circuit Grade ${g + 1} of 16, sublevel ${SUBLEVELS[sub]} (step ${step + 1} of 48)`,
  };
});
export const rankView = (step: number): RankView => VIEWS[clampStep(step)];
export const ALL_RANKS: readonly RankView[] = VIEWS;

// ------------------------------------------------------------------ records
export type RankVia = 'start' | 'checkpoint' | 'promotion' | 'replay';
export interface RankHighest { step: number; season: number; round: number; via: RankVia }
export interface StandingParts { position: number | null; results: number | null; rating: number | null;
  /** In the league's relegation places (15th–16th) at the checkpoint: no step up (e.g. a career that forfeits every
   *  game cannot rise on its rating alone). */
  bottom?: boolean }
export interface RankEvent { season: number; round: number; kind: 'start' | 'mid' | 'end' | 'promotion' | 'relegation' | 'migration' | 'entry'; from: number; to: number; score?: number }
export interface PlayerRank {
  rule: typeof RANK_RULE_ID;
  step: number;
  /** 1 = the next checkpoint cannot lower the step (set by any step up). */
  protect: number;
  highest: RankHighest;
  /** The latest checkpoint evaluation (score 0–100, rounded to 0.1). */
  last: { season: number; round: number; kind: 'mid' | 'end'; parts: StandingParts; score: number } | null;
  /** Step changes, newest last (capped). */
  log: RankEvent[];
  origin: 'new' | 'migrated';
}
/** Compact competitor record: [step, protect, highest step, season first achieved, last score × 10 (−1 = none)]. */
export type CompRank = [number, number, number, number, number];
const LOG_CAP = 200;

/** A new player's rank (Commoner III). */
export function initialPlayerRank(season: number, round: number, division: number = DIVISIONS): PlayerRank {
  const step = divisionBase(division) + INITIAL_STEP;
  return { rule: RANK_RULE_ID, step, protect: 0, highest: { step, season, round, via: 'start' }, last: null, log: [{ season, round, kind: 'start', from: step, to: step }], origin: 'new' };
}

// ------------------------------------------------------------------ the standing score and the checkpoint step
export function standingScore(p: StandingParts): number {
  let w = 0, s = 0;
  if (p.position !== null) { w += RANK_WEIGHTS.position; s += RANK_WEIGHTS.position * p.position; }
  if (p.results !== null) { w += RANK_WEIGHTS.results; s += RANK_WEIGHTS.results * p.results; }
  if (p.rating !== null) { w += RANK_WEIGHTS.rating; s += RANK_WEIGHTS.rating * p.rating; }
  return w ? Math.round((1000 * s) / w) / 10 : 0;
}
/** One checkpoint inside a division: at most one step; up at THRESHOLDS[k+1] (not from the relegation places:
 *  `canRise`); down below THRESHOLDS[k] − HYSTERESIS unless protected. Returns the new local step and protection. */
export function checkpointStep(local: number, score: number, protect: number, canRise = true): { local: number; protect: number; change: -1 | 0 | 1 } {
  if (canRise && local < STEPS_PER_DIVISION - 1 && score >= THRESHOLDS[local + 1]) return { local: local + 1, protect: 1, change: 1 };
  if (local > 0 && !protect && score < THRESHOLDS[local] - HYSTERESIS) return { local: local - 1, protect: 0, change: -1 };
  return { local, protect: 0, change: 0 };
}
/** Founding seed (a new world, or a founding competitor of a migrated world with no history): the step its
 *  rating percentile inside its division reaches, without hysteresis. */
export function seedLocal(ratingPercentile: number): number {
  const s = 100 * ratingPercentile;
  let k = 0;
  for (let i = 1; i < STEPS_PER_DIVISION; i++) if (s >= THRESHOLDS[i]) k = i;
  return k;
}

type Game = { event: string; white: string; black: string; result: number | null };
interface WorldLike { world: WorldState; plan: SeasonPlan; competitors: Map<string, Competitor> }

/** Percentile (0..1, mid-rank for ties) of each value in a list. */
function percentiles(entries: [string, number][]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const out = new Map<string, number>();
  const n = sorted.length;
  for (let i = 0; i < n;) {
    let j = i; while (j + 1 < n && sorted[j + 1][1] === sorted[i][1]) j++;
    const p = n === 1 ? 0.5 : ((i + j) / 2) / (n - 1);
    for (let k = i; k <= j; k++) out.set(sorted[k][0], p);
    i = j + 1;
  }
  return out;
}

/**
 * Standing parts of every league member of the plan (the player included when in a circuit) from the season's
 * recorded games: league position, score in sanctioned games, rating percentile in the division (federation-wide).
 * `only`: compute for these circuit members only (the player's live projection).
 */
export function computeStandings(w: WorldLike, games: Game[], playerRating: number, only?: Set<string>): Map<string, StandingParts> {
  const byEvent = gamesByEvent(games);
  const res = new Map<string, [number, number]>();
  const want = (id: string) => !only || only.has(id);
  for (const g of games) {
    if (g.result === null || !SANCTIONED(g.event) || !(want(g.white) || want(g.black))) continue;
    const a = res.get(g.white) ?? [0, 0]; a[0] += g.result; a[1]++; res.set(g.white, a);
    const b = res.get(g.black) ?? [0, 0]; b[0] += 1 - g.result; b[1]++; res.set(g.black, b);
  }
  const rating = (id: string) => (id === PLAYER_ID ? playerRating : w.competitors.get(id)?.rating ?? 0);
  const byDiv = new Map<number, [string, number][]>();
  for (const c of w.plan.circuits) { const l = byDiv.get(c.division) ?? []; for (const m of c.members) l.push([m, rating(m)]); byDiv.set(c.division, l); }
  const pct = new Map<number, Map<string, number>>();
  const out = new Map<string, StandingParts>();
  for (const c of w.plan.circuits) {
    if (only && !c.members.some(m => only.has(m))) continue;
    if (!pct.has(c.division)) pct.set(c.division, percentiles(byDiv.get(c.division) ?? []));
    const p = pct.get(c.division)!;
    const t = leagueTable(c, games, undefined, byEvent);
    const anyPlayed = t.some(r => r.played > 0);
    t.forEach((r, i) => {
      if (!want(r.id)) return;
      const q = res.get(r.id);
      out.set(r.id, { position: anyPlayed ? 1 - i / Math.max(1, t.length - 1) : null, results: q && q[1] ? q[0] / q[1] : null, rating: p.get(r.id) ?? null, bottom: anyPlayed && i >= t.length - 2 });
    });
  }
  return out;
}

// ------------------------------------------------------------------ applying checkpoints and division moves
const raise = (h: RankHighest, step: number, season: number, round: number, via: RankVia): RankHighest => (step > h.step ? { step, season, round, via } : h);
const log = (r: PlayerRank, e: RankEvent) => { r.log.push(e); if (r.log.length > LOG_CAP) r.log.splice(0, r.log.length - LOG_CAP); };
function compRankOf(c: Competitor): CompRank { return c.rank!; }

/** A checkpoint ('mid' after round MID_ROUND, 'end' at season end before promotion/relegation). Mutates ranks. */
export function rankCheckpoint(w: WorldLike, games: Game[], playerRating: number, kind: 'mid' | 'end'): void {
  ensureRanks(w, playerRating);
  const season = w.world.season, round = w.world.round;
  const st = computeStandings(w, games, playerRating);
  for (const [id, parts] of st) {
    const score = standingScore(parts);
    if (id === PLAYER_ID) {
      const r = w.world.player.rank;
      if (!r) continue;
      const base = r.step - localOf(r.step);
      // league games the player postponed (crown-competition-2, due by round 15) are missing from the table at the
      // mid-season checkpoint: the checkpoint can raise the player but not lower them while any is pending
      const pending = (w.world.player.postponed?.length ?? 0) > 0;
      const n = checkpointStep(localOf(r.step), score, pending ? 1 : r.protect, !parts.bottom);
      const to = base + n.local;
      if (to !== r.step) log(r, { season, round, kind, from: r.step, to, score });
      if (n.change > 0) r.highest = raise(r.highest, to, season, round, 'checkpoint');
      r.step = to; r.protect = n.protect; r.last = { season, round, kind, parts, score };
      continue;
    }
    const c = w.competitors.get(id);
    if (!c || c.status !== 'active' || !c.rank) continue;
    const k = compRankOf(c);
    const n = checkpointStep(localOf(k[0]), score, k[1], !parts.bottom);
    const to = k[0] - localOf(k[0]) + n.local;
    c.rank = [to, n.protect, to > k[2] ? to : k[2], to > k[2] ? season : k[3], Math.round(score * 10)];
  }
}

/** After `endSeason`: move ranks with promotion/relegation, start entrants at the lowest step of their division. */
export function rankDivisionMoves(w: WorldLike, res: SeasonEndResult, season: number, round: number): void {
  const entrants = new Set(res.entrants.map(e => e.id));
  for (const e of res.entrants) { const c = w.competitors.get(e.id); if (c) { const s = divisionBase(c.division) + PROMOTION_LANDING; c.rank = [s, 0, s, season + 1, -1]; } }
  const moved = new Map<string, number>();
  for (const m of res.promotions) moved.set(m.id, m.to);
  for (const m of res.relegations) moved.set(m.id, m.to);
  for (const [id, to] of moved) {
    if (id === PLAYER_ID) {
      const r = w.world.player.rank; if (!r) continue;
      const from = r.step, up = to < divisionOfStep(from);
      r.step = divisionBase(to) + (up ? PROMOTION_LANDING : RELEGATION_LANDING);
      r.protect = up ? 1 : 0;
      log(r, { season, round, kind: up ? 'promotion' : 'relegation', from, to: r.step });
      if (up) r.highest = raise(r.highest, r.step, season, round, 'promotion');
      continue;
    }
    const c = w.competitors.get(id); if (!c?.rank) continue;
    const k = c.rank, up = to < divisionOfStep(k[0]);
    const s = divisionBase(to) + (up ? PROMOTION_LANDING : RELEGATION_LANDING);
    c.rank = [s, up ? 1 : 0, s > k[2] ? s : k[2], s > k[2] ? season : k[3], k[4]];
  }
  // anyone else whose division no longer matches (e.g. the reserve competitor re-entering): clamp into the division
  for (const c of w.competitors.values()) {
    if (!c.rank || entrants.has(c.id) || c.status !== 'active') continue;
    // (a rank actually held, so the highest rank is at least this one)
    if (divisionOfStep(c.rank[0]) !== c.division) { const s = divisionBase(c.division) + (divisionOfStep(c.rank[0]) > c.division ? PROMOTION_LANDING : RELEGATION_LANDING); c.rank = [s, 0, Math.max(s, c.rank[2]), s > c.rank[2] ? season + 1 : c.rank[3], c.rank[4]]; }
  }
}

// ------------------------------------------------------------------ migration of saves without ranks (deterministic)
/**
 * Give every record that has no rank yet one, deterministically, from stored data only:
 *  * a competitor with season history: seeded at its first recorded season (an entrant at the lowest step of its
 *    division; a founding competitor from its earliest stored rating's percentile), then the season-end checkpoint
 *    rule replayed over every stored season record (position = league place, results = league score, rating =
 *    percentile of the stored season rating among that season's division) with the recorded division moves;
 *  * a competitor without history: a founding competitor from its current rating percentile, an entrant at the
 *    lowest step of its division;
 *  * the player: Commoner III at joining, then the same replay over the stored season records (place and points;
 *    no per-season rating is stored, so that part is left out and the weights renormalised).
 * Mid-season checkpoints of past seasons cannot be replayed (no record of mid-season tables is kept). Highest rank
 * from a replay is marked via 'replay'; a seed is a starting rank, not an achievement.
 * Returns the number of records given a rank.
 */
export function ensureRanks(w: WorldLike, playerRating: number, opts: { newCareer?: boolean } = {}): number {
  let n = 0;
  if (opts.newCareer && w.world.player.joined && !w.world.player.rank && !w.world.player.history.length) {
    w.world.player.rank = initialPlayerRank(w.world.season, w.world.round, w.world.player.division); n++;
  }
  const comps = [...w.competitors.values()].filter(c => !c.rank);
  if (comps.length) {
    const hist = new Map<string, [string, number][]>();
    for (const c of w.competitors.values()) for (const h of c.history) { const k = `${h.season}:${h.division}`; const l = hist.get(k) ?? []; l.push([c.id, h.rating]); hist.set(k, l); }
    const histPct = new Map<string, Map<string, number>>();
    const pctOf = (season: number, division: number, id: string) => {
      const k = `${season}:${division}`;
      if (!histPct.has(k)) histPct.set(k, percentiles(hist.get(k) ?? []));
      return histPct.get(k)!.get(id) ?? 0.5;
    };
    const cur = new Map<number, [string, number][]>();
    for (const c of w.competitors.values()) if (c.status === 'active') { const l = cur.get(c.division) ?? []; l.push([c.id, c.rating]); cur.set(c.division, l); }
    const curPct = new Map<number, Map<string, number>>();
    const curOf = (division: number, id: string) => { if (!curPct.has(division)) curPct.set(division, percentiles(cur.get(division) ?? [])); return curPct.get(division)!.get(id) ?? 0.5; };
    const size = Math.max(2, w.world.topology?.divisionSize ?? 16);
    for (const c of comps) {
      const founder = c.joinedSeason <= 1;
      const h = c.history;
      if (!h.length) {
        const s = divisionBase(c.division) + (founder && c.status === 'active' ? seedLocal(curOf(c.division, c.id)) : PROMOTION_LANDING);
        c.rank = [s, 0, s, Math.max(1, c.joinedSeason), -1]; n++; continue;
      }
      let step = divisionBase(h[0].division) + (founder ? seedLocal(pctOf(h[0].season, h[0].division, c.id)) : PROMOTION_LANDING);
      let protect = 0, hi = step, hiSeason = h[0].season, last = -1;
      for (let i = 0; i < h.length; i++) {
        const e = h[i];
        if (divisionOfStep(step) !== e.division) step = divisionBase(e.division) + (divisionOfStep(step) > e.division ? PROMOTION_LANDING : RELEGATION_LANDING);
        // the founding seed already reflects the first season's (end-of-season) rating: replay from the next record
        if (!(founder && i === 0)) {
          const score = standingScore({ position: 1 - (e.rank - 1) / (size - 1), results: e.played ? e.points / e.played : null, rating: pctOf(e.season, e.division, c.id) });
          const r = checkpointStep(localOf(step), score, protect, e.rank < size - 1);
          step = step - localOf(step) + r.local; protect = r.protect; last = Math.round(score * 10);
          if (step > hi) { hi = step; hiSeason = e.season; }
        }
        const nextDiv = i + 1 < h.length ? h[i + 1].division : c.division;
        if (nextDiv !== e.division) {
          const up = nextDiv < e.division;
          step = divisionBase(nextDiv) + (up ? PROMOTION_LANDING : RELEGATION_LANDING); protect = up ? 1 : 0;
          if (step > hi) { hi = step; hiSeason = e.season; }
        }
      }
      c.rank = [step, protect, hi, hiSeason, last]; n++;
    }
  }
  const p = w.world.player;
  if (p.joined && !p.rank) {
    const firstDiv = p.history[0]?.division ?? p.division;
    const s0 = divisionBase(firstDiv) + INITIAL_STEP;
    const startSeason = p.history[0]?.season ?? w.world.season;
    const r: PlayerRank = { rule: RANK_RULE_ID, step: s0, protect: 0, highest: { step: s0, season: startSeason, round: 1, via: 'start' }, last: null, log: [], origin: 'migrated' };
    const size = Math.max(2, w.world.topology?.divisionSize ?? 16);
    for (let i = 0; i < p.history.length; i++) {
      const e = p.history[i];
      if (divisionOfStep(r.step) !== e.division) r.step = divisionBase(e.division) + (divisionOfStep(r.step) > e.division ? PROMOTION_LANDING : RELEGATION_LANDING);
      const parts: StandingParts = { position: 1 - (e.rank - 1) / (size - 1), results: e.points / LEAGUE_ROUNDS, rating: null, bottom: e.rank >= size - 1 };
      const score = standingScore(parts);
      const c = checkpointStep(localOf(r.step), score, r.protect, !parts.bottom);
      r.step = r.step - localOf(r.step) + c.local; r.protect = c.protect;
      r.last = { season: e.season, round: ROUNDS_PER_SEASON, kind: 'end', parts, score };
      if (c.change > 0) r.highest = raise(r.highest, r.step, e.season, ROUNDS_PER_SEASON, 'replay');
      const nextDiv = i + 1 < p.history.length ? p.history[i + 1].division : p.division;
      if (nextDiv !== e.division) {
        const up = nextDiv < e.division;
        r.step = divisionBase(nextDiv) + (up ? PROMOTION_LANDING : RELEGATION_LANDING); r.protect = up ? 1 : 0;
        if (up) r.highest = raise(r.highest, r.step, e.season, ROUNDS_PER_SEASON, 'replay');
      }
    }
    if (divisionOfStep(r.step) !== p.division) r.step = divisionBase(p.division);
    r.log.push({ season: w.world.season, round: w.world.round, kind: 'migration', from: s0, to: r.step });
    p.rank = r; n++;
  }
  void playerRating;
  return n;
}

/**
 * Migration at load: ensureRanks, then — if this season's mid-season checkpoint has already passed — that checkpoint
 * applied to the migrated records only, from the current season's stored games.
 */
export function migrateRanks(w: WorldLike, currentSeasonGames: Game[], playerRating: number): number {
  const before = new Set([...w.competitors.values()].filter(c => !c.rank).map(c => c.id));
  const playerNew = w.world.player.joined && !w.world.player.rank;
  const n = ensureRanks(w, playerRating);
  if (!n || w.world.round <= MID_ROUND) return n;
  const st = computeStandings(w, currentSeasonGames, playerRating);
  const season = w.world.season;
  for (const [id, parts] of st) {
    const score = standingScore(parts);
    if (id === PLAYER_ID) {
      if (!playerNew) continue;
      const r = w.world.player.rank!;
      const c = checkpointStep(localOf(r.step), score, r.protect, !parts.bottom);
      const to = r.step - localOf(r.step) + c.local;
      if (c.change > 0) r.highest = raise(r.highest, to, season, MID_ROUND, 'replay');
      r.step = to; r.protect = c.protect; r.last = { season, round: MID_ROUND, kind: 'mid', parts, score };
      r.log[r.log.length - 1].to = to;
      continue;
    }
    if (!before.has(id)) continue;
    const comp = w.competitors.get(id);
    if (!comp?.rank || comp.status !== 'active') continue;
    const k = comp.rank, c = checkpointStep(localOf(k[0]), score, k[1], !parts.bottom);
    const to = k[0] - localOf(k[0]) + c.local;
    comp.rank = [to, c.protect, Math.max(to, k[2]), to > k[2] ? season : k[3], Math.round(score * 10)];
  }
  return n;
}

// ------------------------------------------------------------------ read API (package I header, profiles, lists)
type StateLike = { world: WorldState } | null | undefined;
/** The player's current Circuit Grade (Commoner III before a career exists). */
export function currentRank(state: StateLike): RankView & { joined: boolean } {
  const r = state?.world.player.rank;
  return { ...rankView(r ? r.step : INITIAL_STEP), joined: !!state?.world.player.joined };
}
/** The player's highest Circuit Grade ever achieved, with when it was first achieved (null before a career). */
export function highestRank(state: StateLike): (RankView & { season: number; round: number; via: RankVia }) | null {
  const r = state?.world.player.rank;
  return r ? { ...rankView(r.highest.step), season: r.highest.season, round: r.highest.round, via: r.highest.via } : null;
}
export function competitorRank(c: Pick<Competitor, 'rank'> | null | undefined): RankView | null { return c?.rank ? rankView(c.rank[0]) : null; }
export function competitorHighestRank(c: Pick<Competitor, 'rank'> | null | undefined): (RankView & { season: number }) | null {
  return c?.rank ? { ...rankView(c.rank[2]), season: c.rank[3] } : null;
}
/** Rank of any id ('player' or a competitor id). */
export function rankOfId(state: (StateLike & { competitors?: Map<string, Competitor> }) | null | undefined, id: string): RankView | null {
  if (id === PLAYER_ID) return state?.world.player.joined ? currentRank(state) : null;
  return competitorRank(state?.competitors?.get(id));
}

/** Everything the rank guide shows about the player's progress. `live`: the standing parts if the checkpoint were now. */
export interface RankProgress {
  current: RankView; highest: (RankView & { season: number; round: number; via: RankVia }) | null;
  local: number; next: RankView | null; prev: RankView | null;
  promoteAt: number | null; demoteBelow: number | null; protectedNow: boolean;
  score: number | null; scoreSource: 'live' | 'last' | null; fraction: number;
  nextCheckpoint: { season: number; round: number; kind: 'mid' | 'end' };
  divisionUp: RankView | null; divisionDown: RankView | null;
}
export function rankProgress(state: StateLike, live?: StandingParts | null): RankProgress {
  const r = state?.world.player.rank;
  const step = r ? r.step : INITIAL_STEP;
  const local = localOf(step);
  const score = live ? standingScore(live) : r?.last?.score ?? null;
  const promoteAt = local < STEPS_PER_DIVISION - 1 ? THRESHOLDS[local + 1] : null;
  const demoteBelow = local > 0 ? THRESHOLDS[local] - HYSTERESIS : null;
  const lo = THRESHOLDS[local], hi = promoteAt ?? 100;
  const fraction = score === null ? 0 : Math.max(0, Math.min(1, (score - lo) / Math.max(1, hi - lo)));
  const season = state?.world.season ?? 1, round = state?.world.round ?? 1;
  const division = divisionOfStep(step);
  return {
    current: rankView(step), highest: highestRank(state), local,
    next: local < STEPS_PER_DIVISION - 1 ? rankView(step + 1) : null, prev: local > 0 ? rankView(step - 1) : null,
    promoteAt, demoteBelow, protectedNow: !!r?.protect, score, scoreSource: live ? 'live' : r?.last ? 'last' : null, fraction,
    nextCheckpoint: round <= MID_ROUND ? { season, round: MID_ROUND, kind: 'mid' } : { season, round: ROUNDS_PER_SEASON, kind: 'end' },
    divisionUp: division > 1 ? rankView(divisionBase(division - 1) + PROMOTION_LANDING) : null,
    divisionDown: division < DIVISIONS ? rankView(divisionBase(division + 1) + RELEGATION_LANDING) : null,
  };
}
