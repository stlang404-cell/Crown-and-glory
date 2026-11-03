import { useEffect, useState } from 'react';
import { useServices } from './App';
import type { AnalysisReport, PlyAnalysis } from '../analysis/types';
import type { GameRecord } from '../games/types';
import { mulberry32 } from '../rules/tables';

/**
 * Chess intelligence laboratory — M1 foundation (lab policy crown-lab-0).
 * Only descriptive, sourced rates from engine reports of the player's own moves are shown, with
 * opportunity counts and game-clustered bootstrap intervals. These are chess-specific performance
 * summaries, not IQ or validated psychometric scores. Dimensions without a defined M1 rubric say so.
 */
interface Evidence { games: number; n: number; s: number; rate: number | null; ci: [number, number] | null; perGame: { s: number; n: number }[] }

function clusterBootstrap(perGame: { s: number; n: number }[], iters = 1000): [number, number] | null {
  const tot = perGame.reduce((a, g) => a + g.n, 0);
  if (perGame.length < 3 || tot < 10) return null;
  const r = mulberry32(12345);
  const vals: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0, n = 0;
    for (let j = 0; j < perGame.length; j++) { const g = perGame[Math.floor((r() / 4294967296) * perGame.length)]; s += g.s; n += g.n; }
    vals.push(n ? s / n : 0);
  }
  vals.sort((a, b) => a - b);
  return [vals[Math.floor(iters * 0.025)], vals[Math.floor(iters * 0.975)]];
}

function measure(items: { gameId: string; plies: PlyAnalysis[] }[], opp: (p: PlyAnalysis) => boolean, success: (p: PlyAnalysis) => boolean): Evidence {
  const perGame: { s: number; n: number }[] = [];
  for (const it of items) {
    const ps = it.plies.filter(opp);
    if (ps.length) perGame.push({ n: ps.length, s: ps.filter(success).length });
  }
  const n = perGame.reduce((a, g) => a + g.n, 0), s = perGame.reduce((a, g) => a + g.s, 0);
  return { games: perGame.length, n, s, rate: n ? s / n : null, ci: clusterBootstrap(perGame), perGame };
}

export function LabScreen() {
  const services = useServices();
  const [data, setData] = useState<{ reports: AnalysisReport[]; games: GameRecord[] } | null>(null);
  useEffect(() => { void Promise.all([services.db.allReports(), services.db.allGames()]).then(([reports, games]) => setData({ reports, games })); }, [services, services.revision]);
  if (!data) return <p className="muted">Loading…</p>;

  // Latest complete report per game; only one methodology is aggregated at a time.
  const byGame = new Map<string, AnalysisReport>();
  for (const r of data.reports) if (r.status === 'complete') { const c = byGame.get(r.gameId); if (!c || r.completedAt > c.completedAt) byGame.set(r.gameId, r); }
  const methods = new Map<string, number>();
  for (const r of byGame.values()) { const k = `${r.methodology.gradingId} / ${r.engine.buildId} / ${r.settings.id}`; methods.set(k, (methods.get(k) ?? 0) + 1); }
  const method = [...methods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const gameById = new Map(data.games.map(g => [g.id, g]));
  const items = [...byGame.values()].filter(r => `${r.methodology.gradingId} / ${r.engine.buildId} / ${r.settings.id}` === method).map(r => {
    const g = gameById.get(r.gameId)!;
    return { gameId: r.gameId, game: g, plies: r.plies.filter(p => g && p.color === g.humanColor && !p.forced && p.loss !== null) };
  }).filter(x => x.game && x.game.mode !== 'training');
  const excluded = byGame.size - items.length;

  const critical = measure(items, p => p.critical, p => (p.loss ?? 1) <= 0.05);
  const blunderFree = measure(items, () => true, p => p.grade !== 'blunder' && p.grade !== 'mistake');
  const safety = measure(items, () => true, p => !p.notes.some(n => n.kind === 'hanging-piece' || n.kind === 'allowed-tactic' || n.kind === 'allowed-mate'));
  const endgame = measure(items, p => p.phase === 'endgame', p => (p.loss ?? 1) <= 0.05);
  const opening = measure(items, p => p.phase === 'opening', p => (p.loss ?? 1) <= 0.05);
  const missed = measure(items, p => p.notes.some(n => n.kind === 'missed-win' || n.kind === 'missed-mate') || (p.critical && p.best.ccn === p.ccn), p => p.best.ccn === p.ccn);
  // time management: mean seconds spent on critical vs other decisions (timed games, descriptive)
  let tc = 0, tcn = 0, to = 0, ton = 0;
  for (const it of items) if (it.game.clocks) for (const p of it.plies) {
    const ms = it.game.moves[p.ply - 1]?.elapsedMs ?? 0;
    if (p.critical) { tc += ms; tcn++; } else { to += ms; ton++; }
  }

  const dims: { name: string; rubric: string; ev: Evidence | null; note?: string }[] = [
    { name: 'Tactical vision', rubric: 'Found the engine-best move where a material-winning or mating line existed (coach-verified opportunities).', ev: missed },
    { name: 'Calculation', rubric: 'Requires held-out multi-ply exercises with verified solutions.', ev: null, note: 'Not measured in M1 — held-out assessments arrive in M2.' },
    { name: 'Positional judgment', rubric: 'Requires stable multi-budget evaluation of non-forcing positions.', ev: null, note: 'Not measured in M1.' },
    { name: 'Endgame technique', rubric: 'Endgame-phase decisions with expected-score loss ≤ 0.05.', ev: endgame },
    { name: 'Defensive awareness', rubric: 'Moves that did not allow an engine-verified material-winning reply or mate.', ev: safety },
    { name: 'Opening understanding', rubric: 'Opening-phase decisions with loss ≤ 0.05 (no 6×6 opening theory exists yet).', ev: opening },
    { name: 'Time management', rubric: 'Time spent on critical vs ordinary decisions (descriptive only).', ev: null, note: tcn >= 5 ? `Critical: ${(tc / tcn / 1000).toFixed(1)} s avg over ${tcn} decisions · other: ${(to / Math.max(1, ton) / 1000).toFixed(1)} s over ${ton}. Speed alone is not skill.` : 'Insufficient timed critical decisions.' },
    { name: 'Consistency', rubric: 'Share of decisions without a Mistake or Blunder grade.', ev: blunderFree },
    { name: 'Threat detection', rubric: 'Handling of critical positions (best-vs-next gap ≥ 0.10): loss ≤ 0.05.', ev: critical },
    { name: 'Adaptability', rubric: 'Improvement against novel motifs after exposure; needs longitudinal held-out data.', ev: null, note: 'Not measured in M1.' },
  ];

  return (
    <div>
      <h1>Chess Intelligence Lab</h1>
      <div className="notice" style={{ marginBottom: 14 }}>
        Chess-specific performance summaries from engine reports of your own moves — not IQ, not general intelligence and not validated psychometrics.
        Estimates appear only with ≥ 10 opportunities across ≥ 3 games; intervals are 95% game-clustered bootstrap ranges. Methodology {method ?? '—'} · {items.length} games{excluded ? ` · ${excluded} report(s) with a different methodology or training games kept separate` : ''}.
      </div>
      <div className="grid-2">
        {dims.map(d => (
          <div key={d.name} className="panel" data-testid="lab-dimension">
            <div className="panel-title"><h3 style={{ margin: 0 }}>{d.name}</h3>
              {d.ev && d.ev.ci ? <span className="chip gold">{Math.round(d.ev.rate! * 100)}%</span> : <span className="chip">insufficient evidence</span>}
            </div>
            <div className="small muted">{d.rubric}</div>
            {d.ev && (
              <div className="small" style={{ marginTop: 6 }}>
                {d.ev.ci ? <>Rate {Math.round(d.ev.rate! * 100)}% (95% range {Math.round(d.ev.ci[0] * 100)}–{Math.round(d.ev.ci[1] * 100)}%) · </> : null}
                {d.ev.s}/{d.ev.n} opportunities in {d.ev.games} game{d.ev.games === 1 ? '' : 's'}
              </div>
            )}
            {d.note && <div className="small" style={{ marginTop: 6 }}>{d.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
