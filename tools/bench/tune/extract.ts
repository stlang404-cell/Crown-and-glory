/**
 * Tuning corpus, step 1 (crown-tune-corpus-1): positions from the recorded benchmark games of M2/M3
 * (tools/bench/results/*-games.json: self-play at many strengths, levels L1–L8, Fairy-Stockfish matches).
 * For every position from ply 6 on, the capture/promotion sequence of a small quiescence search is played
 * out to a QUIET leaf (no capture improves the static score, side to move not in check); leaves are
 * de-duplicated by Zobrist key. Output: tools/bench/tune/positions.json (fen, game result for White, game id).
 *   npx tsx tools/bench/tune/extract.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { Position } from '../../../src/rules/position';
import { parseLegalCcn } from '../../../src/rules/notation';
import { Move } from '../../../src/rules/types';
import { see } from '../../../src/engine/search';
import { evaluate, EVAL3_WEIGHTS } from '../../../src/engine/evaluate';

const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const dir = new URL('../results/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('-games.json')).sort();

/** Tiny captures-only quiescence returning the principal capture line. */
function qs(p: Position, alpha: number, beta: number, depth: number, pv: Move[]): number {
  const stand = evaluate(p, EVAL3_WEIGHTS);
  if (stand >= beta || depth >= 8) return stand;
  if (stand > alpha) alpha = stand;
  const buf = new Int32Array(128);
  const n = p.generatePseudo(buf, true);
  let best = stand;
  for (let i = 0; i < n; i++) {
    const m = buf[i];
    if (((m >> 12) & 7) === 0 && see(p, m) < 0) continue;
    p.makeMove(m);
    if (p.lastMoveLeftKingInCheck()) { p.unmakeMove(); continue; }
    const child: Move[] = [];
    const s = -qs(p, -beta, -alpha, depth + 1, child);
    p.unmakeMove();
    if (s > best) {
      best = s;
      if (s > alpha) { alpha = s; pv.length = 0; pv.push(m, ...child); if (s >= beta) break; }
    }
  }
  return best;
}

const seen = new Set<string>();
const out: { fen: string; result: number; game: string }[] = [];
let games = 0;
for (const f of files) {
  const data = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, { moves: string[]; result: string }[]>;
  for (const [match, list] of Object.entries(data)) {
    list.forEach((g, gi) => {
      if (g.result === '*') return;
      games++;
      const result = g.result === '1-0' ? 1 : g.result === '0-1' ? 0 : 0.5;
      const p = Position.fromFen(START);
      for (let i = 0; i < g.moves.length; i++) {
        const m = parseLegalCcn(p, g.moves[i]);
        if (m < 0) break;
        p.makeMove(m);
        if (i < 5 || p.inCheck()) continue;
        const pv: Move[] = [];
        const q = p.clone();
        qs(q, -32000, 32000, 0, pv);
        for (const mv of pv) q.makeMove(mv);
        if (q.inCheck() || !q.hasLegalMove()) continue;
        if (!q.hasNonKingPiece(0) && !q.hasNonKingPiece(1)) continue;
        const key = q.hashKey();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ fen: q.toFen(), result, game: `${f}:${match}:${gi}` });
      }
    });
  }
}
writeFileSync(new URL('./positions.json', import.meta.url), JSON.stringify({ id: 'crown-tune-corpus-1', games, sources: files, count: out.length, positions: out }));
console.log('games', games, 'positions', out.length);
