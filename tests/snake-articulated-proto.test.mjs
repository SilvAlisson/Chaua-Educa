import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolveRealSnakeRig,rigNeckNodes,articulatedSnakeCircles,preloadArticulatedSnakeProto,drawArticulatedSnakeProto,disposeArticulatedSnakeProto,NECK_SEGMENTS} from '../Chaua-Educa-main/js/snake-articulated-proto.mjs';
import {labPhases,labDuration,labState,labCursor} from '../Chaua-Educa-main/js/snake-lab-timeline.mjs';
import {snakeAttack} from '../Chaua-Educa-main/js/attack-patterns.mjs';
const types=['frontal','alto','varredura'];
test('all attack phase boundaries have the same head position and rotation on both sides',()=>{
 for(const attackType of types){
  const t=snakeAttack({attackType});
  for(const [a,duration,b] of [['warning',.8,'windup'],['windup',t.windup,'striking'],['striking',t.strike,'recovering'],['recovering',t.recovery,'spent']]){
   const before=resolveRealSnakeRig({attackType,age:2,phase:a,phaseAge:duration,warningAge:duration});
   const after=resolveRealSnakeRig({attackType,age:2,phase:b,phaseAge:0,warningAge:0});
   for(const key of ['x','y','angle'])assert.ok(Math.abs(before.head[key]-after.head[key])<1e-9,`${attackType} ${a}→${b} ${key}`);
  }
 }
});
test('neck root stays anchored and every sampled point is finite across all phases and attacks',()=>{
 for(const type of types)for(const [phase,d] of labPhases(type))for(let i=0;i<=100;i++){
  const rig=resolveRealSnakeRig({attackType:type,age:1,phase,phaseAge:d*i/100,warningAge:d*i/100});
  const nodes=rigNeckNodes(rig);
  assert.equal(nodes.length,NECK_SEGMENTS+1);
  assert.deepEqual(nodes.at(-1),{x:0,y:-112});
  assert.deepEqual(nodes[0],rig.points[3]);
  for(const p of nodes)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
 }
});
test('timeline uses real durations and resets every transient state when seeking',()=>{
 for(const type of types){
  const phases=labPhases(type);assert.equal(labDuration(type),phases.reduce((n,[,d])=>n+d,0));
  let start=0;
  for(const [phase,d] of phases){assert.equal(labState(type,'auto',start+d/2).phase,phase);start+=d;}
  assert.equal(labState(type,'stunned',.5).retreatTime,.5);
  assert.equal(labState(type,'watching',.1).retreatTime,0);
  assert.equal(labState(type,'watching',.1).dazed,false);
 }
});
test('reduced motion is static and geometry guides need no browser or drawing',()=>{
 assert.deepEqual(resolveRealSnakeRig({phase:'striking',phaseAge:.2,age:50},true),resolveRealSnakeRig({},true));
 const circles=articulatedSnakeCircles({x:10,bottom:250,snake:{phase:'striking',phaseAge:.1}});
 assert.ok(circles.length>3);assert.ok(circles.every(c=>Number.isFinite(c.x+c.y+c.r)));
 assert.deepEqual(articulatedSnakeCircles({snake:{retreat:true}}),[]);
});
test('three attacks have different locked peak targets and no frame-sized teleport within a phase',()=>{
 const targets=[];
 for(const attackType of types){
  const t=snakeAttack({attackType});targets.push(resolveRealSnakeRig({attackType,phase:'striking',phaseAge:t.strike}).head);
  let previous=null;
  for(let i=0;i<=2000;i++){
   const {head}=resolveRealSnakeRig({attackType,phase:'striking',phaseAge:t.strike*i/2000});
   if(previous)assert.ok(Math.hypot(head.x-previous.x,head.y-previous.y)<1);
   previous=head;
  }
 }
 assert.equal(new Set(targets.map(t=>JSON.stringify(t))).size,3);
});
test('preload is shared, draw submits one head and coil plus bounded neck, no baking or readbacks',async()=>{
 const Original=globalThis.Image;let loads=0;
 globalThis.Image=class {naturalWidth=1254;naturalHeight=1254;set src(value){loads++;queueMicrotask(()=>this.onload());}async decode(){}};
 try{
  await Promise.all([preloadArticulatedSnakeProto(),preloadArticulatedSnakeProto()]);assert.equal(loads,1);
  for(const attackType of types){
   const images=[];const c={save(){},restore(){},scale(){},translate(){},rotate(){},drawImage(...args){images.push(args);}};
   drawArticulatedSnakeProto(c,{attackType,phase:'striking',phaseAge:.1});
   assert.equal(images.length,NECK_SEGMENTS+2);
   assert.equal(images.filter(args=>args[1]===674).length,1,'exactly one open head');
  }
 }finally{disposeArticulatedSnakeProto();globalThis.Image=Original;}
});
test('experimental atlas integrity is pinned independently of production art',()=>{
 const data=readFileSync(new URL('../Chaua-Educa-main/public/snake/experimental/rig-parts.webp',import.meta.url));
 assert.equal(createHash('sha256').update(data).digest('hex'),'561aa070f5be2c7fb8f86c5f4ade99764a3e57bec665f1051099bb81498db0bd');
});

test('paused seek preserves the inclusive endpoint while playback wraps',()=>{
 for(const type of types)for(const mode of ['auto','watching','warning','windup','striking','recovering','stunned']){
  const end=labDuration(type,mode);
  assert.equal(labCursor(type,mode,end,true),end);
  assert.equal(labCursor(type,mode,end,false),0);
  const state=labState(type,mode,end,true);
  assert.equal(state.phase,mode==='auto'?'spent':mode);
  assert.ok(Math.abs(state.phaseAge-(mode==='auto'?.5:end))<1e-9);
 }
});
