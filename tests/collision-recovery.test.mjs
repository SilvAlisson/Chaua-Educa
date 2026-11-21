import {playerShapes,shapesHitRect} from '../Chaua-Educa-main/js/collision.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,CONTACT} from '../Chaua-Educa-main/js/engine.mjs';
function setup(){const events=[];const g=new Game({onEvent:e=>events.push(e)});g.state='playing';g.nextSpawn=Infinity;return {g,events};}

test('shield rescues both boundaries, corrects velocity and interpolation, and expires normally',()=>{
 for(const side of ['top','bottom']){
  const {g,events}=setup();g.shield=true;g.y=side==='top'?19:616;g.vy=side==='top'?-300:360;g.tick(STEP);
  assert.equal(g.state,'playing');assert.equal(g.shield,false);assert.equal(g.invincible,CONTACT.grace);
  assert.ok(g.y>CONTACT.top&&g.y<CONTACT.bottom);assert.equal(g.previous.y,g.y);
  assert.ok(side==='top'?g.vy>0:g.vy<0);assert.equal(events.filter(e=>e.type==='shield-break').length,1);
  // Another boundary during grace cannot kill or consume a newly collected shield.
  g.shield=true;g.y=side==='top'?19:616;g.tick(STEP);assert.equal(g.state,'playing');assert.equal(g.shield,true);
  g.shield=false;g.invincible=0;g.y=side==='top'?19:616;g.vy=side==='top'?-300:360;g.tick(STEP);assert.equal(g.state,'impact');
 }
});
test('living trunk rescues into a free passage without deleting its collision geometry',()=>{
 const {g}=setup();const e={id:1,kind:'wood',x:g.x-20,top:350,bottom:510,variant:'plain'};
 const before=g.woodRects(e);g.entities=[e];g.shield=true;g.tick(STEP);
 assert.equal(g.y,430);assert.equal(g.vy,0);assert.equal(e.broken,undefined);assert.equal(e.contacted,true);
 assert.equal(g.woodRects(e).length,before.length);assert.ok(g.woodRects(e).every(r=>!shapesHitRect(playerShapes(g.x,g.y,g.angle),r)));
 e.x=g.x-200;g.tick(STEP);assert.equal(g.score,0);
});
test('only the dry branch disappears while trunk remains solid',()=>{
 const {g}=setup();const e={id:1,kind:'wood',x:g.x-80,top:340,bottom:520,variant:'broken'};
 g.entities=[e];g.shield=true;g.tick(STEP);
 assert.equal(e.dryBranchBroken,true);assert.equal(e.broken,undefined);assert.ok(!g.woodRects(e).some(r=>r.part==='dry-branch'));
 assert.ok(g.woodRects(e).some(r=>r.y===0));assert.ok(g.particles.some(p=>p.chip));
});
test('snake and wood simultaneous contact consumes one shield and awards no points',()=>{
 const {g,events}=setup();const e={id:1,kind:'wood',x:g.x-10,top:140,bottom:385,variant:'plain',snake:{y:305,retreat:false}};
 g.entities=[e];g.shield=true;g.tick(STEP);
 assert.equal(g.state,'playing');assert.equal(e.snake.retreat,true);assert.equal(e.broken,undefined);
 assert.equal(events.filter(e=>e.type==='shield-break').length,1);assert.equal(g.score,0);
});
test('boundary and wood contact in one tick cannot double consume or end',()=>{
 const {g,events}=setup();g.shield=true;g.y=19;g.vy=-300;g.entities=[{id:1,kind:'wood',x:g.x,top:300,bottom:480}];g.tick(STEP);
 assert.equal(g.state,'playing');assert.equal(events.filter(e=>e.type==='shield-break').length,1);assert.equal(events.filter(e=>e.type==='lose').length,0);
});
test('unprotected simultaneous contacts emit one defeat and pause freezes recovery',()=>{
 const {g,events}=setup();g.entities=[{id:1,kind:'wood',x:g.x,top:350,bottom:500},{id:2,kind:'wood',x:g.x,top:350,bottom:500}];g.tick(STEP);
 assert.equal(events.filter(e=>e.type==='lose').length,1);
 const {g:h}=setup();h.shield=true;h.boundaryContact('bottom');h.pause();const grace=h.invincible;for(let i=0;i<240;i++)h.tick(STEP);assert.equal(h.invincible,grace);
});

test('ground rebound grace still resolves solid trees without consuming another shield',()=>{
 for(const side of ['top','bottom']){
  const {g,events}=setup();g.shield=true;g.boundaryContact(side);
  assert.equal(g.invincible,CONTACT.grace);g.shield=true;
  const e={id:1,kind:'wood',x:g.x,top:220,bottom:420,variant:'plain'};g.entities=[e];
  g.y=side==='top'?75:570;g.previous.y=g.y;g.vy=0;
  g.tick(STEP);
  assert.equal(g.state,'playing');assert.equal(g.shield,true);assert.equal(e.contacted,true);
  assert.equal(g.previous.y,g.y,'recovery must not interpolate through wood');
  assert.ok(g.woodRects(e).every(r=>!shapesHitRect(playerShapes(g.x,g.y,g.angle),r)));
  assert.equal(events.filter(e=>e.type==='shield-break').length,1);
  assert.equal(g.invincible,CONTACT.grace-STEP,'tree must not renew the grace window');
  e.x=g.x-210;g.tick(STEP);assert.equal(g.score,0,'rescued tree cannot award clean passage');
 }
});
