import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {TREE_WIDTH,livingWoodRects} from '../Chaua-Educa-main/js/forest-geometry.mjs';
import {woodContactPosition} from '../Chaua-Educa-main/js/render.mjs';
import {birdAnimation,snakePlacement,spriteHeadRect} from '../Chaua-Educa-main/js/animation.mjs';
import {SPRITES} from '../Chaua-Educa-main/js/sprite-data.mjs';
import {impactPose} from '../Chaua-Educa-main/js/motion.mjs';

test('living trunks are wider than the flight sprite and branches join their support',()=>{
 const f=SPRITES.chaua.frames[0],birdWidth=f.content[2]*27.7027*.74/SPRITES.chaua.landmarkWidth;assert.ok(TREE_WIDTH>birdWidth);
 const rects=livingWoodRects({x:500,top:180,bottom:420,variant:'branch'}),root=rects[1],branch=rects[2];
 assert.ok(branch.x<root.x&&branch.x+branch.w>root.x);assert.ok(branch.y>=root.y&&branch.y<root.y+root.h);
});
test('new encounters never generate hollow windows or pasted dry wood blocks',()=>{
 const g=new Game({seed:104});g.state='playing';
 for(let i=0;i<100;i++){g.elapsed=i*2;g.entities=[];g.spawn();for(const w of g.entities.filter(e=>e.kind==='wood'))assert.ok(['plain','branch'].includes(w.variant));}
});
test('snake faces the approaching bird and its complete body is comparable in size',()=>{
 const w={x:500,bottom:420,snake:{branch:true,age:2,phase:'occupied'}},p=snakePlacement(w),r=spriteHeadRect(w);
 assert.equal(p.facing,1);assert.ok(p.factor*260>=85);assert.ok(r.x+r.w/2<p.x);assert.ok(r.y<w.bottom);
});
test('every fatal wood impact pose is kept fully outside the obstacle, including rotation',()=>{
 for(const reduced of [false,true])for(let n=0;n<=100;n++){
  const progress=n/100,g={state:'impact',x:220,y:300,wing:.6,angle:.12,impactContact:{x:210,y:0,w:TREE_WIDTH,h:350}};
  const p=woodContactPosition(g,progress,reduced),pose=reduced?{x:0,y:0,angle:0}:impactPose(progress),angle=g.angle+pose.angle,clip=birdAnimation({wing:g.wing,defeated:true,impactProgress:progress,reduced}),factor=27.7027*.74/SPRITES.chaua.landmarkWidth;
  for(const index of [clip.frame,clip.next]){const f=SPRITES.chaua.frames[index],[x,y,w,h]=f.content;for(const [xx,yy]of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){
   const dx=(xx-192)*factor,dy=(yy-192)*factor;assert.ok(p.x+dx*Math.cos(angle)-dy*Math.sin(angle)+pose.x<=g.impactContact.x-1);
  }}
 }
 const g=new Game();g.state='playing';g.nextSpawn=Infinity;g.entities=[{kind:'wood',id:1,x:g.x-10,top:350,bottom:550,variant:'plain'}];g.tick(STEP);assert.equal(g.state,'impact');assert.ok(g.impactContact);g.reset();assert.equal(g.impactContact,null);
});

test('v5 records remain in history after the new encounter geometry rules',async()=>{
 const {default:DB}=await import('../Chaua-Educa-main/js/database.js');const data=new Map([['db-chaua-floresta-v5',JSON.stringify([{playerName:'Perfil anterior',score_val:250,mode:'aventura'}])]]);
 globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};DB.memory=new Map();DB.storageAvailable=true;
 assert.ok(DB.previousScores().some(s=>s.ruleset==='floresta-v5'&&s.score_val===250));DB.upsertPlayerScore('Perfil anterior',30,'aventura');assert.equal(DB.get()[0].score_val,30);assert.equal(JSON.parse(data.get('db-chaua-floresta-v5'))[0].score_val,250);
});
