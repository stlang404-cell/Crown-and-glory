import { useEffect, useState } from 'react';
import { useServices } from './App';
import type { PreparedCareerChange } from '../app/career';
import type { PoolState } from '../ratings/ledger';
import { careerEloLabel } from '../ratings/career';
import { listArchives, archivedBackup, type ArchivedBackup } from '../storage/archive';

const download = (text: string, filename: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
};

/**
 * Settings → Career: the career's rating origin and Start New Career (docs/CAREER_RATING.md). Starting over is two
 * explicit steps: (1) export a full backup, offered as a download and kept as a local archive copy if storage allows;
 * (2) confirm. The current career is then cleared — games, rating history, Academy, Vault, the Federation and the
 * economy — and a new career begins at 0, provisional. Backups and the archive are never touched.
 */
export function CareerSettings() {
  const services = useServices();
  const career = services.db.career;
  const [pool, setPool] = useState<PoolState | null>(null);
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedCareerChange | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [archives, setArchives] = useState<Omit<ArchivedBackup, 'json'>[]>([]);
  useEffect(() => { void services.db.careerRating().then(setPool).catch(() => setPool(null)); }, [services, services.revision]);
  useEffect(() => { void listArchives().then(setArchives); }, [prepared]);

  const backup = async () => {
    setBusy(true); setMsg(null);
    try {
      const p = await services.prepareNewCareer();
      download(p.json, p.filename);
      setPrepared(p);
    } catch (e) { setMsg(`The backup failed (${(e as Error).message}). Nothing was changed.`); }
    setBusy(false);
  };
  const confirm = async () => {
    if (!prepared || !ack) return;
    setBusy(true); setMsg(null);
    try {
      await services.startNewCareer(prepared);
      setMsg('Your new career has started. Reloading…');
      setTimeout(() => location.reload(), 300);
    } catch (e) { setMsg(`Could not start a new career (${(e as Error).message}). Your current career is unchanged.`); setBusy(false); }
  };
  const fed = services.fed?.ready ? services.fed.state : null;

  return (
    <section className="panel" aria-labelledby="set-career" data-testid="career-settings">
      <div className="panel-title"><h2 id="set-career" style={{ margin: 0 }}>Career</h2>
        <span className="chip" data-testid="career-origin">{career.origin === 'new' ? 'Started at 0' : 'Started before v0.11 (at 1500)'}</span>
      </div>
      <p className="small" style={{ marginTop: 0 }}>
        Current career Elo: <strong className="mono" data-testid="career-current">{pool ? careerEloLabel(pool.rating, pool.games, pool.rd) : '…'}</strong>
        {pool ? ` · ${pool.games} rated game${pool.games === 1 ? '' : 's'}` : ''}{fed ? ' · Federation member' : ''}.
        {' '}New careers start at 0 and earn their rating through rated results only. Careers created before v0.11 keep their rating and history.
      </p>
      {!open && <button className="btn" data-testid="new-career-open" disabled={services.readOnly} onClick={() => { setOpen(true); setMsg(null); }}>Start New Career…</button>}
      {open && (
        <div className="notice stack" data-testid="new-career-panel" style={{ gap: 8 }}>
          <strong>Start a new career at 0?</strong>
          <span className="small">
            This closes your current career on this device: every game, your rating history in all pools, analyses, Academy and Grimoire progress,
            Sovereign Vault collection, your Federation world (division, titles, trophies, rivals) and your economy are cleared. Your new career
            starts at 0 career Elo, provisional, with 0 rated games, and a new Federation that you found again.
            Display settings stay as they are.
          </span>
          <span className="small"><strong>Step 1.</strong> Save a full backup of the current career first. You can import it later into an empty profile to get this career back exactly.</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" data-testid="new-career-backup" disabled={busy} onClick={() => void backup()}>{prepared ? 'Download Backup Again' : 'Export Backup and Continue'}</button>
            <button className="btn ghost" data-testid="new-career-cancel" disabled={busy} onClick={() => { setOpen(false); setPrepared(null); setAck(false); }}>Cancel</button>
          </div>
          {prepared && (
            <>
              <span className="small" data-testid="new-career-backup-done">
                Backup exported: {prepared.filename} ({prepared.counts.games} games, {prepared.counts.ratingEvents} rating changes, {prepared.counts.reports} analyses).
                {prepared.archiveId ? ' A second copy is kept on this device under Settings → Career → Archived Careers.' : ` No second copy could be kept on this device (${prepared.archiveReason ?? 'storage unavailable'}), so keep the downloaded file safe.`}
              </span>
              <span className="small"><strong>Step 2.</strong> Confirm.</span>
              <label className="row small" style={{ gap: 8 }}>
                <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} data-testid="new-career-ack" />
                I have the backup. Clear this career and start a new one at 0.
              </label>
              <button className="btn danger" data-testid="new-career-confirm" disabled={busy || !ack} onClick={() => void confirm()}>Start New Career</button>
            </>
          )}
        </div>
      )}
      {msg && <div className="notice small" role="status" style={{ marginTop: 8 }}>{msg}</div>}
      {archives.length > 0 && (
        <details className="small" style={{ marginTop: 8 }} data-testid="career-archives">
          <summary>Archived Careers ({archives.length})</summary>
          <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
            {archives.map(a => (
              <li key={a.id}>
                {a.at.slice(0, 16).replace('T', ' ')} · {a.games} games, {a.ratingEvents} rating changes · {(a.bytes / 1048576).toFixed(1)} MB{' '}
                <button className="btn small ghost" onClick={() => void archivedBackup(a.id).then(t => { if (t) download(t, `crown-backup-${a.at.slice(0, 10)}-archived.json`); })}>Download</button>
              </li>
            ))}
          </ul>
          <span className="muted">To return to an archived career, start a new career (or use an empty profile) and import the file in Games → Import Backup before playing.</span>
        </details>
      )}
    </section>
  );
}
