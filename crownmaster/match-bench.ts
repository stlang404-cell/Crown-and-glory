import { writeFileSync, readFileSync } from 'node:fs';
import { Position } from '../src/rules/position';
import { automaticOutcome, claimableDraws } from '../src/rules/adjudication';
import { parseLegalCcn } from '../src/rules/notation';
import { Searcher } from '../src/engine/search';
import { CANON_OPTS } from '../src/engine/canonical';
import { calculate, type Study } from './src/core';
const openings = ['', 'c2c3 c5c4', 'b2b3 b5b4 e1d3 e6d4', 'd2d3 d5d4 b1c3 b6c4'];
const games = []; let wins=0,draws=0,losses=0,unfinished=0;
for(const opening of openings) for(const labColor of [0,1]) {
 const p=Position.start(); for(const c of opening.split(' ').filter(Boolean)) p.makeMove(parseLegalCcn(p,c));
 const s:Study={name:'Match',initialFen:p.toFen(),setupMoves:[],moves:[]}, base=new Searcher(18);let outcome=automaticOutcome(p), claimed=false;
 for(let ply=0;ply<160 && !outcome;ply++) {
  const claims=claimableDraws(p);if(claims.threefold || claims.fiftyMove){claimed=true;break;}
  let move:number;
  if(p.side===labColor) {const r=calculate(s,s.moves.length,25,3,()=>{}); if(!r.candidates.length) throw new Error('No completed lab move');move=parseLegalCcn(p,r.candidates[0].ccn);}
  else move=base.search(p,{...CANON_OPTS,limits:{timeMs:25}}).bestMove;
  if(!p.legalMoves().includes(move))throw new Error('Illegal benchmark move');
  const {moveToCcn}=await import('../src/rules/notation');s.moves.push(moveToCcn(move));p.makeMove(move);outcome=automaticOutcome(p);
 }
 let result:string;if(claimed||outcome?.winner===null){draws++;result='draw';}else if(outcome){if(outcome.winner===labColor){wins++;result='win';}else{losses++;result='loss';}}else{unfinished++;result='unfinished';}
 games.push({opening,labColor,plies:s.moves.length,result,termination:claimed?'claimable-draw':outcome?.termination??'160-ply cap',moves:s.moves});console.log(`Game ${games.length}: ${result}`);
}
const n=wins+draws+losses, score=n?(wins+draws/2)/n:null;
const r={games:games.length,wins,draws,losses,unfinished,budgetMs:25,maxPlies:160,score,scoreInterval95:null,intervalMethod:'Not estimated: four fixed opening pairs, one unfinished game, and wall-clock variability are insufficient for a population-strength interval',details:games};
const report=JSON.parse(readFileSync('crownmaster/benchmark-results.json','utf8'));report.matches=r;writeFileSync('crownmaster/benchmark-results.json',JSON.stringify(report,null,2)+'\n');
