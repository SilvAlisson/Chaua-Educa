import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, FlightClock, STEP, WIDTH} from '../Chaua-Educa-main/js/engine.mjs';
import {FRUITS} from '../Chaua-Educa-main/js/fruits.mjs';
import DB from '../Chaua-Educa-main/js/database.js';

test('viewport dimensions cannot change world, spawn distance or bird position',()=>{
 const views=[296,960,1600].map(width=>{const g=new Game({width,random:()=>.5});g.spawn();return [g.width,g.x,g.entities[0].x];});
 assert.deepEqual(views[0],views[1]);assert.deepEqual(views[1],views[2]);assert.equal(views[0][0],WIDTH);
});
test('render interpolation advances between ticks without mutating collision state',()=>{
 const g=new Game();g.state='playing';g.nextSpawn=Infinity;g.vy=100;g.entities=[{id:1,kind:'fruit',variety:0,x:800,y:300}];
 const oldY=g.y,oldX=800;g.tick(STEP);const currentY=g.y,currentX=g.entities[0].x;
 const v=g.visual(.5);assert.equal(v.y,(oldY+currentY)/2);assert.equal(v.entities[0].x,(oldX+currentX)/2);
 assert.equal(g.y,currentY);assert.equal(g.entities[0].x,currentX);
});
test('240Hz and 60Hz simulate identical flight',()=>{
 const values=[60,240].map(hz=>{const g=new Game();g.state='playing';g.nextSpawn=Infinity;g.press();g.release();const c=new FlightClock(g);for(let i=0;i<hz;i++)c.advance(1/hz);return [g.y,g.vy,g.elapsed];});
 values[0].forEach((v,i)=>assert.ok(Math.abs(v-values[1][i])<1e-9));
});
test('resume grants countdown with frozen physics and powers',()=>{
 const g=new Game();g.state='playing';g.feather=8;g.y=500;g.vy=125;g.pause();g.resume();
 for(let i=0;i<120;i++)g.tick(STEP);
 assert.equal(g.state,'countdown');assert.equal(g.y,500);assert.equal(g.feather,8);
});
test('tranquilo can learn from a wrong answer and safely resume',()=>{
 const g=new Game();g.start('tranquilo');g.state='playing';g.fruits=1;g.collect({kind:'fruit',variety:0,x:0,y:0});g.answer(!g.question.answer);g.continueQuiz();
 assert.equal(g.state,'countdown');assert.equal(g.correct,0);assert.equal(g.score,3);
 assert.ok(g.question.explanation.length>20);
});
test('all seven foods occur in the spawn sequence',()=>{
 const g=new Game({random:()=>.5}),found=new Set();
 for(let i=0;i<30;i++){g.entities=[];g.spawn();for(const e of g.entities)if(e.kind==='fruit')found.add(FRUITS[e.variety].id);}
 assert.equal(found.size,7);
});
test('previous scores and discoveries remain accessible without rewriting old save',()=>{
 const original=JSON.stringify({version:2,scores:[{name:'Alisson',score:80,mode:'learn',ruleset:'forest-powers-1'}],unlocked:['Manga'],mistakes:['habitat']});
 const data=new Map([['chaua-educa-v2',original]]);globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 DB.memory=new Map();DB.storageAvailable=true;
 assert.equal(DB.previousScores()[0].score_val,80);assert.deepEqual(DB.unlocked(),['Manga']);DB.unlock('Goiaba');
 assert.deepEqual(DB.unlocked(),['Manga','Goiaba']);assert.equal(data.get('chaua-educa-v2'),original);
});
