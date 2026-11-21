// Controlled Canvas 2D background pass ablation. Each toggle exists ONLY here:
// no production image, effect, quality preset or motion is disabled.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const out='test-results/background-passes';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/\/js\/script\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const results=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs'),{images}=await import('/js/assets.mjs');
   const canvas=document.createElement('canvas');
   canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
   document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);await r.ready;r.setQuality('high');
   const c=r.c,forest=images.get('forest');
   if(!forest)throw Error('Forest image not loaded');
   const methods={
    drawImage:c.drawImage.bind(c),ellipse:c.ellipse.bind(c),fillRect:c.fillRect.bind(c),fill:c.fill.bind(c),
    skyLayer:r.skyLayer.bind(r)
   };
   const variants=['full','no-sky-copy','no-forest-image','no-fog','no-tree-parallax','no-tint','no-sunbeams'];
   let active='full';
   c.drawImage=(...args)=>{
    if(active==='no-forest-image'&&args[0]===forest)return;
    return methods.drawImage(...args);
   };
   c.ellipse=(...args)=>{
    if(active==='no-fog'&&Math.abs(c.globalAlpha-.08)<1e-4)return;
    return methods.ellipse(...args);
   };
   c.fill=(...args)=>{
    if(active==='no-tree-parallax'&&(.044<c.globalAlpha&&c.globalAlpha<.076))return;
    if(active==='no-sunbeams'&&(/^rgba?\(255,\s*255,\s*203(?:,|\))/i).test(String(c.fillStyle)))return;
    return methods.fill(...args);
   };
   c.fillRect=(...args)=>{
    if(active==='no-tint'&&Math.abs(c.globalAlpha-.1)<1e-4
     &&args[0]===0&&args[1]===0&&args[2]===r.w&&args[3]===r.h
     &&String(c.fillStyle).startsWith('rgb('))return;
    return methods.fillRect(...args);
   };
   r.skyLayer=(...args)=>{
    if(active==='no-sky-copy')return;
    return methods.skyLayer(...args);
   };
   // Baseline first initializes the sky cache before the timed samples.
   active='full';r.base();r.background(44,15000,2,false,false,1);c.getImageData(0,0,1,1);
   const measured=Object.fromEntries(variants.map(v=>[v,[]]));
   for(let iteration=0;iteration<120;iteration++){
    const order=iteration%2?[...variants].reverse():variants;
    for(const variant of order){
     active=variant;r.base();
     const start=performance.now();
     r.background(44+iteration/60,15000+iteration*3,2,false,false,1);
     c.getImageData(0,0,1,1); // Force raster completion for each controlled variant.
     if(iteration>=15)measured[variant].push(performance.now()-start);
    }
   }
   const report={};
   for(const [variant,samples]of Object.entries(measured)){
    const sorted=[...samples].sort((a,b)=>a-b);
    report[variant]={
     count:samples.length,
     meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,
     p50Ms:sorted[Math.floor((sorted.length-1)*.5)],
     p95Ms:sorted[Math.floor((sorted.length-1)*.95)]
    };
   }
   return {backing:[r.canvas.width,r.canvas.height],dpr:r.dpr,
    note:'Diagnostic ablations alone, not additive or quality recommendations. Variants never exist in production.',stats:report};
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/background-passes.json',JSON.stringify(results,null,2));
  console.log('BACKGROUND_PASSES_RESULT '+JSON.stringify(results));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
