import {hawkAction} from './action-states.mjs';
import {hawkUsesActionArt} from './hawk-geometry.mjs';
// The same transforms drive artwork and collision; quality never changes them.
export function playerFlightPlacement({x=0,y=0,angle=0,time=0,wing=0,flapImpulse=0,reduced=false,scale=1.04}={}, target=null){
 if(reduced){
  if(target){target.x=x;target.y=y;target.angle=angle;return target;}
  return {x,y,angle};
 }
 const heave=flapImpulse>0?flapImpulse*Math.sin(flapImpulse*Math.PI)*3.5:0;
 const glide=Math.max(0,1-Math.max(0,wing)*8);
 const ry=y-heave+Math.sin(time*2.6)*.65*scale*glide;
 const ra=angle-(flapImpulse>0?flapImpulse*.04:0)+Math.sin(time*1.9)*.006*glide;
 if(target){target.x=x;target.y=ry;target.angle=ra;return target;}
 return {x,y:ry,angle:ra};
}
export function hawkPresentation(e,time=0,reduced=false,target=null){
 const action=hawkAction(e,time,reduced)??(reduced&&hawkUsesActionArt(e)?{sheet:e.retreat?'hawk-stunned':'hawk-flight',frame:e.retreat?2:0}:null);
 let offsetY=0,angle=0;
 if(!reduced&&!(e.warning>0)&&!e.retreat){
  if(e.dive){
   const span=(e.startX||1)-(e.targetX||0),p=span>0?Math.max(0,Math.min(1,((e.startX||e.x)-e.x)/span)):.5;
   offsetY=Math.sin(p*Math.PI)*7;angle=(p-.5)*.16;
  }else if(!action){offsetY=Math.sin(time*2.8+(e.id||0)*1.5)*3.5;angle=Math.cos(time*2.8+(e.id||0)*1.5)*.035;}
 }
 const finalOffsetY=offsetY+(action?.offsetY||0);
 const finalAngle=angle+(action?.angle||0);
 if(target){target.action=action;target.offsetY=finalOffsetY;target.angle=finalAngle;return target;}
 return {action,offsetY:finalOffsetY,angle:finalAngle};
}
