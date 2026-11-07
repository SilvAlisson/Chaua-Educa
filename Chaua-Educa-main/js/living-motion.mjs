import {smoothstep} from './motion.mjs';
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
// Simulation-time motion: pausing never advances weather or secondary animation.
export function breeze(time=0,strength=0,reduced=false,x=0){
 return reduced?0:(.16+.64*clamp(strength))*(.65*Math.sin(time*1.7-x*.002)+.35*Math.sin(time*3.1-x*.003));
}
export function treeBend(time,wind,id,hitAge,reduced=false){
 if(reduced)return 0;
 const recoil=hitAge===null?0:Math.sin(hitAge*24)*Math.exp(-hitAge*7)*.009;
 return breeze(time,wind,false,id*41)*.003+recoil;
}
export function winterAmount(distance){return smoothstep(clamp((distance-17500)/700))*smoothstep(clamp((20200-distance)/700));}
