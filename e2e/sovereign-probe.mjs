/**
 * Sovereign probe (v0.8): plays the real UI against The Sovereign at a chosen thinking budget with a scripted
 * opponent and reports, from the saved game record, what the engine actually did on every move:
 * depth, nodes, time used, stop reason, engine build, nodes/s. Used to audit the max-difficulty path.
 *   node scripts/serve.mjs --dir dist --port 4401 &  node e2e/sovereign-probe.mjs http://127.0.0.1:4401/ <budgetS> <engineMoves>
 */
import { createRequire } from 'node:module';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { register } from 'tsx/esm/api';
register();
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { Position } = await import('../src/rules/position.ts');
const { moveToCcn } = await import('../src/rules/notation.ts');
const { Searcher } = await import('../src/engine/search.ts');
const url = process.argv[2] ?? 'http://127.0.0.1:4401/';
const BUDGET = process.argv[3] ?? '5'; const N = +(process.argv[4] ?? 6);
const ART = new URL('./artifacts/sovereign-probe/', import.meta.url).pathname;
rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
page.on('pageerror', e => console.log('pageerror ' + e));
await page.goto(url); await page.waitForFunction(() => window.__crown);
await page.getByRole('button', { name: /The Sovereign/ }).click();
await page.getByRole('button', { name: 'Casual', exact: true }).click();
await page.locator('[data-testid="max-budget"]').getByRole('button', { name: `${BUDGET} s`, exact: true }).click();
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const robot = new Searcher(18);
for (let i = 0; i < N; i++) {
  await page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 120000 });
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') === 'over') break;
  const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
  const mv = moveToCcn(robot.search(Position.fromFen(fen), { limits: { nodes: 20000 } }).bestMove);
  await page.click(`[data-square="${mv.slice(0, 2)}"]`); await page.click(`[data-square="${mv.slice(2, 4)}"]`);
  if (mv.length === 5) await page.getByRole('button', { name: /Promote to queen/ }).click();
  await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen);
}
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') !== 'engine', null, { timeout: 120000 });
const rec = await page.evaluate(async () => (await window.__crown.db.unfinishedGames())[0] ?? (await window.__crown.db.allGames()).at(-1));
const eng = rec.moves.filter((_, i) => i % 2 === 1).map(m => ({ san: m.san, depth: m.engine?.depth, nodes: m.engine?.nodes, ms: m.engine?.timeMs, stop: m.engine?.stopReason, build: m.engine?.build, nps: m.engine?.nodes && m.engine?.timeMs ? Math.round(m.engine.nodes / m.engine.timeMs * 1000) : null }));
const summary = { budgetS: +BUDGET, profile: rec.black.engine?.profileId, config: rec.black.engine?.config, moves: eng, cores: await page.evaluate(() => navigator.hardwareConcurrency) };
console.log(JSON.stringify(summary, null, 1));
writeFileSync(ART + `probe-${BUDGET}s.json`, JSON.stringify(summary, null, 1));
await ctx.close();
