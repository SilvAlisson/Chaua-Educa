import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ASSET_PATHS, images, flightPose} from '../Chaua-Educa-main/js/assets.mjs';
import {Renderer} from '../Chaua-Educa-main/js/render.mjs';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';

test('every art URL resolves to a real WebP in the served directory',()=>{
 for(const path of Object.values(ASSET_PATHS)) {
  const bytes=readFileSync(new URL('../Chaua-Educa-main/js/'+path,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
});
test('flap uses four authored poses and glide keeps a stable pose',()=>{
 assert.deepEqual([1,.7,.45,.2,0].map(w=>flightPose(w)),[0,2,3,1,1]);assert.equal(flightPose(1,true),1);
});
test('render paths draw authored art for home, flight, obstacles, enemies and powers',async()=>{
 globalThis.window={devicePixelRatio:1};
 globalThis.Image=class {
  naturalWidth=627;naturalHeight=627;complete=true;
  set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}
 };
 const calls=[];
 const ctx=new Proxy({}, {get(target,key){
  if(key==='drawImage')return (img,...args)=>{assert.ok(args.every(Number.isFinite));calls.push(img.url);};
  if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
  return target[key]??(()=>{});
 },set(target,key,value){target[key]=value;return true;}});
 const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({width:960,height:640})};
 const r=new Renderer(canvas);await r.ready;
 r.home(1,false);
 const g=new Game();g.state='playing';g.nextSpawn=Infinity;g.wing=1;
 g.entities=[
  {id:1,kind:'wood',x:450,top:180,bottom:450,variant:'plain',snake:{retreat:false}},
  {id:2,kind:'wood',x:650,top:180,bottom:450,variant:'branch',snake:{branch:true,retreat:false}},
  {id:3,kind:'wood',x:850,top:180,bottom:450,variant:'hollow'},
  {id:4,kind:'hawk',x:700,y:320,warning:0},
  {id:5,kind:'shield',x:300,y:320}, {id:6,kind:'feather',x:350,y:320},
 ];
 g.shield=true;g.feather=3;g.hit={id:1,age:.1};
 g.featherBurst(['#79aa55'],4);
 r.game(g,false);
 r.game(g,true);
 r.setQuality('low');r.game(g,false);assert.equal(r.dpr,1);
 for(const name of ['forest','perch','chaua-0','snake','branch','hollow','hawk-0','shield','feather'])
  assert.ok(calls.some(url=>url.endsWith(`/${name}.webp`)),`${name} must be rendered`);
 assert.equal(images.size,Object.keys(ASSET_PATHS).length);
});
test('snake collision follows lower trunk and clears after shield retreat',()=>{
 const g=new Game(),e={x:400,top:180,bottom:450,snake:{retreat:false}};
 assert.ok(g.snakeRects(e).every(r=>r.y>=e.bottom));
 e.snake.retreat=true;assert.deepEqual(g.snakeRects(e),[]);
});
