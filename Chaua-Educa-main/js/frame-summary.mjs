// Shared RAF interval statistics. No browser APIs or instrumentation.
const round=(x,n=2)=>Number(x.toFixed(n));
export function summarizeFrames(samples){
 const dt=Array.from(samples,x=>typeof x==='number'?x:x.dt).filter(v=>v>0&&Number.isFinite(v));
 if(!dt.length)return {frames:0,fps:null,onePercentLowFps:null,frameP50Ms:null,frameP95Ms:null,frameP99Ms:null,maxFrameMs:null,framesOver22Ms:0,framesOver33Ms:0,framesOver50Ms:0,framesOver100Ms:0};
 dt.sort((a,b)=>a-b);
 let total=0,over22=0,over33=0,over50=0,over100=0;
 for(const ms of dt){total+=ms;if(ms>22)over22++;if(ms>33.33)over33++;if(ms>50)over50++;if(ms>100)over100++;}
 const pick=p=>round(dt[Math.floor((dt.length-1)*p)],1);
 const worstCount=Math.max(1,Math.ceil(dt.length*.01));
 let worstMs=0;for(let i=dt.length-worstCount;i<dt.length;i++)worstMs+=dt[i];
 return {
  frames:dt.length,
  fps:round(dt.length*1000/total),
  // 1% low: inverse mean frametime of the slowest 1% of complete frames.
  onePercentLowFps:round(1000*worstCount/worstMs),
  frameP50Ms:pick(.5),frameP95Ms:pick(.95),frameP99Ms:pick(.99),
  maxFrameMs:round(dt[dt.length-1],1),
  framesOver22Ms:over22,framesOver33Ms:over33,
  framesOver50Ms:over50,framesOver100Ms:over100
 };
}

