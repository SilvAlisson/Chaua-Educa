import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolvePerfVariant} from '../Chaua-Educa-main/js/perf-ab.mjs';
import {precomposedSnowStage,precomposedAssetKey,PRECOMPOSED_SNOW_STAGES} from '../Chaua-Educa-main/js/precomposed-winter.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'Chaua-Educa-main/assets/Seasons/Winter/Precomposed/manifest.json'),'utf8'));

test('Test C is opt-in on ordinary winter game URLs',()=>{
 assert.equal(resolvePerfVariant('?clima=winter&perf-ab=precomposed-snow'),'precomposed-snow');
 assert.equal(resolvePerfVariant(''),'baseline');
 assert.equal(resolvePerfVariant('?perf-ab=baseline'),'baseline');
});
test('sixteen precomposed snow levels quantize safely',()=>{
 assert.equal(PRECOMPOSED_SNOW_STAGES,16);
 for(const [n,want] of [[-10,0],[0,0],[0.25,4],[0.5,8],[1,15],[10,15],[NaN,0]])
  assert.equal(precomposedSnowStage(n),want);
});
test('every stage exists and stage zero/full living stage exactly reuse original WebPs',()=>{
 for(const kind of ['lower','upper','special']){
  const family=manifest.families[kind];
  assert.equal(family.files.length,16);
  for(let stage=0;stage<16;stage++){
   assert.ok(fs.existsSync(path.join(root,family.files[stage])),family.files[stage]);
   assert.ok(precomposedAssetKey(kind,stage));
  }
  assert.deepEqual(fs.readFileSync(path.join(root,family.files[0])),fs.readFileSync(path.join(root,family.base)));
  if(kind!=='special')assert.deepEqual(fs.readFileSync(path.join(root,family.files[15])),fs.readFileSync(path.join(root,family.fullSnow)));
 }
});
