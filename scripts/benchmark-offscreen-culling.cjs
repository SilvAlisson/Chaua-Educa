// Exact-pixel control: draw all world sprites vs render-only viewport culling.
// Physics, warning overlays, routes, and entity state are never altered.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const out='test-results/offscreen-culling';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const results=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const report=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {flightViewport}=await import('/js/viewport.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const make=async drawAll=>{
     const canvas=document.createElement('canvas');
     canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(canvas);
     const r=new Renderer(canvas);await r.ready;r.setQuality('high');
     r.drawOffscreenEntitiesForTest=drawAll;
     r.base();r.background(33,8000,0,false,false,1);
     return r;
    };
    const all=await make(true),culled=await make(false);
    const view=flightViewport(all.w,all.h);
    const left=view.worldLeft,right=left+view.worldWidth,middle=(left+right)/2;
    const makeWood=(id,x,snake=true)=>{
     const w={id,kind:'wood',x,top:150,bottom:465,variant:'branch'};
     if(snake){w.snake={age:2,phase:'warning',warningAge:.5};advanceSnake(w,.2,120);}
     return w;
    };
    const makeHawk=(id,x)=>({id,kind:'hawk',x,y:275,startX:x,startY:275,targetX:middle,targetY:265,warning:0,age:2,dive:false});
    const makeFruit=(id,x)=>({id,kind:'fruit',x,y:325,variety:id%3,collected:false,route:12});
    const g=new Game({seed:104});g.state='playing';g.y=320;g.wing=.5;
    g.elapsed=35;g.sceneTime=35;g.stageAge=2;g.distance=9200;
    g.entities=[makeWood(1,middle,true),makeHawk(2,middle+80),makeFruit(3,middle-120),
     makeWood(4,right+325,true),makeWood(5,right+560,true),makeWood(6,left-450,true),
     makeHawk(7,right+190),makeHawk(8,right+410),
     makeFruit(9,right+103),makeFruit(10,right+380),makeFruit(11,left-190)];
    const parity=[];
    for(const quality of ['high','low']){
     for(const r of [all,culled])r.setQuality(quality);
     for(let stage=0;stage<4;stage++)for(const mix of [.35,1]){
      g.stage=stage;g.stageAge=4*mix;
      g.elapsed=35+stage*15+mix;g.sceneTime=g.elapsed;
      for(const r of [all,culled])r.game(g,false,g.sceneTime);
      const a=all.c.getImageData(0,0,all.canvas.width,all.canvas.height).data;
      const b=culled.c.getImageData(0,0,culled.canvas.width,culled.canvas.height).data;
      let changed=0,max=0;
      for(let i=0;i<a.length;i++)if(a[i]!==b[i]){changed++;max=Math.max(max,Math.abs(a[i]-b[i]));}
      parity.push({quality,stage,mix,changed,max});
     }
    }
    for(const r of [all,culled])r.setQuality('high');
    const measurements={all:[],culled:[]};
    for(let i=0;i<130;i++){
     g.stage=1;g.stageAge=1.5+(i%110)/50;
     g.elapsed=39+i/60;g.sceneTime=g.elapsed;
     const order=i%2?[[culled,'culled'],[all,'all']]:[[all,'all'],[culled,'culled']];
     for(const [r,key]of order){
      const start=performance.now();
      r.game(g,false,g.sceneTime);
      r.c.getImageData(0,0,1,1);
      if(i>=12)measurements[key].push(performance.now()-start);
     }
    }
    const stat=a=>{
     const s=[...a].sort((a,b)=>a-b),at=p=>s[Math.floor((s.length-1)*p)];
     return {frames:a.length,meanMs:a.reduce((x,y)=>x+y,0)/a.length,p50Ms:at(.5),p95Ms:at(.95),
      p99Ms:at(.99),above33:a.filter(x=>x>33.33).length};
    };
    return {canvas:[all.canvas.width,all.canvas.height],parityCases:parity.length,
     differences:parity.filter(p=>p.changed>0),baseline:stat(measurements.all),optimized:stat(measurements.culled)};
   });
   assert.deepEqual(errors,[]);
   assert.deepEqual(report.differences,[],'Culling changed pixels including offscreen warning overlays');
   if(viewport.width===1440)assert.ok(report.optimized.meanMs<report.baseline.meanMs*.9,
    'Culling did not materially reduce the cost of a scene with hidden snakes: '+JSON.stringify(report));
   results.push({viewport,...report});
   console.log('OFFSCREEN_CULLING_AB '+JSON.stringify({viewport,...report}));
   await page.close();
  }
  fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
