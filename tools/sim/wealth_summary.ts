/**
 * Summarise wealth-loop simulation results (tools/sim/wealth.ts) into the tables of docs/ECONOMY_V11.md.
 * Usage: npx tsx tools/sim/wealth_summary.ts out.json in1.json [in2.json ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';

type Season = { season: number; netWorth: number; cash: number; inAdministration: boolean; circulatingPerCompetitor: number; circulatingGrowth: number | null; meanCompetitorBalance: number; treasury: number; mintedThisSeason: number; sunkThisSeason: number; conserved: boolean; negativeAccounts: number };
type Run = { archetype: string; seed: number; regions: number; population: number; seasons: Season[]; final: { netWorth: number; division: number; titles: number }; administration: { episodes: { since: number; until: number | null; loan: boolean }[] }; lifetime: { earnings: number; expenses: number; exchangeNet: number; ledgerExact: boolean }; flowsPerSeason: Record<string, Record<string, number>> };

const [out, ...ins] = process.argv.slice(2);
const runs: Run[] = ins.flatMap(f => (JSON.parse(readFileSync(f, 'utf8')) as { results: Run[] }).results);
const stats = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; const mean = s.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)); return { n, mean, sd, min: s[0], median: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, max: s[n - 1] }; };
const r0 = (x: number) => Math.round(x).toLocaleString('en');
const summary: Record<string, unknown> = {};
const md: string[] = [];
for (const regions of [...new Set(runs.map(r => r.regions))].sort((a, b) => a - b)) {
  const R = runs.filter(r => r.regions === regions);
  const pop = R[0].population;
  md.push(`\n### ${pop.toLocaleString('en')} competitors (${regions} regions) — ${new Set(R.map(r => r.seed)).size} seeds × ${R[0].seasons.length} seasons\n`);
  md.push('| Archetype | Runs | Final net worth mean ± sd | min / median / max | Final division (mean) | Runs with administration | Episodes | Recovered (mean seasons) | Still in administration at the end | Ledger exact & conserved |');
  md.push('|---|---|---|---|---|---|---|---|---|---|');
  const byA: Record<string, unknown> = {};
  for (const a of [...new Set(R.map(r => r.archetype))]) {
    const A = R.filter(r => r.archetype === a);
    const nw = stats(A.map(r => r.final.netWorth));
    const eps = A.flatMap(r => r.administration.episodes);
    const rec = eps.filter(e => e.until !== null).map(e => e.until! - e.since);
    const ok = A.every(r => r.lifetime.ledgerExact && r.seasons.every(s => s.conserved && s.negativeAccounts === 0));
    const div = stats(A.map(r => r.final.division)).mean;
    byA[a] = { netWorth: nw, division: div, runsWithAdmin: A.filter(r => r.administration.episodes.length).length, episodes: eps.length, recoveredSeasons: rec.length ? stats(rec) : null, unrecovered: eps.filter(e => e.until === null).length, loans: eps.filter(e => e.loan).length, ok };
    md.push(`| ${a} | ${A.length} | $${r0(nw.mean)} ± ${r0(nw.sd)} | $${r0(nw.min)} / $${r0(nw.median)} / $${r0(nw.max)} | ${div.toFixed(1)} | ${A.filter(r => r.administration.episodes.length).length} | ${eps.length} | ${rec.length} (${rec.length ? stats(rec).mean.toFixed(1) : '—'}) | ${eps.filter(e => e.until === null).length} | ${ok ? 'yes' : 'NO'} |`);
  }
  // money supply per competitor (all runs of this size; the world is the same for every archetype of a seed)
  const S = R[0].seasons.length;
  const at = (k: number, f: (s: Season) => number) => stats(R.map(r => f(r.seasons[k - 1])));
  const late = stats(R.flatMap(r => r.seasons.slice(12).map(s => s.circulatingGrowth ?? 0)));
  const supply = { perCompetitor: [1, 6, 12, 18, S].map(k => ({ season: k, ...at(k, s => s.circulatingPerCompetitor) })), lateGrowth: late, meanCompetitorBalance: [1, 12, S].map(k => ({ season: k, ...at(k, s => s.meanCompetitorBalance) })), mintedPerCompetitor: at(S, s => s.mintedThisSeason / pop), sunkPerCompetitor: at(S, s => s.sunkThisSeason / pop), treasury: at(S, s => s.treasury) };
  md.push(`\nCirculating money per competitor (minted − sink, $): ${supply.perCompetitor.map(x => `S${x.season} ${x.mean.toFixed(1)}`).join(' · ')}; growth per season over seasons 13–${S}: mean ${(late.mean * 100).toFixed(2)}%, max ${(late.max * 100).toFixed(2)}%. Season ${S}: minted ${supply.mintedPerCompetitor.mean.toFixed(2)} $/competitor, sunk ${supply.sunkPerCompetitor.mean.toFixed(2)} $/competitor; treasury $${r0(supply.treasury.mean)}.`);
  // flow audit: chess-only runs, per season averages
  const C = R.filter(r => r.archetype === 'chess-only');
  const kinds = [...new Set(C.flatMap(r => Object.keys(r.flowsPerSeason)))].sort();
  const flows: Record<string, Record<string, number>> = {};
  for (const k of kinds) { const cls = [...new Set(C.flatMap(r => Object.keys(r.flowsPerSeason[k] ?? {})))]; flows[k] = Object.fromEntries(cls.map(c => [c, C.reduce((a, r) => a + (r.flowsPerSeason[k]?.[c] ?? 0), 0) / C.length])); }
  summary[regions] = { population: pop, archetypes: byA, supply, flowsChessOnly: flows };
}
writeFileSync(out, JSON.stringify(summary, null, 1));
console.log(md.join('\n'));
