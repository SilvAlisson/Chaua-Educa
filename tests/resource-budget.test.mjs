import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Renderer} from '../Chaua-Educa-main/js/render.mjs';
import {SeasonalBackdrop} from '../Chaua-Educa-main/js/seasons.mjs';
const root=new URL('../Chaua-Educa-main/',import.meta.url);

test('local WOFF2 fonts preserve the verified full conversions and replace discarded TTFs',()=>{
 const defs={Baloo2:'a11bcd0a5d635f7a90ea8a192609c067cd232bd2ca9af0f1f4789512821dab13',Nunito:'fd0bff4bcc6e73295ec4f03d6ebcaecabff6292de6e04b31154e2d6fddab6b80'};
 let total=0;
 for(const [name,hash] of Object.entries(defs)){
  const bytes=readFileSync(new URL(`Fonts/${name}/${name}.woff2`,root));total+=bytes.length;
  assert.equal(bytes.toString('ascii',0,4),'wOF2');assert.equal(bytes.readUInt32BE(8),bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  assert.ok(existsSync(new URL(`Fonts/${name}/OFL.txt`,root)));
  assert.equal(existsSync(new URL(`Fonts/${name}/${name}.ttf`,root)),false);
 }
 assert.ok(total<300000);assert.equal(total,280912);
 for(const path of ['index.html','scss/style.scss','css/style.css'])assert.doesNotMatch(readFileSync(new URL(path,root),'utf8'),/\.ttf\b|font\/ttf|truetype/);
});
test('switching background families releases every incompatible raster surface exactly once',()=>{
 const r=Object.create(Renderer.prototype),surfaces=[];
 for(const key of ['skyCache','forestCache','fragmentedBackdrop','transitionBackdrop']){const surface={width:100,height:100};r[key]={surface};surfaces.push(surface);}
 r.seasonalBackdrop=new SeasonalBackdrop();const season={width:100,height:100};r.seasonalBackdrop.frames.set(0,season);
 r.selectBackdrop('seasonal');assert.ok(surfaces.every(s=>s.width===0&&s.height===0));assert.equal(season.width,100);
 r.selectBackdrop('seasonal');assert.equal(season.width,100,'active family is reused');
 r.selectBackdrop('forest');assert.equal(season.width,0);assert.equal(season.height,0);assert.equal(r.seasonalBackdrop.frames.size,0);
});
test('seasonal release frees both ready and partially prepared surfaces',()=>{
 const cache=new SeasonalBackdrop(),ready={width:10,height:20},pending={width:30,height:40};
 cache.frames.set(0,ready);cache.pending={surface:pending};cache.key='old';cache.atlas={};cache.release();
 assert.deepEqual([ready.width,ready.height,pending.width,pending.height],[0,0,0,0]);
 assert.equal(cache.frames.size,0);assert.equal(cache.pending,null);assert.equal(cache.atlas,null);
});
test('resize invalidates seasonal surfaces immediately, while a redundant resize keeps them',t=>{
 const previous=globalThis.window;t.after(()=>{globalThis.window=previous;});globalThis.window={devicePixelRatio:1};
 let rect={width:960,height:640};const r=Object.create(Renderer.prototype);
 r.canvas={width:960,height:640,getBoundingClientRect:()=>rect};r.w=960;r.h=640;r.dpr=1;r.resolution='high';r.seasonalBackdrop=new SeasonalBackdrop();
 const surface={width:1012,height:640};r.seasonalBackdrop.frames.set(0,surface);
 r.resize();assert.equal(surface.width,1012);
 rect={width:844,height:390};r.resize();assert.equal(surface.width,0);assert.equal(surface.height,0);assert.equal(r.seasonalBackdrop.frames.size,0);
});
