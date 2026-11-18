const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
export function sequence(frames,progress,loop=false){
 const position=loop?((progress%1+1)%1)*frames.length:clamp(progress)*(frames.length-1);
 const i=Math.min(frames.length-1,Math.floor(position));
 return {frame:frames[i],next:frames[loop?(i+1)%frames.length:Math.min(i+1,frames.length-1)],blend:ease(position-i)};
}
// Use complete authored flight poses: crossfading distant wing positions creates
// translucent duplicate feathers rather than an intermediate drawing.
function flightFrame(frames,progress){
 const position=((progress%1+1)%1)*frames.length;
 const i=Math.min(frames.length-1,Math.floor(position));
 const blend=ease(position-i);
 const frame=blend<.5?frames[i]:frames[(i+1)%frames.length];
 return {frame,next:frame,blend:0};
}
const CHAUA_REDUCED_FLIGHT=Object.freeze({frame:3,next:3,blend:0});
const HAWK_WARNING_FRAME=Object.freeze({frame:8,next:8,blend:0});
export const CLIPS=Object.freeze({
 chaua:{flight:[0,1,2,3,4,5,6,7],landing:[8,9,10,11,12],idle:[12,13],recoil:[14,15]},
 hawk:{flight:[0,1,2,3,4,5,6,7],glide:[8,9],dive:[10,11],recoil:[12,13,14,15]},
});
export function birdAnimation({wing=0,time=0,perched=false,landing=null,defeated=false,impactProgress=0,reduced=false}={}){
 const glidePose=reduced?.42:.42+(time>0?Math.sin(time*2.4)*0.025:0);
 const flapProgress=(.42+(1-wing))%1;
 const flight=reduced?CHAUA_REDUCED_FLIGHT:flightFrame(CLIPS.chaua.flight,wing>0?flapProgress:glidePose);
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
 if(reduced||e.warning>0)return HAWK_WARNING_FRAME;
 if(e.phase==='leaving')return flightFrame(CLIPS.hawk.glide,time*.7);
 if(e.dive)return flightFrame(CLIPS.hawk.dive,(Math.sin(time*4)+1)/2);
 const cycle=(time*1.6+(e.id||0)*.37)%2.6;
 if(cycle>1.5)return flightFrame(CLIPS.hawk.glide,(cycle-1.5)*.5);
 return flightFrame(CLIPS.hawk.flight,cycle/1.5*2.2);
}
// Screen-space labels avoid both other labels and protected actor regions.
// If a tiny viewport cannot fit everything, minimize covered area explicitly.
export function placeWarnings(items,view,protectedRegions=[]){
 const result=[],gap=6,left=view.x+4,top=view.y+4;
 const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w+gap)-Math.max(a.x,b.x-gap))*
  Math.max(0,Math.min(a.y+a.h,b.y+b.h+gap)-Math.max(a.y,b.y-gap));
 // Place the taller notices first so a small card cannot consume their only slot.
 for(const item of [...items].sort((a,b)=>b.h-a.h)){
  const box={...item,w:Math.min(item.w,Math.max(1,view.w-8)),h:Math.min(item.h,Math.max(1,view.h-8))};
  const right=Math.max(left,view.x+view.w-box.w-4),bottom=Math.max(top,view.y+view.h-box.h-4);
  box.x=Math.max(left,Math.min(right,item.x));box.y=Math.max(top,Math.min(bottom,item.y));
  const blockers=[...protectedRegions,...result];
  // Preserve candidate ordering, deduplication and tie-break rules, but
  // avoid flatMap pair arrays and a per-candidate reduce/candidate allocation.
  const xs=[box.x,left,right],ys=[box.y,top,bottom];
  for(const b of blockers){
   xs.push(b.x-box.w-gap,b.x+b.w+gap);
   ys.push(b.y-box.h-gap,b.y+b.h+gap);
  }
  let best={x:box.x,y:box.y,overlap:Infinity,distance:Infinity};
  const candidate={x:0,y:0,w:box.w,h:box.h};
  for(const x of new Set(xs))for(const y of new Set(ys)){
   if(x<left||x>right||y<top||y>bottom)continue;
   candidate.x=x;candidate.y=y;
   let overlap=0;
   for(const b of blockers)overlap+=area(candidate,b);
   const distance=(x-box.x)**2+(y-box.y)**2;
   if(overlap<best.overlap||overlap===best.overlap&&distance<best.distance)best={x,y,overlap,distance};
  }
  result.push({...box,x:best.x,y:best.y});
 }
 return result;
}
