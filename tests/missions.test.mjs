import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {advanceProgress,normalizeProgress,completedMissions,progressTitle} from '../Chaua-Educa-main/js/missions.mjs';
import {QUESTIONS} from '../Chaua-Educa-main/js/questions.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';
let saved;
beforeEach(()=>{
 saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
 DB.memory=new Map();DB.storageAvailable=true;
});
test('missions survive reload and remain isolated by trimmed player name',()=>{
 DB.advanceMissions(' Ana ',{type:'fruit',fruit:'Goiaba'});
 DB.advanceMissions('Bia',{type:'fruit',fruit:'Manga'});
 DB.memory=new Map();assert.deepEqual(DB.missionProgress('Ana').varieties,['Goiaba']);
 assert.deepEqual(DB.missionProgress('Bia').varieties,['Manga']);
 assert.equal(DB.missionProgress('Novo').fruits,0);
 DB.advanceMissions('  ',{type:'win'});assert.equal(DB.missionProgress('').arrivals,0);
});
test('wrong answers count as learning; the same question never counts twice',()=>{
 let p=normalizeProgress(null);
 for(const q of QUESTIONS.slice(0,4)){
  p=advanceProgress(p,{type:'incorrect',questionId:q.id});
  p=advanceProgress(p,{type:'correct',questionId:q.id});
 }
 assert.equal(p.questions.length,4);assert.ok(completedMissions(p).some(m=>m.id==='learner'));
 assert.deepEqual(advanceProgress(p,{type:'incorrect',questionId:'unknown'}),p);
});
test('all six missions have attainable goals, saturate and unlock final title',()=>{
 let p=normalizeProgress(null);
 for(let i=0;i<20;i++)p=advanceProgress(p,{type:'fruit',fruit:['Goiaba','Manga','Milho'][i%3]});
 for(const q of QUESTIONS.slice(0,4))p=advanceProgress(p,{type:'correct',questionId:q.id});
 for(let i=0;i<10;i++)p=advanceProgress(p,{type:'route-complete'});
 p=advanceProgress(p,{type:'stage',stage:2});p=advanceProgress(p,{type:'stage',stage:1});
 p=advanceProgress(p,{type:'win'});p=advanceProgress(p,{type:'win'});
 assert.equal(p.stage,2);assert.equal(p.fruits,12);assert.equal(p.routes,3);assert.equal(p.arrivals,1);
 assert.equal(completedMissions(p).length,6);assert.equal(progressTitle(p),'Companheiro da floresta');
 for(const type of ['lose','shield-break','flap','pause','points'])assert.deepEqual(advanceProgress(p,{type}),p);
});
test('invalid persisted data cannot grant progress or crash the game',()=>{
 const p=normalizeProgress({fruits:-4,routes:'3',arrivals:Infinity,questions:['unknown',null],varieties:['bad'],stage:NaN});
 assert.deepEqual(p,normalizeProgress(null));
 saved.set('chaua-missions-v1','invalid json');assert.deepEqual(DB.missionProgress('Ana'),p);
 saved.set('chaua-missions-v1','{}');assert.deepEqual(DB.missionProgress('Ana'),p);
});
test('quota failure retains progress in memory and never changes legacy scores or collection',()=>{
 saved.set('db-chaua','original');saved.set('chaua-floresta-collection','["Goiaba"]');
 globalThis.localStorage.setItem=()=>{throw Error('quota');};
 DB.advanceMissions('Ana',{type:'fruit',fruit:'Manga'});
 assert.equal(DB.missionProgress('Ana').fruits,1);assert.equal(DB.storageAvailable,false);
 assert.equal(saved.get('db-chaua'),'original');assert.deepEqual(DB.unlocked(),['Goiaba']);
});
test('game events track both modes without modifying scores or quiz punishment',()=>{
 for(const mode of ['aventura','tranquilo']){
  const name=mode;
  const g=new Game({onEvent:event=>DB.advanceMissions(name,event)});
  g.reset(mode);g.state='playing';g.collect({kind:'fruit',variety:0,x:g.x,y:g.y});
  assert.equal(g.score,3);assert.equal(DB.missionProgress(name).fruits,1);
  g.elapsed=g.nextQuizAt;g.y=320;g.vy=0;g.entities=[];assert.equal(g.maybeOpenQuiz(),true);
  g.answer(!g.question.answer);g.answer(!g.question.answer);
  assert.equal(DB.missionProgress(name).questions.length,1);
  g.continueQuiz();assert.equal(g.state,mode==='aventura'?'ended':'countdown');assert.equal(g.score,3);
 }
});
