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
export function hawkShapes(e){const a=hawkAngle(e);return [bodyPart(e.x,e.y,-3,9,18,14,a),bodyPart(e.x,e.y,-29,-7,10,10,a)];}
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
export const shapesHitRect=(shapes,rect)=>shapes.some(p=>intersects(p,rectShape(rect)));
