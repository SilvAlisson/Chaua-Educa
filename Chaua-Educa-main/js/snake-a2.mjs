import {SNAKE_TIMING} from './animals.mjs';

// Experimental A2 artwork only: enabled explicitly via ?snakeA2=1.
export const SNAKE_A2_ENABLED =
 typeof location!=='undefined'&&new URLSearchParams(location.search).get('snakeA2')==='1';
export const SNAKE_A2_GRID=Object.freeze({columns:4,rows:2,cell:384,anchorX:192,anchorY:352});
const PATHS=Object.freeze({
 idle:'../public/snake/base/idle.webp',
 attack:'../public/snake/attack/attack.webp',
 stunned:'../public/snake/reactions/stunned.webp'
});
const images=new Map();
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
    const loop=[4,5,6,7,6,5];
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
    images.set(key,image);resolve(true);
   }else resolve(false);
  };
  image.onerror=()=>resolve(false);
  image.src=new URL(path,import.meta.url).href;
 }))).then(results=>{
  if(results.some(ok=>!ok)||images.size!==3){images.clear();return false;}
  return true;
 });
 return loading;
}
export function isSnakeA2Ready(){return SNAKE_A2_ENABLED&&images.size===3;}
export function drawSnakeA2(c,s,factor,reduced=false){
 if(!isSnakeA2Ready())return false;
 const pose=snakeA2Pose(s,reduced);
 if(!pose)return false;
 const image=images.get(pose.key);
 if(!image)return false;
 const {columns,cell,anchorX,anchorY}=SNAKE_A2_GRID;
 const sx=pose.frame%columns*cell,sy=Math.floor(pose.frame/columns)*cell;
 // The authored sheet faces right; flip horizontally so the snake faces left towards the incoming parrot.
 c.save();
 c.scale(-1, 1);
 c.drawImage(image,sx,sy,cell,cell,-anchorX*factor,-anchorY*factor,cell*factor,cell*factor);
 c.restore();
 return true;
}
