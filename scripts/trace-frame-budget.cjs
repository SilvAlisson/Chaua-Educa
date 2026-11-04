// Native-RAF diagnostic of frame spikes and backdrop invalidation.
// Read-only instrumentation; no performance heuristics or production changes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const out='test-results/forest-layer-feasibility';
fs.mkdirSync(out,{recursive:true});
const pct=(v,p)=>v.length?[...v].sort((a,b)=>a-b)[Math.floor((v.length-1)*p)]:null;
const summarize=v=>({count:v.length,mean:v.reduce((s,x)=>s+x,0)/Math.max(v.length,1),
 median:pct(v,.5),p95:pct(v,.95),p99:pct(v,.99),max:v.length?Math.max(...v):null,
 over33:v.filter(x=>x>33.33).length,over50:v.filter(x=>x>50).length});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const {Game}=await import('/js/engine.mjs');
   const {advanceSnake}=await import('/js/animals.mjs');
   const canvas=document.createElement('canvas');
   canvas.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none';
   document.body.replaceChildren(canvas);
   const renderer=new Renderer(canvas);await renderer.ready;renderer.setQuality('high');
   const g=new Game({seed:104});g.state='playing';g.y=320;g.wing=.5;
   const wood={id:1,kind:'wood',x:470,top:140,bottom:460,variant:'branch',snake:{age:3}};
   advanceSnake(wood,.4,120);
   g.entities=[wood,{id:2,kind:'hawk',x:750,y:310,startX:750,startY:310,targetX:250,targetY:300,
     warning:0,age:2,dive:false,retreat:false},
     {id:3,kind:'fruit',x:720,y:300,variety:0,collected:false}];
   let flags=null,backgroundCallMs=0;
   const originalBackdrop=renderer.prepareFragmentedBackdrop;
   renderer.prepareFragmentedBackdrop=function(...args){
    const old=this.fragmentedBackdrop;
    const signature=old?[old.surface,old.light,old.forestAlpha,old.sourceDrift]:null;
    const result=originalBackdrop.apply(this,args);
    const next=result?[result.surface,result.light,result.forestAlpha,result.sourceDrift]:null;
    if(flags&&(!signature||!next||signature.some((v,i)=>v!==next[i])))flags.rebuild++;
    return result;
   };
   const originalStaged=renderer.prepareStagedBackdrop;
   renderer.prepareStagedBackdrop=function(...args){
    const old=this.fragmentedBackdrop?.surface;
    const done=this.transitionBackdrop?.rowsDone??0;
    const result=originalStaged.apply(this,args);
    if(flags){
     if(this.transitionBackdrop?.rowsDone!==done)flags.stripe++;
     if(old&&this.fragmentedBackdrop?.surface!==old)flags.published++;
    }
    return result;
   };
   const originalBackground=renderer.background;
   renderer.background=function(...args){
    const begin=performance.now(),result=originalBackground.apply(this,args);
    backgroundCallMs=performance.now()-begin;
    return result;
   };
   const sequences=[
    {name:'open-forest',stage:0,transition:false,seconds:3.5},
    {name:'fragmented-settled',stage:2,transition:false,seconds:5},
    {name:'transition-1-to-2',stage:2,transition:true,seconds:5},
    {name:'transition-2-to-3',stage:3,transition:true,seconds:5}
   ];
   const cases=[];
   for(const config of sequences){
    if(config.transition){
     renderer.transitionBackdrop && (renderer.transitionBackdrop.active=false);
     if(renderer.transitionBackdrop){renderer.transitionBackdrop.target=null;renderer.transitionBackdrop.rowsDone=0;}
     renderer.background(40,15000,config.stage-1,false,false,1);
    }
    const samples=[],longtasks=[];
    let observer;
    if(typeof PerformanceObserver!=='undefined'){
     try{
      observer=new PerformanceObserver(list=>{
       for(const entry of list.getEntries())longtasks.push({start:entry.startTime,ms:entry.duration});
      });
      observer.observe({type:'longtask'});
     }catch{}
    }
    await new Promise(resolve=>{
     let first=0,last=null;
     const callback=now=>{
      if(!first)first=now;
      if(last)samples.push({...last,dt:now-last.time});
      const elapsed=(now-first)/1000;
      const time=40+elapsed;
      g.stage=config.stage;g.stageAge=config.transition?Math.min(4,elapsed):10;
      g.distance=7000*config.stage+250;
      g.sceneTime=g.elapsed=time;
      flags={rebuild:0,stripe:0,published:0};
      const t=performance.now();
      renderer.game(g,false,time);
      last={time:now,drawJsMs:performance.now()-t,backgroundJsMs:backgroundCallMs,
       ...flags,transition:config.transition};
      flags=null;
      if(elapsed<config.seconds)requestAnimationFrame(callback);
      else resolve();
     };
     requestAnimationFrame(callback);
    });
    observer?.disconnect();
    const all=samples.map(s=>s.dt);
    const slow=samples.filter(s=>s.dt>33.33);
    const stable=samples.filter(s=>s.dt<=33.33);
    const anyUpdate=samples.filter(s=>s.rebuild||s.stripe||s.published);
    const noUpdate=samples.filter(s=>!(s.rebuild||s.stripe||s.published));
    const info={name:config.name,stage:config.stage,transition:config.transition,
      frame:summarize(all),drawJS:summarize(samples.map(s=>s.drawJsMs)),
      backgroundJS:summarize(samples.map(s=>s.backgroundJsMs)),
      cache:{rebuild:samples.filter(s=>s.rebuild).length,
       stripes:samples.filter(s=>s.stripe).length,
       publishes:samples.filter(s=>s.published).length,
       updated:summarize(anyUpdate.map(s=>s.dt)),
       unchanged:summarize(noUpdate.map(s=>s.dt))},
      slow:{count:slow.length,
       withCacheUpdate:slow.filter(s=>s.rebuild||s.stripe||s.published).length,
       withoutCacheUpdate:slow.filter(s=>!(s.rebuild||s.stripe||s.published)).length,
       drawJS:summarize(slow.map(s=>s.drawJsMs)),
       backgroundJS:summarize(slow.map(s=>s.backgroundJsMs)),
       examples:slow.slice(0,20)},
      normal:{drawJS:summarize(stable.map(s=>s.drawJsMs))},
      longtasks:longtasks.slice(0,20)};
    cases.push(info);
   }
   return {backing:[renderer.canvas.width,renderer.canvas.height],dpr:renderer.dpr,
    methodology:'RAF interval attributed to preceding draw; render JS timers may omit queued GPU raster/compositing',
    cases};
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/frame-spike-attribution.json',JSON.stringify(result,null,2));
  for(const row of result.cases)console.log('FRAME_SPIKE_CASE '+JSON.stringify({viewport:result.backing,...row}));
  console.log('FRAME_SPIKE_SUMMARY '+JSON.stringify({
   backing:result.backing,cases:result.cases.map(x=>({
    name:x.name,frame:x.frame,drawJS:x.drawJS,backgroundJS:x.backgroundJS,
    cache:x.cache,slow:x.slow.count,slowWithCache:x.slow.withCacheUpdate,slowWithoutCache:x.slow.withoutCacheUpdate
   }))
  }));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
