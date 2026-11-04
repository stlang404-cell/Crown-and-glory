/**
 * Startup timeline (v1.0 package R, docs/evidence/v1.0/reload-flake.md). `mark()` records one named phase of the
 * cold start — database open, Federation load, first render, the deferred back-fills, analysis queue, scheduler — as
 * a User Timing mark (`crown:<name>`, visible in DevTools) and in an in-memory list read by e2e/startup.mjs through
 * `window.__crownStartup`. A mark costs one performance.now(); nothing is stored or sent anywhere.
 */
export interface StartupMark { name: string; t: number }

const marks: StartupMark[] = [];
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const MAX_MARKS = 500; // a long session keeps only its first marks (the startup is what they are for)

export function mark(name: string): void {
  if (marks.length >= MAX_MARKS) return;
  const t = now();
  marks.push({ name, t: Math.round(t * 10) / 10 });
  try { performance.mark(`crown:${name}`); } catch { /* User Timing unavailable */ }
}

/** Run an async phase between `<name>:start` and `<name>:end` marks (the end mark is written on failure too). */
export async function phase<T>(name: string, f: () => Promise<T>): Promise<T> {
  mark(`${name}:start`);
  try { return await f(); } finally { mark(`${name}:end`); }
}

export function startupMarks(): StartupMark[] { return marks.slice(); }
/** Time of the first mark with this name (ms since navigation start), or null. */
export function markTime(name: string): number | null { return marks.find(m => m.name === name)?.t ?? null; }
