import { SNAKE_ART } from './geometry.mjs';
import { FRUITS } from './fruits.mjs';
// One cache for gameplay, menus and results. All files are local.
export const ASSET_PATHS = Object.fromEntries([
 ...FRUITS.map(f=>[`fruit-${f.id}`,`../assets/v3/fruit-${f.id}.webp`]),
 ...['forest','chaua-hero', ...[0,1,2,3].map(i=>`chaua-${i}`), ...[0,1,2].flatMap(i=>[`trunk-${i}`,`bark-${i}`])].map(k=>[k,`../assets/v3/${k}.webp`]),
 ...['branch','feather','hawk-0','hawk-1','hawk-2','hawk-3','hollow','perch','shield','snake'].map(k=>[k,`../assets/v4/${k}.webp`]),
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
export const BIRD_ANCHORS = [[370/627,418/627],[356/627,418/627],[370/627,343/627],[350/627,343/627]];
export const TRUNKS = [{originX:.497,coreWidth:620},{originX:.503,coreWidth:600},{originX:.50,coreWidth:620}];
export const SPECIAL = {snake:SNAKE_ART,hollow:{originX:.62,coreWidth:160}};
export function flightPose(wing, reduced=false) { return reduced || wing<=0 ? 1 : [0,2,3,1][Math.min(3,Math.floor((1-wing)*4))]; }
