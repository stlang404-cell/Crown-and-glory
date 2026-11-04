/**
 * App-side Circuit Grade helpers (docs/FEUDAL_RANKS.md): rank-change ceremonies and the player's live standing.
 * The rule itself lives in src/federation/ranks.ts.
 */
import { PLAYER_ID } from '../federation/model';
import { gamesOf } from '../federation/driver';
import { computeStandings, rankLabel, type PlayerRank, type StandingParts } from '../federation/ranks';
import type { Ceremony, FedState } from './federation';

/**
 * Ceremonies for the player's rank changes in a processed round (one per round, restrained). A division promotion
 * already has its own ceremony: the new grade is added to that ceremony's detail instead of a second card.
 */
export function rankCeremonies(before: PlayerRank | undefined, after: PlayerRank | undefined, season: number, round: number, ceremonies: Ceremony[]): void {
  if (!before || !after || before.step === after.step) return;
  const up = after.step > before.step;
  const promo = ceremonies.find(c => c.kind === 'promotion' && c.season === season);
  if (promo) { promo.detail = `${promo.detail} · Circuit Grade ${rankLabel(after.step)}`; return; }
  const ev = [...after.log].reverse().find(e => e.season === season && e.round === round);
  const why = ev?.kind === 'relegation' ? 'Relegation to a lower division'
    : ev?.kind === 'mid' ? `Mid-season checkpoint · standing score ${ev.score?.toFixed(1) ?? '—'}`
    : ev?.kind === 'end' ? `Season-end checkpoint · standing score ${ev.score?.toFixed(1) ?? '—'}` : 'Checkpoint';
  ceremonies.push({
    id: `rank:${season}:${round}:${after.step}`, season, round, kind: 'rank',
    title: up ? `Circuit Grade: ${rankLabel(after.step)}` : `Circuit Grade now ${rankLabel(after.step)}`,
    ids: [PLAYER_ID], detail: `${up ? 'Up' : 'Down'} from ${rankLabel(before.step)} · ${why}`, seen: false,
  });
}

/** The player's standing parts if a checkpoint were taken now (current season's recorded games). */
export function liveStanding(st: FedState | null, playerRating: number): StandingParts | null {
  if (!st || !st.world.player.joined) return null;
  const rounds = [...st.rounds.values()].filter(r => r.season === st.world.season);
  return computeStandings(st, gamesOf(rounds), playerRating, new Set([PLAYER_ID])).get(PLAYER_ID) ?? null;
}
