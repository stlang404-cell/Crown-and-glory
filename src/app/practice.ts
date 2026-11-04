/**
 * Practice-game hand-off (crown-practice-1): a screen that suggests a practice game (the Grimoire's Today's Plan)
 * leaves the chosen opponent and time control here, and the Play screen preselects them the next time it opens.
 *
 * A practice setup is ALWAYS casual: it can never start a rated game by itself (the player may still choose Rated
 * on the Play screen, which is the ordinary, unassisted rated flow). Assistance availability is decided by the game
 * session from the game's mode, never by this hand-off, so nothing here can leak assistance into rated play.
 * The setup is kept in memory and mirrored to sessionStorage (best effort) so a reload of the Play screen keeps it.
 */
import { ROSTER } from '../federation/roster';
import { TIME_CONTROLS, type TimeControlId } from '../games/types';

export interface PracticeSetup {
  opponentId: string;
  timeControl: TimeControlId;
  mode: 'casual';
  source: 'grimoire-plan';
}

const KEY = 'crown:practice-setup';
let pending: PracticeSetup | null = null;

/** Validate an untrusted value; null unless the opponent and time control exist. The mode is forced to casual. */
export function sanitizePractice(raw: unknown): PracticeSetup | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const opponentId = typeof r.opponentId === 'string' ? r.opponentId : '';
  const tc = typeof r.timeControl === 'string' ? r.timeControl : 'rapid';
  if (!ROSTER.some(o => o.id === opponentId)) return null;
  if (!Object.prototype.hasOwnProperty.call(TIME_CONTROLS, tc)) return null;
  return { opponentId, timeControl: tc as TimeControlId, mode: 'casual', source: 'grimoire-plan' };
}

/** The practice setup for an engine level (the roster opponent of that level), or null if there is none. */
export function practiceForLevel(level: number, timeControl: TimeControlId = 'rapid'): PracticeSetup | null {
  const o = ROSTER.find(x => x.level === level);
  return o ? sanitizePractice({ opponentId: o.id, timeControl }) : null;
}

export function requestPractice(s: PracticeSetup): void {
  pending = sanitizePractice(s);
  try { if (pending) sessionStorage.setItem(KEY, JSON.stringify(pending)); else sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

/** Read the pending setup without consuming it (safe to call from a render/initialiser). */
export function peekPractice(): PracticeSetup | null {
  if (pending) return pending;
  try { const s = sessionStorage.getItem(KEY); return s ? sanitizePractice(JSON.parse(s)) : null; } catch { return null; }
}

export function clearPractice(): void {
  pending = null;
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
