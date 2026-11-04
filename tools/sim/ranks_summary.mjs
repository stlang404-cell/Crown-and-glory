// Summarise tools/sim/ranks_sim.mts reports:  node tools/sim/ranks_summary.mjs docs/sim/ranks_*.json
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(2)) {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  console.log('==', f, `regions ${r.regions}, seasons ${r.seasons}, seed ${r.seed}`);
  for (const p of r.players) console.log('player', JSON.stringify(p));
  console.log('rule | step change / checkpoint | reversed next checkpoint (of moves) | reversals / competitor-checkpoint | local step share | division bottom→top checkpoints');
  for (const x of r.rules) console.log(x.rule, '|', x.stepChangePerCheckpoint, '|', x.reversedAtNextCheckpoint, '|', x.reversalsPerCompetitorCheckpoint, '|', JSON.stringify(x.localStepShare), '|', JSON.stringify(x.divisionBottomToTopCheckpoints));
  console.log('per grade (shipped):', JSON.stringify(r.rules[0].perGrade));
}
