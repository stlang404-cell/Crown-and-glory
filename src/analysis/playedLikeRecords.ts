/**
 * Permanent Played Like records (crown-pl-record-1) and career statistics.
 *
 * After each completed, analysed game the player's own Played Like estimate is stored WITH the game record
 * (GameRecord.playedLike: one entry per model id — additive, versioned, carried by backups because games are). A
 * record never resets across seasons, divisions or rating changes; statistics only ever combine records of the SAME
 * model id, and only "adequate" ones (a number from a validated model with ≥ ADEQUATE_MOVES informative moves) count
 * toward best / lowest / averages. Everything else stays in the match history with its label.
 */
import { isStudyGame } from '../app/study';
import { PLAYED_LIKE_ID, playedLike, reportForPlayedLike, type PlayedLike } from './playedLike';
import type { AnalysisReport, Pov } from './types';
import type { GameRecord } from '../games/types';
import type { RatingEvent } from '../ratings/ledger';

export const PL_RECORD_SCHEMA = 'crown-pl-record-1';
/** Fewer informative moves than this → the number is kept but labelled "low confidence" and not counted. */
export const ADEQUATE_MOVES = 15;

export type PlayedLikeConfidence = 'adequate' | 'low' | 'insufficient' | 'unavailable';

export interface PlayedLikeGameRecord {
  schema: typeof PL_RECORD_SCHEMA;
  modelId: string;
  reportId: string;
  gameId: string;
  /** when the game was played (game end, else start) */
  at: string;
  recordedAt: string;
  pov: Pov;
  opponent: { id: string | null; name: string };
  /** the player's result: 1 win, 0.5 draw, 0 loss, null unknown */
  result: number | null;
  pool: string | null;
  /** career Elo at the time (Glicko-2, from the rating event): before → after; null for unrated games */
  career: { before: number; after: number; rd: number } | null;
  estimate: PlayedLike;
  confidence: PlayedLikeConfidence;
}

export function confidenceOf(pl: PlayedLike): PlayedLikeConfidence {
  if (pl.status === 'ok') return pl.moves >= ADEQUATE_MOVES ? 'adequate' : 'low';
  if (pl.status === 'insufficient') return 'insufficient';
  return 'unavailable';
}

export const CONFIDENCE_LABEL: Record<PlayedLikeConfidence, string> = {
  adequate: 'Counted', low: 'Low confidence (not counted)', insufficient: 'Too few moves (not counted)', unavailable: 'No estimate',
};

/** Build the record for a player's game from its report (null when there is nothing to record yet). */
export function buildPlayedLikeRecord(game: GameRecord, report: AnalysisReport | null, event: RatingEvent | null, nowIso = new Date().toISOString()): PlayedLikeGameRecord | null {
  if (!report || report.status !== 'complete' || game.status !== 'finalized' || game.id.startsWith('exh:') || report.gameId.startsWith('exh:')) return null;
  const pov = game.humanColor;
  const estimate = playedLike(report, pov);
  if (estimate.status === 'pending') return null;
  const opp = pov === 'white' ? game.black : game.white;
  const result = game.result === '1/2-1/2' ? 0.5 : game.result === '1-0' ? (pov === 'white' ? 1 : 0) : game.result === '0-1' ? (pov === 'black' ? 1 : 0) : null;
  return {
    schema: PL_RECORD_SCHEMA, modelId: estimate.modelId, reportId: report.id, gameId: game.id, at: game.endedAt ?? game.startedAt, recordedAt: nowIso, pov,
    opponent: { id: (opp as { id?: string }).id ?? null, name: opp.name }, result, pool: game.pool ?? null,
    career: event ? { before: Math.round(event.before.rating), after: Math.round(event.after.rating), rd: Math.round(event.after.rd) } : null,
    estimate, confidence: confidenceOf(estimate),
  };
}

/** Insert or replace the record of the same model id (one per model version per game; other versions are kept). */
export function upsertRecord(list: PlayedLikeGameRecord[] | undefined, rec: PlayedLikeGameRecord): PlayedLikeGameRecord[] {
  return [...(list ?? []).filter(r => r.modelId !== rec.modelId), rec];
}

/** Does the game need a (new) record for the current model from these reports? */
export function needsRecord(game: GameRecord, reports: AnalysisReport[]): AnalysisReport | null {
  // v0.11: unofficial exhibitions (id "exh:…", src/app/exhibition.ts) never get a permanent record
  // v1.0: Study Matches (src/app/study.ts) are unofficial too: their analysis shows Played Like, but no record is kept
  if (game.status !== 'finalized' || game.id.startsWith('exh:') || isStudyGame(game)) return null;
  const rep = reportForPlayedLike(reports);
  if (!rep) return null;
  const have = (game.playedLike ?? []).find(r => r.modelId === PLAYED_LIKE_ID);
  // same report and the same estimate (e.g. not a record written while the model was still calibrating) → nothing to do
  if (have && have.reportId === rep.id && JSON.stringify(have.estimate) === JSON.stringify(playedLike(rep, game.humanColor))) return null;
  return rep;
}

export interface PlayedLikePoint { gameId: string; at: string; rating: number; sd: number; rolling: number }
export interface PlayedLikeStats {
  modelId: string;
  /** games of this model with any record (analysed) */
  analysed: number;
  /** adequate estimates (counted) */
  counted: number;
  highest: PlayedLikeGameRecord | null;
  lowest: PlayedLikeGameRecord | null;
  mostRecent: PlayedLikeGameRecord | null;
  average: number | null;
  median: number | null;
  /** averages of the most recent 10 / 50 / 100 counted games (null until that many exist) */
  recent: { 10: number | null; 50: number | null; 100: number | null };
  /** mean of the last 10 counted minus the 10 before (null until 20 exist) */
  trend: number | null;
  /** counted estimates in game order with a rolling mean of up to 10 */
  series: PlayedLikePoint[];
}

const ratingOf = (r: PlayedLikeGameRecord) => (r.estimate.status === 'ok' ? r.estimate.rating : NaN);
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

export function playedLikeStats(records: PlayedLikeGameRecord[], modelId: string): PlayedLikeStats {
  const mine = records.filter(r => r.modelId === modelId).sort((a, b) => a.at.localeCompare(b.at) || a.gameId.localeCompare(b.gameId));
  const counted = mine.filter(r => r.confidence === 'adequate' && r.estimate.status === 'ok');
  const vals = counted.map(ratingOf);
  const sorted = [...vals].sort((a, b) => a - b);
  const med = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  const last = (k: number) => (vals.length >= k ? Math.round(mean(vals.slice(-k))) : null);
  let highest: PlayedLikeGameRecord | null = null, lowest: PlayedLikeGameRecord | null = null;
  for (const r of counted) { if (!highest || ratingOf(r) > ratingOf(highest)) highest = r; if (!lowest || ratingOf(r) < ratingOf(lowest)) lowest = r; }
  const series = counted.map((r, i) => ({ gameId: r.gameId, at: r.at, rating: ratingOf(r), sd: r.estimate.status === 'ok' ? r.estimate.sd : 0, rolling: Math.round(mean(vals.slice(Math.max(0, i - 9), i + 1))) }));
  return {
    modelId, analysed: mine.length, counted: counted.length, highest, lowest, mostRecent: counted[counted.length - 1] ?? null,
    average: vals.length ? Math.round(mean(vals)) : null, median: med === null ? null : Math.round(med),
    recent: { 10: last(10), 50: last(50), 100: last(100) },
    trend: vals.length >= 20 ? Math.round(mean(vals.slice(-10)) - mean(vals.slice(-20, -10))) : null,
    series,
  };
}

/** All records across games, and statistics per model id (current model first; never mixed). */
export function playedLikeCareer(games: GameRecord[]): { records: PlayedLikeGameRecord[]; byModel: PlayedLikeStats[] } {
  const records = games.flatMap(g => g.playedLike ?? []);
  const ids = [...new Set(records.map(r => r.modelId))].sort((a, b) => (a === PLAYED_LIKE_ID ? -1 : b === PLAYED_LIKE_ID ? 1 : a.localeCompare(b)));
  return { records, byModel: ids.map(id => playedLikeStats(records, id)) };
}
