/** Analysis report schema (crown-report v1). Reports are immutable once stored. */

export type Pov = 'white' | 'black';
export type EngineScore =
  | { kind: 'cp'; value: number; pov: Pov }
  | { kind: 'mate'; plies: number; pov: Pov; proven: false }
  | { kind: 'terminal'; outcome: 'win' | 'draw' | 'loss'; pov: Pov };

export type Grade = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export const GRADES: Grade[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
export type Phase = 'opening' | 'middlegame' | 'endgame';

export interface AnalysisSettings {
  id: string; // e.g. std-d7
  label: string;
  depth: number;
  /** Ranking depth for the full legal-move screen. */
  screenDepth: number;
  /** Extra plies for Brilliant verification searches. */
  verifyExtra: number;
  candidates: number;
}

export interface Candidate {
  ccn: string;
  san: string;
  /** Exact score at `depth` from the mover's perspective. */
  score: EngineScore;
  /** Exact score at depth-1 (stability evidence). */
  scorePrev: EngineScore | null;
  u: number;
  pv: string[];
  pvSan: string[];
}

export interface CoachNote {
  kind: 'missed-win' | 'hanging-piece' | 'allowed-tactic' | 'allowed-mate' | 'missed-mate' | 'fork' | 'promotion' | 'good-find';
  text: string;
  /** Training topic id this note supports. */
  topic: string;
  line: string[];
  evidence: string;
}

export interface PlyAnalysis {
  ply: number;
  color: Pov;
  ccn: string;
  san: string;
  preHash: string;
  postHash: string;
  legalCount: number;
  forced: boolean;
  phase: Phase;
  requestedDepth: number;
  achievedDepth: number;
  nodes: number;
  best: Candidate;
  played: Candidate;
  second: Candidate | null;
  candidates: Candidate[];
  /** Evaluations from White's perspective for the graph: before (best play) and after the played move. */
  evalBefore: EngineScore;
  evalAfter: EngineScore;
  /** Bounded expected-score loss at depth and at depth-1. */
  loss: number | null;
  lossPrev: number | null;
  lossInterval: [number, number] | null;
  cpLoss: number | null;
  grade: Grade | null;
  gradeProvisional: boolean;
  uncertainGrades: Grade[] | null;
  gradeReasons: string[];
  critical: boolean;
  criticalReason: string | null;
  mateNote: string | null;
  searchInconsistency: boolean;
  notes: CoachNote[];
}

export interface SideSummary {
  accuracy: number | null;
  eligible: number;
  moves: number;
  forced: number;
  coverage: number;
  counts: Record<Grade, number>;
  avgCpLoss: number | null;
  cpLossMoves: number;
  bestFrequency: number | null;
  phaseAccuracy: Record<Phase, { accuracy: number | null; eligible: number }>;
  critical: { total: number; handled: number };
  provisionalMoves: number;
}

export interface AnalysisReport {
  id: string;
  schemaVersion: 1;
  gameId: string;
  gameChecksum: string;
  variantId: string;
  rulesVersion: string;
  engine: { searchId: string; evalId: string; buildId: string };
  settings: AnalysisSettings;
  methodology: { gradingId: string; accuracyId: string; phaseId: string; criticalId: string; coachId: string; calibration: string; experimental: true };
  status: 'complete' | 'partial';
  coverage: { analysed: number; total: number };
  plies: PlyAnalysis[];
  summary: { white: SideSummary; black: SideSummary };
  turningPoints: number[];
  highlights: { worstMistake: number | null; biggestMiss: number | null; bestTactic: number | null };
  recommendations: { topic: string; label: string; basis: string; general: boolean; plies: number[] }[];
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
}
