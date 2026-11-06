import {SNAKE_TIMING} from './animals.mjs';
import {snakePlacement} from './animation.mjs';
import {shapesHitRect} from './collision.mjs';

// Use A2 by default. The original snake remains available via ?snakeA2=0.
export const SNAKE_A2_ENABLED =
 typeof location!=='undefined'&&new URLSearchParams(location.search).get('snakeA2')!=='0';
export const SNAKE_A2_GRID=Object.freeze({columns:4,rows:2,cell:384,anchorX:192,anchorY:352});
const PATHS=Object.freeze({
 idle:'../public/snake/base/idle.webp',
 attack:'../public/snake/attack/attack.webp',
 stunned:'../public/snake/reactions/stunned.webp'
});
const images=new Map();
// Precompute each visible frame's alpha silhouette during loading rather than
// reading the canvas during 120 Hz gameplay. All hitboxes share the same WebP.
const MASK_CELL=12, MASK_SIDE=SNAKE_A2_GRID.cell/MASK_CELL, ALPHA_THRESHOLD=112;
const collisionMasks=new Map();
let allVisibleFramesMask=null;
function imageCollisionMasks(image){
 const canvas=typeof OffscreenCanvas!=='undefined'
  ?new OffscreenCanvas(image.naturalWidth,image.naturalHeight)
  :typeof document!=='undefined'?document.createElement('canvas'):null;
 if(!canvas)throw Error('No canvas for A2 collision masks');
 canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context)throw Error('No 2D canvas for A2 collision masks');
 context.drawImage(image,0,0);
 const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
 const frames=[],rowStride=canvas.width*4;
 for(let frameIndex=0;frameIndex<8;frameIndex++){
  const frameX=frameIndex%SNAKE_A2_GRID.columns*SNAKE_A2_GRID.cell;
  const frameY=Math.floor(frameIndex/SNAKE_A2_GRID.columns)*SNAKE_A2_GRID.cell;
  const cells=new Uint8Array(MASK_SIDE*MASK_SIDE);
  for(let row=0;row<MASK_SIDE;row++)for(let col=0;col<MASK_SIDE;col++){
   const sourceX=frameX+col*MASK_CELL,sourceY=frameY+row*MASK_CELL;
   let filled=false;
   for(let y=0;y<MASK_CELL&&!filled;y++){
    const start=(sourceY+y)*rowStride+(sourceX*4)+3;
    for(let x=0;x<MASK_CELL;x++)if(pixels[start+x*4]>=ALPHA_THRESHOLD){filled=true;break;}
   }
   cells[row*MASK_SIDE+col]=filled?1:0;
  }
  frames.push(cells);
 }
 return frames;
}
function buildVisibleFootprint(){
 const union=new Uint8Array(MASK_SIDE*MASK_SIDE);
 for(const key of ['idle','attack','stunned'])for(let frame=0;frame<8;frame++){
  const cells=collisionMasks.get(key)[frame],flip=snakeA2NeedsMirror({key,frame});
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
function candidateRange(value,halfSize,center,anchor,factor){
 const a=(value-halfSize-center)/factor+anchor,b=(value+halfSize-center)/factor+anchor;
 return [Math.max(0,Math.floor(Math.min(a,b)/MASK_CELL)),Math.min(MASK_SIDE-1,Math.floor(Math.max(a,b)/MASK_CELL))];
}

// Collision follows the current illustrated pose, including sprite mirroring.
// When the WebP art is absent, Game keeps the exact original collision path.
export function snakeA2HitsPlayer(wood,playerPolygons,reduced=false){
 if(!isSnakeA2Ready()||!wood?.snake||wood.snake.retreat)return false;
 const pose=snakeA2Pose(wood.snake,reduced),mask=collisionMasks.get(pose.key)?.[pose.frame];
 if(!mask)return false;
 const place=snakePlacement(wood),flip=snakeA2NeedsMirror(pose);
 for(const polygon of playerPolygons){
  if(!polygon?.length)continue;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const vertex of polygon){left=Math.min(left,vertex.x);right=Math.max(right,vertex.x);top=Math.min(top,vertex.y);bottom=Math.max(bottom,vertex.y);}
  const [colStart,colEnd]=candidateRange((left+right)/2,(right-left)/2,place.x,SNAKE_A2_GRID.anchorX,place.factor);
  const [rowStart,rowEnd]=candidateRange((top+bottom)/2,(bottom-top)/2,place.y,SNAKE_A2_GRID.anchorY,place.factor);
  const realCols=flip?[MASK_SIDE-1-colEnd,MASK_SIDE-1-colStart]:[colStart,colEnd];
  for(let row=rowStart;row<=rowEnd;row++)for(let col=realCols[0];col<=realCols[1];col++)
   if(mask[row*MASK_SIDE+col]&&shapesHitRect([polygon],spriteCellRect(place,col,row,flip)))return true;
 }
 return false;
}

// The fruit must be clear of every visible pose, including shield stun.
// 56 logical pixels includes the fruit halo, its bobbing motion and
// a visible air gap around the snake.
export function snakeA2FruitHasClearance(wood,x,y,radius=56){
 if(!isSnakeA2Ready())return true;
 const place=snakePlacement(wood);
 const [colStart,colEnd]=candidateRange(x,radius,place.x,SNAKE_A2_GRID.anchorX,place.factor);
 const [rowStart,rowEnd]=candidateRange(y,radius,place.y,SNAKE_A2_GRID.anchorY,place.factor);
 const r2=radius*radius;
 for(let row=rowStart;row<=rowEnd;row++)for(let col=colStart;col<=colEnd;col++){
  if(!allVisibleFramesMask[row*MASK_SIDE+col])continue;
  const box=spriteCellRect(place,col,row);
  const dx=Math.max(box.x-x,0,x-(box.x+box.w)),dy=Math.max(box.y-y,0,y-(box.y+box.h));
  if(dx*dx+dy*dy<r2)return false;
 }
 return true;
}

export function placeA2Fruit(snakes,x,y,minimumY,maximumY,previous=[]){
 if(minimumY>maximumY)return null;
 const fits=(cx,cy)=>cy>=minimumY&&cy<=maximumY&&
  snakes.every(wood=>snakeA2FruitHasClearance(wood,cx,cy))&&
  !previous.some(p=>Math.abs(p.x-cx)<56&&Math.abs(p.y-cy)<50);
 if(fits(x,y))return {x,y};
 let best=null,score=Infinity;
 // Prefer a tiny vertical shift within the existing corridor. A horizontal
 // adjustment is a fallback, so the difficulty and fruit routes are retained.
 for(const deltaX of [0,-16,16,-32,32,-48,48,-64,64,-80,80,-96,96,-112,112,-128,128,-144,144]){
  for(let yy=minimumY;yy<maximumY+4;yy+=4){
   const cy=Math.min(yy,maximumY),cx=x+deltaX;
   const cost=Math.abs(deltaX)*1.4+Math.abs(cy-y);
   if(cost>=score||!fits(cx,cy))continue;
   score=cost;best={x:cx,y:cy};
  }
 }
 if(!best)for(const dx of [-160,160,-180,180,-200,200]){
  const cx=x+dx,cy=Math.max(minimumY,Math.min(y,maximumY));
  if(fits(cx,cy)){best={x:cx,y:cy};break;}
 }
 return best;
}
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
    // Loop the dazed wobble expression (frames 4, 5, 6, 7) so the stunned snake stays visibly dazed
    const loop=[7,6,5,4,5,6];
    f=loop[Math.floor((t-0.85)*5)%loop.length];
  }
  return {key:'stunned',frame:reduced?3:f,state:'shield-stunned'};
 }
 if(reduced)return {key:'idle',frame:0,state:'idle'};
 switch(s.phase){
  case 'warning':return {key:'idle',frame:Math.min(5,3+frame(validTime(s.warningAge)/SNAKE_TIMING.warning,3)),state:'alert'};
  case 'windup':return {key:'attack',frame:frame(validTime(s.phaseAge)/SNAKE_TIMING.windup,4),state:'windup'};
  case 'striking':return {key:'attack',frame:4+frame(validTime(s.phaseAge)/SNAKE_TIMING.strike,2),state:'strike'};
  case 'recovering':return {key:'attack',frame:6+frame(validTime(s.phaseAge)/SNAKE_TIMING.recovery,2),state:'recover'};
  case 'spent':case 'leaving':return {key:'idle',frame:7,state:s.phase};
  default:return {key:'idle',frame:[0,1,2,1,0,6,7,0][Math.floor(validTime(s.age)*2.3)%8],state:'watching'};
 }
}
export function preloadSnakeA2(){
 if(!SNAKE_A2_ENABLED||typeof Image==='undefined')return Promise.resolve(false);
 if(loading)return loading;
 loading=Promise.all(Object.entries(PATHS).map(([key,path])=>new Promise(resolve=>{
  const image=new Image();
  image.onload=()=>{
   if(image.naturalWidth===SNAKE_A2_GRID.columns*SNAKE_A2_GRID.cell&&
      image.naturalHeight===SNAKE_A2_GRID.rows*SNAKE_A2_GRID.cell){
    images.set(key,image);
    try{collisionMasks.set(key,imageCollisionMasks(image));resolve(true);}
    catch{images.delete(key);resolve(false);}
   }else resolve(false);
  };
  image.onerror=()=>resolve(false);
  image.src=new URL(path,import.meta.url).href;
 }))).then(results=>{
  if(results.some(ok=>!ok)||images.size!==3||collisionMasks.size!==3){images.clear();collisionMasks.clear();return false;}
  allVisibleFramesMask=buildVisibleFootprint();
  return true;
 });
 return loading;
}
export function isSnakeA2Ready(){return SNAKE_A2_ENABLED&&images.size===3&&collisionMasks.size===3&&!!allVisibleFramesMask;}
export function snakeA2NeedsMirror(pose){
 return pose?.key==='attack'&&(pose.frame===4||pose.frame===5)
  ||pose?.key==='stunned'&&pose.frame===3;
}
export function drawSnakeA2(c,s,factor,reduced=false){
 if(!isSnakeA2Ready())return false;
 const pose=snakeA2Pose(s,reduced);
 if(!pose)return false;
 const image=images.get(pose.key);
 if(!image)return false;
 const {columns,cell,anchorX,anchorY}=SNAKE_A2_GRID;
 const sx=pose.frame%columns*cell,sy=Math.floor(pose.frame/columns)*cell;
 // The generated A2 sheet mixes directions: idle and windup already
 // face the incoming Chauá (left), whereas peak strike poses face right.
 // Mirror ONLY the right-facing poses; a global flip made the snake turn
 // away from the player during warning and snap back during the bite.
 const flip=snakeA2NeedsMirror(pose);
 c.save();
 if(flip)c.scale(-1,1);
 c.drawImage(image,sx,sy,cell,cell,-anchorX*factor,-anchorY*factor,cell*factor,cell*factor);
 c.restore();
 return true;
}
