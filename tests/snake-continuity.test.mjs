import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {snakeA2Pose,snakeA2CollisionRects} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {advanceSnake,SNAKE_TIMING as T} from '../Chaua-Educa-main/js/animals.mjs';
import {Game,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {planEncounter,seededRandom} from '../Chaua-Educa-main/js/encounters.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('A2 frame sequence remains within the official eight frames through the whole strike',()=>{
 const wood={x:400,bottom:440,snake:{age:0,phase:'watching'}};
 let prev=null,seen=new Set();
 for(let i=0;i<900;i++){
  advanceSnake(wood,1/240,220);const pose=snakeA2Pose(wood.snake);
  assert.ok(pose.frame>=0&&pose.frame<8);
  const rects=snakeA2CollisionRects(wood);
  assert.ok(rects.length>15,'official snake silhouette must not disappear');
  seen.add(pose.state);
  if(prev&&prev.state===pose.state&&pose.state==='strike')assert.ok(Math.abs(pose.frame-prev.frame)<=1);
  prev=pose;
 }
 for(const state of ['alert','windup','strike','recover','spent'])assert.ok(seen.has(state),state);
});
test('A2 has no historic recoil geometry; shield removes collision but keeps authored stunned art',()=>{
 const g=new Game();g.state='playing';g.shield=true;
 const w={kind:'wood',x:400,top:100,bottom:450,snake:{kind:'snake',phase:'striking',phaseAge:.17,age:2}};
 assert.ok(g.snakeRects(w).length>20);
 g.collide(w.snake,true,w);
 assert.equal(w.snake.retreat,true);assert.equal(w.snake.phase,'retreat');
 assert.equal(g.snakeRects(w).length,0);
 assert.equal(snakeA2Pose(w.snake).key,'stunned');
});
test('Amigavel encounter trace is bit-for-bit unchanged from v8',()=>{
 let center=320,lastPattern=null;const random=seededRandom(47),trace=[];
 for(let n=0;n<50;n++){const p=planEncounter({sequence:n,elapsed:n*3,lastCenter:center,lastPattern,profile:FLIGHT.tranquilo,speed:250,stage:n%4,random});trace.push(p);center=p.center;lastPattern=p.id;}
 assert.equal(createHash('sha256').update(JSON.stringify(trace)).digest('hex'),'8c5359f876b52cbd040ccc36f16a453edab72c7ef18280eef0d49246faf90b11');
});
test('unchanged Amigavel keeps current scores; old Aventura remains archived and v8 saves remain untouched',()=>{
 const original=JSON.stringify([{playerName:'Ana',score_val:400,mode:'tranquilo'},{playerName:'Ana',score_val:500,mode:'aventura'}]),data=new Map([['db-chaua-floresta-v8',original]]);
 globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};DB.memory=new Map();DB.storageAvailable=true;
 assert.deepEqual(DB.get(),[{playerName:'Ana',score_val:400,mode:'tranquilo'}]);DB.upsertPlayerScore('Ana',30,'aventura');DB.upsertPlayerScore('Ana',350,'tranquilo');assert.equal(DB.get().find(p=>p.mode==='tranquilo').score_val,400);assert.equal(data.get('db-chaua-floresta-v8'),original);assert.ok(DB.previousScores().some(p=>p.ruleset==='floresta-v8'&&p.mode==='aventura'&&p.score_val===500));
});

test('Aventura has narrower gaps, denser encounters and more vertical travel than the v8 reference route',()=>{
 // Captured from the v8 planner at seed 47 across 50 encounters.
 const old={gap:155.67264,interval:1.60462,vertical:534.9022485227267};
 let center=320,lastPattern=null,gap=0,interval=0,vertical=0;const random=seededRandom(47),profile=FLIGHT.aventura;
 for(let n=0;n<50;n++){const p=planEncounter({sequence:n,elapsed:n*3,lastCenter:center,lastPattern,profile,speed:profile.speed+Math.min(profile.speedGain,n*3*.45),stage:n%4,random});gap+=p.gap;interval+=p.interval;vertical+=Math.abs(p.center-center);center=p.center;lastPattern=p.id;}
 assert.ok(gap/50<old.gap*.9);assert.ok(interval/50<old.interval*.9);assert.ok(vertical>old.vertical*1.2);
});
