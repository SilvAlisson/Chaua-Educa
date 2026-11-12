import test from 'node:test';
import assert from 'node:assert/strict';
import {winterBreathSettings,drawSnowShedding}
 from '../Chaua-Educa-main/js/winter-vfx.mjs';
import {drawAnimalBreath} from '../Chaua-Educa-main/js/render.mjs';
import {images} from '../Chaua-Educa-main/js/assets.mjs';

const species=['chaua','snake','hawk'];
function mock(){
 const draws=[];
 const c={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},
  arc(){draws.push(['arc'])},fill(){},drawImage(...args){draws.push(['img',...args])}};
 return {c,draws};
}

test('cold vapour exists only during active winter and respects reduced motion',()=>{
 for(const kind of species){
  assert.equal(winterBreathSettings(kind,0,0),null);
  assert.equal(winterBreathSettings(kind,.18,0),null);
  assert.equal(winterBreathSettings(kind,1,0,{reduced:true}),null);
  assert.equal(winterBreathSettings(kind,1,0,{activity:.95}),null);
  const t=Array.from({length:200},(_,i)=>i*.1).find(t=>
    winterBreathSettings(kind,1,t)!==null);
  assert.ok(t!==undefined,kind+' has no visible winter exhalation');
  const full=winterBreathSettings(kind,1,t);
  assert.ok(full.strength>.01&&full.strength<=.68);
  assert.equal(full.puffs,2);
  const low=winterBreathSettings(kind,1,t,{low:true});
  if(low)assert.equal(low.puffs,1);
  assert.deepEqual(full,winterBreathSettings(kind,1,t),
   'breath cannot randomly change between equal paused frames');
 }
});

test('vapour exclusively samples existing four-frame clay-breath WebP',t=>{
 const previous=images.get('clay-breath');
 t.after(()=>{if(previous)images.set('clay-breath',previous);else images.delete('clay-breath')});
 const atlas={naturalWidth:512,naturalHeight:128};
 images.set('clay-breath',atlas);
 const full=mock();
 drawAnimalBreath(full.c,44,0,.65,.5,2.85,.34,1,18,-9,2,.85);
 const frames=full.draws.filter(x=>x[0]==='img');
 assert.ok(frames.length>=1&&frames.length<=2);
 assert.ok(frames.every(x=>x[1]===atlas&&x[4]===128&&x[5]===128));
 assert.ok(frames.every(x=>x[2]>=0&&x[2]<=384&&x[2]%128===0));
 const low=mock();
 drawAnimalBreath(low.c,44,0,.65,.5,2.85,.34,1,18,-9,1,.85);
 assert.ok(low.draws.filter(x=>x[0]==='img').length<=1);
 const noWinter=mock();drawAnimalBreath(noWinter.c,44,0,0,.5);
 assert.equal(noWinter.draws.length,0);
});

test('dislodged snow is tiny, deterministic, and suppressed when no action or winter',()=>{
 for(const kind of species){
  const none=mock();
  drawSnowShedding(none.c,kind,0,5,.8);
  assert.equal(none.draws.length,0);
  drawSnowShedding(none.c,kind,1,5,.1);
  assert.equal(none.draws.length,0);
  drawSnowShedding(none.c,kind,1,5,.8,{reduced:true});
  assert.equal(none.draws.length,0);
  const high=mock(),repeat=mock(),low=mock();
  drawSnowShedding(high.c,kind,1,5.2,.8,{seed:42});
  drawSnowShedding(repeat.c,kind,1,5.2,.8,{seed:42});
  drawSnowShedding(low.c,kind,1,5.2,.8,{seed:42,low:true});
  assert.deepEqual(high.draws,repeat.draws);
  assert.equal(high.draws.filter(x=>x[0]==='arc').length,5);
  assert.equal(low.draws.filter(x=>x[0]==='arc').length,2);
 }
});
