import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchPerformance} from '../Chaua-Educa-main/js/match-performance.mjs';
import {activeProbe} from '../Chaua-Educa-main/js/perf-hooks.mjs';

function fixture(){
 return {
  game:{seed:2448657347,mode:'aventura',state:'countdown',elapsed:0,stage:0,
   score:0,won:false,distance:0,entities:[],particles:[],surfaceWeather:{snow:0}},
  quality:{mode:'high',level:'high'},
  renderer:{canvas:{width:1668,height:750},resolution:'high',decoration:'high',
   seasonalBackdrop:{pending:null,frames:new Map(),prewarmEnabled:true}}
 };
}
test('opt-in forensic evidence is attached to the ordinary match JSON, without another RAF',()=>{
 const {game,quality,renderer}=fixture();
 const r=new MatchPerformance({storage:null});
 r.forensicEnabled=true;
 try{
  r.start(game,quality,renderer);
  assert.equal(activeProbe,r.forensic);
  assert.equal(typeof renderer.seasonalBackdrop.onTelemetry,'function');
  renderer.seasonalBackdrop.onTelemetry('surface-start',{seasonId:2,urgent:false});
  renderer.seasonalBackdrop.onTelemetry('surface-ready',{seasonId:2,slices:32});
  game.state='playing';game.elapsed=1;game.entities=[{
   id:4,kind:'hawk',warning:1.5,phase:'warning',dive:true,attackKind:'mergulho'
  }];
  const t=performance.now()+50;
  r.frame(t,game,quality,renderer,2,true);
  r.forensic.beginFrame(t+33,0);
  const started=r.forensic.begin('render.hawkArtwork');
  r.forensic.end('render.hawkArtwork',started,{asset:'v6:10:11',dive:true});
  r.forensic.firstDraw('hawk:v6:10:11',1);
  r.forensic.endFrame();
  game.elapsed=1.04;
  game.entities[0].phase='crossing';game.entities[0].warning=0;
  r.frame(t+33.34,game,quality,renderer,2,true);
  const report=r.finish('ended',game,quality,renderer);
  assert.equal(activeProbe,null);
  assert.equal(renderer.seasonalBackdrop.onTelemetry,null);
  assert.equal(renderer.seasonalBackdrop.prewarmEnabled,true);
  assert.equal(report.measurement.deepInstrumentation,true);
  assert.equal(report.summary.stutterThresholdMs,28);
  assert.equal(report.stutters.length,1);
  assert.equal(report.stutters[0].entities.hawk,1);
  assert.equal(report.stutters[0].currentCallbackCpuMs,2);
  assert.equal(report.forensics.correlatedStutters.length,1);
  assert.ok(report.forensics.gameEvents.some(x=>x.name==='seasonal:surface-ready'));
  assert.ok(report.forensics.gameEvents.some(x=>x.name==='hawk-state'));
  assert.ok(report.forensics.gameEvents.some(x=>x.name==='first-draw'));
  assert.equal(report.experiment.fixedSeed,2448657347);
  assert.ok(report.forensics.limitations.some(x=>x.includes('GPU')));
 }finally{
  if(r.current)r.finish('cancelled',game,quality,renderer);
 }
});
test('ordinary automatic match reports do not enable deep hooks',()=>{
 const {game,quality,renderer}=fixture();
 const r=new MatchPerformance({storage:null});
 r.forensicEnabled=false;r.start(game,quality,renderer);
 const t=performance.now()+40;game.state='playing';
 r.frame(t,game,quality,renderer,2,true);
 r.frame(t+29,game,quality,renderer,2,true);
 const report=r.finish('ended',game,quality,renderer);
 assert.equal(activeProbe,null);
 assert.equal(report.measurement.deepInstrumentation,false);
 assert.equal(report.forensics,undefined);
 assert.equal(report.summary.stutterCount,1);
 assert.equal(report.summary.framesOver22Ms,1);
});
