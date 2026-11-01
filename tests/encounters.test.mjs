import {pilotTarget} from './helpers/pilot.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {ENCOUNTERS,planEncounter,seededRandom} from '../Chaua-Educa-main/js/encounters.mjs';

test('plans have reachable transitions, clear reward routes and no immediate pattern repeats',()=>{
 const seen=new Set();
 for(const mode of ['aventura','tranquilo'])for(let seed=0;seed<80;seed++){
  const random=seededRandom(seed);let center=320,lastPattern=null;
  for(let n=0;n<70;n++){
   const p=planEncounter({sequence:n,elapsed:n*3,lastCenter:center,lastPattern,profile:FLIGHT[mode],speed:FLIGHT[mode].speed+55,random});
   assert.notEqual(p.id,lastPattern);assert.ok(Math.abs(p.center-center)<=p.maxShift+1e-8);assert.ok(p.gap>=FLIGHT[mode].minGap);
   assert.ok(p.center-p.gap/2>20&&p.center+p.gap/2<615);
   for(const f of p.fruits)assert.ok(Math.abs(f.y-p.center)<=p.gap/2-48+1e-8);
   if(p.optional)assert.ok(p.fruits.every(f=>Math.abs(f.y-p.center)>25));
   seen.add(p.id);center=p.center;lastPattern=p.id;
  }
 }
 assert.deepEqual([...seen].sort(),ENCOUNTERS.map(p=>p.id).sort());
});
test('seeded runs replay geometry and quiz RNG cannot perturb encounter choices',()=>{
 function run(extraQuestions){const g=new Game({seed:12345});const result=[];
  for(let i=0;i<50;i++){g.elapsed=i*3;g.entities=[];if(extraQuestions)for(let j=0;j<5;j++)g.random();g.spawn();result.push(JSON.stringify(g.entities));}
  return result;
 }
 assert.deepEqual(run(false),run(true));
 const g=new Game();g.start('aventura',[],99);g.spawn();const first=JSON.stringify(g.entities);g.start('aventura',[],99);g.spawn();assert.equal(JSON.stringify(g.entities),first);
});
test('clearings spawn no hazards or pickups and hawks remain isolated',()=>{
 const g=new Game({seed:10});g.elapsed=30;g.sequence=5;g.spawn();assert.equal(g.entities.length,0);assert.equal(g.nextSpawn,2.8);
 g.elapsed=100;g.sequence=10;g.spawn();assert.ok(g.entities.some(e=>e.kind==='hawk'&&e.dive));assert.ok(!g.entities.some(e=>e.kind==='wood'));
 const count=g.entities.length;g.spawn();assert.equal(g.entities.length,count);
});
test('80 complete journeys are navigable without shields, fruit or quiz pauses',()=>{
 for(const mode of ['aventura','tranquilo'])for(let seed=0;seed<40;seed++){
  const g=new Game({seed});g.reset(mode);g.state='playing';
  for(let i=0;i<180/STEP;i++){
   // No pickups, shielding or quiz pauses may hide an unsafe corridor.
   g.entities=g.entities.filter(e=>e.kind==='wood'||e.kind==='hawk');
   const wood=g.entities.find(e=>e.kind==='wood'&&e.x+100>g.x);
   const target=pilotTarget(g);
   if(g.y>target+12&&g.vy>0&&g.flapCooldown<=0){g.press();g.release();}
   g.tick(STEP);
   if(g.state==='ended'){assert.equal(g.won,true,`${mode} seed ${seed}: ${g.reason}`);break;}
   assert.ok(['playing','arrival'].includes(g.state),`${mode} seed ${seed} at ${g.elapsed}: ${g.reason}`);
  }
  assert.equal(g.won,true);assert.equal(g.shield,false);assert.equal(g.fruits,0);assert.equal(g.invincible,0);
 }
});
