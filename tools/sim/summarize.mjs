/** Summarise a crown-sim-2 economy run across seeds (mean ± SD) as Markdown.  node tools/sim/summarize.mjs docs/sim/economy-v4.json */
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const by = new Map();
for (const r of d.results) { if (!by.has(r.strategy)) by.set(r.strategy, []); by.get(r.strategy).push(r); }
const ms = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); return `${Math.round(m)} ± ${Math.round(sd)}`; };
const last = r => r.seasons[r.seasons.length - 1];
console.log(`Run ${d.id}: ${d.seasons} seasons × seeds ${d.seeds.join(', ')} (${d.seconds} s)\n`);
console.log('| Strategy | Final division | Cash | Net worth | Trading P&L | Contracts (earned − paid) | Club level | Titles | Conserved & no negative accounts |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [k, rs] of by) {
  const ok = rs.every(r => r.seasons.every(s => s.conserved && s.negativeAccounts === 0));
  console.log(`| ${k} | ${ms(rs.map(r => last(r).playerDivision))} | ${ms(rs.map(r => last(r).cash))} | ${ms(rs.map(r => last(r).netWorth))} | ${ms(rs.map(r => r.tradeReceived - r.tradeSpent))} | ${ms(rs.map(r => last(r).contractsEarned - last(r).contractsPaid))} | ${ms(rs.map(r => last(r).clubLevel))} | ${ms(rs.map(r => r.seasons.reduce((a, s) => a + s.titles.length, 0)))} | ${ok ? 'yes' : 'NO'} |`);
}
const all = d.results;
const growth = all.map(r => { const s = r.seasons; return s.length > 1 ? 100 * (s[s.length - 1].circulating / s[s.length - 2].circulating - 1) : 0; });
console.log(`\nCirculating-supply growth in the last season: ${ms(growth.map(x => x * 10)).replace(/(-?\d+) ± (\d+)/, (_, a, b) => `${(a / 10).toFixed(1)}% ± ${(b / 10).toFixed(1)}`)} (all runs)`);
console.log(`Treasury at the end: ${ms(all.map(r => last(r).treasury))} ₵ · NPC wallets: ${ms(all.map(r => last(r).npcWallets))} ₵`);
console.log(`Earnings Gini: ${ms(all.map(r => 1000 * last(r).earningsGini)).replace(/(\d+) ± (\d+)/, (_, a, b) => `${(a / 1000).toFixed(3)} ± ${(b / 1000).toFixed(3)}`)} · top-1% share ${ms(all.map(r => 1000 * last(r).top1pctEarningsShare)).replace(/(\d+) ± (\d+)/, (_, a, b) => `${(a / 1000).toFixed(3)} ± ${(b / 1000).toFixed(3)}`)}`);
console.log(`Market maker over all settled markets: total ${ms(all.map(r => last(r).makerPnlTotal))} ₵ · worst single market ${Math.min(...all.map(r => last(r).makerWorstMarket)).toFixed(1)} ₵`);
console.log(`Settled markets per run by family: ${JSON.stringify(last(all[0]).settledByKind)}`);
