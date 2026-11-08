import {images} from './assets.mjs';
import {PARTS} from '../assets/v11/parts.mjs';
import {snakeMotion} from './snake-motion.mjs';
import {shapesHitRect} from './collision.mjs';

export function part(c,name,index,x,y,w,h,angle=0){
 const img=images.get('v11-'+name);if(!img)return false;
 const b=PARTS[name][index];c.save();c.translate(x,y);c.rotate(angle);
 c.drawImage(img,index%4*256+b[0],Math.floor(index/4)*256+b[1],b[2],b[3],-w/2,-h/2,w,h);c.restore();return true;
}

export function drawBirdRig(c,name,p={}){
 if(!images.has('v11-'+name))return false;
 const parrot=name==='parrot',t=p.reduced?0:p.time||0;
 const flap=p.reduced?0:parrot?(p.wing>0?Math.sin((1-p.wing)*Math.PI*2):0):p.dive?0:Math.sin(t*8);
 const tail=p.reduced?0:Math.sin(t*2.5)*.04+Math.max(-.12,Math.min(.12,(p.vy||0)/3500));
 const shield=p.reduced||p.shieldHitAge==null?0:Math.sin(Math.min(1,p.shieldHitAge/.25)*Math.PI);
 c.save();
 if(parrot)c.scale(p.scale||1,p.scale||1);
 else c.scale((p.scale||1)*1.65,(p.scale||1)*1.65);
 // Exactly one torso and head. Full-character source cells are never drawn here.
 if(parrot){
  part(c,name,11,-41,9,39,20,tail);
  part(c,name,12,-8,3,66,37);
  part(c,name,15,-8,25,22,14);
  part(c,name,13,27-shield*4,-11-shield*2,39,39);
  part(c,name,8,-18,-5,49,50,-.3-flap*.8+shield*.3);
 }else{
  part(c,name,11,48,0,66,42,tail);
  part(c,name,12,0,0,96,56);
  part(c,name,15,0,32,36,30);
  part(c,name,13,-36,12,60,56);
  part(c,name,8,10,-25,115,120,.2+flap*.65);
 }
 c.restore();return true;
}

export function snakeRigParts(s,reduced=false){
 const p=snakeMotion(s,reduced),dx=p.x*.52,dy=p.y*.52;
 return [
  {i:8,x:0,y:-24,w:151,h:94,a:0},
  {i:9,x:0+dx*.4,y:-58+dy*.4,w:58,h:100,a:p.angle*.4},
  {i:p.mouth>.5?11:10,x:-16+dx,y:-105+dy,w:86,h:58,a:p.angle}
 ];
}

export function drawSnakeRig(c,s,factor,reduced=false){
 if(!images.has('v11-snake'))return false;
 for(const p of snakeRigParts(s,reduced))part(c,'snake',p.i,p.x,p.y,p.w,p.h,p.a);
 return true;
}

export function snakeRigHits(wood,body,reduced=false){
 const origin={x:wood.x+29,y:wood.bottom+20};
 return snakeRigParts(wood.snake,reduced).some(p=>{
  const head=p.i===10||p.i===11,neck=p.i===9;
  const ey=head?20:0,w=neck?125:p.w*.96;
  return shapesHitRect(body,{
   x:origin.x+p.x-w/2,
   y:origin.y+p.y-ey-p.h*.52,
   w:w,
   h:p.h*1.04+ey
  });
 });
}
