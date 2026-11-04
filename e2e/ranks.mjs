/**
 * v0.11 Circuit Grades journey (docs/FEUDAL_RANKS.md): founds the default (10,240) federation through the UI, checks
 * the new career is Commoner III, advances past the mid-season checkpoint (round 8), then at desktop and 390 px opens
 * the rank guide (all 48 steps, current position, progress, requirements), the Career Passport (rank and highest rank),
 * a competitor profile with its rank, the competitor list and a league table: ranks shown, no horizontal overflow, page
 * scroll reaches the bottom, no errors. The three featured engine games per round are given stub results through the
 * service's own runner hook (the journey is about ranks, and engine games at this size take minutes); every other
 * result is the federation's normal simulation.
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4442 & node e2e/ranks.mjs http://127.0.0.1:4442/
 */
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] ?? 'http://127.0.0.1:4442/';
const SHOTS = new URL('../docs/screenshots/v0.11/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
let failed = 0;
const check = (id, ok, m) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const profile = mkdtempSync(join(tmpdir(), 'crown-ranks-'));
const ctx = await chromium.launchPersistentContext(profile, { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(url + '#/world');
await page.waitForFunction(() => window.__crown);
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForFunction(() => window.__crown.fed.ready, null, { timeout: 180000 });
const start = await page.evaluate(() => {
  const st = window.__crown.fed.state;
  const comps = [...st.competitors.values()];
  return { n: comps.length, ranked: comps.filter(c => Array.isArray(c.rank)).length, player: st.world.player.rank };
});
check(1, start.n >= 10240 && start.ranked === start.n && start.player?.step === 0 && start.player?.origin === 'new', `Founded ${start.n.toLocaleString('en')} competitors, ${start.ranked.toLocaleString('en')} with a Circuit Grade; new career at step ${start.player?.step} (Commoner III)`);

const adv = await page.evaluate(async () => {
  const f = window.__crown.fed;
  f.runSelfplay = async req => ({ moves: [], result: ['1-0', '0-1', '1/2-1/2'][req.seed % 3], termination: 'checkmate' });
  const t0 = performance.now(); const ms = [];
  while (f.state.world.round <= 8) {
    for (const x of f.playerFixtures()) await f.forfeit(x.id);
    const a = performance.now(); await f.advanceRound(); ms.push(Math.round(performance.now() - a));
    for (const c of (f.state.extra.ceremonies ?? []).filter(x => !x.seen)) await f.markCeremonySeen(c.id);
  }
  const comps = [...f.state.competitors.values()].filter(c => c.status === 'active');
  return { round: f.state.world.round, ms, total: Math.round(performance.now() - t0), moved: comps.filter(c => c.rank[4] >= 0).length, steps: new Set(comps.map(c => c.rank[0])).size, player: f.state.world.player.rank };
});
check(2, adv.round === 9 && adv.moved > 9000 && adv.steps === 48, `Past the mid-season checkpoint: ${adv.moved.toLocaleString('en')} competitors scored at round 8, all 48 steps held; round times ${adv.ms.join(', ')} ms (round 8 includes the checkpoint)`);
check(3, adv.player.step === 0 && adv.player.last?.round === 8, `A career that forfeits every game stays Commoner III (score ${adv.player.last?.score})`);

const layout = () => page.evaluate(async () => {
  const overflow = document.documentElement.scrollWidth - window.innerWidth;
  window.scrollTo(0, document.documentElement.scrollHeight); await new Promise(r => setTimeout(r, 250));
  const bottom = Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 2;
  const y = window.scrollY; window.scrollTo(0, 0);
  return { overflow, bottom, y, boundary: !!document.querySelector('[data-testid="screen-error"]') };
});
const pick = await page.evaluate(() => {
  const st = window.__crown.fed.state;
  const c = [...st.competitors.values()].filter(x => x.status === 'active' && x.division === 1).sort((a, b) => b.rank[0] - a.rank[0])[0];
  return { id: c.id, name: c.name, step: c.rank[0], hi: c.rank[2] };
});
for (const [w, h] of [[1366, 900], [390, 844]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url + '#/ranks'); await page.waitForSelector('[data-testid="rank-guide"]');
  const g = await page.evaluate(() => ({
    steps: document.querySelectorAll('[data-testid^="rank-step-"]').length,
    current: document.querySelector('[data-testid="rank-current-label"]')?.textContent,
    you: document.querySelector('.rank-step.current')?.getAttribute('data-testid'),
    progress: !!document.querySelector('[data-testid="rank-progress"][role="progressbar"]'),
    req: document.querySelector('[data-testid="rank-requirements"]')?.textContent ?? '',
    highest: document.querySelector('[data-testid="rank-highest"]')?.textContent ?? '',
    svgs: [...document.querySelectorAll('[data-testid="rank-ladder"] svg[role="img"]')].filter(s => s.getAttribute('aria-label')?.includes('Circuit Grade')).length,
  }));
  const l = await layout();
  await page.screenshot({ path: `${SHOTS}ranks-guide-${w}.png`, fullPage: w < 400 ? false : true });
  if (w > 400) await page.locator('[data-testid="rank-ladder"]').screenshot({ path: `${SHOTS}ranks-ladder.png` });
  check(`4-${w}`, g.steps === 48 && g.svgs === 48 && g.current === 'Commoner III' && g.you === 'rank-step-0' && g.progress && /Next attainable rank: Commoner II/.test(g.req) && /Squire III/.test(g.req) && /Highest ever: Commoner III/.test(g.highest), `Rank guide at ${w} px: 48 steps with labelled insignia, current ${g.current}, progress bar, next rank and promotion route shown`);
  check(`5-${w}`, l.overflow <= 0 && l.bottom && !l.boundary, `Rank guide at ${w} px: overflow ${l.overflow}, scrolled to the bottom (y ${l.y})`);

  await page.goto(url + '#/profile'); await page.waitForSelector('[data-testid="career-rank"]');
  const p = await page.locator('[data-testid="career-rank"]').innerText();
  const lp = await layout();
  check(`6-${w}`, /Commoner III/.test(p) && /Highest ever: Commoner III/.test(p) && lp.overflow <= 0 && lp.bottom, `Career Passport at ${w} px shows the rank and highest rank ("${p.replace(/\s+/g, ' ').slice(0, 80)}…"); overflow ${lp.overflow}`);

  await page.goto(url + `#/competitor/${pick.id}`); await page.waitForSelector('[data-testid="competitor-rank"]');
  const c = await page.locator('[data-testid="competitor-rank"]').innerText();
  const expect = await page.evaluate(s => document.querySelector('[data-testid="competitor-rank"] [data-rank]')?.getAttribute('data-rank') + ' ' + document.querySelector('[data-testid="competitor-rank"] [data-rank]')?.getAttribute('data-sublevel'), pick.step);
  const lc = await layout();
  await page.screenshot({ path: `${SHOTS}ranks-competitor-${w}.png` });
  const gradeId = `cg-${String(Math.floor(pick.step / 3) + 1).padStart(2, '0')}`;
  check(`7-${w}`, expect === `${gradeId} ${['III', 'II', 'I'][pick.step % 3]}` && /Circuit Grade/i.test(c) && lc.overflow <= 0 && lc.bottom, `Competitor profile at ${w} px: ${pick.name} shows ${c.split('\n')[0]} (${expect}); overflow ${lc.overflow}`);

  await page.goto(url + '#/competitors'); await page.waitForSelector('[data-testid="competitor-row-rank"]');
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="competitor-row-rank"]')].filter(r => r.querySelector('[data-rank]')).length);
  const ll = await layout();
  check(`8-${w}`, rows === 100 && ll.overflow <= 0, `Competitor list at ${w} px: ${rows} rows with a rank insignia; overflow ${ll.overflow}`);

  await page.goto(url + '#/standings'); await page.waitForSelector('table');
  const st = await page.evaluate(() => document.querySelectorAll('table [data-rank]').length);
  const ls = await layout();
  check(`9-${w}`, st >= 16 && ls.overflow <= 0, `League standings at ${w} px: ${st} rows with a rank insignia; overflow ${ls.overflow}`);
}
check(10, errors.length === 0, `No page or console errors (${errors.length})${errors.length ? ': ' + errors.join(' | ') : ''}`);
await ctx.close();
rmSync(profile, { recursive: true, force: true });
console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
