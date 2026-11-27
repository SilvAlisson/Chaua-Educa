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
const _sortedItems = [], _blockers = [], _xs = [], _ys = [];
function pushUnique(arr, val) {
 for (let i = 0; i < arr.length; i++) if (arr[i] === val) return;
 arr.push(val);
}

// Screen-space labels avoid both other labels and protected actor regions.
// If a tiny viewport cannot fit everything, minimize covered area explicitly.
export function placeWarnings(items,view,protectedRegions=[]){
 const result=[],gap=6,left=view.x+4,top=view.y+4;
 const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w+gap)-Math.max(a.x,b.x-gap))*
  Math.max(0,Math.min(a.y+a.h,b.y+b.h+gap)-Math.max(a.y,b.y-gap));
 _sortedItems.length = 0;
 for (let i = 0; i < items.length; i++) _sortedItems.push(items[i]);
 _sortedItems.sort((a,b)=>b.h-a.h);
 _blockers.length = 0;
 for (let i = 0; i < protectedRegions.length; i++) _blockers.push(protectedRegions[i]);
 // Place the taller notices first so a small card cannot consume their only slot.
 for(let ii = 0; ii < _sortedItems.length; ii++){
  const item = _sortedItems[ii];
  const boxW=Math.min(item.w,Math.max(1,view.w-8)),boxH=Math.min(item.h,Math.max(1,view.h-8));
  const right=Math.max(left,view.x+view.w-boxW-4),bottom=Math.max(top,view.y+view.h-boxH-4);
  const bx=Math.max(left,Math.min(right,item.x)),by=Math.max(top,Math.min(bottom,item.y));
  _xs.length=0;_ys.length=0;
  _xs.push(bx);pushUnique(_xs,left);pushUnique(_xs,right);
  _ys.push(by);pushUnique(_ys,top);pushUnique(_ys,bottom);
  for(let bi=0;bi<_blockers.length;bi++){
   const b=_blockers[bi];
   pushUnique(_xs,b.x-boxW-gap);pushUnique(_xs,b.x+b.w+gap);
   pushUnique(_ys,b.y-boxH-gap);pushUnique(_ys,b.y+b.h+gap);
  }
  let bestX=bx,bestY=by,bestOverlap=Infinity,bestDistance=Infinity;
  const candidate={x:0,y:0,w:boxW,h:boxH};
  search:for(let xi=0;xi<_xs.length;xi++){
   const x=_xs[xi];
   if(x<left||x>right)continue;
   candidate.x=x;
   for(let yi=0;yi<_ys.length;yi++){
    const y=_ys[yi];
    if(y<top||y>bottom)continue;
    candidate.y=y;
    let overlap=0;
    for(let bi=0;bi<_blockers.length;bi++)overlap+=area(candidate,_blockers[bi]);
    const distance=(x-bx)*(x-bx)+(y-by)*(y-by);
    if(overlap<bestOverlap||(overlap===bestOverlap&&distance<bestDistance)){bestX=x;bestY=y;bestOverlap=overlap;bestDistance=distance;}
    if(bestOverlap===0&&bestDistance===0)break search;
   }
  }
  const placed={...item,w:boxW,h:boxH,x:bestX,y:bestY};
  result.push(placed);
  _blockers.push(placed);
 }
 _sortedItems.length=0;_blockers.length=0;_xs.length=0;_ys.length=0;
 return result;
}
