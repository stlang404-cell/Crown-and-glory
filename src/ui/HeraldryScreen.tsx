import { Emblem, Trophy } from './Emblem';
import { divisionLabel, REGION_NAMES } from '../federation/model';
import { divisionEmblem, rankEmblem, RANK_ORDER, titleEmblem, FED_TITLES, FED_TITLE_ABBR, regionEmblem, tournamentCrest, TOURNAMENTS, TOURNAMENT_NAME, TROPHY_FOR, financialEmblem, FIN_TIERS, ACHIEVEMENTS, achievementEmblem } from '../heraldry/catalog';
import { AI_CLUBS, clubEmblem } from '../heraldry/clubs';
import { TITLE_RULES, TITLES_ID } from '../heraldry/titles';
import { RIVALRY_ID } from '../heraldry/rivalry';
import type { EmblemSpec } from '../heraldry/spec';

function Row({ items }: { items: { spec: EmblemSpec; label: string; sub?: string }[] }) {
  return (
    <div className="emblem-row">
      {items.map(x => (
        <div key={x.label} className="emblem-cell" data-testid="emblem-cell">
          <Emblem spec={x.spec} size="md" title={x.label} />
          <span className="small"><strong>{x.label}</strong>{x.sub && <><br /><span className="muted">{x.sub}</span></>}</span>
        </div>
      ))}
    </div>
  );
}

/** The federation's heraldry: every emblem family, its sizes, and the rules behind earned insignia. */
export function HeraldryScreen() {
  return (
    <div>
      <h1>Heraldry of the Federation</h1>
      <p className="small muted">Every emblem is original vector art drawn by the game (no external images) and built from one design system: a shield shape per family, a field division, fixed heraldic tinctures, a charge, and — for the highest ranks — crests, wreaths, gold borders and pixel pips. Outlines follow your colour theme.</p>
      <section className="panel stack" data-testid="gallery-sizes">
        <h3>Sizes</h3>
        <div className="emblem-row">
          {(['sm', 'md', 'lg'] as const).map(s => <div key={s} className="emblem-cell"><Emblem spec={tournamentCrest('champ')} size={s} title={`Crown Championship crest (${s})`} /><span className="small muted">{s === 'sm' ? 'small · 22 px (lists, phone)' : s === 'md' ? 'medium · 44 px' : 'large · 104 px (ceremonies)'}</span></div>)}
          {(['sm', 'md', 'lg'] as const).map(s => <div key={`d${s}`} className="emblem-cell"><Emblem spec={divisionEmblem(1)} size={s} title={`Crown Division (${s})`} /></div>)}
        </div>
      </section>
      <section className="panel stack" data-testid="gallery-divisions"><h3>League divisions</h3><Row items={Array.from({ length: 8 }, (_, i) => ({ spec: divisionEmblem(i + 1), label: divisionLabel(i + 1), sub: `Division ${i + 1}` }))} /></section>
      <section className="panel stack" data-testid="gallery-ranks"><h3>Rating ranks <span className="chip">temporary — follow your current rating band</span></h3><Row items={RANK_ORDER.map(r => ({ spec: rankEmblem(r), label: r }))} /></section>
      <section className="panel stack" data-testid="gallery-titles">
        <h3>Federation titles <span className="chip gold">permanent — earned by norms</span></h3>
        <Row items={FED_TITLES.map(t => ({ spec: titleEmblem(t), label: `${t} (${FED_TITLE_ABBR[t]})` }))} />
        <table className="small"><thead><tr><th>Title</th><th>Norms</th><th>Norm performance</th><th>Opposition floor</th><th>Norm games</th><th>Peak rating</th><th>Also</th></tr></thead>
          <tbody>{TITLE_RULES.map(r => <tr key={r.title}><td>{r.title}</td><td>{r.norms}</td><td>{r.tpr}+</td><td>{r.oppFloor}+</td><td>{r.normGames}+</td><td>{r.peak}{r.established ? ' (established)' : ''}</td><td>{r.honour === 'none' ? '—' : r.honour === 'any-title' ? 'an event title' : 'a Crown Championship final'}</td></tr>)}</tbody></table>
        <div className="small muted">{TITLES_ID}: fictional honours of the Six-Square Federation, inspired by how real chess titles reward sustained performance (norms over several events plus a rating requirement). They are not FIDE titles and carry no meaning outside this game.</div>
      </section>
      <section className="panel stack" data-testid="gallery-regions"><h3>Regional federations</h3><Row items={REGION_NAMES.map((n, i) => ({ spec: regionEmblem(i), label: n }))} /></section>
      <section className="panel stack" data-testid="gallery-tournaments">
        <h3>Major tournaments and their trophies</h3>
        <div className="emblem-row">{TOURNAMENTS.map(t => <div key={t} className="emblem-cell"><span className="row"><Emblem spec={tournamentCrest(t)} size="md" title={`${TOURNAMENT_NAME[t]} crest`} /><Trophy kind={TROPHY_FOR[t]} size="md" title={`${TOURNAMENT_NAME[t]} trophy`} /></span><span className="small"><strong>{TOURNAMENT_NAME[t]}</strong></span></div>)}</div>
        <div className="small muted">Trophies appear in the Hall of Fame only for titles actually recorded in a season.</div>
      </section>
      <section className="panel stack" data-testid="gallery-finance"><h3>Financial prestige tiers</h3><Row items={FIN_TIERS.map(t => ({ spec: financialEmblem(t), label: t }))} /></section>
      <section className="panel stack" data-testid="gallery-achievements"><h3>Achievements</h3><Row items={ACHIEVEMENTS.map(a => ({ spec: achievementEmblem(a, true), label: a.name, sub: a.description }))} /></section>
      <section className="panel stack" data-testid="gallery-clubs"><h3>Clubs of the federation</h3><Row items={AI_CLUBS.map(c => ({ spec: clubEmblem(c.identity), label: c.identity.name, sub: `“${c.identity.motto}”` }))} /></section>
      <div className="small muted">Rivalries use {RIVALRY_ID} (see a competitor's profile for the breakdown); titles use {TITLES_ID}.</div>
    </div>
  );
}
