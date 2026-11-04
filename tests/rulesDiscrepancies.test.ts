/**
 * Fixes of documented rule discrepancies (docs/RULES_TRACEABILITY.md, "Discrepancies found"):
 *   D9  the pure Swiss registration rule closes before round 4, like the service and the rulebook (rounds 1–3);
 *   D10 Training Hall sparring games never carry a Sandbox practice market (rulebook: only casual games started from
 *       Play or Random Match).
 */
import { describe, expect, it } from 'vitest';
import { generateFederation } from '../src/federation/generator';
import { createWorld, joinPlayer, registerChallenger, type Ctx } from '../src/federation/world';
import { DIVISIONS, PLAYER_ID, SWISS_ROUNDS } from '../src/federation/model';
import { FederationService } from '../src/app/federation';
import { createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';
import { ROSTER, opponentSnapshot } from '../src/federation/roster';

function newCtx(seed = 42): Ctx {
  const comps = generateFederation(seed);
  const { world, plan } = createWorld(seed, comps, 'T');
  return { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 350, name: 'You' }, swissHistory: [] };
}

describe('D9: Swiss registration window', () => {
  it('accepts registration in rounds 1–3 and refuses it from round 4 (the first Swiss round) on', () => {
    expect(SWISS_ROUNDS[0]).toBe(4);
    for (const round of [1, 2, 3, 4, 5]) {
      const ctx = newCtx();
      joinPlayer(ctx, 0);
      expect(ctx.world.player.division).toBe(DIVISIONS);
      ctx.world.round = round;
      if (round < SWISS_ROUNDS[0]) {
        registerChallenger(ctx);
        expect(ctx.plan.swiss.find(s => s.event === 'challenger')!.entrants).toContain(PLAYER_ID);
      } else expect(() => registerChallenger(ctx)).toThrow(/closed/);
    }
  });
});

describe('D10: Sandbox eligibility', () => {
  const base = (id: string, engine: ReturnType<typeof opponentSnapshot>, eventName: string) => createGameRecord({
    id, mode: 'casual', timeControl: TIME_CONTROLS.rapid, humanColor: 'white',
    human: { kind: 'human', id: 'player', name: 'You', rating: null, rd: null },
    engine, engineSeed: 1, nowIso: '2026-01-01T00:00:00.000Z', context: { kind: 'quick-match', eventName },
  });
  it('a casual Play game is eligible; a Training Hall sparring game (also context quick-match) is not', () => {
    const play = base('g-1', opponentSnapshot(ROSTER[2]), 'Casual game');
    expect(FederationService.sandboxIneligible(play)).toBeNull();
    const spar = base('spar-1-3-l-0-abc', { ...opponentSnapshot(ROSTER[2]), id: 'spar:c-0001', name: 'X (sparring)' }, 'Sparring vs X');
    expect(spar.context.kind).toBe('quick-match');
    expect(FederationService.isSparring(spar)).toBe(true);
    expect(FederationService.sandboxIneligible(spar)).toMatch(/training games are excluded/);
  });
});
