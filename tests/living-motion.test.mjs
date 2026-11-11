import test from 'node:test';
import assert from 'node:assert/strict';
import {breeze,treeBend,winterAmount} from '../Chaua-Educa-main/js/living-motion.mjs';

test('ambient motion is bounded, continuous and stationary with reduced motion',()=>{
 for(let t=0;t<30;t+=1/60){
  assert.ok(Math.abs(breeze(t,1))<=.8);
  assert.ok(Math.abs(breeze(t+1/60,1)-breeze(t,1))<.04);
  assert.equal(breeze(t,1,true),0);
  assert.equal(treeBend(t,1,3,.1,true),0);
 }
 assert.equal(winterAmount(0),0);
 assert.equal(winterAmount(21000),0);
 assert.equal(winterAmount(11000),1);
 assert.equal(winterAmount(19000),0);
});
