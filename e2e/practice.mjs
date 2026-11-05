/**
 * Practice-game journey: Academy → Today's Plan (Advanced, 30 min) → "Play" on the suggested practice game → the Play
 * screen has the suggested opponent (L6 Dario Quill), Rapid 5+3 and Casual preselected → Start Match → the match is
 * Casual with the assistant available (never rated). Going back to Play afterwards shows the ordinary defaults (the
 * hand-off is consumed once). Phone width (390 px): no horizontal overflow. No page errors.
 *   npm run build && node scripts/serve.mjs --dir dist --port 4406 &   then   node e2e/practice.mjs [url]
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4406/';
const OUT = new URL('./artifacts/practice/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/practice-profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true }); rmSync(PROFILE, { recursive: true, force: true });
const log = []; const errors = [];
const step = m => { log.push(m); console.log(m); };
const done = code => { writeFileSync(OUT + 'practice-log.txt', log.join('\n') + '\n'); process.exit(code); };
const fail = async m => { step('FAIL: ' + m); try { await page.screenshot({ path: OUT + 'fail.png' }); } catch { /* ignore */ } done(1); };

const ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1280, height: 900 } });
const page = ctx.pages()[0];
page.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + e); });

await page.goto(url + '#/academy');
await page.waitForSelector('[data-testid="learning-plan"]');
await page.selectOption('[data-testid="plan-level"]', 'advanced');
await page.selectOption('[data-testid="plan-minutes"]', '30');
await page.getByRole('button', { name: 'Save Plan' }).click();
await page.waitForSelector('[data-testid="plan-practice"]');
const planText = (await page.locator('[data-testid="plan-practice"]').innerText()).replace(/\s+/g, ' ');
step(`Today's Plan: ${planText}`);
if (!/Dario Quill/.test(planText) || !/L6/.test(planText) || !/Casual/.test(planText)) await fail('plan should suggest a casual game vs L6 Dario Quill');
await page.screenshot({ path: OUT + '01-plan.png' });

await page.click('[data-testid="plan-practice-play"]');
await page.waitForSelector('[data-testid="practice-preset"]');
const pressed = async label => page.locator(`[aria-label="${label}"] button[aria-pressed="true"]`).allInnerTexts();
const selectedOpp = await page.locator('.opp-card[aria-pressed="true"]').innerText();
// v1.1: time controls are split into rated and casual groups (TimeControlPicker)
const tc = [...await pressed('Rated time controls'), ...await pressed('Casual time controls')], mode = await pressed('Mode');
step(`Play screen: opponent "${selectedOpp.split('\n')[0]}", time control ${tc.join(',')}, mode ${mode.join(',')}`);
step(`Notice: ${await page.locator('[data-testid="practice-preset"]').innerText()}`);
if (!/Dario Quill/.test(selectedOpp)) await fail('suggested opponent not selected');
if (tc.join() !== 'Rapid 5+3') await fail('Rapid 5+3 not selected');
if (mode.join() !== 'Casual') await fail('Casual not selected');
const startLabel = await page.getByRole('button', { name: /Start Match vs/ }).innerText();
step(`Start button: ${startLabel.trim()}`);
await page.screenshot({ path: OUT + '02-play-preselected.png' });

await page.getByRole('button', { name: /Start Match vs Dario Quill/ }).click();
await page.waitForSelector('[data-testid="match"]');
const header = await page.locator('.chip', { hasText: /^(Casual|Rated · Unassisted)$/ }).first().innerText();
step(`Match started: ${header}; game ${await page.evaluate(() => location.hash)}`);
if (header !== 'Casual') await fail('practice match must be casual');
const assistTab = page.getByRole('tab', { name: /Assistant/i });
if (await assistTab.count()) await assistTab.first().click();
const locked = await page.locator('[data-testid="assist-locked"]').count();
const assistPanel = await page.locator('[data-testid="assist-panel"]').count();
step(`Assistant: panel ${assistPanel ? 'available' : 'absent'}, locked notice ${locked ? 'shown' : 'absent'} (casual game: available)`);
if (locked || !assistPanel) await fail('assistant should be available in a casual practice game');
await page.screenshot({ path: OUT + '03-match-casual.png' });

// the hand-off is consumed: opening Play again shows the ordinary defaults
await page.goto(url + '#/play');
await page.waitForSelector('.opp-card');
const again = await page.locator('[data-testid="practice-preset"]').count();
const mode2 = await pressed('Mode');
step(`Play reopened: practice notice ${again ? 'shown' : 'gone'}, mode ${mode2.join(',')}`);
if (again) await fail('practice setup should be consumed once');

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url + '#/academy');
await page.waitForSelector('[data-testid="plan-practice"]');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
step(`Phone width 390 px: horizontal overflow ${overflow}px`);
if (overflow > 0) await fail('horizontal overflow at 390 px');
await page.screenshot({ path: OUT + '04-plan-phone.png' });

if (errors.length) await fail(`${errors.length} page error(s)`);
step('PASS practice journey');
await ctx.close();
done(0);
