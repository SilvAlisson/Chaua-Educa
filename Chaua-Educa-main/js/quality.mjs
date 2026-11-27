export const QUALITY_MODES=['auto','high','low'];
// Resolution budgets are independent of decoration density. Keep the existing
// presets until visual/performance measurements justify a different budget.
export const RESOLUTION_BUDGETS=Object.freeze({
 high:Object.freeze({maxDpr:2,maxPixels:2_250_000}),
 low:Object.freeze({maxDpr:1,maxPixels:2_250_000})
});
export function canvasResolution(width,height,deviceRatio=1,resolution='high'){
 const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
 const ratio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
 const budget=RESOLUTION_BUDGETS[resolution==='low'?'low':'high'];
 const dpr=Math.min(ratio,budget.maxDpr,Math.sqrt(budget.maxPixels/(w*h)));
 return {dpr,width:Math.max(1,Math.floor(w*dpr)),height:Math.max(1,Math.floor(h*dpr))};
}
const SAMPLE_WINDOW=2, SLOW_FRAME=1/42, SLOW_SHARE=.35, EPSILON=1e-9;
// A RAF interval belongs to the PREVIOUS callback. A single unexplained gap
// gets a bounded allowance, never a reset of the rolling slowdown evidence.
const EXTERNAL_GAP_SECONDS=.09, LIGHT_RAF_MS=8;
export function identicalCanvasBudgets(width,height,dpr){
 const high=canvasResolution(width,height,dpr,'high');
 const low=canvasResolution(width,height,dpr,'low');
 return high.width===low.width && high.height===low.height;
}
// A bounded rolling window counts time spent in slow frames, including active
// stalls. Fast frames cannot erase recurring slowdown; one stall is insufficient.
export class VisualQuality {
 constructor(mode='auto'){
  this.samples=new Float64Array(1024);this.slowSamples=new Uint8Array(1024);
  this.setMode(mode);
 }
 setMode(mode){this.mode=QUALITY_MODES.includes(mode)?mode:'auto';this.level=this.mode==='low'?'low':'high';this.ignoredSchedulingGaps=0;this.previousWorkMs=undefined;this.gapAllowance=1;this.healthySeconds=0;this.resetSamples();}
 // Low-cost frames cannot establish that the high-cost profile is sustainable.
 // Reassess only at a new flight or an explicit setting change, never mid-flight.
 beginFlight(){const previous=this.level;this.setMode(this.mode);return this.level!==previous;}
 resetSamples(){this.head=0;this.count=0;this.windowSeconds=0;this.slowSeconds=0;}
 record(seconds){
  if(this.count===this.samples.length){
   const oldest=this.samples[this.head];
   this.windowSeconds-=oldest;this.slowSeconds-=oldest*this.slowSamples[this.head];
   this.head=(this.head+1)%this.samples.length;this.count--;
  }
  const index=(this.head+this.count)%this.samples.length,slow=Number(seconds>SLOW_FRAME);
  this.samples[index]=seconds;this.slowSamples[index]=slow;this.count++;
  this.windowSeconds+=seconds;this.slowSeconds+=seconds*slow;
  while(this.windowSeconds>SAMPLE_WINDOW&&this.count){
   const removed=Math.min(this.samples[this.head],this.windowSeconds-SAMPLE_WINDOW);
   this.windowSeconds-=removed;this.slowSeconds-=removed*this.slowSamples[this.head];
   this.samples[this.head]-=removed;
   if(this.samples[this.head]<=EPSILON){this.head=(this.head+1)%this.samples.length;this.count--;}
  }
 }
 sample(seconds,active=true,frameWorkMs=undefined){
  if(!active || !Number.isFinite(seconds) || seconds<=0){this.resetSamples();this.previousWorkMs=undefined;this.gapAllowance=1;this.healthySeconds=0;return false;}
  if(this.mode!=='auto')return false;
  const priorWork=this.previousWorkMs;
  this.previousWorkMs=frameWorkMs;
  if(seconds<=SLOW_FRAME){this.healthySeconds+=seconds;if(this.healthySeconds>=2)this.gapAllowance=1;}
  else this.healthySeconds=0;
  if(Number.isFinite(priorWork) && seconds>=EXTERNAL_GAP_SECONDS && priorWork<=LIGHT_RAF_MS && this.gapAllowance>0){
   if(this.level==='high')this.ignoredSchedulingGaps++;
   this.gapAllowance=0;
   // Record a healthy tick so existing samples age normally; repeating long
   // intervals remain eligible even if JavaScript is cheap (GPU is unmeasured).
   seconds=1/60;
  }
  // Match the flight clock's cap, so a single suspended frame cannot dominate.
  seconds=Math.min(seconds,.25);
  if(this.level==='high'){
   this.record(seconds);
   if(this.windowSeconds>=SAMPLE_WINDOW-EPSILON&&this.slowSeconds>=SAMPLE_WINDOW*SLOW_SHARE){
    this.level='low';this.resetSamples();return true;
   }
  }
  return false;
 }
}
