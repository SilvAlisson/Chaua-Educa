import {ASSET_CATALOG} from '../Chaua-Educa-main/js/asset-manifest.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {STARTUP_ASSET_KEYS,images,loadAssets} from '../Chaua-Educa-main/js/assets.mjs';
import {preloadSnakeA2,isSnakeA2Ready} from '../Chaua-Educa-main/js/snake-a2.mjs';

test('all required textures finish asynchronous decoding before the game is ready',async()=>{
 const old=globalThis.Image;let count=0;
 class Img{
  naturalWidth=1;naturalHeight=1;
  set src(url){this.url=url;const page=Object.values(ASSET_CATALOG).find(p=>url.endsWith(p.path.slice(2)));if(page){this.naturalWidth=page.width;this.naturalHeight=page.height;}queueMicrotask(()=>this.onload?.());}
  async decode(){count++;}
 }
 globalThis.Image=Img;
 try{
  await loadAssets();
  assert.equal(count,STARTUP_ASSET_KEYS.length);
  assert.equal(images.size,count);
  assert.ok(images.has('runtime-fx-0'));assert.ok(images.has('runtime-foods-0'));
 }finally{globalThis.Image=old;}
});

test('all five A2 textures finish decoding before the renderer reports ready',async()=>{
 const old=globalThis.Image;let count=0;
 class Img{
  naturalWidth=1536;naturalHeight=768;
  set src(url){this.url=url;queueMicrotask(()=>this.onload?.());}
  async decode(){count++;}
 }
 globalThis.Image=Img;
 try{
  await preloadSnakeA2();
  assert.equal(count,5);
  assert.equal(isSnakeA2Ready(),true);
 }finally{globalThis.Image=old;}
});
