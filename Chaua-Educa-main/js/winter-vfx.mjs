// Winter VFX are procedural and use the original character/tree art intact.
// No generated anatomy, no texture allocation per frame, no sprite replacement.
const clamp01=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
const wrap=(v,span)=>((v%span)+span)%span;

// Far and mid-distance snow are drawn beneath the animals. Near-camera flakes
// are sparse and do not compete with fruits, HUD, warning labels or predators.
export function drawSnowfall(c,w,h,time,intensity,reduced=false,low=false,wind=0,foreground=false){
 const amount=clamp01(intensity);
 if(amount<=.012||reduced||w<=0||h<=0)return;
 const layers=foreground?[{depth:1,count:low?6:18}]:
  [{depth:.32,count:low?16:48},{depth:.68,count:low?16:56}];
 c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
 for(const {depth,count} of layers){
  c.fillStyle=depth>.8?'#f7fdff':'#e8f6fa';
  c.globalAlpha=Math.min(.88,amount*(foreground?.78:.56+depth*.30));
  c.beginPath();
  for(let i=0;i<count;i++){
   const seed=(i+1)*137.71+depth*191.43;
   const velocity=(28+depth*74+(i%5)*7);
   const y=wrap(seed*17.31+time*velocity,h+60)-30;
   const sway=Math.sin(time*(.54+depth*.42)+seed)*((1-depth)*12+4);
   const x=wrap(seed*29.17+time*(wind*21+depth*4)+sway,w+60)-30;
   const radius=(foreground?1.45:.95)+depth*(foreground?1.65:1.5)+(i%3)*.12;
   c.moveTo(x+radius,y);
   c.arc(x,y,radius,0,Math.PI*2);
  }
  c.strokeStyle='#527585';c.lineWidth=.8;c.stroke();
  c.fill();
 }
 if(foreground&&!low){
  // A few soft, four-point flakes distinguish snow from rain droplets.
  // No sprite/atlas: four short strokes are batched into one path.
  c.globalAlpha=amount*.6;c.strokeStyle='#f5fcff';c.lineWidth=.8;c.lineCap='round';
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

// Tiny crystals settle on an exposed branch/cap and then fade. Existing winter
// WebP layers supply the substantial snow; these are just contact feedback.
export function drawSnowContact(c,x,y,intensity,time,seed=0,reduced=false,low=false,falling=false){
 const snow=clamp01(intensity);
 if(snow<=.15||reduced)return;
 const count=low?2:4;
 c.save();c.globalAlpha=Math.min(.48,(snow-.15)*.4);
 c.fillStyle='#eaf8fb';c.beginPath();
 for(let i=0;i<count;i++){
  const phase=wrap(time*.23+seed*.17+i*.31,1);
  const sx=x+(i-(count-1)/2)*13+Math.sin(phase*Math.PI*2)*1.8;
  // Downward release from an upper hanging tree must follow gravity.
  // Lower tree caps can collect flakes that flutter just above the surface.
  const sy=falling?y+phase*15:y-2-Math.sin(phase*Math.PI)*3;
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
