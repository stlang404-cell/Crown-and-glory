import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ROSTER_IDENTITIES, ROSTER_CATEGORIES, ROSTER_REGIONS, MAX_DEATH_YEAR, FOUNDING_PERSONA_SHARE, applyFoundingPersonas, assignEntrantPersonas, rosterIdentity, lifespan,
} from '../src/federation/rosterPersonas';
import { rosterDocSection, DOC_BEGIN, DOC_END } from '../src/federation/rosterDoc';
import { generateFederation } from '../src/federation/generator';
import { createWorld, Ctx, RoundRecord } from '../src/federation/world';
import { runRoundHeadless } from '../src/federation/driver';
import { ROUNDS_PER_SEASON, topologyWithRegions } from '../src/federation/model';
import type { Competitor } from '../src/federation/model';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';

/** Names the policy explicitly rules out (docs/ROSTER.md): living people, people who died after 1925, atrocity
 *  figures, conquerors, religious founders and figures of worship, and the conservatively omitted. */
const EXCLUDED = [
  'Taylor Swift', 'Beyoncé', 'Beyonce', 'Serena Williams', 'Magnus Carlsen', 'Lionel Messi', 'LeBron James', 'Donald Trump', 'Joe Biden', 'Barack Obama', 'Vladimir Putin', 'Xi Jinping', 'Narendra Modi', 'Emmanuel Macron', 'Keir Starmer',
  'Albert Einstein', 'Marie Curie', 'Claude Monet', 'Harry Houdini', 'Annie Oakley', 'Antoni Gaudí', 'Rudolph Valentino', 'Rainer Maria Rilke', 'Mary Cassatt', 'Gertrude Bell', 'Bessie Coleman', 'Fred Spofforth', 'Camillo Golgi', 'Thomas Edison', 'Nikola Tesla', 'Mahatma Gandhi', 'Emanuel Lasker', 'Siegbert Tarrasch', 'Arthur Conan Doyle', 'Sigmund Freud', 'Winston Churchill',
  'Adolf Hitler', 'Joseph Stalin', 'Pol Pot', 'Genghis Khan', 'Timur', 'Attila', 'Vlad the Impaler', 'Ivan the Terrible', 'Caligula', 'Nero', 'Leopold II of Belgium', 'Ranavalona I', 'Christopher Columbus', 'Hernán Cortés', 'Francisco Pizarro', 'Vasco da Gama', 'Henry Morton Stanley', 'Cecil Rhodes', 'Andrew Jackson',
  'Alexander the Great', 'Julius Caesar', 'Napoleon', 'Napoleon Bonaparte',
  'Jesus', 'Muhammad', 'Gautama Buddha', 'Moses', 'Zoroaster', 'Confucius', 'Laozi', 'Guru Nanak', 'Martin Luther', 'Pythagoras', 'Joan of Arc', 'Francis of Assisi', 'Hildegard of Bingen', 'Thomas Aquinas', 'Mary MacKillop', 'Rumi', 'Kabir', 'Emperor Meiji', 'Chulalongkorn', 'Augustus', 'Akbar', 'Auguste Comte', 'Ram Mohan Roy', 'Miguel Hidalgo', 'Sor Juana Inés de la Cruz',
  'Juan Luna', 'Max Linder', 'Caravaggio', 'Paul Gauguin', 'Egon Schiele', 'Richard Wagner', 'P. T. Barnum', 'Cap Anson', 'Ned Kelly', 'Mata Hari', 'Jean-Jacques Dessalines', 'Tipu Sultan',
];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

describe('historical roster data (crown-roster-1)', () => {
  it('has a few hundred identities across every category and region', () => {
    expect(ROSTER_IDENTITIES.length).toBeGreaterThanOrEqual(250);
    expect(ROSTER_IDENTITIES.length).toBeLessThanOrEqual(450);
    for (const c of ROSTER_CATEGORIES) expect(ROSTER_IDENTITIES.filter(r => r.category === c).length, c).toBeGreaterThanOrEqual(10);
    for (const g of ROSTER_REGIONS) expect(ROSTER_IDENTITIES.filter(r => r.region === g).length, g).toBeGreaterThanOrEqual(5);
    // global spread: Europe is not the majority
    expect(ROSTER_IDENTITIES.filter(r => r.region === 'Europe').length).toBeLessThan(ROSTER_IDENTITIES.length / 2);
  });

  it('every entry: died in 1925 or earlier, born before death, well-formed fields', () => {
    for (const r of ROSTER_IDENTITIES) {
      const where = `${r.id} ${r.name}`;
      expect(Number.isInteger(r.born) && Number.isInteger(r.died), where).toBe(true);
      expect(r.died, where).toBeLessThanOrEqual(MAX_DEATH_YEAR);
      expect(r.born, where).toBeLessThan(r.died);
      expect(r.died - r.born, where).toBeLessThanOrEqual(110);
      expect(r.died - r.born, where).toBeGreaterThanOrEqual(15);
      expect(ROSTER_CATEGORIES as readonly string[], where).toContain(r.category);
      expect(ROSTER_REGIONS as readonly string[], where).toContain(r.region);
      expect(r.id, where).toMatch(/^hist-[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(r.name.trim(), where).toBe(r.name);
      expect(r.name.length, where).toBeGreaterThan(2);
      expect(r.descriptor.length, where).toBeGreaterThan(5);
      expect(r.descriptor.length, where).toBeLessThanOrEqual(100);
      expect(r.reference.trim().length, where).toBeGreaterThan(2);
      expect(r.circa === undefined || r.circa === true, where).toBe(true);
      expect(Object.keys(r).sort(), where).toEqual(['born', 'category', 'circa', 'descriptor', 'died', 'id', 'name', 'reference', 'region'].filter(k => k !== 'circa' || r.circa));
    }
  });

  it('ids, display names and references are unique', () => {
    const uniq = (xs: string[]) => new Set(xs).size === xs.length;
    expect(uniq(ROSTER_IDENTITIES.map(r => r.id))).toBe(true);
    expect(uniq(ROSTER_IDENTITIES.map(r => fold(r.name)))).toBe(true);
    expect(uniq(ROSTER_IDENTITIES.map(r => r.reference))).toBe(true);
  });

  it('none of the explicitly excluded people appear', () => {
    const names = new Set(ROSTER_IDENTITIES.map(r => fold(r.name)));
    const refs = new Set(ROSTER_IDENTITIES.map(r => fold(r.reference)));
    for (const x of EXCLUDED) {
      expect(names.has(fold(x)), x).toBe(false);
      expect(refs.has(fold(x)), x).toBe(false);
    }
    // and no display name merely contains a living/after-1925 headline name (e.g. "Albert Einstein II")
    for (const r of ROSTER_IDENTITIES) for (const x of ['Einstein', 'Swift Taylor', 'Taylor Swift', 'Beyonc', 'Serena Williams', 'Marie Curie', 'Hitler', 'Stalin']) expect(fold(r.name).includes(fold(x)), `${r.name} ~ ${x}`).toBe(false);
  });

  it('lifespans render, including BC and circa', () => {
    expect(lifespan(rosterIdentity('hist-ada-lovelace')!)).toBe('1815–1852');
    expect(lifespan(rosterIdentity('hist-socrates')!)).toBe('c. 470 BC – 399 BC');
  });

  it('docs/ROSTER.md provenance table is generated from the data and up to date', () => {
    const doc = readFileSync(new URL('../docs/ROSTER.md', import.meta.url), 'utf8');
    const a = doc.indexOf(DOC_BEGIN), b = doc.indexOf(DOC_END);
    expect(a).toBeGreaterThan(0);
    expect(doc.slice(a, b + DOC_END.length)).toBe(rosterDocSection());
    for (const x of ['Taylor Swift', 'Beyoncé', 'Serena Williams', 'Albert Einstein', 'Marie Curie']) expect(doc.slice(0, a)).toContain(x);
  });
});

const strip = (c: Competitor) => { const { name: _n, persona: _p, ...rest } = c; void _n; void _p; return JSON.stringify(rest); };

describe('persona integration', () => {
  it('a new federation: a seeded share carries personas, no duplicates, attributes untouched, deterministic', () => {
    const plain = generateFederation(11);
    const a = generateFederation(11), b = generateFederation(11);
    const n = applyFoundingPersonas(11, a);
    applyFoundingPersonas(11, b);
    expect(n).toBe(Math.round(2048 * FOUNDING_PERSONA_SHARE));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const personas = a.filter(c => c.persona);
    expect(personas).toHaveLength(n);
    expect(new Set(personas.map(c => c.persona)).size).toBe(n);
    expect(new Set(a.map(c => c.name)).size).toBe(a.length);
    for (const c of personas) expect(c.name).toBe(rosterIdentity(c.persona)!.name);
    // only the name changes: ids, strength, rating, style, region, division, age are those of the plain generation
    a.forEach((c, i) => { expect(c.id).toBe(plain[i].id); expect(strip(c)).toBe(strip(plain[i])); });
    for (const c of a.filter(x => !x.persona)) expect(c.name).toBe(plain[a.indexOf(c)].name);
    // a different seed chooses different slots and identities
    const c2 = generateFederation(12); applyFoundingPersonas(12, c2);
    expect(c2.filter(c => c.persona).map(c => `${c.id}:${c.persona}`).join()).not.toBe(personas.map(c => `${c.id}:${c.persona}`).join());
    // applying twice is a no-op
    expect(applyFoundingPersonas(11, a)).toBe(0);
  });

  it('placement is independent of the person: personas spread over every division and region', () => {
    const a = generateFederation(5); applyFoundingPersonas(5, a);
    const p = a.filter(c => c.persona);
    expect(new Set(p.map(c => c.division)).size).toBe(8);
    expect(new Set(p.map(c => c.region)).size).toBe(16);
    // famous and obscure identities are not sorted by rating: mean rating of personas ≈ population mean
    const mean = (xs: Competitor[]) => xs.reduce((s, c) => s + c.rating, 0) / xs.length;
    expect(Math.abs(mean(p) - mean(a))).toBeLessThan(120);
  });

  it('caps founding personas for very large federations so later entrants still bring new identities', () => {
    const big = generateFederation(3, topologyWithRegions(64)); // 8,192 competitors
    const n = applyFoundingPersonas(3, big);
    expect(n).toBe(Math.floor(ROSTER_IDENTITIES.length * 0.6));
    expect(new Set(big.map(c => c.name)).size).toBe(big.length);
  });

  it('an existing (v0.9-style) world: no competitor is renamed; personas enter only as new entrants', () => {
    const run = () => {
      const comps = generateFederation(42); // founded before v0.10: no founding personas
      const before = new Map(comps.map(c => [c.id, c.name]));
      const { world, plan } = createWorld(42, comps, 'T');
      const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 350, name: 'You' }, swissHistory: [] };
      const entrants: Competitor[] = [];
      for (let s = 0; s < 3; s++) {
        const rounds: RoundRecord[] = [];
        for (let r = 0; r < ROUNDS_PER_SEASON; r++) { const p = runRoundHeadless(ctx, rounds); rounds.push(p.record); if (p.seasonEnd) entrants.push(...p.seasonEnd.entrants); }
      }
      return { ctx, before, entrants };
    };
    const { ctx, before, entrants } = run();
    for (const [id, name] of before) { const c = ctx.competitors.get(id)!; expect(c.name).toBe(name); expect(c.persona).toBeUndefined(); }
    expect(entrants.length).toBeGreaterThan(20);
    const p = entrants.filter(e => e.persona);
    expect(p.length).toBeGreaterThan(0);
    expect(p.length).toBeLessThan(entrants.length);
    expect(new Set(p.map(e => e.persona)).size).toBe(p.length);
    expect(new Set([...ctx.competitors.values()].map(c => c.name)).size).toBe(ctx.competitors.size);
    for (const e of p) expect(e.name).toBe(rosterIdentity(e.persona)!.name);
    // deterministic
    const again = run();
    expect(again.entrants.map(e => `${e.id}:${e.name}:${e.persona ?? ''}`).join()).toBe(entrants.map(e => `${e.id}:${e.name}:${e.persona ?? ''}`).join());
  }, 120_000);

  it('entrant personas never reuse an identity already in the world (even a retired one)', () => {
    const comps = generateFederation(9); applyFoundingPersonas(9, comps);
    const used = new Set(comps.map(c => c.persona).filter(Boolean));
    const entrants = generateFederation(9).slice(0, 400).map((c, i) => ({ ...c, id: `e${i}`, name: `Entrant ${i}` }));
    comps[0].status = 'retired';
    const got = assignEntrantPersonas(9, 4, entrants, [...comps, ...entrants]);
    expect(got.length).toBeGreaterThan(20);
    for (const e of entrants.filter(x => x.persona)) expect(used.has(e.persona)).toBe(false);
    expect(new Set(entrants.filter(x => x.persona).map(x => x.persona)).size).toBe(got.length);
  });

  it('founding through the service gives a new federation its personas, and they persist across a reload', async () => {
    let clock = 0;
    const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
    const f = new IDBFactory();
    const svc = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await svc.create(2, 777);
    const personas = [...svc.state!.competitors.values()].filter(c => c.persona);
    expect(personas.length).toBe(Math.round(2048 * FOUNDING_PERSONA_SHARE));
    const svc2 = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await svc2.load();
    for (const c of personas) { const d = svc2.state!.competitors.get(c.id)!; expect(d.name).toBe(c.name); expect(d.persona).toBe(c.persona); }
  });
});
