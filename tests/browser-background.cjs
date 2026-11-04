const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=process.env.GAME_URL||'http://127.0.0.1:5501/',out='test-results/background';
async function scene(browser,viewport,domFallback=false){
 const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(domFallback=>{
  window.frameForTest=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;
  if(domFallback)window.OffscreenCanvas=undefined;
 },domFallback);
 await page.goto(root,{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {Renderer}=await import('/js/render.mjs'),{images}=await import('/js/assets.mjs');
  const canvas=()=>{const c=document.createElement('canvas');c.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';return c;};
  const a=canvas(),b=canvas();document.body.replaceChildren(a,b);
  const direct=new Renderer(a),cached=new Renderer(b);await Promise.all([direct.ready,cached.ready]);
  direct.skyLayer=function(light){Renderer.prototype.skyLayer.call(this,light,false);};
  direct.prepareSky=()=>null;
  let directTransition=false;
  const original=direct.prepareFragmentedBackdrop.bind(direct);
  direct.prepareFragmentedBackdrop=(...args)=>directTransition?null:original(...args);
  direct.prepareStagedBackdrop=()=>null;
  window.backgroundTest={direct,cached,images,setDirectTransition:v=>{directTransition=v;}};
 });
 return {page,errors};
}
async function pixels(browser){
 const summaries=[];
 for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
  const {page,errors}=await scene(browser,viewport);
  const summary=await page.evaluate(async()=>{
   const {direct,cached,images,setDirectTransition}=window.backgroundTest;
   const {Game}=await import('/js/engine.mjs');const game=new Game();game.state='countdown';
   cached.game(game,false);const prepared=cached.skyCache;
   cached.base();cached.background(44,9000,2,false,false,1);
   const preparedBeforeFlight=prepared===cached.skyCache;
   const cases=[
    [0,1,0,false,false],[1,.4,44,false,false],
    [2,0,0,false,false],[2,.5,44,false,false],[2,1,44,false,false],
    [2,1,89,false,false],[3,0,44,false,false],[3,.5,89,false,false],
    [3,1,44,false,false],[0,1,89,true,false],[2,1,89,false,true]
   ];
   let maximum=0,different=0,total=0,reused=false,transitionMax=0,transitionTotal=0,transitionDiff=0;
   for(const quality of ['high','low']){
    direct.setQuality(quality);cached.setQuality(quality);
    for(const [stage,mix,time,home,reduced]of cases){
     const transitioning=mix<1&&!home&&!reduced;
     setDirectTransition(transitioning);
     for(const r of [direct,cached]){r.base();r.background(time,7000+time*275,stage,home,reduced,mix);}
     // The double-buffered compositor never displays half-painted strips.
     // A static pixel test must let up to two complete eight-stripe snapshots
     // finish before comparing the identical fixed transition inputs.
     for(let i=0;i<(stage===1?32:16)&&!home&&!reduced;i++){
      cached.base();cached.background(time,7000+time*275,stage,home,reduced,mix);
     }
     const a=direct.c.getImageData(0,0,direct.canvas.width,direct.canvas.height).data;
     const b=cached.c.getImageData(0,0,cached.canvas.width,cached.canvas.height).data;
     for(let i=0;i<a.length;i++){
      const delta=Math.abs(a[i]-b[i]);
      if(transitioning){transitionMax=Math.max(transitionMax,delta);transitionDiff+=delta;}
      else {maximum=Math.max(maximum,delta);different+=Number(delta!==0);}
     }
     if(transitioning)transitionTotal+=a.length;
     else total+=a.length;
     if(stage===2&&mix===1){
       const active=()=>reduced?cached.skyCache:cached.fragmentedBackdrop;
       const cache=active();
       cached.base();cached.background(time+.01,9000,2,false,reduced,1);
       reused ||= !!cache&&cache===active();
      }
    }
   }
   const forest=images.get('forest');images.delete('forest');
   try{
    for(const r of [direct,cached]){r.base();r.background(44,1500,2,false,false,1);}
    const a=direct.c.getImageData(0,0,direct.canvas.width,direct.canvas.height).data,b=cached.c.getImageData(0,0,cached.canvas.width,cached.canvas.height).data;
    for(let i=0;i<a.length;i++)maximum=Math.max(maximum,Math.abs(a[i]-b[i]));
   }finally{images.set('forest',forest);}
   return {maximum,different,total,reused,preparedBeforeFlight,pixels:cached.skyCache.width*cached.skyCache.height,
    transitionMax,transitionMAE:transitionTotal?transitionDiff/transitionTotal:0};
  });
  assert.equal(summary.maximum,0,'stable, home and reduced-motion paths must remain pixel exact');
  assert.ok(summary.transitionMax<=40&&summary.transitionMAE<1.1,
   'transition visual deviation exceeds threshold: '+JSON.stringify(summary));
  assert.equal(summary.reused,true);assert.ok(summary.pixels<=4_000_000);
  assert.equal(summary.preparedBeforeFlight,true,'countdown must prepare the fog background');
  // Resize and quality changes must release the old backing, not accumulate it.
  for(let cycle=0;cycle<10;cycle++){
   const viewport=cycle%2?{width:390,height:844}:{width:1000,height:700};
   await page.setViewportSize(viewport);
   const released=await page.evaluate(()=>{
    const {cached:r}=window.backgroundTest;
    const old=[r.skyCache?.surface,r.fragmentedBackdrop?.surface,r.transitionBackdrop?.surface].filter(Boolean);
    r.resize();
    const released=old.length>0&&old.every(surface=>surface.width===0)&&r.skyCache===null&&r.fragmentedBackdrop===null&&r.transitionBackdrop===null;
    r.base();r.background(44,9000,2,false,false,1);return released;
   });
   assert.equal(released,true);
  }
  assert.equal(await page.evaluate(()=>{
   const {cached:r}=window.backgroundTest;
   const old=[r.skyCache?.surface,r.fragmentedBackdrop?.surface,r.transitionBackdrop?.surface].filter(Boolean);
   r.setQuality('high');
   const released=old.length>0&&old.every(surface=>surface.width===0)&&r.skyCache===null&&r.fragmentedBackdrop===null&&r.transitionBackdrop===null;
   r.base();r.background(44,9000,2,false,false,1);return released;
  }),true,'quality change must release the old backing');
  await page.screenshot({path:path.join(out,'scene-'+summaries.length+'.png')});
  assert.deepEqual(errors,[]);summaries.push({viewport,...summary});await page.close();
 }
 const {page,errors}=await scene(browser,{width:390,height:844},true);
 assert.equal(await page.evaluate(()=>{
  const {direct,cached}=window.backgroundTest;
  for(const r of [direct,cached]){r.base();r.background(44,9000,2,false,false,1);}
  const a=direct.c.getImageData(0,0,780,1688).data,b=cached.c.getImageData(0,0,780,1688).data;
  return a.every((v,i)=>v===b[i])&&cached.fragmentedBackdrop?.surface instanceof HTMLCanvasElement;
 }),true,'HTML canvas fallback differs');assert.deepEqual(errors,[]);await page.close();
 console.log(JSON.stringify(summaries));
 console.log('PASS background: exact stable/fallback pixels, bounded seasonal blends and complete buffer release.');
}
async function benchmark(browser){
 const results=[];
 for(const config of [
  {name:'desktop-translucent',viewport:{width:1440,height:960},stage:2},
  {name:'mobile-translucent',viewport:{width:390,height:844},stage:2},
  {name:'desktop-opaque-control',viewport:{width:1440,height:960},stage:0}
 ]){
  for(let pair=0;pair<3;pair++)for(const variant of pair%2?['cached','direct']:['direct','cached']){
   const {page,errors}=await scene(browser,config.viewport);
   const metrics=await page.evaluate(async({variant,stage})=>{
    window.backgroundTest[variant==='direct'?'cached':'direct'].canvas.remove();
    const r=window.backgroundTest[variant];let start=0,last=0,firstPaint=null,frames=[];
    const {Game}=await import('/js/engine.mjs');const game=new Game();game.state='countdown';
    const preparing=performance.now();r.game(game,false);r.c.getImageData(0,0,1,1);
    const preparation=performance.now()-preparing;
    return await new Promise(resolve=>{function draw(now){
     start||=now;const elapsed=(now-start)/1000,t=performance.now();
     r.base();r.background(30+elapsed,4000+elapsed*275,stage,false,false,1);
     // Equal readback on both paths flushes deferred raster work; this is a
     // background-component benchmark, not a prediction of whole-game FPS.
     r.c.getImageData(0,0,1,1);const paint=performance.now()-t;
     firstPaint??=paint;
     if(elapsed>.5&&last)frames.push({dt:now-last,paint});last=now;
     if(elapsed<4)window.frameForTest(draw);
     else{
      const pct=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
      resolve({fps:1000*frames.length/frames.reduce((s,f)=>s+f.dt,0),interval95:pct(frames.map(f=>f.dt),.95),paint50:pct(frames.map(f=>f.paint),.5),paint95:pct(frames.map(f=>f.paint),.95),firstPaint,preparation,cacheBytes:(r.skyCache?.width??0)*(r.skyCache?.height??0)*4});
     }
    }window.frameForTest(draw);});
   },{variant,stage:config.stage});
   assert.deepEqual(errors,[]);const result={scenario:config.name,pair,variant,...metrics};
   results.push(result);console.log(JSON.stringify(result));await page.close();
  }
 }
 fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(results,null,2));
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{if(process.argv.includes('--benchmark'))await benchmark(browser);else await pixels(browser);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
