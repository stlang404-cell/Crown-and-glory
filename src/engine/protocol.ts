/** Versioned worker message protocol (crown-engine-protocol-1). All replies echo requestId + generation. */
import type { EngineScore, AnalysisReport, AnalysisSettings, PlyAnalysis } from '../analysis/types';

export const PROTOCOL_ID = 'crown-engine-protocol-1';

export interface MoveRequest {
  type: 'move';
  requestId: string;
  generation: number;
  initialFen: string;
  setupMoves?: string[];
  moves: string[];
  level: number;
  seed: number;
  clock?: { remainingMs: number; incrementMs: number };
  newGame?: boolean;
}

export interface AnalyzeRequest {
  type: 'analyze';
  requestId: string;
  generation: number;
  gameId: string;
  checksum: string;
  initialFen: string;
  setupMoves?: string[];
  moves: string[];
  settings: AnalysisSettings;
}

export interface AssistRequest {
  type: 'assist';
  requestId: string;
  generation: number;
  initialFen: string;
  setupMoves?: string[];
  moves: string[];
  depth: number;
}

export interface AssistCandidate { ccn: string; san: string; score: EngineScore; pv: string[]; pvSan: string[] }

export type WorkerRequest = MoveRequest | AnalyzeRequest | AssistRequest | { type: 'ping'; requestId: string; generation: number };

export interface IterationMsg { depth: number; score: EngineScore; pv: string[]; nodes: number; timeMs: number }

export type WorkerReply =
  | { type: 'progress'; requestId: string; generation: number; info: IterationMsg }
  | { type: 'move-result'; requestId: string; generation: number; move: string; score: EngineScore; depth: number; nodes: number; timeMs: number; pv: string[]; selected: 'best' | 'bounded-sample'; stopReason: string }
  | { type: 'ply'; requestId: string; generation: number; index: number; total: number; ply: PlyAnalysis }
  | { type: 'analysis-result'; requestId: string; generation: number; report: AnalysisReport }
  | { type: 'assist-result'; requestId: string; generation: number; candidates: AssistCandidate[]; depth: number }
  | { type: 'error'; requestId: string; generation: number; message: string }
  | { type: 'pong'; requestId: string; generation: number; engine: string };
