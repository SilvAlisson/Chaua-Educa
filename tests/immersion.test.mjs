import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {ForestAudio} from '../Chaua-Educa-main/js/audio.mjs';

test('cosmetic bursts are bounded and do not alter the gameplay random stream',()=>{
 const g=new Game();let calls=0;g.random=()=>{calls++;return .5;};
 for(let i=0;i<30;i++){g.burst(1,2,'green',12);g.woodBurst(1,2);g.featherBurst(['green'],18);}
 assert.equal(calls,0);assert.equal(g.particles.length,96);
 g.advanceEffects(1);assert.equal(g.particles.length,0);
});
test('collection feedback captures doubled score without duplicate scoring',()=>{
 const g=new Game();g.state='playing';g.feather=3;g.collect({kind:'fruit',x:220,y:300,variety:0});
 assert.equal(g.score,6);assert.equal(g.popups.at(-1).text,'+6');assert.equal(g.popups.at(-1).gold,true);
 assert.ok(g.collectPulse>0);assert.ok(g.particles.every(p=>p.spark));
 g.advanceEffects(1);assert.equal(g.popups.length,0);assert.equal(g.collectPulse,0);assert.equal(g.score,6);
});
test('power expiration occurs once and freezes during quiz and pause',()=>{
 const g=new Game(),events=[];g.onEvent=e=>events.push(e);g.state='quiz';g.feather=STEP;g.collectPulse=.2;
 const distance=g.distance;g.tick(STEP);assert.equal(g.feather,STEP);assert.equal(g.collectPulse,.2);
 g.state='paused';g.tick(STEP);assert.equal(g.feather,STEP);assert.equal(g.distance,distance);
 g.state='playing';g.nextSpawn=Infinity;g.tick(STEP);
 assert.equal(g.feather,0);assert.ok(g.powerFade>0);g.tick(STEP);
 assert.equal(events.filter(e=>e.type==='feather-end').length,1);
 g.power('feather');assert.equal(g.powerFade,0);
});
test('world distance is integrated and frozen on pause, independent of graphics',()=>{
 const g=new Game();g.state='playing';g.nextSpawn=Infinity;
 for(let i=0;i<20;i++)g.tick(STEP);
 const distance=g.distance;assert.ok(distance>0);g.pause();g.tick(STEP);assert.equal(g.distance,distance);
 g.start();assert.equal(g.distance,0);assert.equal(g.popups.length,0);
});
function fakeAudio(){
 const params=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:params(),frequency:params(),connect(n){return n;},start(){},stop(){},disconnect(){}});
 return {currentTime:1,sampleRate:100,state:'running',destination:{},createGain:node,createBufferSource:node,createBiquadFilter:node,createOscillator:node,
 createBuffer:()=>({getChannelData:()=>new Float32Array(200)})};
}
test('audio requires opt-in, reuses one context and mutes ambience during dialogs',()=>{
 let contexts=0;const audio=new ForestAudio(()=>{contexts++;return fakeAudio();});
 audio.play('fruit');assert.equal(contexts,0);audio.setEnabled(true);audio.play('points');assert.equal(contexts,0);
 audio.play('fruit');audio.play('flap');assert.equal(contexts,1);
 audio.update('playing',true,10,0);assert.equal(audio.active,true);assert.ok(audio.ambient.gain.value>0);
 for(const state of ['quiz','paused','impact','ended']){audio.update(state,true,10,0);assert.equal(audio.active,false);assert.equal(audio.ambient.gain.value,0);}
 audio.update('playing',true,10,0);audio.setEnabled(false);audio.update('playing',true,10,0);
 assert.equal(audio.master.gain.value,0);assert.equal(audio.active,false);
 audio.setEnabled(true);audio.update('playing',false,10,0);assert.equal(audio.active,false);
});
test('unavailable audio cannot block game feedback',()=>{
 const audio=new ForestAudio(()=>{throw new Error('No device');});audio.setEnabled(true);
 assert.doesNotThrow(()=>audio.play('fruit'));assert.doesNotThrow(()=>audio.update('playing',true,10,0));
});
