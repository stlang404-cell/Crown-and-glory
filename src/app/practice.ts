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
import { TIME_CONTROLS, type PresetId } from '../games/types';

export interface PracticeSetup {
  opponentId: string;
  timeControl: PresetId;
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
  return { opponentId, timeControl: tc as PresetId, mode: 'casual', source: 'grimoire-plan' };
}

/** The practice setup for an engine level (the roster opponent of that level), or null if there is none. */
export function practiceForLevel(level: number, timeControl: PresetId = 'rapid'): PracticeSetup | null {
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

/* ---------- v0.10: practise a verified mistake from a game report ---------- */
/**
 * Game Review hands one of the player's own analysed mistakes to the Academy, which opens its Mistakes drill on that
 * position. The puzzle itself is built by the Academy from the stored report (src/academy/academy.ts
 * `mistakePuzzles`: the player's non-forced move with an expected-score loss of at least 0.12, solved by the engine's
 * best move), so nothing here can create an exercise that the report does not support.
 */
const DRILL_KEY = 'crown:practice-drill';
let pendingDrill: string | null = null;
export const mistakePuzzleId = (gameId: string, ply: number) => `mk-${gameId}-${ply}`;
const validDrill = (id: unknown): id is string => typeof id === 'string' && /^mk-.+-\d+$/.test(id) && id.length < 200;

export function requestMistakeDrill(puzzleId: string): void {
  pendingDrill = validDrill(puzzleId) ? puzzleId : null;
  try { if (pendingDrill) sessionStorage.setItem(DRILL_KEY, pendingDrill); else sessionStorage.removeItem(DRILL_KEY); } catch { /* storage unavailable */ }
}

/** Read and clear the pending drill (the Academy calls this once when it opens). */
export function takeMistakeDrill(): string | null {
  let id = pendingDrill;
  if (!id) { try { const s = sessionStorage.getItem(DRILL_KEY); id = validDrill(s) ? s : null; } catch { id = null; } }
  pendingDrill = null;
  try { sessionStorage.removeItem(DRILL_KEY); } catch { /* storage unavailable */ }
  return id;
}
