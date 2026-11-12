import {SNAKE_TIMING} from './animals.mjs';
import {shapesHitRect} from './collision.mjs';
import {SNAKE_A2_MASKS} from './snake-a2-masks.mjs';

// Official snake implementation: no legacy art or query-string toggle.
export const SNAKE_A2_GRID=Object.freeze({columns:4,rows:2,cell:384,anchorX:192,anchorY:352});
const PATHS=Object.freeze({
 idle:'../public/snake/base/idle.webp',
 attack:'../public/snake/attack/attack.webp',
 stunned:'../public/snake/reactions/stunned.webp'
});
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
export function snakeA2FruitHasClearance(wood,x,y,radius=62){
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
 // Headless physics/tests use the same versioned masks; only rendering needs Image.
 if(typeof Image==='undefined')return Promise.resolve();
 if(loading)return loading;
 loading=Promise.all(Object.entries(PATHS).map(([key,path])=>new Promise((resolve,reject)=>{
  const image=new Image();
  const url=new URL(path,import.meta.url).href;
  image.onload=()=>{
   if(image.naturalWidth!==SNAKE_A2_GRID.columns*SNAKE_A2_GRID.cell||
      image.naturalHeight!==SNAKE_A2_GRID.rows*SNAKE_A2_GRID.cell){
    reject(new Error(`Sprite A2 inválido (${key}): dimensões inesperadas.`));return;
   }
   images.set(key,image);resolve();
  };
  image.onerror=()=>reject(new Error(`Não foi possível carregar a cobra A2: ${url}`));
  image.src=url;
 }))).then(()=>{
  if(images.size!==3)throw new Error('A cobra A2 não está pronta.');
 }).catch(error=>{images.clear();throw error;});
 return loading;
}
export function isSnakeA2Ready(){return images.size===3;}
export function snakeA2NeedsMirror(pose){
 return pose?.key==='attack'&&(pose.frame===4||pose.frame===5)
  ||pose?.key==='stunned'&&pose.frame===3;
}
export function drawSnakeA2(c,s,factor,reduced=false){
 if(!isSnakeA2Ready())throw new Error('Cobra A2 ainda não carregada.');
 const pose=snakeA2Pose(s,reduced);
 if(!pose)return false;
 const image=images.get(pose.key);
 if(!image)throw new Error(`Sprite A2 ausente: ${pose.key}`);
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


// Geometric diagnostics use the SAME pixel masks as the production collision.
export function snakeA2CollisionRects(wood,reduced=false){
 if(!wood?.snake||wood.snake.retreat)return [];
 const place=snakePlacement(wood),pose=snakeA2Pose(wood.snake,reduced);
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

// Upper silhouette supplies the head/mouth location for weather effects.
// The collision remains the complete mask, not this illustrative bounding box.
export function snakeA2HeadRect(wood,reduced=false){
 if(!wood?.snake||wood.snake.retreat)return null;
 const place=snakePlacement(wood),pose=snakeA2Pose(wood.snake,reduced);
 const mask=collisionMasks[pose.key][pose.frame],flip=snakeA2NeedsMirror(pose);
 let minX=MASK_SIDE,maxX=-1,minY=MASK_SIDE,maxY=-1;
 for(let row=0;row<14;row++)for(let col=0;col<MASK_SIDE;col++){
  if(!mask[row*MASK_SIDE+col])continue;
  const displayCol=flip?MASK_SIDE-1-col:col;
  minX=Math.min(minX,displayCol);maxX=Math.max(maxX,displayCol);
  minY=Math.min(minY,row);maxY=Math.max(maxY,row);
 }
 if(maxX<0)return null;
 return {x:place.x+(minX*MASK_CELL-SNAKE_A2_GRID.anchorX)*place.factor,
  y:place.y+(minY*MASK_CELL-SNAKE_A2_GRID.anchorY)*place.factor,
  w:(maxX-minX+1)*MASK_CELL*place.factor,h:(maxY-minY+1)*MASK_CELL*place.factor};
}
