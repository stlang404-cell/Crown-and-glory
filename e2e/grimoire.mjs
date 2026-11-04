/**
 * Grimoire browser journey: Academy → Grimoire → Book II → forks chapter; read it, solve an exercise with the correct
 * move (feedback), make a wrong move (recorded for review), complete the chapter by solving every exercise and complete
 * an exercise-free chapter by reading it; reload (progress persists), offline reload (lessons load from the service
 * worker cache), phone width 390 px (no horizontal overflow), and no page errors.
 *   npm run build && node scripts/serve.mjs --dir dist --port 4404 &   then   node e2e/grimoire.mjs [url]
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4404/';
const OUT = new URL('../docs/screenshots/grimoire/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/grimoire-profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true }); rmSync(PROFILE, { recursive: true, force: true });
const log = []; const errors = [];
const step = m => { log.push(m); console.log(m); };
const done = code => { writeFileSync(OUT + 'grimoire-log.txt', log.join('\n') + '\n'); process.exit(code); };
const fail = m => { step('FAIL: ' + m); done(1); };
const FORKS = 'b2-1-double-attacks-and-forks';
const FREE = 'b1-1-the-board-and-its-coordinates';

let ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1280, height: 900 } });
let page = ctx.pages()[0];
const watch = p => { p.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + e); }); };
watch(page);

await page.goto(url + '#/academy');
await page.waitForSelector('[data-testid="academy-grimoire"]');
await page.waitForSelector('[data-testid="learning-plan"]');
await page.screenshot({ path: OUT + '01-academy-home.png' });
step('Academy home shows the Grimoire card and Today’s Plan');
await page.getByRole('button', { name: 'Open the Grimoire' }).click();
await page.waitForSelector('[data-testid="grimoire-home"]');
step(`Grimoire home: ${await page.locator('[data-testid="grimoire-book-card"]').count()} book cards`);
await page.screenshot({ path: OUT + '02-grimoire-home.png' });
await page.click('[data-testid="grimoire-book-card"][data-book="2"]');
await page.waitForSelector('[data-testid="grimoire-book"][data-book="2"]');
await page.screenshot({ path: OUT + '03-book-ii.png' });
await page.click(`[data-testid="grimoire-chapter"][data-chapter="${FORKS}"]`);
await page.waitForSelector(`[data-testid="grimoire-chapter-reader"][data-chapter="${FORKS}"]`);
const examples = await page.locator('[data-testid="grimoire-example"]').count();
const exCount = await page.locator('[data-testid="grim-exercise"]').count();
step(`Forks chapter open: ${examples} example boards, ${exCount} interactive exercises`);
if (exCount < 2) fail('expected exercises in the forks chapter');
await page.screenshot({ path: OUT + '04-forks-chapter.png' });
// read: scroll through to the end
await page.locator('[data-testid="chapter-end"]').scrollIntoViewIfNeeded();

const panel = i => page.locator('[data-testid="grim-exercise"]').nth(i);
async function play(i, ccn) {
  const sq = s => panel(i).locator(`[data-square="${s}"]`);
  await sq(ccn.slice(0, 2)).click();
  await sq(ccn.slice(2, 4)).click();
  if (ccn.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[ccn[4]] }).click();
}
async function solve(i) {
  const p = panel(i);
  await p.scrollIntoViewIfNeeded();
  const sol = (await p.getAttribute('data-solution')).split(' ');
  const kind = await p.getAttribute('data-kind');
  for (let k = 0; k < (kind === 'line' ? sol.length : 1); k += 2) {
    await play(i, sol[k]);
    await page.waitForTimeout(700); // the stored reply animates in
  }
  await page.waitForFunction(([idx]) => document.querySelectorAll('[data-testid="grim-exercise"]')[idx]?.getAttribute('data-status') === 'solved', [i], { timeout: 8000 }).catch(() => {});
  return { status: await p.getAttribute('data-status'), feedback: await p.locator('[data-testid="grim-feedback"]').textContent().catch(() => '') };
}

// 1. the guided exercise with the correct moves
const r0 = await solve(0);
step(`Guided exercise: status=${r0.status}; feedback "${r0.feedback?.slice(0, 90)}"`);
if (r0.status !== 'solved' || !/first try/.test(r0.feedback ?? '')) fail('correct move not accepted with first-try feedback');
await panel(0).screenshot({ path: OUT + '05-exercise-solved.png' });

// 2. a wrong move on exercise 1
const wrong = await panel(1).getAttribute('data-wrong');
await panel(1).scrollIntoViewIfNeeded();
await play(1, wrong);
await page.waitForFunction(() => document.querySelectorAll('[data-testid="grim-exercise"]')[1]?.getAttribute('data-status') === 'wrong');
const wrongText = await panel(1).locator('[data-testid="grim-feedback"]').textContent();
step(`Wrong move ${wrong} on exercise 1: feedback "${wrongText}"`);
await panel(1).screenshot({ path: OUT + '06-exercise-wrong.png' });
await page.waitForTimeout(400);
const recs = await page.evaluate(async () => (await window.__crown.db.metaWithPrefix('grim:att:')).map(r => r.value));
const missed = recs.find(r => r.outcome === 'failed');
step(`Stored attempts: ${recs.map(r => `${r.exerciseId.split('/')[1]}=${r.outcome}${r.solved ? '+solved' : ''}`).join(', ')}`);
if (!missed) fail('the wrong move was not recorded');

// 3. finish the chapter: solve exercise 1 after the miss, then the rest
for (let i = 1; i < exCount; i++) {
  const r = await solve(i);
  step(`Exercise ${i}: ${r.status}`);
  if (r.status !== 'solved') fail(`exercise ${i} not solved`);
}
await page.waitForSelector('[data-testid="chapter-complete"]', { timeout: 5000 }).catch(() => fail('chapter not marked complete after all exercises were solved'));
step('Forks chapter complete (all exercises solved; the missed one stays scheduled for review)');
await page.locator('[data-testid="chapter-end"]').screenshot({ path: OUT + '07-chapter-complete.png' });

// 4. an exercise-free chapter is completed by reading it to the end
await page.goto(url + `#/grimoire/${FREE}`);
await page.waitForSelector(`[data-testid="grimoire-chapter-reader"][data-chapter="${FREE}"]`);
await page.locator('[data-testid="chapter-end"]').scrollIntoViewIfNeeded();
await page.getByRole('button', { name: 'Finish Chapter' }).click();
await page.waitForSelector('[data-testid="chapter-complete"]');
step('Book I chapter 1 (no exercises) complete after reading to the end');

// 5. reload: progress persists
await page.reload();
await page.goto(url + '#/grimoire');
await page.waitForSelector('[data-testid="review-counts"]');
const sched = await page.getAttribute('[data-testid="review-counts"]', 'data-scheduled');
step(`After reload: review queue holds ${sched} scheduled exercise(s) (due after 1 day)`);
if (+sched < 1) fail('missed exercise is not in the review schedule');
await page.goto(url + '#/grimoire/b2');
await page.waitForSelector(`[data-testid="grimoire-chapter"][data-chapter="${FORKS}"]`);
const st = await page.getAttribute(`[data-testid="grimoire-chapter"][data-chapter="${FORKS}"]`, 'data-status');
step(`After reload: forks chapter status = ${st}`);
if (st !== 'complete') fail('completion did not persist');
const done1 = await page.evaluate(async () => (await window.__crown.db.metaWithPrefix('grim:done:')).map(r => r.value.chapterId));
step(`Completion records: ${done1.join(', ')}`);
await page.waitForTimeout(2500);
const ach = await page.evaluate(async () => (await window.__crown.db.metaWithPrefix('ach:')).map(r => r.key).filter(k => k === 'ach:first-lesson'));
step(`Vault: ${ach.length ? 'first-lesson unlocked' : 'first-lesson not (yet) unlocked'}`);

// 6. offline reload: lessons load from the precache
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }); }
await ctx.setOffline(true);
await page.goto(url + `#/grimoire/${FORKS}`);
await page.reload();
await page.waitForSelector(`[data-testid="grimoire-chapter-reader"][data-chapter="${FORKS}"]`, { timeout: 15000 }).catch(() => fail('chapter did not load offline'));
step(`Offline reload: forks chapter loaded from the service-worker cache (${await page.locator('[data-testid="grim-exercise"]').count()} exercises, complete=${await page.getAttribute('[data-testid="grimoire-chapter-reader"]', 'data-complete')})`);
await page.screenshot({ path: OUT + '08-offline-chapter.png' });
await ctx.setOffline(false);
await ctx.close();

// 7. phone width
ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
page = ctx.pages()[0];
watch(page);
for (const [hash, name] of [['#/academy', '09-phone-academy'], ['#/grimoire', '10-phone-grimoire'], [`#/grimoire/${FORKS}`, '11-phone-chapter'], ['#/grimoire/b3-iii-1-the-first-ten-doors-development-on-six-files', '12-phone-tables']]) {
  await page.goto(url + hash);
  await page.waitForTimeout(900);
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  step(`Phone ${hash}: scrollWidth ${w.sw} / clientWidth ${w.cw}`);
  if (w.sw > w.cw + 1) fail(`horizontal overflow on ${hash}`);
  await page.screenshot({ path: OUT + name + '.png' });
}
await page.goto(url + `#/grimoire/${FORKS}`);
await page.waitForSelector('[data-testid="grim-exercise"]');
await page.locator('[data-testid="grim-exercise"]').first().screenshot({ path: OUT + '13-phone-exercise.png' });
await ctx.close();

if (errors.length) fail(`${errors.length} page error(s)`);
step('PASS: Grimoire journey');
done(0);
