import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,VICTORY_SCORE,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {JOURNEY_LENGTH} from '../Chaua-Educa-main/js/journey.mjs';
import {climateJourneyProgress,climateReferenceSeconds} from '../Chaua-Educa-main/js/climate-progress.mjs';
import {SEASON_IDS,CLIMATE_TRANSITIONS,seasonAtProgress,seasonWeights} from '../Chaua-Educa-main/js/climate-timeline.mjs';
import {journeySeason,SeasonalBackdrop} from '../Chaua-Educa-main/js/seasons.mjs';
import {journeyRain,journeyStorm,journeyFog,journeyWind,getWeatherMode,setWeatherMode} from '../Chaua-Educa-main/js/weather.mjs';
import {winterAmount,summerSunAmount} from '../Chaua-Educa-main/js/living-motion.mjs';

const sample=(progress,mode='aventura',seed=104,extra={})=>({
 elapsed:climateReferenceSeconds(mode,seed)*progress,
 distance:JOURNEY_LENGTH,score:560,seed,mode,tutorial:null,
 ...extra
});

test('the four seasons follow spring, summer, autumn and winter, matching authored atlas IDs',()=>{
 assert.deepEqual(SEASON_IDS,{spring:0,autumn:1,summer:2,winter:3});
 assert.deepEqual(CLIMATE_TRANSITIONS.map(s=>[s.from,s.to]),[[0,2],[2,1],[1,3]]);
 for(const [p,id] of [[0,0],[.10,0],[.30,2],[.52,1],[.78,3],[1,3]]){
  assert.deepEqual(seasonAtProgress(p),{from:id,to:id,mix:1},'full season at '+p);
 }
 for(const {start,end,from,to} of CLIMATE_TRANSITIONS){
  assert.deepEqual(seasonAtProgress(start),{from,to,mix:0});
  assert.ok(Math.abs(seasonAtProgress((start+end)/2).mix-.5)<1e-10);
  assert.deepEqual(seasonAtProgress(end),{from:to,to,mix:1});
 }
 assert.ok(CLIMATE_TRANSITIONS[2].end<.80,'winter must last long enough for the fastest pilot win');
});

test('climate intensity is continuous and non-regressive while points and world distance cannot affect it',()=>{
 const old=getWeatherMode();try{
  setWeatherMode('auto');
  for(const mode of ['aventura','tranquilo'])for(const seed of [104,217,451,999]){
   let last=-1,lastSeasonIndex=-1,lastWinter=0;
   const order=[0,2,1,3];
   for(let i=0;i<=1000;i++){
    const p=i/1000,game=sample(p,mode,seed);
    const state=journeySeason(game),weight=seasonWeights(state);
    const active=Math.max(order.indexOf(state.from),order.indexOf(state.to));
    assert.ok(active>=lastSeasonIndex,'season went backwards at '+p);
    lastSeasonIndex=active;
    assert.ok(weight.every(w=>w>=0&&w<=1));
    assert.ok(Math.abs(weight.reduce((a,b)=>a+b,0)-1)<1e-10);
    const progressed=climateJourneyProgress(game);
    assert.ok(progressed>=last,'clock regressed at '+p);
    last=progressed;
    for(const score of [0,560,1000,1500]){
     assert.deepEqual(journeySeason({...game,score,distance:JOURNEY_LENGTH}),state);
    }
    if(p>=.74){
     assert.equal(winterAmount(game),1,'fully snowy winter is missing after .74');
     assert.ok(winterAmount(game)>=lastWinter);
     lastWinter=winterAmount(game);
    }
   }
  }
 }finally{setWeatherMode(old)}
});

test('rain, cold, heat, wind and fog agree with the same active seasonal state',()=>{
 const old=getWeatherMode();try{
  setWeatherMode('auto');
  const spring=sample(.10),summer=sample(.34),autumn=sample(.56),winter=sample(.84);
  assert.equal(journeyRain(spring),0);
  assert.equal(journeyRain(summer),0);
  assert.ok(journeyRain(autumn)>.75);
  assert.equal(journeyRain(winter),0);
  assert.equal(journeyStorm(winter,'aventura'),0);
  assert.ok(journeyStorm(autumn,'aventura')>.45);
  assert.equal(journeyStorm(autumn,'tranquilo'),0);
  assert.equal(winterAmount(autumn),0);
  assert.equal(winterAmount(winter),1);
  assert.ok(summerSunAmount(summer)>summerSunAmount(spring));
  assert.equal(summerSunAmount(winter),0);
  assert.ok(journeyWind(autumn,'aventura')>journeyWind(summer,'aventura'));
  assert.ok(journeyFog(winter)>journeyFog(summer));
  const blend=sample(.69);
  const state=journeySeason(blend),w=seasonWeights(state);
  assert.ok(w[1]>0 && w[3]>0,'winter must crossfade through autumn');
  assert.ok(Math.abs(winterAmount(blend)-w[3])<1e-10);
  assert.ok(Math.abs(journeyRain(blend)-w[1]*.85)<1e-10);
  assert.equal(journeySeason({...winter,tutorial:true}).to,0);
 }finally{setWeatherMode(old)}
});

test('manual season selection is preserved and cannot inherit incompatible rain',()=>{
 const old=getWeatherMode();try{
  const game=sample(.84);
  for(const [mode,id] of [['spring',0],['summer',2],['autumn',1],['winter',3]]){
   setWeatherMode(mode);
   assert.deepEqual(journeySeason(game),{from:id,to:id,mix:1});
   assert.equal(journeyRain(game),0);
   assert.equal(journeyStorm(game,'aventura'),0);
   assert.equal(winterAmount(game),mode==='winter'?1:0);
  }
  setWeatherMode('rain');assert.equal(journeyRain(game),.85);
  setWeatherMode('storm');assert.equal(journeyStorm(game,'aventura'),1);
 }finally{setWeatherMode(old)}
});

test('the real game retains victory, score sources, distance cap, stage geometry and physical wind',()=>{
 const game=new Game({seed:104});game.state='playing';game.nextSpawn=Infinity;
 assert.equal(VICTORY_SCORE,1000);assert.equal(JOURNEY_LENGTH,28000);
 assert.equal(FLIGHT.aventura.speed,275);
 const origin=game.speed;
 game.distance=16000;
 assert.ok(game.speed>origin,'physical wind must still read the original world distance');
 assert.equal(journeySeason({...game,elapsed:0}).to,0);
 assert.equal(journeySeason({...game,elapsed:climateReferenceSeconds('aventura',104)*.85}).to,3);
});

test('season backdrop prewarms the upcoming authored atlas frame under the new clock',t=>{
 const old=globalThis.OffscreenCanvas;t.after(()=>{globalThis.OffscreenCanvas=old;});
 const c=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 globalThis.OffscreenCanvas=class{
  constructor(w,h){this.width=w;this.height=h}
  getContext(){return c}
 };
 const oldMode=getWeatherMode();t.after(()=>setWeatherMode(oldMode));setWeatherMode('auto');
 const cache=new SeasonalBackdrop(),atlas={naturalWidth:1672,naturalHeight:941};
 const before=sample(.193);
 for(let i=0;i<10;i++)cache.prepare(atlas,1366,638,1,{...before,elapsed:before.elapsed+i*.1});
 assert.ok(cache.frames.has(2),'summer should prewarm before spring-to-summer transition');
 assert.ok(cache.frames.size<=2,'no third simultaneous backdrop');
 const later=sample(.23);
 cache.prepare(atlas,1366,638,1,later);
 assert.ok(cache.frames.has(2),'prewarmed summer must be ready at transition');
});
