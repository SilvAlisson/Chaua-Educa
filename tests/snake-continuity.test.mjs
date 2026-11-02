import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {snakeMotion,deformSnakePoint} from '../Chaua-Educa-main/js/snake-motion.mjs';
import {advanceSnake,SNAKE_TIMING as T} from '../Chaua-Educa-main/js/animals.mjs';
import {Game,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {planEncounter,seededRandom} from '../Chaua-Educa-main/js/encounters.mjs';
import DB from '../Chaua-Educa-main/js/database.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('continuous head motion joins every phase and does not reset when the tree passes',()=>{
 const stages=[['warning',0],['warning',T.warning],['windup',0],['windup',T.windup],['striking',0],['striking',T.strike],['recovering',0],['recovering',T.recovery],['spent',0]];
 const p=stages.map(([phase,t])=>snakeMotion({phase,phaseAge:t,warningAge:t,age:3}));
 for(const [a,b]of [[1,2],[3,4],[5,6],[7,8]])for(const k of Object.keys(p[a]))near(p[a][k],p[b][k]);
 const wood={x:400,bottom:440,snake:{}};let previous=deformSnakePoint(130,137,snakeMotion(wood.snake)),max=0;
 for(let i=0;i<900;i++){advanceSnake(wood,1/240,220);const now=deformSnakePoint(130,137,snakeMotion(wood.snake));max=Math.max(max,Math.hypot(now.x-previous.x,now.y-previous.y)*.52);previous=now;}
 assert.ok(max<1.5,`head teleports ${max} units per 240Hz tick`);
 const moving={x:400,snake:{attackStarted:true,attackAge:.7,phase:'recovering',age:2}};moving.x=90;advanceSnake(moving,.01,220);assert.equal(moving.snake.phase,'recovering');
});
test('head stays rigid, coil stays anchored, reduced motion stays static and shield retreat starts at the displayed pose',()=>{
 for(const phase of ['warning','windup','striking','recovering'])for(let i=0;i<60;i++){
  const pose=snakeMotion({phase,warningAge:i/60,phaseAge:i/60,age:2}),a=deformSnakePoint(110,130,pose),b=deformSnakePoint(160,145,pose);
  near(Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(50,15));assert.deepEqual(deformSnakePoint(230,310,pose),{x:230,y:310});
  assert.deepEqual(snakeMotion({phase,phaseAge:i},true),{x:0,y:0,angle:0,mouth:0});
 }
 const g=new Game();g.state='playing';g.shield=true;const w={kind:'wood',x:400,top:100,bottom:450,snake:{kind:'snake',phase:'striking',phaseAge:.17,age:2}};const before=snakeMotion(w.snake);g.collide(w.snake,true,w);assert.deepEqual(snakeMotion(w.snake),before);
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
