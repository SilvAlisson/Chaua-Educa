import test from 'node:test';
import assert from 'node:assert/strict';
import {tailTipSwing,hawkDazeVisual,snakeDazeVisual} from '../Chaua-Educa-main/js/secondary-motion.mjs';
const inside=(value,max)=>assert.ok(Math.abs(value)<=max+1e-9, String(value));
test('tail tip is original at zero time, oscillates gently and respects reduced motion',()=>{
 assert.equal(tailTipSwing({age:0}),0);
 assert.equal(tailTipSwing({age:1.5},true),0);
 let max=0;for(let i=0;i<300;i++)max=Math.max(max,Math.abs(tailTipSwing({age:i/120})));
 assert.ok(max>.95);inside(max,1);
 assert.ok(Math.abs(tailTipSwing({age:1,phase:'striking'}))<=.4);
 assert.equal(tailTipSwing({retreat:true,dazed:false,age:2}),0);
 assert.equal(tailTipSwing({retreat:true,dazed:true,retreatTime:2}),0);
});
test('hawk uses bounded fading motion using existing sprites only',()=>{
 assert.deepEqual(hawkDazeVisual(.3,true),{x:0,y:0,angle:0,stars:0});
 assert.deepEqual(hawkDazeVisual(2),{x:0,y:0,angle:0,stars:0});
 for(let i=0;i<240;i++){
   const x=hawkDazeVisual(i/120);inside(x.x,2.2);inside(x.y,3.2);inside(x.angle,.185);
   assert.ok(x.stars>=0&&x.stars<=1);
 }
});
test('snake visual reaction ends without moving hitboxes',()=>{
 assert.deepEqual(snakeDazeVisual(.3,true),{x:0,y:0,angle:0,stars:0});
 assert.deepEqual(snakeDazeVisual(1.5),{x:0,y:0,angle:0,stars:0});
 for(let i=0;i<240;i++){const v=snakeDazeVisual(i/120);inside(v.x,2.5);inside(v.y,1.4);inside(v.angle,.075);}
});
