// A/B, diagnostics only. Does a bounded synchronous flush after each eighth
// of the staged backdrop help native RAF, or merely move the same cost?
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const out='test-results/transition-stripe-flush';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try {
  const results=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const report=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const pct=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)]:null;
    const stat=a=>({count:a.length,mean:a.reduce((s,v)=>s+v,0)/Math.max(1,a.length),
     median:pct(a,.5),p95:pct(a,.95),p99:pct(a,.99),max:a.length?Math.max(...a):null,
     over33:a.filter(x=>x>33.33).length,over50:a.filter(x=>x>50).length});
    const newRenderer=async()=>{
     const canvas=document.createElement('canvas');
     canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
     document.body.append(canvas);
     const renderer=new Renderer(canvas);
     await renderer.ready;
     renderer.setQuality('high');
     return renderer;
    };
    const before=await newRenderer(),after=await newRenderer(),flushDurations=[];
    const original=after.prepareStagedBackdrop;
    after.prepareStagedBackdrop=function(...args){
     const pending=this.ensureTransitionBackdrop(),ctx=pending?.c,rows=pending?.rowsDone??0;
     const result=original.apply(this,args);
     if(pending&&ctx&&pending.rowsDone!==rows){
      const t=performance.now();
      ctx.getImageData(0,Math.floor(pending.height*rows/8),1,1);
      flushDurations.push(performance.now()-t);
     }
     return result;
    };
    const g=new Game({seed:104});g.state='playing';g.y=320;g.wing=.55;g.elapsed=35;g.sceneTime=35;
    const wood={id:1,kind:'wood',x:490,top:150,bottom:470,variant:'branch',snake:{age:3}};
    advanceSnake(wood,.4,120);
    g.entities=[wood,{id:2,kind:'hawk',x:700,y:300,startX:700,startY:300,targetX:270,targetY:280,
      warning:0,age:2,dive:false,retreat:false},{id:3,kind:'fruit',x:780,y:300,variety:0,collected:false}];
    const scene=[];
    const comparePixels=()=>{
     const aa=before.c.getImageData(0,0,before.canvas.width,before.canvas.height).data;
     const bb=after.c.getImageData(0,0,after.canvas.width,after.canvas.height).data;
     let diff=0,max=0;
     for(let i=0;i<aa.length;i++){
      const delta=Math.abs(aa[i]-bb[i]);
      if(delta)diff++;
      if(delta>max)max=delta;
     }
     return {changedChannels:diff,maxDelta:max};
    };
    for(const stage of [2,3]){
     for(const r of [before,after]){
      r.background(35,15500,stage-1,false,false,1);
      const pending=r.ensureTransitionBackdrop();
      if(pending){pending.target=null;pending.rowsDone=0;pending.active=false;}
     }
     const samples={before:[],after:[]},visual=[];
     const flushStart=flushDurations.length;
     for(let i=0;i<132;i++){
      const fraction=i/131,clock=35+4*fraction;
      g.stage=stage;g.stageAge=fraction*4;g.sceneTime=g.elapsed=clock;g.distance=stage*7000+250;
      for(const key of i%2?['after','before']:['before','after']){
       const r=key==='after'?after:before;
       const t=performance.now();
       r.game(g,false,clock);
       r.c.getImageData(0,0,1,1);
       if(i>=12)samples[key].push(performance.now()-t);
      }
      if([12,30,66,98,131].includes(i))visual.push({frame:i,...comparePixels()});
     }
     const native={};
     if(window.innerWidth>700){
      for(const key of ['before','after']){
       const r=key==='after'?after:before;
       before.canvas.style.display=key==='before'?'block':'none';
       after.canvas.style.display=key==='after'?'block':'none';
       r.background(40,15500,stage-1,false,false,1);
       const pending=r.ensureTransitionBackdrop();
       if(pending){pending.target=null;pending.rowsDone=0;pending.active=false;}
       const timings=[];
       await new Promise(resolve=>{
        let zero=0,last=0;
        const tick=t=>{
         if(!zero)zero=t;
         if(last)timings.push(t-last);
         last=t;
         const elapsed=(t-zero)/1000;
         g.stage=stage;g.stageAge=Math.min(4,elapsed);g.sceneTime=g.elapsed=45+elapsed;
         r.game(g,false,45+elapsed);
         if(elapsed<4.3)requestAnimationFrame(tick);else resolve();
        };
        requestAnimationFrame(tick);
       });
       native[key]={fps:1000*timings.length/timings.reduce((s,v)=>s+v,0),...stat(timings)};
      }
     }
     scene.push({stage,backing:[before.canvas.width,before.canvas.height],
      syncedStripeCount:flushDurations.length-flushStart,
      syncMs:stat(flushDurations.slice(flushStart)),
      raster:{before:stat(samples.before),after:stat(samples.after)},
      visual,native});
    }
    return {scene};
   });
   assert.deepEqual(errors,[]);
   for(const row of report.scene){
    if(row.backing[0]*row.backing[1]>=1_800_000)
     assert.ok(row.syncedStripeCount>0,'Flush variant did not synchronize staged stripes');
    assert.ok(row.visual.every(x=>x.changedChannels===0&&x.maxDelta===0),
      'Readback-only change must retain exact pixels: '+JSON.stringify(row.visual));
   }
   results.push({viewport,...report});
   console.log('STRIPE_FLUSH_ROW '+JSON.stringify({viewport,...report}));
   await page.close();
  }
  fs.writeFileSync(out+'/summary.json',JSON.stringify(results,null,2));
  console.log('STRIPE_FLUSH_SUMMARY '+JSON.stringify(results.map(r=>({viewport:r.viewport,
   stages:r.scene.map(s=>({stage:s.stage,sync:s.syncMs,
    before:s.raster.before,after:s.raster.after,native:s.native}))}))));
 } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
