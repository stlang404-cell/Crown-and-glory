import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { calculate, type Study } from './src/core';
import { Position } from '../src/rules/position';
import { START_FEN } from '../src/rules/types';
import { moveToCcn } from '../src/rules/notation';
import { Searcher } from '../src/engine/search';
import { CANON_OPTS, CANON_BUILD } from '../src/engine/canonical';
const positions = [{ name: 'Opening', fen: START_FEN }, { name: 'Mate in one', fen:'k5/6/1K4/6/6/5R w - - 0 1', expected:'f1f6' }, { name:'Hanging queen', fen:'3k2/6/3q2/6/3R2/3K2 w - - 0 1', expected:'d2d4' }, { name:'Promotion', fen:'3k2/P5/6/6/6/K5 w - - 0 1', expected:'a5a6q' }];
// Warm up V8 before measurement. Same canonical engine, TT size and 500 ms wall budget in each arm.
new Searcher(18).search(Position.start(), { ...CANON_OPTS, limits:{nodes:10000} });
const results = positions.map(p => {
 const base = new Searcher(18).search(Position.fromFen(p.fen), { ...CANON_OPTS, limits: {timeMs:500} });
 const s: Study = { name:p.name, initialFen:p.fen, setupMoves:[], moves:[] };
 const lab = calculate(s,0,500,3,()=>{});
 return { name:p.name, expected:p.expected ?? null, baseline: { move:moveToCcn(base.bestMove), depth:base.depth, nodes:base.nodes, ms:base.timeMs, nps:Math.round(base.nodes/base.timeMs*1000) }, crownmaster:{ move:lab.candidates[0]?.ccn, depth:lab.depth, nodes:lab.nodes, ms:lab.elapsedMs, nps:Math.round(lab.nodes/lab.elapsedMs*1000), ttBytes:lab.ttBytes }, solved: p.expected ? lab.candidates[0]?.ccn === p.expected : null };
});
const report = { at:new Date().toISOString(), node:process.version, cpu:cpus()[0].model, engine:CANON_BUILD, budgetMs:500, multiPV:3, ttBits:18, processMemory:process.memoryUsage(), results, matches: { games:0, wins:null, draws:null, losses:null, confidenceInterval:null, reason:'Same underlying engine; no playing-strength improvement claimed. MultiPV does extra work. No match estimate without a controlled match tournament.' } };
writeFileSync('crownmaster/benchmark-results.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
