import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePerfVariant} from '../Chaua-Educa-main/js/perf-ab.mjs';
import {precomposedSnowStage,winterCapFrame,PRECOMPOSED_SNOW_STAGES} from '../Chaua-Educa-main/js/precomposed-winter.mjs';
import {WINTER_CAP_ART} from '../Chaua-Educa-main/js/winter-cap-data.mjs';

test('precomposed snow is the default and legacy controls remain available',()=>{
 assert.equal(resolvePerfVariant(''),'precomposed-snow');
 assert.equal(resolvePerfVariant('?perf-ab=baseline'),'precomposed-snow');
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
