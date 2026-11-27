import {COLLISION_ART} from './collision-art-data.mjs';
import {playerFlightPlacement,hawkPresentation} from './actor-placement.mjs';
import {predictedHawkY} from './animals.mjs';
import {hawkBodyParts} from './hawk-geometry.mjs';
// Convex body shapes exclude decorative feathers, beaks and feet.
// Twenty vertices keep ellipse error below a fraction of a logical pixel.
function ellipse(x,y,rx,ry,angle=0,target=null){
 const cos=Math.cos(angle),sin=Math.sin(angle);
 const out=target||new Array(20);
 for(let i=0;i<20;i++){
  const a=i*Math.PI/10,dx=Math.cos(a)*rx,dy=Math.sin(a)*ry;
  const px=x+dx*cos-dy*sin,py=y+dx*sin+dy*cos;
  if(out[i]){out[i].x=px;out[i].y=py;}
  else out[i]={x:px,y:py};
 }
 return out;
}
function bodyPart(x,y,dx,dy,rx,ry,angle,target=null){
 return ellipse(x+dx*Math.cos(angle)-dy*Math.sin(angle),y+dx*Math.sin(angle)+dy*Math.cos(angle),rx,ry,angle,target);
}
const defaultPlacementScratch={x:0,y:0,angle:0};
export function playerShapes(x,y,angle=0,pose=null,target=null){
 let p;
 if(pose){
  if(target){
   pose.x=x;pose.y=y;pose.angle=angle;
   p=playerFlightPlacement(pose,defaultPlacementScratch);
  }else{
   p=playerFlightPlacement({...pose,x,y,angle});
  }
 }else{
  p=target?defaultPlacementScratch:{x,y,angle};
  if(target){p.x=x;p.y=y;p.angle=angle;}
 }
 const bodies=COLLISION_ART.bodies.parrot;
 const out=target||new Array(bodies.length);
 for(let b=0;b<bodies.length;b++){
  const [dx,dy,rx,ry]=bodies[b];
  out[b]=bodyPart(p.x,p.y,dx,dy,rx,ry,p.angle,out[b]);
 }
 return out;
}
export function hawkAngle(e){
 if(e.attackKind)return Math.max(-.65,Math.min(.65,Math.atan((predictedHawkY(e,e.x+1)-predictedHawkY(e,e.x-1))/2)));
 if(e.dive)return -Math.atan2(e.targetY-e.startY,e.startX-e.targetX);
 if(e.ascent){
  const angle=-Math.atan2(e.targetY-e.startY,e.startX-e.targetX)*.65;
  return Math.max(-.28,Math.min(.28,angle));
 }
 return 0;
}
const hawkPresScratch={action:null,offsetY:0,angle:0};
export function hawkShapes(e,time=0,reduced=false,target=null){
 const p=hawkPresentation(e,time,reduced,hawkPresScratch),a=(e.retreat?0:hawkAngle(e))+p.angle;
 const parts=hawkBodyParts(e);
 const out=target||new Array(parts.length);
 out.length=parts.length;
 for(let i=0;i<parts.length;i++){
  const [dx,dy,rx,ry]=parts[i];
  out[i]=bodyPart(e.x,e.y+p.offsetY,dx,dy,rx,ry,a,out[i]);
 }
 return out;
}
export function rectShape({x,y,w,h}){return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];}
export function intersects(a,b){
 for(let k=0;k<2;k++){
  const poly=k===0?a:b;
  for(let i=0;i<poly.length;i++){
   const p=poly[i],q=poly[(i+1)%poly.length],nx=-(q.y-p.y),ny=q.x-p.x;
   let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
   for(let j=0;j<a.length;j++){const v=a[j],n=v.x*nx+v.y*ny;if(n<amin)amin=n;if(n>amax)amax=n;}
   for(let j=0;j<b.length;j++){const v=b[j],n=v.x*nx+v.y*ny;if(n<bmin)bmin=n;if(n>bmax)bmax=n;}
   if(amax<=bmin||bmax<=amin)return false;
  }
 }
 return true;
}
function polyOverlapsPoly(a,b){
 let aMinX=Infinity,aMaxX=-Infinity,aMinY=Infinity,aMaxY=-Infinity;
 for(let i=0;i<a.length;i++){
  const v=a[i];
  if(v.x<aMinX)aMinX=v.x;if(v.x>aMaxX)aMaxX=v.x;
  if(v.y<aMinY)aMinY=v.y;if(v.y>aMaxY)aMaxY=v.y;
 }
 let bMinX=Infinity,bMaxX=-Infinity,bMinY=Infinity,bMaxY=-Infinity;
 for(let i=0;i<b.length;i++){
  const v=b[i];
  if(v.x<bMinX)bMinX=v.x;if(v.x>bMaxX)bMaxX=v.x;
  if(v.y<bMinY)bMinY=v.y;if(v.y>bMaxY)bMaxY=v.y;
 }
 return aMaxX>bMinX&&aMinX<bMaxX&&aMaxY>bMinY&&aMinY<bMaxY;
}
export function shapesIntersect(a,b){
 for(let i=0;i<a.length;i++){
  const p=a[i];
  for(let j=0;j<b.length;j++){
   const q=b[j];
   if(polyOverlapsPoly(p,q)&&intersects(p,q))return true;
  }
 }
 return false;
}
// Shared scratch is safe: collision checks are synchronous and intersects()
// is read-only. Keep exported rectShape() immutable for external callers.
const rectScratch=[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
function polygonOverlapsRectBounds(poly,rect){
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(let i=0;i<poly.length;i++){
  const v=poly[i];
  if(v.x<minX)minX=v.x;
  if(v.x>maxX)maxX=v.x;
  if(v.y<minY)minY=v.y;
  if(v.y>maxY)maxY=v.y;
 }
 return maxX>rect.x&&minX<rect.x+rect.w&&
        maxY>rect.y&&minY<rect.y+rect.h;
}
export function shapesHitRect(shapes,rect){
 // One sweep per polygon: test AABB and exact SAT together. Previously
 // close calls rescanned 20-point polygons twice before reaching SAT.
 // RectScratch is initialized lazily so distant objects stay cheap.
 const x=rect.x,y=rect.y,X=x+rect.w,Y=y+rect.h;
 let prepared=false;
 for(const poly of shapes){
  if(!polygonOverlapsRectBounds(poly,rect))continue;
  if(!prepared){
   rectScratch[0].x=x;rectScratch[0].y=y;
   rectScratch[1].x=X;rectScratch[1].y=y;
   rectScratch[2].x=X;rectScratch[2].y=Y;
   rectScratch[3].x=x;rectScratch[3].y=Y;
   prepared=true;
  }
  if(intersects(poly,rectScratch))return true;
 }
 return false;
}
