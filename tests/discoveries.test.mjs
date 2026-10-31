import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,QUIZ_INTERVAL} from '../Chaua-Educa-main/js/engine.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
function flight(mode='aventura'){const g=new Game();g.reset(mode);g.state='playing';g.nextSpawn=Infinity;return g;}
function fruit(g){g.collect({kind:'fruit',variety:0,x:g.x,y:g.y});}
function discovery(g){g.elapsed=g.nextQuizAt;g.y=320;g.vy=0;return g.maybeOpenQuiz();}

test('many fruits award points but only queue one discovery after 30 seconds',()=>{
 const g=flight();for(let i=0;i<10;i++)fruit(g);
 assert.equal(g.score,30);assert.equal(g.state,'playing');assert.equal(g.quizPending,true);
 g.elapsed=29.9;assert.equal(g.maybeOpenQuiz(),false);
 assert.equal(discovery(g),true);assert.equal(g.quizPending,false);
 g.answer(g.question.answer);g.continueQuiz();assert.equal(g.nextQuizAt,60);
 g.state='playing';g.elapsed=100;assert.equal(g.maybeOpenQuiz(),false);
});
test('discovery drains encounters and refuses unsafe altitude or vertical speed',()=>{
 const g=flight();fruit(g);g.elapsed=QUIZ_INTERVAL;g.nextSpawn=0;
 g.entities=[{id:1,kind:'wood',x:900,top:100,bottom:500}];g.tick(STEP);
 assert.equal(g.sequence,0);assert.equal(g.state,'playing');assert.equal(g.entities.length,1);
 g.entities=[{kind:'hawk',x:1000,warning:1,harmless:false}];assert.equal(g.maybeOpenQuiz(),false);
 g.entities=[];g.y=80;assert.equal(g.maybeOpenQuiz(),false);
 g.y=320;g.vy=300;assert.equal(g.maybeOpenQuiz(),false);
 g.vy=0;assert.equal(g.maybeOpenQuiz(),true);assert.ok(g.nextSpawn>=1.5);
});
test('wrong answer ends challenge but friendly retains fruit points and resumes',()=>{
 for(const mode of ['aventura','tranquilo']){
  const g=flight(mode);fruit(g);discovery(g);g.answer(!g.question.answer);assert.equal(g.state,'quiz');assert.equal(g.score,3);
  g.continueQuiz();assert.equal(g.state,mode==='aventura'?'ended':'countdown');assert.equal(g.correct,0);
 }
});
test('multiplier is captured when quiz opens; explanations freeze powers and cannot score twice',()=>{
 const g=flight();fruit(g);g.feather=2;discovery(g);const elapsed=g.elapsed;
 for(let i=0;i<600;i++)g.tick(STEP);
 assert.equal(g.elapsed,elapsed);assert.equal(g.feather,2);g.answer(g.question.answer);g.answer(g.question.answer);assert.equal(g.score,7);
});
test('a due discovery is resolved before victory and incorrect challenge cannot bypass punishment',()=>{
 const g=flight();g.score=198;fruit(g);g.elapsed=QUIZ_INTERVAL;g.tick(STEP);assert.equal(g.state,'quiz');g.answer(!g.question.answer);g.continueQuiz();assert.equal(g.won,false);
});
test('review topics persist per player, survive blocked storage and clear after learning',()=>{
 const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};DB.memory=new Map();DB.storageAvailable=true;
 DB.recordDiscovery('Ana','habitat',false);DB.recordDiscovery('Bia','captura',false);
 DB.memory=new Map();assert.deepEqual(DB.reviewTopics('Ana'),['habitat']);assert.deepEqual(DB.reviewTopics('Bia'),['captura']);
 globalThis.localStorage.setItem=()=>{throw Error('quota');};DB.recordDiscovery('Ana','habitat',true);assert.deepEqual(DB.reviewTopics('Ana'),[]);
 DB.recordDiscovery('Ana','captura',false);assert.deepEqual(DB.reviewTopics('Ana'),['captura']);
 const g=flight();g.reviewIds=DB.reviewTopics('Ana');fruit(g);discovery(g);assert.equal(g.question.id,'captura');
 const first=g.question.id;g.answer(!g.question.answer);g.mode='tranquilo';g.continueQuiz();g.state='playing';fruit(g);discovery(g);assert.notEqual(g.question.id,first);
});
