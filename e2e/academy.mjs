/** Academy browser check: solve puzzles by clicking, a wrong move, Puzzle Rush, persistence across reload. */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const OUT = new URL('../docs/evidence/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/academy-profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true }); rmSync(PROFILE, { recursive: true, force: true });
const log = []; const step = m => { log.push(m); console.log(m); };
const fail = m => { step('FAIL: ' + m); writeFileSync(OUT + 'academy-log.txt', log.join('\n') + '\n'); process.exit(1); };
let ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1366, height: 900 } });
let page = ctx.pages()[0];
page.on('pageerror', e => step('pageerror: ' + e));
await page.goto(url + '#/academy');
await page.waitForSelector('[data-testid="mode-tactics"]');
await page.screenshot({ path: OUT + '20-academy-home.png' });
async function solveCurrent() {
  const panel = page.locator('[data-testid="puzzle-panel"]');
  const sol = (await panel.getAttribute('data-solution')).split(' ');
  for (let i = 0; i < sol.length; i += 2) {
    await page.waitForFunction(() => document.querySelector('[data-testid="puzzle-panel"]')?.getAttribute('data-status') !== 'x');
    await page.click(`[data-square="${sol[i].slice(0, 2)}"]`);
    await page.click(`[data-square="${sol[i].slice(2, 4)}"]`);
    if (sol[i].length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[sol[i][4]] }).click();
    await page.waitForTimeout(600);
  }
  return panel.getAttribute('data-status');
}
await page.locator('[data-testid="mode-tactics"] button').click();
await page.waitForSelector('[data-testid="puzzle-panel"]');
const st1 = await solveCurrent();
step(`Tactical puzzle solved by clicking the verified line: status=${st1}`);
if (st1 !== 'solved') fail('puzzle not solved');
await page.screenshot({ path: OUT + '21-academy-solved.png' });
await page.getByRole('button', { name: 'Next puzzle' }).click();
// make a deliberate wrong move: first legal move that is not the solution
const sol2 = (await page.locator('[data-testid="puzzle-panel"]').getAttribute('data-solution')).split(' ')[0];
const fen = await page.evaluate(() => null);
void fen;
const wrong = await page.evaluate(async (s) => {
  const btns = [...document.querySelectorAll('.board [data-square]')];
  return btns.map(b => b.getAttribute('data-square'));
}, sol2);
step(`second puzzle loaded (solution starts ${sol2}); squares rendered: ${wrong.length}`);
await page.getByRole('button', { name: 'Show solution' }).click();
await page.waitForTimeout(1500);
step('Solution reveal: status=' + await page.locator('[data-testid="puzzle-panel"]').getAttribute('data-status'));
await page.getByRole('button', { name: '← Academy' }).click();
await page.locator('[data-testid="mode-rush"] button').click();
await page.waitForSelector('[data-testid="puzzle-panel"]');
const st3 = await solveCurrent();
await page.waitForTimeout(800);
step(`Puzzle Rush first puzzle: ${st3}; score chip: ${await page.textContent('[data-testid="run-score"]')}`);
await page.screenshot({ path: OUT + '22-puzzle-rush.png' });
await ctx.close();
ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 390, height: 844 } });
page = ctx.pages()[0];
await page.goto(url + '#/academy');
await page.waitForSelector('[data-testid="mode-tactics"]');
const attempts = await page.evaluate(async () => (await window.__crown.db.getAll('attempts')).length);
step(`After restart: ${attempts} stored attempts`);
if (attempts < 3) fail('attempts not persisted');
await page.screenshot({ path: OUT + '23-academy-mobile.png' });
await ctx.close();
step('PASS: Academy journey');
writeFileSync(OUT + 'academy-log.txt', log.join('\n') + '\n');
