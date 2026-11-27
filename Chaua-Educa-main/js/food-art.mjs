import {FOODS} from './foods.mjs';
import {RUNTIME_ART} from './runtime-art-data.mjs';
import {images} from './assets.mjs';

// Original frames remain the single art source and keep their alpha silhouettes.
// A frozen atlas is authored once after asset load (not recreated every frame).
// Rain's old elliptical wet highlight remains, quantized only by <= 1/64 step.
const TAU=Math.PI*2;
const WET_STEPS=64,WET_CACHE_CAPACITY=64;
const wetCache=new Map();
let frozenSource=null,frozenAtlas=null;

function surface(width,height){
 const canvas=typeof document!=='undefined'?document.createElement('canvas'):
  typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):null;
 if(!canvas)return null;
 canvas.width=width;canvas.height=height;
 const c=canvas.getContext('2d');
 return c?{canvas,c}:null;
}

export function getFrozenFoodAtlas(){
 return prewarmFoodArt()?frozenAtlas:null;
}

// Called during Renderer.initializeAssets(), outside the active flight loop.
// Frozen means a translucent cold/ice sheen, NOT snow piled on the fruit.
export function prewarmFoodArt(){
 const image=images.get('runtime-foods-0');
 if(!image)return false;
 if(frozenSource===image&&frozenAtlas)return true;
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
 if(!(w>0&&h>0))return false;
 const entry=surface(w,h);
 if(!entry)return false;
 const b=entry.c;
 b.drawImage(image,0,0,w,h);
 for(const frames of RUNTIME_ART.foods.frames)for(const rect of frames){
  const [x,y,tw,th]=rect;
  b.save();
  b.beginPath();b.rect(x,y,tw,th);b.clip();
  b.globalCompositeOperation='source-atop';
  b.globalAlpha=.29;b.fillStyle='#acd9f2';b.fillRect(x,y,tw,th);
  // Icy reflections follow the existing alpha: no detached snow cap.
  b.globalAlpha=.18;b.fillStyle='#f5fcff';b.beginPath();
  b.ellipse(x+tw*.69,y+th*.36,tw*.14,th*.29,-.31,0,TAU);b.fill();
  b.restore();
 }
 frozenSource=image;frozenAtlas=entry.canvas;
 wetCache.clear();
 return true;
}

// 64 surfaces = at most ~4 MiB of RGBA storage (plus browser overhead).
// Reuse the oldest canvas on misses, never allocate a return wrapper on hits.
function wetSurface(image,rect,slot,frame,wetStep){
 const key=(slot*4+frame)*(WET_STEPS+1)+wetStep;
 let entry=wetCache.get(key);
 if(entry){
  // Refresh LRU ordering; all pixel work happens only on a cache miss.
  wetCache.delete(key);wetCache.set(key,entry);
  return entry.canvas;
 }
 if(wetCache.size>=WET_CACHE_CAPACITY){
  const oldest=wetCache.keys().next().value;
  entry=wetCache.get(oldest);wetCache.delete(oldest);
 }else entry=surface(128,128);
 if(!entry)return null;
 const b=entry.c;
 b.clearRect(0,0,128,128);
 b.globalAlpha=1;b.globalCompositeOperation='source-over';
 b.drawImage(image,rect[0],rect[1],rect[2],rect[3],0,0,128,128);
 b.globalCompositeOperation='source-atop';
 b.fillStyle='#d2ecf5';b.globalAlpha=wetStep/WET_STEPS*.32;
 b.beginPath();b.ellipse(82,48,5,12,.35,0,TAU);b.fill();
 b.globalAlpha=1;b.globalCompositeOperation='source-over';
 wetCache.set(key,entry);
 return entry.canvas;
}

export function drawFood(c,variety,x,y,size=50,time=0,reduced=false,phase=0,snow=0,wet=0){
 const food=FOODS[variety];
 const image=images.get('runtime-foods-0');
 if(!food||!image)throw new Error('Required food atlas is unavailable');
 const frame=reduced?0:Math.floor(Math.max(0,time)*7+phase)%4;
 const rect=RUNTIME_ART.foods.frames[food.slot][frame];
 const half=size/2;
 // The frozen texture uses the same authored frame and alpha mask.
 if(snow>0&&prewarmFoodArt()){
  c.drawImage(frozenAtlas,rect[0],rect[1],rect[2],rect[3],x-half,y-half,size,size);
  return;
 }
 if(wet>0){
  const step=Math.max(1,Math.min(WET_STEPS,Math.round(Math.min(1,wet)*WET_STEPS)));
  const cached=wetSurface(image,rect,food.slot,frame,step);
  if(cached){c.drawImage(cached,x-half,y-half,size,size);return;}
 }
 c.drawImage(image,rect[0],rect[1],rect[2],rect[3],x-half,y-half,size,size);
}
