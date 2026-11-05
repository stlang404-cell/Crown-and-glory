/**
 * Display preferences: colour theme, board palette and motion. Stored in localStorage (this browser only,
 * never in the save database) and applied as attributes on <html>, which src/ui/themes.css keys on.
 * index.html carries an inline copy of `applyStoredPrefs` so the right theme is painted before React boots;
 * keep PREFS_KEY and the attribute names in sync with it.
 */

export const THEMES = [
  { id: 'obsidian', name: 'Obsidian & Burgundy', blurb: 'The royal default: graphite and ink, burgundy banners, gold leaf and silver steel.', scheme: 'dark', meta: '#111318', swatches: ['#111318', '#252932', '#f2ede3', '#962a3f', '#e2c074', '#c3cad4'] },
  { id: 'midnight', name: 'Midnight & Gold', blurb: 'Deep navy ink with royal-blue banners, gold and amethyst.', scheme: 'dark', meta: '#10151e', swatches: ['#10151e', '#222d3d', '#f1ebdd', '#3762bb', '#d8b56c', '#b9a2e8'] },
  { id: 'emerald', name: 'Emerald & Gold', blurb: 'Forest-dark surfaces, emerald banners and gold, on a green tournament board.', scheme: 'dark', meta: '#0d1512', swatches: ['#0d1512', '#1b2a22', '#eef0e6', '#1c7650', '#dfbd6c', '#c4ccd0'] },
  { id: 'ivory', name: 'Ivory & Slate', blurb: 'A light theme: warm parchment, slate ink, royal blue and burgundy details for daylight play.', scheme: 'light', meta: '#f2efe8', swatches: ['#f2efe8', '#fcfbf8', '#1c2129', '#284a8a', '#8a2b3e', '#74520f'] },
] as const;

export const BOARDS = [
  { id: 'theme', name: 'Theme default', blurb: 'Matches the colour theme.' },
  { id: 'walnut', name: 'Walnut', blurb: 'Warm maple and walnut wood tones.' },
  { id: 'slate', name: 'Slate', blurb: 'Cool blue-grey stone.' },
  { id: 'green', name: 'Green', blurb: 'Classic tournament green and cream.' },
  { id: 'mono', name: 'Monochrome', blurb: 'Neutral greys; the strongest square contrast.' },
  { id: 'marble', name: 'Royal Marble', blurb: 'Ivory and veined grey marble (unlock in Finance → Cosmetics).' },
  { id: 'crimson', name: 'Crimson Court', blurb: 'Rose stone and oxblood (unlock in Finance → Cosmetics).' },
] as const;
/** Board palettes that must be owned (cosmetic id) before they can be chosen. */
export const PREMIUM_BOARDS: Record<string, string> = { marble: 'board-marble', crimson: 'board-crimson' };

export const MOTIONS = [
  { id: 'system', name: 'Follow system' },
  { id: 'reduce', name: 'Reduce' },
  { id: 'full', name: 'Full' },
] as const;

/** Piece-movement speed (ms for an ordinary move). "Off" places pieces instantly; Reduce motion also turns slides off. */
export const PIECE_SPEEDS = [
  { id: 'off', name: 'Off', ms: 0 },
  { id: 'fast', name: 'Fast', ms: 140 },
  { id: 'normal', name: 'Normal', ms: 200 },
  { id: 'slow', name: 'Slow', ms: 280 },
] as const;
export type PieceSpeed = (typeof PIECE_SPEEDS)[number]['id'];

export type ThemeId = (typeof THEMES)[number]['id'];
export type BoardId = (typeof BOARDS)[number]['id'];
export type MotionPref = (typeof MOTIONS)[number]['id'];
export interface DisplayPrefs { theme: ThemeId; board: BoardId; motion: MotionPref; pieceSpeed: PieceSpeed }

export const PREFS_KEY = 'crown.display.v1';
export const DEFAULT_PREFS: DisplayPrefs = { theme: 'obsidian', board: 'theme', motion: 'system', pieceSpeed: 'normal' };

const isTheme = (x: unknown): x is ThemeId => THEMES.some(t => t.id === x);
const isBoard = (x: unknown): x is BoardId => BOARDS.some(b => b.id === x);
const isMotion = (x: unknown): x is MotionPref => MOTIONS.some(m => m.id === x);
const isSpeed = (x: unknown): x is PieceSpeed => PIECE_SPEEDS.some(m => m.id === x);

/** Read preferences; any missing, invalid or unreadable value falls back to the default. */
export function getPrefs(): DisplayPrefs {
  let raw: unknown = null;
  try { raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null'); } catch { raw = null; }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: isTheme(o.theme) ? o.theme : DEFAULT_PREFS.theme,
    board: isBoard(o.board) ? o.board : DEFAULT_PREFS.board,
    motion: isMotion(o.motion) ? o.motion : DEFAULT_PREFS.motion,
    pieceSpeed: isSpeed(o.pieceSpeed) ? o.pieceSpeed : DEFAULT_PREFS.pieceSpeed,
  };
}

const listeners = new Set<() => void>();
let current: DisplayPrefs | null = null;

/** Merge, persist (best effort) and apply a preference change. */
export function setPrefs(patch: Partial<DisplayPrefs>): DisplayPrefs {
  const next = { ...getCurrentPrefs(), ...patch };
  current = next;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep for this session only */ }
  applyPrefs(next);
  listeners.forEach(l => l());
  return next;
}
export const setTheme = (theme: ThemeId) => setPrefs({ theme });
export const setBoard = (board: BoardId) => setPrefs({ board });
export const setMotion = (motion: MotionPref) => setPrefs({ motion });
export const setPieceSpeed = (pieceSpeed: PieceSpeed) => setPrefs({ pieceSpeed });

/** Duration of an ordinary piece move in ms (0 = no animation): the speed setting, overridden by reduced motion. */
export function pieceMoveMs(p: DisplayPrefs = getCurrentPrefs()): number {
  if (prefersReducedMotion(p)) return 0;
  return PIECE_SPEEDS.find(x => x.id === p.pieceSpeed)!.ms;
}

export function getCurrentPrefs(): DisplayPrefs { return current ?? (current = getPrefs()); }
export function subscribePrefs(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

/** True when animation should be suppressed (explicit choice, or the OS setting when following the system). */
export function prefersReducedMotion(p: DisplayPrefs = getCurrentPrefs()): boolean {
  if (p.motion !== 'system') return p.motion === 'reduce';
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Write the preference attributes onto an element (default <html>) and update the browser chrome colour. */
export function applyPrefs(p: DisplayPrefs = getCurrentPrefs(), el: HTMLElement = document.documentElement): void {
  el.dataset.theme = p.theme;
  el.dataset.board = p.board;
  el.dataset.motion = p.motion;
  if (el === document.documentElement) {
    const meta = document.querySelector('meta[name="theme-color"]');
    const t = THEMES.find(x => x.id === p.theme)!;
    meta?.setAttribute('content', t.meta);
  }
}
