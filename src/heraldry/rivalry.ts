/**
 * Rivalry model (crown-rivalry-1): intensity between two competitors (or the player and a competitor), computed
 * ONLY from recorded meetings and season outcomes. It is presentation and goal-setting data: nothing here is read
 * by result generation, pairing, ratings or engine strength.
 *
 * Points per event (transparent, bounded):
 *   meeting                      +2   (only the first 2 meetings of a pair per season count — anti-farming)
 *   decisive result              +1   (same cap)
 *   upset (winner rated ≥150 below the loser at the time)   +6   (at most once per pair per season)
 *   knockout elimination          +12  (+18 in the Crown Championship)
 *   championship rematch           +10  (met in Crown Championships of two or more seasons; per extra season)
 *   consecutive-season encounters +5   (per season beyond the second in an unbroken run)
 *   promotion battle              +8   (both finished in the top three of the same division)
 *   winning streak                +5   (one side wins 3 decisive meetings in a row; once per streak)
 * Season decay ×0.7 per season of age; intensity = min(100, round(sum)).
 * Levels: Acquaintance < 10 ≤ Rival < 30 ≤ Nemesis < 60 ≤ Arch-rival.
 */
export const RIVALRY_ID = 'crown-rivalry-1';
export interface Meeting { season: number; round: number; event: string; a: string; b: string; scoreA: number | null; ratingA?: number; ratingB?: number; gameId?: string | null }
export interface KoMeeting { season: number; event: 'champ' | 'club' | 'cup'; stage: string; winner: string; loser: string; /** v0.11 Zonal Championships / Regional Cups: the event title. */ title?: string }
export interface SeasonFinish { season: number; region: number; division: number; rank: number; id: string }
export interface RivalryEvent { season: number; kind: string; points: number; text: string }
export interface Rivalry { a: string; b: string; intensity: number; level: string; w: number; d: number; l: number; meetings: number; events: RivalryEvent[]; lastSeason: number }

export const levelOf = (x: number) => (x >= 60 ? 'Arch-rival' : x >= 30 ? 'Nemesis' : x >= 10 ? 'Rival' : 'Acquaintance');

export function computeRivalry(a: string, b: string, meetings: Meeting[], kos: KoMeeting[], finishes: SeasonFinish[], currentSeason: number, nameOf: (id: string) => string = x => x): Rivalry {
  const mine = meetings.filter(m => ((m.a === a && m.b === b) || (m.a === b && m.b === a)) && m.scoreA !== null)
    .map(m => (m.a === a ? m : { ...m, a, b, scoreA: 1 - (m.scoreA as number), ratingA: m.ratingB, ratingB: m.ratingA }))
    .sort((x, y) => x.season - y.season || x.round - y.round);
  const events: RivalryEvent[] = [];
  const perSeason = new Map<number, number>();
  const upsetSeason = new Set<number>();
  let w = 0, d = 0, l = 0, streakSide = 0, streak = 0;
  for (const m of mine) {
    const s = m.scoreA as number;
    if (s === 1) w++; else if (s === 0) l++; else d++;
    const n = (perSeason.get(m.season) ?? 0) + 1;
    perSeason.set(m.season, n);
    if (n <= 2) events.push({ season: m.season, kind: 'meeting', points: s === 0.5 ? 2 : 3, text: `S${m.season} R${m.round}: ${s === 1 ? `${nameOf(a)} beat ${nameOf(b)}` : s === 0 ? `${nameOf(b)} beat ${nameOf(a)}` : 'drawn'}` });
    if (s !== 0.5 && m.ratingA !== undefined && m.ratingB !== undefined && !upsetSeason.has(m.season)) {
      const gap = s === 1 ? m.ratingB - m.ratingA : m.ratingA - m.ratingB;
      if (gap >= 150) { upsetSeason.add(m.season); events.push({ season: m.season, kind: 'upset', points: 6, text: `Upset: ${s === 1 ? nameOf(a) : nameOf(b)} won against a ${Math.round(gap)}-point higher rating` }); }
    }
    if (s !== 0.5) {
      const side = s === 1 ? 1 : -1;
      streak = side === streakSide ? streak + 1 : 1; streakSide = side;
      if (streak === 3) events.push({ season: m.season, kind: 'streak', points: 5, text: `${side === 1 ? nameOf(a) : nameOf(b)} won three in a row` });
    }
  }
  for (const k of kos) {
    if (!((k.winner === a && k.loser === b) || (k.winner === b && k.loser === a))) continue;
    events.push({ season: k.season, kind: 'elimination', points: k.event === 'champ' ? 18 : 12, text: `${nameOf(k.winner)} eliminated ${nameOf(k.loser)} (${k.event === 'champ' ? 'Crown Championship' : k.event === 'club' ? 'Club Weekend' : k.title ?? 'Cup'} ${k.stage})` });
  }
  const champSeasons = [...new Set(kos.filter(k => k.event === 'champ' && ((k.winner === a && k.loser === b) || (k.winner === b && k.loser === a))).map(k => k.season))].sort((x, y) => x - y);
  champSeasons.slice(1).forEach(s => events.push({ season: s, kind: 'rematch', points: 10, text: `Championship rematch in season ${s}` }));
  const seasons = [...new Set(mine.map(m => m.season))].sort((x, y) => x - y);
  let run = 1;
  for (let i = 1; i < seasons.length; i++) {
    run = seasons[i] === seasons[i - 1] + 1 ? run + 1 : 1;
    if (run >= 3) events.push({ season: seasons[i], kind: 'consecutive', points: 5, text: `Met in ${run} consecutive seasons` });
  }
  const fa = new Map(finishes.filter(f => f.id === a).map(f => [f.season, f])), fb = new Map(finishes.filter(f => f.id === b).map(f => [f.season, f]));
  for (const [s, x] of fa) { const y = fb.get(s); if (y && x.region === y.region && x.division === y.division && x.rank <= 3 && y.rank <= 3) events.push({ season: s, kind: 'promotion-battle', points: 8, text: `Promotion battle: both in the top three of the same division in season ${s}` }); }
  const sum = events.reduce((acc, e) => acc + e.points * Math.pow(0.7, Math.max(0, currentSeason - e.season)), 0);
  const intensity = Math.min(100, Math.round(sum));
  return { a, b, intensity, level: levelOf(intensity), w, d, l, meetings: mine.length, events: events.sort((x, y) => y.season - x.season), lastSeason: mine.length ? mine[mine.length - 1].season : 0 };
}
