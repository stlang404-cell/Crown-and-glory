/**
 * Procedural sound effects (Web Audio): every sound is synthesised on the device from oscillators and filtered
 * noise, so there are no audio files, licences or network requests and it works offline everywhere.
 *
 * Browsers only allow audio after a user gesture. The AudioContext is created on the first pointer or key press
 * (a legitimate unlock) and nothing is attempted before that; until then sounds are silently skipped.
 * Preferences live in localStorage (this browser only), like the display settings.
 */
export type SoundId = 'move' | 'capture' | 'check' | 'promotion' | 'checkmate' | 'draw' | 'victory' | 'defeat' | 'tournament' | 'rank';
export type SoundCategory = 'moves' | 'results' | 'ceremonies';
export const SOUND_CATEGORY: Record<SoundId, SoundCategory> = {
  move: 'moves', capture: 'moves', check: 'moves', promotion: 'moves',
  checkmate: 'results', draw: 'results', victory: 'results', defeat: 'results',
  tournament: 'ceremonies', rank: 'ceremonies',
};
export const SOUND_CATEGORIES: { id: SoundCategory; name: string; detail: string }[] = [
  { id: 'moves', name: 'Moves', detail: 'Moves, captures, checks and promotions' },
  { id: 'results', name: 'Game Results', detail: 'Checkmate, draws, wins and losses' },
  { id: 'ceremonies', name: 'Ceremonies', detail: 'Tournament victories and promotions' },
];

export interface SoundPrefs { enabled: boolean; volume: number; categories: Record<SoundCategory, boolean> }
export const SOUND_KEY = 'crown.sound.v1';
export const DEFAULT_SOUND: SoundPrefs = { enabled: true, volume: 0.6, categories: { moves: true, results: true, ceremonies: true } };

export function readSoundPrefs(): SoundPrefs {
  let raw: unknown = null;
  try { raw = JSON.parse(localStorage.getItem(SOUND_KEY) ?? 'null'); } catch { raw = null; }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<SoundPrefs>;
  const cats = (o.categories && typeof o.categories === 'object' ? o.categories : {}) as Partial<Record<SoundCategory, unknown>>;
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_SOUND.enabled,
    volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : DEFAULT_SOUND.volume,
    categories: {
      moves: typeof cats.moves === 'boolean' ? cats.moves : true,
      results: typeof cats.results === 'boolean' ? cats.results : true,
      ceremonies: typeof cats.ceremonies === 'boolean' ? cats.ceremonies : true,
    },
  };
}

let prefs: SoundPrefs | null = null;
const listeners = new Set<() => void>();
export const getSoundPrefs = (): SoundPrefs => prefs ?? (prefs = readSoundPrefs());
export function setSoundPrefs(patch: Partial<SoundPrefs>): SoundPrefs {
  prefs = { ...getSoundPrefs(), ...patch, categories: { ...getSoundPrefs().categories, ...(patch.categories ?? {}) } };
  try { localStorage.setItem(SOUND_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable: this session only */ }
  if (master) master.gain.value = prefs.volume;
  listeners.forEach(l => l());
  return prefs;
}
export const subscribeSound = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

// ---------- audio graph ----------
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
/** Recently played sounds, for de-duplication (re-renders, double events). Exposed for tests and e2e checks. */
export const soundLog: { id: SoundId; at: number }[] = [];

export function audioUnlocked(): boolean { return !!ctx && ctx.state === 'running'; }

/** Create/resume the AudioContext. Call only from a user gesture handler. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = getSoundPrefs().volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
      const d = noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff - 1); }
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { ctx = null; }
}

/** Install the one-time gesture listeners that unlock audio (idempotent). */
export function installAudioUnlock(): void {
  if (typeof window === 'undefined' || (window as unknown as { __crownAudio?: boolean }).__crownAudio) return;
  (window as unknown as { __crownAudio?: boolean }).__crownAudio = true;
  const on = () => unlockAudio();
  window.addEventListener('pointerdown', on, { capture: true, passive: true });
  window.addEventListener('keydown', on, { capture: true });
}

function tone(t0: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', glideTo?: number) {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master!);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
/** Short filtered noise burst: the "wood" of a piece being set down. */
function knock(t0: number, freq: number, q: number, dur: number, gain: number) {
  const s = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  s.buffer = noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(master!);
  s.start(t0); s.stop(t0 + dur + 0.01);
}
function chord(t0: number, freqs: number[], step: number, dur: number, gain: number, type: OscillatorType = 'triangle') {
  freqs.forEach((f, i) => tone(t0 + i * step, f, dur, gain, type));
}

const SYNTH: Record<SoundId, (t: number) => void> = {
  move: t => { knock(t, 1900, 1.4, 0.06, 0.55); tone(t, 210, 0.07, 0.18, 'sine', 160); },
  capture: t => { knock(t, 1300, 1.1, 0.09, 0.75); knock(t + 0.035, 2500, 2, 0.05, 0.35); tone(t, 150, 0.1, 0.22, 'sine', 110); },
  check: t => { knock(t, 1900, 1.4, 0.05, 0.4); tone(t + 0.02, 988, 0.32, 0.12, 'sine'); tone(t + 0.02, 1482, 0.24, 0.05, 'sine'); },
  promotion: t => { knock(t, 1900, 1.4, 0.05, 0.4); chord(t + 0.03, [784, 988, 1175], 0.06, 0.32, 0.09); },
  checkmate: t => { chord(t, [392, 494, 587, 784], 0.07, 0.9, 0.1, 'triangle'); tone(t, 98, 0.9, 0.12, 'sine'); },
  draw: t => { tone(t, 523, 0.35, 0.09, 'triangle'); tone(t + 0.18, 523, 0.45, 0.08, 'triangle'); },
  victory: t => { chord(t, [523, 659, 784, 1047], 0.09, 0.6, 0.09, 'triangle'); },
  defeat: t => { tone(t, 440, 0.4, 0.08, 'triangle'); tone(t + 0.22, 349, 0.6, 0.08, 'triangle'); },
  tournament: t => { chord(t, [392, 523, 659, 784], 0.11, 0.5, 0.08, 'triangle'); chord(t + 0.5, [523, 659, 784, 1047], 0, 1.1, 0.06, 'triangle'); tone(t + 0.5, 131, 1.1, 0.1, 'sine'); },
  rank: t => { chord(t, [659, 784, 988, 1319], 0.07, 0.5, 0.07, 'sine'); },
};

/** Minimum spacing between two plays of the same sound: re-renders and duplicate events never double a sound. */
const DEDUPE_MS = 120;
const lastAt = new Map<SoundId, number>();

export function canPlay(id: SoundId, p: SoundPrefs = getSoundPrefs()): boolean {
  return p.enabled && p.volume > 0 && p.categories[SOUND_CATEGORY[id]];
}

export function playSound(id: SoundId): boolean {
  if (!canPlay(id)) return false;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - (lastAt.get(id) ?? -1e9) < DEDUPE_MS) return false;
  lastAt.set(id, now);
  soundLog.push({ id, at: now }); if (soundLog.length > 200) soundLog.shift();
  if (!ctx || !master || ctx.state !== 'running') return false; // locked until a user gesture: skip silently
  try { SYNTH[id](ctx.currentTime + 0.005); } catch { return false; }
  return true;
}

/** The sound for a move: priority promotion > check > capture > move (one sound per move). */
export function moveSoundId(o: { capture: boolean; check: boolean; promotion: boolean }): SoundId {
  return o.promotion ? 'promotion' : o.check ? 'check' : o.capture ? 'capture' : 'move';
}

/** Play a sound once per key (e.g. a game id + result) for the lifetime of the page. */
const played = new Set<string>();
export function playOnce(key: string, id: SoundId): void {
  if (played.has(key)) return;
  played.add(key);
  playSound(id);
}
