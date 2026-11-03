/**
 * M4 theme evidence: screenshots of the key screens in every colour theme (desktop 1366×900, phone 390×844)
 * plus a horizontal-overflow check. Serve a build first:  node scripts/serve.mjs --dir dist --port 4600
 *   node e2e/m4-themes.mjs [http://127.0.0.1:4600/] [--quick]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv.find(a => a.startsWith('http')) ?? 'http://127.0.0.1:4600/';
const OUT = new URL('../docs/evidence/m4-themes/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'crown-m4-'));
const THEMES = ['obsidian', 'midnight', 'ivory'];
const SCREENS = [
  ['#/play', 'play', 'text=Choose your opponent'],
  ['#/world', 'world', 'h1'],
  ['#/exchange', 'exchange', 'h1'],
  ['#/finance', 'finance', 'h1'],
  ['#/library', 'library', 'h1'],
  ['#/academy', 'academy', '[data-testid="mode-tactics"]'],
  ['#/profile', 'profile', 'h1'],
  ['#/settings', 'settings', '[data-testid="theme-obsidian"]'],
];
const PHONE = ['play', 'world', 'settings', 'exchange'];
const problems = [];

const ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0];
const setPrefs = async prefs => { await page.evaluate(p => localStorage.setItem('crown.display.v1', JSON.stringify(p)), prefs); };

// Fresh profile: found the federation once so World/Exchange/Finance have content.
await page.goto(url + '#/world');
const found = page.locator('button', { hasText: 'Found the federation' });
await found.waitFor({ timeout: 20000 }).catch(() => {});
if (await found.count()) { await found.click(); await page.waitForSelector('text=Founding the federation…', { state: 'detached', timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1500); }

async function shoot(theme, board, w, h, tag, list) {
  await page.setViewportSize({ width: w, height: h });
  for (const [route, name, sel] of SCREENS.filter(s => list.includes(s[1]))) {
    await setPrefs({ theme, board, motion: 'reduce' });
    await page.goto(url + route);
    await page.reload();
    await page.waitForSelector(sel, { timeout: 20000 }).catch(() => problems.push(`${tag} ${theme} ${name}: selector ${sel} not found`));
    await page.waitForTimeout(400);
    const attr = await page.evaluate(() => document.documentElement.dataset.theme);
    if (attr !== theme) problems.push(`${tag} ${theme} ${name}: data-theme=${attr}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) problems.push(`${tag} ${theme} ${name}: HORIZONTAL OVERFLOW`);
    const file = `${tag}-${theme}${board !== 'theme' ? '-' + board : ''}-${name}.jpg`;
    await page.screenshot({ path: OUT + file, fullPage: tag === 'desktop', type: 'jpeg', quality: 85 });
    console.log(file, overflow ? 'OVERFLOW' : 'ok');
  }
}

const quick = process.argv.includes('--quick');
for (const theme of THEMES) await shoot(theme, 'theme', 1366, 900, 'desktop', quick ? ['play', 'settings'] : SCREENS.map(s => s[1]));
for (const theme of THEMES) await shoot(theme, 'theme', 390, 844, 'phone', quick ? ['play'] : PHONE);
if (!quick) for (const board of ['walnut', 'slate', 'green', 'mono']) await shoot('obsidian', board, 1366, 900, 'desktop', ['play']);

// A live match board (pieces on squares, last-move and selection highlights) in several theme/board pairs.
await page.setViewportSize({ width: 1366, height: 900 });
await page.goto(url + '#/play');
await page.waitForSelector('text=Choose your opponent');
await page.locator('.seg button', { hasText: /^White$/ }).first().click().catch(() => {});
await page.locator('button', { hasText: 'Start match vs' }).click();
await page.waitForSelector('[data-square="c2"]', { timeout: 20000 });
await page.click('[data-square="c2"]').catch(() => {});
await page.click('[data-square="c3"]').catch(() => {});
await page.waitForTimeout(4000);
const matchUrl = page.url();
for (const [theme, board] of [['obsidian', 'theme'], ['midnight', 'theme'], ['ivory', 'theme'], ['obsidian', 'walnut'], ['obsidian', 'slate'], ['ivory', 'green'], ['midnight', 'mono']]) {
  await setPrefs({ theme, board, motion: 'reduce' });
  await page.goto(matchUrl);
  await page.reload();
  await page.waitForSelector('[data-square="d2"]', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.click('[data-square="d2"]').catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}match-${theme}-${board}.jpg`, type: 'jpeg', quality: 85 });
  console.log(`match-${theme}-${board}.jpg`);
}
await page.setViewportSize({ width: 390, height: 844 });
await setPrefs({ theme: 'obsidian', board: 'theme', motion: 'reduce' });
await page.goto(matchUrl); await page.reload(); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}phone-obsidian-match.jpg`, fullPage: true, type: 'jpeg', quality: 85 });
if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push('phone match: HORIZONTAL OVERFLOW');

// Finish the game (resign) so the analysis screen (eval graph, grades) and the Passport rating chart have data.
if (!quick) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(matchUrl); await page.reload();
  await page.locator('button', { hasText: 'Resign' }).click();
  await page.locator('button', { hasText: 'Yes, resign' }).click();
  await page.waitForTimeout(1500);
  const gameId = decodeURIComponent(matchUrl.split('#/match/')[1] ?? '');
  for (const theme of THEMES) {
    await setPrefs({ theme, board: 'theme', motion: 'reduce' });
    await page.goto(`${url}#/analysis/${encodeURIComponent(gameId)}/1`);
    await page.reload();
    await page.waitForSelector('[data-testid="analysis-status"]:has-text("complete")', { timeout: 180000 }).catch(() => problems.push(`analysis ${theme}: not complete`));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}desktop-${theme}-analysis.jpg`, fullPage: true, type: 'jpeg', quality: 85 });
    console.log(`desktop-${theme}-analysis.jpg`);
    await page.goto(url + '#/profile'); await page.reload();
    await page.waitForSelector('[data-testid="current-rating"]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}desktop-${theme}-profile-rated.jpg`, fullPage: true, type: 'jpeg', quality: 85 });
    console.log(`desktop-${theme}-profile-rated.jpg`);
  }
}

await ctx.close();
fs.rmSync(PROFILE, { recursive: true, force: true });
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nno problems');
