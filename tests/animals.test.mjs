import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceHawk,advanceSnake} from '../Chaua-Educa-main/js/animals.mjs';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
function hawk(){return {kind:'hawk',x:1040,y:100,startX:1040,startY:100,targetX:160,targetY:420,warning:1.7,age:0,dive:true};}
test('hawk stays fixed during warning then follows exactly the announced line',()=>{
 const h=hawk();advanceHawk(h,1,250,220);assert.equal(h.phase,'warning');assert.equal(h.x,1040);assert.equal(h.y,100);
 advanceHawk(h,.7,250,220);assert.equal(h.warning,0);advanceHawk(h,.5,250,220);
 assert.equal(h.phase,'crossing');assert.equal(h.x,890);assert.ok(Math.abs(h.y-(100+320*150/880))<1e-8);
 const path=[h.startX,h.startY,h.targetX,h.targetY];advanceHawk(h,.5,300,400);assert.deepEqual([h.startX,h.startY,h.targetX,h.targetY],path);
});
test('passed hawks become harmless, shield retreat exits within two seconds',()=>{
 const h=hawk();h.warning=0;h.x=180;advanceHawk(h,.1,250,220);assert.equal(h.phase,'leaving');assert.equal(h.harmless,true);
 const g=new Game();g.state='playing';g.shield=true;const bird=hawk();bird.warning=0;bird.x=g.x;bird.y=g.y;
 g.entities=[bird];g.collide(bird,true);const x=bird.x;advanceHawk(bird,.1,g.speed,g.x);assert.ok(bird.x>x);assert.equal(bird.phase,'retreat');assert.equal(g.score,0);
 advanceHawk(bird,1.9,g.speed,g.x);assert.equal(bird.finished,true);g.nextSpawn=Infinity;g.y=300;g.tick(STEP);assert.equal(g.entities.length,0);
});
test('snake stages advance while its animated head stays near the announced position',()=>{
 const g=new Game();const e={kind:'wood',x:900,bottom:400,snake:{y:435,retreat:false}};
 advanceSnake(e,STEP,220);assert.equal(e.snake.phase,'watching');
 e.x=700;const rects=g.snakeRects(e);advanceSnake(e,STEP,220);assert.equal(e.snake.phase,'warning');assert.ok(Math.abs(g.snakeRects(e)[0].x-rects[0].x)<12);assert.ok(Math.abs(g.snakeRects(e)[0].y-rects[0].y)<12);
 e.x=300;advanceSnake(e,STEP,220);assert.equal(e.snake.phase,'occupied');e.x=100;advanceSnake(e,STEP,220);assert.equal(e.snake.phase,'leaving');
 e.snake.retreat=true;advanceSnake(e,.2,220);assert.equal(e.snake.phase,'retreat');assert.equal(g.snakeRects(e).length,0);
});
test('pause freezes both animal phases and warning clocks',()=>{
 const g=new Game();g.state='playing';g.entities=[hawk(),{kind:'wood',x:700,top:200,bottom:420,snake:{y:455,retreat:false,phase:'warning'}}];g.pause();
 const before=JSON.stringify(g.entities);for(let i=0;i<240;i++)g.tick(STEP);assert.equal(JSON.stringify(g.entities),before);
});

test('reduced motion keeps the snake collider on the static rendered head in every phase',()=>{
 const g=new Game();
 for(const branch of [false,true]){
  const wood={kind:'wood',x:400,top:180,bottom:420,snake:{branch,retreat:false}};
  const shown=g.snakeRects(wood);
  g.reducedMotion=true;
  for(const phase of ['watching','warning','occupied','leaving'])for(const age of [.1,.4,.8,1,1.3,1.6,2,4]){
   wood.snake={branch,retreat:false,phase,age};assert.deepEqual(g.snakeRects(wood),shown,`${branch} ${phase} ${age}`);
  }
  g.reducedMotion=false;wood.snake={branch,retreat:false,phase:'occupied',age:1};const moving=g.snakeRects(wood);
  wood.snake.age=2;assert.notDeepEqual(g.snakeRects(wood),moving);
  g.reducedMotion=true;wood.snake.retreat=true;assert.deepEqual(g.snakeRects(wood),[]);
  g.reducedMotion=false;
 }
});
test('snake loss messages identify the actual trunk or branch perch',()=>{
 for(const branch of [false,true]){
  const g=new Game();g.state='playing';const snake={branch,retreat:false},wood={kind:'wood',id:1,snake,variant:branch?'branch':'plain'};
  g.collide(snake,true,wood);
  assert.equal(g.endCause,'snake');assert.equal(g.reason,`Você encostou na cobra do ${branch?'galho':'tronco'}.`);
 }
});
