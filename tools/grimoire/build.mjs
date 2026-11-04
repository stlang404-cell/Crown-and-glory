/**
 * Builds the book editions of The Sovereign's Grimoire from docs/grimoire/*.md:
 *   docs/THE_SOVEREIGNS_GRIMOIRE.md   one Markdown file (front matter + table of contents + all books + glossary)
 *   docs/grimoire/build/grimoire.html  standalone styled HTML (offline; light and dark)
 *   docs/grimoire/build/grimoire.pdf   print edition via headless Chromium (A5-like, page numbers)
 * Run after `npx tsx tools/grimoire/check.ts --render` so every diagram is current.
 *   node tools/grimoire/build.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const parts = readdirSync('docs/grimoire').filter(f => /^\d\d-.*\.md$/.test(f)).sort();
const body = parts.map(f => readFileSync(`docs/grimoire/${f}`, 'utf8').trim()).join('\n\n---\n\n');
const toc = parts.flatMap(f => readFileSync(`docs/grimoire/${f}`, 'utf8').split('\n').filter(l => /^#{1,2} /.test(l)))
  .map(l => { const lvl = l.startsWith('## ') ? 1 : 0; const t = l.replace(/^#+ /, ''); return `${'  '.repeat(lvl)}- ${t}`; }).join('\n');
const front = `# The Sovereign's Grimoire
## From Apprentice to Chess Sovereign

*The official strategy textbook of Crown & Calculation — six-square chess (crown-la6-v1), the Federation and the Crown Exchange.*

Every board in this book is checked by \`tools/grimoire/check.ts\` against the game's real rules: legality, every move
written in a line, and every "mate in N" claim (proved exhaustively). "Best move" claims are the engine's judgement under
the Academy puzzle policy and are labelled as such. The official rules are in [RULEBOOK.md](RULEBOOK.md).
Money in this book is the game's fictional dollars.

## Contents

${toc}

---

`;
writeFileSync('docs/THE_SOVEREIGNS_GRIMOIRE.md', front + body + '\n');
console.log(`docs/THE_SOVEREIGNS_GRIMOIRE.md: ${parts.length} parts, ${(front + body).length.toLocaleString('en')} characters`);

mkdirSync('docs/grimoire/build', { recursive: true });
const css = `
:root { --ink:#22201c; --paper:#fbf7ee; --rule:#d9cdb3; --accent:#8e2f3a; --muted:#6b6457; --code:#f3ecdc; }
@media (prefers-color-scheme: dark) { :root { --ink:#ece6d8; --paper:#16151a; --rule:#3a3631; --accent:#e07a85; --muted:#a69f91; --code:#211f24; } }
html { background: var(--paper); color: var(--ink); }
body { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; font: 1.05rem/1.65 Georgia, 'Iowan Old Style', 'Palatino Linotype', serif; }
h1, h2, h3, h4 { font-family: Georgia, serif; line-height: 1.25; color: var(--ink); }
h1 { font-size: 2.1rem; border-bottom: 2px solid var(--accent); padding-bottom: .3rem; margin-top: 3rem; }
h2 { font-size: 1.5rem; margin-top: 2.4rem; color: var(--accent); }
h3 { font-size: 1.2rem; margin-top: 1.8rem; }
a { color: var(--accent); }
pre, code { font-family: 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: .92rem; }
pre { background: var(--code); border: 1px solid var(--rule); border-radius: 8px; padding: .8rem 1rem; overflow-x: auto; line-height: 1.25; }
figure.board { margin: 1rem 0; break-inside: avoid; } figure.board figcaption { font-size: .9rem; color: var(--muted); font-style: italic; }
table { border-collapse: collapse; width: 100%; font-size: .95rem; }
th, td { border-bottom: 1px solid var(--rule); padding: .35rem .5rem; text-align: left; vertical-align: top; }
blockquote { border-left: 3px solid var(--accent); margin: 1rem 0; padding: .2rem 1rem; color: var(--muted); }
hr { border: 0; border-top: 1px solid var(--rule); margin: 3rem 0; }
@media print { body { max-width: none; font-size: 10.5pt; } h1 { break-before: page; } pre { break-inside: avoid; } a { color: inherit; } }
`;
writeFileSync('docs/grimoire/build/grimoire.css', css);
// the crown source blocks are hidden (the rendered diagram follows each one)
// HTML/PDF editions draw every diagram as an SVG board (text diagrams stay in the Markdown edition)
const GLYPH = { K: '♔', Q: '♕', R: '♖', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', n: '♞', p: '♟' };
function svgBoard(fen, flip) {
  const rows = fen.split(' ')[0].split('/').map(r => r.replace(/\d/g, d => '.'.repeat(+d)).split(''));
  const S = 34, pad = 16, W = pad + 6 * S + 4;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W * 1.25}" height="${W * 1.25}" role="img" aria-label="board ${fen.split(' ')[0]}">`;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const rr = flip ? 5 - r : r, cc = flip ? 5 - c : c;
    const light = (rr + cc) % 2 === 0;
    out += `<rect x="${pad + c * S}" y="${r * S}" width="${S}" height="${S}" fill="${light ? '#efe3c8' : '#b8956a'}"/>`;
    const p = rows[rr][cc];
    if (p !== '.') out += `<text x="${pad + c * S + S / 2}" y="${r * S + S * 0.78}" font-size="${S * 0.86}" text-anchor="middle" font-family="DejaVu Sans, Segoe UI Symbol, Noto Sans Symbols2, sans-serif" fill="#1b1712">${GLYPH[p]}</text>`;
  }
  for (let i = 0; i < 6; i++) {
    out += `<text x="${pad / 2}" y="${i * S + S * 0.62}" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#6b6457">${flip ? i + 1 : 6 - i}</text>`;
    out += `<text x="${pad + i * S + S / 2}" y="${6 * S + 12}" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#6b6457">${(flip ? 'fedcba' : 'abcdef')[i]}</text>`;
  }
  out += `<rect x="${pad}" y="0" width="${6 * S}" height="${6 * S}" fill="none" stroke="#5a4630" stroke-width="1.5"/></svg>`;
  return out;
}
const md = readFileSync('docs/THE_SOVEREIGNS_GRIMOIRE.md', 'utf8').replace(/```crown\n([\s\S]*?)\n```\n?\s*<!-- diagram -->\n```text\n[\s\S]*?\n```\n?((?:\*[^\n]*\*\n)?)<!-- \/diagram -->/g, (all, body, cap) => {
  const f = Object.fromEntries(body.split('\n').map(l => /^\s*([a-z-]+)\s*:\s*(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].trim()]));
  const after = (all.match(/```text\n[\s\S]*?\n```/)[0]);
  // the rendered text diagram already reflects `show: after`; recover its board from the text art
  const ranks = after.split('\n').filter(l => /^[1-6] │/.test(l)).map(l => l.slice(4).split(' ').map(ch => ({ '♔': 'K', '♕': 'Q', '♖': 'R', '♘': 'N', '♙': 'P', '♚': 'k', '♛': 'q', '♜': 'r', '♞': 'n', '♟': 'p' }[ch] ?? '.')));
  const flip = f.flip === 'true';
  const board = (flip ? [...ranks].reverse().map(r => [...r].reverse()) : ranks).map(r => r.join('').replace(/\.+/g, m => String(m.length))).join('/');
  const side = /White to move/.test(after) ? 'White to move' : 'Black to move';
  return `<figure class="board">${svgBoard(board + ' w', flip)}<figcaption>${side}${cap ? ' — ' + cap.trim().replace(/^\*|\*$/g, '') : ''}</figcaption></figure>\n`;
}).replace(/```crown\n[\s\S]*?\n```\n?/g, '');
writeFileSync('docs/grimoire/build/grimoire.src.md', md);
execFileSync('pandoc', ['docs/grimoire/build/grimoire.src.md', '-f', 'gfm', '-t', 'html5', '-s', '--metadata', "title=The Sovereign's Grimoire",
  '--toc', '--toc-depth=2', '-c', 'grimoire.css', '--embed-resources', '--resource-path=docs/grimoire/build', '-o', 'docs/grimoire/build/grimoire.html']);
console.log('docs/grimoire/build/grimoire.html');

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + process.cwd() + '/docs/grimoire/build/grimoire.html');
await page.emulateMedia({ media: 'print', colorScheme: 'light' });
await page.pdf({ path: 'docs/grimoire/build/grimoire.pdf', width: '148mm', height: '210mm', margin: { top: '14mm', bottom: '16mm', left: '13mm', right: '13mm' },
  displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;text-align:center;font-size:8px;color:#777"><span class="pageNumber"></span></div>' });
await browser.close();
console.log('docs/grimoire/build/grimoire.pdf');
