/**
 * Round/season driver shared by the app service and long-horizon tests. All world mutations go through
 * these functions; the service persists the results atomically (src/app/federationService.ts).
 */
import { CHAMPIONSHIP_ROUNDS, Fixture, LEAGUE_ROUNDS, ROUNDS_PER_SEASON, topologyOf } from './model';
import { Ctx, RoundRecord, SeasonEndResult, applyRound, buildChampionship, advanceKo, endSeason, makePlan, openRound, settleRound } from './world';
import { MID_ROUND, rankCheckpoint, rankDivisionMoves } from './ranks';

export type SeasonGame = { event: string; white: string; black: string; result: number | null };

export function gamesOf(rounds: RoundRecord[]): SeasonGame[] {
  const out: SeasonGame[] = [];
  for (const r of rounds) {
    for (const [event, white, black, result] of r.abstract) out.push({ event, white, black, result });
    for (const f of r.fixtures) out.push({ event: f.event, white: f.white, black: f.black, result: f.result });
  }
  return out;
}

export interface ProcessedRound {
  record: RoundRecord;
  seasonEnd: SeasonEndResult | null;
  koAdvanced: string[];
  championshipBuilt: boolean;
}

/**
 * Process the open round: all non-player, non-featured fixtures are resolved; then ratings/standings apply,
 * the championship is built after the league, knockout stages advance and the season ends after round 19.
 * Throws if a player or featured fixture is still pending (the caller must play or forfeit it first).
 */
export function processRound(ctx: Ctx, rec: RoundRecord, seasonRounds: RoundRecord[], nowIso: string): ProcessedRound {
  const { waiting } = settleRound(ctx, rec);
  if (waiting.length) throw new Error(`Round ${rec.season}:${rec.round} still has ${waiting.length} unplayed fixture(s): ${waiting.map(f => `${f.id} (tier ${f.tier})`).join(", ")}`);
  rec.status = 'done';
  rec.processedAt = nowIso;
  const all = [...seasonRounds.filter(r => r.id !== rec.id), rec];
  applyRound(ctx, rec, gamesOf(all));
  // v0.11 Circuit Grades (src/federation/ranks.ts): mid-season checkpoint
  if (rec.round === MID_ROUND) rankCheckpoint(ctx, gamesOf(all), ctx.player.rating, 'mid');
  let championshipBuilt = false;
  let koAdvanced: string[] = [];
  if (rec.round === LEAGUE_ROUNDS) { ctx.plan.champ = buildChampionship(ctx, gamesOf(all)); championshipBuilt = true; }
  if (ctx.plan.champ && CHAMPIONSHIP_ROUNDS.includes(rec.round)) koAdvanced = advanceKo(ctx.plan.champ, rec.round);
  if (ctx.plan.club && ctx.plan.club.stages.some(s => s.round === rec.round)) advanceKo(ctx.plan.club, rec.round);
  let seasonEnd: SeasonEndResult | null = null;
  if (rec.round === ROUNDS_PER_SEASON) {
    const finalGames = gamesOf(all);
    rankCheckpoint(ctx, finalGames, ctx.player.rating, 'end'); // in the divisions the season was played in
    seasonEnd = endSeason(ctx, finalGames);
    rankDivisionMoves(ctx, seasonEnd, rec.season, rec.round);
    ctx.world.season += 1;
    ctx.world.round = 1;
    ctx.plan = makePlan(ctx.world.seed, ctx.world.season, [...ctx.competitors.values()], ctx.world.player, topologyOf(ctx.world));
    ctx.swissHistory = [];
  } else ctx.world.round += 1;
  return { record: rec, seasonEnd, koAdvanced, championshipBuilt };
}

/** Run a full round with no player and no featured games (tests, simulations, catch-up). */
export function runRoundHeadless(ctx: Ctx, seasonRounds: RoundRecord[], nowIso = '2026-01-01T00:00:00.000Z', resolveTier1?: (f: Fixture) => number): ProcessedRound {
  const rec = openRound(ctx);
  for (let guard = 0; guard < 20; guard++) {
    const { waiting } = settleRound(ctx, rec);
    if (!waiting.length) break;
    if (!resolveTier1) throw new Error('Player fixtures pending');
    for (const f of waiting) f.result = resolveTier1(f);
  }
  return processRound(ctx, rec, seasonRounds, nowIso);
}
