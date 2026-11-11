import {smoothstep} from './motion.mjs';
import {getWeatherMode} from './weather.mjs';
import {seasonFromFlight} from './climate-timeline.mjs';

// Artistic ambiences along the journey, not a simulation of the local calendar.
const PHASES = [[0,0],[6000,1],[9000,3],[14000,2],[20000,0]];
export function journeySeason(distance) {
 const wm = getWeatherMode();
 if (wm === 'spring') return {from: 0, to: 0, mix: 1};
 if (wm === 'autumn') return {from: 1, to: 1, mix: 1};
 if (wm === 'winter') return {from: 3, to: 3, mix: 1};
 if (wm === 'summer') return {from: 2, to: 2, mix: 1};

 // Active gameplay supplies the Game object (elapsed/mode/seed).
 // Numeric offsets are preserved ONLY for existing render diagnostics,
 // historical captures and standalone API callers during migration.
 if (distance && typeof distance === 'object') {
  if (distance.tutorial) return {from:0,to:0,mix:1};
  return seasonFromFlight(distance);
 }

 let phase=0;
 while(phase+1<PHASES.length && distance>=PHASES[phase+1][0])phase++;
 const to=PHASES[phase][1], from=phase?PHASES[phase-1][1]:to;
 return {from,to,mix:phase?smoothstep((distance-PHASES[phase][0])/1800):1};
}

// Cache only the two visible frames at viewport resolution. Resizing or changing
// quality releases the old surfaces; there is no per-frame atlas resampling.
export class SeasonalBackdrop {
 constructor(){this.frames=new Map();this.key='';this.pending=null;this.prewarmEnabled=true;}
 prepare(atlas,w,h,dpr,distance){
  const state=journeySeason(distance), margin=26;
  const key=`${w}:${h}:${dpr}`;
  if(this.key!==key || this.atlas!==atlas){
   for(const surface of this.frames.values()){surface.width=0;surface.height=0;}
   if(this.pending){this.pending.surface.width=0;this.pending.surface.height=0;}
   this.pending=null;this.frames.clear();this.key=key;this.atlas=atlas;
  }
  const needed=new Set(state.mix===1?[state.to]:[state.from,state.to]);
  const ahead=typeof distance==='number'?distance+900:{...distance,elapsed:(distance.elapsed||0)+10};
  const upcoming=journeySeason(ahead).to;
  if(this.prewarmEnabled && state.mix===1)needed.add(upcoming);
  for(const [id,surface] of this.frames)if(!needed.has(id)){
   surface.width=0;surface.height=0;this.frames.delete(id);
  }
  if(this.pending&&!needed.has(this.pending.id)){
   this.pending.surface.width=0;this.pending.surface.height=0;this.pending=null;
  }
  for(const id of needed)if(!this.frames.has(id)){
   if(this.pending&&this.pending.id!==id){this.pending.surface.width=0;this.pending.surface.height=0;this.pending=null;}
   if(!this.pending){
    const pw=Math.ceil((w+margin*2)*dpr),ph=Math.ceil(h*dpr);
    const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(pw,ph):document.createElement('canvas');
    surface.width=pw;surface.height=ph;
    this.pending={id,surface,ctx:surface.getContext('2d',{alpha:false}),row:0};
   }
   const p=this.pending;
   const visible=id===state.from&&state.mix<1 || id===state.to&&state.mix>0;
   const end=visible?p.surface.height:Math.min(p.surface.height,p.row+96);
   const sw=atlas.naturalWidth/2,sh=Math.floor(atlas.naturalHeight/2),sy=id<2?0:atlas.naturalHeight-sh;
   const scale=Math.max((w+margin*2)/sw,h/sh)*1.08;
   p.ctx.save();p.ctx.setTransform(1,0,0,1,0,0);
   p.ctx.beginPath();p.ctx.rect(0,p.row,p.surface.width,end-p.row);p.ctx.clip();
   p.ctx.setTransform(dpr,0,0,dpr,0,0);
   p.ctx.drawImage(atlas,(id%2)*sw,sy,sw,sh,(w+margin*2-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);
   p.ctx.restore();p.row=end;
   if(end===p.surface.height){this.frames.set(id,p.surface);this.pending=null;}
  }
  return state;
 }
 draw(c,atlas,w,h,dpr,time,distance,reduced){
  const state=this.prepare(atlas,w,h,dpr,distance),margin=26;
  const drift=reduced?0:Math.sin(time*.035)*24;
  c.save();c.setTransform(1,0,0,1,0,0);
  c.globalAlpha=1;
  c.drawImage(this.frames.get(state.mix===1?state.to:state.from),Math.round((drift-margin)*dpr),0);
  if(state.mix<1 && state.mix>0){
   c.globalAlpha=state.mix;
   c.drawImage(this.frames.get(state.to),Math.round((drift-margin)*dpr),0);
  }
  c.restore();
 }
}

export function drawSeasonParticles(c,atlas,w,h,time,distance,reduced,low,wind=0){
 if(reduced || !atlas)return;
 const state=journeySeason(distance);
 const weights=[0,0,0,0];weights[state.from]+=1-state.mix;weights[state.to]+=state.mix;
 const driftOffset=typeof distance==='number'?distance:(distance.distance||0);
 const count=low?7:14, cell=(atlas.naturalWidth||atlas.width)/2;
 const layers=[
  {row: 0, weight: weights[0]},
  {row: 2, weight: weights[1] + weights[2]}
 ];
 for(const {row, weight} of layers){
  if(weight<=0)continue;
  for(let i=0;i<count;i++){
   const baseSize=row===0?32:38;
   const size=baseSize+(i%4)*4;
   const travel=time*(15+i%3*4)+driftOffset*.028;
   const x=w+48-((i*147.7+travel)%(w+96))+Math.sin(time*.9+i)*16;
   const y=((i*97.4+time*(22+i%4*7))%(h+80))-40;
   c.save();c.globalAlpha=Math.min(0.92, weight*.85);
   c.translate(x,y);c.rotate(Math.sin(time*1.1+i)*.65+time*.25+wind*.3);
   // A smooth tumble without swapping unrelated images or snapping scale.
   c.scale(.75+.25*Math.sin(time*1.4+i),1);
   const frame=row+(i%2);
   c.drawImage(atlas,(frame%2)*cell,Math.floor(frame/2)*cell,cell,cell,-size/2,-size/2,size,size);
   c.restore();
  }
 }
}
