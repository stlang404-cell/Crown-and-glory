/**
 * v0.10 evaluation bar (src/ui/MatchCenter.tsx): orientation and flipping, numeric and mate display, the
 * expected-score boundary, and the fairness gate — a player's own game in progress (rated or not) renders no bar and
 * exposes no evaluation.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { EvalBar, EvalBoard, evalBarAllowed, evalBarModel, formatEval } from '../src/ui/MatchCenter';
import type { EngineScore } from '../src/analysis/types';
import { mapV2 } from '../src/analysis/outcomeMap';

const cp = (value: number, pov: 'white' | 'black' = 'white'): EngineScore => ({ kind: 'cp', value, pov });
const mate = (plies: number, pov: 'white' | 'black' = 'white'): EngineScore => ({ kind: 'mate', plies, pov, proven: false });

describe('formatEval', () => {
  it('prints pawns with one decimal from White’s side', () => {
    expect(formatEval(cp(130))).toBe('+1.3');
    expect(formatEval(cp(-40))).toBe('−0.4');
    expect(formatEval(cp(0))).toBe('0.0');
    expect(formatEval(cp(4))).toBe('0.0');
    // a score from Black's point of view is shown from White's side
    expect(formatEval(cp(50, 'black'))).toBe('−0.5');
  });
  it('prints mate as moves, signed for Black', () => {
    expect(formatEval(mate(5))).toBe('M3');
    expect(formatEval(mate(-3))).toBe('−M2');
    expect(formatEval(mate(3, 'black'))).toBe('−M2');
    expect(formatEval(mate(1))).toBe('M1');
    expect(formatEval(null)).toBe('–');
    expect(formatEval({ kind: 'terminal', outcome: 'win', pov: 'black' })).toBe('0-1');
  });
});

describe('evalBarModel', () => {
  it('uses the expected-score map, not a linear centipawn scale', () => {
    expect(evalBarModel(cp(0)).white).toBeCloseTo(mapV2(0), 9);
    expect(evalBarModel(cp(150)).white).toBeCloseTo(mapV2(150), 9);
    const small = evalBarModel(cp(100)).white - evalBarModel(cp(0)).white;
    const large = evalBarModel(cp(1100)).white - evalBarModel(cp(1000)).white;
    expect(small).toBeGreaterThan(large * 2);
    expect(evalBarModel(cp(150)).leader).toBe('white');
    expect(evalBarModel(cp(-150)).leader).toBe('black');
  });
  it('puts mate at the edge and describes it', () => {
    expect(evalBarModel(mate(5)).white).toBe(1);
    expect(evalBarModel(mate(-5)).white).toBe(0);
    expect(evalBarModel(mate(5)).label).toMatch(/White mates in 3/);
    expect(evalBarModel(null)).toMatchObject({ white: 0.5, text: '–', leader: null });
  });
});

describe('EvalBar', () => {
  const html = (score: EngineScore | null, orientation: 'white' | 'black') => renderToStaticMarkup(createElement(EvalBar, { score, orientation, source: 'published engine evaluation' }));
  it('fills White from the bottom when White is at the bottom and flips with the board', () => {
    const w = html(cp(130), 'white');
    expect(w).toContain('mc-evalbar white-bottom');
    expect(w).toContain('data-orientation="white"');
    const b = html(cp(130), 'black');
    expect(b).toContain('mc-evalbar white-top');
    expect(b).toContain('data-orientation="black"');
    const u = mapV2(130);
    expect(w).toContain(`scaleY(${u})`);
    expect(b).toContain(`scaleY(${u})`);
  });
  it('prints the value at the leading side’s end', () => {
    expect(html(cp(130), 'white')).toMatch(/mc-evalbar-value at-bottom on-white[^>]*>\+1\.3</);
    expect(html(cp(130), 'black')).toMatch(/mc-evalbar-value at-top on-white[^>]*>\+1\.3</);
    expect(html(cp(-40), 'white')).toMatch(/mc-evalbar-value at-top on-black[^>]*>−0\.4</);
    expect(html(mate(3, 'black'), 'black')).toMatch(/at-bottom on-black[^>]*>−M2</);
  });
  it('is an accessible meter that names its source', () => {
    const w = html(cp(130), 'white');
    expect(w).toContain('role="meter"');
    expect(w).toContain('aria-label="Evaluation bar (published engine evaluation)"');
    expect(w).toMatch(/aria-valuetext="\+1\.3: plus 1\.3 pawns, White is better; White&#x27;s expected score \d+%"/);
    expect(w).toMatch(/aria-valuenow="\d+"/);
  });
});

describe('fairness: no bar and no evaluation in player games', () => {
  const board = createElement('div', { className: 'board-stub' });
  const render = (context: Parameters<typeof evalBarAllowed>[0]) => renderToStaticMarkup(createElement(EvalBoard, { context, score: cp(130), orientation: 'white', source: 'engine', children: board }));
  it('rated games render no bar and expose no evaluation', () => {
    const html = render({ kind: 'play', rated: true });
    expect(evalBarAllowed({ kind: 'play', rated: true })).toBe(false);
    expect(html).not.toContain('mc-evalbar');
    expect(html).not.toContain('+1.3');
    expect(html).not.toMatch(/meter|expected score/i);
    expect(html).toBe('<div class="board-stub"></div>');
  });
  it('casual games in progress have no permanent bar either (the Assistant gives evaluations on request only)', () => {
    expect(render({ kind: 'play', rated: false })).toBe('<div class="board-stub"></div>');
  });
  it('spectating, replays and analysis show the bar', () => {
    for (const c of [{ kind: 'spectate' }, { kind: 'replay' }, { kind: 'analysis' }] as const) {
      expect(evalBarAllowed(c)).toBe(true);
      expect(render(c)).toContain('mc-evalbar');
    }
  });
  it('the play screen never renders the bar or the bar model', () => {
    const src = readFileSync(new URL('../src/ui/PlayScreen.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/EvalBar|EvalBoard|evalBarModel|formatEval/);
    // the only evaluation text in a live game is the Assistant's on-request answer, which rated games lock
    expect(src).toMatch(/!session\.assistanceAllowed/);
    expect(src).toContain('Engine help is off in rated games.');
  });
});
