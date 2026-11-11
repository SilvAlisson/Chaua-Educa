import {SNAKE_TIMING} from './animals.mjs';
// Visual-only state resolver: the 120 Hz simulation, hitboxes and scoring are unchanged.
// Each state is derived from the simulation clock; no per-frame mutable timers.
const clamp = value => Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const frame = (count, progress) => Math.min(count-1,Math.floor(clamp(progress)*count));
export const ACTION_TIMINGS = Object.freeze({parrotImpact:1.2,shieldRebound:.30,hawkStun:1.05,hawkRetreat:2,snakeDaze:.85});
export function parrotAction(p = {}) {
 if(p.reduced||p.perched||p.landing!==null&&p.landing!==undefined||p.surprise)return null;
 if(p.defeated)return {state:'impact',sheet:'parrot-impact',frame:frame(6,p.impactProgress||0)};
 if(Number.isFinite(p.shieldHitAge)&&p.shieldHitAge>=0&&p.shieldHitAge<ACTION_TIMINGS.shieldRebound)
   return {state:'shield-rebound',sheet:'parrot-impact',frame:frame(6,p.shieldHitAge/ACTION_TIMINGS.shieldRebound)};
 const t=Number.isFinite(p.time)?p.time:0;
 const wing=Number.isFinite(p.wing)?p.wing:0;
 return {state:wing>0?'flapping':'gliding',sheet:'parrot-flight',
   frame:wing>0?frame(8,1-wing):3,progress:wing>0?1-wing:t};
}
export function hawkAction(e={},time=0,reduced=false) {
 if(reduced||e.warning>0)return null;
 if(e.retreat) {
   if(!e.dazed)return null;
   const t=Math.max(0,e.retreatTime||0);
   let f;
   if(t<.12) f=0;
   else if(t<.38) f=1;
   else {
     const dazedFrames=[2,3,2,4];
     f=dazedFrames[Math.floor((t-.38)*4)%dazedFrames.length];
   }
   return {state:t<.12?'shield-impact':t<1.05?'stunned':'dazed-exit',
      sheet:'hawk-stunned',frame:f,
      angle:Math.sin(t*14)*.12,
      offsetY:Math.sin(t*10)*3.2};
 }
 if(e.dive||e.phase==='leaving')return null; // preserve authored dive and glide.
 const t=Number.isFinite(time)?time:0;
 const position=((t*16+(e.id||0)*1.5)%8+8)%8, current=Math.floor(position), fraction=position-current;
 const phase=(position/8)*Math.PI*2;
 const offsetY=Math.sin(phase)*3.8;
 const angle=Math.cos(phase)*0.045;
 return {state:'flight',sheet:'hawk-flight',frame:current,next:(current+1)%8,blend:fraction*fraction*(3-2*fraction),angle,offsetY};
}
export function snakeAction(s={},reduced=false) {
 if(reduced)return null;
 if(s.retreat){
   if(!s.dazed)return null;
   const t=Math.max(0,s.retreatTime||0);
   let f;
   if(t<.14) f=0;
   else if(t<.38) f=1;
   else {
     const loop=[3,4,3,4];
     f=loop[Math.floor((t-.38)*4)%loop.length];
   }
   return {state:t<.14?'shield-impact':'stunned',sheet:'snake-stunned',
     frame:f};
 }
 if(s.phase==='watching'||s.phase==='warning')return {state:'alert',sheet:'snake-strike',frame:s.phase==='warning'?1:0};
 if(s.phase==='windup')return {state:'windup',sheet:'snake-strike',frame:2+frame(2,(s.phaseAge||0)/SNAKE_TIMING.windup)};
 if(s.phase==='striking')return {state:'strike',sheet:'snake-strike',frame:4};
 if(s.phase==='recovering')return {state:'recover',sheet:'snake-strike',frame:5};
 return {state:'idle',sheet:'snake-strike',frame:0};
}
