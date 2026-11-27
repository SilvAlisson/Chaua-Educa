import {COLLISION_ART} from './collision-art-data.mjs';
import {FOODS} from './foods.mjs';
import {shapesIntersect,rectShape,intersects} from './collision.mjs';
const scratchPickupPose = {float: 0, pulse: 1, angle: 0, frame: 0};
export function pickupPose(e,time=0,reduced=false,target=null){
 const res = target || (target === false ? scratchPickupPose : {float: 0, pulse: 1, angle: 0, frame: 0});
 res.float = reduced?0:Math.sin(time*2+(e.id??0))*3;
 res.pulse = reduced?1:1+Math.sin(time*3.2+(e.id??0))*.07;
 res.angle = e.kind==='pepper'&&!reduced?Math.sin(time*3+(e.id??0))*.15:0;
 res.frame = reduced?0:Math.floor(Math.max(0,time)*7+(e.id??0))%4;
 return res;
}
export function pickupShapes(e,time=0,reduced=false){
 const p=pickupPose(e,time,reduced,scratchPickupPose),size=e.kind==='fruit'?60:e.kind==='feather'?64:58;
 if(e.kind==='pepper'){
  // The pepper is a code-native drawing; this inset follows its red flesh.
  const points=rectShape({x:-6,y:-10,w:16,h:26}),cos=Math.cos(p.angle),sin=Math.sin(p.angle);
  return [points.map(v=>({x:e.x+(v.x*cos-v.y*sin)*p.pulse,y:e.y+(p.float+v.x*sin+v.y*cos)*p.pulse}))];
 }
 const index=e.kind==='fruit'?(FOODS[e.variety]?.slot??0)*4+p.frame:0;
 const spans=COLLISION_ART.pickups[e.kind]?.[index];
 if(!spans)throw new Error(`Missing current pickup mask: ${e.kind}/${index}`);
 const unit=size/16*p.pulse;
 return spans.map(([col,row,width])=>rectShape({x:e.x+(col-8)*unit,y:e.y+p.float*p.pulse+(row-8)*unit,w:width*unit,h:unit}));
}
// All collision helpers below are synchronous and do not retain their input.
// Reuse narrow-phase geometry; unlike pickupShapes(), this hot path allocates
// nothing after the first call, while preserving the exact authored masks.
const pickupPoseScratch={float:0,pulse:1,angle:0,frame:0};
const playerBoundsScratch=[];
const spanVerticesScratch=[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
const pepperVerticesScratch=[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
const pepperShapeScratch=[pepperVerticesScratch];
const PEPPER_COORDS=[[-6,-10],[10,-10],[10,16],[-6,16]];

export function pickupHitsPlayer(e,player,time=0,reduced=false){
 if(!player.length)return false;
 const p=pickupPose(e,time,reduced,pickupPoseScratch);
 if(e.kind==='pepper'){
  const cos=Math.cos(p.angle),sin=Math.sin(p.angle);
  for(let i=0;i<4;i++){
   const local=PEPPER_COORDS[i],x=local[0],y=local[1];
   pepperVerticesScratch[i].x=e.x+(x*cos-y*sin)*p.pulse;
   pepperVerticesScratch[i].y=e.y+(p.float+x*sin+y*cos)*p.pulse;
  }
  return shapesIntersect(player,pepperShapeScratch);
 }
 const size=e.kind==='fruit'?60:e.kind==='feather'?64:58;
 const index=e.kind==='fruit'?(FOODS[e.variety]?.slot??0)*4+p.frame:0;
 const spans=COLLISION_ART.pickups[e.kind]?.[index];
 if(!spans)throw new Error(`Missing current pickup mask: ${e.kind}/${index}`);
 const unit=size/16*p.pulse,baseY=e.y+p.float*p.pulse;
 const left=e.x-8*unit,right=e.x+8*unit;
 const top=baseY-8*unit,bottom=baseY+8*unit;
 // The current parrot has two polygons, but the pool grows for future art.
 // Read each bird polygon once instead of rescanning it for every fruit span.
 let near=false;
 for(let k=0;k<player.length;k++){
  const poly=player[k];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let v=0;v<poly.length;v++){
   const pt=poly[v];
   if(pt.x<minX)minX=pt.x;if(pt.x>maxX)maxX=pt.x;
   if(pt.y<minY)minY=pt.y;if(pt.y>maxY)maxY=pt.y;
  }
  const b=playerBoundsScratch[k]??(playerBoundsScratch[k]={minX:0,minY:0,maxX:0,maxY:0});
  b.minX=minX;b.minY=minY;b.maxX=maxX;b.maxY=maxY;
  if(maxX>left&&minX<right&&maxY>top&&minY<bottom)near=true;
 }
 if(!near)return false;
 for(let i=0;i<spans.length;i++){
  const span=spans[i];
  const x0=e.x+(span[0]-8)*unit,y0=baseY+(span[1]-8)*unit;
  const x1=x0+span[2]*unit,y1=y0+unit;
  for(let k=0;k<player.length;k++){
   const b=playerBoundsScratch[k];
   if(b.maxX<=x0||b.minX>=x1||b.maxY<=y0||b.minY>=y1)continue;
   spanVerticesScratch[0].x=x0;spanVerticesScratch[0].y=y0;
   spanVerticesScratch[1].x=x1;spanVerticesScratch[1].y=y0;
   spanVerticesScratch[2].x=x1;spanVerticesScratch[2].y=y1;
   spanVerticesScratch[3].x=x0;spanVerticesScratch[3].y=y1;
   if(intersects(player[k],spanVerticesScratch))return true;
  }
 }
 return false;
}
