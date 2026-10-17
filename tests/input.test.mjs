import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, FlightClock, FLIGHT, STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {FlightInput} from '../Chaua-Educa-main/js/input.mjs';
function setup(){const events=[];const g=new Game({onEvent:e=>events.push(e.type)});g.state='playing';g.nextSpawn=Infinity;return {g,events,input:new FlightInput(g)};}
function ticks(g,n){for(let i=0;i<n;i++)g.tick(STEP);}

test('late released tap fires once at next available beat, never queues multiple beats',()=>{
 const {g,input,events}=setup();g.flapCooldown=.08;
 for(let i=0;i<4;i++){input.press('Space');input.release('Space');}
 ticks(g,36);assert.equal(events.filter(e=>e==='flap').length,1);assert.equal(g.pendingTap,0);assert.equal(g.held,false);
});
test('early released tap is not replayed long after release',()=>{
 const {g,input,events}=setup();g.flapCooldown=FLIGHT.flapInterval;input.press('Space');input.release('Space');ticks(g,36);
 assert.equal(events.length,0);assert.equal(g.pendingTap,0);
});
test('held countdown input lifts immediately, while released countdown input does not',()=>{
 for(const held of [true,false]){const {g,input,events}=setup();g.start();g.countdown=STEP;g.flapCooldown=.2;
 input.press('Space');if(!held)input.release('Space');const y=g.y;g.tick(STEP);
 assert.equal(g.state,'playing');assert.equal(g.y,y);assert.equal(events.length,held?1:0);assert.equal(g.vy,held?-FLIGHT.tapLift:0);}
});
test('keyboard and touch share ownership without extra impulses or premature release',()=>{
 const {g,input,events}=setup();input.press('Space');input.press('Space');input.press('pointer-1');input.release('Space');
 assert.equal(g.held,true);assert.equal(events.length,1);input.release('pointer-1');assert.equal(g.held,false);
});
test('normal capture loss preserves a released tap; cancellation removes pending commands',()=>{
 const {g,input,events}=setup();g.flapCooldown=.08;input.press('pointer-1');input.release('pointer-1');input.cancel('pointer-1');ticks(g,12);assert.equal(events.length,1);
 g.flapCooldown=.08;input.press('pointer-2');input.cancel('pointer-2');ticks(g,12);assert.equal(events.length,1);assert.equal(g.held,false);
});
test('pause and quiz clear pending input; fresh countdown input works on resume',()=>{
 const {g,input,events}=setup();g.flapCooldown=.08;input.press('Space');input.release('Space');g.pause();input.clear();g.resume();g.countdown=STEP;g.tick(STEP);ticks(g,12);assert.equal(events.length,0);
 g.flapCooldown=.08;input.press('Space');input.release('Space');g.fruits=1;g.collect({kind:'fruit',variety:0,x:g.x,y:g.y});input.clear();assert.equal(g.pendingTap,0);
 g.answer(g.question.answer);g.continueQuiz();input.press('pointer-1');g.countdown=STEP;g.tick(STEP);assert.equal(events.filter(e=>e==='flap').length,1);assert.ok(g.vy<0);
});
test('buffered tap advances identically at 30, 60, 120 and 240Hz',()=>{
 const states=[30,60,120,240].map(hz=>{const {g,input}=setup();g.flapCooldown=.08;input.press('Space');input.release('Space');const clock=new FlightClock(g);for(let i=0;i<hz/2;i++)clock.advance(1/hz);return [g.y,g.vy,g.pendingTap,g.elapsed];});
 for(const state of states.slice(1))state.forEach((v,i)=>assert.ok(Math.abs(v-states[0][i])<1e-8));
});
test('reset and inactive states cannot retain flight commands',()=>{
 const {g,input}=setup();g.flapCooldown=.08;input.press('Space');input.clear();g.start();assert.equal(g.pendingTap,0);assert.equal(g.held,false);
 for(const state of ['menu','paused','quiz','impact','ended']){g.state=state;input.press('Space');assert.equal(input.sources.size,0);assert.equal(g.held,false);}
});
