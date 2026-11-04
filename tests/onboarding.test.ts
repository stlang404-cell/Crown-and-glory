import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  STEPS, TOUR_KEY, ackStep, emptyTour, hintVisible, markSeen, restartTour, sanitizeTour, setDismissed, tourView, type TourFacts,
} from '../src/app/onboarding';
import { CrownDB } from '../src/storage/db';
import { exportBundle, importBundle, PROGRESS_PREFIXES } from '../src/storage/backup';

const none: TourFacts = { games: 0, ratedGames: 0, federationGames: 0, federation: false, tournamentEntry: false, traded: false, trophies: 0 };
const T = '2026-11-04T00:00:00Z';

describe('first-run guide (crown-tour-1)', () => {
  it('a new career sees only the first relevant steps; the rest unlock progressively', () => {
    const v = tourView(emptyTour(), none);
    expect(v.current?.id).toBe('rules');
    expect(v.steps.filter(x => x.status === 'locked').map(x => x.step.id)).toEqual(['first-rated', 'replay', 'federation', 'tournament', 'market', 'honours', 'trophy']);
    const afterGame = tourView(ackStep(emptyTour(), 'rules', T), { ...none, games: 1 });
    expect(afterGame.steps.find(x => x.step.id === 'first-game')!.status).toBe('done');
    expect(afterGame.current?.id).toBe('first-rated');
    expect(afterGame.steps.find(x => x.step.id === 'federation')!.status).toBe('open');
    expect(afterGame.steps.find(x => x.step.id === 'market')!.status).toBe('locked');
  });

  it('facts complete action steps; explanations need an acknowledgement', () => {
    const f: TourFacts = { games: 3, ratedGames: 2, federationGames: 1, federation: true, tournamentEntry: false, traded: true, trophies: 1 };
    const s = markSeen(emptyTour(), 'analysis', T);
    const v = tourView(s, f);
    const done = v.steps.filter(x => x.status === 'done').map(x => x.step.id);
    expect(done).toEqual(['first-game', 'first-rated', 'replay', 'federation', 'tournament', 'market', 'trophy']);
    expect(v.current?.id).toBe('rules');
    const all = STEPS.reduce((acc, st) => ackStep(acc, st.id, T), s);
    expect(tourView(all, f).complete).toBe(true);
  });

  it('hints: explain steps show until acknowledged, action steps disappear once done, hiding the guide hides all', () => {
    const f = { ...none, games: 1, federation: true, traded: true };
    const s = emptyTour();
    expect(hintVisible('market', s, f)).toBe(true); // traded, but the explanation was never acknowledged
    expect(hintVisible('market', ackStep(s, 'market', T), f)).toBe(false);
    expect(hintVisible('first-game', s, f)).toBe(false); // already played
    expect(hintVisible('first-rated', s, f)).toBe(true);
    expect(hintVisible('market', s, none)).toBe(false); // not relevant before the Federation exists
    expect(hintVisible('first-rated', setDismissed(s, true), f)).toBe(false);
  });

  it('restart replays every explanation but keeps what the save records', () => {
    let s = ackStep(ackStep(emptyTour(), 'rules', T), 'honours', T);
    s = setDismissed(markSeen(s, 'analysis', T), true);
    const r = restartTour(s);
    expect(r.dismissed).toBe(false);
    expect(r.ack).toEqual({});
    expect(r.seen.analysis).toBe(T);
    expect(r.restarts).toBe(1);
    expect(hintVisible('rules', r, none)).toBe(true);
  });

  it('sanitises stored records (unknown steps, wrong types, missing record)', () => {
    expect(sanitizeTour(undefined)).toEqual(emptyTour());
    const s = sanitizeTour({ v: 1, dismissed: 'yes', ack: { rules: T, bogus: T, honours: 3 }, seen: { analysis: T, x: 1 }, restarts: -4 });
    expect(s).toEqual({ v: 1, dismissed: false, ack: { rules: T }, seen: { analysis: T }, restarts: 0 });
  });

  it('the guide state travels in backups and merges like learning progress', async () => {
    expect(PROGRESS_PREFIXES).toContain('tour:');
    const db = await CrownDB.open(new IDBFactory());
    const state = ackStep(emptyTour(), 'rules', T);
    await db.setMeta(TOUR_KEY, state);
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, 'test')));
    expect(bundle.payload.progress.map((e: { key: string }) => e.key)).toContain(TOUR_KEY);
    const fresh = await CrownDB.open(new IDBFactory());
    await importBundle(fresh, bundle);
    expect(await fresh.getMeta(TOUR_KEY)).toEqual(state);
  });
});
