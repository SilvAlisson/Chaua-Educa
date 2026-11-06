import test from 'node:test';
import assert from 'node:assert/strict';
import {snakeA2Pose,preloadSnakeA2,isSnakeA2Ready,drawSnakeA2,SNAKE_A2_GRID} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {SNAKE_TIMING} from '../Chaua-Educa-main/js/animals.mjs';
const pose=(phase,phaseAge)=>snakeA2Pose({phase,phaseAge});
test('A2 sprite sheet has eight 384x384 frames per atlas',()=>{
 assert.deepEqual(SNAKE_A2_GRID,{columns:4,rows:2,cell:384,anchorX:192,anchorY:352});
});
test('watching and warning use only idle and alert art',()=>{
 for(let i=0;i<500;i++){
  const s=snakeA2Pose({phase:'watching',age:i/120});
  assert.equal(s.key,'idle');assert.ok(s.frame>=0&&s.frame<=7);
 }
 assert.equal(snakeA2Pose({phase:'warning',warningAge:0}).frame,3);
 assert.equal(snakeA2Pose({phase:'warning',warningAge:SNAKE_TIMING.warning}).frame,5);
});
test('attack follows existing physics timing',()=>{
 assert.deepEqual(pose('windup',0),{key:'attack',frame:0,state:'windup'});
 assert.equal(pose('windup',SNAKE_TIMING.windup-.001).frame,3);
 assert.equal(pose('striking',0).frame,4);
 assert.equal(pose('striking',SNAKE_TIMING.strike-.001).frame,5);
 assert.equal(pose('recovering',0).frame,6);
 assert.equal(pose('recovering',SNAKE_TIMING.recovery-.001).frame,7);
 assert.equal(pose('spent',2).key,'idle');
});
test('shield daze alone uses reaction art and reduced motion is static',()=>{
 assert.equal(snakeA2Pose({retreat:true,dazed:true,retreatTime:0}).frame,0);
 assert.equal(snakeA2Pose({retreat:true,dazed:true,retreatTime:.84}).frame,7);
 assert.equal(snakeA2Pose({retreat:true,dazed:true,retreatTime:.3},true).frame,3);
 assert.deepEqual(snakeA2Pose({retreat:true,dazed:false}),{key:'idle',frame:7,state:'retreat'});
 assert.equal(snakeA2Pose({phase:'striking'},true).key,'idle');
});
test('without optional binary art, production fallback remains functional',async()=>{
 assert.equal(await preloadSnakeA2(),false);
 assert.equal(isSnakeA2Ready(),false);
 assert.equal(drawSnakeA2(null,{phase:'striking'},.52),false);
});
