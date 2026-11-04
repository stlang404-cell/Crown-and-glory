/**
 * The Sovereign's Grimoire — lesson data for the in-app Crown Academy (crown-grimoire-lessons-1).
 *
 * Reads the book (docs/grimoire/01-…06-*.md, plus the twelve-week program and the glossary as appendices) and writes
 *   src/academy/data/grimoire.json        books → chapters (objectives, prose sections as Markdown, example boards, exercises)
 *   src/academy/data/grimoire-index.json  ids only (books → chapters → exercise ids, tags) for the Vault and the plan
 * Both are committed build data like puzzles.json; tests/grimoire.lessons.test.ts regenerates them and fails on drift.
 *
 * Exercises are the `crown` blocks inside "Guided exercise" / "Independent exercises" sections with an interactive claim:
 *   puzzle <id>        the verified Academy line (player moves and stored replies) from src/academy/data/puzzles.json
 *   (only-)mate-in-N   the complete set of first moves that force mate within N, proven exhaustively with the shared
 *                      prover (src/academy/mateProver.ts, the same code tools/grimoire/check.ts uses); the app checks
 *                      later moves with the same prover against the most stubborn defence
 *   best <SAN>         that move (the engine judgement checked by tools/grimoire/check.ts)
 * Other blocks (legal, checkmate, stalemate, bare-kings) are display boards.
 *
 *   npx tsx tools/grimoire/lessons.ts           write both files
 *   npx tsx tools/grimoire/lessons.ts --check   exit 1 if the committed files differ from the book
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Position } from '../../src/rules/position';
import { moveToCcn, moveToSan, parseSan } from '../../src/rules/notation';
import { MATE_PROVER_ID, matingFirstMoves } from '../../src/academy/mateProver';
import type { GrimoireBook, GrimoireBoard, GrimoireChapter, GrimoireData, GrimoireExercise, GrimoireIndex, GrimoirePart, GrimoireSection } from '../../src/academy/grimoire';
import { GRIMOIRE_ID } from '../../src/academy/grimoire';

const DIR = 'docs/grimoire';
export const OUT_DATA = 'src/academy/data/grimoire.json';
export const OUT_INDEX = 'src/academy/data/grimoire-index.json';

interface PuzzleRow { id: string; fen: string; solution: string[]; solutionSan: string[]; goal: string; themes: string[]; retired?: unknown }

export function slug(s: string): string {
  const full = s.toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (full.length <= 64) return full;
  const cut = full.slice(0, 64);
  return full[64] === '-' ? cut : cut.slice(0, cut.lastIndexOf('-')); // whole words only
}
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

/** Book II motif chapters are the mastery topics; each maps to the Academy puzzle theme used for extra practice. */
const TOPIC_THEMES: [RegExp, string][] = [
  [/fork|double attack/i, 'fork'], [/\bpins?\b/i, 'pin'], [/skewer/i, 'skewer'], [/discover/i, 'discovered-attack'],
  [/defender|overload|trapped/i, 'hanging-piece'], [/mate threat/i, 'mate-threat'], [/promotion/i, 'promotion'],
  [/deflection|decoy|zwischenzug|in-between|forcing/i, 'calculation'],
];

function parseFields(lines: string[]): Record<string, string> {
  const f: Record<string, string> = {};
  for (const l of lines) { const m = /^\s*([a-z-]+)\s*:\s*(.*)$/.exec(l); if (m) f[m[1]] = m[2].trim(); }
  return f;
}
const sanTokens = (line: string | undefined) => (line ?? '').split(/\s+/).filter(Boolean).filter(t => !/^\d+\.+$/.test(t));

/** SAN line → CCN list (stops at the first unparsable move; the checker guarantees the book's lines are legal). */
function lineToCcn(fen: string, sans: string[]): string[] {
  const pos = Position.fromFen(fen);
  const out: string[] = [];
  for (const s of sans) { const m = parseSan(pos, s); if (m < 0) throw new Error(`illegal move ${s} in line from ${fen}`); out.push(moveToCcn(m)); pos.makeMove(m); }
  return out;
}

/** Split Markdown lines into prose and board parts; the rendered text diagram under each board is dropped (the app draws the board). */
function parseParts(lines: string[], onBoard: (fields: Record<string, string>, ctx: { lastItem: number | null; textBefore: string }) => GrimoirePart): GrimoirePart[] {
  const parts: GrimoirePart[] = [];
  let buf: string[] = [];
  let lastItem: number | null = null;
  const flush = () => { const md = buf.join('\n').trim(); if (md) parts.push({ kind: 'md', md }); buf = []; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '```crown') {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '```') j++;
      const fields = parseFields(lines.slice(i + 1, j));
      const textBefore = buf.join('\n');
      flush();
      parts.push(onBoard(fields, { lastItem, textBefore }));
      i = j;
      let k = i + 1;
      while (k < lines.length && lines[k].trim() === '') k++;
      if (lines[k]?.trim() === '<!-- diagram -->') { while (k < lines.length && lines[k].trim() !== '<!-- /diagram -->') k++; i = k; }
      continue;
    }
    if (/^<!--.*-->\s*$/.test(l.trim())) continue; // no raw HTML in lesson prose
    const item = /^(\d+)\.\s/.exec(l);
    if (item) lastItem = +item[1];
    buf.push(l);
  }
  flush();
  return parts;
}

/** Answers section → map from exercise key ("guided" or a number) to the answer's Markdown. */
export function parseAnswers(md: string): Map<string, string> {
  const items: string[][] = [];
  for (const l of md.split('\n')) {
    if (/^(?:[-*]|\d+\.)\s+/.test(l)) items.push([l]);
    else if (items.length && l.trim() !== '') items[items.length - 1].push(l);
    else if (l.trim() === '') items.push([]);
  }
  const out = new Map<string, string>();
  for (const it of items) {
    if (!it.length) continue;
    const first = it[0];
    let key: string | null = null;
    const num = /^(\d+)\.\s+/.exec(first);
    let text = it.map(x => x.trim()).join(' ');
    if (num && !/^\d+\.\s+\*\*/.test(first)) { key = num[1]; text = text.replace(/^\d+\.\s+/, ''); }
    else {
      const label = /^(?:[-*]|\d+\.)\s+\*\*([^*]+)\*\*/.exec(first)?.[1];
      if (label) {
        if (/guided/i.test(label)) key = 'guided';
        else {
          const tok = /^(?:Exercise\s+)?([\dIVX]+(?:\.\d+)*)/.exec(label.trim())?.[1];
          if (tok) key = String(+tok.split('.').pop()!);
        }
      } else if (num) key = num[1];
      text = text.replace(/^(?:[-*]|\d+\.)\s+/, '');
      if (label) text = text.replace(/^\*\*[^*]+\*\*\s*/, ''); // the label names the exercise; the reader already knows which
    }
    if (key && !out.has(key)) out.set(key, text);
  }
  return out;
}

export function buildGrimoire(root = '.'): { data: GrimoireData; index: GrimoireIndex } {
  const puzzles = new Map<string, PuzzleRow>((JSON.parse(readFileSync(join(root, 'src/academy/data/puzzles.json'), 'utf8')).puzzles as PuzzleRow[]).map(p => [p.id, p]));
  const files = readdirSync(join(root, DIR)).filter(f => /^\d\d-.*\.md$/.test(f)).sort();
  const books: GrimoireBook[] = [];
  for (const file of files) {
    const number = +file.slice(0, 2);
    const lines = readFileSync(join(root, DIR, file), 'utf8').split('\n');
    const title = lines.find(l => l.startsWith('# '))!.slice(2).trim();
    const roman = /^Book ([IVX]+)\b/.exec(title)?.[1];
    const isBook = !!roman;
    const bookNo = isBook ? ROMAN[roman!] : number;
    const h2 = lines.map((l, i) => (/^## /.test(l) ? i : -1)).filter(i => i >= 0);
    const strip = (ls: string[]) => { const t = [...ls]; while (t.length && (t[t.length - 1].trim() === '' || t[t.length - 1].trim() === '---')) t.pop(); return t; };
    const chapters: GrimoireChapter[] = [];
    let introLines: string[];
    const chapterSpans: { heading: string; body: string[] }[] = [];
    if (isBook) {
      introLines = strip(lines.slice(lines.findIndex(l => l.startsWith('# ')) + 1, h2[0] ?? lines.length));
      h2.forEach((s, k) => chapterSpans.push({ heading: lines[s].slice(3).trim(), body: strip(lines.slice(s + 1, h2[k + 1] ?? lines.length)) }));
    } else {
      // appendix (program, glossary): one chapter; its ## headings become sections
      introLines = [];
      const start = lines.findIndex(l => l.startsWith('# '));
      chapterSpans.push({ heading: title, body: strip(lines.slice(start + 1)).map(l => (/^## /.test(l) ? '#' + l : l)) });
    }
    chapterSpans.forEach((span, ci) => {
      const label = span.heading.replace(/^Chapter\s+/, '');
      const id = `b${bookNo}-${slug(label)}`;
      const exercises: GrimoireExercise[] = [];
      const objectives: string[] = [];
      const sections: GrimoireSection[] = [];
      const h3 = span.body.map((l, i) => (/^### /.test(l) ? i : -1)).filter(i => i >= 0);
      const secSpans: { heading: string; body: string[] }[] = [];
      if (!h3.length || h3[0] > 0) secSpans.push({ heading: '', body: span.body.slice(0, h3[0] ?? span.body.length) });
      h3.forEach((s, k) => secSpans.push({ heading: span.body[s].slice(4).trim(), body: span.body.slice(s + 1, h3[k + 1] ?? span.body.length) }));
      const answersSec = secSpans.find(s => /^Answers\b/i.test(s.heading));
      const answers = answersSec ? parseAnswers(answersSec.body.join('\n')) : new Map<string, string>();
      const topic = isBook && bookNo === 2 && /^Chapter/.test(span.heading)
        ? { id, label: span.heading.split(/\s+—\s+/).slice(1).join(' — ') || label, theme: TOPIC_THEMES.find(([re]) => re.test(span.heading))?.[1] ?? 'calculation' }
        : null;
      for (const sec of secSpans) {
        if (/^Learning objectives$/i.test(sec.heading)) {
          for (const l of sec.body) { const m = /^\s*[-*]\s+(.*)$/.exec(l); if (m) objectives.push(m[1].trim()); }
          continue;
        }
        const guided = /^Guided exercise/i.test(sec.heading);
        const exerciseSection = guided || /^Independent exercises/i.test(sec.heading);
        const secText = sec.body.join('\n');
        const secHint = (() => { const m = /\*Hint:\*\s*([\s\S]*?)(?:\*Answer:\*|\n\s*\n|$)/.exec(secText); return m ? m[1].replace(/\s+/g, ' ').trim() || null : null; })();
        const inlineAnswer = (() => { const m = /\*Answer:\*\s*([\s\S]*?)(?:\n\s*\n|$)/.exec(secText); return m ? m[1].replace(/\s+/g, ' ').trim() : null; })();
        const parts = parseParts(sec.body, (f, ctx) => {
          const fen = f.fen;
          const sans = sanTokens(f.line);
          const board: GrimoireBoard = { fen, caption: f.caption ?? '', line: sans, ccn: lineToCcn(fen, sans), show: f.show === 'after' ? 'after' : 'before', flip: f.flip === 'true', claim: f.claim ?? 'legal' };
          const [kind, arg] = (f.claim ?? 'legal').split(/\s+/, 2);
          const interactive = kind === 'puzzle' || kind === 'best' || /^(only-)?mate-in-\d$/.test(kind);
          if (!exerciseSection || !interactive) return { kind: 'board', board };
          const capNo = /\bExercise\s+(?:[IVX]+\.)?(?:\d+\.)*(\d+)\b/.exec(board.caption)?.[1];
          const number: 'guided' | number = guided ? 'guided' : capNo ? +capNo : ctx.lastItem ?? exercises.filter(e => e.number !== 'guided').length + 1;
          let exId = `${id}/${number === 'guided' ? 'guided' : `ex-${number}`}`;
          while (exercises.some(e => e.id === exId)) exId += '-b';
          const answer = answers.get(String(number)) ?? (guided ? inlineAnswer : null);
          const base = {
            id: exId, chapterId: id, book: bookNo, number, fen, flip: board.flip, caption: board.caption, claim: board.claim,
            answer, hint: (guided ? secHint : null), topic: topic?.id ?? null,
          };
          let ex: GrimoireExercise;
          if (kind === 'puzzle') {
            const p = puzzles.get(arg);
            if (!p) throw new Error(`${exId}: unknown puzzle ${arg}`);
            if (p.fen !== fen) throw new Error(`${exId}: fen differs from puzzle ${arg}`);
            ex = { ...base, kind: 'line', source: 'puzzle', puzzleId: p.id, solution: [...p.solution], solutionSan: [...p.solutionSan], goal: p.goal, themes: [...p.themes] };
          } else if (kind === 'best') {
            const pos = Position.fromFen(fen);
            const m = parseSan(pos, arg);
            if (m < 0) throw new Error(`${exId}: best move ${arg} is not legal`);
            ex = { ...base, kind: 'line', source: 'best', solution: [moveToCcn(m)], solutionSan: [moveToSan(pos, m)], line: sans };
          } else {
            const n = +kind.slice(-1);
            const pos = Position.fromFen(fen);
            const firsts = matingFirstMoves(pos, n);
            if (!firsts.length) throw new Error(`${exId}: no forced mate in ${n}`);
            if (kind.startsWith('only') && firsts.length !== 1) throw new Error(`${exId}: claimed only move but ${firsts.length} mate`);
            ex = { ...base, kind: 'mate', source: 'mate', mateIn: n, only: kind.startsWith('only'), firstMoves: firsts.map(moveToCcn), firstMovesSan: firsts.map(m => moveToSan(pos, m)), line: sans };
          }
          exercises.push(ex);
          return { kind: 'exercise', id: ex.id };
        });
        // an inline "*Answer:*" in an exercise section is folded away in the reader (shown on request), like the Answers section
        const shown = exerciseSection ? parts.flatMap((pt): GrimoirePart[] => {
          if (pt.kind !== 'md' || !pt.md.includes('*Answer:*')) return [pt];
          const at = pt.md.indexOf('*Answer:*');
          const end = pt.md.indexOf('\n\n', at);
          const before = pt.md.slice(0, at).trim(), ans = pt.md.slice(at, end < 0 ? undefined : end).trim(), after = end < 0 ? '' : pt.md.slice(end).trim();
          return [...(before ? [{ kind: 'md' as const, md: before }] : []), { kind: 'md' as const, md: ans, spoiler: true }, ...(after ? [{ kind: 'md' as const, md: after }] : [])];
        }) : parts;
        sections.push({ heading: sec.heading, answers: /^Answers\b/i.test(sec.heading), parts: shown });
      }
      const tags: string[] = [];
      if (topic) tags.push('topic');
      if (bookNo === 2 && topic?.theme === 'fork') tags.push('fork');
      if (bookNo === 4 && /ending|endgame|fortress/i.test(span.heading)) tags.push('endgame');
      if (bookNo === 4 && /candidate|forcing/i.test(span.heading)) tags.push('calculation');
      chapters.push({ id, book: bookNo, index: ci + 1, title: span.heading, objectives, sections, exercises, topic, tags });
    });
    const intro = introLines.length ? parseParts(introLines, f => ({ kind: 'board', board: { fen: f.fen, caption: f.caption ?? '', line: sanTokens(f.line), ccn: lineToCcn(f.fen, sanTokens(f.line)), show: f.show === 'after' ? 'after' : 'before', flip: f.flip === 'true', claim: f.claim ?? 'legal' } })) : [];
    books.push({ id: `b${bookNo}`, number: bookNo, kind: isBook ? 'book' : 'appendix', title, file: `${DIR}/${file}`, intro, chapters });
  }
  const data: GrimoireData = { id: GRIMOIRE_ID, prover: MATE_PROVER_ID, books };
  const index: GrimoireIndex = {
    id: GRIMOIRE_ID,
    books: books.map(b => ({ number: b.number, kind: b.kind, title: b.title, chapters: b.chapters.map(c => ({ id: c.id, title: c.title, tags: c.tags, topic: c.topic, exercises: c.exercises.map(e => e.id), puzzles: c.exercises.flatMap(e => (e.kind === 'line' && e.puzzleId ? [e.puzzleId] : [])) })) })),
  };
  return { data, index };
}

export const serialize = (x: unknown) => JSON.stringify(x, null, 1) + '\n';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { data, index } = buildGrimoire();
  const check = process.argv.includes('--check');
  let drift = 0;
  for (const [file, value] of [[OUT_DATA, data], [OUT_INDEX, index]] as const) {
    const text = serialize(value);
    if (check) { let cur = ''; try { cur = readFileSync(file, 'utf8'); } catch { /* missing */ } if (cur !== text) { drift++; console.log(`DRIFT ${file}`); } }
    else writeFileSync(file, text);
  }
  const ex = data.books.flatMap(b => b.chapters.flatMap(c => c.exercises));
  const by = (k: string) => ex.filter(e => e.source === k).length;
  console.log(`${data.books.length} books, ${data.books.reduce((a, b) => a + b.chapters.length, 0)} chapters, ${ex.length} exercises (puzzle ${by('puzzle')}, mate ${by('mate')}, best ${by('best')}), ${ex.filter(e => e.answer).length} with an answer from the book${check ? (drift ? ' — DRIFT' : ' — up to date') : ''}`);
  process.exit(drift ? 1 : 0);
}
