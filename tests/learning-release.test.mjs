import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FlightClock} from '../Chaua-Educa-main/js/engine.mjs';
import {LESSONS,tutorialInstruction} from '../Chaua-Educa-main/js/tutorial.mjs';
import {createFlightLearning,advanceFlightLearning,flightLearningEntries} from '../Chaua-Educa-main/js/flight-learning.mjs';
import {FOODS} from '../Chaua-Educa-main/js/foods.mjs';
import {QUESTIONS} from '../Chaua-Educa-main/js/questions.mjs';
import {MISSIONS,advanceProgress,normalizeProgress,completedMissions,progressTitle} from '../Chaua-Educa-main/js/missions.mjs';
import {pilotTarget} from './helpers/pilot.mjs';

test('safe practice teaches a gate and all six current attacks using actual flight and collision',()=>{
 const events=[],g=new Game({seed:104,onEvent:e=>events.push(e)});g.startTutorial();g.state='playing';g.tutorial.step=3;
 const hawks=new Set(),snakes=new Set();
 for(let i=0;i<180/STEP&&!g.tutorial.done;i++){
  const target=pilotTarget(g);if(g.y>target+20&&g.vy>0&&g.flapCooldown<=0){g.press();g.release();}
  g.tick(STEP);
  for(const e of g.entities){if(e.kind==='hawk')hawks.add(e.attackKind);if(e.snake)snakes.add(e.snake.attackType);}
 }
 assert.equal(LESSONS.length,6);assert.equal(g.state,'trained');assert.equal(g.tutorial.done,true);
 assert.deepEqual([...hawks],['mergulho','rasante','gancho']);assert.deepEqual([...snakes],['frontal','alto','varredura']);
 assert.equal(g.score,0);assert.equal(g.distance,0);assert.equal(g.fruits,0);assert.equal(g.question,null);
 assert.equal(events.filter(e=>e.type==='tutorial-complete').length,1);
 assert.ok(!events.some(e=>['lose','fruit','correct','stage','win','route-complete'].includes(e.type)));
});
test('practice contact retries without game over, and pausing freezes both retry and enemy timers',()=>{
 const events=[],g=new Game({onEvent:e=>events.push(e)});g.startTutorial();g.state='playing';g.tutorial.step=3;
 g.entities=[{kind:'wood',id:1,x:g.x,top:350,bottom:550}];g.tick(STEP);
 assert.equal(g.state,'playing');assert.equal(g.tutorial.step,3);assert.equal(g.tutorial.retries,1);
 assert.equal(g.entities.length,0);assert.match(tutorialInstruction(g.tutorial),/Tente de novo/);
 assert.equal(events.filter(e=>e.type==='tutorial-retry').length,1);
 g.pause();const before=JSON.stringify(g.tutorial);new FlightClock(g).advance(.25);assert.equal(JSON.stringify(g.tutorial),before);
 g.start('aventura');assert.equal(g.tutorial,null);assert.equal(g.entities.length,0);
});
test('a session recap records actual themes, distinct foods and questions, including mistakes',()=>{
 let recap=createFlightLearning();const before=recap;
 recap=advanceFlightLearning(recap,{type:'fruit',fruit:FOODS[0].id});assert.equal(before.entries.length,0);
 recap=advanceFlightLearning(recap,{type:'fruit',fruit:FOODS[0].id});
 recap=advanceFlightLearning(recap,{type:'stage',stage:1});
 recap=advanceFlightLearning(recap,{type:'incorrect',questionId:QUESTIONS[0].id});
 assert.equal(recap.foods.length,1);assert.equal(recap.questions.length,1);
 assert.ok(flightLearningEntries(recap).some(e=>e.id==='arvores'));
 assert.equal(new Set(recap.entries).size,recap.entries.length);
 assert.deepEqual(advanceFlightLearning(recap,{type:'shield-break'}),recap);
 assert.deepEqual(createFlightLearning(),{entries:[],foods:[],questions:[],chapters:[0]});
});
test('new optional learning badges preserve the original six and ignore historical food aliases',()=>{
 let p=normalizeProgress({fruits:12,varieties:FOODS.slice(0,3).map(f=>f.id),questions:QUESTIONS.slice(0,4).map(q=>q.id),stage:3,routes:3,arrivals:1});
 assert.equal(completedMissions(p).length,6);assert.equal(progressTitle(p),'Companheiro da floresta');
 for(const food of FOODS)p=advanceProgress(p,{type:'fruit',fruit:food.id});
 for(const q of QUESTIONS.slice(0,12))p=advanceProgress(p,{type:'incorrect',questionId:q.id});
 assert.equal(completedMissions(p).length,MISSIONS.length);assert.equal(progressTitle(p),'Guardião de descobertas');
 const historical=normalizeProgress({...p,varieties:[...FOODS.slice(0,10).map(f=>f.id),'Milho','Coquinho']});
 assert.ok(!completedMissions(historical).some(m=>m.id==='field-notes'));
});
