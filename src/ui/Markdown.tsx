/**
 * A tiny, safe Markdown renderer for Grimoire lessons: headings, paragraphs, bold/italic, inline code, lists (nested
 * by indentation), tables, fenced code, block quotes and rules. It builds React elements only — raw HTML is never
 * interpreted (HTML comments are dropped; any other tag is shown as text) and links render as their text.
 */
import { Fragment, type ReactNode } from 'react';

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'code'; text: string }
  | { t: 'quote'; text: string }
  | { t: 'hr' }
  | { t: 'list'; ordered: boolean; start: number; items: { text: string; children: Block[] }[] }
  | { t: 'table'; head: string[]; rows: string[][] };

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const fence = /^\s*(```|~~~)/.exec(l);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      out.push({ t: 'code', text: body.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { out.push({ t: 'h', level: h[1].length, text: h[2].trim() }); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push({ t: 'hr' }); i++; continue; }
    if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push({ t: 'table', head, rows });
      continue;
    }
    if (/^\s*>/.test(l)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ t: 'quote', text: body.join(' ') });
      continue;
    }
    if (LIST_RE.test(l)) {
      const [block, next] = parseList(lines, i);
      out.push(block); i = next;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s/.test(lines[i]) && !/^\s*(```|~~~)/.test(lines[i]) && !LIST_RE.test(lines[i]) && !/^\s*>/.test(lines[i])
      && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) para.push(lines[i++].trim());
    out.push({ t: 'p', text: para.join(' ') });
  }
  return out;
}

function parseList(lines: string[], start: number): [Block, number] {
  const first = LIST_RE.exec(lines[start])!;
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items: { text: string; children: Block[] }[] = [];
  let i = start;
  while (i < lines.length) {
    const m = LIST_RE.exec(lines[i]);
    if (m && m[1].length === indent && /\d/.test(m[2]) === ordered) { items.push({ text: m[3].trim(), children: [] }); i++; continue; }
    if (m && m[1].length > indent && items.length) { const [sub, n] = parseList(lines, i); items[items.length - 1].children.push(sub); i = n; continue; }
    // continuation: an indented line, or a lazy line straight after the item (no blank line between)
    if (!m && lines[i].trim() && items.length && (/^\s+/.test(lines[i]) || lines[i - 1].trim() !== '') && !/^(#{1,6})\s|^\s*(```|~~~)|^\s*>/.test(lines[i])) { items[items.length - 1].text += ' ' + lines[i].trim(); i++; continue; }
    break;
  }
  return [{ t: 'list', ordered, start: ordered ? parseInt(first[2], 10) : 1, items }, i];
}

/** Inline: `code`, **bold**, *italic* / _italic_, [text](url) → text. Everything else is literal text. */
export function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`+)([\s\S]*?)\1|\*\*([\s\S]+?)\*\*|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const id = `${key}-${k++}`;
    if (m[1]) out.push(<code key={id}>{m[2]}</code>);
    else if (m[3] !== undefined) out.push(<strong key={id}>{inline(m[3], id)}</strong>);
    else if (m[4] !== undefined) out.push(<em key={id}>{inline(m[4], id)}</em>);
    else if (m[5] !== undefined) out.push(<em key={id}>{inline(m[5], id)}</em>);
    else if (m[6] !== undefined) out.push(<Fragment key={id}>{inline(m[6], id)}</Fragment>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function render(b: Block, key: string, headingOffset: number): ReactNode {
  switch (b.t) {
    case 'h': { const lvl = Math.min(6, b.level + headingOffset); const H = `h${lvl}` as 'h3'; return <H key={key}>{inline(b.text, key)}</H>; }
    case 'p': return <p key={key}>{inline(b.text, key)}</p>;
    case 'code': return <pre key={key} className="md-code"><code>{b.text}</code></pre>;
    case 'quote': return <blockquote key={key}>{inline(b.text, key)}</blockquote>;
    case 'hr': return <hr key={key} />;
    case 'list': {
      const items = b.items.map((it, j) => <li key={j}>{inline(it.text, `${key}-${j}`)}{it.children.map((c, n) => render(c, `${key}-${j}-${n}`, headingOffset))}</li>);
      return b.ordered ? <ol key={key} start={b.start}>{items}</ol> : <ul key={key}>{items}</ul>;
    }
    case 'table': return (
      <div key={key} className="md-table"><table>
        <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c, `${key}-h${j}`)}</th>)}</tr></thead>
        <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, n) => <td key={n}>{inline(c, `${key}-${j}-${n}`)}</td>)}</tr>)}</tbody>
      </table></div>
    );
  }
}

export function Markdown({ md, headingOffset = 0 }: { md: string; headingOffset?: number }) {
  return <div className="md">{parseMarkdown(md).map((b, i) => render(b, `b${i}`, headingOffset))}</div>;
}
