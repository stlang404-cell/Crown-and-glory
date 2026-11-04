/** "Is it safe to switch to a downloaded update now?" — the pure decision used by <UpdateNotice />. */
import { describe, expect, it } from 'vitest';
import { updateSafety, blockingLiveGames, type UpdateSafetyInput } from '../src/app/updatePolicy';

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

describe('blockingLiveGames (v0.9 scheduler)', () => {
  it('counts only live in-play games with a market; scheduled background games never block an update', () => {
    const games = [
      { status: 'live', marketId: null }, { status: 'live', marketId: undefined }, { status: 'live' },
      { status: 'done', marketId: 'mk:1' }, { status: 'live', marketId: 'mk:2' },
    ];
    expect(blockingLiveGames(games)).toBe(1);
    expect(blockingLiveGames(games.slice(0, 3))).toBe(0);
  });
});

describe('UpdateController.apply (React #185 regression)', () => {
  it('asks a waiting worker once and does not notify listeners again when the state is unchanged', async () => {
    const { updates, CURRENT_BUILD } = await import('../src/app/updates');
    const posted: unknown[] = [];
    const waiting = { postMessage: (m: unknown) => posted.push(m) } as unknown as ServiceWorker;
    updates.reg = { waiting } as unknown as ServiceWorkerRegistration;
    updates.state = { ...updates.state, waiting: true, available: CURRENT_BUILD, applying: false };
    let notified = 0;
    const off = updates.subscribe(() => { notified++; });
    // The page already runs the waiting build, so apply() switches without a reload (applying stays false).
    for (let i = 0; i < 50; i++) updates.apply();
    off();
    expect(posted).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(notified).toBe(0);
  });
});
