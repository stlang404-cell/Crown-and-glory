/**
 * Round/season driver shared by the app service and long-horizon tests. All world mutations go through
 * these functions; the service persists the results atomically (src/app/federationService.ts).
 */
import { CHAMPIONSHIP_ROUNDS, Fixture, LEAGUE_ROUNDS, ROUNDS_PER_SEASON, topologyOf } from './model';
import { Ctx, RoundRecord, SeasonEndResult, applyRound, buildChampionship, buildCups, advanceKo, endSeason, makePlan, openRound, settleRound } from './world';
import { RULES_V2, rulesOf } from './competitions';
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
  if (rec.round === LEAGUE_ROUNDS) {
    ctx.plan.champ = buildChampionship(ctx, gamesOf(all)); championshipBuilt = true;
    // crown-competition-2: Zonal Championships and Regional Cups in rounds 16–19 (never reached under rules 1)
    if (rulesOf(ctx.plan) >= RULES_V2) ctx.plan.cups = buildCups(ctx, gamesOf(all));
  }
  if (ctx.plan.champ && CHAMPIONSHIP_ROUNDS.includes(rec.round)) koAdvanced = advanceKo(ctx.plan.champ, rec.round);
  if (ctx.plan.club && ctx.plan.club.stages.some(s => s.round === rec.round)) advanceKo(ctx.plan.club, rec.round);
  for (const ko of ctx.plan.cups ?? []) if (ko.stages.some(s => s.round === rec.round)) advanceKo(ko, rec.round);
  let seasonEnd: SeasonEndResult | null = null;
  if (rec.round === ROUNDS_PER_SEASON) {
    const finalGames = gamesOf(all);
    rankCheckpoint(ctx, finalGames, ctx.player.rating, 'end'); // in the divisions the season was played in
    seasonEnd = endSeason(ctx, finalGames);
    rankDivisionMoves(ctx, seasonEnd, rec.season, rec.round);
    ctx.world.season += 1;
    ctx.world.round = 1;
    // v0.11: an older world adopts the newer competition rules at its next season start (never mid-season)
    if ((ctx.targetRules ?? 0) > rulesOf(ctx.world)) ctx.world.rules = ctx.targetRules;
    const rules = rulesOf(ctx.world);
    const opts = rules >= RULES_V2 ? { rules, invites: ctx.world.openInvites?.season === ctx.world.season ? ctx.world.openInvites.ids : [] } : {};
    ctx.plan = makePlan(ctx.world.seed, ctx.world.season, [...ctx.competitors.values()], ctx.world.player, topologyOf(ctx.world), opts);
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
