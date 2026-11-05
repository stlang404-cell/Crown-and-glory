import { tacticalFacts } from './tactics';
import { Position } from '../../src/rules/position';
import { automaticOutcome, claimableDraws } from '../../src/rules/adjudication';
import { moveToCcn, moveToSan, parseLegalCcn, ccnLineToSan } from '../../src/rules/notation';
import { START_FEN, VARIANT_ID, moveFrom, moveTo, movePromo, pieceType, pieceColor, squareName } from '../../src/rules/types';
import { evaluate4, setTrace, lastTraceScale, phaseOf, NUM_PAIRS, OFF } from '../../src/engine/eval4';
import { PLAY_WEIGHTS } from '../../src/engine/evaluate';
import { Searcher, isMateScore, mateInPlies } from '../../src/engine/search';
import { CANON_OPTS } from '../../src/engine/canonical';
export interface Study { name: string; initialFen: string; setupMoves: string[]; moves: string[] }
export interface Line { ccn: string; san: string; depth: number; score: number; pv: string[]; pvSan: string[]; explanation: string[] }
export interface Snapshot { depth: number; nodes: number; elapsedMs: number; candidates: Line[]; status: string; claimable: string[]; ttBytes: number }
export function replay(s: Study, ply = s.moves.length): Position {
  const p = Position.fromFen(s.initialFen);
  for (const c of [...s.setupMoves, ...s.moves.slice(0, ply)]) {
    if (automaticOutcome(p)) throw new Error('Moves continue after the game has ended.');
    const m = parseLegalCcn(p, c); if (m < 0) throw new Error(`Illegal move: ${c}`); p.makeMove(m);
  } return p;
}
export function importStudies(text: string): Study[] {
  if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) { const p = Position.fromFen(text); return [{ name: 'Imported position', initialFen: p.toFen(), setupMoves: [], moves: [] }]; }
  const raw = JSON.parse(text);
  if (raw.variantId && raw.variantId !== VARIANT_ID) throw new Error('Unsupported chess variant.');
  const games = raw.format === 'crown-backup-1' ? raw.payload?.games : Array.isArray(raw) ? raw : [raw];
  if (!Array.isArray(games) || !games.length || games.length > 10000) throw new Error('No supported games in this file.');
  return games.map((g: Record<string, unknown>, i: number) => {
    if (g.variantId && g.variantId !== VARIANT_ID) throw new Error('Unsupported chess variant.');
    if (g.status && g.status !== 'finalized') throw new Error('Export a completed game for post-game review.');
    if (!Array.isArray(g.moves) || g.moves.length > 10000) throw new Error('Invalid game moves.');
    const moves = g.moves.map((m: string | { ccn: string }) => typeof m === 'string' ? m : m?.ccn);
    if (moves.some(m => typeof m !== 'string')) throw new Error('Invalid coordinate notation.');
    const s: Study = { name: String(g.name ?? g.id ?? `Game ${i + 1}`), initialFen: String(g.initialFen ?? START_FEN), setupMoves: (g.setupMoves ?? []) as string[], moves };
    if (!Array.isArray(s.setupMoves) || s.setupMoves.some(m => typeof m !== 'string')) throw new Error('Invalid setup history.');
    replay(s); return s;
  });
}
export function scoreLabel(n: number): string { return isMateScore(n) ? `${n < 0 ? '−' : ''}M${Math.ceil(Math.abs(mateInPlies(n)) / 2)}` : `${n >= 0 ? '+' : ''}${(n / 100).toFixed(2)}`; }
const names = ['', 'pawn', 'knight', 'rook', 'queen', 'king'];
export function explain(p: Position, ccn: string, pv: string[]): string[] {
  const m = parseLegalCcn(p, ccn); if (m < 0) throw new Error('Illegal explanation move');
  const notes = [`Move the ${names[pieceType(p.board[moveFrom(m)])]} from ${squareName(moveFrom(m))} to ${squareName(moveTo(m))}.`];
  const captured = p.board[moveTo(m)]; if (captured) notes.push(`This captures a ${names[pieceType(captured)]}.`);
  if (movePromo(m)) notes.push(`The pawn promotes to a ${names[movePromo(m)]}.`);
  const q = p.clone(); q.makeMove(m);
  if (q.inCheck()) notes.push(q.hasLegalMove() ? 'This gives check; the opponent must answer it.' : 'This is checkmate.');
  const targets: string[] = [];
  for (let sq = 0; sq < 36; sq++) if (q.board[sq] && pieceColor(q.board[sq]) === q.side && pieceType(q.board[sq]) !== 5) {
    // A legal capture on the following turn verifies an attack, not a forced material win.
    const test = q.clone(); test.side = p.side; test.recomputeHash();
    if (test.legalMoves().some(x => moveFrom(x) === moveTo(m) && moveTo(x) === sq)) targets.push(squareName(sq));
  }
  if (targets.length > 1) notes.push(`The moved piece attacks ${targets.join(' and ')} (a double attack). The defender may still have a resource.`);
  if (pv.length > 1) notes.push(`The search's best reply in this line is ${ccnLineToSan(p.toFen(), pv).slice(1).join(' ')}. Explore it on the board; this is a searched variation, not a guarantee.`);
  return [...notes, ...tacticalFacts(p, pv)];
}
/** Exclusion MultiPV: search all remaining root moves for each rank. Publish only complete, equal-depth rounds. */
export function calculate(s: Study, ply: number, budgetMs: number, count: number, onProgress: (x: Snapshot) => void, maxDepth = 64): Snapshot {
  const p = replay(s, ply), start = performance.now(), searcher = new Searcher(18);
  const outcome = automaticOutcome(p), claims = claimableDraws(p);
  let result: Snapshot = { depth: 0, nodes: 0, elapsedMs: 0, candidates: [], status: outcome ? `${outcome.result} · ${outcome.termination}` : 'No completed search iteration yet', claimable: [claims.threefold ? 'Threefold draw can be claimed' : '', claims.fiftyMove ? '100-halfmove draw can be claimed' : ''].filter(Boolean), ttBytes: searcher.tt.bytes };
  if (outcome) { onProgress(result); return result; }
  let nodes = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let remaining = p.legalMoves(); const candidates: Line[] = []; let complete = true;
    for (let rank = 0; rank < Math.min(5, Math.max(1, count)); rank++) {
      if (!remaining.length) break;
      const left = budgetMs - (performance.now() - start); if (left <= 0) { complete = false; break; }
      const r = searcher.search(p, { ...CANON_OPTS, rootMoves: remaining, limits: { depth, timeMs: left } }); nodes += r.nodes;
      if (r.depth < depth && r.stopReason !== 'mate') { complete = false; break; }
      if (r.depth === 0 || !remaining.includes(r.bestMove)) { complete = false; break; }
      const pv = r.pv.map(moveToCcn), ccn = moveToCcn(r.bestMove);
      candidates.push({ ccn, san: moveToSan(p, r.bestMove), depth: r.depth, score: r.score, pv, pvSan: ccnLineToSan(p.toFen(), pv), explanation: explain(p, ccn, pv) });
      remaining = remaining.filter(m => m !== r.bestMove);
    }
    if (!complete) break;
    candidates.sort((a, b) => b.score - a.score || a.ccn.localeCompare(b.ccn));
    result = { ...result, depth: Math.min(...candidates.map(c => c.depth)), nodes, elapsedMs: performance.now() - start, candidates, status: 'Complete iteration · heuristic evaluation' }; onProgress(result);
    if (performance.now() - start >= budgetMs) break;
  }
  return { ...result, nodes, elapsedMs: performance.now() - start, status: result.depth ? 'Search finished · heuristic evaluation' : result.status };
}

/** Static evaluator trace, White-positive; search scores also include future play. */
export function evaluationFacts(p: Position): { label: string; cp: number }[] {
  if (PLAY_WEIGHTS.version !== 4) throw new Error('Expected canonical eval4 weights');
  const trace = new Float64Array(NUM_PAIRS); setTrace(trace);
  let total: number;
  try { total = evaluate4(p, PLAY_WEIGHTS) * (p.side ? -1 : 1); } finally { setTrace(null); }
  const phase = phaseOf(p), scale = lastTraceScale(), params = PLAY_WEIGHTS.p;
  const bounds = Object.entries(OFF).map(([name, from], i, all) => ({ name, from, to: all[i + 1]?.[1] ?? NUM_PAIRS }));
  const groups: Record<string, string[]> = { 'Material': ['MAT'], 'Piece activity': ['PST', 'ROOK_OPEN', 'ROOK_SEMI', 'OUTPOST', 'TROPISM'], 'Mobility': ['MOB', 'MOBT'], 'Pawn structure': ['DOUBLED','ISOLATED','SUPPORTED','PHALANX'], 'King safety': ['KING_SHIELD','KING_ATTACK','KING_ATTACKERS','KING_OPEN'], 'Promotion threats': ['PASSED','PASSED_FREE','PASSED_OWNK','PASSED_ENK','UNSTOPPABLE'], 'Tactical threats': ['THREAT_PAWN','THREAT_MINOR','THREAT_ROOK','HANGING'] };
  const rows = Object.entries(groups).map(([label, keys]) => { let cp = 0; for (const b of bounds.filter(b => keys.includes(b.name))) for (let i = b.from; i < b.to; i++) cp += trace[i] * (params[2*i] * phase + params[2*i+1] * (20-phase)) / 20 * scale; return { label, cp: Math.round(cp) }; });
  rows.push({ label: 'Tempo, scaling & endgame adjustments', cp: total - rows.reduce((a,b) => a+b.cp,0) }); return rows;
}
