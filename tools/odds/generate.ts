/**
 * Odds-model fit data (crown-odds-2): federation-style engine games with PUBLIC ratings/RDs and the engine's own
 * published per-move evaluation, generated exactly as featured live games are played (profileForStrength(latent,
 * 30k node cap), competitor style, Crown adjudication, 400-ply limit).
 *   npx tsx tools/odds/generate.ts <worldSeed> <games> <out.json> [seasons=3]
 * The population is the shipped generator run headless for `seasons` seasons so that public ratings and RDs carry
 * realistic estimation error. Latent strength is recorded for diagnostics only; the model never reads it.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { generateFederation, hashSeed, rng01 } from '../../src/federation/generator';
import { createWorld, Ctx, RoundRecord } from '../../src/federation/world';
import { runRoundHeadless } from '../../src/federation/driver';
import { ROUNDS_PER_SEASON, Competitor } from '../../src/federation/model';
import { profileForStrength } from '../../src/federation/profiles';
import { playSelfplay } from '../../src/engine/selfplay';
import { START_FEN } from '../../src/rules/types';

const SEED = +(process.argv[2] ?? 1), N = +(process.argv[3] ?? 10), OUT = process.argv[4] ?? 'odds-games.json', SEASONS = +(process.argv[5] ?? 3);
const NODE_CAP = 30_000; // FEATURED_NODE_CAP in src/app/federation.ts

const comps = generateFederation(SEED);
const { world, plan } = createWorld(SEED, comps, 'T');
const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 350, name: 'You' }, swissHistory: [] };
for (let s = 0; s < SEASONS; s++) { const rounds: RoundRecord[] = []; for (let r = 0; r < ROUNDS_PER_SEASON; r++) rounds.push(runRoundHeadless(ctx, rounds).record); }
const active = [...ctx.competitors.values()].filter(c => c.status === 'active');
const byDiv = new Map<string, Competitor[]>();
for (const c of active) { const k = `${c.region}:${c.division}`; byDiv.set(k, [...(byDiv.get(k) ?? []), c]); }

/** material from a FEN board: [white non-pawn, black non-pawn, white pawns, black pawns] (N3 B3 R5 Q9). */
function material(fen: string): number[] {
  const v: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };
  const m = [0, 0, 0, 0];
  for (const ch of fen.split(' ')[0]) {
    const lo = ch.toLowerCase(), white = ch !== lo;
    if (lo === 'p') m[white ? 2 : 3]++; else if (v[lo]) m[white ? 0 : 1] += v[lo];
  }
  return m;
}

const out: unknown[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const t0 = Date.now();
for (let g = out.length; g < N; g++) {
  // pairing mix: 60% same circuit (league), 40% across adjacent divisions in one region (Swiss/cup-like gaps);
  // division weights favour the top (featured games come from top events) but cover the whole ladder
  const rr = rng01(hashSeed(SEED, 'pair', g));
  const div = 1 + Math.min(7, Math.floor(-Math.log(1 - rr()) * 2.2));
  const region = Math.floor(rr() * 16);
  const A = byDiv.get(`${region}:${div}`)!;
  const div2 = rr() < 0.6 ? div : Math.max(1, Math.min(8, div + (rr() < 0.5 ? -1 : 1)));
  const B = byDiv.get(`${region}:${div2}`)!;
  const a = A[Math.floor(rr() * A.length)];
  let b = B[Math.floor(rr() * B.length)];
  if (b.id === a.id) b = B[(B.indexOf(b) + 1) % B.length];
  const [w, bl] = rr() < 0.5 ? [a, b] : [b, a];
  const seed = hashSeed(SEED, 'game', g);
  const ts = Date.now();
  const res = playSelfplay(START_FEN, { profile: profileForStrength(w.latent, NODE_CAP), style: w.style }, { profile: profileForStrength(bl.latent, NODE_CAP), style: bl.style }, seed, 400);
  out.push({
    id: `s${SEED}g${g}`, white: { id: w.id, rating: Math.round(w.rating), rd: Math.round(w.rd), latent: w.latent, style: w.style, division: w.division },
    black: { id: bl.id, rating: Math.round(bl.rating), rd: Math.round(bl.rd), latent: bl.latent, style: bl.style, division: bl.division },
    result: res.result, termination: res.termination, plies: res.moves.length, ms: Date.now() - ts,
    // per ply (after the move): engine score as published (white POV cp, or mate/terminal), and material
    evals: res.moves.map(m => { const s = m.score; const sw = s.pov === 'white' ? 1 : -1; return s.kind === 'cp' ? sw * s.value : s.kind === 'mate' ? sw * (s.plies > 0 ? 1 : -1) * 100000 : (s.outcome === 'draw' ? 0 : sw * (s.outcome === 'win' ? 1 : -1) * 100000); }),
    material: res.moves.map(m => material(m.fen)),
  });
  if (g % 5 === 4 || g === N - 1) writeFileSync(OUT, JSON.stringify(out));
  process.stderr.write(`${g + 1}/${N} ${w.rating}/${bl.rating} ${res.result} ${res.moves.length}p ${((Date.now() - ts) / 1000).toFixed(1)}s total ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
}
writeFileSync(OUT, JSON.stringify(out));
