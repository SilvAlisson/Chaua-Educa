import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';
import {SeasonalBackdrop,journeySeason} from '../Chaua-Educa-main/js/seasons.mjs';
import {climateReferenceSeconds} from '../Chaua-Educa-main/js/climate-progress.mjs';
import {physicsWind,journeyWind,setWeatherMode,getWeatherMode,drawJourneyRain,drawJourneyFog,drawLightning}
 from '../Chaua-Educa-main/js/weather.mjs';
import {hawkAction} from '../Chaua-Educa-main/js/action-states.mjs';
import {drawForestLife} from '../Chaua-Educa-main/js/forest-life.mjs';
import {drawTreeVariant} from '../Chaua-Educa-main/js/tree-art.mjs';
import {images} from '../Chaua-Educa-main/js/assets.mjs';
import {shapesHitRect,intersects,rectShape} from '../Chaua-Educa-main/js/collision.mjs';
import {ForestAudio} from '../Chaua-Educa-main/js/audio.mjs';

function spyCanvas(){
 const events=[],gradients=[];
 const c=new Proxy({globalAlpha:1,strokeStyle:'',shadowBlur:0}, {
  get(o,k){
   if(k==='createLinearGradient'||k==='createRadialGradient')return (...a)=>{
    events.push(['gradient',k,...a]);const g={addColorStop(){}};
    gradients.push(g);return g;
   };
   if(k==='drawImage')return (...a)=>events.push(['image',...a]);
   if(['save','restore','setTransform','beginPath','rect','clip','translate','scale',
    'rotate','moveTo','lineTo','closePath','fill','fillRect','arc','ellipse',
    'quadraticCurveTo','stroke','bezierCurveTo'].includes(k))
    return (...a)=>events.push([k,...a]);
   return o[k];
  },set(o,k,v){o[k]=v;return true;}
 });
 return {c,events,gradients};
}

test('prewarm uses prototype-inherited seed/mode from the ACTUAL Game.visual(alpha)',t=>{
 const prev=globalThis.OffscreenCanvas;
 t.after(()=>{globalThis.OffscreenCanvas=prev});
 const spy=spyCanvas();
 globalThis.OffscreenCanvas=class{
  constructor(w,h){this.width=w;this.height=h}
  getContext(){return spy.c}
 };
 const previous=getWeatherMode();t.after(()=>setWeatherMode(previous));
 setWeatherMode('auto');
 const g=new Game({seed:217});
 g.mode='tranquilo';g.elapsed=290;g.state='playing';g.snapshot();
 const interpolated=g.visual(1);
 assert.equal(interpolated.mode,'tranquilo');
 assert.equal(interpolated.seed,217);
 assert.equal(Object.hasOwn(interpolated,'mode'),false);
 assert.equal(Object.hasOwn(interpolated,'seed'),false);
 const atlas={naturalWidth:1672,naturalHeight:941};
 const cache=new SeasonalBackdrop();
 const correctState=journeySeason({mode:g.mode,seed:g.seed,elapsed:308,distance:28000});
 assert.equal(correctState.to,1,'expect summer before autumn boundary');
 // The incremental scheduler uses 24-row slices and a SOFT time budget;
 // allow enough calls to complete the cache on slow CI machines.
 for(let i=0;i<80;i++)cache.prepare(atlas,950,600,1,interpolated);
 assert.ok(cache.frames.has(1),'summer source missing');
 assert.ok(!cache.frames.has(2),'wrong-mode prewarm accidentally loaded autumn');
 assert.ok(cache.frames.size<=2);
});

test('physical speed is completely independent of manual season and weather selection',t=>{
 const prev=getWeatherMode();t.after(()=>setWeatherMode(prev));
 const g=new Game({seed:104});g.mode='aventura';
 for(const mode of ['aventura','tranquilo']){
  g.mode=mode;
  for(const d of [0,10500,16000,20000,28000]){
   g.distance=d;setWeatherMode('auto');
   const speed=g.speed,reference=physicsWind(d,mode,false);
   for(const setting of ['spring','summer','autumn','winter','storm','rain','auto']){
    setWeatherMode(setting);
    assert.equal(g.speed,speed,`${mode}, ${d}, ${setting} altered physical motion`);
    assert.equal(physicsWind(d,mode,false),reference);
   }
  }
 }
 setWeatherMode('storm');
 assert.equal(physicsWind(16000,'aventura',true),0);
 assert.notEqual(journeyWind(16000,'aventura'),physicsWind(16000,'aventura'));
});

test('ascending hawk preserves the wingbeat action instead of inverted dive art',()=>{
 for(const [y,up] of [[175,true],[425,false]]){
  const g=new Game({seed:104});
  g.state='playing';g.elapsed=100;g.sequence=4;g.mode='aventura';
  g.y=y;g.hawkSequence=up?1:0;g.entities=[];g.spawn();
  const hawk=g.entities.find(e=>e.kind==='hawk');
  assert.ok(hawk,'solo hawk did not spawn');
  assert.equal(hawk.ascent,up);
  assert.equal(hawk.dive,!up);
  if(up){
   assert.ok(hawk.startY>hawk.targetY,'ascending hawk should climb');
   assert.equal(hawkAction({...hawk,warning:0},5,false).sheet,'hawk-flight');
  }else{
   assert.ok(hawk.startY<hawk.targetY,'true dive should descend');
   assert.equal(hawkAction({...hawk,warning:0},5,false),null);
  }
 }
});

test('camera-bounded bark draws fewer repeated tiles without changing the original cap',t=>{
 const backup=new Map(images);t.after(()=>{images.clear();for(const [k,v] of backup)images.set(k,v)});
 const art={id:'tree-variants'};
 images.set('tree-variants',art);
 for(const upper of [true,false]){
  const full=spyCanvas(),cropped=spyCanvas();
  drawTreeVariant(full.c,400,190,upper,'moss',undefined,0,0,2,1000);
  drawTreeVariant(cropped.c,400,190,upper,'moss',undefined,0,0,2,240);
  const count=c=>c.events.filter(e=>e[0]==='image'&&e[1]===art).length;
  assert.ok(count(full)>=9,'reference trunk not drawn completely');
  assert.ok(count(cropped)<count(full),'camera culling failed');
  assert.ok(count(cropped)>=2,'culling removed authored cap or entire bark');
 }
});

test('conservative broad-phase agrees with old exact SAT on varied overlaps and edge contacts',()=>{
 let state=14591;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 for(let i=0;i<1000;i++){
  const r={x:random()*300-150,y:random()*240-120,w:10+random()*75,h:10+random()*85};
  const make=()=>{const x=random()*340-170,y=random()*280-140,w=2+random()*120,h=2+random()*80;return rectShape({x,y,w,h})};
  const shapes=[make(),make()];
  const before=shapes.some(poly=>intersects(poly,rectShape(r)));
  assert.equal(shapesHitRect(shapes,r),before,`SAT broadphase mismatched test ${i}`);
 }
});

test('atmospheric gradient cache obeys context + dimensions and uses a single sunbeam fill',t=>{
 const old=getWeatherMode();t.after(()=>setWeatherMode(old));setWeatherMode('summer');
 const {c,events}=spyCanvas();
 drawForestLife(c,1366,638,1,{mode:'aventura',seed:104,elapsed:220,distance:28000},0,.20,false,false,0);
 const first=events.filter(e=>e[0]==='gradient').length;
 assert.ok(first>0);
 const firstFills=events.filter(e=>e[0]==='fill').length;
 assert.ok(firstFills<=3,'sunbeam fill should be batched, not one fill per ray');
 drawForestLife(c,1366,638,1.3,{mode:'aventura',seed:104,elapsed:220,distance:28000},0,.2,false,false,0);
 assert.equal(events.filter(e=>e[0]==='gradient').length,first,'forest rebuilt gradients at same size');
 drawForestLife(c,390,844,1.8,{mode:'aventura',seed:104,elapsed:220,distance:28000},0,.2,false,false,0);
 assert.ok(events.filter(e=>e[0]==='gradient').length>first,'resize failed to rebuild gradients');
 const wx=spyCanvas();
 drawJourneyFog(wx.c,1366,638,.7);
 drawJourneyRain(wx.c,1366,638,2,.8,false,false,.3);
 const weatherBefore=wx.events.filter(e=>e[0]==='gradient').length;
 drawJourneyFog(wx.c,1366,638,.7);
 drawJourneyRain(wx.c,1366,638,2,.8,false,false,.3);
 assert.equal(wx.events.filter(e=>e[0]==='gradient').length,weatherBefore);
});

test('lightning uses doubled strokes and never requests a Gaussian shadow blur',()=>{
 const {c,events}=spyCanvas();
 const time=(1-.15+.02)/.31;
 drawLightning(c,900,600,time,1,false);
 assert.ok(events.filter(e=>e[0]==='stroke').length>=3,'lightning+fork strokes missing');
 assert.equal(c.shadowBlur,0);
});

test('WebAudio graph suspends when hidden and resumes on visibility restoration',async()=>{
 let state='running',suspends=0,resumes=0;
 const context={currentTime:2,get state(){return state},
  suspend(){suspends++;state='suspended';return Promise.resolve()},
  resume(){resumes++;state='running';return Promise.resolve()}};
 const gain={setTargetAtTime(){}};
 const audio=new ForestAudio(()=>context);
 audio.context=context;audio.master={gain};audio.ambient={gain};
 audio.thunder={gain};audio.filter={frequency:{setTargetAtTime(){}}};
 audio.enabled=true;audio.visible=true;audio.nextFilter=1000;
 audio.update('playing',false,0,0,0,1,.5);
 assert.equal(suspends,1);assert.equal(context.state,'suspended');
 audio.update('playing',true,0,0,0,1,.5);
 await Promise.resolve();
 assert.equal(resumes,1);assert.equal(context.state,'running');
});
