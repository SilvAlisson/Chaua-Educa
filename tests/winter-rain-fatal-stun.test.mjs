import {readFileSync} from 'node:fs';
import {drawAnimalBreath} from '../Chaua-Educa-main/js/render.mjs';
import {ASSET_PATHS,images} from '../Chaua-Educa-main/js/assets.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {journeySeason,drawSnowfall,drawSeasonParticles} from '../Chaua-Educa-main/js/seasons.mjs';
import {winterAmount} from '../Chaua-Educa-main/js/living-motion.mjs';
import {getWeatherMode,setWeatherMode,journeyRain,journeyStorm,drawJourneyRain,drawForegroundRain} from '../Chaua-Educa-main/js/weather.mjs';
import {ACTION_TIMINGS,parrotAction} from '../Chaua-Educa-main/js/action-states.mjs';

function mockCanvas(){
 const calls={arcs:0,ellipses:0,petals:0,ripples:0,fillRects:0,strokes:0};
 const ctx={
  save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},
  translate(){},rotate(){},scale(){},quadraticCurveTo(){},lineTo(){},
  arc(){calls.arcs++},ellipse(){calls.ellipses++},
  fill(){},stroke(){calls.strokes++},fillRect(){calls.fillRects++},
  drawImage(){calls.petals++},createLinearGradient(){return{addColorStop(){}}}
 };
 return {ctx,calls};
}
test('winter scenery, accumulated snow and falling flakes share one distance transition',()=>{
 const old=getWeatherMode();
 try {
  setWeatherMode('auto');
  for(const [distance,expected] of [[0,0],[8999,0],[9000,0],
   [10800,1],[13999,1],[14000,1],[15800,0],[22000,0]]){
   const {from,to,mix}=journeySeason(distance);
   const fraction=(from===3?1-mix:0)+(to===3?mix:0);
   assert.ok(Math.abs(winterAmount(distance)-fraction)<1e-10,'snow mismatch at '+distance);
   assert.ok(Math.abs(winterAmount(distance)-expected)<.02,'incorrect season at '+distance);
  }
  const partial=winterAmount(9900);
  assert.ok(partial>.1&&partial<.9,'winter fade-in is not progressive');
  const {ctx,calls}=mockCanvas();
  const fakeAtlas={naturalWidth:256,naturalHeight:256};
  drawSeasonParticles(ctx,fakeAtlas,390,844,12,11000,false,false,.45);
  assert.ok(calls.arcs>0,'missing falling snow');
  assert.equal(calls.petals,0,'petals must be absent in winter');
  const back=mockCanvas();
  drawSnowfall(back.ctx,390,844,12,1,false,false,.45,true);
  assert.ok(back.calls.arcs>0,'missing near-camera snow');
  const muted=mockCanvas();
  drawSnowfall(muted.ctx,390,844,12,1,true,false,.45,true);
  assert.equal(muted.calls.arcs,0,'reduced motion should suppress flakes');
  const autumn=mockCanvas();
  drawSeasonParticles(autumn.ctx,fakeAtlas,390,844,12,8000,false,false,.3);
  assert.ok(autumn.calls.petals>0,'autumn petal artwork unexpectedly removed');
  assert.equal(autumn.calls.arcs,0,'snow cannot fall in autumn');
 }finally{setWeatherMode(old)}
});
test('autumn rain yields to snow; thunderstorms never cover full winter',()=>{
 const old=getWeatherMode();
 try{
  setWeatherMode('auto');
  assert.equal(journeyRain(4000),0);
  assert.ok(journeyRain(8000)>.2);
  assert.ok(journeyStorm(8000,'aventura')>.2);
  assert.equal(journeyStorm(11000,'aventura'),0);
  assert.equal(journeyRain(10800),0);
  assert.equal(journeyRain(12000),0);
  assert.equal(winterAmount(11000),1);
 }finally{setWeatherMode(old)}
});
test('manual winter override keeps snow at the beginning of the journey',()=>{
 const old=getWeatherMode();
 try{
  setWeatherMode('winter');
  assert.equal(winterAmount(0),1);
  const {ctx,calls}=mockCanvas();
  drawSeasonParticles(ctx,null,390,844,2,0,false,true,.45);
  assert.ok(calls.arcs>0,'winter cannot depend on a particle atlas');
  setWeatherMode('summer');
  assert.equal(winterAmount(10000),0);
 }finally{setWeatherMode(old)}
});
test('rain renders tinted droplets, atmospheric wash and ripples, not only opaque white lines',()=>{
 const {ctx,calls}=mockCanvas();
 drawJourneyRain(ctx,390,844,6,.8,false,false,.35,.25);
 drawForegroundRain(ctx,390,844,6,.8,false,false,.35,.25);
 assert.ok(calls.ellipses>25,'missing drop heads and surface ripples');
 assert.ok(calls.fillRects>=1,'missing rainy atmospheric wash');
 assert.ok(calls.strokes>2,'missing rainfall trails and ripples');
 const still=mockCanvas();
 drawForegroundRain(still.ctx,390,844,6,.8,true,true,.35,.25);
 assert.equal(still.calls.ellipses,0,'reduced-motion foreground rain');
});
test('fatal collision preserves daze for the full transition, shield rebound does not',()=>{
 assert.ok(ACTION_TIMINGS.parrotImpact>=1.1);
 assert.ok(ACTION_TIMINGS.shieldRebound<.4);
 const game=new Game();game.state='playing';game.nextSpawn=Infinity;
 game.collide({kind:'boundary',side:'top'});
 assert.equal(game.state,'impact');
 assert.equal(game.impactRemaining,ACTION_TIMINGS.parrotImpact);
 assert.equal(parrotAction({defeated:true,impactProgress:.8}).sheet,'parrot-impact');
 for(let i=0;i<Math.round(.6/STEP);i++)game.tick(STEP);
 assert.equal(game.state,'impact','gameover cannot appear before stunned animation completes');
 for(let i=0;i<Math.ceil((ACTION_TIMINGS.parrotImpact-.6+.1)/STEP);i++)game.tick(STEP);
 assert.equal(game.state,'ended');
 const shield=new Game();shield.state='playing';shield.nextSpawn=Infinity;
 shield.power('shield');shield.collide({kind:'boundary',side:'top'});
 assert.equal(shield.state,'playing');assert.ok(shield.invincible>1);
 assert.equal(parrotAction({shieldHitAge:.11}).state,'shield-rebound');
 assert.equal(parrotAction({shieldHitAge:.31}).state,'gliding');
 const reduced=new Game();reduced.state='playing';reduced.reducedMotion=true;
 reduced.collide({kind:'boundary',side:'top'});
 assert.equal(reduced.state,'ended','reduced-motion gameover should not wait');
});


// Artistic VFX use small reusable atlases, while the main weather particles
// remain deterministic and procedural for minimal draw cost.
test('frost-breath and puddle splash atlases are transparent, local and eight-frame',()=>{
 const fs={readFileSync};
 for(const [key,name] of [['frost-breath-fx','frost-breath'],['rain-splash-fx','rain-splash']]){
  const src=ASSET_PATHS[key];
  assert.equal(src,'../assets/v11/'+name+'.svg');
  const data=fs.readFileSync(new URL('../Chaua-Educa-main/assets/v11/'+name+'.svg',import.meta.url),'utf8');
  assert.match(data,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(data,/width="512" height="256"/);
  assert.equal((data.match(/<g transform="translate\(/g)||[]).length,8);
  assert.doesNotMatch(data,/<image|https?:\/\//i);
 }
});
test('all three animals share authored breath atlas with correct frame row and fallback',()=>{
 const c=mockCanvas(),draws=[];
 c.ctx.drawImage=(...args)=>draws.push(args);
 images.set('frost-breath-fx',{width:512,height:256});
 try{
  drawAnimalBreath(c.ctx,22,0,1,.92,2.4,.45,1,20,-10);
  assert.ok(draws.length>=1);
  assert.ok(draws.some(args=>args[2]===128),'late breath frame must use second atlas row');
  assert.ok(draws.every(args=>args[3]===128&&args[4]===128),'wrong source cell size');
 }finally{images.delete('frost-breath-fx')}
});
test('rain splash atlas augments wet ripples without removing procedural rain',()=>{
 const {ctx,calls}=mockCanvas(),frames=[];
 ctx.drawImage=(...args)=>frames.push(args);
 drawJourneyRain(ctx,390,844,6,.8,false,true,.35,.25,250,{width:512,height:256});
 assert.ok(frames.length>=1,'rain splash never sampled');
 assert.ok(frames.every(f=>f[3]===128&&f[4]===128),'wrong splash cell');
 assert.ok(calls.ellipses>=1,'procedural rain fallback was removed');
});
