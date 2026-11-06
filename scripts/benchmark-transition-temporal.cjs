// Temporal visual check: compare CURRENT on-screen frame to the exact direct
// renderer at every progress increment. Static reference captures alone cannot
// detect color stepping from an eight-frame backdrop update.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path='test-results/transition-composite';
fs.mkdirSync(path,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const reports=[];
  for(const {viewport,automaticLow} of [
   {viewport:{width:1440,height:960}},
   {viewport:{width:390,height:844}},
   {viewport:{width:1440,height:960},automaticLow:true}
  ]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const measurements=await page.evaluate(async automaticLow=>{
    const {Renderer}=await import('/js/render.mjs');
    const {images}=await import('/js/assets.mjs');
    const create=async()=>{
     const canvas=document.createElement('canvas');
     canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(canvas);
     const renderer=new Renderer(canvas);await renderer.ready;renderer.setQuality('high');
     if(automaticLow)renderer.setAutomaticQuality('low');
     const sample=document.createElement('canvas');sample.width=96;sample.height=64;
     return {renderer,sample:sample.getContext('2d',{willReadFrequently:true})};
    };
    const original=await create(),optimized=await create();
    // Renderer.ready waits for the full atlas/WebP set. Accessing images
    // before it resolves was the cause of the false "forest missing" failure.
    const forest=images.get('forest');
    if(!forest||!forest.complete||!forest.naturalWidth)throw Error('forest asset not ready after Renderer.ready');
    original.renderer.prepareStagedBackdrop=()=>null;
    const records=[];
    for(const stage of automaticLow?[3]:[1,2,3]){
     // Prime the exact displayed last frame of the PREVIOUS stage, including
     // its real-time wind displacement. A drift=0 prewarm would falsely mark
     // the first 8 frames as a visual jump, even though gameplay never starts
     // the transition with a reset wind clock.
     for(const object of [original,optimized]){
      const r=object.renderer;
      if(r.transitionBackdrop){
       r.transitionBackdrop.target=null;
       r.transitionBackdrop.rowsDone=0;
       r.transitionBackdrop.active=false;
      }
      r.base();
      r.background(35,15500,stage-1,false,false,1);
     }
     const timeseries=[],n=160;
     let previousOriginal=null,previousOptimized=null;
     for(let i=0;i<=n;i++){
      const mix=i/n,time=35+4*mix,offset=15500+i*4;
      const snapshots=[];
      for(const obj of [original,optimized]){
       const r=obj.renderer;
       r.base();r.background(time,offset,stage,false,false,mix);
       obj.sample.clearRect(0,0,96,64);
       obj.sample.drawImage(r.canvas,0,0,96,64);
       snapshots.push(obj.sample.getImageData(0,0,96,64).data);
      }
      let total=0,large=0,max=0;
      for(let k=0;k<snapshots[0].length;k++){
       const diff=Math.abs(snapshots[0][k]-snapshots[1][k]);
       total+=diff;if(diff>5)large++;max=Math.max(max,diff);
      }
      // Difference of consecutive frames, compared with the original
      // renderer's consecutive-frame changes. This catches visible stepping
      // even if an eventual static image matches the reference exactly.
      let extraDeltaTotal=0,extraDeltaOver5=0,extraDeltaMax=0;
      if(previousOriginal&&previousOptimized){
       for(let k=0;k<snapshots[0].length;k++){
        const referenceMotion=snapshots[0][k]-previousOriginal[k];
        const candidateMotion=snapshots[1][k]-previousOptimized[k];
        const extra=Math.abs(candidateMotion-referenceMotion);
        extraDeltaTotal+=extra;
        if(extra>5)extraDeltaOver5++;
        extraDeltaMax=Math.max(extraDeltaMax,extra);
       }
      }
      timeseries.push({mix,mae:total/snapshots[0].length,over5Fraction:large/snapshots[0].length,maxDelta:max,
       extraMotionMAE:previousOriginal?extraDeltaTotal/snapshots[0].length:null,
       extraMotionOver5Fraction:previousOriginal?extraDeltaOver5/snapshots[0].length:null,
       extraMotionMax:previousOriginal?extraDeltaMax:null});
      previousOriginal=snapshots[0];
      previousOptimized=snapshots[1];
     }
     const sorted=[...timeseries.map(x=>x.mae)].sort((a,b)=>a-b);
     const p=q=>sorted[Math.floor((sorted.length-1)*q)];
     const extraMotion=timeseries.slice(1).map(x=>x.extraMotionMAE);
     const sortedExtra=[...extraMotion].sort((a,b)=>a-b);
     records.push({stage,stripes:optimized.renderer.transitionBackdrop?.stripeCount??0,frames:timeseries.length,meanMAE:timeseries.reduce((s,x)=>s+x.mae,0)/timeseries.length,
      p95MAE:p(.95),maxMAE:sorted[sorted.length-1],maxChannelDelta:Math.max(...timeseries.map(x=>x.maxDelta)),
      maxOver5Fraction:Math.max(...timeseries.map(x=>x.over5Fraction)),
      p95ExtraMotionMAE:sortedExtra[Math.floor((sortedExtra.length-1)*.95)],
      maxExtraMotionMAE:sortedExtra[sortedExtra.length-1],
      worstMotionFrames:[...timeseries].slice(1).sort((a,b)=>b.extraMotionMAE-a.extraMotionMAE).slice(0,6),
      worstFrames:[...timeseries].sort((a,b)=>b.mae-a.mae).slice(0,6)});
    }
    return records;
   },!!automaticLow);
   assert.deepEqual(errors,[]);
   if(automaticLow)assert.equal(measurements[0].stripes,4,'Reduced automatic Refúgio must exercise the four-stripe path');
   for(const result of measurements){
    // An error of 1 is one 8-bit color channel level out of 255.
    // Static and temporal criteria both gate the staged-paint approach.
    assert.ok(result.p95MAE<1.5&&result.maxMAE<1.8,
     'Visible deviation between original and candidate: '+JSON.stringify({viewport,...result}));
    assert.ok(result.p95ExtraMotionMAE<.95&&result.maxExtraMotionMAE<1.5,
     'Frame-to-frame visual stepping detected: '+JSON.stringify({viewport,...result}));
    assert.ok(result.maxOver5Fraction<.05&&result.maxChannelDelta<=50,
     'Localized pixel mismatch is excessive: '+JSON.stringify({viewport,...result}));
   }
   reports.push({viewport,automaticLow:!!automaticLow,measurements});
   console.log('TRANSITION_TEMPORAL_ROW '+JSON.stringify({viewport,automaticLow:!!automaticLow,measurements}));
   console.log('PASS temporal continuity '+JSON.stringify({viewport,automaticLow:!!automaticLow}));
   await page.close();
  }
  fs.writeFileSync(path+'/temporal-visual.json',JSON.stringify(reports,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
