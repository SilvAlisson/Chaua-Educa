// Visual and performance A/B: baseline direct WebP draw vs cached forest.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
fs.mkdirSync('test-results/forest-cache',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
 const reports=[];
 for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const report=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs'),{images}=await import('/js/assets.mjs');
   const create=async()=>{
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.append(canvas);
    const r=new Renderer(canvas);await r.ready;return r;
   };
   const regular=await create(),cached=await create();
   regular.drawForestLayer=function(img,fw,fh,drift){
    this.c.drawImage(img,(this.w-fw)/2+drift,(this.h-fh)/2,fw,fh);
   };
   const forest=images.get('forest');if(!forest)throw Error('Missing forest image');
   const qualityModes=['high','low'];
   const cases=[];
   for(const quality of qualityModes){
    regular.setQuality(quality);cached.setQuality(quality);
    for(const stage of [0,1,2,3])for(const stageMix of [.35,1])
     for(const [time,reduced] of [[0,false],[33.4,false],[70.1,false],[88,true]]){
      for(const r of [regular,cached]){
       r.base();
       r.background(time,15000+time*240,stage,false,reduced,stageMix);
      }
      const a=regular.c.getImageData(0,0,regular.canvas.width,regular.canvas.height).data;
      const b=cached.c.getImageData(0,0,cached.canvas.width,cached.canvas.height).data;
      let changed=0,max=0,totalDiff=0,within1=0;
      for(let i=0;i<a.length;i++){
       const delta=Math.abs(a[i]-b[i]);
       if(delta){changed++;max=Math.max(max,delta);totalDiff+=delta;if(delta<=1)within1++;}
      }
      cases.push({quality,stage,stageMix,time,reduced,changedChannels:changed,changedFraction:changed/a.length,
        maxDelta:max,meanChannelDelta:totalDiff/a.length,softChanges:within1});
     }
   }
   // A/B pair on the same backing and same 120 input frames.
   for(const r of [regular,cached])r.setQuality('high');
   const samples={regular:[],cached:[]};
   for(let i=0;i<140;i++){
    const order=i%2?[cached,regular]:[regular,cached];
    for(const r of order){
     r.base();
     const start=performance.now();
     r.background(44+i/60,16000+i*275/60,2,false,false,1);
     r.c.getImageData(0,0,1,1);
     if(i>=15)samples[r===cached?'cached':'regular'].push(performance.now()-start);
    }
   }
   const stat=x=>{const y=[...x].sort((a,b)=>a-b);return {count:x.length,meanMs:x.reduce((a,b)=>a+b,0)/x.length,
    medianMs:y[Math.floor(y.length*.5)],p95Ms:y[Math.floor(y.length*.95)],maxMs:y[y.length-1]};};
   const originalCanvas=cached.forestSurface;
   const cacheCreated=!!originalCanvas;
   cached.resize();
   const sameCacheAfterNoop=cached.forestSurface===originalCanvas;
   const extremes=[...cases].sort((a,b)=>b.changedFraction-a.changedFraction).slice(0,5);
   const maximum=Math.max(...cases.map(x=>x.maxDelta));
   const worstFraction=Math.max(...cases.map(x=>x.changedFraction));
   const worstMAE=Math.max(...cases.map(x=>x.meanChannelDelta));
   return {viewport:[regular.canvas.width,regular.canvas.height],cases:cases.length,maximum,worstFraction,worstMAE,
    totalChanged:cases.reduce((sum,x)=>sum+x.changedChannels,0),
    examples:extremes,cacheCreated,sameCacheAfterNoop,
    regular:stat(samples.regular),cached:stat(samples.cached)};
  });
  reports.push({viewport,...report});assert.deepEqual(errors,[]);
  console.log('FOREST_CACHE_ROW '+JSON.stringify({viewport,...report}));
  await page.close();
 }
 fs.writeFileSync('test-results/forest-cache/forest-cache-results.json',JSON.stringify(reports,null,2));
 console.log('FOREST_CACHE_SUMMARY '+JSON.stringify(reports.map(x=>({viewport:x.viewport,baseline:x.regular.meanMs,cached:x.cached.meanMs,speedup:x.regular.meanMs/x.cached.meanMs,maximum:x.maximum,worstFraction:x.worstFraction,worstMAE:x.worstMAE}))));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
