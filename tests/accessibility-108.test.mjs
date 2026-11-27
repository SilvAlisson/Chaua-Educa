import test from 'node:test';
import assert from 'node:assert/strict';
import {FlightCues,nativeKeyboardTarget} from '../Chaua-Educa-main/js/flight-accessibility.mjs';
import {ForestAudio} from '../Chaua-Educa-main/js/audio.mjs';
const snake=()=>({kind:'wood',snake:{phase:'warning'}});
const hawk=()=>({kind:'hawk',x:900});
test('attack cues respect original active warnings and do not replay across pause',()=>{
 const c=new FlightCues(),s=snake(),h=hawk(),g={state:'playing',x:200,entities:[s,h,{kind:'hawk',x:800,harmless:true}]};
 assert.equal(c.hasWarnings(g),true);
 assert.deepEqual(c.warnings(g).map(e=>e.sound),['snake-warning','hawk-warning']);assert.deepEqual(c.warnings(g),[]);
 g.state='paused';assert.equal(c.hasWarnings(g),false);g.entities.push(snake());assert.deepEqual(c.warnings(g),[]);g.state='quiz';assert.deepEqual(c.warnings(g),[]);
 g.state='playing';assert.equal(c.warnings(g).length,1);s.snake.phase='idle';s.snake.phase='warning';assert.deepEqual(c.warnings(g),[]);
 c.reset();assert.equal(c.warnings(g).length,3);
});
test('countdown announces each beat only once; resume and restart reset beats',()=>{
 const c=new FlightCues();assert.equal(c.countdown(3),true);assert.equal(c.countdown(3),false);assert.equal(c.countdown(2),true);
 assert.equal(c.countdown(null),false);assert.equal(c.countdown(2),true);c.reset();assert.equal(c.countdown(2),true);
});
test('native controls keep keyboard ownership and missing event targets are safe',()=>{
 assert.equal(nativeKeyboardTarget(null),false);assert.equal(nativeKeyboardTarget({}),false);
 let selector;assert.equal(nativeKeyboardTarget({closest:s=>{selector=s;return {};}}),true);assert.match(selector,/select/);assert.match(selector,/summary/);
});
function audioSetup(){
 const stopped=[],tones=[],calls=[];
 const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),connect(n){return n;},disconnect(){},start(){},stop(){}});
 const ctx={state:'running',sampleRate:100,currentTime:1,destination:{},createGain:node,createBiquadFilter:node,createBufferSource:node,
  createBuffer:()=>({getChannelData:()=>new Float32Array(200)}),
  createOscillator(){const o=node();o.stop=when=>{if(when===undefined){stopped.push(o);o.onended?.();}};tones.push(o);return o;},
  suspend(){calls.push('suspend');this.state='suspended';return Promise.resolve();},resume(){calls.push('resume');this.state='running';return Promise.resolve();}};
 const audio=new ForestAudio(()=>{calls.push('create');return ctx;});audio.setEnabled(true);return {audio,ctx,stopped,tones,calls};
}
test('muted or hidden audio never creates or resumes a device',()=>{
 const {audio,calls}=audioSetup();audio.setEnabled(false);audio.play('snake-warning');assert.deepEqual(calls,[]);
 audio.setEnabled(true);audio.visible=false;audio.play('countdown');assert.equal(audio.ensure(),false);assert.deepEqual(calls,[]);
});
test('background stops scheduled tones, silences graph and releases voices',async()=>{
 const {audio,ctx,stopped,calls}=audioSetup();audio.play('hawk-warning');assert.equal(audio.voices,2);
 audio.update('paused',false,0,0);await Promise.resolve();assert.equal(stopped.length,2);assert.equal(audio.voices,0);assert.equal(audio.master.gain.value,0);assert.equal(ctx.state,'suspended');
 audio.play('snake-warning');assert.equal(audio.voices,0);assert.deepEqual(calls,['create','suspend']);
});
test('a return gesture can recover interrupted audio; unsupported devices remain optional',()=>{
 const {audio,ctx,calls}=audioSetup();audio.ensure();ctx.state='interrupted';audio.ensure();assert.ok(calls.includes('resume'));
 const unsupported=new ForestAudio(()=>{throw Error('no audio device');});unsupported.setEnabled(true);assert.doesNotThrow(()=>unsupported.play('countdown'));assert.equal(unsupported.context,null);
});
test('new warning tones obey volume and mute; unknown events stay silent',()=>{
 const {audio,tones}=audioSetup();audio.setVolume(.25);audio.play('snake-warning');assert.equal(tones.length,2);assert.equal(audio.master.gain.value,.25);
 audio.play('unknown');assert.equal(tones.length,2);audio.setEnabled(false);audio.play('countdown');assert.equal(tones.length,2);assert.equal(audio.master.gain.value,0);
});

test('ambient forest never synthesizes unverified bird calls; action cues remain available',()=>{
 const {audio,ctx,tones}=audioSetup();audio.ensure();
 for(let t=0;t<80;t++){ctx.currentTime=t;audio.update('playing',true,t,0);}
 assert.equal(tones.length,0);
 audio.play('fruit');assert.equal(tones.length,2);
});
