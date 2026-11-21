import {ANIMAL_CONTACTS} from './animal-contact-data.mjs';
import {drawWater} from './weather-art.mjs';

const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
// rect is exactly the destination rectangle used for this intact sprite frame.
// Snake peak-strike mirroring is applied here, in the same local coordinates.
export function animalContactPoints({sheet,frame=0,rect,mirror=false}){
 const points=ANIMAL_CONTACTS[sheet]?.[frame];
 if(!points||!rect)return [];
 const cell=sheet==='parrot-flight'?256:sheet==='hawk-flight'?320:384;
 return points.map(([x,y])=>[(rect[0]+x/cell*rect[2])*(mirror?-1:1),rect[1]+y/cell*rect[3]]);
}
export function drawAnimalSurface(c,points,{snow=0,wet=0,snowfall=0,time=0,reduced=false,low=false,load=1}={}){
 const cover=clamp(snow)*clamp(load),water=clamp(wet),count=low?Math.min(2,points.length):points.length;
 if(cover<=.015&&water<=.015&&(reduced||snowfall<=.1))return;
 c.save();c.lineCap='round';
 for(let i=0;i<count;i++){
  const [x,y]=points[i];
  if(cover>.015){
   c.globalAlpha=cover*.55;c.strokeStyle='#e8f4f8';c.lineWidth=.65+cover*.8;
   c.beginPath();c.moveTo(x-1.2-cover,y);c.quadraticCurveTo(x,y-.7,x+1.2+cover,y);c.stroke();
  }
  if(!reduced&&snowfall>.1&&i<(low?1:2)){
   const hit=((time*1.2+i*.43)%1+1)%1;
   if(hit<.30){
    c.globalAlpha=clamp(snowfall)*(1-hit/.30)*.62;c.fillStyle='#eef9fc';
    c.beginPath();c.arc(x,y-Math.max(0,.1-hit)*24,.7,0,Math.PI*2);c.fill();
   }
  }
  if(water>.015){
   c.globalAlpha=water*.48;
   // Existing atlas: formation on the surface, then impact/splash decay.
   const phase=reduced?.35:((time*1.8+i*.37)%1+1)%1;
   drawWater(c,reduced?2:phase<.72?Math.min(4,Math.floor(phase/.72*5)):8+Math.min(3,Math.floor((phase-.72)/.28*4)),x,y+1,4.5);
  }
 }
 c.restore();
}
function isFiniteMatrix(m){return !!(m&&Number.isFinite(m.a)&&Number.isFinite(m.b)&&Number.isFinite(m.c)&&Number.isFinite(m.d)&&Number.isFinite(m.e)&&Number.isFinite(m.f));}
function inverse(m){
 if(!isFiniteMatrix(m))return null;
 const det=m.a*m.d-m.b*m.c;
 return Math.abs(det)<1e-9?null:{a:m.d/det,b:-m.b/det,c:-m.c/det,d:m.a/det,e:(m.c*m.f-m.d*m.e)/det,f:(m.b*m.e-m.a*m.f)/det};
}
function transform(m,x,y){return [m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f];}

// Renderer-owned state only: no physics/entity mutation, RNG or pixel readback.
// Released particles live in world coordinates; subsequent poses cannot drag them.
export class AnimalWeather {
 constructor(){this.actors=new Map();this.particles=[];this.time=null;this.seed=null;this.enabled=false;}
 begin(c,{time=0,seed=0,speed=0,wind=0,snow=0,snowfall=0,wet=0,rain=0,reduced=false,low=false}={}){
  if(this.seed!==seed||this.time!==null&&time<this.time){this.actors.clear();this.particles.length=0;this.time=null;}
  this.dt=this.time===null?0:Math.max(0,Math.min(.16,time-this.time));
  this.time=time;this.seed=seed;this.low=low;this.reduced=reduced;
  this.snow=clamp(snow);this.snowfall=clamp(snowfall);this.wet=clamp(wet);this.rain=clamp(rain);
  this.speed=Number.isFinite(speed)?speed:0;this.wind=Number.isFinite(wind)?wind:0;
  this.worldInverse=inverse(c.getTransform?.());this.enabled=true;
  this.limit=low?8:24;
  if(reduced)this.particles.length=0;
  if(this.particles.length>this.limit)this.particles.length=this.limit;
  for(let i=this.particles.length-1;i>=0;i--){
   const p=this.particles[i];p.age+=this.dt;
   if(p.age>=p.life){this.particles.splice(i,1);continue;}
   p.vy+=p.snow?80*this.dt:200*this.dt;
   p.x+=(p.vx-this.speed+this.wind*8)*this.dt;p.y+=p.vy*this.dt;
  }
  for(const [id,s] of this.actors)if(time-s.seen>1.5)this.actors.delete(id);
 }
 actor(c,{id,pose,moving=false,hidden=false}){
  if(!this.enabled||hidden||this.snow<=.015&&this.wet<=.015&&(this.reduced||this.snowfall<=.1))return;
  const points=animalContactPoints(pose);
  if(!points.length)return;
  let state=this.actors.get(id);
  if(!state){
   if(this.actors.size>=16)return;
   state={seen:this.time,moving:false,load:1,releaseAt:this.time+.8};this.actors.set(id,state);
  }
  // Local dusting gradually returns after a shake; global season deposition
  // remains the ceiling, so no animal appears fully snowy at winter entry.
  state.load=Math.min(1,state.load+this.dt*.45);state.seen=this.time;
  drawAnimalSurface(c,points,{snow:this.snow,snowfall:this.snowfall,wet:this.wet,time:this.time,reduced:this.reduced,low:this.low,load:state.load});
  const shake=moving&&!state.moving;
  const drip=this.rain>.1&&this.time>=state.releaseAt;
  if(!this.reduced&&this.dt>0&&(shake||drip)&&this.worldInverse){
   const matrix=c.getTransform?.();
   if(isFiniteMatrix(matrix)){
    const count=this.low?1:shake?3:1;
    for(let i=0;i<count&&this.particles.length<this.limit;i++){
     const snowy=this.snow*state.load>.12&&(this.wet<.12||i%2===0);
     if(!snowy&&this.wet<.12)continue;
     const [sx,sy]=transform(matrix,...points[(i+state.releaseAt|0)%points.length]);
     const [x,y]=transform(this.worldInverse,sx,sy);
     this.particles.push({x,y,vx:(i-1)*12,vy:shake?-22-i*7:15,age:0,life:snowy?.72:.48,snow:snowy});
    }
    if(shake)state.load*=.3;
   }
   state.releaseAt=this.time+(this.low?1.25:.8);
  }
  state.moving=!!moving;
 }
 draw(c){
  if(!this.enabled)return;
  c.save();
  for(const p of this.particles){
   c.globalAlpha=(1-p.age/p.life)*.66;
   if(p.snow){c.fillStyle='#eaf7fb';c.beginPath();c.arc(p.x,p.y,1.05,0,Math.PI*2);c.fill();}
   else drawWater(c,6+(p.age>p.life*.5?1:0),p.x,p.y,4.5);
  }
  c.restore();this.enabled=false;
 }
}
