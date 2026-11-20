// Verify authored atlas appearance and compare direct clipping against the
// frozen 1024x1024 rebuild implementation. Must run on real Chromium Canvas.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const TEST_URL=process.env.GAME_URL||'http://127.0.0.1:5501/';
const STAGES=[0.05,0.15,0.3,0.5,0.7,0.85,0.98];
const browserOptions={executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']};
(async()=>{
 const browser=await chromium.launch(browserOptions);
 try{
  await fs.mkdir('test-results/snow-direct-clips',{recursive:true});
  async function renderCase(variant,amount,savePng){
   const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
   const url=new URL(TEST_URL);
   url.searchParams.set('perf-test','1');url.searchParams.set('perf-ab',variant);
   // Baseline now tests cached snow sprites; compare the direct implementation
   // explicitly against the pre-existing 1024px rebuild reference.
   if(variant==='baseline')url.searchParams.set('snow-render','direct');
   await page.goto(url.toString(),{waitUntil:'networkidle'});
   const out=await page.evaluate(async snow=>{
    const [{Renderer},{drawLivingTrunk,snowMaskMetrics}]=await Promise.all([
     import('/js/render.mjs'),import('/js/tree-art.mjs')]);
    const canvas=document.createElement('canvas');
    canvas.width=1280;canvas.height=800;
    canvas.style.cssText='width:1280px;height:800px;';
    document.body.replaceChildren(canvas);
    const renderer=new Renderer(canvas);await renderer.ready;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,1280,800);
    for(let variant=0;variant<4;variant++){
     const x=160+variant*315;
     drawLivingTrunk(c,{x,y:320,upper:true,width:136,length:100,variant,snow});
     drawLivingTrunk(c,{x,y:490,upper:false,width:136,length:100,variant,snow});
    }
    const stats={...snowMaskMetrics};
    return {png:canvas.toDataURL('image/png'),stats};
   },amount);
   assert.deepEqual(errors,[]);
   await page.close();
   if(savePng)await fs.writeFile(`test-results/snow-direct-clips/${variant}-${Math.round(amount*100)}.png`,Buffer.from(out.png.split(',')[1],'base64'));
   return out;
  }
  async function compareImage(expectedPng,candidatePng){
   const page=await browser.newPage();
   const delta=await page.evaluate(async images=>{
    const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
    const [a,b]=await Promise.all(images.map(load));
    const c=document.createElement('canvas');c.width=a.width;c.height=a.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(a,0,0);const x=ctx.getImageData(0,0,c.width,c.height).data;
    ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(b,0,0);
    const y=ctx.getImageData(0,0,c.width,c.height).data;
    let changedChannels=0,absoluteSum=0,visiblePixels=0;
    for(let i=0;i<x.length;i+=4){
     if(x[i+3]>10)visiblePixels++;
     for(let j=0;j<4;j++){
      const d=Math.abs(x[i+j]-y[i+j]);if(d)changedChannels++;absoluteSum+=d;
     }
    }
    return {changedFraction:changedChannels/x.length,meanError: absoluteSum/x.length,
      changedChannels,visiblePixels,totalPixels:c.width*c.height};
   },[expectedPng,candidatePng]);
   await page.close();return delta;
  }
  const results=[];
  for(const snow of STAGES){
   const legacy=await renderCase('legacy-snow-rebuild',snow,snow===.5);
   const direct=await renderCase('baseline',snow,snow===.5);
   const pixels=await compareImage(legacy.png,direct.png);
   // The same authored silhouettes must survive even with fractional
   // transforms; at most subpixel edge-coverage differences are permitted.
   assert.ok(pixels.changedFraction<.0025,
    `more than 0.25% of RGBA channels changed at snow=${snow}: ${JSON.stringify(pixels)}`);
   assert.ok(pixels.meanError<.3,
    `excessive image intensity delta at snow=${snow}: ${JSON.stringify(pixels)}`);
   assert.equal(direct.stats.rebuilds,0,'direct clip must allocate/rebuild no 1024px mask');
   assert.ok(direct.stats.directClips>=8,'all 8 trunks use the direct clip');
   assert.ok(legacy.stats.rebuilds>=2,'legacy reference must actually rebuild both masks');
   results.push({snow,...pixels});
  }
  await fs.writeFile('test-results/snow-direct-clips/parity.json',JSON.stringify(results,null,2));
  console.log('SNOW_DIRECT_CLIP_PARITY_PASS '+JSON.stringify(results));
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
