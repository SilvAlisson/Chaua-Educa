// Winter VFX are procedural and use the original character/tree art intact.
// No generated anatomy, no texture allocation per frame, no sprite replacement.
const clamp01=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
const wrap=(v,span)=>((v%span)+span)%span;

// Far and mid-distance snow are drawn beneath the animals. Near-camera flakes
// are sparse and do not compete with fruits, HUD, warning labels or predators.
export function drawSnowfall(c,w,h,time,intensity,reduced=false,low=false,wind=0,foreground=false){
 const amount=clamp01(intensity);
 if(amount<=.012||reduced||w<=0||h<=0)return;
 const layers=foreground?[{depth:1,count:low?3:8}]:
  [{depth:.32,count:low?11:24},{depth:.68,count:low?9:23}];
 c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
 for(const {depth,count} of layers){
  c.fillStyle=depth>.8?'#f7fdff':'#e8f6fa';
  c.globalAlpha=Math.min(.72,amount*(foreground?.42:.31+depth*.26));
  c.beginPath();
  for(let i=0;i<count;i++){
   const seed=(i+1)*137.71+depth*191.43;
   const velocity=(28+depth*74+(i%5)*7);
   const y=wrap(seed*17.31+time*velocity,h+60)-30;
   const sway=Math.sin(time*(.54+depth*.42)+seed)*((1-depth)*12+4);
   const x=wrap(seed*29.17+time*(wind*21+depth*4)+sway,w+60)-30;
   const radius=(foreground?1.05:.53)+depth*(foreground?1.35:1.12)+(i%3)*.12;
   c.moveTo(x+radius,y);
   c.arc(x,y,radius,0,Math.PI*2);
  }
  c.fill();
 }
 if(foreground&&!low){
  // A few soft, four-point flakes distinguish snow from rain droplets.
  // No sprite/atlas: four short strokes are batched into one path.
  c.globalAlpha=amount*.34;c.strokeStyle='#f5fcff';c.lineWidth=.8;c.lineCap='round';
  c.beginPath();
  for(let i=0;i<3;i++){
   const seed=(i+1)*241.73;
   const x=wrap(seed*2.17+time*(wind*19+6)+Math.sin(time*.6+i)*7,w+48)-24;
   const y=wrap(seed*3.41+time*(95+i*13),h+48)-24;
   const r=2.7+i*.3;
   c.moveTo(x-r,y);c.lineTo(x+r,y);
   c.moveTo(x,y-r);c.lineTo(x,y+r);
  }
  c.stroke();
 }
 c.restore();
}

// A faint, spatially anchored dusting. Existing character sprites remain the
// source of head, wings, body and tail; this never draws a new silhouette.
const FROST_POINTS=Object.freeze({
 chaua:Object.freeze([[-27,-24,1.8],[-22,-35,1.5],[-5,-30,1.7],[-31,1,1.4]]),
 snake:Object.freeze([[-46,-99,1.4],[-28,-78,1.6],[-14,-48,1.9],[17,-37,1.7]]),
 hawk:Object.freeze([[-27,-46,1.8],[-8,-51,1.7],[24,-32,2],[41,-21,1.2]])
});
export function drawAnimalFrost(c,kind,intensity,scale=1,reduced=false){
 const snow=clamp01(intensity);
 if(snow<=.12||!FROST_POINTS[kind])return;
 const points=FROST_POINTS[kind];
 c.save();
 c.globalAlpha=Math.min(.38,(snow-.12)*.42);
 c.strokeStyle='#e7f4fa';c.lineWidth=Math.max(.55,1.05*scale);c.lineCap='round';
 c.beginPath();
 for(const [x,y,r] of points){
  const px=x*scale,py=y*scale,rx=r*scale;
  c.moveTo(px-rx*2.2,py+rx*.2);
  c.quadraticCurveTo(px,py-rx,px+rx*1.9,py+rx*.1);
 }
 c.stroke();
 if(!reduced&&snow>.5){
  c.globalAlpha=Math.min(.44,(snow-.5)*.55);
  c.fillStyle='#edf9fd';c.beginPath();
  for(let i=0;i<points.length;i+=2){
   const [x,y,r]=points[i],px=x*scale+3*scale,py=y*scale-2*scale;
   c.moveTo(px+r*.36*scale,py);
   c.arc(px,py,Math.max(.6,r*.36*scale),0,Math.PI*2);
  }
  c.fill();
 }
 c.restore();
}

// Tiny crystals settle on an exposed branch/cap and then fade. Existing winter
// WebP layers supply the substantial snow; these are just contact feedback.
export function drawSnowContact(c,x,y,intensity,time,seed=0,reduced=false,low=false){
 const snow=clamp01(intensity);
 if(snow<=.15||reduced)return;
 const count=low?2:4;
 c.save();c.globalAlpha=Math.min(.48,(snow-.15)*.4);
 c.fillStyle='#eaf8fb';c.beginPath();
 for(let i=0;i<count;i++){
  const phase=wrap(time*.23+seed*.17+i*.31,1);
  const sx=x+(i-(count-1)/2)*13+Math.sin(phase*Math.PI*2)*1.8;
  const sy=y-2-Math.sin(phase*Math.PI)*3;
  const r=(.65+(i%2)*.3)*Math.min(1,snow*1.2);
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
 return fraction>.001?[{stage:base,alpha:1},{stage:base+1,alpha:fraction}]:
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

// A flap, dive or snake movement dislodges only a handful of crystals from
// points within the original art. No new head/wing/body is painted and there
// is no emitter state that can desync from paused simulation time.
const SHAKE_ANCHORS=Object.freeze({
 chaua:Object.freeze([[-26,-22],[-11,4],[12,8]]),
 snake:Object.freeze([[-32,-85],[-11,-55],[14,-36]]),
 hawk:Object.freeze([[-28,-30],[4,-37],[30,-19]])
});
export function drawSnowShedding(c,kind,snow,time,activity=0,{scale=1,seed=0,low=false,reduced=false}={}){
 const cold=clamp01(snow),force=clamp01(activity),anchors=SHAKE_ANCHORS[kind];
 if(!anchors||reduced||cold<.32||force<.16||!Number.isFinite(time))return;
 const count=low?2:5,spread=low?9:16;
 c.save();
 c.globalAlpha=Math.min(.55,(cold-.32)*.57*force);
 c.fillStyle='#e5f3f8';
 c.beginPath();
 for(let i=0;i<count;i++){
  const [ax,ay]=anchors[i%anchors.length];
  const variation=wrap((time*.55)+(seed*.063)+(i*.219),1);
  const dx=(-7-variation*spread-(i%2)*4)*scale;
  const dy=(-4-variation*(8+i%3*3))*scale;
  const x=ax*scale+dx,y=ay*scale+dy;
  const radius=Math.max(.36,(1-variation)*(.85+(i%3)*.22)*scale);
  c.moveTo(x+radius,y);
  c.arc(x,y,radius,0,Math.PI*2);
 }
 c.fill();c.restore();
}
