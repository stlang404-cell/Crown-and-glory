/**
 * v0.8 piece animation + sound journey, through the real UI:
 *  Settings → Sound and Piece Movement persist across reload; a played game slides pieces (Web Animations on
 *  the moved piece), plays one move sound per move after the first tap unlocks audio, never shows more or fewer
 *  pieces than the position; Analysis replay autoplay animates and sounds each step; rapid keyboard scrubbing
 *  skips animation and sound and ends on the right position; stepping back is silent; reduced motion turns
 *  slides off; muting silences everything. Records a short video of play + replay.
 *   node scripts/serve.mjs --dir dist --port 4394 &  node e2e/motion-sound.mjs http://127.0.0.1:4394/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4394/';
const SHOTS = new URL('../docs/screenshots/v0.8.0/', import.meta.url).pathname;
const ART = new URL('./artifacts/motion-sound/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const PROFILE = ART + 'profile';
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };

let ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1280, height: 860 }, recordVideo: { dir: ART + 'video', size: { width: 1280, height: 860 } } });
let page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
const watch = p => p.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + String(e).slice(0, 300)); });
watch(page);
// instrument: record every Web Animation started on a board piece, and sample piece counts vs the FEN on every frame
const instrument = () => {
  window.__motion = { slides: 0, ghosts: 0, maxExtra: 0, minMissing: 0, samples: 0 };
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (k, o) {
    if (this.classList?.contains('piece') && Array.isArray(k) && k[0] && 'transform' in k[0] && String(k[0].transform).startsWith('translate')) window.__motion.slides++;
    return orig.call(this, k, o);
  };
  const tick = () => {
    const m = document.querySelector('[data-testid="match"]');
    const fen = m?.getAttribute('data-fen');
    if (fen) {
      const want = fen.split(' ')[0].replace(/[\d/]/g, '').length;
      const have = m.querySelectorAll('.board .piece:not(.capture-ghost)').length;
      window.__motion.samples++;
      window.__motion.maxExtra = Math.max(window.__motion.maxExtra, have - want);
      window.__motion.minMissing = Math.max(window.__motion.minMissing, want - have);
    }
    if (document.querySelector('.capture-ghost')) window.__motion.ghosts++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
await page.addInitScript(instrument);
await page.goto(url);
const sounds = () => page.evaluate(() => (window.__crownSound?.soundLog ?? []).map(x => x.id));
const motion = () => page.evaluate(() => window.__motion);

// 1. settings persist
await page.goto(url + '#/settings');
await page.waitForSelector('[data-testid="sound-settings"]');
await page.locator('[data-testid="sound-volume"]').fill('40');
await page.locator('[data-testid="sound-cat-ceremonies"]').uncheck();
await page.locator('[data-testid="piece-speed"]').getByRole('button', { name: 'Slow' }).click();
await page.screenshot({ path: SHOTS + 'settings-sound-motion.png', fullPage: true });
await page.reload();
await page.waitForSelector('[data-testid="sound-settings"]');
const vol = await page.locator('[data-testid="sound-volume"]').inputValue();
const cer = await page.locator('[data-testid="sound-cat-ceremonies"]').isChecked();
const slow = await page.locator('[data-testid="piece-speed"]').getByRole('button', { name: 'Slow' }).getAttribute('aria-pressed');
check(1, vol === '40' && !cer && slow === 'true', `Sound volume ${vol}%, ceremonies ${cer ? 'on' : 'off'}, piece speed Slow pressed=${slow} after reload`);
await page.locator('[data-testid="piece-speed"]').getByRole('button', { name: 'Normal' }).click();

// 2. play a game: slides, sounds, no duplicated/missing pieces
await page.goto(url + '#/play');
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const s0 = (await sounds()).length;
let myMoves = 0;
for (let i = 0; i < 10; i++) {
  await page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 30000 });
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') === 'over') break;
  const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
  const sqs = await page.$$eval('[data-testid="match"] [data-square]', els => els.map(e => e.getAttribute('data-square')));
  let moved = false;
  for (const s of [...sqs.slice((i * 7) % 36), ...sqs.slice(0, (i * 7) % 36)]) {
    await page.click(`[data-square="${s}"]`);
    const hs = await page.$$eval('[data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square')));
    if (hs.length) {
      const capture = await page.$$eval('[data-square]', els => els.filter(e => e.querySelector('.ring')).map(e => e.getAttribute('data-square')));
      await page.click(`[data-square="${capture[0] ?? hs[hs.length - 1]}"]`); moved = true; break;
    }
  }
  if (!moved) break;
  const promo = page.getByRole('button', { name: /Promote to queen/ });
  if (await promo.isVisible().catch(() => false)) await promo.click();
  myMoves++;
  await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 15000 }).catch(() => {});
  if (i === 2) { await page.waitForTimeout(60); await page.screenshot({ path: SHOTS + 'motion-last-move-highlight.png' }); }
}
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') !== 'engine', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(500);
const m1 = await motion();
const plyCount2 = await page.evaluate(async () => (await window.__crown.db.unfinishedGames())[0]?.moves.length ?? 0);
const sPlay = (await sounds()).slice(s0);
const unlocked = await page.evaluate(() => window.__crownSound?.audioUnlocked());
const plies = await page.evaluate(() => (document.querySelector('[data-testid="match"]').getAttribute('data-fen') ? 0 : 0));
check(2, m1.slides >= plyCount2 - 1 && m1.maxExtra === 0 && m1.minMissing === 0 && m1.samples > 50,
  `${plyCount2} plies (${myMoves} by the player): ${m1.slides} slides, ${m1.ghosts} capture-ghost frames; over ${m1.samples} frames never an extra (${m1.maxExtra}) or missing (${m1.minMissing}) piece`);
const moveSounds = sPlay.filter(x => ['move', 'capture', 'check', 'promotion'].includes(x));
const plyCount = await page.evaluate(async () => (await window.__crown.db.unfinishedGames())[0]?.moves.length ?? 0);
check(3, unlocked === true && moveSounds.length >= plyCount - 1 && moveSounds.length <= plyCount,
  `Audio unlocked by the first tap (${unlocked}); ${moveSounds.length} move sounds for ${plyCount} plies (player and engine): ${JSON.stringify(sPlay)}`);
void plies;

// 3. resign → one result sound
await page.getByRole('button', { name: /Resign/ }).first().click();
await page.getByRole('button', { name: 'Yes, Resign' }).click();
await page.waitForSelector('.result-overlay');
await page.waitForTimeout(300);
const sRes = (await sounds()).slice(s0 + sPlay.length);
check(4, sRes.filter(x => x === 'defeat').length === 1, `Resigning plays one result sound: ${JSON.stringify(sRes)}`);

// 4. analysis replay: autoplay animates and sounds each step; scrubbing is instant and silent; stepping back silent
await page.getByRole('button', { name: /View Analysis/i }).click();
await page.waitForSelector('[data-testid="replay-play"]');
const before = await motion(); const sb = (await sounds()).length;
await page.getByRole('button', { name: 'Fast' }).click();
await page.locator('[data-testid="replay-play"]').click();
await page.waitForTimeout(2400);
await page.locator('[data-testid="replay-play"]').click();
const after = await motion(); const sa = await sounds();
const ind = await page.locator('[data-testid="ply-indicator"]').textContent();
const steps = +(/ply (\d+)/.exec(ind)?.[1] ?? 0);
check(5, after.slides - before.slides >= steps - 1 && sa.length - sb >= steps - 1 && sa.length - sb <= steps + 1,
  `Replay autoplay to ${ind}: ${after.slides - before.slides} slides and ${sa.length - sb} sounds`);
await page.locator('main .mc-mv[data-ply="1"]').click();
await page.keyboard.press('Home');
await page.waitForTimeout(400);
const b2 = await motion(); const sb2 = (await sounds()).length;
// 9 ArrowRight presses at keyboard auto-repeat spacing (~33 ms), dispatched inside the page so test overhead does not stretch them
await page.evaluate(() => new Promise(res => {
  const target = document.activeElement ?? document.body; let n = 0;
  const id = setInterval(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); if (++n === 9) { clearInterval(id); res(); } }, 33);
}));
await page.waitForTimeout(500);
const a2 = await motion(); const sa2 = (await sounds()).length;
const ind2 = await page.locator('[data-testid="ply-indicator"]').textContent();
const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.classList?.contains('piece')).length);
const boardPieces = await page.evaluate(() => document.querySelectorAll('main .board .piece:not(.capture-ghost)').length);
check(6, a2.slides - b2.slides <= 2 && sa2 - sb2 <= 2 && /ply 9\//.test(ind2) && running === 0,
  `Rapid scrubbing (9 key presses 33 ms apart) ended on ${ind2} with ${a2.slides - b2.slides} slide(s), ${sa2 - sb2} sound(s), ${running} animations still running, ${boardPieces} pieces drawn`);
await page.waitForTimeout(400);
const sb3 = (await sounds()).length; const b3 = await motion();
await page.evaluate(() => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
await page.waitForTimeout(500);
const sa3 = (await sounds()).length; const a3 = await motion();
check(7, sa3 === sb3 && a3.slides - b3.slides === 1, `Stepping back slides the piece home (${a3.slides - b3.slides}) silently (${sa3 - sb3} sounds)`);

// 5. mute
await page.goto(url + '#/settings');
await page.locator('[data-testid="sound-enabled"]').uncheck();
await page.goto(url + '#/analysis');
await page.locator('[data-testid="analysis-pick-row"]').first().getByRole('button', { name: 'Open' }).click();
await page.waitForSelector('[data-testid="replay-play"]');
const sm = (await sounds()).length;
await page.keyboard.press('Home'); await page.waitForTimeout(300);
for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450); }
check(8, (await sounds()).length === sm, 'With sound turned off, replay steps are silent');
await ctx.close();

// 6. reduced motion
ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
page = ctx.pages()[0] ?? await ctx.newPage(); watch(page);
await page.addInitScript(instrument);
await page.goto(url + '#/analysis');
await page.locator('[data-testid="analysis-pick-row"]').first().getByRole('button', { name: 'Open' }).click();
await page.waitForSelector('[data-testid="replay-play"]');
const r0 = await motion();
await page.keyboard.press('Home'); await page.waitForTimeout(300);
for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450); }
const r1 = await motion();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(9, r1.slides - r0.slides === 0 && overflow <= 0, `Reduced motion: ${r1.slides - r0.slides} slides over 3 steps; phone overflow ${overflow}px`);
check(10, errors.length === 0, `No page errors (${errors.length})`);
await ctx.close();
const vids = readdirSync(ART + 'video').filter(f => f.endsWith('.webm'));
if (vids[0]) { renameSync(ART + 'video/' + vids[0], ART + 'play-and-replay.webm'); step('video: ' + ART + 'play-and-replay.webm'); }
writeFileSync(ART + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
