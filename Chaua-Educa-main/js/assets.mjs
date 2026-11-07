import { SNAKE_ART } from './geometry.mjs';
import { FRUITS } from './fruits.mjs';
// One cache for gameplay, menus and results. All files are local.
export const ASSET_PATHS = Object.fromEntries([
 ...['parrot','hawk','snake','forest'].map(k=>['v11-'+k,'../assets/v11/'+k+'.webp']),
 ...['chaua','hawk'].map(k=>[`${k}-atlas`,`../assets/v6/${k}-atlas.webp`]),
 ['snake-atlas','../assets/v7/snake-atlas.webp'],
 ['snake-wrap','../assets/v8/snake-wrap.webp'],
 ...['lower','upper'].map(k=>[`trees-${k}`,`../assets/v7/trees-${k}.webp`]),
 ...FRUITS.map(f=>[`fruit-${f.id}`,`../assets/v3/fruit-${f.id}.webp`]),
 ...['forest'].map(k=>[k,`../assets/v3/${k}.webp`]),
 ...['feather','shield'].map(k=>[k,`../assets/v4/${k}.webp`]),
 ['tree-variants','../assets/v11/tree-variants.webp'],
 ['season-backgrounds','../assets/v10/season-backgrounds.webp'],
 ['season-particles','../assets/v10/season-particles.webp'],
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
export const BIRD_ANCHORS = [[371.75/627,418.09/627],[353/627,418.2/627],[369.14/627,342.21/627],[356.94/627,342.31/627]];
export const BIRD_SCALES = [139/140,1,139/138,139/138];
export const TRUNKS = [{originX:.497,coreWidth:620},{originX:.503,coreWidth:600},{originX:.50,coreWidth:620}];
export const SPECIAL = {snake:SNAKE_ART,hollow:{originX:.62,coreWidth:160}};
export function flightPose(wing, reduced=false) { return reduced || wing<=0 ? 1 : [0,2,3,1][Math.min(3,Math.floor((1-wing)*4))]; }
