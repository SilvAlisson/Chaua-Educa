import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FlightClock} from '../Chaua-Educa-main/js/engine.mjs';
import {JOURNEY,JOURNEY_LENGTH,journeyLength,journeyProgress,journeyStage} from '../Chaua-Educa-main/js/journey.mjs';
function flight(){const g=new Game();g.state='playing';g.nextSpawn=Infinity;return g;}
function ready(){const g=flight();g.distance=JOURNEY_LENGTH;g.score=1000;g.y=320;g.vy=0;g.refuge={x:330,y:320};return g;}
test('1000 points award one medal and preserve the landing sequence',()=>{
 const g=flight(),events=[];g.onEvent=e=>events.push(e);g.addScore(1000);g.addScore(5);g.tick(STEP);
 assert.equal(g.state,'playing');assert.equal(g.medal,true);assert.equal(events.filter(e=>e.type==='medal').length,1);
});
test('four stages depend on distance, not score or screen size',()=>{
 assert.deepEqual([0,.25,.5,.75,1].map(p=>journeyStage(p*JOURNEY_LENGTH)),[0,1,2,3,3]);
 const g=flight();g.distance=JOURNEY_LENGTH/2-1;g.tick(STEP);assert.equal(g.stage,2);assert.equal(JOURNEY[g.stage].name,'Mata fragmentada');
 const before=g.distance;g.pause();g.tick(10);assert.equal(g.distance,before);
});
test('destination waits for hazards and arrival requires alignment',()=>{
 const g=flight();g.distance=JOURNEY_LENGTH;g.score=1000;g.entities=[{kind:'wood',x:500,top:100,bottom:500}];g.advanceJourney(STEP);assert.equal(g.refuge,null);
 g.entities=[];g.y=500;g.advanceJourney(10);assert.ok(g.refuge);assert.equal(g.state,'playing');
 g.y=320;g.advanceJourney(STEP);assert.equal(g.state,'arrival');assert.equal(g.held,false);
});
test('arrival freezes powers and physics, can pause, and wins once',()=>{
 const g=ready(),events=[];g.onEvent=e=>events.push(e);g.feather=5;g.advanceJourney(STEP);g.tick(.4);const age=g.arrival.age;
 g.pause();g.tick(4);assert.equal(g.arrival.age,age);g.resume();assert.equal(g.state,'countdown');
 for(let i=0;i<180;i++)g.tick(STEP);assert.equal(g.state,'arrival');
 const clock=new FlightClock(g);for(let i=0;i<20;i++)clock.advance(.1);
 assert.equal(g.state,'ended');assert.equal(g.won,true);assert.equal(g.y,320);assert.equal(g.x,330);assert.equal(g.feather,5);assert.equal(events.filter(e=>e.type==='win').length,1);
});
test('pending challenge question must be answered before reaching refuge',()=>{
 const g=flight();g.distance=JOURNEY_LENGTH;g.score=1000;g.elapsed=40;g.quizPending=true;g.y=320;g.vy=0;g.advanceJourney(STEP);assert.equal(g.refuge,null);
 assert.equal(g.maybeOpenQuiz(),true);g.answer(!g.question.answer);g.continueQuiz();assert.equal(g.won,false);assert.equal(g.state,'ended');
});
test('friendly mode can arrive after a wrong answer; reduced motion skips landing animation',()=>{
 const g=flight();g.mode='tranquilo';g.distance=JOURNEY_LENGTH;g.score=1000;g.elapsed=40;g.quizPending=true;g.y=320;g.vy=0;
 g.maybeOpenQuiz();g.answer(!g.question.answer);g.continueQuiz();for(let i=0;i<180;i++)g.tick(STEP);
 g.refuge={x:330,y:320};g.advanceJourney(STEP);g.reducedMotion=true;g.tick(STEP);assert.equal(g.won,true);
 g.start();assert.equal(g.arrival,null);assert.equal(g.refuge,null);assert.equal(g.distance,0);
});

test('route completion opens refuge without a score grind, and an early medal cannot skip chapters',()=>{
 for(const mode of ['aventura','tranquilo']){
  const g=flight();g.mode=mode;g.score=0;g.distance=journeyLength(mode);g.advanceJourney(STEP);
  assert.ok(g.refuge);assert.equal(journeyProgress(g),1);
  const early=flight();early.mode=mode;early.distance=journeyLength(mode)*.5;early.addScore(1000);early.advanceJourney(STEP);
  assert.equal(early.medal,true);assert.equal(early.refuge,null);early.nextSpawn=0;early.tick(STEP);
  assert.ok(early.entities.length>0,'medal cannot stop the encounters before route completion');
 }
});
