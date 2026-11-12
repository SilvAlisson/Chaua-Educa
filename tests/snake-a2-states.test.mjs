import test from 'node:test';
import assert from 'node:assert/strict';
import {snakeA2Pose,preloadSnakeA2,isSnakeA2Ready,drawSnakeA2,SNAKE_A2_GRID,snakeA2NeedsMirror} from '../Chaua-Educa-main/js/snake-a2.mjs';
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
test('official A2 physics is independent of browser graphics and rendering fails explicitly',async()=>{
 const {snakeA2HitsPlayer,snakeA2CollisionRects}=await import('../Chaua-Educa-main/js/snake-a2.mjs');
 const {playerShapes}=await import('../Chaua-Educa-main/js/collision.mjs');
 await preloadSnakeA2(); // Node has no Image; the static A2 collision data must still work.
 assert.equal(isSnakeA2Ready(),false);
 const wood={x:200,bottom:450,snake:{phase:'watching',age:0}};
 assert.ok(snakeA2CollisionRects(wood).length>20);
 assert.equal(typeof snakeA2HitsPlayer(wood,playerShapes(229,350)),'boolean');
 assert.throws(()=>drawSnakeA2(null,{phase:'striking'},.52),/A2 ainda não carregada/);
});

test('A2 faces the incoming Chauá throughout alert, windup and strike',()=>{
 for(const key of ['idle','attack'])for(let f=0;f<8;f++){
  const expected=key==='attack'&&(f===4||f===5);
  assert.equal(snakeA2NeedsMirror({key,frame:f}),expected,key+' frame '+f);
 }
 assert.equal(snakeA2NeedsMirror({key:'stunned',frame:3}),true);
});

test('dazed loop continues from the impact pose without skipping poses',()=>{
 let previous=snakeA2Pose({retreat:true,dazed:true,retreatTime:.849}).frame;
 for(let i=0;i<240;i++){
  const current=snakeA2Pose({retreat:true,dazed:true,retreatTime:.85+i/120}).frame;
  assert.ok(Math.abs(current-previous)<=1);
  previous=current;
 }
});
