import { Emblem, Trophy } from './Emblem';
import { divisionLabel, regionNamesOf, TOPOLOGY_V1 } from '../federation/model';
import { divisionEmblem, rankEmblem, RANK_ORDER, titleEmblem, FED_TITLES, FED_TITLE_ABBR, regionEmblem, tournamentCrest, TOURNAMENTS, TOURNAMENT_NAME, TROPHY_FOR, financialEmblem, FIN_TIERS, ACHIEVEMENTS, achievementEmblem } from '../heraldry/catalog';
import { AI_CLUBS, clubEmblem } from '../heraldry/clubs';
import { TITLE_RULES, TITLES_ID } from '../heraldry/titles';
import { RIVALRY_ID } from '../heraldry/rivalry';
import type { EmblemSpec } from '../heraldry/spec';

function Row({ items }: { items: { spec: EmblemSpec; label: string; sub?: string }[] }) {
  return (
    <div className="emblem-row" style={{ alignItems: 'flex-start' }}>
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
      <p className="small muted">Every emblem in the federation, and what it takes to earn one. All art is drawn by the game and follows your colour theme.</p>
      <details className="small muted"><summary>Details</summary>Each emblem family has its own shield shape, field division, fixed tinctures and charge. The highest ranks add crests, wreaths, gold borders and pips.</details>
      <section className="panel stack" data-testid="gallery-sizes">
        <h3>Sizes</h3>
        <div className="emblem-row" style={{ alignItems: 'flex-end' }}>
          {(['sm', 'md', 'lg'] as const).map(s => <div key={s} className="emblem-cell"><Emblem spec={tournamentCrest('champ')} size={s} title={`Crown Championship crest (${s})`} /><span className="small muted">{s === 'sm' ? 'Small · 22 px (lists, phone)' : s === 'md' ? 'Medium · 44 px' : 'Large · 104 px (ceremonies)'}</span></div>)}
          {(['sm', 'md', 'lg'] as const).map(s => <div key={`d${s}`} className="emblem-cell"><Emblem spec={divisionEmblem(1)} size={s} title={`Crown Division (${s})`} /></div>)}
        </div>
      </section>
      <section className="panel stack" data-testid="gallery-divisions"><h3>Divisions</h3><Row items={Array.from({ length: 8 }, (_, i) => ({ spec: divisionEmblem(i + 1), label: divisionLabel(i + 1), sub: `Division ${i + 1}` }))} /></section>
      <section className="panel stack" data-testid="gallery-ranks"><h3>Ranks <span className="chip">Temporary · Follows Your Rating</span></h3><Row items={RANK_ORDER.map(r => ({ spec: rankEmblem(r), label: r }))} /></section>
      <section className="panel stack" data-testid="gallery-titles">
        <h3>Federation Titles <span className="chip gold">Permanent · Earned by Norms</span></h3>
        <Row items={FED_TITLES.map(t => ({ spec: titleEmblem(t), label: `${t} (${FED_TITLE_ABBR[t]})` }))} />
        <details className="small"><summary>Details</summary>
        <table className="small"><thead><tr><th>Title</th><th>Norms</th><th>Norm Performance</th><th>Opponent Average</th><th>Norm Games</th><th>Peak Rating</th><th>Also Needs</th></tr></thead>
          <tbody>{TITLE_RULES.map(r => <tr key={r.title}><td>{r.title}</td><td>{r.norms}</td><td>{r.tpr}+</td><td>{r.oppFloor}+</td><td>{r.normGames}+</td><td>{r.peak}{r.established ? ' (established)' : ''}</td><td>{r.honour === 'none' ? '—' : r.honour === 'any-title' ? 'An event title' : 'A Crown Championship final'}</td></tr>)}</tbody></table>
        <p className="muted">Norm Performance is your performance rating in one event; Opponent Average is the minimum average rating of your opponents there. "Established" means the peak was reached with a settled rating (uncertainty ±100 or less).</p>
        </details>
        <div className="small muted">Fictional honours of this federation, earned like real chess titles through norms and a peak rating. They are not FIDE titles.</div>
      </section>
      <section className="panel stack" data-testid="gallery-regions"><h3>Regional Federations</h3><Row items={regionNamesOf(TOPOLOGY_V1).map((n, i) => ({ spec: regionEmblem(i), label: n }))} /></section>
      <section className="panel stack" data-testid="gallery-tournaments">
        <h3>Major Tournaments and Their Trophies</h3>
        <div className="emblem-row">{TOURNAMENTS.map(t => <div key={t} className="emblem-cell"><span className="row"><Emblem spec={tournamentCrest(t)} size="md" title={`${TOURNAMENT_NAME[t]} crest`} /><Trophy kind={TROPHY_FOR[t]} size="md" title={`${TOURNAMENT_NAME[t]} trophy`} /></span><span className="small"><strong>{TOURNAMENT_NAME[t]}</strong></span></div>)}</div>
        <div className="small muted">Win one of these events to add its trophy to your Hall of Fame.</div>
      </section>
      <section className="panel stack" data-testid="gallery-finance"><h3>Financial Prestige</h3><Row items={FIN_TIERS.map(t => ({ spec: financialEmblem(t), label: t }))} /></section>
      <section className="panel stack" data-testid="gallery-achievements"><h3>Achievements</h3><Row items={ACHIEVEMENTS.map(a => ({ spec: achievementEmblem(a, true), label: a.name, sub: a.description }))} /></section>
      <section className="panel stack" data-testid="gallery-clubs"><h3>Clubs of the Federation</h3><Row items={AI_CLUBS.map(c => ({ spec: clubEmblem(c.identity), label: c.identity.name, sub: `“${c.identity.motto}”` }))} /></section>
      <details className="small muted"><summary>Details</summary>Rules versions: rivalries {RIVALRY_ID}, titles {TITLES_ID}. A competitor's profile shows how your rivalry with them was scored.</details>
    </div>
  );
}
