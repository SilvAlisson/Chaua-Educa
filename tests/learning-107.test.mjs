import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FlightClock} from '../Chaua-Educa-main/js/engine.mjs';
import {QUESTIONS,SOURCES,CONTENT_REVIEWED} from '../Chaua-Educa-main/js/questions.mjs';
import {CHAPTER_DISCOVERIES,OBSERVATION_DETAILS} from '../Chaua-Educa-main/js/chapter-learning.mjs';
import {ENTRIES,discoveriesFor} from '../Chaua-Educa-main/js/collection.mjs';
import {createFlightLearning,advanceFlightLearning} from '../Chaua-Educa-main/js/flight-learning.mjs';
const safe=(g,stage=0)=>{g.state='playing';g.stage=stage;g.elapsed=Math.max(g.elapsed,g.nextQuizAt);g.y=320;g.vy=0;g.entities=[];g.quizPending=true;return g.maybeOpenQuiz();};
const clocks=g=>JSON.stringify({elapsed:g.elapsed,sceneTime:g.sceneTime,distance:g.distance,feather:g.feather,pepper:g.pepper,invincible:g.invincible,score:g.score,question:g.question,pool:g.questionPool,entities:g.entities,y:g.y,vy:g.vy,stamina:g.stamina});

test('reviewed questions retain IDs, answers, explicit chapter coverage and verified source keys',()=>{
 assert.equal(QUESTIONS.length,24);assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,24);
 assert.equal(CONTENT_REVIEWED,'2026-11-15');
 assert.equal(SOURCES.zoo.url,'https://zoo.df.gov.br/papagaio-chaua');
 assert.match(SOURCES.icmbio.label,/finalizado/);
 for(const q of QUESTIONS){assert.ok(q.chapters.length);assert.ok(q.chapters.every(n=>Number.isInteger(n)&&n>=0&&n<4));assert.ok(SOURCES[q.source]);}
 for(let stage=0;stage<4;stage++)assert.ok(QUESTIONS.filter(q=>q.chapters.includes(stage)).length>=4);
});
test('each chapter discovery appears once per attempt and never interrupts an unsafe flight',()=>{
 const events=[],g=new Game({seed:104,onEvent:e=>events.push(e)});
 for(let stage=0;stage<4;stage++){
  g.state='playing';g.stage=stage;g.elapsed=g.nextQuizAt;g.quizPending=true;g.entities=[{kind:'wood',x:900}];g.y=320;g.vy=0;
  assert.equal(g.maybeOpenQuiz(),false);assert.equal(g.chapterDiscovery,null);
  g.entities=[];g.y=80;assert.equal(g.maybeOpenQuiz(),false);g.y=320;g.vy=200;assert.equal(g.maybeOpenQuiz(),false);
  g.vy=0;assert.equal(g.maybeOpenQuiz(),true);assert.equal(g.chapterDiscovery,CHAPTER_DISCOVERIES[stage]);assert.ok(g.question.chapters.includes(stage));
  g.answer(g.question.answer);g.continueQuiz();assert.equal(safe(g,stage),true);assert.equal(g.chapterDiscovery,null);
  g.answer(g.question.answer);g.continueQuiz();
 }
 assert.deepEqual(events.filter(e=>e.type==='chapter-discovery').map(e=>e.stage),[0,1,2,3]);
 g.start('tranquilo');assert.deepEqual(g.chapterDiscoveries,[]);assert.equal(g.chapterDiscovery,null);
});
test('review of mistakes keeps precedence over chapter preference without immediate repetition',()=>{
 const g=new Game({seed:104});g.reviewIds=['captura'];safe(g,0);assert.equal(g.question.id,'captura');
 g.answer(false);g.mode='tranquilo';g.continueQuiz();safe(g,0);assert.notEqual(g.question.id,'captura');
});
test('observation freezes all flight clocks and cannot answer or score behind the dialog',()=>{
 const events=[],g=new Game({seed:104,onEvent:e=>events.push(e)});assert.equal(g.openObservation(),false);
 g.feather=2;g.pepper=3;g.invincible=1;safe(g);const before=clocks(g),pool=[...g.questionPool],question=g.question;
 assert.equal(g.openObservation(),true);assert.equal(g.openObservation(),false);assert.equal(g.held,false);
 for(let i=0;i<1200;i++)g.tick(STEP);new FlightClock(g).advance(.25);
 assert.equal(clocks(g),before);
 for(const id of Object.keys(OBSERVATION_DETAILS)){assert.equal(g.observeDetail(id),true);assert.equal(g.observeDetail(id),true);}
 assert.equal(g.observeDetail('unknown'),false);assert.equal(g.observeDetail('__proto__'),false);
 g.answer(g.question.answer);g.continueQuiz();assert.equal(g.answerResult,null);assert.equal(g.score,0);assert.equal(g.state,'quiz');
 assert.equal(g.closeObservation(),true);assert.equal(g.closeObservation(),false);
 assert.equal(g.question,question);assert.deepEqual(g.questionPool,pool);assert.equal(clocks(g),before);
 assert.equal(events.filter(e=>e.type==='observation').length,3);
 g.answer(g.question.answer);assert.equal(g.score,8);g.continueQuiz();assert.equal(g.state,'countdown');
 assert.equal(g.observeDetail('cabeca'),false);assert.equal(g.openObservation(),false);
});
test('optional observation cannot bypass the challenge consequence or penalize friendly mode',()=>{
 for(const mode of ['aventura','tranquilo']){
  const g=new Game();g.reset(mode);safe(g);g.openObservation();g.observeDetail('cabeca');g.closeObservation();
  g.answer(!g.question.answer);assert.equal(g.openObservation(),false);g.continueQuiz();
  assert.equal(g.state,mode==='aventura'?'ended':'countdown');assert.equal(g.score,0);
 }
});
test('new discoveries link to real catalogue entries and are deduplicated in the flight recap',()=>{
 let recap=createFlightLearning();
 for(const card of CHAPTER_DISCOVERIES){assert.ok(ENTRIES.some(e=>e.id===card.entry));assert.ok(SOURCES[card.source]);assert.deepEqual(discoveriesFor({type:'chapter-discovery',stage:card.stage}),[card.entry]);}
 for(const [detail,card] of Object.entries(OBSERVATION_DETAILS)){
  assert.ok(ENTRIES.some(e=>e.id===card.entry));assert.ok(SOURCES[card.source]);
  recap=advanceFlightLearning(recap,{type:'observation',detail});recap=advanceFlightLearning(recap,{type:'observation',detail});
 }
 assert.equal(new Set(recap.entries).size,recap.entries.length);assert.ok(recap.entries.includes('chaua'));assert.ok(recap.entries.includes('fantasia'));
 for(const stage of [-1,4,null,'1'])assert.deepEqual(discoveriesFor({type:'chapter-discovery',stage}),[]);
 assert.deepEqual(discoveriesFor({type:'observation',detail:'__proto__'}),[]);
});
test('new flights and friendly chapter retries clear observation state without deleting learned progress',()=>{
 const g=new Game();safe(g);g.openObservation();g.observeDetail('cabeca');g.start('tranquilo');assert.equal(g.observationOpen,false);assert.deepEqual(g.observedDetails,[]);
 const cp={version:1,mode:'tranquilo',stage:2,seed:104,elapsed:180,sequence:40,snakeSequence:7,hawkSequence:5,foodSequence:23};
 assert.equal(g.resumeChapter(cp),true);assert.deepEqual(g.chapterDiscoveries,[]);safe(g,2);assert.equal(g.chapterDiscovery.stage,2);
});
