import {loadImage} from './image-loader.mjs';
import {RUNTIME_ART} from './runtime-art-data.mjs';
import {PRECOMPOSED_SNOW_ACTIVE,precomposedAssetKey} from './precomposed-winter.mjs';
// One cache for gameplay, menus and results. All files are local.
export const ASSET_PATHS = Object.fromEntries([
 ...['chaua','hawk'].map(k=>[`${k}-atlas`,`../assets/v6/${k}-atlas.webp`]),
 ...['lower','upper'].map(k=>[`trees-${k}`,`../assets/v7/trees-${k}.webp`]),
 // Keep only the authored full-winter atlas plus transparent transition
 // overlays. Remove 2 identical legacy copies and 6 unused intermediate
 // full-size frames from BOOT, while keeping their on-disk originals intact.
 ...['lower','upper'].map(k=>[`trees-${k}-snow-04`,`../assets/Seasons/Winter/trees-${k}-snow-04.webp`]),
 ...['lower','upper'].flatMap(k=>[1,2,3,4].map(s=>[`trees-${k}-overlay-0${s}`,`../assets/Seasons/Winter/trees-${k}-overlay-0${s}.webp`])),
 // Test C: add 43 source-aligned stage files only when explicitly requested.
 // Stage zero and full-snow living trees reuse already approved assets.
 ...(PRECOMPOSED_SNOW_ACTIVE?[
  ...['lower','upper'].flatMap(kind=>Array.from({length:14},(_,i)=>i+1).map(stage=>[
   precomposedAssetKey(kind,stage),
   '../assets/Seasons/Winter/Precomposed/trees-'+kind+'-snow-'+String(stage).padStart(2,'0')+'.webp'
  ])),
  ...Array.from({length:15},(_,i)=>i+1).map(stage=>[
   precomposedAssetKey('special',stage),
   '../assets/Seasons/Winter/Precomposed/tree-variants-snow-'+String(stage).padStart(2,'0')+'.webp'
  ])
 ]:[]),
 ...Object.entries(RUNTIME_ART).flatMap(([family,def])=>def.pages.map((page,i)=>[`runtime-${family}-${i}`,page.path])),
 ...['forest'].map(k=>[k,`../assets/v3/${k}.webp`]),
 ...['feather','shield'].map(k=>[k,`../assets/v4/${k}.webp`]),
 ['tree-variants','../assets/v9/tree-variants.webp'],
 ['tree-variants-snow','../assets/v10/tree-variants-snow.webp'],
 ['season-backgrounds','../assets/v10/season-backgrounds.webp'],
 ['season-particles','../assets/v10/season-particles.webp'],
 ['clay-breath','../assets/v10/clay-breath.webp'],
]);
export const images = new Map();
const runtimeDimensions=new Map(Object.entries(RUNTIME_ART).flatMap(([family,def])=>def.pages.map((p,i)=>[`runtime-${family}-${i}`,[p.width,p.height]])));
let pending;
export function loadAssets() {
 if(typeof Image==='undefined')return Promise.resolve([]);
 if(pending)return pending;
 pending=Promise.all(Object.entries(ASSET_PATHS).map(async([key,path])=>{
  const [width,height]=runtimeDimensions.get(key)||[];
  const url=new URL(path,import.meta.url).href;
  const image=await loadImage(url,{width,height,errorMessage:`Não foi possível carregar ${key}: ${url}`});
  return [key,image];
 })).then(entries=>{
  // Publish only the complete attempt; late callbacks from a failed attempt stay local.
  for(const [key,image] of entries)images.set(key,image);
  return entries.map(([,image])=>image);
 }).catch(error=>{pending=null;throw error;});
 return pending;
}
