import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {journeyLength,journeyProgress,journeyStage} from '../Chaua-Educa-main/js/journey.mjs';
import {GAME_VERSION} from '../Chaua-Educa-main/js/version.mjs';
import {drawLightning} from '../Chaua-Educa-main/js/weather.mjs';
import {climateReferenceSeconds} from '../Chaua-Educa-main/js/climate-progress.mjs';
import DB from '../Chaua-Educa-main/js/database.js';

test('package, lockfile and visible build version identify the same preparation increment',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
 const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url)));
 assert.equal(pkg.version,GAME_VERSION);assert.equal(lock.version,GAME_VERSION);
 assert.equal(lock.packages[''].version,GAME_VERSION);
});

test('both mode routes distribute four chapters over a five-to-eight-minute physical flight',()=>{
 for(const mode of ['aventura','tranquilo']){
  const g=new Game({seed:104});g.reset(mode);let times=[];
  while(g.distance<journeyLength(mode)){
   g.elapsed+=STEP;g.distance=Math.min(journeyLength(mode),g.distance+g.speed*STEP);
   const stage=journeyStage(g.distance,mode);
   if(stage>times.length)times.push(g.elapsed);
  }
  assert.equal(times.length,3);assert.ok(g.elapsed>=300&&g.elapsed<=480);
  assert.ok(times[0]>60);assert.ok(g.elapsed-times[2]>=45);
  assert.ok(climateReferenceSeconds(mode,104)*.74<g.elapsed-30,'winter needs visible time before arrival');
  assert.equal(journeyProgress(g),1);
  assert.equal(journeyProgress({...g,distance:0,score:5000}),0);
 }
});

test('a predator is followed by a wide central passage before narrow snake encounters',()=>{
 const g=new Game({seed:104});g.elapsed=100;g.sequence=4;g.spawn();
 assert.ok(g.entities.some(e=>e.kind==='hawk'));assert.equal(g.postHawkRecovery,true);
 g.entities=[];g.spawn();
 // A quiet slot may run first; retain the promised recovery through it.
 if(!g.entities.some(e=>e.kind==='wood'))g.spawn();
 const wood=g.entities.find(e=>e.kind==='wood');
 assert.ok(wood.recovery);assert.equal(wood.snake,undefined);
 assert.equal((wood.top+wood.bottom)/2,320);assert.ok(wood.bottom-wood.top>=340);
 assert.equal(g.postHawkRecovery,false);
});

test('reduced motion suppresses the entire storm flash, while normal lightning still works',()=>{
 let fills=0;
 const c=new Proxy({},{get:(o,k)=>k==='fillRect'?()=>fills++:o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 for(let t=0;t<10;t+=.01)drawLightning(c,960,640,t,1,true);
 assert.equal(fills,0);
 for(let t=0;t<10;t+=.01)drawLightning(c,960,640,t,1,false);
 assert.ok(fills>0);
});

test('campaign rules preserve previous attack-era scores in history without overwriting them',()=>{
 const memory=DB.memory,available=DB.storageAvailable;
 DB.memory=new Map([['db-chaua-floresta-v11',[{playerName:'Ana',mode:'aventura',score_val:942}]]]);
 DB.storageAvailable=false;
 try{
  assert.ok(DB.previousScores().some(r=>r.ruleset==='floresta-v11'&&r.score_val===942));
  assert.deepEqual(DB.get(),[]);
  DB.upsertPlayerScore('Ana',120,'aventura');
  assert.equal(DB.get()[0].score_val,120);
  assert.equal(DB.memory.get('db-chaua-floresta-v11')[0].score_val,942);
 }finally{DB.memory=memory;DB.storageAvailable=available;}
});
