const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
  const url=new URL(process.env.GAME_URL||'http://127.0.0.1:5501/');
  url.searchParams.set('perf-ab','precomposed-snow');
  url.searchParams.set('clima','winter');
  await page.goto(url.toString(),{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const [{ASSET_PATHS,images,loadAssets},{drawLivingTrunk,drawTreeVariant},{PRECOMPOSED_SNOW_ACTIVE,precomposedSnowStage}]=await Promise.all([
    import('/js/assets.mjs'),import('/js/tree-art.mjs'),import('/js/precomposed-winter.mjs')]);
   await loadAssets();
   const keys=Object.keys(ASSET_PATHS).filter(k=>k.includes('-precomposed-'));
   const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=800;
   const c=canvas.getContext('2d',{willReadFrequently:true});
   const results=[];
   for(const snow of [0,.06,.22,.5,.8,1]){
    c.clearRect(0,0,1500,800);
    const original=c.drawImage.bind(c);let draws=0;
    c.drawImage=(...args)=>{draws++;return original(...args);};
    drawLivingTrunk(c,{x:250,y:80,width:145,length:800,variant:1,snow});
    c.drawImage=original;
    let visible=0;const pixels=c.getImageData(180,0,200,420).data;
    for(let i=3;i<pixels.length;i+=4)if(pixels[i]>120)visible++;
    results.push({snow,stage:precomposedSnowStage(snow),draws,visible});
   }
   c.clearRect(0,0,1500,800);
   const saved=c.drawImage.bind(c);let specialDraws=0;
   c.drawImage=(...args)=>{specialDraws++;return saved(...args);};
   drawTreeVariant(c,700,120,false,'hollow',undefined,.5,0,0,1000);
   c.drawImage=saved;
   return {active:PRECOMPOSED_SNOW_ACTIVE,keys:keys.length,
    loaded:keys.filter(k=>images.has(k)).length,
    results,specialDraws};
  });
  assert.deepEqual(errors,[]);
  assert.equal(result.active,true);
  assert.equal(result.keys,43);
  assert.equal(result.loaded,43);
  assert.ok(result.results.every(x=>x.draws===1),'one original-compatible draw per living tree');
  assert.ok(result.results.every(x=>x.visible>2000),'all winter stages render visible art');
  assert.equal(result.specialDraws,1,'precomposed special tree has no overlay pass');
  console.log('TEST_C_PRECOMPOSED_PASS '+JSON.stringify(result));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
