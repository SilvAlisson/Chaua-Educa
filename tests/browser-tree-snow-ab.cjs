// Real-art A/B parity: only tree-bound snow coverage changes.
// This test renders the actual authored trunk and variant assets on Canvas.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const base=new URL(process.env.GAME_URL||'http://127.0.0.1:5501/');
 try{
  const trials=[];
  for(const trial of [{name:'snowless',override:null},{name:'baseline',override:'baseline'}]){
   const page=await b.newPage({viewport:{width:1100,height:700}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   // No UI or game frame loop: exercise the exact tree render functions directly.
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
   const url=new URL(base);if(trial.override)url.searchParams.set('perf-ab',trial.override);
   await page.goto(url.href,{waitUntil:'networkidle'});
   const result=await page.evaluate(async()=>{
    const [{loadAssets},{drawLivingTrunk,drawTreeVariant,snowMaskMetrics},{PERF_AB_VARIANT}]=await Promise.all([
     import('/js/assets.mjs'),import('/js/tree-art.mjs'),import('/js/perf-ab.mjs')]);
    await loadAssets();
    const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=700;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    function draw(amount){
     c.clearRect(0,0,1100,700);
     drawLivingTrunk(c,{x:240,y:390,upper:false,width:145,length:220,variant:0,snow:amount});
     drawLivingTrunk(c,{x:540,y:390,upper:false,width:145,length:220,variant:1,snow:amount});
     drawTreeVariant(c,850,390,false,'rot',undefined,amount,0,0,500);
     const pixels=c.getImageData(0,0,1100,700).data;
     let hash=2166136261,visible=0;
     for(let i=0;i<pixels.length;i+=4){
      if(pixels[i+3]>127)visible++;
      if(i%64===0){
       for(let k=0;k<4;k++){hash^=pixels[i+k];hash=Math.imul(hash,16777619);}
      }
     }
     return {hash:hash>>>0,visible};
    }
    return {variant:PERF_AB_VARIANT,zero:draw(0),partial:draw(.5),full:draw(1),
     spriteDraws:snowMaskMetrics.snowSpriteMetrics.draws};
   });
   assert.deepEqual(errors,[],'no browser errors during '+trial.name);
   assert.ok(result.zero.visible>5000,'real authored trees visible for '+trial.name);
   trials.push({name:trial.name,...result});
   await page.close();
  }
  const snowless=trials[0],baseline=trials[1];
  assert.equal(snowless.variant,'snow-mask-off');
  assert.equal(baseline.variant,'baseline');
  assert.equal(snowless.zero.hash,snowless.partial.hash,'no tree snow appears at 50%');
  assert.equal(snowless.zero.hash,snowless.full.hash,'no snowy tree texture appears at 100%');
  assert.equal(snowless.zero.hash,baseline.zero.hash,'the underlying bare trees are identical');
  assert.notEqual(baseline.zero.hash,baseline.partial.hash,'baseline renders progressive tree snow');
  assert.notEqual(baseline.zero.hash,baseline.full.hash,'baseline renders authored full-snow trees');
  assert.equal(snowless.spriteDraws,0,'no snow sprites drawn over trees in experimental arm');
  console.log('TREE_SNOW_AB_PASS '+JSON.stringify(trials));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
