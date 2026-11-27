import {WINTER_CAP_ART} from './winter-cap-data.mjs';
import {loadImage} from './image-loader.mjs';
import {RUNTIME_ART} from './runtime-art-data.mjs';
import {PERF_AB_VARIANT} from './perf-ab.mjs';
import {PRECOMPOSED_SNOW_ACTIVE,PRECOMPOSED_SNOW_COMPACT_STAGES,PRECOMPOSED_SNOW_STAGE_CACHE,winterCapKey,winterStageKey} from './precomposed-winter.mjs';
// One cache for gameplay, menus and results. All files are local.
const precomposedWinterAssetEntries=PRECOMPOSED_SNOW_COMPACT_STAGES
 ? (WINTER_CAP_ART.stagePages||[]).filter(Boolean).map(page=>[
  winterStageKey(page.stage),'../assets/Seasons/Winter/Precomposed/'+page.file
 ])
 : WINTER_CAP_ART.pages.map((page,index)=>[
  winterCapKey(index),'../assets/Seasons/Winter/Precomposed/'+page.file
 ]);
export const ASSET_PATHS = Object.fromEntries([
 ...['chaua','hawk'].map(k=>[`${k}-atlas`,`../assets/v6/${k}-atlas.webp`]),
 ...['lower','upper'].map(k=>[`trees-${k}`,`../assets/v7/trees-${k}.webp`]),
 // Keep the authored full-winter atlas and overlay-04 fallback/visual-test
 // surface; overlays 01-03 are unused at runtime.
 ...['lower','upper'].map(k=>[`trees-${k}-snow-04`,`../assets/Seasons/Winter/trees-${k}-snow-04.webp`]),
 ...['lower','upper'].map(k=>[`trees-${k}-overlay-04`,`../assets/Seasons/Winter/trees-${k}-overlay-04.webp`]),
 ...(PRECOMPOSED_SNOW_ACTIVE?precomposedWinterAssetEntries:[]),
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
const winterCapKeys=new Set();
if(PRECOMPOSED_SNOW_COMPACT_STAGES){
 for(const page of WINTER_CAP_ART.stagePages||[]){
  if(!page)continue;
  const key=winterStageKey(page.stage);
  winterCapKeys.add(key);
  runtimeDimensions.set(key,[page.width,page.height]);
 }
}else{
 WINTER_CAP_ART.pages.forEach((page,index)=>{
  const key=winterCapKey(index);
  winterCapKeys.add(key);
  runtimeDimensions.set(key,[page.width,page.height]);
 });
}
let pending;
export function loadAssets() {
 if(typeof Image==='undefined')return Promise.resolve([]);
 if(pending)return pending;
 const winterCapRepresentation=PRECOMPOSED_SNOW_STAGE_CACHE?'image':
  PERF_AB_VARIANT==='winter-caps-bitmap'?'bitmap':'canvas';
 pending=Promise.all(Object.entries(ASSET_PATHS).map(async([key,path])=>{
  const [width,height]=runtimeDimensions.get(key)||[];
  const url=new URL(path,import.meta.url).href;
  const representation=winterCapKeys.has(key)?winterCapRepresentation:'canvas';
  const image=await loadImage(url,{width,height,representation,errorMessage:`Não foi possível carregar ${key}: ${url}`});
  return [key,image];
 })).then(entries=>{
  // Publish only the complete attempt; late callbacks from a failed attempt stay local.
  for(const [key,image] of entries)images.set(key,image);
  return entries.map(([,image])=>image);
 }).catch(error=>{pending=null;throw error;});
 return pending;
}
