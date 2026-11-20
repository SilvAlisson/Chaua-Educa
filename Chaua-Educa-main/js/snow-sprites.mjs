// Fixed, source-aligned snow sprites, prepared ONCE before a flight.
// Generated AI mockups have imperfect registration/transparency, so the
// approved WebP and FOREST_ART coordinates are authoritative.
//
// Each level has an opaque base sprite plus a sparse incremental DELTA sprite
// for the next step. This retains all previously accumulated opaque snow.
// Premultiplied color math ensures base+delta -> next exact stage at alpha=1.
import {images} from './assets.mjs';
import {FOREST_ART} from './forest-art-data.mjs';
import {clipSnowReveal} from './winter-vfx.mjs';

export const SNOW_FRAMES=16;
const FRAMES_PER_PAGE=8,RASTER_SCALE=.75,PAD=2;
const atlases=new Map();
export const snowSpriteMetrics={
 generated:0,buildMs:0,draws:0,estimatedBytes:0,ready:false,
 deltaPixels:0,nonMonotonePixels:0
};
function newCanvas(width,height){
 const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):
  typeof document!=='undefined'?document.createElement('canvas'):null;
 if(!canvas)return null;
 canvas.width=width;canvas.height=height;
 return canvas;
}
function geometry(f,upper){
 const [sx,sy]=f.rect,cx=f.content[0],cw=f.content[2];
 const top=upper?f.spliceY:0;
 const bottom=upper?Math.min(512,f.endY+30):f.spliceY;
 const capY=upper?f.spliceY:0;
 const capH=upper?bottom-f.spliceY:f.spliceY;
 return {sourceX:sx+cx,sourceY:sy+capY,cw,capH,
  clipX:sx,clipY:sy+top,clipH:bottom-top};
}
function frameRect(a,variant,step){
 const frame=step-1,page=Math.floor(frame/FRAMES_PER_PAGE),row=frame%FRAMES_PER_PAGE;
 const g=a.info[variant];
 return {canvas:a.pages[page],x:variant*a.strideX+PAD,y:row*a.strideY+PAD,
  w:Math.ceil(g.cw*a.scale),h:Math.ceil(g.capH*a.scale)};
}
function readStage(a,variant,step){
 const rect=frameRect(a,variant,step);
 const ctx=rect.canvas.getContext('2d');
 if(typeof ctx?.getImageData!=='function')return null;
 const pixels=ctx.getImageData(rect.x,rect.y,rect.w,rect.h);
 return pixels?.data&&Number.isFinite(pixels.width)&&
  Number.isFinite(pixels.height)?pixels:null;
}
function createDelta(ctx,low,hi){
 const w=hi.width,h=hi.height,data=ctx.createImageData(w,h);
 let minX=w,minY=h,maxX=-1,maxY=-1,nonMonotone=0;
 const ld=low?.data,hd=hi.data,d=data.data;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,al=(ld?ld[i+3]:0)/255,ah=hd[i+3]/255;
  if(ah+1/255<al)nonMonotone++;
  if(ah<=al||al>=1)continue;
  const ad=Math.min(1,(ah-al)/(1-al));
  const target=ad*255;
  if(target<.3)continue;
  const loss=(1-ad)*al,comp=ah;
  d[i+3]=Math.round(target);
  for(let c=0;c<3;c++){
   const oldColor=ld?ld[i+c]:0;
   // Source-over inversion: next = delta over previous.
   d[i+c]=Math.max(0,Math.min(255,Math.round((hd[i+c]*comp-oldColor*loss)/ad)));
  }
  if(x<minX)minX=x;if(y<minY)minY=y;
  if(x>maxX)maxX=x;if(y>maxY)maxY=y;
 }
 return {data,minX,minY,maxX,maxY,nonMonotone};
}
function prepareDeltas(a){
 const work=newCanvas(a.strideX*4,a.strideY);
 const workCtx=work?.getContext('2d',{willReadFrequently:true});
 // Some non-browser render unit tests provide a drawing-only Canvas fake.
 // Their fallback renderer must remain supported without pretending that
 // stubbed getImageData/createImageData can decode sprite pixels.
 if(!workCtx||typeof workCtx.createImageData!=='function')return false;
 const pending=[];let sumHeight=0;
 for(let step=1;step<=SNOW_FRAMES;step++){
  let rowHeight=0;const variants=[];
  for(let variant=0;variant<4;variant++){
   const low=step===1?null:readStage(a,variant,step-1);
   const hi=readStage(a,variant,step);
   if(!hi||(step>1&&!low))return false;
   const delta=createDelta(workCtx,low,hi);
   rowHeight=Math.max(rowHeight,delta.maxY>=delta.minY?delta.maxY-delta.minY+1:0);
   variants.push(delta);
   snowSpriteMetrics.nonMonotonePixels+=delta.nonMonotone;
  }
  pending.push({variants,y:sumHeight});
  sumHeight+=rowHeight+PAD*2;
 }
 const canvas=newCanvas(a.strideX*4,Math.max(1,sumHeight));
 if(!canvas)return false;
 const c=canvas.getContext('2d');
 if(!c)return false;
 const boxes=[];
 for(let step=1;step<=SNOW_FRAMES;step++){
  const entry=pending[step-1],rects=[];
  for(let variant=0;variant<4;variant++){
   const v=entry.variants[variant],w=v.maxX-v.minX+1,h=v.maxY-v.minY+1;
   if(w<=0||h<=0){rects.push(null);continue;}
   const out=c.createImageData(w,h);
   for(let row=0;row<h;row++){
    const srcOffset=((row+v.minY)*v.data.width+v.minX)*4;
    const dstOffset=row*w*4;
    out.data.set(v.data.data.subarray(srcOffset,srcOffset+w*4),dstOffset);
   }
   const x=variant*a.strideX+PAD,y=entry.y+PAD;
   c.putImageData(out,x,y);
   rects.push({x,y,w,h,offsetX:v.minX,offsetY:v.minY});
   snowSpriteMetrics.deltaPixels+=w*h;
  }
  boxes.push(rects);
 }
 a.delta={canvas,boxes};
 snowSpriteMetrics.estimatedBytes+=canvas.width*canvas.height*4;
 return true;
}
export function prepareSnowSprites(){
 if(snowSpriteMetrics.ready)return true;
 if(typeof performance==='undefined')return false;
 const started=performance.now();
 const pending=[];
 let totalBytes=0;
 for(const kind of ['lower','upper']){
  const image=images.get('trees-'+kind+'-overlay-04');if(!image)return false;
  const upper=kind==='upper',info=FOREST_ART[kind].map(f=>geometry(f,upper));
  const width=Math.ceil(Math.max(...info.map(v=>v.cw))*RASTER_SCALE);
  const height=Math.ceil(Math.max(...info.map(v=>v.capH))*RASTER_SCALE);
  const strideX=width+PAD*2,strideY=height+PAD*2;
  const pages=[];
  for(let page=0;page<Math.ceil(SNOW_FRAMES/FRAMES_PER_PAGE);page++){
   const canvas=newCanvas(strideX*4,strideY*FRAMES_PER_PAGE);
   if(!canvas)return false;
   const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)return false;
   c.imageSmoothingEnabled=true;
   for(let row=0;row<FRAMES_PER_PAGE;row++){
    const level=(page*FRAMES_PER_PAGE+row+1)/SNOW_FRAMES;
    for(let variant=0;variant<4;variant++){
     const g=info[variant];
     const x=variant*strideX+PAD,y=row*strideY+PAD;
     c.save();c.translate(x-g.sourceX*RASTER_SCALE,y-g.sourceY*RASTER_SCALE);
     c.scale(RASTER_SCALE,RASTER_SCALE);
     clipSnowReveal(c,g.clipX,g.clipY,512,g.clipH,level);
     c.drawImage(image,g.sourceX,g.sourceY,g.cw,g.capH,
      g.sourceX,g.sourceY,g.cw,g.capH);
     c.restore();
    }
   }
   totalBytes+=canvas.width*canvas.height*4;
   pages.push(canvas);
  }
  const atlas={image,pages,info,strideX,strideY,scale:RASTER_SCALE};
  if(!prepareDeltas(atlas))return false;
  pending.push([kind,atlas]);
 }
 for(const [kind,a] of pending)atlases.set(kind,a);
 snowSpriteMetrics.generated=SNOW_FRAMES*4*2;
 snowSpriteMetrics.estimatedBytes+=totalBytes;
 snowSpriteMetrics.buildMs=Math.round((performance.now()-started)*100)/100;
 snowSpriteMetrics.ready=true;
 return true;
}
function drawStage(c,a,variant,stage,dx,dy,dw,dh){
 const f=frameRect(a,variant,stage);
 c.drawImage(f.canvas,f.x,f.y,f.w,f.h,dx,dy,dw,dh);
 snowSpriteMetrics.draws++;
}
function drawDelta(c,a,variant,stage,fraction,dx,dy,dw,dh){
 const box=a.delta?.boxes[stage-1]?.[variant];if(!box)return;
 const g=a.info[variant],baseW=Math.ceil(g.cw*a.scale),baseH=Math.ceil(g.capH*a.scale);
 c.save();c.globalAlpha*=fraction;
 c.drawImage(a.delta.canvas,box.x,box.y,box.w,box.h,
  dx+box.offsetX/baseW*dw,dy+box.offsetY/baseH*dh,
  box.w/baseW*dw,box.h/baseH*dh);
 c.restore();snowSpriteMetrics.draws++;
}
export function drawSnowSprites(c,kind,variant,snow,dx,dy,dw,dh){
 const atlas=atlases.get(kind);
 if(!atlas||atlas.image!==images.get('trees-'+kind+'-overlay-04'))return false;
 // Match the established 1/256 coverage quantization used by
 // clipSnowReveal. Very small floating-point differences either side of
 // a sprite boundary must not cause a discontinuous Canvas image switch.
 const coverage=Math.round(Math.min(1,Math.max(0,snow))*256)/256;
 const v=coverage*SNOW_FRAMES;
 const lower=Math.floor(v),fraction=v-lower;
 if(lower>0)drawStage(c,atlas,variant,lower,dx,dy,dw,dh);
 if(fraction>.00001&&lower<SNOW_FRAMES)
  drawDelta(c,atlas,variant,lower+1,fraction,dx,dy,dw,dh);
 return true;
}
// Countdown-only GPU prewarm. Draw the actual texture, not a transparent
// corner pixel, and cover it with the normal background in the same frame.
export function warmupSnowSpriteTexture(c,index){
 const pages=[...(atlases.get('lower')?.pages||[]),
  ...(atlases.get('upper')?.pages||[]),
  atlases.get('lower')?.delta?.canvas,atlases.get('upper')?.delta?.canvas].filter(Boolean);
 const source=pages[index];if(!source)return false;
 c.save();c.setTransform(1,0,0,1,0,0);
 c.drawImage(source,0,0,source.width,source.height,0,0,3,3);
 c.restore();
 return true;
}
export const SNOW_GPU_PAGES=6;
