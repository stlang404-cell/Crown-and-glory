/**
 * Practice-game hand-off (src/app/practice.ts): the Grimoire's Today's Plan preselects the suggested opponent and
 * time control on the Play screen, always as a casual game (never rated, so assistance never reaches rated play).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { clearPractice, peekPractice, practiceForLevel, requestPractice, sanitizePractice } from '../src/app/practice';
import { LEVEL_PLAN, LEVELS, dailyPlan } from '../src/academy/grimoire';
import { ROSTER, opponentSnapshot } from '../src/federation/roster';
import { createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';

afterEach(() => clearPractice());

describe('practice game from the learning plan', () => {
  it('every plan level maps to a real roster opponent, Rapid, casual', () => {
    for (const level of LEVELS) {
      const plan = dailyPlan({ settings: { level, minutes: 30 }, progress: { attempts: [], completions: new Map(), read: new Set() }, nowIso: '2026-01-01T00:00:00.000Z', puzzles: [], academyAttemptIds: new Set() });
      expect(plan.game).toMatchObject({ opponentLevel: LEVEL_PLAN[level].opponentLevel, timeControl: 'rapid', mode: 'casual' });
      const s = practiceForLevel(plan.game!.opponentLevel, plan.game!.timeControl)!;
      expect(s.mode).toBe('casual');
      expect(ROSTER.find(o => o.id === s.opponentId)!.level).toBe(LEVEL_PLAN[level].opponentLevel);
    }
    expect([1, 3, 4, 6, 8].map(l => practiceForLevel(l)!.opponentId)).toEqual(['opp-mira', 'opp-ines', 'opp-oskar', 'opp-dario', 'opp-crown']);
  });

  it('the hand-off is read until cleared, and it can never ask for a rated game', () => {
    expect(peekPractice()).toBeNull();
    requestPractice(practiceForLevel(6)!);
    expect(peekPractice()).toEqual({ opponentId: 'opp-dario', timeControl: 'rapid', mode: 'casual', source: 'grimoire-plan' });
    expect(peekPractice()).not.toBeNull(); // peek does not consume (safe in render initialisers)
    clearPractice();
    expect(peekPractice()).toBeNull();
    // untrusted input: a forged "rated" mode is forced to casual; unknown opponents / time controls are refused
    expect(sanitizePractice({ opponentId: 'opp-ines', timeControl: 'blitz', mode: 'rated' })?.mode).toBe('casual');
    expect(sanitizePractice({ opponentId: 'opp-nobody', timeControl: 'rapid' })).toBeNull();
    expect(sanitizePractice({ opponentId: 'opp-ines', timeControl: 'bullet' })).toBeNull();
    expect(sanitizePractice(null)).toBeNull();
  });

  it('a casual game record allows assistance and is not rated', () => {
    const s = practiceForLevel(4)!;
    const opp = ROSTER.find(o => o.id === s.opponentId)!;
    const rec = createGameRecord({
      id: 'g-test', mode: s.mode, timeControl: TIME_CONTROLS[s.timeControl], humanColor: 'white',
      human: { kind: 'human', id: 'player', name: 'You', rating: null, rd: null },
      engine: opponentSnapshot(opp), engineSeed: 1, nowIso: '2026-01-01T00:00:00.000Z',
    });
    expect(rec.rated).toBe(false);
    expect(rec.mode).toBe('casual');
  });
});
