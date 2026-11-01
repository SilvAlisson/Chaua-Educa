import test from 'node:test';
import assert from 'node:assert/strict';
import {SPRITES} from '../Chaua-Educa-main/js/sprite-data.mjs';
import {CLIPS,sequence,birdAnimation,hawkAnimation,snakeAnimation,placeWarnings} from '../Chaua-Educa-main/js/animation.mjs';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';

test('all 48 authored frames have fixed cells, transparent gutters and usable animation clips',()=>{
 for(const [name,data]of Object.entries(SPRITES)){
  assert.equal(data.frames.length,16);
  const used=new Set(Object.values(CLIPS[name]).flat());assert.equal(used.size,16);
  for(const [i,f]of data.frames.entries()){
   assert.deepEqual(f.rect,[(i%4)*384,Math.floor(i/4)*384,384,384]);
   assert.deepEqual(f.anchor,data.anchor);
   const [x,y,w,h]=f.content;assert.ok(x>=10&&y>=10&&x+w<=374&&y+h<=374);
   if(name!=='snake')assert.ok(f.eye.every(Number.isFinite));else assert.ok(f.head.every(Number.isFinite));
  }
 }
});
test('clips meet at the same weighted pose at every boundary, including a wrapped wingbeat',()=>{
 const weights=clip=>{const a=Array(16).fill(0);a[clip.frame]+=1-clip.blend;a[clip.next]+=clip.blend;return a;};
 for(const frames of [CLIPS.chaua.flight,CLIPS.hawk.flight,CLIPS.snake.alert])for(let i=0;i<=frames.length;i++){
  const a=weights(sequence(frames,i/frames.length-1e-7,true)),b=weights(sequence(frames,i/frames.length+1e-7,true));
  a.forEach((n,k)=>assert.ok(Math.abs(n-b[k])<.00001));
 }
 assert.equal(birdAnimation({landing:1}).frame,birdAnimation({perched:true,time:0}).frame);
 assert.equal(hawkAnimation({retreat:true,retreatTime:2}).frame,15);
 assert.equal(snakeAnimation({retreat:true,retreatTime:2}).frame,11);
 const g=new Game();g.won=true;g.reset();assert.equal(g.won,false);
});
test('simultaneous predator and snake notices stay in the viewport without overlapping',()=>{
 for(const w of [320,390,568,960]){
  const view={x:0,y:100,w,h:300},items=[{x:w-200,y:120,w:180,h:40},{x:w-210,y:122,w:180,h:40},{x:w-190,y:124,w:180,h:40}];
  const boxes=placeWarnings(items,view);
  for(const a of boxes){assert.ok(a.x>=0&&a.x+a.w<=w&&a.y>=100&&a.y+a.h<=400);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
  }
 }
});

test('flight draws a single complete pose instead of translucent duplicate wings',()=>{
 for(let i=0;i<200;i++){
  for(const clip of [birdAnimation({wing:i/200}),hawkAnimation({id:3},i/100)]){
   assert.equal(clip.frame,clip.next);assert.equal(clip.blend,0);
  }
 }
});
