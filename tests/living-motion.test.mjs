import test from 'node:test';
import assert from 'node:assert/strict';
import {breeze,treeBend,winterAmount} from '../Chaua-Educa-main/js/living-motion.mjs';
import {climateReferenceSeconds} from '../Chaua-Educa-main/js/climate-progress.mjs';
const at=p=>({mode:'aventura',seed:104,elapsed:climateReferenceSeconds('aventura',104)*p});

test('ambient motion is bounded, continuous and stationary with reduced motion',()=>{
 for(let t=0;t<30;t+=1/60){
  assert.ok(Math.abs(breeze(t,1))<=.8);
  assert.ok(Math.abs(breeze(t+1/60,1)-breeze(t,1))<.04);
  assert.equal(breeze(t,1,true),0);
  assert.equal(treeBend(t,1,3,.1,true),0);
 }
 assert.equal(winterAmount(at(0)),0);
 assert.equal(winterAmount(at(.60)),0);
 assert.equal(winterAmount(at(.85)),1);
});
