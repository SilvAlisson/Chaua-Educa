import test from 'node:test';
import assert from 'node:assert/strict';
import {VisualQuality,canvasResolution} from '../Chaua-Educa-main/js/quality.mjs';
import {Game,FlightClock} from '../Chaua-Educa-main/js/engine.mjs';

test('automatic quality requires sustained slowdown and recovers with hysteresis',()=>{
 const q=new VisualQuality();
 for(let i=0;i<59;i++)assert.equal(q.sample(1/30),false);
 let changed=false;for(let i=0;i<3;i++)changed=q.sample(1/30)||changed;
 assert.equal(changed,true);assert.equal(q.level,'low');
 for(let i=0;i<600;i++)q.sample(1/60);assert.equal(q.level,'low');
 for(let i=0;i<130;i++)q.sample(1/60);assert.equal(q.level,'high');
});
test('hidden tabs, pauses and isolated stalls never downgrade quality',()=>{
 const q=new VisualQuality();
 for(let i=0;i<300;i++){q.sample(1/30,false);q.sample(.25);q.sample(1/60);}
 assert.equal(q.level,'high');
 for(const mode of ['high','low']){q.setMode(mode);for(let i=0;i<1000;i++)q.sample(1/30);assert.equal(q.level,mode);}
 q.setMode('corrupt');assert.equal(q.mode,'auto');
});
test('backing canvas respects pixel budget on 4K and extreme displays',()=>{
 for(const [w,h,dpr] of [[3840,2160,2],[1920,1080,3],[390,844,3],[12000,8000,4]]){
  for(const mode of ['high','low']){
   const size=canvasResolution(w,h,dpr,mode);assert.ok(size.width*size.height<=4_000_000);
   assert.ok(size.dpr<=(mode==='low'?1:2));assert.ok(size.width>0&&size.height>0);
  }
 }
 assert.equal(canvasResolution(390,844,3,'low').dpr,1);
 assert.ok(Number.isFinite(canvasResolution(NaN,0,Infinity).dpr));
});
test('graphics quality cannot change fixed-step flight or encounter planning',()=>{
 const run=mode=>{
  const q=new VisualQuality(mode),g=new Game({seed:123});g.startTutorial();const clock=new FlightClock(g);
  for(let i=0;i<600;i++){q.sample(1/60);clock.advance(1/60);}
  return {y:g.y,vy:g.vy,elapsed:g.elapsed,score:g.score,distance:g.distance};
 };
 assert.deepEqual(run('low'),run('high'));assert.deepEqual(run('auto'),run('high'));
});
