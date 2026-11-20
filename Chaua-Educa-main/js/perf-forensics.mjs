// Diagnostic data model only; not a separate profiler or background worker.
// Web timings can establish duration and coincidence, NEVER prove GPU upload,
// disk flush, garbage collection or root cause without a matching trace.
const MAX_EVENTS=600, MAX_OPERATIONS=1200, MAX_FRAMES=240, MAX_BROWSER=160;
const finite=x=>Number.isFinite(x)?x:0;
const round=x=>Math.round(x*100)/100;
const pushBounded=(array,item,max)=>{if(array.length===max)array.shift();array.push(item);};
export function overlaps(a,b,begin,end) {
 return a<=end&&b>=begin;
}
export function aggregateOperations(items) {
 const rows=Object.create(null);
 for(const e of items){
  const row=rows[e.name]??(rows[e.name]={count:0,totalMs:0,maxMs:0,over8Ms:0});
  row.count++;row.totalMs+=e.ms;row.maxMs=Math.max(row.maxMs,e.ms);
  if(e.ms>8)row.over8Ms++;
 }
 return Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{...v,totalMs:round(v.totalMs),maxMs:round(v.maxMs)}]));
}
export class ForensicRecorder {
 constructor(now=()=>performance.now()){
  this.now=now;this.clear();
 }
 clear(){
  this.startedAt=this.now();this.events=[];this.operations=[];this.frames=[];
  this.longFrames=[];this.longTasks=[];this.counters=new Map();
  this.stutterFrames=new Map();
  this.stutterOperations=new Map();
  this.stutterEvents=new Map();
  this.firstDraws=new Set();this.currentFrame=null;this.observers=[];this.supportedTypes=[];this.observedTypes=[];
 }
 event(name,details={}){
  pushBounded(this.events,{atMs:round(this.now()),name,...details},MAX_EVENTS);
 }
 begin(name){return this.now();}
 end(name,start,details={}){
  if(!Number.isFinite(start))return 0;
  const ms=Math.max(0,this.now()-start);
  const k=this.counters.get(name)||{count:0,totalMs:0,maxMs:0,over8Ms:0};
  k.count++;k.totalMs+=ms;k.maxMs=Math.max(ms,k.maxMs);
  if(ms>8)k.over8Ms++;
  this.counters.set(name,k);
  if(this.currentFrame){
   this.currentFrame.sections[name]=round((this.currentFrame.sections[name]||0)+ms);
  }
  // Preserve all slow samples and all storage operations for direct evidence;
  // avoid filling the log with 60-Hz fast operations.
  if(ms>=2||name.startsWith('storage.')||name.startsWith('snake.')){
   pushBounded(this.operations,{name,atMs:round(this.now()),ms:round(ms),...details},MAX_OPERATIONS);
  }
  return ms;
 }
 beginFrame(rafTimestamp,stage){
  this.currentFrame={atMs:round(this.now()),rafTimestamp,stage,sections:Object.create(null)};
 }
 endFrame(){
  if(!this.currentFrame)return;
  const f=this.currentFrame;f.cpuMs=round(Math.max(0,this.now()-f.atMs));
  pushBounded(this.frames,f,MAX_FRAMES);
  this.currentFrame=null;
 }
 discardStutter(frame){
  this.stutterFrames.delete(frame);
  this.stutterOperations.delete(frame);
  this.stutterEvents.delete(frame);
 }
 rememberStutter(frame){
  // Save nearby measured CPU work NOW, before a long flight evicts older frames.
  if(this.stutterFrames.size>=160){
   this.stutterFrames.delete(this.stutterFrames.keys().next().value);
  }
  this.stutterFrames.set(frame,this.frames.slice(-6));
  this.stutterOperations.set(frame,this.operations.slice(-30));
  this.stutterEvents.set(frame,this.events.slice(-25));
  while(this.stutterOperations.size>160)this.stutterOperations.delete(this.stutterOperations.keys().next().value);
  while(this.stutterEvents.size>160)this.stutterEvents.delete(this.stutterEvents.keys().next().value);
 }
 firstDraw(name,durationMs){
  if(this.firstDraws.has(name))return;
  this.firstDraws.add(name);
  this.event('first-draw',{asset:name,drawCpuMs:round(durationMs)});
 }
 longFrame(entry){
  if(!entry||!Number.isFinite(entry.startTime))return;
  const scripts=Array.from(entry.scripts||[]).sort((a,b)=>b.duration-a.duration).slice(0,8).map(s=>({
   source:(s.sourceURL||'').split('?')[0].replace(/^https?:\/\/[^/]+/,''),
   function:s.sourceFunctionName||null,invoker:s.invoker||null,
   durationMs:round(finite(s.duration)),
   forcedLayoutMs:round(finite(s.forcedStyleAndLayoutDuration)),
   pauseMs:round(finite(s.pauseDuration))
  }));
  pushBounded(this.longFrames,{
   atMs:round(entry.startTime),durationMs:round(entry.duration),
   blockingMs:round(finite(entry.blockingDuration)),
   styleAndLayoutStartMs:round(finite(entry.styleAndLayoutStart)),
   renderStartMs:round(finite(entry.renderStart)),scripts
  },MAX_BROWSER);
 }
 longTask(entry){
  if(!entry||!Number.isFinite(entry.startTime))return;
  pushBounded(this.longTasks,{atMs:round(entry.startTime),durationMs:round(entry.duration),
   attribution:Array.from(entry.attribution||[]).slice(0,3).map(a=>a.name||a.containerType||'unknown')
  },MAX_BROWSER);
 }
 startBrowserObservers(){
  if(typeof PerformanceObserver==='undefined')return [];
  const supported=PerformanceObserver.supportedEntryTypes||[];
  this.supportedTypes=['long-animation-frame','longtask'].filter(type=>supported.includes(type));
  for(const type of ['long-animation-frame','longtask']){
   if(!supported.includes(type))continue;
   try{
    const observer=new PerformanceObserver(list=>{
     for(const e of list.getEntries()){
      if(e.startTime<this.startedAt)continue;
      if(type==='long-animation-frame')this.longFrame(e);else this.longTask(e);
     }
    });
    observer.observe({type,buffered:false});
    this.observers.push(observer);this.observedTypes.push(type);
   }catch{/* Browser may advertise a type but reject registration. */}
  }
  return [...this.observedTypes];
 }
 stopBrowserObservers(){for(const o of this.observers){try{o.takeRecords?.().forEach(e=>{if(e.entryType==='long-animation-frame')this.longFrame(e);else if(e.entryType==='longtask')this.longTask(e);});}catch{}o.disconnect();}this.observers=[];}
 correlate(stutters){
  return stutters.map(s=>{
   const end=this.startedAt+s.atSeconds*1000;
   const begin=end-s.frameMs;
   const captured=this.stutterFrames.get(s.frame)||[];
   const frames=captured.length?captured:this.frames.filter(x=>overlaps(x.atMs,x.atMs+x.cpuMs,begin-40,end+40)).slice(-6);
   const operations=(this.stutterOperations.get(s.frame)||this.operations).filter(x=>overlaps(x.atMs-x.ms,x.atMs,begin-35,end+35))
    .sort((a,b)=>b.ms-a.ms).slice(0,15);
   const longFrames=this.longFrames.filter(x=>overlaps(x.atMs,x.atMs+x.durationMs,begin-35,end+35)).slice(-5);
   const longTasks=this.longTasks.filter(x=>overlaps(x.atMs,x.atMs+x.durationMs,begin-35,end+35)).slice(-5);
   const recentEvents=(this.stutterEvents.get(s.frame)||this.events)
    .filter(x=>x.atMs>=end-1500&&x.atMs<=end+50).slice(-16);
   // Do not turn a temporal correlation into a causal claim.
   const measured=operations.filter(x=>x.ms>=8);
   const note=measured.length?'measured-js-work-overlap':
     longFrames.length?'browser-long-animation-frame-observed':
     longTasks.length?'browser-long-task-observed':'unattributed';
   return {...s,attributionStatus:note,nearbyMeasuredOperations:measured,
    nearbyLongAnimationFrames:longFrames,nearbyLongTasks:longTasks,
    nearbyGameEvents:recentEvents,nearbyFrameCpu:frames};
  });
 }
 report(stutters){
  return {
   version:2,
   limitations:[
    'Intervals between requestAnimationFrame callbacks include browser scheduling; they are not exclusively JavaScript execution.',
    'Nearby events and script entry points show temporal correlation, not confirmed causality.',
    'Neither GPU upload, garbage collection nor disk flush can be proven by this browser-only JSON.',
    'The reported GPU/heap availability varies by browser and device; absent fields are not zeros.'
   ],
   capabilities:{
    supportedEntryTypes:this.supportedTypes,observerTypes:this.observedTypes,
    longAnimationFramesObserved:this.longFrames.length,longTasksObserved:this.longTasks.length,
    jsHeapReadout:typeof performance!=='undefined'&&
     Number.isFinite(performance.memory?.usedJSHeapSize)
   },
   // Aggregated counters include fast operations; the detailed sample list
   // intentionally retains only noteworthy calls to reduce probe overhead.
   measuredOperations:Object.fromEntries(Array.from(this.counters,([name,row])=>[name,{
    ...row,totalMs:round(row.totalMs),maxMs:round(row.maxMs)
   }])),
   measuredOperationSamples:this.operations,
   gameEvents:this.events,
   detailedRecentFrames:this.frames,
   longAnimationFrames:this.longFrames,
   longTasks:this.longTasks,
   correlatedStutters:this.correlate(stutters),
   counters:Object.fromEntries(Array.from(this.counters,([k,v])=>[k,{
    ...v,totalMs:round(v.totalMs),maxMs:round(v.maxMs)}]))
  };
 }
}
