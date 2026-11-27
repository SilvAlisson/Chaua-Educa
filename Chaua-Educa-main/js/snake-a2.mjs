const WARNING_ATTACK_FRAMES = Object.freeze([2, 3, 4]);
const WARNING_DEF_FRAMES = Object.freeze([1, 0, 0]);
const IDLE_CYCLE = Object.freeze([0, 1, 2, 1]);
const DELTA_X_CANDIDATES = Object.freeze([0,-16,16,-32,32,-48,48,-64,64,-80,80,-96,96,-112,112,-128,128,-144,144]);
const FALLBACK_DX = Object.freeze([-160,160,-180,180,-200,200]);

function snakesClear(snakes, cx, cy) {
 for (let i = 0; i < snakes.length; i++) {
  if (!snakeA2FruitHasClearance(snakes[i], cx, cy)) return false;
 }
 return true;
}
function previousClear(previous, cx, cy) {
 for (let i = 0; i < previous.length; i++) {
  const p = previous[i];
  if (Math.abs(p.x - cx) < 56 && Math.abs(p.y - cy) < 50) return false;
 }
 return true;
}
import {loadCatalogAsset} from './assets.mjs';
import {SNAKE_A2_GRID,SNAKE_SHEET_DEFS} from './asset-manifest.mjs';
import {SNAKE_ATTACK_ART} from './snake-attack-art.mjs';
import {snakeAttack} from './attack-patterns.mjs';
import {SNAKE_TIMING} from './animals.mjs';
import { activeProbe } from './perf-hooks.mjs';
import {shapesHitRect} from './collision.mjs';
import {SNAKE_A2_MASKS} from './snake-a2-masks.mjs';

// Official snake implementation: no legacy art or query-string toggle.
export {SNAKE_A2_GRID};
export const SNAKE_SHEET_KEYS=Object.freeze(Object.keys(SNAKE_SHEET_DEFS));
export const snakeA2ArtScale=pose=>SNAKE_ATTACK_ART[pose?.key]?.scale??1;
export function snakePlacement(wood){return {x:wood.x+29,y:wood.bottom+20,factor:.52,facing:1};}
const images=new Map();
// Generated offline from the official A2 artwork: deterministic physics at 120 Hz
// without browser image readbacks. All collision shapes use the same frames.
const MASK_CELL=12, MASK_SIDE=SNAKE_A2_GRID.cell/MASK_CELL;
const collisionMasks=SNAKE_A2_MASKS;
function buildVisibleFootprint(){
 const union=new Uint8Array(MASK_SIDE*MASK_SIDE);
 for(const key of ['idle','attack','stunned'])for(let frame=0;frame<8;frame++){
  const cells=collisionMasks[key][frame],flip=snakeA2NeedsMirror({key,frame});
  for(let row=0;row<MASK_SIDE;row++)for(let col=0;col<MASK_SIDE;col++)
   if(cells[row*MASK_SIDE+col])union[row*MASK_SIDE+(flip?MASK_SIDE-1-col:col)]=1;
 }
 return union;
}
function spriteCellRect(place,col,row,flip=false){
 const side=MASK_CELL*place.factor;
 return {x:place.x+((flip?SNAKE_A2_GRID.anchorX-(col+1)*MASK_CELL:col*MASK_CELL-SNAKE_A2_GRID.anchorX)*place.factor),
  y:place.y+(row*MASK_CELL-SNAKE_A2_GRID.anchorY)*place.factor,w:side,h:side};
}
const scratchCellRect={x:0,y:0,w:0,h:0};
function setSpriteCellRect(place,col,row,flip=false){
 const side=MASK_CELL*place.factor;
 scratchCellRect.x=place.x+((flip?SNAKE_A2_GRID.anchorX-(col+1)*MASK_CELL:col*MASK_CELL-SNAKE_A2_GRID.anchorX)*place.factor);
 scratchCellRect.y=place.y+(row*MASK_CELL-SNAKE_A2_GRID.anchorY)*place.factor;
 scratchCellRect.w=side;
 scratchCellRect.h=side;
 return scratchCellRect;
}
const singlePolyWrapper=[null];
function candidateRange(value,halfSize,center,anchor,factor){
 const a=(value-halfSize-center)/factor+anchor,b=(value+halfSize-center)/factor+anchor;
 return [Math.max(0,Math.floor(Math.min(a,b)/MASK_CELL)),Math.min(MASK_SIDE-1,Math.floor(Math.max(a,b)/MASK_CELL))];
}

// Collision follows the current illustrated pose, including sprite mirroring.
// Collision never switches to a historical implementation.
export function snakeA2HitsPlayer(wood,playerPolygons,reduced=false){
 if(!wood?.snake||wood.snake.retreat)return false;
 const pose=snakeA2Pose(wood.snake,reduced),mask=collisionMasks[pose.key]?.[pose.frame];
 if(!mask)throw new Error(`A2 collision mask is missing: ${pose.key} frame ${pose.frame}`);
 const place=snakePlacement(wood),flip=snakeA2NeedsMirror(pose);place.factor*=snakeA2ArtScale(pose);
 for(let pi=0;pi<playerPolygons.length;pi++){
  const polygon=playerPolygons[pi];
  if(!polygon?.length)continue;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(let vi=0;vi<polygon.length;vi++){
   const vertex=polygon[vi];
   if(vertex.x<left)left=vertex.x;if(vertex.x>right)right=vertex.x;
   if(vertex.y<top)top=vertex.y;if(vertex.y>bottom)bottom=vertex.y;
  }
  const cx=(left+right)*.5,ch=(right-left)*.5;
  const ca1=(cx-ch-place.x)/place.factor+SNAKE_A2_GRID.anchorX,ca2=(cx+ch-place.x)/place.factor+SNAKE_A2_GRID.anchorX;
  const colStart=Math.max(0,Math.floor(Math.min(ca1,ca2)/MASK_CELL));
  const colEnd=Math.min(MASK_SIDE-1,Math.floor(Math.max(ca1,ca2)/MASK_CELL));

  const cy=(top+bottom)*.5,cv=(bottom-top)*.5;
  const cb1=(cy-cv-place.y)/place.factor+SNAKE_A2_GRID.anchorY,cb2=(cy+cv-place.y)/place.factor+SNAKE_A2_GRID.anchorY;
  const rowStart=Math.max(0,Math.floor(Math.min(cb1,cb2)/MASK_CELL));
  const rowEnd=Math.min(MASK_SIDE-1,Math.floor(Math.max(cb1,cb2)/MASK_CELL));

  const c0=flip?MASK_SIDE-1-colEnd:colStart;
  const c1=flip?MASK_SIDE-1-colStart:colEnd;

  singlePolyWrapper[0]=polygon;
  for(let row=rowStart;row<=rowEnd;row++){
   const rowOffset=row*MASK_SIDE;
   for(let col=c0;col<=c1;col++){
    if(mask[rowOffset+col]&&shapesHitRect(singlePolyWrapper,setSpriteCellRect(place,col,row,flip)))return true;
   }
  }
 }
 return false;
}

// The fruit must be clear of every visible pose, including shield stun.
// 56 logical pixels includes the fruit halo, its bobbing motion and
// a visible air gap around the snake.
export function snakeA2FruitHasClearance(wood,x,y,radius=62){
 const place=snakePlacement(wood);
 const kind=snakeAttack(wood.snake).key;
 if(kind!=='attack')return scaledFruitClearance(kind,place,x,y,radius);
 const ca1=(x-radius-place.x)/place.factor+SNAKE_A2_GRID.anchorX,ca2=(x+radius-place.x)/place.factor+SNAKE_A2_GRID.anchorX;
 const colStart=Math.max(0,Math.floor(Math.min(ca1,ca2)/MASK_CELL));
 const colEnd=Math.min(MASK_SIDE-1,Math.floor(Math.max(ca1,ca2)/MASK_CELL));
 const cb1=(y-radius-place.y)/place.factor+SNAKE_A2_GRID.anchorY,cb2=(y+radius-place.y)/place.factor+SNAKE_A2_GRID.anchorY;
 const rowStart=Math.max(0,Math.floor(Math.min(cb1,cb2)/MASK_CELL));
 const rowEnd=Math.min(MASK_SIDE-1,Math.floor(Math.max(cb1,cb2)/MASK_CELL));
 const r2=radius*radius;
 for(let row=rowStart;row<=rowEnd;row++){
  const rowOffset=row*MASK_SIDE;
  for(let col=colStart;col<=colEnd;col++){
   if(!allVisibleFramesMask[rowOffset+col])continue;
   const box=setSpriteCellRect(place,col,row);
   const dx=Math.max(box.x-x,0,x-(box.x+box.w)),dy=Math.max(box.y-y,0,y-(box.y+box.h));
   if(dx*dx+dy*dy<r2)return false;
  }
 }
 return true;
}

const scaledFootprints=new Map();
function prepareScaledFootprint(kind){
 let footprint=scaledFootprints.get(kind);
 const side=48,ox=-288,oy=-448;
 if(!footprint){
  footprint=new Uint8Array(side*side);
  for(const key of ['idle','stunned',kind])for(let frame=0;frame<8;frame++){
   const mask=collisionMasks[key][frame],flip=snakeA2NeedsMirror({key,frame}),scale=snakeA2ArtScale({key});
   for(let row=0;row<32;row++)for(let col=0;col<32;col++)if(mask[row*32+col]){
    const xx=(flip?192-(col+1)*12:col*12-192)*scale,yy=(row*12-352)*scale;
    const x0=Math.max(0,Math.floor((xx-ox)/12)),x1=Math.min(side-1,Math.ceil((xx+12*scale-ox)/12)-1);
    const y0=Math.max(0,Math.floor((yy-oy)/12)),y1=Math.min(side-1,Math.ceil((yy+12*scale-oy)/12)-1);
    for(let r=y0;r<=y1;r++)for(let c=x0;c<=x1;c++)footprint[r*side+c]=1;
   }
  }
  scaledFootprints.set(kind,footprint);
 }
 return footprint;
}
function scaledFruitClearance(kind,place,x,y,radius){
 const footprint=prepareScaledFootprint(kind),side=48,ox=-288,oy=-448;
 const x0=Math.max(0,Math.floor(((x-radius-place.x)/place.factor-ox)/12)),x1=Math.min(side-1,Math.floor(((x+radius-place.x)/place.factor-ox)/12));
 const y0=Math.max(0,Math.floor(((y-radius-place.y)/place.factor-oy)/12)),y1=Math.min(side-1,Math.floor(((y+radius-place.y)/place.factor-oy)/12));
 const size=12*place.factor;
 for(let row=y0;row<=y1;row++)for(let col=x0;col<=x1;col++)if(footprint[row*side+col]){
  const xx=place.x+(ox+col*12)*place.factor,yy=place.y+(oy+row*12)*place.factor;
  const dx=Math.max(xx-x,0,x-xx-size),dy=Math.max(yy-y,0,y-yy-size);
  if(dx*dx+dy*dy<radius*radius)return false;
 }
 return true;
}

export function placeA2Fruit(snakes,x,y,minimumY,maximumY,previous=[]){
 if(minimumY>maximumY)return null;
 const probe=activeProbe;
 let candidates=0;
 const fits=(cx,cy)=>{
  candidates++;
  return cy>=minimumY&&cy<=maximumY&&
   snakesClear(snakes,cx,cy)&&
   previousClear(previous,cx,cy);
 };
 if(fits(x,y)){
  if(probe)probe.event('snake:fruitPlacement',{candidates,originalPositionAccepted:true});
  return {x,y};
 }
 let best=null,score=Infinity;
 // Prefer a tiny vertical shift within the existing corridor. A horizontal
 // adjustment is a fallback, so the difficulty and fruit routes are retained.
 for(let dIdx=0;dIdx<DELTA_X_CANDIDATES.length;dIdx++){
  const deltaX=DELTA_X_CANDIDATES[dIdx];
  for(let yy=minimumY;yy<maximumY+4;yy+=4){
   const cy=Math.min(yy,maximumY),cx=x+deltaX;
   const cost=Math.abs(deltaX)*1.4+Math.abs(cy-y);
   if(cost>=score||!fits(cx,cy))continue;
   score=cost;best={x:cx,y:cy};
  }
 }
 if(!best)for(let dIdx=0;dIdx<FALLBACK_DX.length;dIdx++){
  const dx=FALLBACK_DX[dIdx];
  const cx=x+dx,cy=Math.max(minimumY,Math.min(y,maximumY));
  if(fits(cx,cy)){best={x:cx,y:cy};break;}
 }
 if(probe)probe.event('snake:fruitPlacement',{candidates,originalPositionAccepted:false,found:!!best});
 return best;
}
const allVisibleFramesMask=buildVisibleFootprint();
let loading;
const clamp=(value,lo=0,hi=1)=>Math.max(lo,Math.min(hi,Number.isFinite(value)?value:lo));
const frame=(progress,count)=>Math.min(count-1,Math.floor(clamp(progress)*count));
const validTime=t=>Number.isFinite(t)?Math.max(0,t):0;

export function snakeA2Pose(s={},reduced=false){
 if(s.retreat){
  if(!s.dazed)return {key:'idle',frame:7,state:'retreat'};
  const t=validTime(s.retreatTime);
  // Initial recoil/impact frames for the first 0.85s, then continuous dazed wobble
  let f;
  if(t<0.85){
    f=frame(t/.85,8);
  } else {
    // Transition smoothly down to frames 2 and 3 and stay looping between spiral-eye stunned poses until offscreen
    const step = Math.floor((t - 0.85) * 8);
    if (step === 0) f = 6;
    else if (step === 1) f = 5;
    else if (step === 2) f = 4;
    else if (step === 3) f = 3;
    else f = (step % 2 === 0) ? 2 : 3;
  }
  return {key:'stunned',frame:reduced?3:f,state:'shield-stunned'};
 }
 if(reduced)return {key:'idle',frame:0,state:'idle'};
 const timing=snakeAttack(s);
 switch(s.phase){
  case 'warning':{
   const frames=timing.key==='attack'?[2,3,4]:[1,0,0];
   return {key:'idle',frame:frames[frame(validTime(s.warningAge)/SNAKE_TIMING.warning,frames.length)],state:'alert'};
  }
  case 'windup':return {key:timing.key,frame:frame(validTime(s.phaseAge)/timing.windup,4),state:'windup'};
  case 'striking':return {key:timing.key,frame:4+frame(validTime(s.phaseAge)/timing.strike,2),state:'strike'};
  case 'recovering':{
   // Recoil through the intact windup poses in reverse. The former 5→6→7
   // shortcut skipped the extended neck and snapped the head back ~40px.
   // Idle intermediates register the raised frontal head against its rest pose.
   const sequence=timing.key!=='attack'?[[timing.key,5],[timing.key,4],[timing.key,3],[timing.key,2],[timing.key,1],[timing.key,0],['idle',0]]:
    [[timing.key,5],[timing.key,4],[timing.key,3],[timing.key,2],[timing.key,1],[timing.key,0],['idle',4],['idle',3],['idle',2],['idle',1],['idle',0]];
   const [key,f]=sequence[frame(validTime(s.phaseAge)/timing.recovery,sequence.length)];
   return {key,frame:f,state:'recover'};
  }
  case 'spent':case 'leaving':return {key:'idle',frame:0,state:s.phase};
  default:return {key:'idle',frame:IDLE_CYCLE[Math.floor(validTime(s.age)*2.3)%4],state:'watching'};
 }
}
export function preloadSnakeA2(){
 // Offline collision masks do not require an Image in headless tests.
 if(typeof Image==='undefined')return Promise.resolve();
 if(loading)return loading;
 prepareScaledFootprint('high');prepareScaledFootprint('sweep');
 loading=Promise.all(SNAKE_SHEET_KEYS.map(async key=>[key,await loadCatalogAsset('snake:'+key,'canvas','Não foi possível carregar a cobra A2 ('+key+')')]))
 .then(entries=>{for(const [key,image] of entries)images.set(key,image);})
 .catch(error=>{loading=null;throw error;});
 return loading;
}
export function isSnakeA2Ready(){return images.size===SNAKE_SHEET_KEYS.length;}
// Experimental main-canvas first-use prewarm. Called only during countdown,
// before the opaque scene is painted, and never counted as a gameplay first-draw.
// This is NOT proof that the browser has uploaded the texture to the GPU.
export function warmupSnakeA2(c,key){
 const image=images.get(key);
 if(!image||!c)return false;
 c.save();
 c.setTransform(1,0,0,1,0,0);
 c.globalAlpha=.001;
 c.drawImage(image,0,0,SNAKE_A2_GRID.cell,SNAKE_A2_GRID.cell,0,0,8,8);
 c.restore();
 return true;
}
export function snakeA2NeedsMirror(pose){
 return pose?.key==='attack'&&(pose.frame===4||pose.frame===5)
  ||pose?.key==='stunned'&&pose.frame===3;
}
export function drawSnakeA2(c,s,factor,reduced=false){
 if(!isSnakeA2Ready())throw new Error('Cobra A2 ainda não carregada.');
 const pose=snakeA2Pose(s,reduced);
 if(!pose)return false;
 factor*=snakeA2ArtScale(pose);
 const image=images.get(pose.key);
 if(!image)throw new Error(`Sprite A2 ausente: ${pose.key}`);
 const {cell,anchorX,anchorY}=SNAKE_A2_GRID;
 const [sx,sy]=SNAKE_SHEET_DEFS[pose.key].frames[pose.frame].rect;
 // The generated A2 sheet mixes directions: idle and windup already
 // face the incoming Chauá (left), whereas peak strike poses face right.
 // Mirror ONLY the right-facing poses; a global flip made the snake turn
 // away from the player during warning and snap back during the bite.
 const flip=snakeA2NeedsMirror(pose);
 c.save();
 if(flip)c.scale(-1,1);
 const probe=activeProbe;
 const first=probe&&!probe.firstDraws.has('snake:'+pose.key);
 const measure=probe&&(first||probe.deep);
 const drawAt=measure?probe.begin(first?'snake.firstDrawCpu':'snake.drawCpu'):0;
 c.drawImage(image,sx,sy,cell,cell,-anchorX*factor,-anchorY*factor,cell*factor,cell*factor);
 if(measure){
  const duration=probe.end(first?'snake.firstDrawCpu':'snake.drawCpu',drawAt,{sheet:pose.key});
  if(first)probe.firstDraw('snake:'+pose.key,duration);
 }
 c.restore();
 return true;
}


// Geometric diagnostics use the SAME pixel masks as the production collision.
export function snakeA2CollisionRects(wood,reduced=false){
 if(!wood?.snake||wood.snake.retreat)return [];
 const place=snakePlacement(wood),pose=snakeA2Pose(wood.snake,reduced);place.factor*=snakeA2ArtScale(pose);
 const mask=collisionMasks[pose.key][pose.frame],flip=snakeA2NeedsMirror(pose),rects=[];
 for(let row=0;row<MASK_SIDE;row++){
  let start=-1;
  for(let col=0;col<=MASK_SIDE;col++){
   const occupied=col<MASK_SIDE&&!!mask[row*MASK_SIDE+(flip?MASK_SIDE-1-col:col)];
   if(occupied&&start<0)start=col;
   if(!occupied&&start>=0){
    const side=MASK_CELL*place.factor;
    rects.push({x:place.x+(start*MASK_CELL-SNAKE_A2_GRID.anchorX)*place.factor,
     y:place.y+(row*MASK_CELL-SNAKE_A2_GRID.anchorY)*place.factor,
     w:(col-start)*side,h:side});
    start=-1;
   }
  }
 }
 return rects;
}

// Exact destination cell used by drawSnakeA2. Presentation clearance only;
// collision still uses the detailed masks, never this transparent-cell box.
export function snakeA2SpriteRect(wood,reduced=false){
 if(!wood?.snake||wood.snake.retreat)return null;
 const place=snakePlacement(wood),pose=snakeA2Pose(wood.snake,reduced);
 const factor=place.factor*snakeA2ArtScale(pose);
 return {x:place.x-SNAKE_A2_GRID.anchorX*factor,y:place.y-SNAKE_A2_GRID.anchorY*factor,
  w:SNAKE_A2_GRID.cell*factor,h:SNAKE_A2_GRID.cell*factor};
}

// Upper silhouette supplies the head/mouth location for weather effects.
// The collision remains the complete mask, not this illustrative bounding box.
const HEAD_BOUNDS_CACHE = Object.create(null);
export function snakeA2HeadRect(wood,reduced=false){
 if(!wood?.snake||wood.snake.retreat)return null;
 const place=snakePlacement(wood),pose=snakeA2Pose(wood.snake,reduced);place.factor*=snakeA2ArtScale(pose);
 const flip=snakeA2NeedsMirror(pose);
 const cacheKey=`${pose.key}:${pose.frame}:${flip?1:0}`;
 let bounds=HEAD_BOUNDS_CACHE[cacheKey];
 if(bounds===undefined){
  const mask=collisionMasks[pose.key][pose.frame];
  let minX=MASK_SIDE,maxX=-1,minY=MASK_SIDE,maxY=-1;
  for(let row=0;row<(pose.key==='sweep'?22:14);row++)for(let col=0;col<MASK_SIDE;col++){
   if(!mask[row*MASK_SIDE+col])continue;
   const displayCol=flip?MASK_SIDE-1-col:col;
   minX=Math.min(minX,displayCol);maxX=Math.max(maxX,displayCol);
   minY=Math.min(minY,row);maxY=Math.max(maxY,row);
  }
  bounds=HEAD_BOUNDS_CACHE[cacheKey]=maxX<0?null:{minX,maxX,minY,maxY};
 }
 if(!bounds)return null;
 return {x:place.x+(bounds.minX*MASK_CELL-SNAKE_A2_GRID.anchorX)*place.factor,
  y:place.y+(bounds.minY*MASK_CELL-SNAKE_A2_GRID.anchorY)*place.factor,
  w:(bounds.maxX-bounds.minX+1)*MASK_CELL*place.factor,h:(bounds.maxY-bounds.minY+1)*MASK_CELL*place.factor};
}
