import test from 'node:test';
import assert from 'node:assert/strict';
import {flightViewport,flightCameraTop,warningPosition,snakeWarningPosition} from '../Chaua-Educa-main/js/viewport.mjs';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';
import {placeWarnings} from '../Chaua-Educa-main/js/animation.mjs';

test('responsive camera stays inside the screen and maps world units consistently',()=>{
 for(const [w,h] of [[320,568],[390,844],[768,1024],[844,390],[1024,600],[1280,720],[1366,768],[1440,960]]){
  const v=flightViewport(w,h,{top:24,bottom:20,left:12,right:12});
  assert.ok(v.x>=12&&v.x+v.w<=w-12+.001);
  assert.ok(v.y>=24&&v.y+v.h<=h-20+.001);
  assert.ok(v.worldHeight<=640+1e-8);
  assert.ok(Math.abs(v.h/v.scale-v.worldHeight)<1e-8);
  assert.ok(Math.abs(v.w/v.scale-v.worldWidth)<1e-8);
  assert.ok((220-v.worldLeft)*v.scale>36,'bird must remain inside the left edge');
  for(const playerY of [35,120,320,500,605]){
   const top=flightCameraTop(v,playerY);
   assert.ok(top>=0&&top<=640-v.worldHeight+1e-7);
   if(v.worldHeight<640){
    const screenY=v.y+(playerY-top)*v.scale;
    assert.ok(screenY>=v.y-1e-8&&screenY<=v.y+v.h+1e-8);
   }
  }
 }
});

test('notebook game objects grow rather than shrinking the 640-high world',()=>{
 for(const [width,height] of [[1280,720],[1366,768],[1024,600]]){
  const v=flightViewport(width,height);
  const oldScale=Math.min(width/960,(height-228)/640);
  assert.ok(v.scale>oldScale*1.3,
   'expected genuinely larger game objects at '+width+'x'+height+': '+v.scale+' vs '+oldScale);
  assert.ok(v.worldHeight<640,'notebook must use vertical framing, not a full-world shrink');
 }
});
test('portrait improves object size; offscreen warnings are pinned to the edge',()=>{
 const v=flightViewport(390,844);
 assert.ok(v.scale/(390/720)>1.2);
 const pending={x:960,bottom:442,snake:{phase:'warning'}};
 const message={...snakeWarningPosition(v,pending,true),w:136,h:26};
 const [placed]=placeWarnings([message],v);
 assert.ok(placed.x>=v.x+4&&placed.x+136<=v.x+v.w-4);
});
test('warning positions respect a vertical tracking camera',()=>{
 for(const [w,h] of [[320,568],[390,844],[844,390],[1280,720],[1366,768]]){
  const base=flightViewport(w,h);
  for(const y of [40,100,460,600]){
   const view={...base,worldTop:flightCameraTop(base,y)};
   const p=warningPosition(view,y);
   assert.ok(p.x>=view.x&&p.x+108<=view.x+view.w);
   assert.ok(p.y>=view.y&&p.y+36<=view.y+view.h);
  }
 }
});
test('viewport changes cannot mutate physics or encounter state',()=>{
 const g=new Game({random:()=>.5});g.spawn();const before=JSON.stringify(g);
 flightViewport(390,844);flightViewport(844,390);assert.equal(JSON.stringify(g),before);
});
test('A2 notices follow the camera without moving legacy relative placement',()=>{
 const wood={x:360,bottom:442};
 for(const [width,height] of [[1200,720],[390,844],[844,390]]){
  const originalView=flightViewport(width,height);
  const view={...originalView,worldTop:flightCameraTop(originalView,320)};
  const original=snakeWarningPosition(view,wood);
  const a2=snakeWarningPosition(view,wood,true);
  assert.equal(original.x,view.x+(wood.x-view.worldLeft)*view.scale-30);
  assert.equal(original.y,view.y+(wood.bottom-155-view.worldTop)*view.scale);
  assert.equal(a2.x,original.x);
  assert.ok(Math.abs((original.y-a2.y)-90*view.scale)<1e-9);
 }
});
