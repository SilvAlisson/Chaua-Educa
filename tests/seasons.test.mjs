import test from 'node:test';
import assert from 'node:assert/strict';
import {journeySeason,SeasonalBackdrop,drawSeasonParticles} from '../Chaua-Educa-main/js/seasons.mjs';
test('season transitions retain their previous frame and reach the next gradually',()=>{
 for(const [distance,from,to] of [[6000,0,1],[9000,1,3],[14000,3,2],[20000,2,0]]){
  assert.deepEqual(journeySeason(distance),{from,to,mix:0});
  assert.equal(journeySeason(distance+900).mix,.5);
  assert.equal(journeySeason(distance+1800).mix,1);
 }
});
test('reduced motion disables seasonal particles',()=>{
 drawSeasonParticles(new Proxy({},{get(){throw Error('must not draw');}}),{},800,600,10,16000,true,false);
});
test('season cache reuses surfaces and retains at most two frames',t=>{
 const previous=globalThis.OffscreenCanvas;t.after(()=>{globalThis.OffscreenCanvas=previous;});
 const c=new Proxy({},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
 let allocations=0;
 globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;allocations++;}getContext(){return c;}};
 const cache=new SeasonalBackdrop(),atlas={naturalWidth:1672,naturalHeight:941};
 for(const distance of [0,6900,10800,14900,16500,20900,22000]){
  cache.draw(c,atlas,390,844,1,42,distance,false);
  const before=allocations;cache.draw(c,atlas,390,844,1,42,distance,false);
  assert.equal(allocations,before);assert.ok(cache.frames.size<=2);
 }
 const old=[...cache.frames.values()];cache.draw(c,atlas,1366,638,1,42,22000,false);
 assert.ok(old.every(s=>s.width===0&&s.height===0));
});
