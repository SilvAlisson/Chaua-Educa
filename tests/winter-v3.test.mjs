import test from 'node:test';
import assert from 'node:assert/strict';
import {images} from '../Chaua-Educa-main/js/assets.mjs';
import {TREE_WIDTH} from '../Chaua-Educa-main/js/forest-geometry.mjs';
import {drawLivingTrunk} from '../Chaua-Educa-main/js/tree-art.mjs';
import {drawSnowfall,drawSnowContact,winterOverlayStages}
 from '../Chaua-Educa-main/js/winter-vfx.mjs';
import {drawSeasonParticles,journeySeason} from '../Chaua-Educa-main/js/seasons.mjs';
import {drawForestLife} from '../Chaua-Educa-main/js/forest-life.mjs';
import {winterAmount} from '../Chaua-Educa-main/js/living-motion.mjs';
import {journeyRain,getWeatherMode,setWeatherMode} from '../Chaua-Educa-main/js/weather.mjs';
import {climateReferenceSeconds} from '../Chaua-Educa-main/js/climate-progress.mjs';

function mock(){
 const calls=[];
 const c=new Proxy({globalAlpha:1}, {get(o,k){
  if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});
  if(k==='drawImage')return (...args)=>{calls.push({type:'image',args});};
  if(k==='arc'||k==='stroke'||k==='fill'||k==='lineTo'||k==='fillRect'||k==='quadraticCurveTo'||k==='rect'||k==='ellipse')
   return (...args)=>{calls.push({type:k,args});};
  if(k==='save'||k==='restore'||k==='beginPath'||k==='clip'||k==='moveTo'||k==='translate'||k==='scale'||k==='rotate'||k==='setTransform')
   return (...args)=>{calls.push({type:k,args});};
  return o[k];
 },set(o,k,v){o[k]=v;return true}});
 return {c,calls};
}
const at=(progress,mode='aventura',seed=104)=>({
 mode,seed,score:560,distance:28000,
 elapsed:climateReferenceSeconds(mode,seed)*progress,tutorial:null
});

test('snowfall is procedural, layered, deterministic and respects reduced motion',()=>{
 const a=mock();drawSnowfall(a.c,390,844,26,.88,false,false,.45,false);
 const b=mock();drawSnowfall(b.c,390,844,26,.88,false,false,.45,false);
 assert.deepEqual(a.calls,b.calls,'snow must not jitter when the game is paused');
 assert.ok(a.calls.filter(x=>x.type==='arc').length>=40);
 assert.equal(a.calls.filter(x=>x.type==='image').length,0,'snow may not depend on unrelated sprite sheets');
 const front=mock();drawSnowfall(front.c,390,844,26,.88,false,false,.45,true);
 assert.ok(front.calls.filter(x=>x.type==='arc').length>=3);
 assert.ok(front.calls.filter(x=>x.type==='arc').length<=18,'foreground flakes must stay within the visibility budget');
 const low=mock();drawSnowfall(low.c,390,844,26,.88,false,true,.45,false);
 assert.ok(low.calls.filter(x=>x.type==='arc').length<a.calls.filter(x=>x.type==='arc').length);
 const reduced=mock();drawSnowfall(reduced.c,390,844,26,.88,true,false,.45,false);
 assert.equal(reduced.calls.length,0);
 const dry=mock();drawSnowfall(dry.c,390,844,26,0,false,false,.45,false);
 assert.equal(dry.calls.length,0);
});

test('winter completely replaces petal atlas, and full summer has no petal shower',()=>{
 const old=getWeatherMode();
 try{
  setWeatherMode('auto');
  const atlas={naturalWidth:256,naturalHeight:256};
  const winter=mock();drawSeasonParticles(winter.c,atlas,390,844,26,at(.85),false,false,.4);
  assert.ok(winter.calls.some(x=>x.type==='arc'));
  assert.equal(winter.calls.filter(x=>x.type==='image').length,0,'petals appeared in winter');
  const manual=mock();setWeatherMode('winter');
  drawSeasonParticles(manual.c,null,390,844,26,at(.05),false,true,.4);
  assert.ok(manual.calls.some(x=>x.type==='arc'),'winter should not require a petal atlas');
  setWeatherMode('auto');
  const summer=mock();
  drawSeasonParticles(summer.c,atlas,390,844,26,at(.35),false,false,.4);
  assert.equal(summer.calls.filter(x=>x.type==='image').length,0,'summer must not borrow autumn petals');
  const autumn=mock();
  drawSeasonParticles(autumn.c,atlas,390,844,26,at(.55),false,false,.4);
  assert.ok(autumn.calls.some(x=>x.type==='image'),'autumn leaf atlas must remain');
  assert.equal(autumn.calls.filter(x=>x.type==='arc').length,0,'no snow should fall in autumn');
 }finally{setWeatherMode(old)}
});

test('weather blends snow in gradually and keeps it during late flight, independent of score',()=>{
 const old=getWeatherMode();
 try{
  setWeatherMode('auto');
  for(const mode of ['aventura','tranquilo']){
   for(const p of [.60,.64,.65,.675,.69,.72,.74,.85,1]){
    const game=at(p,mode);
    const winter=winterAmount(game);
    assert.ok(winter>=0&&winter<=1);
    if(p<=.65)assert.equal(winter,0);
    if(p>=.74)assert.equal(winter,1);
    if(p>.65&&p<.74)assert.ok(winter>0&&winter<1,'snow should crossfade');
    for(const score of [0,200,560,1000,1500]){
     assert.equal(winterAmount({...game,score}),winter);
    }
    if(p>=.74)assert.equal(journeyRain(game),0,'rain and full snow cannot coexist');
   }
  }
  setWeatherMode('winter');
  assert.equal(winterAmount(at(.05)),1);
  setWeatherMode('summer');
  assert.equal(winterAmount(at(.85)),0);
 }finally{setWeatherMode(old)}
});

test('four existing transparent snow overlays crossfade progressively at every boundary',()=>{
 assert.deepEqual(winterOverlayStages(0),[]);
 assert.deepEqual(winterOverlayStages(.125),[{stage:1,alpha:.5}]);
 assert.deepEqual(winterOverlayStages(.25),[{stage:1,alpha:1}]);
 assert.deepEqual(winterOverlayStages(.375),[{stage:1,alpha:.5},{stage:2,alpha:.5}]);
 assert.deepEqual(winterOverlayStages(.5),[{stage:2,alpha:1}]);
 assert.deepEqual(winterOverlayStages(1),[{stage:4,alpha:1}]);
 for(let i=0;i<=100;i++){
  const overlays=winterOverlayStages(i/100);
  assert.ok(overlays.length<=2);
  assert.ok(overlays.every(x=>x.stage>=1&&x.stage<=4&&x.alpha>0&&x.alpha<=1));
 }
});

test('the upper tree snow overlay touches only the exposed branch cap, never its ceiling-bound trunk strip',t=>{
 const old=new Map(images);
 t.after(()=>{images.clear();for(const [k,v] of old)images.set(k,v)});
 const original={id:'original'},stage1={id:'stage1'},stage2={id:'stage2'};
 images.set('trees-upper',original);
 images.set('trees-upper-overlay-01',stage1);
 images.set('trees-upper-overlay-02',stage2);
 const oldCanvas=globalThis.OffscreenCanvas,inside=mock();inside.c.clearRect=()=>{};
 globalThis.OffscreenCanvas=class{getContext(){return inside.c}};
 t.after(()=>{globalThis.OffscreenCanvas=oldCanvas});
 const upper=mock();
 drawLivingTrunk(upper.c,{x:200,y:200,upper:true,width:TREE_WIDTH,length:900,snow:.375});
 const snowDraws=inside.calls.filter(x=>x.type==='image'&&(x.args[0]===stage1||x.args[0]===stage2));
 assert.equal(snowDraws.length,2);
 assert.equal(snowDraws[0].args[0],stage1);
 assert.equal(snowDraws[1].args[0],stage2);
 const composed=upper.calls.find(x=>x.type==='image'&&x.args[0]!==original);
 assert.ok(composed.args[4]>2,'the composed overlay uses the exposed cap rather than the ceiling strip');
 assert.ok(upper.calls.some(x=>x.type==='image'&&x.args[0]===original),'the authored base tree must remain');
});

test('forest atmosphere no longer emits duplicate snowfall particles',()=>{
 const old=getWeatherMode();
 try{
  setWeatherMode('winter');
  const {c,calls}=mock();
  drawForestLife(c,390,844,20,at(.90),0,.45,false,false,0);
  assert.equal(calls.filter(x=>x.type==='arc').length,0,'old forest snowflake loop was not removed');
  assert.ok(calls.some(x=>x.type==='fillRect'),'winter still needs its cold atmospheric haze');
 }finally{setWeatherMode(old)}
});


test('upper branch crystals fall down while lower-cap crystals settle on top',()=>{
 const falling=mock(),settled=mock();
 drawSnowContact(falling.c,210,320,.9,8.6,13,false,false,true);
 drawSnowContact(settled.c,210,320,.9,8.6,13,false,false,false);
 const f=falling.calls.filter(x=>x.type==='arc').map(x=>x.args[1]);
 const s=settled.calls.filter(x=>x.type==='arc').map(x=>x.args[1]);
 assert.equal(f.length,4);
 assert.ok(f.every(y=>y>=320&&y<=335),'upper tree snow must descend with gravity');
 assert.ok(s.every(y=>y<=320),'lower cap snow should not originate below its surface');
});
