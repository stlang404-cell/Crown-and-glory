/**
 * When may a downloaded update be switched on? (pure; see tests/updatePolicy.test.ts and docs/IPHONE_PAGES.md)
 *
 * Activating an update reloads the page. Saves are never at risk (they live in IndexedDB and are written as each
 * move / trade happens), but a reload in the middle of a game or a live in-play market would interrupt the player.
 * So the app switches automatically only when nothing is in progress, and otherwise shows "Restart to Update" and
 * switches by itself once the player leaves the game.
 */
import type { GameStatus } from '../games/types';

export interface UpdateSafetyInput {
  /** Current screen (View name from the hash route, e.g. 'play', 'match', 'watch', 'exchange'). */
  route: string;
  /** Status of the game shown on the match route; 'unknown' while it is being looked up; null when not on it. */
  matchGameStatus: GameStatus | 'unknown' | null;
  /** In-play arena games (Federation live games) that have started and are not yet settled. */
  liveArenaGames: number;
  /** A featured arena game is being played right now (move-by-move or background). */
  featuredInFlight: boolean;
  /** A Federation command (round, trade, settlement) is being committed right now. */
  federationBusy: boolean;
  /** This tab is read-only because another Crown tab owns the saves (that tab may be mid-game). */
  readOnly: boolean;
}

export type UpdateBlocker = 'game-in-progress' | 'game-screen' | 'live-arena' | 'federation-busy' | 'other-tab';
export type UpdateSafety = { safe: true } | { safe: false; reason: UpdateBlocker };

const UNFINISHED: ReadonlySet<string> = new Set(['active', 'paused', 'terminal', 'unknown']);

export function updateSafety(i: UpdateSafetyInput): UpdateSafety {
  if (i.readOnly) return { safe: false, reason: 'other-tab' };
  if (i.federationBusy) return { safe: false, reason: 'federation-busy' };
  if (i.route === 'match') {
    // An unfinished (or still-loading) game is being played; a finished one is on its result screen — in both cases
    // wait until the player leaves the match screen.
    if (i.matchGameStatus === null || UNFINISHED.has(i.matchGameStatus)) return { safe: false, reason: 'game-in-progress' };
    return { safe: false, reason: 'game-screen' };
  }
  if (i.featuredInFlight || i.liveArenaGames > 0) return { safe: false, reason: 'live-arena' };
  return { safe: true };
}

export const BLOCKER_TEXT: Record<UpdateBlocker, string> = {
  'game-in-progress': 'It will install when you leave this game.',
  'game-screen': 'It will install when you leave this game.',
  'live-arena': 'It will install once the live arena game is settled.',
  'federation-busy': 'It will install in a moment.',
  'other-tab': 'Close other Crown tabs to install it.',
};
