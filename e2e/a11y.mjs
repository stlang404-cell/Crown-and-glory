/**
 * Accessibility audit (v1.0 package V). Runs axe-core (WCAG 2.0/2.1/2.2 A+AA and best-practice rules) plus the
 * game's own checks over every main screen at 1366 px and 390 px, on a populated career (a finished rated game, a
 * founded Federation, one advanced round), then plays a full game with the keyboard only (including a promotion)
 * and checks the screen-reader text and live regions of the board.
 *
 *   node scripts/serve.mjs --dir dist --port 4458 &  node e2e/a11y.mjs http://127.0.0.1:4458/ [label] [--strict]
 *
 * Writes e2e/artifacts/a11y/<label>.json (per screen, per rule, node counts) and log.txt. With --strict the run
 * fails on any serious/critical axe violation or any custom-check failure; without it it only reports (used for
 * the "before" baseline).
 * Custom checks (beyond axe): exactly one visible h1 per screen; no skipped heading levels; a visible focus
 * indicator on every element reached by Tab (first 40 stops); target size >= 24 px for every visible control that
 * is not inline text; no running infinite animation under prefers-reduced-motion; board squares named
 * "<square>, <colour> <piece>"; move announcements in a polite live region, one per move; clocks not live (no spam).
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AXE = require.resolve('axe-core/axe.min.js');
const url = (process.argv[2] ?? 'http://127.0.0.1:4458/').replace(/\/?$/, '/');
const label = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'after';
const strict = process.argv.includes('--strict');
const OUT = new URL('./artifacts/a11y/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };

rmSync(OUT + 'profile-' + label, { recursive: true, force: true }); // a fresh profile every run (a reused one carries an old federation)
const ctx = await chromium.launchPersistentContext(OUT + 'profile-' + label, { viewport: { width: 1366, height: 900 }, reducedMotion: 'no-preference' });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(String(e).slice(0, 300)); step('pageerror: ' + String(e).slice(0, 300)); });
await page.goto(url);
await page.waitForFunction(() => window.__crown);
await page.evaluate(async () => { await window.__crown.db.setMeta('tour:state', { v: 1, dismissed: true, done: {}, seen: {} }); });

// ---------------------------------------------------------------- populate: a rated game, a federation, one round
async function playSomeMovesAndResign(p) {
  for (let i = 0; i < 3; i++) {
    await p.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 30000 });
    if (await p.getAttribute('[data-testid="match"]', 'data-turn') === 'over') return;
    const sqs = await p.$$eval('[data-testid="match"] [data-square]', els => els.map(e => e.getAttribute('data-square')));
    for (const s of sqs) {
      await p.click(`[data-square="${s}"]`);
      const hs = await p.$$eval('[data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square')));
      if (hs.length) { await p.click(`[data-square="${hs[0]}"]`); break; }
    }
    await p.waitForTimeout(300);
  }
  if (await p.getAttribute('[data-testid="match"]', 'data-turn') !== 'over') { await p.getByRole('button', { name: /Resign/ }).first().click(); await p.getByRole('button', { name: 'Yes, Resign' }).click(); }
}
await page.goto(url + '#/play');
await page.getByTestId('opp-beginner-L0a').click().catch(() => page.getByRole('button', { name: /Beginner/ }).first().click());
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true }).click().catch(() => {});
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
await playSomeMovesAndResign(page);
await page.waitForSelector('.result-overlay', { timeout: 20000 });
const gameId = await page.evaluate(async () => (await window.__crown.db.allGames()).find(g => g.status === 'finalized')?.id);
await page.waitForFunction(async () => (await window.__crown.db.allReports()).some(r => r.status === 'complete'), null, { timeout: 180000 }).catch(() => step('analysis did not complete in time'));
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); await f.advanceRound(); });
await page.locator('[data-testid="ceremony-continue"]').click({ timeout: 2000 }).catch(() => {});
const ids = await page.evaluate(() => {
  const f = window.__crown.fed;
  const fx = f.featuredFixtures()[0] ?? f.currentRound()?.fixtures[0];
  const comp = [...f.state.competitors.values()][0];
  const market = [...f.state.markets.values()].find(m => m.status === 'open');
  return { fixture: fx?.id, competitor: comp?.id, market: market?.id };
});
// an unfinished casual game for the match screen
await page.goto(url + '#/play');
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const matchId = decodeURIComponent((await page.evaluate(() => location.hash)).split('/')[2]);
// v1.0 Crownmaster Study Match in progress (all aids on, hint and best move shown)
await page.goto(url + '#/study');
await page.locator('[data-testid="study-opp"][data-beginner]').first().click();
await page.click('[data-testid="study-start"]');
await page.waitForSelector('[data-testid="study-match"]');
const studyId = decodeURIComponent((await page.evaluate(() => location.hash)).split('/')[2]);

const SCREENS = [
  ['dashboard', ''], ['play', 'play'], ['match', `match/${encodeURIComponent(matchId)}`], ['study', 'study'], ['study-match', `study/${encodeURIComponent(studyId)}`], ['federation', 'world'], ['standings', 'standings'], ['tournaments', 'tournaments'],
  ['competitors', 'competitors'], ['competitor', `competitor/${encodeURIComponent(ids.competitor)}`], ['population', 'population'], ['watch', `watch/${encodeURIComponent(ids.fixture)}`],
  ['arena', 'arena'], ['exhibition', 'exhibition'], ['exchange', 'exchange'], ['market', ids.market ? `exchange/${encodeURIComponent(ids.market)}` : 'exchange'], ['finance', 'finance'], ['forecasts', 'forecasts'],
  ['news', 'news'], ['games', 'library'], ['replays', 'replays'], ['analyses', 'analysis'], ['analysis', `analysis/${encodeURIComponent(gameId)}`], ['academy', 'academy'],
  ['grimoire', 'grimoire'], ['career', 'profile'], ['rivals', 'rivals'], ['hall', 'hall'], ['heraldry', 'heraldry'], ['vault', 'vault'], ['ranks', 'ranks'], ['lab', 'lab'], ['settings', 'settings'],
];

async function custom(p) {
  return p.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"], [hidden], .sr-only'); };
    const main = document.querySelector('main');
    const hs = [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis);
    const h1 = hs.filter(h => h.tagName === 'H1').length;
    let skips = []; let prev = 0;
    for (const h of hs) { const l = +h.tagName[1]; if (prev && l > prev + 1) skips.push(`${'h' + prev}→${h.tagName.toLowerCase()} "${h.textContent.trim().slice(0, 40)}"`); prev = l; }
    // target size: controls that are not inline text links
    const small = [];
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary, [role=button], [role=tab], [role=radio], [role=checkbox]')) {
      if (!vis(el) || el.disabled) continue;
      // WCAG 2.5.8 inline exception: a link inside a sentence is constrained by the line height of the text
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length) continue;
      if (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox') && el.closest('label')) { const lr = el.closest('label').getBoundingClientRect(); if (lr.width >= 24 && lr.height >= 24) continue; }
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) small.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    const landmarks = { main: document.querySelectorAll('main').length, nav: [...document.querySelectorAll('nav')].filter(vis).map(n => n.getAttribute('aria-label')) };
    return { h1, skips, small, landmarks };
  });
}

async function focusWalk(p, stops = 40) {
  await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await p.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {});
  const bad = new Set(); let reached = 0;
  for (let i = 0; i < stops; i++) {
    await p.keyboard.press('Tab');
    const r = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none');
      return { ring, d: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"` };
    });
    if (!r) continue;
    reached++;
    if (!r.ring) bad.add(r.d);
  }
  return { reached, bad: [...bad] };
}

async function runAxe(p) {
  await p.addScriptTag({ path: AXE }).catch(() => {});
  return p.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ')) }));
  });
}

const report = { label, url, at: new Date().toISOString(), widths: {} };
async function auditAll(p, width) {
  const rows = [];
  for (const [name, hash] of SCREENS) {
    await p.goto(url + '#/' + hash);
    await p.waitForFunction(() => window.__crown);
    await p.waitForTimeout(1500);
    await p.locator('[data-testid="ceremony-continue"]').click({ timeout: 500 }).catch(() => {});
    const axe = await runAxe(p);
    const c = await custom(p);
    const f = await focusWalk(p);
    const serious = axe.filter(v => v.impact === 'serious' || v.impact === 'critical').reduce((s, v) => s + v.nodes, 0);
    const total = axe.reduce((s, v) => s + v.nodes, 0);
    const customFails = (c.h1 === 1 ? 0 : 1) + c.skips.length + c.small.length + f.bad.length;
    rows.push({ name, axe, total, serious, custom: c, focus: f, customFails });
    step(`  ${width}px ${name}: axe ${axe.length} rules / ${total} nodes (${serious} serious+critical) · h1 ${c.h1} · skips ${c.skips.length} · small targets ${c.small.length} · focus without ring ${f.bad.length}/${f.reached}`);
    for (const v of axe) step(`      axe ${v.impact} ${v.id} ×${v.nodes}: ${v.targets.join(' | ').slice(0, 220)}`);
    if (c.small.length) step(`      small: ${c.small.slice(0, 6).join('; ')}`);
    if (f.bad.length) step(`      no ring: ${f.bad.slice(0, 6).join('; ')}`);
    if (c.skips.length) step(`      heading skips: ${c.skips.slice(0, 4).join('; ')}`);
  }
  return rows;
}

report.widths[1366] = await auditAll(page, 1366);

// ---------------------------------------------------------------- keyboard-only game with a promotion
async function focusBoard(p) {
  const board = p.locator('[data-testid="match"] .board');
  for (let i = 0; i < 120 && !(await board.evaluate(b => b.contains(document.activeElement))); i++) await p.keyboard.press('Tab');
  return board.evaluate(b => b.contains(document.activeElement));
}
/** Walk the board's roving focus to `target` with arrow keys only. */
async function kbWalk(p, target) {
  const flip = await p.evaluate(() => document.querySelector('[data-testid="match"]').getAttribute('data-human') === 'b');
  for (let guard = 0; guard < 20; guard++) {
    const c = await p.evaluate(() => document.activeElement?.getAttribute('data-square'));
    if (!c) return false;
    if (c === target) return true;
    const df = target.charCodeAt(0) - c.charCodeAt(0), dr = +target[1] - +c[1];
    const key = df !== 0 ? ((df > 0) !== flip ? 'ArrowRight' : 'ArrowLeft') : ((dr > 0) !== flip ? 'ArrowUp' : 'ArrowDown');
    await p.keyboard.press(key);
  }
  return false;
}
async function keyboardMove(p, from, to) {
  if (!(await focusBoard(p))) return false;
  if (!(await kbWalk(p, from))) return false;
  await p.keyboard.press('Enter');
  if (!(await kbWalk(p, to))) return false;
  await p.keyboard.press('Enter');
  return true;
}
step('Keyboard-only game');
// Use the real UI to start a casual untimed game from the start position, then play it out with the keyboard only.
await page.goto(url + '#/play');
await page.getByRole('group', { name: 'Time control' }).getByRole('button', { name: 'Untimed' }).click();
await page.getByRole('button', { name: /Start match/i }).focus();
await page.keyboard.press('Enter');
await page.waitForSelector('[data-testid="match"]');
// live-region spam monitor
await page.evaluate(() => {
  window.__liveLog = [];
  const obs = new MutationObserver(ms => { for (const m of ms) { const el = (m.target.nodeType === 3 ? m.target.parentElement : m.target); const lr = el?.closest?.('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]'); if (lr) window.__liveLog.push({ t: Date.now(), text: lr.textContent }); } });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true });
});
let kbMoves = 0, kbOk = true;
for (let i = 0; i < 60; i++) {
  await page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 30000 });
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') === 'over') break;
  // choose a legal move from the board's own labels: select each own piece by keyboard until destinations appear
  const human = await page.getAttribute('[data-testid="match"]', 'data-human');
  const own = await page.$$eval('[data-testid="match"] [data-square]', (els, h) => els.filter(e => (e.getAttribute('aria-label') ?? '').includes(h === 'w' ? 'white' : 'black')).map(e => e.getAttribute('data-square')), human);
  let moved = false;
  for (const from of own.sort(() => Math.random() - 0.5)) {
    if (!(await focusBoard(page)) || !(await kbWalk(page, from))) { kbOk = false; break; }
    await page.keyboard.press('Enter'); // select
    const dests = await page.$$eval('[data-testid="match"] [data-square]', els => els.filter(e => /legal destination/.test(e.getAttribute('aria-label') ?? '')).map(e => e.getAttribute('data-square')));
    if (!dests.length) { await page.keyboard.press('Enter'); continue; } // deselect, try another piece
    if (!(await kbWalk(page, dests[0]))) { kbOk = false; break; }
    await page.keyboard.press('Enter');
    if (await page.locator('.promo').count()) await page.keyboard.press('Enter'); // promotion: first choice (queen)
    moved = true; kbMoves++; break;
  }
  if (!moved) { kbOk = false; break; }
  await page.waitForTimeout(150);
}
// finish the game with the keyboard: Tab to Resign, Enter, then confirm
if (await page.getAttribute('[data-testid="match"]', 'data-turn') !== 'over') {
  await page.getByRole('button', { name: /Resign/ }).first().focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Yes, Resign' }).focus(); await page.keyboard.press('Enter');
}
await page.waitForSelector('.result-overlay', { timeout: 20000 });
const focusInDialog = await page.evaluate(() => !!document.activeElement?.closest('.result-overlay'));
const live = await page.evaluate(() => window.__liveLog);
// one announcement per text change of the move region (consecutive duplicates are one announcement)
const moveTexts = live.filter(x => /Last move/.test(x.text)).map(x => x.text);
const announcements = moveTexts.filter((t, i) => i === 0 || t !== moveTexts[i - 1]).length;
check('kb-game', kbOk && kbMoves >= 5, `A full game is played with the keyboard only (${kbMoves} moves by arrow keys + Enter, ended by keyboard resignation)`);
check('kb-result-focus', focusInDialog, 'The result dialog receives keyboard focus');
check('live-moves', announcements >= kbMoves && announcements <= kbMoves * 2 + 2, `Moves are announced in a polite live region once each (${announcements} announcements for ${kbMoves} player moves plus replies; ${live.length} live mutations)`);

// promotion by keyboard: a casual untimed game from a promotion position (set up through the save layer)
await page.goto(url + '#/play');
await page.getByRole('group', { name: 'Time control' }).getByRole('button', { name: 'Untimed' }).click();
await page.getByRole('group', { name: 'Colour' }).getByRole('button', { name: 'White' }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const promoId = decodeURIComponent((await page.evaluate(() => location.hash)).split('/')[2]);
await page.goto(url + '#/play');
// the only non-UI step: the new, unplayed game is given a promotion position (same record, initial position only)
await page.evaluate(async id => { const s = window.__crown; const g = await s.db.getGame(id); await s.saveGame({ ...g, initialFen: 'k5/pp2P1/6/6/6/5K w - - 0 1' }); }, promoId);
await page.goto(url + '#/match/' + encodeURIComponent(promoId));
await page.waitForSelector('[data-testid="match"]');
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 15000 });
const sqLabel = await page.getAttribute('[data-square="e5"]', 'aria-label');
check('sq-names', /^e5, white pawn/.test(sqLabel ?? ''), `Board squares carry screen-reader names ("${sqLabel}")`);
await keyboardMove(page, 'e5', 'e6');
await page.waitForSelector('.promo', { timeout: 3000 }).catch(() => {});
const promoFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'over', null, { timeout: 15000 }).catch(() => {});
const promoted = await page.evaluate(async id => { const g = await window.__crown.db.getGame(id); return { ccn: g.moves[0]?.ccn, result: g.result, termination: g.termination }; }, promoId);
check('kb-promotion', promoted.ccn === 'e5e6q', `Promotion chosen with the keyboard (focus moved to "${promoFocus}"; move ${promoted.ccn}, ${promoted.termination ?? 'no result'})`);
check('kb-promotion-mate', promoted.result === '1-0', `The keyboard-played promotion ends the game by checkmate (${promoted.result})`);
const clockLive = await page.evaluate(() => [...document.querySelectorAll('.clock')].some(c => c.closest('[aria-live]:not([aria-live="off"])')));
check('clock-quiet', !clockLive, 'Clocks are not inside a live region (role="timer", no per-second announcements)');
await ctx.close();

// ---------------------------------------------------------------- 390 px + reduced motion
const ctx2 = await chromium.launchPersistentContext(OUT + 'profile-' + label, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const p2 = ctx2.pages()[0] ?? await ctx2.newPage();
p2.on('pageerror', e => { errors.push(String(e).slice(0, 300)); step('pageerror (390): ' + String(e).slice(0, 300)); });
await p2.goto(url); await p2.waitForFunction(() => window.__crown);
report.widths[390] = await auditAll(p2, 390);
const motion = [];
for (const [name, hash] of SCREENS.filter(s => ['dashboard', 'match', 'watch', 'federation'].includes(s[0]))) {
  await p2.goto(url + '#/' + hash); await p2.waitForTimeout(1500);
  const n = await p2.evaluate(() => [...document.querySelectorAll('*')].filter(el => { const s = getComputedStyle(el); return s.animationName !== 'none' && s.animationIterationCount === 'infinite' && parseFloat(s.animationDuration) > 0 && s.animationPlayState === 'running'; }).map(el => el.className?.toString?.().slice(0, 40)));
  motion.push({ name, infinite: n });
}
const motionBad = motion.filter(m => m.infinite.length);
check('reduced-motion', motionBad.length === 0, `prefers-reduced-motion: no running infinite animations${motionBad.length ? ': ' + motionBad.map(m => `${m.name} (${m.infinite.join(', ')})`).join('; ') : ''}`);
await ctx2.close();

// ---------------------------------------------------------------- summary
const sum = rows => ({
  screens: rows.length,
  axeNodes: rows.reduce((s, r) => s + r.total, 0),
  axeSerious: rows.reduce((s, r) => s + r.serious, 0),
  axeRules: [...new Set(rows.flatMap(r => r.axe.map(v => v.id)))],
  smallTargets: rows.reduce((s, r) => s + r.custom.small.length, 0),
  focusNoRing: rows.reduce((s, r) => s + r.focus.bad.length, 0),
  headingSkips: rows.reduce((s, r) => s + r.custom.skips.length, 0),
  h1Problems: rows.filter(r => r.custom.h1 !== 1).map(r => `${r.name}(${r.custom.h1})`),
});
report.summary = { 1366: sum(report.widths[1366]), 390: sum(report.widths[390]), motion };
const byRule = {};
for (const w of [1366, 390]) for (const r of report.widths[w]) for (const v of r.axe) { byRule[v.id] ??= { impact: v.impact, help: v.help, 1366: 0, 390: 0 }; byRule[v.id][w] += v.nodes; }
report.byRule = byRule;
for (const w of [1366, 390]) step(`SUMMARY ${w}px: ${JSON.stringify(report.summary[w])}`);
step('BY RULE: ' + JSON.stringify(byRule));
writeFileSync(OUT + label + '.json', JSON.stringify(report, null, 1));
if (strict) {
  for (const w of [1366, 390]) {
    const s = report.summary[w];
    check(`strict-${w}`, s.axeSerious === 0 && s.smallTargets === 0 && s.focusNoRing === 0 && s.headingSkips === 0 && s.h1Problems.length === 0,
      `${w}px: no serious/critical axe violations (${s.axeSerious}), small targets (${s.smallTargets}), focus without ring (${s.focusNoRing}), heading skips (${s.headingSkips}), h1 problems (${s.h1Problems.join(',') || 0})`);
  }
}
check('errors', errors.length === 0, `No page errors (${errors.length})`);
writeFileSync(OUT + label + '-log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
