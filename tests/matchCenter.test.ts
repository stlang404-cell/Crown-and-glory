/**
 * Match Center shared components (src/ui/MatchCenter.tsx): presentation only. The notation list must show a grade
 * icon only for moves the screen passes a grade for (the Arena passes none before settlement; live play never does).
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchHeader, MatchLayout, MoveNav, NotationList } from '../src/ui/MatchCenter';

const moves = ['a3', 'f4', 'Nb3'].map(san => ({ san }));

describe('NotationList', () => {
  it('renders no grade icons when no grades are given', () => {
    const html = renderToStaticMarkup(createElement(NotationList, { moves, current: 2, label: 'Move list', testId: 'arena-moves', itemTestId: 'arena-move' }));
    expect(html).not.toContain('grade-icon');
    expect(html.match(/data-testid="arena-move"/g)).toHaveLength(3);
    expect(html).toContain('data-ply="2"');
    expect(html).toMatch(/class="mc-mv on"[^>]*aria-current="step"[^>]*data-ply="2"/);
    expect(html).toContain('aria-label="2. White Nb3"');
  });

  it('renders grades, and the not-graded icon for null, only when supplied', () => {
    const html = renderToStaticMarkup(createElement(NotationList, { moves: [{ san: 'a3', grade: 'best' as const }, { san: 'f4', grade: null }, { san: 'Nb3' }], current: 0, label: 'Move list' }));
    expect(html.match(/grade-icon/g)).toHaveLength(2);
    expect(html).toContain('grade-best');
    expect(html).toContain('grade-none');
    expect(html).toContain('aria-label="1. White a3, Best"');
    expect(html).toContain('aria-label="1. Black f4, not graded"');
  });

  it('numbers a game that starts with Black correctly', () => {
    const html = renderToStaticMarkup(createElement(NotationList, { moves: moves.slice(0, 2), current: 1, startsWithBlack: true, label: 'Move list' }));
    expect(html).toContain('aria-label="1. Black a3"');
    expect(html).toContain('aria-label="2. White f4"');
  });
});

describe('MoveNav, MatchHeader and MatchLayout', () => {
  const noop = () => {};
  it('keeps the navigation labels and the replay controls', () => {
    const html = renderToStaticMarkup(createElement(MoveNav, {
      onFirst: noop, onPrev: noop, onNext: noop, onLast: noop, lastLabel: 'Latest Move', onFlip: noop,
      replay: { playing: false, onToggle: noop, testId: 'replay-play', speeds: [{ label: 'Slow' }, { label: 'Fast' }], speed: 1, onSpeed: noop },
    }));
    for (const l of ['First Move', 'Previous Move', 'Next Move', 'Latest Move', 'Flip Board', 'Move Navigation', 'Replay Speed']) expect(html).toContain(`aria-label="${l}"`);
    expect(html).toContain('data-testid="replay-play"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Fast</);
  });

  it('shows vs until there is a result', () => {
    const a = renderToStaticMarkup(createElement(MatchHeader, { title: 'Crown Championship', white: { name: 'A', rating: '1500' }, black: { name: 'B' } }));
    expect(a).toContain('>vs<');
    const b = renderToStaticMarkup(createElement(MatchHeader, { title: 'Crown Championship', white: { name: 'A' }, black: { name: 'B' }, result: '1-0' }));
    expect(b).toContain('A (White) vs B (Black), final result 1-0');
  });

  it('renders every panel (tabs only hide them at phone width) and marks the active tab', () => {
    const html = renderToStaticMarkup(createElement(MatchLayout, {
      board: 'board', active: 'market', onActive: noop, tabsLabel: 'Arena Panels', columns: 2,
      panels: [{ id: 'analysis', label: 'Moves & Eval', content: 'A', column: 0 }, { id: 'market', label: 'Market', content: 'M', column: 1 }],
    }));
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/aria-selected="true"[^>]*>Market</);
    expect(html.match(/class="mc-panel is-(on|off)"/g)).toHaveLength(2);
    expect(html).toContain('mc-cols-2');
  });
});
