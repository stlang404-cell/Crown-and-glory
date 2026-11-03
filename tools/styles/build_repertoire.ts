/**
 * Opening repertoire for playing styles (crown-repertoire-1).
 * Breadth-first from the start position to PLIES plies: at every node every legal move is scored at a fixed
 * depth (no node cap: a capped search aborts and returns no score); every move within MARGIN_CP of the best is
 * kept as a book move with its score; the MAX_EXPAND best kept moves are expanded (others leave the book). The result is the menu a style may
 * choose from in the opening; it never contains a move judged more than MARGIN_CP worse than the best.
 *   npx tsx tools/styles/build_repertoire.ts
 */
import { writeFileSync } from 'node:fs';
import { Position } from '../../src/rules/position';
import { moveToCcn } from '../../src/rules/notation';
import { Searcher, isMateScore } from '../../src/engine/search';

const PLIES = 6, MARGIN_CP = 30, MAX_EXPAND = 3, DEPTH = 7;
export const bookKey = (fen: string) => fen.split(' ').slice(0, 2).join(' ');

const searcher = new Searcher(18);
const book: Record<string, [string, number][]> = {};
let frontier = [Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1')];
const t0 = Date.now();
for (let ply = 0; ply < PLIES; ply++) {
  const next: Position[] = [];
  for (const pos of frontier) {
    const key = bookKey(pos.toFen());
    if (book[key]) continue;
    const legal = pos.legalMoves();
    if (legal.length < 2) continue;
    const scored = searcher.scoreRootMoves(pos, legal, DEPTH).filter(s => Number.isFinite(s.score) && !isMateScore(s.score));
    if (!scored.length) continue;
    const best = Math.max(...scored.map(s => s.score));
    const keep = scored.filter(s => s.score >= best - MARGIN_CP).sort((a, b) => b.score - a.score);
    book[key] = keep.map(s => [moveToCcn(s.move), s.score]);
    for (const s of keep.slice(0, MAX_EXPAND)) { const p = pos.clone(); p.makeMove(s.move); next.push(p); }
  }
  frontier = next;
  console.log(`ply ${ply + 1}: ${Object.keys(book).length} book positions, frontier ${frontier.length}, ${Math.round((Date.now() - t0) / 1000)} s`);
}
writeFileSync(new URL('../../src/engine/repertoire.json', import.meta.url), JSON.stringify({ id: 'crown-repertoire-1', plies: PLIES, marginCp: MARGIN_CP, maxExpand: MAX_EXPAND, depth: DEPTH, positions: book }));
console.log('positions', Object.keys(book).length);
