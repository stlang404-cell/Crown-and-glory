/**
 * Crown competition adjudication policy for crown-la6-v1 (policy id crown-adj-1).
 *
 * Source: research document 04 "Crown competition policies". Intentional differences from
 * orthodox (FIDE) chess are declared here and shown in the in-game rules sheet:
 *  - Only bare kings (K vs K) is automatically drawn as a dead position. Other insufficient-material
 *    combinations continue until agreement, repetition or the no-progress rules apply.
 *  - Timeout: the flagging player loses if the opponent has ANY non-king piece, otherwise draw —
 *    even if that piece could never deliver mate (orthodox rules would draw some of those).
 *  - Threefold repetition and the 100-halfmove rule are claimable; fivefold repetition and 150
 *    halfmoves are automatic. Checkmate on the final move takes precedence over every draw.
 *  - Draw by agreement is allowed only after each side has moved at least ten times.
 * Engine evaluation never decides a result.
 */
import { Position } from './position';
import { Color, WHITE } from './types';

export const ADJUDICATION_POLICY = 'crown-adj-1';

export type ResultCode = '1-0' | '0-1' | '1/2-1/2';
export type Termination =
  | 'checkmate'
  | 'stalemate'
  | 'bare-kings'
  | 'fivefold-repetition'
  | 'seventy-five-move'
  | 'threefold-claim'
  | 'fifty-move-claim'
  | 'agreement'
  | 'resignation'
  | 'timeout'
  | 'timeout-vs-bare-king'
  | 'abandoned';

export interface Outcome {
  result: ResultCode;
  termination: Termination;
  /** Winner color, or null for a draw. */
  winner: Color | null;
}

export const winResult = (winner: Color): ResultCode => (winner === WHITE ? '1-0' : '0-1');

/**
 * Automatic terminal status of a position reached in a game (call after each committed move).
 * Precedence: checkmate > stalemate > bare kings > fivefold > 150 halfmoves.
 */
export function automaticOutcome(pos: Position): Outcome | null {
  const hasMove = pos.hasLegalMove();
  if (!hasMove) {
    if (pos.inCheck()) {
      const winner = (pos.side ^ 1) as Color;
      return { result: winResult(winner), termination: 'checkmate', winner };
    }
    return { result: '1/2-1/2', termination: 'stalemate', winner: null };
  }
  if (!pos.hasNonKingPiece(0) && !pos.hasNonKingPiece(1)) {
    return { result: '1/2-1/2', termination: 'bare-kings', winner: null };
  }
  if (pos.repetitionCount() >= 5) return { result: '1/2-1/2', termination: 'fivefold-repetition', winner: null };
  if (pos.halfmove >= 150) return { result: '1/2-1/2', termination: 'seventy-five-move', winner: null };
  return null;
}

export interface ClaimableDraws {
  threefold: boolean;
  fiftyMove: boolean;
}

/** Draw claims available to the side to move in the current (non-terminal) position. */
export function claimableDraws(pos: Position): ClaimableDraws {
  return { threefold: pos.repetitionCount() >= 3, fiftyMove: pos.halfmove >= 100 };
}

/** Draw by agreement requires each side to have completed at least ten moves (20 plies from the start). */
export function agreementAllowed(pliesPlayed: number): boolean {
  return pliesPlayed >= 20;
}

/** Crown timeout rule: flagging player loses if opponent has any non-king piece; otherwise draw. */
export function timeoutOutcome(pos: Position, flagged: Color): Outcome {
  const opponent = (flagged ^ 1) as Color;
  if (pos.hasNonKingPiece(opponent)) {
    return { result: winResult(opponent), termination: 'timeout', winner: opponent };
  }
  return { result: '1/2-1/2', termination: 'timeout-vs-bare-king', winner: null };
}

export function resignationOutcome(resigning: Color): Outcome {
  const winner = (resigning ^ 1) as Color;
  return { result: winResult(winner), termination: 'resignation', winner };
}

export const TERMINATION_LABEL: Record<Termination, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  'bare-kings': 'Bare kings (automatic draw)',
  'fivefold-repetition': 'Fivefold repetition (automatic draw)',
  'seventy-five-move': '150 halfmoves without pawn move or capture',
  'threefold-claim': 'Threefold repetition (claimed)',
  'fifty-move-claim': '100 halfmoves without pawn move or capture (claimed)',
  agreement: 'Draw by agreement',
  resignation: 'Resignation',
  timeout: 'Time forfeit',
  'timeout-vs-bare-king': 'Timeout against a bare king (draw)',
  abandoned: 'Abandoned',
};
