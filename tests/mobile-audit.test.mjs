import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePerfVariant,buildPerfTestUrl,PERF_AB_VARIANT} from '../Chaua-Educa-main/js/perf-ab.mjs';
import {diagnosticStutterSlot} from '../Chaua-Educa-main/js/perf-sampling.mjs';
import {clipSnowReveal,snowRevealHeight} from '../Chaua-Educa-main/js/winter-vfx.mjs';
import {readFileSync} from 'node:fs';

test('A/B modes never affect game unless perf-test is enabled',()=>{
 assert.equal(PERF_AB_VARIANT,'precomposed-snow');
 assert.equal(resolvePerfVariant('?perf-ab=snow-mask-off'),'pixi-webgl-winter');
 assert.equal(resolvePerfVariant('?perf-ab=winter-caps-bitmap'),'pixi-webgl-winter');
 assert.equal(resolvePerfVariant('?perf-ab=winter-caps-stage-cache'),'pixi-webgl-winter');
 assert.equal(resolvePerfVariant('?perf-ab=winter-caps-stage-prefetch'),'pixi-webgl-winter');
 assert.equal(resolvePerfVariant('?perf-ab=winter-caps-compact-stages'),'pixi-webgl-winter');
 for(const v of ['winter-caps-compact-stages','winter-caps-stage-prefetch','winter-caps-stage-cache','winter-caps-bitmap','baseline','direct-snow','snow-mask-off','snow-flakes-off','static-season-bg','legacy-snow-clips','legacy-snow-rebuild']){
  assert.equal(resolvePerfVariant('?perf-test=1&perf-ab='+v),v);
 }
 assert.equal(resolvePerfVariant('?perf-test=1&perf-ab=invalid'),'precomposed-snow');
 const built=buildPerfTestUrl('https://example.test/Chaua-Educa/Chaua-Educa-main/?foo=bar',{ab:'winter-caps-compact-stages',level:'deep',hz:120,replay:true,weather:'winter'});
 const u=new URL(built);
 assert.equal(u.pathname,'/Chaua-Educa/Chaua-Educa-main/');
 assert.equal(u.searchParams.get('foo'),'bar');
 assert.equal(u.searchParams.get('perf-test'),'1');
 assert.equal(u.searchParams.get('perf-ab'),'winter-caps-compact-stages');
 assert.equal(u.searchParams.get('perf-level'),'deep');
 assert.equal(u.searchParams.get('perf-hz'),'120');
 assert.equal(u.searchParams.get('perf-replay'),'1');
 assert.equal(u.searchParams.get('clima'),'winter');
 const exited=new URL(buildPerfTestUrl(built,{enabled:false}));
 assert.equal(exited.search,'?foo=bar');
});
test('clip reveal preserves all 32 columns on the fallback path',()=>{
 const calls=[],ctx={beginPath(){calls.push('begin');},rect(...args){calls.push(args);},clip(){calls.push('clip');}};
 clipSnowReveal(ctx,0,0,256,128,.5);
 const rects=calls.filter(Array.isArray);
 assert.equal(rects.length,32);
 assert.equal(rects[0][2],8);
 assert.ok(rects.every(rect=>rect[3]>0&&rect[3]<=128));
 assert.equal(calls.at(-1),'clip');
 assert.equal(snowRevealHeight(1),1);
});
test('Path2D reuses the clipping geometry for multiple identical trees',()=>{
 const original=globalThis.Path2D;let constructed=0;
 globalThis.Path2D=class {constructor(){constructed++;this.rectangles=[];}rect(...args){this.rectangles.push(args);}};
 try{
  const paths=[],ctx={clip(p){paths.push(p);}};
  clipSnowReveal(ctx,0,0,512,180,.25);
  clipSnowReveal(ctx,0,0,512,180,.25);
  assert.equal(constructed,1);
  assert.equal(paths[0],paths[1]);
  clipSnowReveal(ctx,0,0,512,180,.5);
  assert.equal(constructed,2);
 }finally{
  if(original===undefined)delete globalThis.Path2D;
  else globalThis.Path2D=original;
 }
});
test('stutter details retain early, late and >50 ms frames in long flights',()=>{
 const samples=[],limit=150;
 for(let seen=1;seen<=1000;seen++){
  const ms=seen===750?83.1:seen%15===0?49.9:33.3;
  const slot=diagnosticStutterSlot(seen,limit,seen,ms,samples);
  if(slot>=0)samples[slot]={frame:seen,frameMs:ms};
 }
 assert.equal(samples.length,limit);
 assert.ok(samples.some(s=>s.frame>850),'late flight represented');
 assert.ok(samples.some(s=>s.frame===750),'severe late spike retained');
 assert.ok(samples.some(s=>s.frame<250),'early flight represented');
});
test('all diagnostic overrides are separated from normal rendering',()=>{
 const root=new URL('../',import.meta.url);
 const read=p=>readFileSync(new URL(p,root),'utf8');
 const tree=read('Chaua-Educa-main/js/tree-art.mjs');
 const season=read('Chaua-Educa-main/js/seasons.mjs');
 const probe=read('Chaua-Educa-main/js/perf-probe.mjs');
 assert.match(tree,/render\.snowMaskRebuild/);
 assert.match(tree,/PERF_AB_VARIANT!=='snow-mask-off'/);
 assert.match(season,/PERF_AB_VARIANT==='static-season-bg'/);
 assert.match(probe,/diagnosticRevision:'flight-benchmark-2'/);
 assert.match(probe,/if\(forensics.deep\)\{forensics.startBrowserObservers\(\)/);
});
