/**
 * Pure match state machine: created → active ↔ paused → terminal → (finalized by storage).
 * All time inputs are explicit (ms timestamps) so the session is deterministic and testable.
 */
import { Position } from '../rules/position';
import { moveToCcn, moveToSan, parseLegalCcn, NOTATION_VERSION } from '../rules/notation';
import {
  ADJUDICATION_POLICY, Outcome, agreementAllowed, automaticOutcome, claimableDraws, resignationOutcome, timeoutOutcome,
} from '../rules/adjudication';
import { Color, RULES_VERSION, START_FEN, VARIANT_ID, WHITE, Move } from '../rules/types';
import { GAME_SCHEMA_VERSION, GameMode, GameRecord, MoveRecord, ParticipantSnapshot, TimeControl, poolFor } from './types';
import { classifyOpening } from './openings';

export interface NewGameOptions {
  id: string;
  mode: GameMode;
  timeControl: TimeControl;
  humanColor: 'white' | 'black';
  human: ParticipantSnapshot;
  engine: ParticipantSnapshot;
  initialFen?: string;
  clocks?: { whiteMs: number; blackMs: number };
  /** Moves already played from initialFen (training retries keep the original history for repetition). */
  prefixMoves?: string[];
  context?: GameRecord['context'];
  engineSeed: number;
  nowIso: string;
}

export function createGameRecord(o: NewGameOptions): GameRecord {
  const timed = o.timeControl.id !== 'untimed';
  const rated = o.mode === 'rated' && timed;
  const white = o.humanColor === 'white' ? o.human : o.engine;
  const black = o.humanColor === 'white' ? o.engine : o.human;
  return {
    id: o.id,
    schemaVersion: GAME_SCHEMA_VERSION,
    variantId: VARIANT_ID,
    rulesVersion: RULES_VERSION,
    adjudicationPolicy: ADJUDICATION_POLICY,
    notationVersion: NOTATION_VERSION,
    initialFen: o.initialFen ?? START_FEN,
    setupMoves: o.prefixMoves ?? [],
    mode: rated ? 'rated' : o.mode === 'rated' ? 'casual' : o.mode,
    status: 'active',
    timeControl: o.timeControl,
    pool: rated ? poolFor(o.timeControl.id) : null,
    rated,
    humanColor: o.humanColor,
    white, black,
    createdAt: o.nowIso,
    startedAt: o.nowIso,
    endedAt: null,
    moves: [],
    assistance: [],
    pauses: [],
    result: null,
    termination: null,
    clocks: timed ? (o.clocks ?? { whiteMs: o.timeControl.initialMs, blackMs: o.timeControl.initialMs }) : null,
    context: o.context ?? { kind: 'quick-match' },
    opening: null,
    finalizationKey: null,
    ratingEventId: null,
    reportIds: [],
    bookmarks: [],
    checksum: null,
    engineSeed: o.engineSeed,
  };
}

export class GameSession {
  readonly record: GameRecord;
  readonly pos: Position;
  /** Wall-clock timestamp (ms) at which the side to move's clock started running; null when paused/untimed. */
  private runningSince: number | null = null;
  outcome: Outcome | null = null;
  /** Mover's clock value when the current turn began (for per-move elapsed time). */
  private turnClockStart: number | null = null;
  private turnWallStart = 0;

  constructor(record: GameRecord) {
    this.record = record;
    this.pos = Position.fromFen(record.initialFen);
    for (const s of record.setupMoves ?? []) {
      const mv = parseLegalCcn(this.pos, s);
      if (mv < 0) throw new Error(`Corrupt game ${record.id}: illegal setup move ${s}`);
      this.pos.makeMove(mv);
    }
    for (const m of record.moves) {
      const mv = parseLegalCcn(this.pos, m.ccn);
      if (mv < 0) throw new Error(`Corrupt game ${record.id}: illegal move ${m.ccn} at ply ${m.ply}`);
      this.pos.makeMove(mv);
    }
    if (record.result && record.termination) {
      this.outcome = { result: record.result, termination: record.termination, winner: record.result === '1-0' ? 0 : record.result === '0-1' ? 1 : null };
    }
  }

  get timed(): boolean { return this.record.clocks !== null; }
  get isOver(): boolean { return this.outcome !== null; }
  get sideToMove(): Color { return this.pos.side; }
  get humanColor(): Color { return this.record.humanColor === 'white' ? 0 : 1; }
  get plies(): number { return this.record.moves.length; }

  start(nowMs: number): void {
    this.turnWallStart = nowMs;
    if (this.timed && !this.isOver) {
      this.runningSince = nowMs;
      this.turnClockStart = this.pos.side === WHITE ? this.record.clocks!.whiteMs : this.record.clocks!.blackMs;
    }
  }

  pause(nowMs: number, reason: 'visibility' | 'manual' | 'reload', nowIso: string): void {
    if (this.isOver || this.runningSince === null) return;
    this.chargeRunning(nowMs);
    this.runningSince = null;
    this.record.status = 'paused';
    this.record.pauses.push({ at: nowIso, reason });
  }

  resume(nowMs: number, nowIso: string): void {
    if (this.isOver) return;
    const last = this.record.pauses[this.record.pauses.length - 1];
    if (last && !last.resumedAt) last.resumedAt = nowIso;
    this.record.status = 'active';
    if (this.timed) this.runningSince = nowMs;
    this.turnWallStart = nowMs;
  }

  get paused(): boolean { return this.timed && this.runningSince === null && !this.isOver; }

  /** Remaining time for a color at time `nowMs` (running clock included). */
  remaining(color: Color, nowMs: number): number {
    if (!this.record.clocks) return Infinity;
    const base = color === WHITE ? this.record.clocks.whiteMs : this.record.clocks.blackMs;
    if (this.runningSince !== null && color === this.pos.side && !this.isOver) return Math.max(0, base - (nowMs - this.runningSince));
    return base;
  }

  private chargeRunning(nowMs: number): number {
    if (!this.record.clocks || this.runningSince === null) return 0;
    const elapsed = Math.max(0, nowMs - this.runningSince);
    if (this.pos.side === WHITE) this.record.clocks.whiteMs = Math.max(0, this.record.clocks.whiteMs - elapsed);
    else this.record.clocks.blackMs = Math.max(0, this.record.clocks.blackMs - elapsed);
    this.runningSince = nowMs;
    return elapsed;
  }

  /** Check the running clock; returns the timeout outcome if the side to move has flagged. */
  tick(nowMs: number, nowIso: string): Outcome | null {
    if (this.isOver || !this.timed || this.runningSince === null) return null;
    if (this.remaining(this.pos.side, nowMs) <= 0) {
      this.chargeRunning(nowMs);
      return this.finish(timeoutOutcome(this.pos, this.pos.side), nowIso);
    }
    return null;
  }

  legalMoves(): Move[] { return this.isOver ? [] : this.pos.legalMoves(); }

  /**
   * Commit a move. Order at the commit boundary: (1) the mover's clock must not have expired
   * before the move (otherwise timeout); (2) the move must be legal; (3) increment is added;
   * (4) automatic terminal states (mate/stalemate/bare kings/fivefold/150) are checked.
   */
  applyMove(ccn: string, nowMs: number, nowIso: string, engine?: MoveRecord['engine']): { ok: true; record: MoveRecord; outcome: Outcome | null } | { ok: false; error: string; outcome?: Outcome } {
    if (this.isOver) return { ok: false, error: 'Game is over' };
    if (this.paused) return { ok: false, error: 'Game is paused' };
    const mover = this.pos.side;
    let elapsed = Math.max(0, nowMs - this.turnWallStart);
    let clockBefore: number | null = null;
    if (this.timed) {
      // Flag check first: a move submitted after the flag fell does not count.
      if (this.remaining(mover, nowMs) <= 0) {
        this.chargeRunning(nowMs);
        return { ok: false, error: 'Flag fell', outcome: this.finish(timeoutOutcome(this.pos, mover), nowIso) };
      }
    }
    const m = parseLegalCcn(this.pos, ccn);
    if (m < 0) return { ok: false, error: `Illegal move ${ccn}` };
    if (this.timed) {
      clockBefore = this.turnClockStart ?? (mover === WHITE ? this.record.clocks!.whiteMs : this.record.clocks!.blackMs);
      this.chargeRunning(nowMs);
      const left = mover === WHITE ? this.record.clocks!.whiteMs : this.record.clocks!.blackMs;
      elapsed = clockBefore - left;
    }
    const preHash = this.pos.hashKey();
    const san = moveToSan(this.pos, m);
    this.pos.makeMove(m);
    let clockAfter: number | null = null;
    if (this.timed) {
      const inc = this.record.timeControl.incrementMs;
      if (mover === WHITE) this.record.clocks!.whiteMs += inc; else this.record.clocks!.blackMs += inc;
      clockAfter = mover === WHITE ? this.record.clocks!.whiteMs : this.record.clocks!.blackMs;
      this.runningSince = nowMs;
      this.turnClockStart = mover === WHITE ? this.record.clocks!.blackMs : this.record.clocks!.whiteMs;
    }
    this.turnWallStart = nowMs;
    const rec: MoveRecord = {
      ply: this.record.moves.length + 1,
      ccn: moveToCcn(m), san, preHash, postHash: this.pos.hashKey(), fenAfter: this.pos.toFen(),
      clockBeforeMs: clockBefore, clockAfterMs: clockAfter, elapsedMs: Math.round(elapsed),
      ...(engine ? { engine } : {}),
    };
    this.record.moves.push(rec);
    if (!this.record.setupMoves?.length && (this.record.moves.length === 4 || (!this.record.opening && this.record.moves.length >= 2))) {
      this.record.opening = classifyOpening(this.record.initialFen, this.record.moves.map(x => x.ccn));
    }
    const auto = automaticOutcome(this.pos);
    return { ok: true, record: rec, outcome: auto ? this.finish(auto, nowIso) : null };
  }

  claims() { return this.isOver ? { threefold: false, fiftyMove: false } : claimableDraws(this.pos); }

  /** Only the side to move may claim (claims are made on one's own turn). */
  claimDraw(kind: 'threefold' | 'fiftyMove', nowMs: number, nowIso: string): Outcome | null {
    const c = this.claims();
    if (!c[kind]) return null;
    this.chargeRunning(nowMs);
    return this.finish({ result: '1/2-1/2', termination: kind === 'threefold' ? 'threefold-claim' : 'fifty-move-claim', winner: null }, nowIso);
  }

  canAgreeDraw(): boolean { return !this.isOver && agreementAllowed(this.plies); }

  agreeDraw(nowMs: number, nowIso: string): Outcome | null {
    if (!this.canAgreeDraw()) return null;
    this.chargeRunning(nowMs);
    return this.finish({ result: '1/2-1/2', termination: 'agreement', winner: null }, nowIso);
  }

  resign(color: Color, nowMs: number, nowIso: string): Outcome {
    this.chargeRunning(nowMs);
    return this.finish(resignationOutcome(color), nowIso);
  }

  markAssisted(kind: 'hint' | 'takeback' | 'analysis-during-play', nowIso: string): void {
    this.record.assistance.push({ ply: this.plies, kind, at: nowIso });
    if (this.record.rated) {
      // Engine assistance makes a game ineligible for rating.
      this.record.rated = false;
      this.record.mode = 'casual';
      this.record.pool = null;
    }
  }

  private finish(o: Outcome, nowIso: string): Outcome {
    this.outcome = o;
    this.runningSince = null;
    this.record.result = o.result;
    this.record.termination = o.termination;
    this.record.endedAt = nowIso;
    this.record.status = 'terminal';
    return o;
  }

  /** Copy of the record as a plain object for persistence. */
  snapshot(): GameRecord {
    return structuredClone(this.record);
  }
}
