import {SNAKE_TIMING} from './animals.mjs';
// Visual-only state resolver: the 120 Hz simulation, hitboxes and scoring are unchanged.
// Each state is derived from the simulation clock; no per-frame mutable timers.
const clamp = value => Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const frame = (count, progress) => Math.min(count-1,Math.floor(clamp(progress)*count));
export const ACTION_TIMINGS = Object.freeze({parrotImpact:.42,shieldRebound:.30,hawkStun:1.05,hawkRetreat:2,snakeDaze:.85});
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
   return {state:t<.12?'shield-impact':t<1.05?'stunned':'dazed-exit',
      sheet:'hawk-stunned',frame:frame(6,t/ACTION_TIMINGS.hawkStun),
      angle:t<1.5?Math.sin(t*17)*.105*(1-clamp(t/1.5)):0,
      offsetY:t<1.5?Math.sin(t*12)*2.6*(1-clamp(t/1.5)):0};
 }
 if(e.dive||e.phase==='leaving')return null; // preserve authored dive and glide.
 const t=Number.isFinite(time)?time:0;
 return {state:'flight',sheet:'hawk-flight',frame:Math.floor(((t*8+(e.id||0)*1.5)%8+8)%8),angle:0,offsetY:0};
}
export function snakeAction(s={},reduced=false) {
 if(reduced)return null;
 if(s.retreat){
   if(!s.dazed)return null;
   const t=Math.max(0,s.retreatTime||0);
   return {state:t<.14?'shield-impact':'stunned',sheet:'snake-stunned',
     frame:frame(6,t/ACTION_TIMINGS.snakeDaze)};
 }
 if(s.phase==='watching'||s.phase==='warning')return {state:'alert',sheet:'snake-strike',frame:s.phase==='warning'?1:0};
 if(s.phase==='windup')return {state:'windup',sheet:'snake-strike',frame:2+frame(2,(s.phaseAge||0)/SNAKE_TIMING.windup)};
 if(s.phase==='striking')return {state:'strike',sheet:'snake-strike',frame:4};
 if(s.phase==='recovering')return {state:'recover',sheet:'snake-strike',frame:5};
 return {state:'idle',sheet:'snake-strike',frame:0};
}
