/**
 * Exhibition Arena (crown-exhibition-1): any two distinct Federation competitors play an UNOFFICIAL match that the
 * player watches and studies.
 *
 * Engine (exactly like Federation featured and scheduled games, src/app/federation.ts):
 *  * each side plays with ITS OWN engine profile, `profileForStrength(latent, FEATURED_NODE_CAP)` (crown-profile-map-2;
 *    node cap 30,000, the featured/scheduled-game cap: a competitor rated above the measured range plays at that
 *    budget, which the UI says in words via `strengthNote`), and its validated style, `playStyle(style)`;
 *  * every move is a FRESH seeded search (seed of ply k = seed + k·7919, src/app/schedulerEngine.ts), so a paused,
 *    reloaded or resumed exhibition continues on exactly the same timeline;
 *  * terminal rules are the live-game rules (automatic outcomes, draw claims taken at once, 400-ply playing limit).
 *
 * Isolation (the reason this module exists apart from the Federation): an exhibition reads competitor records and
 * never writes Federation, rating, economy, Vault or game-history state. Its records live in the meta store under
 * their own prefixes (`exh:` the game, `exhrep:` its Match Analysis report; kind "exhibition", docs/SAVE_FORMAT.md),
 * never in `games`, `reports`, `worldGames`, `ratingEvents` or any Federation store — so nothing that reacts to "a game
 * finished" or reads analysis reports (Vault, rivalries, Played Like history, Lab, Academy, news, standings) can see
 * one. Tested in tests/exhibition.test.ts.
 */
import type { CrownDB } from '../storage/db';
import type { Competitor, StyleId } from '../federation/model';
import { divisionLabel } from '../federation/model';
import { profileForStrength, strengthNote, type StrengthNote } from '../federation/profiles';
import type { StrengthProfile } from '../engine/levels';
import { STYLE_LABEL, isValidatedStyle, playStyle, styleTendency } from '../engine/styles';
import type { SelfplayMove } from '../engine/selfplay';
import type { AnalysisReport, EngineScore } from '../analysis/types';
import { Position } from '../rules/position';
import { moveToCcn, moveToSan, parseLegalCcn } from '../rules/notation';
import { START_FEN, liveTerminal, plySeed } from './schedulerEngine';
import { FEATURED_NODE_CAP } from './federation';
import { hashSeed } from '../federation/generator';
import { sha256Hex } from '../storage/checksum';

export const EXHIBITION_ID = 'crown-exhibition-1';
/** Meta-store prefixes: the exhibition game, and its Match Analysis report. */
export const EXH_PREFIX = 'exh:';
export const EXH_REPORT_PREFIX = 'exhrep:';
export const EXHIBITION_PREFIXES = [EXH_PREFIX, EXH_REPORT_PREFIX] as const;
/** Same node cap as featured and scheduled Federation games. */
export const EXHIBITION_NODE_CAP = FEATURED_NODE_CAP;
export const isExhibitionId = (id: string | null | undefined): boolean => !!id && id.startsWith(EXH_PREFIX);

export interface ExhibitionSide {
  id: string;
  name: string;
  /** Career Elo (Glicko-2 rating) and RD at the start of the exhibition (read only; never changed by it). */
  rating: number;
  rd: number;
  division: number;
  region: number;
  fedTitle: string | null;
  /** The competitor's own style and the style actually played (unvalidated styles play as Universal). */
  style: StyleId;
  playedStyle: StyleId;
  persona: string | null;
  /** Engine profile used for this side (profileForStrength of its hidden strength at EXHIBITION_NODE_CAP). */
  profile: StrengthProfile;
}

export interface ExhibitionGame {
  id: string;
  kind: 'exhibition';
  schema: typeof EXHIBITION_ID;
  official: false;
  createdAt: string;
  finishedAt: string | null;
  status: 'playing' | 'finished';
  seed: number;
  nodeCap: number;
  initialFen: string;
  white: ExhibitionSide;
  black: ExhibitionSide;
  moves: SelfplayMove[];
  result: '1-0' | '0-1' | '1/2-1/2' | null;
  termination: string | null;
  /** SHA-256 over id, moves and result once finished (the analysis queue's input checksum). */
  checksum: string | null;
  /** v1.1 AI Arena: the DISPLAYED game clock (accounting only, never the engine budget; absent/null = no clock). */
  timeControl?: ExhibitionTimeControl | null;
  /** v1.1 AI Arena: set on a restart — the exhibition this one restarts and whether it kept that one's seed. */
  restartOf?: { id: string; seed: 'same' | 'new' } | null;
  /** v1.1 AI Arena: set on the OLD record when it was restarted (it stays in the archive, resumable as itself). */
  restartedAs?: string | null;
}

/* ------------------------------------------------------------------ display clock (v1.1 AI vs AI Arena) */

/**
 * Display time controls for exhibitions. The clock is DISPLAY and ACCOUNTING only: each move is charged the engine's
 * real measured thinking time (recorded in the move, so a replay shows the same clocks) plus the increment. It never
 * sets the engine's search budget — each side keeps its own profile budget (`thinkingBudget`), so a 120-minute game
 * plays at the same pace as any other — and it never decides a game (no time forfeits: exhibitions end only by the
 * rules' checkmate, stalemate and draw adjudication).
 *
 * Integrator note (package X): the long presets mirror X's new rated presets (30+30 … 240+120) and are defined here
 * so this package does not depend on X landing first; unify with src/games/types.ts TIME_CONTROLS when merging.
 */
export interface ExhibitionTimeControl { id: string; label: string; initialMs: number; incrementMs: number }
const tc = (min: number, inc: number, label?: string): ExhibitionTimeControl => ({ id: `${min}+${inc}`, label: label ?? `${min}+${inc}`, initialMs: min * 60_000, incrementMs: inc * 1000 });
export const EXHIBITION_TIME_CONTROLS: readonly ExhibitionTimeControl[] = [
  { id: 'untimed', label: 'No clock', initialMs: 0, incrementMs: 0 },
  tc(3, 2, 'Blitz 3+2'), tc(5, 3, 'Rapid 5+3'), tc(15, 10, 'Classical 15+10'),
  tc(30, 30, 'Classical 30+30'), tc(60, 30, 'Classical 60+30'), tc(90, 30, 'Classical 90+30'),
  tc(120, 90, 'Classical 120+90'), tc(180, 60, 'Classical 180+60'), tc(240, 120, 'Classical 240+120'),
];
export const timeControlById = (id: string | null | undefined): ExhibitionTimeControl | null => {
  const t = EXHIBITION_TIME_CONTROLS.find(x => x.id === id);
  return t && t.initialMs > 0 ? t : null;
};

/** Display clocks (ms remaining) after `upto` plies: initial − Σ measured engine time + increment per move made. */
export function clocksAt(g: Pick<ExhibitionGame, 'moves' | 'timeControl'>, upto = g.moves.length): { white: number; black: number; spent: { white: number; black: number } } | null {
  const t = g.timeControl;
  if (!t || !(t.initialMs > 0)) return null;
  const left = [t.initialMs, t.initialMs], spent = [0, 0];
  for (let i = 0; i < Math.min(upto, g.moves.length); i++) {
    const ms = Math.max(0, Math.round(g.moves[i].ms || 0));
    left[i % 2] += t.incrementMs - ms;
    spent[i % 2] += ms;
  }
  return { white: Math.max(0, left[0]), black: Math.max(0, left[1]), spent: { white: spent[0], black: spent[1] } };
}

/** The engine's own per-move budget of a side (its profile: wall-clock cap and node budget), independent of any clock. */
export function thinkingBudget(p: Pick<StrengthProfile, 'maxTimeMs' | 'nodes' | 'depth'>): { seconds: number; nodes: number | null; text: string } {
  const seconds = Math.round(p.maxTimeMs / 100) / 10;
  const nodes = Number.isFinite(p.nodes) ? p.nodes : null;
  return { seconds, nodes, text: `AI thinking budget: up to ${seconds} s per move${nodes !== null ? ` (${nodes.toLocaleString('en-US')} nodes)` : ''}` };
}

/** m:ss or h:mm:ss for a display clock. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}

/**
 * Restart semantics (documented in docs/AI_ARENA.md): a restart is a NEW exhibition record — new id, same two sides
 * exactly as recorded at the start (same engine profiles and styles, read from the record, not re-read from the
 * competitors), same colours and display clock, moves from the start position. `seed: 'same'` replays the identical
 * game (every move is a fresh seeded search of the recorded seed); `'new'` draws a new seed and so, usually, a new
 * game. The old record is kept in the archive (marked `restartedAs`); a practice market on it is voided.
 */
export function restartOf(old: ExhibitionGame, createdAt: string, seed: 'same' | 'new', fresh?: number): ExhibitionGame {
  const s = (seed === 'same' ? old.seed : (fresh ?? hashSeed('exhibition-restart', old.id, createdAt, Math.floor(Math.random() * 2 ** 31)))) >>> 0;
  let id = `${EXH_PREFIX}${createdAt.replace(/[^0-9]/g, '').slice(0, 17)}-${s.toString(36)}`;
  if (id === old.id) id = `${id}-r`;
  return {
    id, kind: 'exhibition', schema: EXHIBITION_ID, official: false, createdAt, finishedAt: null, status: 'playing', seed: s, nodeCap: old.nodeCap,
    initialFen: old.initialFen, white: old.white, black: old.black, moves: [], result: null, termination: null, checksum: null,
    timeControl: old.timeControl ?? null, restartOf: { id: old.id, seed }, restartedAs: null,
  };
}

export type ComputeMove = (req: { moves: string[]; profile: StrengthProfile; style: StyleId; seed: number }) => Promise<{ ccn: string; score: EngineScore; depth: number; nodes: number; ms: number }>;

/** The engine side of a competitor in an exhibition: its own profile and validated style (as Federation games). */
export function sideOf(c: Competitor): ExhibitionSide {
  return {
    id: c.id, name: c.name, rating: c.rating, rd: c.rd, division: c.division, region: c.region, fedTitle: c.fedTitle ?? null,
    style: c.style, playedStyle: playStyle(c.style), persona: c.persona ?? null, profile: profileForStrength(c.latent, EXHIBITION_NODE_CAP),
  };
}

/** Display facts for a competitor in the pickers and the match screen. */
export function sideFacts(c: Pick<Competitor, 'style' | 'rating' | 'division'>): { styleLabel: string; scouting: string | null; division: string; note: StrengthNote } {
  const s = isValidatedStyle(c.style) ? c.style : 'universal';
  return { styleLabel: STYLE_LABEL[s], scouting: styleTendency(s), division: divisionLabel(c.division), note: strengthNote(c.rating, EXHIBITION_NODE_CAP) };
}

/** A new exhibition between two distinct competitors (nothing is written). */
export function newExhibition(white: Competitor, black: Competitor, createdAt: string, seed?: number, timeControl: ExhibitionTimeControl | null = null): ExhibitionGame {
  if (!white || !black) throw new Error('Choose two competitors.');
  if (white.id === black.id) throw new Error('Choose two different competitors.');
  const s = (seed ?? hashSeed('exhibition', white.id, black.id, createdAt, Math.floor(Math.random() * 2 ** 31))) >>> 0;
  return {
    id: `${EXH_PREFIX}${createdAt.replace(/[^0-9]/g, '').slice(0, 17)}-${s.toString(36)}`, kind: 'exhibition', schema: EXHIBITION_ID, official: false,
    createdAt, finishedAt: null, status: 'playing', seed: s, nodeCap: EXHIBITION_NODE_CAP, initialFen: START_FEN,
    white: sideOf(white), black: sideOf(black), moves: [], result: null, termination: null, checksum: null,
    timeControl: timeControl && timeControl.initialMs > 0 ? { ...timeControl } : null,
  };
}

/** Position after the recorded moves (every move re-validated). */
export function positionOf(g: Pick<ExhibitionGame, 'initialFen' | 'moves'>, upto = g.moves.length): Position {
  const pos = Position.fromFen(g.initialFen);
  for (const m of g.moves.slice(0, upto)) {
    const mv = parseLegalCcn(pos, m.ccn);
    if (mv < 0) throw new Error(`Exhibition record has an illegal move ${m.ccn}.`);
    pos.makeMove(mv);
  }
  return pos;
}

/** The request for the next move: the side to move's own profile and played style, and the ply's seed. */
export function nextRequest(g: ExhibitionGame): { moves: string[]; profile: StrengthProfile; style: StyleId; seed: number } {
  const side = g.moves.length % 2 === 0 ? g.white : g.black;
  return { moves: g.moves.map(m => m.ccn), profile: side.profile, style: side.playedStyle, seed: plySeed(g.seed, g.moves.length) };
}

/** Apply an engine reply as the next move (validated), returning the new record and whether the game ended. */
export function applyMove(g: ExhibitionGame, r: Awaited<ReturnType<ComputeMove>>, now: string): ExhibitionGame {
  const pos = positionOf(g);
  const mv = parseLegalCcn(pos, r.ccn);
  if (mv < 0 || !pos.legalMoves().includes(mv)) throw new Error('Engine produced an illegal move');
  const san = moveToSan(pos, mv);
  pos.makeMove(mv);
  const move: SelfplayMove = { ccn: moveToCcn(mv), san, fen: pos.toFen(), score: r.score, depth: r.depth, nodes: r.nodes, ms: r.ms };
  const next: ExhibitionGame = { ...g, moves: [...g.moves, move] };
  const end = liveTerminal(pos, next.moves.length);
  return end ? { ...next, status: 'finished', result: end.result, termination: end.termination, finishedAt: now } : next;
}

/** Terminal state of a record that has not been marked finished (e.g. a game resumed after a reload). */
export function terminalOf(g: ExhibitionGame): { result: '1-0' | '0-1' | '1/2-1/2'; termination: string } | null {
  return liveTerminal(positionOf(g), g.moves.length);
}

export const exhibitionChecksum = (g: Pick<ExhibitionGame, 'id' | 'moves' | 'result'>) => sha256Hex(JSON.stringify({ id: g.id, moves: g.moves.map(m => m.ccn), result: g.result }));

/* ------------------------------------------------------------------ archive (meta store) */

export async function saveExhibition(db: CrownDB, g: ExhibitionGame): Promise<void> { await db.setMeta(g.id, g); }
export async function loadExhibition(db: CrownDB, id: string): Promise<ExhibitionGame | null> { return isExhibitionId(id) ? ((await db.getMeta<ExhibitionGame>(id)) ?? null) : null; }
/** Every archived exhibition, newest first. */
export async function listExhibitions(db: CrownDB): Promise<ExhibitionGame[]> {
  const rows = await db.metaWithPrefix<ExhibitionGame>(EXH_PREFIX);
  return rows.map(r => r.value).filter(g => g && g.kind === 'exhibition').sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
export const reportKey = (id: string) => `${EXH_REPORT_PREFIX}${id}`;
export async function loadExhibitionReport(db: CrownDB, id: string): Promise<AnalysisReport | null> { return (await db.getMeta<AnalysisReport>(reportKey(id))) ?? null; }
export async function saveExhibitionReport(db: CrownDB, r: AnalysisReport): Promise<void> {
  if (!isExhibitionId(r.gameId)) throw new Error('Not an exhibition report.');
  await db.setMeta(reportKey(r.gameId), r);
}
/** Delete an exhibition, its report, its analysis jobs and any favourites/positions saved from it. */
export async function deleteExhibition(db: CrownDB, id: string): Promise<void> {
  if (!isExhibitionId(id)) throw new Error('Not an exhibition.');
  await db.deleteMeta(id);
  await db.deleteMeta(reportKey(id));
  for (const j of await db.allJobs()) if (j.gameId === id) await db.deleteJob(j.id);
  for (const b of await db.getAll<{ id: string; gameId: string }>('bookmarks')) if (b.gameId === id) await db.remove('bookmarks', b.id);
}

/** Structural check of an imported exhibition record (legal replay of every move, finished games terminal). */
export function validateExhibition(g: ExhibitionGame): void {
  if (!g || g.kind !== 'exhibition' || !isExhibitionId(g.id) || !Array.isArray(g.moves) || !g.white?.id || !g.black?.id || g.white.id === g.black.id) throw new Error(`Exhibition ${g?.id ?? '?'} is malformed.`);
  const pos = Position.fromFen(g.initialFen);
  for (const m of g.moves) {
    const mv = parseLegalCcn(pos, m.ccn);
    if (mv < 0) throw new Error(`Exhibition ${g.id}: illegal move ${m.ccn}.`);
    pos.makeMove(mv);
    if (pos.toFen() !== m.fen) throw new Error(`Exhibition ${g.id}: stored position does not match legal replay.`);
  }
  if (g.status === 'finished' && !liveTerminal(pos, g.moves.length)) throw new Error(`Exhibition ${g.id}: marked finished but the position is not terminal.`);
}

/* ------------------------------------------------------------------ runner */

export type RunnerState = 'idle' | 'running' | 'paused' | 'finishing' | 'finished';
export const EXHIBITION_SPEEDS = [{ label: 'Slow', ms: 2200 }, { label: 'Normal', ms: 1100 }, { label: 'Fast', ms: 450 }, { label: 'Instant', ms: 0 }] as const;

export interface RunnerHost {
  db: CrownDB;
  compute: ComputeMove;
  /** Stop the in-flight engine search at once (the worker is terminated). */
  cancel: () => void;
  now: () => string;
  onChange?: () => void;
  /** The game finished (record saved): the app queues its Match Analysis. */
  onFinished?: (g: ExhibitionGame) => void;
  /** Whether engine work is running now, on every change (the app pauses scheduled games on phones meanwhile). */
  onBusy?: (busy: boolean) => void;
  readOnly?: () => boolean;
  /** v1.1: a move was saved; awaited before the move is shown (the practice market re-prices from it). Never throws into the game. */
  onMoved?: (g: ExhibitionGame) => Promise<void> | void;
  /** v1.1: Skip to Result was pressed (the practice market stops trading: the remaining moves are not watched). */
  onSkip?: (g: ExhibitionGame) => Promise<void> | void;
  /** v1.1: `old` was restarted as `next` (the practice market on `old` is voided). */
  onRestart?: (old: ExhibitionGame, next: ExhibitionGame) => Promise<void> | void;
}

/**
 * One exhibition at a time. While running, moves are computed one after another with `paceMs` between them;
 * `pause()` stops engine work at once (the in-flight search is cancelled and its reply discarded); `finish()`
 * computes the remaining moves with no pause between them. Every move is saved as it is played.
 */
export class ExhibitionRunner {
  game: ExhibitionGame | null = null;
  state: RunnerState = 'idle';
  paceMs: number = EXHIBITION_SPEEDS[1].ms;
  error: string | null = null;
  private gen = 0;
  private loopP: Promise<void> | null = null;
  constructor(readonly host: RunnerHost) {}

  get busy(): boolean { return this.state === 'running' || this.state === 'finishing'; }
  private stepping = false;
  private changed(): void { this.host.onBusy?.(this.busy || this.stepping); this.host.onChange?.(); }

  /** Start a new exhibition (any running one is paused first; it stays in the archive, resumable). */
  async start(white: Competitor, black: Competitor, opts: { seed?: number; paused?: boolean; timeControl?: ExhibitionTimeControl | null } = {}): Promise<ExhibitionGame> {
    if (this.host.readOnly?.()) throw new Error('This tab is read-only.');
    const g = newExhibition(white, black, this.host.now(), opts.seed, opts.timeControl ?? null);
    this.stopEngine();
    await saveExhibition(this.host.db, g);
    this.game = g; this.error = null;
    this.state = opts.paused ? 'paused' : 'running';
    this.changed();
    if (!opts.paused) this.kick();
    return g;
  }

  /**
   * Restart the current exhibition as a NEW game (restartOf): same pairing, colours and clock; the same seed (an
   * identical replay) or a new one. The engine stops at once; the old record stays archived, marked `restartedAs`.
   */
  async restart(seed: 'same' | 'new', opts: { paused?: boolean; fresh?: number } = {}): Promise<ExhibitionGame> {
    if (this.host.readOnly?.()) throw new Error('This tab is read-only.');
    const old = this.game;
    if (!old) throw new Error('No exhibition to restart.');
    this.stopEngine();
    const next = restartOf(old, this.host.now(), seed, opts.fresh);
    const marked: ExhibitionGame = { ...old, restartedAs: next.id };
    await saveExhibition(this.host.db, marked);
    await saveExhibition(this.host.db, next);
    try { await this.host.onRestart?.(marked, next); } catch (e) { console.error('exhibition restart hook', e); }
    this.game = next; this.error = null;
    this.state = opts.paused ? 'paused' : 'running';
    this.changed();
    if (!opts.paused) this.kick();
    return next;
  }

  /** Make a stored exhibition the current one (an unfinished one opens paused). */
  async open(id: string): Promise<ExhibitionGame | null> {
    if (this.game?.id === id) return this.game;
    const g = await loadExhibition(this.host.db, id);
    if (!g) return null;
    this.stopEngine();
    this.game = g; this.error = null;
    this.state = g.status === 'finished' ? 'finished' : 'paused';
    this.changed();
    return g;
  }

  pause(): void {
    if (!this.busy) return;
    this.stopEngine();
    this.state = 'paused';
    this.changed();
  }

  resume(): void {
    if (!this.game || this.game.status === 'finished' || this.busy) return;
    this.state = 'running';
    this.changed();
    this.kick();
  }

  /** Paused: compute exactly one more move. */
  async stepForward(): Promise<void> {
    if (!this.game || this.game.status === 'finished' || this.busy) return;
    if (this.stepping) return;
    const gen = ++this.gen;
    this.stepping = true; this.changed();
    try { await this.playOne(gen); } catch (e) { this.fail(e, gen); } finally { this.stepping = false; this.changed(); }
  }

  /** Skip to the final result: compute every remaining move without pacing. Resolves when the game is over (or stopped). */
  async finish(): Promise<void> {
    if (!this.game || this.game.status === 'finished') return;
    this.stopEngine();
    try { await this.host.onSkip?.(this.game); } catch (e) { console.error('exhibition skip hook', e); }
    this.state = 'finishing';
    this.changed();
    this.kick();
    await this.loopP;
  }

  /** Leave the current exhibition (stops the engine; the record stays in the archive). */
  close(): void {
    this.stopEngine();
    this.game = null;
    this.state = 'idle';
    this.changed();
  }

  /** Wait for the current loop (tests). */
  async settled(): Promise<void> { await this.loopP; }

  private stopEngine(): void {
    this.gen++;
    if (this.busy) { try { this.host.cancel(); } catch { /* nothing in flight */ } }
  }

  private kick(): void {
    const gen = ++this.gen;
    const p = this.loop(gen);
    this.loopP = p;
  }

  private fail(e: unknown, gen: number): void {
    if (gen !== this.gen) return; // cancelled: the reply belongs to a superseded request
    this.error = String((e as Error)?.message ?? e);
    this.state = 'paused';
    this.changed();
  }

  /** Compute and commit one move; returns false when the request was superseded (pause/close) or the game is over. */
  private async playOne(gen: number): Promise<boolean> {
    const g0 = this.game;
    if (!g0 || g0.status === 'finished') return false;
    const end = terminalOf(g0);
    if (end) { await this.finalize({ ...g0, status: 'finished', result: end.result, termination: end.termination, finishedAt: this.host.now() }); return false; }
    const r = await this.host.compute(nextRequest(g0));
    if (gen !== this.gen || this.game?.id !== g0.id) return false;
    const g = applyMove(g0, r, this.host.now());
    if (g.status === 'finished') { await this.finalize(g); return false; }
    this.game = g;
    await saveExhibition(this.host.db, g);
    // the practice market re-prices from the move before it is shown; a market failure never stops the game
    try { await this.host.onMoved?.(g); } catch (e) { console.error('exhibition move hook', e); }
    this.changed();
    return true;
  }

  private async finalize(g: ExhibitionGame): Promise<void> {
    const done = { ...g, checksum: await exhibitionChecksum(g) };
    this.game = done;
    this.state = 'finished';
    await saveExhibition(this.host.db, done);
    this.changed();
    this.host.onFinished?.(done);
  }

  private async loop(gen: number): Promise<void> {
    for (;;) {
      if (gen !== this.gen || !this.busy) return;
      let more: boolean;
      try { more = await this.playOne(gen); } catch (e) { this.fail(e, gen); return; }
      if (!more) return;
      if (this.state === 'running' && this.paceMs > 0) await new Promise(res => setTimeout(res, this.paceMs));
    }
  }
}

/** Elo expectation of White from the two career ratings (display only; exhibitions never change ratings). */
export const eloExpectation = (white: number, black: number): number => 1 / (1 + Math.pow(10, (black - white) / 400));
