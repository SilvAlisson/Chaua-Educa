import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {chapterCheckpoint,normalizeCheckpoint,CHECKPOINT_KEY} from '../Chaua-Educa-main/js/chapter-checkpoints.mjs';
import {attackAt,planEncounter,seededRandom} from '../Chaua-Educa-main/js/encounters.mjs';
import {SNAKE_ATTACK_ORDER,HAWK_ATTACK_ORDER} from '../Chaua-Educa-main/js/attack-patterns.mjs';
import {createFlightLearning} from '../Chaua-Educa-main/js/flight-learning.mjs';
import {resultAdvice} from '../Chaua-Educa-main/js/tutorial.mjs';
import {pilotTarget} from './helpers/pilot.mjs';
import {journeyLength} from '../Chaua-Educa-main/js/journey.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
const checkpoint=(stage=2)=>({version:1,mode:'tranquilo',stage,seed:104,elapsed:stage*90,sequence:stage*20,snakeSequence:7,hawkSequence:5,foodSequence:23});

test('attack bags preserve the introduction then vary complete groups without adjacent repeats',()=>{
 for(const order of [SNAKE_ATTACK_ORDER,HAWK_ATTACK_ORDER])for(let seed=0;seed<40;seed++){
  const choices=Array.from({length:60},(_,i)=>attackAt(order,i,seed));
  assert.deepEqual(choices.slice(0,3),order);
  for(let i=0;i<60;i+=3)assert.deepEqual([...choices.slice(i,i+3)].sort(),[...order].sort());
  assert.ok(choices.every((v,i)=>i===0||v!==choices[i-1]));
  assert.notDeepEqual(choices.slice(3),Array.from({length:57},(_,i)=>order[i%3]));
  assert.deepEqual(choices,Array.from({length:60},(_,i)=>attackAt(order,i,seed)));
 }
});
test('recent encounter choices avoid short loops when enough vocabulary has unlocked',()=>{
 const random=seededRandom(73),history=[];let center=320,lastPattern=null;
 for(let i=0;i<80;i++){
  const p=planEncounter({sequence:i+1,elapsed:100,lastCenter:center,lastPattern,profile:FLIGHT.tranquilo,speed:235,random,recentPatterns:history});
  assert.ok(!history.slice(-3).includes(p.id));history.push(p.id);lastPattern=p.id;center=p.center;
 }
 assert.ok(history.includes('choice-curve'));
});
test('optional curved routes keep a free central line and fit existing physical margins',()=>{
 for(const mode of ['aventura','tranquilo']){
  const random=seededRandom(104);let curved=0;
  for(let sequence=1;sequence<200;sequence++){
   const p=planEncounter({sequence,elapsed:120,lastCenter:320,lastPattern:null,profile:FLIGHT[mode],speed:235,random});
   if(p.id!=='choice-curve')continue;curved++;
   assert.equal(p.optional,true);assert.equal(p.fruits.length,3);
   assert.ok(new Set(p.fruits.map(f=>f.y)).size>1);
   for(const f of p.fruits)assert.ok(Math.abs(f.y-p.center)>25&&Math.abs(f.y-p.center)<=p.gap/2-(FLIGHT[mode].fruitMargin??48));
  }
  assert.ok(curved>0);
 }
});
test('optional trail reward is distinct, awarded once, and a contact cancels only the bonus',()=>{
 for(const contact of [false,true]){
  const g=new Game();g.state='playing';g.routes.set(9,{total:3,collected:0,awarded:false,failed:false,optional:true});
  const fruits=Array.from({length:3},(_,i)=>({id:i,kind:'fruit',variety:0,route:9,x:400,y:320}));
  g.collect(fruits[0]);if(contact)g.routes.get(9).failed=true;
  g.collect(fruits[1]);g.collect(fruits[2]);g.collect(fruits[2]);
  assert.equal(g.scoreBreakdown.route,contact?0:4);assert.equal(g.scoreBreakdown.fruit,9);
 }
});
test('checkpoint rejects corrupted/foreign versions and derives distance instead of trusting it',()=>{
 for(const value of [null,{},[],{...checkpoint(),version:0},{...checkpoint(),stage:4},{...checkpoint(),mode:'aventura'},{...checkpoint(),seed:-1},{...checkpoint(),elapsed:Infinity},{...checkpoint(),sequence:'20'}])assert.equal(normalizeCheckpoint(value),null);
 assert.equal(normalizeCheckpoint({...checkpoint(),distance:999999}).distance,journeyLength('tranquilo')/2);
 const g=new Game();g.stage=2;assert.equal(chapterCheckpoint(g),null);g.mode='tranquilo';g.tutorial={};assert.equal(chapterCheckpoint(g),null);
 const before=JSON.stringify(g);assert.equal(g.resumeChapter({bad:true}),false);assert.equal(JSON.stringify(g),before);
});
test('restart clears hazards, input, powers, pending questions and per-flight score without replaying awards',()=>{
 const events=[],g=new Game({onEvent:e=>events.push(e)});g.state='ended';g.shield=true;g.pepper=4;g.score=999;g.entities=[{kind:'hawk'}];g.held=true;g.quizPending=true;
 assert.equal(g.resumeChapter(checkpoint()),true);
 assert.equal(g.mode,'tranquilo');assert.equal(g.stage,2);assert.equal(g.distance,42000);assert.equal(g.elapsed,180);assert.equal(g.sceneTime,180);
 assert.equal(g.state,'countdown');assert.equal(g.resumed,true);assert.equal(g.score,0);assert.equal(g.shield,false);assert.equal(g.pepper,0);assert.equal(g.held,false);assert.equal(g.quizPending,false);assert.equal(g.nextQuizAt,210);assert.deepEqual(g.entities,[]);assert.deepEqual(events,[]);
 assert.deepEqual(createFlightLearning(g.stage).chapters,[2]);
 g.pause();const before=g.elapsed;g.tick(2);assert.equal(g.elapsed,before);g.resume();assert.equal(g.state,'countdown');
 g.start('aventura',[],104);assert.equal(g.resumed,false);assert.equal(g.distance,0);assert.equal(g.chapterEntry,false);
});
test('every resumed chapter begins with a wide, snake-free passage even on a hawk/quiet slot',()=>{
 for(const stage of [1,2,3])for(let sequence=1;sequence<14;sequence++){
  const g=new Game();g.resumeChapter({...checkpoint(stage),sequence});g.spawn();
  const wood=g.entities.find(e=>e.kind==='wood');assert.ok(wood?.recovery);assert.equal(wood.snake,undefined);
  assert.ok(wood.bottom-wood.top>=340);assert.ok(!g.entities.some(e=>e.kind==='hawk'));assert.equal(g.chapterEntry,false);
 }
});
test('all three resumed chapters remain traversable without powers, pickups or quiz pauses',()=>{
 for(const stage of [1,2,3])for(const seed of [1,7,104]){
  const g=new Game();g.resumeChapter({...checkpoint(stage),seed});g.state='playing';
  for(let i=0;i<600/STEP&&g.distance<journeyLength('tranquilo');i++){
   g.entities=g.entities.filter(e=>e.kind==='wood'||e.kind==='hawk');
   const target=pilotTarget(g);if(g.y>target+20&&g.vy>0&&g.flapCooldown<=0){g.press();g.release();}
   g.tick(STEP);assert.ok(!['impact','ended'].includes(g.state),`${stage}/${seed}: ${g.reason}`);
  }
  assert.equal(g.distance,journeyLength('tranquilo'));assert.equal(g.scoreBreakdown.fruit,0);
 }
});
test('checkpoint persistence isolates players, survives reload and falls back to memory when storage fails',()=>{
 const oldStorage=globalThis.localStorage,oldMemory=DB.memory,oldAvailable=DB.storageAvailable,stored=new Map();
 globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};DB.memory=new Map();DB.storageAvailable=true;
 try{
  DB.saveChapterCheckpoint('Ana',checkpoint(1));DB.saveChapterCheckpoint('Beto',checkpoint(3));DB.memory=new Map();
  assert.equal(DB.chapterCheckpoint('Ana').stage,1);assert.equal(DB.chapterCheckpoint('Beto').stage,3);assert.equal(DB.chapterCheckpoint('Outro'),null);
  const copy=DB.chapterCheckpoint('Ana');copy.stage=3;assert.equal(DB.chapterCheckpoint('Ana').stage,1);
  DB.saveChapterCheckpoint('Ana',null);assert.equal(DB.chapterCheckpoint('Ana'),null);assert.equal(DB.chapterCheckpoint('Beto').stage,3);
  stored.set(CHECKPOINT_KEY,'broken');DB.memory=new Map();assert.equal(DB.chapterCheckpoint('Beto'),null);
  globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
  DB.saveChapterCheckpoint('Ana',checkpoint(2));assert.equal(DB.chapterCheckpoint('Ana').stage,2);assert.equal(DB.storageAvailable,false);
 }finally{globalThis.localStorage=oldStorage;DB.memory=oldMemory;DB.storageAvailable=oldAvailable;}
});
test('v13 records remain available in history while v14 starts a separate ranking',()=>{
 const memory=DB.memory,available=DB.storageAvailable;DB.memory=new Map([['db-chaua-floresta-v13',[{playerName:'Ana',mode:'tranquilo',score_val:900}]]]);DB.storageAvailable=false;
 try{assert.equal(DB.dbName,'db-chaua-floresta-v14');assert.ok(DB.previousScores().some(r=>r.ruleset==='floresta-v13'&&r.score_val===900));assert.deepEqual(DB.get(),[]);}finally{DB.memory=memory;DB.storageAvailable=available;}
});
test('post-contact advice distinguishes the high strike from the low sweep',()=>{
 const tips=['frontal','alto','varredura'].map(attackType=>resultAdvice({endCause:'snake',hit:{attackType}}));
 assert.equal(new Set(tips).size,3);assert.match(tips[1],/elevada/);assert.match(tips[2],/baixa/);
});
