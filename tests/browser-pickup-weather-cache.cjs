// Real Chromium alpha-parity and no-per-frame-allocation checks for collectibles.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const NativeOffscreen=window.OffscreenCanvas;
   let newSurfaces=0;
   if(NativeOffscreen)window.OffscreenCanvas=new Proxy(NativeOffscreen,{construct(target,args){newSurfaces++;return Reflect.construct(target,args);}});
   const {Renderer}=await import('/js/render.mjs');
   const {FOODS}=await import('/js/foods.mjs');
   const {drawFood,prewarmFoodArt}=await import('/js/food-art.mjs');
   const r=new Renderer(document.createElement('canvas'));await r.ready;
   if(!prewarmFoodArt())throw Error('frozen authored atlas was not prepared');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
   const c=canvas.getContext('2d',{willReadFrequently:true});
   const render=(slot,frame,snow,wet)=>{
    c.clearRect(0,0,128,128);
    drawFood(c,slot,64,64,128,(frame+.13)/7,false,0,snow,wet);
    return c.getImageData(0,0,128,128).data;
   };
   let alphaErrors=0,frozenDifferences=0,wetDifferences=0,pixelCases=0;
   for(const food of FOODS)for(let frame=0;frame<4;frame++){
    const dry=render(food.slot,frame,0,0);
    const ice=render(food.slot,frame,1,0);
    const wet=render(food.slot,frame,0,1);
    for(let p=0;p<dry.length;p+=4){
     pixelCases++;
     if(dry[p+3]!==ice[p+3]||dry[p+3]!==wet[p+3])alphaErrors++;
     if(dry[p]!==ice[p]||dry[p+1]!==ice[p+1]||dry[p+2]!==ice[p+2])frozenDifferences++;
     if(dry[p]!==wet[p]||dry[p+1]!==wet[p+1]||dry[p+2]!==wet[p+2])wetDifferences++;
    }
   }
   // Snow must never create an offscreen surface after asset preparation.
   const surfaceCount=newSurfaces;
   for(let i=0;i<400;i++)drawFood(c,i%12,64,64,60,i/7,false,i,1,0);
   const snowNewSurfaces=newSurfaces-surfaceCount;
   // One known rainy variety/frame/level must reuse exactly the same surface.
   drawFood(c,0,64,64,60,21,false,0,0,.75);
   const afterFirstWet=newSurfaces;
   for(let i=0;i<400;i++)drawFood(c,0,64,64,60,21,false,0,0,.75);
   const wetNewSurfaces=newSurfaces-afterFirstWet;
   // Browser screenshot for review: original / wet / frozen artwork.
   const proof=document.createElement('canvas');proof.id='pickup-proof';
   proof.width=3*148;proof.height=4*148;document.body.append(proof);
   const pc=proof.getContext('2d');
   pc.fillStyle='#385764';pc.fillRect(0,0,proof.width,proof.height);
   for(let i=0;i<4;i++)for(let j=0;j<3;j++){
    pc.save();pc.translate(j*148,i*148);
    drawFood(pc,i,74,75,118,i/7,false,0,j===2?1:0,j===1?1:0);
    pc.restore();
   }
   // Also visit every pickup renderer, retaining label and glow paint order.
   const items=['fruit','pepper','feather','shield'];
   for(const kind of items)for(const snow of [0,1])r.pickup({kind,id:37,x:400,y:300,variety:0},21,false,snow,.7);
   return{foods:FOODS.length,frames:48,pixelCases,alphaErrors,frozenDifferences,wetDifferences,snowNewSurfaces,wetNewSurfaces};
  });
  assert.equal(result.foods,12);
  assert.equal(result.alphaErrors,0,'winter/rain must preserve authored alpha silhouettes');
  assert.ok(result.frozenDifferences>5000,'winter must visibly ice the fruit');
  assert.ok(result.wetDifferences>200,'rain must visibly wet the fruit');
  assert.equal(result.snowNewSurfaces,0,'winter draws must not allocate canvases per frame');
  assert.equal(result.wetNewSurfaces,0,'repeating the same rain stage must reuse its surface');
  assert.deepEqual(errors,[],'no renderer exceptions');
  await fs.mkdir('test-results/pickup-weather-cache',{recursive:true});
  await page.locator('#pickup-proof').screenshot({path:'test-results/pickup-weather-cache/normal-wet-frozen.png'});
  await fs.writeFile('test-results/pickup-weather-cache/result.json',JSON.stringify(result,null,2));
  console.log('PICKUP_WEATHER_CACHE_PASS '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
