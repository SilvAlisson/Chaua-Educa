import {TREE_WIDTH} from './forest-geometry.mjs';
import {FOREST_ART} from './forest-art-data.mjs';
import {images} from './assets.mjs';
import {drawPackedSection} from './weather-art.mjs';
import {clipSnowReveal} from './winter-vfx.mjs';
import {PERF_AB_VARIANT} from './perf-ab.mjs';
import {activeProbe} from './perf-hooks.mjs';
import {PRECOMPOSED_SNOW_ACTIVE,precomposedSnowStage,precomposedAssetKey} from './precomposed-winter.mjs';


// Repeat complete bark bands at the same scale as the authored cap.
// A reflected pair has matching edges at every join. Tiles and patterns are
// prepared once per source image/context, never rebuilt for each tree/frame.
const barkTiles=new WeakMap();
function barkTile(image,key,sx,sy,width,height,reverse){
 let entries=barkTiles.get(image);
 if(!entries){entries=new Map();barkTiles.set(image,entries);}
 if(entries.has(key))return entries.get(key);
 const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(Math.ceil(width),height*2):document.createElement('canvas');
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
 canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(256,256):document.createElement('canvas');
 canvas.width=256;canvas.height=256;
 const c=canvas.getContext('2d');
 drawPackedSection(c,'wet','variants-0',0,0,256,256,0,0,256,256);
 c.globalCompositeOperation='destination-in';
 c.drawImage(image,0,0,256,256,0,0,256,256);
 wetVariantCaps.set(image,canvas);return canvas;
}
function variantBark(image,index){
 return barkTile(image,'variant-'+index,(index%2)*TREE_CELL+(TREE_CELL-TREE_CORE_WIDTH)/2,
  Math.floor(index/2)*TREE_CELL+TREE_SPLICES[index]-96,TREE_CORE_WIDTH,96,true);
}

// Caps, knots, branches and foliage retain the authored proportions.
export function drawLivingTrunk(c, {x, y, upper = false, width = TREE_WIDTH, length = 900, variant = 0, time = 0, snow = 0, rain = 0}) {
 const kind = upper ? 'upper' : 'lower';
 // Test C: draw a single complete authored tree state, not tree plus overlay.
 const treeSnow=PERF_AB_VARIANT==='snow-mask-off'?0:snow;
 const precomposedLevel=PRECOMPOSED_SNOW_ACTIVE?precomposedSnowStage(treeSnow):0;
 const preparedImage=precomposedLevel>0?images.get(precomposedAssetKey(kind,precomposedLevel)):null;
 const fullSnow = treeSnow >= 1 - 1e-6;
 const snowImg4 = fullSnow ? images.get(`trees-${kind}-snow-04`) : null;
 const image = (PRECOMPOSED_SNOW_ACTIVE?preparedImage:null) || snowImg4 || images.get(`trees-${kind}`);
 if (!image) return;

 const f = FOREST_ART[kind][((variant % 4) + 4) % 4], s = width / (f.core[1] - f.core[0]);
 const sx = f.rect[0], sy = f.rect[1], cx = f.content[0], cy = f.content[1], cw = f.content[2], ch = f.content[3];
 const px = x + (cx - f.anchor[0]) * s, py = y + (cy - f.anchor[1]) * s;
 const coreLeft = x + (f.core[0] - f.anchor[0]) * s;
 const barkImage=images.get(`trees-${kind}`);
 const bark=livingBark(barkImage,kind,((variant%4)+4)%4,f);
 const splice = upper ? f.spliceY : f.spliceY - 1;
 // Snow icicles may extend past original alpha bounds. Visual clip only.
 const snowyTipEnd=upper&&treeSnow>0?Math.max(f.endY,Math.min(512,f.endY+30)):f.endY;
 const join = y + (splice - f.anchor[1]) * s;
 if (upper) {
  const start = y - length;
  fillBark(c,bark,coreLeft,join,width,s,join-start,true);
  c.drawImage(image, sx + cx, sy + splice, cw, snowyTipEnd - splice, px, join, cw * s, (snowyTipEnd - splice) * s);
 } else {
  const end = y + length;
  fillBark(c,bark,coreLeft,join,width,s,end-join,false);
  // Preserve the snow dome above the bare wood's y=20 content bound.
  const capTop=treeSnow>0?0:cy;
  c.drawImage(image,sx+cx,sy+capTop,cw,splice-capTop,
   px,y+(capTop-f.anchor[1])*s,cw*s,(splice-capTop)*s);
 }

 // Restrained wet detail on existing bark, near the visible trunk cap.
 if(rain>0){c.save();c.globalAlpha=rain*.42;
  drawPackedSection(c,'wet',`${kind}-${((variant%4)+4)%4}`,cx,upper?splice:cy,cw,(upper?f.endY:splice)-(upper?splice:cy),px,upper?join:py,cw*s,((upper?f.endY:splice)-(upper?splice:cy))*s);c.restore();}

 // Reveal solid authored snow progressively over the exposed surface.
 // Only the visible branch/cap is coated; a suspended tree must never gain
 // snow along the trunk section attached to the ceiling.
 if(snow>0&&!fullSnow&&!PRECOMPOSED_SNOW_ACTIVE&&PERF_AB_VARIANT!=='snow-mask-off'){
  const overlay=snowOverlay(kind,snow);
  if(overlay){
   if(upper)c.drawImage(overlay,sx+cx,sy+splice,cw,snowyTipEnd-splice,px,join,cw*s,(snowyTipEnd-splice)*s);
   else c.drawImage(overlay,sx+cx,sy,cw,splice,px,y-f.anchor[1]*s,cw*s,splice*s);
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
 const preparedVariant=precomposedLevel>0?images.get(precomposedAssetKey('special',precomposedLevel)):null;
 const intactImage=preparedVariant||image;
 const index = TREE_VARIANT_INDEX[kind] ?? -1;
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
  c.drawImage(image, sx, sy + TREE_CAP_Y, TREE_CELL, splice - TREE_CAP_Y,
   left, 0, TREE_CELL * scale, join);

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
    c.save();
    c.globalAlpha = 1;
    // Keep the original snowy cut face, but do not tile the snowy bark
    // strip all the way to the ceiling: repeating it made vertical stripes.
    // Upper trunks are turned upside down. Mirroring this white cut-face
    // onto their underside would make snow adhere against gravity, so
    // falling crystals are handled separately by drawSnowContact().
    if (!upper) {
     // Include the first 8px of cap snow while keeping the original wood anchor.
     clipSnowReveal(c,left,-TREE_CAP_Y*scale,TREE_CELL*scale,splice*scale,snow);
     c.drawImage(snowImage,sx,sy,TREE_CELL,splice,
      left,-TREE_CAP_Y*scale,TREE_CELL*scale,splice*scale);
    }
    c.restore();
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
   if(preparedVariant){
    // Include the original snowy lip above the 8px bare cap anchor.
    c.drawImage(intactImage,sx,sy,TREE_CELL,splice,
     left,-TREE_CAP_Y*scale,TREE_CELL*scale,splice*scale);
   }else c.drawImage(intactImage, sx, sy + TREE_CAP_Y, TREE_CELL, splice - TREE_CAP_Y,
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
export function prepareTreeWeather(context){
 for(const kind of ['lower','upper']){
  if(!PRECOMPOSED_SNOW_ACTIVE)snowOverlay(kind,0);
  const image=images.get('trees-'+kind);
  if(image)FOREST_ART[kind].forEach((f,index)=>{
   const tile=livingBark(image,kind,index,f);
   if(context)tile.patterns.set(context,context.createPattern(tile.canvas,'repeat'));
  });
 }
 // Warm each prepared sheet before gameplay: avoid texture upload during flight.
 if(PRECOMPOSED_SNOW_ACTIVE&&context){
  context.save();
  for(const kind of ['lower','upper','special'])for(let stage=1;stage<=15;stage++){
   const img=images.get(precomposedAssetKey(kind,stage));
   if(img)context.drawImage(img,100,100,20,20,0,0,1,1);
  }
  context.restore();
 }
 const image=images.get('tree-variants');
 if(image)wetVariantCap(image);
 if(image)for(let index=0;index<4;index++){
  const tile=variantBark(image,index);
  if(context)tile.patterns.set(context,context.createPattern(tile.canvas,'repeat'));
 }
}
function snowOverlay(kind,amount){
 if(PERF_AB_VARIANT==='snow-mask-off')return null;
 amount=Math.round(Math.min(1,Math.max(0,amount))*256)/256;
 const image=images.get(`trees-${kind}-overlay-04`);
 if(!image)return null;
 let buffer=snowMixBuffers.get(kind);
 if(!buffer){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1024,1024):typeof document!=='undefined'?document.createElement('canvas'):null;
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
