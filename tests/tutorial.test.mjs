import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FlightClock} from '../Chaua-Educa-main/js/engine.mjs';
import {resultAdvice} from '../Chaua-Educa-main/js/tutorial.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
const advance=(g,seconds)=>{for(let t=0;t<seconds;t+=STEP)g.tick(STEP);};
function training(events=[]){const g=new Game({onEvent:e=>events.push(e)});g.startTutorial();advance(g,2.5);return g;}

test('training uses real flight physics but never spawns, scores, quizzes or ends on boundaries',()=>{
 const events=[],g=training(events);advance(g,60);
 assert.equal(g.state,'playing');assert.equal(g.tutorial.step,0);assert.equal(g.distance,0);
 assert.equal(g.score,0);assert.equal(g.entities.length,0);assert.equal(g.question,null);
 assert.ok(!events.some(e=>['win','lose','fruit','stage','correct'].includes(e.type)));
 const real=new Game();real.reset('tranquilo');real.state='playing';real.y=g.y;real.vy=g.vy;real.elapsed=g.elapsed;
 real.press();g.press();real.tick(STEP);g.tick(STEP);
 assert.equal(g.vy,real.vy);assert.equal(g.y,real.y);
});
test('tap, sustained hold and actual release complete all three lessons in order',()=>{
 const events=[],g=training(events);
 g.press();g.release();advance(g,.15);assert.equal(g.tutorial.step,1);
 // A brief tap is not a sustained hold.
 g.press();advance(g,.2);g.release();advance(g,.1);assert.equal(g.tutorial.step,1);
 g.press();advance(g,.65);assert.equal(g.tutorial.step,2);assert.equal(g.held,true);
 advance(g,1);assert.equal(g.tutorial.step,2);
 g.release();advance(g,2);assert.equal(g.state,'trained');assert.equal(g.tutorial.done,true);
 assert.equal(events.filter(e=>e.type==='tutorial-complete').length,1);
 advance(g,20);assert.equal(events.filter(e=>e.type==='tutorial-complete').length,1);
 assert.equal(g.score,0);assert.equal(g.fruits,0);
});
test('pause freezes training; fresh regular run removes all training state',()=>{
 const g=training();g.press();advance(g,.15);g.pause();
 const before=JSON.stringify(g.tutorial),y=g.y;
 new FlightClock(g).advance(.25);assert.equal(JSON.stringify(g.tutorial),before);assert.equal(g.y,y);
 g.resume();advance(g,2);assert.equal(g.state,'playing');
 g.start('aventura');assert.equal(g.tutorial,null);assert.equal(g.endCause,null);
 advance(g,2.5);assert.ok(g.distance>0);
});
test('result advice follows structured collision causes and quiz failures',()=>{
 for(const side of ['top','bottom']){
  const g=new Game();g.state='playing';g.boundaryContact(side);
  assert.equal(g.endCause,side);assert.ok(resultAdvice(g).length>30);
 }
 const g=new Game();g.state='playing';g.collide({kind:'hawk',id:1},true);assert.equal(g.endCause,'hawk');
 assert.match(resultAdvice(g),/gavião/);
 assert.match(resultAdvice({endCause:'quiz'}),/Amigável/);
 assert.match(resultAdvice({won:true}),/completou/);
});
test('tutorial completion is optional, persists and works with blocked storage',()=>{
 const stored=new Map();globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
 DB.memory=new Map();DB.storageAvailable=true;assert.equal(DB.tutorialCompleted(),false);
 DB.completeTutorial();DB.memory=new Map();assert.equal(DB.tutorialCompleted(),true);
 globalThis.localStorage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
 DB.memory=new Map();DB.completeTutorial();assert.equal(DB.tutorialCompleted(),true);assert.equal(DB.storageAvailable,false);
});
