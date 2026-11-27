import {loadImage} from './image-loader.mjs';
import {PERF_AB_VARIANT, WINTER_EAGER_CONTROL} from './perf-ab.mjs';
import {PRECOMPOSED_SNOW_ACTIVE,PRECOMPOSED_SNOW_COMPACT_STAGES,PRECOMPOSED_SNOW_STAGE_CACHE,winterStageKey} from './precomposed-winter.mjs';
import {ASSET_CATALOG,BASE_ASSETS,LEGACY_SNOW_ASSETS,WINTER_PAGE_ASSETS,WINTER_STAGE_ASSETS} from './asset-manifest.mjs';

export const STREAM_WINTER_STAGES=PERF_AB_VARIANT==='pixi-webgl-winter'&&!WINTER_EAGER_CONTROL;
const needsLegacySnow=['baseline','direct-snow','legacy-snow-clips','legacy-snow-rebuild'].includes(PERF_AB_VARIANT);
const winterAssets=PRECOMPOSED_SNOW_ACTIVE
 ? (PRECOMPOSED_SNOW_COMPACT_STAGES?WINTER_STAGE_ASSETS:WINTER_PAGE_ASSETS) : {};
export const ASSET_PATHS=Object.fromEntries(Object.entries({
 ...BASE_ASSETS,...LEGACY_SNOW_ASSETS,...winterAssets,
}).map(([key,entry])=>[key,entry.path]));
export const STARTUP_ASSET_KEYS=Object.freeze([
 ...Object.keys(BASE_ASSETS),
 ...(needsLegacySnow?Object.keys(LEGACY_SNOW_ASSETS):[]),
 ...(STREAM_WINTER_STAGES?[winterStageKey(1),winterStageKey(2)]:Object.keys(winterAssets)),
]);
export const images=new Map();

export function loadCatalogAsset(key,representation='canvas',errorLabel=`Não foi possível carregar ${key}`){
 const {path,width,height}=ASSET_CATALOG[key];
 const url=new URL(path,import.meta.url).href;
 return loadImage(url,{width,height,representation,errorMessage:`${errorLabel}: ${url}`});
}

let pending;
export function loadAssets(){
 if(typeof Image==='undefined')return Promise.resolve([]);
 if(pending)return pending;
 const winterRepresentation=PRECOMPOSED_SNOW_STAGE_CACHE?'image':
  PERF_AB_VARIANT==='winter-caps-bitmap'?'bitmap':'canvas';
 pending=Promise.all(STARTUP_ASSET_KEYS.map(async key=>[
  key,await loadCatalogAsset(key,Object.hasOwn(winterAssets,key)?winterRepresentation:'canvas'),
 ])).then(entries=>{
  for(const [key,image] of entries)images.set(key,image);
  return entries.map(([,image])=>image);
 }).catch(error=>{pending=null;throw error;});
 return pending;
}
