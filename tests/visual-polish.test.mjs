import test from 'node:test';
import assert from 'node:assert/strict';
import {WeatherMotion} from '../Chaua-Educa-main/js/weather-motion.mjs';
import {drawForegroundRain,drawWindGusts} from '../Chaua-Educa-main/js/weather.mjs';
import {drawSnowfall} from '../Chaua-Educa-main/js/winter-vfx.mjs';
import {flightWarnings} from '../Chaua-Educa-main/js/flight-warnings.mjs';
import {flightViewport,flightCameraTop} from '../Chaua-Educa-main/js/viewport.mjs';
import {snakeA2SpriteRect,snakeA2CollisionRects} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {placeWarnings} from '../Chaua-Educa-main/js/animation.mjs';

function traceContext(){
 const points=[];
 const c=new Proxy({points},{get:(o,k)=>k in o?o[k]:(...args)=>{if(['moveTo','quadraticCurveTo','ellipse','arc','bezierCurveTo'].includes(k))points.push([k,...args]);},set:(o,k,v)=>(o[k]=v,true)});
 return c;
}
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

test('late weather changes do not multiply a new velocity by the whole flight age',()=>{
 const m=new WeatherMotion();m.advance(300,{wind:.2,storm:.1,speed:250});
 const before={...m.travel};const after=m.advance(300+1/60,{wind:.9,storm:.8,speed:500});
 assert.ok(Math.abs(after.wind-before.wind-.55/60)<1e-9);
 assert.ok(Math.abs(after.speed-before.speed-375/60)<1e-8);
 const frozen={...after};m.advance(300+1/60,{wind:0,storm:0,speed:0});assert.deepEqual(m.travel,frozen);
 m.advance(0,{seed:3});assert.deepEqual(m.travel,{wind:0,storm:0,speed:0});
 m.advance(50,{seed:3,wind:.5,speed:300});assert.deepEqual(m.travel,{wind:25,storm:0,speed:15000});
});
test('weather integration is refresh-rate independent for a smooth velocity ramp',()=>{
 const run=hz=>{const m=new WeatherMotion();for(let i=0;i<=hz*4;i++)m.advance(i/hz,{wind:i/hz/4,speed:250+i/hz*20});return m.travel;};
 for(const key of ['wind','storm','speed'])assert.ok(Math.abs(run(30)[key]-run(144)[key])<1e-8);
});
test('rain origins, snow and gust paths stay fixed when a paused scene changes wind or turbo speed',()=>{
 for(const low of [false,true])for(const kind of ['rain','snow','wind']){
  const m=new WeatherMotion();m.advance(300,{wind:.2,storm:.3,speed:250});
  const draw=(wind,storm,speed)=>{
   const c=traceContext(),motion=m.advance(300,{wind,storm,speed});
   if(kind==='rain')drawForegroundRain(c,960,640,300,1,false,low,storm,wind,speed,motion);
   if(kind==='snow')drawSnowfall(c,960,640,300,1,false,low,wind,false,motion);
   if(kind==='wind')drawWindGusts(c,960,640,300,wind,low,false,motion);
   return c.points;
  };
  const a=draw(.2,.3,250),b=draw(.9,.3,500);
  // Trails tilt to the new velocity, but particle origins do not teleport.
  const origins=list=>list.filter(p=>kind==='rain'?p[0]==='quadraticCurveTo':p[0]==='moveTo');
  if(kind==='rain'){
   const starts=list=>list.filter(p=>p[0]==='moveTo').slice(0,Math.floor(list.filter(p=>p[0]==='moveTo').length/2));
   assert.deepEqual(starts(a),starts(b));
  }else assert.deepEqual(origins(a),origins(b));
 }
});
test('raindrop heads meet the end of their tilted trails instead of floating beside them',()=>{
 const c=traceContext();drawForegroundRain(c,960,640,40,1,false,true,.6,.9,500);
 const curves=c.points.filter(p=>p[0]==='quadraticCurveTo'),heads=c.points.filter(p=>p[0]==='ellipse');
 assert.equal(curves.length,heads.length);
 curves.forEach((p,i)=>{assert.ok(Math.abs(p[3]-heads[i][1])<1e-9);assert.ok(Math.abs(p[4]-heads[i][2])<1e-9);});
});
test('all attack notices avoid heads and birds in compact, portrait and tracking views',()=>{
 for(const [w,h] of [[320,568],[390,844],[568,320],[844,390],[1366,768]])for(const y of [120,320,500])for(const attackType of ['frontal','alto','varredura'])for(const phase of ['warning','windup','striking']){
  const view=flightViewport(w,h);view.worldTop=flightCameraTop(view,y);
  const game={x:220,y,entities:[{id:7,kind:'wood',x:485,top:190,bottom:540,snake:{attackType,phase,phaseAge:.1,warningAge:.3,age:3}},{id:20,kind:'hawk',x:730,y:260,warning:0}]};
  const before=JSON.stringify(game),{boxes,protectedRegions}=flightWarnings(game,view);
  assert.equal(boxes.length,2);assert.equal(JSON.stringify(game),before);
  for(const a of boxes){
   assert.ok(a.x>=view.x&&a.x+a.w<=view.x+view.w+1e-8&&a.y>=view.y&&a.y+a.h<=view.y+view.h+1e-8);
   assert.ok(protectedRegions.every(b=>!overlap(a,b)),`${w}x${h} ${attackType} ${phase}`);
  }
  assert.ok(!overlap(boxes[0],boxes[1]));
 }
});
test('a constrained label can move sideways instead of covering a protected face',()=>{
 const view={x:0,y:0,w:320,h:90},face={x:0,y:0,w:150,h:90};
 const [box]=placeWarnings([{x:0,y:30,w:130,h:26}],view,[face]);
 assert.ok(!overlap(box,face));assert.ok(box.x>=156);
});

test('notice clearance encloses the whole current snake art cell, including mirrored/scaled strikes',()=>{
 for(const attackType of ['frontal','alto','varredura'])for(const phase of ['watching','warning','windup','striking','recovering'])for(const phaseAge of [0,.1,.2,.4]){
  const wood={x:485,bottom:540,snake:{attackType,phase,phaseAge,age:3}};
  const bound=snakeA2SpriteRect(wood);
  for(const cell of snakeA2CollisionRects(wood)){
   assert.ok(cell.x>=bound.x-1e-8&&cell.x+cell.w<=bound.x+bound.w+1e-8);
   assert.ok(cell.y>=bound.y-1e-8&&cell.y+cell.h<=bound.y+bound.h+1e-8);
  }
 }
});
