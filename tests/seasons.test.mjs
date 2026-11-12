import test from 'node:test';
import assert from 'node:assert/strict';
import {journeySeason,SeasonalBackdrop,drawSeasonParticles} from '../Chaua-Educa-main/js/seasons.mjs';
import {climateReferenceSeconds} from '../Chaua-Educa-main/js/climate-progress.mjs';
import {getWeatherMode,setWeatherMode} from '../Chaua-Educa-main/js/weather.mjs';
const at=(p,mode='aventura',seed=104)=>({mode,seed,elapsed:climateReferenceSeconds(mode,seed)*p,distance:28000});
test('one calibrated season timeline has authored, non-reversing transitions',t=>{
 const previous=getWeatherMode();t.after(()=>setWeatherMode(previous));setWeatherMode('auto');
 for(const [start,end,from,to] of [[.20,.27,0,1],[.43,.50,1,2],[.65,.74,2,3]]){
  assert.deepEqual(journeySeason(at(start)),{from,to,mix:0});
  assert.ok(Math.abs(journeySeason(at((start+end)/2)).mix-.5)<1e-8);
  assert.deepEqual(journeySeason(at(end)),{from:to,to,mix:1});
 }
 assert.throws(()=>journeySeason(19000),/requires the current Game/);
});
test('reduced motion disables seasonal particles',()=>{
 drawSeasonParticles(new Proxy({},{get(){throw Error('must not draw');}}),{},800,600,10,at(.4),true,false);
});
test('season cache reuses surfaces and retains at most two frames',t=>{
 const previous=globalThis.OffscreenCanvas;t.after(()=>{globalThis.OffscreenCanvas=previous;});
 const c=new Proxy({},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
 let allocations=0;
 globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;allocations++;}getContext(){return c;}};
 const cache=new SeasonalBackdrop(),atlas={naturalWidth:1672,naturalHeight:941};
 for(const progress of [0,.24,.33,.48,.58,.72,.85]){
  cache.draw(c,atlas,390,844,1,42,at(progress),false);
  const before=allocations;cache.draw(c,atlas,390,844,1,42,at(progress),false);
  assert.equal(allocations,before);assert.ok(cache.frames.size<=2);
 }
 const old=[...cache.frames.values()];cache.draw(c,atlas,1366,638,1,42,at(.85),false);
 assert.ok(old.every(s=>s.width===0&&s.height===0));
});

test('upcoming seasonal frame is prepared before the transition starts',t=>{
 const old=globalThis.OffscreenCanvas;t.after(()=>{globalThis.OffscreenCanvas=old;});
 const c=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 globalThis.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return c;}};
 const cache=new SeasonalBackdrop(),atlas={naturalWidth:1672,naturalHeight:941};
 cache.prepare(atlas,1366,638,1,at(0));
 for(let p=.17;p<.20;p+=.001)cache.prepare(atlas,1366,638,1,at(p));
 assert.ok(cache.frames.has(1));assert.equal(cache.frames.size,2);assert.equal(cache.pending,null);
 const next=cache.frames.get(1);cache.prepare(atlas,1366,638,1,at(.22));assert.equal(cache.frames.get(1),next);
});
