/**
 * Settings → "Show contemporary famous names" (docs/ROSTER.md). Default ON, as the owner asked. When off, every
 * contemporary persona is shown under its stable original fictional name; ids, records and history never change.
 * Remembered in this browser only (localStorage), like the display and sound settings.
 */
const KEY = 'crown-contemporary-names';
let show: boolean | null = null;
const listeners = new Set<() => void>();

export function showContemporaryNames(): boolean {
  if (show === null) {
    let raw: string | null = null;
    try { raw = localStorage.getItem(KEY); } catch { raw = null; }
    show = raw !== 'off';
  }
  return show;
}

export function setShowContemporaryNames(v: boolean): void {
  show = v;
  try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* storage unavailable: this session only */ }
  listeners.forEach(l => l());
}

export const subscribeContemporaryNames = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
