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

test('CPU callback spikes are captured independently from RAF stutter thresholds, with bounded stage timings',()=>{
 const {game,quality,renderer}=make();const r=new MatchPerformance({storage:storage()});
 r.start(game,quality,renderer);game.state='playing';game.elapsed=1.1;
 const sections={physicsMs:2,uiMs:3,audioMs:1,visualMs:4,drawMs:23,otherMs:2};
 r.frame(100,game,quality,renderer,35,true,sections);
 game.elapsed=1.15;r.frame(116.7,game,quality,renderer,3,true,null);
 const report=r.finish('ended',game,quality,renderer);
 assert.equal(report.summary.framesOver33Ms,0,'the spike may not appear in RAF intervals');
 assert.equal(report.longCallbacks.total,1);
 assert.equal(report.longCallbacks.slowest.length,1);
 assert.equal(report.longCallbacks.slowest[0].cpuMs,35);
 assert.deepEqual(report.longCallbacks.slowest[0].breakdownMs,sections);
 assert.equal(report.longCallbacks.slowest[0].entities.snakes,0);
});
test('retains only 50 largest callback entries without altering matched frame summaries',()=>{
 const {game,quality,renderer}=make();const r=new MatchPerformance({storage:storage()});
 r.start(game,quality,renderer);game.state='playing';
 for(let i=1;i<=80;i++){game.elapsed=i/60;r.frame(i*16.7,game,quality,renderer,20+i/10,true);}
 const report=r.finish('ended',game,quality,renderer);
 assert.equal(report.longCallbacks.total,80);
 assert.equal(report.longCallbacks.slowest.length,50);
 assert.ok(Math.min(...report.longCallbacks.slowest.map(x=>x.cpuMs))>=23.1);
 assert.equal(report.summary.frames,79);
});

// The winter-mix mask is 1024x1024 per orientation. Report how often it was
// actually rebuilt near a CPU spike, rather than inferring it from snowfall.
test('mask-rebuild counters are correlated with long callback records',async()=>{
 const {snowMaskMetrics}=await import('../Chaua-Educa-main/js/tree-art.mjs');
 const {game,quality,renderer}=make(),r=new MatchPerformance({storage:storage()});
 r.start(game,quality,renderer);game.state='playing';
 r.frame(100,game,quality,renderer,1,true);
 snowMaskMetrics.rebuilds+=2;
 try{
  r.frame(116.7,game,quality,renderer,22,true,{physicsMs:1,uiMs:0,audioMs:0,visualMs:0,drawMs:21,otherMs:0});
  const result=r.finish('ended',game,quality,renderer);
  assert.equal(result.snowMask.rebuildsDuringFlight,2);
  assert.equal(result.longCallbacks.slowest[0].snowMaskRebuilds,2);
 }finally{snowMaskMetrics.rebuilds-=2;}
});

test('direct snow clipping counts independently from legacy atlas rebuilds',async()=>{
 const {snowMaskMetrics}=await import('../Chaua-Educa-main/js/tree-art.mjs');
 const {game,quality,renderer}=make(),r=new MatchPerformance({storage:storage()});
 r.start(game,quality,renderer);game.state='playing';
 r.frame(100,game,quality,renderer,1,true);
 snowMaskMetrics.directClips+=5;
 try{
  r.frame(116.7,game,quality,renderer,23,true,{physicsMs:1,uiMs:0,audioMs:0,visualMs:0,drawMs:22,otherMs:0});
  const result=r.finish('ended',game,quality,renderer);
  assert.equal(result.snowMask.directClipsDuringFlight,5);
  assert.equal(result.snowMask.rebuildsDuringFlight,0);
  assert.equal(result.longCallbacks.slowest[0].snowDirectClips,5);
 }finally{snowMaskMetrics.directClips-=5;}
});

test('ordinary match reports identify which snow rendering algorithm ran',async()=>{
 const {SNOW_RENDER_MODE}=await import('../Chaua-Educa-main/js/tree-art.mjs');
 const {game,quality,renderer}=make(),r=new MatchPerformance({storage:storage()});
 r.start(game,quality,renderer);
 r.frame(100,game,quality,renderer,2,true);
 const report=r.finish('ended',game,quality,renderer);
 assert.equal(report.snowMask.renderer,SNOW_RENDER_MODE);
 assert.ok(['direct','legacy','sprites'].includes(report.snowMask.renderer));
});

test('slow callback export includes named renderer passes when available',()=>{
 const {game,quality,renderer}=make(),r=new MatchPerformance({storage:storage()});
 renderer._renderCpuParts={backgroundMs:5,treesMs:9,entitiesMs:21,
  birdMs:3,particlesMs:1,foregroundMs:2};
 r.start(game,quality,renderer);game.state='playing';
 r.frame(100,game,quality,renderer,41,true,{
  physicsMs:0,uiMs:0,audioMs:0,visualMs:0,drawMs:41,otherMs:0});
 const report=r.finish('ended',game,quality,renderer);
 const row=report.longCallbacks.slowest[0];
 assert.equal(row.renderPartsMs.entitiesMs,21);
 assert.equal(row.renderPartsMs.backgroundMs,5);
});
