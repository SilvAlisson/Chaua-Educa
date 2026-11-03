// Paired cost of game() with explicit base() (old) versus game() only (candidate).
// Same browser, artwork, 4 MP backing, actors and forced 1-pixel readback.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const {Game}=await import('/js/engine.mjs');
   const {advanceSnake}=await import('/js/animals.mjs');
   const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);await r.ready;r.setQuality('high');
   const g=new Game({seed:104});g.state='playing';g.distance=15000;g.elapsed=50;g.sceneTime=50;g.y=320;g.wing=.5;g.stage=2;g.stageAge=10;
   const wood={id:1,kind:'wood',x:480,top:145,bottom:465,variant:'branch',snake:{age:2}};
   advanceSnake(wood,.4,g.x);
   g.entities=[wood,{id:2,kind:'hawk',x:650,y:260,startX:650,startY:260,targetX:270,targetY:260,warning:0,age:2,dive:false}];
   const t={old:[],candidate:[]};
   for(let i=0;i<190;i++){
    const order=i%2?['candidate','old']:['old','candidate'];
    for(const path of order){
     g.sceneTime=50+i/60;g.elapsed=g.sceneTime;
     const start=performance.now();
     if(path==='old')r.base();
     r.game(g,false,g.sceneTime);
     r.c.getImageData(0,0,1,1);
     if(i>=20)t[path].push(performance.now()-start);
    }
   }
   const stats=data=>{
    const sorted=[...data].sort((a,b)=>a-b);
    const at=p=>sorted[Math.floor((sorted.length-1)*p)];
    return {frames:data.length,meanMs:data.reduce((a,b)=>a+b,0)/data.length,p50Ms:at(.5),p95Ms:at(.95),maxMs:at(1)};
   };
   return {canvas:[r.canvas.width,r.canvas.height],old:stats(t.old),candidate:stats(t.candidate)};
  });
  assert.deepEqual(errors,[]);
  console.log('CLEAR_AB_RESULT '+JSON.stringify({...result,meanRatio:result.candidate.meanMs/result.old.meanMs,
    note:'Paired within-run Canvas raster plus readback time. Hardware/software dependent; no phone FPS inference.'}));
  await page.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
