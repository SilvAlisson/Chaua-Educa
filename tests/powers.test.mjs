import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {offerPower} from '../Chaua-Educa-main/js/powers.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
function options(){return {elapsed:30,shield:false,feather:0,entities:[],schedule:{nextAny:0,nextShield:0,nextFeather:18},opportunity:true,random:()=>.5};}
function route(){const g=new Game();g.state='playing';g.routes.set(1,{total:3,collected:0,awarded:false,failed:false});const fruit=Array.from({length:3},(_,i)=>({id:i,kind:'fruit',variety:0,route:1,x:220+i*100,y:320}));g.entities=fruit;return {g,fruit};}
test('power offers respect spacing, existing shields, pending pickups and fruit opportunities',()=>{
 const o=options();assert.equal(offerPower(o),'feather');assert.equal(o.schedule.nextAny,39);assert.equal(o.schedule.nextFeather,53);assert.equal(offerPower(o),null);
 o.elapsed=40;o.shield=true;o.opportunity=false;assert.equal(offerPower(o),null);o.shield=false;o.entities=[{kind:'shield'}];assert.equal(offerPower(o),null);
 o.entities=[];assert.equal(offerPower(o),'shield');assert.equal(o.schedule.nextShield,62);
 const p=options();p.feather=8;p.shield=true;assert.equal(offerPower(p),null);
});
test('duplicate shield is explained without extra lives or points; feather renews to ten seconds',()=>{
 const g=new Game(),events=[];g.onEvent=e=>events.push(e);g.power('shield');g.power('shield');assert.equal(g.shield,true);assert.equal(g.score,0);assert.equal(events.at(-1).type,'shield-kept');
 g.feather=3;g.power('feather');assert.equal(g.feather,10);assert.equal(events.at(-1).renewed,true);
});
test('completed routes award once, respect multiplier and explain every point',()=>{
 const {g,fruit}=route();g.feather=5;for(const f of fruit)g.collect(f);g.collect(fruit[2]);
 assert.equal(g.score,22);assert.deepEqual(g.scoreBreakdown,{passage:0,fruit:18,quiz:0,route:4});assert.equal(g.routes.get(1).awarded,true);
});
test('missed fruit or protected contact prevents trail bonus without removing fruit points',()=>{
 const {g,fruit}=route();g.collect(fruit[0]);g.collect(fruit[2]);assert.equal(g.score,6);assert.equal(g.scoreBreakdown.route,0);
 g.shield=true;g.collide({kind:'wood',route:1,top:180,bottom:440});g.collect(fruit[1]);assert.equal(g.score,9);assert.equal(g.scoreBreakdown.route,0);
});
test('unused trail bookkeeping is bounded and power schedules freeze during pause',()=>{
 const {g}=route();g.entities=[];g.nextSpawn=Infinity;g.tick(STEP);assert.equal(g.routes.size,0);
 g.powerSchedule={nextAny:45,nextShield:50,nextFeather:55};g.pause();const before=JSON.stringify(g.powerSchedule);for(let i=0;i<240;i++)g.tick(STEP);assert.equal(JSON.stringify(g.powerSchedule),before);
});
test('feather offers lead a multi-fruit opportunity and stay within safe gap margins',()=>{
 const g=new Game({random:()=>.999});g.elapsed=40;g.sequence=3;g.spawn();const feather=g.entities.find(e=>e.kind==='feather');const fruits=g.entities.filter(e=>e.kind==='fruit');
 assert.ok(feather);assert.ok(fruits.length>1);assert.equal(fruits[0].x-feather.x,125);assert.equal(feather.y,fruits[0].y);
 const wood=g.entities.find(e=>e.kind==='wood');assert.ok(feather.y>=wood.top+(FLIGHT.aventura.fruitMargin??48)&&feather.y<=wood.bottom-(FLIGHT.aventura.fruitMargin??48));
});
test('new balance scores stay separate while previous forest records remain readable',()=>{
 const original=JSON.stringify([{playerName:'Ana',score_val:200,mode:'aventura'}]);const data=new Map([['db-chaua-floresta-v2',original]]);
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};DB.memory=new Map();DB.storageAvailable=true;
 DB.upsertPlayerScore('Ana',40,'aventura');assert.equal(DB.get()[0].score_val,40);assert.equal(DB.previousScores()[0].score_val,200);assert.equal(data.get('db-chaua-floresta-v2'),original);
});
