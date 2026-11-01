import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSnake,SNAKE_TIMING as T} from '../Chaua-Educa-main/js/animals.mjs';
import {snakeAnimation,snakePlacement,spriteBodyRects} from '../Chaua-Educa-main/js/animation.mjs';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {SNAKE_WRAP} from '../Chaua-Educa-main/js/snake-wrap-data.mjs';

test('snake signals for at least 800ms then winds up, strikes once, recovers and never repeats',()=>{
 const w={x:400,bottom:440,snake:{age:0,retreat:false}};
 advanceSnake(w,.79,220);assert.equal(w.snake.phase,'warning');assert.equal(w.snake.attackStarted,undefined);
 advanceSnake(w,.02,220);assert.equal(w.snake.phase,'windup');assert.equal(w.snake.attackAge,0);
 advanceSnake(w,T.windup,220);assert.equal(w.snake.phase,'striking');
 advanceSnake(w,T.strike+.001,220);assert.equal(w.snake.phase,'recovering');
 advanceSnake(w,T.recovery+.001,220);assert.equal(w.snake.phase,'spent');
 for(let i=0;i<100;i++)advanceSnake(w,.1,220);assert.equal(w.snake.phase,'spent');assert.equal(w.snake.strikeCount,1);
 w.x=850;advanceSnake(w,1,220);w.x=400;advanceSnake(w,1,220);assert.equal(w.snake.strikeCount,1);
});
test('animation clips join at the same poses and attack time clamps instead of looping',()=>{
 const end=(phase,phaseAge)=>snakeAnimation({phase,phaseAge,warningAge:T.warning});
 assert.equal(snakeAnimation({phase:'warning',warningAge:T.warning}).frame,end('windup',0).frame);
 assert.equal(end('windup',T.windup).frame,end('striking',0).frame);
 assert.equal(end('striking',T.strike).frame,end('recovering',0).frame);
 assert.equal(end('recovering',T.recovery).frame,end('spent',0).frame);
 assert.deepEqual(end('spent',0),end('spent',1000));
});
test('pause freezes the warning and attack; visual interpolation does not mutate clocks',()=>{
 const g=new Game();g.state='playing';g.nextSpawn=Infinity;g.entities=[{id:1,kind:'wood',x:400,top:80,bottom:500,snake:{age:2,warningAge:1,phase:'windup',phaseAge:.1,attackStarted:true,attackAge:.1}}];
 g.snapshot();g.entities[0].snake.phaseAge=.2;const before=JSON.stringify(g.entities);assert.ok(Math.abs(g.visual(.5).entities[0].snake.phaseAge-.15)<1e-9);assert.equal(JSON.stringify(g.entities),before);
 g.pause();for(let i=0;i<240;i++)g.tick(STEP);assert.equal(JSON.stringify(g.entities),before);
});
test('larger snake has body and neck contact; retreat clears all regions and does not alter the tree',()=>{
 const g=new Game(),w={id:1,kind:'wood',x:500,top:80,bottom:450,snake:{phase:'watching',age:0}};
 assert.ok(snakePlacement(w).factor*240>120);assert.ok(g.snakeRects(w).length>20);assert.equal(SNAKE_WRAP.neckMasks.length,16);
 for(const reduced of [false,true])for(const phase of ['warning','windup','striking','recovering','spent']){
  w.snake.phase=phase;w.snake.phaseAge=.1;const rects=spriteBodyRects(w,reduced);assert.ok(rects.every(r=>Object.values(r).every(Number.isFinite)&&r.w>0&&r.h>0));
 }
 g.state='playing';g.shield=true;const woodBefore=g.woodRects(w);g.collide(w.snake,true,w);assert.equal(g.shield,false);assert.equal(w.snake.retreat,true);assert.deepEqual(g.snakeRects(w),[]);assert.deepEqual(g.woodRects(w),woodBefore);
});
