/** "Is it safe to switch to a downloaded update now?" — the pure decision used by <UpdateNotice />. */
import { describe, expect, it } from 'vitest';
import { updateSafety, type UpdateSafetyInput } from '../src/app/updatePolicy';

const idle: UpdateSafetyInput = { route: 'play', matchGameStatus: null, liveArenaGames: 0, featuredInFlight: false, federationBusy: false, readOnly: false };

describe('updateSafety', () => {
  it('idle screens are safe (play, exchange with open positions, finance, settings, world)', () => {
    for (const route of ['play', 'exchange', 'finance', 'settings', 'world', 'library', 'analysis'])
      expect(updateSafety({ ...idle, route })).toEqual({ safe: true });
  });
  it('an unfinished game on the match route blocks (active, paused, terminal-not-saved, still loading)', () => {
    for (const s of ['active', 'paused', 'terminal', 'unknown'] as const)
      expect(updateSafety({ ...idle, route: 'match', matchGameStatus: s })).toEqual({ safe: false, reason: 'game-in-progress' });
    expect(updateSafety({ ...idle, route: 'match', matchGameStatus: null })).toEqual({ safe: false, reason: 'game-in-progress' });
  });
  it('a finished game still on screen waits until the player leaves', () => {
    expect(updateSafety({ ...idle, route: 'match', matchGameStatus: 'finalized' })).toEqual({ safe: false, reason: 'game-screen' });
    expect(updateSafety({ ...idle, route: 'match', matchGameStatus: 'abandoned' })).toEqual({ safe: false, reason: 'game-screen' });
  });
  it('an unfinished game saved in the background (player elsewhere) does not block', () => {
    expect(updateSafety({ ...idle, route: 'play', matchGameStatus: null })).toEqual({ safe: true });
  });
  it('live in-play arena games block until settled, on any screen', () => {
    expect(updateSafety({ ...idle, route: 'watch', liveArenaGames: 1 })).toEqual({ safe: false, reason: 'live-arena' });
    expect(updateSafety({ ...idle, route: 'exchange', liveArenaGames: 2 })).toEqual({ safe: false, reason: 'live-arena' });
    expect(updateSafety({ ...idle, featuredInFlight: true })).toEqual({ safe: false, reason: 'live-arena' });
  });
  it('a Federation command being committed blocks; a read-only second tab never switches', () => {
    expect(updateSafety({ ...idle, federationBusy: true })).toEqual({ safe: false, reason: 'federation-busy' });
    expect(updateSafety({ ...idle, readOnly: true })).toEqual({ safe: false, reason: 'other-tab' });
  });
  it('leaving the game makes it safe (auto-apply path)', () => {
    const inGame = updateSafety({ ...idle, route: 'match', matchGameStatus: 'active' });
    const left = updateSafety({ ...idle, route: 'play', matchGameStatus: null });
    expect(inGame.safe).toBe(false);
    expect(left.safe).toBe(true);
  });
});
