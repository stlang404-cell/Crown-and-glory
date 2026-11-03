/** Captures M2 screens (desktop + phone) from the profile created by e2e/run.mjs. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const OUT = new URL('../docs/evidence/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/profile', import.meta.url).pathname;
for (const [w, h, tag] of [[1366, 900, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: w, height: h } });
  const p = ctx.pages()[0];
  for (const [route, name, sel] of [['#/play', 'home', 'text=Choose your opponent'], ['#/profile', 'passport', '[data-testid="current-rating"]'], ['#/lab', 'lab', '[data-testid="lab-dimension"]'], ['#/academy', 'academy', '[data-testid="mode-tactics"]'], ['#/library', 'library', '[data-testid="library-row"]'], ['#/federation', 'federation', 'text=Calibration']]) {
    await p.goto(url + route);
    await p.waitForSelector(sel);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}m2-${tag}-${name}.png`, fullPage: tag === 'desktop' });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(tag, name, overflow ? 'HORIZONTAL OVERFLOW' : 'ok');
  }
  await ctx.close();
}
