import {SNAKE_WRAP} from './snake-wrap-data.mjs';
import {tailTipSwing} from './secondary-motion.mjs';
// Exact existing source pixels, locally bent only at the terminal left curl.
// 17 small precomputed poses: no per-frame mesh raster or synthetic tail art.
const TIP={x:0,y:190,w:68,h:87,pad:5};
const STEPS=8;
let prepared=null;
function makeSurface(w,h){
    if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);
    if(typeof document==='undefined')return null;
    const c=document.createElement('canvas');c.width=w;c.height=h;return c;
}
function build(image){
    if(prepared?.image===image)return prepared;
    if(image.width!==384||image.height!==302)return null;
    const fixed=makeSurface(384,302);if(!fixed)return null;
    const ctx=fixed.getContext('2d');if(!ctx)return null;
    ctx.drawImage(image,0,0);
    ctx.clearRect(TIP.x,TIP.y,TIP.w,TIP.h);
    const frames=[];
    for(let step=-STEPS;step<=STEPS;step++){
        const frame=makeSurface(TIP.w,TIP.h+TIP.pad*2);
        if(!frame)return null;
        const c=frame.getContext('2d');if(!c)return null;
        const wave=step/STEPS;
        for(let x=0;x<TIP.w;x+=4){
            const strip=Math.min(4,TIP.w-x);
            const free=1-(x+strip/2)/TIP.w;
            const dy=wave*3.1*free*free;
            c.drawImage(image,x,TIP.y,strip,TIP.h,x,TIP.pad+dy,strip,TIP.h);
        }
        frames.push(frame);
    }
    prepared={image,fixed,frames};
    return prepared;
}
export function drawSnakeWrap(c,image,snake,reduced=false){
    if(!image)return;
    const left=-SNAKE_WRAP.worldWidth/2,top=-8;
    const width=SNAKE_WRAP.worldWidth,height=SNAKE_WRAP.worldHeight;
    const sway=tailTipSwing(snake,reduced);
    // Original, byte-identical path for motion-reduction and exact rest.
    if(reduced||Math.abs(sway)<.015){
        c.drawImage(image,left,top,width,height);return;
    }
    const cache=build(image);
    if(!cache){c.drawImage(image,left,top,width,height);return;}
    c.drawImage(cache.fixed,left,top,width,height);
    const step=Math.min(STEPS*2,Math.max(0,Math.round((sway+1)*STEPS)));
    c.drawImage(cache.frames[step],left+TIP.x/384*width,
        top+(TIP.y-TIP.pad)/302*height,
        TIP.w/384*width,(TIP.h+TIP.pad*2)/302*height);
}
