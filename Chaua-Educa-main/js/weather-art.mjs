import {images} from './assets.mjs';
import {RUNTIME_ART} from './runtime-art-data.mjs';
import {FOREST_ART} from './forest-art-data.mjs';
import {TREE_WIDTH} from './forest-geometry.mjs';
import {treeBend} from './living-motion.mjs';

// Cropped overlays retain original-cell coordinates, including transparent gaps.
export function drawPackedSection(c,family,key,sx,sy,sw,sh,dx,dy,dw,dh){
 const f=RUNTIME_ART[family].frames[key];
 if(!f)return;
 const image=images.get(`runtime-${family}-${f.page}`);
 if(!image)return;
 const ax=f.rect[0],ay=f.rect[1],aw=f.rect[2],ah=f.rect[3],ox=f.offset[0],oy=f.offset[1];
 const x=Math.max(sx,ox),y=Math.max(sy,oy),right=Math.min(sx+sw,ox+aw),bottom=Math.min(sy+sh,oy+ah);
 if(right<=x||bottom<=y)return;
 c.drawImage(image,ax+x-ox,ay+y-oy,right-x,bottom-y,
  dx+(x-sx)*dw/sw,dy+(y-sy)*dh/sh,(right-x)*dw/sw,(bottom-y)*dh/sh);
}
export function drawWater(c,frame,x,y,size=7){
 const f=RUNTIME_ART.fx.frames[`water-${frame}`],im=images.get(`runtime-fx-${f.page}`);
 if(!im)return;
 const w=f.rect[2],h=f.rect[3];
 c.drawImage(im,f.rect[0],f.rect[1],w,h,x-size/2,y-size*h/w/2,size,size*h/w);
}

// Locations measured in the unchanged 512px upper-tree cells (leaf tips/cut rim).
export const UPPER_DRIP_POINTS=Object.freeze([
 [[252,474]],[[468,226],[250,454]],[[175,329],[250,474]],[[115,224],[253,378]]
]);
export function dripOrigin(wood,time,wind=0,out={}){
 const special=wood.fragileSide==='top'?wood.fragileKind:wood.decorSide==='top'?wood.decorKind:null;
 if(special){out.x=wood.x+29;out.y=wood.top+2;return out;}
 const variant=(wood.id||0)%3,f=FOREST_ART.upper[variant];
 const [px,py]=UPPER_DRIP_POINTS[variant][(wood.id||0)%UPPER_DRIP_POINTS[variant].length];
 const scale=TREE_WIDTH/(f.core[1]-f.core[0]),y=wood.top+(py-f.anchor[1])*scale;
 const lean=treeBend(time,wind,wood.id||0,null,false);
 out.x=wood.x+29+(px-f.anchor[0])*scale+lean*(y-wood.top);out.y=y;return out;
}
export class TreeDrips{
 constructor(){this.items=Array.from({length:24},()=>({age:2,active:false}));this.emitters=new Map();this.activeIds=new Set();this.lastTime=undefined;}
 draw(c,game,time,wet,wind,low,reduced,bounds){
  if(this.lastTime===undefined||time<this.lastTime){this.lastTime=time;this.emitters.clear();for(const p of this.items)p.active=false;}
  const dt=Math.max(0,Math.min(.25,time-this.lastTime));this.lastTime=time;
  if(reduced){for(const p of this.items)p.active=false;return;}
  const limit=low?8:24,activeIds=this.activeIds;activeIds.clear();
  for(const wood of game.entities){
   if(wood.kind!=='wood'||wood.broken&&wood.brokenSide==='top'||wood.x<bounds.left-100||wood.x>bounds.right+100)continue;
   const id=wood.id;activeIds.add(id);
   if(!this.emitters.has(id))this.emitters.set(id,time+((id*73)%101)/70);
   const due=this.emitters.get(id);
   if(wet>.035&&dt>0&&time>=due){
    this.emitters.set(id,time+1.1+(1-wet)*2.8+(id%3)*.23);
    let p;for(let i=0;i<limit;i++)if(!this.items[i].active){p=this.items[i];break;}
    if(p){dripOrigin(wood,time,wind,p);Object.assign(p,{active:true,id,age:0,vy:0,splashAge:-1});}
   }
  }
  this.emitters.forEach((_, id) => { if (!activeIds.has(id)) this.emitters.delete(id); });
  for(let i=0;i<this.items.length;i++){
   const p=this.items[i];if(!p.active)continue;
   if(i>=limit){p.active=false;continue;}
   p.age+=dt;
   let wood = null;
   for(let k=0;k<game.entities.length;k++){const ent=game.entities[k];if(ent.id===p.id&&ent.kind==='wood'){wood=ent;break;}}
   if(p.splashAge>=0){
    p.splashAge+=dt;p.x-=game.speed*dt;
    if(p.splashAge>=.28)p.active=false;
    else drawWater(c,8+Math.min(3,Math.floor(p.splashAge/.07)),p.x,p.y,13);
    continue;
   }
   if(p.age<.36){
    if(!wood||wood.broken&&wood.brokenSide==='top'){p.active=false;continue;}
    dripOrigin(wood,time,wind,p);
    drawWater(c,Math.min(4,Math.floor(p.age/.36*5)),p.x,p.y+2,4+p.age*6);
   }else{
    p.vy+=420*dt;p.y+=p.vy*dt;p.x+=(-game.speed+wind*10)*dt;
    if(p.y>= (wood?.bottom??640)-4){
     p.y=(wood?.bottom??640)-3;p.splashAge=0;drawWater(c,8,p.x,p.y,13);
    }else{c.save();c.globalAlpha=Math.min(1,(1.2-p.age)*3);drawWater(c,5,p.x,p.y,5);c.restore();}
   }
   if(p.age>1.2||p.y>bounds.bottom+60)p.active=false;
  }
 }
}
