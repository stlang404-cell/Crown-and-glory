import { tacticalFacts } from '../crownmaster/src/tactics';
import { describe, it, expect } from 'vitest';
import { calculate, importStudies, replay, evaluationFacts, explain, type Study } from '../crownmaster/src/core';
import { Position, START_FEN, perft, parseLegalCcn } from '../src/rules';
import { Searcher } from '../src/engine/search';
import { CANON_OPTS } from '../src/engine/canonical';
const study = (fen = START_FEN): Study => ({ name: 'Test', initialFen: fen, setupMoves: [], moves: [] });
describe('Crownmaster integration', () => {
  it('retains the authoritative perft counts', () => expect([1,2,3,4].map(d => perft(Position.start(), d))).toEqual([10,100,1212,14332]));
  it('ranks distinct legal MultiPV moves like full root scoring at equal depth', () => {
    const s = study(), p = replay(s), out = calculate(s, 0, 10000, 5, () => {}, 3);
    const expected = new Searcher(18).scoreRootMoves(p, p.legalMoves(), 3, CANON_OPTS).sort((a,b) => b.score-a.score);
    expect(out.depth).toBe(3); expect(out.candidates).toHaveLength(5);
    expect(new Set(out.candidates.map(c => c.ccn)).size).toBe(5);
    expect(out.candidates.map(c => c.score)).toEqual(expected.slice(0,5).map(c => c.score));
    for (const c of out.candidates) { const q = p.clone(); for (const move of c.pv) { const m = parseLegalCcn(q, move); expect(m).toBeGreaterThanOrEqual(0); q.makeMove(m); } }
    expect(p.toFen()).toBe(START_FEN);
  });
  it('is deterministic at a fixed completed depth', () => {
    const a = calculate(study(),0,10000,3,()=>{},3), b = calculate(study(),0,10000,3,()=>{},3);
    expect(a.candidates).toEqual(b.candidates); expect(a.nodes).toBe(b.nodes);
  });
  it('finds known mate and hanging-queen tactics', () => {
    expect(calculate(study('k5/6/1K4/6/6/5R w - - 0 1'),0,10000,3,()=>{},4).candidates[0].ccn).toBe('f1f6');
    expect(calculate(study('3k2/6/3q2/6/3R2/3K2 w - - 0 1'),0,10000,3,()=>{},4).candidates[0].ccn).toBe('d2d4');
  });
  it('never fabricates a depth-zero evaluation', () => expect(calculate(study(),0,0,3,()=>{}).candidates).toEqual([]));
  it('does not analyze terminal draws', () => expect(calculate(study('k5/6/6/6/6/5K w - - 0 1'),0,1000,3,()=>{}).status).toContain('bare-kings'));
  it('preserves repetition history through import and replay', () => {
    const s = study('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    s.moves = ['b1a3','b6a4','a3b1','a4b6','b1a3','b6a4','a3b1','a4b6'];
    const loaded = importStudies(JSON.stringify(s))[0]; expect(replay(loaded).repetitionCount()).toBe(3);
    expect(calculate(loaded,8,1000,3,()=>{},2).claimable).toContain('Threefold draw can be claimed');
  });
  it('imports saved move records and multiple-game backups as copies', () => {
    const g = { ...study(), variantId: 'crown-la6-v1', status: 'finalized', moves: [{ ccn:'c2c3' }] };
    const [a,b] = importStudies(JSON.stringify({ format:'crown-backup-1', payload:{games:[g,g]} })); expect(a.moves).toEqual(['c2c3']); expect(replay(b).side).toBe(1);
  });
  it('rejects invalid and live game imports', () => {
    for (const raw of ['6/6/6/6/6/6 w - - 0 1', JSON.stringify({...study(),moves:['a2a4']}), JSON.stringify({...study(),status:'active'}), JSON.stringify({...study(),variantId:'chess'})]) expect(() => importStudies(raw)).toThrow();
  });
  it('provides finite static evaluation contributions without changing the position', () => { const p = Position.start(), before = p.toFen(); expect(evaluationFacts(p).every(x => Number.isFinite(x.cp))).toBe(true); expect(p.toFen()).toBe(before); });
});

describe('Crownmaster tactical evidence', () => {
  it('identifies a pin on a legal recommended move', () => {
    const p=Position.fromFen('3k2/3r2/6/6/6/3R1K w - - 0 1');
    const m=parseLegalCcn(p,'d1d2'); expect(m).toBeGreaterThanOrEqual(0);
    expect(tacticalFacts(p,['d1d2']).some(x=>x.startsWith('Pin:'))).toBe(true);
  });
  it('rejects illegal continuation evidence', () => expect(()=>tacticalFacts(Position.start(),['c2c3','a5a2'])).toThrow());
  it('grounds promotion and capture explanations in the board', () => {
    const p=Position.fromFen('1r1k2/P5/6/6/6/K5 w - - 0 1');
    const e=explain(p,'a5b6q',['a5b6q']); expect(e.join(' ')).toContain('captures a rook'); expect(e.join(' ')).toContain('promotes to a queen');
  });
});
