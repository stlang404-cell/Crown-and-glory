/**
 * Persistent game record schema (schema crown-game-record v1).
 * Every played game — rated, casual, assisted or training — is stored with enough information to
 * reproduce every position exactly (initial FEN + ordered legal CCN moves + per-ply hashes).
 */
import type { ResultCode, Termination } from '../rules/adjudication';

export const GAME_SCHEMA_VERSION = 1;

export type TimeControlId = 'blitz' | 'rapid' | 'classical' | 'untimed';
export interface TimeControl {
  id: TimeControlId;
  label: string;
  initialMs: number;
  incrementMs: number;
}
export const TIME_CONTROLS: Record<TimeControlId, TimeControl> = {
  blitz: { id: 'blitz', label: 'Blitz 3+2', initialMs: 180_000, incrementMs: 2_000 },
  rapid: { id: 'rapid', label: 'Rapid 5+3', initialMs: 300_000, incrementMs: 3_000 },
  classical: { id: 'classical', label: 'Classical 15+10', initialMs: 900_000, incrementMs: 10_000 },
  untimed: { id: 'untimed', label: 'Untimed', initialMs: 0, incrementMs: 0 },
};

/** Rating pools are separated by time control; untimed games are never rated. */
export type PoolId = 'blitz' | 'rapid' | 'classical';
export const poolFor = (tc: TimeControlId): PoolId | null => (tc === 'untimed' ? null : tc);

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
  engine?: { profileId: string; level: number; levelsId: string; searchId: string; evalId: string; calibrationId: string; style: string };
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
  engine?: { depth: number; nodes: number; timeMs: number; selected: 'best' | 'bounded-sample'; seed: number };
}

export interface AssistanceEvent {
  ply: number;
  kind: 'hint' | 'takeback' | 'analysis-during-play' | 'candidates' | 'threat' | 'evaluation' | 'explanation';
  at: string;
}

export interface PauseEvent {
  at: string;
  resumedAt?: string;
  reason: 'visibility' | 'manual' | 'reload';
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
  /** Remaining clocks at the end/last save. */
  clocks: { whiteMs: number; blackMs: number } | null;
  context: { kind: 'quick-match' | 'training-retry' | 'imported'; sourceGameId?: string; sourcePly?: number; tournamentId?: string };
  opening: { name: string; classifierVersion: string } | null;
  /** Finalization key: guarantees exactly-once result/rating commit. */
  finalizationKey: string | null;
  ratingEventId: string | null;
  /** Analysis report ids (all versions, oldest first). */
  reportIds: string[];
  bookmarks: number[];
  checksum: string | null;
  engineSeed: number;
}
