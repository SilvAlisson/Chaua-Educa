// Side-by-side original versus cached translucent stage-2 backdrop.
// The screenshot-bearing renderer, characters, dynamic fog and motion remain intact.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
fs.mkdirSync('test-results/fragmented-composite',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const reports=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const stats=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const create=async()=>{
     const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(canvas);
     const r=new Renderer(canvas);await r.ready;return r;
    };
    const direct=await create(),optimized=await create();
    window.__fragmentedCompare={direct,optimized};
    direct.canvas.id='forest-comparison-baseline';
    optimized.canvas.id='forest-comparison-cached';
    direct.prepareFragmentedBackdrop=()=>null;
    const out=[];
    for(const quality of ['high','low']){
     for(const r of [direct,optimized])r.setQuality(quality);
     for(const stage of [0,1,2,3])for(const mix of [.4,1])
      for(const [time,reduced] of [[0,false],[35,false],[78.5,false],[80,true]]){
       for(const r of [direct,optimized]){
        r.base();r.background(time,15000+time*120,stage,false,reduced,mix);
       }
       const a=direct.c.getImageData(0,0,direct.canvas.width,direct.canvas.height).data;
       const b=optimized.c.getImageData(0,0,optimized.canvas.width,optimized.canvas.height).data;
       let total=0,changed=0,large=0,max=0;
       for(let i=0;i<a.length;i++){
        const d=Math.abs(a[i]-b[i]);
        total+=d;
        if(d)changed++;
        if(d>5)large++;
        if(d>max)max=d;
       }
       out.push({quality,stage,mix,time,reduced,changedFraction:changed/a.length,largeFraction:large/a.length,
        maxDelta:max,mae:total/a.length});
      }
    }
    // A/B: same exact rendered high-resolution scene (including the snake),
    // alternated on one browser runner and flushed with an identical readback.
    const wood={id:1,kind:'wood',x:480,top:140,bottom:465,variant:'branch',snake:{age:3}};
    advanceSnake(wood,.4,120);
    const g=new Game({seed:104});g.state='playing';g.stage=2;g.stageAge=10;g.elapsed=35;g.sceneTime=35;g.distance=15500;g.y=320;g.wing=.5;g.entities=[wood];
    for(const r of [direct,optimized])r.setQuality('high');
    const samples={direct:[],optimized:[]};
    for(let i=0;i<130;i++){
     g.elapsed=35+i/60;g.sceneTime=g.elapsed;
     const order=i%2?['optimized','direct']:['direct','optimized'];
     for(const variant of order){
      const r=variant==='direct'?direct:optimized;
      const start=performance.now();
      r.game(g,false,g.sceneTime);
      r.c.getImageData(0,0,1,1);
      if(i>=15)samples[variant].push(performance.now()-start);
     }
    }
    const stat=a=>{const sorted=[...a].sort((x,y)=>x-y);return {
     mean:a.reduce((s,v)=>s+v,0)/a.length,median:sorted[Math.floor(sorted.length*.5)],
     p95:sorted[Math.floor(sorted.length*.95)],max:sorted[sorted.length-1]}};
    const active=out.filter(x=>x.stage===2&&x.mix===1&&!x.reduced);
    const control=out.filter(x=>x.stage!==2||x.mix!==1||x.reduced);
    const maximum=Math.max(...active.map(x=>x.maxDelta));
    const totalMAE=Math.max(...active.map(x=>x.mae));
    const maximumLargeFraction=Math.max(...active.map(x=>x.largeFraction));
    const fallbackErrors=control.filter(x=>x.maxDelta!==0);
    return {canvas:[optimized.canvas.width,optimized.canvas.height],active,maximum,totalMAE,maximumLargeFraction,
      fallbackErrors:fallbackErrors.length,fallbackErrorExamples:fallbackErrors.slice(0,3),
      cacheAllocated:!!optimized.fragmentedBackdrop,
      direct:stat(samples.direct),optimized:stat(samples.optimized)};
   });
   assert.deepEqual(errors,[]);
   assert.equal(stats.fallbackErrors,0,'Other stages and transitions must remain pixel-identical');
   assert.ok(stats.cacheAllocated,'Fragmented backdrop cache must be allocated');
   assert.ok(stats.totalMAE<.75,'Excessive average image difference: '+stats.totalMAE);
   assert.ok(stats.maximum<=32,'Large individual channel difference: '+stats.maximum);
   assert.ok(stats.maximumLargeFraction<.02,'Too many perceptible color differences: '+stats.maximumLargeFraction);
   // A paired within-run ratio reduces susceptibility to differing CI runners.
   assert.ok(stats.optimized.mean<stats.direct.mean*.9,'No material background composite benefit observed');
   // Export each backing canvas's true pixels. Element screenshots would
   // accidentally capture the *topmost* overlapping canvas in both files.
   const captures=await page.evaluate(()=>{
    const {direct,optimized}=window.__fragmentedCompare;
    for(const r of [direct,optimized]){
     r.setQuality('high');r.base();r.background(35,15000,2,false,false,1);
    }
    return {
     original:direct.canvas.toDataURL('image/png').split(',')[1],
     optimized:optimized.canvas.toDataURL('image/png').split(',')[1]
    };
   });
   const suffix=viewport.width+'x'+viewport.height;
   for(const [version,base64] of Object.entries(captures)){
    fs.writeFileSync('test-results/fragmented-composite/'+suffix+'-'+version+'.png',Buffer.from(base64,'base64'));
   }
   reports.push({viewport,...stats});
   console.log('FRAGMENTED_COMPOSITE_ROW '+JSON.stringify({viewport,...stats}));
   await page.close();
  }
  fs.writeFileSync('test-results/fragmented-composite/results.json',JSON.stringify(reports,null,2));
  console.log('FRAGMENTED_COMPOSITE_SUMMARY '+JSON.stringify(reports.map(x=>({viewport:x.viewport,cache:x.cacheAllocated,
   direct:x.direct.mean,optimized:x.optimized.mean,speedup:x.direct.mean/x.optimized.mean,
   maximum:x.maximum,totalMAE:x.totalMAE,largeFraction:x.maximumLargeFraction,fallbackErrors:x.fallbackErrors}))));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
