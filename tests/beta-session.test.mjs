import test from 'node:test';
import assert from 'node:assert/strict';
import {BetaSession,BETA_MAX_FRAMES} from '../Chaua-Educa-main/js/beta-session.mjs';
const playing={stateBefore:'playing',stateAfter:'playing',stage:0,profile:'auto/high/1/high',viewport:[393,727]};
test('beta excludes paused, hidden, blurred, countdown, training and cross-state intervals without clamping real stalls',()=>{
 const s=new BetaSession();s.frame(0,playing);s.frame(16,playing);s.frame(616,playing);
 for(const c of [{stateAfter:'paused'},{visible:false},{focused:false},{stateBefore:'countdown'},{training:true}]){
  s.frame(1000,{...playing,...c});s.frame(5000,playing);s.frame(5016,playing);
 }
 const r=s.report();assert.equal(r.measurement.summary.frames,7);assert.equal(r.measurement.summary.maxFrameMs,600);assert.equal(r.measurement.summary.framesOver100Ms,1);
 assert.equal(r.measurement.sampledPlayingSeconds,.7);assert.equal(r.validationStatus,'aguarda-revisao-humana-e-matriz-real');
 s.interrupt();s.frame(50000,playing);assert.equal(s.report().measurement.summary.frames,7);
});
test('beta bounds samples and details, preserves stage/profile summaries and freezes after stop',()=>{
 const s=new BetaSession();for(let i=0;i<BETA_MAX_FRAMES+4;i++)s.frame(i*16,{...playing,stage:i%4,profile:i%2?'low':'high'});
 s.stop();s.frame(99999999,playing);s.event('fruit');
 const r=s.report();assert.equal(r.measurement.summary.frames,BETA_MAX_FRAMES);assert.equal(r.measurement.droppedFrames,3);assert.equal(r.measurement.capped,true);assert.equal(r.measurement.boundedDetailsTruncated,true);
 assert.equal(r.transitions.length,120);assert.equal(Object.keys(r.measurement.byStage).length,4);assert.equal(Object.keys(r.measurement.byProfile).length,2);assert.deepEqual(r.events,{});assert.equal(r.active,false);
});
test('beta reports only approved metadata, keeps unknown/physical assertions distinct, sanitizes feedback and never includes player data',()=>{
 const s=new BetaSession({device:{group:'iniciante',family:'android',environment:'emulado',model:'x'.repeat(200),playerName:'SEGREDO'},build:'test',instrumented:true});
 s.attempt({seed:17,mode:'tranquilo',player:'SEGREDO',partial:true});s.event('lose',{score:12,elapsed:34,stage:1,player:'SEGREDO'});s.event('unapproved',{player:'SEGREDO'});
 const r=s.report({fun:5,clarity:0,comfort:'3',learned:'a'.repeat(900),problem:'b'.repeat(1000),severity:'grave',tasks:{treino:true,voo:false,secret:true},player:'SEGREDO'});
 assert.equal(JSON.stringify(r).includes('SEGREDO'),false);assert.equal(r.device.environment,'emulado');assert.equal(r.device.model.length,80);assert.equal(r.feedback.fun,5);assert.equal(r.feedback.clarity,null);assert.equal(r.feedback.comfort,3);assert.equal(r.feedback.learned.length,500);assert.equal(r.feedback.problem.length,800);assert.equal(r.feedback.severity,'grave');assert.equal(r.feedback.tasks.treino,'concluido');assert.equal(r.feedback.tasks.voo,'nao-avaliado');assert.equal(r.measurement.additionalInstrumentationObserved,true);assert.equal(r.attempts[0].outcome,'lose');assert.equal(r.attempts[0].partial,true);assert.equal(r.attempts[0].score,12);
 assert.equal(new BetaSession().report().device.environment,'nao-informado');assert.equal(new BetaSession().report().measurement.summary.fps,null);
});
test('beta outcome events remain bounded by attempt limit and do not mutate game snapshots',()=>{
 const g={seed:1,mode:'aventura',tutorial:null};const s=new BetaSession();for(let i=0;i<50;i++)s.attempt(g);s.event('fruit');s.event('win',{score:40,elapsed:300,stage:3});assert.deepEqual(g,{seed:1,mode:'aventura',tutorial:null});assert.equal(s.report().attempts.length,30);assert.equal(s.report().events.fruit,1);assert.equal(s.report().attempts.at(-1).outcome,'nao-concluido');
});
