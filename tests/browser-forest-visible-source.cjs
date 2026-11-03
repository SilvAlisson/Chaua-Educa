// Controlled experiment: source-window crop of the moving forest WebP.
// Normal game rendering is untouched unless and until pixel parity and A/B pass.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const reports=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const report=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {images}=await import('/js/assets.mjs');
    const make=async()=>{
     const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(canvas);
     const r=new Renderer(canvas);await r.ready;return r;
    };
    const before=await make(),candidate=await make();
    const forest=images.get('forest');
    if(!forest)throw Error('Forest is unavailable after assets loaded');
    const original=candidate.c.drawImage.bind(candidate.c);
    let sourcePixelsFraction=1;
    candidate.c.drawImage=function(image,...args){
     if(image!==forest||args.length!==4)return original(image,...args);
     const [x,y,w,h]=args,margin=3/candidate.dpr;
     const x0=Math.max(0,Math.min(1,(-margin-x)/w)),x1=Math.max(0,Math.min(1,(candidate.w+margin-x)/w));
     const y0=Math.max(0,Math.min(1,(-margin-y)/h)),y1=Math.max(0,Math.min(1,(candidate.h+margin-y)/h));
     if(x0>=x1||y0>=y1)return;
     sourcePixelsFraction=(x1-x0)*(y1-y0);
     return original(image,x0*forest.naturalWidth,y0*forest.naturalHeight,
      (x1-x0)*forest.naturalWidth,(y1-y0)*forest.naturalHeight,
      x+x0*w,y+y0*h,(x1-x0)*w,(y1-y0)*h);
    };
    let cases=0,changed=0,maxDelta=0;
    for(const quality of ['high','low'])for(let stage=0;stage<4;stage++)
     for(const mix of [.3,1])for(const reduced of [false,true]){
      for(const r of [before,candidate]){
       r.setQuality(quality);r.base();r.background(44,9000,stage,false,reduced,mix);
      }
      const a=before.c.getImageData(0,0,before.canvas.width,before.canvas.height).data;
      const b=candidate.c.getImageData(0,0,candidate.canvas.width,candidate.canvas.height).data;
      for(let i=0;i<a.length;i++){
       const d=Math.abs(a[i]-b[i]);if(d){changed++;maxDelta=Math.max(d,maxDelta);}
      }
      cases++;
     }
    for(const r of [before,candidate])r.setQuality('high');
    const times={baseline:[],crop:[]};
    for(let i=0;i<140;i++){
     for(const which of i%2?['crop','baseline']:['baseline','crop']){
      const r=which==='crop'?candidate:before;
      r.base();
      const start=performance.now();
      r.background(44+i/60,15000+i*2,2,false,false,1);
      r.c.getImageData(0,0,1,1);
      if(i>=20)times[which].push(performance.now()-start);
     }
    }
    const stat=values=>{
     const a=[...values].sort((x,y)=>x-y);
     return {count:a.length,meanMs:values.reduce((s,v)=>s+v,0)/values.length,p50Ms:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)]};
    };
    return {cases,changedChannels:changed,maxChannelDelta:maxDelta,forestNatural:[forest.naturalWidth,forest.naturalHeight],
     sourcePixelsFraction,backing:[candidate.canvas.width,candidate.canvas.height],baseline:stat(times.baseline),crop:stat(times.crop)};
   });
   assert.deepEqual(errors,[]);
   reports.push({viewport,...report});
   if(report.changedChannels)throw Error('Forest source clipping is not pixel exact: '+JSON.stringify(report));
   await page.close();
  }
  console.log('FOREST_SOURCE_CROP_RESULT '+JSON.stringify({browser:browser.version(),reports}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
