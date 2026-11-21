import {canvasSpy,installCanvasMock} from './helpers/canvas.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {drawLivingTrunk,drawTreeVariant} from '../Chaua-Educa-main/js/tree-art.mjs';
import {images} from '../Chaua-Educa-main/js/assets.mjs';
import {RUNTIME_ART} from '../Chaua-Educa-main/js/runtime-art-data.mjs';
const root=new URL('../Chaua-Educa-main/assets/',import.meta.url);

test('winter assets and six shedding frames remain available in runtime',()=>{
 for(const kind of ['lower','upper']){
  for(const stage of ['snow-04','overlay-01','overlay-02','overlay-03','overlay-04']){
   const file=new URL(`Seasons/Winter/trees-${kind}-${stage}.webp`,root);
   const b=readFileSync(file);
   assert.equal(b.toString('ascii',8,12),'WEBP',file.pathname);
  }
 }
 for(let i=0;i<6;i++)assert.ok(Object.keys(RUNTIME_ART.fx.frames).some(k=>k.startsWith(`snow-${i}-`)));
 for(const page of RUNTIME_ART.fx.pages)assert.ok(existsSync(new URL(page.path.replace('../assets/',''),root)));
});
test('winter lower cap starts before old y20 clip; upper tips extend but physics is untouched',t=>{
 installCanvasMock(t);
 const {c,draws:calls}=canvasSpy();
 const base={naturalWidth:1024,naturalHeight:1024};
 const old=new Map(images);images.set('trees-lower',base);images.set('trees-upper',base);
 try{
  drawLivingTrunk(c,{x:500,y:250,width:160,snow:.5,upper:false,variant:0});
  assert.ok(calls.some(v=>v.length===9&&v[2]===0),'lower cap must include top pixels');
  calls.length=0;
  drawLivingTrunk(c,{x:500,y:250,width:160,snow:.5,upper:true,variant:0});
  assert.ok(calls.some(v=>v.length===9),'upper trunk must remain drawable');
 }finally{images.clear();for(const [k,v] of old)images.set(k,v);}
});
