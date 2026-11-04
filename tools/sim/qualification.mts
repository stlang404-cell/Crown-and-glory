/**
 * Qualification simulation (crown-competition-2 and -3, docs/V3_COMPETITION_RULES.md): how often does a player of a given
 * strength reach each competition of the shared Federation? Runs the shipped pure world code headless (no storage),
 * with a joined player whose games are drawn from the same result model as every summary game, at the player's fixed
 * strength (rating = strength, i.e. a settled rating). The player registers for their Swiss event every season (and
 * takes up a Federation Open invitation when they have one). Every other game is the normal AI calendar.
 *
 *   npx tsx tools/sim/qualification.mts [regions=16] [seasons=10] [seeds=3] [strengths=1600,2000,2400,2800] [rules=3]
 *
 * Prints one JSON line per (strength, seed) and a summary per strength. Season codes: D<division>#<league place>,
 * /c<n> or /o<n> Challenger / Federation Open (best possible place on points), i = invited, /cup or /CUP! (won),
 * /zon or /ZON!, /CHAMP(<stage reached>, via zone|league|open|path). v1.0 additions: how the player qualified, and
 * the strength of every Championship field (hidden latent of its 16 qualifiers: median and weakest, and of the
 * Crown Path place holders) so a fairer path can be checked for not weakening the Championship.
 */
import { generateFederation, hashSeed, rng01 } from '../../src/federation/generator.ts';
import { createWorld, joinPlayer, registerChallenger, swissEventsOpenTo, type Ctx, type RoundRecord } from '../../src/federation/world.ts';
import { runRoundHeadless } from '../../src/federation/driver.ts';
import { PLAYER_ID, ROUNDS_PER_SEASON, SWISS_ROUNDS, topologyWithRegions } from '../../src/federation/model.ts';
import { NEW_FEDERATION_POPULATION } from '../../src/federation/population.ts';
import { sampleResult } from '../../src/federation/resultModel.ts';

const REGIONS = +(process.argv[2] ?? 16), SEASONS = +(process.argv[3] ?? 10), SEEDS = +(process.argv[4] ?? 3);
const STRENGTHS = (process.argv[5] ?? '1600,2000,2400,2800').split(',').map(Number);
const RULES = +(process.argv[6] ?? 3);
const topo = topologyWithRegions(REGIONS);

type SeasonLog = { season: number; division: number; rank: number; swiss: string | null; swissRank: number | null; invited: boolean; champ: boolean; champBest: string | null; via: string | null; zonal: boolean; zonalWon: boolean; cup: boolean; cupWon: boolean; crownChampion: boolean };

function run(strength: number, seed: number): SeasonLog[] {
  const comps = generateFederation(seed, topo, NEW_FEDERATION_POPULATION);
  const { world, plan } = createWorld(seed, comps, 'T', topo, NEW_FEDERATION_POPULATION, RULES);
  const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: strength, rd: 60, name: 'You' }, swissHistory: [], targetRules: RULES };
  joinPlayer(ctx, 3 % REGIONS);
  const logs: SeasonLog[] = [];
  let rounds: RoundRecord[] = [];
  const strengthOf = (id: string) => (id === PLAYER_ID ? strength : ctx.competitors.get(id)!.latent);
  for (let s = 0; s < SEASONS; s++) {
    const season = ctx.world.season;
    const division = ctx.world.player.division;
    const invited = ctx.world.player.invite?.season === season;
    const evs = swissEventsOpenTo(ctx.world);
    let swiss: string | null = null;
    if (evs.length) { registerChallenger(ctx, evs[0]); swiss = evs[0]; }
    let swissRank: number | null = null;
    for (let r = 1; r <= ROUNDS_PER_SEASON; r++) {
      const before = ctx.plan;
      const res = runRoundHeadless(ctx, rounds, 'T', f => sampleResult(strengthOf(f.white), strengthOf(f.black), rng01(hashSeed(seed, 'player-sim', f.id))()));
      rounds = [...rounds, res.record];
      if (r === SWISS_ROUNDS[SWISS_ROUNDS.length - 1] && swiss) {
        const sw = before.swiss.find(x => x.event === swiss)!;
        // recompute the final Swiss table from the season's games
        const games = rounds.flatMap(x => [...x.abstract.map(([e, w, b, rr]) => ({ event: e, white: w, black: b, result: rr })), ...x.fixtures.map(f => ({ event: f.event, white: f.white, black: f.black, result: f.result }))]).filter(g => g.event === swiss);
        const pts = new Map<string, number>(sw.entrants.map(id => [id, 0]));
        for (const g of games) { pts.set(g.white, (pts.get(g.white) ?? 0) + (g.result ?? 0)); pts.set(g.black, (pts.get(g.black) ?? 0) + 1 - (g.result ?? 0)); }
        for (const [id, b] of Object.entries(sw.byes)) pts.set(id, (pts.get(id) ?? 0) + b);
        const mine = pts.get(PLAYER_ID) ?? 0;
        swissRank = 1 + [...pts.values()].filter(v => v > mine).length; // best possible place on points
      }
      if (r === ROUNDS_PER_SEASON) {
        const champ = before.champ;
        const cups = before.cups ?? [];
        const myZonal = cups.find(k => k.kind === 'zonal' && k.qualifiers.includes(PLAYER_ID));
        const myCup = cups.find(k => k.kind === 'cup' && k.qualifiers.includes(PLAYER_ID));
        let champBest: string | null = null;
        const qual = champ?.qualifiers ?? [];
        const lat = qual.filter(id => id !== PLAYER_ID).map(id => ctx.competitors.get(id)!.latent).sort((a, b) => a - b);
        if (lat.length) fields.push({ median: lat[Math.floor(lat.length / 2)], min: lat[0], path: (champ?.pathPlaces ?? []).map(id => strengthOf(id)) });
        const i = qual.indexOf(PLAYER_ID);
        const via = i < 0 ? null : champ?.pathPlaces?.includes(PLAYER_ID) ? 'path' : i >= 8 ? 'open' : ctx.world.crownQualified?.season === season && ctx.world.crownQualified.ids.includes(PLAYER_ID) ? 'zone' : 'league';
        if (champ?.qualifiers.includes(PLAYER_ID)) for (const sg of champ.stages) if (sg.matches.some(m => m.a === PLAYER_ID || m.b === PLAYER_ID)) champBest = sg.label;
        const hist = ctx.world.player.history.find(h => h.season === season);
        logs.push({ season, division, rank: hist?.rank ?? 0, swiss, swissRank, invited, champ: !!champ?.qualifiers.includes(PLAYER_ID), champBest, via, zonal: !!myZonal, zonalWon: !!myZonal?.champions.includes(PLAYER_ID), cup: !!myCup, cupWon: !!myCup?.champions.includes(PLAYER_ID), crownChampion: !!champ?.champions.includes(PLAYER_ID) });
        rounds = [];
      }
    }
  }
  return logs;
}

const fields: { median: number; min: number; path: number[] }[] = [];
const t0 = Date.now();
const summary: Record<string, unknown>[] = [];
for (const strength of STRENGTHS) {
  const all: SeasonLog[][] = [];
  fields.length = 0;
  for (let k = 0; k < SEEDS; k++) {
    const seed = 1000 + k * 7919;
    const logs = run(strength, seed);
    all.push(logs);
    console.log(JSON.stringify({ regions: REGIONS, rules: RULES, strength, seed, seasons: logs.map(l => `${l.season}:D${l.division}#${l.rank}${l.swiss ? `/${l.swiss[0]}${l.swissRank}` : ''}${l.invited ? 'i' : ''}${l.cup ? (l.cupWon ? '/CUP!' : '/cup') : ''}${l.zonal ? (l.zonalWon ? '/ZON!' : '/zon') : ''}${l.champ ? `/CHAMP(${l.champBest},${l.via})` : ''}`).join(' ') }));
  }
  const flat = all.flat();
  const first = (pred: (l: SeasonLog) => boolean) => all.map(ls => ls.find(pred)?.season ?? null);
  const firstChamp = first(l => l.champ);
  const reached = firstChamp.filter((x): x is number => x !== null);
  summary.push({
    regions: REGIONS, rules: RULES, strength, runs: SEEDS, seasonsEach: SEASONS,
    reachedCrownDivision: first(l => l.division === 1),
    champQualifiedRuns: `${reached.length}/${SEEDS}`, firstChampSeason: firstChamp,
    champSeasons: flat.filter(l => l.champ).length, champVia: Object.fromEntries(['zone', 'league', 'open', 'path'].map(v => [v, flat.filter(l => l.via === v).length])),
    champField: fields.length ? { seasons: fields.length, medianLatent: Math.round(fields.reduce((a, f) => a + f.median, 0) / fields.length), weakestLatent: Math.round(fields.reduce((a, f) => a + f.min, 0) / fields.length), pathHolders: fields.reduce((a, f) => a + f.path.length, 0), pathMeanStrength: fields.some(f => f.path.length) ? Math.round(fields.flatMap(f => f.path).reduce((a, b) => a + b, 0) / fields.flatMap(f => f.path).length) : null } : null,
    crownTitles: flat.filter(l => l.crownChampion).length,
    zonalEntries: flat.filter(l => l.zonal).length, zonalWins: flat.filter(l => l.zonalWon).length,
    cupEntries: flat.filter(l => l.cup).length, cupWins: flat.filter(l => l.cupWon).length, openInvites: flat.filter(l => l.invited).length,
    seasonsInDiv1to4: flat.filter(l => l.division <= 4).length,
    champRateWhenDiv1to4: flat.filter(l => l.division <= 4).length ? +(flat.filter(l => l.division <= 4 && l.champ).length / flat.filter(l => l.division <= 4).length).toFixed(3) : null,
  });
}
for (const s of summary) console.log(JSON.stringify({ summary: s }));
console.log(JSON.stringify({ ms: Date.now() - t0 }));
