// Pixel-accurate validation for precomputed source-aligned snow sprites.
// Correctly authored cap must remain in place on all 8 trunk variants.
// This never uses generated speculative tree silhouettes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const browser=chromium;
(async()=>{
 const b=await browser.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const mode of ['sprites','direct']){
   const page=await b.newPage({viewport:{width:1280,height:720}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
   const url=new URL(process.env.GAME_URL||'http://127.0.0.1:5501/');
   url.searchParams.set('snow-render',mode);
   await page.goto(url.toString(),{waitUntil:'networkidle'});
   const result=await page.evaluate(async()=>{
    const [{Renderer},{drawLivingTrunk,snowMaskMetrics}]=await Promise.all([
     import('/js/render.mjs'),import('/js/tree-art.mjs')]);
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    const r=new Renderer(canvas);await r.ready;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    const stages=[];
    for(const amount of [.03,.125,.25,.375,.5,.7,.875,.98]){
     c.clearRect(0,0,1280,720);
     for(let v=0;v<4;v++)for(const upper of [true,false]){
      drawLivingTrunk(c,{x:135+v*300,y:upper?200:500,width:145,length:100,upper,variant:v,snow:amount});
     }
     const a=c.getImageData(0,0,1280,720).data;
     let visible=0;for(let i=3;i<a.length;i+=4)if(a[i]>127)visible++;
     stages.push({amount,visible});
    }
    return {stages,metrics:{...snowMaskMetrics,
      sprite:{...snowMaskMetrics.snowSpriteMetrics}}};
   });
   assert.deepEqual(errors,[]);
   assert.ok(result.stages.every(x=>x.visible>5000),'authored trees render in all stages');
   if(mode==='sprites'){
    assert.ok(result.metrics.sprite.ready,'pre-rendering finished during loading');
    assert.equal(result.metrics.rebuilds,0,'no 1024px snow atlas reconstruction');
    assert.ok(result.metrics.sprite.draws>0,'draw cached authored snow sprites');
    assert.equal(result.metrics.directClips,0,'no direct clipping on prepared sprites');
   }else{
    assert.ok(result.metrics.directClips>0,'legacy direct control truly clipped snow');
   }
   console.log('SNOW_SPRITES_'+mode.toUpperCase()+'_PASS '+JSON.stringify(result));
   await page.close();
  }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
