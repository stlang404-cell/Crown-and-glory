/** Player achievements, each evaluated from recorded facts only (never awarded by a button). */
import type { FedState } from './federation';
import { ACHIEVEMENTS, type AchievementDef } from '../heraldry/catalog';
import { scoreAll, summary } from './forecasting';
import type { Rivalry } from '../heraldry/rivalry';

export function achievementsOf(st: FedState, rivalries: Rivalry[]): { def: AchievementDef; earned: boolean; evidence: string }[] {
  const p = st.world.player;
  const divs = [...p.history.map(h => h.division), p.division];
  const promoted = divs.some((d, i) => i > 0 && d < divs[i - 1]);
  const sc = scoreAll(st.extra.forecasts, st.markets);
  const sm = summary(sc);
  const clubLevel = [...st.assets.values()].find(a => a.typeId === 'club')?.level ?? ([...st.assets.values()].some(a => a.typeId === 'club') ? 1 : 0);
  const upset = rivalries.flatMap(r => r.events).find(e => e.kind === 'upset' && e.text.startsWith('Upset: You'));
  const facts: Record<string, [boolean, string]> = {
    'first-win': [st.extra.sponsorsPaid.includes('first-federation-win'), 'First federation win sponsor milestone'],
    promotion: [promoted, promoted ? `Division history ${divs.join(' → ')}` : ''],
    'league-title': [p.titles.some(t => / champion \(/.test(t.title)), p.titles.find(t => / champion \(/.test(t.title))?.title ?? ''],
    'swiss-podium': [st.extra.sponsorsPaid.some(s => s.endsWith(':swiss-top8')), 'Swiss event top-eight sponsor milestone'],
    'giant-slayer': [!!upset, upset?.text ?? ''],
    norm: [(p.norms?.length ?? 0) > 0, p.norms?.[0] ? `${p.norms[0].event}: performance ${p.norms[0].tpr}` : ''],
    forecaster: [sm.n >= 10 && sm.brier !== null && sm.modelBrier !== null && sm.brier < sm.modelBrier, sm.n ? `${sm.n} scored forecasts` : ''],
    patron: [clubLevel >= 2, clubLevel ? `Club level ${clubLevel}` : ''],
  };
  return ACHIEVEMENTS.map(def => ({ def, earned: facts[def.id]?.[0] ?? false, evidence: facts[def.id]?.[1] ?? '' }));
}
