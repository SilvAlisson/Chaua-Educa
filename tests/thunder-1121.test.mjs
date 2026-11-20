import test from 'node:test';
import assert from 'node:assert/strict';
import {ForestAudio} from '../Chaua-Educa-main/js/audio.mjs';
import {lightningStrikeAt,LIGHTNING_CYCLE_SECONDS} from '../Chaua-Educa-main/js/lightning.mjs';
import {drawLightning,drawLightningIllumination,lightningFlashStrength} from '../Chaua-Educa-main/js/weather.mjs';

function fakeAudioContext(){
 const ctx={sampleRate:48000,currentTime:0,state:'running',events:[],decodeCalls:0,bufferCalls:0};
 const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(value){this.value=value;},cancelScheduledValues(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>{const n={gain:param(),frequency:param(),playbackRate:param(),connect(){return n;},disconnect(){}};return n;};
 ctx.destination=node();
 ctx.createGain=node;ctx.createBiquadFilter=node;
 ctx.createBuffer=(channels,len)=>{ctx.bufferCalls++;return {getChannelData:()=>new Float32Array(len)};};
 ctx.decodeAudioData=async bytes=>{ctx.decodeCalls++;assert.ok(bytes.byteLength>0);return {duration:5.47};};
 ctx.createBufferSource=()=>{
  const n=node();
  n.start=(...args)=>{if(!n.loop)ctx.events.push({source:n,args});};
  n.stop=when=>{n.stoppedAt=when;};
  return n;
 };
 return ctx;
}
const strikeTime=index=>lightningStrikeAt(index*LIGHTNING_CYCLE_SECONDS).startsAt+.08;
async function harness({fail=false}={}){
 const ctx=fakeAudioContext();
 let requests=0;
 const fetcher=async url=>{
  requests++;
  assert.ok(url.endsWith('/sounds/thunder-real.mp3?v=1.0.11-real-thunder'));
  if(fail)throw Error('offline');
  return {ok:true,arrayBuffer:async()=>new Uint8Array([73,68,51]).buffer};
 };
 const audio=new ForestAudio(()=>ctx,fetcher);
 audio.setEnabled(true);
 audio.ensure();
 await audio.thunderLoading;
 return {ctx,audio,requests:()=>requests};
}
test('CC0 thunder MP3 is fetched and decoded asynchronously only once',async()=>{
 const {audio,ctx,requests}=await harness();
 assert.equal(requests(),1);
 assert.equal(ctx.decodeCalls,1);
 assert.equal(ctx.bufferCalls,1,'one ambience buffer, no procedural thunder buffer');
 audio.ensure();await audio.prewarmThunder();
 assert.equal(requests(),1);
 assert.equal(ctx.decodeCalls,1);
 assert.ok(audio.thunderBuffer);
});
test('restart reuses decoded audio and allows same strike index in a fresh flight',async()=>{
 const {audio,ctx}=await harness();
 audio.beginFlight();audio.update('playing',true,strikeTime(0),0,1,1,1);
 assert.equal(ctx.events.length,1);
 const decoded=audio.thunderBuffer;
 audio.beginFlight();audio.update('playing',true,strikeTime(0),0,1,1,1);
 assert.equal(ctx.events.length,2);
 assert.equal(audio.thunderBuffer,decoded);
});
test('menu and countdown do not play thunder, even with forced storm weather',async()=>{
 const {audio,ctx}=await harness();
 const time=strikeTime(0);
 audio.update('menu',true,time,0,1,1,1);
 audio.update('countdown',true,time,0,1,1,1);
 assert.equal(ctx.events.length,0);
 audio.update('playing',true,time,0,1,1,1);
 assert.equal(ctx.events.length,1);
});
test('short, medium and prolonged real thunders have distinct durations and delays',async()=>{
 const {audio,ctx}=await harness();
 audio.beginFlight();
 audio.update('playing',true,strikeTime(0),0,1,1,1);
 audio.update('playing',true,strikeTime(1),0,1,1,1);
 audio.update('playing',true,strikeTime(2),0,1,1,1);
 assert.equal(ctx.events.length,3);
 assert.deepEqual(ctx.events.map(event=>event.args[1]),[.08,2.62,.04]);
 assert.deepEqual(ctx.events.map(event=>Math.round(event.args[2]*100)/100),[.90,1.35,2.45]);
 assert.ok(ctx.events[0].args[0]<ctx.events[1].args[0]);
 assert.ok(ctx.events[1].args[0]<ctx.events[2].args[0]);
 const effective=ctx.events.map(event=>event.args[2]/event.source.playbackRate.value);
 assert.deepEqual(effective.length,3);
 assert.ok(effective[0]>=.8&&effective[0]<=1,'short must play within 0.8–1 s');
 assert.ok(effective[1]>=1.2&&effective[1]<=1.5,'medium must play within 1.2–1.5 s');
 assert.ok(effective[2]>=2&&effective[2]<=2.8,'long must play within 2–2.8 s');
 // Every clip stays inside its own recording; no silence between packed takes.
 assert.ok(ctx.events[0].args[1]+ctx.events[0].args[2]<=2.5);
 assert.ok(ctx.events[1].args[1]+ctx.events[1].args[2]<=5.47);
 assert.ok(ctx.events[2].args[1]+ctx.events[2].args[2]<=2.5);
});
test('pause, quiz, mute and focus loss fade real thunder without re-triggering',async()=>{
 const {audio,ctx}=await harness();
 audio.update('playing',true,strikeTime(0),0,1,1,1);
 const one=ctx.events[0].source;
 audio.update('quiz',true,strikeTime(0),0,1,1,1);
 assert.equal(audio.thunderVoices.size,0);
 assert.ok(one.stoppedAt<=ctx.currentTime+.1);
 audio.update('playing',true,strikeTime(1),0,1,1,1);
 const two=ctx.events[1].source;
 audio.setEnabled(false);
 assert.equal(audio.thunderVoices.size,0);
 assert.ok(two.stoppedAt<=ctx.currentTime+.1);
 audio.setEnabled(true);
 audio.update('playing',true,strikeTime(2),0,1,1,1);
 const three=ctx.events[2].source;
 audio.update('playing',false,strikeTime(2),0,1,1,1);
 assert.ok(three.stoppedAt<=ctx.currentTime+.1);
});
test('network failure stays silent instead of synthesizing crackle',async()=>{
 const {audio,ctx,requests}=await harness({fail:true});
 assert.equal(requests(),1);
 assert.equal(audio.thunderLoadFailed,true);
 audio.update('playing',true,strikeTime(0),0,1,1,1);
 assert.equal(ctx.events.length,0);
 assert.equal(ctx.bufferCalls,1,'only wind buffer synthesized');
});
test('flash and sound still share a reproducible timing window',()=>{
 const strike=lightningStrikeAt(strikeTime(0));
 assert.ok(strike.active);
 const calls=[];
 const c=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
 drawLightning(c,960,640,strikeTime(0),1,false);
 assert.ok(calls.some(x=>x[0]==='fillRect'));
 calls.length=0;
 drawLightning(c,960,640,strikeTime(0)+.5,1,false);
 assert.equal(calls.some(x=>x[0]==='fillRect'),false);
});

test('storm illumination covers the entire flight with one low-cost screen blend',()=>{
 const strike=lightningStrikeAt(strikeTime(0));
 const time=strike.startsAt+.05;
 assert.ok(lightningFlashStrength(time,1,false)>.1);
 const operations=[],ctx=new Proxy({}, {
  get:(target,key)=>key in target?target[key]:(...args)=>operations.push({name:key,args,blend:target.globalCompositeOperation,alpha:target.globalAlpha}),
  set:(target,key,value)=>(target[key]=value,true)
 });
 drawLightningIllumination(ctx,960,640,time,1,false);
 const fills=operations.filter(op=>op.name==='fillRect');
 assert.equal(fills.length,1);
 assert.deepEqual(fills[0].args,[0,0,960,640]);
 assert.equal(fills[0].blend,'screen');
 assert.ok(fills[0].alpha>.1&&fills[0].alpha<=.66);
 operations.length=0;
 drawLightningIllumination(ctx,960,640,time,1,true);
 assert.equal(operations.length,0,'reduced motion must suppress the flash');
});
test('flight scene lighting occurs after actor/rain draw and before warnings',async()=>{
 const fs=await import('node:fs');
 const text=fs.readFileSync(new URL('../Chaua-Educa-main/js/render.mjs',import.meta.url),'utf8');
 const rain=text.indexOf('drawForegroundRain(c,this.w,this.h,sceneTime');
 const lighting=text.indexOf('drawLightningIllumination(c,this.w,this.h,sceneTime');
 const warnings=text.indexOf('const {boxes}=flightWarnings(game');
 assert.ok(rain>=0&&rain<lighting&&lighting<warnings);
});

test('all thunder pitch extremes preserve the requested short/medium/long ranges',async()=>{
 const {audio,ctx}=await harness();
 for(const [i,bounds] of [[0,[.8,1]],[1,[1.2,1.5]],[2,[2,2.8]]]){
  for(const pitch of [.70,.89,1,1.10,1.30]){
   audio.playThunder(1,{index:i,pitch,amplitude:1});
   const event=ctx.events.at(-1),rate=event.source.playbackRate.value;
   assert.ok(rate>=.97&&rate<=1.03);
   const duration=event.args[2]/rate;
   assert.ok(duration>=bounds[0]&&duration<=bounds[1],`variant ${i} pitch ${pitch}: ${duration.toFixed(3)} s`);
  }
 }
});

test('audio weather remains silent in menu and pauses immediately without muting new flights',async()=>{
 const {audio,ctx}=await harness();
 const time=strikeTime(0);
 audio.update('menu',true,time,0,1,1,1);
 assert.equal(audio.active,false);
 assert.equal(audio.ambient.gain.value,0,'menu should be silent');
 audio.update('playing',true,time,0,1,1,1);
 assert.equal(audio.active,true);
 assert.equal(ctx.events.length,1);
 const thunder=ctx.events[0].source;
 audio.update('paused',true,time,0,1,1,1);
 assert.equal(audio.active,false);
 assert.equal(audio.ambient.gain.value,0,'wind/rain must mute synchronously');
 assert.equal(thunder.stoppedAt,ctx.currentTime,'thunder must stop immediately');
 assert.equal(audio.thunderVoices.size,0);
 audio.update('menu',true,time,0,1,1,1);
 assert.equal(ctx.events.length,1);
 audio.update('playing',true,strikeTime(1),0,1,1,1);
 assert.equal(audio.active,true);
 assert.equal(ctx.events.length,2,'next flight re-enables thunder');
 audio.update('quiz',true,strikeTime(1),0,1,1,1);
 assert.equal(audio.ambient.gain.value,0,'quiz must be silent');
 assert.equal(ctx.events[1].source.stoppedAt,ctx.currentTime);
});
