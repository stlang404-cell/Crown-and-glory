/**
 * Persistent game record schema (schema crown-game-record v1).
 * Every played game — rated, casual, assisted or training — is stored with enough information to
 * reproduce every position exactly (initial FEN + ordered legal CCN moves + per-ply hashes).
 */
import type { ResultCode, Termination } from '../rules/adjudication';

export const GAME_SCHEMA_VERSION = 1;

/**
 * Time controls (crown-time-controls-2, docs/CAREER_RATING.md §7). Fischer increment: `incrementMs` is added to the
 * clock of the player who completes a legal move.
 *
 * Rated human play needs a base of at least 30 minutes (owner requirement, v1.1 Grand Classical update): the six
 * RATED_PRESETS below, or a custom control inside the same documented envelope (base 30–240 min, increment
 * 30–120 s). Every rated game of these controls is rated in ONE career pool, CAREER_POOL ('classical-long').
 * The older controls (Blitz 3+2, Rapid 5+3, Classical 15+10) keep their ids and labels unchanged — historical games
 * store their own clock definition and are always shown with it — but new games at these controls are casual only.
 */
export type RatedPresetId = 'xrapid30' | 'classical60' | 'grand90' | 'crownmaster120' | 'marathon180' | 'eternal240';
export type LegacyControlId = 'blitz' | 'rapid' | 'classical';
export type PresetId = RatedPresetId | LegacyControlId | 'untimed';
export type TimeControlId = PresetId | 'custom';
export interface TimeControl {
  id: TimeControlId;
  label: string;
  initialMs: number;
  incrementMs: number;
}
const MIN = 60_000, SEC = 1_000;
export const TIME_CONTROLS: Record<PresetId, TimeControl> = {
  blitz: { id: 'blitz', label: 'Blitz 3+2', initialMs: 180_000, incrementMs: 2_000 },
  rapid: { id: 'rapid', label: 'Rapid 5+3', initialMs: 300_000, incrementMs: 3_000 },
  classical: { id: 'classical', label: 'Classical 15+10', initialMs: 900_000, incrementMs: 10_000 },
  untimed: { id: 'untimed', label: 'Untimed', initialMs: 0, incrementMs: 0 },
  xrapid30: { id: 'xrapid30', label: 'Extended Rapid 30+30', initialMs: 30 * MIN, incrementMs: 30 * SEC },
  classical60: { id: 'classical60', label: 'Classical 60+60', initialMs: 60 * MIN, incrementMs: 60 * SEC },
  grand90: { id: 'grand90', label: 'Grand Classical 90+60', initialMs: 90 * MIN, incrementMs: 60 * SEC },
  crownmaster120: { id: 'crownmaster120', label: 'Crownmaster 120+90', initialMs: 120 * MIN, incrementMs: 90 * SEC },
  marathon180: { id: 'marathon180', label: 'Marathon 180+120', initialMs: 180 * MIN, incrementMs: 120 * SEC },
  eternal240: { id: 'eternal240', label: 'Eternal Crown 240+120', initialMs: 240 * MIN, incrementMs: 120 * SEC },
};
/** Human-rated presets, shortest first. */
export const RATED_PRESETS: readonly RatedPresetId[] = ['xrapid30', 'classical60', 'grand90', 'crownmaster120', 'marathon180', 'eternal240'];
/** Older, shorter controls: casual only for new games (never relabelled). */
export const CASUAL_CONTROLS: readonly PresetId[] = ['blitz', 'rapid', 'classical', 'untimed'];
/** Default for every new human-rated match (Play, Quick Match, Federation fixtures). */
export const DEFAULT_RATED_PRESET: RatedPresetId = 'classical60';
export const DEFAULT_RATED_CONTROL: TimeControl = TIME_CONTROLS[DEFAULT_RATED_PRESET];
/** Federation player fixtures whose game is created from v1.1 on (docs/CAREER_RATING.md §7.4). */
export const FEDERATION_TIME_CONTROL: TimeControl = TIME_CONTROLS.classical60;

/** The documented envelope of human-rated play (minimum base 30 minutes). */
export const RATED_ENVELOPE = { minBaseMin: 30, maxBaseMin: 240, minIncS: 30, maxIncS: 120 } as const;
/** Custom controls the selector accepts (rated only inside RATED_ENVELOPE). */
export const CUSTOM_LIMITS = { minBaseMin: 30, maxBaseMin: 240, minIncS: 0, maxIncS: 120 } as const;

/** A custom control (whole minutes and seconds, clamped to CUSTOM_LIMITS). */
export function customTimeControl(baseMin: number, incS: number): TimeControl {
  const b = Math.min(CUSTOM_LIMITS.maxBaseMin, Math.max(CUSTOM_LIMITS.minBaseMin, Math.round(Number.isFinite(baseMin) ? baseMin : 60)));
  const i = Math.min(CUSTOM_LIMITS.maxIncS, Math.max(CUSTOM_LIMITS.minIncS, Math.round(Number.isFinite(incS) ? incS : 0)));
  return { id: 'custom', label: `Custom ${b}+${i}`, initialMs: b * MIN, incrementMs: i * SEC };
}

/** Is this control inside the rated envelope (base 30–240 whole minutes, increment 30–120 whole seconds)? */
export function isRatedControl(tc: Pick<TimeControl, 'id' | 'initialMs' | 'incrementMs'>): boolean {
  if (tc.id === 'untimed') return false;
  const b = tc.initialMs / MIN, i = tc.incrementMs / SEC;
  return Number.isInteger(b) && Number.isInteger(i) && b >= RATED_ENVELOPE.minBaseMin && b <= RATED_ENVELOPE.maxBaseMin && i >= RATED_ENVELOPE.minIncS && i <= RATED_ENVELOPE.maxIncS;
}

/** Library / Passport filter options (by stored control id; historical labels: Blitz, Rapid, Classical 15+10). */
export const TC_FILTER_OPTIONS: readonly [TimeControlId, string][] = [
  ...RATED_PRESETS.map(id => [id, TIME_CONTROLS[id].label] as [TimeControlId, string]),
  ['custom', 'Custom'], ['blitz', 'Blitz 3+2'], ['rapid', 'Rapid 5+3'], ['classical', 'Classical 15+10'], ['untimed', 'Untimed'],
];

/** Plain-language explanation: "60 minutes per player, plus 60 seconds after every completed move". */
export function describeControl(tc: Pick<TimeControl, 'id' | 'initialMs' | 'incrementMs'>): string {
  if (tc.id === 'untimed' || tc.initialMs <= 0) return 'No clock';
  const m = tc.initialMs / MIN;
  const base = m >= 1 && Number.isInteger(m) ? `${m} minute${m === 1 ? '' : 's'}` : `${Math.round(tc.initialMs / SEC)} seconds`;
  const inc = tc.incrementMs / SEC;
  return inc > 0 ? `${base} per player, plus ${inc} second${inc === 1 ? '' : 's'} after every completed move` : `${base} per player, no increment`;
}

/**
 * Rating pools. 'classical-long' is the career pool (CAREER_POOL, src/ratings/pools.ts) for every rated game of
 * 30+ minutes. 'rapid', 'blitz' and 'classical' are legacy pools: their histories stay intact and visible, games
 * already in progress when v1.1 was installed finish in them, and no new game is rated in them.
 */
export type PoolId = 'blitz' | 'rapid' | 'classical' | 'classical-long';
/** The pool a NEW game at this control is rated in (null: casual only). */
export const poolFor = (tc: Pick<TimeControl, 'id' | 'initialMs' | 'incrementMs'>): PoolId | null => (isRatedControl(tc) ? 'classical-long' : null);
/** Pre-v1.1 mapping, for reading old games only: each legacy control had its own pool. */
export const legacyPoolFor = (tc: TimeControlId): PoolId | null => (tc === 'blitz' || tc === 'rapid' || tc === 'classical' ? tc : null);

export type GameMode = 'rated' | 'casual' | 'training';
export type GameStatus = 'active' | 'paused' | 'terminal' | 'finalized' | 'abandoned';

export interface ParticipantSnapshot {
  kind: 'human' | 'engine';
  id: string;
  name: string;
  /** Rating snapshot at game start (null when not applicable). */
  rating: number | null;
  rd: number | null;
  /** Engine opponents only. */
  engine?: { profileId: string; level: number; levelsId: string; searchId: string; evalId: string; calibrationId: string; style: string; profile?: import('../engine/levels').StrengthProfile; styleId?: import('../federation/model').StyleId;
    /** v0.5: exact engine configuration used for this game (rules, backend, build, memory, budget). */
    config?: { rules: string; backend: string; build: string; intel: string; ttBits: number; maxTimeMs: number; nodes: number | null; selection: 'best' | 'bounded' } };
}

export interface MoveRecord {
  ply: number; // 1-based
  ccn: string;
  san: string;
  /** Position hashes before and after (Zobrist, hex). */
  preHash: string;
  postHash: string;
  /** FEN after the move (complete rules state except repetition history, which is the record itself). */
  fenAfter: string;
  /** Clock of the mover before and after (ms), and time spent. Null for untimed games. */
  clockBeforeMs: number | null;
  clockAfterMs: number | null;
  elapsedMs: number;
  /** Engine move metadata (engine moves only). */
  engine?: { depth: number; nodes: number; timeMs: number; selected: 'best' | 'bounded-sample' | 'repertoire' | 'error-random' | 'error-sample'; seed: number;
    /** v0.5 provenance: score (side to move's view), stop reason and build of the search that chose the move. */
    score?: { kind: 'cp' | 'mate'; value: number }; stopReason?: string; build?: string };
}

export interface AssistanceEvent {
  ply: number;
  kind: 'hint' | 'takeback' | 'analysis-during-play' | 'candidates' | 'threat' | 'evaluation' | 'explanation';
  at: string;
}

export interface PauseEvent {
  at: string;
  resumedAt?: string;
  /** v1.1 adds 'pagehide', 'freeze' (page lifecycle) and 'leave' (left the match screen); older records use the first three. */
  reason: 'visibility' | 'manual' | 'reload' | 'pagehide' | 'freeze' | 'leave';
}

export interface GameRecord {
  id: string;
  schemaVersion: number;
  variantId: string;
  rulesVersion: string;
  adjudicationPolicy: string;
  notationVersion: string;
  initialFen: string;
  /** Moves applied from initialFen before this game's own moves (training retries keep the original
   *  history so repetition state is exact). Never shown or analysed as part of this game. */
  setupMoves?: string[];
  mode: GameMode;
  status: GameStatus;
  timeControl: TimeControl;
  pool: PoolId | null;
  /** Rated eligibility after assistance checks. */
  rated: boolean;
  humanColor: 'white' | 'black';
  white: ParticipantSnapshot;
  black: ParticipantSnapshot;
  createdAt: string;
  startedAt: string;
  endedAt: string | null;
  moves: MoveRecord[];
  assistance: AssistanceEvent[];
  pauses: PauseEvent[];
  result: ResultCode | null;
  termination: Termination | null;
  /** Remaining clocks at the end/last save. From v1.1 the running clock is committed here every few seconds while
   *  a player thinks (heartbeat) and whenever the page is hidden, so a reload charges at most the time up to the
   *  last commit (docs/SAVE_FORMAT.md, pause-on-exit policy). */
  clocks: { whiteMs: number; blackMs: number } | null;
  /** v1.1 (additive, optional): the side to move's clock when its current turn began, so per-move time stays exact
   *  across pauses and reloads. Absent on older records (the move then records the clock at resume). */
  clockTurn?: { ply: number; startMs: number };
  context: { kind: 'quick-match' | 'training-retry' | 'imported' | 'federation'; sourceGameId?: string; sourcePly?: number; tournamentId?: string; fixtureId?: string; eventName?: string };
  opening: { name: string; classifierVersion: string } | null;
  /** Finalization key: guarantees exactly-once result/rating commit. */
  finalizationKey: string | null;
  ratingEventId: string | null;
  /** Analysis report ids (all versions, oldest first). */
  reportIds: string[];
  bookmarks: number[];
  checksum: string | null;
  engineSeed: number;
  /** v0.10 (additive, optional): permanent Played Like records of the player's own estimate, one per model id
   *  (crown-pl-record-1, src/analysis/playedLikeRecords.ts). Not part of the checksum. */
  playedLike?: import('../analysis/playedLikeRecords').PlayedLikeGameRecord[];
}
