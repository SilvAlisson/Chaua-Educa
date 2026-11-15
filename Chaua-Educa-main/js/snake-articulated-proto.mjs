// Experimental only. Authored parts + continuous geometry; never imported by the game.
import {snakeAttack} from './attack-patterns.mjs';
import {SNAKE_TIMING} from './animals.mjs';
import {snakePlacement} from './snake-a2.mjs';

export const RIG_PARTS=Object.freeze({
 coil:{x:57,y:204,w:543,h:296},
 neck:{x:855,y:94,w:164,h:459},
 closed:{x:68,y:777,w:480,h:314},
 open:{x:674,y:770,w:506,h:362}
});
export const NECK_SEGMENTS=12;
const clamp=t=>Math.max(0,Math.min(1,Number.isFinite(t)?t:0));
const time=t=>Number.isFinite(t)?Math.max(0,t):0;
const ease=t=>{const u=clamp(t);return u*u*u*(u*(u*6-15)+10);};
const rest={x:-28,y:-242,angle:0};
const alert={x:-22,y:-250,angle:.025};
const ready={frontal:{x:25,y:-225,angle:.10},alto:{x:20,y:-247,angle:.24},varredura:{x:30,y:-200,angle:-.12}};
const reach={frontal:{x:-125,y:-222,angle:-.06},alto:{x:-100,y:-310,angle:.34},varredura:{x:-140,y:-147,angle:-.25}};
const mix=(a,b,t)=>Object.fromEntries(['x','y','angle'].map(k=>[k,a[k]+(b[k]-a[k])*ease(t)]));
let image=null,loading=null;
export function preloadArticulatedSnakeProto(){
 if(image)return Promise.resolve();
 if(loading)return loading;
 loading=(async()=>{
  const img=new Image();
  await new Promise((resolve,reject)=>{
   img.onload=resolve;img.onerror=()=>reject(new Error('Não foi possível carregar as peças da cobra experimental.'));
   img.src=new URL('../public/snake/experimental/rig-parts.webp',import.meta.url).href;
  });
  if(img.decode)await img.decode();
  if(img.naturalWidth!==1254||img.naturalHeight!==1254)throw new Error('Atlas experimental inválido.');
  image=img;
 })().catch(e=>{loading=null;throw e;});
 return loading;
}
export function disposeArticulatedSnakeProto(){image=null;loading=null;}

// Every phase shares endpoints with the next. No interpolation between raster heads.
export function resolveRealSnakeRig(s={},reduced=false){
 const type=Object.hasOwn(ready,s.attackType)?s.attackType:'frontal',timing=snakeAttack(s);
 let head={...rest},mouth=false,breath=1;
 const age=time(s.age),u=time(s.phaseAge);
 if(!reduced){
  if(s.retreat&&s.dazed){
   const t=time(s.retreatTime),onset=ease(t/.12);
   head={x:rest.x+Math.sin(t*9)*9*onset,y:rest.y+Math.sin(t*7)*5*onset,angle:Math.sin(t*9)*.09*onset};
   breath=0;
  }else switch(s.phase){
   case 'warning': {const v=clamp(time(s.warningAge)/SNAKE_TIMING.warning);head=mix(rest,alert,v);breath=1-ease(v);break;}
   case 'windup':head=mix(alert,ready[type],u/timing.windup);breath=0;break;
   case 'striking':head=mix(ready[type],reach[type],u/(timing.strike*.7));mouth=true;breath=0;break;
   case 'recovering': {const v=clamp(u/timing.recovery);head=mix(reach[type],rest,v);mouth=v<.38;breath=ease(v);break;}
  }
  head.x+=Math.sin(age*2.6)*2.5*breath;
  head.y+=Math.sin(age*2.6)*1.8*breath;
 }
 const cs=Math.cos(head.angle),sn=Math.sin(head.angle);
 // Identical socket registration for closed/open heads. Head is a rigid image.
 const socket={x:head.x+43*cs-24*sn,y:head.y+43*sn+24*cs};
 const points=[{x:0,y:-112},{x:55,y:-162},{x:socket.x+26,y:socket.y+40},socket];
 return {head,mouth:!reduced&&mouth,points};
}
export function spinePoint(points,t){
 const u=clamp(t),v=1-u;
 return {x:v*v*v*points[0].x+3*v*v*u*points[1].x+3*v*u*u*points[2].x+u*u*u*points[3].x,
 y:v*v*v*points[0].y+3*v*v*u*points[1].y+3*v*u*u*points[2].y+u*u*u*points[3].y};
}
export function rigNeckNodes(rig){
 return Array.from({length:NECK_SEGMENTS+1},(_,i)=>spinePoint(rig.points,1-i/NECK_SEGMENTS));
}
function part(c,rect,x,y,w,h){c.drawImage(image,rect.x,rect.y,rect.w,rect.h,x,y,w,h);}
export function drawArticulatedSnakeProto(c,s,factor=.52,reduced=false,debug=false){
 if(!image)return false;
 const rig=resolveRealSnakeRig(s,reduced),nodes=rigNeckNodes(rig),neck=RIG_PARTS.neck;
 c.save();c.scale(factor,factor);
 // Texture mapped only onto the neck. Overlap covers subpixel cracks; the face is never sliced.
 for(let i=0;i<NECK_SEGMENTS;i++){
  const a=nodes[i],b=nodes[i+1],length=Math.hypot(b.x-a.x,b.y-a.y),width=49+5*i/NECK_SEGMENTS;
  c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2);
  c.drawImage(image,neck.x,neck.y+neck.h*i/NECK_SEGMENTS,neck.w,neck.h/NECK_SEGMENTS,
   -width/2,-1,width,length+2);c.restore();
 }
 // The coil covers the neck root. No second body hidden under the moving parts.
 part(c,RIG_PARTS.coil,-140,-153,280,153);
 c.save();c.translate(rig.head.x,rig.head.y);c.rotate(rig.head.angle);
 // Both expressions use the same eye and socket position, rather than bounding-box centering.
 if(rig.mouth)part(c,RIG_PARTS.open,-105.3,-39.9,171,122.3);
 else part(c,RIG_PARTS.closed,-86,-50,162,106);
 c.restore();
 if(debug){
  c.strokeStyle='#00f5d4';c.lineWidth=1.5;c.beginPath();
  nodes.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
  for(const p of [rig.points[0],rig.points[3]]){c.beginPath();c.arc(p.x,p.y,5,0,Math.PI*2);c.stroke();}
 }
 c.restore();return true;
}
// These are LAB geometry guides, not production collision masks. No canvas/readback allocation.
export function articulatedSnakeCircles(wood,reduced=false){
 if(!wood?.snake||wood.snake.retreat)return [];
 const place=snakePlacement(wood),rig=resolveRealSnakeRig(wood.snake,reduced),f=place.factor;
 return [{x:place.x,y:place.y-68*f,r:100*f},
  ...rigNeckNodes(rig).filter((_,i)=>i%2===0).map(p=>({x:place.x+p.x*f,y:place.y+p.y*f,r:24*f})),
  {x:place.x+rig.head.x*f,y:place.y+rig.head.y*f,r:55*f}];
}
