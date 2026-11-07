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
  // Repeat a reflected bark band at native scale. Stretching a scanline
  // turned grooves and moss into long vertical stripes on portrait screens.
  const bandHeight = 96, tileHeight = bandHeight * scale;
  for (let pos = join - .5, tile = 0; pos < 1000; pos += tileHeight, tile++) {
   c.save();
   c.translate(0, pos + (tile % 2 === 0 ? tileHeight : 0));
   if (tile % 2 === 0) c.scale(1, -1);
   c.drawImage(image, sx + (TREE_CELL - TREE_CORE_WIDTH) / 2, sy + splice - bandHeight,
    TREE_CORE_WIDTH, bandHeight, -TREE_WIDTH / 2, 0, TREE_WIDTH, tileHeight + .5);
   c.restore();
  }
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
