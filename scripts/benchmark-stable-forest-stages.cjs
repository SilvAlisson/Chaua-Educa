// Compare the production stage-2-only composite with the extended settled-stage
// composite in the same Chromium instance. Nothing is disabled in shipped game.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out='test-results/stable-stages';
fs.mkdirSync(out,{recursive:true});
const {chromium}=require('playwright');
const summarize=values=>{
 const a=[...values].sort((x,y)=>x-y);
 return {frames:values.length,meanMs:values.reduce((s,v)=>s+v,0)/values.length,
  p50Ms:a[Math.floor((a.length-1)*.5)],p95Ms:a[Math.floor((a.length-1)*.95)],maxMs:a[a.length-1]};
};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const records=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const x=await page.evaluate(async()=>{
    const summarize=values=>{
     const a=[...values].sort((x,y)=>x-y);
     return {frames:values.length,meanMs:values.reduce((sum,v)=>sum+v,0)/values.length,
      p50Ms:a[Math.floor((a.length-1)*.5)],p95Ms:a[Math.floor((a.length-1)*.95)],maxMs:a[a.length-1]};
    };
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const make=async()=>{
     const canvas=document.createElement('canvas');
     canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(canvas);
     const r=new Renderer(canvas);await r.ready;return r;
    };
    const old=await make(),next=await make();
    const originalMethod=old.prepareFragmentedBackdrop.bind(old);
    old.prepareFragmentedBackdrop=function(forest,light,drift,alpha){
     if(alpha!==.6)return null; // Stage-2 stays exactly as shipped on main.
     return originalMethod(forest,light,drift,alpha);
    };
    const variants={old,next},results=[],g=new Game({seed:104});
    g.state='playing';g.elapsed=45;g.sceneTime=45;g.stageAge=10;
    g.distance=15000;g.y=320;g.wing=.6;
    const trunk={id:1,kind:'wood',x:480,top:160,bottom:460,variant:'branch',snake:{age:2}};
    advanceSnake(trunk,.4,g.x);
    g.entities=[trunk,{id:2,kind:'hawk',x:650,y:255,startX:650,startY:255,targetX:270,targetY:265,age:3,warning:0,dive:false},
      {id:3,kind:'fruit',x:740,y:300,variety:0,collected:false}];
    for(const quality of ['high','low']){
     for(const r of [old,next])r.setQuality(quality);
     for(let stage=0;stage<4;stage++){
      // Render fixed identical backgrounds and exact transitions as controls.
      for(const stageMix of [.4,1])for(const [time,reduced,home] of [[0,false,false],[35,false,false],[77.3,false,false],[90,true,false],[35,false,true]]){
       for(const r of [old,next]){
        r.base();
        r.background(time,15000+time*200,stage,home,reduced,stageMix);
       }
       const a=old.c.getImageData(0,0,old.canvas.width,old.canvas.height).data;
       const b=next.c.getImageData(0,0,next.canvas.width,next.canvas.height).data;
       let diff=0,total=0,over5=0,maximum=0;
       for(let i=0;i<a.length;i++){
        const d=Math.abs(a[i]-b[i]);total+=d;maximum=Math.max(maximum,d);
        if(d){diff++;if(d>5)over5++;}
       }
       const changedStage=stage!==2&&stageMix===1&&!reduced&&!home;
       results.push({stage,quality,stageMix,time,reduced,home,changedStage,
        maxDelta:maximum,mae:total/a.length,over5Fraction:over5/a.length,changedFraction:diff/a.length});
      }
     }
    }
    // Paired time including a readback (to make raster work visible) of real
    // complete scenes with the parrot, snakes, trunks, foliage and effects.
    const performanceResults=[];
    for(let stage=0;stage<4;stage++){
     for(const r of [old,next])r.setQuality('high');
     g.stage=stage;g.stageAge=10;
     const samples={old:[],next:[]};
     for(let i=0;i<90;i++){
      const clock=35+i/60;g.elapsed=clock;g.sceneTime=clock;
      for(const variant of i%2?['next','old']:['old','next']){
       const r=variants[variant],start=performance.now();
       r.game(g,false,clock);
       r.c.getImageData(0,0,1,1);
       if(i>=12)samples[variant].push(performance.now()-start);
      }
     }
     performanceResults.push({stage,baseline:summarize(samples.old),optimized:summarize(samples.next),
      ratio:summarize(samples.next).meanMs/summarize(samples.old).meanMs});
    }
    // Each season repaints the same backing; no repeated 4 MP allocation.
    const surface=next.fragmentedBackdrop?.surface;
    let reusedAcrossStages=!!surface;
    for(const stage of [0,1,2,3]){
     next.base();next.background(40,17000,stage,false,false,1);
     reusedAcrossStages &&= next.fragmentedBackdrop?.surface===surface;
    }
    // Test resizing releases the shared backing and old cache is not retained.
    const originalSize=[next.canvas.width,next.canvas.height];
    const originalResolution=next.resolution;
    next.setQuality('low');
    const released=!!surface&&surface.width===0&&next.fragmentedBackdrop===null;
    next.setQuality(originalResolution);
    const preserved=next.canvas.width===originalSize[0]&&next.canvas.height===originalSize[1];
    return {canvas:originalSize,visual:results,performance:performanceResults,cacheReleased:released,resolutionRestored:preserved,reusedAcrossStages};
   });
   assert.deepEqual(errors,[]);
   assert.ok(x.cacheReleased&&x.resolutionRestored,'canvas resizing failed to release cache');
   assert.ok(x.reusedAcrossStages,'stage change allocated an additional backing surface');
   // New settled stages may have subpixel rounding, but the artistic colors
   // and the old stage-2 image must remain equivalent.
   const changed=x.visual.filter(c=>c.changedStage);
   const untouched=x.visual.filter(c=>!c.changedStage);
   assert.ok(untouched.every(c=>c.maxDelta===0),'Existing paths unexpectedly changed');
   assert.ok(changed.every(c=>c.mae<.8&&c.maxDelta<=36&&c.over5Fraction<.02),
     'Settled stage visual deviation exceeded tolerance: '+JSON.stringify(changed.sort((a,b)=>b.mae-a.mae).slice(0,3)));
   records.push({viewport,...x});
   console.log('STABLE_STAGES_ROW '+JSON.stringify({viewport,visual:{worstMae:Math.max(...changed.map(x=>x.mae)),
    worstDelta:Math.max(...changed.map(x=>x.maxDelta)),
    worstOver5:Math.max(...changed.map(x=>x.over5Fraction)),untouchedCases:untouched.length},performance:x.performance}));
   await page.close();
  }
  fs.writeFileSync(out+'/stable-stages.json',JSON.stringify(records,null,2));
  console.log('STABLE_STAGES_SUMMARY '+JSON.stringify(records.map(r=>({viewport:r.viewport,
   stages:r.performance.map(s=>({stage:s.stage,meanBefore:s.baseline.meanMs,meanAfter:s.optimized.meanMs,ratio:s.ratio}))}))));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
