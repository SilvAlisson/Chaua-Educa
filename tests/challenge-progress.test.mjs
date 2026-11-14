import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeAt} from '../Chaua-Educa-main/js/challenge.mjs';
import {Game,FLIGHT,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {planEncounter,seededRandom} from '../Chaua-Educa-main/js/encounters.mjs';
import {pilotTarget} from './helpers/pilot.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
test('challenge keeps growing after the final scenery stage, with finite safe ceilings',()=>{
 const times=[0,30,90,180,300,480,720];let previous=challengeAt(0);
 for(const time of times){const now=challengeAt(time);assert.ok(now.speedGain>=previous.speedGain);assert.ok(now.pressure>=previous.pressure);assert.ok(now.minInterval<=previous.minInterval);assert.ok(now.quietEvery>=previous.quietEvery);previous=now;}
 assert.ok(challengeAt(650).speedGain>challengeAt(240).speedGain);
 assert.deepEqual(challengeAt(99999),challengeAt(10000));
 assert.deepEqual(challengeAt(NaN),challengeAt(0));
});
test('late challenge requires larger route corrections without breaking reachability budgets',()=>{
 const sample=elapsed=>{let movement=0;for(let seed=0;seed<40;seed++){
  const random=seededRandom(seed);let center=320,lastPattern=null;
  for(let sequence=0;sequence<60;sequence++){
   const g=new Game({seed});g.elapsed=elapsed;
   const p=planEncounter({sequence,elapsed,lastCenter:center,lastPattern,profile:FLIGHT.aventura,speed:g.speed,stage:3,random});
   movement+=Math.abs(p.center-center);assert.ok(Math.abs(p.center-center)<=p.maxShift+1e-8);
   assert.ok(p.gap>=115&&p.center-p.gap/2>20&&p.center+p.gap/2<615);
   center=p.center;lastPattern=p.id;
  }
 }return movement;};
 assert.ok(sample(650)>sample(25)*1.4,'late flight still resembles the early central corridor');
});
test('an active pilot can navigate a late challenge corridor without powers or quiz pauses',()=>{
 const g=new Game({seed:0});g.reset('aventura');g.state='playing';g.elapsed=650;g.distance=28000;g.nextQuizAt=Infinity;
 for(let i=0;i<45/STEP;i++){
  g.entities=g.entities.filter(e=>e.kind==='wood'||e.kind==='hawk');
  if(g.y>pilotTarget(g)+12&&g.vy>0&&g.flapCooldown<=0){g.press();g.release();}g.tick(STEP);
  assert.equal(g.state,'playing',g.reason);
 }
 assert.equal(g.shield,false);assert.equal(g.fruits,0);
 const pressure=challengeAt(g.elapsed);g.pause();for(let i=0;i<120;i++)g.tick(STEP);assert.deepEqual(challengeAt(g.elapsed),pressure);
});
test('new animal encounters archive both previous modes',()=>{
 const previous=new Map(DB.memory);DB.memory.clear();
 try{
  DB.memory.set('db-chaua-floresta-v9',[{playerName:'Ana',mode:'aventura',score_val:942},{playerName:'Ana',mode:'tranquilo',score_val:600}]);
  assert.equal(DB.get().length,0);
  assert.ok(DB.previousScores().some(r=>r.mode==='tranquilo'&&r.score_val===600));
  assert.ok(!DB.get().some(r=>r.mode==='aventura'));
  assert.ok(DB.previousScores().some(r=>r.ruleset==='floresta-v9'&&r.score_val===942));
 }finally{DB.memory.clear();for(const [k,v]of previous)DB.memory.set(k,v);}
});
