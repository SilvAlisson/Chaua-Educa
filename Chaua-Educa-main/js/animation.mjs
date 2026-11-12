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
});
export function birdAnimation({wing=0,time=0,perched=false,landing=null,defeated=false,impactProgress=0,reduced=false}={}){
 const glidePose=reduced?.42:.42+(time>0?Math.sin(time*2.4)*0.025:0);
 const flapProgress=(.42+(1-wing))%1;
 const flight=reduced?{frame:3,next:3,blend:0}:flightFrame(CLIPS.chaua.flight,wing>0?flapProgress:glidePose);
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
 if(e.phase==='leaving')return flightFrame(CLIPS.hawk.glide,time*.7);
 if(e.dive)return flightFrame(CLIPS.hawk.dive,(Math.sin(time*4)+1)/2);
 const cycle=(time*1.6+(e.id||0)*.37)%2.6;
 if(cycle>1.5)return flightFrame(CLIPS.hawk.glide,(cycle-1.5)*.5);
 return flightFrame(CLIPS.hawk.flight,cycle/1.5*2.2);
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
