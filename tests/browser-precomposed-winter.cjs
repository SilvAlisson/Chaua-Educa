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
   const [{ASSET_PATHS,images,loadAssets},{drawLivingTrunk,drawTreeVariant},{PRECOMPOSED_SNOW_ACTIVE,precomposedSnowStage,winterCapFrame,winterCapKey}]=await Promise.all([
    import('/js/assets.mjs'),import('/js/tree-art.mjs'),import('/js/precomposed-winter.mjs')]);
   await loadAssets();
   const keys=Object.keys(ASSET_PATHS).filter(k=>k.startsWith('winter-caps-'));
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
   const saved=c.drawImage.bind(c);const specialSources=[];
   c.drawImage=(...args)=>{specialSources.push(args);return saved(...args);};
   drawTreeVariant(c,700,120,false,'hollow',undefined,.5,0,0,1000);
   c.drawImage=saved;
   const [source,sx,sy,sw,sh,dx,dy,dw,dh]=specialSources[0]??[];
   const specialDraws=specialSources.length;
   const frame=winterCapFrame('special',precomposedSnowStage(.5),1);
   const snowySpecial=source===images.get(winterCapKey(frame[0]))&&sx===frame[1]&&sy===frame[2];
   const anchored=dy<0&&Math.abs(dy+8*dh/sh)<1e-9;
   return {snowySpecial,anchored,active:PRECOMPOSED_SNOW_ACTIVE,keys:keys.length,
    loaded:keys.filter(k=>images.has(k)).length,
    results,specialDraws};
  });
  assert.deepEqual(errors,[]);
  assert.equal(result.active,true);
  assert.equal(result.keys,4);
  assert.equal(result.loaded,4);
  assert.ok(result.results.every(x=>x.draws===1),'one original-compatible draw per living tree');
  assert.ok(result.results.every(x=>x.visible>2000),'all winter stages render visible art');
  assert.equal(result.specialDraws,1,'precomposed special tree has no overlay pass');
  assert.equal(result.snowySpecial,true,'the intact special tree draws the actual snowy stage');
  assert.equal(result.anchored,true,'snow extends above the unchanged wood anchor');
  console.log('TEST_C_PRECOMPOSED_PASS '+JSON.stringify(result));
  await page.close();

  async function snowScene(variant){
   const view=await browser.newPage();
   try{
    await view.route(/\/js\/script\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:''}));
    const sceneUrl=new URL(url);
    sceneUrl.searchParams.set('perf-test','1');
    sceneUrl.searchParams.set('perf-ab',variant);
    await view.goto(sceneUrl.toString(),{waitUntil:'domcontentloaded'});
    return await view.evaluate(async()=>{
     const [{loadAssets},{drawLivingTrunk,prepareTreeWeather},{setActiveProbe}]=await Promise.all([
      import('/js/assets.mjs'),import('/js/tree-art.mjs'),import('/js/perf-hooks.mjs')
     ]);
     await loadAssets();
     const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
     const c=canvas.getContext('2d',{willReadFrequently:true});
     let masks=0;
     setActiveProbe({begin:()=>0,end:name=>{if(name==='render.snowMaskRebuild')masks++;}});
     prepareTreeWeather(c);
     const images=[];
     for(const snow of [.05,.5,.98,1]){
      c.clearRect(0,0,canvas.width,canvas.height);
      for(let index=0;index<4;index++){
       const x=160+index*315;
       drawLivingTrunk(c,{x,y:250,upper:true,width:136,length:220,variant:index,snow});
       drawLivingTrunk(c,{x,y:470,width:136,length:220,variant:index,snow});
      }
      images.push(canvas.toDataURL());
     }
     setActiveProbe(null);
     return {images,masks};
    });
   }finally{await view.close();}
  }
  const legacy=await snowScene('legacy-snow-rebuild');
  const direct=await snowScene('direct-snow');
  assert.ok(legacy.masks>=6,'the comparison must exercise the previous mask rebuilds');
  assert.equal(direct.masks,0,'regular winter must never rebuild either mask');
  const compare=await browser.newPage();
  const differences=await compare.evaluate(async({legacy,direct})=>{
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
   const c=canvas.getContext('2d',{willReadFrequently:true});
   async function channels(url){
    const img=new Image();img.src=url;await img.decode();
    c.clearRect(0,0,canvas.width,canvas.height);
    c.drawImage(img,0,0);
    return c.getImageData(0,0,canvas.width,canvas.height).data;
   }
   const results=[];
   for(let scene=0;scene<legacy.images.length;scene++){
    const a=await channels(legacy.images[scene]),b=await channels(direct.images[scene]);
    let changed=0,error=0;
    for(let i=0;i<a.length;i++){
     const delta=Math.abs(a[i]-b[i]);
     if(delta){changed++;error+=delta;}
    }
    results.push({changedFraction:changed/a.length,meanError:error/a.length});
   }
   return results;
  },{legacy,direct});
  await compare.close();
  assert.ok(differences.every(d=>d.changedFraction<.0025&&d.meanError<.3),JSON.stringify(differences));
  assert.equal(differences.at(-1).changedFraction,0,'full cover must preserve the original winter art');
  console.log('WINTER_MASK_PARITY_PASS '+JSON.stringify({legacyMasks:legacy.masks,directMasks:direct.masks,differences}));

  // Start the real fixed-step flight from the diagnostic panel and verify the exported result.
  const flight=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
  const flightErrors=[];flight.on('pageerror',e=>flightErrors.push(e.message));
  const commit='1234567890abcdef1234567890abcdef12345678';
  url.searchParams.set('perf-test','1');
  url.searchParams.set('perf-replay','1');
  url.searchParams.set('perf-hz','120');
  await flight.route(url=>url.searchParams.has('chaua-build-info'),route=>route.fulfill({
   status:200,headers:{'X-Chaua-Git-Commit':commit}
  }));
  await flight.goto(url.toString(),{waitUntil:'domcontentloaded'});
  await flight.getByRole('button',{name:'Executar voo de referência'}).click();
  await flight.waitForFunction(()=>window.__CHAUA_LAST_LOG__?.replay,{},{timeout:90_000});
  const report=await flight.evaluate(()=>window.__CHAUA_LAST_LOG__);
  assert.deepEqual(flightErrors,[]);
  assert.equal(report.replay.completed,true,JSON.stringify(report.replay));
  assert.equal(report.replay.steps,4949);
  assert.ok(report.climateTimeline.some(item=>item.snow>0&&item.snow<1&&item.snowStage>0));
  assert.deepEqual(report.snowCaps,{rebuilds:0,hits:0,directDraws:0});
  assert.equal(report.match.score,115);
  assert.equal(report.experiments.perfAB,'precomposed-snow');
  assert.equal(report.provenance.gitCommit,commit);
  assert.equal(report.provenance.gitCommitSource,'build');
  assert.equal(report.frameBudget.targetHz,120);
  assert.equal(report.windowTimebase,'flight-seconds');
  assert.ok(report.byTenSecondWindow['20'].frames>0);
  assert.ok(report.device.canvas.every(size=>size>0));
  assert.equal(await flight.locator('dialog[open]').count(),0,'the replay leaves the report controls reachable');
  const [download]=await Promise.all([
   flight.waitForEvent('download'),
   flight.getByRole('button',{name:'Baixar relatório'}).click({timeout:5000})
  ]);
  assert.match(download.suggestedFilename(),/^chaua-perf-dispositivo-.*\.json$/);
  console.log('WINTER_REFERENCE_FLIGHT_PASS '+JSON.stringify(report.replay));
  await flight.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
