import { useServices } from './App';
import { Emblem, Trophy } from './Emblem';
import { Portrait } from './Portrait';
import { PLAYER_ID } from '../federation/model';
import { titleEmblem, divisionEmblem, tournamentCrest, TROPHY_FOR, type FedTitle } from '../heraldry/catalog';
import { titleKind } from './HallScreen';

/** Presents the oldest unseen ceremony (a federation title, an event title, a promotion, or the season's champion). */
export function CeremonyOverlay() {
  const services = useServices();
  const fed = services.fed;
  const st = fed.state;
  const c = st?.extra.ceremonies?.find(x => !x.seen);
  if (!st || !c || services.readOnly) return null;
  const dismiss = () => { void fed.markCeremonySeen(c.id); };
  const visual = (() => {
    if (c.kind === 'fed-title') return <Emblem spec={titleEmblem(c.title.replace('Federation title: ', '') as FedTitle)} size="lg" title={c.title} className="glow" />;
    if (c.kind === 'promotion') return <Emblem spec={divisionEmblem(st.world.player.division)} size="lg" title={c.title} className="glow" />;
    if (c.kind === 'championship') return <span className="row" style={{ justifyContent: 'center', gap: 10 }}><Emblem spec={tournamentCrest('champ')} size="md" title="Crown Championship" /><Trophy kind="grand" size="lg" title="Crown Championship trophy" /></span>;
    return <Trophy kind={TROPHY_FOR[titleKind(c.title)]} size="lg" title={c.title} />;
  })();
  return (
    <div className="ceremony" role="dialog" aria-modal="true" aria-label={c.title} data-testid="ceremony">
      <div className="ceremony-card stack" style={{ alignItems: 'center' }}>
        <span className="chip gold">{{ 'fed-title': 'Federation title earned', 'event-title': 'Title won', promotion: 'Promotion', championship: `Season ${c.season} · Crown Championship` }[c.kind]}</span>
        <div className="glow">{visual}</div>
        <h2 style={{ margin: 0 }}>{c.title}</h2>
        {c.kind === 'championship' && <div className="row" style={{ justifyContent: 'center', gap: 12 }}>{c.ids.map(id => id === PLAYER_ID ? <strong key={id}>You</strong> : <span key={id} className="stack" style={{ alignItems: 'center', gap: 2 }}><Portrait seed={st.competitors.get(id)?.portraitSeed ?? 0} size={56} crown /><strong className="small">{fed.name(id)}</strong></span>)}</div>}
        <p className="small muted" style={{ margin: 0 }}>{c.detail}</p>
        <button className="btn primary" data-testid="ceremony-continue" onClick={dismiss} autoFocus>Continue</button>
      </div>
    </div>
  );
}
