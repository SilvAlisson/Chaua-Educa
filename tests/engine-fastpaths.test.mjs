import {pickupHitsPlayer} from '../Chaua-Educa-main/js/pickup-geometry.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {playerShapes,hawkShapes,shapesIntersect,shapesHitRect} from '../Chaua-Educa-main/js/collision.mjs';
import {livingWoodRects} from '../Chaua-Educa-main/js/forest-geometry.mjs';

test('hawk broad phase never skips an exact collision',()=>{
 for(const angle of [-.23,-.1,0,.15,.28]){
  const player=playerShapes(220,320,angle);
  for(const dive of [false,true]){
   for(let dx=-160;dx<=160;dx+=5)for(let dy=-130;dy<=130;dy+=5){
    const hawk={x:220+dx,y:320+dy,dive,startX:1050,startY:dive?105:320,targetX:160,targetY:dive?500:320};
    if(shapesIntersect(player,hawkShapes(hawk)))
     assert.ok(Math.abs(dx)<180&&Math.abs(dy)<140,
       'hawk collision culled at '+JSON.stringify({angle,dive,dx,dy}));
   }
  }
 }
});
test('wood broad phase never skips an exact hit across branch variants',()=>{
 const px=220,py=320;
 for(const angle of [-.23,0,.28]){
  const body=playerShapes(px,py,angle);
  for(const variant of ['plain','branch','broken']){
   for(let dx=-175;dx<=175;dx+=5){
    const wood={x:px+dx,top:260,bottom:440,variant};
    for(const rect of livingWoodRects(wood,640)){
     if(shapesHitRect(body,rect))
      assert.ok(wood.x+115>=px-28&&wood.x-80<=px+28,
        'wood collision culled at '+JSON.stringify({variant,angle,dx,rect}));
    }
   }
  }
 }
});
test('pickup broad phase never skips any current food or power silhouette',()=>{
 const body=playerShapes(220,320,.28,{time:1,wing:.3,flapImpulse:.7});
 for(const kind of ['fruit','pepper','feather','shield'])for(let variety=0;variety<(kind==='fruit'?12:1);variety++)for(const time of [0,.18,.42,1]){
  for(let dx=-120;dx<=120;dx+=20)for(let dy=-100;dy<=100;dy+=20){
   const e={id:0,kind,variety,x:220+dx,y:320+dy};
   if(pickupHitsPlayer(e,body,time))assert.ok(Math.abs(dx)<100&&Math.abs(dy)<90,JSON.stringify(e));
  }
 }
});
test('invalid and expired effects are removed without filtering unchanged arrays',()=>{
 const g=new Game({seed:104,onEvent:()=>{}});g.state='playing';g.nextSpawn=999;g.elapsed=1;
 g.entities=[{id:1,kind:'fruit',x:NaN,y:320},{id:2,kind:'fruit',x:900,y:500}];
 g.popups=[{life:NaN,y:4},{life:2,y:4}];
 g.particles=[{life:NaN,x:0,y:0,vx:0,vy:0},{life:2,x:0,y:0,vx:0,vy:0}];
 g.tick(STEP);
 assert.deepEqual(g.entities.map(e=>e.id),[2]);
 assert.equal(g.popups.length,1);assert.equal(g.particles.length,1);
 const entities=g.entities,popups=g.popups,particles=g.particles;
 g.tick(STEP);
 assert.equal(g.entities,entities);assert.equal(g.popups,popups);assert.equal(g.particles,particles);
});
