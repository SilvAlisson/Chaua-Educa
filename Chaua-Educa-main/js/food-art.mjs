import {FOODS} from './foods.mjs';
import {RUNTIME_ART} from './runtime-art-data.mjs';
import {images} from './assets.mjs';

let weatherBuffer;
export function drawFood(c,variety,x,y,size=50,time=0,reduced=false,phase=0,snow=0,wet=0){
 const food=FOODS[variety];
 const image=images.get('runtime-foods-0');
 if(!food||!image)throw new Error('Required food atlas is unavailable');
 const frame=reduced?0:Math.floor(Math.max(0,time)*7+phase)%4;
 const rect=RUNTIME_ART.foods.frames[food.slot][frame];
 if(snow>0||wet>0){
  if(!weatherBuffer){
   const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(128,128):document.createElement('canvas');
   canvas.width=128;canvas.height=128;weatherBuffer={canvas,c:canvas.getContext('2d')};
  }
  const b=weatherBuffer.c;b.clearRect(0,0,128,128);b.globalCompositeOperation='source-over';b.globalAlpha=1;
  b.drawImage(image,rect[0],rect[1],rect[2],rect[3],0,0,128,128);
  // source-atop clips snow/moisture to THIS food's own alpha silhouette,
  // never a detached white cap over a petal, seed or leaf.
  b.globalCompositeOperation='source-atop';
  if(snow>0){b.fillStyle=`rgba(245,250,255,${Math.min(.85,snow)})`;b.beginPath();b.ellipse(64,22,45,12,0,0,Math.PI*2);b.fill();}
  if(wet>0){b.fillStyle=`rgba(210,236,245,${wet*.32})`;b.beginPath();b.ellipse(82,48,5,12,.35,0,Math.PI*2);b.fill();}
  b.globalCompositeOperation='source-over';c.drawImage(weatherBuffer.canvas,x-size/2,y-size/2,size,size);
 }else c.drawImage(image,rect[0],rect[1],rect[2],rect[3],x-size/2,y-size/2,size,size);
}
