// Same-runner A/B against a pinned 1.0.3 checkout. Measures readiness, transfer
// and explicit Canvas backing dimensions; never claims physical RAM/GPU usage.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const current=process.env.GAME_URL||'http://127.0.0.1:5501/',baseline=process.env.BASE_GAME_URL;
if(!baseline)throw Error('BASE_GAME_URL must serve the pinned 1.0.3 checkout');
const throughput=Number(process.env.BENCH_MBPS)||20,latency=50;
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const rows=[],memory=[];
 try{
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
   // Alternate order to reduce systematic warm-up/order bias. Each context
   // starts cold, then reloads the same page with that context's cache.
   for(let repeat=0;repeat<3;repeat++)for(const [label,url] of repeat%2?[['after',current],['before',baseline]]:[['before',baseline],['after',current]]){
    const context=await browser.newContext({viewport,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency,downloadThroughput:throughput*1000000/8,uploadThroughput:throughput*1000000/8});
    for(const cache of ['cold','warm']){
     if(cache==='cold')await page.goto(url,{waitUntil:'domcontentloaded'});else await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#start-training:not([disabled])').waitFor({timeout:45000});
     await page.evaluate(()=>document.fonts.ready);
     const sample=await page.evaluate(()=>({readyMs:performance.now(),resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,transfer:r.transferSize,body:r.encodedBodySize,duration:r.duration})),fontsLoaded:document.fonts.check('700 20px Nunito','Chauá · conservação · alimentação')&&document.fonts.check('700 20px "Baloo 2"','Chauá')}));
     assert.ok(sample.fontsLoaded);assert.deepEqual(errors,[]);
     rows.push({label,viewport,repeat,cache,...sample});
    }
    await context.close();
   }
   for(const [label,url] of [['before',baseline],['after',current]]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
    await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    const result=await page.evaluate(async()=>{
     const {Renderer}=await import(new URL('./js/render.mjs',location.href).href),{Game}=await import(new URL('./js/engine.mjs',location.href).href);
     const canvas=document.createElement('canvas');let size={width:innerWidth,height:innerHeight};
     canvas.getBoundingClientRect=()=>size;document.body.replaceChildren(canvas);
     const r=new Renderer(canvas);await r.ready;
     const snapshots=[],hashes=[];
     const surfaces=()=>[r.skyCache?.surface,r.forestCache?.surface,r.fragmentedBackdrop?.surface,r.transitionBackdrop?.surface,...(r.seasonalBackdrop?.frames.values()||[]),r.seasonalBackdrop?.pending?.surface].filter(Boolean);
     const snap=label=>snapshots.push({label,bytes:surfaces().reduce((n,s)=>n+s.width*s.height*4,0),surfaces:surfaces().filter(s=>s.width&&s.height).length});
     const hash=async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.c.getImageData(0,0,canvas.width,canvas.height).data))).map(x=>x.toString(16).padStart(2,'0')).join('');
     snap('ready');
     const g=new Game({seed:104});g.state='countdown';g.elapsed=0;g.sceneTime=1;g.nextSpawn=Infinity;
     for(let cycle=0;cycle<3;cycle++){
      r.home(1,false);g.tutorial={step:0};r.game(g,false);snap('forest-'+cycle);
      g.tutorial=null;r.game(g,false);snap('seasonal-'+cycle);hashes.push(await hash());
     }
     const old=surfaces();size={width:innerWidth+24,height:innerHeight+16};r.resize();snap('resize-before-draw');
     const released=old.every(s=>s.width===0&&s.height===0);
     r.game(g,false);hashes.push(await hash());snap('resized-seasonal');
     r.game(g,false);hashes.push(await hash());
     return {snapshots,hashes,released};
    });
    assert.deepEqual(errors,[]);memory.push({label,viewport,...result});await page.close();
   }
  }
  fs.mkdirSync('test-results/startup-memory',{recursive:true});
  fs.writeFileSync('test-results/startup-memory/report.json',JSON.stringify({rows,memory},null,2));
  const summaries=[];
  for(const width of [1366,390]){
   const before=memory.find(r=>r.label==='before'&&r.viewport.width===width),after=memory.find(r=>r.label==='after'&&r.viewport.width===width);
   // Keep the old checkout as the transfer/readiness/cache-byte baseline.
   // Approved art revisions can change its pixels; compare exact visual
   // stability across cache lifecycles within EACH revision instead.
   for(const revision of [before,after]){
    assert.equal(revision.hashes.length,5);
    assert.ok(revision.hashes.slice(0,3).every(hash=>hash===revision.hashes[0]),
     'restarting the same frozen scene must preserve exact rendered pixels');
    assert.equal(revision.hashes[3],revision.hashes[4],
     'a rebuilt resized cache must preserve exact pixels on the next draw');
   }
   assert.ok(after.released,'resize must release stale surfaces before another draw');
   const seasonal=r=>r.snapshots.filter(s=>s.label.startsWith('seasonal-'));
   assert.ok(seasonal(after).every(s=>s.bytes===seasonal(after)[0].bytes),'restarts must reach a stable backing-store plateau');
   assert.ok(seasonal(after)[0].bytes<seasonal(before)[0].bytes,'active flight must retain fewer background bytes');
   for(const label of ['before','after'])for(const cache of ['cold','warm']){
    const samples=rows.filter(r=>r.label===label&&r.viewport.width===width&&r.cache===cache);
    summaries.push({width,label,cache,readyMedianMs:Math.round(median(samples.map(r=>r.readyMs))),fontBodyBytes:median(samples.map(r=>r.resources.filter(s=>/\.(ttf|woff2)$/.test(s.name)).reduce((n,s)=>n+s.body,0))),transferBytes:median(samples.map(r=>r.resources.reduce((n,s)=>n+s.transfer,0)))});
   }
  }
  const report={baseline:'f32ee403b493d5a25f86c1710223d96c0af106b1',browser:browser.version(),network:{mbps:throughput,latencyMs:latency},notes:'Visual hashes check repeated frozen frames within each revision; cross-version pixels can differ after approved art changes. Same-runner Chromium headless diagnostic. Canvas bytes are width*height*4 estimates, not actual RAM/GPU. Readiness includes loaded fonts and required game art. Warm measurements include ordinary HTTP validation.',summaries,memory,rows};
  fs.mkdirSync('test-results/startup-memory',{recursive:true});fs.writeFileSync('test-results/startup-memory/report.json',JSON.stringify(report,null,2));
  console.log('STARTUP_MEMORY_AB '+JSON.stringify({network:report.network,summaries,memory}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
