/**
 * Time-control selector (v1.1): the six human-rated presets (30+ minutes, Classical 60+60 by default), a custom
 * control (base 30–240 min, increment 0–120 s; rated only inside the documented envelope) and the older, shorter
 * controls, which are casual only. Plain-language explanation of the selected control. Mobile-first: two-column grid
 * of large buttons at 375–420 px.
 */
import { useEffect, useState } from 'react';
import {
  CASUAL_CONTROLS, CUSTOM_LIMITS, RATED_ENVELOPE, RATED_PRESETS, TIME_CONTROLS, customTimeControl, describeControl, poolFor, type TimeControl,
} from '../games/types';
import { POOL_LABEL } from '../ratings/pools';
import './clock.css';

const short = (tc: TimeControl) => tc.label.replace(/^.*\s(\d+\+\d+)$/, '$1');
const nameOf = (tc: TimeControl) => tc.label.replace(/\s\d+\+\d+$/, '');

export function TimeControlPicker({ value, onChange, compact }: { value: TimeControl; onChange: (tc: TimeControl) => void; compact?: boolean }) {
  const [custom, setCustom] = useState(value.id === 'custom');
  const [base, setBase] = useState(String(value.id === 'custom' ? value.initialMs / 60_000 : 45));
  const [inc, setInc] = useState(String(value.id === 'custom' ? value.incrementMs / 1000 : 30));
  useEffect(() => { if (value.id === 'custom') { setCustom(true); setBase(String(value.initialMs / 60_000)); setInc(String(value.incrementMs / 1000)); } }, [value.id, value.initialMs, value.incrementMs]);
  const pool = poolFor(value);
  const applyCustom = (b: string, i: string) => {
    setBase(b); setInc(i);
    const bn = Number(b), inn = Number(i);
    if (b !== '' && i !== '' && Number.isFinite(bn) && Number.isFinite(inn)) onChange(customTimeControl(bn, inn));
  };
  return (
    <div className="tc-picker" data-testid="tc-picker">
      <div className="small muted">Time Control</div>
      <div className="tc-summary" data-testid="tc-summary" aria-live="polite">
        <strong data-testid="tc-selected">{value.label}</strong>{' '}
        <span className={`chip ${pool ? 'pos' : ''}`} data-testid="tc-rated">{pool ? `Rated · ${POOL_LABEL[pool]}` : 'Casual only'}</span>
        <div className="small" data-testid="tc-explain">{describeControl(value)}.</div>
        {!pool && value.id !== 'untimed' && <div className="small muted">Rated games need at least {RATED_ENVELOPE.minBaseMin} minutes per player and an increment of {RATED_ENVELOPE.minIncS}–{RATED_ENVELOPE.maxIncS} seconds.</div>}
      </div>
      <div className="tc-grid" role="group" aria-label="Rated time controls">
        {RATED_PRESETS.map(id => {
          const tc = TIME_CONTROLS[id];
          return (
            <button key={id} type="button" className="tc-option" aria-pressed={value.id === id} data-testid={`tc-${id}`} aria-label={tc.label} title={describeControl(tc)}
              onClick={() => { setCustom(false); onChange(tc); }}>
              <span className="tc-o-name">{nameOf(tc)}</span><span className="tc-o-sub">{short(tc)}{id === 'classical60' ? ' · default' : ''}</span>
            </button>
          );
        })}
        <button type="button" className="tc-option" aria-pressed={value.id === 'custom'} data-testid="tc-custom" aria-label="Custom time control"
          onClick={() => { setCustom(true); applyCustom(base, inc); }}>
          <span className="tc-o-name">Custom</span><span className="tc-o-sub">{CUSTOM_LIMITS.minBaseMin}–{CUSTOM_LIMITS.maxBaseMin} min</span>
        </button>
      </div>
      {custom && value.id === 'custom' && (
        <div className="tc-custom" data-testid="tc-custom-fields">
          <label>Minutes per player
            <input type="number" inputMode="numeric" min={CUSTOM_LIMITS.minBaseMin} max={CUSTOM_LIMITS.maxBaseMin} step={1} value={base} data-testid="tc-custom-base"
              onChange={e => applyCustom(e.target.value, inc)} />
          </label>
          <label>Seconds added per move
            <input type="number" inputMode="numeric" min={CUSTOM_LIMITS.minIncS} max={CUSTOM_LIMITS.maxIncS} step={1} value={inc} data-testid="tc-custom-inc"
              onChange={e => applyCustom(base, e.target.value)} />
          </label>
          <span className="small muted">Base {CUSTOM_LIMITS.minBaseMin}–{CUSTOM_LIMITS.maxBaseMin} minutes, increment {CUSTOM_LIMITS.minIncS}–{CUSTOM_LIMITS.maxIncS} seconds. Rated when the increment is {RATED_ENVELOPE.minIncS} s or more (the same envelope as the presets); otherwise casual.</span>
        </div>
      )}
      {!compact && (
        <div className="small" data-testid="tc-casual">
          <div className="muted">Shorter controls · casual only</div>
          <div className="tc-casual" role="group" aria-label="Casual time controls" style={{ marginTop: 4 }}>
            {CASUAL_CONTROLS.map(id => <button key={id} type="button" className="btn small" aria-pressed={value.id === id} onClick={() => { setCustom(false); onChange(TIME_CONTROLS[id]); }}>{TIME_CONTROLS[id].label}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}
