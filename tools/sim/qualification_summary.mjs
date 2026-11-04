/**
 * Summarise tools/sim/qualification.mts output (one or more JSONL files) as a Markdown table, recomputed from the
 * per-run season lines (so it also reads output of the v0.11 script, which had no field-strength columns).
 *   node tools/sim/qualification_summary.mjs docs/sim/qualification-v3-16.jsonl [...]
 */
import { readFileSync } from 'node:fs';

const runs = [], summaries = [];
for (const f of process.argv.slice(2)) for (const line of readFileSync(f, 'utf8').split('\n')) {
  if (!line.trim().startsWith('{')) continue;
  const o = JSON.parse(line);
  if (o.seasons !== undefined) runs.push(o);
  else if (o.summary) summaries.push(o.summary);
}
const key = r => `${r.regions}|${r.rules}|${r.strength}`;
const groups = new Map();
for (const r of runs) { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const rows = [];
for (const [k, rs] of groups) {
  const [regions, rules, strength] = k.split('|').map(Number);
  const firsts = [], apps = [];
  let crown = 0, path = 0, open = 0, zone = 0, league = 0, seasons = 0, crownSeasons = 0, zonal = 0, zonalWon = 0;
  for (const r of rs) {
    const ss = r.seasons.split(/ (?=\d+:D)/);
    seasons = Math.max(seasons, ss.length);
    const champ = ss.filter(s => s.includes('/CHAMP('));
    apps.push(champ.length);
    const first = champ.length ? +champ[0].split(':')[0] : null;
    if (first !== null) firsts.push(first);
    if (ss.some(s => s.includes(':D1#'))) crown++;
    crownSeasons += ss.filter(s => s.includes(':D1#')).length; zonal += ss.filter(s => /\/zon|\/ZON!/.test(s)).length; zonalWon += ss.filter(s => s.includes('/ZON!')).length;
    for (const s of champ) { if (s.includes(',path)')) path++; else if (s.includes(',open)')) open++; else if (s.includes(',zone)')) zone++; else if (s.includes(',league)')) league++; }
  }
  const sm = summaries.find(s => s.regions === regions && s.rules === rules && s.strength === strength && s.runs === rs.length);
  const fsx = sm?.champField;
  firsts.sort((a, b) => a - b);
  rows.push({ regions, rules, strength, runs: rs.length, seasons, reached: firsts.length, firsts, median: firsts.length ? firsts[Math.floor((firsts.length - 1) / 2)] : null, apps: apps.reduce((a, b) => a + b, 0), via: { path, open, zone, league }, crown, crownSeasons, zonal, zonalWon, field: fsx });
}
rows.sort((a, b) => a.regions - b.regions || a.strength - b.strength || a.rules - b.rules);
console.log('| World | Strength | Rules | Runs reaching the Championship | First season (each run that qualified) | Championship appearances (all runs) | via path / open / zone / league | Runs reaching the Crown Division | Zonal entries (wins) / Crown Division seasons | Championship field: median / weakest latent (path holders, mean strength) |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const via = r.rules >= 3 ? `${r.via.path} / ${r.via.open} / ${r.via.zone} / ${r.via.league}` : `– / ${r.via.open} / ${r.via.zone} / ${r.via.league}`;
  const f = r.field ? `${r.field.medianLatent} / ${r.field.weakestLatent}${r.field.pathHolders ? ` (${r.field.pathHolders}, ${r.field.pathMeanStrength})` : ''}` : '–';
  console.log(`| ${r.regions === 16 ? '2,048' : r.regions === 80 ? '10,240' : r.regions * 128} | ${r.strength} | ${r.rules} | ${r.reached}/${r.runs} | ${r.firsts.length ? r.firsts.join(', ') : '–'} | ${r.apps} / ${r.runs * r.seasons} | ${via} | ${r.crown}/${r.runs} | ${r.zonal} (${r.zonalWon}) / ${r.crownSeasons} | ${f} |`);
}
