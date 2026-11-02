import {SPRITES} from './sprite-data.mjs';
import {snakeMotion,deformSnakePoint} from './snake-motion.mjs';

function triangle(c,image,src,dst){
 const [a,b,d]=src,[p,q,r]=dst,den=(b.x-a.x)*(d.y-a.y)-(d.x-a.x)*(b.y-a.y);
 const A=((q.x-p.x)*(d.y-a.y)-(r.x-p.x)*(b.y-a.y))/den,B=((q.y-p.y)*(d.y-a.y)-(r.y-p.y)*(b.y-a.y))/den;
 const C=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(d.x-a.x))/den,D=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(d.x-a.x))/den;
 const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
 // Subpixel overlap prevents antialiasing cracks between adjacent triangles.
 const edge=dst.map(v=>{const dx=v.x-center.x,dy=v.y-center.y,len=Math.hypot(dx,dy);return {x:v.x+dx/len*.35,y:v.y+dy/len*.35};});
 c.save();c.beginPath();c.moveTo(edge[0].x,edge[0].y);c.lineTo(edge[1].x,edge[1].y);c.lineTo(edge[2].x,edge[2].y);c.closePath();c.clip();
 c.transform(A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y);c.drawImage(image,0,0,384,384,0,0,384,384);c.restore();
}
function drawMesh(c,image,s,factor){
 const data=SPRITES.snake,pose=snakeMotion(s,false);
 const project=({x,y})=>{const p=deformSnakePoint(x,y,pose);return {x:(p.x-192)*factor,y:(p.y-328)*factor};};
 const rows=[0,180,190,200,210,220,230,240,250,260,270,280,384];
 for(let i=0;i<rows.length-1;i++){
  const top=rows[i],bottom=rows[i+1],v=[{x:0,y:top},{x:384,y:top},{x:384,y:bottom},{x:0,y:bottom}];
  for(const indices of [[0,1,2],[0,2,3]]){const src=indices.map(j=>v[j]);triangle(c,image,src,src.map(project));}
 }
 if(pose.mouth>0){
  const h=data.frames[0].head,open=data.frames[10],o=open.head,scale=h[2]/o[2];
  c.save();c.translate((h[0]-192+pose.x)*factor,(h[1]-328+pose.y)*factor);c.rotate(pose.angle);c.scale(factor,factor);
  c.beginPath();c.ellipse(-16,23,40,23,0,0,Math.PI*2);c.clip();c.globalAlpha*=pose.mouth;
  c.drawImage(image,...open.rect,-o[0]*scale,-o[1]*scale,384*scale,384*scale);c.restore();
 }
}

let surface;
export function drawContinuousSnake(c,image,s,factor,reduced=false){
 if(!image)return;
 if(reduced){c.drawImage(image,...SPRITES.snake.frames[0].rect,-192*factor,-328*factor,384*factor,384*factor);return;}
 if(!surface&&typeof OffscreenCanvas!=='undefined')surface=new OffscreenCanvas(512,512);
 if(!surface&&typeof document!=='undefined'){surface=document.createElement('canvas');surface.width=surface.height=512;}
 if(!surface){drawMesh(c,image,s,factor);return;}
 const layer=surface.getContext('2d');layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,512,512);layer.setTransform(2,0,0,2,256,256);layer.globalAlpha=1;layer.globalCompositeOperation='source-over';
 drawMesh(layer,image,s,factor);c.drawImage(surface,-128,-128,256,256);
}
