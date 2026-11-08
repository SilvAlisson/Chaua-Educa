import {smoothstep} from './motion.mjs';

// Artistic ambiences along the journey, not a simulation of the local calendar.
const PHASES = [[0,0],[6000,1],[9000,3],[14000,2],[20000,0]];
export function journeySeason(distance) {
 let phase=0;
 while(phase+1<PHASES.length && distance>=PHASES[phase+1][0])phase++;
 const to=PHASES[phase][1], from=phase?PHASES[phase-1][1]:to;
 return {from,to,mix:phase?smoothstep((distance-PHASES[phase][0])/1800):1};
}

// Cache only the two visible frames at viewport resolution. Resizing or changing
// quality releases the old surfaces; there is no per-frame atlas resampling.
export class SeasonalBackdrop {
 constructor(){this.frames=new Map();this.key='';}
 draw(c,atlas,w,h,dpr,time,distance,reduced){
  const state=journeySeason(distance), margin=26;
  const key=`${w}:${h}:${dpr}`;
  if(this.key!==key || this.atlas!==atlas){
   for(const surface of this.frames.values()){surface.width=0;surface.height=0;}
   this.frames.clear();this.key=key;this.atlas=atlas;
  }
  const needed=new Set(state.mix===1?[state.to]:[state.from,state.to]);
  for(const [id,surface] of this.frames)if(!needed.has(id)){
   surface.width=0;surface.height=0;this.frames.delete(id);
  }
  for(const id of needed)if(!this.frames.has(id)){
   const pw=Math.ceil((w+margin*2)*dpr), ph=Math.ceil(h*dpr);
   const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(pw,ph):document.createElement('canvas');
   surface.width=pw;surface.height=ph;
   const ctx=surface.getContext('2d',{alpha:false});
   const sw=atlas.naturalWidth/2, sh=Math.floor(atlas.naturalHeight/2);
   const sy=id<2?0:atlas.naturalHeight-sh;
   const scale=Math.max((w+margin*2)/sw,h/sh)*1.08;
   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.drawImage(atlas,(id%2)*sw,sy,sw,sh,(w+margin*2-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);
   this.frames.set(id,surface);
  }
  const drift=reduced?0:Math.sin(time*.035)*24;
  // Draw in logical coordinates. The DPR transform preserves 1:1 physical blits
  // without changing observable draw commands between quality/resolution modes.
  c.save();c.setTransform(dpr,0,0,dpr,0,0);
  c.globalAlpha=1;
  const x=Math.round(drift-margin);
  c.drawImage(this.frames.get(state.mix===1?state.to:state.from),x,0,w+margin*2,h);
  if(state.mix<1 && state.mix>0){
   c.globalAlpha=state.mix;
   c.drawImage(this.frames.get(state.to),x,0,w+margin*2,h);
  }
  c.restore();
 }
}

export function drawSeasonParticles(c,atlas,w,h,time,distance,reduced,low,wind=0){
 if(reduced || !atlas)return;
 const state=journeySeason(distance);
 const weights=[0,0,0,0];weights[state.from]+=1-state.mix;weights[state.to]+=state.mix;
 // Budget shared between seasons: 18 total, even during the final transition.
 const count=low?7:18, cell=atlas.naturalWidth/2;
 for(const season of [0,2]){
  const active=Math.round(count*weights[season]);
  if(!active)continue;
  for(let i=0;i<active;i++){
   const size=(season===0?13:19)+(i%4)*2;
   const travel=time*(14+i%3*3)*(1+wind*2.2)+distance*.025;
   const x=w+32-((i*137.7+travel)%(w+64))+Math.sin(time*.8+i)*9;
   const y=((i*93.4+time*(22+i%4*7))%(h+64))-32;
   c.save();c.globalAlpha=Math.min(.72,.72*weights[season]*count/active);
   c.translate(x,y);c.rotate(Math.sin(time*1.1+i)*.6+time*(.3+wind*.38)+wind*.25);
   c.scale(.72+.28*Math.sin(time*1.4+i),1);
   const frame=season+(i%2);
   c.drawImage(atlas,(frame%2)*cell,Math.floor(frame/2)*cell,cell,cell,-size/2,-size/2,size,size);
   c.restore();
  }
 }
}
