// Browser A/B: same Chromium process and runner, alternating prior/current.
// Synchronize Canvas readback once per frame; report timings, never assert speed.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const urls={before:process.env.BASE_GAME_URL,after:process.env.GAME_URL||'http://127.0.0.1:5501/'};
  assert.ok(urls.before,'BASE_GAME_URL is required for controlled A/B');
  const pages={};
  for(const [name,url] of Object.entries(urls)){
   const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(url,{waitUntil:'networkidle'});
   await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;';
    document.body.replaceChildren(canvas);
    const renderer=new Renderer(canvas);await renderer.ready;renderer.setQuality('high');
    window.__pickupAB={renderer,items:[
     {id:71,kind:'fruit',variety:0,x:340,y:300},
     {id:72,kind:'fruit',variety:3,x:540,y:320},
     {id:73,kind:'fruit',variety:6,x:740,y:340},
     {id:74,kind:'pepper',x:930,y:310},
     {id:75,kind:'feather',x:1090,y:350}
    ]};
   });
   pages[name]={page,errors};
  }
  const scenarios=[
   {name:'normal',snow:0,wet:0},
   {name:'rain',snow:0,wet:.75},
   {name:'winter',snow:1,wet:0}
  ];
  const results=[];
  for(const scenario of scenarios){
   for(let round=0;round<4;round++){
    const order=round%2?['after','before']:['before','after'];
    for(const name of order){
     const times=await pages[name].page.evaluate(({snow,wet,round})=>{
      const {renderer,items}=window.__pickupAB,c=renderer.c,sample=[];
      const draw=i=>{
       c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,renderer.canvas.width,renderer.canvas.height);
       c.setTransform(renderer.dpr,0,0,renderer.dpr,0,0);
       for(const item of items)renderer.pickup(item,25+(i+round*200)/60,false,snow,wet);
       c.getImageData(0,0,1,1);
      };
      for(let i=0;i<12;i++)draw(i);
      for(let i=0;i<100;i++){const t=performance.now();draw(i+12);sample.push(performance.now()-t);}
      return sample;
     },{snow:scenario.snow,wet:scenario.wet,round});
     results.push({scenario:scenario.name,version:name,round,times});
    }
   }
  }
  const summary={};
  for(const scenario of scenarios){
   const row={};
   for(const version of ['before','after']){
    const ms=results.filter(x=>x.scenario===scenario.name&&x.version===version).flatMap(x=>x.times).sort((a,b)=>a-b);
    const p=x=>ms[Math.floor((ms.length-1)*x)];
    row[version]={frames:ms.length,medianMs:p(.5),p95Ms:p(.95),p99Ms:p(.99),meanMs:ms.reduce((s,v)=>s+v,0)/ms.length,over33ms:ms.filter(v=>v>33.33).length};
   }
   summary[scenario.name]=row;
  }
  for(const [name,check] of Object.entries(pages))assert.deepEqual(check.errors,[],name+' JavaScript errors');
  fs.mkdirSync('test-results/pickup-ab',{recursive:true});
  const result={browser:browser.version(),viewport:'1440x960@2 capped by renderer',units:'Canvas frame CPU+raster readback, not device FPS',iterations:400,summary};
  fs.writeFileSync('test-results/pickup-ab/pickup-ab.json',JSON.stringify(result,null,2));
  console.log('PICKUP_AB_RESULT '+JSON.stringify(result));
  for(const value of Object.values(pages))await value.page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
