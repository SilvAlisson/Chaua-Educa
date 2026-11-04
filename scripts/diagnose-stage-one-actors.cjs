// Diagnostic-only controlled Canvas ablation of stage-1 transition elements.
// No visual layer is removed from production. Disabling is local to this page.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const dest='test-results/stage-one-actor-cost';
fs.mkdirSync(dest,{recursive:true});
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
   const canvas=document.createElement('canvas');
   canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
   document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);await r.ready;r.setQuality('high');
   r.base();r.background(39,9200,0,false,false,1);
   const methods=Object.fromEntries(['background','obstacle','snake','hawk','pickup'].map(key=>[key,r[key].bind(r)]));
   let active='full';
   const omit={background:'without-background',obstacle:'without-obstacles',
    snake:'without-snakes',hawk:'without-hawks',pickup:'without-pickups'};
   for(const [method,variant]of Object.entries(omit)){
    r[method]=(...args)=>active===variant?undefined:methods[method](...args);
   }
   const names=['full','without-obstacles','without-snakes','without-hawks','without-pickups','without-background'];
   const g=new Game({seed:104});g.state='playing';g.stage=1;g.stageAge=2.5;g.elapsed=39;g.sceneTime=39;
   g.distance=9200;g.y=320;g.wing=.5;
   const wood={id:1,kind:'wood',x:500,top:140,bottom:455,variant:'branch',snake:{age:2}};
   advanceSnake(wood,.5,100);
   const hawk={id:2,kind:'hawk',x:740,y:280,startX:740,startY:280,targetX:260,targetY:330,warning:0,age:2,dive:false};
   const fruit={id:3,kind:'fruit',x:870,y:320,variety:0,collected:false};
   const pepper={id:4,kind:'pepper',x:670,y:280,collected:false};
   const feather={id:5,kind:'feather',x:1010,y:250,collected:false};
   const getStat=values=>{
    const sorted=[...values].sort((a,b)=>a-b);
    const at=f=>sorted[Math.floor((sorted.length-1)*f)];
    return {frames:values.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,
     p50Ms:at(.5),p95Ms:at(.95),p99Ms:at(.99),
     above16:values.filter(t=>t>16.67).length,above33:values.filter(t=>t>33.33).length};
   };
   const output={};
   for(const density of ['normal','dense']){
    const extraWood={...wood,id:11,x:950,top:125,bottom:465,snake:{age:2}};
    advanceSnake(extraWood,.5,100);
    const extraHawk={...hawk,id:12,x:1050,y:350,startX:1050,startY:350,targetX:320,targetY:375};
    g.entities=density==='normal'?[wood,hawk,fruit,pepper]:
     [wood,extraWood,hawk,extraHawk,fruit,pepper,feather,
      {id:21,kind:'fruit',x:780,y:390,variety:1,collected:false},
      {id:22,kind:'fruit',x:980,y:290,variety:2,collected:false}];
    const collected=Object.fromEntries(names.map(n=>[n,[]]));
    for(let i=0;i<108;i++){
     const time=39+i/60;
     g.elapsed=time;g.sceneTime=time;g.stageAge=2.2+i/120;
     const order=i%2?[...names].reverse():names;
     for(const label of order){
      active=label;
      const start=performance.now();
      r.game(g,false,time);
      r.c.getImageData(0,0,1,1);
      if(i>=12)collected[label].push(performance.now()-start);
     }
    }
    const stats=Object.fromEntries(Object.entries(collected).map(([n,v])=>[n,getStat(v)]));
    output[density]={stats,differences:Object.fromEntries(names.filter(n=>n!=='full').map(n=>[n,{
     savedMeanMs:stats.full.meanMs-stats[n].meanMs,savedP95Ms:stats.full.p95Ms-stats[n].p95Ms
    }]))};
   }
   return {backing:[r.canvas.width,r.canvas.height],deviceRatio:r.dpr,
    note:'Ablations are diagnostics only, effects are not removed from the game. Measured savings are not additive; workload and rasterization overlap.',output};
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(dest+'/stage-one-costs.json',JSON.stringify(result,null,2));
  console.log('STAGE_ONE_ACTOR_ABLATION '+JSON.stringify(result));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
