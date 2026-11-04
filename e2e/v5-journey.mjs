/**
 * v0.5.0 "Sovereign Intelligence" acceptance journey, driven through the real UI in Chromium.
 * Phase A: the real v0.4.0 build (commit d4dbbe6) creates a career on the SAME origin (federation, club, trade,
 * a rated game with its legacy analysis report, an Academy attempt). Phase B: the v0.5.0 build is served on that
 * origin and every new acceptance item is executed. Items covered by the existing journeys (tournaments, rivals,
 * live spectating/trading, settlement, conditional contracts, sandbox, club finances, trophies) are re-run with
 * e2e/m4-journey.mjs and e2e/m5-heraldry.mjs on the same final build.
 *   npm run build && node e2e/v5-journey.mjs <v0.4.0 dist dir> [port]
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { register } from 'tsx/esm/api';
register();
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { Position } = await import('../src/rules/position.ts');
const { moveToCcn, parseLegalCcn } = await import('../src/rules/notation.ts');
const { Searcher } = await import('../src/engine/search.ts');

const OLD_DIST = process.argv[2];
const PORT = +(process.argv[3] ?? 4295);
const URL_ = `http://127.0.0.1:${PORT}/`;
const OUT = new URL('../docs/evidence/v5/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/v5-profile', import.meta.url).pathname;
const PROFILE2 = new URL('./artifacts/tmp/v5-profile-import', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
rmSync(PROFILE2, { recursive: true, force: true });
const log = [];
const results = {};
const step = (m) => { const line = `[${new Date().toISOString()}] ${m}`; log.push(line); console.log(line); writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n'); };
const save = () => writeFileSync(OUT + 'journey-results.json', JSON.stringify(results, null, 1));
const check = (n, cond, m) => { results[n] = !!cond; step(`${cond ? 'PASS' : 'FAIL'}: ${n}. ${m}`); save(); if (!cond) { server?.kill(); process.exit(1); } };
process.on('uncaughtException', e => { console.error(e); server?.kill(); process.exit(1); });
process.on('unhandledRejection', e => { console.error(e); server?.kill(); process.exit(1); });

let server = null;
async function serve(dir) {
  if (server) { server.kill(); await new Promise(r => setTimeout(r, 500)); }
  server = spawn(process.execPath, ['scripts/serve.mjs', '--dir', dir, '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const first = await new Promise(r => server.stdout.once('data', d => r(String(d))));
  // a stale server from an earlier run would make us test the wrong build
  if (!first.includes(`running at http://127.0.0.1:${PORT}/`) || first.includes('already running')) throw new Error(`port ${PORT} is not served by this run: ${first}`);
  await new Promise(r => setTimeout(r, 300));
}
const errors = [];
async function open(profile = PROFILE, viewport = { width: 1366, height: 900 }) {
  const ctx = await chromium.launchPersistentContext(profile, { viewport, acceptDownloads: true });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + e); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error: ' + m.text().slice(0, 300)); } });
  await page.goto(URL_);
  await page.waitForSelector('.app');
  await page.waitForFunction(() => window.__crown);
  return { ctx, page };
}
const robot = new Searcher(18);
async function playOut(page, nodes = 8000) {
  await page.waitForSelector('[data-testid="match"]');
  const deadline = Date.now() + 40 * 60_000;
  while (Date.now() < deadline) {
    const turn = await page.getAttribute('[data-testid="match"]', 'data-turn');
    if (turn === 'over') break;
    if (turn !== 'human') { await page.waitForTimeout(150); continue; }
    const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
    const r = robot.search(Position.fromFen(fen), { limits: { nodes } });
    const mv = moveToCcn(r.bestMove);
    await page.click(`[data-square="${mv.slice(0, 2)}"]`);
    await page.click(`[data-square="${mv.slice(2, 4)}"]`);
    if (mv.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[mv[4]] }).click();
    await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 120000 }).catch(() => {});
  }
  await page.waitForSelector('.result-overlay', { timeout: 120000 });
  return page.textContent('.result-title');
}
async function startMatch(page, opp, { tc = 'Rapid 5+3', mode = 'Casual', color = 'White', budget } = {}) {
  await page.goto(URL_ + '#/play');
  await page.getByRole('button', { name: opp }).first().click();
  if (budget) await page.locator('[data-testid="max-budget"]').getByRole('button', { name: `${budget} s`, exact: true }).click();
  await page.getByRole('button', { name: tc }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: mode, exact: true }).click();
  await page.getByRole('button', { name: color, exact: true }).click();
  await page.getByRole('button', { name: /Start match/i }).click();
  await page.waitForSelector('[data-testid="match"]');
}
const dump = page => page.evaluate(async () => {
  const d = await window.__crown.db.dump();
  const sortId = a => [...a].sort((x, y) => String(x.id ?? x.pool ?? x.key).localeCompare(String(y.id ?? y.pool ?? y.key)));
  return { games: sortId(d.games), ratingEvents: sortId(d.ratingEvents), ratingState: sortId(d.ratingState), reports: sortId(d.reports), attempts: sortId(d.attempts ?? []), federation: Object.fromEntries(Object.entries(d.federation ?? {}).map(([k, v]) => [k, sortId(v)])) };
});
/** Poll an async in-page predicate (Playwright's waitForFunction would treat the returned Promise as truthy). */
async function waitUntil(page, fn, arg, timeout = 600000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(fn, arg).catch(() => false)) return;
    if (Date.now() > end) throw new Error('waitUntil timed out: ' + fn.toString().slice(0, 120));
    await page.waitForTimeout(1000);
  }
}
const replayLegal = (g) => { const p = Position.fromFen(g.initialFen); for (const s of g.setupMoves ?? []) p.makeMove(parseLegalCcn(p, s)); for (const m of g.moves) { const mv = parseLegalCcn(p, m.ccn); if (mv < 0) return false; p.makeMove(mv); if (p.toFen() !== m.fenAfter) return false; } return true; };

// ============================== Phase A: v0.4.0 =================================
let old = null;
if (OLD_DIST) {
  await serve(OLD_DIST);
  const { ctx, page } = await open();
  step(`v0.4.0 build served from ${OLD_DIST}`);
  await page.goto(URL_ + '#/world');
  await page.getByRole('button', { name: 'Found the federation' }).click();
  await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
  await page.evaluate(async () => { const f = window.__crown.fed; const m = f.featuredFixtures().map(x => f.marketFor(x.id)).find(x => x && x.status === 'open'); await f.trade(m.id, 0, 5, 'buy'); await f.buyAsset('club'); });
  await startMatch(page, /Mira Vell/, { mode: 'Rated' });
  const r0 = await playOut(page);
  await waitUntil(page, async () => (await window.__crown.db.allReports()).some(r => r.status === 'complete'), undefined, 600000);
  await page.goto(URL_ + '#/academy');
  await page.getByRole('button', { name: /Start adaptive training/i }).click();
  await page.waitForSelector('[data-testid="puzzle-panel"]');
  const sol = (await page.locator('[data-testid="puzzle-panel"]').getAttribute('data-solution')).split(' ');
  for (let i = 0; i < sol.length; i += 2) { await page.click(`[data-square="${sol[i].slice(0, 2)}"]`); await page.click(`[data-square="${sol[i].slice(2, 4)}"]`); if (sol[i].length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[sol[i][4]] }).click(); await page.waitForTimeout(700); }
  await waitUntil(page, async () => (await window.__crown.db.dump()).attempts.length > 0, undefined, 30000);
  old = await dump(page);
  step(`v0.4.0 career: ${old.games.length} game(s) (rated ${r0}), ${old.ratingEvents.length} rating event(s), ${old.reports.length} report(s) [${old.reports.map(r => r.engine.buildId).join(', ')}], ${old.attempts.length} Academy attempt(s), ${old.federation.journal?.length ?? 0} journals`);
  writeFileSync(OUT + 'v040-save-summary.json', JSON.stringify({ games: old.games.length, ratingEvents: old.ratingEvents.length, reports: old.reports.map(r => ({ id: r.id, build: r.engine.buildId, grading: r.methodology.gradingId })), attempts: old.attempts.length, journals: old.federation.journal?.length }, null, 1));
  await page.screenshot({ path: OUT + '00-v040-career.png' });
  await ctx.close();
}

// ============================== Phase B: v0.5.0 =================================
await serve('dist');
let { ctx, page } = await open();
step('v0.5.0 build served on the same origin');
if (old) {
  const now = await dump(page);
  const same = k => JSON.stringify(now[k]) === JSON.stringify(old[k]);
  const oldJ = new Map((old.federation.journal ?? []).map(j => [j.id, JSON.stringify(j)]));
  const keptJ = (now.federation.journal ?? []).filter(j => oldJ.get(j.id) === JSON.stringify(j)).length === oldJ.size;
  const bal = d => JSON.stringify((d.federation.balances ?? d.federation.balance ?? []));
  const legacy = now.reports.find(r => r.engine.buildId === 'crown-search-1+crown-eval-3');
  const commit = await page.evaluate(() => window.__crown.fed.state.world.engineCommitments);
  check(25, same('games') && same('ratingEvents') && same('ratingState') && same('reports') && same('attempts') && keptJ && bal(now) === bal(old) && legacy && commit?.at(-1)?.build === 'crown-search-2+crown-eval-4',
    `v0.4.0 save migrated without loss: ${now.games.length} games, ${now.ratingEvents.length} rating events, ${now.reports.length} reports, ${now.attempts.length} attempts, all ${oldJ.size} journals and every balance byte-identical; historical report kept with engine ${legacy?.engine.buildId}; engine commitment recorded (${JSON.stringify(commit?.at(-1))})`);
  // historical report display + re-analysis with the canonical engine (both kept)
  const gid = old.games[0].id;
  await page.goto(URL_ + `#/analysis/${encodeURIComponent(gid)}`);
  await page.waitForSelector('[data-testid="report-status"]', { timeout: 60000 });
  const histTxt = await page.locator('body').textContent();
  await page.screenshot({ path: OUT + '01-historical-report.png', fullPage: true });
  const btn = page.getByRole('button', { name: /Analyse Again/ });
  const enabled = await btn.isEnabled();
  await btn.click();
  await waitUntil(page, async id => (await window.__crown.db.allReports()).some(r => r.gameId === id && r.status === 'complete' && r.engine.buildId === 'crown-search-2+crown-eval-4'), gid, 900000);
  const reps = await page.evaluate(async id => (await window.__crown.db.allReports()).filter(r => r.gameId === id).map(r => ({ id: r.id, build: r.engine.buildId, grading: r.methodology.gradingId, acc: r.methodology.accuracyId })), gid);
  check('6a', enabled && /Historical report/.test(histTxt) && reps.length === 2 && reps.some(r => r.grading === 'crown-grade-v1-experimental') && reps.some(r => r.grading === 'crown-grade-v3-experimental'),
    `Historical report labelled and kept; re-analysis with the canonical engine produced a second report: ${JSON.stringify(reps)}`);
} else step('no v0.4.0 dist given: migration steps skipped (NOT RUN)');

await page.goto(URL_ + '#/world');
if (!(await page.evaluate(() => window.__crown.fed.ready))) { await page.getByRole('button', { name: 'Found the federation' }).click(); await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 }); }

// ---- 1, 2: complete legal match vs Sovereign Max with recorded provenance
await startMatch(page, /The Sovereign/, { budget: 5 });
await page.screenshot({ path: OUT + '02-sovereign-match.png' });
const maxRes = await playOut(page, 8000);
const maxGame = await page.evaluate(async () => { const gs = await window.__crown.db.allGames(); return gs.filter(g => g.status === 'finalized').sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))[0]; });
const eng = maxGame.humanColor === 'white' ? maxGame.black : maxGame.white;
const engMoves = maxGame.moves.filter((m, i) => (i % 2 === 0) === (maxGame.humanColor === 'black'));
check(1, replayLegal(maxGame) && maxGame.variantId === 'crown-la6-v1', `Complete legal crown-la6-v1 match (${maxGame.moves.length} plies, ${maxGame.result}, ${maxGame.termination}); every move re-verified by the rules engine`);
check(2, eng.engine.config?.build === 'crown-search-2+crown-eval-4' && eng.engine.config.ttBits === 20 && eng.engine.config.maxTimeMs === 5000 && eng.engine.config.selection === 'best' && engMoves.every(m => m.engine?.build === 'crown-search-2+crown-eval-4' && m.engine?.score && m.engine?.stopReason),
  `Sovereign Max (${maxRes}): game records ${JSON.stringify(eng.engine.config)}; all ${engMoves.length} engine moves carry build, score and stop reason (avg depth ${(engMoves.reduce((a, m) => a + m.engine.depth, 0) / engMoves.length).toFixed(1)}, max ${Math.max(...engMoves.map(m => m.engine.timeMs))} ms)`);
await page.screenshot({ path: OUT + '03-sovereign-result.png' });

// ---- 26: safe worker cancellation — the Max game's analysis is running; a new match pre-empts it
await page.waitForFunction(id => window.__crown.progress?.gameId === id, maxGame.id, { timeout: 120000 }).catch(() => {});
const before = await page.evaluate(() => window.__crown.engineEvents().length);
await startMatch(page, /Mira Vell/, { tc: 'Rapid 5+3' });
// ---- 7: assistant from the canonical engine in a casual game
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 60000 });
const evs = await page.evaluate(n => window.__crown.engineEvents().slice(n), before);
const cancelled = evs.find(e => e.role === 'analysis' && e.event === 'cancelled');
const job = await page.evaluate(async id => (await window.__crown.db.allJobs()).find(j => j.gameId === id), maxGame.id);
check(26, cancelled && cancelled.ms < 500 && job && (job.status === 'queued' || job.status === 'complete'), `Background analysis cancelled when the match started (worker terminated in ${cancelled?.ms} ms, ${cancelled?.detail}); its job was re-queued (${job?.status}), nothing partial was saved`);
await page.getByRole('button', { name: 'Candidate moves' }).click();
await page.waitForSelector('.coach li', { timeout: 60000 });
const cands = await page.locator('.coach li').count();
const assistEv = await page.evaluate(() => window.__crown.engineEvents().filter(e => e.role === 'assist' && e.event === 'done').length);
const recA = await page.evaluate(async () => (await window.__crown.db.unfinishedGames())[0]);
check(7, cands > 0 && assistEv > 0 && recA.assistance.length > 0, `Assistant returned ${cands} candidate moves from the canonical engine (assist worker); the casual game is now permanently marked assisted (${recA.assistance.length} use)`);
await page.screenshot({ path: OUT + '04-assistant.png' });
await playOut(page);

// ---- 4, 5, 8: rated game — correct single rating update, history, assistant locked
const rs0 = await page.evaluate(async () => { const s = await window.__crown.db.ratingState('rapid'); return { rating: s.rating, games: s.games, events: (await window.__crown.db.ratingEvents()).length }; });
await startMatch(page, /Mira Vell/, { mode: 'Rated' });
const locked = await page.locator('[data-testid="assist-locked"]').count(), panel = await page.locator('[data-testid="assist-panel"]').count();
check(8, locked === 1 && panel === 0, 'Rated game: assistant locked (no assistant panel, no engine help available)');
await playOut(page);
await page.waitForSelector('[data-testid="rating-delta"]');
const rs1 = await page.evaluate(async () => { const s = await window.__crown.db.ratingState('rapid'); const ev = await window.__crown.db.ratingEvents(); return { rating: s.rating, games: s.games, events: ev.length, last: ev.sort((a, b) => a.at.localeCompare(b.at)).at(-1) }; });
check(4, rs1.events === rs0.events + 1 && rs1.games === rs0.games + 1 && Math.abs(rs1.rating - rs1.last.after.rating) < 1e-9, `Rating updated exactly once: ${Math.round(rs0.rating)} → ${Math.round(rs1.rating)} (one Glicko-2 event, ledger state matches the event)`);
await page.reload(); await page.waitForFunction(() => window.__crown);
const rs2 = await page.evaluate(async () => (await window.__crown.db.ratingEvents()).length);
await page.goto(URL_ + '#/profile');
await page.waitForSelector('[data-testid="rating-event"]');
const evRows = await page.locator('[data-testid="rating-event"]').count();
check(5, rs2 === rs1.events && evRows === rs1.events, `Permanent history: ${evRows} rating events listed in the Passport after reload`);

// ---- 6: move-by-move analysis from the canonical engine (the rated game's automatic report)
const rated = await page.evaluate(async () => (await window.__crown.db.allGames()).filter(g => g.rated && g.status === 'finalized').sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))[0]);
await waitUntil(page, async id => (await window.__crown.db.allReports()).some(r => r.gameId === id && r.status === 'complete'), rated.id, 900000);
await page.goto(URL_ + `#/analysis/${encodeURIComponent(rated.id)}`);
await page.waitForSelector('[data-ply="3"]', { timeout: 60000 });
await page.click('[data-ply="3"]');
await page.waitForSelector('[data-testid="move-panel"]', { timeout: 60000 });
const rep = await page.evaluate(async id => { const r = (await window.__crown.db.allReports()).find(x => x.gameId === id && x.status === 'complete'); return { plies: r.plies.length, build: r.engine.buildId, grading: r.methodology.gradingId, acc: r.methodology.accuracyId, accuracyOk: Object.values(r.summary ?? {}).every(s => s?.accuracy === null || s?.accuracy === undefined || (s.accuracy >= 0 && s.accuracy <= 100)) }; }, rated.id);
check(6, rep.plies === rated.moves.length && rep.build === 'crown-search-2+crown-eval-4' && rep.grading === 'crown-grade-v3-experimental' && rep.accuracyOk, `Move-by-move analysis: ${rep.plies}/${rated.moves.length} plies graded by ${rep.build} (${rep.grading}, ${rep.acc}); accuracies bounded 0–100`);
await page.screenshot({ path: OUT + '05-analysis.png', fullPage: true });

// ---- 9: Academy puzzle from the re-verified library
await page.goto(URL_ + '#/academy');
await page.getByRole('button', { name: /Start adaptive training/i }).click();
await page.waitForSelector('[data-testid="puzzle-panel"]');
const pid = await page.locator('[data-testid="puzzle-panel"]').getAttribute('data-puzzle');
const sol = (await page.locator('[data-testid="puzzle-panel"]').getAttribute('data-solution')).split(' ');
for (let i = 0; i < sol.length; i += 2) { await page.click(`[data-square="${sol[i].slice(0, 2)}"]`); await page.click(`[data-square="${sol[i].slice(2, 4)}"]`); if (sol[i].length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[sol[i][4]] }).click(); await page.waitForTimeout(700); }
const pstatus = await page.locator('[data-testid="puzzle-panel"]').getAttribute('data-status');
const pz = JSON.parse(readFileSync(new URL('../src/academy/data/puzzles.json', import.meta.url), 'utf8')).puzzles.find(p => p.id === pid);
check(9, pstatus === 'solved' && !pz.retired && pz.canonical?.ok && pz.canonical.verifyId === 'crown-puzzle-verify-2', `Puzzle ${pid} served from the active library, verified by crown-puzzle-verify-2 (gap ${pz.canonical?.gap}); solved`);
await page.screenshot({ path: OUT + '06-academy.png' });

// ---- 10: Lab evidence — one methodology, no mixing
await page.goto(URL_ + '#/lab');
await page.waitForTimeout(1500);
const labTxt = (await page.locator('main, .app').first().textContent()).replace(/\s+/g, ' ');
const m = labTxt.match(/Methodology ([^·]+)·/);
check(10, m && !/crown-search-1/.test(m[1]) && /crown-grade-v3/.test(m[1]), `Lab uses one methodology: "${m?.[1]?.trim()}" (other versions excluded and counted, never mixed)`);
await page.screenshot({ path: OUT + '07-lab.png', fullPage: true });

// ---- 21: cosmetic purchase; 11/22: Passport accuracy
await page.goto(URL_ + '#/finance');
await page.locator('[data-testid="buy-cosmetic-frame-gold"]').click();
await page.waitForSelector('text=Bought Gold frame');
const cs = await page.evaluate(() => ({ c: window.__crown.fed.cosmetics(), total: [...window.__crown.fed.state.balances.values()].reduce((a, b) => a + b, 0) }));
await page.locator('[data-testid="cosmetics"]').screenshot({ path: OUT + '08-cosmetics.png' });
check(21, cs.c.owned.includes('frame-gold') && cs.c.equipped.frame === 'frame-gold' && cs.total === 0, `Bought and equipped the Gold frame (cosmetic, ledger conserved); earned-only items stay locked`);
await page.goto(URL_ + '#/profile');
await page.waitForSelector('[data-testid="career-standing"]');
const pass = await page.evaluate(async () => { const t = document.querySelector('[data-testid="career-standing"]').textContent; const s = await window.__crown.db.ratingState('rapid'); const w = window.__crown.fed.state.world; return { t, rating: Math.round(s.rating), div: w.player.division, title: w.player.fedTitle ?? null, avatar: getComputedStyle(document.querySelector('[data-testid="player-avatar"]')).borderTopColor }; });
check(11, (pass.t.includes(String(pass.rating)) || pass.t.includes(pass.rating.toLocaleString('en'))) && pass.t.includes(`Division ${pass.div} of 8`) && pass.t.includes(pass.title ?? 'None yet'), `Passport shows rating ${pass.rating}, division ${pass.div} and federation title ${pass.title ?? 'none'} as six separate records`);
check(22, /Cash .*net worth/.test(pass.t) && /Eligibility this season/.test(pass.t) && pass.avatar !== 'rgba(0, 0, 0, 0)', `Career Passport accurate: finances, eligibility, trophies, rivalries, forecasting and achievements from recorded state; equipped frame visible (${pass.avatar})`);
await page.screenshot({ path: OUT + '09-passport.png', fullPage: true });

// ---- 24: export → import into a fresh profile on the same origin (after background analysis has finished)
await waitUntil(page, async () => !window.__crown.progress && (await window.__crown.db.allJobs()).every(j => j.status !== 'queued' && j.status !== 'running'), undefined, 1200000);
await page.goto(URL_ + '#/library');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
const file = OUT + 'backup-sample.json';
await dl.saveAs(file);
const snapA = await dump(page);
await ctx.close();
({ ctx, page } = await open(PROFILE2));
await page.goto(URL_ + '#/library');
await page.locator('input[type="file"]').setInputFiles(file);
await waitUntil(page, async () => (await window.__crown.db.allGames()).length > 0, undefined, 60000);
await page.reload(); await page.waitForFunction(() => window.__crown?.fed);
const snapB = await dump(page);
const eqk = k => JSON.stringify(snapA[k]) === JSON.stringify(snapB[k]);
check(24, eqk('games') && eqk('ratingEvents') && eqk('ratingState') && eqk('reports') && JSON.stringify(snapA.federation.balances ?? snapA.federation.balance) === JSON.stringify(snapB.federation.balances ?? snapB.federation.balance),
  `Exported backup (${(readFileSync(file).length / 1024).toFixed(0)} KB, checksummed) imported into an empty profile: ${snapB.games.length} games, ${snapB.ratingEvents.length} rating events, ${snapB.reports.length} reports and the federation ledger identical`);
rmSync(file, { force: true });
await ctx.close();

// ---- 23: restart continuity (original profile)
({ ctx, page } = await open());
const snapC = await dump(page);
{ // diagnostic: name exactly what differs (store → record ids)
  const diff = {};
  for (const k of new Set([...Object.keys(snapA.federation), ...Object.keys(snapC.federation)])) {
    const A = new Map((snapA.federation[k] ?? []).map(r => [String(r.id ?? r.pool ?? r.key), JSON.stringify(r)]));
    const C = new Map((snapC.federation[k] ?? []).map(r => [String(r.id ?? r.pool ?? r.key), JSON.stringify(r)]));
    const ids = [...new Set([...A.keys(), ...C.keys()])].filter(id => A.get(id) !== C.get(id));
    if (ids.length) diff[k] = ids.slice(0, 8).map(id => `${id}${A.has(id) ? '' : ' (new)'}${C.has(id) ? '' : ' (gone)'}`);
  }
  for (const k of ['games', 'reports']) if (JSON.stringify(snapA[k]) !== JSON.stringify(snapC[k])) diff[k] = 'differs';
  step('restart diff: ' + JSON.stringify(diff).slice(0, 1500));
}
// v0.9: the live scheduler resumes background games when the app opens, so a scheduled live game may have gained
// moves. Everything else must be identical; a scheduled game must keep every earlier move (its old moves a prefix).
const sched = snap => (snap.federation.liveGames ?? []).filter(g => g.kind === 'scheduled');
const resumedOk = sched(snapA).every(a => { const c = sched(snapC).find(x => x.id === a.id); return c && JSON.stringify(c.moves.slice(0, a.moves.length)) === JSON.stringify(a.moves); });
const nonSched = snap => ({ ...snap.federation, liveGames: (snap.federation.liveGames ?? []).filter(g => g.kind !== 'scheduled') });
check(23, JSON.stringify(snapC.games) === JSON.stringify(snapA.games) && JSON.stringify(snapC.reports) === JSON.stringify(snapA.reports) && JSON.stringify(nonSched(snapC)) === JSON.stringify(nonSched(snapA)) && resumedOk,
  `Browser restarted: games, reports and the whole federation state identical; ${sched(snapA).length} scheduled background game(s) resumed with every earlier move kept`);

// ---- 27: offline restart, engine move offline
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.app');
await startMatch(page, /Mira Vell/, { color: 'Black' });
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 30000 });
const ofen = await page.getAttribute('[data-testid="match"]', 'data-fen');
const gamesAfterOffline = await page.evaluate(async () => (await window.__crown.db.allGames()).length);
check(27, !ofen.startsWith('rnqknr/pppppp/6/6/PPPPPP/RNQKNR'), 'Offline: app shell from the service worker, engine move computed in a Web Worker, career loaded from IndexedDB');
await ctx.setOffline(false);
await ctx.close();

// ---- 28: accessibility & responsive checks (phone)
({ ctx, page } = await open(PROFILE, { width: 390, height: 844 }));
const a11y = [];
for (const [h, name] of [['#/play', 'm-play'], ['#/profile', 'm-passport'], ['#/finance', 'm-finance'], ['#/settings', 'm-settings'], ['#/academy', 'm-academy'], ['#/world', 'm-world'], ['#/heraldry', 'm-heraldry']]) {
  await page.goto(URL_ + h);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    unnamed: [...document.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), select')].filter(e => (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }) : e.offsetParent !== null) && !((e.innerText ?? '').trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.labels?.length || e.getAttribute('aria-labelledby') || e.querySelector('[role="img"][aria-label], img[alt]:not([alt=""])'))).length,
    imgsNoAlt: [...document.querySelectorAll('svg[role="img"]')].filter(s => !s.getAttribute('aria-label')).length,
    examples: [...document.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), select')].filter(e => (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }) : e.offsetParent !== null) && !((e.innerText ?? '').trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.labels?.length || e.getAttribute('aria-labelledby') || e.querySelector('[role="img"][aria-label], img[alt]:not([alt=""])'))).slice(0, 3).map(e => e.outerHTML.slice(0, 200)),
  }));
  a11y.push({ h, ...r });
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
}
// keyboard: Tab reaches interactive elements; board squares are labelled
await page.goto(URL_ + '#/settings');
await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
const focused = await page.evaluate(() => document.activeElement?.tagName);
await ctx.close();
step('   a11y/responsive: ' + JSON.stringify(a11y));
check(28, a11y.every(x => !x.overflow && x.unnamed === 0 && x.imgsNoAlt === 0) && focused && focused !== 'BODY', `Phone width 390 px: no horizontal overflow on ${a11y.length} screens, every visible control has an accessible name, every SVG image is labelled, keyboard focus moves (${focused})`);

// ---- rollback: the real v0.4.0 build still opens the career touched by v0.5.0 (additive fields only)
if (OLD_DIST) {
  const errsBefore = errors.length;
  await serve(OLD_DIST);
  ({ ctx, page } = await open());
  await page.waitForFunction(() => window.__crown?.fed?.state, null, { timeout: 60000 });
  const rb = await page.evaluate(async () => ({ games: (await window.__crown.db.allGames()).length, round: window.__crown.fed.state.world.round, total: [...window.__crown.fed.state.balances.values()].reduce((a, b) => a + b, 0) }));
  await page.goto(URL_ + '#/profile'); await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + '10-rollback-v040.png' });
  await ctx.close();
  check('rollback', rb.games === gamesAfterOffline && rb.total === 0 && errors.length === errsBefore, `v0.4.0 build reopened the v0.5.0 career: ${rb.games} games, federation round ${rb.round}, ledger conserved, no errors`);
  await serve('dist');
}

step(`console/page errors: ${errors.length}`);
step(`v0.5 JOURNEY: ${Object.values(results).filter(Boolean).length}/${Object.keys(results).length} steps passed`);
server.kill();
process.exit(0);
