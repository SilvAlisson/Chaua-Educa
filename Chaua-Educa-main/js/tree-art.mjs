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

const FRAGILE_CELL_WIDTH = 128;
const FRAGILE_CELL_HEIGHT = 160;

export function drawFragileTrunk(c, x, y, upper, kind, breakAge) {
 const image = images.get('fragile-trees');
 if (!image) return;
 const row = kind === 'hollow' ? FRAGILE_CELL_HEIGHT : 0;
 const frame = breakAge === undefined ? 0 : breakAge < .055 ? 1 : 2;
 const column = frame * FRAGILE_CELL_WIDTH;
 c.save();
 c.translate(x, y);
 if (upper) c.scale(1, -1);
 if (frame < 2) {
  c.drawImage(image, 9, row + 159, TREE_WIDTH, 1,
   -TREE_WIDTH / 2, 159, TREE_WIDTH, 841);
 } else {
  c.globalAlpha *= Math.max(0, 1 - (breakAge - .055) / .185);
  c.translate(0, breakAge * 140);
 }
 c.drawImage(image, column, row, FRAGILE_CELL_WIDTH, FRAGILE_CELL_HEIGHT,
  -FRAGILE_CELL_WIDTH / 2, 0, FRAGILE_CELL_WIDTH, FRAGILE_CELL_HEIGHT);
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
