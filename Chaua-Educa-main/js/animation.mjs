import {SPRITES} from './sprite-data.mjs';
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
export function sequence(frames,progress,loop=false){
 const position=loop?((progress%1+1)%1)*frames.length:clamp(progress)*(frames.length-1);
 const i=Math.min(frames.length-1,Math.floor(position));
 return {frame:frames[i],next:frames[loop?(i+1)%frames.length:Math.min(i+1,frames.length-1)],blend:ease(position-i)};
}
// Use complete authored flight poses: crossfading distant wing positions creates
// translucent duplicate feathers rather than an intermediate drawing.
function flightFrame(frames,progress){const clip=sequence(frames,progress,true);const frame=clip.blend<.5?clip.frame:clip.next;return {frame,next:frame,blend:0};}
export const CLIPS=Object.freeze({
 chaua:{flight:[0,1,2,3,4,5,6,7],landing:[8,9,10,11,12],idle:[12,13],recoil:[14,15]},
 hawk:{flight:[0,1,2,3,4,5,6,7],glide:[8,9],dive:[10,11],recoil:[12,13,14,15]},
 snake:{idle:[0,1,2,3],alert:[4,5,6,7],attack:[7,8,9,10,11,7],withdraw:[11,12,13,14,15],emerge:[15,0]},
});
export function birdAnimation({wing=0,time=0,perched=false,landing=null,defeated=false,impactProgress=0,reduced=false}={}){
 const flight=reduced?{frame:3,next:3,blend:0}:flightFrame(CLIPS.chaua.flight,wing>0?(1-wing):.42);
 if(landing!==null){
  if(!reduced&&landing<.15)return {frame:flight.frame,next:8,blend:ease(landing/.15)};
  return sequence(CLIPS.chaua.landing,reduced?1:(landing-.15)/.85);
 }
 if(perched){const blink=time%4;return sequence(CLIPS.chaua.idle,reduced?0:blink>3.55?Math.sin((blink-3.55)/.45*Math.PI):0);}
 if(!defeated)return flight;
 if(impactProgress<.4)return {frame:flight.frame,next:14,blend:ease(impactProgress/.4)};
 return sequence(CLIPS.chaua.recoil,(impactProgress-.4)/.6);
}
export function hawkAnimation(e,time=0,reduced=false){
 if(e.retreat||e.dazed)return sequence(CLIPS.hawk.recoil,reduced?1:(e.retreatTime||0)/.7);
 if(reduced||e.warning>0)return {frame:8,next:8,blend:0};
 if(e.phase==='leaving')return sequence(CLIPS.hawk.glide,time*.7,true);
 if(e.dive)return sequence(CLIPS.hawk.dive,(Math.sin(time*4)+1)/2);
 return flightFrame(CLIPS.hawk.flight,time*2.2+(e.id||0)*.13);
}
export function snakeAnimation(s={},reduced=false){
 if(reduced){const frame=s.retreat?15:0;return {frame,next:frame,blend:0};}
 if(s.retreat)return sequence(CLIPS.snake.withdraw,(s.retreatTime||0)/.85);
 if(Number.isFinite(s.age)&&s.age<.8)return sequence(CLIPS.snake.emerge,s.age/.8);
 if(s.phase==='occupied')return sequence(CLIPS.snake.attack,(s.age||0)*.65,true);
 return sequence(s.phase==='warning'||s.phase==='occupied'?CLIPS.snake.alert:CLIPS.snake.idle,(s.age||0)*1.1,true);
}
export function snakePlacement(wood){return {x:wood.x+29-(wood.snake?.branch?65:5),y:wood.bottom+(wood.snake?.branch?34:8),factor:.37,facing:1};}
export function spriteHeadRect(wood,reduced=false){
 const {x,y,factor,facing}=snakePlacement(wood),clip=snakeAnimation(wood.snake,reduced),data=SPRITES.snake;
 const a=data.frames[clip.frame].head,b=data.frames[clip.next].head,t=clip.blend;
 const [cx,cy,rx,ry]=a.map((v,i)=>v+(b[i]-v)*t);
 return {x:x+((cx-data.anchor[0])*facing-rx)*factor,y:y+(cy-data.anchor[1]-ry)*factor,w:rx*2*factor,h:ry*2*factor};
}
export function placeWarnings(items,view){
 const result=[];
 for(const item of items){
  const box={...item,x:Math.max(view.x+4,Math.min(view.x+view.w-item.w-4,item.x)),y:Math.max(view.y+4,Math.min(view.y+view.h-item.h-4,item.y))};
  const fits=y=>y>=view.y+4&&y+box.h<=view.y+view.h-4;
  const clear=y=>!result.some(b=>box.x<b.x+b.w+4&&box.x+box.w+4>b.x&&y<b.y+b.h+4&&y+box.h+4>b.y);
  const candidates=[box.y,view.y+4,view.y+view.h-box.h-4,...result.flatMap(b=>[b.y-box.h-6,b.y+b.h+6])];
  candidates.sort((a,b)=>Math.abs(a-box.y)-Math.abs(b-box.y));
  box.y=candidates.find(y=>fits(y)&&clear(y))??box.y;
  result.push(box);
 }
 return result;
}
