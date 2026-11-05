/**
 * v0.11 career rating journey (docs/CAREER_RATING.md), through the real UI on a production build:
 * fresh profile → banner, Career Passport and Play show career Elo 0 · provisional → Play suggests the beginners →
 * a rated Classical 60+60 game vs a calibrated beginner, won by a scripted robot (Crown engine in Node, clicking squares) →
 * the rating rises by the Glicko-2 amount and is shown as previous → new → reload keeps it → Settings → Career →
 * Start New Career (backup download + archive, confirmation) → the new career is back at 0 with an empty Federation.
 * Layout checks at desktop and 390 px: no horizontal overflow, page scroll reaches the bottom.
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4438 &  node e2e/new-career.mjs http://127.0.0.1:4438/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { register } from 'tsx/esm/api';
register();
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { Position } = await import('../src/rules/position.ts');
const { moveToCcn } = await import('../src/rules/notation.ts');
const { Searcher } = await import('../src/engine/search.ts');
const { updateRating } = await import('../src/ratings/glicko2.ts');

const url = process.argv[2] ?? 'http://127.0.0.1:4438/';
const ART = new URL('./artifacts/new-career/', import.meta.url).pathname;
const OUT = new URL('../docs/evidence/v0.11/', import.meta.url).pathname;
rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true }); mkdirSync(OUT, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const finish = async ctx => { await ctx?.close().catch(() => {}); writeFileSync(OUT + 'new-career.txt', log.join('\n') + '\n'); step(failed ? `${failed} check(s) FAILED` : 'All checks passed'); process.exit(failed ? 1 : 0); };

const errors = [];
let ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 }, acceptDownloads: true });
let page = ctx.pages()[0] ?? await ctx.newPage();
const watch = p => p.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); });
watch(page);

/**
 * No horizontal overflow, and scrolling to the end really reaches the bottom of the document (gap ≤ 2 px, unchanged).
 * The pages render in stages: saved data, the legacy panels and, on the Career Passport, the Played Like Records, which
 * grow from a one-line placeholder to ~1,000 px at 390 px when the finished game's background analysis completes —
 * on a loaded machine that can land at any moment, including inside the check's 300 ms window, and because that panel
 * is the last element, scroll anchoring cannot compensate (measured: gap 981 px, then 0 px 300 ms later; see
 * docs/evidence/v0.11/bottom-gap.md). So a measurement only counts on a settled layout: network idle, fonts loaded,
 * the same document height in five samples 200 ms apart, and the same height at the scroll and at the measurement;
 * otherwise it is taken again (up to 8 times, then it fails as "never settled").
 */
async function layout(label) {
  await page.waitForLoadState('networkidle').catch(() => {});
  const r = await page.evaluate(async () => {
    const el = document.scrollingElement;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await document.fonts?.ready;
    let res = null;
    for (let attempt = 1; attempt <= 8; attempt++) {
      // wait for a stable document height (5 identical samples, 200 ms apart; at most 12 s)
      let last = -1, same = 0;
      for (let i = 0; i < 60 && same < 4; i++) { const h = el.scrollHeight; same = h === last ? same + 1 : 0; last = h; await sleep(200); }
      el.scrollTo(0, el.scrollHeight);
      const atScroll = el.scrollHeight;
      await sleep(300);
      res = { overflow: el.scrollWidth - window.innerWidth, gap: el.scrollHeight - (el.scrollTop + window.innerHeight), scrolled: el.scrollTop, height: el.scrollHeight, attempt, settled: same >= 4 && atScroll === el.scrollHeight };
      if (res.settled) break;
    }
    el.scrollTo(0, 0);
    return res;
  });
  check(`layout ${label}`, r.settled && r.overflow <= 1 && r.gap <= 2, `${label}: horizontal overflow ${r.overflow}px, bottom gap ${r.gap}px after scrolling ${r.scrolled}px of ${r.height}px${r.settled ? '' : ' — layout never settled'}${r.attempt > 1 ? ` (settled on attempt ${r.attempt})` : ''}`);
}

await page.goto(url); await page.waitForFunction(() => window.__crown);
await page.goto(url + '#/profile');
await page.waitForSelector('[data-testid="current-rating"]');
await page.waitForTimeout(800);
const fresh = await page.evaluate(async () => {
  const s = await window.__crown.db.careerRating();
  return { origin: window.__crown.db.career.origin, rating: s.rating, rd: s.rd, games: s.games,
    shown: document.querySelector('[data-testid="current-rating"]').textContent, status: document.querySelector('[data-testid="current-rating-status"]').textContent,
    banner: document.querySelector('[data-testid="banner-rating"]')?.textContent ?? null, bannerTitle: document.querySelector('[data-testid="banner-title"]')?.textContent ?? null };
});
check(1, fresh.origin === 'new' && fresh.rating === 0 && fresh.rd === 350 && fresh.games === 0, `Fresh profile is a new career: stored r ${fresh.rating}, RD ${fresh.rd}, ${fresh.games} games`);
check(2, fresh.shown === '0' && /Provisional/.test(fresh.status), `Career Passport shows "${fresh.shown}" with "${fresh.status}"`);
check(3, fresh.banner === null || (fresh.banner.replace(/^Career Elo /, '').startsWith('0 ') && /provisional/.test(fresh.banner + (fresh.bannerTitle ?? ''))), `Identity banner: "${fresh.banner}" / "${fresh.bannerTitle}"`);
await page.screenshot({ path: ART + '01-fresh-passport.png' });

// ---- Play: suggestions and a rated game vs a calibrated beginner
await page.goto(url + '#/play');
await page.waitForSelector('[data-testid="beginner-group"]');
await page.waitForTimeout(600);
const play = await page.evaluate(() => ({
  suggested: !!document.querySelector('[data-testid="beginner-suggested"]'),
  pressed: document.querySelector('.opp-card[aria-pressed="true"]')?.textContent ?? '',
}));
check(4, play.suggested && /L0[a-d]/.test(play.pressed), `Play suggests the beginners and preselects one: "${play.pressed.slice(0, 60)}"`);
await page.locator('[data-testid="opp-beginner-L0c"]').click();
await page.locator('[data-testid="tc-classical60"]').click(); // v1.1: rated games are 30+ minutes
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true }).click();
const notice = await page.locator('[data-testid="play-my-rating"]').textContent();
check(5, notice === '0 · provisional', `Match settings show your career Elo "${notice}"`);
await layout('Play desktop');
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const robot = new Searcher(18);
for (let guard = 0; guard < 400; guard++) {
  const turn = await page.getAttribute('[data-testid="match"]', 'data-turn');
  if (turn === 'over') break;
  if (turn !== 'human') { await page.waitForTimeout(120); continue; }
  const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
  const mv = moveToCcn(robot.search(Position.fromFen(fen), { limits: { nodes: 20000 } }).bestMove);
  await page.click(`[data-square="${mv.slice(0, 2)}"]`);
  await page.click(`[data-square="${mv.slice(2, 4)}"]`);
  if (mv.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[mv[4]] }).click();
  await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 30000 }).catch(() => {});
}
await page.waitForSelector('.result-overlay', { timeout: 60000 });
const result = await page.textContent('.result-title');
const change = await page.locator('[data-testid="rating-change"]').textContent();
const ev = await page.evaluate(async () => { const e = (await window.__crown.db.ratingEvents('classical-long')).at(-1); const s = await window.__crown.db.careerRating(); return { e, s }; });
const want = updateRating(ev.e.before, [{ rating: ev.e.opponent.rating, rd: ev.e.opponent.rd, score: ev.e.score }]).after;
check(6, ev.e.before.rating === 0 && ev.e.before.rd === 350 && Math.abs(ev.e.after.rating - want.rating) < 1e-9 && Math.abs(ev.s.rating - want.rating) < 1e-9,
  `${result} vs ${ev.e.opponent.name} (${ev.e.opponent.rating} ±${ev.e.opponent.rd}), score ${ev.e.score}: Glicko-2 0 ±350 → ${want.rating.toFixed(2)} ±${want.rd.toFixed(2)} (stored ${ev.s.rating.toFixed(2)})`);
check(7, ev.e.score === 1 && ev.s.rating > 0 && change.replace(/\s+/g, ' ').includes(`0 → New ${Math.max(0, Math.round(ev.s.rating)).toLocaleString('en-US')}`) && /provisional/.test(change), `Result overlay: "${change}"`);
await page.screenshot({ path: ART + '02-result.png' });

// ---- reload persists
await page.reload(); await page.waitForFunction(() => window.__crown);
await page.goto(url + '#/profile');
await page.waitForSelector('[data-testid="rating-event"]');
const after = await page.evaluate(async () => ({ shown: document.querySelector('[data-testid="current-rating"]').textContent, s: await window.__crown.db.careerRating(), rows: document.querySelectorAll('[data-testid="rating-event"]').length, highest: document.querySelector('[data-testid="highest-so-far"]')?.textContent ?? '' }));
check(8, after.s.rating === ev.s.rating && after.s.games === 1 && after.rows === 1 && after.shown === String(Math.round(ev.s.rating)), `After reload: career Elo ${after.shown}, ${after.s.games} rated game, ${after.rows} history row,${after.highest}`);
await layout('Career Passport desktop');

// ---- phone width
await page.setViewportSize({ width: 390, height: 844 });
for (const [hash, label] of [['#/profile', 'Career Passport'], ['#/play', 'Play'], ['#/settings', 'Settings']]) {
  await page.goto(url + hash); await page.waitForTimeout(1200);
  await layout(`${label} 390 px`);
}
await page.screenshot({ path: ART + '03-settings-390.png', fullPage: true });

// ---- Start New Career
await page.setViewportSize({ width: 1366, height: 900 });
await page.goto(url + '#/settings');
await page.locator('[data-testid="new-career-open"]').click();
check(9, !(await page.locator('[data-testid="new-career-confirm"]').count()), 'No confirm button before the backup has been exported');
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="new-career-backup"]').click()]);
const file = ART + dl.suggestedFilename();
await dl.saveAs(file);
const bundle = JSON.parse(readFileSync(file, 'utf8'));
check(10, bundle.format === 'crown-backup-1' && bundle.counts.ratingEvents === 1 && bundle.payload.career?.ratingStart === 0, `Backup downloaded: ${dl.suggestedFilename()} (${bundle.counts.games} games, ${bundle.counts.ratingEvents} rating event)`);
const doneText = await page.locator('[data-testid="new-career-backup-done"]').textContent();
check(11, await page.locator('[data-testid="new-career-confirm"]').isDisabled(), `Confirm stays disabled until acknowledged ("${doneText.slice(0, 90)}…")`);
await page.locator('[data-testid="new-career-ack"]').check();
await page.locator('[data-testid="new-career-confirm"]').click();
await page.waitForTimeout(2500);
await page.waitForFunction(() => window.__crown);
await page.goto(url + '#/profile'); await page.waitForSelector('[data-testid="current-rating"]'); await page.waitForTimeout(800);
const nc = await page.evaluate(async () => ({ career: window.__crown.db.career, s: await window.__crown.db.careerRating(), games: (await window.__crown.db.allGames()).length, events: (await window.__crown.db.ratingEvents()).length, fed: window.__crown.fed.state ? 'founded' : 'none', shown: document.querySelector('[data-testid="current-rating"]').textContent }));
check(12, nc.career.origin === 'new' && nc.career.previousArchiveId && nc.s.rating === 0 && nc.s.games === 0 && nc.games === 0 && nc.events === 0 && nc.fed === 'none' && nc.shown === '0',
  `New career: ${nc.shown} (stored ${nc.s.rating}, ${nc.s.games} games), ${nc.games} games, ${nc.events} rating events, Federation ${nc.fed}, archive ${nc.career.previousArchiveId}`);
await page.goto(url + '#/settings'); await page.waitForTimeout(800);
check(13, (await page.locator('[data-testid="career-archives"]').count()) === 1, 'Settings lists the archived previous career');
check(14, errors.length === 0, `No page errors (${errors.length})`);
await finish(ctx);
