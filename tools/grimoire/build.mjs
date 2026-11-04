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
pre.crown, pre:has(code.language-crown) { display: none; }
table { border-collapse: collapse; width: 100%; font-size: .95rem; }
th, td { border-bottom: 1px solid var(--rule); padding: .35rem .5rem; text-align: left; vertical-align: top; }
blockquote { border-left: 3px solid var(--accent); margin: 1rem 0; padding: .2rem 1rem; color: var(--muted); }
hr { border: 0; border-top: 1px solid var(--rule); margin: 3rem 0; }
@media print { body { max-width: none; font-size: 10.5pt; } h1 { break-before: page; } pre { break-inside: avoid; } a { color: inherit; } }
`;
writeFileSync('docs/grimoire/build/grimoire.css', css);
// the crown source blocks are hidden (the rendered diagram follows each one)
const md = readFileSync('docs/THE_SOVEREIGNS_GRIMOIRE.md', 'utf8').replace(/```crown\n[\s\S]*?\n```\n?/g, '');
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
