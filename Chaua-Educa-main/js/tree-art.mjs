import {TREE_WIDTH} from './forest-geometry.mjs';
import {FOREST_ART} from './forest-art-data.mjs';
import {images} from './assets.mjs';

// Source sprites retain their authored proportions. Only an undecorated bark
// strip extends toward the viewport edge; caps, knots and leaves never stretch.
export function drawLivingTrunk(c,{x,y,upper=false,width=TREE_WIDTH,length=900,variant=0}){
 const kind=upper?'upper':'lower',image=images.get(`trees-${kind}`);if(!image)return;
 const f=FOREST_ART[kind][((variant%4)+4)%4],s=width/(f.core[1]-f.core[0]);
 const [sx,sy]=f.rect,[cx,cy,cw,ch]=f.content;
 const px=x+(cx-f.anchor[0])*s,py=y+(cy-f.anchor[1])*s;
 const coreLeft=x+(f.core[0]-f.anchor[0])*s;
 const stripLeft=f.core[0],stripWidth=f.core[1]-f.core[0];
 const splice=upper?f.spliceY:f.spliceY-1;
 const join=y+(splice-f.anchor[1])*s;
 if(upper){
  const start=y-length;
  if(join>start)c.drawImage(image,sx+stripLeft,sy+splice,stripWidth,1,coreLeft,start,width,join-start+.5);
  c.drawImage(image,sx+cx,sy+splice,cw,f.endY-splice,px,join,cw*s,(f.endY-splice)*s);
 }else{
  const end=y+length;
  if(end>join)c.drawImage(image,sx+stripLeft,sy+splice,stripWidth,1,coreLeft,join-.5,width,end-join+.5);
  c.drawImage(image,sx+cx,sy+cy,cw,splice-cy,px,py,cw*s,(splice-cy)*s);
 }
}

// Four transparent 256 px cells. The cap and bark core use the same
// center and scale across variants, regardless of moss or leaf overhang.
const TREE_CELL = 256;
const TREE_CAP_Y = 8;
const TREE_CORE_WIDTH = 128;
const TREE_VARIANTS = ['rot', 'hollow', 'moss', 'vine'];
const TREE_SPLICES = [181, 180, 180, 182];

// An atlas cell contains a tiny knot-free bark swatch. Build a long organic
// painted extension ONCE per atlas/variant; never repeat knots, mushrooms or
// leaves and never render hundreds of procedural strokes per gameplay frame.
const BARK_SURFACES = new WeakMap();
const BARK_SOURCE_WIDTH = 128;
const BARK_SOURCE_HEIGHT = 1100;
function continuousBark(image, index) {
 let cached=BARK_SURFACES.get(image);
 if(!cached){cached=new Map();BARK_SURFACES.set(image,cached);}
 if(cached.has(index))return cached.get(index);
 const canvas=typeof OffscreenCanvas!=='undefined'
  ?new OffscreenCanvas(BARK_SOURCE_WIDTH,BARK_SOURCE_HEIGHT)
  :document.createElement('canvas');
 canvas.width=BARK_SOURCE_WIDTH;canvas.height=BARK_SOURCE_HEIGHT;
 const layer=canvas.getContext('2d',{willReadFrequently:true});
 const sx=(index%2)*TREE_CELL+64,sy=Math.floor(index/2)*TREE_CELL+192;
 layer.drawImage(image,sx,sy,128,64,0,0,128,64);
 const pixels=layer.getImageData?.(0,25,128,1);
 if(!pixels?.data || typeof layer.createImageData!=='function'){
  // Node's minimal canvas stubs do not expose pixel readback. Browser canvas does.
  cached.set(index,null);
  return null;
 }
 const sample=pixels.data;
 const base=new Array(128);
 for(let x=0;x<128;x++){
  const k=x*4;
  base[x]=[sample[k],sample[k+1],sample[k+2]];
 }
 const softened=base.map((_,x)=>{
  let r=0,g=0,b=0,n=0;
  for(let dx=-3;dx<=3;dx++){
   const color=base[Math.min(127,Math.max(0,x+dx))];
   r+=color[0];g+=color[1];b+=color[2];n++;
  }
  return [r/n,g/n,b/n];
 });
 const frame=layer.createImageData(BARK_SOURCE_WIDTH,BARK_SOURCE_HEIGHT);
 const data=frame.data;
 const phase=index*.71;
 for(let y=0;y<BARK_SOURCE_HEIGHT;y++){
  // Long, nonrepeating waves gently curve the original painted bark grooves.
  const shift=(Math.sin(y*.013+phase)-Math.sin(phase))*6.5+
              (Math.sin(y*.041+phase*2)-Math.sin(phase*2))*2.5;
  const top=Math.min(1,y/13);
  for(let x=0;x<128;x++){
   const warped=Math.max(0,Math.min(127,Math.round(x+shift)));
   const pure=base[x],smooth=softened[warped];
   const variation=top*(3.6*Math.sin(y*.029+x*.083+phase)+
                        1.8*Math.sin(y*.071-x*.029+phase));
   const k=(y*128+x)*4;
   for(let ch=0;ch<3;ch++){
    const value=pure[ch]*(1-top)+smooth[ch]*top+variation*(ch===0?1:ch===1?.67:.45);
    data[k+ch]=Math.max(0,Math.min(255,Math.round(value)));
   }
   data[k+3]=255;
  }
 }
 layer.putImageData(frame,0,0);
 // Hand-painted continuous, meandering bark fissures and warm ridges.
 // Paths cross the whole 1100px surface and never form identical repetitions.
 for(let i=0;i<17;i++){
  const root=7+((i*37+index*11)%115);
  const phase2=i*1.83+index*.45;
  layer.beginPath();
  for(let y=12;y<BARK_SOURCE_HEIGHT;y+=24){
   const x=root+4.5*Math.sin(y*.015+phase2)+
               2.2*Math.sin(y*.037+phase2*.57);
   if(y===12)layer.moveTo(x,y);else layer.lineTo(x,y);
  }
  layer.strokeStyle=i%4===0?'rgba(78,35,21,.25)':
                    i%4===1?'rgba(251,179,95,.21)':
                    i%4===2?'rgba(90,42,26,.18)':'rgba(254,204,130,.15)';
  layer.lineWidth=i%5===0?3.2:i%3===0?2.1:1.15;
  layer.lineCap='round';layer.stroke();
 }
 cached.set(index,canvas);
 return canvas;
}

export function drawTreeVariant(c, x, y, upper, kind, breakAge) {
 const image = images.get('tree-variants');
 const index = TREE_VARIANTS.indexOf(kind);
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
  // Texture is cached once per variant, not rebuilt on each frame.
  const bark=continuousBark(image,index);
  const run=1000-join;
  if(bark)c.drawImage(bark,0,0,BARK_SOURCE_WIDTH,run,
   -TREE_WIDTH/2,join-.5,TREE_WIDTH,run+.5);
  else c.drawImage(image,sx+64,sy+192,128,64,
   -TREE_WIDTH/2,join-.5,TREE_WIDTH,run+.5);
  c.drawImage(image, sx, sy + TREE_CAP_Y, TREE_CELL, splice - TREE_CAP_Y,
   left, 0, TREE_CELL * scale, join);
  if (breakAge !== undefined) {
   c.beginPath();
   c.moveTo(-9, 6);
   c.lineTo(2, 23);
   c.lineTo(-5, 39);
   c.lineTo(11, 57);
   c.lineTo(2, 83);
   c.strokeStyle = '#352218';
   c.lineWidth = 3;
   c.stroke();
  }
 } else {
  const elapsed = breakAge - .055;
  c.globalAlpha *= Math.max(0, 1 - elapsed / .185);
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
 }
 c.restore();
}

export function drawRefugeTree(c,r,support,time=0,width=215,footX=7){
 const f=FOREST_ART.lower[3],s=width/(f.core[1]-f.core[0]);
 // Measured landing point on the integrated left branch (cell-local pixels).
 const perch=f.perch;
 const rootX=r.x+footX-(perch[0]-f.anchor[0])*s;
 const top=support-4-(perch[1]-f.anchor[1])*s;
 drawLivingTrunk(c,{x:rootX,y:top,width,length:900,variant:3});
}
