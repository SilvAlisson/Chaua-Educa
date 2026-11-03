// Compare opaque and alpha-enabled 2D backings before changing production.
// The Renderer constructor reuses an already-created context for each canvas.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const reports=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const result=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const create=async alpha=>{
     const canvas=document.createElement('canvas');
     canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(canvas);
     canvas.getContext('2d',{alpha}); // Must precede Renderer constructor.
     const r=new Renderer(canvas);await r.ready;
     if(r.c.getContextAttributes?.().alpha!==alpha)throw Error('Canvas alpha option not applied');
     return r;
    };
    const regular=await create(true),opaque=await create(false);
    const {images}=await import('/js/assets.mjs');
    if(!images.get('forest'))throw Error('Forest artwork missing');
    const g=new Game({seed:104});g.state='playing';g.elapsed=45;g.sceneTime=45;g.distance=15000;g.y=320;g.wing=.4;
    const wood={id:1,kind:'wood',x:470,top:155,bottom:465,variant:'branch',snake:{age:2}};
    advanceSnake(wood,.4,g.x);
    g.entities=[wood,{id:2,kind:'hawk',x:650,y:250,startX:650,startY:250,targetX:260,targetY:240,warning:0,age:2,dive:false},
      {id:3,kind:'fruit',x:760,y:300,variety:0,collected:false}];
    let cases=0,differences=0,maxChannelDelta=0;
    for(const quality of ['high','low'])for(let stage=0;stage<4;stage++)
     for(const stageAge of [1,10])for(const reduced of [false,true]){
      g.stage=stage;g.stageAge=stageAge;
      for(const r of [regular,opaque]){r.setQuality(quality);r.game(g,reduced,45);}
      const a=regular.c.getImageData(0,0,regular.canvas.width,regular.canvas.height).data;
      const b=opaque.c.getImageData(0,0,opaque.canvas.width,opaque.canvas.height).data;
      if(a.length!==b.length)throw Error('Mismatch backing size');
      for(let k=0;k<a.length;k++){
       const d=Math.abs(a[k]-b[k]);
       if(d){differences++;maxChannelDelta=Math.max(maxChannelDelta,d);}
      }
      cases++;
     }
    // A paired A/B run with readbacks flushes deferred Canvas raster.
    g.stage=2;g.stageAge=10;
    for(const r of [regular,opaque])r.setQuality('high');
    const times={opaque:[],regular:[]},renderers={opaque,regular};
    for(let iteration=0;iteration<150;iteration++){
     const order=iteration%2?['opaque','regular']:['regular','opaque'];
     for(const kind of order){
      const r=renderers[kind];g.elapsed=35+iteration/60;g.sceneTime=g.elapsed;
      const begin=performance.now();
      r.game(g,false,g.sceneTime);
      r.c.getImageData(0,0,1,1);
      if(iteration>=15)times[kind].push(performance.now()-begin);
     }
    }
    const stat=x=>{const sorted=[...x].sort((a,b)=>a-b);return {
     meanMs:x.reduce((a,b)=>a+b,0)/x.length,
     p50Ms:sorted[Math.floor((sorted.length-1)*.5)],
     p95Ms:sorted[Math.floor((sorted.length-1)*.95)],
     count:x.length
    }};
    return {cases,differences,maxChannelDelta,backing:[regular.canvas.width,regular.canvas.height],
      opaque:stat(times.opaque),regular:stat(times.regular)};
   });
   assert.deepEqual(errors,[]);assert.equal(result.differences,0,'opaque canvas must be pixel-perfect: '+JSON.stringify(result));
   reports.push({viewport,...result});await page.close();
  }
  console.log('OPAQUE_CANVAS_RESULT '+JSON.stringify({browser:browser.version(),reports}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
