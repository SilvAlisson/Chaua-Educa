import test from 'node:test';
import assert from 'node:assert/strict';
import {FOREST_ART} from '../Chaua-Educa-main/js/forest-art-data.mjs';
import {SPRITES} from '../Chaua-Educa-main/js/sprite-data.mjs';
import {ASSET_PATHS,images} from '../Chaua-Educa-main/js/assets.mjs';
import {drawLivingTrunk,drawRefugeTree} from '../Chaua-Educa-main/js/tree-art.mjs';
import {snakePlacement} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {snakeA2Pose,snakeA2HeadRect,snakeA2CollisionRects} from '../Chaua-Educa-main/js/snake-a2.mjs';

test('new reference art loads through the shared cache with four upper/lower variants',()=>{
 for(const k of ['trees-lower','trees-upper'])assert.match(ASSET_PATHS[k],/assets\/v7\//);
 for(const kind of ['lower','upper']){
  assert.equal(FOREST_ART[kind].length,4);
  for(const f of FOREST_ART[kind])assert.ok(f.core[1]>f.core[0]&&f.spliceY>f.content[1]&&f.spliceY<f.endY);
 }
 assert.equal(SPRITES.snake,undefined,'Do not register the retired snake');
 assert.equal(FOREST_ART.snake,undefined);
});
test('all authored tree variants extend continuously without stretching the illustrated cap',()=>{
 for(const upper of [true,false])for(let variant=0;variant<4;variant++){
  const calls=[];images.set(`trees-${upper?'upper':'lower'}`,{});
  drawLivingTrunk({drawImage:(...a)=>calls.push(a)},{x:500,y:upper?180:420,upper,width:110,length:900,variant});
  assert.equal(calls.length,2);assert.ok(calls.flatMap(a=>a.slice(1)).every(Number.isFinite));
  const [,sx,sy,sw,sh,dx,dy,dw,dh]=calls[1];assert.ok(Math.abs(sw/sh-dw/dh)<1e-8,'authored art must keep its aspect ratio');
  const ext=calls[0];assert.equal(ext[4],1);assert.equal(ext[7],110);assert.ok(ext[8]>0);
 }
});
test('refuge branch uses a measured wood contact, not an unrelated rectangle',()=>{
 images.set('trees-lower',{});const calls=[];drawRefugeTree({drawImage:(...a)=>calls.push(a)},{x:330},357);
 const f=FOREST_ART.lower[3],a=calls[1],scale=a[7]/a[3];
 const x=a[5]+(f.perch[0]-f.content[0])*scale,y=a[6]+(f.perch[1]-f.content[1])*scale;
 assert.ok(Math.abs(x-337)<1e-8);assert.ok(Math.abs(y-353)<1e-8);
});
test('official A2 snake uses artwork-aligned masks, not v7 animated fallback',()=>{
 for(const phase of ['watching','warning','windup','striking','recovering'])for(let age=0;age<5;age+=.07){
  const wood={x:500,bottom:420,snake:{phase,age,warningAge:age,phaseAge:age}};
  const p=snakePlacement(wood),r=snakeA2HeadRect(wood),clip=snakeA2Pose(wood.snake);
  assert.equal(p.facing,1);assert.ok(r.w>5&&r.h>5);
  assert.ok(clip.frame>=0&&clip.frame<8);
  assert.ok(snakeA2CollisionRects(wood).length>0);
 }
});
