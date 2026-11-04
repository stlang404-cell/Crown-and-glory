/**
 * First-run guide journey (v1.0 package V, crown-tour-1): a new career sees one step at a time on the Dashboard,
 * screen hints appear where a step matters (Play, Analysis, Federation, Exchange, Career, Hall), never in a match,
 * everything is keyboard operable and skippable, state persists across reloads and in the save, and the guide can be
 * hidden and replayed from Settings → Help & Tutorials. Also checks the after-loss options of the result dialog.
 *   node scripts/serve.mjs --dir dist --port 4458 &  node e2e/onboarding.mjs http://127.0.0.1:4458/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = (process.argv[2] ?? 'http://127.0.0.1:4458/').replace(/\/?$/, '/');
const OUT = new URL('./artifacts/onboarding/', import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };

const ctx = await chromium.launchPersistentContext(OUT + 'profile', { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(String(e).slice(0, 300)); step('pageerror: ' + String(e).slice(0, 300)); });
page.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 300)); step('console.error: ' + m.text().slice(0, 300)); } });
await page.goto(url);
await page.waitForFunction(() => window.__crown);
const card = page.getByTestId('guide-card');
await card.waitFor({ timeout: 10000 });
const first = await page.evaluate(() => ({
  step: document.querySelector('[data-testid="guide-card"]')?.getAttribute('data-step'),
  progress: document.querySelector('[data-testid="guide-progress"]')?.textContent,
  bodies: document.querySelectorAll('[data-testid="guide-current"]').length,
  locked: [...document.querySelectorAll('[data-testid="guide-steps"] li[data-status="locked"]')].length,
  text: document.querySelector('[data-testid="guide-current"]')?.textContent ?? '',
}));
check(1, first.step === 'rules' && /0 of 9/.test(first.progress) && first.bodies === 1 && first.locked === 7 && /no bishops/.test(first.text),
  `A new career's Dashboard shows one guide step (${first.step}, "${first.progress}", ${first.locked} later steps locked until relevant) with the rules summary`);
await page.screenshot({ path: OUT + '1-dashboard-guide.png' });

// keyboard: reach the guide's "Got it" with Tab and press Enter
await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
let reached = false;
for (let i = 0; i < 60 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'guide-skip'); }
if (reached) await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelector('[data-testid="guide-card"]')?.getAttribute('data-step') === 'first-game', null, { timeout: 5000 }).catch(() => {});
const s2 = await card.getAttribute('data-step');
check(2, reached && s2 === 'first-game', `The guide is keyboard operable: Tab reaches "Got it", Enter moves on to "${s2}"`);

// first beginner opponent: CTA → Play, hint, beginner suggested at 0 career Elo
await page.getByTestId('guide-cta').click();
await page.waitForSelector('[data-testid="tour-hint-first-game"]', { timeout: 5000 }).catch(() => {});
await page.waitForSelector('[data-testid="beginner-suggested"]', { timeout: 5000 }).catch(() => {});
const play = await page.evaluate(() => ({ hash: location.hash, hint: !!document.querySelector('[data-testid="tour-hint-first-game"]'), suggested: !!document.querySelector('[data-testid="beginner-suggested"]'), text: document.querySelector('[data-testid="tour-hint-first-game"]')?.textContent ?? '' }));
step(JSON.stringify({ ...play, text: play.text.slice(0, 80) }));
check(3, play.hash === '#/play' && play.hint && play.suggested && /career Elo of 0/.test(play.text) && /Commoner III/.test(play.text), `The step opens Play with an inline hint (0 career Elo, Commoner III) and beginners suggested`);

// a rated game vs a beginner: no guide in the match; lose by resignation → after-loss options
await page.getByTestId('opp-beginner-L0d').click();
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const inMatch = await page.evaluate(() => ({ hints: document.querySelectorAll('[data-testid^="tour-hint"], [data-testid="guide-card"], .help-tip').length, overlay: !!document.querySelector('.tour-hint, .guide-card') }));
check(4, inMatch.hints === 0 && !inMatch.overlay, `Nothing from the guide appears in a rated match (${inMatch.hints} guide elements)`);
await page.waitForFunction(() => ['human', 'engine'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')));
await page.getByRole('button', { name: /Resign/ }).first().click();
await page.getByRole('button', { name: 'Yes, Resign' }).click();
await page.waitForSelector('.result-overlay', { timeout: 20000 });
const res = await page.evaluate(() => ({ focus: document.activeElement?.textContent, loss: !!document.querySelector('[data-testid="after-loss"]'), practice: !!document.querySelector('[data-testid="after-loss-practice"]'), rematch: [...document.querySelectorAll('.result-overlay button')].some(b => b.textContent === 'Rematch') }));
check(5, res.focus === 'View Analysis' && res.loss && res.practice && res.rematch, `After a loss the result dialog takes focus on "${res.focus}" and offers analysis, Academy practice and a rematch`);
await page.screenshot({ path: OUT + '2-after-loss.png' });

// first replay analysis
await page.getByRole('button', { name: 'View Analysis' }).click();
await page.waitForSelector('[data-testid="tour-hint-replay"]', { timeout: 15000 }).catch(() => {});
const rep = await page.evaluate(() => document.querySelector('[data-testid="tour-hint-replay"]')?.textContent ?? '');
check(6, /evaluation bar/i.test(rep) && /Played Like/.test(rep), 'The first analysis shows the replay guide (evaluation bar only outside your own game, Played Like)');
await page.getByTestId('tour-ack-replay').click();

// Dashboard: progress moved on (rules ack, first game, first rated, replay) → Federation
await page.goto(url + '#/dashboard');
await page.waitForFunction(() => document.querySelector('[data-testid="guide-card"]')?.getAttribute('data-step') === 'federation', null, { timeout: 15000 }).catch(() => {});
const d2 = await page.evaluate(() => ({ step: document.querySelector('[data-testid="guide-card"]')?.getAttribute('data-step'), progress: document.querySelector('[data-testid="guide-progress"]')?.textContent }));
check(7, d2.step === 'federation' && /4 of 9/.test(d2.progress), `Progress is derived from the save: "${d2.progress}", next "${d2.step}"`);

// join the Federation → tournament hint; market tutorial on the Exchange
await page.getByTestId('guide-cta').click();
const fedHint = await page.getByTestId('tour-hint-federation').isVisible().catch(() => false);
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
const tourHint = await page.getByTestId('tour-hint-tournament').isVisible().catch(() => false);
check(8, fedHint && tourHint, 'The Federation screen explains joining before it is founded and the first match/tournament after');
await page.goto(url + '#/exchange');
await page.waitForSelector('[data-testid="tour-hint-market"]', { timeout: 10000 }).catch(() => {});
const mk = await page.evaluate(() => document.querySelector('[data-testid="tour-hint-market"]')?.textContent ?? '');
check(9, /fictional/.test(mk) && /cannot be bought, cashed out/.test(mk) && /lose what you paid/.test(mk) && /never more/.test(mk), 'The first live-market tutorial says plainly that money is fictional and how losses work');
await page.screenshot({ path: OUT + '3-market-tutorial.png' });
// help tip: keyboard disclosure
const tip = page.locator('.help-tip-btn').first();
await tip.focus(); await page.keyboard.press('Enter');
const tipOpen = await tip.getAttribute('aria-expanded');
await page.keyboard.press('Escape');
const tipClosed = await tip.getAttribute('aria-expanded');
check(10, tipOpen === 'true' && tipClosed === 'false', 'Contextual "?" help opens with Enter and closes with Escape');
await page.goto(url + '#/profile');
const honours = await page.getByTestId('tour-hint-honours').textContent({ timeout: 10000 }).catch(() => '');
check(11, /Career Elo/.test(honours) && /Competitive Rank/.test(honours) && /Federation Titles/.test(honours) && /Played Like/.test(honours), 'Career explains rank vs title vs Elo vs Played Like');
await page.goto(url + '#/hall');
const trophy = await page.getByTestId('tour-hint-trophy').isVisible({ timeout: 10000 }).catch(() => false);
check(12, trophy, 'The Hall of Fame introduces the first trophy');

// persistence: reload keeps acknowledgements; the record is in the meta store (carried in backups)
await page.reload(); await page.waitForFunction(() => window.__crown);
const stored = await page.evaluate(async () => window.__crown.db.getMeta('tour:state'));
check(13, !!stored?.ack?.rules && !!stored?.ack?.replay && !!stored?.seen?.analysis, `Guide state persists in the save (tour:state: ack ${Object.keys(stored?.ack ?? {}).join(', ')})`);

// hide, then replay from Settings
await page.goto(url + '#/dashboard');
await page.getByTestId('guide-hide').click();
const hidden = await page.getByTestId('guide-card').count();
await page.goto(url + '#/exchange');
const hintsHidden = await page.locator('[data-testid^="tour-hint"]').count();
await page.goto(url + '#/settings');
await page.getByTestId('help-restart').click();
await page.goto(url + '#/dashboard');
await page.waitForSelector('[data-testid="guide-card"]', { timeout: 5000 }).catch(() => {});
const back = await page.evaluate(() => document.querySelector('[data-testid="guide-card"]')?.getAttribute('data-step'));
check(14, hidden === 0 && hintsHidden === 0 && back === 'rules', `Hiding removes the card and all tips; Settings → Restart the Guide replays it from "${back}"`);

// 390 px: no overflow, card fits
await ctx.close();
const ctx2 = await chromium.launchPersistentContext(OUT + 'profile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p2 = ctx2.pages()[0] ?? await ctx2.newPage();
await p2.goto(url + '#/dashboard'); await p2.waitForFunction(() => window.__crown);
await p2.waitForSelector('[data-testid="guide-card"]', { timeout: 10000 }).catch(() => {});
const phone = await p2.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, card: document.querySelector('[data-testid="guide-card"]')?.getBoundingClientRect().width ?? 0 }));
await p2.screenshot({ path: OUT + '4-phone-guide.png' });
check(15, phone.overflow <= 0 && phone.card > 0 && phone.card <= 390, `390 px: the guide fits (card ${Math.round(phone.card)} px, overflow ${phone.overflow})`);
await ctx2.close();
check(16, errors.length === 0, `No page or console errors (${errors.length})`);
writeFileSync(OUT + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
