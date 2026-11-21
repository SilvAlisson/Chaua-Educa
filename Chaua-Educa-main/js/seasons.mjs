import {getWeatherMode,journeyRain,journeyStorm} from './weather.mjs';
import {seasonFromFlight} from './climate-timeline.mjs';
import {drawSnowfall} from './winter-vfx.mjs';
import {activeProbe} from './perf-hooks.mjs';
import {PERF_AB_VARIANT} from './perf-ab.mjs';

export function journeySeason(game) {
 const wm = getWeatherMode();
 if (wm === 'spring') return {from: 0, to: 0, mix: 1};
 if (wm === 'autumn') return {from: 2, to: 2, mix: 1};
 if (wm === 'winter') return {from: 3, to: 3, mix: 1};
 if (wm === 'summer') return {from: 1, to: 1, mix: 1};

 // A single calibrated clock determines every season. Do not accept the
 // historical world-distance argument: it selected an unrelated season order.
 if(!game || typeof game!=='object')
  throw new TypeError('journeySeason requires the current Game flight state');
 if(game.tutorial)return {from:0,to:0,mix:1};
 return seasonFromFlight(game);
}

// Cache only the two visible frames at viewport resolution. Resizing or changing
// quality releases the old surfaces; there is no per-frame atlas resampling.
// Small incremental cache slices keep scene preparation off the critical path.
// The budget is SOFT: a single Canvas draw can take longer than its allowance.
// Visible missing surfaces use an urgent correctness fallback (telemetry recorded).
const DEFAULT_PREWARM_SECONDS=18;
const DEFAULT_SLICE_ROWS=24;
const DEFAULT_BUDGET_MS=1.8;
export class SeasonalBackdrop {
 constructor({prewarmSeconds=DEFAULT_PREWARM_SECONDS,sliceRows=DEFAULT_SLICE_ROWS,
  budgetMs=DEFAULT_BUDGET_MS,now=()=>performance.now()}={}){
  this.frames=new Map();this.key='';this.pending=null;this.prewarmEnabled=true;this.onTelemetry=null;
  this.prewarmSeconds=Math.max(0,prewarmSeconds);
  this.sliceRows=Math.max(1,Math.floor(sliceRows));
  this.budgetMs=Math.max(.1,budgetMs);
  this.now=now;
 }
 release(){
  for(const surface of this.frames.values()){surface.width=0;surface.height=0;}
  if(this.pending){this.pending.surface.width=0;this.pending.surface.height=0;}
  this.pending=null;this.frames.clear();this.key='';this.atlas=null;
 }
 prepare(atlas,w,h,dpr,game){
  const state=journeySeason(game),margin=26;
  const key=`${w}:${h}:${dpr}`;
  if(this.key!==key || this.atlas!==atlas){
   this.onTelemetry?.('cache-reset',{width:w,height:h,dpr});
   this.release();this.key=key;this.atlas=atlas;
  }
  const needed1=state.to,needed2=state.mix===1?-1:state.from;
  if(!this._ahead)this._ahead={elapsed:0,mode:'aventura',seed:0,tutorial:null};
  this._ahead.elapsed=(game.elapsed||0)+this.prewarmSeconds;
  this._ahead.mode=game.mode;
  this._ahead.seed=game.seed;
  this._ahead.tutorial=game.tutorial;
  const needed3=(this.prewarmEnabled && state.mix===1)?journeySeason(this._ahead).to:-1;
  if(!this._needed)this._needed=[0,0,0];
  let neededCount=1;
  this._needed[0]=needed1;
  if(needed2>=0&&needed2!==needed1)this._needed[neededCount++]=needed2;
  if(needed3>=0&&needed3!==needed1&&needed3!==needed2)this._needed[neededCount++]=needed3;
  const isNeeded=id=>id===needed1||(needed2>=0&&id===needed2)||(needed3>=0&&id===needed3);
  this.frames.forEach((surface,id)=>{
   if(!isNeeded(id)){surface.width=0;surface.height=0;this.frames.delete(id);}
  });
  if(this.pending&&!isNeeded(this.pending.id)){
   this.pending.surface.width=0;this.pending.surface.height=0;this.pending=null;
  }
  // Shared per-frame budget covers all speculative surfaces, not each one
  // independently; visible surfaces take priority regardless of budget.
  const budgetStart=this.now();
  for(let ni=0;ni<neededCount;ni++){
   const id=this._needed[ni];
   if(this.frames.has(id))continue;
   if(this.pending&&this.pending.id!==id){
    this.pending.surface.width=0;this.pending.surface.height=0;this.pending=null;
   }
   if(!this.pending){
    const pw=Math.max(1,Math.ceil((w+margin*2)*dpr)),ph=Math.max(1,Math.ceil(h*dpr));
    const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(pw,ph):document.createElement('canvas');
    surface.width=pw;surface.height=ph;
    this.pending={id,surface,ctx:surface.getContext('2d',{alpha:false}),row:0,
     startMs:this.onTelemetry?this.now():0,sliceCount:0,drawMs:0};
    this.onTelemetry?.('surface-start',{seasonId:id,urgent:id===state.from||id===state.to});
   }
   const p=this.pending;
   const visible=(id===state.from&&state.mix<1)||(id===state.to&&state.mix>0);
   if(visible && p.row<p.surface.height)
    this.onTelemetry?.('surface-urgent',{seasonId:id,remainingRows:p.surface.height-p.row});
   const sw=atlas.naturalWidth/2,sh=Math.floor(atlas.naturalHeight/2),sy=id<2?0:atlas.naturalHeight-sh;
   const scale=Math.max((w+margin*2)/sw,h/sh)*1.08;
   // Even if the budget is exhausted, do one forward-progress slice on the
   // speculative target; measuring time after every slice prevents a long loop.
   let processed=0;
   while(p.row<p.surface.height && (visible || !processed || this.now()-budgetStart<this.budgetMs)){
    const firstRow=p.row;
    const end=visible?p.surface.height:Math.min(p.surface.height,p.row+this.sliceRows);
    const probe=activeProbe,sliceAt=probe?probe.begin('render.seasonalSlice'):0;
    const started=this.now();
    p.ctx.save();p.ctx.setTransform(1,0,0,1,0,0);
    p.ctx.beginPath();p.ctx.rect(0,firstRow,p.surface.width,end-firstRow);p.ctx.clip();
    p.ctx.setTransform(dpr,0,0,dpr,0,0);
    p.ctx.drawImage(atlas,(id%2)*sw,sy,sw,sh,(w+margin*2-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);
    p.ctx.restore();
    const cpuMs=this.now()-started;
    p.row=end;p.sliceCount++;p.drawMs+=cpuMs;processed++;
    if(probe)probe.end('render.seasonalSlice',sliceAt,{seasonId:id,rows:end-firstRow,urgent:visible});
    if(p.row===p.surface.height){
     this.frames.set(id,p.surface);
     this.onTelemetry?.('surface-ready',{seasonId:id,
      buildMs:this.onTelemetry?Math.round((this.now()-p.startMs)*100)/100:null,
      drawMs:Math.round(p.drawMs*100)/100,slices:p.sliceCount});
     this.pending=null;
     break;
    }
   }
  }
  return state;
 }
 draw(c,atlas,w,h,dpr,time,game,reduced){
  const probe=activeProbe,prepAt=probe?probe.begin('render.seasonalPrepare'):0;
  const state=this.prepare(atlas,w,h,dpr,game),margin=26;
  if(probe)probe.end('render.seasonalPrepare',prepAt);
  const blitAt=probe?probe.begin('render.seasonalBlit'):0;
  const drift=reduced||PERF_AB_VARIANT==='static-season-bg'?0:Math.sin(time*.035)*24;
  c.save();c.setTransform(1,0,0,1,0,0);
  c.globalAlpha=1;
  c.drawImage(this.frames.get(state.mix===1?state.to:state.from),Math.round((drift-margin)*dpr),0);
  if(state.mix<1 && state.mix>0){
   c.globalAlpha=state.mix;
   c.drawImage(this.frames.get(state.to),Math.round((drift-margin)*dpr),0);
  }
  c.restore();
  if(probe)probe.end('render.seasonalBlit',blitAt);
 }
}

export function drawSeasonParticles(c,atlas,w,h,time,game,reduced,low,wind=0,motion=null){
 if(reduced)return;
 const state=journeySeason(game);
 const wFrom=1-state.mix,wTo=state.mix;
 const weight3=(state.from===3?wFrom:0)+(state.to===3?wTo:0);
 const driftOffset=game.distance||0;
 // Snow shares the exact winter weight used by terrain, animals and lighting.
 // The original atlas contains only petals and leaves, not snow textures.
 drawSnowfall(c,w,h,time,weight3,reduced,low,wind,false,motion);
 if(!atlas)return;
 const cell=(atlas.naturalWidth||atlas.width)/2;
 // Rain and storm are independent weather modes, not seasons. Suppress
 // decorative petals/foliage under severe precipitation instead of silently
 // remapping storm to winter or rain to autumn.
 const rain=journeyRain(game,game.tutorial),storm=journeyStorm(game,game.mode,game.tutorial);
 const r=Math.max(0,Math.min(1,(rain-.5)/.35));
 const t=Math.max(0,Math.min(1,(storm-.3)/.5));
 const suppression=Math.max(r*r*(3-2*r),t*t*(3-2*t));
 const w0=((state.from===0?wFrom:0)+(state.to===0?wTo:0))*(1-suppression);
 const w2=((state.from===2?wFrom:0)+(state.to===2?wTo:0))*(1-suppression*.85);
 if(w0>0){
  const count=low?1:3,layerAlpha=Math.min(0.92,w0*.85);
  for(let i=0;i<count;i++){
   const size=32+(i%4)*4;
   const travel=time*(15+i%3*4)+driftOffset*.028;
   const x=w+48-((i*147.7+travel)%(w+96))+Math.sin(time*.9+i)*16;
   const y=((i*97.4+time*(22+i%4*7))%(h+80))-40;
   c.save();c.globalAlpha=layerAlpha;
   c.translate(x,y);c.rotate(Math.sin(time*1.1+i)*.65+time*.25+wind*.3);
   c.scale(.75+.25*Math.sin(time*1.4+i),1);
   const frame=i%2;
   c.drawImage(atlas,(frame%2)*cell,Math.floor(frame/2)*cell,cell,cell,-size/2,-size/2,size,size);
   c.restore();
  }
 }
 if(w2>0){
  const count=low?7:14,layerAlpha=Math.min(0.92,w2*.85);
  for(let i=0;i<count;i++){
   const size=38+(i%4)*4;
   const travel=time*(15+i%3*4)+driftOffset*.028;
   const x=w+48-((i*147.7+travel)%(w+96))+Math.sin(time*.9+i)*16;
   const y=((i*97.4+time*(22+i%4*7))%(h+80))-40;
   c.save();c.globalAlpha=layerAlpha;
   c.translate(x,y);c.rotate(Math.sin(time*1.1+i)*.65+time*.25+wind*.3);
   c.scale(.75+.25*Math.sin(time*1.4+i),1);
   const frame=2+(i%2);
   c.drawImage(atlas,(frame%2)*cell,Math.floor(frame/2)*cell,cell,cell,-size/2,-size/2,size,size);
   c.restore();
  }
 }
}
