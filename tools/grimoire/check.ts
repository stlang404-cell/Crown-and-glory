/**
 * The Sovereign's Grimoire — position checker and diagram renderer.
 *
 * Every board in the rulebook and the Grimoire is written as a fenced block:
 *
 *   ```crown
 *   fen: 5k/P5/6/6/6/K5 w - - 0 1
 *   line: a6=Q+ Ke5          (optional: SAN moves played from the position, checked for legality)
 *   claim: mate-in-1          (optional, see below)
 *   caption: Promotion with check
 *   flip: false               (optional: draw from Black's side)
 *   ```
 *
 * Claims (all checked against the real crown-la6-v1 rules in src/rules):
 *   legal                  the position is legal (always checked anyway)
 *   checkmate | stalemate  the position (after `line`, if given) is exactly that
 *   bare-kings             only the two kings remain (automatic draw)
 *   mate-in-N  (N = 1..3)  the side to move can force mate in N moves — proven EXHAUSTIVELY (every defence tried),
 *                          and `line`, if given, must start with a move that achieves it
 *   only-mate-in-N         as above, and that first move is the ONLY one that mates in ≤ N
 *   best <SAN>             the move passes the Academy puzzle policy (crown-puzzle-verify-2: engine best by a clear
 *                          margin, no alternative winning mate) — an engine judgement, labelled as such in the text
 *   puzzle <id>            refers to a verified Academy puzzle (src/academy/data/puzzles.json); fen must match
 *   tablebase <result>     exhaustive endgame value of the position AFTER `line` (if given), for the side to move:
 *                          `win-in-N`, `loss-in-N` (N = moves to mate with best play) or `draw`; 3–4 men only,
 *                          solved by tools/grimoire/endgame.ts (retrograde analysis over src/rules)
 *
 *   npx tsx tools/grimoire/check.ts            check all books, print a report, exit 1 on any failure
 *   npx tsx tools/grimoire/check.ts --render   also (re)write the diagram under every block
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Position } from '../../src/rules/position';
import { moveToSan, parseSan } from '../../src/rules/notation';
import { automaticOutcome } from '../../src/rules/adjudication';
import { KING, PAWN, pieceType, pieceColor, type Move } from '../../src/rules/types';
import { Searcher } from '../../src/engine/search';
import { verifyPuzzle } from '../../src/academy/verify';
import { matingFirstMoves } from '../../src/academy/mateProver';

const ROOTS = ['docs/RULEBOOK.md', 'docs/grimoire'];
const RENDER = process.argv.includes('--render');
const files: string[] = [];
for (const r of ROOTS) {
  if (!existsSync(r)) continue;
  if (r.endsWith('.md')) files.push(r);
  else for (const f of readdirSync(r).sort()) if (f.endsWith('.md')) files.push(join(r, f));
}
const puzzles = new Map<string, { fen: string; solution: string[] }>(
  (JSON.parse(readFileSync('src/academy/data/puzzles.json', 'utf8')).puzzles as { id: string; fen: string; solution: string[] }[]).map(p => [p.id, p]));

const GLYPH: Record<string, string> = { K: '♔', Q: '♕', R: '♖', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', n: '♞', p: '♟' };
export function diagram(fen: string, flip = false): string {
  const rows = fen.split(' ')[0].split('/').map(r => r.replace(/\d/g, d => '.'.repeat(+d)).split(''));
  const ranks = flip ? [...rows].reverse().map(r => [...r].reverse()) : rows;
  const files = flip ? 'f e d c b a' : 'a b c d e f';
  const out = ranks.map((r, i) => `${flip ? i + 1 : 6 - i} │ ${r.map(c => (c === '.' ? '·' : GLYPH[c])).join(' ')}`);
  const side = fen.split(' ')[1] === 'w' ? 'White to move' : 'Black to move';
  return ['  ┌─────────────', ...out, '  └─────────────', `    ${files}    ${side}`].join('\n');
}

function legalPosition(pos: Position, fen: string): string | null {
  const b = fen.split(' ')[0];
  if ((b.match(/K/g) ?? []).length !== 1 || (b.match(/k/g) ?? []).length !== 1) return 'each side needs exactly one king';
  const rows = b.split('/');
  if (rows.length !== 6) return 'board must have 6 ranks';
  if (/[pP]/.test(rows[0]) || /[pP]/.test(rows[5])) return 'no pawn may stand on the first or last rank';
  if (/[bB]/.test(b)) return 'there are no bishops in crown-la6-v1';
  // the side NOT to move may not be in check
  // Flip the side to move: if that position is in check, the original side NOT to move was in check (illegal).
  // Building the flipped copy may itself be refused when the ORIGINAL side to move is in check — that is legal.
  let other: Position | null = null;
  try { other = Position.fromFen(fen.replace(/ ([wb]) /, (_, s) => ` ${s === 'w' ? 'b' : 'w'} `)); } catch { other = null; }
  if (other && other.inCheck()) return 'the side not to move is in check (illegal position)';
  void pos; void KING; void PAWN; void pieceType; void pieceColor;
  return null;
}

// The mate prover is shared with the lesson generator and the in-app Grimoire exercises (src/academy/mateProver.ts),
// so the app accepts exactly the moves proven here.

interface Block { file: string; start: number; end: number; fields: Record<string, string> }
const blocks: Block[] = [];
const texts = new Map<string, string[]>();
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  texts.set(f, lines);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '```crown') continue;
    const fields: Record<string, string> = {};
    let j = i + 1;
    for (; j < lines.length && lines[j].trim() !== '```'; j++) {
      const m = /^\s*([a-z-]+)\s*:\s*(.*)$/.exec(lines[j]);
      if (m) fields[m[1]] = m[2].trim();
    }
    blocks.push({ file: f, start: i, end: j, fields });
    i = j;
  }
}

const searcher = new Searcher(18);
let failures = 0, checked = 0;
const report: string[] = [];
for (const b of blocks) {
  const where = `${b.file}:${b.start + 1}`;
  const fail = (msg: string) => { failures++; report.push(`FAIL ${where} — ${msg}`); };
  const fen = b.fields.fen;
  if (!fen) { fail('missing fen'); continue; }
  let pos: Position;
  try { pos = Position.fromFen(fen); } catch (e) { fail(`bad FEN: ${(e as Error).message}`); continue; }
  const bad = legalPosition(pos, fen);
  if (bad) { fail(bad); continue; }
  checked++;
  const lineSan = (b.fields.line ?? '').split(/\s+/).filter(Boolean).filter(t => !/^\d+\.+$/.test(t));
  const played: Move[] = [];
  let ok = true;
  for (const san of lineSan) {
    const m = parseSan(pos, san);
    if (m < 0) { fail(`move "${san}" is not legal (or ambiguous) in the line`); ok = false; break; }
    const canon = moveToSan(pos, m).replace(/[+#]/g, '');
    if (canon !== san.replace(/[+#!?]/g, '')) { fail(`move "${san}" should be written "${moveToSan(pos, m)}"`); ok = false; break; }
    // check/mate marks must be right
    pos.makeMove(m); played.push(m);
    const sanMark = /#/.test(san) ? '#' : /\+/.test(san) ? '+' : '';
    const real = !pos.hasLegalMove() && pos.inCheck() ? '#' : pos.inCheck() ? '+' : '';
    if (sanMark !== real) { fail(`move "${san}" should be marked "${real || 'without + or #'}"`); ok = false; break; }
  }
  if (!ok) continue;
  const claim = b.fields.claim ?? 'legal';
  const [kind, arg] = claim.split(/\s+/, 2);
  try {
    if (kind === 'legal') { /* done */ }
    else if (kind === 'checkmate' || kind === 'stalemate' || kind === 'bare-kings') {
      const o = automaticOutcome(pos);
      if (o?.termination !== kind) fail(`claim ${kind} but the position is ${o?.termination ?? 'not terminal'}`);
    } else if (/^(only-)?mate-in-[123]$/.test(kind)) {
      const n = +kind.slice(-1);
      for (let k = played.length - 1; k >= 0; k--) pos.unmakeMove(); // claims refer to the starting position
      const firsts = matingFirstMoves(pos, n);
      if (!firsts.length) fail(`no forced mate in ${n} exists`);
      else {
        const sans = firsts.map(m => moveToSan(pos, m));
        if (played.length && !firsts.includes(played[0])) fail(`line starts with ${lineSan[0]}, which does not force mate in ${n} (mating moves: ${sans.join(', ')})`);
        if (kind.startsWith('only') && firsts.length !== 1) fail(`claimed only move, but ${firsts.length} moves mate in ≤ ${n}: ${sans.join(', ')}`);
        report.push(`ok   ${where} — mate in ${n}: ${sans.join(', ')}${firsts.length === 1 ? ' (unique)' : ''}`);
      }
    } else if (kind === 'best') {
      for (let k = played.length - 1; k >= 0; k--) pos.unmakeMove();
      const m = parseSan(pos, arg);
      if (m < 0) fail(`best move ${arg} is not legal`);
      else {
        const { moveToCcn } = await import('../../src/rules/notation');
        const r = verifyPuzzle(searcher, { fen, solution: [moveToCcn(m)] });
        if (!r.ok) fail(`best ${arg} fails the puzzle policy (gap ${r.gap.toFixed(2)})`);
        else report.push(`ok   ${where} — best ${arg} (engine policy crown-puzzle-verify-2, gap ${r.gap.toFixed(2)})`);
      }
    } else if (kind === 'puzzle') {
      const p = puzzles.get(arg);
      if (!p) fail(`unknown puzzle ${arg}`);
      else if (p.fen !== fen) fail(`fen differs from puzzle ${arg}`);
    } else if (kind === 'tablebase') {
      const { probePosition } = await import('./endgame');
      const pr = probePosition(pos);
      const got = pr.result === 'draw' ? 'draw' : `${pr.result}-in-${pr.moves}`;
      if (got !== arg) fail(`claim tablebase ${arg} but the solver gives ${got} (${pr.key})`);
      else report.push(`ok   ${where} — tablebase ${got} (${pr.key})`);
    } else fail(`unknown claim "${claim}"`);
  } catch (e) { fail(`check error: ${(e as Error).message}`); }
}

if (RENDER) {
  // rewrite diagrams bottom-up so earlier line numbers stay valid
  const byFile = new Map<string, Block[]>();
  for (const b of blocks) byFile.set(b.file, [...(byFile.get(b.file) ?? []), b]);
  for (const [f, bs] of byFile) {
    const lines = texts.get(f)!;
    for (const b of [...bs].sort((x, y) => y.start - x.start)) {
      if (!b.fields.fen) continue;
      let fenAfter = b.fields.fen;
      if (b.fields.show === 'after' && b.fields.line) {
        const p = Position.fromFen(b.fields.fen);
        for (const san of b.fields.line.split(/\s+/).filter(t => t && !/^\d+\.+$/.test(t))) { const m = parseSan(p, san); if (m < 0) break; p.makeMove(m); }
        fenAfter = p.toFen();
      }
      const art = ['<!-- diagram -->', '```text', diagram(fenAfter, b.fields.flip === 'true'), '```', ...(b.fields.caption ? [`*${b.fields.caption}*`] : []), '<!-- /diagram -->'];
      let k = b.end + 1;
      let removeTo = k;
      while (removeTo < lines.length && lines[removeTo].trim() === '') removeTo++;
      if (lines[removeTo]?.trim() === '<!-- diagram -->') {
        let e = removeTo;
        while (e < lines.length && lines[e].trim() !== '<!-- /diagram -->') e++;
        lines.splice(k, e - k + 1, ...art);
      } else lines.splice(k, 0, ...art);
    }
    writeFileSync(f, lines.join('\n'));
  }
}

console.log(report.join('\n'));
console.log(`\n${blocks.length} positions in ${files.length} files; ${checked} legal; ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
