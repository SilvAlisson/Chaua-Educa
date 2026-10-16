import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,FlightClock,STEP} from '../Chaua-Educa-main/js/engine.mjs';
function flight(){const g=new Game();g.state='playing';g.nextSpawn=Infinity;return g;}
test('fatal impact animates briefly with frozen flight and ends exactly once',()=>{
 const events=[],g=flight();g.onEvent=e=>events.push(e);g.feather=6;
 const wood={id:7,kind:'wood',x:g.x,top:350,bottom:500};g.entities=[wood];g.collide(wood);
 assert.equal(g.state,'impact');assert.equal(g.hit.id,7);assert.equal(g.particles.filter(p=>p.feather).length,18);
 const flightState=[g.y,g.vy,g.score,g.elapsed,g.feather,wood.x];const before=g.particles[0].x;
 const clock=new FlightClock(g);clock.advance(.2);
 assert.equal(g.state,'impact');assert.notEqual(g.particles[0].x,before);
 assert.deepEqual([g.y,g.vy,g.score,g.elapsed,g.feather,wood.x],flightState);
 clock.advance(.25);assert.equal(g.state,'ended');assert.equal(events.filter(e=>e.type==='lose').length,1);
 g.start();assert.equal(g.hit,null);assert.equal(g.particles.length,0);assert.equal(g.impactRemaining,0);
});
test('shield sheds feathers and shakes wood without ending or awarding points',()=>{
 const g=flight();g.shield=true;const e={id:4,kind:'wood',hitSide:'top'};g.collide(e);
 assert.equal(g.state,'playing');assert.equal(g.shield,false);assert.equal(e.broken,true);
 assert.equal(g.score,0);assert.equal(g.hit.id,4);assert.ok(g.particles.every(p=>p.feather));
 g.advanceEffects(.31);assert.equal(g.hit,null);
});
test('reduced motion and non-collision losses do not delay the result',()=>{
 const g=flight();g.reducedMotion=true;g.collide({id:2,kind:'wood'});assert.equal(g.state,'ended');
 const quiz=flight();quiz.end(false,'Resposta incorreta');assert.equal(quiz.state,'ended');assert.equal(quiz.particles.length,0);
});
test('feather particles never consume gameplay randomness',()=>{
 const g=flight();let calls=0;g.random=()=>{calls++;return .5;};g.featherBurst(['green'],18);assert.equal(calls,0);
});
