// Diagnostic only: compare scaled forest with the original source at identical
// times, seasons and raster sizes. Report pixel differences and CPU/GPU timing.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='test-results/prescale';
fs.mkdirSync(root,{recursive:true});
(async()=>{
const browser=await chromium.launch({args:['--no-sandbox']});
try{
const results=[];
for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
 const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
 const row=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const make=async enabled=>{
     const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';document.body.append(canvas);
     const r=new Renderer(canvas);await r.ready;r.scaledForestCacheEnabled=enabled;
     r.prepareStagedBackdrop=function(forest,light,drift,alpha){return this.prepareFragmentedBackdrop(forest,light,drift,alpha);};
     return r;
   };
   const baseline=await make(false),candidate=await make(true);
   const cases=[[0,1,28],[1,1,35],[2,.5,46],[2,1,80],[3,.5,95],[3,1,106]];
   const scenes=[];
   for(const [stage,mix,time] of cases){
     for(const r of [baseline,candidate]){r.base();r.background(time,9000,stage,false,false,mix);}
     const a=baseline.c.getImageData(0,0,baseline.canvas.width,baseline.canvas.height).data;
     const b=candidate.c.getImageData(0,0,candidate.canvas.width,candidate.canvas.height).data;
     let sum=0,max=0,changed=0,over5=0;
     for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;if(d>max)max=d;if(d>0)changed++;if(d>5)over5++;}
     scenes.push({stage,mix,time,mae:sum/a.length,max,changedFraction:changed/a.length,over5Fraction:over5/a.length});
   }
   const cache=candidate.forestCache;
   const buffers={canvasPixels:candidate.canvas.width*candidate.canvas.height,forestTexturePixels:cache?cache.pixelW*cache.pixelH:0,additionalMiB:cache?cache.pixelW*cache.pixelH*4/1048576:0,enabled:candidate.scaledForestCacheEnabled};
   const perf=[];
   for(let pass=0;pass<2;pass++){
    for(const r of pass===0?[baseline,candidate]:[candidate,baseline]){
      const name=r===baseline?'baseline':'prescaled';
      r.base();r.background(40,9000,2,false,false,1);
      const durations=[],frames=[];
      let last=null;
      await new Promise(resolve=>{let start=0;
       const tick=now=>{
        if(!start)start=now;
        const elapsed=(now-start)/1000;
        if(last!==null)frames.push(now-last);
        last=now;
        r.base();const t=performance.now();r.background(40+elapsed*18,9000,2,false,false,1);
        r.c.getImageData(0,0,1,1);durations.push(performance.now()-t);
        if(elapsed<2.5)requestAnimationFrame(tick);else resolve();
       };
       requestAnimationFrame(tick);
      });
      const pct=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];
      perf.push({pass,mode:name,frames:frames.length,fps:1000*frames.length/frames.reduce((a,b)=>a+b,0),
       drawMean:durations.reduce((a,b)=>a+b,0)/durations.length,drawP95:pct(durations,.95),drawP99:pct(durations,.99),
       over33:frames.filter(x=>x>33.33).length});
    }
   }
   return {backing:[candidate.canvas.width,candidate.canvas.height],scenes,buffers,perf};
 });
 assert.deepEqual(errors,[]);
 const data={viewport,...row};results.push(data);
 console.log('FOREST_PRESCALE_ROW '+JSON.stringify(data));
 await page.close();
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify(results,null,2));
console.log('FOREST_PRESCALE_SUMMARY '+JSON.stringify(results.map(r=>({
 viewport:r.viewport,buffers:r.buffers,maximumDelta:Math.max(...r.scenes.map(s=>s.max)),
 maximumMAE:Math.max(...r.scenes.map(s=>s.mae)),maximumOver5:Math.max(...r.scenes.map(s=>s.over5Fraction)),
 perf:r.perf}))));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
