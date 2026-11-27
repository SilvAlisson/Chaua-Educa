import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePerfVariant} from '../Chaua-Educa-main/js/perf-ab.mjs';
import {precomposedSnowStage,winterCapFrame,PRECOMPOSED_SNOW_STAGES} from '../Chaua-Educa-main/js/precomposed-winter.mjs';
import {WINTER_CAP_ART} from '../Chaua-Educa-main/js/winter-cap-data.mjs';

test('Pixi with precomposed snow is the browser default and legacy controls remain available',()=>{
 assert.equal(resolvePerfVariant(''),'pixi-webgl-winter');
 assert.equal(resolvePerfVariant('?perf-ab=baseline'),'pixi-webgl-winter');
 assert.equal(resolvePerfVariant('?perf-test=1&perf-ab=baseline'),'baseline');
});

test('sixteen snow levels progress in order and reserve full art for full cover',()=>{
 assert.equal(PRECOMPOSED_SNOW_STAGES,16);
 for(const [n,want] of [[-1,0],[0,0],[0.25,3],[0.5,7],[0.99,14],[1,15],[10,15],[NaN,0]])
  assert.equal(precomposedSnowStage(n),want);
 for(let i=0;i<16;i++)assert.equal(precomposedSnowStage(i/15),i);
});

test('all intermediate cap regions fit on their packed page',()=>{
 for(const kind of ['lower','upper','special']){
  for(let level=1;level<16;level++)for(let variant=0;variant<4;variant++){
   const frame=winterCapFrame(kind,level,variant);
   if(level===15&&kind!=='special'){assert.equal(frame,undefined);continue;}
   const [page,x,y,w,h]=frame;
   const bounds=WINTER_CAP_ART.pages[page];
   assert.ok(x>=2&&y>=2&&w>0&&h>0&&x+w+2<=bounds.width&&y+h+2<=bounds.height);
  }
 }
});

test('streaming winter preloads adjacent pages and releases textures through snow and thaw',async()=>{
 const {WinterStageStream}=await import('../Chaua-Educa-main/js/winter-stream.mjs');
 const {winterStageKey}=await import('../Chaua-Educa-main/js/precomposed-winter.mjs');
 const bitmap=stage=>({stage,closed:false,close(){this.closed=true;}});
 const cache=new Map([1,2].map(stage=>[winterStageKey(stage),bitmap(stage)]));
 const requested=[],released=[];
 const context={prepareImage(image){assert.equal(image.closed,false);},releaseImage(image){released.push(image);}};
 const stream=new WinterStageStream({cache,load:async key=>{
  const stage=Number(key.split('-').at(-1));requested.push(stage);return bitmap(stage);
 }});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 stream.prepareInitial(context);
 for(const stage of [...Array.from({length:16},(_,i)=>i),...Array.from({length:16},(_,i)=>15-i),0,1,2]){
  // Retain the last uploaded page while a required page is still decoding.
  for(let frame=0;frame<3;frame++){stream.update(context,stage/15);await settle();}
  assert.equal(stream.update(context,stage/15),stage);
  assert.ok(cache.size<=4);
 }
 assert.equal(stream.report().peakResident,4);
 assert.ok(requested.includes(15));
 assert.ok(released.length>0&&released.every(image=>image.closed));
});

test('late and failed winter requests preserve displayed art and retry with backoff',async()=>{
 const {WinterStageStream}=await import('../Chaua-Educa-main/js/winter-stream.mjs');
 const {winterStageKey}=await import('../Chaua-Educa-main/js/precomposed-winter.mjs');
 const cache=new Map([[winterStageKey(1),{stage:1}],[winterStageKey(2),{stage:2}]]);
 const pending=[];let time=10;
 const stream=new WinterStageStream({cache,now:()=>time,load:key=>new Promise((resolve,reject)=>pending.push({key,resolve,reject}))});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 const context={};
 stream.prepareInitial(context);
 assert.equal(stream.update(context,2/15),2);
 pending.shift().reject(Error('network offline'));await settle();
 assert.equal(stream.update(context,3/15),2);
 const inFlight=pending.shift();
 assert.equal(inFlight.key,winterStageKey(3));
 assert.equal(stream.update(context,0),0);
 const stale={closed:false,close(){this.closed=true;}};
 inFlight.resolve(stale);await settle();
 assert.equal(stream.update(context,0),0);
 assert.equal(stale.closed,true);
 assert.equal(stream.report().stageMisses,1);
 assert.equal(pending[0].key,winterStageKey(1));
 pending.shift().reject(Error('offline'));await settle();
 stream.update(context,0);assert.equal(pending.length,0);
 time+=3001;stream.update(context,0);
 assert.equal(pending[0].key,winterStageKey(1));
 assert.equal(stream.report().loadErrors,2);
});
