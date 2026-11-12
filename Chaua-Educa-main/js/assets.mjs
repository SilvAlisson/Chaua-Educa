import { FRUITS } from './fruits.mjs';
// One cache for gameplay, menus and results. All files are local.
export const ASSET_PATHS = Object.fromEntries([
 ...['chaua','hawk'].map(k=>[`${k}-atlas`,`../assets/v6/${k}-atlas.webp`]),
 ...['lower','upper'].map(k=>[`trees-${k}`,`../assets/v7/trees-${k}.webp`]),
 // Keep only the authored full-winter atlas plus transparent transition
 // overlays. Remove 2 identical legacy copies and 6 unused intermediate
 // full-size frames from BOOT, while keeping their on-disk originals intact.
 ...['lower','upper'].map(k=>[`trees-${k}-snow-04`,`../assets/Seasons/Winter/trees-${k}-snow-04.webp`]),
 ...['lower','upper'].flatMap(k=>[1,2,3,4].map(s=>[`trees-${k}-overlay-0${s}`,`../assets/Seasons/Winter/trees-${k}-overlay-0${s}.webp`])),
 ...[0,1,2,3,4,5].map(s=>[`trees-upper-shedding-0${s}`,`../assets/Seasons/Winter/trees-upper-shedding-0${s}.webp`]),
 ...FRUITS.map(f=>[`fruit-${f.id}`,`../assets/v3/fruit-${f.id}.webp`]),
 ...['forest'].map(k=>[k,`../assets/v3/${k}.webp`]),
 ...['feather','shield'].map(k=>[k,`../assets/v4/${k}.webp`]),
 ['tree-variants','../assets/v9/tree-variants.webp'],
 ['tree-variants-snow','../assets/v10/tree-variants-snow.webp'],
 ['season-backgrounds','../assets/v10/season-backgrounds.webp'],
 ['season-particles','../assets/v10/season-particles.webp'],
 ['clay-breath','../assets/v10/clay-breath.webp'],
]);
export const images = new Map();
let pending;
export function loadAssets() {
 return pending ??= Promise.all(Object.entries(ASSET_PATHS).map(([key,path])=>new Promise((resolve,reject)=>{
  const img=new Image(); img.onload=()=>{images.set(key,img);resolve(img);};
  img.onerror=()=>reject(new Error(`Não foi possível carregar ${key}. Recarregue a página.`));
  img.src=new URL(path,import.meta.url).href;
 })));
}
