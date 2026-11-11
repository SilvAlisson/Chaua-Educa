import test from 'node:test';
import assert from 'node:assert/strict';
import {parrotAction,hawkAction,snakeAction,ACTION_TIMINGS} from '../Chaua-Educa-main/js/action-states.mjs';
import {ACTION_SHEET_DEFS,drawActionSheet} from '../Chaua-Educa-main/js/action-sheets.mjs';
test('all six image atlas grid definitions match authored bundle dimensions',()=>{
 assert.equal(Object.keys(ACTION_SHEET_DEFS).length,6);
 assert.deepEqual(Object.values(ACTION_SHEET_DEFS).map(v=>v.columns*v.rows),[8,6,8,6,6,6]);
 assert.ok(Object.values(ACTION_SHEET_DEFS).every(v=>v.path.startsWith('../public/')&&v.cell>=256));
});
test('parrot flight, shield contact and fatal impact never mix their states',()=>{
 assert.equal(parrotAction({wing:.8,time:0}).sheet,'parrot-flight');
 assert.equal(parrotAction({wing:0}).state,'gliding');
 assert.equal(parrotAction({shieldHitAge:.11}).state,'shield-rebound');
 assert.equal(parrotAction({defeated:true,impactProgress:.7}).state,'impact');
 assert.equal(parrotAction({defeated:true,impactProgress:1}).state,'stunned');
 assert.equal(parrotAction({defeated:true,impactProgress:1}).frame,5);
 assert.ok(ACTION_TIMINGS.parrotImpact>ACTION_TIMINGS.parrotRecoil);
 assert.ok(ACTION_TIMINGS.shieldRebound<ACTION_TIMINGS.parrotImpact);
 assert.equal(parrotAction({reduced:true,defeated:true}),null);
 assert.equal(parrotAction({perched:true}),null);
 assert.equal(parrotAction({landing:.5}),null);
 assert.equal(parrotAction({shieldHitAge:.31}).state,'gliding');
});
test('predator keeps original dive/glide and switches to daze only after shield',()=>{
 assert.equal(hawkAction({warning:1.1},1),null);
 assert.equal(hawkAction({warning:0,phase:'crossing'},1).state,'flight');
 assert.equal(hawkAction({warning:0,dive:true},1),null);
 assert.equal(hawkAction({warning:0,phase:'leaving'},1),null);
 assert.equal(hawkAction({retreat:true,dazed:true,retreatTime:0}).state,'shield-impact');
 assert.equal(hawkAction({retreat:true,dazed:true,retreatTime:.4}).state,'stunned');
 assert.equal(hawkAction({retreat:true,dazed:true,retreatTime:1.2}).state,'dazed-exit');
 assert.equal(hawkAction({retreat:true,dazed:true,retreatTime:.4},1,true),null);
});
test('snake states follow original 0.45/0.22/0.60 physical timings',()=>{
 assert.equal(snakeAction({phase:'watching'}).state,'alert');
 assert.equal(snakeAction({phase:'warning',warningAge:.7}).frame,1);
 assert.equal(snakeAction({phase:'windup',phaseAge:0}).frame,2);
 assert.equal(snakeAction({phase:'windup',phaseAge:.44}).frame,3);
 assert.equal(snakeAction({phase:'striking',phaseAge:.21}).frame,4);
 assert.equal(snakeAction({phase:'recovering',phaseAge:.5}).frame,5);
 assert.equal(snakeAction({retreat:true,dazed:true,retreatTime:.05}).state,'shield-impact');
 assert.equal(snakeAction({retreat:true,dazed:true,retreatTime:.5}).state,'stunned');
 assert.equal(snakeAction({retreat:true,dazed:true,retreatTime:.6},true),null);
});
test('missing sheet never prevents legacy game art rendering',()=>{
 assert.equal(drawActionSheet(null,'hawk-flight',0,0,0,32,32),false);
});

test('hawk pose weights are continuous across every wing frame boundary',()=>{
 const weights=t=>{const a=hawkAction({id:0},t,false),w=Array(8).fill(0);w[a.frame]+=1-a.blend;w[a.next]+=a.blend;return w;};
 for(let i=1;i<=16;i++){
  const a=weights(i/8-1e-8),b=weights(i/8+1e-8);
  assert.ok(a.every((v,k)=>Math.abs(v-b[k])<1e-6));
 }
});
