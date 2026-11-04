// Paired A/B against production's direct background path for stage transitions.
// All comparisons use the same Chromium, backing resolution, forest and time.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const OUTPUT='test-results/transition-composite';
fs.mkdirSync(OUTPUT,{recursive:true});
const summarize=a=>{
 const x=[...a].sort((p,q)=>p-q),at=p=>x[Math.floor((x.length-1)*p)];
 return {frames:a.length,meanMs:a.reduce((s,v)=>s+v,0)/a.length,
  medianMs:at(.5),p95Ms:at(.95),p99Ms:at(.99),maxMs:x[x.length-1],
  framesAbove33Ms:a.filter(v=>v>33.33).length,
  framesAbove50Ms:a.filter(v=>v>50).length};
};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const reports=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const report=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const newRenderer=async()=>{
     const c=document.createElement('canvas');c.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(c);
     const r=new Renderer(c);await r.ready;return r;
    };
    const old=await newRenderer(),candidate=await newRenderer();
    // Baseline is the shipped direct paintSky + scaled-WebP draw whenever
    // stageMix<1. At stageMix=1 it shares the already-optimized cache.
    const original=old.prepareFragmentedBackdrop.bind(old);
    let directTransition=false;
    old.prepareFragmentedBackdrop=(...args)=>directTransition?null:original(...args);
    // Stage 2/3 use a different incremental method. Disable it on the
    // control renderer as well, or we'd compare two buffered candidates.
    old.prepareStagedBackdrop=()=>null;
    const paint=candidate.paintSky.bind(candidate);
    let repaints=0;
    candidate.paintSky=(...args)=>{repaints++;return paint(...args);};
    const staged=candidate.prepareStagedBackdrop.bind(candidate);
    let publications=0;
    candidate.prepareStagedBackdrop=(...args)=>{
     const before=candidate.fragmentedBackdrop?.surface;
     const result=staged(...args);
     if(before&&candidate.fragmentedBackdrop?.surface!==before)publications++;
     return result;
    };
    const qualityCases=[],channels={};
    const snapshots={};
    for(const quality of ['high','low']){
     for(const r of [old,candidate])r.setQuality(quality);
     for(const stage of [0,1,2,3]){
      for(const mix of [0,.007,.125,.249,.499,.501,.749,.991,.999,1]){
       directTransition=mix<1;
       for(const r of [old,candidate]){
        r.base();r.background(42.15+mix,13000+mix*100,stage,false,false,mix);
       }
       // Complete both possible eight-stripe snapshots before checking exact-frame colors.
       // Transition input progression is checked separately below.
       for(let j=0;j<(stage===1?32:16);j++){
        candidate.base();candidate.background(42.15+mix,13000+mix*100,stage,false,false,mix);
       }
       const left=old.c.getImageData(0,0,old.canvas.width,old.canvas.height).data;
       const right=candidate.c.getImageData(0,0,candidate.canvas.width,candidate.canvas.height).data;
       let sum=0,max=0,over5=0,diff=0;
       for(let i=0;i<left.length;i++){
        const d=Math.abs(left[i]-right[i]);sum+=d;
        if(d){diff++;max=Math.max(max,d);if(d>5)over5++;}
       }
       const item={quality,stage,mix,maxDelta:max,mae:sum/left.length,
        over5Fraction:over5/left.length,changedFraction:diff/left.length};
       if(mix===1)item.cacheState={
        oldLight:old.fragmentedBackdrop?.light,
        oldAlpha:old.fragmentedBackdrop?.forestAlpha,
        oldDrift:old.fragmentedBackdrop?.sourceDrift,
        nextLight:candidate.fragmentedBackdrop?.light,
        nextAlpha:candidate.fragmentedBackdrop?.forestAlpha,
        nextDrift:candidate.fragmentedBackdrop?.sourceDrift,
        pendingTarget:candidate.transitionBackdrop?.target,
        pendingRows:candidate.transitionBackdrop?.rowsDone
       };
       qualityCases.push(item);
       if(stage===2&&quality==='high'&&mix===.499){
        snapshots.original=old.canvas.toDataURL('image/png').split(',')[1];
        snapshots.candidate=candidate.canvas.toDataURL('image/png').split(',')[1];
       }
      }
      // Fallback path must remain pixel-identical for menus/reduced motion.
      directTransition=false;
      for(const [home,reduced] of [[true,false],[false,true]]){
       for(const r of [old,candidate]){
        r.base();r.background(47,11000,stage,home,reduced,.45);
       }
       const a=old.c.getImageData(0,0,old.canvas.width,old.canvas.height).data;
       const b=candidate.c.getImageData(0,0,candidate.canvas.width,candidate.canvas.height).data;
       let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;
       qualityCases.push({quality,stage,home,reduced,fallback:true,changed});
      }
     }
    }
    const scenes=[];
    if(innerWidth>=1200){
     const g=new Game({seed:104});
     g.state='playing';g.sceneTime=33;g.elapsed=33;g.stageAge=1;g.y=320;g.wing=.4;g.distance=14000;
     const wood={id:1,kind:'wood',x:500,top:130,bottom:460,variant:'branch',snake:{age:3}};
     advanceSnake(wood,.4,g.x);
     g.entities=[wood,{id:2,kind:'hawk',x:710,y:280,startX:710,startY:280,targetX:260,targetY:280,warning:0,age:2,dive:false},
      {id:3,kind:'fruit',x:780,y:325,variety:0,collected:false}];
     for(const r of [old,candidate])r.setQuality('high');
     for(const stage of [1,2,3]){
      const samples={original:[],candidate:[]},motionSamples=[];
      const beforeRepaints=repaints,beforePublications=publications;
      for(let i=0;i<165;i++){
       const mix=Math.min(1,i/160);
       g.stage=stage;g.stageAge=4*mix;g.sceneTime=33+i/60;g.elapsed=g.sceneTime;
       directTransition=mix<1;
       for(const label of i%2?['candidate','original']:['original','candidate']){
        const r=label==='original'?old:candidate;
        const start=performance.now();
        r.game(g,false,g.sceneTime);
        r.c.getImageData(0,0,1,1);
        if(i>=12)samples[label].push(performance.now()-start);
       }
       if(stage>=2&&i>0&&i<=160&&i%20===0){
        // Sample the ACTUAL displayed frame during a pending tile update.
        const a=old.c.getImageData(0,0,old.canvas.width,old.canvas.height).data;
        const b=candidate.c.getImageData(0,0,candidate.canvas.width,candidate.canvas.height).data;
        let sum=0,max=0,over5=0;
        for(let k=0;k<a.length;k++){
         const d=Math.abs(a[k]-b[k]);sum+=d;max=Math.max(max,d);if(d>5)over5++;
        }
        motionSamples.push({mix,mae:sum/a.length,maxDelta:max,over5Fraction:over5/a.length});
       }
      }
      const sortStat=a=>{
       const x=[...a].sort((p,q)=>p-q),at=p=>x[Math.floor((x.length-1)*p)];
       return {frames:a.length,meanMs:a.reduce((s,v)=>s+v,0)/a.length,
        medianMs:at(.5),p95Ms:at(.95),p99Ms:at(.99),maxMs:x[x.length-1],
        above33:a.filter(t=>t>33.33).length,above50:a.filter(t=>t>50).length};
      };
      scenes.push({stage,original:sortStat(samples.original),candidate:sortStat(samples.candidate),cacheRepaints:repaints-beforeRepaints,cachePublications:publications-beforePublications,motionSamples});
     }
    }
    const stableCacheStates=[];
    if(innerWidth>=1200){
     for(const stage of [1,2,3]){
      candidate.base();candidate.background(47,16000,stage,false,false,.75);
      for(let i=0;i<(stage===1?32:17);i++){
       candidate.base();candidate.background(47,16000,stage,false,false,1);
      }
      stableCacheStates.push({stage,stagedActive:!!candidate.transitionBackdrop?.active});
     }
    }
    const changed=qualityCases.filter(c=>!c.fallback&&c.mix<1),controls=qualityCases.filter(c=>c.fallback||c.mix===1);
    return {backing:[candidate.canvas.width,candidate.canvas.height],stableCacheStates,visual:{
      count:qualityCases.length,
      worstMae:Math.max(...changed.map(c=>c.mae)),
      worstMaxDelta:Math.max(...changed.map(c=>c.maxDelta)),
      worstOver5Fraction:Math.max(...changed.map(c=>c.over5Fraction)),
      worstCases:[...changed].sort((a,b)=>b.mae-a.mae).slice(0,5),
      controlDifferences:controls.filter(c=>c.fallback?c.changed>0:c.maxDelta!==0).length,
      failedControls:controls.filter(c=>c.fallback?c.changed>0:c.maxDelta!==0).slice(0,8)
    },scenes,snapshots};
   });
   console.log('TRANSITION_AB_PRECHECK '+JSON.stringify({viewport,visual:report.visual,
    scenes:report.scenes.map(x=>({stage:x.stage,old:x.original,new:x.candidate,published:x.cachePublications}))}));
   assert.deepEqual(errors,[],'no JavaScript exceptions');
   assert.equal(report.visual.controlDifferences,0,'Stable and reduced-motion/home controls must be exactly unchanged: '+JSON.stringify(report.visual.failedControls));
   assert.ok(report.visual.worstMae<1.1,'Visual mean delta too high: '+report.visual.worstMae);
   assert.ok(report.visual.worstMaxDelta<=40,'One channel changed excessively: '+report.visual.worstMaxDelta);
   assert.ok(report.visual.worstOver5Fraction<.03,'Too many channels visibly changed: '+report.visual.worstOver5Fraction);
   if(viewport.width>=1200){
    assert.deepEqual(report.stableCacheStates,
      [{stage:1,stagedActive:false},{stage:2,stagedActive:true},{stage:3,stagedActive:false}],
      'Opaque stages must leave incremental mode; the translucent forest retains it');
    for(const row of report.scenes){
     assert.ok(row.cachePublications<75,'Transition recomposed too often: '+JSON.stringify(row));
     if(row.stage>=2)for(const sample of row.motionSamples)assert.ok(
      sample.mae<1.4&&sample.maxDelta<=55&&sample.over5Fraction<.035,
      'Transition motion diverged: '+JSON.stringify({stage:row.stage,...sample}));
     if(row.stage>=2)assert.ok(row.candidate.p95Ms<row.original.p95Ms*.85,
      'Recompose spikes still too expensive (p95) in stage '+row.stage+': '+JSON.stringify(row));
     // Software-renderer runners have variable absolute frame costs. Enforce
     // a controlled relative P95 improvement and no >33ms raster frames here.
     // The stricter 16.7ms FULL-frame budget is assessed in native flights.
     if(row.stage===1)assert.ok(
      row.candidate.p95Ms<row.original.p95Ms*.85&&row.candidate.above33===0,
      'First-stage transition has not reduced slow raster frames enough: '+JSON.stringify(row));
     assert.ok(row.candidate.meanMs<row.original.meanMs*.9,'No material transition performance benefit in stage '+row.stage);
    }
   }
   for(const [version,png] of Object.entries(report.snapshots)){
    fs.writeFileSync(OUTPUT+'/'+viewport.width+'x'+viewport.height+'-'+version+'.png',Buffer.from(png,'base64'));
   }
   delete report.snapshots;
   reports.push({viewport,...report});
   console.log('TRANSITION_AB_ROW '+JSON.stringify({viewport,...report}));
   await page.close();
  }
  fs.writeFileSync(OUTPUT+'/metrics.json',JSON.stringify(reports,null,2));
  console.log('TRANSITION_AB_SUMMARY '+JSON.stringify(reports.map(x=>({viewport:x.viewport,visual:x.visual,
   performance:x.scenes.map(s=>({stage:s.stage,old:s.original.meanMs,new:s.candidate.meanMs,
    p95Old:s.original.p95Ms,p95New:s.candidate.p95Ms,repaints:s.cacheRepaints}))}))));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
