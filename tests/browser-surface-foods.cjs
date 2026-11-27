const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const root=process.env.GAME_URL||'http://127.0.0.1:5501/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Static art probes jump between snow levels without a flight clock.
   const artUrl=new URL(root);
   artUrl.searchParams.set('perf-test','1');
   artUrl.searchParams.set('perf-ab','pixi-webgl-winter');
   artUrl.searchParams.set('perf-winter','eager');
   await page.goto(artUrl.toString(),{waitUntil:'networkidle'});await page.locator('#start-training:not([disabled])').waitFor();
  const result=await page.evaluate(async()=>{
   const {FOODS}=await import('/js/foods.mjs'),{drawFood}=await import('/js/food-art.mjs');
   const {drawLivingTrunk}=await import('/js/tree-art.mjs');
   const canvas=document.createElement('canvas');canvas.id='surface-proof';canvas.width=768;canvas.height=1440;
   canvas.style.cssText='position:absolute;left:0;top:0;z-index:99999;background:#d6e3c9';document.body.append(canvas);
   const c=canvas.getContext('2d');c.fillStyle='#d6e3c9';c.fillRect(0,0,768,1440);
   c.font='18px sans-serif';c.fillStyle='#21462e';
   for(const food of FOODS){c.fillText(food.name,12,food.slot*116+24);for(let f=0;f<4;f++)drawFood(c,food.slot,260+f*128,food.slot*116+62,100,f/7,false,0);}
   window.surfaceProof={canvas,c,drawLivingTrunk};
   return {foods:FOODS.length,images:performance.getEntriesByType('resource').filter(x=>x.name.includes('fruit-')).length};
  });
  assert.equal(result.foods,12);assert.equal(result.images,0);
  await fs.mkdir('test-results/surface-foods',{recursive:true});
  await page.locator('#surface-proof').screenshot({path:'test-results/surface-foods/foods.png'});
  const measured=await page.evaluate(()=>{
   const {canvas,c,drawLivingTrunk:draw}=window.surfaceProof;canvas.width=768;canvas.height=500;
   const render=(snow,wet)=>{c.clearRect(0,0,768,500);draw(c,{x:380,y:160,width:180,snow,rain:wet,variant:1});return c.getImageData(0,0,768,500).data;};
   const dry=render(0,0),wet=render(0,1);let wetDiff=0,outside=0;
   for(let i=0;i<dry.length;i+=4){if(dry[i]!==wet[i]||dry[i+1]!==wet[i+1]||dry[i+2]!==wet[i+2]){wetDiff++;if(!dry[i+3])outside++;}}
   let maxBoundary=0;
   for(const threshold of [.25,.5,.75]){
    const a=render(threshold-1e-8,0),b=render(threshold,0);
    for(let i=0;i<a.length;i++)maxBoundary=Math.max(maxBoundary,Math.abs(a[i]-b[i]));
   }
   c.clearRect(0,0,768,500);
   for(let i=0;i<6;i++)draw(c,{x:70+i*125,y:200,width:90,snow:[0,.1,.25,.5,.75,1][i],variant:1});
   return {wetDiff,outside,maxBoundary};
  });
  assert.ok(measured.wetDiff>100,'wet authoring must be visibly different');assert.equal(measured.outside,0,'water cannot alter the original silhouette');
  assert.ok(measured.maxBoundary<=1,'snow interpolation must be continuous across atlas stages');
  await page.locator('#surface-proof').screenshot({path:'test-results/surface-foods/snow-levels.png'});
  await page.evaluate(async()=>{document.querySelector('#surface-proof').remove();const {game}=await import('/js/script.js');game.state='menu';});
  await page.goto(root,{waitUntil:'networkidle'});
  await page.locator('#inputPlayer').fill('Teste alimentos');await page.locator('#btnStart:not([disabled])').click();
  await page.waitForTimeout(800);assert.deepEqual(errors,[]);
  console.log('PASS surface weather, twelve food sheets, silhouette and snow continuity',measured);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
