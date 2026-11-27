import {createArtSurface} from './art-surface.mjs';
import {PERF_AB_VARIANT} from './perf-ab.mjs';

// Winter VFX are procedural and use the original character/tree art intact.
// No generated anatomy, no texture allocation per frame, no sprite replacement.
const clamp01=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
const wrap=(v,span)=>((v%span)+span)%span;

// In real browsers, blitting pre-rendered soft particles avoids Skia MSAA
// promotion and full-screen stencil clip allocations triggered by arc()/clip().
let snowSpriteSheet=null;
function getSnowSpriteSheet(){
 if(snowSpriteSheet)return snowSpriteSheet;
 if(typeof document==='undefined')return null;
 const canvas=createArtSurface();
 canvas.width=48;canvas.height=16;
 const sc=canvas.getContext('2d');
 if(!sc)return null;
 // Cell 0: round background/foreground snow flake (8,8 radius 5 inside 16x16 cell).
 sc.fillStyle='#ffffff';
 sc.beginPath();sc.arc(8,8,5,0,Math.PI*2);sc.fill();
 // Cell 1: crisp 4-point foreground star flake at (24,8).
 sc.strokeStyle='#f5fcff';sc.lineWidth=1.5;sc.lineCap='round';
 sc.beginPath();
 sc.moveTo(19,8);sc.lineTo(29,8);
 sc.moveTo(24,3);sc.lineTo(24,13);
 sc.stroke();
 // Cell 2: contact ice crystal dot at (40,8) in #eaf8fb.
 sc.fillStyle='#eaf8fb';
 sc.beginPath();sc.arc(40,8,5,0,Math.PI*2);sc.fill();
 snowSpriteSheet=canvas;
 return snowSpriteSheet;
}
function isFullSurfaceViewport(c,w,h){
 if(typeof document==='undefined'||!c?.canvas||typeof c.getTransform!=='function')return false;
 const m=c.getTransform();
 return m.b===0&&m.c===0&&Math.abs(m.e)<=1&&Math.abs(m.f)<=1&&
  Math.abs(w*m.a-c.canvas.width)<=2&&Math.abs(h*m.d-c.canvas.height)<=2;
}
export function prewarmWinterVfx(c){
 const sheet=getSnowSpriteSheet();
 if(!c||!sheet||typeof c.drawImage!=='function')return;
 c.save();
 c.setTransform(1,0,0,1,0,0);
 c.globalAlpha=0.004;
 c.drawImage(sheet,0,0,4,4,0,0,2,2);
 c.restore();
}

// Far and mid-distance snow are drawn beneath the animals. Near-camera flakes
// are sparse and do not compete with fruits, HUD, warning labels or predators.
const FOREGROUND_LAYERS_NORMAL = Object.freeze([{depth: 1, count: 18}]);
const FOREGROUND_LAYERS_LOW = Object.freeze([{depth: 1, count: 6}]);
const BACKGROUND_LAYERS_NORMAL = Object.freeze([{depth: .32, count: 48}, {depth: .68, count: 56}]);
const BACKGROUND_LAYERS_LOW = Object.freeze([{depth: .32, count: 16}, {depth: .68, count: 16}]);

export function drawSnowfall(c,w,h,time,intensity,reduced=false,low=false,wind=0,foreground=false,motion=null){
 const amount=clamp01(intensity);
 if(amount<=.012||reduced||w<=0||h<=0||PERF_AB_VARIANT==='snow-flakes-off')return;
 const layers=foreground?(low?FOREGROUND_LAYERS_LOW:FOREGROUND_LAYERS_NORMAL):
  (low?BACKGROUND_LAYERS_LOW:BACKGROUND_LAYERS_NORMAL);
 const sheet=typeof c.drawImage==='function'?getSnowSpriteSheet():null;
 const sprites=PERF_AB_VARIANT==='compact-batched-flakes'?null:sheet;
 const needClip=!sheet||!isFullSurfaceViewport(c,w,h);
 c.save();
 if(needClip){c.beginPath();c.rect(0,0,w,h);c.clip();}
 for(const {depth,count} of layers){
  c.globalAlpha=Math.min(.96,amount*(foreground?.90:.70+depth*.25));
  if(sprites){
   for(let i=0;i<count;i++){
    const seed=(i+1)*137.71+depth*191.43;
    const velocity=(28+depth*74+(i%5)*7);
    const y=wrap(seed*17.31+time*velocity,h+60)-30;
    const sway=Math.sin(time*(.54+depth*.42)+seed)*((1-depth)*12+4);
    const x=wrap(seed*29.17+(motion?.wind??time*wind)*21+time*depth*4+sway,w+60)-30;
    const radius=(foreground?1.45:.95)+depth*(foreground?1.65:1.5)+(i%3)*.12;
    const size=radius*3.2;
    c.drawImage(sprites,0,0,16,16,x-size*.5,y-size*.5,size,size);
   }
   continue;
  }
  c.fillStyle='#ffffff';
  c.beginPath();
  for(let i=0;i<count;i++){
   const seed=(i+1)*137.71+depth*191.43;
   const velocity=(28+depth*74+(i%5)*7);
   const y=wrap(seed*17.31+time*velocity,h+60)-30;
   const sway=Math.sin(time*(.54+depth*.42)+seed)*((1-depth)*12+4);
   const x=wrap(seed*29.17+(motion?.wind??time*wind)*21+time*depth*4+sway,w+60)-30;
   const radius=(foreground?1.45:.95)+depth*(foreground?1.65:1.5)+(i%3)*.12;
   c.moveTo(x+radius,y);
   c.arc(x,y,radius,0,Math.PI*2);
  }
  c.fill();
 }
 if(foreground&&!low){
  // A few soft, four-point flakes distinguish snow from rain droplets.
  c.globalAlpha=amount*.6;
  if(sprites){
   for(let i=0;i<6;i++){
    const seed=(i+1)*241.73;
    const x=wrap(seed*2.17+(motion?.wind??time*wind)*19+time*6+Math.sin(time*.6+i)*7,w+48)-24;
    const y=wrap(seed*3.41+time*(95+i*13),h+48)-24;
    const r=2.7+i*.3;
    const size=r*3.2;
    c.drawImage(sprites,16,0,16,16,x-size*.5,y-size*.5,size,size);
   }
  }else{
   c.strokeStyle='#f5fcff';c.lineWidth=.8;c.lineCap='round';
   c.beginPath();
   for(let i=0;i<6;i++){
    const seed=(i+1)*241.73;
    const x=wrap(seed*2.17+(motion?.wind??time*wind)*19+time*6+Math.sin(time*.6+i)*7,w+48)-24;
    const y=wrap(seed*3.41+time*(95+i*13),h+48)-24;
    const r=2.7+i*.3;
    c.moveTo(x-r,y);c.lineTo(x+r,y);
    c.moveTo(x,y-r);c.lineTo(x,y+r);
   }
   c.stroke();
  }
 }
 c.restore();
}

// Grow coverage instead of fading the whole snow sheet through translucent white.
// Stable column delays give an uneven edge; every column grows downward and
// reaches the exact authored extent at full cover. No RNG or pixel readback.
export function snowRevealHeight(intensity,column=0){
 const amount=clamp01(intensity);
 const progress=1-Math.pow(1-amount,1.6);
 const delay=((Math.imul(column+1,73)>>>0)%101)/101*.18;
 return clamp01((progress-delay)/(1-delay));
}
// Cache clipping geometry for visually identical snow-masks. The old path
// allocation was repeated once PER visible trunk and frame.
const revealPaths=new Map(),REVEAL_PATH_LIMIT=192;
export function clipSnowReveal(c,x,y,width,height,intensity){
 const columns=32;
 if(!c.gpu&&typeof Path2D!=='undefined'&&PERF_AB_VARIANT!=='legacy-snow-clips'){
  const step=Math.round(clamp01(intensity)*256);
  const key=`${x}:${y}:${width}:${height}:${step}`;
  let path=revealPaths.get(key);
  if(!path){
   path=new Path2D();
   for(let i=0;i<columns;i++){
    const reach=snowRevealHeight(intensity,i);
    if(reach>0)path.rect(x+i*width/columns,y,width/columns,height*reach);
   }
   if(revealPaths.size>=REVEAL_PATH_LIMIT)revealPaths.delete(revealPaths.keys().next().value);
   revealPaths.set(key,path);
  }
  c.clip(path);return;
 }
 c.beginPath();
 for(let i=0;i<columns;i++){
  const reach=snowRevealHeight(intensity,i);
  if(reach>0)c.rect(x+i*width/columns,y,width/columns,height*reach);
 }
 c.clip();
}

// Visible contact crystals supplement the authored snow without covering the
// flight corridor. Low detail keeps the same contrast with fewer particles.
export function drawSnowContact(c,x,y,intensity,time,seed=0,reduced=false,low=false,falling=false){
 const snow=clamp01(intensity);
 if(snow<=.15||reduced)return;
 const count=low?2:4;
 const sprites=typeof c.drawImage==='function'?getSnowSpriteSheet():null;
 c.save();c.globalAlpha=Math.min(.92,.55+(snow-.15)*.44);
 if(sprites){
  for(let i=0;i<count;i++){
   const phase=wrap(time*.23+seed*.17+i*.31,1);
   const sx=x+(i-(count-1)/2)*13+Math.sin(phase*Math.PI*2)*1.8;
   const sy=falling?y+phase*15:y-2-Math.sin(phase*Math.PI)*3;
   const r=(1.25+(i%2)*.45)*(.7+snow*.3);
   const size=r*3.2;
   c.drawImage(sprites,32,0,16,16,sx-size*.5,sy-size*.5,size,size);
  }
  c.restore();
  return;
 }
 c.fillStyle='#eaf8fb';c.beginPath();
 for(let i=0;i<count;i++){
  const phase=wrap(time*.23+seed*.17+i*.31,1);
  const sx=x+(i-(count-1)/2)*13+Math.sin(phase*Math.PI*2)*1.8;
  // Downward release from an upper hanging tree must follow gravity.
  // Lower tree caps can collect flakes that flutter just above the surface.
  const sy=falling?y+phase*15:y-2-Math.sin(phase*Math.PI)*3;
  const r=(1.25+(i%2)*.45)*(.7+snow*.3);
  c.moveTo(sx+r,sy);
  c.arc(sx,sy,r,0,Math.PI*2);
 }
 c.fill();c.restore();
}

export function winterOverlayStages(intensity){
 const level=clamp01(intensity)*4;
 const base=Math.floor(level);
 const fraction=level-base;
 if(base>=4)return [{stage:4,alpha:1}];
 if(base===0)return fraction>.001?[{stage:1,alpha:fraction}]:[];
 return fraction>.001?[{stage:base,alpha:1-fraction},{stage:base+1,alpha:fraction}]:
  [{stage:base,alpha:1}];
}


// Cold breath never replaces an existing animal sprite: this function only
// schedules the original four-frame clay-breath.webp VFX, independently for
// each animal, according to the same winter weight as the scenery.
const BREATH_PROFILES=Object.freeze({
 chaua:Object.freeze({period:2.85,duration:.34,speedX:18,liftY:-9,offset:0,sizeMultiplier:.90}),
 snake:Object.freeze({period:3.65,duration:.28,speedX:13,liftY:-8,offset:.83,sizeMultiplier:.74}),
 hawk:Object.freeze({period:4.15,duration:.23,speedX:21,liftY:-7,offset:1.71,sizeMultiplier:.72})
});
export function winterBreathSettings(kind,snow,time,{reduced=false,low=false,activity=0,seed=0}={}){
 const cfg=BREATH_PROFILES[kind],cold=clamp01(snow),motion=clamp01(activity);
 if(!cfg||!Number.isFinite(time)||cold<=.18||reduced||motion>.88)return null;
 // Sparse VFX in low detail; in high detail use two staggered original
 // atlas puffs. Fast movement makes vapor less intense, not more opaque.
 const period=cfg.period*(low?1.22:1);
 const shifted=time+cfg.offset+(Number.isFinite(seed)?seed*.017:0);
 const phase=wrap(shifted/period,1);
 if(phase>=cfg.duration)return null;
 const strength=Math.min(.68,(cold-.18)/.82*.56)*(1-motion*.68)*(low?.75:1);
 if(strength<=.015)return null;
 return {strength,time:shifted,period,duration:cfg.duration,
  speedX:cfg.speedX,liftY:cfg.liftY,puffs:low?1:2,sizeMultiplier:cfg.sizeMultiplier};
}
