import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {COLLISION_ART} from '../Chaua-Educa-main/js/collision-art-data.mjs';
import {playerShapes,hawkShapes,shapesHitRect,rectShape} from '../Chaua-Educa-main/js/collision.mjs';
import {playerFlightPlacement,hawkPresentation} from '../Chaua-Educa-main/js/actor-placement.mjs';
import {pickupPose,pickupShapes,pickupHitsPlayer} from '../Chaua-Educa-main/js/pickup-geometry.mjs';
import {snakeA2Pose,snakeA2CollisionRects,snakeA2HitsPlayer} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {snakeAttack} from '../Chaua-Educa-main/js/attack-patterns.mjs';
import {Game,STEP,CONTACT} from '../Chaua-Educa-main/js/engine.mjs';
import DB from '../Chaua-Educa-main/js/database.js';

test('all collidable bird, tree and pickup art is pinned to the current source hashes',()=>{
 assert.equal(Object.keys(COLLISION_ART.sources).length,10);
 for(const [path,hash] of Object.entries(COLLISION_ART.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../Chaua-Educa-main/'+path,import.meta.url))).digest('hex'),hash,path);
 assert.equal(COLLISION_ART.pickups.fruit.length,48);
});
test('the active parrot head occupies the current illustration, not the old neck rectangle',()=>{
 const body=playerShapes(220,320);
 assert.ok(shapesHitRect(body,{x:249,y:302,w:4,h:4}),'forward head contact');
 assert.equal(shapesHitRect(body,{x:270,y:340,w:3,h:3}),false,'beak/empty corner excluded');
 assert.equal(shapesHitRect(body,{x:155,y:282,w:3,h:3}),false,'decorative wing/tail excluded');
});
test('bird and hawk colliders use the same continuous placement as their graphics',()=>{
 for(const time of [0,.031,.12,.5,1,7])for(const reduced of [false,true]){
  const state={x:220,y:320,angle:.2,time,wing:.6,flapImpulse:.7,reduced},p=playerFlightPlacement(state);
  const base=playerShapes(0,0),placed=playerShapes(state.x,state.y,state.angle,state);
  base.forEach((poly,i)=>poly.forEach((v,j)=>{
   assert.ok(Math.abs(placed[i][j].x-(p.x+v.x*Math.cos(p.angle)-v.y*Math.sin(p.angle)))<1e-9);
   assert.ok(Math.abs(placed[i][j].y-(p.y+v.x*Math.sin(p.angle)+v.y*Math.cos(p.angle)))<1e-9);
  }));
  const hawk={id:0,x:320,y:300,warning:0};const presentation=hawkPresentation(hawk,time,reduced);
  const shapes=hawkShapes(hawk,time,reduced);assert.ok(shapes.flat().every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));
  if(reduced)assert.equal(presentation.offsetY,0);
 }
});
test('pickup masks follow their actual frame, floating, pulse and vector rotation',()=>{
 for(let variety=0;variety<12;variety++)for(let f=0;f<4;f++){
  const e={id:0,kind:'fruit',variety,x:220,y:320},time=(f+.1)/7,pose=pickupPose(e,time);
  assert.equal(pose.frame,f);const shapes=pickupShapes(e,time);assert.ok(shapes.length>5);
  const p=shapes[Math.floor(shapes.length/2)][0];
  assert.ok(pickupHitsPlayer(e,[rectShape({x:p.x+.1,y:p.y+.1,w:.2,h:.2})],time));
  assert.equal(pickupHitsPlayer(e,[rectShape({x:290,y:390,w:1,h:1})],time),false);
 }
 for(const kind of ['pepper','feather','shield'])assert.ok(pickupShapes({id:1,kind,x:220,y:320},1).flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('all three recoils use intact intermediate poses with current masks and finish in the rest pose',()=>{
 for(const attackType of ['frontal','alto','varredura']){
  const timing=snakeAttack({attackType});let seen=new Set();
  for(let i=0;i<=100;i++){
   const snake={attackType,phase:'recovering',phaseAge:timing.recovery*i/100},wood={x:220,bottom:480,snake};
   const pose=snakeA2Pose(snake);seen.add(pose.key+'/'+pose.frame);
   const rects=snakeA2CollisionRects(wood),r=rects[Math.floor(rects.length/2)];
   assert.ok(snakeA2HitsPlayer(wood,[rectShape({x:r.x+.1,y:r.y+.1,w:.2,h:.2})]));
  }
  assert.ok(seen.size>=7);assert.ok(seen.has(timing.key+'/5'));assert.ok(seen.has('idle/0'));
  assert.equal(snakeA2Pose({attackType,phase:'spent'}).frame,0);
 }
});
test('canopy and floor respond to the current body, before its center crosses the boundary',()=>{
 for(const y of [CONTACT.top+20,CONTACT.bottom-10]){
  const g=new Game({seed:1});g.state='playing';g.nextSpawn=Infinity;g.y=y;g.tick(STEP);
  assert.equal(g.state,'impact');assert.ok(['top','bottom'].includes(g.endCause));
 }
});
test('collision rules archive v12 preparation records without changing missions or their values',()=>{
 const memory=DB.memory,available=DB.storageAvailable;DB.memory=new Map([['db-chaua-floresta-v12',[{playerName:'Ana',mode:'aventura',score_val:400}]]]);DB.storageAvailable=false;
 try{assert.equal(DB.dbName,'db-chaua-floresta-v14');assert.ok(DB.previousScores().some(r=>r.ruleset==='floresta-v12'&&r.score_val===400));assert.deepEqual(DB.get(),[]);}finally{DB.memory=memory;DB.storageAvailable=available;}
});
