import {SPRITES} from './sprite-data.mjs';
import {SNAKE_TIMING as T} from './animals.mjs';
const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
const REST={x:0,y:0,angle:0,mouth:0},ALERT={x:-3,y:-9,angle:-.025,mouth:0},CURL={x:12,y:5,angle:.055,mouth:0},STRIKE={x:-62,y:-3,angle:-.05,mouth:1};
const mix=(a,b,t)=>Object.fromEntries(Object.keys(REST).map(k=>[k,a[k]+(b[k]-a[k])*smooth(t)]));
export function snakeMotion(s={},reduced=false){
 if(reduced)return {...REST};
 if(s.retreat)return mix(s.retreatPose??REST,{x:10,y:30,angle:.06,mouth:0},(s.retreatTime||0)/.85);
 let p;
 switch(s.phase){
  case 'warning':p=mix(REST,ALERT,(s.warningAge||0)/T.warning);break;
  case 'windup':p=mix(ALERT,CURL,(s.phaseAge||0)/T.windup);break;
  case 'striking':p=mix(CURL,STRIKE,(s.phaseAge||0)/T.strike);break;
  case 'recovering':p=mix(STRIKE,REST,(s.phaseAge||0)/T.recovery);break;
  default:p={...REST};
 }
 // One continuous breathing clock, including across phase boundaries.
 p.y+=Math.sin((s.age||0)*1.8)*1.2;return p;
}
export function deformSnakePoint(x,y,pose){
 const h=SPRITES.snake.frames[0].head,w=smooth((280-y)/100),dx=x-h[0],dy=y-h[1],cos=Math.cos(pose.angle),sin=Math.sin(pose.angle);
 return {x:x+w*(pose.x+dx*cos-dy*sin-dx),y:y+w*(pose.y+dx*sin+dy*cos-dy)};
}
export function deformSnakeRect([x,y,w,h],pose){
 const corners=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>deformSnakePoint(x,y,pose));
 const left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y));
 return {x:left,y:top,w:Math.max(...corners.map(p=>p.x))-left,h:Math.max(...corners.map(p=>p.y))-top};
}
