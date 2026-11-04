/**
 * v0.11 package K journey — one shared Federation, through the real UI: found a (Standard) federation → the
 * Federation screen shows the deadline rule, upcoming matches and "what you need" → enter the Challenger Open from
 * the qualification panel → play the round-1 league fixture (resigned, a real rated game) → standings show the result
 * → postpone the round-2 game, advance, see it listed as postponed → reload: everything persisted → advance to
 * round 17 (forfeits confirmed through the service, as the "Advance Without Playing" button does) → Tournaments shows
 * the Zonal / Regional Cup bracket with decided matches → Dashboard "Your Season" → 390 px without overflow.
 *   node scripts/serve.mjs --dir dist --port 4434 &  node e2e/federation-career.mjs http://127.0.0.1:4434/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4434/';
const SHOTS = new URL('../docs/screenshots/v0.11.0/', import.meta.url).pathname;
const ART = new URL('./artifacts/federation-career/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const errors = [];
const watch = p => { p.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); }); p.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error ' + m.text()); } }); };
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const nav = (page, name) => page.locator('nav.rail').getByRole('button', { name, exact: true }).click();

const ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 } });
let page = ctx.pages()[0] ?? await ctx.newPage();
watch(page);
await page.addInitScript(() => { try { localStorage.setItem('crown.display.v1', JSON.stringify({ ...(JSON.parse(localStorage.getItem('crown.display.v1') || '{}')), motion: 'reduce' })); } catch { /* ignore */ } });
await page.goto(url + '#/world'); await page.waitForFunction(() => window.__crown);
// 1. found a Standard federation (2,048: quickest rounds)
await page.getByLabel('Federation Size').selectOption({ index: 0 });
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="advance-round"]', { timeout: 60000 });
const s1 = await page.evaluate(() => ({ rules: window.__crown.fed.state.world.rules, rule: document.querySelector('[data-testid="deadline-rule"]')?.textContent ?? '', upcoming: document.querySelectorAll('[data-testid="career-match"]').length, opp: [...document.querySelectorAll('[data-testid="career-opportunity"]')].map(e => `${e.getAttribute('data-id')}:${e.getAttribute('data-status')}`), cal: document.querySelector('[data-testid="season-calendar"]')?.textContent ?? '' }));
step('founded: ' + JSON.stringify({ ...s1, rule: s1.rule.slice(0, 80), cal: s1.cal.slice(0, 60) }));
check(1, s1.rules === 3 && /Nothing is ever played for you/.test(s1.rule) && s1.upcoming >= 3 && s1.opp.includes('challenger:open') && s1.opp.some(o => o.startsWith('promotion:')) && /Zonal Championships/.test(s1.cal),
  'Federation screen: crown-competition-3, deadline rule shown before it applies, upcoming matches, qualification opportunities, calendar lists Zonal Championships and Regional Cups');
await page.screenshot({ path: SHOTS + 'career-world-desktop.png', fullPage: true });

// 2. enter the Challenger Open from the opportunities panel
await page.locator('[data-testid="career-register-challenger"]').first().click();
await page.waitForFunction(() => window.__crown.fed.state.plan.swiss.find(s => s.event === 'challenger').entrants.includes('player'));
const entered = await page.evaluate(() => document.querySelector('[data-testid="career-opportunity"][data-id="challenger"]')?.getAttribute('data-status'));
check(2, entered === 'entered', `Registered for the Challenger Open (opportunity status "${entered}")`);

// 3. play the round-1 fixture (a real rated game, resigned) and see the standings update
const blocked = await page.locator('[data-testid="advance-round"]').isDisabled();
await page.locator('[data-testid="play-fixture"]').first().click();
await page.waitForSelector('[data-testid="match"]');
await page.getByRole('button', { name: /Resign/ }).click();
await page.getByRole('button', { name: 'Yes, resign' }).click();
await page.waitForSelector('.result-overlay');
await page.waitForFunction(() => window.__crown.fed.roundFixtures().length === 0, null, { timeout: 30000 });
await page.locator('[data-testid="back-to-federation"]').click();
await page.waitForSelector('[data-testid="advance-round"]');
const afterGame = await page.evaluate(() => { const row = [...document.querySelectorAll('table tr')].find(tr => /You/.test(tr.textContent ?? '') && tr.querySelectorAll('td').length >= 5); return { played: row ? row.querySelectorAll('td')[3]?.textContent : null, enabled: !document.querySelector('[data-testid="advance-round"]').disabled }; });
check(3, blocked && afterGame.played === '1' && afterGame.enabled, `Advance was disabled while the game was unplayed; after the game your league row shows P=${afterGame.played} and Advance is enabled`);
await page.locator('[data-testid="advance-round"]').click();
await page.waitForFunction(() => window.__crown.fed.state.world.round === 2, null, { timeout: 600000 });

// 4. postpone the round-2 league game; the world advances; the game stays listed with its deadline
const leaguePlay = page.locator('[data-testid="postpone-fixture"]');
check(4, (await leaguePlay.count()) >= 1, 'Postpone offered for the league game');
await leaguePlay.first().click();
await page.waitForFunction(() => window.__crown.fed.postponedFixtures().length === 1);
// round 2 may still hold no other game of yours (Swiss starts in round 4)
const canAdvance = await page.evaluate(() => window.__crown.fed.blockingFixtures().length === 0);
await page.locator('[data-testid="advance-round"]').click();
await page.waitForFunction(() => window.__crown.fed.state.world.round === 3, null, { timeout: 600000 });
const post = await page.evaluate(() => ({ chip: document.querySelectorAll('[data-testid="postponed-chip"]').length, upcoming: [...document.querySelectorAll('[data-testid="career-match"]')].map(e => e.getAttribute('data-status')) }));
check(5, canAdvance && post.chip === 1 && post.upcoming.includes('postponed'), `After postponing, round 2 advanced; the game is listed as postponed (chip ${post.chip}, upcoming ${post.upcoming.join(',')})`);
await page.screenshot({ path: SHOTS + 'career-postponed-desktop.png', fullPage: true });

// 5. reload: persisted
await page.reload(); await page.waitForFunction(() => window.__crown?.fed?.state);
const re = await page.evaluate(() => ({ round: window.__crown.fed.state.world.round, postponed: window.__crown.fed.postponedFixtures().length, entered: window.__crown.fed.state.plan.swiss.find(s => s.event === 'challenger').entrants.includes('player') }));
check(6, re.round === 3 && re.postponed === 1 && re.entered, `Reload keeps round ${re.round}, the postponed game and the Challenger entry`);

// 6. advance to round 17 (the player's games forfeited with consent, exactly what "Forfeit and Advance" does)
const t0 = Date.now();
await page.evaluate(async () => { const f = window.__crown.fed; while (f.state.world.round < 17) await f.forfeitAndAdvance(); }).catch(e => step('advance error ' + e));
const st17 = await page.evaluate(() => { const f = window.__crown.fed; const p = f.state.plan; return { round: f.state.world.round, cups: (p.cups ?? []).length, decided: (p.cups ?? []).flatMap(k => k.stages[0].matches).filter(m => m.winner).length, forfeits: f.seasonRounds().flatMap(r => r.fixtures).filter(x => x.forfeit).length }; });
step(`advanced to round ${st17.round} in ${Math.round((Date.now() - t0) / 1000)} s`);
check(7, st17.round === 17 && st17.cups === 24 && st17.decided >= 64, `Round 17: ${st17.cups} Zonal Championships and Regional Cups, ${st17.decided} first-stage matches decided; ${st17.forfeits} forfeits recorded (only after consent)`);

// 7. Tournaments: bracket
await page.goto(url + '#/tournaments'); await page.waitForSelector('[data-testid="cups"]');
const br = await page.evaluate(() => ({ matches: document.querySelectorAll('[data-testid="bracket-cup"] [data-testid="bracket-match"]').length, champ: document.querySelectorAll('[data-testid="championship"]').length }));
check(8, br.matches >= 8 && br.champ === 1, `Tournaments: the cup bracket shows ${br.matches} matches; Crown Championship panel present`);
await page.screenshot({ path: SHOTS + 'career-bracket-desktop.png', fullPage: true });

// 8. Dashboard: Your Season
await page.goto(url + '#/'); await page.waitForSelector('[data-testid="dash-season"]');
const dash = await page.evaluate(() => ({ opp: document.querySelectorAll('[data-testid="dash-season"] [data-testid="career-opportunity"]').length, standing: document.querySelector('[data-testid="career-standing"]')?.textContent ?? '' }));
check(9, dash.opp >= 2 && /of 16/.test(dash.standing), `Dashboard "Your Season": ${dash.opp} opportunities; standing "${dash.standing.slice(0, 60)}"`);

// 9. phone width
await page.setViewportSize({ width: 390, height: 844 });
const widths = {};
for (const h of ['#/', '#/world', '#/tournaments', '#/rivals']) { await page.goto(url + h); await page.waitForTimeout(700); widths[h] = await overflow(page); }
await page.goto(url + '#/tournaments'); await page.waitForTimeout(500);
await page.screenshot({ path: SHOTS + 'career-bracket-390.png', fullPage: true });
check(10, Object.values(widths).every(v => v <= 1), `390 px: no horizontal overflow ${JSON.stringify(widths)}`);
check(11, errors.length === 0, `no page errors (${errors.length})`);
writeFileSync(ART + 'log.txt', log.join('\n'));
await ctx.close();
console.log(failed ? `FAILED ${failed}` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
