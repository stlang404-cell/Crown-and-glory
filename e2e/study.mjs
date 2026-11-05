/**
 * Crownmaster Study Match journey, through the real UI, at 375 px, 390 px and desktop (each in a fresh profile):
 * Play → "Study Match" → beginner opponent → start (labelled "Study — unrated", untimed) → request a hint (one square
 * highlighted, text from the engine) → best move with its engine line → toggle the evaluation bar on and off → make
 * moves with move feedback (grade + expected-score loss) → take back → reload and resume (moves, feedback and aid
 * switches kept) → finish (resign) → open the standard Match Analysis (Played Like shown) → ratings, rating events,
 * Played Like records, Vault facts and markets unchanged. Desktop also founds the Federation and starts a study match
 * against a Federation competitor (its own profile + style). Phones: no horizontal overflow. No page errors.
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4482 &   then   node e2e/study.mjs [url]
 *   (Playwright: NODE_PATH=/opt/node22/lib/node_modules if it is not installed locally)
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4482/';
const ART = new URL('./artifacts/study/', import.meta.url).pathname;
rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };

const turn = page => page.getAttribute('[data-testid="study-match"]', 'data-turn');
const waitHuman = page => page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="study-match"]')?.getAttribute('data-turn')), null, { timeout: 60000 });
async function openAids(page) { const t = page.getByRole('tab', { name: 'Study Aids' }); if (await t.count() && await t.isVisible()) await t.click(); }
async function openMoves(page) { const t = page.getByRole('tab', { name: 'Moves' }); if (await t.count() && await t.isVisible()) await t.click(); }

/** One legal move by clicking: a square of ours, then the last highlighted target. */
async function makeMove(page, i) {
  await waitHuman(page);
  if (await turn(page) === 'over') return false;
  const plies = +(await page.getAttribute('[data-testid="study-match"]', 'data-plies'));
  const sqs = await page.$$eval('[data-testid="study-match"] [data-square]', els => els.map(e => e.getAttribute('data-square')));
  const order = [...sqs.slice((i * 7) % sqs.length), ...sqs.slice(0, (i * 7) % sqs.length)];
  for (const s of order) {
    await page.click(`[data-testid="study-match"] [data-square="${s}"]`);
    const hs = await page.$$eval('[data-testid="study-match"] [data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square')));
    if (hs.length) {
      await page.click(`[data-testid="study-match"] [data-square="${hs[hs.length - 1]}"]`);
      const promo = page.getByRole('button', { name: /Promote to queen/ });
      if (await promo.isVisible().catch(() => false)) await promo.click();
      await page.waitForFunction(p => +document.querySelector('[data-testid="study-match"]')?.getAttribute('data-plies') > p, plies, { timeout: 15000 });
      return true;
    }
  }
  return false;
}

async function official(page) {
  return page.evaluate(async () => {
    const s = window.__crown;
    const evs = await s.db.ratingEvents();
    const states = await Promise.all(['blitz', 'rapid', 'classical'].map(p => s.db.ratingState(p)));
    const games = await s.db.allGames();
    await s.vault.evaluate().catch(() => {});
    const f = s.vault.facts;
    return {
      ratingEvents: evs.length, ratings: states.map(p => `${p.pool}:${p.rating.toFixed(3)}/${p.games}`).join(' '),
      plRecords: games.filter(g => (g.playedLike ?? []).length > 0).length,
      vaultGames: f ? f.games.length : null, vaultAnalyses: f ? f.analyses.complete : null,
      markets: s.fed?.state ? [...s.fed.state.markets.keys()].filter(k => k.includes('study-')).length : 0,
      fedPlayer: s.fed?.state ? JSON.stringify(s.fed.state.world.player.stats ?? null) : null,
    };
  });
}

async function journey(name, viewport, opts = {}) {
  const PROFILE = ART + `profile-${name}`;
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport, deviceScaleFactor: 2 });
  let page = ctx.pages()[0] ?? await ctx.newPage();
  const errors = [];
  const watch = p => p.on('pageerror', e => { errors.push(String(e)); step(`[${name}] pageerror ${e}`); });
  watch(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.goto(url); await page.waitForFunction(() => window.__crown);
  if (opts.federation) {
    await page.goto(url + '#/world');
    await page.getByRole('button', { name: 'Found the federation' }).click();
    await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 90000 });
  }
  const before = await official(page);
  step(`[${name}] official state before: ${JSON.stringify(before)}`);

  // entry points
  await page.goto(url + '#/dashboard');
  check(`${name}-entry-dash`, await page.locator('[data-testid="dash-study"]').count() === 1, 'Dashboard has a Study Match link');
  await page.goto(url + '#/academy');
  await page.waitForSelector('[data-testid="academy-study-link"]', { timeout: 20000 }).catch(() => {});
  check(`${name}-entry-academy`, await page.locator('[data-testid="academy-study-link"]').count() === 1, 'Academy has a Study Match link');
  await page.goto(url + '#/play');
  await page.click('[data-testid="play-study"]');
  await page.waitForSelector('[data-testid="study-home"]');
  check(`${name}-home`, (await page.locator('[data-testid="study-label"]').innerText()).includes('Study — unrated'), 'Study setup is labelled "Study — unrated"');
  if (viewport.width < 500) check(`${name}-home-overflow`, await overflow() <= 0, `setup: no horizontal overflow (${await overflow()} px)`);
  await page.screenshot({ path: ART + `${name}-01-setup.png` });

  // beginner opponent
  const beginner = page.locator('[data-testid="study-opp"][data-beginner]').first();
  const oppName = (await beginner.locator('strong').first().innerText()).trim();
  await beginner.click();
  await page.click('[data-testid="study-start"]');
  await page.waitForSelector('[data-testid="study-match"]');
  const gameId = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2] ?? ''));
  const header = await page.locator('[data-testid="study-header-label"]').innerText();
  const rec0 = await page.evaluate(async id => { const g = await window.__crown.db.getGame(id); return { mode: g.mode, rated: g.rated, pool: g.pool, tc: g.timeControl.id, clocks: g.clocks, ctx: g.context.kind }; }, gameId);
  check(`${name}-start`, header === 'Study — unrated' && rec0.ctx === 'study' && !rec0.rated && rec0.pool === null && rec0.tc === 'untimed' && rec0.clocks === null,
    `study match vs ${oppName} (${gameId}): header "${header}", record ${JSON.stringify(rec0)}`);
  check(`${name}-no-clock`, await page.locator('[data-testid="study-match"] .mc-clock, [data-testid="study-match"] [aria-label$=" clock"]').count() === 0, 'no clock is shown (untimed)');

  await waitHuman(page);
  if (await page.getAttribute('[data-testid="study-match"]', 'data-human') === 'b') await waitHuman(page);
  await openAids(page);
  // hint
  await page.click('[data-testid="study-hint"]');
  await page.waitForSelector('[data-testid="study-hint-text"]', { timeout: 30000 });
  const hint = await page.locator('[data-testid="study-hint-text"]').innerText();
  const hl = await page.$$eval('[data-testid="study-match"] [data-square].hl, [data-testid="study-match"] [data-square].highlight, [data-testid="study-match"] [data-square][data-highlight]', els => els.length);
  check(`${name}-hint`, /Engine hint \(depth \d+\): consider moving the piece on [a-f][1-6]\./.test(hint), `hint: "${hint}" (highlighted squares: ${hl})`);
  // best move + why
  await page.click('[data-testid="study-best"]');
  await page.waitForSelector('[data-testid="study-best-text"]', { timeout: 30000 });
  const best = await page.locator('[data-testid="study-best-text"]').innerText();
  check(`${name}-best`, /Engine estimate, depth \d+ — not a perfect analysis\./.test(best) && /Best move: /.test(best), `best move explanation: "${best.replace(/\s+/g, ' ')}"`);
  // evaluation on/off
  const evalOn = await page.getAttribute('[data-testid="study-aid-eval"]', 'aria-pressed');
  if (evalOn !== 'true') await page.click('[data-testid="study-aid-eval"]');
  await page.waitForSelector('[data-testid="eval-bar"]', { timeout: 30000 });
  const bar = await page.getAttribute('[data-testid="eval-bar"]', 'aria-label');
  check(`${name}-eval-on`, /Engine estimate, depth \d+/.test(bar ?? ''), `evaluation bar shown: "${bar}"`);
  await page.click('[data-testid="study-aid-eval"]');
  check(`${name}-eval-off`, await page.locator('[data-testid="eval-bar"]').count() === 0, 'evaluation bar hidden when the aid is switched off');
  await page.click('[data-testid="study-aid-eval"]');
  await page.screenshot({ path: ART + `${name}-02-aids.png` });
  if (viewport.width < 500) check(`${name}-match-overflow`, await overflow() <= 0, `match: no horizontal overflow (${await overflow()} px)`);

  // moves with feedback
  for (let i = 0; i < 3; i++) if (!await makeMove(page, i)) break;
  await waitHuman(page);
  await page.waitForSelector('[data-testid="study-feedback"]', { timeout: 60000 }).catch(() => {});
  const fb = page.locator('[data-testid="study-feedback"]');
  const fbText = await fb.count() ? (await fb.first().innerText()).replace(/\s+/g, ' ') : '';
  const fbGrade = await fb.count() ? await fb.first().getAttribute('data-grade') : null;
  check(`${name}-feedback`, /(Brilliant|Great|Best|Excellent|Good|Inaccuracy|Mistake|Blunder|Not graded)/.test(fbText) && /expected-score loss \d\.\d\d|no confident grade/.test(fbText) && /Standard analysis \(std-d7\), depth 7/.test(fbText),
    `feedback after a move: "${fbText.slice(0, 200)}" (grade ${fbGrade})`);
  await page.screenshot({ path: ART + `${name}-03-feedback.png` });

  // take back
  await openAids(page);
  const pliesBefore = +(await page.getAttribute('[data-testid="study-match"]', 'data-plies'));
  await page.click('[data-testid="study-takeback"]');
  await page.waitForFunction(p => +document.querySelector('[data-testid="study-match"]')?.getAttribute('data-plies') < p, pliesBefore, { timeout: 10000 }).catch(() => {});
  const pliesAfter = +(await page.getAttribute('[data-testid="study-match"]', 'data-plies'));
  check(`${name}-takeback`, pliesAfter < pliesBefore && pliesAfter >= pliesBefore - 2, `take back: ${pliesBefore} → ${pliesAfter} plies`);
  await makeMove(page, 5);
  await waitHuman(page);
  await page.waitForFunction(() => !document.querySelector('[data-testid="study-grading"]'), null, { timeout: 60000 }).catch(() => {});

  // reload and resume
  const saved = await page.evaluate(async id => { const g = await window.__crown.db.getGame(id); return { plies: g.moves.length, fb: g.study?.feedback.length ?? 0, aids: g.study?.aids, uses: g.assistance.map(a => a.kind) }; }, gameId);
  await page.reload(); await page.waitForFunction(() => window.__crown);
  await page.goto(url + '#/play');
  await page.click('[data-testid="play-study"]');
  await page.waitForSelector('[data-testid="study-resume-btn"]');
  await page.click('[data-testid="study-resume-btn"]');
  await page.waitForSelector('[data-testid="study-match"]');
  await waitHuman(page);
  const resumed = await page.evaluate(async id => { const g = await window.__crown.db.getGame(id); return { plies: g.moves.length, fb: g.study?.feedback.length ?? 0, aids: g.study?.aids, status: g.status }; }, gameId);
  const shownPlies = +(await page.getAttribute('[data-testid="study-match"]', 'data-plies'));
  check(`${name}-resume`, resumed.plies === saved.plies && shownPlies === saved.plies && resumed.fb === saved.fb && JSON.stringify(resumed.aids) === JSON.stringify(saved.aids),
    `reload + resume: ${saved.plies} plies, ${saved.fb} feedback entries, aids ${JSON.stringify(saved.aids)}; aid uses recorded: ${saved.uses.join(',')}`);
  check(`${name}-uses-recorded`, ['hint', 'best-move', 'evaluation', 'takeback'].every(k => saved.uses.includes(k)) && saved.uses.includes('feedback'), 'every aid use is recorded on the game');

  // finish
  await openMoves(page);
  await page.click('[data-testid="study-resign"]');
  await page.click('[data-testid="study-resign-yes"]');
  await page.waitForSelector('[data-testid="study-result"]', { timeout: 20000 });
  const resultText = (await page.locator('[data-testid="study-result"]').innerText()).replace(/\s+/g, ' ');
  check(`${name}-result`, /Study — unrated/.test(resultText) && /No rating change/.test(resultText) && !/[+−-]\d+ career/i.test(resultText), `result card: "${resultText.slice(0, 160)}"`);
  await page.click('[data-testid="study-view-analysis"]');
  await page.waitForSelector('[data-testid="analysis-mode"]');
  const amode = await page.locator('[data-testid="analysis-mode"]').innerText();
  check(`${name}-analysis-label`, amode === 'Study — unrated' && await page.locator('[data-testid="analysis-study-note"]').count() === 1, `Match Analysis labelled "${amode}"`);
  await page.waitForSelector('[data-testid="played-like"]', { timeout: 180000 }).catch(() => {});
  const summaryTab = page.getByRole('tab', { name: 'Summary' });
  if (await summaryTab.count() && await summaryTab.isVisible()) await summaryTab.click();
  check(`${name}-analysis-pl`, await page.locator('[data-testid="played-like"]').count() > 0, 'standard Match Analysis completed and shows Played Like');
  await page.screenshot({ path: ART + `${name}-04-analysis.png` });
  if (viewport.width < 500) check(`${name}-analysis-overflow`, await overflow() <= 0, `analysis: no horizontal overflow (${await overflow()} px)`);

  // library + replay labels
  await page.goto(url + '#/library');
  await page.waitForSelector('[data-testid="library-row"]', { timeout: 20000 }).catch(() => {});
  check(`${name}-library`, await page.locator('[data-testid="library-study"]').count() >= 1, 'Game library row labelled "Study — unrated"');

  // official records unchanged
  await page.waitForFunction(id => window.__crown.db.getGame(id).then(g => !!g), gameId);
  await page.waitForFunction(async id => (await window.__crown.db.reportsForGame(id)).some(r => r.status === 'complete'), gameId, { timeout: 180000 }).catch(() => {});
  await page.evaluate(() => window.__crown.backfillPlayedLike());
  const after = await official(page);
  const studyRec = await page.evaluate(async id => { const g = await window.__crown.db.getGame(id); return { pl: (g.playedLike ?? []).length, ratingEventId: g.ratingEventId, sandbox: !!window.__crown.fed?.sandboxMarketFor?.(id) }; }, gameId);
  step(`[${name}] official state after: ${JSON.stringify(after)}; study game: ${JSON.stringify(studyRec)}`);
  check(`${name}-isolation`, JSON.stringify(after) === JSON.stringify(before) && studyRec.pl === 0 && studyRec.ratingEventId === null && !studyRec.sandbox,
    'ratings, rating events, Played Like records, Vault facts, Federation stats and markets unchanged; no Played Like record and no market for the study game');

  if (opts.federation) {
    await page.goto(url + '#/study');
    await page.click('[data-testid="study-source-federation"]');
    await page.waitForSelector('[data-testid="exh-row-black"]', { timeout: 20000 });
    await page.locator('[data-testid="exh-row-black"]').first().click();
    const startLabel = await page.locator('[data-testid="study-start"]').innerText();
    await page.click('[data-testid="study-start"]');
    await page.waitForSelector('[data-testid="study-match"]');
    const fid = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2] ?? ''));
    const fr = await page.evaluate(async id => { const g = await window.__crown.db.getGame(id); const o = g.humanColor === 'white' ? g.black : g.white; return { ctx: g.context.kind, rated: g.rated, profile: o.engine?.profileId, style: o.engine?.styleId, opp: o.id }; }, fid);
    await makeMove(page, 1);
    await waitHuman(page);
    check(`${name}-federation-opponent`, fr.ctx === 'study' && !fr.rated && !!fr.profile && !!fr.style, `${startLabel.trim()}: ${JSON.stringify(fr)}; the competitor replied`);
    await page.click('[data-testid="study-pause"]');
    await page.waitForSelector('[data-testid="study-resume"]');
    check(`${name}-pause`, await page.locator('[data-testid="study-resume-btn"]').count() >= 1, 'Pause & Save returns to the Study screen with the game listed under Resume');
  }
  check(`${name}-errors`, errors.length === 0, `no page errors (${errors.length})`);
  await ctx.close();
}

await journey('w390', { width: 390, height: 844 });
await journey('w375', { width: 375, height: 740 });
await journey('desktop', { width: 1366, height: 900 }, { federation: true });
writeFileSync(ART + 'study-log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'All study checks passed');
process.exit(failed ? 1 : 0);
