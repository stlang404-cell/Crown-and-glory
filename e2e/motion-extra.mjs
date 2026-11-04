/**
 * v0.8 motion/sound supplement, through the real UI:
 *  A. Promotion with check in real play: a casual game is started from the Play screen, its saved start position is
 *     replaced (test setup only) by "5k/P5/6/6/6/K5 w", then the player clicks a5→a6 and chooses a queen. Checks the
 *     slide, the promotion glint, the promoted piece, the check warning on the black king and the single
 *     "promotion" sound (promotion outranks check), then the engine's reply.
 *  B. Spectating a live Arena game: each published move slides on the arena board with one move sound, the board
 *     never shows an extra or missing piece, and grades stay hidden while trading is open.
 *   node scripts/serve.mjs --dir dist --port 4396 &  node e2e/motion-extra.mjs http://127.0.0.1:4396/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4396/';
const SHOTS = new URL('../docs/screenshots/v0.8.0/', import.meta.url).pathname;
const ART = new URL('./artifacts/motion-extra/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + String(e).slice(0, 300)); });
await page.addInitScript(() => {
  window.__motion = { slides: [], glints: 0, extra: 0, missing: 0, samples: 0 };
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (k, o) {
    if (this.classList?.contains('piece') && Array.isArray(k) && k[0]) {
      if (String(k[0].transform ?? '').startsWith('translate')) window.__motion.slides.push(this.closest('[data-square]')?.getAttribute('data-square'));
      if ('filter' in k[0] && String(k[1]?.filter ?? '').includes('drop-shadow')) window.__motion.glints++;
    }
    return orig.call(this, k, o);
  };
  window.__checks = [];
  new MutationObserver(ms => { for (const m of ms) if (m.target.classList?.contains('check') && !String(m.oldValue).includes('check')) window.__checks.push(m.target.getAttribute('data-square')); })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
});
await page.goto(url + '#/play');
await page.waitForFunction(() => window.__crown && window.__crownSound);
const sounds = () => page.evaluate(() => window.__crownSound.soundLog.map(x => x.id));
const motion = () => page.evaluate(() => window.__motion);

// ---------- A. promotion with check ----------
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const gid = await page.evaluate(async () => {
  const g = (await window.__crown.db.unfinishedGames())[0];
  await window.__crown.saveGame({ ...g, initialFen: '5k/P5/6/6/6/K5 w - - 0 1', moves: [] });
  return g.id;
});
await page.goto(url + '#/play'); await page.goto(url + '#/match/' + encodeURIComponent(gid));
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen')?.startsWith('5k/P5/'), null, { timeout: 15000 });
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 15000 });
const s0 = (await sounds()).length;
await page.click('[data-square="a5"]');
await page.click('[data-square="a6"]');
await page.getByRole('button', { name: /Promote to queen/ }).click();
await page.waitForTimeout(250);
const afterPromo = await page.evaluate(() => ({
  a6: document.querySelector('[data-square="a6"]')?.getAttribute('aria-label'),
  check: document.querySelector('.sq.check')?.getAttribute('data-square'),
}));
const m1 = await motion();
const sP = (await sounds()).slice(s0);
check('A1', /white queen/.test(afterPromo.a6 ?? '') && m1.slides.includes('a6') && m1.glints >= 1,
  `Promotion a5→a6=Q slid (${JSON.stringify(m1.slides)}), glinted (${m1.glints}), a6 now "${afterPromo.a6}"`);
check('A2', sP[0] === 'promotion' && sP.filter(x => x === 'promotion').length === 1,
  `One promotion sound for the promoting move (promotion outranks check): ${JSON.stringify(sP)}`);
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') !== 'engine', null, { timeout: 30000 });
await page.waitForTimeout(500);
const m2 = await motion(); const sR = (await sounds()).slice(s0);
const seen = await page.evaluate(() => window.__checks);
await page.locator('[data-testid="match"] .mc-mv[data-ply="1"]').click();
await page.waitForTimeout(300);
const histCheck = await page.evaluate(() => document.querySelector('[data-testid="match"] .sq.check')?.getAttribute('data-square'));
await page.screenshot({ path: SHOTS + 'promotion-check-in-play.png' });
check('A3', seen.includes('f6') && histCheck === 'f6',
  `Check warning shown on f6 when the promotion gave check (${JSON.stringify(seen)}; the engine escaped within one frame) and while viewing that move again (${histCheck})`);
check('A4', m2.slides.length >= 2 && sR.length >= 2, `Engine reply slid (${m2.slides.length} slides) and sounded: ${JSON.stringify(sR)}`);

// ---------- B. spectating a live Arena game ----------
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
const fx = await page.evaluate(() => { const f = window.__crown.fed; const x = f.featuredFixtures().find(y => y.result === null && f.marketFor(y.id)?.status === 'open'); return x?.id; });
await page.goto(url + '#/watch/' + encodeURIComponent(fx));
await page.waitForSelector('[data-testid="arena"]');
await page.locator('[data-testid="start-inplay"]').click();
await page.waitForSelector('[data-testid="inplay"]');
const b0 = await motion(); const sb = (await sounds()).length;
let maxExtra = 0, maxMissing = 0, published = 0;
for (let i = 0; i < 6; i++) {
  const before = await page.evaluate(id => window.__crown.fed.liveGame(id).moves.length, fx);
  await page.locator('[data-testid="next-move"]').click();
  await page.waitForFunction(([id, n]) => window.__crown.fed.liveGame(id).moves.length > n, [fx, before], { timeout: 120000 });
  await page.waitForTimeout(450);
  const c = await page.evaluate(id => {
    const g = window.__crown.fed.liveGame(id); const fen = g.moves.at(-1).fen;
    const want = fen.split(' ')[0].replace(/[\d/]/g, '').length;
    const have = document.querySelectorAll('[data-testid="arena"] .board .piece:not(.capture-ghost)').length;
    return { want, have, n: g.moves.length };
  }, fx);
  published = c.n; maxExtra = Math.max(maxExtra, c.have - c.want); maxMissing = Math.max(maxMissing, c.want - c.have);
  if (i === 3) await page.screenshot({ path: SHOTS + 'arena-live-board.png' });
}
const b1 = await motion(); const sa = (await sounds()).slice(sb);
const grades = await page.locator('[data-testid="arena-moves"] .grade-icon').count();
check('B1', b1.slides.length - b0.slides.length >= published - 1 && maxExtra === 0 && maxMissing === 0,
  `Spectating: ${published} published moves, ${b1.slides.length - b0.slides.length} slides; extra pieces ${maxExtra}, missing ${maxMissing}`);
check('B2', sa.length >= published - 1 && sa.length <= published, `Spectating: ${sa.length} move sounds for ${published} moves: ${JSON.stringify(sa)}`);
check('B3', grades === 0, `No move grades while trading is open (${grades})`);
check('Z', errors.length === 0, `No page errors (${errors.length})`);
await ctx.close();
writeFileSync(ART + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
