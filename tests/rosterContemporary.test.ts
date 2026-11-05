import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  CONTEMPORARY_IDENTITIES, ROSTER_IDENTITIES, ROSTER_CATEGORIES, ROSTER_REGIONS, OWNER_NAMED_CONTEMPORARY, OWNER_NAMED_HISTORICAL, CONTEMPORARY_DISCLOSURE,
  applyFoundingPersonas, assignEntrantPersonas, applyNameMode, displayNameOf, shownPersona, contemporaryIdentity, rosterIdentity, isContemporaryId,
} from '../src/federation/rosterPersonas';
import { generateFederation } from '../src/federation/generator';
import { createWorld, Ctx, RoundRecord } from '../src/federation/world';
import { runRoundHeadless } from '../src/federation/driver';
import { ROUNDS_PER_SEASON } from '../src/federation/model';
import type { Competitor } from '../src/federation/model';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s: string) => fold(s.replace(/ł/g, 'l').replace(/Ł/g, 'L')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Ruled out for the contemporary set (docs/ROSTER.md "Not used, and why"): atrocities, terrorism, violent crime,
 *  ICC warrants, convictions for violent/sexual crimes or a coup, primarily-scandal fame, religious figures of worship
 *  and clergy, minors and the pseudonymous, brand names, and entries left out because a fact was uncertain. */
const EXCLUDED = [
  'Adolf Hitler', 'Joseph Stalin', 'Mao Zedong', 'Pol Pot', 'Kim Jong Un', 'Kim Jong-un', 'Kim Il Sung', 'Saddam Hussein', 'Idi Amin', 'Muammar Gaddafi', 'Osama bin Laden', 'Benito Mussolini', 'Augusto Pinochet', 'Francisco Franco',
  'Vladimir Putin', 'Benjamin Netanyahu', 'Rodrigo Duterte', 'Omar al-Bashir',
  'Mike Tyson', 'Floyd Mayweather', 'Gérard Depardieu', 'Jair Bolsonaro', 'Conor McGregor', 'Neil Gaiman', 'O. J. Simpson', 'Harvey Weinstein', 'Jeffrey Epstein', 'R. Kelly',
  'Kim Kardashian', 'Paris Hilton',
  'Pope Francis', 'Pope Benedict XVI', 'Pope John Paul II', 'Dalai Lama', '14th Dalai Lama', 'Mother Teresa', 'Desmond Tutu', 'Haile Selassie', 'B. R. Ambedkar', 'Ruhollah Khomeini', 'Ali Khamenei', 'Akihito', 'Naruhito', 'Malcolm X', 'Billy Graham',
  'Anne Frank', 'Banksy', 'Satoshi Nakamoto', 'Elena Ferrante',
  'Walt Disney', 'Soichiro Honda', 'Enzo Ferrari', 'Coco Chanel', 'Henry Ford',
  'David Attenborough', 'Noam Chomsky', 'Jürgen Habermas', 'Wole Soyinka', 'Clint Eastwood', 'Sophia Loren', 'Kanye West', 'Johnny Depp', 'Will Smith', 'Fidel Castro', 'Che Guevara', 'Yasser Arafat', 'Aung San Suu Kyi', 'Sheikh Hasina',
  'Henry Kissinger', 'Richard Nixon', 'Wernher von Braun', 'Charles Lindbergh', 'Martin Heidegger', 'Alexander Alekhine',
];

describe('contemporary roster data (crown-roster-pub-1)', () => {
  it('has roughly 250–350 identities across every category and region, not dominated by one region', () => {
    const xs = CONTEMPORARY_IDENTITIES;
    expect(xs.length).toBeGreaterThanOrEqual(250);
    expect(xs.length).toBeLessThanOrEqual(360);
    for (const c of ROSTER_CATEGORIES) expect(xs.filter(r => r.category === c).length, c).toBeGreaterThanOrEqual(10);
    for (const g of ROSTER_REGIONS) expect(xs.filter(r => r.region === g).length, g).toBeGreaterThanOrEqual(5);
    expect(xs.filter(r => r.region === 'Europe' || r.region === 'North America').length).toBeLessThan(xs.length / 2);
    // leaders from every region of the world
    for (const g of ROSTER_REGIONS) expect(xs.some(r => r.category === 'statesman' && r.region === g), `statesman in ${g}`).toBe(true);
  });

  it('every entry: well-formed fields, names only (no personal data beyond the public identity)', () => {
    for (const r of CONTEMPORARY_IDENTITIES) {
      const where = `${r.id} ${r.name}`;
      expect(r.id, where).toBe(`pub-${slug(r.name)}`);
      expect(r.name.trim(), where).toBe(r.name);
      expect(r.name.length, where).toBeGreaterThan(2);
      expect(ROSTER_CATEGORIES as readonly string[], where).toContain(r.category);
      expect(ROSTER_REGIONS as readonly string[], where).toContain(r.region);
      expect(typeof r.living, where).toBe('boolean');
      expect(r.descriptor.length, where).toBeGreaterThan(5);
      expect(r.descriptor.length, where).toBeLessThanOrEqual(100);
      expect(r.reference.trim().length, where).toBeGreaterThan(2);
      expect(r.reference.trim(), where).toBe(r.reference);
      // reference: the name, or the name with a Wikipedia disambiguator
      expect(r.reference === r.name || r.reference.startsWith(`${r.name} (`), where).toBe(true);
      expect(Object.keys(r).sort(), where).toEqual(['category', 'descriptor', 'id', 'living', 'name', 'reference', 'region'].concat(r.born !== undefined ? ['born'] : []).sort());
      if (r.born !== undefined) expect(r.born > 1900 && r.born <= 2008, where).toBe(true); // adults only
      expect(isContemporaryId(r.id), where).toBe(true);
    }
  });

  it('descriptors are neutral profession lines (no claims about views, private life, health or controversies)', () => {
    const banned = /controvers|scandal|convict|accus|alleg|disgrac|infamous|notorious|criminal|war crime|\bcrimes\b|affair|illness|disease|cancer|died|death|killed|murder|divorce|married|wife|husband|greatest|best|worst|legendary|beloved|hated|far-right|far-left|populist|dictator|authoritarian|liberal|conservative|socialist|communist|nationalist/i;
    for (const r of CONTEMPORARY_IDENTITIES) expect(banned.test(r.descriptor), `${r.name}: ${r.descriptor}`).toBe(false);
  });

  it('ids, display names and references are unique across both sets', () => {
    const all = [...ROSTER_IDENTITIES, ...CONTEMPORARY_IDENTITIES];
    const uniq = (xs: string[]) => new Set(xs).size === xs.length;
    expect(uniq(all.map(r => r.id))).toBe(true);
    expect(uniq(all.map(r => fold(r.name)))).toBe(true);
    expect(uniq(all.map(r => r.reference))).toBe(true);
  });

  it('every owner-named person is present (contemporary and historical)', () => {
    expect(OWNER_NAMED_CONTEMPORARY).toHaveLength(14);
    for (const n of OWNER_NAMED_CONTEMPORARY) expect(CONTEMPORARY_IDENTITIES.some(r => r.name === n), n).toBe(true);
    for (const n of OWNER_NAMED_HISTORICAL) expect(ROSTER_IDENTITIES.some(r => r.name === n), n).toBe(true);
    expect(contemporaryIdentity('pub-taylor-swift')!.descriptor).toBe('American singer-songwriter');
    expect(contemporaryIdentity('pub-drake')!.reference).toBe('Drake (musician)');
    expect(contemporaryIdentity('pub-donald-trump')!.living).toBe(true);
    expect(contemporaryIdentity('pub-michael-jackson')!.living).toBe(false);
    expect(rosterIdentity('hist-julius-caesar')!.died).toBe(-44);
    expect(rosterIdentity('hist-napoleon-bonaparte')!.reference).toBe('Napoleon');
  });

  it('none of the excluded people appear in either set', () => {
    const all = [...ROSTER_IDENTITIES, ...CONTEMPORARY_IDENTITIES];
    const names = new Set(all.map(r => fold(r.name))), refs = new Set(all.map(r => fold(r.reference)));
    for (const x of EXCLUDED) {
      expect(names.has(fold(x)), x).toBe(false);
      expect(refs.has(fold(x)), x).toBe(false);
    }
  });

  it('the living flag is present on every entry and both values occur', () => {
    expect(CONTEMPORARY_IDENTITIES.every(r => typeof r.living === 'boolean')).toBe(true);
    expect(CONTEMPORARY_IDENTITIES.filter(r => r.living).length).toBeGreaterThan(100);
    expect(CONTEMPORARY_IDENTITIES.filter(r => !r.living).length).toBeGreaterThan(100);
  });
});

const strip = (c: Competitor) => { const { name: _n, persona: _p, altName: _a, ...rest } = c; void _n; void _p; void _a; return JSON.stringify(rest); };

describe('contemporary personas in a world', () => {
  it('a new world carries every owner-named person, on seeded-random competitors, with attributes untouched', () => {
    const plain = generateFederation(21);
    const a = generateFederation(21); applyFoundingPersonas(21, a);
    const pub = a.filter(c => isContemporaryId(c.persona));
    expect(pub).toHaveLength(123);
    expect(a.filter(c => c.persona?.startsWith('hist-'))).toHaveLength(164);
    for (const n of [...OWNER_NAMED_CONTEMPORARY, ...OWNER_NAMED_HISTORICAL]) expect(a.some(c => c.name === n), n).toBe(true);
    a.forEach((c, i) => { expect(c.id).toBe(plain[i].id); expect(strip(c)).toBe(strip(plain[i])); });
    // altName is the competitor's own generated name, unique in the world
    for (const c of pub) expect(c.altName).toBe(plain[a.indexOf(c)].name);
    const all = new Set([...a.map(c => c.name), ...pub.map(c => c.altName!)]);
    expect(all.size).toBe(a.length + pub.length);
    // another seed puts the owner-named people on other competitors
    const b = generateFederation(22); applyFoundingPersonas(22, b);
    const at = (xs: Competitor[], n: string) => xs.find(c => c.name === n)!.id;
    expect(OWNER_NAMED_CONTEMPORARY.filter(n => at(a, n) === at(b, n)).length).toBeLessThan(3);
  });

  it('contemporary personas span the rating spectrum and every division; their ratings are the population\'s', () => {
    const a = generateFederation(5); applyFoundingPersonas(5, a);
    const pub = a.filter(c => isContemporaryId(c.persona));
    const r = pub.map(c => c.rating).sort((x, y) => x - y);
    const all = a.map(c => c.rating).sort((x, y) => x - y);
    expect(r[0]).toBeLessThan(all[Math.floor(all.length * 0.1)]);
    expect(r[r.length - 1]).toBeGreaterThan(all[Math.floor(all.length * 0.9)]);
    expect(new Set(pub.map(c => c.division)).size).toBe(8);
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(Math.abs(mean(r) - mean(all))).toBeLessThan(150);
    // owner-named people are not systematically placed high or low
    const owners = a.filter(c => OWNER_NAMED_CONTEMPORARY.includes(c.name)).map(c => c.rating);
    expect(Math.max(...owners) - Math.min(...owners)).toBeGreaterThan(300);
  });

  it('"Show contemporary famous names" off: original names, ids and history unchanged, reversible', () => {
    const a = generateFederation(8); applyFoundingPersonas(8, a);
    const famous = new Map(a.map(c => [c.id, c.name]));
    const pub = a.filter(c => isContemporaryId(c.persona));
    pub[0].milestones.push({ season: 1, round: 2, text: `Upset win against ${pub[1].name} (+300 rated)` });
    const text = pub[0].milestones[0].text;
    const before = a.map(strip);
    expect(applyNameMode(a, false, { texts: true })).toBe(pub.length);
    for (const c of pub) { expect(c.name).toBe(c.altName); expect(shownPersona(c, false)).toBeNull(); expect(displayNameOf(c, false)).toBe(c.altName); }
    expect(pub[0].milestones[0].text).toBe(`Upset win against ${pub[1].altName} (+300 rated)`);
    for (const c of a.filter(x => !isContemporaryId(x.persona))) expect(c.name).toBe(famous.get(c.id));
    expect(new Set(a.map(c => c.name)).size).toBe(a.length);
    expect(a.filter(c => c.persona?.startsWith('hist-')).every(c => shownPersona(c, false)?.kind === 'historical')).toBe(true);
    // back on: the famous names and the text return; nothing else ever changed
    applyNameMode(a, true, { texts: true });
    for (const c of a) expect(c.name).toBe(famous.get(c.id));
    expect(pub[0].milestones[0].text).toBe(text);
    pub[0].milestones.pop();
    expect(a.map(strip)).toEqual(before.map((s, i) => (i === a.indexOf(pub[0]) ? strip(pub[0]) : s)));
    expect(shownPersona(pub[0], true)?.kind).toBe('contemporary');
    expect(CONTEMPORARY_DISCLOSURE).toBe('Fictional chess persona — not the real person; no participation or endorsement.');
  });

  it('an identity removed from the data file falls back to the original name, whatever the setting', () => {
    const c = { ...generateFederation(3)[0], persona: 'pub-someone-removed', altName: 'Original Name', name: 'Removed Person' } as Competitor;
    expect(displayNameOf(c, true)).toBe('Original Name');
    applyNameMode([c], true);
    expect(c.name).toBe('Original Name');
    expect(shownPersona(c, true)).toBeNull();
    expect(c.persona).toBe('pub-someone-removed'); // id kept, never reused
  });

  it('entrants bring contemporary identities without reuse; owner-named ones first in a world that has none', () => {
    const comps = generateFederation(9); // a v0.9-style world: no founding personas
    const entrants = generateFederation(9).slice(0, 600).map((c, i) => ({ ...c, id: `e${i}`, name: `Entrant ${i}` }));
    assignEntrantPersonas(9, 4, entrants, [...comps, ...entrants]);
    const pub = entrants.filter(e => isContemporaryId(e.persona));
    expect(pub.length).toBeGreaterThan(20);
    expect(new Set(pub.map(e => e.persona)).size).toBe(pub.length);
    expect(pub.slice(0, OWNER_NAMED_CONTEMPORARY.length).map(e => e.name).sort()).toEqual([...OWNER_NAMED_CONTEMPORARY].sort());
    for (const e of pub) expect(e.altName).toMatch(/^Entrant \d+$/);
  });

  it('the simulation is identical whether famous names are shown or not (names are display only)', () => {
    const run = (show: boolean) => {
      const comps = generateFederation(42); applyFoundingPersonas(42, comps, show);
      const { world, plan } = createWorld(42, comps, 'T');
      const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 350, name: 'You' }, swissHistory: [] };
      const rounds: RoundRecord[] = [];
      const entrants: Competitor[] = [];
      for (let r = 0; r < ROUNDS_PER_SEASON; r++) {
        const p = runRoundHeadless(ctx, rounds); rounds.push(p.record);
        if (p.seasonEnd) entrants.push(...p.seasonEnd.entrants);
        applyNameMode(ctx.competitors.values(), show);
      }
      return { ctx, rounds, entrants };
    };
    const on = run(true), off = run(false);
    expect(on.entrants.length).toBeGreaterThan(0);
    expect(off.entrants.map(e => `${e.id}:${e.persona ?? ''}:${e.altName ?? e.name}`)).toEqual(on.entrants.map(e => `${e.id}:${e.persona ?? ''}:${e.altName ?? e.name}`));
    expect(JSON.stringify(off.rounds)).toBe(JSON.stringify(on.rounds));
    for (const [id, c] of on.ctx.competitors) {
      const d = off.ctx.competitors.get(id)!;
      expect({ ...d, name: '', milestones: d.milestones.map(m => m.season) }).toEqual({ ...c, name: '', milestones: c.milestones.map(m => m.season) });
      expect(d.name).toBe(displayNameOf(c, false));
    }
  }, 120_000);

  it('the service applies the setting in memory and keeps stored ids and history', async () => {
    let clock = 0;
    const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
    const f = new IDBFactory();
    const svc = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    expect(svc.showNames).toBe(true); // default on
    await svc.create(2, 777);
    const pub = [...svc.state!.competitors.values()].filter(c => isContemporaryId(c.persona));
    expect(pub.length).toBe(123);
    for (const n of OWNER_NAMED_CONTEMPORARY) expect(pub.some(c => c.name === n), n).toBe(true);
    svc.setContemporaryNames(false);
    for (const c of pub) { expect(svc.name(c.id)).toBe(c.altName); expect(svc.state!.competitors.get(c.id)!.persona).toBe(c.persona); }
    // a reload with the setting on shows the famous names again; ids and personas persisted
    const svc2 = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await svc2.load();
    for (const c of pub) { const d = svc2.state!.competitors.get(c.id)!; expect(d.name).toBe(contemporaryIdentity(c.persona)!.name); expect(d.altName).toBe(c.altName); }
  });
});
