export const QUALITY_MODES=['auto','high','low'];
export function canvasResolution(width,height,deviceRatio=1,quality='high'){
 const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
 const ratio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
 const dpr=Math.min(ratio,quality==='low'?1:2,Math.sqrt(4_000_000/(w*h)));
 return {dpr,width:Math.max(1,Math.floor(w*dpr)),height:Math.max(1,Math.floor(h*dpr))};
}
// Sustained thresholds avoid reacting to one delayed frame or rapid quality oscillation.
export class VisualQuality {
 constructor(mode='auto'){this.setMode(mode);}
 setMode(mode){this.mode=QUALITY_MODES.includes(mode)?mode:'auto';this.level=this.mode==='low'?'low':'high';this.resetSamples();}
 resetSamples(){this.slow=0;this.fast=0;}
 sample(seconds,active=true){
  if(!active || !Number.isFinite(seconds) || seconds<=0 || seconds>.1){this.resetSamples();return false;}
  if(this.mode!=='auto')return false;
  this.slow=seconds>1/42?this.slow+seconds:0;
  this.fast=seconds<1/55?this.fast+seconds:0;
  if(this.level==='high'&&this.slow>=2){this.level='low';this.resetSamples();return true;}
  if(this.level==='low'&&this.fast>=12){this.level='high';this.resetSamples();return true;}
  return false;
 }
}
