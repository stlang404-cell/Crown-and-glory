import { describe, expect, it } from 'vitest';
import { BEGINNER_OPPONENTS, PLAY_OPPONENTS, findOpponent, opponentRating, playOpponentSnapshot } from '../src/federation/opponents';
import { ROSTER, opponentSnapshot } from '../src/federation/roster';

describe('Play screen opponents', () => {
  it('offer genuine beginners under 800, clearly labelled, with measured ratings and their exact engine profile', () => {
    expect(PLAY_OPPONENTS.length).toBe(ROSTER.length + 4);
    expect(PLAY_OPPONENTS.slice(0, 4).map(o => o.beginner)).toEqual(['L0d', 'L0c', 'L0b', 'L0a']);
    for (const o of BEGINNER_OPPONENTS) {
      const r = opponentRating(o)!;
      expect(r.rating).toBeLessThan(800);
      expect(findOpponent(o.id)).toBe(o);
      const snap = playOpponentSnapshot(o);
      expect(snap.rating).toBe(r.rating);
      expect(snap.engine!.profile!.error).toBeDefined();
      expect(snap.engine!.profileId).toBe(o.beginner);
    }
    expect(opponentRating(BEGINNER_OPPONENTS[3])!.rating).toBeLessThan(400);
    // the ladder opponents are unchanged
    for (const o of ROSTER) expect(playOpponentSnapshot(o)).toEqual(opponentSnapshot(o));
  });
});
