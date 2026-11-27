import {createArtSurface} from './art-surface.mjs';
import {WINTER_CAP_ART} from './winter-cap-data.mjs';
import {TREE_WIDTH} from './forest-geometry.mjs';
import {FOREST_ART} from './forest-art-data.mjs';
import {images} from './assets.mjs';
import {drawPackedSection} from './weather-art.mjs';
import {clipSnowReveal} from './winter-vfx.mjs';
import {PERF_AB_VARIANT} from './perf-ab.mjs';
import {activeProbe} from './perf-hooks.mjs';
import {PRECOMPOSED_SNOW_ACTIVE,PRECOMPOSED_SNOW_COMPACT_STAGES,PRECOMPOSED_SNOW_STAGE_CACHE,PRECOMPOSED_SNOW_STAGE_PREFETCH,precomposedSnowStage,winterCapFrame,winterCapKey,winterStageFrame,winterStageKey} from './precomposed-winter.mjs';

const WINTER_CAP_PAGE_ASSETS=Object.freeze(
 WINTER_CAP_ART.pages.map((_,page)=>`winter-cap:page-${page}`)
);
const WINTER_CAP_STAGE_ASSETS=Object.freeze(
 (WINTER_CAP_ART.stagePages||[]).map((p,stage)=>p?`winter-cap:stage-${stage}`:null)
);
const COMPACT_STAGE_PACKED_SCRATCH=[0,0,0,0,0];
function resolveWinterCapArt(c,kind,stage,variant){
 if(PRECOMPOSED_SNOW_COMPACT_STAGES){
  // Stage 15 for living trunks is supplied by the full-snow source atlas.
  if(stage===WINTER_CAP_ART.stages-1&&kind!=='special')return null;
  if(stage>0&&Number.isInteger(c.winterDisplayStage))stage=c.winterDisplayStage;
  const f=winterStageFrame(kind,stage,variant);
  if(!f)return null;
  COMPACT_STAGE_PACKED_SCRATCH[0]=stage;
  COMPACT_STAGE_PACKED_SCRATCH[1]=f[0];
  COMPACT_STAGE_PACKED_SCRATCH[2]=f[1];
  COMPACT_STAGE_PACKED_SCRATCH[3]=f[2];
  COMPACT_STAGE_PACKED_SCRATCH[4]=f[3];
  return {packed:COMPACT_STAGE_PACKED_SCRATCH,image:images.get(winterStageKey(stage))||null};
 }
 const packed=winterCapFrame(kind,stage,variant);
 return {packed,image:packed?images.get(winterCapKey(packed[0]))||null:null};
}

export const winterStageCacheMetrics={
 copies:0,
 predecodedHits:0,
 syncCopies:0,
 fallbacks:0,
 activeStage:null,
 activePage:null,
 onCopy:null,
 onPrefetch:null
};

let winterStageBands=null;
function getWinterStageBands(){
 if(winterStageBands)return winterStageBands;
 const bands=new Array(WINTER_CAP_ART.stages).fill(null);
 let maxWidth=0,maxHeight=0;
 const kinds=Object.keys(WINTER_CAP_ART.frames);
 for(let stage=0;stage<WINTER_CAP_ART.stages;stage++){
  let page=-1,minY=Infinity,maxY=-Infinity;
  for(let k=0;k<kinds.length;k++){
   const row=WINTER_CAP_ART.frames[kinds[k]][stage];
   if(!row)continue;
   for(let v=0;v<row.length;v++){
    const f=row[v];
    if(!f)continue;
    if(page!==-1&&page!==f[0]){
     throw new Error(`Estágio ${stage} ocupa mais de uma página`);
    }
    page=f[0];
    const pageInfo=WINTER_CAP_ART.pages[page];
    if(!pageInfo){
     throw new Error(`Página ${page} ausente no estágio ${stage}`);
    }
    if(
     f[1]<0||f[2]<0||f[3]<=0||f[4]<=0||
     f[1]+f[3]>pageInfo.width||f[2]+f[4]>pageInfo.height
    ){
     throw new Error(`Recorte fora dos limites no estágio ${stage} (${kinds[k]}:${v})`);
    }
    if(f[2]<minY)minY=f[2];
    if(f[2]+f[4]>maxY)maxY=f[2]+f[4];
   }
  }
  if(page<0)continue;
  const pageInfo=WINTER_CAP_ART.pages[page];
  const y=Math.max(0,minY-2);
  const bottom=Math.min(pageInfo.height,maxY+2);
  const width=pageInfo.width,height=bottom-y;
  if(width>maxWidth)maxWidth=width;
  if(height>maxHeight)maxHeight=height;
  bands[stage]=Object.freeze({page,y,width,height});
 }
 winterStageBands=Object.freeze({bands:Object.freeze(bands),maxWidth,maxHeight});
 return winterStageBands;
}

let activeWinterStageBuffer=null;
let prefetchedWinterStage=null;
let pendingWinterPrefetch=null;
let winterPrefetchToken=0;
let failedWinterPrefetch=new WeakMap();
export function resetWinterPrefetchFailures(){
 failedWinterPrefetch=new WeakMap();
}

async function prepareWinterStageBitmap(source,band){
 return await createImageBitmap(source,0,band.y,band.width,band.height);
}

function clearPrefetchedWinterStage(){
 if(prefetchedWinterStage?.bitmap){
  prefetchedWinterStage.bitmap.close?.();
 }
 prefetchedWinterStage=null;
}

function prefetchWinterStage(stage){
 if(!PRECOMPOSED_SNOW_STAGE_PREFETCH||typeof createImageBitmap!=='function')return;
 if(stage<=0||stage>=WINTER_CAP_ART.stages)return;
 const stageBands=getWinterStageBands();
 const band=stageBands.bands[stage];
 if(!band)return;
 const sourceImage=images.get(winterCapKey(band.page));
 if(!sourceImage||failedWinterPrefetch.get(sourceImage)?.has(stage))return;
 if(
  prefetchedWinterStage&&
  prefetchedWinterStage.stage===stage&&
  prefetchedWinterStage.page===band.page&&
  prefetchedWinterStage.source===sourceImage
 )return;
 if(
  pendingWinterPrefetch&&
  pendingWinterPrefetch.stage===stage&&
  pendingWinterPrefetch.page===band.page&&
  pendingWinterPrefetch.source===sourceImage
 )return;
 clearPrefetchedWinterStage();
 const token=++winterPrefetchToken;
 pendingWinterPrefetch={stage,page:band.page,source:sourceImage,token};
 winterStageCacheMetrics.onPrefetch?.({status:'started',stage,page:band.page});
 prepareWinterStageBitmap(sourceImage,band).then(bitmap=>{
  if(token!==winterPrefetchToken||!PRECOMPOSED_SNOW_STAGE_CACHE){
   bitmap.close?.();
   return;
  }
  if(activeWinterStageBuffer&&activeWinterStageBuffer.stage===stage&&activeWinterStageBuffer.source===sourceImage){
   pendingWinterPrefetch=null;
   bitmap.close?.();
   return;
  }
  pendingWinterPrefetch=null;
  winterStageCacheMetrics.onPrefetch?.({status:'ready',stage,page:band.page});
  clearPrefetchedWinterStage();
  prefetchedWinterStage={stage,page:band.page,source:sourceImage,bitmap,width:band.width,height:band.height};
 },error=>{
  if(token!==winterPrefetchToken)return;
  pendingWinterPrefetch=null;
  let failedStages=failedWinterPrefetch.get(sourceImage);
  if(!failedStages){failedStages=new Set();failedWinterPrefetch.set(sourceImage,failedStages);}
  failedStages.add(stage);
  winterStageCacheMetrics.onPrefetch?.({status:'failed',stage,page:band.page,error:error?.name??'Error'});
 });
}

function maybePrefetchFirstWinterStage(snow,precomposedLevel){
 if(!PRECOMPOSED_SNOW_STAGE_PREFETCH||precomposedLevel!==0||snow<=0)return;
 if(activeWinterStageBuffer&&activeWinterStageBuffer.stage===1)return;
 prefetchWinterStage(1);
}

function winterStageCache(stage,sourceImage,expectedPage,warmup=false){
 const stageBands=getWinterStageBands();
 const band=stageBands.bands[stage];
 if(!band||!sourceImage||(expectedPage!==undefined&&band.page!==expectedPage))return null;
 let buf=activeWinterStageBuffer;
 if(!buf){
  const surface=createArtSurface();
  if(!surface)return null;
  surface.width=stageBands.maxWidth;
  surface.height=stageBands.maxHeight;
  const oc=surface.getContext('2d');
  if(!oc)return null;
  buf=activeWinterStageBuffer={surface,oc,stage:-1,page:-1,source:null,y:0,width:0,height:0};
 }
 if(buf.stage!==stage||buf.source!==sourceImage){
  let predecodedBitmap=null;
  if(
   prefetchedWinterStage&&
   prefetchedWinterStage.stage===stage&&
   prefetchedWinterStage.page===band.page&&
   prefetchedWinterStage.source===sourceImage&&
   prefetchedWinterStage.width===band.width&&
   prefetchedWinterStage.height===band.height
  ){
   predecodedBitmap=prefetchedWinterStage.bitmap;
   prefetchedWinterStage=null;
  }
  const predecoded=!!predecodedBitmap;
  const probe=activeProbe;
  const measure=!warmup&&probe?.deep&&probe.currentFrame&&probe.game?.state==='playing';
  const copyAt=measure?probe.begin('winterCap.stageCacheCopy'):0;
  // Clear the full reusable surface so shorter bands (stage 15) never retain stale pixels.
  buf.oc.clearRect(0,0,buf.surface.width,buf.surface.height);
  if(predecodedBitmap){
   try{buf.oc.drawImage(predecodedBitmap,0,0);}
   finally{predecodedBitmap.close();}
  }else{
   buf.oc.drawImage(sourceImage,0,band.y,band.width,band.height,0,0,band.width,band.height);
  }
  buf.stage=stage;buf.page=band.page;buf.source=sourceImage;
  buf.y=band.y;buf.width=band.width;buf.height=band.height;
  winterStageCacheMetrics.copies++;
  if(predecoded)winterStageCacheMetrics.predecodedHits++;
  else winterStageCacheMetrics.syncCopies++;
  winterStageCacheMetrics.activeStage=stage;
  winterStageCacheMetrics.activePage=band.page;
  let copyMs=null;
  if(measure){
   copyMs=Math.round(probe.end('winterCap.stageCacheCopy',copyAt,{
    stage,page:band.page,width:band.width,height:band.height,predecoded
   })*100)/100;
   probe.event('winter-stage-cache-copy',{
    stage,page:band.page,width:band.width,height:band.height,predecoded,copyMs,
    rafTimestamp:probe.currentFrame.rafTimestamp
   });
  }
  winterStageCacheMetrics.onCopy?.({
   stage,page:band.page,width:band.width,height:band.height,predecoded,warmup,copyMs
  });
  prefetchWinterStage(stage+1);
 }
 return buf;
}

let lastCompactStage=-1;
function drawWinterCap(c,image,packed,dx,dy,dw,dh,kind,stage,variant){
 let source=image,sy=packed[2],usedStageCache=false,usedCompactStage=false;
 if(PRECOMPOSED_SNOW_COMPACT_STAGES){
  usedCompactStage=true;
  stage=packed[0];
  if(lastCompactStage!==stage){
   lastCompactStage=stage;
   winterStageCacheMetrics.copies++;
   winterStageCacheMetrics.predecodedHits++;
   winterStageCacheMetrics.activeStage=stage;
   winterStageCacheMetrics.activePage=stage;
   const probe=activeProbe;
   const measure=probe?.deep&&probe.currentFrame&&probe.game?.state==='playing';
   const details={
    stage,page:stage,
    width:image.naturalWidth||image.width,
    height:image.naturalHeight||image.height,
    predecoded:true,compact:true,warmup:false,copyMs:0
   };
   if(measure){
    probe.event('winter-stage-cache-copy',{
     ...details,
     rafTimestamp:probe.currentFrame.rafTimestamp
    });
   }
   winterStageCacheMetrics.onCopy?.(details);
  }
 }else if(PRECOMPOSED_SNOW_STAGE_CACHE){
  const cached=winterStageCache(stage,image,packed[0],false);
  const localY=cached?packed[2]-cached.y:-1;
  if(
   cached&&
   cached.page===packed[0]&&
   packed[1]>=0&&packed[1]+packed[3]<=cached.width&&
   localY>=0&&localY+packed[4]<=cached.height
  ){
   source=cached.surface;
   sy=localY;
   usedStageCache=true;
  }else{
   winterStageCacheMetrics.fallbacks++;
  }
 }
 const probe=activeProbe;
 if(probe?.deep&&probe.currentFrame&&probe.game?.state==='playing'){
  const page=packed[0];
  const asset=usedCompactStage
   ?(WINTER_CAP_STAGE_ASSETS[page]??`winter-cap:stage-${page}`)
   :(WINTER_CAP_PAGE_ASSETS[page]??`winter-cap:page-${page}`);
  if(!probe.firstDraws.has(asset)){
   const op='winterCap.firstDrawCpu';
   const details={page,kind,stage,variant,stageCache:usedStageCache,compactStage:usedCompactStage};
   const drawAt=probe.begin(op);
   c.drawImage(source,packed[1],sy,packed[3],packed[4],dx,dy,dw,dh);
   const drawCpuMs=probe.end(op,drawAt,details);
   probe.firstDraw(asset,drawCpuMs,details);
   return;
  }
 }
 c.drawImage(source,packed[1],sy,packed[3],packed[4],dx,dy,dw,dh);
}

function drawFullSnowTrunkCap(c,image,sx,sy,sw,sh,dx,dy,dw,dh,kind,variant){
 const probe=activeProbe;
 if(probe?.deep&&probe.currentFrame&&probe.game?.state==='playing'){
  const asset=kind==='upper'?'winter-cap:full-upper':'winter-cap:full-lower';
  if(!probe.firstDraws.has(asset)){
   const op='winterCap.firstDrawCpu';
   const details={kind,stage:WINTER_CAP_ART.stages-1,variant};
   const drawAt=probe.begin(op);
   c.drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh);
   const drawCpuMs=probe.end(op,drawAt,details);
   probe.firstDraw(asset,drawCpuMs,details);
   return;
  }
 }
 c.drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh);
}

// Repeat complete bark bands at the same scale as the authored cap.
// A reflected pair has matching edges at every join. Tiles and patterns are
// prepared once per source image/context, never rebuilt for each tree/frame.
const barkTiles=new WeakMap();
function barkTile(image,key,sx,sy,width,height,reverse){
 let entries=barkTiles.get(image);
 if(!entries){entries=new Map();barkTiles.set(image,entries);}
 if(entries.has(key))return entries.get(key);
 const canvas=createArtSurface();
 canvas.width=Math.ceil(width);canvas.height=height*2;
 const c=canvas.getContext('2d');
 for(let row=0;row<2;row++){
  const reflected=reverse?row===0:row===1;
  c.save();c.translate(0,row*height+(reflected?height:0));
  if(reflected)c.scale(1,-1);
  c.drawImage(image,sx,sy,width,height,0,0,canvas.width,height);
  c.restore();
 }
 const tile={canvas,width:canvas.width,height:canvas.height,patterns:new WeakMap()};
 entries.set(key,tile);return tile;
}
function fillBark(c,tile,x,join,width,scale,reach,upper){
 if(reach<=0)return;
 let pattern=tile.patterns.get(c);
 if(!pattern){pattern=c.createPattern(tile.canvas,'repeat');if(!pattern)throw Error('Unable to prepare tree bark');tile.patterns.set(c,pattern);}
 c.save();c.translate(x,join);
 c.scale(width/tile.width,upper?-scale:scale);
 c.fillStyle=pattern;
 // The half-pixel overlap lies underneath the unchanged cap.
 c.fillRect(0,-.5/scale,tile.width,(reach+.5)/scale);
 c.restore();
}
function livingBark(image,kind,index,f){
 const height=96,upper=kind==='upper',splice=upper?f.spliceY:f.spliceY-1;
 return barkTile(image,kind+'-'+index,f.rect[0]+f.core[0],f.rect[1]+(upper?splice:splice-height),
  f.core[1]-f.core[0],height,!upper);
}
const wetVariantCaps=new WeakMap();
function wetVariantCap(image){
 let canvas=wetVariantCaps.get(image);if(canvas)return canvas;
 canvas=createArtSurface();
 canvas.width=256;canvas.height=256;
 const c=canvas.getContext('2d');
 drawPackedSection(c,'wet','variants-0',0,0,256,256,0,0,256,256,{recordFirstDraw:false});
 c.globalCompositeOperation='destination-in';
 c.drawImage(image,0,0,256,256,0,0,256,256);
 wetVariantCaps.set(image,canvas);return canvas;
}
function variantBark(image,index){
 return barkTile(image,'variant-'+index,(index%2)*TREE_CELL+(TREE_CELL-TREE_CORE_WIDTH)/2,
  Math.floor(index/2)*TREE_CELL+TREE_SPLICES[index]-96,TREE_CORE_WIDTH,96,true);
}

const snowCapBuffers = new Map();
export const snowCapMetrics={rebuilds:0,hits:0,directDraws:0};

function cachedLivingSnowOverlay(kind, variantIdx, overlay, sx, sy, cx, sourceOffsetY, cw, sourceHeight, top, bottom, reveal) {
 if (typeof OffscreenCanvas === 'undefined' || typeof OffscreenCanvasRenderingContext2D === 'undefined') return null;
 const step = Math.round(reveal * 256);
 const key = `${kind}:${variantIdx}`;
 let entry = snowCapBuffers.get(key);
 if (!entry || entry.w !== cw || entry.h !== sourceHeight) {
  const surface = entry?.surface ?? createArtSurface(cw, sourceHeight);
  surface.width = cw; surface.height = sourceHeight;
  const oc = surface.getContext('2d');
  if (!oc) return null;
  entry = { surface, oc, w: cw, h: sourceHeight, step: -1, overlay: null };
  snowCapBuffers.set(key, entry);
 }
 if (entry.step !== step || entry.overlay !== overlay) {
  const oc = entry.oc;
  oc.clearRect(0, 0, cw, sourceHeight);
  oc.save();
  oc.translate(-(sx + cx), -(sy + sourceOffsetY));
  clipSnowReveal(oc, sx, sy + top, 512, bottom - top, reveal);
  oc.drawImage(overlay, sx + cx, sy + sourceOffsetY, cw, sourceHeight, sx + cx, sy + sourceOffsetY, cw, sourceHeight);
  oc.restore();
  entry.step = step;
  entry.overlay = overlay;
  snowCapMetrics.rebuilds++;
 }else snowCapMetrics.hits++;
 return entry.surface;
}

const variantSnowCapBuffers = new Map();
function cachedVariantSnowOverlay(index, snowImage, sx, sy, splice, snow) {
 if (typeof OffscreenCanvas === 'undefined' || typeof OffscreenCanvasRenderingContext2D === 'undefined') return null;
 const step = Math.round(Math.min(1, Math.max(0, snow)) * 256);
 let entry = variantSnowCapBuffers.get(index);
 if (!entry || entry.h !== splice) {
  const surface = entry?.surface ?? createArtSurface(TREE_CELL, splice);
  surface.width = TREE_CELL; surface.height = splice;
  const oc = surface.getContext('2d');
  if (!oc) return null;
  entry = { surface, oc, h: splice, step: -1, snowImage: null };
  variantSnowCapBuffers.set(index, entry);
 }
 if (entry.step !== step || entry.snowImage !== snowImage) {
  const oc = entry.oc;
  oc.clearRect(0, 0, TREE_CELL, splice);
  oc.save();
  clipSnowReveal(oc, 0, 0, TREE_CELL, splice, snow);
  oc.drawImage(snowImage, sx, sy, TREE_CELL, splice, 0, 0, TREE_CELL, splice);
  oc.restore();
  entry.step = step;
  entry.snowImage = snowImage;
  snowCapMetrics.rebuilds++;
 }else snowCapMetrics.hits++;
 return entry.surface;
}

// Caps, knots, branches and foliage retain the authored proportions.
export function drawLivingTrunk(c, {x, y, upper = false, width = TREE_WIDTH, length = 900, variant = 0, time = 0, snow = 0, rain = 0}) {
 const kind = upper ? 'upper' : 'lower';
 // Test C: draw a single complete authored tree state, not tree plus overlay.
 const treeSnow=PERF_AB_VARIANT==='snow-mask-off'?0:snow;
 const precomposedLevel=PRECOMPOSED_SNOW_ACTIVE?precomposedSnowStage(treeSnow):0;
 maybePrefetchFirstWinterStage(treeSnow,precomposedLevel);

 const fullSnow = treeSnow >= 1 - 1e-6 || (precomposedLevel>0&&c.winterDisplayStage===WINTER_CAP_ART.stages-1);
 const snowImg4 = fullSnow ? images.get(`trees-${kind}-snow-04`) : null;
 const image = snowImg4 || images.get(`trees-${kind}`);
 if (!image) return;

 const variantIdx=((variant % 4) + 4) % 4;
 const capArt=resolveWinterCapArt(c,kind,precomposedLevel,variantIdx);
 const packed=capArt?.packed??null;
 const capImage=capArt?.image??null;
 const f = FOREST_ART[kind][variantIdx], s = width / (f.core[1] - f.core[0]);
 const sx = f.rect[0], sy = f.rect[1], cx = f.content[0], cy = f.content[1], cw = f.content[2], ch = f.content[3];
 const px = x + (cx - f.anchor[0]) * s, py = y + (cy - f.anchor[1]) * s;
 const coreLeft = x + (f.core[0] - f.anchor[0]) * s;
 const barkImage=images.get(`trees-${kind}`);
 const bark=livingBark(barkImage,kind,variantIdx,f);
 const splice = upper ? f.spliceY : f.spliceY - 1;
 // Snow icicles may extend past original alpha bounds. Visual clip only.
 const snowyTipEnd=upper&&treeSnow>0?Math.max(f.endY,Math.min(512,f.endY+30)):f.endY;
 const join = y + (splice - f.anchor[1]) * s;

 if (upper) {
  const start = y - length;
  fillBark(c,bark,coreLeft,join,width,s,join-start,true);
  if(capImage)drawWinterCap(c,capImage,packed,px,join,packed[3]*s,packed[4]*s,kind,precomposedLevel,variantIdx);
  else if(snowImg4)drawFullSnowTrunkCap(c,image,sx+cx,sy+splice,cw,snowyTipEnd-splice,px,join,cw*s,(snowyTipEnd-splice)*s,kind,variantIdx);
  else c.drawImage(image,sx+cx,sy+splice,cw,snowyTipEnd-splice,px,join,cw*s,(snowyTipEnd-splice)*s);
 } else {
  const end = y + length;
  fillBark(c,bark,coreLeft,join,width,s,end-join,false);
  // Preserve the snow dome above the bare wood's y=20 content bound.
  const capTop=treeSnow>0?0:cy;
  if(capImage)drawWinterCap(c,capImage,packed,px,y-f.anchor[1]*s,packed[3]*s,packed[4]*s,kind,precomposedLevel,variantIdx);
  else if(snowImg4)drawFullSnowTrunkCap(c,image,sx+cx,sy+capTop,cw,splice-capTop,px,y+(capTop-f.anchor[1])*s,cw*s,(splice-capTop)*s,kind,variantIdx);
  else c.drawImage(image,sx+cx,sy+capTop,cw,splice-capTop,
   px,y+(capTop-f.anchor[1])*s,cw*s,(splice-capTop)*s);
 }

 // Restrained wet detail on existing bark, near the visible trunk cap.
 if(rain>0){c.save();c.globalAlpha=rain*.42;
  drawPackedSection(c,'wet',`${kind}-${variantIdx}`,cx,upper?splice:cy,cw,(upper?f.endY:splice)-(upper?splice:cy),px,upper?join:py,cw*s,((upper?f.endY:splice)-(upper?splice:cy))*s);c.restore();}

 // Reveal solid authored snow progressively over the exposed surface.
 // Only the visible branch/cap is coated; a suspended tree must never gain
 // snow along the trunk section attached to the ceiling.
 if(snow>0&&!fullSnow&&!capImage&&(!PRECOMPOSED_SNOW_ACTIVE||!!packed)&&PERF_AB_VARIANT!=='snow-mask-off'){
  const destY=upper?join:y-f.anchor[1]*s;
  const sourceY=sy+(upper?splice:0);
  const sourceHeight=upper?snowyTipEnd-splice:splice;
  if(PERF_AB_VARIANT==='legacy-snow-rebuild'){
   const overlay=snowOverlay(kind,snow);
   if(overlay)c.drawImage(overlay,sx+cx,sourceY,cw,sourceHeight,px,destY,cw*s,sourceHeight*s);
  }else{
   // Reuse the original art and reveal geometry with no mutable atlas per level.
   const overlay=images.get(`trees-${kind}-overlay-04`);
   if(overlay){
    const sourceX=sx+cx;
    const top=upper?f.spliceY:0;
    const bottom=upper?Math.min(512,f.endY+30):f.spliceY;
    const reveal=Math.round(Math.min(1,Math.max(0,snow))*256)/256;
    const cachedOverlay=PERF_AB_VARIANT==='baseline'?cachedLivingSnowOverlay(
     kind,variantIdx,overlay,sx,sy,cx,upper?splice:0,cw,sourceHeight,top,bottom,reveal
    ):null;
    if(cachedOverlay){
     c.drawImage(cachedOverlay,0,0,cw,sourceHeight,px,destY,cw*s,sourceHeight*s);
    }else{
     snowCapMetrics.directDraws++;
     c.save();c.translate(px-sourceX*s,destY-sourceY*s);c.scale(s,s);
     clipSnowReveal(c,sx,sy+top,512,bottom-top,reveal);
     c.drawImage(overlay,sourceX,sourceY,cw,sourceHeight,sourceX,sourceY,cw,sourceHeight);
     c.restore();
    }
   }
  }
 }

 // Ambient snow flurries shedding gently from upper tree branches in winter
 if (upper && snow > 0.15) {
  const shedFrame = Math.floor((time * 3 + variant * 1.5) % 6);
  c.save();c.globalAlpha=Math.min(1,(snow-.15)*1.25);
  drawPackedSection(c,'fx',`snow-${shedFrame}-${((variant%4)+4)%4}`,cx,splice,cw,f.endY-splice,px,join,cw*s,(f.endY-splice)*s);
  c.restore();
 }
}

// Four transparent 256 px cells. The cap and bark core use the same
// center and scale across variants, regardless of moss or leaf overhang.
const TREE_CELL = 256;
const TREE_CAP_Y = 8;
const TREE_CORE_WIDTH = 128;
const TREE_VARIANTS = Object.freeze(['rot', 'hollow', 'moss', 'vine']);
const TREE_VARIANT_INDEX = Object.freeze({rot: 0, hollow: 1, moss: 2, vine: 3});
const TREE_SPLICES = [181, 180, 180, 182];

export function drawTreeVariant(c, x, y, upper, kind, breakAge, snow = 0, rain = 0, time = 0, visibleReach = 1000) {
 const image = images.get('tree-variants');
 // Special upper trunks remain free of ceiling-attached snow.
 // Broken variants retain the original fracture sequence.
 const precomposedLevel=PRECOMPOSED_SNOW_ACTIVE&&!upper&&breakAge===undefined?precomposedSnowStage(snow):0;
 if(!upper&&breakAge===undefined)maybePrefetchFirstWinterStage(snow,precomposedLevel);
 const index = TREE_VARIANT_INDEX[kind] ?? -1;
 const capArt=resolveWinterCapArt(c,'special',precomposedLevel,index);
 const packed=capArt?.packed??null;
 const preparedVariant=capArt?.image??null;
 if (!image || index < 0) return;
 const sx = (index % 2) * TREE_CELL;
 const sy = Math.floor(index / 2) * TREE_CELL;
 const scale = TREE_WIDTH / TREE_CORE_WIDTH;
 const splice = TREE_SPLICES[index];
 const join = (splice - TREE_CAP_Y) * scale;
 const left = -TREE_CELL * scale / 2;

 c.save();
 c.translate(x, y);
 if (upper) c.scale(1, -1);
 if (breakAge === undefined || breakAge < .055) {
  // One cached pattern fill instead of a draw call per repeated band.
  const reach=Math.max(join,Math.min(1000,Number.isFinite(visibleReach)?visibleReach:1000));
  fillBark(c,variantBark(image,index),-TREE_WIDTH/2,join,TREE_WIDTH,scale,reach-join,false);
  if(preparedVariant){
   // Draw the snow above the original cap without moving the wood anchor.
   drawWinterCap(c,preparedVariant,packed,
    left,-TREE_CAP_Y*scale,TREE_CELL*scale,splice*scale,'special',precomposedLevel,index);
  }else c.drawImage(image,sx,sy+TREE_CAP_Y,TREE_CELL,splice-TREE_CAP_Y,
   left,0,TREE_CELL*scale,join);

  // Material highlight remains local to the cap; the WebP silhouette stays intact.
  if(rain>0&&breakAge===undefined)
   {c.save();c.globalAlpha=rain*.42;
    if(index===0)c.drawImage(wetVariantCap(image),0,TREE_CAP_Y,TREE_CELL,splice-TREE_CAP_Y,left,0,TREE_CELL*scale,join);
    else drawPackedSection(c,'wet',`variants-${index}`,0,TREE_CAP_Y,TREE_CELL,splice-TREE_CAP_Y,left,0,TREE_CELL*scale,join);
    c.restore();}

  // Snow variant transition
  if (snow > 0 && breakAge === undefined && !PRECOMPOSED_SNOW_ACTIVE && PERF_AB_VARIANT!=='snow-mask-off') {
   const snowImage = images.get('tree-variants-snow');
   if (snowImage) {
    // Keep the original snowy cut face, but do not tile the snowy bark
    // strip all the way to the ceiling: repeating it made vertical stripes.
    // Upper trunks are turned upside down. Mirroring this white cut-face
    // onto their underside would make snow adhere against gravity, so
    // falling crystals are handled separately by drawSnowContact().
    if (!upper) {
     const cachedOverlay = PERF_AB_VARIANT === 'baseline'
      ? cachedVariantSnowOverlay(index, snowImage, sx, sy, splice, snow) : null;
     if (cachedOverlay) {
      c.drawImage(cachedOverlay, 0, 0, TREE_CELL, splice, left, -TREE_CAP_Y * scale, TREE_CELL * scale, splice * scale);
     } else {
      snowCapMetrics.directDraws++;
      c.save();
      c.globalAlpha = 1;
      // Include the first 8px of cap snow while keeping the original wood anchor.
      clipSnowReveal(c,left,-TREE_CAP_Y*scale,TREE_CELL*scale,splice*scale,snow);
      c.drawImage(snowImage,sx,sy,TREE_CELL,splice,
       left,-TREE_CAP_Y*scale,TREE_CELL*scale,splice*scale);
      c.restore();
     }
    }
   }
  }

  if (breakAge !== undefined) {
   // Primary fracture fissure
   c.beginPath();
   c.moveTo(-9, 6);
   c.lineTo(2, 23);
   c.lineTo(-5, 39);
   c.lineTo(11, 57);
   c.lineTo(2, 83);
   c.strokeStyle = '#2b180e';
   c.lineWidth = 3.5;
   c.stroke();

   // Branching structural cracks radiating along wood grain
   c.beginPath();
   c.moveTo(2, 23);
   c.lineTo(-14, 30);
   c.lineTo(-22, 38);
   c.moveTo(-5, 39);
   c.lineTo(12, 44);
   c.lineTo(21, 56);
   c.moveTo(11, 57);
   c.lineTo(-3, 69);
   c.strokeStyle = '#3e2723';
   c.lineWidth = 1.8;
   c.stroke();

   // Inner highlighted split lip for 3D wood relief
   c.beginPath();
   c.moveTo(-8, 8);
   c.lineTo(3, 24);
   c.lineTo(-4, 40);
   c.lineTo(12, 58);
   c.strokeStyle = '#8d6e63';
   c.lineWidth = 1;
   c.stroke();
  }
 } else {
  const elapsed = breakAge - .055;
  c.globalAlpha *= Math.max(0, 1 - elapsed / .26);
  // Shared jagged edges preserve the whole painted cap at the start of
  // the break. Each piece rotates about its own center, with world gravity.
  const edges = [-TREE_CELL * scale / 2, -19, 19, TREE_CELL * scale / 2];
  for (let i = 0; i < 3; i++) {
   const direction = i - 1;
   const l = edges[i], r = edges[i + 1], center = (l + r) / 2;
   const fall = elapsed * 100 + 700 * elapsed * elapsed;
   c.save();
   c.translate(center + direction * elapsed * 115, join / 2 + (upper ? -fall : fall));
   c.rotate(direction * elapsed * 2);
   c.translate(-center, -join / 2);
   c.beginPath();
   c.moveTo(l, 0); c.lineTo(r, 0);
   c.lineTo(r + (i < 2 ? 6 : 0), join * .3);
   c.lineTo(r - (i < 2 ? 4 : 0), join * .65); c.lineTo(r, join);
   c.lineTo(l, join); c.lineTo(l - (i > 0 ? 4 : 0), join * .65);
   c.lineTo(l + (i > 0 ? 6 : 0), join * .3); c.closePath(); c.clip();
   c.drawImage(image, sx, sy + TREE_CAP_Y, TREE_CELL, splice - TREE_CAP_Y,
    left, 0, TREE_CELL * scale, join);
   c.restore();
  }

  // Estilhacos de madeira e farpas voadoras (wood splinters & flying debris)
  const isRot = kind === 'rot';
  const colors = isRot
   ? ['#2a180e', '#452b1a', '#6d4c33', '#3d522f', '#1f130b']
   : ['#3e2723', '#5d4037', '#8d6e63', '#a1887f', '#d7ccc8'];

  // Soft wood dust / decay smoke puff at impact epicenter
  if (elapsed < 0.16) {
   const dustAlpha = (1 - elapsed / 0.16) * 0.30;
   c.save();
   c.globalAlpha *= dustAlpha;
   c.fillStyle = isRot ? '#4a3b30' : '#8d7b68';
   for (let d = 0; d < 3; d++) {
    const dr = 6 + d * 5 + elapsed * 50;
    const dx = (-8 + d * 8) * (1 + elapsed * 1.5);
    const dy = (upper ? -1 : 1) * (28 + d * 9 + elapsed * 18);
    c.beginPath();
    c.arc(dx, dy, dr, 0, Math.PI * 2);
    c.fill();
   }
   c.restore();
  }

  // Shower of dynamic sharp wooden splinters, slivers and chips
  for (let i = 0; i < 15; i++) {
   const dir = (i % 2 === 0 ? 1 : -1);
   const speedX = 42 + (i * 23) % 78;
   const speedY = -28 + (i * 31) % 82;
   const gravity = 720;
   const sx = dir * speedX * elapsed;
   const sy = (upper ? -1 : 1) * (speedY * elapsed + gravity * elapsed * elapsed);
   const spin = dir * (4.5 + (i % 4) * 2.8) * elapsed;
   const len = 7 + (i % 5) * 3.2;
   const thick = 2.2 + (i % 3) * 1.2;
   const ox = -14 + (i * 13) % 28;
   const oy = 18 + (i * 17) % 52;

   c.save();
   c.translate(ox + sx, oy + sy);
   c.rotate(spin);
   c.fillStyle = colors[i % colors.length];
   c.beginPath();
   c.moveTo(-thick / 2, 0);
   c.lineTo(0, -len / 2);
   c.lineTo(thick / 2, 0);
   c.lineTo(0, len / 2);
   c.closePath();
   c.fill();
   c.restore();
  }
 }
 c.restore();
}

export function drawRefugeTree(c, r, support, time = 0, width = 215, footX = 7, snow = 0, rain = 0) {
 const f = FOREST_ART.lower[3], s = width / (f.core[1] - f.core[0]);
 const perch = f.perch;
 const rootX = r.x + footX - (perch[0] - f.anchor[0]) * s;
 const top = support - 4 - (perch[1] - f.anchor[1]) * s;
 drawLivingTrunk(c, {x: rootX, y: top, width, length: 900, variant: 3, time, snow, rain});
}

const snowMixBuffers=new Map();
export function warmWinterCapPage(context,page){
 if(!PRECOMPOSED_SNOW_ACTIVE||!context)return false;
 const img=images.get(PRECOMPOSED_SNOW_COMPACT_STAGES?winterStageKey(page):winterCapKey(page));
 if(!img)return false;
 context.save();
 context.setTransform(1,0,0,1,0,0);
 context.globalAlpha=.004;
 context.drawImage(img,2,2,20,20,0,0,1,1);
 context.restore();
 return true;
}
export function prepareTreeWeather(context,options={}){
 const skipWinterCapGpuWarmup=options?.skipWinterCapGpuWarmup===true;
 const warmPattern=(pattern)=>{
  if(!context||!pattern)return;
  context.save();
  context.setTransform(1,0,0,1,0,0);
  context.globalAlpha=.004;
  context.fillStyle=pattern;
  context.fillRect(0,0,1,1);
  context.restore();
 };
 for(const kind of ['lower','upper']){
  if(PERF_AB_VARIANT==='legacy-snow-rebuild')snowOverlay(kind,0);
  const image=images.get('trees-'+kind);
  if(image)FOREST_ART[kind].forEach((f,index)=>{
   const tile=livingBark(image,kind,index,f);
   if(context){
    const pattern=context.createPattern(tile.canvas,'repeat');
    tile.patterns.set(context,pattern);
    warmPattern(pattern);
   }
  });
 }
 // Validate bands and warm only the compact active-stage surface in the
 // experimental stage-cache variant; control keeps warming all pages unless deferred.
 if(PRECOMPOSED_SNOW_COMPACT_STAGES){
  if(context&&!skipWinterCapGpuWarmup){
   for(const page of WINTER_CAP_ART.stagePages||[]){
    if(page)warmWinterCapPage(context,page.stage);
   }
  }
 }else if(PRECOMPOSED_SNOW_STAGE_CACHE){
  const stageBands=getWinterStageBands();
  const firstBand=stageBands.bands[1];
  const firstImage=firstBand?images.get(winterCapKey(firstBand.page)):null;
  const cached=firstImage?winterStageCache(1,firstImage,firstBand.page,true):null;
  if(cached&&context){
   context.save();
   context.drawImage(cached.surface,2,2,20,20,0,0,1,1);
   context.restore();
  }
 }else if(PRECOMPOSED_SNOW_ACTIVE&&context&&!skipWinterCapGpuWarmup){
  context.save();
  for(let page=0;page<WINTER_CAP_ART.pages.length;page++){
   const img=images.get(winterCapKey(page));
   if(img)context.drawImage(img,2,2,20,20,0,0,1,1);
  }
  context.restore();
 }
 const image=images.get('tree-variants');
 if(image)wetVariantCap(image);
 if(image)for(let index=0;index<4;index++){
  const tile=variantBark(image,index);
  if(context){
   const pattern=context.createPattern(tile.canvas,'repeat');
   tile.patterns.set(context,pattern);
   warmPattern(pattern);
  }
 }
}
function snowOverlay(kind,amount){
 if(PERF_AB_VARIANT==='snow-mask-off')return null;
 amount=Math.round(Math.min(1,Math.max(0,amount))*256)/256;
 const image=images.get(`trees-${kind}-overlay-04`);
 if(!image)return null;
 let buffer=snowMixBuffers.get(kind);
 if(!buffer){
  const canvas=createArtSurface();
  // Without a canvas, skip partial cover rather than show full winter at entry.
  if(!canvas)return amount>=1?image:null;
  canvas.width=1024;canvas.height=1024;buffer={canvas,c:canvas.getContext('2d'),amount:-1,image};snowMixBuffers.set(kind,buffer);
 }
 // One shared surface per orientation, rebuilt only when coverage changes.
 // The final overlay retains authored opacity, shading and antialiased edges.
 if(buffer.amount!==amount||buffer.image!==image){
  const probe=activeProbe,started=probe?probe.begin('render.snowMaskRebuild'):0;
  const c=buffer.c;c.clearRect(0,0,1024,1024);
  c.save();c.globalAlpha=1;c.globalCompositeOperation='source-over';
  for(const f of FOREST_ART[kind]){
   const [sx,sy]=f.rect;
   const top=kind==='upper'?f.spliceY:0;
   const bottom=kind==='upper'?Math.min(512,f.endY+30):f.spliceY;
   c.save();clipSnowReveal(c,sx,sy+top,512,bottom-top,amount);
   c.drawImage(image,sx,sy+top,512,bottom-top,sx,sy+top,512,bottom-top);
   c.restore();
  }
  c.restore();buffer.amount=amount;buffer.image=image;
  if(probe)probe.end('render.snowMaskRebuild',started,{kind,amount,maskPixels:1024*1024});
 }
 return buffer.canvas;
}
