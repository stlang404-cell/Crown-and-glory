/**
 * v0.11 Circuit Grades journey (docs/FEUDAL_RANKS.md): founds the default (10,240) federation through the UI, checks
 * the new career is Commoner III, advances past the mid-season checkpoint (round 8), then at desktop and 390 px opens
 * the rank guide (all 48 steps, current position, progress, requirements), the Career Passport (rank and highest rank),
 * a competitor profile with its rank, the competitor list and a league table: ranks shown, no horizontal overflow, page
 * scroll reaches the bottom, no errors. Package Q: the Competitive Rank and the Federation Title are shown in separate,
 * labelled areas with different frames, tags and tooltips (header, Dashboard/Profile heading, Career Statistics,
 * competitor list rows, competitor profile, league table). The three featured engine games per round are given stub results through the
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
// a titled competitor, preferably one whose rank and title share a word (e.g. rank "Knight II", title "Knight")
const titled = await page.evaluate(() => {
  const st = window.__crown.fed.state;
  const all = [...st.competitors.values()].filter(x => x.status === 'active' && x.fedTitle);
  const grade = c => ['Commoner', 'Page', 'Squire', 'Man-at-Arms', 'Knight'][Math.floor(c.rank[0] / 3)];
  const c = all.find(x => grade(x) === x.fedTitle) ?? all.find(x => x.fedTitle === 'Knight' || x.fedTitle === 'Squire') ?? all[0];
  return c ? { id: c.id, name: c.name, title: c.fedTitle, step: c.rank[0], n: all.length } : null;
});
console.log(`titled competitors: ${titled?.n ?? 0}; chosen ${titled?.name} (title ${titled?.title}, step ${titled?.step})`);
/** The separate labelled areas: kind label, tag, frame shape/colour and tooltip of one badge. */
const honour = (sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].map(e => {
  const f = e.querySelector('[data-honour-frame]') ?? (e.matches('[data-honour-frame]') ? e : null);
  const cs = f ? getComputedStyle(f) : null;
  return { kind: e.getAttribute('data-honour') ?? e.querySelector('[data-honour]')?.getAttribute('data-honour') ?? null, aria: e.getAttribute('aria-label') ?? e.querySelector('[aria-label]')?.getAttribute('aria-label') ?? '', tip: e.getAttribute('title') ?? e.querySelector('[title]')?.getAttribute('title') ?? '',
    tag: e.querySelector('[data-honour-tag]')?.textContent ?? null, tagKind: e.querySelector('[data-honour-tag]')?.getAttribute('data-honour-tag') ?? null, text: e.textContent.replace(/\s+/g, ' ').trim(),
    radius: cs ? parseFloat(cs.borderTopLeftRadius) : null, border: cs ? cs.borderTopColor : null, frame: f?.getAttribute('data-honour-frame') ?? null };
}), sel);
const RANK_TIP = /current competitive standing.*up or down/i, TITLE_TIP = /permanent honour earned by title norms.*never lost/i;
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

  await page.goto(url + '#/dashboard'); await page.waitForSelector('[data-testid="rank-heading"]');
  const dh = await page.evaluate(() => ({ src: document.querySelector('[data-testid="rank-heading"]').getAttribute('data-source'), label: document.querySelector('[data-testid="rank-label"]')?.textContent, link: document.querySelector('[data-testid="rank-heading-link"]')?.getAttribute('href'), text: document.querySelector('[data-testid="rank-heading"]').textContent, marks: document.querySelector('[data-testid="rank-heading"] svg [data-marks]')?.getAttribute('data-marks') }));
  check(`H-${w}`, dh.src === 'feudal-rank' && dh.label === 'Commoner III' && dh.link === '#/ranks' && /Career Elo/.test(dh.text) && /Open Division/.test(dh.text) && dh.marks === '1', `Dashboard heading at ${w} px: ${dh.label} with insignia (sublevel marks ${dh.marks}), Career Elo and division, linked to ${dh.link}`);
  const hd = await page.evaluate(() => { const q = s => document.querySelector(s); return {
    kind: q('[data-testid="rank-heading-kind"]')?.textContent.trim(), kindTip: q('[data-testid="rank-heading-kind"]')?.getAttribute('title') ?? '', kindTag: q('[data-testid="rank-heading-kind"] [data-honour-tag]')?.textContent,
    title: q('[data-testid="rank-heading-fedtitle"]')?.textContent.replace(/\s+/g, ' ').trim(), titleTip: q('[data-testid="rank-heading-fedtitle"]')?.getAttribute('title') ?? '', titleTag: q('[data-testid="rank-heading-fedtitle"] [data-honour-tag]')?.textContent,
    frame: q('[data-testid="rank-heading"] > [data-honour-frame]')?.getAttribute('data-honour-frame'),
    header: q('[data-testid="header-rank-area"]')?.textContent.replace(/\s+/g, ' ').trim(), headerAria: q('[data-testid="header-rank-area"]')?.getAttribute('aria-label'), headerTip: q('[data-testid="header-rank-area"]')?.getAttribute('title') ?? '',
    rating: q('[data-testid="banner-title"] [data-honour-tag]')?.textContent, ratingTip: q('[data-testid="banner-title"]')?.getAttribute('title') ?? '' }; });
  check(`L-${w}`, hd.kind === 'Competitive Rank Rank' && hd.kindTag === 'Rank' && RANK_TIP.test(hd.kindTip) && hd.frame === 'rank' && /^Federation Title: none yet/.test(hd.title ?? '') && hd.titleTag === 'Title' && TITLE_TIP.test(hd.titleTip)
    && hd.header === 'Competitive Rank Commoner III Rank' && hd.headerAria === 'Competitive Rank: Commoner III' && RANK_TIP.test(hd.headerTip) && hd.rating === 'Rating' && /neither a Competitive Rank nor a Federation Title/.test(hd.ratingTip),
    `Separate labelled areas at ${w} px: heading "${hd.kind}" (rank frame, rank tooltip) and "${hd.title}" (title tooltip); header "${hd.header}"; rating title tagged "${hd.rating}"`);
  if (w > 400) await page.locator('[data-testid="identity-banner"]').screenshot({ path: `${SHOTS}rank-title-header-${w}.png` });
  else await page.screenshot({ path: `${SHOTS}rank-title-dashboard-${w}.png` });
  await page.goto(url + '#/profile'); await page.waitForSelector('[data-testid="career-rank"]');
  const cs = await page.evaluate(() => { const t = s => document.querySelector(s); return { cur: t('[data-testid="current-rank"] .k')?.textContent.trim(), curTip: t('[data-testid="current-rank"]')?.getAttribute('title') ?? '', fed: t('[data-testid="stats-fedtitle"]')?.textContent.replace(/\s+/g, ' ').trim(), fedTip: t('[data-testid="stats-fedtitle"]')?.getAttribute('title') ?? '', hi: t('[data-testid="highest-rank"] .k')?.textContent.trim(), standing: t('[data-testid="career-rank"] .k')?.textContent.trim(), standingTitle: t('[data-testid="career-fedtitle"] .k')?.textContent.trim() }; });
  check(`S-${w}`, cs.cur === 'Current Competitive Rank Rank' && RANK_TIP.test(cs.curTip) && /^Federation Title ?Title ?None yet ?Permanent/.test(cs.fed ?? '') && TITLE_TIP.test(cs.fedTip) && cs.hi === 'Highest Competitive Rank Ever Rank' && cs.standing === 'Competitive Rank Rank' && cs.standingTitle === 'Federation Title Title',
    `Profile at ${w} px: Career Statistics "${cs.cur}" / "${cs.hi}" and "${cs.fed}"; Career Standing "${cs.standing}" apart from "${cs.standingTitle}"`);
  const ph = await page.evaluate(() => ({ label: document.querySelector('[data-testid="rank-label"]')?.textContent, hi: document.querySelector('[data-testid="highest-rank"]')?.textContent, elo: document.querySelector('[data-testid="highest-elo"]')?.textContent }));
  check(`P-${w}`, ph.label === 'Commoner III' && /Commoner III/.test(ph.hi ?? '') && /Starting rank, season 1/.test(ph.hi ?? '') && !!ph.elo, `Profile heading ${ph.label}; Career Statistics highest rank "${(ph.hi ?? '').replace(/\s+/g, ' ')}" shown apart from Highest Career Elo`);
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
  const rr = await honour('[data-testid="competitor-row-rank"] [data-honour="rank"]');
  const rt = await honour('[data-testid="competitor-row-title"]');
  const ll = await layout();
  check(`8-${w}`, rows === 100 && ll.overflow <= 0 && rr.length === 100 && rr.every(r => r.tag === 'Rank' && /^Competitive Rank: \S/.test(r.aria) && RANK_TIP.test(r.tip) && r.frame === 'rank') && rt.every(r => r.tag === 'Title' && /^Federation Title: /.test(r.aria) && TITLE_TIP.test(r.tip) && /^(SQ|KT|PL|SV) Title$/.test(r.text)),
    `Competitor list at ${w} px: ${rows} rows with a rank insignia, each tagged "Rank" with an accessible label and the rank tooltip; ${rt.length} abbreviated Federation Titles tagged "Title"; overflow ${ll.overflow}`);
  if (titled) {
    await page.goto(url + `#/competitor/${titled.id}`); await page.waitForSelector('[data-testid="competitor-fedtitle"]');
    const [r] = await honour('[data-testid="competitor-rank"] [data-honour="rank"]');
    const [t] = await honour('[data-testid="competitor-fedtitle"] [data-honour="title"]');
    const cells = await page.evaluate(() => ({ rank: document.querySelector('[data-testid="insignia-rank"]')?.textContent, title: document.querySelector('[data-testid="insignia-fedtitle"]')?.textContent, dossier: !!document.querySelector('[data-testid="dossier"]') }));
    const lt = await layout();
    await page.locator('[data-testid="competitor-rank"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}rank-vs-title-competitor-${w}.png` });
    check(`T-${w}`, r && t && r.kind === 'rank' && t.kind === 'title' && r.tag === 'Rank' && t.tag === 'Title' && r.frame === 'rank' && t.frame === 'title' && r.radius < 8 && t.radius > 100 && r.border !== t.border && RANK_TIP.test(r.tip) && TITLE_TIP.test(t.tip)
      && t.aria === `Federation Title: ${titled.title}` && /^Competitive Rank: .+ (III|II|I)$/.test(r.aria) && /Rank$/.test(cells.rank ?? '') && /Title$/.test(cells.title ?? '') && lt.overflow <= 0 && lt.bottom,
      `Competitor profile at ${w} px: ${titled.name} shows "${r?.aria}" (square frame r=${r?.radius}px, ${r?.border}) apart from "${t?.aria}" (round frame r=${t?.radius}px, ${t?.border}); separate tooltips; overflow ${lt.overflow}`);
  }

  await page.goto(url + '#/standings'); await page.waitForSelector('table');
  const st = await page.evaluate(() => document.querySelectorAll('table [data-rank]').length);
  const stTags = await page.evaluate(() => [...document.querySelectorAll('table [data-honour="rank"]')].filter(e => e.querySelector('[data-honour-tag="rank"]') && /^Competitive Rank: /.test(e.getAttribute('aria-label') ?? '')).length);
  const ls = await layout();
  check(`9-${w}`, st >= 16 && stTags === st && ls.overflow <= 0, `League standings at ${w} px: ${st} rows with a rank insignia (${stTags} tagged "Rank" with an accessible label); overflow ${ls.overflow}`);
}
check(10, errors.length === 0, `No page or console errors (${errors.length})${errors.length ? ': ' + errors.join(' | ') : ''}`);
await ctx.close();
rmSync(profile, { recursive: true, force: true });
console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
