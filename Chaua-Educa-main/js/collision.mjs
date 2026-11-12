import {hawkBodyParts} from './hawk-geometry.mjs';
// Convex body shapes exclude decorative feathers, beaks and feet.
// Twenty vertices keep ellipse error below a fraction of a logical pixel.
function ellipse(x,y,rx,ry,angle=0){
 const cos=Math.cos(angle),sin=Math.sin(angle);
 return Array.from({length:20},(_,i)=>{const a=i*Math.PI/10,dx=Math.cos(a)*rx,dy=Math.sin(a)*ry;return {x:x+dx*cos-dy*sin,y:y+dx*sin+dy*cos};});
}
function bodyPart(x,y,dx,dy,rx,ry,angle){
 return ellipse(x+dx*Math.cos(angle)-dy*Math.sin(angle),y+dx*Math.sin(angle)+dy*Math.cos(angle),rx,ry,angle);
}
export function playerShapes(x,y,angle=0){return [bodyPart(x,y,-3,2,16,14,angle),bodyPart(x,y,15,-7,9,10,angle)];}
export function hawkAngle(e){return e.dive?-Math.atan2(e.targetY-e.startY,e.startX-e.targetX):0;}
export function hawkShapes(e){const a=hawkAngle(e);return hawkBodyParts(e).map(([dx,dy,rx,ry])=>bodyPart(e.x,e.y,dx,dy,rx,ry,a));}
export function rectShape({x,y,w,h}){return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];}
export function roundedShape(rect){return ellipse(rect.x+rect.w/2,rect.y+rect.h/2,rect.w/2,rect.h/2);}
export function intersects(a,b){
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],nx=-(q.y-p.y),ny=q.x-p.x;
  let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
  for(const v of a){const n=v.x*nx+v.y*ny;amin=Math.min(amin,n);amax=Math.max(amax,n);}
  for(const v of b){const n=v.x*nx+v.y*ny;bmin=Math.min(bmin,n);bmax=Math.max(bmax,n);}
  if(amax<=bmin||bmax<=amin)return false;
 }
 return true;
}
export const shapesIntersect=(a,b)=>a.some(p=>b.some(q=>intersects(p,q)));
// Shared scratch is safe: collision checks are synchronous and intersects()
// is read-only. Keep exported rectShape() immutable for external callers.
const rectScratch=[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
function polygonOverlapsRectBounds(poly,rect){
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const v of poly){
  if(v.x<minX)minX=v.x;
  if(v.x>maxX)maxX=v.x;
  if(v.y<minY)minY=v.y;
  if(v.y>maxY)maxY=v.y;
 }
 return maxX>rect.x&&minX<rect.x+rect.w&&
        maxY>rect.y&&minY<rect.y+rect.h;
}
export function shapesHitRect(shapes,rect){
 // Broad-phase rejects obvious misses before allocating or projecting
 // anything; still perform the original precise SAT on close contacts.
 let mayHit=false;
 for(const poly of shapes){
  if(polygonOverlapsRectBounds(poly,rect)){mayHit=true;break;}
 }
 if(!mayHit)return false;
 const x=rect.x,y=rect.y,X=x+rect.w,Y=y+rect.h;
 rectScratch[0].x=x;rectScratch[0].y=y;
 rectScratch[1].x=X;rectScratch[1].y=y;
 rectScratch[2].x=X;rectScratch[2].y=Y;
 rectScratch[3].x=x;rectScratch[3].y=Y;
 for(const poly of shapes)if(polygonOverlapsRectBounds(poly,rect)&&intersects(poly,rectScratch))return true;
 return false;
}
