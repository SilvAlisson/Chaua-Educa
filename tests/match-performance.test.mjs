import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchPerformance,MATCH_PERF_KEY} from '../Chaua-Educa-main/js/match-performance.mjs';
const make=()=>({
 game:{seed:104,mode:'aventura',elapsed:0,stage:0,distance:0,score:0,won:false,
  state:'countdown',tutorial:null,entities:[{kind:'fruit'}],particles:[]},
 quality:{mode:'high',level:'high'},
 renderer:{canvas:{width:960,height:640},resolution:'high',decoration:'high',seasonalBackdrop:{pending:null}}
});
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
test('normal matches collect independently, skip pauses, keep only local data and never store player name',()=>{
 const s=storage(),r=new MatchPerformance({storage:s});
 const {game,quality,renderer}=make();
 r.start(game,quality,renderer);
 game.state='playing';
 r.frame(100,game,quality,renderer,3,true);
 r.frame(116.7,game,quality,renderer,4,true);
 r.frame(150.8,game,quality,renderer,5,true);
 r.frame(200,game,quality,renderer,2,false);
 r.frame(1500,game,quality,renderer,3,true);
 r.frame(1517,game,quality,renderer,2,true);
 game.state='ended';game.score=25;game.elapsed=4;
 const report=r.finish('ended',game,quality,renderer);
 assert.equal(report.summary.frames,3);
 assert.equal(report.summary.framesOver33Ms,1);
 assert.equal(report.stutters.length,1);
 assert.equal(report.stutters[0].previousCallbackCpuMs,4);
 assert.equal(report.match.score,25);
 assert.equal(report.measurement.deepInstrumentation,false);
 assert.equal(JSON.stringify(report).includes('playerName'),false);
 assert.equal(r.all().length,1);
 assert.equal(JSON.parse(s.getItem(MATCH_PERF_KEY)).length,1);
 const restored=new MatchPerformance({storage:s});assert.equal(restored.all().length,1);
 restored.start(game,quality,renderer);game.state='playing';
 restored.frame(5000,game,quality,renderer,1,true);
 restored.frame(5016.7,game,quality,renderer,1,true);
 game.state='trained';restored.frame(5030,game,quality,renderer,1,false);
 assert.equal(restored.all().length,2);
});
test('storage unavailable does not break play; disabling collector discards an unfinished match',()=>{
 const {game,quality,renderer}=make();
 const r=new MatchPerformance({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}});
 r.start(game,quality,renderer);r.setEnabled(false);
 assert.equal(r.current,null);assert.equal(r.all().length,0);
 r.start(game,quality,renderer);assert.equal(r.current,null);
 r.setEnabled(true);r.start(game,quality,renderer);
 const result=r.finish('returned-to-menu',game,quality,renderer);
 assert.equal(result.summary.frames,0);assert.equal(r.savedToDevice,false);
});
test('oldest results are pruned, with bounded stutter details',()=>{
 const s=storage(),r=new MatchPerformance({storage:s,maxReports:2});
 const {game,quality,renderer}=make();game.state='playing';
 for(let n=0;n<4;n++){
  r.start(game,quality,renderer);
  r.frame(100,game,quality,renderer,1,true);
  for(let i=1;i<=200;i++)r.frame(100+i*40,game,quality,renderer,1,true);
  r.finish('ended',game,quality,renderer);
 }
 assert.equal(r.all().length,2);
 assert.ok(r.latest().stutters.length<=100);
 assert.equal(r.latest().summary.frames,200);
});
