/**
 * Circuit Grade rule simulation (docs/FEUDAL_RANKS.md §5).
 *   npx tsx tools/sim/ranks_sim.mts [regions=16] [seasons=30] [seed=4242] [playerStrengths=1100,1800,2600]
 *
 * 1. Runs a headless federation (crown-population-2, the population of new federations) for N seasons with the live
 *    rule (src/federation/ranks.ts) and a player of fixed strength per run (results drawn from strength, as for the AI).
 * 2. Records, at every checkpoint, each league member's division and standing score, and every division move. The
 *    scores do not depend on the rank rule (ranks never feed back into results), so any candidate rule can then be
 *    replayed offline on exactly the same seasons.
 * 3. Reports, per candidate rule: share of competitors whose step changes per checkpoint, oscillation (a step
 *    reversed at the very next checkpoint), the distribution over the 48 steps (and per grade), and time to climb.
 * 4. Checks that the offline replay of the shipped rule equals the live engine's stored ranks (consistency).
 */
import { generateFederation } from '../../src/federation/generator.ts';
import { createWorld, joinPlayer, type Ctx, type RoundRecord } from '../../src/federation/world.ts';
import { gamesOf, runRoundHeadless } from '../../src/federation/driver.ts';
import { PLAYER_ID, ROUNDS_PER_SEASON, topologyWithRegions, type Fixture } from '../../src/federation/model.ts';
import { POPULATION_V2 } from '../../src/federation/population.ts';
import { sampleResult } from '../../src/federation/resultModel.ts';
import { HYSTERESIS, MID_ROUND, PROMOTION_LANDING, RELEGATION_LANDING, THRESHOLDS, computeStandings, divisionBase, ensureRanks, rankLabel } from '../../src/federation/ranks.ts';

const REGIONS = +(process.argv[2] ?? 16), SEASONS = +(process.argv[3] ?? 30), SEED = +(process.argv[4] ?? 4242);
const STRENGTHS = (process.argv[5] ?? '1100,1800,2600').split(',').map(Number);

interface Rule { name: string; th: number[]; hyst: number; protect: boolean; relLanding: number; maxStep: number }
const RULES: Rule[] = [
  { name: 'shipped', th: [...THRESHOLDS], hyst: HYSTERESIS, protect: true, relLanding: RELEGATION_LANDING, maxStep: 1 },
  { name: 'no hysteresis, no protection', th: [...THRESHOLDS], hyst: 0, protect: false, relLanding: RELEGATION_LANDING, maxStep: 1 },
  { name: 'hysteresis only (no protection)', th: [...THRESHOLDS], hyst: HYSTERESIS, protect: false, relLanding: RELEGATION_LANDING, maxStep: 1 },
  { name: 'jump to target (no step cap, no hysteresis)', th: [...THRESHOLDS], hyst: 0, protect: false, relLanding: RELEGATION_LANDING, maxStep: 6 },
  { name: 'even thresholds 17/33/50/67/83', th: [0, 17, 33, 50, 67, 83], hyst: HYSTERESIS, protect: true, relLanding: RELEGATION_LANDING, maxStep: 1 },
  ...[4, 8, 10, 12, 15, 20].filter(h => h !== HYSTERESIS).map(h => ({ name: `hysteresis ${h}`, th: [...THRESHOLDS], hyst: h, protect: true, relLanding: RELEGATION_LANDING, maxStep: 1 })),
  { name: 'relegation lands at top step (I)', th: [...THRESHOLDS], hyst: HYSTERESIS, protect: true, relLanding: 5, maxStep: 1 },
];

type Checkpoint = { kind: 'mid' | 'end'; season: number; scores: Map<string, { div: number; score: number; bottom: boolean }>; moves: Map<string, number>; entrants: Map<string, number> };

function rngOf(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function runWorld(strength: number) {
  const topo = topologyWithRegions(REGIONS);
  const comps = generateFederation(SEED, topo, POPULATION_V2);
  const { world, plan } = createWorld(SEED, comps, 'T', topo, POPULATION_V2);
  const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: strength, rd: 60, name: 'You' }, swissHistory: [] };
  joinPlayer(ctx, 0);
  ensureRanks(ctx, strength, { newCareer: true });
  const seeds = new Map([...ctx.competitors.values()].map(c => [c.id, c.rank![0]]));
  const rnd = rngOf(SEED ^ strength);
  const tier1 = (f: Fixture) => { const s = (id: string) => (id === PLAYER_ID ? strength : ctx.competitors.get(id)!.latent); return sampleResult(s(f.white), s(f.black), rnd()); };
  const cps: Checkpoint[] = [];
  const playerTrace: { season: number; round: number; step: number; division: number }[] = [];
  let rounds: RoundRecord[] = [];
  let cpMs = 0, cpN = 0;
  for (let s = 0; s < SEASONS; s++) {
    for (let r = 1; r <= ROUNDS_PER_SEASON; r++) {
      const season = ctx.world.season;
      const divBefore = new Map([...ctx.competitors.values()].map(c => [c.id, c.division]));
      divBefore.set(PLAYER_ID, ctx.world.player.division);
      const t0 = performance.now();
      const p = runRoundHeadless(ctx, rounds, 'T', tier1);
      if (r === MID_ROUND || r === ROUNDS_PER_SEASON) { cpMs += performance.now() - t0; cpN++; }
      rounds.push(p.record);
      if (r === MID_ROUND || p.seasonEnd) {
        // relegation places at the checkpoint (no step up from there): from the final tables at season end, from the
        // current tables at mid-season
        const bottom = new Set<string>();
        if (p.seasonEnd) for (const t of p.seasonEnd.standings) for (const id of t.order.slice(-2)) bottom.add(id);
        else for (const [id, parts] of computeStandings(ctx, gamesOf(rounds), strength)) if (parts.bottom) bottom.add(id);
        const scores = new Map<string, { div: number; score: number; bottom: boolean }>();
        for (const c of ctx.competitors.values()) if (c.rank && c.rank[4] >= 0 && divBefore.get(c.id) !== undefined && (p.seasonEnd ? !p.seasonEnd.entrants.some(e => e.id === c.id) : true)) scores.set(c.id, { div: divBefore.get(c.id)!, score: c.rank[4] / 10, bottom: bottom.has(c.id) });
        const pr = ctx.world.player.rank!;
        if (pr.last && pr.last.season === season && pr.last.round === r) scores.set(PLAYER_ID, { div: divBefore.get(PLAYER_ID)!, score: pr.last.score, bottom: bottom.has(PLAYER_ID) });
        const moves = new Map<string, number>(), entrants = new Map<string, number>();
        if (p.seasonEnd) {
          for (const m of [...p.seasonEnd.promotions, ...p.seasonEnd.relegations]) moves.set(m.id, m.to);
          for (const e of p.seasonEnd.entrants) entrants.set(e.id, e.division);
          // retirees keep a frozen rank; mark them so replay stops evaluating them
          for (const id of p.seasonEnd.retirements) moves.set(id, -1);
        }
        cps.push({ kind: r === MID_ROUND ? 'mid' : 'end', season, scores, moves, entrants });
        // a competitor's last score stays on its record; clear the stale ones so the next checkpoint only sees fresh
        for (const c of ctx.competitors.values()) if (c.rank) c.rank[4] = -1;
      }
      playerTrace.push({ season, round: r, step: ctx.world.player.rank!.step, division: ctx.world.player.division });
      if (p.seasonEnd) rounds = [];
    }
  }
  return { ctx, cps, seeds, playerTrace, cpMs: cpMs / Math.max(1, cpN) };
}

function replay(rule: Rule, seeds: Map<string, number>, cps: Checkpoint[]) {
  const step = new Map(seeds), prot = new Map<string, number>(), lastDir = new Map<string, number>();
  step.set(PLAYER_ID, divisionBase(8));
  const active = new Set(step.keys());
  let moves = 0, evals = 0, reversals = 0, ups = 0, downs = 0;
  const climb = new Map<string, number[]>(); // id → checkpoint index at which each step was first reached
  const firstReach = (id: string, s: number, t: number) => { const a = climb.get(id) ?? []; if (a[s] === undefined) a[s] = t; climb.set(id, a); };
  for (const [id, s] of step) firstReach(id, s, -1);
  const local = (s: number) => s % 6;
  cps.forEach((cp, t) => {
    for (const [id, { score, bottom }] of cp.scores) {
      if (!active.has(id)) continue;
      const s = step.get(id)!, l = local(s);
      let nl = l;
      // target with hysteresis, capped at maxStep per checkpoint
      for (let k = 0; k < rule.maxStep; k++) {
        if (!bottom && nl < 5 && score >= rule.th[nl + 1]) nl++;
        else break;
      }
      if (nl === l) for (let k = 0; k < rule.maxStep; k++) {
        if (nl > 0 && !(rule.protect && prot.get(id)) && score < rule.th[nl] - rule.hyst) nl--;
        else break;
      }
      evals++;
      const d = Math.sign(nl - l);
      prot.set(id, d > 0 ? 1 : 0);
      if (d) {
        moves++; if (d > 0) ups++; else downs++;
        const prev = lastDir.get(id);
        if (prev !== undefined && prev === -d) reversals++;
        lastDir.set(id, d);
        step.set(id, s - l + nl); if (d > 0) firstReach(id, s - l + nl, t);
      } else lastDir.delete(id);
    }
    if (cp.kind === 'end') {
      for (const [id, to] of cp.moves) {
        if (to === -1) { active.delete(id); continue; }
        const s = step.get(id); if (s === undefined) continue;
        const from = 8 - Math.floor(s / 6), up = to < from;
        const ns = divisionBase(to) + (up ? PROMOTION_LANDING : rule.relLanding);
        step.set(id, ns); prot.set(id, up ? 1 : 0); lastDir.delete(id);
        if (up) firstReach(id, ns, t);
      }
      for (const [id, d] of cp.entrants) { step.set(id, divisionBase(d) + PROMOTION_LANDING); active.add(id); firstReach(id, divisionBase(d), t); }
    }
  });
  return { step, active, climb, moveRate: moves / evals, reversalRate: moves ? reversals / moves : 0, reversalPerEval: reversals / evals, ups, downs, evals };
}

const report: Record<string, unknown> = { regions: REGIONS, seasons: SEASONS, seed: SEED, rule: { THRESHOLDS, HYSTERESIS, MID_ROUND, PROMOTION_LANDING, RELEGATION_LANDING } };
const players: Record<string, unknown>[] = [];
let ruleTables: Record<string, unknown>[] | null = null;
for (const strength of STRENGTHS) {
  const t0 = performance.now();
  const { ctx, cps, seeds, playerTrace, cpMs } = runWorld(strength);
  const ms = performance.now() - t0;
  // consistency: offline replay of the shipped rule = live ranks
  const shipped = replay(RULES[0], seeds, cps);
  let mismatch = 0;
  for (const c of ctx.competitors.values()) if (c.status === 'active' && shipped.step.get(c.id) !== c.rank![0]) mismatch++;
  if (shipped.step.get(PLAYER_ID) !== ctx.world.player.rank!.step) mismatch++;
  // player's time to climb (seasons from joining to first reach each grade)
  const firstGrade: Record<string, string> = {};
  for (const p of playerTrace) { const g = rankLabel(p.step).replace(/ (III|II|I)$/, ''); if (!(g in firstGrade)) firstGrade[g] = `S${p.season} R${p.round}`; }
  players.push({ strength, msTotal: Math.round(ms), checkpointRoundMs: Math.round(cpMs), liveVsReplayMismatches: mismatch, final: rankLabel(ctx.world.player.rank!.step), finalDivision: ctx.world.player.division, highest: rankLabel(ctx.world.player.rank!.highest.step), firstReached: firstGrade });
  if (!ruleTables) {
    ruleTables = RULES.map(rule => {
      const r = replay(rule, seeds, cps);
      const live = [...r.step].filter(([id]) => r.active.has(id) && id !== PLAYER_ID).map(([, s]) => s);
      const dist = Array.from({ length: 48 }, (_, s) => live.filter(x => x === s).length);
      const perGrade = Array.from({ length: 16 }, (_, g) => dist[g * 3] + dist[g * 3 + 1] + dist[g * 3 + 2]);
      const perLocal = Array.from({ length: 6 }, (_, l) => live.filter(x => x % 6 === l).length / live.length);
      // AI time to climb: checkpoints from entering a division (step base) to reaching its top step, among those who did
      const climbs: number[] = [];
      for (const a of r.climb.values()) for (let d = 0; d < 8; d++) { const b = a[d * 6], top = a[d * 6 + 5]; if (b !== undefined && top !== undefined && top > b) climbs.push(top - b); }
      climbs.sort((x, y) => x - y);
      return { rule: rule.name, stepChangePerCheckpoint: +r.moveRate.toFixed(4), reversedAtNextCheckpoint: +r.reversalRate.toFixed(4), reversalsPerCompetitorCheckpoint: +r.reversalPerEval.toFixed(4), ups: r.ups, downs: r.downs, localStepShare: perLocal.map(x => +x.toFixed(3)), perGrade, perStep: dist, divisionBottomToTopCheckpoints: climbs.length ? { n: climbs.length, median: climbs[climbs.length >> 1], p10: climbs[Math.floor(climbs.length * 0.1)], p90: climbs[Math.floor(climbs.length * 0.9)] } : null };
    });
  }
}
report.players = players;
report.rules = ruleTables;
console.log(JSON.stringify(report, null, 1));
