import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchPerformance} from '../Chaua-Educa-main/js/match-performance.mjs';
const storage={getItem:()=>null,setItem:()=>{}};
test('quality-profile caching preserves per-profile and per-time-window statistics',()=>{
 const recorder=new MatchPerformance({storage});
 const game={seed:72,mode:'aventura',state:'playing',elapsed:0,distance:0,stage:0,score:0,
   won:false,entities:[],particles:[]};
 const renderer={canvas:{width:1280,height:720},resolution:'high',decoration:'high'};
 const quality={mode:'auto',level:'high'};
 recorder.start(game,quality,renderer);
 for(let i=1;i<=30;i++){
  game.elapsed=i/3;
  recorder.frame(100+i*16.7,game,quality,renderer,4,true);
 }
 quality.level='low';
 for(let i=31;i<=55;i++){
  game.elapsed=i/3;game.stage=1;renderer.resolution='low';
  recorder.frame(100+i*24,game,quality,renderer,5,true);
 }
 const report=recorder.finish('ended',game,quality,renderer);
 assert.equal(report.profileChanges.length,2);
 assert.deepEqual(report.profileChanges.map(x=>x.profile),['auto/high/high/high','auto/low/low/high']);
 assert.equal(Object.keys(report.byProfile).length,2);
 assert.equal(Object.keys(report.byTenSecondWindow).length,2);
 assert.equal(report.summary.frames,54);
 assert.ok(report.byStage['0'].frames>0);
 assert.ok(report.byStage['1'].frames>0);
});
