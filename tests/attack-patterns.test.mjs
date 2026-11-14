import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {advanceSnake,advanceHawk,predictedHawkY} from '../Chaua-Educa-main/js/animals.mjs';
import {SNAKE_ATTACK_ORDER,HAWK_ATTACK_ORDER,snakeAttack} from '../Chaua-Educa-main/js/attack-patterns.mjs';
import {snakeA2Pose,snakeA2CollisionRects,snakeA2HitsPlayer,snakeA2FruitHasClearance} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {playerShapes,hawkShapes,shapesIntersect,hawkAngle} from '../Chaua-Educa-main/js/collision.mjs';

test('every snake attack warns, strikes once before passing and uses its own authored atlas',()=>{
 for(const attackType of SNAKE_ATTACK_ORDER)for(const speed of [205,340,520]){
  const wood={x:1040,bottom:470,snake:{attackType}},s=wood.snake,timing=snakeAttack(s);
  let warning=0,hitX=null;
  for(let t=0;t<8;t+=STEP){
   wood.x-=speed*STEP;advanceSnake(wood,STEP,220,speed);
   if(s.phase==='warning')warning+=STEP;
   if(s.phase==='striking'&&hitX===null){
    hitX=wood.x;assert.equal(snakeA2Pose(s).key,timing.key);
   }
  }
  assert.ok(warning>=.78);assert.ok(hitX>220&&hitX<450,`${attackType}/${speed}: ${hitX}`);
  assert.equal(s.strikeCount,1);assert.equal(s.phase,'leaving');
 }
});

test('new attack masks include the drawn body and keep fruit away from all poses',()=>{
 for(const attackType of SNAKE_ATTACK_ORDER){
  const timing=snakeAttack({attackType});
  const wood={x:400,bottom:470,snake:{attackType,phase:'striking',phaseAge:timing.strike*.3}};
  const rects=snakeA2CollisionRects(wood);assert.ok(rects.length>15);
  const body=rects.find(r=>r.w>12);assert.ok(body);
  const x=body.x+body.w/2,y=body.y+body.h/2;
  assert.equal(snakeA2HitsPlayer(wood,playerShapes(x,y)),true);
  assert.equal(snakeA2FruitHasClearance(wood,x,y),false);
  assert.equal(snakeA2FruitHasClearance(wood,400,100),true);
 }
});

test('all attack types spawn in both modes with their planned safe line and physical room',()=>{
 for(const mode of ['aventura','tranquilo']){
  const g=new Game({seed:104});g.reset(mode);g.elapsed=100;const snakes=new Set(),hawks=new Set();
  for(let i=0;i<500;i++){
   g.entities=[];g.spawn();
   for(const e of g.entities){
    if(e.snake){snakes.add(e.snake.attackType);assert.ok(e.top>=30&&e.bottom<=605);assert.equal(e.top+85,g.lastGap);}
    if(e.kind==='hawk')hawks.add(e.attackKind);
   }
  }
  assert.deepEqual([...snakes].sort(),[...SNAKE_ATTACK_ORDER].sort());
  assert.deepEqual([...hawks].sort(),[...HAWK_ATTACK_ORDER].sort());
 }
});

test('three predator curves aim at a marked lane, collide there and cannot track after lock',()=>{
 const curves=[];
 for(const attackKind of HAWK_ATTACK_ORDER){
  const e={attackKind,x:1040,startX:1040,startY:attackKind==='rasante'?535:105,y:105,targetX:160,targetY:320,attackX:220,warning:1.5};
  while(e.warning>0)advanceHawk(e,STEP,400,220,320);
  assert.equal(e.targetLocked,true);assert.equal(e.targetY,320);
  curves.push(predictedHawkY(e,630));assert.equal(predictedHawkY(e,220),320);
  const contact={...e,x:220,y:predictedHawkY(e,220)};
  assert.ok(shapesIntersect(playerShapes(220,320),hawkShapes(contact)));
  assert.ok(Math.abs(hawkAngle(contact))<=.65);
  for(let i=0;i<240;i++)advanceHawk(e,STEP,400,220,480);
  assert.equal(e.targetY,320);assert.equal(e.harmless,true);
 }
 assert.equal(new Set(curves.map(Math.round)).size,3);
});
