// Validate bounded stripe sync, exact publish and safe fallback for slow/unsupported readbacks.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const results=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const {images}=await import('/js/assets.mjs');
   const forest=images.get('forest');
   const records=[];
   if(!forest)throw Error('Missing forest');
   for(const fault of ['healthy','throw','stall']){
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.append(canvas);
    const r=new Renderer(canvas);await r.ready;
    const normal=r.prepareFragmentedBackdrop(forest,'#dbe7b5',0,1);
    const originalSurface=normal.surface;
    const pending=r.ensureTransitionBackdrop();
    if(!pending)throw Error('Expected large transition buffer');
    const stagedSurface=pending.surface;
    const originalRead=pending.c.getImageData.bind(pending.c);
    let readCalls=0;
    pending.c.getImageData=(...args)=>{
     readCalls++;
     if(fault==='throw')throw Error('Simulated unsupported readback');
     if(fault==='stall'){
      const until=performance.now()+22;
      while(performance.now()<until){}
     }
     return originalRead(...args);
    };
    const passes=fault==='healthy'?8:fault==='throw'?1:2;
    for(let i=0;i<passes;i++){
     r.base(false);
     r.background(35,15000,2,false,false,.5);
     if(fault==='healthy'&&i<7&&normal.surface!==originalSurface)
      throw Error('Published incomplete stripe '+i);
    }
    if(readCalls!==passes)throw Error('Wrong sync count '+fault+': '+readCalls);
    if(fault==='healthy'){
     if(normal.surface!==stagedSurface)throw Error('Did not publish completed eighth stripe');
     if(pending.rowsDone!==0||pending.target!==null)
      throw Error('Pending state not reset after full publish');
     if(r.transitionRasterDisabled)throw Error('Healthy renderer disabled its transition cache');
    }else{
     if(!r.transitionRasterDisabled||r.transitionBackdrop!==null)
      throw Error('Unsupported/slow readback did not select direct fallback');
     if(stagedSurface.width!==0||stagedSurface.height!==0)
      throw Error('Fallback did not release staged buffer');
     if(r.ensureTransitionBackdrop()!==null)
      throw Error('Disabled staging restarted unexpectedly');
     r.base(false);
     r.background(36,16000,2,false,false,.65);
    }
    const pixelAlpha=r.c.getImageData(0,0,1,1).data[3];
    records.push({fault,readCalls,disabled:r.transitionRasterDisabled,
     published:fault==='healthy'?normal.surface===stagedSurface:false,pixelAlpha});
    canvas.remove();
   }
   return records;
  });
  assert.deepEqual(errors,[]);
  assert.deepEqual(results.map(x=>x.readCalls),[8,1,2]);
  assert.deepEqual(results.map(x=>x.disabled),[false,true,true]);
  assert.ok(results.every(x=>x.pixelAlpha===255));
  console.log('PASS transition bounded raster sync, full publish and adaptive fallback '+JSON.stringify(results));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
