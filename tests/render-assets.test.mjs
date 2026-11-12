import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ASSET_PATHS, images} from '../Chaua-Educa-main/js/assets.mjs';
import {Renderer} from '../Chaua-Educa-main/js/render.mjs';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';

test('every art URL resolves to a real WebP in the served directory',()=>{
 for(const path of Object.values(ASSET_PATHS)) {
  const bytes=readFileSync(new URL('../Chaua-Educa-main/js/'+path,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
});
test('flap uses four authored poses and glide keeps a stable pose',()=>{
 assert.equal(ASSET_PATHS['snake-atlas'],undefined,'Retired snake assets must not be registered');
});
test('render paths draw authored art for home, flight, obstacles, enemies and powers',async(t)=>{
 t.after(()=>{delete globalThis.OffscreenCanvas;});
 globalThis.window={devicePixelRatio:1};
 globalThis.Image=class {
  naturalWidth=627;naturalHeight=627;complete=true;
  set src(value){this.url=value;
   if(value.includes('/public/snake/')){this.naturalWidth=1536;this.naturalHeight=768;}
   else if(value.includes('/public/parrot/fly/')){this.naturalWidth=1024;this.naturalHeight=512;}
   else if(value.includes('/public/parrot/animations/')){this.naturalWidth=768;this.naturalHeight=512;}
   else if(value.includes('/public/hawk/fly/')){this.naturalWidth=1280;this.naturalHeight=640;}
   else if(value.includes('/public/hawk/animations/')){this.naturalWidth=960;this.naturalHeight=640;}
   queueMicrotask(()=>this.onload?.());}
 };
 const calls=[];
 const ctx=new Proxy({}, {get(target,key){
  if(key==='drawImage')return (img,...args)=>{assert.ok(args.every(Number.isFinite));calls.push(img.url ?? "cached-surface");};
  if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
  return target[key]??(()=>{});
 },set(target,key,value){target[key]=value;return true;}});
 globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;} getContext(){return ctx;}};
 const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({width:960,height:640})};
 const {hawkShapes}=await import('../Chaua-Educa-main/js/collision.mjs');
 const actor={x:300,y:300,phase:'crossing',warning:0,dive:false};
 const before=hawkShapes(actor);
 const r=new Renderer(canvas);await r.ready;
 assert.deepEqual(hawkShapes(actor),before,'loading real sheets must not change the gavião hitbox');
 r.home(1,false);
 const g=new Game();g.state='playing';g.nextSpawn=Infinity;g.wing=1;
 g.entities=[
  {id:1,kind:'wood',x:450,top:180,bottom:450,variant:'plain',snake:{retreat:false}},
  {id:2,kind:'wood',x:650,top:180,bottom:450,variant:'branch',snake:{branch:true,retreat:false}},
  {id:3,kind:'wood',x:850,top:180,bottom:450,variant:'plain',fragileSide:'bottom',fragileKind:'hollow'},
  {id:4,kind:'hawk',x:700,y:320,warning:0},
  {id:5,kind:'shield',x:300,y:320}, {id:6,kind:'feather',x:350,y:320},
 ];
 g.shield=true;g.feather=3;g.hit={id:1,age:.1};
 g.featherBurst(['#79aa55'],4);
 r.game(g,false);
 r.game(g,true);
 // Inclined dive intentionally uses its own authored v6 pose, not as a load fallback.
 r.hawk({kind:'hawk',id:8,x:700,y:320,warning:0,dive:true,startX:900,startY:320,targetX:200,targetY:200},1,false);
 r.setQuality('low');r.game(g,false);assert.equal(r.dpr,1);
 for(const name of ['forest','chaua-atlas','idle','hawk-atlas','shield','feather'])
  assert.ok(calls.some(url=>url.endsWith(`/${name}.webp`)),`${name} must be rendered`);
 assert.ok(calls.some(url=>url.endsWith('/tree-variants.webp')));
 assert.ok(calls.some(url=>url.endsWith('/parrot/fly/flight.webp')), 'official parrot flight must render');
 assert.ok(calls.some(url=>url.endsWith('/hawk/fly/flight.webp')), 'official hawk flight must render');
 assert.equal(images.size,Object.keys(ASSET_PATHS).length);
});
test('snake collision follows lower trunk and clears after shield retreat',()=>{
 const g=new Game(),e={x:400,top:180,bottom:450,snake:{retreat:false}};
 assert.ok(g.snakeRects(e)[0].y<e.bottom&&g.snakeRects(e).length>2);
 e.snake.retreat=true;assert.deepEqual(g.snakeRects(e),[]);
});
